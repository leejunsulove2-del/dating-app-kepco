import React, { useState, useEffect } from 'react';
import { X, Heart, MessageCircle, Building2, MapPin, Sparkles, Calendar, ShieldCheck, ThumbsUp, ThumbsDown, Plus, Flame, Tag, Type, Check, ShieldAlert } from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, ProfileSticker } from '../types';
import { formatDistance, getUserActiveStatus } from '../utils/geo';
import { DatingService } from '../services/datingService';
import { ItemService } from '../services/itemService';
import { AVAILABLE_STICKERS } from '../services/mockProfiles';
import { ReportModal } from './ReportModal';
import { handleAvatarError, getAvatarForUser } from '../utils/avatarUtils';

interface ProfileDetailModalProps {
  user: UserProfile | null;
  currentUserId: string;
  onClose: () => void;
  onStartChat: (targetUser: UserProfile) => void;
  onProfileUpdated?: () => void;
}

const CUSTOM_STICKER_EMOJIS = ['🏷️', '💌', '💬', '✨', '💖', '🎀', '⭐', '🔥', '☕', '🌸'];

export const ProfileDetailModal: React.FC<ProfileDetailModalProps> = ({
  user,
  currentUserId,
  onClose,
  onStartChat,
  onProfileUpdated,
}) => {
  const [hasLiked, setHasLiked] = useState<boolean>(() => {
    return user ? DatingService.hasLiked(currentUserId, user.id) : false;
  });
  const [isMatchAlert, setIsMatchAlert] = useState(false);
  const [popularity, setPopularity] = useState<number>(() => user?.popularity ?? 100);
  const [stickers, setStickers] = useState<Record<string, number>>(() => user?.stickers ?? {});
  const [myGivenStickers, setMyGivenStickers] = useState<string[]>(() => {
    return user ? DatingService.getMyGivenStickers(currentUserId, user.id) : [];
  });
  const [isStickerPickerOpen, setIsStickerPickerOpen] = useState(false);
  const [stickerTab, setStickerTab] = useState<'preset' | 'custom'>('preset');
  const [customEmoji, setCustomEmoji] = useState('🏷️');
  const [customText, setCustomText] = useState('');
  const [popularityNotice, setPopularityNotice] = useState<string | null>(null);
  const [stickerNotice, setStickerNotice] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportSuccessNotice, setReportSuccessNotice] = useState<string | null>(null);

  // Synchronize state whenever user profile or currentUserId changes
  useEffect(() => {
    if (user) {
      setHasLiked(DatingService.hasLiked(currentUserId, user.id));
      setPopularity(user.popularity ?? 100);
      const stickerRes = DatingService.getProfileStickers(currentUserId, user.id);
      setStickers(stickerRes.stickers);
      setMyGivenStickers(stickerRes.myGivenStickers);
      setIsStickerPickerOpen(false);
      setStickerTab('preset');
      setCustomText('');
      setPopularityNotice(null);
      setStickerNotice(null);
      setIsMatchAlert(false);
    }
  }, [user?.id, currentUserId]);

  if (!user) return null;

  const statusInfo = getUserActiveStatus(user.lastActive);
  const isOnline = statusInfo.status === 'online';
  const isSelf = user.id === currentUserId;
  const todayVoteInfo = ItemService.getTodayVoteInfo(currentUserId);
  const hasVotedForThisUser = todayVoteInfo.votedTargetUserId === user.id;
  const canVoteToday = ItemService.canVotePopularityToday(currentUserId) && !isSelf;
  const currentInv = ItemService.getInventory(currentUserId);

  const handleSendHeart = () => {
    const res = DatingService.sendLike(currentUserId, user.id);
    setHasLiked(true);

    if (res.isMatch) {
      setIsMatchAlert(true);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f43f5e', '#ec4899', '#fb7185', '#ffd1dc'],
      });
    } else {
      confetti({
        particleCount: 35,
        spread: 50,
        origin: { y: 0.7 },
        colors: ['#f43f5e', '#fb7185'],
      });
    }
  };

  const handleVotePopularity = (type: 'up' | 'down') => {
    if (isSelf) {
      setPopularityNotice('자신에게는 인기도 투표를 할 수 없습니다.');
      return;
    }

    const res = ItemService.votePopularity(currentUserId, user.id, type);
    setPopularityNotice(res.message);

    if (res.success) {
      setPopularity(res.newPopularity);
      onProfileUpdated?.();

      if (type === 'up') {
        confetti({
          particleCount: 45,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#f59e0b', '#ef4444', '#ec4899'],
        });
      }
    }
  };

  const handleToggleSticker = (stickerKey: string) => {
    const res = ItemService.attachSticker(currentUserId, user.id, stickerKey);
    setStickers(res.stickers);
    setMyGivenStickers(res.myGivenStickers);
    setStickerNotice(res.message);
    onProfileUpdated?.();

    if (res.success && res.action === 'attached') {
      confetti({
        particleCount: 35,
        spread: 50,
        origin: { y: 0.75 },
        colors: ['#ec4899', '#f43f5e', '#a855f7'],
      });
    }

    setTimeout(() => {
      setStickerNotice(null);
    }, 3500);
  };

  const handleAttachCustomTextSticker = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = customText.trim();
    if (!cleanText) {
      setStickerNotice('스티커에 들어갈 문구를 1자 이상 입력해주세요.');
      return;
    }
    if (cleanText.length > 10) {
      setStickerNotice('글자스티커는 최대 10자 이내로 입력해주세요.');
      return;
    }

    const stickerKey = `${customEmoji} ${cleanText}`;
    const res = ItemService.attachSticker(currentUserId, user.id, stickerKey);
    setStickers(res.stickers);
    setMyGivenStickers(res.myGivenStickers);
    setStickerNotice(res.message);
    onProfileUpdated?.();

    if (res.success && res.action === 'attached') {
      setCustomText('');
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.75 },
        colors: ['#ec4899', '#f43f5e', '#a855f7'],
      });
    }

    setTimeout(() => {
      setStickerNotice(null);
    }, 3500);
  };

  return (
    <div id="profile-detail-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div id="profile-detail-container" className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]">
        
        {/* Profile Image & Top Actions */}
        <div className="relative h-56 sm:h-64 w-full bg-stone-900 shrink-0">
          <img
            src={user.photoUrl || getAvatarForUser(user.gender, user.id)}
            alt={user.name}
            onError={(e) => handleAvatarError(e, user.gender, user.id)}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/20 to-black/30"></div>

          {/* Top Action Buttons (Close & Small Report Button) */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {!isSelf && (
              <button
                type="button"
                id="open-report-user-btn"
                onClick={() => setIsReportModalOpen(true)}
                title="부적절한 사용자 신고하기"
                className="px-2.5 py-1 rounded-full bg-black/40 hover:bg-red-600/85 text-white/90 hover:text-white text-[11px] font-medium flex items-center gap-1 backdrop-blur-md transition cursor-pointer border border-white/10 shadow"
              >
                <ShieldAlert className="w-3 h-3 text-red-300" />
                <span>신고</span>
              </button>
            )}

            <button
              type="button"
              id="close-profile-detail-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md transition cursor-pointer border border-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Distance & Online Pill */}
          <div className="absolute top-4 left-4 flex items-center gap-1.5 flex-wrap">
            <span className="bg-rose-500/90 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow">
              <MapPin className="w-3.5 h-3.5" />
              {formatDistance(user.distanceKm)}
            </span>
            <span
              className={`backdrop-blur-md text-white text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 shadow ${
                isOnline ? 'bg-emerald-500/90' : 'bg-amber-500/90'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOnline ? 'bg-white animate-pulse' : 'bg-amber-100'
                }`}
              ></span>
              {isOnline ? '실시간 접속 중' : statusInfo.label}
            </span>
          </div>

          {/* Bottom Title on Image */}
          <div className="absolute bottom-3.5 left-4 right-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-bold">{user.name}</h3>
                <span className="text-base font-medium text-rose-200">만 {user.age}세</span>
                {user.verifiedEmail && (
                  <span title="인증된 회원" className="text-sky-400">
                    <ShieldCheck className="w-5 h-5" />
                  </span>
                )}
              </div>

              {/* Popularity Badge */}
              <div className="flex items-center space-x-1 px-3 py-1 bg-amber-500/30 backdrop-blur-md border border-amber-300/40 rounded-full shadow-inner text-amber-300">
                <Flame className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-xs font-black">인기도 {popularity}</span>
              </div>
            </div>

            <p className="text-xs font-medium text-stone-200 flex items-center gap-1.5 mt-1">
              <Building2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{user.company}</span>
            </p>
          </div>
        </div>

        {/* Profile Details Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Match Banner Alert */}
          {isMatchAlert && (
            <div className="p-3.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-2xl shadow-lg flex items-center justify-between animate-in zoom-in-95">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  축하합니다! 서로 매칭되었습니다 🎉
                </div>
                <p className="text-[11px] text-rose-100">
                  {user.name}님과 지금 바로 1:1 대화를 시작해보세요!
                </p>
              </div>
              <button
                type="button"
                onClick={() => onStartChat(user)}
                className="px-3 py-1.5 bg-white text-rose-600 font-bold text-xs rounded-xl shadow hover:bg-rose-50 transition shrink-0"
              >
                대화하기
              </button>
            </div>
          )}

          {/* 1. Daily Popularity Rating Block (하루 1명 인기도 +1 / -1) */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50/90 to-orange-50/80 border border-amber-200/80">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5">
                <Flame className="w-4 h-4 text-amber-600 fill-amber-500" />
                <span className="text-xs font-bold text-slate-800">일일 인기도 선택</span>
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-200/70 px-2 py-0.5 rounded-full">
                  하루 1명 한정
                </span>
              </div>
              <span className="text-xs font-black text-amber-700">{popularity} 점</span>
            </div>

            {hasVotedForThisUser ? (
              <div className="p-2 bg-amber-100/60 rounded-xl text-center text-xs font-semibold text-amber-800">
                오늘 {user.name}님께 {todayVoteInfo.voteType === 'up' ? '호감(+1) 🔥' : '비추(-1) ❄️'} 투표를 완료했습니다!
              </div>
            ) : !canVoteToday ? (
              <div className="p-2 bg-slate-100 rounded-xl text-center text-xs text-slate-500">
                {isSelf ? '내 프로필에는 투표할 수 없습니다.' : '오늘의 인기도 투표(1일 1명)를 이미 사용하셨습니다.'}
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  id="vote-popularity-up-btn"
                  onClick={() => handleVotePopularity('up')}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center space-x-1.5"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>호감 올리기 (+1)</span>
                </button>
                <button
                  id="vote-popularity-down-btn"
                  onClick={() => handleVotePopularity('down')}
                  className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all active:scale-95 flex items-center justify-center space-x-1"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  <span>-1</span>
                </button>
              </div>
            )}

            {popularityNotice && (
              <p className="text-[11px] text-amber-800 font-medium text-center mt-2 animate-fadeIn">
                {popularityNotice}
              </p>
            )}
          </div>

          {/* 2. Profile Stickers Section (제3자가 붙여주는 스티커 - 3일간 유지) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Tag className="w-3.5 h-3.5 text-rose-500" />
                <h4 className="text-xs font-bold text-stone-600 uppercase tracking-wider">
                  회원들이 붙여준 스티커
                </h4>
                <span className="text-[10px] bg-rose-50 text-rose-600 font-bold px-1.5 py-0.5 rounded-full border border-rose-200">
                  3일간 유지
                </span>
              </div>
              <button
                id="toggle-sticker-picker-btn"
                onClick={() => setIsStickerPickerOpen(!isStickerPickerOpen)}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center space-x-1 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 transition"
              >
                <Plus className="w-3 h-3" />
                <span>스티커 붙이기 (카드 {currentInv.stickerCards ?? 0}장)</span>
              </button>
            </div>

            {/* Sticker Notice Toast */}
            {stickerNotice && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 text-center animate-fadeIn">
                {stickerNotice}
              </div>
            )}

            {/* Sticker Picker Drawer */}
            {isStickerPickerOpen && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-rose-200/80 shadow-sm animate-fadeIn space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-700 font-bold flex items-center gap-1">
                    <span>{user.name}님에게 붙일 스티커 선택:</span>
                  </p>
                  <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    보유 카드: {currentInv.stickerCards ?? 0}장
                  </span>
                </div>

                {/* Sticker Mode Tabs: Preset vs Custom Text */}
                <div className="flex rounded-xl bg-slate-200/70 p-0.5 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setStickerTab('preset')}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 transition ${
                      stickerTab === 'preset'
                        ? 'bg-white text-rose-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>추천 스티커</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStickerTab('custom')}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 transition ${
                      stickerTab === 'custom'
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Type className="w-3 h-3" />
                    <span>글자스티커 직접 만들기</span>
                  </button>
                </div>

                {/* Tab 1: Preset Charm Stickers */}
                {stickerTab === 'preset' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-1.5">
                      {AVAILABLE_STICKERS.map((stk) => {
                        const stickerKey = `${stk.emoji} ${stk.label}`;
                        const isAttachedByMe = myGivenStickers.includes(stickerKey);
                        return (
                          <button
                            key={stk.id}
                            type="button"
                            onClick={() => handleToggleSticker(stickerKey)}
                            className={`p-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center transition border ${
                              isAttachedByMe
                                ? 'bg-rose-500 text-white border-rose-600 shadow-sm'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300'
                            }`}
                          >
                            <span className="text-base">{stk.emoji}</span>
                            <span className="text-[10px] mt-0.5 truncate">{stk.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tab 2: Custom Text Sticker (10자 이내) */}
                {stickerTab === 'custom' && (
                  <form onSubmit={handleAttachCustomTextSticker} className="space-y-2.5 bg-white p-3 rounded-xl border border-rose-100">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        1. 아이콘 선택
                      </label>
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                        {CUSTOM_STICKER_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setCustomEmoji(emoji)}
                            className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center shrink-0 border transition ${
                              customEmoji === emoji
                                ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-300 text-base scale-105'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-700">
                          2. 스티커 문구 입력 (최대 10자)
                        </label>
                        <span className={`text-[10px] font-bold ${
                          customText.length > 10 ? 'text-red-500' : 'text-slate-400'
                        }`}>
                          {customText.length}/10자
                        </span>
                      </div>
                      <div className="relative flex items-center">
                        <span className="absolute left-2.5 text-base select-none">{customEmoji}</span>
                        <input
                          type="text"
                          maxLength={10}
                          value={customText}
                          onChange={(e) => setCustomText(e.target.value)}
                          placeholder="예: 목소리꿀보이스, 센스쟁이"
                          className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-400 focus:bg-white transition"
                        />
                      </div>
                    </div>

                    {/* Live Preview */}
                    {customText.trim() && (
                      <div className="p-2 bg-rose-50/70 rounded-xl flex items-center justify-between text-xs">
                        <span className="text-[10px] font-bold text-rose-700">미리보기:</span>
                        <span className="px-2.5 py-0.5 bg-white text-rose-700 font-bold rounded-full border border-rose-200 shadow-2xs">
                          {customEmoji} {customText.trim()}
                        </span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!customText.trim() || (currentInv.stickerCards ?? 0) <= 0}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition ${
                        !customText.trim() || (currentInv.stickerCards ?? 0) <= 0
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white active:scale-98'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{user.name}님에게 글자스티커 붙이기 (카드 1장)</span>
                    </button>
                  </form>
                )}

                <p className="text-[10px] text-slate-500 text-center italic">
                  💡 {user.name}님 프로필에 부착된 스티커는 3일(72시간) 동안 유지됩니다.
                </p>
              </div>
            )}

            {/* Display Attached Stickers */}
            <div className="flex flex-wrap gap-1.5 min-h-[32px] items-center">
              {Object.entries(stickers).length > 0 ? (
                Object.entries(stickers).map(([label, count]) => {
                  const isGivenByMe = myGivenStickers.includes(label);
                  return (
                    <button
                      key={label}
                      onClick={() => handleToggleSticker(label)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center space-x-1.5 border transition cursor-pointer ${
                        isGivenByMe
                          ? 'bg-rose-100/90 text-rose-800 border-rose-300 ring-1 ring-rose-300 shadow-2xs'
                          : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
                      }`}
                      title={isGivenByMe ? '내가 부착한 스티커 (클릭하여 회수/취소)' : '클릭하여 나도 부착 (3일 지속)'}
                    >
                      <span>{label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${isGivenByMe ? 'bg-rose-500 text-white' : 'bg-stone-300 text-stone-800'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="text-xs text-stone-400 italic py-1">
                  아직 부착된 스티커가 없습니다. 첫 스티커나 나만의 글자스티커를 붙여보세요! (3일간 지속)
                </p>
              )}
            </div>
          </div>

          {/* Self Introduction (자기소개) */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">자기소개</h4>
            <p className="text-sm text-stone-700 leading-relaxed bg-stone-50 p-3 rounded-2xl border border-stone-100">
              {user.bio || '등록된 자기소개가 없습니다.'}
            </p>
          </div>

          {/* Interest Tags (관심사 항목) */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">관심사</h4>
            <div className="flex flex-wrap gap-1.5">
              {user.interests.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-medium rounded-full border border-rose-100/80"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Basic Info Badges */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2.5 bg-stone-50 rounded-2xl border border-stone-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-stone-400 shrink-0" />
              <div className="text-xs">
                <span className="text-stone-400 block text-[10px]">생년월일</span>
                <span className="font-semibold text-stone-700">{user.birthDate}</span>
              </div>
            </div>

            <div className="p-2.5 bg-stone-50 rounded-2xl border border-stone-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-stone-400 shrink-0" />
              <div className="text-xs truncate">
                <span className="text-stone-400 block text-[10px]">직장/소속</span>
                <span className="font-semibold text-stone-700 truncate block">{user.company}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center gap-3 shrink-0">
          <button
            type="button"
            id="send-like-heart-btn"
            onClick={handleSendHeart}
            disabled={hasLiked}
            className={`flex-1 py-3.5 rounded-2xl font-bold text-sm transition flex items-center justify-center gap-2 shadow-md cursor-pointer ${
              hasLiked
                ? 'bg-stone-200 text-stone-500 cursor-default'
                : 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200 active:scale-95'
            }`}
          >
            <Heart className={`w-4 h-4 ${hasLiked ? 'fill-stone-400 text-stone-400' : 'fill-white text-white'}`} />
            <span>{hasLiked ? '좋아요를 보냈습니다' : '좋아요 보내기'}</span>
          </button>

          <button
            type="button"
            id="start-chat-btn"
            onClick={() => onStartChat(user)}
            className="px-5 py-3.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-2xl text-sm transition flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95"
          >
            <MessageCircle className="w-4 h-4" />
            <span>1:1 대화</span>
          </button>
        </div>
      </div>

      {/* Report Modal */}
      {isReportModalOpen && (
        <ReportModal
          isOpen={isReportModalOpen}
          currentUser={{ id: currentUserId } as UserProfile}
          targetUser={user}
          onClose={() => setIsReportModalOpen(false)}
          onReportSubmitted={(msg) => {
            setReportSuccessNotice(msg);
            onProfileUpdated?.();
            setTimeout(() => {
              onClose();
            }, 1800);
          }}
        />
      )}

      {/* Report Success Toast */}
      {reportSuccessNotice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white text-xs px-4 py-3 rounded-2xl shadow-xl border border-stone-700 max-w-sm text-center animate-in fade-in slide-in-from-bottom-4">
          {reportSuccessNotice}
        </div>
      )}
    </div>
  );
};

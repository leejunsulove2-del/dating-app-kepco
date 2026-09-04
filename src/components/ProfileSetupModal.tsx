import React, { useState, useMemo } from 'react';
import { Camera, Building2, Calendar, User, Heart, Sparkles, Check, Plus, AlertCircle, CheckCircle2, ShieldAlert, Dices, Grid, Search, X } from 'lucide-react';
import { UserProfile } from '../types';
import { calculateAge } from '../utils/geo';
import { INITIAL_INTEREST_TAGS } from '../services/mockProfiles';
import { DatingService } from '../services/datingService';
import { AdminService } from '../services/adminService';
import {
  handleAvatarError,
  getAvatarForUser,
  SPECIES_CATEGORIES,
  filterAvatars,
  getRandomAnimalAvatar,
  ANIMAL_AVATARS,
  AnimalAvatarMeta,
} from '../utils/avatarUtils';
import { BirthDatePicker } from './BirthDatePicker';

interface ProfileSetupModalProps {
  isOpen: boolean;
  initialUser: UserProfile;
  onComplete: (completedUser: UserProfile) => void;
}

export const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({
  isOpen,
  initialUser,
  onComplete,
}) => {
  const [name, setName] = useState(initialUser.name || '');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(initialUser.gender || 'female');
  const [birthDate, setBirthDate] = useState(initialUser.birthDate || '1998-05-20');
  const [company, setCompany] = useState(initialUser.company || '');
  const [photoUrl, setPhotoUrl] = useState(
    initialUser.photoUrl || getAvatarForUser(gender, initialUser.id)
  );
  const [bio, setBio] = useState(initialUser.bio || '');
  const [interests, setInterests] = useState<string[]>(initialUser.interests || ['☕ 카페투어', '🍷 와인/위스키']);
  const [customInterest, setCustomInterest] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Animal Avatar Picker States
  const [selectedSpecies, setSelectedSpecies] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFullPickerOpen, setIsFullPickerOpen] = useState<boolean>(false);

  // Filtered avatars for display
  const displayedAvatars = useMemo(() => {
    return filterAvatars(selectedSpecies, searchQuery);
  }, [selectedSpecies, searchQuery]);

  // Current selected avatar metadata
  const currentAvatarMeta = useMemo(() => {
    return ANIMAL_AVATARS.find((a) => a.url === photoUrl);
  }, [photoUrl]);

  if (!isOpen) return null;

  const handleRandomAvatar = () => {
    const random = getRandomAnimalAvatar(selectedSpecies !== 'all' ? selectedSpecies : undefined);
    if (random) {
      setPhotoUrl(random.url);
    }
  };


  const handleInterestToggle = (tag: string) => {
    if (interests.includes(tag)) {
      setInterests(interests.filter((t) => t !== tag));
    } else {
      if (interests.length >= 8) {
        setError('관심사는 최대 8개까지 선택 가능합니다.');
        return;
      }
      setError(null);
      setInterests([...interests, tag]);
    }
  };

  const handleAddCustomInterest = () => {
    if (!customInterest.trim()) return;
    const formatted = customInterest.startsWith('#')
      ? customInterest.trim()
      : `#${customInterest.trim()}`;
    if (!interests.includes(formatted)) {
      setInterests([...interests, formatted]);
    }
    setCustomInterest('');
  };

  // Direct photo upload block with user notice requirement
  const handleDirectUploadAttempt = () => {
    alert('임시로 직접 프로필사진등록 기능을 정지했습니다.');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!photoUrl) {
      setError('프로필 사진은 필수 항목입니다.');
      return;
    }
    if (!name.trim()) {
      setError('이름(닉네임)을 입력해주세요.');
      return;
    }
    if (!birthDate) {
      setError('생년월일은 필수 항목입니다.');
      return;
    }
    if (!company.trim()) {
      setError('기업명(직장명/소속)은 필수 항목입니다.');
      return;
    }

    const calculatedAge = calculateAge(birthDate);
    if (calculatedAge < 19) {
      setError('만 19세 이상만 가입 가능합니다.');
      return;
    }

    const updatedUser: UserProfile = {
      ...initialUser,
      name: name.trim(),
      gender,
      birthDate,
      age: calculatedAge,
      company: company.trim(),
      photoUrl,
      bio: bio.trim() || '안녕하세요! 좋은 인연 만나고 싶어요.',
      interests: interests.length > 0 ? interests : ['☕ 카페투어', '🍣 맛집탐방'],
      lastActive: Date.now(),
    };

    DatingService.saveCurrentUser(updatedUser);
    AdminService.recordBioChange(updatedUser.id, updatedUser, 'user');

    onComplete(updatedUser);
  };

  return (
    <div id="profile-setup-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/75 backdrop-blur-sm overflow-y-auto">
      <div id="profile-setup-container" className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-6 text-white text-center">
          <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
            필수 프로필 등록
          </span>
          <h2 className="text-2xl font-bold">프로필 완성하기</h2>
          <p className="text-rose-100 text-xs mt-1">
            공식 아바타, 생년월일, 소속을 등록하고 인근의 멋진 인연을 만나보세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Official Animal Avatar Selection (525+ Unique SVG Avatars) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-800">
                공식 프로필 캐릭터 (525종 동물 아바타) <span className="text-rose-500">* 필수</span>
              </label>
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                초경량 고화질 SVG 에셋
              </span>
            </div>

            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative shrink-0 text-center">
                  <div className="relative inline-block">
                    <img
                      src={photoUrl || getAvatarForUser(gender, initialUser.id)}
                      alt="Profile Preview"
                      onError={(e) => handleAvatarError(e, gender, initialUser.id)}
                      className="w-24 h-24 rounded-2xl object-cover border-2 border-rose-400 shadow-md bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleRandomAvatar}
                      title="랜덤 동물 아바타 뽑기"
                      className="absolute -bottom-2 -right-2 p-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full shadow-lg transition active:scale-95"
                    >
                      <Dices className="w-4 h-4" />
                    </button>
                  </div>
                  {currentAvatarMeta && (
                    <div className="mt-2 inline-block px-2 py-0.5 bg-white text-[11px] font-bold text-stone-700 rounded-md border border-stone-200 shadow-xs">
                      {currentAvatarMeta.koreanSpecies} · {currentAvatarMeta.name}
                    </div>
                  )}
                </div>

                <div className="w-full space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-stone-700 font-bold">동물 종 선택하기:</p>
                    <button
                      type="button"
                      onClick={() => setIsFullPickerOpen(true)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition"
                    >
                      <Grid className="w-3.5 h-3.5" />
                      전체 둘러보기 (525종)
                    </button>
                  </div>

                  {/* Species Quick Tabs */}
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {SPECIES_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedSpecies(cat.id)}
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium transition flex items-center gap-1 ${
                          selectedSpecies === cat.id
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'bg-white text-stone-600 hover:bg-stone-200 border border-stone-200'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Current Species Preview List */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
                    {displayedAvatars.slice(0, 10).map((avatar) => (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => setPhotoUrl(avatar.url)}
                        title={avatar.name}
                        className={`w-11 h-11 shrink-0 rounded-xl overflow-hidden border-2 transition ${
                          photoUrl === avatar.url
                            ? 'border-rose-500 scale-110 ring-2 ring-rose-200 shadow-md'
                            : 'border-stone-200 hover:border-stone-400 bg-white'
                        }`}
                      >
                        <img
                          src={avatar.url}
                          alt={avatar.name}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                    {displayedAvatars.length > 10 && (
                      <button
                        type="button"
                        onClick={() => setIsFullPickerOpen(true)}
                        className="w-11 h-11 shrink-0 rounded-xl bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center border border-rose-300 hover:bg-rose-200 transition"
                      >
                        +{displayedAvatars.length - 10}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-stone-200/60 text-xs">
                <button
                  type="button"
                  onClick={handleRandomAvatar}
                  className="inline-flex items-center gap-1.5 text-stone-600 hover:text-rose-600 font-medium transition"
                >
                  <Dices className="w-3.5 h-3.5 text-rose-500" />
                  랜덤 추천 아바타 뽑기
                </button>
                <button
                  type="button"
                  onClick={handleDirectUploadAttempt}
                  className="text-stone-400 hover:text-stone-500 text-[11px] inline-flex items-center gap-1"
                >
                  <Camera className="w-3 h-3" />
                  직접 사진등록 안내
                </button>
              </div>
            </div>
          </div>

          {/* Name & Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                닉네임 / 이름 <span className="text-rose-500">* 필수</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  id="profile-name-input"
                  type="text"
                  required
                  placeholder="예: 김민지"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">성별</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setGender('female');
                    setPhotoUrl(getAvatarForUser('female', 0));
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                    gender === 'female' ? 'bg-rose-500 text-white shadow-sm' : 'bg-stone-50 border border-stone-200 text-stone-600'
                  }`}
                >
                  여성
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGender('male');
                    setPhotoUrl(getAvatarForUser('male', 1));
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                    gender === 'male' ? 'bg-blue-500 text-white shadow-sm' : 'bg-stone-50 border border-stone-200 text-stone-600'
                  }`}
                >
                  남성
                </button>
              </div>
            </div>
          </div>

          {/* Birth Date & Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                생년월일 (연도 / 월 / 일) <span className="text-rose-500">* 필수</span>
              </label>
              <BirthDatePicker
                value={birthDate}
                onChange={(val) => setBirthDate(val)}
                theme="light"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                기업명 / 소속 <span className="text-rose-500">* 필수</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  id="profile-company-input"
                  type="text"
                  required
                  placeholder="예: 한국전력공사"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">한 줄 소개</label>
            <textarea
              id="profile-bio-input"
              rows={2}
              placeholder="자신을 표현하는 매력적인 소개글을 남겨보세요."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full p-3 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
            />
          </div>

          {/* Interests */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-800">관심사 키워드 (최대 8개)</label>
              <span className="text-[11px] text-stone-500">{interests.length}/8 선택됨</span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
              {INITIAL_INTEREST_TAGS.map((tag) => {
                const isSelected = interests.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleInterestToggle(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1 ${
                      isSelected
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    {tag}
                  </button>
                );
              })}
            </div>

            {/* Custom Tag Input */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="직접 관심사 추가 (예: 클라이밍)"
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomInterest();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-rose-500"
              />
              <button
                type="button"
                onClick={handleAddCustomInterest}
                className="px-3 py-1.5 bg-stone-800 text-white rounded-xl text-xs font-semibold hover:bg-stone-700 transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                추가
              </button>
            </div>
          </div>

          <button
            id="profile-setup-submit-btn"
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-sm rounded-2xl shadow-lg shadow-rose-200 transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>프로필 저장하고 시작하기</span>
          </button>
        </form>

        {/* Full 525+ Animal Avatars Selection Modal */}
        {isFullPickerOpen && (
          <div className="fixed inset-0 z-60 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    🐾
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">525종 동물 공식 캐릭터 둘러보기</h3>
                    <p className="text-[11px] text-stone-500">마음에 드는 귀여운 동물 캐릭터를 자유롭게 골라보세요</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFullPickerOpen(false)}
                  className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-full transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search & Species Filter Bar */}
              <div className="p-3 border-b border-stone-200 space-y-2 bg-white">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    placeholder="동물 종 또는 이름 검색 (예: 여우, 곰, 늑대, 기린, 토끼...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {SPECIES_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedSpecies(cat.id)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1 shrink-0 ${
                        selectedSpecies === cat.id
                          ? 'bg-rose-500 text-white shadow-xs'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Avatars Grid */}
              <div className="p-4 overflow-y-auto flex-1 bg-stone-50/50">
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-3">
                  {displayedAvatars.map((avatar) => {
                    const isSelected = photoUrl === avatar.url;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => {
                          setPhotoUrl(avatar.url);
                          setIsFullPickerOpen(false);
                        }}
                        className={`group flex flex-col items-center p-2 rounded-2xl bg-white border transition duration-150 relative ${
                          isSelected
                            ? 'border-rose-500 ring-2 ring-rose-400/40 shadow-md bg-rose-50/30'
                            : 'border-stone-200 hover:border-rose-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="w-14 h-14 rounded-xl overflow-hidden mb-1.5 bg-stone-100 relative">
                          <img
                            src={avatar.url}
                            alt={avatar.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-rose-500/20 flex items-center justify-center">
                              <CheckCircle2 className="w-5 h-5 text-rose-600 bg-white rounded-full" />
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-stone-700 truncate w-full text-center leading-tight">
                          {avatar.name}
                        </span>
                        <span className="text-[9px] text-stone-400">
                          {avatar.koreanSpecies}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {displayedAvatars.length === 0 && (
                  <div className="py-12 text-center text-stone-400 space-y-2">
                    <AlertCircle className="w-8 h-8 mx-auto text-stone-300" />
                    <p className="text-xs">검색 조건과 일치하는 동물 아바타가 없습니다.</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-stone-200 bg-white flex items-center justify-between text-xs">
                <span className="text-stone-500 font-medium">
                  검색된 캐릭터: <strong className="text-rose-600">{displayedAvatars.length}</strong>개
                </span>
                <button
                  type="button"
                  onClick={() => setIsFullPickerOpen(false)}
                  className="px-4 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-xl font-bold transition"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

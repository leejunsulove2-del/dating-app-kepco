import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertOctagon, Clock, Gift, Check, LogOut, Sparkles } from 'lucide-react';
import { UserProfile, UserRewardNotice } from '../types';
import { ItemService } from '../services/itemService';
import { DatingService } from '../services/datingService';

interface SanctionNoticeModalProps {
  user: UserProfile;
  onLogout: () => void;
  onRewardClaimed?: () => void;
}

export const SanctionNoticeModal: React.FC<SanctionNoticeModalProps> = ({
  user,
  onLogout,
  onRewardClaimed,
}) => {
  const [remainingTimeText, setRemainingTimeText] = useState('');
  const [isPermanent, setIsPermanent] = useState(false);

  const now = Date.now();
  const isBanned = Boolean(user.isBanned || (user.sanctionCount && user.sanctionCount >= 10));
  const isUnderSanction = Boolean(
    isBanned || (user.sanctionExpiresAt && user.sanctionExpiresAt > now)
  );

  // Unclaimed rewards from admin
  const unclaimedNotices = (user.rewardNotices || []).filter((n) => !n.claimed);

  useEffect(() => {
    if (isBanned) {
      setIsPermanent(true);
      setRemainingTimeText('무제한 (영구 정지)');
      return;
    }

    if (!user.sanctionExpiresAt) return;

    const updateTimer = () => {
      const currentNow = Date.now();
      const diffMs = (user.sanctionExpiresAt || 0) - currentNow;

      if (diffMs <= 0) {
        setRemainingTimeText('제재 만료됨 (새로고침 시 자동 해제)');
      } else {
        const hours = Math.floor(diffMs / (3600 * 1000));
        const minutes = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
        const seconds = Math.floor((diffMs % (60 * 1000)) / 1000);
        setRemainingTimeText(`${hours}시간 ${minutes}분 ${seconds}초 남음`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [user.sanctionExpiresAt, isBanned]);

  if (!isUnderSanction && unclaimedNotices.length === 0) {
    return null;
  }

  // Handle claiming admin compensation rewards
  const handleClaimRewardNotice = (noticeId: string) => {
    const updatedUser = DatingService.getCurrentUser();
    if (updatedUser && updatedUser.rewardNotices) {
      const targetNotice = updatedUser.rewardNotices.find((n) => n.id === noticeId);
      if (targetNotice) {
        targetNotice.claimed = true;
        DatingService.saveCurrentUser(updatedUser);
        onRewardClaimed?.();
      }
    }
  };

  // If only has compensation reward notice to show (not under sanction)
  if (!isUnderSanction && unclaimedNotices.length > 0) {
    const notice = unclaimedNotices[0];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-rose-100 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-400 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-amber-200">
            <Gift className="w-9 h-9 animate-bounce" />
          </div>
          <div className="space-y-1">
            <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
              🎁 관리자 보상 지급 알림
            </span>
            <h3 className="text-xl font-bold text-stone-900">환영박스 {notice.rewardBoxes}개가 지급되었습니다!</h3>
            <p className="text-xs text-stone-600 bg-stone-50 p-3 rounded-2xl border border-stone-200 mt-2">
              "{notice.noticeMessage}"
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleClaimRewardNotice(notice.id)}
            className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white text-xs font-bold rounded-2xl shadow-lg shadow-rose-200 transition cursor-pointer"
          >
            보상 확인 및 계속하기
          </button>
        </div>
      </div>
    );
  }

  // Active Sanction Notice Modal (Blocks access)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/90 backdrop-blur-md">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-red-200 overflow-hidden text-stone-800">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 p-6 text-white text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
            {isPermanent ? (
              <AlertOctagon className="w-8 h-8 text-white" />
            ) : (
              <ShieldAlert className="w-8 h-8 text-white" />
            )}
          </div>
          <h3 className="text-xl font-bold">
            {isPermanent ? '계정 영구 접속 차단 안내' : '서비스 이용 제한(제재) 안내'}
          </h3>
          <p className="text-xs text-rose-100">
            {isPermanent
              ? '누적 10회 제재 또는 허위신고 3회 누적으로 인해 영구 차단되었습니다.'
              : '신고 접수로 인해 서비스 이용이 일시적으로 제한되었습니다.'}
          </p>
        </div>

        {/* Body Details */}
        <div className="p-6 space-y-4">
          <div className="p-4 bg-red-50/80 border border-red-100 rounded-2xl space-y-2 text-xs">
            <div className="flex justify-between items-center text-red-900 font-bold">
              <span>제재 누적 차수:</span>
              <span className="text-sm text-red-600 font-black">{user.sanctionCount || 1} / 10회</span>
            </div>
            <div className="flex justify-between items-center text-stone-700">
              <span>제재 사유:</span>
              <span className="font-semibold text-stone-900">{user.sanctionReason || '이용약관 및 커뮤니티 가이드라인 위반'}</span>
            </div>
            <div className="flex justify-between items-center text-stone-700 pt-1 border-t border-red-200/60">
              <span className="flex items-center gap-1 text-red-800 font-semibold">
                <Clock className="w-3.5 h-3.5" />
                남은 제한 시간:
              </span>
              <span className="font-bold text-red-600 font-mono">{remainingTimeText}</span>
            </div>
          </div>

          <div className="p-3 bg-stone-50 rounded-2xl text-[11px] text-stone-500 leading-relaxed space-y-1">
            <p className="font-bold text-stone-700">📌 이용 제재 누적 정책 안내</p>
            <p>1회차 1시간, 2회차 2시간, ... 10회차 도달 시 계정이 영구 접속 차단되며 가입이 중지됩니다.</p>
            <p>허위 신고로 인한 억울한 제재인 경우, 관리자 심사를 거쳐 제재 감경 및 보상 상자가 지급됩니다.</p>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="w-full py-3 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Gift, Clock, Sparkles, X, CheckCircle, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ItemService, TimeRewardStatus } from '../services/itemService';
import { UserProfile } from '../types';

interface TimeRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onInventoryUpdated: () => void;
  onOpenBoxModal?: () => void;
}

export const TimeRewardModal: React.FC<TimeRewardModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onInventoryUpdated,
  onOpenBoxModal,
}) => {
  const [justClaimed, setJustClaimed] = useState(false);
  const [awardedCount, setAwardedCount] = useState(1);

  if (!isOpen) return null;

  const status: TimeRewardStatus = ItemService.getTimeRewardStatus(currentUser.id);

  const handleClaim = () => {
    const res = ItemService.claimTimeReward(currentUser.id);
    if (res.success) {
      setJustClaimed(true);
      setAwardedCount(res.awardedCount);
      onInventoryUpdated();

      try {
        confetti({
          particleCount: status.isWeekendOrHoliday ? 120 : 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: status.isWeekendOrHoliday
            ? ['#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6']
            : ['#f59e0b', '#10b981', '#f43f5e'],
        });
      } catch {}
    }
  };

  return (
    <div
      id="time-reward-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
      >
        {/* Header decoration */}
        <div
          className={`relative px-5 pt-6 pb-5 text-white text-center ${
            status.isWeekendOrHoliday
              ? 'bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600'
              : 'bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500'
          }`}
        >
          <button
            type="button"
            id="close-time-reward-modal-btn"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-black/15 hover:bg-black/25 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl mb-2 shadow-inner">
            {status.isWeekendOrHoliday ? (
              <Sparkles className="w-6 h-6 text-amber-200" />
            ) : (
              <Clock className="w-6 h-6 text-amber-100" />
            )}
          </div>

          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-white/25 rounded-full backdrop-blur-sm">
              {status.isWeekendOrHoliday ? '주말 / 공휴일 특별 혜택' : '평일 점심시간 한정 혜택'}
            </span>
          </div>

          <h2 className="text-xl font-bold tracking-tight">{status.title}</h2>
          <p className="text-white/80 text-xs mt-0.5">{status.description}</p>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4">
          {/* Reward Item Badge */}
          <div
            className={`p-4 rounded-2xl border flex items-center space-x-3.5 ${
              status.isWeekendOrHoliday
                ? 'bg-purple-50/80 border-purple-200'
                : 'bg-amber-50/80 border-amber-200'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm shrink-0 ${
                status.isWeekendOrHoliday
                  ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
                  : 'bg-gradient-to-br from-amber-400 to-orange-500'
              }`}
            >
              🎁
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-black text-slate-900">
                  {status.isWeekendOrHoliday ? '주말 보상 환영박스' : '점심 보상 환영박스'}
                </span>
                <span
                  className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                    status.isWeekendOrHoliday
                      ? 'bg-purple-200 text-purple-950 ring-1 ring-purple-300'
                      : 'bg-amber-200 text-amber-950'
                  }`}
                >
                  {status.isWeekendOrHoliday ? 'x3 특별지급' : '100% 지급'}
                </span>
              </div>
              <p className="text-sm font-extrabold text-slate-800 mt-0.5">
                신비한 환영박스{' '}
                <span
                  className={`font-black ${
                    status.isWeekendOrHoliday ? 'text-purple-600 text-base' : 'text-amber-600'
                  }`}
                >
                  {status.boxCountToAward}개
                </span>
                {status.isWeekendOrHoliday && (
                  <span className="ml-1 text-xs font-bold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded">
                    (x3)
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                {status.isWeekendOrHoliday
                  ? '주말 종일 1회 수령 가능 (3개 일괄 지급)'
                  : '평일 점심 11:30 ~ 13:00 접속 시 1회 수령 가능'}
              </p>
            </div>
          </div>

          {/* Action Area */}
          {!status.isClaimedToday && !justClaimed ? (
            <button
              id="claim-time-reward-btn"
              onClick={handleClaim}
              className={`w-full py-3.5 text-white text-sm font-black rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center space-x-2 cursor-pointer ${
                status.isWeekendOrHoliday
                  ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-purple-500/25'
                  : 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 shadow-amber-500/25'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>
                {status.isWeekendOrHoliday
                  ? '주말 특별 보상 받기 (환영박스 x3)'
                  : '점심시간 보상받기 (환영박스 1개)'}
              </span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center space-x-2.5 text-emerald-800">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold">오늘 시간대 보상 수령 완료!</p>
                  <p className="text-emerald-700 text-[11px]">
                    환영박스 {justClaimed ? awardedCount : status.boxCountToAward}개가 보관함에
                    지급되었습니다.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                {onOpenBoxModal && (
                  <button
                    id="open-time-reward-box-btn"
                    onClick={() => {
                      onClose();
                      onOpenBoxModal();
                    }}
                    className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-105 text-slate-950 text-xs font-black rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    환영박스 바로 열기 🎁
                  </button>
                )}
                <button
                  type="button"
                  id="confirm-time-reward-btn"
                  onClick={onClose}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

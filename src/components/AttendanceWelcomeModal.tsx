import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Gift, Sparkles, X, CheckCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ItemService } from '../services/itemService';
import { UserProfile } from '../types';

interface AttendanceWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onInventoryUpdated: () => void;
  onOpenBoxModal?: () => void;
}

export const AttendanceWelcomeModal: React.FC<AttendanceWelcomeModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onInventoryUpdated,
  onOpenBoxModal,
}) => {
  const [justClaimed, setJustClaimed] = useState(false);

  if (!isOpen) return null;

  const daily = ItemService.getDailyActivity(currentUser.id);

  const handleClaimAttendance = () => {
    const res = ItemService.claimDailyAttendance(currentUser.id);
    onInventoryUpdated();

    if (res.success) {
      setJustClaimed(true);
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
      >
        {/* Header decoration */}
        <div className="relative bg-gradient-to-br from-amber-500 via-rose-500 to-pink-500 px-5 pt-6 pb-5 text-white text-center">
          <button
            id="close-attendance-modal-btn"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-black/15 hover:bg-black/25 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl mb-2 shadow-inner">
            <Gift className="w-6 h-6 text-amber-100" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">오늘의 출석 체크</h2>
          <p className="text-rose-100 text-xs mt-0.5">
            매일 1회 출석하고 환영박스 보상을 받으세요!
          </p>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4">
          {/* Reward Item Badge */}
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl shadow-sm shrink-0">
              🎁
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-black text-amber-900">오늘의 출석 보상</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded-md">
                  100% 지급
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-700 mt-0.5">
                신비한 환영박스 1개
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                개봉 시 안테나/메시지증가권 등 랜덤 획득
              </p>
            </div>
          </div>

          {/* Action Area */}
          {!daily.attendanceClaimed && !justClaimed ? (
            <button
              id="claim-attendance-btn"
              onClick={handleClaimAttendance}
              className="w-full py-3.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white text-sm font-black rounded-2xl shadow-lg shadow-rose-500/25 transition-all active:scale-[0.98] flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>오늘의 출석체크 받기</span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center space-x-2.5 text-emerald-800">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold">오늘 출석 완료!</p>
                  <p className="text-emerald-700 text-[11px]">환영박스가 보관함에 지급되었습니다.</p>
                </div>
              </div>

              <div className="flex gap-2">
                {onOpenBoxModal && (
                  <button
                    id="open-box-now-btn"
                    onClick={() => {
                      onClose();
                      onOpenBoxModal();
                    }}
                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    환영박스 바로 열기 🎁
                  </button>
                )}
                <button
                  id="confirm-attendance-btn"
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

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Backpack, X, Clock, PlusCircle, Sparkles, Zap, Gift, Check, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ItemService, ITEM_DEFINITIONS } from '../services/itemService';
import { UserProfile, ItemId } from '../types';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onInventoryUpdated: () => void;
  onOpenBoxModal: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onInventoryUpdated,
  onOpenBoxModal,
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [remainingBoostMins, setRemainingBoostMins] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const updateTime = () => {
      setRemainingBoostMins(ItemService.getRemainingBoostMinutes(currentUser.id));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, [isOpen, currentUser.id]);

  if (!isOpen) return null;

  const inv = ItemService.getInventory(currentUser.id);
  const daily = ItemService.getDailyActivity(currentUser.id);
  const remainingMessages = ItemService.getRemainingMessagesToday(currentUser.id);
  const totalMessageQuota = ItemService.getDailyTotalMessageLimit(currentUser.id);
  const isBoostActive = ItemService.isBoostRadiusActive(currentUser.id);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleUseAntenna = () => {
    const res = ItemService.activateBroadSearchAntenna(currentUser.id);
    showToast(res.message);
    if (res.success) {
      onInventoryUpdated();
      setRemainingBoostMins(ItemService.getRemainingBoostMinutes(currentUser.id));
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch {}
    }
  };

  const handleUseMessageTicket = () => {
    const res = ItemService.useMessageTicket(currentUser.id);
    showToast(res.message);
    if (res.success) {
      onInventoryUpdated();
      try {
        confetti({
          particleCount: 50,
          spread: 60,
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
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-5 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-2xl border border-indigo-500/30">
              <Backpack className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">내 아이템 보관함</h3>
              <p className="text-xs text-slate-400">보유한 소모성 아이템과 활성 효과를 확인하세요</p>
            </div>
          </div>
          <button
            id="close-inventory-modal-btn"
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body with smooth scrolling and bottom safety padding */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 overscroll-contain">
          {toastMessage && (
            <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs font-semibold text-indigo-900 text-center animate-fadeIn shadow-sm">
              {toastMessage}
            </div>
          )}

          {/* Active Status Dashboard */}
          <div className="grid grid-cols-2 gap-3">
            {/* Search Radius Status */}
            <div className={`p-4 rounded-2xl border ${isBoostActive ? 'bg-rose-50/80 border-rose-200 ring-2 ring-rose-300/40' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-500">광역 안테나 상태</span>
                {isBoostActive && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 bg-rose-500 text-white rounded-full animate-pulse">
                    안테나 ON
                  </span>
                )}
              </div>
              <div className="flex items-baseline space-x-1">
                <span className={`text-2xl font-black ${isBoostActive ? 'text-rose-600' : 'text-slate-800'}`}>
                  {isBoostActive ? '자유 조절' : '기본 1.0'}
                </span>
                <span className="text-xs font-bold text-slate-500">{isBoostActive ? '(최대 30km)' : 'km'}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>
                  {isBoostActive ? `버프 종료까지 ${remainingBoostMins}분` : '기본 1km 제한 적용'}
                </span>
              </p>
            </div>

            {/* Daily Message Quota Status */}
            <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-indigo-700">오늘 메시지 전송</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-200 text-indigo-800 rounded-full">
                  일일 한도
                </span>
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-black text-indigo-700">{remainingMessages}</span>
                <span className="text-xs font-bold text-indigo-400">/ {totalMessageQuota}회 남음</span>
              </div>
              <p className="text-[11px] text-indigo-600/80 mt-1">
                오늘 {daily.messagesSentToday || 0}회 발송됨
              </p>
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">보유 소모성 아이템</h4>

            {/* 1. Welcome Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200 flex items-center justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl shadow-sm">
                  🎁
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h5 className="text-sm font-bold text-slate-900">환영박스</h5>
                    <span className="text-xs font-black px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full">
                      {inv.welcomeBoxes}개 보유
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">개봉 시 소모성 아이템 3종 중 1종 랜덤 획득</p>
                </div>
              </div>
              <button
                id="open-welcome-box-from-inv"
                onClick={() => {
                  onClose();
                  onOpenBoxModal();
                }}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                개봉하기
              </button>
            </div>

            {/* 2. Broad Search Antenna */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center text-2xl text-white shadow-sm">
                  📡
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h5 className="text-sm font-bold text-slate-900">광역 검색 안테나</h5>
                    <span className="text-xs font-black px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full">
                      {inv.boostAntennas}개 보유
                    </span>
                    {isBoostActive && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 bg-rose-500 text-white rounded-full animate-pulse">
                        {remainingBoostMins}분 남음
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">1시간 동안 반경을 원하는 거리로 늘리거나 줄일 수 있음</p>
                </div>
              </div>
              <button
                id="use-antenna-item-btn"
                onClick={handleUseAntenna}
                disabled={inv.boostAntennas <= 0}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                {isBoostActive ? '+1시간 연장' : '1개 사용'}
              </button>
            </div>

            {/* 3. Message Ticket */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-2xl text-white shadow-sm">
                  ✉️
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h5 className="text-sm font-bold text-slate-900">메시지 횟수 증가권</h5>
                    <span className="text-xs font-black px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full">
                      {inv.messageTickets}장 보유
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">오늘 메시지 전송 가능 횟수를 +1회 추가 충전</p>
                </div>
              </div>
              <button
                id="use-message-ticket-btn"
                onClick={handleUseMessageTicket}
                disabled={inv.messageTickets <= 0}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                1장 사용
              </button>
            </div>

            {/* 4. Popularity Message Item */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl text-white shadow-sm">
                  ✨
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h5 className="text-sm font-bold text-slate-900">인기도 메시지</h5>
                    <span className="text-xs font-black px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full">
                      {inv.popularityMessages}개 보유
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">채팅방에서 호감 메시지 전송 시 상대 인기도 +1 증가</p>
                </div>
              </div>
              <span className="text-[11px] text-purple-600 font-semibold bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                채팅방에서 사용
              </span>
            </div>

            {/* 5. Sticker Placement Card Item */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-2xl text-white shadow-sm">
                  🔖
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h5 className="text-sm font-bold text-slate-900">스티커 붙이기 카드</h5>
                    <span className="text-xs font-black px-2 py-0.5 bg-pink-100 text-pink-800 rounded-full">
                      {inv.stickerCards ?? 0}장 보유
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded-md border border-rose-200">
                      3일간 지속
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">상대 프로필에 매력 스티커 부착 시 1장 소모 (3일 유지)</p>
                </div>
              </div>
              <span className="text-[11px] text-pink-600 font-semibold bg-pink-50 px-2.5 py-1 rounded-lg border border-pink-100">
                프로필에서 사용
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-1.5">
            <Gift className="w-4 h-4 text-amber-500" />
            <span>매일 자정 출석체크로 환영박스가 충전됩니다</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 font-bold text-slate-800 rounded-xl"
          >
            닫기
          </button>
        </div>
      </motion.div>
    </div>
  );
};

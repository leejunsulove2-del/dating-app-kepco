import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PackageOpen, X, Sparkles, Gift } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ItemService, ITEM_DEFINITIONS } from '../services/itemService';
import { ItemId, UserProfile } from '../types';

interface BoxOpenModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onInventoryUpdated: () => void;
}

export const BoxOpenModal: React.FC<BoxOpenModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onInventoryUpdated,
}) => {
  const [isOpening, setIsOpening] = useState(false);
  const [openedItem, setOpenedItem] = useState<{ id: ItemId; info: typeof ITEM_DEFINITIONS[ItemId] } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const inventory = ItemService.getInventory(currentUser.id);

  const handleOpenBox = () => {
    if (inventory.welcomeBoxes <= 0) {
      setErrorMessage('보유한 환영박스가 없습니다.');
      return;
    }

    setIsOpening(true);
    setOpenedItem(null);
    setErrorMessage(null);

    // Box opening effect
    setTimeout(() => {
      const res = ItemService.openWelcomeBox(currentUser.id);
      setIsOpening(false);

      if (res.success && res.awardedItem && res.itemInfo) {
        setOpenedItem({
          id: res.awardedItem,
          info: res.itemInfo,
        });
        onInventoryUpdated();

        try {
          confetti({
            particleCount: 90,
            spread: 80,
            origin: { y: 0.6 },
          });
        } catch {}
      } else {
        setErrorMessage(res.message);
      }
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 rounded-3xl shadow-2xl overflow-hidden border border-slate-700/70 text-white"
      >
        {/* Subtle background glow */}
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-rose-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="relative px-5 pt-5 pb-3 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center space-x-2">
            <Gift className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold tracking-tight text-amber-100">환영박스 개봉</h3>
          </div>
          <button
            id="close-box-open-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Header Info */}
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-medium text-slate-400">보유 환영박스</span>
            <span className="font-extrabold text-amber-400 text-sm bg-slate-800/90 px-3 py-1 rounded-full border border-slate-700">
              {inventory.welcomeBoxes}개
            </span>
          </div>

          {errorMessage && (
            <div className="p-2.5 bg-rose-950/80 border border-rose-800 rounded-xl text-xs text-rose-300 text-center">
              {errorMessage}
            </div>
          )}

          {/* Box Animation / Reward Area */}
          <div className="py-4 flex flex-col items-center justify-center min-h-[160px]">
            <AnimatePresence mode="wait">
              {openedItem ? (
                <motion.div
                  key="reward"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  className="p-4 bg-slate-800/90 rounded-2xl border border-amber-400/40 w-full text-center shadow-lg"
                >
                  <div className="text-4xl mb-1.5 animate-bounce">{openedItem.info.icon}</div>
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 bg-amber-400/20 text-amber-300 rounded-full mb-1">
                    {openedItem.info.badge}
                  </span>
                  <h4 className="text-base font-bold text-amber-300">{openedItem.info.name}</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {openedItem.info.description}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="box"
                  animate={
                    isOpening
                      ? { rotate: [0, -15, 15, -15, 15, 0], scale: [1, 1.2, 0.9, 1.15, 1] }
                      : { y: [0, -8, 0] }
                  }
                  transition={
                    isOpening
                      ? { duration: 0.9, repeat: 1 }
                      : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                  }
                  className="cursor-pointer select-none text-7xl my-2 drop-shadow-[0_10px_20px_rgba(245,158,11,0.2)]"
                  onClick={inventory.welcomeBoxes > 0 && !isOpening ? handleOpenBox : undefined}
                >
                  🎁
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Buttons */}
          <div className="pt-1">
            {openedItem ? (
              <div className="flex gap-2">
                <button
                  id="open-another-box-btn"
                  onClick={() => {
                    setOpenedItem(null);
                    if (inventory.welcomeBoxes > 0) {
                      handleOpenBox();
                    }
                  }}
                  disabled={inventory.welcomeBoxes <= 0}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-orange-400 hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-black rounded-xl transition-all shadow-md cursor-pointer"
                >
                  {inventory.welcomeBoxes > 0 ? `하나 더 개봉 (${inventory.welcomeBoxes}개)` : '박스 소진됨'}
                </button>
                <button
                  id="confirm-reward-btn"
                  onClick={onClose}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  확인
                </button>
              </div>
            ) : (
              <button
                id="open-welcome-box-action-btn"
                onClick={handleOpenBox}
                disabled={inventory.welcomeBoxes <= 0 || isOpening}
                className="w-full py-3.5 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-sm font-black rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center space-x-2 cursor-pointer"
              >
                <PackageOpen className="w-4 h-4" />
                <span>
                  {isOpening
                    ? '상자 개봉 중...'
                    : inventory.welcomeBoxes > 0
                    ? `환영박스 개봉하기 (${inventory.welcomeBoxes}개)`
                    : '보유한 환영박스가 없습니다'}
                </span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

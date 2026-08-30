import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, SlidersHorizontal, RotateCcw, Check, Trash2, UserPlus, Users, Radio, Sparkles, Clock, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { FilterOptions, UserProfile } from '../types';
import { INITIAL_INTEREST_TAGS } from '../services/mockProfiles';
import { ItemService } from '../services/itemService';

interface FilterDrawerProps {
  isOpen: boolean;
  filter: FilterOptions;
  onChange: (filter: FilterOptions) => void;
  onClose: () => void;
  currentUser?: UserProfile | null;
  onInventoryUpdated?: () => void;
  hasTestAccounts?: boolean;
  onDeleteTestAccounts?: () => void;
  onRecreateTestAccounts?: () => void;
  onResetAndRecreateTestAccounts?: () => void;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  filter,
  onChange,
  onClose,
  currentUser,
  onInventoryUpdated,
  hasTestAccounts = true,
  onDeleteTestAccounts,
  onRecreateTestAccounts,
  onResetAndRecreateTestAccounts,
}) => {
  const [pendingRadiusPrompt, setPendingRadiusPrompt] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAntennaActive = currentUser ? ItemService.isBoostRadiusActive(currentUser.id) : false;
  const remainingMins = currentUser ? ItemService.getRemainingBoostMinutes(currentUser.id) : 0;
  const inv = currentUser ? ItemService.getInventory(currentUser.id) : null;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleInterestToggle = (tag: string) => {
    if (filter.selectedInterests.includes(tag)) {
      onChange({
        ...filter,
        selectedInterests: filter.selectedInterests.filter((t) => t !== tag),
      });
    } else {
      onChange({
        ...filter,
        selectedInterests: [...filter.selectedInterests, tag],
      });
    }
  };

  const handleReset = () => {
    onChange({
      maxDistanceKm: isAntennaActive ? 10 : 1,
      minAge: 20,
      maxAge: 40,
      selectedInterests: [],
      genderFilter: 'all',
    });
  };

  // Slider change interceptor: If > 1km and antenna not active, prompt to use antenna
  const handleSliderChange = (newRadius: number) => {
    if (newRadius > 1 && !isAntennaActive) {
      setPendingRadiusPrompt(newRadius);
    } else {
      onChange({ ...filter, maxDistanceKm: newRadius });
    }
  };

  // Activate Antenna from prompt or direct button
  const handleConfirmUseAntenna = (targetRadius?: number) => {
    if (!currentUser) return;
    const res = ItemService.activateBroadSearchAntenna(currentUser.id);
    showToast(res.message);
    if (res.success) {
      const radiusToApply = targetRadius ?? pendingRadiusPrompt ?? 5;
      onChange({ ...filter, maxDistanceKm: radiusToApply });
      if (onInventoryUpdated) onInventoryUpdated();
      setPendingRadiusPrompt(null);
      try {
        confetti({
          particleCount: 70,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}
    }
  };

  const handleCancelAntennaPrompt = () => {
    setPendingRadiusPrompt(null);
    onChange({ ...filter, maxDistanceKm: 1 });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 relative">
        
        {/* Header */}
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-rose-500" />
            <h3 className="font-bold text-stone-900 text-base">탐색 필터</h3>
          </div>
          <button
            type="button"
            id="btn-close-filter-drawer"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 flex-1 overflow-y-auto">
          
          {toastMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-900 text-center animate-fadeIn shadow-xs">
              {toastMsg}
            </div>
          )}

          {/* Distance Radius Section */}
          <div className="space-y-3 p-4 bg-stone-50/80 rounded-2xl border border-stone-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold text-stone-800">탐색 반경 설정</span>
                {isAntennaActive ? (
                  <span className="text-[10px] font-black px-2 py-0.5 bg-rose-500 text-white rounded-full flex items-center gap-1 animate-pulse">
                    <Radio className="w-2.5 h-2.5" />
                    광역 안테나 ON ({remainingMins}분)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-stone-200 text-stone-600 rounded-md">
                    기본 1km
                  </span>
                )}
              </div>
              <span className="text-rose-600 font-black font-mono text-base">
                {isAntennaActive ? `${filter.maxDistanceKm}km` : '1.0km'}
              </span>
            </div>

            {/* Slider */}
            <div className="space-y-1.5">
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                id="distance-radius-slider"
                value={isAntennaActive ? filter.maxDistanceKm : 1}
                onChange={(e) => handleSliderChange(Number(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer h-2 bg-stone-200 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-stone-400 font-medium">
                <span>1km (기본)</span>
                <span>10km</span>
                <span>20km</span>
                <span>30km (최대)</span>
              </div>
            </div>

            {/* Antenna Status / Explanatory card */}
            {isAntennaActive ? (
              <div className="p-3 bg-gradient-to-r from-rose-500/10 to-pink-500/10 border border-rose-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-rose-700">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                    1시간 반경 자유 조절 활성 중
                  </span>
                  <span className="text-[11px] font-mono font-black text-rose-600 flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {remainingMins}분 남음
                  </span>
                </div>
                <p className="text-[11px] text-rose-900/80 leading-relaxed">
                  슬라이더를 움직여 탐색 반경을 자유롭게 늘리거나 줄일 수 있습니다. (현재: {filter.maxDistanceKm}km)
                </p>
              </div>
            ) : (
              <div className="pt-2 border-t border-stone-200 flex flex-col gap-2">
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  1km 초과 광역 검색을 이용하시려면 <strong className="text-stone-800">광역 검색 안테나</strong>가 필요합니다. 사용 시 1시간 동안 반경을 자유롭게 늘리거나 줄일 수 있습니다.
                </p>
                <button
                  type="button"
                  id="btn-quick-activate-antenna"
                  onClick={() => handleConfirmUseAntenna(5)}
                  className="w-full py-2 px-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>광역 검색 안테나 1개 사용 (보유: {inv?.boostAntennas ?? 999}개)</span>
                </button>
              </div>
            )}
          </div>

          {/* Gender Preference */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-stone-800">
              표시할 성별
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '전체', val: 'all' as const },
                { label: '여성만', val: 'female' as const },
                { label: '남성만', val: 'male' as const },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => onChange({ ...filter, genderFilter: item.val })}
                  className={`py-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                    filter.genderFilter === item.val
                      ? 'bg-rose-50 border-rose-400 text-rose-600 font-bold'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Age Range */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-stone-800">
              <span>연령대</span>
              <span className="text-rose-500 font-mono text-sm">
                만 {filter.minAge}세 ~ {filter.maxAge}세
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-stone-400 font-medium">최소 나이</span>
                <input
                  type="number"
                  min="19"
                  max={filter.maxAge}
                  value={filter.minAge}
                  onChange={(e) => onChange({ ...filter, minAge: Number(e.target.value) })}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-stone-400 font-medium">최대 나이</span>
                <input
                  type="number"
                  min={filter.minAge}
                  max="60"
                  value={filter.maxAge}
                  onChange={(e) => onChange({ ...filter, maxAge: Number(e.target.value) })}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Interests multi-filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800">
                관심사 필터링
              </label>
              {filter.selectedInterests.length > 0 && (
                <span className="text-[11px] text-rose-500 font-medium">
                  {filter.selectedInterests.length}개 선택됨
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 bg-stone-50 rounded-xl border border-stone-200 max-h-44 overflow-y-auto">
              {INITIAL_INTEREST_TAGS.map((tag) => {
                const isSelected = filter.selectedInterests.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleInterestToggle(tag)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Test Accounts Management Section */}
          <div className="pt-4 border-t border-stone-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                <span>테스트 계정 관리 & 주변 재생성</span>
              </label>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                hasTestAccounts ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-stone-100 text-stone-500'
              }`}>
                {hasTestAccounts ? '테스트 계정 활성' : '모두 삭제됨'}
              </span>
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              다양한 거리 반경(0.2km ~ 28km)으로 테스트 계정을 생성하여 기본 1km 검색 및 광역 안테나 필터 조회를 검증할 수 있습니다.
            </p>

            {/* Primary Action: One-Click Reset & Recreate */}
            <button
              type="button"
              id="btn-reset-and-recreate-test-accounts"
              onClick={onResetAndRecreateTestAccounts}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-700 hover:to-rose-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>[테스트 계정 모두삭제 & 재생성]</span>
            </button>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {hasTestAccounts ? (
                <button
                  type="button"
                  id="btn-delete-all-test-accounts"
                  onClick={onDeleteTestAccounts}
                  className="py-2 px-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>계정 모두 삭제</span>
                </button>
              ) : (
                <button
                  type="button"
                  id="btn-recreate-test-accounts"
                  onClick={onRecreateTestAccounts}
                  className="py-2 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>주변 계정 다시 생성</span>
                </button>
              )}

              <button
                type="button"
                id="btn-recreate-test-accounts-alt"
                onClick={onRecreateTestAccounts}
                className="py-2 px-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>거리 랜덤 재배치</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-stone-100 bg-stone-50 flex items-center gap-2">
          <button
            type="button"
            id="btn-reset-filters"
            onClick={handleReset}
            className="p-3 bg-white hover:bg-stone-100 text-stone-600 rounded-2xl border border-stone-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            초기화
          </button>
          <button
            type="button"
            id="btn-apply-filters"
            onClick={onClose}
            className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl text-xs transition shadow-md shadow-rose-200 cursor-pointer"
          >
            적용하기
          </button>
        </div>

        {/* ========================================================= */}
        {/* Broad Search Antenna Confirmation Modal Overlay */}
        {/* ========================================================= */}
        <AnimatePresence>
          {pendingRadiusPrompt !== null && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-2xl border border-rose-100 text-center space-y-4"
              >
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white flex items-center justify-center text-2xl shadow-lg shadow-rose-200 animate-bounce">
                  📡
                </div>

                <div>
                  <h4 className="text-base font-extrabold text-stone-900">
                    '광역 검색 안테나'를 사용하시겠습니까?
                  </h4>
                  <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                    기본 1km를 넘어 <strong className="text-rose-600 font-bold">{pendingRadiusPrompt}km</strong>로 반경을 확장하려면 안테나 아이템이 필요합니다.
                  </p>
                </div>

                <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200/80 text-left space-y-1 text-xs">
                  <div className="flex items-center justify-between text-rose-900 font-bold">
                    <span>✨ 사용 혜택</span>
                    <span className="text-[11px] bg-rose-200 text-rose-800 px-1.5 py-0.2 rounded font-black">1시간 지속</span>
                  </div>
                  <p className="text-stone-600 text-[11px] leading-snug">
                    1시간 동안 반경을 원하는 거리(최대 30km)까지 자유롭게 늘리거나 줄일 수 있습니다.
                  </p>
                  <div className="pt-1 flex items-center justify-between text-[11px] font-bold text-stone-700">
                    <span>보유 안테나</span>
                    <span className="text-rose-600 font-mono font-black">{inv?.boostAntennas ?? 999}개 보유</span>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    id="btn-confirm-antenna-use"
                    onClick={() => handleConfirmUseAntenna(pendingRadiusPrompt)}
                    className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>안테나 사용하고 {pendingRadiusPrompt}km로 탐색</span>
                  </button>

                  <button
                    type="button"
                    id="btn-cancel-antenna-prompt"
                    onClick={handleCancelAntennaPrompt}
                    className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    기본 1km 유지하기 (취소)
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

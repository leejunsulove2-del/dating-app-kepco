import React from 'react';
import { Heart, SlidersHorizontal, MessageCircle, RefreshCw, LogOut, Gift, Backpack, Radio, Flame, Sparkles, Clock } from 'lucide-react';
import { UserProfile } from '../types';
import { ItemService } from '../services/itemService';

interface HeaderProps {
  currentUser: UserProfile;
  syncCountdown: number;
  isSyncing: boolean;
  activeRadiusKm?: number;
  onManualRefresh: () => void;
  onOpenFilter: () => void;
  onOpenProfile: () => void;
  onOpenChatList: () => void;
  onOpenAttendance: () => void;
  onOpenTimeReward?: () => void;
  onOpenInventory: () => void;
  onLogout: () => void;
  unreadCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  syncCountdown,
  isSyncing,
  activeRadiusKm = 1,
  onManualRefresh,
  onOpenFilter,
  onOpenProfile,
  onOpenChatList,
  onOpenAttendance,
  onOpenTimeReward,
  onOpenInventory,
  onLogout,
  unreadCount = 0,
}) => {
  const isBoostActive = ItemService.isBoostRadiusActive(currentUser.id);
  const remainingBoostMins = ItemService.getRemainingBoostMinutes(currentUser.id);
  const daily = ItemService.getDailyActivity(currentUser.id);
  const inv = ItemService.getInventory(currentUser.id);
  const hasAttendanceToClaim = !daily.attendanceClaimed;
  const timeRewardStatus = ItemService.getTimeRewardStatus(currentUser.id);
  const hasTimeRewardToClaim = timeRewardStatus.isEligibleNow;

  return (
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-stone-200 px-3 sm:px-4 flex items-center justify-between z-40 relative">
      {/* Brand & Active Boost Indicator */}
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center shadow-md shadow-rose-200 shrink-0">
          <Heart className="w-5 h-5 text-white fill-white animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-extrabold text-stone-900 text-base sm:text-lg tracking-tight">
              연애의 지도
            </h1>
            {isBoostActive ? (
              <button
                type="button"
                onClick={onOpenFilter}
                className="px-2 py-0.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[10px] rounded-md shadow-xs animate-pulse flex items-center space-x-1 cursor-pointer"
                title="광역 탐색 반경 조절하기"
              >
                <Radio className="w-3 h-3" />
                <span>광역 {activeRadiusKm}km ({remainingBoostMins}분)</span>
              </button>
            ) : (
              <span className="px-1.5 py-0.5 bg-stone-100 text-stone-600 font-bold text-[10px] rounded-md border border-stone-200 hidden xs:inline-block">
                반경 1km
              </span>
            )}
          </div>
          <p className="text-[10px] text-stone-400 font-medium hidden sm:block">
            내 위치 기반 주변 프로필 실시간 탐색
          </p>
        </div>
      </div>

      {/* Center 30s Status (Desktop) */}
      <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-full text-xs text-stone-700">
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
        <span className="font-semibold text-stone-600">위치 전송:</span>
        <span className="font-mono font-bold text-rose-600">{syncCountdown}초</span>
        <button
          type="button"
          onClick={onManualRefresh}
          disabled={isSyncing}
          className="p-1 hover:text-rose-600 text-stone-400 transition cursor-pointer"
          title="지금 위치 전송 및 동기화"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-rose-500' : ''}`} />
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* 1. Daily Attendance & Welcome Box Button */}
        <button
          type="button"
          id="header-attendance-btn"
          onClick={onOpenAttendance}
          className="relative p-2 sm:px-3 sm:py-2 rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 text-amber-900 transition cursor-pointer flex items-center gap-1 text-xs font-bold shadow-xs"
          title="출석체크 및 환영박스"
        >
          <Gift className="w-4 h-4 text-amber-600" />
          <span className="hidden sm:inline">{daily.attendanceClaimed ? '출석완료' : '출석체크'}</span>
          {hasAttendanceToClaim && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center animate-bounce">
              !
            </span>
          )}
        </button>

        {/* 1-2. Special Time Reward Button (점심시간 / 주말특별 보상) */}
        {onOpenTimeReward && (
          <button
            type="button"
            id="header-time-reward-btn"
            onClick={onOpenTimeReward}
            className={`relative p-2 sm:px-3 sm:py-2 rounded-2xl border transition cursor-pointer flex items-center gap-1 text-xs font-bold shadow-xs ${
              timeRewardStatus.isWeekendOrHoliday
                ? 'border-purple-300/80 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 text-purple-900'
                : 'border-rose-300/80 bg-gradient-to-r from-rose-50 to-pink-50 hover:from-rose-100 text-rose-900'
            }`}
            title={timeRewardStatus.title}
          >
            {timeRewardStatus.isWeekendOrHoliday ? (
              <Sparkles className="w-4 h-4 text-purple-600" />
            ) : (
              <Clock className="w-4 h-4 text-rose-600" />
            )}
            <span className="hidden sm:inline">
              {timeRewardStatus.isWeekendOrHoliday ? '주말박스 (x3)' : '점심박스'}
            </span>
            {hasTimeRewardToClaim && (
              <span className="absolute -top-1 -right-1 px-1 py-0.2 bg-rose-500 text-white rounded-full text-[8px] font-black animate-bounce">
                {timeRewardStatus.isWeekendOrHoliday ? 'x3' : 'N'}
              </span>
            )}
          </button>
        )}

        {/* 2. Inventory / Backpack Button */}
        <button
          type="button"
          id="header-inventory-btn"
          onClick={onOpenInventory}
          className="relative p-2 sm:px-3 sm:py-2 rounded-2xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100/70 text-indigo-900 transition cursor-pointer flex items-center gap-1 text-xs font-bold shadow-xs"
          title="보관함 (인벤토리)"
        >
          <Backpack className="w-4 h-4 text-indigo-600" />
          <span className="hidden sm:inline">보관함</span>
          {inv.welcomeBoxes + inv.messageTickets + inv.popularityMessages > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[9px] font-black">
              {inv.welcomeBoxes + inv.messageTickets + inv.popularityMessages}
            </span>
          )}
        </button>

        {/* 3. Filter Button */}
        <button
          type="button"
          id="header-filter-btn"
          onClick={onOpenFilter}
          className="p-2 sm:px-3 sm:py-2 rounded-2xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
          title="필터 설정"
        >
          <SlidersHorizontal className="w-4 h-4 text-stone-600" />
          <span className="hidden sm:inline">필터</span>
        </button>

        {/* 4. Chat List Button */}
        <button
          type="button"
          id="header-chat-btn"
          onClick={onOpenChatList}
          className="relative p-2 sm:px-3 sm:py-2 rounded-2xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
          title="1:1 대화 및 매칭"
        >
          <MessageCircle className="w-4 h-4 text-rose-500" />
          <span className="hidden sm:inline">대화</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-bounce">
              {unreadCount}
            </span>
          )}
        </button>

        {/* 5. User Profile Chip */}
        <button
          type="button"
          id="header-profile-btn"
          onClick={onOpenProfile}
          className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-2xl border border-stone-200 bg-stone-50 hover:bg-stone-100 transition cursor-pointer"
          title="프로필 확인/수정"
        >
          <div className="relative w-7 h-7 rounded-xl overflow-hidden bg-rose-100 shrink-0">
            <img src={currentUser.photoUrl} alt={currentUser.name} className="w-full h-full object-cover" />
          </div>
          <div className="text-left hidden md:block max-w-[80px]">
            <span className="block text-xs font-bold text-stone-800 truncate">{currentUser.name}</span>
            <span className="block text-[10px] text-amber-600 font-semibold truncate flex items-center gap-0.5">
              <Flame className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
              {currentUser.popularity ?? 100}
            </span>
          </div>
        </button>

        {/* 6. Logout */}
        <button
          type="button"
          id="header-logout-btn"
          onClick={onLogout}
          className="p-2 rounded-2xl text-stone-400 hover:text-red-500 hover:bg-red-50 transition cursor-pointer"
          title="로그아웃"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};


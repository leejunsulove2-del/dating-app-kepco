import React, { useState, useMemo } from 'react';
import { Building2, MapPin, ChevronUp, ChevronDown, Flame, Tag } from 'lucide-react';
import { UserProfile } from '../types';
import { formatDistance, getUserActiveStatus } from '../utils/geo';
import { handleAvatarError, getAvatarForUser, resolveAssetUrl } from '../utils/avatarUtils';

interface NearbyUserListProps {
  nearbyUsers: UserProfile[];
  currentUserId: string;
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export const NearbyUserList: React.FC<NearbyUserListProps> = ({
  nearbyUsers,
  selectedUser,
  onSelectUser,
  isExpanded,
  onToggleExpand,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'recent'>('all');

  const onlineUsers = useMemo(
    () => nearbyUsers.filter((u) => getUserActiveStatus(u.lastActive).status === 'online'),
    [nearbyUsers]
  );
  const recentUsers = useMemo(
    () => nearbyUsers.filter((u) => getUserActiveStatus(u.lastActive).status === 'recent'),
    [nearbyUsers]
  );

  const displayedUsers = useMemo(() => {
    if (statusFilter === 'online') return onlineUsers;
    if (statusFilter === 'recent') return recentUsers;
    return nearbyUsers;
  }, [nearbyUsers, onlineUsers, recentUsers, statusFilter]);

  return (
    <div
      id="nearby-user-tray"
      className={`fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-2xl transition-all duration-300 ${
        isExpanded ? 'h-80 sm:h-96' : 'h-44 sm:h-48'
      } flex flex-col`}
    >
      {/* Drawer Handle & Status Filter Tabs Header */}
      <div className="px-4 py-2 flex flex-wrap items-center justify-between border-b border-stone-100 gap-2 select-none bg-stone-50/70">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></div>
          <h3 className="font-bold text-stone-800 text-xs sm:text-sm">
            내 주변 프로필
          </h3>

          {/* Quick Tabs */}
          <div className="flex items-center gap-1 bg-stone-200/70 p-0.5 rounded-xl text-[11px] ml-2">
            <button
              type="button"
              id="tab-filter-all"
              onClick={(e) => {
                e.stopPropagation();
                setStatusFilter('all');
              }}
              className={`px-2.5 py-0.5 rounded-lg font-medium transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-stone-900 shadow-xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              전체 ({nearbyUsers.length})
            </button>
            <button
              type="button"
              id="tab-filter-online"
              onClick={(e) => {
                e.stopPropagation();
                setStatusFilter('online');
              }}
              className={`px-2.5 py-0.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                statusFilter === 'online'
                  ? 'bg-emerald-500 text-white shadow-xs font-bold'
                  : 'text-stone-600 hover:text-emerald-700'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              접속중 ({onlineUsers.length})
            </button>
            <button
              type="button"
              id="tab-filter-recent"
              onClick={(e) => {
                e.stopPropagation();
                setStatusFilter('recent');
              }}
              className={`px-2.5 py-0.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                statusFilter === 'recent'
                  ? 'bg-amber-500 text-white shadow-xs font-bold'
                  : 'text-stone-600 hover:text-amber-700'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300"></span>
              1시간 이내 ({recentUsers.length})
            </button>
          </div>
        </div>

        <button
          type="button"
          id="toggle-nearby-tray-btn"
          onClick={onToggleExpand}
          className="text-stone-500 hover:text-stone-900 p-1 flex items-center gap-1 text-xs font-medium cursor-pointer"
        >
          <span>{isExpanded ? '간략히 보기' : '펼쳐보기'}</span>
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Cards List */}
      <div className="flex-1 p-3 overflow-x-auto overflow-y-hidden sm:overflow-y-auto">
        {displayedUsers.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-stone-400 text-xs">
            <MapPin className="w-6 h-6 mb-1 text-stone-300" />
            <p>해당 조건에 부합하는 사용자가 현재 없습니다.</p>
            <p className="text-[11px] text-stone-400 mt-0.5">필터 탭을 '전체'로 변경하거나 검색 반경을 확인해보세요.</p>
          </div>
        ) : (
          <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 h-full items-center sm:items-stretch">
            {displayedUsers.map((user, idx) => {
              const isSelected = selectedUser?.id === user.id;
              const statusInfo = getUserActiveStatus(user.lastActive);
              const isOnline = statusInfo.status === 'online';
              const topSticker = user.stickers && Object.keys(user.stickers).length > 0
                ? (Object.entries(user.stickers) as [string, number][]).sort((a, b) => Number(b[1]) - Number(a[1]))[0]
                : null;

              return (
                <div
                  key={`nearby-user-${user.id}-${idx}`}
                  id={`nearby-card-${user.id}`}
                  onClick={() => onSelectUser(user)}
                  className={`min-w-[260px] sm:min-w-0 bg-white rounded-2xl border p-3 shadow-xs hover:shadow-md transition-all cursor-pointer flex gap-3 items-center shrink-0 ${
                    isSelected
                      ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50/25'
                      : 'border-stone-200 hover:border-rose-300'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-stone-100 border border-stone-200/60">
                    <img 
                      src={resolveAssetUrl(user.photoUrl) || getAvatarForUser(user.gender, user.id)} 
                      alt={user.name} 
                      onError={(e) => handleAvatarError(e, user.gender, user.id)}
                      className="w-full h-full object-cover" 
                    />
                    <span
                      className={`absolute top-1 right-1 w-3 h-3 ${
                        isOnline ? 'bg-emerald-500 animate-pulse ring-1 ring-white' : 'bg-amber-400'
                      } border-2 border-white rounded-full`}
                    ></span>
                  </div>

                  {/* Profile info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-stone-900 text-sm truncate">
                        {user.name} <span className="text-xs font-normal text-stone-500">({user.age}세)</span>
                      </h4>
                      <span className="text-[11px] font-bold text-rose-500 whitespace-nowrap ml-1">
                        {formatDistance(user.distanceKm)}
                      </span>
                    </div>

                    {/* Status & Popularity Badge */}
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 ${
                          isOnline
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                            : 'bg-amber-50 text-amber-800 border border-amber-200/80'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                          }`}
                        ></span>
                        {isOnline ? '실시간 접속 중' : statusInfo.label}
                      </span>

                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                        <Flame className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                        {user.popularity ?? 100}
                      </span>

                      {topSticker && (
                        <span className="text-[9px] font-semibold text-rose-700 bg-rose-50 border border-rose-200/60 px-1.5 py-0.5 rounded-md truncate max-w-[85px]">
                          {topSticker[0]}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-stone-600 truncate mt-1 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-stone-400 shrink-0" />
                      <span className="truncate">{user.company}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

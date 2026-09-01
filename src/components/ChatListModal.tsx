import React, { useState, useEffect } from 'react';
import {
  X,
  MessageCircle,
  Heart,
  Building2,
  ChevronRight,
  Search,
  Sparkles,
  CheckCheck
} from 'lucide-react';
import { UserProfile, ChatRoom } from '../types';
import { FirebaseChatService } from '../services/firebaseChatService';
import { DatingService } from '../services/datingService';
import { formatDistance } from '../utils/geo';
import { handleAvatarError, getAvatarForUser } from '../utils/avatarUtils';

interface ChatListModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  nearbyUsers: UserProfile[];
  onClose: () => void;
  onSelectChat: (user: UserProfile) => void;
}

export const ChatListModal: React.FC<ChatListModalProps> = ({
  isOpen,
  currentUser,
  nearbyUsers,
  onClose,
  onSelectChat,
}) => {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'matched'>('all');

  // Real-time Chat Rooms Subscription
  useEffect(() => {
    if (!isOpen || !currentUser) return;

    const unsubscribe = FirebaseChatService.subscribeToUserRooms(
      currentUser.id,
      (rooms) => {
        setChatRooms(rooms);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  // Helper to extract partner profile from room
  const getPartnerFromRoom = (room: ChatRoom): UserProfile | null => {
    const partnerId = room.participantIds.find((id) => id !== currentUser.id);
    if (!partnerId) return null;

    if (room.participantProfiles && room.participantProfiles[partnerId]) {
      return room.participantProfiles[partnerId];
    }

    const allUsers = DatingService.getAllUsers();
    return allUsers.find((u) => u.id === partnerId) || null;
  };

  const formatRelativeTime = (ts?: number) => {
    if (!ts) return '';
    const diffMs = Date.now() - ts;
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // Filtered rooms
  const filteredRooms = chatRooms.filter((room) => {
    const partner = getPartnerFromRoom(room);
    if (!partner) return false;

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = partner.name.toLowerCase().includes(q);
      const matchCompany = partner.company.toLowerCase().includes(q);
      if (!matchName && !matchCompany) return false;
    }

    // Tab filter
    const unread = room.unreadCounts?.[currentUser.id] || 0;
    if (activeTab === 'unread') return unread > 0;
    if (activeTab === 'matched') return room.isMatched && (!room.lastMessage || room.lastMessage.type === 'system');

    return true;
  });

  const totalUnreadCount = FirebaseChatService.calculateTotalUnread(chatRooms, currentUser.id);

  return (
    <div
      id="chat-list-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-900/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="chat-list-container"
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden flex flex-col h-[580px] max-h-[88vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-stone-900 text-base">실시간 매칭 대화방</h3>
                {totalUnreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-rose-500 text-white font-bold text-[10px] rounded-full">
                    {totalUnreadCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-400">Firebase Realtime 실시간 동기화</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 transition cursor-pointer"
            title="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Tabs */}
        <div className="p-3 bg-stone-50/80 border-b border-stone-100 space-y-2 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="대화 상대방 이름 또는 기업명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
            />
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              전체 ({chatRooms.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                activeTab === 'unread'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              안 읽음 {totalUnreadCount > 0 ? `(${totalUnreadCount})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('matched')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                activeTab === 'matched'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              새 매칭
            </button>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-stone-50/40">
          {filteredRooms.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-400 flex items-center justify-center">
                <Heart className="w-7 h-7 fill-rose-100 text-rose-400 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-bold text-stone-700">대화방 내역이 없습니다</p>
                <p className="text-xs text-stone-400 max-w-xs mt-1">
                  {searchTerm
                    ? '검색어와 일치하는 대화방을 찾을 수 없습니다.'
                    : '지도에서 마음에 드는 상대방 프로필을 확인하고 하트를 보내보세요!'}
                </p>
              </div>
            </div>
          ) : (
            filteredRooms.map((room) => {
              const partner = getPartnerFromRoom(room);
              if (!partner) return null;

              const unread = room.unreadCounts?.[currentUser.id] || 0;
              const lastMsg = room.lastMessage;
              const isMineLast = lastMsg?.senderId === currentUser.id;

              return (
                <div
                  key={room.id}
                  onClick={() => {
                    onClose();
                    onSelectChat(partner);
                  }}
                  className={`p-3 bg-white hover:bg-rose-50/50 rounded-2xl border transition cursor-pointer flex items-center gap-3 shadow-2xs ${
                    unread > 0 ? 'border-rose-300 bg-rose-50/20' : 'border-stone-200/90'
                  }`}
                >
                  <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-stone-100 shrink-0 border border-stone-100">
                    <img
                      src={partner.photoUrl || getAvatarForUser(partner.gender, partner.id)}
                      alt={partner.name}
                      onError={(e) => handleAvatarError(e, partner.gender, partner.id)}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-stone-900 text-sm truncate">{partner.name}</h4>
                        <span className="text-[10px] text-stone-500 font-medium truncate max-w-[110px]">
                          {partner.company}
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-400 shrink-0 ml-1">
                        {formatRelativeTime(room.updatedAt || lastMsg?.timestamp)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className={`text-xs truncate max-w-[200px] sm:max-w-[240px] ${
                        unread > 0 ? 'text-stone-900 font-semibold' : 'text-stone-500'
                      }`}>
                        {isMineLast && <span className="text-stone-400 mr-1">나:</span>}
                        {lastMsg ? lastMsg.text : '🎉 새로운 매칭! 첫 인사를 건네보세요.'}
                      </p>

                      {unread > 0 && (
                        <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-extrabold rounded-full shrink-0 shadow-2xs animate-pulse">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

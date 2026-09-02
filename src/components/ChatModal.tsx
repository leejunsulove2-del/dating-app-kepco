import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Send,
  Heart,
  Sparkles,
  Building2,
  Smile,
  Calendar,
  Coffee,
  Film,
  Utensils,
  Wine,
  AlertCircle,
  PlusCircle,
  Flame,
  RotateCcw,
  Volume2,
  VolumeX,
  Clock,
  Radio,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, ChatMessage, ChatRoom } from '../types';
import { FirebaseChatService } from '../services/firebaseChatService';
import { ItemService } from '../services/itemService';
import { DatingService } from '../services/datingService';
import { formatDistance } from '../utils/geo';
import { soundManager } from '../utils/sound';
import { handleAvatarError, getAvatarForUser } from '../utils/avatarUtils';

interface ChatModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  targetUser: UserProfile | null;
  onClose: () => void;
  onInventoryUpdated?: () => void;
  onOpenInventory?: () => void;
}

const ICEBREAKERS = [
  '안녕하세요! 프로필 보고 대화 나눠보고 싶어서 연락드렸어요 😊',
  '관심사가 저랑 잘 맞아서 반가워요! 주말엔 보통 뭐하세요?',
  '회사 근처에 분위기 좋은 맛집 아시나요? 같이 가요 ✨',
  '프로필 사진 분위기가 너무 좋으세요! 날씨도 좋은데 커피 한잔해요 ☕',
];

const QUICK_STICKERS = [
  { icon: Coffee, label: '커피 한잔해요 ☕', text: '주말에 커피 한잔 어떠세요? ☕ 분위기 좋은 카페 알아요!' },
  { icon: Utensils, label: '맛집 탐방 🍣', text: '퇴근하고 맛있는 저녁 같이 먹어요! 🍣' },
  { icon: Wine, label: '와인/한잔 🍷', text: '가볍게 와인이나 맥주 한잔해요! 🍷' },
  { icon: Film, label: '영화 보기 🎬', text: '요즘 개봉한 영화 보고 싶은데 같이 보실래요? 🎬' },
];

const REACTION_EMOJIS = ['❤️', '👍', '😊', '🥂', '🔥'];

export const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  currentUser,
  targetUser,
  onClose,
  onInventoryUpdated,
  onOpenInventory,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [usePopularityGift, setUsePopularityGift] = useState(false);
  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isSyncRefreshing, setIsSyncRefreshing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevMsgCountRef = useRef<number>(0);

  const roomId = targetUser ? FirebaseChatService.getRoomId(currentUser.id, targetUser.id) : '';

  // Manual resync handler for instant force refresh
  const handleManualSync = useCallback(() => {
    if (!roomId) return;
    setIsSyncRefreshing(true);
    const msgs = FirebaseChatService.getRoomMessagesDirect(roomId);
    if (msgs && msgs.length > 0) {
      setMessages(msgs);
    }
    FirebaseChatService.markRoomAsRead(roomId, currentUser.id).catch(() => {});
    setTimeout(() => {
      setIsSyncRefreshing(false);
    }, 600);
  }, [roomId, currentUser.id]);

  // Initialize room and subscriptions
  useEffect(() => {
    if (!targetUser || !isOpen) return;

    let unsubscribeMessages: (() => void) | null = null;
    let unsubscribeTyping: (() => void) | null = null;

    const setupChat = async () => {
      const room = await FirebaseChatService.createOrGetRoom(currentUser, targetUser);
      setCurrentRoom(room);

      unsubscribeMessages = FirebaseChatService.subscribeToRoomMessages(
        room.id,
        (fetchedMsgs) => {
          setMessages((prev) => {
            // Play incoming sound if a new message from counterpart arrives
            if (fetchedMsgs.length > prev.length && prev.length > 0) {
              const latestMsg = fetchedMsgs[fetchedMsgs.length - 1];
              if (latestMsg.senderId === targetUser.id && isSoundEnabled) {
                soundManager.playReceiveSound();
              }
            }
            return fetchedMsgs;
          });
          FirebaseChatService.markRoomAsRead(room.id, currentUser.id).catch(console.error);
        }
      );

      unsubscribeTyping = FirebaseChatService.subscribeToTyping(
        room.id,
        currentUser.id,
        (typing) => {
          setIsPartnerTyping(typing);
        }
      );
    };

    setupChat();

    return () => {
      if (unsubscribeMessages) unsubscribeMessages();
      if (unsubscribeTyping) unsubscribeTyping();
      if (roomId) {
        FirebaseChatService.setTyping(roomId, currentUser.id, false).catch(() => {});
      }
    };
  }, [currentUser, targetUser, isOpen, roomId, isSoundEnabled]);

  // Auto scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    prevMsgCountRef.current = messages.length;
  }, [messages, isPartnerTyping]);

  if (!isOpen || !targetUser) return null;

  const inv = ItemService.getInventory(currentUser.id);
  const remainingMessages = ItemService.getRemainingMessagesToday(currentUser.id);
  const totalMessageQuota = ItemService.getDailyTotalMessageLimit(currentUser.id);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (roomId) {
      FirebaseChatService.setTyping(roomId, currentUser.id, true).catch(() => {});

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        FirebaseChatService.setTyping(roomId, currentUser.id, false).catch(() => {});
      }, 2500);
    }
  };

  const handleUseMessageTicketInChat = () => {
    const res = ItemService.useMessageTicket(currentUser.id);
    setQuotaWarning(res.message);
    if (res.success) {
      onInventoryUpdated?.();
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch {}
    }
  };

  // Send message handler (enforcing quota & instant optimistic Kakao style refresh)
  const handleSendMessage = async (
    customText?: string,
    type: 'text' | 'image' | 'sticker' | 'popularity_gift' = 'text',
    mediaUrl?: string
  ) => {
    const text = customText || inputText;
    if (!text.trim() && !mediaUrl) return;

    // Check message quota
    const currentRemaining = ItemService.getRemainingMessagesToday(currentUser.id);
    if (currentRemaining <= 0) {
      setQuotaWarning('오늘 메시지 전송 한도를 모두 사용하셨습니다. 메시지 횟수 증가권을 사용해보세요!');
      return;
    }

    // Check if sending as popularity gift
    const isSendingPopularityGift = usePopularityGift || type === 'popularity_gift';
    if (isSendingPopularityGift) {
      if (inv.popularityMessages <= 0) {
        setQuotaWarning('보유한 인기도 메시지 아이템이 없습니다. 환영박스에서 획득해보세요!');
        return;
      }
      ItemService.consumePopularityMessage(currentUser.id);
      onInventoryUpdated?.();
    }

    setIsSending(true);
    setInputText('');
    setShowStickers(false);
    setUsePopularityGift(false);
    setQuotaWarning(null);

    // Record 1 message sent today
    ItemService.recordMessageSent(currentUser.id);
    onInventoryUpdated?.();

    if (isSoundEnabled) {
      soundManager.playSendSound();
    }

    if (roomId) {
      FirebaseChatService.setTyping(roomId, currentUser.id, false).catch(() => {});
    }

    try {
      // Send message to Firebase / storage with instant sync
      const newMsg = await FirebaseChatService.sendMessage(
        roomId,
        currentUser,
        targetUser,
        text.trim(),
        isSendingPopularityGift ? 'popularity_gift' : type,
        mediaUrl,
        isSendingPopularityGift
      );

      // Optimistic update to guarantee immediate rendering
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      // Interactive simulation reply only for mock demo accounts (user_1 ~ user_16)
      const isMockAccount = targetUser.isTestAccount || /^user_\d+$/.test(targetUser.id);
      if (isMockAccount) {
        const isFirst = messages.filter((m) => m.senderId === currentUser.id).length === 0;

        setTimeout(() => {
          FirebaseChatService.setTyping(roomId, targetUser.id, true).catch(() => {});

          setTimeout(async () => {
            FirebaseChatService.setTyping(roomId, targetUser.id, false).catch(() => {});

            let reply = '';
            if (isSendingPopularityGift) {
              DatingService.updateUserPopularity(targetUser.id, 1);
              reply = `와! 특별한 인기도 선물 메시지 감사합니다 ✨ ${currentUser.name}님 덕분에 인기도가 +1 올라갔어요! 정말 감동이에요 🥰`;
            } else if (isFirst) {
              reply = `안녕하세요 ${currentUser.name}님! 프로필 보고 연락 기다리고 있었어요 😊 ${targetUser.company}에서 일하고 계시는군요! 반가워요 ✨`;
            } else if (text.includes('커피') || text.includes('카페')) {
              reply = `좋아요! ☕ 제가 회사 근처에 핸드드립 잘하는 예쁜 카페 알고 있어요. 이번 주말 시간 어떠세요?`;
            } else if (text.includes('맛집') || text.includes('저녁') || text.includes('와인') || text.includes('식사')) {
              reply = `와 맛있는 거 너무 좋죠! 🍽️ 일정 맞춰서 같이 가요. 선호하시는 음식 종류 있으신가요?`;
            } else {
              const responses = [
                `네 맞아요! ${currentUser.name}님 말씀에 완전 공감해요 ㅎㅎ`,
                `오늘 하루도 고생 많으셨어요! 대화하니까 힐링되네요 🌿`,
                `좋은 생각이에요! 혹시 주말엔 어떤 취미활동 주로 하세요? 😊`,
                `ㅎㅎ 센스 있으시네요! 자주 연락하고 편하게 알아가봐요 ✨`,
              ];
              reply = responses[Math.floor(Math.random() * responses.length)];
            }

            const receivedMsg = await FirebaseChatService.sendMessage(
              roomId,
              targetUser,
              currentUser,
              reply,
              'text'
            );

            // Instant state refresh on opponent reply
            setMessages((prev) => {
              if (prev.some((m) => m.id === receivedMsg.id)) return prev;
              return [...prev, receivedMsg];
            });

            if (isSoundEnabled) {
              soundManager.playReceiveSound();
            }
          }, 1800);
        }, 1000);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleReaction = (msgId: string, emoji: string) => {
    FirebaseChatService.toggleReaction(roomId, msgId, currentUser.id, emoji).catch(console.error);
    setActiveReactionMsgId(null);
  };

  const formatMessageTime = (ts: number) => {
    const d = new Date(ts);
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? '오후' : '오전';
    const h = hours % 12 || 12;
    const m = minutes < 10 ? `0${minutes}` : minutes;
    return `${ampm} ${h}:${m}`;
  };

  const formatMessageDateDivider = (ts: number) => {
    const d = new Date(ts);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const date = d.getDate();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const day = dayNames[d.getDay()];
    return `${year}년 ${month}월 ${date}일 (${day})`;
  };

  return (
    <div
      id="chat-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/80 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="chat-modal-container"
        className="w-full max-w-lg bg-[#BACEE0] rounded-3xl shadow-2xl border border-stone-300/60 overflow-hidden flex flex-col h-[670px] max-h-[94vh] relative font-sans"
      >
        {/* ========================================================= */}
        {/* 1. KakaoTalk Style Header */}
        {/* ========================================================= */}
        <div className="p-3 sm:px-4 sm:py-3 bg-white/95 backdrop-blur-md border-b border-stone-200/80 flex items-center justify-between shrink-0 shadow-xs z-10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Target Avatar with online badge */}
            <div className="relative w-11 h-11 rounded-full overflow-hidden border border-stone-200 shadow-xs shrink-0 bg-stone-100">
              <img
                src={targetUser.photoUrl || getAvatarForUser(targetUser.gender, targetUser.id)}
                alt={targetUser.name}
                onError={(e) => handleAvatarError(e, targetUser.gender, targetUser.id)}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
            </div>

            {/* Target Name and Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-stone-900 text-base truncate tracking-tight">
                  {targetUser.name}
                </h3>
                <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200/60 px-2 py-0.2 rounded-full shrink-0">
                  {formatDistance(targetUser.distanceKm)}
                </span>
                <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded-full flex items-center gap-0.5 shrink-0">
                  <Flame className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                  {targetUser.popularity ?? 100}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-stone-500 truncate mt-0.5">
                <span className="flex items-center gap-0.5 text-stone-700 font-medium">
                  <Building2 className="w-3 h-3 text-stone-400" />
                  {targetUser.company}
                </span>
                <span className="text-stone-300">•</span>
                <span className="text-emerald-600 font-bold text-[11px]">실시간 접속 중</span>
              </div>
            </div>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Manual Sync / Refresh Button */}
            <button
              type="button"
              id="btn-sync-chat-messages"
              onClick={handleManualSync}
              className={`w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition cursor-pointer ${
                isSyncRefreshing ? 'animate-spin text-rose-500' : ''
              }`}
              title="채팅 새로고침 (실시간 동기화)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Sound Mute/Unmute Toggle */}
            <button
              type="button"
              id="btn-toggle-chat-sound"
              onClick={() => setIsSoundEnabled(!isSoundEnabled)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer ${
                isSoundEnabled ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-400'
              }`}
              title={isSoundEnabled ? '알림음 켜짐' : '알림음 꺼짐'}
            >
              {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              id="close-chat-modal-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition cursor-pointer ml-1"
              title="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quota Warning / Item use bar */}
        {quotaWarning && (
          <div className="p-2.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex items-center justify-between px-4 animate-fadeIn z-10">
            <div className="flex items-center space-x-1.5 truncate">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="truncate">{quotaWarning}</span>
            </div>
            {inv.messageTickets > 0 && (
              <button
                type="button"
                id="quick-use-ticket-btn"
                onClick={handleUseMessageTicketInChat}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black rounded-lg text-[11px] shrink-0 ml-2 shadow-xs cursor-pointer"
              >
                증가권 1장 사용 ({inv.messageTickets}장 보유)
              </button>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. KakaoTalk Style Message Stream Canvas (#BACEE0) */}
        {/* ========================================================= */}
        <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3 relative select-text">
          
          {/* Security & Daily Message Remaining Capsule */}
          <div className="flex items-center justify-center gap-2 flex-wrap pb-1">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#FEE500]/95 text-stone-900 text-[11px] font-extrabold rounded-full shadow-2xs">
              ✉️ 오늘 전송 가능: {remainingMessages}/{totalMessageQuota}회
            </span>
          </div>

          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-white/80 text-rose-500 flex items-center justify-center shadow-sm">
                <Heart className="w-8 h-8 fill-rose-500 text-rose-500 animate-pulse" />
              </div>
              <div>
                <p className="font-extrabold text-stone-900 text-sm">
                  {targetUser.name}님과의 대화가 시작되었습니다! 💛
                </p>
                <p className="text-xs text-stone-600 mt-1">
                  아래 첫 인사 추천을 누르면 간편하게 즉시 전송됩니다
                </p>
              </div>

              {/* Quick Icebreakers */}
              <div className="w-full space-y-2 pt-2 max-w-sm">
                {ICEBREAKERS.map((ice, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendMessage(ice)}
                    className="w-full p-2.5 text-left text-xs bg-white/95 hover:bg-white border border-stone-200/80 rounded-2xl text-stone-800 transition shadow-xs cursor-pointer flex items-center gap-2"
                  >
                    <span className="text-amber-500 font-black">💬</span>
                    <span className="truncate font-medium">{ice}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMine = msg.senderId === currentUser.id;
              const isSystem = msg.type === 'system' || msg.senderId === 'system';
              const isPopularityGiftMsg = msg.type === 'popularity_gift' || msg.isPopularityGift;

              const showDateDivider =
                index === 0 ||
                new Date(msg.timestamp).toDateString() !==
                  new Date(messages[index - 1].timestamp).toDateString();

              // System Message (Center Capsule)
              if (isSystem) {
                return (
                  <div key={msg.id} className="text-center my-3">
                    <span className="inline-block px-3.5 py-1 bg-black/15 text-stone-800 text-[11px] font-medium rounded-full backdrop-blur-xs">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              return (
                <React.Fragment key={msg.id}>
                  {/* Date Divider (Kakao Capsule) */}
                  {showDateDivider && (
                    <div className="flex items-center justify-center my-3">
                      <span className="px-3 py-1 bg-black/15 text-stone-800 text-[11px] font-semibold rounded-full flex items-center gap-1 backdrop-blur-xs">
                        <Calendar className="w-3 h-3 text-stone-600" />
                        {formatMessageDateDivider(msg.timestamp)}
                      </span>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* Message Row: Left (Opponent) or Right (Mine) */}
                  {/* ========================================================= */}
                  <div className={`w-full flex ${isMine ? 'justify-end' : 'justify-start'} group relative my-1.5`}>
                    
                    {/* OPPONENT MESSAGE (Left with Avatar & Name) */}
                    {!isMine && (
                      <div className="flex items-start gap-2 max-w-[85%]">
                        {/* Opponent Profile Avatar */}
                        <div className="w-9 h-9 rounded-full overflow-hidden border border-white/60 shadow-xs shrink-0 mt-0.5 bg-white">
                          <img
                            src={targetUser.photoUrl || getAvatarForUser(targetUser.gender, targetUser.id)}
                            alt={targetUser.name}
                            onError={(e) => handleAvatarError(e, targetUser.gender, targetUser.id)}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex flex-col items-start min-w-0">
                          {/* Opponent Name Header */}
                          <span className="text-[11px] font-bold text-stone-700 mb-1 ml-0.5">
                            {targetUser.name}
                          </span>

                          <div className="flex items-end gap-1.5">
                            {/* Opponent White Bubble */}
                            <div
                              className={`relative px-3.5 py-2.5 rounded-2xl rounded-tl-xs text-sm leading-relaxed ${
                                isPopularityGiftMsg
                                  ? 'bg-gradient-to-r from-purple-50 via-pink-50 to-rose-50 text-purple-950 border border-purple-200 shadow-md'
                                  : 'bg-white text-[#191919] shadow-xs border border-stone-200/60'
                              }`}
                              onDoubleClick={() =>
                                setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)
                              }
                            >
                              {isPopularityGiftMsg && (
                                <div className="flex items-center space-x-1.5 mb-1 pb-1 border-b border-purple-200 text-[11px] font-bold text-purple-700">
                                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                                  <span>✨ 인기도 선물 메시지 (+1 호감)</span>
                                </div>
                              )}

                              {msg.mediaUrl && (
                                <div className="mb-2 rounded-xl overflow-hidden max-h-48 border border-stone-100">
                                  <img
                                    src={msg.mediaUrl}
                                    alt="attachment"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}

                              <p className="whitespace-pre-wrap break-words font-normal text-[13.5px]">
                                {msg.text}
                              </p>
                            </div>

                            {/* Opponent Time (Right of Bubble) */}
                            <div className="text-[10px] text-stone-600 font-medium whitespace-nowrap self-end pb-0.5">
                              {formatMessageTime(msg.timestamp)}
                            </div>
                          </div>

                          {/* Opponent Reactions */}
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div className="flex items-center gap-1 mt-1 ml-0.5">
                              {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                                const ids = Array.isArray(userIds) ? userIds : [];
                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleToggleReaction(msg.id, emoji)}
                                    className={`px-2 py-0.5 text-xs rounded-full border transition cursor-pointer flex items-center gap-1 ${
                                      ids.includes(currentUser.id)
                                        ? 'bg-rose-50 border-rose-300 text-rose-600 font-bold'
                                        : 'bg-white border-stone-200 text-stone-700'
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    <span className="font-bold text-[10px]">{ids.length}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* MY MESSAGE (Right: Kakao Yellow Bubble with Time on Left) */}
                    {isMine && (
                      <div className="flex flex-col items-end max-w-[85%]">
                        <div className="flex items-end gap-1.5">
                          {/* Unread '1' & Time on LEFT of my bubble */}
                          <div className="flex flex-col items-end text-[10px] text-stone-600 font-medium whitespace-nowrap self-end pb-0.5">
                            {!msg.read && (
                              <span className="font-extrabold text-amber-800 text-[11px] leading-none mb-0.5">
                                1
                              </span>
                            )}
                            <span className="leading-tight text-stone-600 font-medium">
                              {formatMessageTime(msg.timestamp)}
                            </span>
                          </div>

                          {/* My Kakao Yellow Bubble (#FEE500) */}
                          <div
                            className={`relative px-3.5 py-2.5 rounded-2xl rounded-tr-xs text-sm leading-relaxed ${
                              isPopularityGiftMsg
                                ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 text-white shadow-lg ring-2 ring-purple-300/60'
                                : 'bg-[#FEE500] text-[#1E1E1E] shadow-xs'
                            }`}
                            onDoubleClick={() =>
                              setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)
                            }
                          >
                            {isPopularityGiftMsg && (
                              <div className="flex items-center space-x-1.5 mb-1 pb-1 border-b border-white/20 text-[11px] font-bold text-amber-200">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>✨ 인기도 선물 메시지 (+1 호감)</span>
                              </div>
                            )}

                            {msg.mediaUrl && (
                              <div className="mb-2 rounded-xl overflow-hidden max-h-48 border border-black/10">
                                <img
                                  src={msg.mediaUrl}
                                  alt="attachment"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}

                            <p className="whitespace-pre-wrap break-words font-normal text-[13.5px]">
                              {msg.text}
                            </p>
                          </div>
                        </div>

                        {/* My Reactions */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className="flex items-center gap-1 mt-1 mr-0.5">
                            {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                              const ids = Array.isArray(userIds) ? userIds : [];
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => handleToggleReaction(msg.id, emoji)}
                                  className={`px-2 py-0.5 text-xs rounded-full border transition cursor-pointer flex items-center gap-1 ${
                                    ids.includes(currentUser.id)
                                      ? 'bg-rose-50 border-rose-300 text-rose-600 font-bold'
                                      : 'bg-white border-stone-200 text-stone-700'
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  <span className="font-bold text-[10px]">{ids.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quick Reaction Floating Picker */}
                    {activeReactionMsgId === msg.id && (
                      <div
                        className={`absolute -top-8 ${
                          isMine ? 'right-0' : 'left-10'
                        } bg-white shadow-xl border border-stone-200 rounded-full px-2 py-1 flex items-center gap-1.5 z-20 animate-in zoom-in-90 duration-150`}
                      >
                        {REACTION_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(msg.id, emoji)}
                            className="text-base hover:scale-125 transition p-0.5 cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}

          {/* Kakao-style Typing Indicator */}
          {isPartnerTyping && (
            <div className="flex items-start gap-2 py-1 animate-in fade-in">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-white/60 shadow-xs shrink-0 bg-white">
                <img
                  src={targetUser.photoUrl}
                  alt={targetUser.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="bg-white px-3.5 py-2 rounded-2xl rounded-tl-xs border border-stone-200 shadow-xs flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-stone-700">
                  {targetUser.name}님이 입력 중
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"></span>
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Popularity Gift Bar Option */}
        {inv.popularityMessages > 0 && (
          <div className="px-4 py-2 bg-gradient-to-r from-purple-50 to-pink-50 border-t border-purple-100 flex items-center justify-between text-xs z-10">
            <div className="flex items-center space-x-2">
              <span className="text-purple-700 font-bold flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>인기도 메시지 아이템 ({inv.popularityMessages}개 보유)</span>
              </span>
            </div>
            <button
              type="button"
              id="toggle-popularity-gift-btn"
              onClick={() => setUsePopularityGift(!usePopularityGift)}
              className={`px-3 py-1 rounded-full font-bold text-xs transition border flex items-center space-x-1 cursor-pointer ${
                usePopularityGift
                  ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                  : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-100'
              }`}
            >
              <span>{usePopularityGift ? '✨ 인기도 선물 적용중' : '호감 +1 선물 적용'}</span>
            </button>
          </div>
        )}

        {/* Quick Dating Stickers Drawer */}
        {showStickers && (
          <div className="p-3 bg-white/95 border-t border-stone-200 grid grid-cols-2 gap-2 animate-in slide-in-from-bottom-2 duration-150 z-10">
            {QUICK_STICKERS.map((sticker, idx) => {
              const IconComp = sticker.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(sticker.text, 'sticker')}
                  className="p-2.5 bg-stone-50 hover:bg-amber-50 border border-stone-200 rounded-xl text-left transition flex items-center gap-2 text-xs font-semibold text-stone-800 shadow-2xs cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#FEE500] text-stone-900 flex items-center justify-center shrink-0">
                    <IconComp className="w-4 h-4" />
                  </div>
                  <span className="truncate">{sticker.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. KakaoTalk Style Bottom Input Bar */}
        {/* ========================================================= */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-2.5 sm:p-3 bg-white border-t border-stone-200 flex items-center gap-2 shrink-0 z-10"
        >
          {/* Sticker / Quick Emoji button */}
          <button
            type="button"
            id="toggle-chat-stickers-btn"
            onClick={() => setShowStickers(!showStickers)}
            className={`p-2.5 rounded-full border transition cursor-pointer ${
              showStickers
                ? 'bg-[#FEE500] text-stone-950 border-amber-300'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-600 border-stone-200'
            }`}
            title="데이트 스티커 보내기"
          >
            <Smile className="w-4 h-4" />
          </button>

          {/* Input text field */}
          <input
            type="text"
            id="chat-input-field"
            placeholder={
              remainingMessages > 0
                ? `${targetUser.name}님에게 메시지 전송 (오늘 ${remainingMessages}회 가능)...`
                : '오늘 전송 한도 초과 (증가권을 사용하세요)'
            }
            value={inputText}
            onChange={handleInputChange}
            disabled={remainingMessages <= 0 && !inv.messageTickets}
            className="flex-1 px-4 py-2.5 bg-stone-100 border border-stone-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FEE500] focus:border-amber-400 focus:bg-white transition disabled:opacity-60 text-stone-900"
          />

          {remainingMessages > 0 ? (
            <button
              type="submit"
              id="send-chat-msg-btn"
              disabled={!inputText.trim() || isSending}
              className={`w-10 h-10 ${
                usePopularityGift
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-[#FEE500] hover:bg-[#fedd00] text-stone-950'
              } disabled:bg-stone-200 disabled:text-stone-400 font-bold rounded-2xl flex items-center justify-center transition shadow-xs cursor-pointer disabled:cursor-not-allowed shrink-0`}
              title="전송"
            >
              <Send className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              id="charge-message-ticket-btn"
              onClick={inv.messageTickets > 0 ? handleUseMessageTicketInChat : onOpenInventory}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl flex items-center space-x-1 shadow-sm shrink-0 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{inv.messageTickets > 0 ? '티켓 충전' : '보관함'}</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

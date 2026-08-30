export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  lastUpdated: number; // timestamp
}

export interface ProfileSticker {
  id: string;
  emoji: string;
  label: string;
  category: 'charm' | 'vibe' | 'personality' | 'manner';
}

export interface AttachedStickerItem {
  id: string;
  stickerLabel: string;
  giverUserId: string;
  attachedAt: number; // timestamp
  expiresAt: number;  // timestamp (3 days from attachment)
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  birthDate: string; // YYYY-MM-DD
  age: number;
  company: string; // 필수: 기업명
  photoUrl: string; // 필수: 프로필 사진
  bio: string; // 자기소개
  interests: string[]; // 관심사 태그
  location?: UserLocation;
  isOnline: boolean;
  distanceKm?: number;
  verifiedEmail: boolean;
  createdAt: number;
  lastActive: number;
  popularity: number; // 인기도 점수 (기본 100점)
  isTestAccount?: boolean; // 테스트 계정 플래그 (모두삭제 시 일괄 제거 가능)
  stickers?: Record<string, number>; // stickerLabel -> count (active non-expired)
  attachedStickersList?: AttachedStickerItem[]; // detailed sticker list with expiration
  myGivenStickers?: string[]; // 내가 이 프로필에 붙인 stickerLabel 목록
}

export type ItemId =
  | 'welcome_box' // 환영박스
  | 'boost_radius_1h' // 검색반경증가(1시간) : 5km~30km 자유 조절
  | 'message_ticket_1x' // 메시지 횟수 증가권(1회)
  | 'popularity_message_1x' // 인기도 메시지(1회)
  | 'sticker_card'; // 스티커 붙이기 카드(1장 - 3일간 유지)

export interface InventoryItemInfo {
  id: ItemId;
  name: string;
  description: string;
  icon: string;
  color: string;
  count: number;
}

export interface UserInventory {
  welcomeBoxes: number;
  boostAntennas: number; // 보유한 광역 검색 안테나 개수 (1시간 자유 반경 확장)
  boostRadiusExpiresAt: number | null; // 광역 검색 안테나 활성화 만료 시각
  messageTickets: number; // 보유한 메시지 횟수 증가권 개수
  popularityMessages: number; // 보유한 인기도 메시지 아이템 개수
  stickerCards: number; // 보유한 스티커 붙이기 카드 개수 (상대에게 3일간 지속 스티커 부착)
  bonusMessagesToday: number; // 오늘 아이템으로 추가 충전된 메시지 횟수
}

export interface DailyActivityState {
  date: string; // YYYY-MM-DD
  attendanceClaimed: boolean;
  timeRewardClaimed: boolean; // 특정 시간대 보상박스 수령 여부 (일일 1회)
  messagesSentToday: number; // 오늘 보낸 메시지 횟수
  votedTargetUserId?: string; // 오늘 인기도 투표한 상대 ID
  voteType?: 'up' | 'down'; // 투표 종류
}

export interface LikeAction {
  id: string;
  fromUserId: string;
  toUserId: string;
  timestamp: number;
  isMatch?: boolean;
}

export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: number;
  read: boolean;
  mediaUrl?: string;
  type?: 'text' | 'image' | 'sticker' | 'system' | 'popularity_gift';
  isPopularityGift?: boolean;
  reactions?: Record<string, string[]>; // emoji -> [userId1, userId2]
}

export interface ChatRoom {
  id: string;
  participantIds: string[];
  participantProfiles: Record<string, UserProfile>;
  lastMessage?: ChatMessage;
  unreadCounts: Record<string, number>; // userId -> count
  createdAt: number;
  updatedAt: number;
  isMatched: boolean;
  popularityGiftAccepted?: boolean;
}

export interface FilterOptions {
  maxDistanceKm: number;
  minAge: number;
  maxAge: number;
  selectedInterests: string[];
  genderFilter: 'all' | 'male' | 'female';
}



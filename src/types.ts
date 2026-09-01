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

export interface BioHistoryItem {
  id: string;
  timestamp: number;
  bio: string;
  name?: string;
  company?: string;
  interests?: string[];
  photoUrl?: string;
  changedBy: 'user' | 'admin';
}

export interface UserRewardNotice {
  id: string;
  timestamp: number;
  rewardBoxes: number;
  noticeMessage: string;
  processedByAdmin: string;
  claimed: boolean;
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
  role?: 'member' | 'agency_admin' | 'master_admin'; // 계정 권한 구분
  totalAttendanceDays?: number; // 누적 출석/접속일수
  consecutiveAttendanceDays?: number; // 연속 출석일수
  loginCount?: number; // 누적 로그인/접속 횟수
  stickers?: Record<string, number>; // stickerLabel -> count (active non-expired)
  attachedStickersList?: AttachedStickerItem[]; // detailed sticker list with expiration
  myGivenStickers?: string[]; // 내가 이 프로필에 붙인 stickerLabel 목록
  // Sanction & Moderation Fields
  sanctionCount?: number; // 피신고 제재 누적 횟수 (1~10)
  sanctionExpiresAt?: number | null; // 피신고 제재 만료 타임스탬프
  sanctionReason?: string | null; // 현재 제재 사유
  reporterCooldownUntil?: number | null; // 신고자 3시간 쿨다운 만료 타임스탬프
  falseReportCount?: number; // 허위신고 누적 횟수 (3회 시 영구 차단)
  isBanned?: boolean; // 10회 누적 또는 허위신고 3회로 인한 영구 접속 차단
  bioHistory?: BioHistoryItem[]; // 자기소개/프로필 변경 이력
  rewardNotices?: UserRewardNotice[]; // 관리자 보상 지급 알림
  // Agency Approval status
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  agencyDomain?: string; // e.g. kepco.co.kr
  rejectionReason?: string;
  approvedAt?: number;
  approvedByAdmin?: string;
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

export type ReportReason =
  | 'fake_profile' // 허위 프로필 / 도용
  | 'inappropriate_purpose' // 목적에 맞지 않는 이용자 (조건, 만남 등)
  | 'commercial_ad' // 광고 / 스팸 게시
  | 'harassment_abuse' // 욕설 / 비매너 / 성희롱
  | 'other'; // 기타 사유

export interface UserReport {
  id: string;
  reporterId: string;
  reporterEmail: string;
  reporterName: string;
  targetUserId: string;
  targetUserEmail: string;
  targetUserName: string;
  reason: ReportReason;
  customReasonDetail?: string;
  timestamp: number;
  status: 'pending' | 'sanction_applied' | 'dismissed_false' | 'compensated_justified';
  appliedSanctionHours: number;
  targetSanctionRound: number; // 당시 누적 차수
  reviewedByAdmin?: string; // 관리자 이메일
  reviewedAt?: number;
  adminNotes?: string;
  // Snapshots for audit
  targetProfileSnapshot: Partial<UserProfile>;
  chatHistorySnapshot?: ChatMessage[];
  bioHistorySnapshot?: BioHistoryItem[];
}

export interface AdminAccount {
  id: string;
  email: string;
  name: string;
  department?: string;
  isMaster: boolean; // true for admin@kepco.co.kr
  agencyDomain: string; // e.g. 'kepco.co.kr' (or '*' for master)
  agencyName: string; // e.g. '한국전력공사'
  passwordPlain: string;
  eventBoxesRemaining: number; // Monthly limit 1,000 + extra granted by Master
  createdAt: number;
  createdBy?: string;
}

export interface AdminBoardComment {
  id: string;
  authorEmail: string;
  authorName: string;
  agencyName: string;
  isMaster: boolean;
  content: string;
  createdAt: number;
}

export interface AdminBoardPost {
  id: string;
  authorId: string;
  authorEmail: string;
  authorName: string;
  agencyName: string;
  agencyDomain: string;
  isMaster: boolean;
  category: 'notice' | 'request' | 'policy' | 'free';
  title: string;
  content: string;
  isPinned?: boolean;
  createdAt: number;
  comments: AdminBoardComment[];
}

export interface GiftDeliveryLog {
  id: string;
  type: 'random_1hour_event' | 'direct_gift' | 'master_allocation';
  adminEmail: string;
  adminAgency: string;
  targetUserId?: string;
  targetUserName?: string;
  recipientCount?: number;
  boxesUsed: number;
  itemsSummary: string;
  timestamp: number;
  memo?: string;
}

export type AdminLogEntry = GiftDeliveryLog;





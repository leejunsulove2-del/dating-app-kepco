import { UserInventory, DailyActivityState, ItemId, InventoryItemInfo } from '../types';
import { DatingService } from './datingService';
import { FirestoreSyncService } from './firestoreSyncService';
import { ApiSyncService } from './apiSyncService';

const INVENTORY_STORAGE_KEY = 'yeon_user_inventory_v1';
const DAILY_STORAGE_KEY = 'yeon_daily_activity_v1';

export const ITEM_DEFINITIONS: Record<ItemId, { name: string; description: string; icon: string; color: string; badge: string }> = {
  welcome_box: {
    name: '환영박스',
    description: '매일 출석 시 지급되는 신비한 상자. 개봉 시 소모성 아이템 4종 중 1개를 무작위로 획득합니다.',
    icon: '🎁',
    color: 'from-amber-400 to-orange-500',
    badge: '랜덤 지급',
  },
  boost_radius_1h: {
    name: '광역 검색 안테나 (1시간)',
    description: '1시간 동안 기본 1km 제한을 해제하고, 내 주변 검색 반경을 원하는 거리(최대 30km)까지 자유롭게 늘리거나 줄일 수 있습니다.',
    icon: '📡',
    color: 'from-rose-500 to-pink-500',
    badge: '1시간 자유 반경 조절',
  },
  message_ticket_1x: {
    name: '메시지 횟수 증가권 (1회)',
    description: '하루 3회 제한된 메시지 전송 가능 횟수를 오늘 하루 동안 1회 즉시 추가 충전합니다.',
    icon: '✉️',
    color: 'from-indigo-500 to-sky-500',
    badge: '1회 충전',
  },
  popularity_message_1x: {
    name: '인기도 메시지 (1회)',
    description: '상대에게 특별한 호감 메시지를 전송하며, 상대가 수락/답장 시 상대의 인기도를 +1 올려줍니다.',
    icon: '✨',
    color: 'from-purple-500 to-pink-500',
    badge: '호감 +1 선물',
  },
  sticker_card: {
    name: '스티커 붙이기 카드 (1장)',
    description: '상대방 프로필에 매력 스티커를 1개 부착할 수 있습니다. 부착된 스티커는 3일(72시간) 동안 유지됩니다.',
    icon: '🔖',
    color: 'from-pink-500 to-rose-600',
    badge: '3일간 지속',
  },
};

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 대한민국 법정 주요 공휴일 목록 (MM-DD)
const KOREAN_HOLIDAYS_MM_DD = [
  '01-01', // 신정
  '03-01', // 3·1절
  '05-05', // 어린이날
  '06-06', // 현충일
  '08-15', // 광복절
  '10-03', // 개천절
  '10-09', // 한글날
  '12-25', // 성탄절
];

export interface TimeRewardStatus {
  isEligibleNow: boolean; // 지금 수령 가능한가
  isClaimedToday: boolean; // 오늘 이미 수령했는가
  isWeekendOrHoliday: boolean; // 주말 또는 공휴일 여부
  boxCountToAward: number; // 수령 시 지급 개수 (평일: 1개, 주말/공휴일: 3개 x3)
  title: string; // 보상 제목
  description: string; // 보상 설명
  timeRemainingText?: string; // 남은 시간 안내
}

export class ItemService {
  // Get or initialize User Inventory (Initial starter: 10 message tickets, 0 of all other items)
  static getInventory(userId: string): UserInventory {
    try {
      const raw = localStorage.getItem(`${INVENTORY_STORAGE_KEY}_${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        const inv: UserInventory = {
          welcomeBoxes: Number(parsed.welcomeBoxes) || 0,
          boostAntennas: Number(parsed.boostAntennas) || 0,
          boostRadiusExpiresAt: parsed.boostRadiusExpiresAt ?? null,
          messageTickets: parsed.messageTickets !== undefined ? Number(parsed.messageTickets) : 10,
          popularityMessages: Number(parsed.popularityMessages) || 0,
          stickerCards: Number(parsed.stickerCards) || 0,
          bonusMessagesToday: Number(parsed.bonusMessagesToday) || 0,
        };
        return inv;
      }
    } catch (e) {
      console.warn('Failed to load inventory', e);
    }

    // Initial starter inventory: Only 10 message tickets, all other items are 0
    const initial: UserInventory = {
      welcomeBoxes: 0,
      boostAntennas: 0,
      boostRadiusExpiresAt: null,
      messageTickets: 10,
      popularityMessages: 0,
      stickerCards: 0,
      bonusMessagesToday: 0,
    };
    this.saveInventory(userId, initial);
    return initial;
  }

  static saveInventory(userId: string, inventory: UserInventory) {
    try {
      localStorage.setItem(`${INVENTORY_STORAGE_KEY}_${userId}`, JSON.stringify(inventory));
      // Cloud Firestore & Server sync
      ApiSyncService.saveInventory(userId, inventory).catch(() => {});
    } catch (e) {
      console.warn('Failed to save inventory', e);
    }
  }

  // Daily Activity State
  static getDailyActivity(userId: string): DailyActivityState {
    const today = getTodayString();
    try {
      const raw = localStorage.getItem(`${DAILY_STORAGE_KEY}_${userId}`);
      if (raw) {
        const parsed: DailyActivityState = JSON.parse(raw);
        if (parsed.date === today) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load daily activity', e);
    }

    // New day reset
    const newDay: DailyActivityState = {
      date: today,
      attendanceClaimed: false,
      timeRewardClaimed: false,
      messagesSentToday: 0,
      votedTargetUserId: undefined,
      voteType: undefined,
    };
    this.saveDailyActivity(userId, newDay);
    return newDay;
  }

  static saveDailyActivity(userId: string, daily: DailyActivityState) {
    try {
      localStorage.setItem(`${DAILY_STORAGE_KEY}_${userId}`, JSON.stringify(daily));
    } catch (e) {
      console.warn('Failed to save daily activity', e);
    }
  }

  // Check whether current day is weekend or Korean holiday
  static isWeekendOrHoliday(dateObj: Date = new Date()): boolean {
    const dayOfWeek = dateObj.getDay(); // 0: Sunday, 6: Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return true;
    }
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const mmdd = `${month}-${day}`;
    return KOREAN_HOLIDAYS_MM_DD.includes(mmdd);
  }

  // Check time-based reward status
  static getTimeRewardStatus(userId: string, now: Date = new Date()): TimeRewardStatus {
    const daily = this.getDailyActivity(userId);
    const isWeekendHoliday = this.isWeekendOrHoliday(now);
    const isClaimed = Boolean(daily.timeRewardClaimed);

    if (isWeekendHoliday) {
      // 주말 / 공휴일: 하루 종일 중 1회 수령 가능 (x3 환영박스 3개)
      return {
        isEligibleNow: !isClaimed,
        isClaimedToday: isClaimed,
        isWeekendOrHoliday: true,
        boxCountToAward: 3,
        title: '주말/공휴일 특별 환영박스 (x3)',
        description: '주말 & 공휴일 기념! 하루 종일 언제든 환영박스 3개를 드립니다.',
      };
    } else {
      // 평일: 점심시간 (11:30 ~ 13:00) 접속 시 수령 가능 (일일 1회, 1개)
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const currentMinuteOfDay = hours * 60 + minutes;
      const startMinute = 11 * 60 + 30; // 11:30 (690)
      const endMinute = 13 * 60; // 13:00 (780)

      const isLunchTime = currentMinuteOfDay >= startMinute && currentMinuteOfDay <= endMinute;

      let timeRemainingText = '';
      if (currentMinuteOfDay < startMinute) {
        const diff = startMinute - currentMinuteOfDay;
        const diffH = Math.floor(diff / 60);
        const diffM = diff % 60;
        timeRemainingText = diffH > 0 ? `${diffH}시간 ${diffM}분 후 시작` : `${diffM}분 후 시작`;
      } else if (isLunchTime) {
        const diff = endMinute - currentMinuteOfDay;
        timeRemainingText = `종료까지 ${diff}분 남음`;
      } else {
        timeRemainingText = '오늘 점심시간 종료됨 (내일 11:30)';
      }

      return {
        isEligibleNow: isLunchTime && !isClaimed,
        isClaimedToday: isClaimed,
        isWeekendOrHoliday: false,
        boxCountToAward: 1,
        title: '평일 점심시간 깜짝 환영박스',
        description: '평일 점심시간(11:30 ~ 13:00) 맛있는 식사와 함께 환영박스 1개를 드립니다.',
        timeRemainingText,
      };
    }
  }

  // Claim time-based reward
  static claimTimeReward(userId: string, now: Date = new Date()): {
    success: boolean;
    awardedCount: number;
    welcomeBoxes: number;
    message: string;
  } {
    const status = this.getTimeRewardStatus(userId, now);
    const inv = this.getInventory(userId);

    if (status.isClaimedToday) {
      return {
        success: false,
        awardedCount: 0,
        welcomeBoxes: inv.welcomeBoxes,
        message: '오늘의 시간대 보상박스는 이미 수령하셨습니다. 내일 또 만나요!',
      };
    }

    if (!status.isEligibleNow) {
      return {
        success: false,
        awardedCount: 0,
        welcomeBoxes: inv.welcomeBoxes,
        message: status.isWeekendOrHoliday
          ? '현재 수령 가능한 상태가 아닙니다.'
          : '평일 점심시간(11:30 ~ 13:00)에만 수령할 수 있습니다.',
      };
    }

    // Award boxes and record state
    const daily = this.getDailyActivity(userId);
    daily.timeRewardClaimed = true;
    this.saveDailyActivity(userId, daily);

    const count = status.boxCountToAward;
    inv.welcomeBoxes = (inv.welcomeBoxes || 0) + count;
    this.saveInventory(userId, inv);

    return {
      success: true,
      awardedCount: count,
      welcomeBoxes: inv.welcomeBoxes,
      message: status.isWeekendOrHoliday
        ? `주말/공휴일 특별 보상! 환영박스 3개(x3)가 지급되었습니다! 🎁🎁🎁`
        : `점심시간 보상! 환영박스 1개가 지급되었습니다! 🎁`,
    };
  }

  // Check and claim daily attendance
  static claimDailyAttendance(userId: string): { success: boolean; welcomeBoxes: number; message: string } {
    const daily = this.getDailyActivity(userId);
    if (daily.attendanceClaimed) {
      return {
        success: false,
        welcomeBoxes: this.getInventory(userId).welcomeBoxes,
        message: '오늘 출석체크는 이미 완료되었습니다. 내일 또 만나요!',
      };
    }

    // Award welcome box
    daily.attendanceClaimed = true;
    this.saveDailyActivity(userId, daily);

    const inv = this.getInventory(userId);
    inv.welcomeBoxes = (inv.welcomeBoxes || 0) + 1;
    this.saveInventory(userId, inv);

    return {
      success: true,
      welcomeBoxes: inv.welcomeBoxes,
      message: '출석체크 완료! 오늘의 환영박스가 지급되었습니다 🎁',
    };
  }

  // Infinite/Test Box Grant Method for testing rewards
  static grantInfiniteWelcomeBox(
    userId: string,
    count: number = 1
  ): { welcomeBoxes: number; message: string } {
    const inv = this.getInventory(userId);
    inv.welcomeBoxes = (inv.welcomeBoxes || 0) + count;
    this.saveInventory(userId, inv);

    // Also reset daily attendance claim flag so user can re-test claiming
    const daily = this.getDailyActivity(userId);
    daily.attendanceClaimed = false;
    this.saveDailyActivity(userId, daily);

    return {
      welcomeBoxes: inv.welcomeBoxes,
      message: `테스트용 환영박스 ${count}개가 즉시 충전되었습니다! (보유: ${inv.welcomeBoxes}개) 🎁`,
    };
  }

  // Open a Welcome Box (Randomly drops 1 of 4 items)
  static openWelcomeBox(userId: string): {
    success: boolean;
    awardedItem?: ItemId;
    itemInfo?: typeof ITEM_DEFINITIONS[ItemId];
    remainingBoxes: number;
    message: string;
  } {
    const inv = this.getInventory(userId);
    if ((inv.welcomeBoxes || 0) <= 0) {
      return {
        success: false,
        remainingBoxes: 0,
        message: '보유한 환영박스가 없습니다. [출석상자 받기] 버튼으로 언제든 무한 충전해보세요!',
      };
    }

    inv.welcomeBoxes -= 1;

    // Random choice among the 4 consumable items
    const possibleItems: ItemId[] = [
      'boost_radius_1h',
      'message_ticket_1x',
      'popularity_message_1x',
      'sticker_card',
    ];
    const picked = possibleItems[Math.floor(Math.random() * possibleItems.length)];

    if (picked === 'boost_radius_1h') {
      inv.boostAntennas = (inv.boostAntennas || 0) + 1;
    } else if (picked === 'message_ticket_1x') {
      inv.messageTickets = (inv.messageTickets || 0) + 1;
    } else if (picked === 'popularity_message_1x') {
      inv.popularityMessages = (inv.popularityMessages || 0) + 1;
    } else if (picked === 'sticker_card') {
      inv.stickerCards = (inv.stickerCards || 0) + 1;
    }

    this.saveInventory(userId, inv);

    return {
      success: true,
      awardedItem: picked,
      itemInfo: ITEM_DEFINITIONS[picked],
      remainingBoxes: inv.welcomeBoxes,
      message: `축하합니다! '${ITEM_DEFINITIONS[picked].name}' 아이템을 획득하셨습니다.`,
    };
  }

  // Activate Broad Search Antenna (1 hour boost)
  static activateBroadSearchAntenna(userId: string): {
    success: boolean;
    remainingAntennas: number;
    expiresAt: number;
    message: string;
  } {
    const inv = this.getInventory(userId);
    if (inv.boostAntennas <= 0) {
      return {
        success: false,
        remainingAntennas: 0,
        expiresAt: inv.boostRadiusExpiresAt || 0,
        message: '보유한 광역 검색 안테나가 없습니다.',
      };
    }

    inv.boostAntennas -= 1;
    const baseTime = inv.boostRadiusExpiresAt && inv.boostRadiusExpiresAt > Date.now()
      ? inv.boostRadiusExpiresAt
      : Date.now();
    inv.boostRadiusExpiresAt = baseTime + 60 * 60 * 1000;
    this.saveInventory(userId, inv);

    return {
      success: true,
      remainingAntennas: inv.boostAntennas,
      expiresAt: inv.boostRadiusExpiresAt,
      message: '광역 검색 안테나가 활성화되었습니다! 1시간 동안 탐색 반경을 자유롭게 조절할 수 있습니다 📡',
    };
  }

  // Check Radius Boost status
  static isBoostRadiusActive(userId: string): boolean {
    const inv = this.getInventory(userId);
    if (!inv.boostRadiusExpiresAt) return false;
    return inv.boostRadiusExpiresAt > Date.now();
  }

  static getRemainingBoostMinutes(userId: string): number {
    const inv = this.getInventory(userId);
    if (!inv.boostRadiusExpiresAt) return 0;
    const diff = inv.boostRadiusExpiresAt - Date.now();
    return Math.max(0, Math.ceil(diff / (60 * 1000)));
  }

  // Get max allowed search radius: 30 km if antenna active, otherwise default 1.0 km
  static getMaxAllowedRadiusKm(userId: string): number {
    return this.isBoostRadiusActive(userId) ? 30.0 : 1.0;
  }

  // Use a Message Ticket (+1 message today)
  static useMessageTicket(userId: string): { success: boolean; remainingTickets: number; newTotalQuota: number; message: string } {
    const inv = this.getInventory(userId);
    if (inv.messageTickets <= 0) {
      return {
        success: false,
        remainingTickets: 0,
        newTotalQuota: this.getDailyTotalMessageLimit(userId),
        message: '보유한 메시지 횟수 증가권이 없습니다.',
      };
    }

    inv.messageTickets -= 1;
    inv.bonusMessagesToday = (inv.bonusMessagesToday || 0) + 1;
    this.saveInventory(userId, inv);

    return {
      success: true,
      remainingTickets: inv.messageTickets,
      newTotalQuota: this.getDailyTotalMessageLimit(userId),
      message: '오늘 전송 가능한 메시지 횟수가 +1회 증가했습니다! 🎉',
    };
  }

  // Message Quota Calculations
  static getDailyBaseMessageLimit(): number {
    return 3; // 기본 하루 3회
  }

  static getDailyTotalMessageLimit(userId: string): number {
    const inv = this.getInventory(userId);
    return this.getDailyBaseMessageLimit() + (inv.bonusMessagesToday || 0);
  }

  static getRemainingMessagesToday(userId: string): number {
    const daily = this.getDailyActivity(userId);
    const total = this.getDailyTotalMessageLimit(userId);
    return Math.max(0, total - (daily.messagesSentToday || 0));
  }

  static canSendMessage(userId: string): boolean {
    return this.getRemainingMessagesToday(userId) > 0;
  }

  static recordMessageSent(userId: string): { remaining: number } {
    const daily = this.getDailyActivity(userId);
    daily.messagesSentToday = (daily.messagesSentToday || 0) + 1;
    this.saveDailyActivity(userId, daily);
    return {
      remaining: this.getRemainingMessagesToday(userId),
    };
  }

  // Consume Popularity Message Item (returns true if had item and consumed)
  static consumePopularityMessage(userId: string): boolean {
    const inv = this.getInventory(userId);
    if (inv.popularityMessages > 0) {
      inv.popularityMessages -= 1;
      this.saveInventory(userId, inv);
      return true;
    }
    return false;
  }

  // Daily Popularity Voting (하루 1명에게 +1 or -1)
  static canVotePopularityToday(userId: string): boolean {
    const daily = this.getDailyActivity(userId);
    return !daily.votedTargetUserId;
  }

  static getTodayVoteInfo(userId: string): { votedTargetUserId?: string; voteType?: 'up' | 'down' } {
    const daily = this.getDailyActivity(userId);
    return {
      votedTargetUserId: daily.votedTargetUserId,
      voteType: daily.voteType,
    };
  }

  static votePopularity(
    currentUserId: string,
    targetUserId: string,
    type: 'up' | 'down'
  ): { success: boolean; newPopularity: number; message: string } {
    if (currentUserId === targetUserId) {
      return { success: false, newPopularity: 100, message: '자신에게는 투표할 수 없습니다.' };
    }

    const daily = this.getDailyActivity(currentUserId);
    if (daily.votedTargetUserId) {
      return {
        success: false,
        newPopularity: 100,
        message: '인기도 선택은 하루에 1명에게만 가능합니다. 내일 다시 투표해주세요!',
      };
    }

    // Update target user's popularity
    const delta = type === 'up' ? 1 : -1;
    const updatedUser = DatingService.updateUserPopularity(targetUserId, delta);

    // Record vote
    daily.votedTargetUserId = targetUserId;
    daily.voteType = type;
    this.saveDailyActivity(currentUserId, daily);

    const actionText = type === 'up' ? '올렸습니다 (+1) 🔥' : '내렸습니다 (-1) ❄️';
    return {
      success: true,
      newPopularity: updatedUser ? updatedUser.popularity : 100,
      message: `${updatedUser?.name || '상대방'}님의 인기도를 ${actionText}`,
    };
  }

  // Profile Sticker Placement (제3자가 붙이는 스티커 - 스티커 붙이기 카드 1장 소모, 3일간 유지)
  static attachSticker(
    currentUserId: string,
    targetUserId: string,
    stickerLabel: string
  ): {
    success: boolean;
    stickers: Record<string, number>;
    myGivenStickers: string[];
    action?: 'attached' | 'removed';
    expiresAt?: number;
    remainingCards: number;
    message: string;
  } {
    const inv = this.getInventory(currentUserId);
    const existingGiven = DatingService.getMyGivenStickers(currentUserId, targetUserId);
    const isAlreadyAttachedByMe = existingGiven.includes(stickerLabel);

    // If attaching new sticker and has no cards
    if (!isAlreadyAttachedByMe && inv.stickerCards <= 0) {
      const stickersRes = DatingService.getProfileStickers(currentUserId, targetUserId);
      return {
        success: false,
        stickers: stickersRes.stickers,
        myGivenStickers: stickersRes.myGivenStickers,
        remainingCards: 0,
        message: '보유한 [스티커 붙이기 카드]가 부족합니다. 환영박스에서 획득할 수 있습니다!',
      };
    }

    const res = DatingService.addStickerToProfile(currentUserId, targetUserId, stickerLabel);

    if (res.action === 'attached') {
      inv.stickerCards = Math.max(0, inv.stickerCards - 1);
      this.saveInventory(currentUserId, inv);
    }

    const message =
      res.action === 'attached'
        ? `[스티커 붙이기 카드] 1장을 소모하여 '${stickerLabel}' 스티커를 부착했습니다! (3일간 지속 🔖)`
        : `'${stickerLabel}' 스티커 부착을 취소했습니다.`;

    return {
      success: true,
      stickers: res.stickers,
      myGivenStickers: res.myGivenStickers,
      action: res.action,
      expiresAt: res.expiresAt,
      remainingCards: inv.stickerCards,
      message,
    };
  }

  // Admin & Event Direct Grant Helpers
  static addWelcomeBoxes(userId: string, count: number): number {
    const inv = this.getInventory(userId);
    inv.welcomeBoxes = (inv.welcomeBoxes || 0) + count;
    this.saveInventory(userId, inv);
    return inv.welcomeBoxes;
  }

  static addBoostAntenna(userId: string, count: number): number {
    const inv = this.getInventory(userId);
    inv.boostAntennas = (inv.boostAntennas || 0) + count;
    this.saveInventory(userId, inv);
    return inv.boostAntennas;
  }

  static addMessageTickets(userId: string, count: number): number {
    const inv = this.getInventory(userId);
    inv.messageTickets = (inv.messageTickets || 0) + count;
    this.saveInventory(userId, inv);
    return inv.messageTickets;
  }

  static addStickerCards(userId: string, count: number): number {
    const inv = this.getInventory(userId);
    inv.stickerCards = (inv.stickerCards || 0) + count;
    this.saveInventory(userId, inv);
    return inv.stickerCards;
  }
}

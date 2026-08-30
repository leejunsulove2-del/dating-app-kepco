import { UserProfile, UserLocation, LikeAction, ChatMessage, FilterOptions } from '../types';
import { calculateDistanceKm, getRandomCoordinateNearby, calculateAge } from '../utils/geo';
import { INITIAL_PROFILES } from './mockProfiles';
import { FirebaseChatService } from './firebaseChatService';

const USERS_STORAGE_KEY = 'love_app_users';
const CURRENT_USER_KEY = 'love_app_current_user';
const LIKES_STORAGE_KEY = 'love_app_likes';
const MESSAGES_STORAGE_KEY = 'love_app_messages';
const VERIFICATION_CODES_KEY = 'love_app_email_verifications';
const USER_PASSWORDS_KEY = 'love_app_user_passwords';
const ALLOWED_DOMAINS_KEY = 'love_app_allowed_email_domains';

export interface AllowedDomainItem {
  domain: string;
  companyName: string;
}

export const DEFAULT_ALLOWED_DOMAINS: AllowedDomainItem[] = [
  { domain: 'korea.kr', companyName: '공무원 (대한민국 정부)' },
  { domain: 'kepco.co.kr', companyName: '한국전력공사' },
  { domain: 'lh.or.kr', companyName: '한국토지주택공사' },
  { domain: 'korail.com', companyName: '한국철도공사' },
  { domain: 'ex.co.kr', companyName: '한국도로공사' },
  { domain: 'kwater.or.kr', companyName: '한국수자원공사' },
  { domain: 'knto.or.kr', companyName: '한국관광공사' },
  { domain: 'nps.or.kr', companyName: '국민연금공단' },
  { domain: 'nhis.or.kr', companyName: '국민건강보험공단' },
  { domain: 'seoul.go.kr', companyName: '서울특별시' },
  { domain: 'gg.go.kr', companyName: '경기도' },
];

export class DatingService {
  // Default coordinates (Seoul Gangnam Station) if browser location is unavailable or blocked
  public static DEFAULT_CENTER = {
    latitude: 37.4979,
    longitude: 127.0276,
  };

  /**
   * Initialize local dataset if empty or relocate test accounts around user coordinates
   */
  public static initDatabase(
    currentLat = this.DEFAULT_CENTER.latitude,
    currentLng = this.DEFAULT_CENTER.longitude,
    forceRelocate = false
  ): void {
    const existingUsersJson = localStorage.getItem(USERS_STORAGE_KEY);
    let users: UserProfile[] = existingUsersJson ? JSON.parse(existingUsersJson) : [];

    const testUsers = users.filter((u) => u.isTestAccount);
    const nonTestUsers = users.filter((u) => !u.isTestAccount);

    // Relocate if no test users exist, forceRelocate is true, or test users are far from current location (> 2km)
    const needsLocationRebase =
      testUsers.length === 0 ||
      forceRelocate ||
      (testUsers.length > 0 &&
        testUsers[0].location &&
        calculateDistanceKm(currentLat, currentLng, testUsers[0].location.latitude, testUsers[0].location.longitude) > 2);

    if (needsLocationRebase) {
      const generatedTestUsers = this.generateTestAccountsAround(currentLat, currentLng);
      // Combine with non-test real users
      const allUsers = [...nonTestUsers, ...generatedTestUsers];
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(allUsers));
    }
  }

  /**
   * Generate test accounts with diverse radial distances (0.2km ~ 28.5km) around user coordinates
   * Allows thorough testing of 1km base radius, 5km, 10km, 20km, 30km antenna radius filters!
   */
  public static generateTestAccountsAround(
    centerLat: number,
    centerLng: number
  ): UserProfile[] {
    // Distinct distance tiers:
    // Close tier (< 1km): 0.25km, 0.52km, 0.84km -> visible in base 1km mode
    // Mid tier (1km ~ 5km): 1.6km, 3.2km, 4.8km -> visible in 5km antenna mode
    // Extended tier (5km ~ 15km): 7.5km, 11.2km, 14.6km -> visible in 15km mode
    // Far tier (15km ~ 30km): 18.5km, 23.4km, 28.2km -> visible in 30km mode
    const baseDistances = [0.25, 0.52, 0.84, 1.65, 3.2, 4.85, 7.5, 11.2, 14.6, 18.5, 23.4, 28.2];
    const angles = [35, 125, 210, 295, 70, 160, 245, 330, 95, 180, 270, 350]; // 360-degree spread

    return INITIAL_PROFILES.map((p, idx) => {
      // Add slight random jitter (± 5%) so each generation is unique
      const jitter = (Math.random() - 0.5) * 0.15;
      const distKm = Math.max(0.15, Math.round((baseDistances[idx % baseDistances.length] + jitter) * 100) / 100);
      const angleDeg = (angles[idx % angles.length] + Math.floor(Math.random() * 20 - 10) + 360) % 360;
      const angleRad = (angleDeg * Math.PI) / 180;

      // 1 deg lat ~= 111.32 km
      const deltaLat = (distKm * Math.cos(angleRad)) / 111.32;
      const deltaLng =
        (distKm * Math.sin(angleRad)) /
        (111.32 * Math.cos((centerLat * Math.PI) / 180));

      const lat = Math.round((centerLat + deltaLat) * 100000) / 100000;
      const lng = Math.round((centerLng + deltaLng) * 100000) / 100000;
      const actualDist = calculateDistanceKm(centerLat, centerLng, lat, lng);

      // Fresh last active (between 15 seconds and 45 minutes ago)
      const minutesAgo = idx % 2 === 0 ? 0.3 : 3 + (idx * 3.5);
      const lastActive = Date.now() - minutesAgo * 60 * 1000;
      const isOnline = minutesAgo < 3;

      return {
        ...p,
        isTestAccount: true,
        popularity: p.popularity ?? (105 + (idx * 3) % 25),
        stickers: p.stickers ?? {
          '✨ 훈훈비주얼': 5 + (idx % 6),
          '☕ 커피메이트': 3 + (idx % 4),
        },
        isOnline,
        lastActive,
        location: {
          latitude: lat,
          longitude: lng,
          lastUpdated: lastActive,
        },
        distanceKm: actualDist,
      };
    });
  }

  /**
   * Delete ALL test accounts (모두삭제 요청 처리)
   */
  public static deleteAllTestAccounts(): { count: number; remainingCount: number } {
    const allUsers = this.getAllUsers();
    const nonTestUsers = allUsers.filter(
      (u) => !u.isTestAccount && !u.id.startsWith('user_') && !u.id.startsWith('demo_user_')
    );
    const deletedCount = allUsers.length - nonTestUsers.length;

    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(nonTestUsers));

    // Also clean messages from test accounts
    const allMessages = this.getMessages();
    const cleanMessages = allMessages.filter(
      (m) => !m.senderId.startsWith('user_') && !m.receiverId.startsWith('user_')
    );
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(cleanMessages));

    return { count: deletedCount, remainingCount: nonTestUsers.length };
  }

  /**
   * Recreate or respawn test accounts around center
   */
  public static recreateTestAccounts(
    currentLat = this.DEFAULT_CENTER.latitude,
    currentLng = this.DEFAULT_CENTER.longitude
  ): UserProfile[] {
    const allUsers = this.getAllUsers();
    const nonTestUsers = allUsers.filter(
      (u) => !u.isTestAccount && !u.id.startsWith('user_') && !u.id.startsWith('demo_user_')
    );
    const newTestUsers = this.generateTestAccountsAround(currentLat, currentLng);
    const combined = [...nonTestUsers, ...newTestUsers];
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(combined));
    return newTestUsers;
  }

  /**
   * One-click [테스트 계정 모두삭제 & 재생성]
   * Deletes all old test accounts and spawns fresh accounts with random distances (0.2km ~ 28km)
   */
  public static resetAndRecreateRandomDistanceTestAccounts(
    currentLat = this.DEFAULT_CENTER.latitude,
    currentLng = this.DEFAULT_CENTER.longitude
  ): { deletedCount: number; newUsers: UserProfile[] } {
    const delRes = this.deleteAllTestAccounts();
    const newUsers = this.recreateTestAccounts(currentLat, currentLng);
    return {
      deletedCount: delRes.count,
      newUsers,
    };
  }

  /**
   * Check if any test account exists
   */
  public static hasTestAccounts(): boolean {
    const allUsers = this.getAllUsers();
    return allUsers.some((u) => u.isTestAccount || u.id.startsWith('user_') || u.id.startsWith('demo_user_'));
  }

  /**
   * Get list of admin-designated allowed email domains
   */
  public static getAllowedEmailDomains(): AllowedDomainItem[] {
    const raw = localStorage.getItem(ALLOWED_DOMAINS_KEY);
    if (!raw) {
      localStorage.setItem(ALLOWED_DOMAINS_KEY, JSON.stringify(DEFAULT_ALLOWED_DOMAINS));
      return DEFAULT_ALLOWED_DOMAINS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_ALLOWED_DOMAINS;
    }
  }

  /**
   * Save designated allowed email domains (Admin setting)
   */
  public static setAllowedEmailDomains(domains: AllowedDomainItem[]): void {
    localStorage.setItem(ALLOWED_DOMAINS_KEY, JSON.stringify(domains));
  }

  /**
   * Add a new allowed domain to whitelist
   */
  public static addAllowedEmailDomain(domainInput: string, companyNameInput?: string): boolean {
    const cleanDomain = domainInput.replace(/^@/, '').toLowerCase().trim();
    if (!cleanDomain || !cleanDomain.includes('.')) return false;

    const list = this.getAllowedEmailDomains();
    if (list.some((item) => item.domain.toLowerCase() === cleanDomain)) {
      return false; // Already exists
    }

    const companyName = companyNameInput?.trim() || cleanDomain.split('.')[0].toUpperCase();
    list.push({ domain: cleanDomain, companyName });
    this.setAllowedEmailDomains(list);
    return true;
  }

  /**
   * Remove an allowed domain from whitelist
   */
  public static removeAllowedEmailDomain(domainInput: string): boolean {
    const cleanDomain = domainInput.replace(/^@/, '').toLowerCase().trim();
    let list = this.getAllowedEmailDomains();
    const initialLen = list.length;
    list = list.filter((item) => item.domain.toLowerCase() !== cleanDomain);
    if (list.length !== initialLen) {
      this.setAllowedEmailDomains(list);
      return true;
    }
    return false;
  }

  /**
   * Reset allowed email domains to default preset
   */
  public static resetAllowedEmailDomains(): AllowedDomainItem[] {
    localStorage.setItem(ALLOWED_DOMAINS_KEY, JSON.stringify(DEFAULT_ALLOWED_DOMAINS));
    return DEFAULT_ALLOWED_DOMAINS;
  }

  /**
   * Check if a given email domain is in the allowed whitelist
   */
  public static isEmailDomainAllowed(email: string): {
    allowed: boolean;
    domain: string;
    matchedItem?: AllowedDomainItem;
  } {
    if (!email || !email.includes('@')) {
      return { allowed: false, domain: '' };
    }
    const parts = email.toLowerCase().trim().split('@');
    const domain = parts[parts.length - 1];
    const list = this.getAllowedEmailDomains();

    const matchedItem = list.find(
      (item) => item.domain.toLowerCase() === domain || domain.endsWith('.' + item.domain.toLowerCase())
    );

    return {
      allowed: Boolean(matchedItem),
      domain,
      matchedItem,
    };
  }

  /**
   * Request email verification code
   * - Restricts re-sending: 1-hour cooldown per same email address
   * - Generates random alphanumeric verification code (combination of uppercase letters & digits, e.g. '7K9M2X')
   * - Checks whitelist strictly
   */
  public static sendEmailVerificationCode(email: string): {
    success: boolean;
    code: string;
    expiresAt: number;
    cooldownUntil?: number;
    message?: string;
  } {
    const cleanEmail = email.toLowerCase().trim();
    
    // Strict domain whitelist check
    const domainCheck = this.isEmailDomainAllowed(cleanEmail);
    if (!domainCheck.allowed) {
      return {
        success: false,
        code: '',
        expiresAt: 0,
        message: `지정된 공공기관/공기업/지자체 도메인(@${domainCheck.domain || '...'})의 이메일이 아닙니다. 허용된 기관 이메일로만 가입이 가능합니다.`,
      };
    }

    const now = Date.now();
    const codesMap: Record<string, { code: string; expiresAt: number; sentAt: number }> = JSON.parse(
      localStorage.getItem(VERIFICATION_CODES_KEY) || '{}'
    );
    const existing = codesMap[cleanEmail];

    // Check 1-hour cooldown (3600 * 1000 ms)
    const ONE_HOUR_MS = 60 * 60 * 1000;
    if (existing && existing.sentAt && (now - existing.sentAt) < ONE_HOUR_MS) {
      const remainingMinutes = Math.ceil((ONE_HOUR_MS - (now - existing.sentAt)) / 60000);
      return {
        success: false,
        code: '',
        expiresAt: existing.expiresAt,
        cooldownUntil: existing.sentAt + ONE_HOUR_MS,
        message: `동일한 이메일로는 1시간에 1회만 인증메일을 발송할 수 있습니다. (약 ${remainingMinutes}분 후 재시도 가능)`,
      };
    }

    // Generate random alphanumeric string (6 characters: uppercase letters + numbers)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude ambiguous characters like I, O, 0, 1
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Verification code valid for 1 hour
    const expiresAt = now + ONE_HOUR_MS;

    codesMap[cleanEmail] = { code, expiresAt, sentAt: now };
    localStorage.setItem(VERIFICATION_CODES_KEY, JSON.stringify(codesMap));

    return {
      success: true,
      code,
      expiresAt,
      cooldownUntil: now + ONE_HOUR_MS,
      message: '인증메일이 발송되었습니다.',
    };
  }

  /**
   * Verify email code (case-insensitive alphanumeric match)
   */
  public static verifyEmailCode(email: string, inputCode: string): { success: boolean; message: string } {
    const codesMap = JSON.parse(localStorage.getItem(VERIFICATION_CODES_KEY) || '{}');
    const record = codesMap[email.toLowerCase().trim()];

    if (!record) {
      return { success: false, message: '인증번호 요청 내역이 없습니다. 먼저 인증메일을 발송해주세요.' };
    }

    if (Date.now() > record.expiresAt) {
      return { success: false, message: '인증코드 유효시간(1시간)이 만료되었습니다. 다시 요청해주세요.' };
    }

    if (record.code.trim().toUpperCase() !== inputCode.trim().toUpperCase()) {
      return { success: false, message: '인증코드가 일치하지 않습니다. 영문/숫자 조합을 다시 확인해주세요.' };
    }

    return { success: true, message: '이메일 인증이 성공적으로 완료되었습니다!' };
  }

  /**
   * User Password Authentication Helpers
   */
  public static saveUserPassword(email: string, passwordPlain: string): void {
    const map = JSON.parse(localStorage.getItem(USER_PASSWORDS_KEY) || '{}');
    map[email.toLowerCase().trim()] = passwordPlain;
    localStorage.setItem(USER_PASSWORDS_KEY, JSON.stringify(map));
  }

  public static verifyUserPassword(email: string, passwordPlain: string): boolean {
    const map = JSON.parse(localStorage.getItem(USER_PASSWORDS_KEY) || '{}');
    const stored = map[email.toLowerCase().trim()];
    if (!stored) {
      // Fallback for default demo accounts or users without saved password
      return passwordPlain.length >= 4;
    }
    return stored === passwordPlain;
  }

  /**
   * Get Current Logged In User
   */
  public static getCurrentUser(): UserProfile | null {
    const json = localStorage.getItem(CURRENT_USER_KEY);
    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  /**
   * Save / Update Current User
   */
  public static saveCurrentUser(user: UserProfile): void {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    
    // Also update in all users collection
    const allUsers = this.getAllUsers();
    const idx = allUsers.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      allUsers[idx] = user;
    } else {
      allUsers.push(user);
    }
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(allUsers));
  }

  /**
   * Get all registered users
   */
  public static getAllUsers(): UserProfile[] {
    const json = localStorage.getItem(USERS_STORAGE_KEY);
    if (!json) {
      this.initDatabase();
      return JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]');
    }
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  }

  /**
   * Broadcast / Sync User Location (Transmits ONLY coordinate payload, every 30s)
   */
  public static syncUserLocation(userId: string, location: UserLocation): UserProfile | null {
    const currentUser = this.getCurrentUser();
    if (!currentUser || currentUser.id !== userId) return null;

    currentUser.location = {
      ...location,
      lastUpdated: Date.now(),
    };
    currentUser.lastActive = Date.now();
    this.saveCurrentUser(currentUser);
    return currentUser;
  }

  /**
   * Fetch nearby active users filtered and calculate distances from current location
   */
  public static fetchNearbyUsers(
    currentLat: number,
    currentLng: number,
    currentUserId: string,
    filter: FilterOptions
  ): UserProfile[] {
    const allUsers = this.getAllUsers();

    return allUsers
      .filter((user) => {
        if (user.id === currentUserId) return false;
        if (!user.location) return false;

        // Gender filter
        if (filter.genderFilter !== 'all' && user.gender !== filter.genderFilter) {
          return false;
        }

        // Age filter
        const age = user.age || calculateAge(user.birthDate);
        if (age < filter.minAge || age > filter.maxAge) {
          return false;
        }

        // Interest filter
        if (filter.selectedInterests.length > 0) {
          const hasCommonInterest = user.interests.some((i) =>
            filter.selectedInterests.includes(i)
          );
          if (!hasCommonInterest) return false;
        }

        // 1-Hour Inactive Rule: Exclude members whose last active time > 1 hour (60 minutes)
        const ONE_HOUR_MS = 60 * 60 * 1000;
        const timeSinceActive = Date.now() - (user.lastActive || 0);
        if (timeSinceActive > ONE_HOUR_MS) {
          return false;
        }

        return true;
      })
      .map((user) => {
        const dist = calculateDistanceKm(
          currentLat,
          currentLng,
          user.location!.latitude,
          user.location!.longitude
        );
        const timeSinceActive = Date.now() - (user.lastActive || 0);
        const isOnline = timeSinceActive < 3 * 60 * 1000; // 3분 이내 활동시 실시간 접속 중
        return {
          ...user,
          isOnline,
          distanceKm: dist,
        };
      })
      .filter((user) => user.distanceKm! <= filter.maxDistanceKm)
      .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
  }

  /**
   * Likes & Matches
   */
  public static getLikes(): LikeAction[] {
    const json = localStorage.getItem(LIKES_STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  }

  public static sendLike(fromUserId: string, toUserId: string): { isMatch: boolean } {
    const likes = this.getLikes();
    const existing = likes.find((l) => l.fromUserId === fromUserId && l.toUserId === toUserId);
    if (existing) {
      return { isMatch: !!existing.isMatch };
    }

    // Check if the other person already liked current user
    const counterpartLike = likes.find((l) => l.fromUserId === toUserId && l.toUserId === fromUserId);
    const isMatch = !!counterpartLike;

    const newLike: LikeAction = {
      id: `like_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      fromUserId,
      toUserId,
      timestamp: Date.now(),
      isMatch,
    };

    if (counterpartLike) {
      counterpartLike.isMatch = true;
    }

    likes.push(newLike);
    localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(likes));

    // If match, auto-create welcome match message and Realtime Database room
    if (isMatch) {
      const allUsers = this.getAllUsers();
      const userFrom = allUsers.find((u) => u.id === fromUserId);
      const userTo = allUsers.find((u) => u.id === toUserId);
      if (userFrom && userTo) {
        FirebaseChatService.createOrGetRoom(userFrom, userTo).catch(console.error);
      }

      this.sendMessage(
        toUserId,
        fromUserId,
        '서로 매칭되었습니다! 🎉 가볍게 인사를 나누어보세요.'
      );
    }

    return { isMatch };
  }

  public static hasLiked(fromUserId: string, toUserId: string): boolean {
    const likes = this.getLikes();
    return likes.some((l) => l.fromUserId === fromUserId && l.toUserId === toUserId);
  }

  public static checkMatch(userId1: string, userId2: string): boolean {
    const likes = this.getLikes();
    const l1 = likes.find((l) => l.fromUserId === userId1 && l.toUserId === userId2);
    const l2 = likes.find((l) => l.fromUserId === userId2 && l.toUserId === userId1);
    return !!(l1 && l2);
  }

  /**
   * Chat Messages
   */
  public static getMessages(): ChatMessage[] {
    const json = localStorage.getItem(MESSAGES_STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  }

  public static getConversation(userId1: string, userId2: string): ChatMessage[] {
    const all = this.getMessages();
    return all.filter(
      (m) =>
        (m.senderId === userId1 && m.receiverId === userId2) ||
        (m.senderId === userId2 && m.receiverId === userId1)
    ).sort((a, b) => a.timestamp - b.timestamp);
  }

  public static sendMessage(senderId: string, receiverId: string, text: string): ChatMessage {
    const all = this.getMessages();
    const roomId = FirebaseChatService.getRoomId(senderId, receiverId);
    const msg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      roomId,
      senderId,
      receiverId,
      text,
      timestamp: Date.now(),
      read: false,
    };
    all.push(msg);
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(all));
    return msg;
  }

  public static updateUserPopularity(userId: string, delta: number): UserProfile | null {
    const allUsers = this.getAllUsers();
    const target = allUsers.find((u) => u.id === userId);
    if (!target) return null;

    target.popularity = Math.max(0, (target.popularity ?? 100) + delta);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(allUsers));

    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      currentUser.popularity = target.popularity;
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
    }

    return target;
  }

  /**
   * Add / Attach a sticker to a user profile with 3-day (72-hour) retention duration
   */
  public static addStickerToProfile(
    currentUserId: string,
    targetUserId: string,
    stickerLabel: string
  ): {
    stickers: Record<string, number>;
    myGivenStickers: string[];
    attachedItems: import('../types').AttachedStickerItem[];
    action: 'attached' | 'removed';
    expiresAt?: number;
  } {
    const allUsers = this.getAllUsers();
    const target = allUsers.find((u) => u.id === targetUserId);
    if (!target) {
      return { stickers: {}, myGivenStickers: [], attachedItems: [], action: 'attached' };
    }

    const detailedKey = `yeon_attached_stickers_v2_${targetUserId}`;
    let items: import('../types').AttachedStickerItem[] = [];
    try {
      items = JSON.parse(localStorage.getItem(detailedKey) || '[]');
    } catch {
      items = [];
    }

    // 1. Purge expired stickers (older than 3 days)
    const now = Date.now();
    items = items.filter((item) => item.expiresAt > now);

    // 2. Check if current user already attached this specific sticker to this target profile
    const existingIndex = items.findIndex(
      (item) => item.giverUserId === currentUserId && item.stickerLabel === stickerLabel
    );

    let action: 'attached' | 'removed' = 'attached';
    let newExpiresAt: number | undefined;

    if (existingIndex >= 0) {
      // Remove sticker (toggle off)
      items.splice(existingIndex, 1);
      action = 'removed';
    } else {
      // Attach sticker with exact 3-day expiration (3 * 24 * 60 * 60 * 1000)
      newExpiresAt = now + 3 * 24 * 60 * 60 * 1000;
      const newItem: import('../types').AttachedStickerItem = {
        id: `stk_${now}_${Math.random().toString(36).substring(2, 7)}`,
        stickerLabel,
        giverUserId: currentUserId,
        attachedAt: now,
        expiresAt: newExpiresAt,
      };
      items.push(newItem);
      action = 'attached';
    }

    // Save updated detailed stickers list for this target user
    localStorage.setItem(detailedKey, JSON.stringify(items));

    // Get initial base stickers from the target's original blueprint
    const initialTarget = INITIAL_PROFILES.find((p) => p.id === targetUserId);
    const baseStickers: Record<string, number> = { ...(initialTarget?.stickers || {}) };

    // Recompute aggregate counts: base + dynamic items
    const aggregatedCounts: Record<string, number> = { ...baseStickers };
    const myGivenList: string[] = [];

    items.forEach((item) => {
      aggregatedCounts[item.stickerLabel] = (aggregatedCounts[item.stickerLabel] || 0) + 1;
      if (item.giverUserId === currentUserId && !myGivenList.includes(item.stickerLabel)) {
        myGivenList.push(item.stickerLabel);
      }
    });

    target.stickers = aggregatedCounts;
    target.attachedStickersList = items;
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(allUsers));

    return {
      stickers: target.stickers,
      myGivenStickers: myGivenList,
      attachedItems: items,
      action,
      expiresAt: newExpiresAt,
    };
  }

  /**
   * Get active stickers and my given stickers for a specific profile (with expiration check)
   */
  public static getProfileStickers(
    currentUserId: string,
    targetUserId: string
  ): {
    stickers: Record<string, number>;
    myGivenStickers: string[];
    attachedItems: import('../types').AttachedStickerItem[];
  } {
    const detailedKey = `yeon_attached_stickers_v2_${targetUserId}`;
    let items: import('../types').AttachedStickerItem[] = [];
    try {
      items = JSON.parse(localStorage.getItem(detailedKey) || '[]');
    } catch {
      items = [];
    }

    const now = Date.now();
    items = items.filter((item) => item.expiresAt > now);

    const initialTarget = INITIAL_PROFILES.find((p) => p.id === targetUserId);
    const aggregatedCounts: Record<string, number> = { ...(initialTarget?.stickers || {}) };
    const myGivenList: string[] = [];

    items.forEach((item) => {
      aggregatedCounts[item.stickerLabel] = (aggregatedCounts[item.stickerLabel] || 0) + 1;
      if (item.giverUserId === currentUserId && !myGivenList.includes(item.stickerLabel)) {
        myGivenList.push(item.stickerLabel);
      }
    });

    const allUsers = this.getAllUsers();
    const target = allUsers.find((u) => u.id === targetUserId);
    if (target) {
      target.stickers = aggregatedCounts;
      target.attachedStickersList = items;
    }

    return {
      stickers: aggregatedCounts,
      myGivenStickers: myGivenList,
      attachedItems: items,
    };
  }

  public static getMyGivenStickers(currentUserId: string, targetUserId: string): string[] {
    const res = this.getProfileStickers(currentUserId, targetUserId);
    return res.myGivenStickers;
  }

  /**
   * Log out
   */
  public static logout(): void {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}


import { UserProfile, UserLocation, LikeAction, ChatMessage, FilterOptions } from '../types';
import { calculateDistanceKm, getRandomCoordinateNearby, calculateAge } from '../utils/geo';
import { INITIAL_PROFILES } from './mockProfiles';
import { FirebaseChatService } from './firebaseChatService';
import { getAvatarForUser } from '../utils/avatarUtils';
import { FirestoreSyncService } from './firestoreSyncService';
import { isFirebaseConfigured } from './firebaseConfig';
import { ApiSyncService } from './apiSyncService';

const USERS_STORAGE_KEY = 'love_app_users';
const CURRENT_USER_KEY = 'love_app_current_user';
const LIKES_STORAGE_KEY = 'love_app_likes';
const MESSAGES_STORAGE_KEY = 'love_app_messages';
const VERIFICATION_CODES_KEY = 'love_app_email_verifications';
const USER_PASSWORDS_KEY = 'love_app_user_passwords';
const ALLOWED_DOMAINS_KEY = 'love_app_allowed_email_domains';
const BLOCKED_USERS_PREFIX = 'love_app_blocked_users_';

export interface AllowedDomainItem {
  domain: string;
  companyName: string;
}

export function isTestAccountProfile(u: Partial<UserProfile> | null | undefined): boolean {
  if (!u || !u.id) return false;
  if (u.isTestAccount === true) return true;
  if (u.id.startsWith('mock_user_') || u.id.startsWith('demo_user_') || u.id.startsWith('seed_user_')) return true;
  // INITIAL_PROFILES uses user_1 ... user_12
  if (/^user_[0-9]{1,2}$/.test(u.id)) return true;
  return false;
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
    let users: UserProfile[] = [];
    try {
      users = existingUsersJson ? JSON.parse(existingUsersJson) : [];
    } catch {
      users = [];
    }

    // Migrate any old .webp photoUrls to valid .svg or SVG Data-URIs
    let hasMigration = false;
    users = users.map((u) => {
      if (u && u.photoUrl && (u.photoUrl.endsWith('.webp') || (!u.photoUrl.startsWith('data:') && !u.photoUrl.endsWith('.svg')))) {
        hasMigration = true;
        const isFemale = u.gender === 'female';
        const num = (parseInt(u.id.replace(/\D/g, ''), 10) || 1) % 5 + 1;
        const newUrl = isFemale ? `/assets/profiles/woman_${num}.svg` : `/assets/profiles/man_${num}.svg`;
        return { ...u, photoUrl: newUrl };
      }
      return u;
    });
    if (hasMigration) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      const curUser = this.getCurrentUser();
      if (curUser && curUser.photoUrl && (curUser.photoUrl.endsWith('.webp') || (!curUser.photoUrl.startsWith('data:') && !curUser.photoUrl.endsWith('.svg')))) {
        const isFemale = curUser.gender === 'female';
        const num = (parseInt(curUser.id.replace(/\D/g, ''), 10) || 1) % 5 + 1;
        curUser.photoUrl = isFemale ? `/assets/profiles/woman_${num}.svg` : `/assets/profiles/man_${num}.svg`;
        this.saveCurrentUser(curUser);
      }
    }

    // Filter true non-test users and deduplicate
    const nonTestUsersMap = new Map<string, UserProfile>();
    const testUsers: UserProfile[] = [];

    for (const u of users) {
      if (!u || !u.id) continue;
      const isTest = isTestAccountProfile(u);
      if (isTest) {
        testUsers.push(u);
      } else {
        if (!nonTestUsersMap.has(u.id)) {
          nonTestUsersMap.set(u.id, u);
        }
      }
    }

    const nonTestUsers = Array.from(nonTestUsersMap.values());

    // Relocate if no test users exist, forceRelocate is true, or test users are far from current location (> 2km)
    const needsLocationRebase =
      testUsers.length === 0 ||
      forceRelocate ||
      (testUsers.length > 0 &&
        testUsers[0].location &&
        calculateDistanceKm(currentLat, currentLng, testUsers[0].location.latitude, testUsers[0].location.longitude) > 2);

    if (needsLocationRebase) {
      const generatedTestUsers = this.generateTestAccountsAround(currentLat, currentLng);
      // Combine with non-test real users and deduplicate strictly by id
      const allUsersMap = new Map<string, UserProfile>();
      for (const u of nonTestUsers) {
        allUsersMap.set(u.id, u);
      }
      for (const u of generatedTestUsers) {
        allUsersMap.set(u.id, u);
      }
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(Array.from(allUsersMap.values())));
    } else {
      // Clean up any duplicates in existing storage
      const allUsersMap = new Map<string, UserProfile>();
      for (const u of users) {
        if (u && u.id) {
          allUsersMap.set(u.id, u);
        }
      }
      if (allUsersMap.size !== users.length) {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(Array.from(allUsersMap.values())));
      }
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
    const nonTestUsers = allUsers.filter((u) => !isTestAccountProfile(u));
    const deletedCount = allUsers.length - nonTestUsers.length;

    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(nonTestUsers));

    // Also clean messages from test accounts
    const allMessages = this.getMessages();
    const cleanMessages = allMessages.filter(
      (m) => !isTestAccountProfile({ id: m.senderId }) && !isTestAccountProfile({ id: m.receiverId })
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
    const nonTestUsers = allUsers.filter((u) => !isTestAccountProfile(u));
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
    return allUsers.some((u) => isTestAccountProfile(u));
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
   * Save / Update Current User (Persists to local storage & Cloud Firestore)
   */
  public static saveCurrentUser(user: UserProfile): void {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    
    // Also update in all users collection uniquely
    const allUsers = this.getAllUsers();
    const userMap = new Map<string, UserProfile>();
    for (const u of allUsers) {
      if (u && u.id) {
        userMap.set(u.id, u);
      }
    }
    userMap.set(user.id, user);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(Array.from(userMap.values())));

    // Sync to Server API and Cloud Firestore
    ApiSyncService.saveUser(user).catch(() => {});
  }

  /**
   * Save / Update Any User in Database
   */
  public static saveUser(user: UserProfile): void {
    const allUsers = this.getAllUsers();
    const userMap = new Map<string, UserProfile>();
    for (const u of allUsers) {
      if (u && u.id) {
        userMap.set(u.id, u);
      }
    }
    userMap.set(user.id, user);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(Array.from(userMap.values())));

    const cur = this.getCurrentUser();
    if (cur && cur.id === user.id) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    }

    // Sync to Server API and Cloud Firestore
    ApiSyncService.saveUser(user).catch(() => {});
    if (isFirebaseConfigured()) {
      FirestoreSyncService.saveUser(user).catch(() => {});
    }
  }

  /**
   * Bulk update internal users dataset from real-time Firestore stream
   */
  public static updateInternalUsersData(cloudUsers: UserProfile[]): void {
    if (!cloudUsers || cloudUsers.length === 0) return;
    const localUsers = this.getAllUsers();
    const userMap = new Map<string, UserProfile>();

    for (const u of localUsers) {
      if (u && u.id) userMap.set(u.id, u);
    }
    for (const cu of cloudUsers) {
      if (cu && cu.id) {
        const existing = userMap.get(cu.id);
        const merged: UserProfile = {
          ...(existing || {}),
          ...cu,
          location: cu.latitude && cu.longitude ? { latitude: cu.latitude, longitude: cu.longitude } : (cu.location || existing?.location),
        } as UserProfile;
        userMap.set(cu.id, merged);
      }
    }
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(Array.from(userMap.values())));
  }

  /**
   * Sync Users from Server and Cloud Firestore into local cache
   */
  public static async syncFromCloudFirestore(): Promise<UserProfile[]> {
    try {
      // 1. Try Server API
      const serverData = await ApiSyncService.fetchAllData();
      if (serverData && serverData.users && serverData.users.length > 0) {
        const localUsers = this.getAllUsers();
        const mergedMap = new Map<string, UserProfile>();
        for (const u of localUsers) {
          if (u && u.id) mergedMap.set(u.id, u);
        }
        for (const su of serverData.users) {
          if (su && su.id) mergedMap.set(su.id, su);
        }
        const mergedList = Array.from(mergedMap.values());
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(mergedList));

        // Sync passwords from server if available
        if (serverData.userPasswords && typeof serverData.userPasswords === 'object') {
          const passMap = JSON.parse(localStorage.getItem(USER_PASSWORDS_KEY) || '{}');
          localStorage.setItem(USER_PASSWORDS_KEY, JSON.stringify({ ...serverData.userPasswords, ...passMap }));
        }

        return mergedList;
      }

      // If server is empty but client has users, push client users to server
      const localUsers = this.getAllUsers();
      if (localUsers.length > 0 && serverData && (!serverData.users || serverData.users.length === 0)) {
        ApiSyncService.syncUsers(localUsers).catch(() => {});
      }

      // 2. Try Firestore
      if (isFirebaseConfigured()) {
        const cloudUsers = await FirestoreSyncService.getAllUsers();
        if (cloudUsers && cloudUsers.length > 0) {
          const mergedMap = new Map<string, UserProfile>();

          for (const u of localUsers) {
            if (u && u.id) mergedMap.set(u.id, u);
          }

          for (const cu of cloudUsers) {
            if (cu && cu.id) {
              mergedMap.set(cu.id, cu);
            }
          }

          const mergedList = Array.from(mergedMap.values());
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(mergedList));
          return mergedList;
        }
      }
    } catch (e) {
      console.warn('Failed to sync from server/Firestore:', e);
    }
    return this.getAllUsers();
  }

  /**
   * Listen to live real-time user updates across all devices
   */
  public static subscribeToLiveUsers(callback?: (users: UserProfile[]) => void): () => void {
    let active = true;

    // 1. If Firebase is configured, subscribe to Firestore snapshot
    const unsubFirestore = FirestoreSyncService.subscribeToUsers((cloudUsers) => {
      if (!active) return;
      if (cloudUsers && cloudUsers.length > 0) {
        this.updateInternalUsersData(cloudUsers);
        const mergedList = this.getAllUsers();
        if (callback) {
          callback(mergedList);
        }
      }
    });

    // 2. Server polling (every 2.5s) for instant cross-terminal sync (e.g. Device 1 & Device 2)
    const pollInterval = setInterval(async () => {
      if (!active) return;
      try {
        const serverData = await ApiSyncService.fetchAllData();
        if (!active || !serverData) return;

        if (serverData.userPasswords && typeof serverData.userPasswords === 'object') {
          const passMap = JSON.parse(localStorage.getItem(USER_PASSWORDS_KEY) || '{}');
          localStorage.setItem(USER_PASSWORDS_KEY, JSON.stringify({ ...serverData.userPasswords, ...passMap }));
        }

        if (serverData.users && serverData.users.length > 0) {
          const prevUsers = this.getAllUsers();
          const prevStr = JSON.stringify(prevUsers.map((u) => ({ id: u.id, s: u.approvalStatus, e: u.email })));

          this.updateInternalUsersData(serverData.users);
          const newUsers = this.getAllUsers();
          const newStr = JSON.stringify(newUsers.map((u) => ({ id: u.id, s: u.approvalStatus, e: u.email })));

          if (prevStr !== newStr && callback) {
            callback(newUsers);
          }
        }
      } catch (e) {
        // silent
      }
    }, 2500);

    return () => {
      active = false;
      clearInterval(pollInterval);
      if (unsubFirestore) unsubFirestore();
    };
  }

  /**
   * Get all registered users (Guaranteed unique by id)
   */
  public static getAllUsers(): UserProfile[] {
    const json = localStorage.getItem(USERS_STORAGE_KEY);
    let rawUsers: UserProfile[] = [];
    if (!json) {
      this.initDatabase();
      try {
        rawUsers = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]');
      } catch {
        rawUsers = [];
      }
    } else {
      try {
        rawUsers = JSON.parse(json);
      } catch {
        rawUsers = [];
      }
    }

    // Always deduplicate strictly by id
    const uniqueMap = new Map<string, UserProfile>();
    for (const u of rawUsers) {
      if (u && u.id && !uniqueMap.has(u.id)) {
        uniqueMap.set(u.id, u);
      }
    }
    return Array.from(uniqueMap.values());
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
    const seenIds = new Set<string>();

    return allUsers
      .filter((user) => {
        if (!user || !user.id) return false;
        if (user.id === currentUserId) return false;
        if (seenIds.has(user.id)) return false;
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

        // Sanction & Ban Check: Exclude banned or temporarily sanctioned users
        if (user.isBanned) {
          return false;
        }
        if (user.sanctionExpiresAt && user.sanctionExpiresAt > Date.now()) {
          return false;
        }

        // Blocked Check: Exclude users blocked by current user
        if (this.isUserBlocked(currentUserId, user.id)) {
          return false;
        }

        seenIds.add(user.id);
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
   * Blocked Users Management (부적절한 사용자 차단 및 관리)
   */
  public static getBlockedUserIds(currentUserId: string): string[] {
    if (!currentUserId) return [];
    try {
      const json = localStorage.getItem(`${BLOCKED_USERS_PREFIX}${currentUserId}`);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  }

  public static blockUser(currentUserId: string, targetUserId: string): void {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return;
    const blocked = this.getBlockedUserIds(currentUserId);
    if (!blocked.includes(targetUserId)) {
      blocked.push(targetUserId);
      localStorage.setItem(`${BLOCKED_USERS_PREFIX}${currentUserId}`, JSON.stringify(blocked));
    }
  }

  public static unblockUser(currentUserId: string, targetUserId: string): void {
    if (!currentUserId || !targetUserId) return;
    const blocked = this.getBlockedUserIds(currentUserId).filter((id) => id !== targetUserId);
    localStorage.setItem(`${BLOCKED_USERS_PREFIX}${currentUserId}`, JSON.stringify(blocked));
  }

  public static isUserBlocked(currentUserId: string, targetUserId: string): boolean {
    if (!currentUserId || !targetUserId) return false;
    const blocked = this.getBlockedUserIds(currentUserId);
    return blocked.includes(targetUserId);
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

    // Sync like action to Firestore
    FirestoreSyncService.saveLikeAction(newLike).catch((err) => {
      console.warn('Failed to save like action to Firestore:', err);
    });

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

  /**
   * Get random profile avatar from asset directory according to gender
   * 남자는 귀여운 강아지(dog_1.svg ~ dog_5.svg / man_1.svg ~ man_5.svg)
   * 여자는 귀여운 고양이(cat_1.svg ~ cat_5.svg / woman_1.svg ~ woman_5.svg)
   */
  public static getRandomProfileAvatar(gender: 'male' | 'female' | 'other'): string {
    const randNum = Math.floor(Math.random() * 5) + 1; // 1 ~ 5
    if (gender === 'female') {
      return `/assets/profiles/woman_${randNum}.svg`;
    }
    return `/assets/profiles/man_${randNum}.svg`;
  }

  public static updatePopularityScore(userId: string, delta: number): UserProfile | null {
    return this.updateUserPopularity(userId, delta);
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
   * Request Agency Membership Registration
   * - Sets approvalStatus to 'pending' (Agency Admin must approve)
   * - Automatically assigns random official avatar from /assets/profiles/
   */
  public static requestUserRegistration(params: {
    email: string;
    passwordPlain: string;
    name: string;
    gender: 'male' | 'female' | 'other';
    birthDate: string;
    age: number;
    company: string;
    bio: string;
    interests: string[];
    location?: UserLocation;
  }): { success: boolean; user?: UserProfile; message: string } {
    const cleanEmail = params.email.toLowerCase().trim();

    // Check banned email
    const BANNED_EMAILS_KEY = 'love_app_banned_emails';
    const banned: string[] = JSON.parse(localStorage.getItem(BANNED_EMAILS_KEY) || '[]');
    if (banned.includes(cleanEmail)) {
      return {
        success: false,
        message: '해당 이메일은 운영정책 위반으로 영구 차단된 계정입니다. 가입이 불가능합니다.',
      };
    }

    // Check domain whitelist
    const domainCheck = this.isEmailDomainAllowed(cleanEmail);
    if (!domainCheck.allowed) {
      return {
        success: false,
        message: `지정된 공공기관/공기업/지자체 도메인(@${domainCheck.domain || '...'})의 이메일이 아닙니다. 허용된 기관 이메일로만 가입이 가능합니다.`,
      };
    }

    const allUsers = this.getAllUsers();
    const existing = allUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      if (existing.approvalStatus === 'pending') {
        return {
          success: false,
          message: '이미 소속 기관 관리자 승인 대기 중인 이메일입니다. 기관 담당자 승인을 기다려주세요.',
        };
      }
      return {
        success: false,
        message: '이미 등록된 이메일 계정입니다. 로그인해주세요.',
      };
    }

    // Auto assign official avatar from asset folder based on gender
    const defaultAvatar = this.getRandomProfileAvatar(params.gender);

    const newUser: UserProfile = {
      id: `member_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: cleanEmail,
      name: params.name.trim(),
      gender: params.gender,
      birthDate: params.birthDate,
      age: params.age,
      company: params.company.trim() || (domainCheck.matchedItem?.companyName || '공공기관'),
      photoUrl: defaultAvatar,
      bio: params.bio.trim(),
      interests: params.interests,
      location: params.location || {
        latitude: this.DEFAULT_CENTER.latitude,
        longitude: this.DEFAULT_CENTER.longitude,
        lastUpdated: Date.now(),
      },
      isOnline: false,
      verifiedEmail: false, // will be verified upon agency approval
      createdAt: Date.now(),
      lastActive: Date.now(),
      popularity: 100,
      approvalStatus: 'pending',
      agencyDomain: domainCheck.domain,
      isTestAccount: false,
    };

    // Save Password
    this.saveUserPassword(cleanEmail, params.passwordPlain);

    // Save user locally
    allUsers.push(newUser);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(allUsers));

    // Save to Server API for instant cross-terminal / cross-device propagation
    ApiSyncService.registerUser(newUser, params.passwordPlain).catch((err) => {
      console.warn('Failed to save registered user to Server API:', err);
    });

    // Save to Cloud Firestore for permanent cross-device persistence
    FirestoreSyncService.saveUser(newUser).catch((err) => {
      console.warn('Failed to save registered user to Cloud Firestore:', err);
    });

    return {
      success: true,
      user: newUser,
      message: `[${domainCheck.matchedItem?.companyName || '소속 기관'}] 가입 신청이 성공적으로 접수되었습니다. 기관 담당자 승인 완료 후 정상 로그인이 가능합니다.`,
    };
  }

  /**
   * User Login with Agency Approval Status Check (with cross-device Server API & Cloud Firestore sync)
   */
  public static async loginUserWithApprovalCheck(
    email: string,
    passwordPlain: string
  ): Promise<{
    success: boolean;
    user?: UserProfile;
    isPendingApproval?: boolean;
    isRejected?: boolean;
    message?: string;
  }> {
    const cleanEmail = email.toLowerCase().trim();

    // Check banned email
    const BANNED_EMAILS_KEY = 'love_app_banned_emails';
    const banned: string[] = JSON.parse(localStorage.getItem(BANNED_EMAILS_KEY) || '[]');
    if (banned.includes(cleanEmail)) {
      return {
        success: false,
        message: '해당 계정은 운영정책 위반으로 영구 이용정지된 상태입니다. 접속할 수 없습니다.',
      };
    }

    // 1. Try local lookup first
    let allUsers = this.getAllUsers();
    let user = allUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    // 2. Query Server API & Firestore if user is not in local storage OR is pending/rejected
    if (!user || user.approvalStatus === 'pending') {
      try {
        const serverData = await ApiSyncService.fetchAllData();
        if (serverData) {
          if (serverData.users && serverData.users.length > 0) {
            this.updateInternalUsersData(serverData.users);
          }
          if (serverData.userPasswords && typeof serverData.userPasswords === 'object') {
            const passMap = JSON.parse(localStorage.getItem(USER_PASSWORDS_KEY) || '{}');
            localStorage.setItem(USER_PASSWORDS_KEY, JSON.stringify({ ...serverData.userPasswords, ...passMap }));
          }
        }
      } catch (e) {
        console.warn('Failed to refresh users from Server on login check:', e);
      }

      if (isFirebaseConfigured()) {
        try {
          const cloudUsers = await FirestoreSyncService.getAllUsers();
          if (cloudUsers && cloudUsers.length > 0) {
            this.updateInternalUsersData(cloudUsers);
          }
        } catch (e) {
          console.warn('Failed to refresh users from Cloud Firestore on login check:', e);
        }
      }

      allUsers = this.getAllUsers();
      user = allUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    }

    // 3. If STILL not found, query dedicated user check endpoint directly
    if (!user) {
      try {
        const checkRes = await ApiSyncService.checkUser(cleanEmail);
        if (checkRes.exists && checkRes.user) {
          this.saveUser(checkRes.user);
          allUsers = this.getAllUsers();
          user = allUsers.find((u) => u.email.toLowerCase() === cleanEmail) || checkRes.user;
        }
      } catch (e) {
        console.warn('Direct checkUser endpoint failed:', e);
      }
    }

    if (!user) {
      return {
        success: false,
        message: '가입되지 않은 이메일 계정입니다. 회원가입 신청을 먼저 진행해주세요.',
      };
    }

    // Verify Password
    if (!this.verifyUserPassword(cleanEmail, passwordPlain)) {
      return {
        success: false,
        message: '비밀번호가 일치하지 않습니다.',
      };
    }

    // Check Approval Status
    if (user.approvalStatus === 'pending') {
      return {
        success: false,
        isPendingApproval: true,
        message: '소속 기관 담당자의 가입 승인 대기 중입니다. 기관 관리자가 승인한 이후 로그인하실 수 있습니다.',
      };
    }

    if (user.approvalStatus === 'rejected') {
      return {
        success: false,
        isRejected: true,
        message: `가입 요청이 반려되었습니다. (사유: ${user.rejectionReason || '소속 기관 확인 불가'})`,
      };
    }

    // Check Sanctions
    const now = Date.now();
    if (user.isBanned) {
      return {
        success: false,
        message: '운영정책 위반으로 영구 차단된 계정입니다.',
      };
    }

    // Save as Current User
    user.isOnline = true;
    user.lastActive = now;
    this.saveCurrentUser(user);

    return {
      success: true,
      user,
      message: '로그인되었습니다.',
    };
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


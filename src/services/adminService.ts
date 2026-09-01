import {
  UserProfile,
  UserReport,
  AdminAccount,
  ReportReason,
  BioHistoryItem,
  UserRewardNotice,
  AdminBoardPost,
  AdminBoardComment,
  GiftDeliveryLog,
} from '../types';
import { DatingService } from './datingService';
import { ItemService } from './itemService';
import { FirebaseChatService } from './firebaseChatService';

const ADMIN_ACCOUNTS_KEY = 'love_app_admin_accounts';
const REPORTS_STORAGE_KEY = 'love_app_user_reports';
const BANNED_EMAILS_KEY = 'love_app_banned_emails';
const ADMIN_BOARD_POSTS_KEY = 'love_app_admin_board_posts';
const GIFT_DELIVERY_LOGS_KEY = 'love_app_gift_delivery_logs';

export const MASTER_ADMIN_CREDENTIALS: AdminAccount = {
  id: 'admin_master',
  email: 'admin@kepco.co.kr',
  name: '최고 관리자 (KEPCO)',
  department: '한국전력공사 시스템총괄실',
  isMaster: true,
  agencyDomain: 'kepco.co.kr',
  agencyName: '한국전력공사 (총괄)',
  passwordPlain: '12101074',
  eventBoxesRemaining: 999999,
  createdAt: 1700000000000,
};

// Initial default agency sample admin accounts (one domain can have multiple agency admins)
export const DEFAULT_AGENCY_ADMINS: AdminAccount[] = [
  {
    id: 'admin_agency_kepco1',
    email: 'hr_manager@kepco.co.kr',
    name: '김전력 (인사운영)',
    department: '한국전력공사 인재경영처',
    isMaster: false,
    agencyDomain: 'kepco.co.kr',
    agencyName: '한국전력공사',
    passwordPlain: '1234',
    eventBoxesRemaining: 1000,
    createdAt: 1700000001000,
    createdBy: 'admin@kepco.co.kr',
  },
  {
    id: 'admin_agency_kepco2',
    email: 'welfare@kepco.co.kr',
    name: '이복지 (사내복지)',
    department: '한국전력공사 노사복지부',
    isMaster: false,
    agencyDomain: 'kepco.co.kr',
    agencyName: '한국전력공사',
    passwordPlain: '1234',
    eventBoxesRemaining: 1000,
    createdAt: 1700000002000,
    createdBy: 'admin@kepco.co.kr',
  },
  {
    id: 'admin_agency_kwater',
    email: 'admin@kwater.or.kr',
    name: '박수자 (총무부)',
    department: '한국수자원공사 경영지원처',
    isMaster: false,
    agencyDomain: 'kwater.or.kr',
    agencyName: '한국수자원공사',
    passwordPlain: '1234',
    eventBoxesRemaining: 1000,
    createdAt: 1700000003000,
    createdBy: 'admin@kepco.co.kr',
  },
  {
    id: 'admin_agency_lh',
    email: 'admin@lh.or.kr',
    name: '최토지 (복지운영)',
    department: '한국토지주택공사 복지기획처',
    isMaster: false,
    agencyDomain: 'lh.or.kr',
    agencyName: '한국토지주택공사',
    passwordPlain: '1234',
    eventBoxesRemaining: 1000,
    createdAt: 1700000004000,
    createdBy: 'admin@kepco.co.kr',
  },
];

export class AdminService {
  /**
   * Check if credentials match master admin or a created agency admin
   */
  public static verifyAdminLogin(
    email: string,
    passwordPlain: string
  ): { isAdmin: boolean; adminAccount?: AdminAccount; error?: string } {
    const cleanEmail = email.toLowerCase().trim();

    // 1. Check Master Admin
    if (
      cleanEmail === MASTER_ADMIN_CREDENTIALS.email.toLowerCase() &&
      passwordPlain === MASTER_ADMIN_CREDENTIALS.passwordPlain
    ) {
      return {
        isAdmin: true,
        adminAccount: MASTER_ADMIN_CREDENTIALS,
      };
    }

    // 2. Check Agency Sub-Admins
    const admins = this.getAllAdminAccounts();
    const found = admins.find(
      (a) => a.email.toLowerCase() === cleanEmail && a.passwordPlain === passwordPlain
    );

    if (found) {
      return {
        isAdmin: true,
        adminAccount: found,
      };
    }

    return {
      isAdmin: false,
      error: '관리자 계정 정보(이메일 또는 비밀번호)가 일치하지 않습니다.',
    };
  }

  /**
   * Get all sub-admins (Agency Admins)
   */
  public static getAllAdminAccounts(): AdminAccount[] {
    try {
      const raw = localStorage.getItem(ADMIN_ACCOUNTS_KEY);
      if (!raw) {
        localStorage.setItem(ADMIN_ACCOUNTS_KEY, JSON.stringify(DEFAULT_AGENCY_ADMINS));
        return DEFAULT_AGENCY_ADMINS;
      }
      return JSON.parse(raw);
    } catch {
      return DEFAULT_AGENCY_ADMINS;
    }
  }

  public static getAdminAccounts(): AdminAccount[] {
    return this.getAllAdminAccounts();
  }

  /**
   * Save all sub-admins
   */
  public static saveAllAdminAccounts(admins: AdminAccount[]): void {
    localStorage.setItem(ADMIN_ACCOUNTS_KEY, JSON.stringify(admins));
  }

  /**
   * Create a new Agency Admin (Master admin can create multiple admins per agency!)
   */
  public static createAgencyAdmin(
    email: string,
    passwordPlain: string,
    name: string,
    department: string,
    agencyDomain: string,
    agencyName: string,
    creatorEmail: string,
    initialEventBoxes = 1000
  ): { success: boolean; adminAccount?: AdminAccount; message: string } {
    const cleanEmail = email.toLowerCase().trim();
    const cleanDomain = agencyDomain.replace(/^@/, '').toLowerCase().trim();

    if (cleanEmail === MASTER_ADMIN_CREDENTIALS.email.toLowerCase()) {
      return { success: false, message: '최고 관리자 이메일은 중복 생성할 수 없습니다.' };
    }

    const admins = this.getAllAdminAccounts();
    if (admins.some((a) => a.email.toLowerCase() === cleanEmail)) {
      return { success: false, message: '이미 등록된 관리자 이메일입니다.' };
    }

    const newAdmin: AdminAccount = {
      id: `admin_agency_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      email: cleanEmail,
      name: name.trim(),
      department: department.trim() || `${agencyName} 운영관리팀`,
      isMaster: false,
      agencyDomain: cleanDomain,
      agencyName: agencyName.trim() || cleanDomain,
      passwordPlain,
      eventBoxesRemaining: Math.max(0, initialEventBoxes),
      createdAt: Date.now(),
      createdBy: creatorEmail,
    };

    admins.push(newAdmin);
    this.saveAllAdminAccounts(admins);

    return {
      success: true,
      adminAccount: newAdmin,
      message: `[${newAdmin.agencyName}] ${newAdmin.name} 기관관리자(${cleanEmail})가 성공적으로 생성되었습니다. (초기 이벤트상자: ${newAdmin.eventBoxesRemaining.toLocaleString()}개)`,
    };
  }

  /**
   * Grant additional Event Boxes from Master Admin to an Agency Admin
   */
  public static grantEventBoxesToAgencyAdmin(
    adminId: string,
    boxesCount: number,
    masterEmail: string,
    memo?: string
  ): { success: boolean; updatedRemaining: number; message: string } {
    const admins = this.getAllAdminAccounts();
    const target = admins.find((a) => a.id === adminId);
    if (!target) {
      return { success: false, updatedRemaining: 0, message: '해당 기관관리자를 찾을 수 없습니다.' };
    }

    target.eventBoxesRemaining = (target.eventBoxesRemaining || 0) + boxesCount;
    this.saveAllAdminAccounts(admins);

    // Record allocation log
    this.recordGiftLog({
      id: `alloc_${Date.now()}`,
      type: 'master_allocation',
      adminEmail: masterEmail,
      adminAgency: '한국전력공사 (총괄)',
      boxesUsed: boxesCount,
      itemsSummary: `이벤트 상자 +${boxesCount.toLocaleString()}개 지급 (${target.agencyName} ${target.name})`,
      timestamp: Date.now(),
      memo: memo || '최고관리자 이벤트 상자 한도 추가 부여',
    });

    return {
      success: true,
      updatedRemaining: target.eventBoxesRemaining,
      message: `[${target.agencyName}] ${target.name} 관리자에게 이벤트 상자 ${boxesCount.toLocaleString()}개가 추가 지급되었습니다. (총 보유: ${target.eventBoxesRemaining.toLocaleString()}개)`,
    };
  }

  /**
   * Delete Agency Admin
   */
  public static deleteSubAdmin(adminId: string): boolean {
    const admins = this.getAllAdminAccounts();
    const filtered = admins.filter((a) => a.id !== adminId);
    this.saveAllAdminAccounts(filtered);
    return true;
  }

  /**
   * Update Agency Admin Password or details
   */
  public static updateAdminPassword(adminId: string, newPasswordPlain: string): boolean {
    const admins = this.getAllAdminAccounts();
    const target = admins.find((a) => a.id === adminId);
    if (!target) return false;
    target.passwordPlain = newPasswordPlain;
    this.saveAllAdminAccounts(admins);
    return true;
  }

  /**
   * Get current active admin session
   */
  public static getCurrentAdminSession(): AdminAccount | null {
    try {
      const data = localStorage.getItem('love_app_current_admin_session');
      if (!data) return null;
      return JSON.parse(data) as AdminAccount;
    } catch {
      return null;
    }
  }

  /**
   * Save or clear active admin session
   */
  public static saveCurrentAdminSession(admin: AdminAccount | null): void {
    try {
      if (!admin) {
        localStorage.removeItem('love_app_current_admin_session');
      } else {
        localStorage.setItem('love_app_current_admin_session', JSON.stringify(admin));
      }
    } catch (e) {
      console.warn('Failed to save admin session', e);
    }
  }

  // ==========================================
  // AGENCY MEMBERSHIP APPROVAL & USER MANAGEMENT
  // ==========================================

  /**
   * Get Pending Membership Requests (by Agency Domain or All)
   */
  public static getPendingApprovals(agencyDomain?: string): UserProfile[] {
    const allUsers = DatingService.getAllUsers();
    return allUsers.filter((u) => {
      const isPending = u.approvalStatus === 'pending';
      if (!isPending) return false;

      if (!agencyDomain || agencyDomain === '*' || agencyDomain === 'kepco.co.kr_all') {
        return true;
      }

      const userEmailDomain = u.email.split('@')[1]?.toLowerCase() || '';
      return userEmailDomain === agencyDomain.toLowerCase();
    });
  }

  /**
   * Approve a user's membership request
   */
  public static approveUserRegistration(
    userId: string,
    adminEmail: string,
    adminName: string
  ): { success: boolean; user?: UserProfile; message: string } {
    const allUsers = DatingService.getAllUsers();
    const target = allUsers.find((u) => u.id === userId);
    if (!target) {
      return { success: false, message: '사용자를 찾을 수 없습니다.' };
    }

    target.approvalStatus = 'approved';
    target.approvedAt = Date.now();
    target.approvedByAdmin = `${adminName} (${adminEmail})`;
    target.verifiedEmail = true;

    // Ensure starter inventory (10 message tickets, 0 others)
    ItemService.getInventory(target.id);

    DatingService.saveCurrentUser(target);

    return {
      success: true,
      user: target,
      message: `[${target.name} (${target.email})] 님의 가입 승인이 완료되었습니다. (메시지 횟수 증가권 10장 기본 지급)`,
    };
  }

  /**
   * Reject a user's membership request
   */
  public static rejectUserRegistration(
    userId: string,
    adminEmail: string,
    reason: string
  ): { success: boolean; message: string } {
    const allUsers = DatingService.getAllUsers();
    const target = allUsers.find((u) => u.id === userId);
    if (!target) {
      return { success: false, message: '사용자를 찾을 수 없습니다.' };
    }

    target.approvalStatus = 'rejected';
    target.rejectionReason = reason.trim() || '소속 기관 확인 불가 또는 사칭 의심';

    DatingService.saveCurrentUser(target);

    return {
      success: true,
      message: `[${target.name}] 님의 가입 요청이 반려 처리되었습니다. (사유: ${target.rejectionReason})`,
    };
  }

  /**
   * Check if a target user is an Admin (Master Admin or Agency Admin)
   */
  public static isProtectedAdmin(emailOrUser: string | UserProfile): {
    isProtected: boolean;
    role: 'master_admin' | 'agency_admin' | 'member';
    adminAccount?: AdminAccount;
    label: string;
  } {
    const email = typeof emailOrUser === 'string' ? emailOrUser.toLowerCase().trim() : emailOrUser.email.toLowerCase().trim();

    // 1. Master Admin Check
    if (email === MASTER_ADMIN_CREDENTIALS.email.toLowerCase()) {
      return {
        isProtected: true,
        role: 'master_admin',
        adminAccount: MASTER_ADMIN_CREDENTIALS,
        label: '최고 관리자 (KEPCO)',
      };
    }

    // 2. Agency Admin Check
    const allAdmins = this.getAllAdminAccounts();
    const agencyAdmin = allAdmins.find((a) => a.email.toLowerCase() === email);
    if (agencyAdmin) {
      return {
        isProtected: true,
        role: 'agency_admin',
        adminAccount: agencyAdmin,
        label: `${agencyAdmin.agencyName} 관리자 (${agencyAdmin.name})`,
      };
    }

    // 3. User Role Check
    if (typeof emailOrUser !== 'string') {
      if (emailOrUser.role === 'master_admin') {
        return { isProtected: true, role: 'master_admin', label: '최고 관리자' };
      }
      if (emailOrUser.role === 'agency_admin') {
        return { isProtected: true, role: 'agency_admin', label: '기관 관리자' };
      }
    }

    return {
      isProtected: false,
      role: 'member',
      label: '일반 회원',
    };
  }

  /**
   * Get users belonging to a specific agency domain with guaranteed attendance & role metrics
   */
  public static getAgencyUsers(agencyDomain?: string): UserProfile[] {
    const allUsers = DatingService.getAllUsers();
    let filtered = allUsers;
    if (agencyDomain && agencyDomain !== '*' && agencyDomain !== 'kepco.co.kr_all') {
      filtered = allUsers.filter((u) => {
        const domain = u.email.split('@')[1]?.toLowerCase() || '';
        return domain === agencyDomain.toLowerCase();
      });
    }

    // Enrich attendance stats if missing
    let updated = false;
    const enriched = filtered.map((u) => {
      const { role } = this.isProtectedAdmin(u);
      let needsSave = false;

      let totalDays = u.totalAttendanceDays;
      let consDays = u.consecutiveAttendanceDays;
      let loginCnt = u.loginCount;

      if (!totalDays || totalDays < 1) {
        // Calculate realistic days from createdAt
        const diffDays = Math.max(1, Math.floor((Date.now() - (u.createdAt || Date.now() - 86400000 * 5)) / 86400000) + 1);
        totalDays = Math.min(60, diffDays);
        needsSave = true;
      }

      if (!consDays || consDays < 1) {
        consDays = Math.min(totalDays, Math.max(1, (parseInt(u.id.replace(/\D/g, ''), 10) % 7) + 1));
        needsSave = true;
      }

      if (!loginCnt || loginCnt < 1) {
        loginCnt = totalDays * 2 + (parseInt(u.id.replace(/\D/g, ''), 10) % 5);
        needsSave = true;
      }

      if (u.role !== role) {
        u.role = role;
        needsSave = true;
      }

      if (needsSave) {
        u.totalAttendanceDays = totalDays;
        u.consecutiveAttendanceDays = consDays;
        u.loginCount = loginCnt;
        updated = true;
      }

      return u;
    });

    if (updated) {
      localStorage.setItem('love_app_users', JSON.stringify(allUsers));
    }

    return enriched;
  }

  /**
   * Directly Sanction a Regular Member (Admin & Master Accounts are strictly protected)
   */
  public static directSanctionUser(
    admin: AdminAccount,
    targetUserId: string,
    sanctionType: 'warning_1h' | 'restrict_24h' | 'restrict_7d' | 'permanent_ban',
    reasonType: string,
    customReasonDetail?: string
  ): { success: boolean; message: string; user?: UserProfile } {
    const allUsers = DatingService.getAllUsers();
    const target = allUsers.find((u) => u.id === targetUserId);
    if (!target) {
      return { success: false, message: '대상 회원을 찾을 수 없습니다.' };
    }

    // Critical Constraint Check: Protect Master Admin & Agency Admins
    const protection = this.isProtectedAdmin(target);
    if (protection.isProtected) {
      return {
        success: false,
        message: `[설정 불가] ${protection.label} 계정은 보호 대상이므로 제재를 적용할 수 없습니다.`,
      };
    }

    const now = Date.now();
    let sanctionHours = 1;
    let newSanctionCount = (target.sanctionCount || 0) + 1;
    let isBanned = false;
    let sanctionLabel = '';

    if (sanctionType === 'warning_1h') {
      sanctionHours = 1;
      sanctionLabel = '1차 경고 및 1시간 주의 조치';
    } else if (sanctionType === 'restrict_24h') {
      sanctionHours = 24;
      sanctionLabel = '24시간 서비스 이용 정지';
    } else if (sanctionType === 'restrict_7d') {
      sanctionHours = 24 * 7;
      sanctionLabel = '7일간 서비스 이용 정지';
    } else if (sanctionType === 'permanent_ban') {
      sanctionHours = 999999;
      isBanned = true;
      newSanctionCount = 10;
      sanctionLabel = '영구 서비스 이용 정지(영구 차단)';
    }

    const sanctionExpiresAt = isBanned ? now + 100 * 365 * 24 * 3600 * 1000 : now + sanctionHours * 3600 * 1000;
    const fullReason = customReasonDetail ? `${reasonType} (${customReasonDetail})` : reasonType;

    target.sanctionCount = newSanctionCount;
    target.sanctionExpiresAt = sanctionExpiresAt;
    target.sanctionReason = fullReason;
    target.isBanned = isBanned;

    if (isBanned) {
      this.addBannedEmail(target.email);
    }

    // Add sanction notice to user
    const noticeItem: UserRewardNotice = {
      id: `sanction_notice_${Date.now()}`,
      timestamp: now,
      rewardBoxes: 0,
      noticeMessage: `[운영정책 위반 제재 안내] ${admin.agencyName} 관리자에 의해 [${sanctionLabel}] 처분이 적용되었습니다. (사유: ${fullReason})`,
      processedByAdmin: `${admin.name} (${admin.agencyName})`,
      claimed: true,
    };

    if (!target.rewardNotices) target.rewardNotices = [];
    target.rewardNotices.unshift(noticeItem);

    DatingService.saveCurrentUser(target);

    // Record Audit Report/Log
    const newReport: UserReport = {
      id: `report_admin_direct_${Date.now()}`,
      reporterId: admin.id,
      reporterEmail: admin.email,
      reporterName: `${admin.name} (${admin.agencyName} 관리자)`,
      targetUserId: target.id,
      targetUserEmail: target.email,
      targetUserName: target.name,
      reason: 'other',
      customReasonDetail: `[관리자 직권 제재] ${fullReason}`,
      timestamp: now,
      status: 'sanction_applied',
      appliedSanctionHours: sanctionHours,
      targetSanctionRound: newSanctionCount,
      reviewedByAdmin: admin.email,
      reviewedAt: now,
      adminNotes: `관리자(${admin.name}) 직권 ${sanctionLabel} 적용`,
      targetProfileSnapshot: target,
    };

    const reports = this.getAllReports();
    reports.unshift(newReport);
    this.saveReports(reports);

    return {
      success: true,
      user: target,
      message: `[${target.name}] 회원에게 [${sanctionLabel}] 처분이 성공적으로 적용되었습니다.`,
    };
  }

  /**
   * Directly Lift Sanction for a Member
   */
  public static directLiftSanctionUser(
    admin: AdminAccount,
    targetUserId: string,
    liftReason: string,
    rewardBoxes = 0,
    noticeMessage?: string
  ): { success: boolean; message: string; user?: UserProfile } {
    const allUsers = DatingService.getAllUsers();
    const target = allUsers.find((u) => u.id === targetUserId);
    if (!target) {
      return { success: false, message: '대상 회원을 찾을 수 없습니다.' };
    }

    const protection = this.isProtectedAdmin(target);
    if (protection.isProtected) {
      return {
        success: false,
        message: `[설정 불가] ${protection.label} 계정은 제재 대상이 아닙니다.`,
      };
    }

    target.sanctionExpiresAt = null;
    target.sanctionReason = null;
    target.isBanned = false;
    target.sanctionCount = Math.max(0, (target.sanctionCount || 1) - 1);
    this.removeBannedEmail(target.email);

    if (rewardBoxes > 0) {
      ItemService.addWelcomeBoxes(target.id, rewardBoxes);
    }

    const finalNotice =
      noticeMessage ||
      `[제재 해지 안내] ${admin.agencyName} 관리자 검토 결과 제재가 즉시 해지되었습니다. ${liftReason ? `(사유: ${liftReason})` : ''}`;

    const noticeItem: UserRewardNotice = {
      id: `lift_notice_${Date.now()}`,
      timestamp: Date.now(),
      rewardBoxes,
      noticeMessage: finalNotice,
      processedByAdmin: `${admin.name} (${admin.agencyName})`,
      claimed: false,
    };

    if (!target.rewardNotices) target.rewardNotices = [];
    target.rewardNotices.unshift(noticeItem);

    DatingService.saveCurrentUser(target);

    return {
      success: true,
      user: target,
      message: `[${target.name}] 회원의 제재가 즉시 해지되었습니다.${rewardBoxes > 0 ? ` (보상 환영박스 ${rewardBoxes}개 지급)` : ''}`,
    };
  }

  // ==========================================
  // GIFTS & 1-HOUR RECENT USER EVENT EXECUTION
  // ==========================================

  /**
   * Run 1-Hour Recent Active Users Random Reward Event
   * Consumes agency admin's eventBoxesRemaining
   */
  public static run1HourRecentUsersRandomEvent(
    admin: AdminAccount,
    boxCostPerUser = 1
  ): {
    success: boolean;
    recipientCount: number;
    boxesUsed: number;
    remainingBoxes: number;
    recipients: { name: string; email: string; rewardSummary: string }[];
    message: string;
  } {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const agencyDomain = admin.agencyDomain;

    // Filter users belonging to this agency who were active within the last 1 hour
    const agencyUsers = this.getAgencyUsers(admin.isMaster ? undefined : agencyDomain);
    const eligibleUsers = agencyUsers.filter((u) => {
      // Must be approved and active within 1 hour
      if (u.approvalStatus === 'rejected') return false;
      return (u.lastActive && u.lastActive >= oneHourAgo) || u.isOnline;
    });

    if (eligibleUsers.length === 0) {
      return {
        success: false,
        recipientCount: 0,
        boxesUsed: 0,
        remainingBoxes: admin.eventBoxesRemaining,
        recipients: [],
        message: '최근 1시간 이내에 접속/활동한 기관 회원이 없습니다.',
      };
    }

    const totalBoxesNeeded = eligibleUsers.length * boxCostPerUser;

    // Check inventory
    if (!admin.isMaster && (admin.eventBoxesRemaining || 0) < totalBoxesNeeded) {
      return {
        success: false,
        recipientCount: eligibleUsers.length,
        boxesUsed: 0,
        remainingBoxes: admin.eventBoxesRemaining || 0,
        recipients: [],
        message: `이벤트 상자 잔여 수량이 부족합니다. (필요: ${totalBoxesNeeded}개, 보유: ${admin.eventBoxesRemaining}개). 최고관리자에게 추가 지급을 요청하세요.`,
      };
    }

    // Deduct boxes from Admin
    const admins = this.getAllAdminAccounts();
    const adminIdx = admins.findIndex((a) => a.id === admin.id);
    let remaining = admin.eventBoxesRemaining;
    if (!admin.isMaster && adminIdx >= 0) {
      admins[adminIdx].eventBoxesRemaining = Math.max(0, admins[adminIdx].eventBoxesRemaining - totalBoxesNeeded);
      remaining = admins[adminIdx].eventBoxesRemaining;
      this.saveAllAdminAccounts(admins);
    }

    // Reward variants pool:
    // 1. Popularity +20 & WelcomeBox 1
    // 2. Popularity +30 & Boost Antenna 1
    // 3. WelcomeBox 2 & Message Ticket 2
    // 4. Popularity +15 & Sticker Card 1
    const recipientsSummary: { name: string; email: string; rewardSummary: string }[] = [];

    eligibleUsers.forEach((user, idx) => {
      const variant = idx % 4;
      let summary = '';
      if (variant === 0) {
        ItemService.addWelcomeBoxes(user.id, 1);
        DatingService.updatePopularityScore(user.id, 20);
        summary = '환영박스 1개 + 호감도(인기도) +20';
      } else if (variant === 1) {
        ItemService.addBoostAntenna(user.id, 1);
        DatingService.updatePopularityScore(user.id, 30);
        summary = '광역 검색 안테나 1개 + 호감도(인기도) +30';
      } else if (variant === 2) {
        ItemService.addWelcomeBoxes(user.id, 2);
        ItemService.addMessageTickets(user.id, 2);
        summary = '환영박스 2개 + 메시지 횟수권 2개';
      } else {
        ItemService.addStickerCards(user.id, 2);
        DatingService.updatePopularityScore(user.id, 15);
        summary = '스티커 부착권 2장 + 호감도(인기도) +15';
      }

      // Add Reward Notice to User
      const rewardNotice: UserRewardNotice = {
        id: `reward_event_${Date.now()}_${idx}`,
        timestamp: Date.now(),
        rewardBoxes: boxCostPerUser,
        noticeMessage: `[기관 특별 이벤트] ${admin.agencyName} 관리자가 최근 접속자 서프라이즈 랜덤 선물(${summary})을 지급했습니다!`,
        processedByAdmin: `${admin.name} (${admin.agencyName})`,
        claimed: true,
      };

      if (!user.rewardNotices) user.rewardNotices = [];
      user.rewardNotices.unshift(rewardNotice);
      DatingService.saveCurrentUser(user);

      recipientsSummary.push({
        name: user.name,
        email: user.email,
        rewardSummary: summary,
      });
    });

    // Record Event Log
    this.recordGiftLog({
      id: `gift_event_${Date.now()}`,
      type: 'random_1hour_event',
      adminEmail: admin.email,
      adminAgency: admin.agencyName,
      recipientCount: eligibleUsers.length,
      boxesUsed: totalBoxesNeeded,
      itemsSummary: `최근 1시간 접속자 ${eligibleUsers.length}명 전원 랜덤 보상 발송 완료`,
      timestamp: Date.now(),
      memo: `1인당 ${boxCostPerUser}개 소모 (잔여 한도: ${remaining.toLocaleString()}개)`,
    });

    return {
      success: true,
      recipientCount: eligibleUsers.length,
      boxesUsed: totalBoxesNeeded,
      remainingBoxes: remaining,
      recipients: recipientsSummary,
      message: `최근 1시간 접속자 ${eligibleUsers.length}명에게 랜덤 서프라이즈 선물이 성공적으로 발송되었습니다! (이벤트 상자 ${totalBoxesNeeded}개 소모, 잔여: ${remaining.toLocaleString()}개)`,
    };
  }

  /**
   * Send direct gift to a single user
   */
  public static sendDirectGiftToUser(
    admin: AdminAccount,
    targetUserId: string,
    giftItem: 'welcome_box' | 'boost_antenna' | 'message_ticket' | 'popularity_50',
    count: number,
    memo?: string
  ): { success: boolean; message: string } {
    const allUsers = DatingService.getAllUsers();
    const target = allUsers.find((u) => u.id === targetUserId);
    if (!target) {
      return { success: false, message: '대상 사용자를 찾을 수 없습니다.' };
    }

    const protection = this.isProtectedAdmin(target);
    if (protection.isProtected) {
      return {
        success: false,
        message: `[설정 불가] ${protection.label} 계정은 관리자 보호 계정이므로 선물 지급 대상이 아닙니다.`,
      };
    }

    let itemLabel = '';
    if (giftItem === 'welcome_box') {
      ItemService.addWelcomeBoxes(target.id, count);
      itemLabel = `환영박스 ${count}개`;
    } else if (giftItem === 'boost_antenna') {
      ItemService.addBoostAntenna(target.id, count);
      itemLabel = `광역 검색 안테나 ${count}개`;
    } else if (giftItem === 'message_ticket') {
      ItemService.addMessageTickets(target.id, count);
      itemLabel = `메시지권 ${count}개`;
    } else {
      DatingService.updatePopularityScore(target.id, 50 * count);
      itemLabel = `호감도(인기도) +${50 * count}점`;
    }

    // Add notice
    const rewardNotice: UserRewardNotice = {
      id: `direct_gift_${Date.now()}`,
      timestamp: Date.now(),
      rewardBoxes: giftItem === 'welcome_box' ? count : 1,
      noticeMessage: `[기관 관리자 선물] ${admin.agencyName} 관리자로부터 ${itemLabel}을(를) 선물 받았습니다! ${memo ? `("${memo}")` : ''}`,
      processedByAdmin: `${admin.name} (${admin.agencyName})`,
      claimed: true,
    };

    if (!target.rewardNotices) target.rewardNotices = [];
    target.rewardNotices.unshift(rewardNotice);
    DatingService.saveCurrentUser(target);

    // Record Log
    this.recordGiftLog({
      id: `direct_${Date.now()}`,
      type: 'direct_gift',
      adminEmail: admin.email,
      adminAgency: admin.agencyName,
      targetUserId: target.id,
      targetUserName: target.name,
      boxesUsed: giftItem === 'welcome_box' ? count : 1,
      itemsSummary: itemLabel,
      timestamp: Date.now(),
      memo: memo || '기관 관리자 1:1 직접 선물',
    });

    return {
      success: true,
      message: `[${target.name}] 님에게 ${itemLabel} 선물이 성공적으로 지급되었습니다!`,
    };
  }

  // ==========================================
  // GIFT & EVENT LOGS
  // ==========================================

  public static getGiftDeliveryLogs(agencyDomain?: string): GiftDeliveryLog[] {
    try {
      const raw = localStorage.getItem(GIFT_DELIVERY_LOGS_KEY);
      const list: GiftDeliveryLog[] = raw ? JSON.parse(raw) : [];
      if (!agencyDomain || agencyDomain === '*' || agencyDomain === 'kepco.co.kr') {
        return list.sort((a, b) => b.timestamp - a.timestamp);
      }
      return list
        .filter((l) => l.adminAgency.includes(agencyDomain) || l.adminEmail.includes(agencyDomain))
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }

  public static recordGiftLog(log: GiftDeliveryLog): void {
    try {
      const raw = localStorage.getItem(GIFT_DELIVERY_LOGS_KEY);
      const list: GiftDeliveryLog[] = raw ? JSON.parse(raw) : [];
      list.unshift(log);
      if (list.length > 200) list.splice(200);
      localStorage.setItem(GIFT_DELIVERY_LOGS_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save gift log', e);
    }
  }

  // ==========================================
  // ADMIN BOARD (최고관리자 <-> 기관관리자 소통 게시판)
  // ==========================================

  public static getBoardPosts(): AdminBoardPost[] {
    try {
      const raw = localStorage.getItem(ADMIN_BOARD_POSTS_KEY);
      if (!raw) {
        // Initial sample posts
        const defaultPosts: AdminBoardPost[] = [
          {
            id: 'post_sample_1',
            authorId: 'admin_master',
            authorEmail: 'admin@kepco.co.kr',
            authorName: '최고 관리자 (KEPCO)',
            agencyName: '한국전력공사 (총괄)',
            agencyDomain: 'kepco.co.kr',
            isMaster: true,
            category: 'notice',
            title: '[공지] 각 기관별 월간 이벤트 상자(1,000개) 기본 충전 및 운영 가이드 안내',
            content: '각 기관 관리자 여러분 안녕하십니까. 사내 임직원들의 건강하고 건전한 소통을 위해 월간 기본 이벤트 상자 1,000개가 각 기관 계정에 지급되었습니다. 최근 1시간 접속자 이벤트 및 모범 사원 선물 기능을 적극 활용하여 주시기 바라며, 추가 수량이 필요하신 경우 본 게시판에 안건을 남겨주시면 즉시 추가 배정해 드리겠습니다.',
            isPinned: true,
            createdAt: Date.now() - 3600 * 1000 * 24 * 2,
            comments: [
              {
                id: 'comm_1',
                authorEmail: 'admin@kwater.or.kr',
                authorName: '박수자',
                agencyName: '한국수자원공사',
                isMaster: false,
                content: '한국수자원공사 관리자입니다. 이번 주말 사내 소통 이벤트를 위해 추가 500개 지급 검토 부탁드립니다.',
                createdAt: Date.now() - 3600 * 1000 * 18,
              },
              {
                id: 'comm_2',
                authorEmail: 'admin@kepco.co.kr',
                authorName: '최고 관리자 (KEPCO)',
                agencyName: '한국전력공사 (총괄)',
                isMaster: true,
                content: '수자원공사 계정으로 이벤트 상자 500개 추가 충전 완료되었습니다. 유익한 이벤트 되시기 바랍니다.',
                createdAt: Date.now() - 3600 * 1000 * 12,
              },
            ],
          },
          {
            id: 'post_sample_2',
            authorId: 'admin_agency_lh',
            authorEmail: 'admin@lh.or.kr',
            authorName: '최토지',
            agencyName: '한국토지주택공사',
            agencyDomain: 'lh.or.kr',
            isMaster: false,
            category: 'request',
            title: '[요청] LH 본사 및 지사 신규 입사자 가입 승인 현황 및 프로필 가이드 질의',
            content: '안녕하세요. LH 관리자입니다. 신규 입사자분들이 대거 가입 신청을 하고 계십니다. 프로필 사진은 지정된 공식 아바타가 기본 적용되어 매우 깔끔하고 만족스럽습니다. 사칭 방지를 위해 소속 사번 대조 후 승인 진행하고 있습니다.',
            isPinned: false,
            createdAt: Date.now() - 3600 * 1000 * 6,
            comments: [],
          },
        ];
        localStorage.setItem(ADMIN_BOARD_POSTS_KEY, JSON.stringify(defaultPosts));
        return defaultPosts;
      }
      const list: AdminBoardPost[] = JSON.parse(raw);
      return list.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.createdAt - a.createdAt;
      });
    } catch {
      return [];
    }
  }

  public static createBoardPost(
    author: AdminAccount,
    category: 'notice' | 'request' | 'policy' | 'free',
    title: string,
    content: string,
    isPinned = false
  ): AdminBoardPost {
    const posts = this.getBoardPosts();
    const newPost: AdminBoardPost = {
      id: `post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      authorId: author.id,
      authorEmail: author.email,
      authorName: author.name,
      agencyName: author.agencyName,
      agencyDomain: author.agencyDomain,
      isMaster: author.isMaster,
      category,
      title: title.trim(),
      content: content.trim(),
      isPinned: author.isMaster ? isPinned : false, // Only master can pin
      createdAt: Date.now(),
      comments: [],
    };

    posts.unshift(newPost);
    localStorage.setItem(ADMIN_BOARD_POSTS_KEY, JSON.stringify(posts));
    return newPost;
  }

  public static addBoardComment(
    postId: string,
    author: AdminAccount,
    content: string
  ): boolean {
    const posts = this.getBoardPosts();
    const target = posts.find((p) => p.id === postId);
    if (!target) return false;

    const newComment: AdminBoardComment = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      authorEmail: author.email,
      authorName: author.name,
      agencyName: author.agencyName,
      isMaster: author.isMaster,
      content: content.trim(),
      createdAt: Date.now(),
    };

    target.comments.push(newComment);
    localStorage.setItem(ADMIN_BOARD_POSTS_KEY, JSON.stringify(posts));
    return true;
  }

  public static deleteBoardPost(postId: string, requesterEmail: string, isMaster: boolean): boolean {
    let posts = this.getBoardPosts();
    const target = posts.find((p) => p.id === postId);
    if (!target) return false;

    if (!isMaster && target.authorEmail.toLowerCase() !== requesterEmail.toLowerCase()) {
      return false; // Permission denied
    }

    posts = posts.filter((p) => p.id !== postId);
    localStorage.setItem(ADMIN_BOARD_POSTS_KEY, JSON.stringify(posts));
    return true;
  }

  public static deleteBoardComment(
    postId: string,
    commentId: string,
    requesterEmail: string,
    isMaster: boolean
  ): boolean {
    const posts = this.getBoardPosts();
    const target = posts.find((p) => p.id === postId);
    if (!target) return false;

    const comm = target.comments.find((c) => c.id === commentId);
    if (!comm) return false;

    if (!isMaster && comm.authorEmail.toLowerCase() !== requesterEmail.toLowerCase()) {
      return false;
    }

    target.comments = target.comments.filter((c) => c.id !== commentId);
    localStorage.setItem(ADMIN_BOARD_POSTS_KEY, JSON.stringify(posts));
    return true;
  }

  // ==========================================
  // SANCTIONS & MODERATION
  // ==========================================

  public static getBannedEmails(): string[] {
    try {
      const raw = localStorage.getItem(BANNED_EMAILS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public static isEmailBanned(email: string): boolean {
    const cleanEmail = email.toLowerCase().trim();
    const banned = this.getBannedEmails();
    return banned.includes(cleanEmail);
  }

  public static addBannedEmail(email: string): void {
    const cleanEmail = email.toLowerCase().trim();
    const banned = this.getBannedEmails();
    if (!banned.includes(cleanEmail)) {
      banned.push(cleanEmail);
      localStorage.setItem(BANNED_EMAILS_KEY, JSON.stringify(banned));
    }
  }

  public static removeBannedEmail(email: string): void {
    const cleanEmail = email.toLowerCase().trim();
    const banned = this.getBannedEmails().filter((e) => e !== cleanEmail);
    localStorage.setItem(BANNED_EMAILS_KEY, JSON.stringify(banned));
  }

  public static getAllReports(): UserReport[] {
    try {
      const raw = localStorage.getItem(REPORTS_STORAGE_KEY);
      const list: UserReport[] = raw ? JSON.parse(raw) : [];
      return list.sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }

  public static saveReports(reports: UserReport[]): void {
    try {
      localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reports));
    } catch (err) {
      console.error('Failed to save reports:', err);
    }
  }

  public static recordBioChange(
    userId: string,
    userProfile: UserProfile,
    changedBy: 'user' | 'admin' = 'user'
  ): void {
    const allUsers = DatingService.getAllUsers();
    const target = allUsers.find((u) => u.id === userId);
    if (!target) return;

    if (!target.bioHistory) {
      target.bioHistory = [];
    }

    const historyItem: BioHistoryItem = {
      id: `bio_hist_${Date.now()}`,
      timestamp: Date.now(),
      bio: userProfile.bio || '',
      name: userProfile.name,
      company: userProfile.company,
      interests: userProfile.interests,
      photoUrl: userProfile.photoUrl,
      changedBy,
    };

    target.bioHistory.unshift(historyItem);
    if (target.bioHistory.length > 30) {
      target.bioHistory = target.bioHistory.slice(0, 30);
    }

    DatingService.saveCurrentUser(target);
  }

  public static submitReport(
    reporter: UserProfile,
    targetUser: UserProfile,
    reason: ReportReason,
    customReasonDetail?: string
  ): {
    success: boolean;
    report?: UserReport;
    targetSanctionHours: number;
    reporterCooldownHours: number;
    message: string;
  } {
    const now = Date.now();

    if (reporter.reporterCooldownUntil && reporter.reporterCooldownUntil > now) {
      const remainingMinutes = Math.ceil((reporter.reporterCooldownUntil - now) / (60 * 1000));
      return {
        success: false,
        targetSanctionHours: 0,
        reporterCooldownHours: 3,
        message: `신고 쿨다운 적용 중입니다. (${remainingMinutes}분 동안 추가 신고가 제한됩니다.)`,
      };
    }

    const allUsers = DatingService.getAllUsers();
    let target = allUsers.find((u) => u.id === targetUser.id) || targetUser;

    const currentCount = target.sanctionCount || 0;
    const newSanctionRound = currentCount + 1;
    const isPermanentBan = newSanctionRound >= 10;
    const sanctionHours = isPermanentBan ? 999999 : newSanctionRound;

    const sanctionExpiresAt = isPermanentBan ? now + 100 * 365 * 24 * 3600 * 1000 : now + sanctionHours * 3600 * 1000;

    const reasonLabels: Record<ReportReason, string> = {
      fake_profile: '허위 프로필 및 사진 도용',
      inappropriate_purpose: '목적에 맞지 않는 부적절한 이용',
      commercial_ad: '광고 및 홍보/스팸 게시',
      harassment_abuse: '욕설, 비매너 및 괴롭힘',
      other: '기타 운영정책 위반',
    };

    const reasonText = customReasonDetail ? `${reasonLabels[reason]} (${customReasonDetail})` : reasonLabels[reason];

    target = {
      ...target,
      sanctionCount: newSanctionRound,
      sanctionExpiresAt,
      sanctionReason: reasonText,
      isBanned: isPermanentBan,
    };

    if (isPermanentBan) {
      this.addBannedEmail(target.email);
    }

    DatingService.saveCurrentUser(target);

    const reporterCooldownUntil = now + 3 * 3600 * 1000;
    let freshReporter = allUsers.find((u) => u.id === reporter.id) || reporter;
    freshReporter = {
      ...freshReporter,
      reporterCooldownUntil,
    };
    DatingService.saveCurrentUser(freshReporter);

    const chatSnapshots = FirebaseChatService.getMessagesForUsers(reporter.id, target.id);
    const targetSnapshot: Partial<UserProfile> = {
      id: target.id,
      name: target.name,
      email: target.email,
      company: target.company,
      bio: target.bio,
      photoUrl: target.photoUrl,
      interests: target.interests,
      popularity: target.popularity,
      sanctionCount: newSanctionRound,
    };

    const newReport: UserReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reporterId: reporter.id,
      reporterEmail: reporter.email,
      reporterName: reporter.name,
      targetUserId: target.id,
      targetUserEmail: target.email,
      targetUserName: target.name,
      reason,
      customReasonDetail,
      timestamp: now,
      status: 'pending',
      appliedSanctionHours: sanctionHours,
      targetSanctionRound: newSanctionRound,
      targetProfileSnapshot: targetSnapshot,
      chatHistorySnapshot: chatSnapshots,
      bioHistorySnapshot: target.bioHistory || [],
    };

    const reports = this.getAllReports();
    reports.unshift(newReport);
    this.saveReports(reports);

    const roundMsg = isPermanentBan
      ? `신고가 접수되어 누적 10차 제재로 해당 유저가 영구 이용정지 처리되었습니다.`
      : `신고가 접수되어 운영정책에 따라 상대방에게 누적 ${newSanctionRound}차 즉시 제재(${sanctionHours}시간 이용제한)가 적용되었습니다.`;

    return {
      success: true,
      report: newReport,
      targetSanctionHours: sanctionHours,
      reporterCooldownHours: 3,
      message: `${roundMsg} (신고자 본인은 허위신고 남발 방지를 위해 3시간 동안 추가 신고가 제한됩니다.)`,
    };
  }

  public static reduceSanctionAndCompensate(
    reportId: string,
    targetUserId: string,
    reduceRounds = 1,
    rewardBoxes = 2,
    noticeMessage = '관리자 검토 결과 부적당한 제재로 확인되어 제재가 해제되고 환영박스가 지급되었습니다.',
    adminEmail = 'admin@kepco.co.kr'
  ): { success: boolean; message: string } {
    const allUsers = DatingService.getAllUsers();
    const target = allUsers.find((u) => u.id === targetUserId);
    if (!target) {
      return { success: false, message: '사용자를 찾을 수 없습니다.' };
    }

    const prevCount = target.sanctionCount || 0;
    const newCount = Math.max(0, prevCount - reduceRounds);

    target.sanctionCount = newCount;
    target.sanctionExpiresAt = null;
    target.sanctionReason = null;
    target.isBanned = false;
    this.removeBannedEmail(target.email);

    if (rewardBoxes > 0) {
      ItemService.addWelcomeBoxes(target.id, rewardBoxes);
    }

    const rewardNotice: UserRewardNotice = {
      id: `notice_${Date.now()}`,
      timestamp: Date.now(),
      rewardBoxes,
      noticeMessage,
      processedByAdmin: adminEmail,
      claimed: false,
    };

    if (!target.rewardNotices) target.rewardNotices = [];
    target.rewardNotices.unshift(rewardNotice);
    DatingService.saveCurrentUser(target);

    const reports = this.getAllReports();
    const rIdx = reports.findIndex((r) => r.id === reportId);
    if (rIdx >= 0) {
      reports[rIdx].status = 'compensated_justified';
      reports[rIdx].reviewedByAdmin = adminEmail;
      reports[rIdx].reviewedAt = Date.now();
      reports[rIdx].adminNotes = `제재 ${reduceRounds}회 차감 (잔여: ${newCount}회), 환영박스 ${rewardBoxes}개 보상 지급`;
      this.saveReports(reports);
    }

    return {
      success: true,
      message: `[${target.name}] 유저의 제재가 ${reduceRounds}회 차감 및 즉시 해제되었으며, 보상박스 ${rewardBoxes}개가 지급되었습니다.`,
    };
  }

  public static markReportAsFalse(
    reportId: string,
    reporterId: string,
    adminEmail = 'admin@kepco.co.kr',
    adminNotes?: string
  ): { success: boolean; reporterBanned: boolean; message: string } {
    const allUsers = DatingService.getAllUsers();
    const reporter = allUsers.find((u) => u.id === reporterId);
    if (!reporter) {
      return { success: false, reporterBanned: false, message: '신고자를 찾을 수 없습니다.' };
    }

    const falseCount = (reporter.falseReportCount || 0) + 1;
    const isBanned = falseCount >= 3;

    reporter.falseReportCount = falseCount;
    if (isBanned) {
      reporter.isBanned = true;
      this.addBannedEmail(reporter.email);
    }

    DatingService.saveCurrentUser(reporter);

    const reports = this.getAllReports();
    const rIdx = reports.findIndex((r) => r.id === reportId);
    if (rIdx >= 0) {
      reports[rIdx].status = 'dismissed_false';
      reports[rIdx].reviewedByAdmin = adminEmail;
      reports[rIdx].reviewedAt = Date.now();
      reports[rIdx].adminNotes = adminNotes || `허위 신고 판정 (신고자 허위신고 누적 ${falseCount}/3회)`;
      this.saveReports(reports);
    }

    return {
      success: true,
      reporterBanned: isBanned,
      message: isBanned
        ? `허위 신고로 판정되었습니다. 신고자(${reporter.name})는 허위신고 3회 누적으로 영구 차단되었습니다.`
        : `허위 신고로 판정되었습니다. 신고자(${reporter.name})에게 허위신고 1회가 누적되었습니다. (현재 ${falseCount}/3회)`,
    };
  }

  public static rewardLegitimateReporter(
    reportId: string,
    reporterId: string,
    rewardBoxes = 2,
    noticeMessage = '접수해주신 신고 건이 정당한 것으로 확인되어 감사의 의미로 환영박스가 지급되었습니다.',
    adminEmail = 'admin@kepco.co.kr'
  ): { success: boolean; message: string } {
    const allUsers = DatingService.getAllUsers();
    const reporter = allUsers.find((u) => u.id === reporterId);
    if (!reporter) {
      return { success: false, message: '신고자를 찾을 수 없습니다.' };
    }

    if (rewardBoxes > 0) {
      ItemService.addWelcomeBoxes(reporter.id, rewardBoxes);
    }

    const rewardNotice: UserRewardNotice = {
      id: `notice_${Date.now()}`,
      timestamp: Date.now(),
      rewardBoxes,
      noticeMessage,
      processedByAdmin: adminEmail,
      claimed: false,
    };

    if (!reporter.rewardNotices) reporter.rewardNotices = [];
    reporter.rewardNotices.unshift(rewardNotice);
    DatingService.saveCurrentUser(reporter);

    const reports = this.getAllReports();
    const rIdx = reports.findIndex((r) => r.id === reportId);
    if (rIdx >= 0) {
      reports[rIdx].status = 'sanction_applied';
      reports[rIdx].reviewedByAdmin = adminEmail;
      reports[rIdx].reviewedAt = Date.now();
      reports[rIdx].adminNotes = `정당한 신고 확인 및 신고자 환영박스 ${rewardBoxes}개 포상`;
      this.saveReports(reports);
    }

    return {
      success: true,
      message: `[${reporter.name}] 신고자에게 환영박스 ${rewardBoxes}개가 성공적으로 포상 지급되었습니다.`,
    };
  }

  public static getPlatformStatistics(): {
    totalUsers: number;
    pendingApprovalsCount: number;
    activeUsersNow: number;
    totalReports: number;
    pendingReports: number;
    sanctionedUsers: number;
    bannedUsers: number;
    agencyAdminsCount: number;
    totalEventBoxesDistributed: number;
  } {
    const allUsers = DatingService.getAllUsers();
    const reports = this.getAllReports();
    const bannedEmails = this.getBannedEmails();
    const now = Date.now();
    const oneHourAgo = now - 3600 * 1000;
    const admins = this.getAllAdminAccounts();

    const pendingApprovals = allUsers.filter((u) => u.approvalStatus === 'pending').length;
    const activeUsersNow = allUsers.filter(
      (u) => u.isOnline || (u.lastActive && u.lastActive >= oneHourAgo)
    ).length;

    const pendingReports = reports.filter((r) => r.status === 'pending').length;
    const sanctionedUsers = allUsers.filter(
      (u) => u.sanctionExpiresAt && u.sanctionExpiresAt > now
    ).length;
    const bannedUsers = allUsers.filter((u) => u.isBanned || bannedEmails.includes(u.email.toLowerCase())).length;

    const totalEventBoxesDistributed = admins.reduce((sum, a) => sum + (a.eventBoxesRemaining || 0), 0);

    return {
      totalUsers: allUsers.length,
      pendingApprovalsCount: pendingApprovals,
      activeUsersNow,
      totalReports: reports.length,
      pendingReports,
      sanctionedUsers,
      bannedUsers,
      agencyAdminsCount: admins.length,
      totalEventBoxesDistributed,
    };
  }
}

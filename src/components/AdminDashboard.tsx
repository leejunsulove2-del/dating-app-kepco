import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  FileText,
  Clock,
  Gift,
  CheckCircle2,
  Trash2,
  Plus,
  Search,
  MessageSquare,
  History,
  Database,
  LogOut,
  RefreshCw,
  Eye,
  Check,
  X,
  Sparkles,
  Lock,
  Building2,
  Sliders,
  ChevronRight,
  Send,
  Radio,
  Pin,
  MessageCircle,
  Award,
  Layers,
  ArrowRightLeft,
  Calendar,
  Zap,
  Unlock,
  CalendarDays,
  ShieldCheck,
  UserCog,
  Cloud,
  UploadCloud,
  DownloadCloud,
  Flame,
  Server,
  HardDrive,
} from 'lucide-react';
import {
  AdminAccount,
  UserReport,
  UserProfile,
  BioHistoryItem,
  ChatMessage,
  ReportReason,
  AdminBoardPost,
  AdminBoardComment,
  GiftDeliveryLog,
} from '../types';
import { AdminService, MASTER_ADMIN_CREDENTIALS, DEFAULT_AGENCY_ADMINS } from '../services/adminService';
import { DatingService, DEFAULT_ALLOWED_DOMAINS } from '../services/datingService';
import { FirebaseChatService } from '../services/firebaseChatService';
import { ItemService } from '../services/itemService';
import { ApiSyncService } from '../services/apiSyncService';
import { FirestoreSyncService } from '../services/firestoreSyncService';
import { isFirebaseConfigured, getStoredFirebaseConfig, saveCustomFirebaseConfig, clearCustomFirebaseConfig, FirebaseProjectConfig } from '../services/firebaseConfig';
import { calculateAge, formatDistance, getUserActiveStatus } from '../utils/geo';
import { getAvatarForUser, handleAvatarError } from '../utils/avatarUtils';

interface AdminDashboardProps {
  currentAdmin: AdminAccount;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentAdmin,
  onLogout,
}) => {
  // Navigation tabs
  type TabType = 'approvals' | 'agency_users' | 'agency_admins' | 'admin_board' | 'reports' | 'stats';
  const [activeTab, setActiveTab] = useState<TabType>('approvals');

  // Core Data States
  const [adminProfile, setAdminProfile] = useState<AdminAccount>(currentAdmin);
  const [stats, setStats] = useState(() => AdminService.getPlatformStatistics());
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>(() =>
    AdminService.getPendingApprovals(currentAdmin.isMaster ? undefined : currentAdmin.agencyDomain)
  );
  const [agencyUsers, setAgencyUsers] = useState<UserProfile[]>(() =>
    AdminService.getAgencyUsers(currentAdmin.isMaster ? undefined : currentAdmin.agencyDomain)
  );
  const [allAdmins, setAllAdmins] = useState<AdminAccount[]>(() => AdminService.getAllAdminAccounts());
  const [reports, setReports] = useState<UserReport[]>(() => AdminService.getAllReports());
  const [boardPosts, setBoardPosts] = useState<AdminBoardPost[]>(() => AdminService.getBoardPosts());
  const [giftLogs, setGiftLogs] = useState<GiftDeliveryLog[]>(() =>
    AdminService.getGiftDeliveryLogs(currentAdmin.isMaster ? undefined : currentAdmin.agencyDomain)
  );

  // Search & Filter States
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [agencyAdminSearchTerm, setAgencyAdminSearchTerm] = useState('');
  const [selectedAgencyFilter, setSelectedAgencyFilter] = useState<string>('all');
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserProfile | null>(null);
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
  const [boardCategoryFilter, setBoardCategoryFilter] = useState<'all' | 'notice' | 'request' | 'policy' | 'free'>('all');

  // Feedback Notification Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Cloud Database & Firebase Sync States
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [currentFbConfig, setCurrentFbConfig] = useState<FirebaseProjectConfig>(() => {
    return (
      getStoredFirebaseConfig() || {
        apiKey: '',
        projectId: '',
        authDomain: '',
        databaseURL: '',
        storageBucket: '',
        appId: '',
      }
    );
  });

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // 1-Click Push All Data to Cloud Firestore & Server DB
  const handlePushAllToCloud = async () => {
    setIsCloudSyncing(true);
    try {
      const allCurrentUsers = DatingService.getAllUsers();
      const allCurrentAdmins = AdminService.getAllAdminAccounts();
      const allCurrentBoard = AdminService.getBoardPosts();

      // 1. Sync to Server
      await ApiSyncService.syncUsers(allCurrentUsers);
      await ApiSyncService.syncAdminAccounts(allCurrentAdmins);
      for (const p of allCurrentBoard) {
        await ApiSyncService.saveBoardPost(p);
      }

      // 2. Sync to Firestore
      if (isFirebaseConfigured()) {
        await FirestoreSyncService.seedUsersToFirestore(allCurrentUsers);
        for (const a of allCurrentAdmins) {
          await FirestoreSyncService.saveAdminAccount(a);
        }
        for (const p of allCurrentBoard) {
          await FirestoreSyncService.saveBoardPost(p);
        }
      }

      showToast(`⚡ 전체 ${allCurrentUsers.length}명 회원 및 ${allCurrentAdmins.length}명 관리자 정보가 클라우드 DB에 영구 보관되었습니다.`, 'success');
      refreshAllData();
    } catch (e: any) {
      showToast(`클라우드 동기화 중 일부 오류가 발생했습니다: ${e?.message || '확인 필요'}`, 'error');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // 1-Click Pull Latest from Cloud Firestore & Server DB
  const handlePullAllFromCloud = async () => {
    setIsCloudSyncing(true);
    try {
      await AdminService.syncFromCloudFirestore();
      await DatingService.syncFromCloudFirestore();
      refreshAllData();
      showToast('📥 클라우드 서버 및 Firestore로부터 최신 회원/관리자 데이터를 완벽하게 동기화했습니다.', 'success');
    } catch (e: any) {
      showToast(`데이터 갱신 오류: ${e?.message || '서버 응답 없음'}`, 'error');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Save Custom Firebase Project Config
  const handleSaveFirebaseConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFbConfig.apiKey || !currentFbConfig.projectId) {
      showToast('API Key와 Project ID는 필수 입력값입니다.', 'error');
      return;
    }

    try {
      await ApiSyncService.saveFirebaseConfig(currentFbConfig);
      saveCustomFirebaseConfig(currentFbConfig);
      setIsFirebaseModalOpen(false);
      showToast('🔥 Firebase 연동 설정이 저장되었습니다. 전체 데이터를 클라우드에 동기화합니다.', 'success');
      handlePushAllToCloud();
    } catch (e: any) {
      showToast(`설정 저장 오류: ${e?.message}`, 'error');
    }
  };

  // Export JSON Backup
  const handleExportBackupJson = () => {
    const backup = {
      users: DatingService.getAllUsers(),
      adminAccounts: AdminService.getAllAdminAccounts(),
      boardPosts: AdminService.getBoardPosts(),
      reports: AdminService.getAllReports(),
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kepco_matching_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('💾 데이터베이스 백업 JSON 파일이 다운로드되었습니다.', 'success');
  };

  // Re-sync Data
  const refreshAllData = () => {
    const freshAdmins = AdminService.getAllAdminAccounts();
    setAllAdmins(freshAdmins);

    const freshCurrent = freshAdmins.find((a) => a.id === currentAdmin.id) || (currentAdmin.isMaster ? MASTER_ADMIN_CREDENTIALS : currentAdmin);
    setAdminProfile(freshCurrent);

    setStats(AdminService.getPlatformStatistics());
    setPendingUsers(AdminService.getPendingApprovals(currentAdmin.isMaster ? undefined : currentAdmin.agencyDomain));
    setAgencyUsers(AdminService.getAgencyUsers(currentAdmin.isMaster ? undefined : currentAdmin.agencyDomain));
    setReports(AdminService.getAllReports());
    setBoardPosts(AdminService.getBoardPosts());
    setGiftLogs(AdminService.getGiftDeliveryLogs(currentAdmin.isMaster ? undefined : currentAdmin.agencyDomain));
  };

  // Live Cloud Firestore Synchronization across all devices
  useEffect(() => {
    AdminService.syncFromCloudFirestore().then(() => {
      DatingService.syncFromCloudFirestore().then(() => {
        refreshAllData();
      });
    });

    const unsubAdmins = AdminService.subscribeToLiveAdmins(() => {
      refreshAllData();
    });
    const unsubBoard = AdminService.subscribeToLiveBoard(() => {
      refreshAllData();
    });
    const unsubUsers = DatingService.subscribeToLiveUsers(() => {
      refreshAllData();
    });

    return () => {
      unsubAdmins();
      unsubBoard();
      unsubUsers();
    };
  }, []);

  // ==========================================
  // TAB 1: MEMBERSHIP APPROVAL ACTIONS
  // ==========================================
  const handleApproveUser = (userId: string) => {
    const res = AdminService.approveUserRegistration(userId, adminProfile.email, adminProfile.name);
    if (res.success) {
      showToast(res.message, 'success');
      refreshAllData();
      if (selectedUserDetail?.id === userId) setSelectedUserDetail(null);
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleRejectUser = (userId: string) => {
    const reason = window.prompt('가입 반려 사유를 입력해주세요:', '소속 기관 임직원 확인 불가');
    if (reason === null) return;

    const res = AdminService.rejectUserRegistration(userId, adminProfile.email, reason);
    if (res.success) {
      showToast(res.message, 'info');
      refreshAllData();
      if (selectedUserDetail?.id === userId) setSelectedUserDetail(null);
    }
  };

  // ==========================================
  // TAB 2: MEMBER MANAGEMENT (회원관리 & 제재/해지 & 선물 & 이벤트)
  // ==========================================
  const [memberFilter, setMemberFilter] = useState<'all' | 'regular' | 'admin' | 'sanctioned' | 'online'>('all');
  const [memberSort, setMemberSort] = useState<'recent_active' | 'attendance_days' | 'created_at' | 'popularity' | 'sanction'>('recent_active');
  const [eventBoxCost, setEventBoxCost] = useState(1);

  // Direct Gift Modal
  const [directGiftUser, setDirectGiftUser] = useState<UserProfile | null>(null);
  const [directGiftType, setDirectGiftType] = useState<'welcome_box' | 'boost_antenna' | 'message_ticket' | 'popularity_50'>('welcome_box');
  const [directGiftCount, setDirectGiftCount] = useState(1);
  const [directGiftMemo, setDirectGiftMemo] = useState('');

  // Direct Sanction Modal
  const [sanctionTargetUser, setSanctionTargetUser] = useState<UserProfile | null>(null);
  const [sanctionType, setSanctionType] = useState<'warning_1h' | 'restrict_24h' | 'restrict_7d' | 'permanent_ban'>('warning_1h');
  const [sanctionReasonType, setSanctionReasonType] = useState<string>('부적절한 대화 및 비매너 언행');
  const [sanctionCustomReason, setSanctionCustomReason] = useState<string>('');

  // Direct Lift Sanction Modal
  const [liftTargetUser, setLiftTargetUser] = useState<UserProfile | null>(null);
  const [liftReason, setLiftReason] = useState<string>('소명 확인 완료 및 오해 해소');
  const [liftCompensationBoxes, setLiftCompensationBoxes] = useState<number>(1);
  const [liftNoticeMessage, setLiftNoticeMessage] = useState<string>('');

  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recent1HourUsers = agencyUsers.filter((u) => {
    if (u.approvalStatus === 'rejected' || u.approvalStatus === 'pending') return false;
    return (u.lastActive && u.lastActive >= oneHourAgo) || u.isOnline;
  });

  const handleOpenSanctionModal = (user: UserProfile) => {
    const protection = AdminService.isProtectedAdmin(user);
    if (protection.isProtected) {
      showToast(`[설정 불가] ${protection.label} 계정은 관리자 보호 대상이므로 제재를 적용할 수 없습니다.`, 'error');
      return;
    }
    setSanctionTargetUser(user);
    setSanctionType('warning_1h');
    setSanctionReasonType('부적절한 대화 및 비매너 언행');
    setSanctionCustomReason('');
  };

  const handleExecuteDirectSanction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sanctionTargetUser) return;

    const res = AdminService.directSanctionUser(
      adminProfile,
      sanctionTargetUser.id,
      sanctionType,
      sanctionReasonType,
      sanctionCustomReason.trim() || undefined
    );

    if (res.success) {
      showToast(res.message, 'success');
      setSanctionTargetUser(null);
      refreshAllData();
      if (selectedUserDetail?.id === sanctionTargetUser.id) {
        setSelectedUserDetail(res.user || null);
      }
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleOpenLiftModal = (user: UserProfile) => {
    const protection = AdminService.isProtectedAdmin(user);
    if (protection.isProtected) {
      showToast(`[설정 불가] ${protection.label} 계정은 관리자 보호 대상입니다.`, 'error');
      return;
    }
    setLiftTargetUser(user);
    setLiftReason('소명 확인 완료 및 오해 해소');
    setLiftCompensationBoxes(1);
    setLiftNoticeMessage('');
  };

  const handleExecuteDirectLiftSanction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!liftTargetUser) return;

    const res = AdminService.directLiftSanctionUser(
      adminProfile,
      liftTargetUser.id,
      liftReason,
      liftCompensationBoxes,
      liftNoticeMessage.trim() || undefined
    );

    if (res.success) {
      showToast(res.message, 'success');
      setLiftTargetUser(null);
      refreshAllData();
      if (selectedUserDetail?.id === liftTargetUser.id) {
        setSelectedUserDetail(res.user || null);
      }
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleOpenGiftModal = (user: UserProfile) => {
    const protection = AdminService.isProtectedAdmin(user);
    if (protection.isProtected) {
      showToast(`[설정 불가] ${protection.label} 계정은 관리자 보호 계정이므로 선물 지급 대상이 아닙니다.`, 'error');
      return;
    }
    setDirectGiftUser(user);
    setDirectGiftType('welcome_box');
    setDirectGiftCount(1);
    setDirectGiftMemo('');
  };

  const handleRun1HourEvent = () => {
    if (recent1HourUsers.length === 0) {
      showToast('최근 1시간 이내에 활동/접속한 기관 회원이 없습니다.', 'error');
      return;
    }

    const neededBoxes = recent1HourUsers.length * eventBoxCost;
    if (!adminProfile.isMaster && (adminProfile.eventBoxesRemaining || 0) < neededBoxes) {
      showToast(
        `보유한 이벤트 상자가 부족합니다. (필요: ${neededBoxes}개, 보유: ${adminProfile.eventBoxesRemaining}개). 최고관리자에게 추가 지급을 요청하세요.`,
        'error'
      );
      return;
    }

    if (
      !window.confirm(
        `[${adminProfile.agencyName}] 최근 1시간 접속자 ${recent1HourUsers.length}명 전원에게 랜덤 보상을 지급하시겠습니까?\n(총 ${neededBoxes}개 이벤트 상자 소모)`
      )
    ) {
      return;
    }

    const res = AdminService.run1HourRecentUsersRandomEvent(adminProfile, eventBoxCost);
    if (res.success) {
      showToast(res.message, 'success');
      refreshAllData();

      // 💡 [실시간 수량 갱신] 최고관리자(isMaster)가 아닐 경우, 이벤트 전체 지급에 소모된 총 상자 수량만큼 상단 UI 배너에서도 즉시 차감합니다.
      if (!adminProfile.isMaster) {
        setAdminProfile(prev => ({
          ...prev,
          eventBoxesRemaining: Math.max(0, (prev.eventBoxesRemaining || 0) - neededBoxes)
        }));
      }
    } else {
      showToast(res.message, 'error');
    }


  const handleSendDirectGift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directGiftUser) return;

    const res = AdminService.sendDirectGiftToUser(
      adminProfile,
      directGiftUser.id,
      directGiftType,
      directGiftCount,
      directGiftMemo.trim() || undefined
    );

    if (res.success) {
      showToast(res.message, 'success');
      setDirectGiftUser(null);
      setDirectGiftMemo('');
      refreshAllData();

      // 💡 [실시간 수량 갱신] 마스터 관리자가 아닐 경우 화면 우측 상단의 이벤트 상자 개수도 즉시 동적 삭감합니다.
      if (!adminProfile.isMaster) {
        setAdminProfile(prev => ({
          ...prev,
          eventBoxesRemaining: Math.max(0, (prev.eventBoxesRemaining || 0) - directGiftCount)
        }));
      }
    } else {
      showToast(res.message, 'error');
    }


  // ==========================================
  // TAB 3: MASTER ONLY - AGENCY ADMINS & GRANT BOXES
  // ==========================================
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('1234');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminDept, setNewAdminDept] = useState('');
  const [newAdminAgencyDomain, setNewAdminAgencyDomain] = useState('kepco.co.kr');
  const [newAdminAgencyName, setNewAdminAgencyName] = useState('한국전력공사');
  const [newAdminInitialBoxes, setNewAdminInitialBoxes] = useState(1000);

  // Grant Boxes Modal Form
  const [grantTargetAdmin, setGrantTargetAdmin] = useState<AdminAccount | null>(null);
  const [grantBoxesAmount, setGrantBoxesAmount] = useState(500);
  const [grantMemo, setGrantMemo] = useState('월간 이벤트 예산 추가 배정');

  const handleCreateAgencyAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim() || !newAdminPassword.trim() || !newAdminName.trim()) {
      showToast('이메일, 비밀번호, 담당자 이름은 필수입니다.', 'error');
      return;
    }

    const res = AdminService.createAgencyAdmin(
      newAdminEmail.trim(),
      newAdminPassword.trim(),
      newAdminName.trim(),
      newAdminDept.trim(),
      newAdminAgencyDomain.trim(),
      newAdminAgencyName.trim(),
      adminProfile.email,
      newAdminInitialBoxes
    );

    if (res.success) {
      showToast(res.message, 'success');
      setNewAdminEmail('');
      setNewAdminName('');
      setNewAdminDept('');
      refreshAllData();
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleExecuteGrantBoxes = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantTargetAdmin) return;

    const res = AdminService.grantEventBoxesToAgencyAdmin(
      grantTargetAdmin.id,
      grantBoxesAmount,
      adminProfile.email,
      grantMemo
    );

    if (res.success) {
      showToast(res.message, 'success');
      setGrantTargetAdmin(null);
      refreshAllData();
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleDeleteAgencyAdmin = (adminId: string) => {
    if (window.confirm('해당 기관 관리자 계정을 삭제하시겠습니까?')) {
      AdminService.deleteSubAdmin(adminId);
      showToast('기관 관리자 계정이 삭제되었습니다.', 'info');
      refreshAllData();
    }
  };

  // ==========================================
  // TAB 4: ADMIN BOARD (COMMUNICATION)
  // ==========================================
  const [isNewPostModalOpen, setIsNewPostModalOpen] = useState(false);
  const [newPostCategory, setNewPostCategory] = useState<'notice' | 'request' | 'policy' | 'free'>('request');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostPinned, setNewPostPinned] = useState(false);
  const [activePostComments, setActivePostComments] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');

  const handleCreateBoardPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      showToast('제목과 내용을 모두 입력해주세요.', 'error');
      return;
    }

    AdminService.createBoardPost(adminProfile, newPostCategory, newPostTitle, newPostContent, newPostPinned);
    showToast('게시글이 등록되었습니다.', 'success');
    setNewPostTitle('');
    setNewPostContent('');
    setNewPostPinned(false);
    setIsNewPostModalOpen(false);
    refreshAllData();
  };

  const handleAddComment = (postId: string) => {
    if (!commentInput.trim()) return;
    AdminService.addBoardComment(postId, adminProfile, commentInput.trim());
    setCommentInput('');
    refreshAllData();
  };

  const handleDeletePost = (postId: string) => {
    if (window.confirm('게시글을 삭제하시겠습니까?')) {
      AdminService.deleteBoardPost(postId, adminProfile.email, adminProfile.isMaster);
      showToast('게시글이 삭제되었습니다.', 'info');
      refreshAllData();
    }
  };

  // ==========================================
  // TAB 5: REPORTS & SANCTIONS
  // ==========================================
  const [moderationAction, setModerationAction] = useState<'reduce_sanction' | 'false_report' | 'reward_reporter' | null>(null);
  const [reduceRounds, setReduceRounds] = useState(1);
  const [rewardBoxes, setRewardBoxes] = useState(2);
  const [noticeMessage, setNoticeMessage] = useState('관리자 검토 결과 부적당한 제재로 확인되어 제재가 해제되고 환영박스가 지급되었습니다.');
  const [adminActionNotes, setAdminActionNotes] = useState('');

  const handleExecuteModeration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;

    if (moderationAction === 'reduce_sanction') {
      const res = AdminService.reduceSanctionAndCompensate(
        selectedReport.id,
        selectedReport.targetUserId,
        reduceRounds,
        rewardBoxes,
        noticeMessage,
        adminProfile.email
      );
      showToast(res.message, 'success');
    } else if (moderationAction === 'false_report') {
      const res = AdminService.markReportAsFalse(
        selectedReport.id,
        selectedReport.reporterId,
        adminProfile.email,
        adminActionNotes.trim() || undefined
      );
      showToast(res.message, 'info');
    } else if (moderationAction === 'reward_reporter') {
      const res = AdminService.rewardLegitimateReporter(
        selectedReport.id,
        selectedReport.reporterId,
        rewardBoxes,
        noticeMessage,
        adminProfile.email
      );
      showToast(res.message, 'success');
    }

    setModerationAction(null);
    setSelectedReport(null);
    refreshAllData();
  };

  // ==========================================
  // TAB 6: DB OPTIMIZE
  // ==========================================
  const handleManualDbOptimize = () => {
    const res = FirebaseChatService.purgeExpiredAndOptimizeMessages();
    showToast(`72시간 초과 만료 대화 ${res.purgedCount}건이 최적화 삭제되었습니다.`, 'success');
    refreshAllData();
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-stone-900 text-stone-100 font-sans select-none overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-16 bg-stone-950/90 border-b border-stone-800 px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-950/40">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">
                {adminProfile.isMaster ? '공공기관 매칭 시스템 통합 관리 포털' : `[${adminProfile.agencyName}] 기관 전용 관리 포털`}
              </h1>
              <span
                className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                  adminProfile.isMaster ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {adminProfile.isMaster ? '최고 관리자 (KEPCO)' : `기관 승인 관리자 (@${adminProfile.agencyDomain})`}
              </span>
            </div>
            <p className="text-xs text-stone-400">
              담당자: <span className="text-stone-200 font-medium">{adminProfile.name}</span> ({adminProfile.email})
            </p>
          </div>
        </div>

        {/* Action Widgets in Header */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Cloud Database Status Pill */}
          <div className="hidden md:flex items-center gap-2 bg-stone-800/90 border border-stone-700 px-3 py-1.5 rounded-xl text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-stone-200">
              {isFirebaseConfigured() ? '🔥 Firebase 클라우드 DB' : '⚡ 서버 영구 DB 실시간 동기화'}
            </span>
          </div>

          {/* Quick Push to Cloud */}
          <button
            onClick={handlePushAllToCloud}
            disabled={isCloudSyncing}
            title="전체 데이터를 클라우드에 즉시 저장"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <UploadCloud className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">클라우드 즉시 저장</span>
          </button>

          {/* Firebase Project Settings Modal Trigger */}
          <button
            onClick={() => setIsFirebaseModalOpen(true)}
            title="Firebase 프로젝트 설정 & 클라우드 DB 연동"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Firebase 설정</span>
          </button>

          {/* Monthly Event Boxes Balance Pill */}
          <div className="hidden lg:flex items-center gap-2 bg-stone-800/90 border border-stone-700 px-3 py-1.5 rounded-xl shadow-inner">
            <Gift className="w-4 h-4 text-amber-400" />
            <div className="text-xs">
              <span className="text-stone-400 mr-1.5">이벤트 상자:</span>
              <span className="font-extrabold text-amber-300 text-sm">
                {adminProfile.isMaster ? '무제한' : `${adminProfile.eventBoxesRemaining?.toLocaleString() || 0}개`}
              </span>
            </div>
          </div>

          <button
            onClick={handlePullAllFromCloud}
            disabled={isCloudSyncing}
            title="클라우드에서 최신 데이터 당겨오기"
            className="p-2 text-stone-300 hover:text-white bg-stone-800/80 hover:bg-stone-700 rounded-lg transition-colors border border-stone-700 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isCloudSyncing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">로그아웃</span>
          </button>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar Navigation */}
        <aside className="w-64 bg-stone-950/70 border-r border-stone-800/80 flex flex-col justify-between p-3 shrink-0">
          <nav className="space-y-1">
            {/* 1. Membership Approval */}
            <button
              onClick={() => setActiveTab('approvals')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'approvals'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
                  : 'text-stone-300 hover:bg-stone-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <UserCheck className="w-4 h-4" />
                <span>가입 요청 승인 심사</span>
              </div>
              {pendingUsers.length > 0 && (
                <span className="bg-amber-400 text-stone-950 text-[11px] font-black px-2 py-0.5 rounded-full animate-pulse">
                  {pendingUsers.length}
                </span>
              )}
            </button>

            {/* 2. Member Management */}
            <button
              onClick={() => setActiveTab('agency_users')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'agency_users'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
                  : 'text-stone-300 hover:bg-stone-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4" />
                <span>회원관리</span>
              </div>
              <span className="text-xs text-stone-400 font-mono">{agencyUsers.length}명</span>
            </button>

            {/* 3. Master Only: Agency Admins & Grant */}
            {adminProfile.isMaster && (
              <button
                onClick={() => setActiveTab('agency_admins')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === 'agency_admins'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/50'
                    : 'text-amber-300/90 hover:bg-stone-800/60 hover:text-amber-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <span>기관 관리자 & 상자 지급</span>
                </div>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-500/30">
                  총괄
                </span>
              </button>
            )}

            {/* 4. Admin Communication Board */}
            <button
              onClick={() => setActiveTab('admin_board')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'admin_board'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
                  : 'text-stone-300 hover:bg-stone-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4" />
                <span>관리자 소통 게시판</span>
              </div>
              <span className="text-xs text-stone-400 font-mono">{boardPosts.length}</span>
            </button>

            {/* 5. Reports & Sanctions */}
            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'reports'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
                  : 'text-stone-300 hover:bg-stone-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-4 h-4" />
                <span>제재 및 신고 관리</span>
              </div>
              {reports.filter((r) => r.status === 'pending').length > 0 && (
                <span className="bg-rose-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {reports.filter((r) => r.status === 'pending').length}
                </span>
              )}
            </button>

            {/* 6. Stats & DB */}
            <button
              onClick={() => setActiveTab('stats')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'stats'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
                  : 'text-stone-300 hover:bg-stone-800/60 hover:text-white'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>시스템 통계 & DB 최적화</span>
            </button>
          </nav>

          {/* Sidebar Footer Info */}
          <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-stone-400">
              <span>기관 도메인</span>
              <span className="font-mono text-stone-200">@{adminProfile.agencyDomain}</span>
            </div>
            <div className="flex items-center justify-between text-stone-400">
              <span>활동 중 회원</span>
              <span className="font-bold text-emerald-400">{stats.activeUsersNow}명</span>
            </div>
            <div className="flex items-center justify-between text-stone-400">
              <span>가입 대기</span>
              <span className="font-bold text-amber-400">{stats.pendingApprovalsCount}명</span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-stone-900/50">
          {/* Toast Notice Bar */}
          {toastMessage && (
            <div
              className={`mb-6 p-4 rounded-xl flex items-center justify-between text-sm font-semibold shadow-lg transition-all animate-fadeIn ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-200'
                  : toastMessage.type === 'error'
                  ? 'bg-rose-950/80 border border-rose-500/40 text-rose-200'
                  : 'bg-stone-800 border border-stone-700 text-stone-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>{toastMessage.text}</span>
              </div>
              <button onClick={() => setToastMessage(null)} className="p-1 hover:opacity-75">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: MEMBERSHIP APPROVAL MANAGEMENT */}
          {/* ========================================================================= */}
          {activeTab === 'approvals' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-rose-400" />
                    <span>신규 회원 가입 요청 심사</span>
                    <span className="text-sm font-normal text-stone-400">({pendingUsers.length}건 대기)</span>
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    공공기관 공식 메일 가입 신청자의 소속 및 프로필을 확인하고 승인합니다. 승인 즉시 정식 로그인과 함께 환영박스가 자동 지급됩니다.
                  </p>
                </div>
              </div>

              {pendingUsers.length === 0 ? (
                <div className="bg-stone-950/60 border border-stone-800/80 rounded-2xl p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-stone-200">현재 대기 중인 가입 요청이 없습니다</h3>
                  <p className="text-xs text-stone-400 max-w-md mx-auto">
                    소속 기관 회원이 가입 신청서를 제출하면 이 목록에 실시간으로 등록됩니다.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingUsers.map((user, idx) => (
                    <div
                      key={`pending-user-${user.id}-${idx}`}
                      className="bg-stone-950/80 border border-stone-800 rounded-2xl p-4 flex flex-col justify-between hover:border-stone-700 transition-all shadow-md"
                    >
                      <div className="space-y-3">
                        {/* Header Avatar & Basic Info */}
                        <div className="flex items-center gap-3">
                          <img
                            src={user.photoUrl}
                            alt={user.name}
                            className="w-14 h-14 rounded-2xl object-cover border-2 border-stone-700 bg-stone-800"
                          />
                          <div className="overflow-hidden">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white truncate">{user.name}</h4>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  user.gender === 'female' ? 'bg-rose-500/20 text-rose-300' : 'bg-blue-500/20 text-blue-300'
                                }`}
                              >
                                {user.gender === 'female' ? '여' : '남'} / {user.age || calculateAge(user.birthDate)}세
                              </span>
                            </div>
                            <p className="text-xs text-stone-400 font-mono truncate">{user.email}</p>
                            <p className="text-xs font-semibold text-rose-300 truncate mt-0.5">{user.company}</p>
                          </div>
                        </div>

                        {/* Bio & Details */}
                        <div className="bg-stone-900/90 rounded-xl p-2.5 border border-stone-800 text-xs space-y-1.5">
                          <p className="text-stone-300 line-clamp-2 italic">
                            "{user.bio || '자기소개가 작성되지 않았습니다.'}"
                          </p>
                          {user.interests && user.interests.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {user.interests.map((tag, idx) => (
                                <span key={idx} className="bg-stone-800 text-stone-300 text-[10px] px-2 py-0.5 rounded-md">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-stone-500 px-1">
                          <span>신청일시: {new Date(user.createdAt).toLocaleString('ko-KR')}</span>
                        </div>
                      </div>

                      {/* Approval Action Buttons */}
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-stone-800/80">
                        <button
                          onClick={() => handleRejectUser(user.id)}
                          className="flex-1 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border border-stone-700"
                        >
                          <X className="w-3.5 h-3.5 text-rose-400" />
                          <span>반려</span>
                        </button>
                        <button
                          onClick={() => handleApproveUser(user.id)}
                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-rose-950/40"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>가입 승인</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: MEMBER MANAGEMENT (회원관리 & 최종/누적접속일 & 제재/해지 & 선물) */}
          {/* ========================================================================= */}
          {activeTab === 'agency_users' && (
            <div className="space-y-6">
              {/* Top Statistics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-stone-950/80 border border-stone-800/90 rounded-2xl p-4 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-400">총 등록 회원</span>
                    <Users className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-black text-white mt-1.5 tracking-tight">
                    {agencyUsers.length}<span className="text-sm font-normal text-stone-400 ml-1">명</span>
                  </div>
                  <div className="text-[11px] text-stone-400 mt-1">
                    일반회원: {agencyUsers.filter((u) => !AdminService.isProtectedAdmin(u).isProtected).length}명
                  </div>
                </div>

                <div className="bg-stone-950/80 border border-stone-800/90 rounded-2xl p-4 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-400">실시간 접속자</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="text-2xl font-black text-emerald-400 mt-1.5 tracking-tight">
                    {agencyUsers.filter((u) => u.isOnline || (u.lastActive && Date.now() - u.lastActive < 300000)).length}
                    <span className="text-sm font-normal text-stone-400 ml-1">명</span>
                  </div>
                  <div className="text-[11px] text-emerald-500/80 mt-1">
                    1시간 내 활동: {recent1HourUsers.length}명
                  </div>
                </div>

                <div className="bg-stone-950/80 border border-stone-800/90 rounded-2xl p-4 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-400">관리자 계정 (보호)</span>
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl font-black text-cyan-300 mt-1.5 tracking-tight">
                    {agencyUsers.filter((u) => AdminService.isProtectedAdmin(u).isProtected).length}
                    <span className="text-sm font-normal text-stone-400 ml-1">명</span>
                  </div>
                  <div className="text-[11px] text-stone-400 mt-1">
                    제재/선물 설정 보호됨
                  </div>
                </div>

                <div className="bg-stone-950/80 border border-stone-800/90 rounded-2xl p-4 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-400">제재/이용제한 회원</span>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-rose-400 mt-1.5 tracking-tight">
                    {
                      agencyUsers.filter(
                        (u) =>
                          (u.sanctionCount && u.sanctionCount > 0) ||
                          u.isBanned ||
                          (u.sanctionExpiresAt && u.sanctionExpiresAt > Date.now())
                      ).length
                    }
                    <span className="text-sm font-normal text-stone-400 ml-1">명</span>
                  </div>
                  <div className="text-[11px] text-rose-400/80 mt-1">
                    즉시 소명/해지 가능
                  </div>
                </div>
              </div>

              {/* Event Execution Banner Card */}
              <div className="bg-gradient-to-r from-rose-950/80 via-stone-900 to-amber-950/60 border border-rose-500/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-400 text-stone-950 text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 fill-stone-950" />
                        기관 한정 서프라이즈 이벤트
                      </span>
                      <span className="text-xs text-stone-400 font-mono">
                        보유 상자: <strong className="text-amber-300 font-bold">{adminProfile.isMaster ? '무제한' : `${adminProfile.eventBoxesRemaining?.toLocaleString()}개`}</strong>
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                      최근 1시간 이내 접속 회원 대상 랜덤 보상 지급
                    </h3>
                    <p className="text-xs text-stone-300 max-w-2xl leading-relaxed">
                      현재 접속 중이거나 1시간 내 활동한 소속 기관 일반회원들에게 감사 선물(환영박스, 광역안테나, 호감도 +30 등)을 일괄 무작위 발송합니다.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-3 text-center min-w-[100px]">
                      <span className="text-[10px] text-stone-400 block">대상 사원</span>
                      <span className="text-lg font-black text-emerald-400">{recent1HourUsers.length}명</span>
                    </div>

                    <button
                      onClick={handleRun1HourEvent}
                      disabled={recent1HourUsers.length === 0}
                      className={`px-4 py-3 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-lg ${
                        recent1HourUsers.length > 0
                          ? 'bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white shadow-rose-950/60'
                          : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>랜덤 선물 발송 ({recent1HourUsers.length * eventBoxCost}개 상자)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Toolbar: Search, Filters, and Sorters */}
              <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-4 space-y-3.5 shadow-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Left: Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setMemberFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        memberFilter === 'all'
                          ? 'bg-rose-600 text-white shadow'
                          : 'bg-stone-900 text-stone-400 hover:text-white border border-stone-800'
                      }`}
                    >
                      전체 ({agencyUsers.length})
                    </button>
                    <button
                      onClick={() => setMemberFilter('regular')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        memberFilter === 'regular'
                          ? 'bg-rose-600 text-white shadow'
                          : 'bg-stone-900 text-stone-400 hover:text-white border border-stone-800'
                      }`}
                    >
                      일반회원 ({agencyUsers.filter((u) => !AdminService.isProtectedAdmin(u).isProtected).length})
                    </button>
                    <button
                      onClick={() => setMemberFilter('admin')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        memberFilter === 'admin'
                          ? 'bg-cyan-600 text-white shadow'
                          : 'bg-stone-900 text-cyan-400/80 hover:text-cyan-200 border border-stone-800'
                      }`}
                    >
                      🔒 관리자 계정 ({agencyUsers.filter((u) => AdminService.isProtectedAdmin(u).isProtected).length})
                    </button>
                    <button
                      onClick={() => setMemberFilter('sanctioned')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        memberFilter === 'sanctioned'
                          ? 'bg-amber-600 text-white shadow'
                          : 'bg-stone-900 text-stone-400 hover:text-white border border-stone-800'
                      }`}
                    >
                      ⚠️ 제재/정지 ({
                        agencyUsers.filter(
                          (u) =>
                            (u.sanctionCount && u.sanctionCount > 0) ||
                            u.isBanned ||
                            (u.sanctionExpiresAt && u.sanctionExpiresAt > Date.now())
                        ).length
                      })
                    </button>
                    <button
                      onClick={() => setMemberFilter('online')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        memberFilter === 'online'
                          ? 'bg-emerald-600 text-white shadow'
                          : 'bg-stone-900 text-emerald-400/80 hover:text-emerald-200 border border-stone-800'
                      }`}
                    >
                      🟢 접속중 ({
                        agencyUsers.filter((u) => u.isOnline || (u.lastActive && Date.now() - u.lastActive < 300000)).length
                      })
                    </button>
                  </div>

                  {/* Right: Search & Sort */}
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    {adminProfile.isMaster && (
                      <select
                        value={selectedAgencyFilter}
                        onChange={(e) => setSelectedAgencyFilter(e.target.value)}
                        className="w-full sm:w-auto bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-amber-300 focus:outline-none focus:border-amber-500 font-semibold"
                      >
                        <option value="all">🏢 모든 기관 전체보기</option>
                        {DEFAULT_ALLOWED_DOMAINS.map((d) => (
                          <option key={d.domain} value={d.domain}>
                            {d.companyName} (@{d.domain})
                          </option>
                        ))}
                      </select>
                    )}

                    <div className="relative w-full sm:w-60">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        type="text"
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        placeholder="이름, 이메일, 기관 검색..."
                        className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-rose-500"
                      />
                      {userSearchTerm && (
                        <button
                          onClick={() => setUserSearchTerm('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <select
                      value={memberSort}
                      onChange={(e) => setMemberSort(e.target.value as any)}
                      className="w-full sm:w-auto bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-rose-500 font-medium"
                    >
                      <option value="recent_active">최종접속일 최신순</option>
                      <option value="attendance_days">누적접속일(출석) 많은순</option>
                      <option value="created_at">가입일시 최신순</option>
                      <option value="popularity">호감도(인기도) 높은순</option>
                      <option value="sanction">제재 차수 높은순</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Members Table */}
              <div className="bg-stone-950/80 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-900/95 text-stone-400 border-b border-stone-800 font-semibold tracking-wide">
                      <tr>
                        <th className="px-4 py-3.5">회원정보</th>
                        <th className="px-4 py-3.5">소속 기관</th>
                        <th className="px-4 py-3.5">최종 접속일</th>
                        <th className="px-4 py-3.5">누적 접속일</th>
                        <th className="px-4 py-3.5">호감도</th>
                        <th className="px-4 py-3.5">제재 현황</th>
                        <th className="px-4 py-3.5 text-right">회원 관리 설정</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800/70">
                      {agencyUsers
                        .filter((u) => {
                          if (selectedAgencyFilter !== 'all') {
                            const domain = u.email?.split('@')[1];
                            if (domain !== selectedAgencyFilter) return false;
                          }
                          if (userSearchTerm) {
                            const term = userSearchTerm.toLowerCase();
                            const matchName = u.name?.toLowerCase().includes(term);
                            const matchEmail = u.email?.toLowerCase().includes(term);
                            const matchCompany = u.company?.toLowerCase().includes(term);
                            if (!matchName && !matchEmail && !matchCompany) return false;
                          }
                          if (memberFilter === 'regular') {
                            return !AdminService.isProtectedAdmin(u).isProtected;
                          }
                          if (memberFilter === 'admin') {
                            return AdminService.isProtectedAdmin(u).isProtected;
                          }
                          if (memberFilter === 'sanctioned') {
                            return (
                              (u.sanctionCount && u.sanctionCount > 0) ||
                              u.isBanned ||
                              (u.sanctionExpiresAt && u.sanctionExpiresAt > Date.now())
                            );
                          }
                          if (memberFilter === 'online') {
                            const status = getUserActiveStatus(u.lastActive);
                            return status.status === 'online' || u.isOnline;
                          }
                          return true;
                        })
                        .sort((a, b) => {
                          if (memberSort === 'recent_active') {
                            return (b.lastActive || 0) - (a.lastActive || 0);
                          }
                          if (memberSort === 'attendance_days') {
                            return (b.totalAttendanceDays || 1) - (a.totalAttendanceDays || 1);
                          }
                          if (memberSort === 'created_at') {
                            return (b.createdAt || 0) - (a.createdAt || 0);
                          }
                          if (memberSort === 'popularity') {
                            return (b.popularity || 100) - (a.popularity || 100);
                          }
                          if (memberSort === 'sanction') {
                            return (b.sanctionCount || 0) - (a.sanctionCount || 0);
                          }
                          return 0;
                        })
                        .map((user, idx) => {
                          const status = getUserActiveStatus(user.lastActive);
                          const isOnline = status.status === 'online' || user.isOnline;
                          const protection = AdminService.isProtectedAdmin(user);

                          // Date formatting for last active
                          const lastActiveDate = user.lastActive ? new Date(user.lastActive) : null;
                          const formattedLastActive = lastActiveDate
                            ? `${lastActiveDate.toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                              })} ${lastActiveDate.toLocaleTimeString('ko-KR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}`
                            : '접속 이력 없음';

                          // Sanction status check
                          const isBanned = user.isBanned;
                          const isCurrentlyRestricted =
                            user.sanctionExpiresAt && user.sanctionExpiresAt > Date.now();

                          return (
                            <tr
                              key={`member-row-${user.id}-${idx}`}
                              className="hover:bg-stone-900/60 transition-colors"
                            >
                              {/* 1. Member Profile & Role */}
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="relative shrink-0">
                                    <img
                                      src={user.photoUrl || getAvatarForUser(user.gender, user.id)}
                                      alt={user.name}
                                      onError={(e) => handleAvatarError(e, user.gender, user.id)}
                                      className="w-10 h-10 rounded-xl object-cover border border-stone-700 bg-stone-900 shadow-sm"
                                    />
                                    {isOnline && (
                                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-stone-950 rounded-full" />
                                    )}
                                  </div>

                                  <div>
                                    <div className="font-bold text-stone-100 flex items-center gap-1.5 flex-wrap">
                                      <span className="text-sm">{user.name}</span>
                                      <span className="text-[11px] text-stone-400 font-normal">
                                        ({user.gender === 'female' ? '여' : '남'}, {user.age || calculateAge(user.birthDate)}세)
                                      </span>

                                      {/* Role Badge */}
                                      {protection.isProtected ? (
                                        protection.role === 'master_admin' ? (
                                          <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm">
                                            <Award className="w-3 h-3 text-amber-400" />
                                            최고관리자
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm">
                                            <ShieldCheck className="w-3 h-3 text-cyan-400" />
                                            기관관리자
                                          </span>
                                        )
                                      ) : (
                                        <span className="bg-stone-800/90 text-stone-400 border border-stone-700 text-[10px] font-medium px-1.5 py-0.5 rounded">
                                          일반회원
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-stone-400 font-mono text-[11px] mt-0.5 flex items-center gap-1">
                                      <span>{user.email}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* 2. Company & Verification */}
                              <td className="px-4 py-3.5">
                                <div className="text-stone-200 font-semibold text-xs">{user.company}</div>
                                <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span>공직자 인증 완료</span>
                                </div>
                              </td>

                              {/* 3. Last Access Date */}
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span
                                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                      isOnline
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : 'bg-stone-800 text-stone-300'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'
                                      }`}
                                    />
                                    {isOnline ? '접속중' : status.label}
                                  </span>
                                </div>
                                <div className="text-stone-400 font-mono text-[11px] flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-stone-500" />
                                  <span>{formattedLastActive}</span>
                                </div>
                              </td>

                              {/* 4. Cumulative Access Days (누적접속일) */}
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-1.5 font-bold text-amber-300 text-xs">
                                  <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                                  <span>누적 {user.totalAttendanceDays || 1}일</span>
                                </div>
                                <div className="text-[11px] text-stone-400 mt-0.5">
                                  연속 출석 {user.consecutiveAttendanceDays || 1}일 (총 {user.loginCount || 1}회 접속)
                                </div>
                              </td>

                              {/* 5. Popularity */}
                              <td className="px-4 py-3.5">
                                <div className="font-bold text-rose-400 font-mono text-xs">
                                  {user.popularity || 100}점
                                </div>
                                <div className="text-[10px] text-stone-500">호감도 지수</div>
                              </td>

                              {/* 6. Sanction Status */}
                              <td className="px-4 py-3.5">
                                {isBanned ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-950/80 text-rose-300 border border-rose-600/60 rounded-lg text-[11px] font-black">
                                    <UserX className="w-3.5 h-3.5 text-rose-400" />
                                    영구 이용정지
                                  </span>
                                ) : isCurrentlyRestricted ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-md text-[11px] font-bold">
                                      <AlertTriangle className="w-3 h-3 text-rose-400" />
                                      {user.sanctionCount}차 정지 진행중
                                    </span>
                                    <div className="text-[10px] text-stone-400 font-mono">
                                      ~{new Date(user.sanctionExpiresAt!).toLocaleDateString()} 해제예정
                                    </div>
                                  </div>
                                ) : user.sanctionCount && user.sanctionCount > 0 ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-md text-[11px] font-medium">
                                      {user.sanctionCount}차 제재 이력
                                    </span>
                                    <div className="text-[10px] text-emerald-400/90 font-medium">
                                      (현재 정상 이용)
                                    </div>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    정상 이용중
                                  </span>
                                )}
                              </td>

                              {/* 7. Action Buttons (Protection Enforced) */}
                              <td className="px-4 py-3.5 text-right">
                                {protection.isProtected ? (
                                  <div
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900/90 border border-stone-700/80 rounded-xl text-[11px] font-bold text-stone-400 shadow-sm cursor-not-allowed select-none"
                                    title="최고관리자 및 기관관리자 계정은 시스템 보호 대상이므로 제재, 제재해지, 선물 설정이 불가능합니다."
                                  >
                                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                                    <span>관리자 보호 (설정 불가)</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                    {/* 1. Gift Button */}
                                    <button
                                      onClick={() => handleOpenGiftModal(user)}
                                      title="1:1 선물 지급"
                                      className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                                    >
                                      <Gift className="w-3.5 h-3.5 text-amber-400" />
                                      <span>선물</span>
                                    </button>

                                    {/* 2. Sanction Button */}
                                    <button
                                      onClick={() => handleOpenSanctionModal(user)}
                                      title="운영정책 위반 제재 조치"
                                      className="px-2.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                                      <span>제재</span>
                                    </button>

                                    {/* 3. Lift Sanction Button (Enhanced if currently sanctioned) */}
                                    <button
                                      onClick={() => handleOpenLiftModal(user)}
                                      title="소명 접수 및 제재 해지"
                                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm ${
                                        isBanned || isCurrentlyRestricted || (user.sanctionCount && user.sanctionCount > 0)
                                          ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-950/40 animate-pulse'
                                          : 'bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-700'
                                      }`}
                                    >
                                      <Unlock className="w-3.5 h-3.5" />
                                      <span>해지</span>
                                    </button>

                                    {/* 4. User Details Modal Button */}
                                    <button
                                      onClick={() => setSelectedUserDetail(user)}
                                      title="상세 정보 보기"
                                      className="p-1.5 bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white rounded-xl border border-stone-700 transition-colors"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Empty State */}
                {agencyUsers.length === 0 && (
                  <div className="p-12 text-center text-stone-500 space-y-2">
                    <Users className="w-10 h-10 mx-auto opacity-40" />
                    <p className="text-sm font-semibold">소속 기관에 등록된 회원이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: MASTER ADMIN ONLY - AGENCY ADMINS & GRANT BOXES */}
          {/* ========================================================================= */}
          {activeTab === 'agency_admins' && adminProfile.isMaster && (
            <div className="space-y-6">
              {/* Top Overview KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
                  <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs text-stone-400 font-medium">등록된 총 기관 관리자</div>
                    <div className="text-xl font-bold text-white font-mono mt-0.5">{allAdmins.length}명</div>
                  </div>
                </div>

                <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
                  <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs text-stone-400 font-medium">관리 대상 공공기관 수</div>
                    <div className="text-xl font-bold text-white font-mono mt-0.5">
                      {new Set(allAdmins.map((a) => a.agencyDomain)).size}개 기관
                    </div>
                  </div>
                </div>

                <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
                  <div className="p-3 bg-amber-500/20 text-amber-300 rounded-xl border border-amber-500/30">
                    <Gift className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs text-stone-400 font-medium">배정된 이벤트 상자 총 잔여량</div>
                    <div className="text-xl font-bold text-amber-300 font-mono mt-0.5">
                      {allAdmins.reduce((acc, a) => acc + (a.eventBoxesRemaining || 0), 0).toLocaleString()}개
                    </div>
                  </div>
                </div>
              </div>

              {/* Add Agency Admin Form */}
              <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                  <Building2 className="w-5 h-5 text-amber-400" />
                  <span>신규 기관 담당자 계정 생성 (기관별 복수 관리자 지원)</span>
                </h3>
                <p className="text-xs text-stone-400 mb-6">
                  각 공공기관 도메인(@기관)별로 가입 심사 및 이벤트를 주관할 관리자 계정을 생성합니다. 생성된 기관 관리자는 해당 기관 회원의 가입 승인 및 회원 관리를 수행합니다.
                </p>

                <form onSubmit={handleCreateAgencyAdmin} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-stone-400 mb-1 block">소속 기관 선택/입력</label>
                    <select
                      value={newAdminAgencyDomain}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewAdminAgencyDomain(val);
                        const matched = DEFAULT_ALLOWED_DOMAINS.find((d) => d.domain === val);
                        if (matched) setNewAdminAgencyName(matched.companyName);
                      }}
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      {DEFAULT_ALLOWED_DOMAINS.map((d) => (
                        <option key={d.domain} value={d.domain}>
                          {d.companyName} (@{d.domain})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-400 mb-1 block">기관명 (표시용)</label>
                    <input
                      type="text"
                      value={newAdminAgencyName}
                      onChange={(e) => setNewAdminAgencyName(e.target.value)}
                      placeholder="예: 한국전력공사"
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-400 mb-1 block">관리자 이메일 (로그인 ID)</label>
                    <input
                      type="email"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder={`예: manager@${newAdminAgencyDomain}`}
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-400 mb-1 block">담당자 이름</label>
                    <input
                      type="text"
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      placeholder="예: 김전력"
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-400 mb-1 block">소속 부서</label>
                    <input
                      type="text"
                      value={newAdminDept}
                      onChange={(e) => setNewAdminDept(e.target.value)}
                      placeholder="예: 인재경영처 복지부"
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-400 mb-1 block">비밀번호</label>
                    <input
                      type="text"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      placeholder="비밀번호 입력"
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="text-xs font-semibold text-stone-400 mb-1 block">
                      초기 배정 이벤트 상자 수량
                    </label>
                    <div className="flex items-center gap-2">
                      {[100, 500, 1000, 3000, 5000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setNewAdminInitialBoxes(amt)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                            newAdminInitialBoxes === amt
                              ? 'bg-amber-500 text-stone-950'
                              : 'bg-stone-900 text-stone-400 hover:text-white border border-stone-700'
                          }`}
                        >
                          +{amt.toLocaleString()}개
                        </button>
                      ))}
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={newAdminInitialBoxes}
                        onChange={(e) => setNewAdminInitialBoxes(Number(e.target.value))}
                        className="w-32 bg-stone-900 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white text-right focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3 flex justify-end pt-2">
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-amber-950/40 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>기관 담당자 등록하기</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Agency Admins List & Grant Boxes */}
              <div className="bg-stone-950/80 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-4 border-b border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>등록된 기관 관리자 목록</span>
                    <span className="text-xs text-stone-400 font-mono">({allAdmins.length}명)</span>
                  </h4>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      value={agencyAdminSearchTerm}
                      onChange={(e) => setAgencyAdminSearchTerm(e.target.value)}
                      placeholder="기관명, 관리자명, 이메일 검색..."
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                    />
                    {agencyAdminSearchTerm && (
                      <button
                        onClick={() => setAgencyAdminSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-900 text-stone-400 uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-3">기관명 / 도메인</th>
                        <th className="px-4 py-3">담당자 / 이메일</th>
                        <th className="px-4 py-3">부서</th>
                        <th className="px-4 py-3">비밀번호</th>
                        <th className="px-4 py-3">이벤트 상자 잔여량</th>
                        <th className="px-4 py-3 text-right">상자 추가지급 / 관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800/60">
                      {allAdmins
                        .filter((admin) => {
                          if (!agencyAdminSearchTerm) return true;
                          const term = agencyAdminSearchTerm.toLowerCase();
                          return (
                            admin.name?.toLowerCase().includes(term) ||
                            admin.email?.toLowerCase().includes(term) ||
                            admin.agencyName?.toLowerCase().includes(term) ||
                            admin.agencyDomain?.toLowerCase().includes(term)
                          );
                        })
                        .map((admin, idx) => (
                          <tr key={`admin-row-${admin.id}-${idx}`} className="hover:bg-stone-900/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-bold text-white">{admin.agencyName}</div>
                              <div className="text-stone-400 font-mono text-[11px]">@{admin.agencyDomain}</div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="font-semibold text-stone-200">{admin.name}</div>
                              <div className="text-stone-400 font-mono text-[11px]">{admin.email}</div>
                            </td>

                            <td className="px-4 py-3 text-stone-300">{admin.department || '-'}</td>

                            <td className="px-4 py-3 text-stone-400 font-mono">{admin.passwordPlain}</td>

                            <td className="px-4 py-3">
                              <span className="font-bold text-amber-300 text-sm font-mono">
                                {admin.eventBoxesRemaining?.toLocaleString() || 0}개
                              </span>
                            </td>

                            <td className="px-4 py-3 text-right space-x-2">
                              <button
                                onClick={() => setGrantTargetAdmin(admin)}
                                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Gift className="w-3.5 h-3.5" />
                                <span>상자 추가지급</span>
                              </button>

                              <button
                                onClick={() => handleDeleteAgencyAdmin(admin.id)}
                                className="p-1.5 text-stone-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                                title="관리자 삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: ADMIN COMMUNICATION BOARD */}
          {/* ========================================================================= */}
          {activeTab === 'admin_board' && (
            <div className="space-y-6">
              {/* Board Header & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-rose-400" />
                    <span>최고관리자 ↔ 기관관리자 소통 게시판</span>
                  </h3>
                  <p className="text-xs text-stone-400 mt-0.5">
                    기관별 건의사항, 이벤트 상자 추가 지원 요청, 운영 가이드 및 질의응답을 공유합니다.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={boardCategoryFilter}
                    onChange={(e) => setBoardCategoryFilter(e.target.value as any)}
                    className="bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-300 focus:outline-none focus:border-rose-500"
                  >
                    <option value="all">전체 카테고리</option>
                    <option value="notice">공지사항</option>
                    <option value="request">지원/안건요청</option>
                    <option value="policy">운영정책</option>
                    <option value="free">자유의견</option>
                  </select>

                  <button
                    onClick={() => setIsNewPostModalOpen(true)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-rose-950/40"
                  >
                    <Plus className="w-4 h-4" />
                    <span>새 게시글 작성</span>
                  </button>
                </div>
              </div>

              {/* Posts List */}
              <div className="space-y-4">
                {boardPosts
                  .filter((p) => boardCategoryFilter === 'all' || p.category === boardCategoryFilter)
                  .map((post) => {
                    const isAuthor = post.authorEmail.toLowerCase() === adminProfile.email.toLowerCase();

                    return (
                      <div
                        key={post.id}
                        className={`bg-stone-950/80 border rounded-2xl p-5 shadow-lg transition-all ${
                          post.isPinned ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-stone-800'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Post Header */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {post.isPinned && (
                                <span className="bg-amber-400 text-stone-950 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <Pin className="w-3 h-3 fill-stone-950" />
                                  중요 공지
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  post.category === 'notice'
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : post.category === 'request'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-stone-800 text-stone-300'
                                }`}
                              >
                                {post.category === 'notice'
                                  ? '공지'
                                  : post.category === 'request'
                                  ? '요청'
                                  : post.category === 'policy'
                                  ? '정책'
                                  : '자유'}
                              </span>
                              <h4 className="text-base font-bold text-white">{post.title}</h4>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-stone-400">
                              <span>{new Date(post.createdAt).toLocaleDateString('ko-KR')}</span>
                              {(isAuthor || adminProfile.isMaster) && (
                                <button
                                  onClick={() => handleDeletePost(post.id)}
                                  className="text-stone-500 hover:text-rose-400 transition-colors p-1"
                                  title="게시글 삭제"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Post Content */}
                          <p className="text-xs text-stone-300 leading-relaxed whitespace-pre-line">{post.content}</p>

                          {/* Author Tag */}
                          <div className="flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-stone-900">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-stone-300">{post.authorName}</span>
                              <span>({post.agencyName})</span>
                            </div>

                            <button
                              onClick={() => setActivePostComments(activePostComments === post.id ? null : post.id)}
                              className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>댓글 {post.comments?.length || 0}개</span>
                            </button>
                          </div>

                          {/* Comments Drawer */}
                          {activePostComments === post.id && (
                            <div className="mt-4 pt-3 border-t border-stone-800/80 space-y-3">
                              <div className="space-y-2">
                                {post.comments && post.comments.length > 0 ? (
                                  post.comments.map((comm) => (
                                    <div key={comm.id} className="bg-stone-900/90 rounded-xl p-3 border border-stone-800/80 text-xs">
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-stone-200">{comm.authorName}</span>
                                          <span className="text-[10px] text-stone-400">({comm.agencyName})</span>
                                          {comm.isMaster && (
                                            <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded">
                                              총괄
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[10px] text-stone-500">
                                          {new Date(comm.createdAt).toLocaleTimeString('ko-KR', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                        </span>
                                      </div>
                                      <p className="text-stone-300">{comm.content}</p>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-xs text-stone-500 italic text-center py-2">등록된 댓글이 없습니다.</p>
                                )}
                              </div>

                              {/* Comment Input */}
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={commentInput}
                                  onChange={(e) => setCommentInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddComment(post.id);
                                  }}
                                  placeholder="댓글을 입력하세요..."
                                  className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-rose-500"
                                />
                                <button
                                  onClick={() => handleAddComment(post.id)}
                                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors"
                                >
                                  등록
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: REPORTS & SANCTIONS MODERATION */}
          {/* ========================================================================= */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                  <span>신고 접수 및 제재/소명 심사 관리</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  신고된 건의 증거 스냅샷(대화 내역, 프로필 변경 기록)을 감사하고, 부당 제재 해제 및 보상 지급 또는 허위신고자 역제재를 처리합니다.
                </p>
              </div>

              <div className="space-y-4">
                {reports.map((report, idx) => (
                  <div
                    key={`report-card-${report.id}-${idx}`}
                    className="bg-stone-950/80 border border-stone-800 rounded-2xl p-5 shadow-lg space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            report.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : report.status === 'compensated_justified'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-stone-800 text-stone-400'
                          }`}
                        >
                          {report.status === 'pending'
                            ? '심사 대기중'
                            : report.status === 'compensated_justified'
                            ? '소명 승인 (제재해제/보상)'
                            : report.status === 'dismissed_false'
                            ? '허위신고 판정'
                            : '정당신고 확인'}
                        </span>
                        <h4 className="text-sm font-bold text-white">
                          피신고자: <span className="text-rose-400">{report.targetUserName}</span> ({report.targetUserEmail})
                        </h4>
                      </div>
                      <span className="text-xs text-stone-500">{new Date(report.timestamp).toLocaleString('ko-KR')}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-stone-900/90 rounded-xl p-3 border border-stone-800/80 text-xs">
                      <div>
                        <span className="text-stone-400 block mb-0.5">신고 사유:</span>
                        <span className="font-semibold text-stone-200">
                          {report.reason} {report.customReasonDetail ? `(${report.customReasonDetail})` : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block mb-0.5">적용된 즉시 제재:</span>
                        <span className="font-bold text-rose-400">
                          누적 {report.targetSanctionRound}차 제재 ({report.appliedSanctionHours}시간 제한)
                        </span>
                      </div>
                    </div>

                    {/* Chat and Bio Audit Preview */}
                    {report.chatHistorySnapshot && report.chatHistorySnapshot.length > 0 && (
                      <div className="bg-stone-900/60 rounded-xl p-3 border border-stone-800 text-xs space-y-1.5">
                        <span className="text-[11px] font-bold text-stone-400">대화 증거 스냅샷 ({report.chatHistorySnapshot.length}개 메시지)</span>
                        <div className="max-h-28 overflow-y-auto space-y-1 pr-2">
                          {report.chatHistorySnapshot.slice(-5).map((m) => (
                            <div key={m.id} className="text-stone-300">
                              <strong className="text-stone-400">{m.senderId === report.targetUserId ? report.targetUserName : report.reporterName}:</strong>{' '}
                              {m.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Moderation Controls */}
                    {report.status === 'pending' && (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-800">
                        <button
                          onClick={() => {
                            setSelectedReport(report);
                            setModerationAction('reduce_sanction');
                          }}
                          className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition-colors"
                        >
                          제재 차감/해제 & 보상 지급
                        </button>
                        <button
                          onClick={() => {
                            setSelectedReport(report);
                            setModerationAction('false_report');
                          }}
                          className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-colors"
                        >
                          허위 신고 역제재 (신고자 1회 누적)
                        </button>
                        <button
                          onClick={() => {
                            setSelectedReport(report);
                            setModerationAction('reward_reporter');
                          }}
                          className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-colors"
                        >
                          정당 신고 확인 & 신고자 포상
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: STATS & DB OPTIMIZATION */}
          {/* ========================================================================= */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-5 shadow-lg">
                  <span className="text-xs text-stone-400 block mb-1">전체 가입 회원수</span>
                  <span className="text-2xl font-black text-white font-mono">{stats.totalUsers}명</span>
                </div>
                <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-5 shadow-lg">
                  <span className="text-xs text-stone-400 block mb-1">현재/최근 접속 회원</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">{stats.activeUsersNow}명</span>
                </div>
                <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-5 shadow-lg">
                  <span className="text-xs text-stone-400 block mb-1">기관 관리자 계정수</span>
                  <span className="text-2xl font-black text-amber-400 font-mono">{stats.agencyAdminsCount}명</span>
                </div>
                <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-5 shadow-lg">
                  <span className="text-xs text-stone-400 block mb-1">배정된 총 이벤트 상자</span>
                  <span className="text-2xl font-black text-rose-400 font-mono">
                    {stats.totalEventBoxesDistributed.toLocaleString()}개
                  </span>
                </div>
              </div>

              {/* 1. Firebase Cloud DB & Multi-Device Realtime Sync Center */}
              <div className="bg-stone-950/90 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                      <Flame className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-white">클라우드 데이터베이스 및 영구 보존 센터</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isFirebaseConfigured()
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        }`}>
                          {isFirebaseConfigured() ? 'Firebase Firestore 연결됨' : '풀스택 서버 영구 보관 활성'}
                        </span>
                      </div>
                      <p className="text-xs text-stone-400 mt-0.5">
                        모든 사용자 프로필, 관리자 계정, 소통 게시판, 인벤토리 데이터가 전 기기 실시간 동기화 및 무기한 보존됩니다.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handlePushAllToCloud}
                      disabled={isCloudSyncing}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
                    >
                      <UploadCloud className={`w-4 h-4 ${isCloudSyncing ? 'animate-bounce' : ''}`} />
                      <span>전체 데이터 클라우드 영구 저장</span>
                    </button>

                    <button
                      onClick={handlePullAllFromCloud}
                      disabled={isCloudSyncing}
                      className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all border border-stone-700 cursor-pointer"
                    >
                      <DownloadCloud className={`w-4 h-4 ${isCloudSyncing ? 'animate-spin' : ''}`} />
                      <span>클라우드 데이터 최신화</span>
                    </button>

                    <button
                      onClick={() => setIsFirebaseModalOpen(true)}
                      className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Flame className="w-4 h-4" />
                      <span>Firebase 연동 설정</span>
                    </button>
                  </div>
                </div>

                {/* Status Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="bg-stone-900/80 p-3.5 rounded-xl border border-stone-800 space-y-1">
                    <div className="text-stone-400 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-rose-400" />
                        회원 데이터 보존
                      </span>
                      <strong className="text-emerald-400">무기한 보관 중</strong>
                    </div>
                    <p className="text-stone-300 text-[11px]">
                      총 {stats.totalUsers}명 회원 위치, 프로필, 사진 영구 보존
                    </p>
                  </div>

                  <div className="bg-stone-900/80 p-3.5 rounded-xl border border-stone-800 space-y-1">
                    <div className="text-stone-400 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-amber-400" />
                        기관 관리자 동기화
                      </span>
                      <strong className="text-emerald-400">전 기기 실시간 공유</strong>
                    </div>
                    <p className="text-stone-300 text-[11px]">
                      총 {allAdmins.length}명 관리자 계정 및 이벤트 상자 동기화
                    </p>
                  </div>

                  <div className="bg-stone-900/80 p-3.5 rounded-xl border border-stone-800 space-y-1">
                    <div className="text-stone-400 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                        JSON 백업 및 다운로드
                      </span>
                      <button
                        onClick={handleExportBackupJson}
                        className="text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer"
                      >
                        백업 받기
                      </button>
                    </div>
                    <p className="text-stone-300 text-[11px]">
                      언제든 데이터베이스 전체를 파일로 내려받아 보관 가능
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. DB Optimization Block */}
              <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">데이터베이스 자동 만료(72시간 TTL) 및 최적화</h4>
                    <p className="text-xs text-stone-400">
                      채팅 메시지는 72시간 경과 후 자동으로 데이터베이스에서 삭제되어 개인정보와 성능을 완벽히 보호합니다.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleManualDbOptimize}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-lg shadow-blue-950/40 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>지금 72시간 초과 만료 데이터 즉시 정리하기</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: DIRECT GIFT TO USER */}
      {/* ========================================================================= */}
      {directGiftUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                <span>[{directGiftUser.name}] 사원 1:1 선물 지급</span>
              </h3>
              <button onClick={() => setDirectGiftUser(null)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendDirectGift} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-400 mb-1 block">지급할 아이템 선택</label>
                <select
                  value={directGiftType}
                  onChange={(e) => setDirectGiftType(e.target.value as any)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="welcome_box">환영 박스 (아이템 뽑기)</option>
                  <option value="boost_antenna">광역 검색 안테나 (1시간 반경확장)</option>
                  <option value="message_ticket">메시지 횟수권</option>
                  <option value="popularity_50">호감도(인기도) +50점</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-400 mb-1 block">수량</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={directGiftCount}
                  onChange={(e) => setDirectGiftCount(Number(e.target.value))}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-400 mb-1 block">전달 메시지 (선택)</label>
                <input
                  type="text"
                  value={directGiftMemo}
                  onChange={(e) => setDirectGiftMemo(e.target.value)}
                  placeholder="예: 이달의 우수 사원 소통 장려 선물"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDirectGiftUser(null)}
                  className="px-4 py-2 bg-stone-800 text-stone-300 rounded-xl text-xs font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs"
                >
                  선물 지급 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: GRANT BOXES TO AGENCY ADMIN (MASTER ONLY) */}
      {/* ========================================================================= */}
      {grantTargetAdmin && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                <span>[{grantTargetAdmin.agencyName}] 상자 추가 지급</span>
              </h3>
              <button onClick={() => setGrantTargetAdmin(null)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteGrantBoxes} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-400 mb-1 block">
                  지급 대상 관리자: <strong className="text-white">{grantTargetAdmin.name}</strong> ({grantTargetAdmin.email})
                </label>
                <p className="text-[11px] text-stone-400">
                  현재 보유량: {grantTargetAdmin.eventBoxesRemaining?.toLocaleString() || 0}개
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-400 mb-1 block">추가 지급할 이벤트 상자 수량</label>
                <div className="flex items-center gap-1.5 mb-2">
                  {[50, 100, 500, 1000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setGrantBoxesAmount(amt)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                        grantBoxesAmount === amt
                          ? 'bg-amber-500 text-stone-950'
                          : 'bg-stone-800 text-amber-300 hover:bg-stone-700'
                      }`}
                    >
                      +{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  step={10}
                  value={grantBoxesAmount}
                  onChange={(e) => setGrantBoxesAmount(Number(e.target.value))}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-400 mb-1 block">지급 사유 / 메모</label>
                <input
                  type="text"
                  value={grantMemo}
                  onChange={(e) => setGrantMemo(e.target.value)}
                  placeholder="예: 분기 특별 소통 이벤트 지원"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGrantTargetAdmin(null)}
                  className="px-4 py-2 bg-stone-800 text-stone-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-amber-950/40"
                >
                  지급 확정하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DIRECT SANCTION USER */}
      {/* ========================================================================= */}
      {sanctionTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-rose-600/40 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">회원 직접 제재 조치</h3>
                  <p className="text-xs text-stone-400">
                    운영정책 위반 회원에 대해 즉시 이용제한 또는 영구차단을 적용합니다.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSanctionTargetUser(null)}
                className="text-stone-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Summary */}
            <div className="flex items-center gap-3 bg-stone-950 p-3 rounded-xl border border-stone-800 text-xs">
              <img
                src={sanctionTargetUser.photoUrl || getAvatarForUser(sanctionTargetUser.gender, sanctionTargetUser.id)}
                alt={sanctionTargetUser.name}
                className="w-10 h-10 rounded-xl object-cover border border-stone-700 bg-stone-900"
              />
              <div className="flex-1 overflow-hidden">
                <div className="font-bold text-white flex items-center gap-2">
                  <span>{sanctionTargetUser.name}</span>
                  <span className="text-stone-400 font-normal">({sanctionTargetUser.company})</span>
                </div>
                <div className="text-stone-400 font-mono text-[11px]">{sanctionTargetUser.email}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-stone-400 block">현재 누적 제재</span>
                <span className="text-rose-400 font-bold font-mono text-xs">{sanctionTargetUser.sanctionCount || 0}회</span>
              </div>
            </div>

            <form onSubmit={handleExecuteDirectSanction} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-300 mb-1.5 block">제재 수위 선택</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'warning_1h', label: '1차 주의/경고', desc: '1시간 서비스 주의 조치' },
                    { id: 'restrict_24h', label: '24시간 정지', desc: '1일간 로그인/매칭 제한' },
                    { id: 'restrict_7d', label: '7일 정지', desc: '일주일간 서비스 이용정지' },
                    { id: 'permanent_ban', label: '영구 이용정지', desc: '영구 차단 및 블랙리스트' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSanctionType(item.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        sanctionType === item.id
                          ? 'bg-rose-500/20 border-rose-500 text-rose-200 shadow-md shadow-rose-950/40'
                          : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      <div className="font-bold text-xs">{item.label}</div>
                      <div className="text-[10px] text-stone-400 mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 mb-1.5 block">제재 사유 분류</label>
                <select
                  value={sanctionReasonType}
                  onChange={(e) => setSanctionReasonType(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="부적절한 대화 및 비매너 언행">부적절한 대화 및 비매너 언행</option>
                  <option value="허위 프로필 등록 및 사진 도용">허위 프로필 등록 및 사진 도용</option>
                  <option value="스팸, 광고 및 상업적 목적 활동">스팸, 광고 및 상업적 목적 활동</option>
                  <option value="불순한 만남 유도 및 개인정보 침해">불순한 만남 유도 및 개인정보 침해</option>
                  <option value="운영자/관리자 지시 불이행 및 기타 위반">운영자/관리자 지시 불이행 및 기타 위반</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 mb-1 block">
                  상세 사유 및 관리자 메모 (선택)
                </label>
                <textarea
                  rows={3}
                  value={sanctionCustomReason}
                  onChange={(e) => setSanctionCustomReason(e.target.value)}
                  placeholder="구체적인 위반 내역 또는 관리자 처리 사유를 기재하세요."
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setSanctionTargetUser(null)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-950/50"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>제재 즉시 적용</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DIRECT LIFT SANCTION */}
      {/* ========================================================================= */}
      {liftTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-emerald-600/40 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Unlock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">회원 제재 해제 및 정상화</h3>
                  <p className="text-xs text-stone-400">
                    소명 확인 또는 오인 조치로 인해 제한된 회원의 이용 상태를 즉시 복구합니다.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLiftTargetUser(null)}
                className="text-stone-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Summary */}
            <div className="flex items-center gap-3 bg-stone-950 p-3 rounded-xl border border-stone-800 text-xs">
              <img
                src={liftTargetUser.photoUrl || getAvatarForUser(liftTargetUser.gender, liftTargetUser.id)}
                alt={liftTargetUser.name}
                className="w-10 h-10 rounded-xl object-cover border border-stone-700 bg-stone-900"
              />
              <div className="flex-1 overflow-hidden">
                <div className="font-bold text-white flex items-center gap-2">
                  <span>{liftTargetUser.name}</span>
                  <span className="text-stone-400 font-normal">({liftTargetUser.company})</span>
                </div>
                <div className="text-stone-400 font-mono text-[11px]">{liftTargetUser.email}</div>
                {liftTargetUser.sanctionReason && (
                  <div className="text-rose-300 text-[10px] mt-0.5 truncate">
                    기존 제재: {liftTargetUser.sanctionReason}
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-stone-400 block">제재 상태</span>
                <span className="text-amber-400 font-bold text-xs">
                  {liftTargetUser.isBanned ? '영구 차단중' : '이용 제한중'}
                </span>
              </div>
            </div>

            <form onSubmit={handleExecuteDirectLiftSanction} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-300 mb-1 block">해제 사유</label>
                <input
                  type="text"
                  value={liftReason}
                  onChange={(e) => setLiftReason(e.target.value)}
                  placeholder="예: 소명자료 확인 완료 및 오해 해소"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 mb-1 block">
                  보상 환영박스 지급 수량 (선택)
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={liftCompensationBoxes}
                  onChange={(e) => setLiftCompensationBoxes(Number(e.target.value))}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[11px] text-stone-400 mt-1 block">
                  오인 제재에 대한 사과 또는 격려 목적으로 환영박스를 함께 선물할 수 있습니다. (0이면 미지급)
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 mb-1 block">
                  회원 알림 메시지 (선택)
                </label>
                <textarea
                  rows={2}
                  value={liftNoticeMessage}
                  onChange={(e) => setLiftNoticeMessage(e.target.value)}
                  placeholder="예: 제출해주신 소명 내용이 확인되어 정상 이용 가능하도록 조치되었습니다."
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setLiftTargetUser(null)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/50"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>제재 해제 및 정상화 확정</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: USER DETAILS MODAL */}
      {/* ========================================================================= */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">회원 상세 정보 및 이력</h3>
              </div>
              <button
                onClick={() => setSelectedUserDetail(null)}
                className="text-stone-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Overview */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 bg-stone-950 p-4 rounded-2xl border border-stone-800">
              <img
                src={selectedUserDetail.photoUrl || getAvatarForUser(selectedUserDetail.gender, selectedUserDetail.id)}
                alt={selectedUserDetail.name}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-stone-700 bg-stone-900 shadow-md"
              />
              <div className="flex-1 text-center sm:text-left space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h4 className="text-lg font-bold text-white">{selectedUserDetail.name}</h4>
                  <span className="text-xs text-stone-400 font-medium">
                    ({selectedUserDetail.gender === 'female' ? '여성' : '남성'}, {selectedUserDetail.age || calculateAge(selectedUserDetail.birthDate)}세)
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded">
                    공직자인증 완료
                  </span>
                </div>
                <p className="text-xs text-rose-300 font-semibold">{selectedUserDetail.company}</p>
                <p className="text-xs text-stone-400 font-mono">{selectedUserDetail.email}</p>
                <div className="flex items-center justify-center sm:justify-start gap-3 pt-1 text-xs text-stone-400">
                  <span>호감도: <strong className="text-amber-300 font-mono">{selectedUserDetail.popularity || 0}점</strong></span>
                  <span>누적 출석: <strong className="text-stone-200 font-mono">{selectedUserDetail.attendanceDays || 1}일</strong></span>
                  <span>제재 횟수: <strong className="text-rose-400 font-mono">{selectedUserDetail.sanctionCount || 0}회</strong></span>
                </div>
              </div>
            </div>

            {/* Bio & Interests */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-stone-400">자기소개</span>
              <div className="bg-stone-950 p-3.5 rounded-xl border border-stone-800 text-xs text-stone-200 leading-relaxed">
                {selectedUserDetail.bio || '등록된 자기소개가 없습니다.'}
              </div>
            </div>

            {selectedUserDetail.interests && selectedUserDetail.interests.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-stone-400">관심사 키워드</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedUserDetail.interests.map((item, i) => (
                    <span key={i} className="bg-stone-800 text-stone-300 px-2.5 py-1 rounded-lg text-xs font-medium border border-stone-700">
                      #{item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Current Sanction Status */}
            {(selectedUserDetail.isBanned || (selectedUserDetail.sanctionExpiresAt && selectedUserDetail.sanctionExpiresAt > Date.now()) || (selectedUserDetail.sanctionCount && selectedUserDetail.sanctionCount > 0)) && (
              <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3.5 space-y-1 text-xs">
                <div className="flex items-center justify-between text-rose-300 font-bold">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    제재 상태 안내
                  </span>
                  <span>
                    {selectedUserDetail.isBanned
                      ? '영구 이용정지 (블랙리스트)'
                      : selectedUserDetail.sanctionExpiresAt && selectedUserDetail.sanctionExpiresAt > Date.now()
                      ? `제재 진행중 (${Math.ceil((selectedUserDetail.sanctionExpiresAt - Date.now()) / (3600 * 1000))}시간 남음)`
                      : `누적 ${selectedUserDetail.sanctionCount}회 이력`}
                  </span>
                </div>
                {selectedUserDetail.sanctionReason && (
                  <p className="text-stone-300 text-[11px] mt-1">
                    사유: {selectedUserDetail.sanctionReason}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons in Modal */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stone-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleOpenGiftModal(selectedUserDetail);
                  }}
                  className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>1:1 선물 지급</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleOpenSanctionModal(selectedUserDetail);
                  }}
                  className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>직접 제재 조치</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleOpenLiftModal(selectedUserDetail);
                  }}
                  className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>제재 해제 및 정상화</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUserDetail(null)}
                className="px-4 py-2 bg-stone-800 text-stone-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NEW BOARD POST */}
      {/* ========================================================================= */}
      {isNewPostModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-rose-400" />
                <span>관리자 소통 게시글 작성</span>
              </h3>
              <button onClick={() => setIsNewPostModalOpen(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBoardPost} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-400 mb-1 block">카테고리</label>
                  <select
                    value={newPostCategory}
                    onChange={(e) => setNewPostCategory(e.target.value as any)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="request">지원/안건요청</option>
                    <option value="notice">공지사항</option>
                    <option value="policy">운영정책</option>
                    <option value="free">자유의견</option>
                  </select>
                </div>

                {adminProfile.isMaster && (
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="pinCheck"
                      checked={newPostPinned}
                      onChange={(e) => setNewPostPinned(e.target.checked)}
                      className="rounded border-stone-700 text-amber-500 focus:ring-amber-400"
                    />
                    <label htmlFor="pinCheck" className="text-xs font-bold text-amber-300 cursor-pointer">
                      상단 중요 공지로 고정 (Pin)
                    </label>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-400 mb-1 block">제목</label>
                <input
                  type="text"
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  placeholder="게시글 제목을 입력하세요"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-400 mb-1 block">내용</label>
                <textarea
                  rows={5}
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="안건 또는 공유할 내용을 작성하세요..."
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewPostModalOpen(false)}
                  className="px-4 py-2 bg-stone-800 text-stone-300 rounded-xl text-xs font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs"
                >
                  게시글 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MODERATION ACTION */}
      {/* ========================================================================= */}
      {moderationAction && selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <span>심사 처리 확정</span>
              </h3>
              <button onClick={() => setModerationAction(null)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteModeration} className="space-y-4">
              {moderationAction === 'reduce_sanction' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-stone-400 mb-1 block">차감할 제재 차수</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={reduceRounds}
                      onChange={(e) => setReduceRounds(Number(e.target.value))}
                      className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-stone-400 mb-1 block">지급할 보상 환영박스</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={rewardBoxes}
                      onChange={(e) => setRewardBoxes(Number(e.target.value))}
                      className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-stone-400 mb-1 block">회원에게 전달될 소명 안내 메시지</label>
                    <input
                      type="text"
                      value={noticeMessage}
                      onChange={(e) => setNoticeMessage(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </>
              )}

              {moderationAction === 'false_report' && (
                <div>
                  <label className="text-xs font-semibold text-stone-400 mb-1 block">허위 신고 사유 메모</label>
                  <textarea
                    rows={3}
                    value={adminActionNotes}
                    onChange={(e) => setAdminActionNotes(e.target.value)}
                    placeholder="신고 내역 및 대화 분석 결과 악의적인 허위 신고로 확인됨."
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              )}

              {moderationAction === 'reward_reporter' && (
                <div>
                  <label className="text-xs font-semibold text-stone-400 mb-1 block">신고자 포상 환영박스 개수</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={rewardBoxes}
                    onChange={(e) => setRewardBoxes(Number(e.target.value))}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModerationAction(null)}
                  className="px-4 py-2 bg-stone-800 text-stone-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  처리 확정
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FIREBASE CLOUD DB CONFIGURATION */}
      {/* ========================================================================= */}
      {isFirebaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-amber-500/40 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Firebase 클라우드 연동 설정</h3>
                  <p className="text-xs text-stone-400">
                    Google Firebase Firestore 및 Realtime DB를 연동하여 모든 데이터를 영구 보존합니다.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFirebaseModalOpen(false)}
                className="text-stone-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFirebaseConfigSubmit} className="space-y-3.5 text-xs">
              <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 text-[11px] text-amber-200/90 leading-relaxed">
                💡 Firebase 콘솔의 <strong>[프로젝트 설정] &gt; [웹 앱 구성]</strong>의 <code>firebaseConfig</code> 객체 값을 입력하면 즉시 전 기기 실시간 영구 저장이 활성화됩니다.
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 mb-1 block">
                  Project ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={currentFbConfig.projectId}
                  onChange={(e) => setCurrentFbConfig({ ...currentFbConfig, projectId: e.target.value.trim() })}
                  placeholder="예: my-dating-kepco-app"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 mb-1 block">
                  API Key <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={currentFbConfig.apiKey}
                  onChange={(e) => setCurrentFbConfig({ ...currentFbConfig, apiKey: e.target.value.trim() })}
                  placeholder="AIzaSy..."
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-white font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-300 mb-1 block">Auth Domain</label>
                  <input
                    type="text"
                    value={currentFbConfig.authDomain}
                    onChange={(e) => setCurrentFbConfig({ ...currentFbConfig, authDomain: e.target.value.trim() })}
                    placeholder="프로젝트명.firebaseapp.com"
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-300 mb-1 block">App ID</label>
                  <input
                    type="text"
                    value={currentFbConfig.appId}
                    onChange={(e) => setCurrentFbConfig({ ...currentFbConfig, appId: e.target.value.trim() })}
                    placeholder="1:12345:web:abcdef"
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 mb-1 block">Database URL (선택, Realtime DB)</label>
                <input
                  type="text"
                  value={currentFbConfig.databaseURL || ''}
                  onChange={(e) => setCurrentFbConfig({ ...currentFbConfig, databaseURL: e.target.value.trim() })}
                  placeholder="https://프로젝트명-default-rtdb.firebaseio.com"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    clearCustomFirebaseConfig();
                    setCurrentFbConfig({
                      apiKey: '',
                      projectId: '',
                      authDomain: '',
                      databaseURL: '',
                      storageBucket: '',
                      appId: '',
                    });
                    showToast('설정이 초기화되었습니다.', 'info');
                  }}
                  className="text-stone-400 hover:text-rose-400 text-[11px] underline cursor-pointer"
                >
                  설정 초기화
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFirebaseModalOpen(false)}
                    className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    닫기
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-amber-950/40"
                  >
                    연동 저장 및 즉시 동기화
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

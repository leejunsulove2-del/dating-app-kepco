import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  limit,
  serverTimestamp,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { initFirebaseApp, isFirebaseConfigured } from './firebaseConfig';
import { UserProfile, AdminAccount, AdminLogEntry, AdminBoardPost, LikeAction, UserInventory, UserReport } from '../types';

export class FirestoreSyncService {
  private static usersUnsubscribe: Unsubscribe | null = null;
  private static adminUnsubscribe: Unsubscribe | null = null;
  private static boardUnsubscribe: Unsubscribe | null = null;
  private static logsUnsubscribe: Unsubscribe | null = null;
  
  // 📍 실시간 기기 간 위치 공유를 해제하기 위한 새로운 구독 관리 변수
  private static locationUnsubscribe: Unsubscribe | null = null;

  /**
   * * Helper to obtain active Firestore instance
   */
  public static getDb() {
    const { db } = initFirebaseApp();
    return db;
  }

  // =========================================================================
  // [기기 간 실시간 위치 공유 핵심 기능]
  // =========================================================================

  /**
   * 내 기기의 GPS 위도/경도를 파이어베이스 서버의 'users' 컬렉션 내부 내 계정으로 보냅니다.
   */
  public static async uploadMyLocation(userId: string, latitude: number, longitude: number): Promise<boolean> {
    const db = this.getDb();
    if (!db || !userId) return false;

    try {
      const userRef = doc(db, 'users', userId);
      // 기존 다른 정보들은 유지한 채, 실시간 위치 정보 필드만 merge하여 업데이트
      await setDoc(userRef, {
        latitude,
        longitude,
        updatedAt: Date.now()
      }, { merge: true });
      return true;
    } catch (error) {
      console.warn(`[FirestoreSync] 내 위치 업로드 실패 (${userId}):`, error);
      return false;
    }
  }

  /**
   * 파이어베이스 서버로부터 다른 회원들의 실시간 위치를 새로고침 없이 계속해서 받아옵니다.
   */
  public static subscribeMembersLocation(currentUserId: string, callback: (users: UserProfile[]) => void): void {
    const db = this.getDb();
    if (!db) return;

    // 이미 열려 있는 위치 감시 리스너가 있다면 중복 실행 방지를 위해 해제
    if (this.locationUnsubscribe) {
      this.locationUnsubscribe();
    }

    const usersRef = collection(db, 'users');

    // 실시간 수신 대기 (onSnapshot)
    this.locationUnsubscribe = onSnapshot(usersRef, (snapshot) => {
      const activeMembers: UserProfile[] = [];
      
      snapshot.forEach((doc) => {
        // 본인 정보를 제외하고, 실시간 위치(위도, 경도) 값이 유효하게 존재하는 회원만 추합
        if (doc.id !== currentUserId) {
          const userData = doc.data() as UserProfile;
          if (userData.latitude && userData.longitude) {
            activeMembers.push({
              ...userData,
              id: doc.id
            });
          }
        }
      });

      // 변경 사항이 감지될 때마다 받아온 리스트를 프론트엔드로 콜백 반환
      callback(activeMembers);
    }, (error) => {
      console.error("[FirestoreSync] 실시간 위치 정보 구독 중 오류 발생:", error);
    });
  }

  /**
   * 화면을 벗어날 때 하드웨어 및 서버 실시간 리스너를 파괴하여 데이터 낭비를 막습니다.
   */
  public static unsubscribeMembersLocation(): void {
    if (this.locationUnsubscribe) {
      this.locationUnsubscribe();
      this.locationUnsubscribe = null;
    }
  }
  // =========================================================================
  // // 1. USERS COLLECTION (Real-time multi-device sync)
  // =========================================================================

  public static async saveUser(user: UserProfile): Promise<boolean> {
    const db = this.getDb();
    if (!db || !user || !user.id) return false;

    try {
      const userRef = doc(db, 'users', user.id);
      // Clean undefined fields for Firestore
      const cleanData = JSON.parse(JSON.stringify(user));
      cleanData.updatedAt = Date.now();
      await setDoc(userRef, cleanData, { merge: true });
      return true;
    } catch (error) {
      console.warn(`[FirestoreSync] Failed to save user ${user.id}:`, error);
      return false;
    }
  }

  public static async deleteUser(userId: string): Promise<boolean> {
    const db = this.getDb();
    if (!db || !userId) return false;
    try {
      await deleteDoc(doc(db, 'users', userId));
      return true;
    } catch (error) {
      console.warn(`[FirestoreSync] Failed to delete user ${userId}:`, error);
      return false;
    }
  }

  public static async seedUsersToFirestore(users: UserProfile[]): Promise<boolean> {
    const db = this.getDb();
    if (!db || !users || users.length === 0) return false;
    try {
      const batch = writeBatch(db);
      for (const u of users) {
        if (u && u.id) {
          const userRef = doc(db, 'users', u.id);
          const cleanData = JSON.parse(JSON.stringify(u));
          cleanData.updatedAt = Date.now();
          batch.set(userRef, cleanData, { merge: true });
        }
      }
      await batch.commit();
      return true;
    } catch (error) {
      console.warn('[FirestoreSync] Failed to seed users to Firestore:', error);
      return false;
    }
  }

  public static async getUser(userId: string): Promise<UserProfile | null> {
    const db = this.getDb();
    if (!db || !userId) return null;

    try {
      const userRef = doc(db, 'users', userId);
      const snapshot = await getDoc(userRef);
      if (snapshot.exists()) {
        return snapshot.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.warn(`[FirestoreSync] Failed to get user ${userId}:`, error);
      return null;
    }
  }

  public static async getAllUsers(): Promise<UserProfile[]> {
    const db = this.getDb();
    if (!db) return [];

    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const users: UserProfile[] = [];
      snapshot.forEach((doc) => {
        users.push({ ...doc.data(), id: doc.id } as UserProfile);
      });
      return users;
    } catch (error) {
      console.warn('[FirestoreSync] Failed to get all users:', error);
      return [];
    }
  }

  public static subscribeToUsers(callback: (users: UserProfile[]) => void): () => void {
    const db = this.getDb();
    if (!db) return () => {};

    const usersRef = collection(db, 'users');
    return onSnapshot(usersRef, (snapshot) => {
      const users: UserProfile[] = [];
      snapshot.forEach((doc) => {
        users.push({ ...doc.data(), id: doc.id } as UserProfile);
      });
      callback(users);
    }, (error) => {
      console.warn('[FirestoreSync] Users listener error:', error);
    });
  }

  public static startUsersListener(callback: (users: UserProfile[]) => void): void {
    const db = this.getDb();
    if (!db) return;

    if (this.usersUnsubscribe) {
      this.usersUnsubscribe();
    }

    const usersRef = collection(db, 'users');
    this.usersUnsubscribe = onSnapshot(usersRef, (snapshot) => {
      const users: UserProfile[] = [];
      snapshot.forEach((doc) => {
        users.push({ ...doc.data(), id: doc.id } as UserProfile);
      });
      callback(users);
    }, (error) => {
      console.warn('[FirestoreSync] Users listener error:', error);
    });
  }

  public static stopUsersListener(): void {
    if (this.usersUnsubscribe) {
      this.usersUnsubscribe();
      this.usersUnsubscribe = null;
    }
  }

  // =========================================================================
  // // 2. LIKES & MATCHES (Interaction state sync)
  // =========================================================================

  public static async saveLikeAction(action: LikeAction): Promise<boolean> {
    return this.registerLikeAction(action);
  }

  public static async registerLikeAction(action: LikeAction): Promise<boolean> {
    const db = this.getDb();
    const fromId = action.fromUserId;
    const toId = action.toUserId;
    if (!db || !fromId || !toId) return false;

    try {
      const actionId = `${fromId}_${toId}`;
      const actionRef = doc(db, 'likes', actionId);
      const cleanData = JSON.parse(JSON.stringify(action));
      cleanData.timestamp = Date.now();
      await setDoc(actionRef, cleanData, { merge: true });
      return true;
    } catch (error) {
      console.warn('[FirestoreSync] Failed to register like action:', error);
      return false;
    }
  }

  public static async checkMatch(userIdA: string, userIdB: string): Promise<boolean> {
    const db = this.getDb();
    if (!db || !userIdA || !userIdB) return false;

    try {
      const forwardId = `${userIdA}_${userIdB}`;
      const backwardId = `${userIdB}_${userIdA}`;
      
      const forwardDoc = await getDoc(doc(db, 'likes', forwardId));
      const backwardDoc = await getDoc(doc(db, 'likes', backwardId));

      if (forwardDoc.exists() && backwardDoc.exists()) {
        return true;
      }
      return false;
    } catch (error) {
      console.warn('[FirestoreSync] Failed to check match:', error);
      return false;
    }
  }

  public static async getUserInventory(userId: string): Promise<UserInventory | null> {
    const db = this.getDb();
    if (!db || !userId) return null;

    try {
      const inventoryRef = doc(db, 'inventories', userId);
      const snapshot = await getDoc(inventoryRef);
      if (snapshot.exists()) {
        return snapshot.data() as UserInventory;
      }
      return null;
    } catch (error) {
      console.warn(`[FirestoreSync] Failed to get inventory for ${userId}:`, error);
      return null;
    }
  }

  public static async saveUserInventory(userId: string, inventory: UserInventory): Promise<boolean> {
    const db = this.getDb();
    if (!db || !userId || !inventory) return false;

    try {
      const inventoryRef = doc(db, 'inventories', userId);
      const cleanData = JSON.parse(JSON.stringify(inventory));
      cleanData.updatedAt = Date.now();
      await setDoc(inventoryRef, cleanData, { merge: true });
      return true;
    } catch (error) {
      console.warn(`[FirestoreSync] Failed to save inventory for ${userId}:`, error);
      return false;
    }
  }

  // =========================================================================
  // // 3. ADMIN MANAGEMENT & SECURITY LOGS
  // =========================================================================

  public static async getAdminAccount(adminId: string): Promise<AdminAccount | null> {
    const db = this.getDb();
    if (!db || !adminId) return null;

    try {
      const adminRef = doc(db, 'admins', adminId);
      const snapshot = await getDoc(adminRef);
      if (snapshot.exists()) {
        return snapshot.data() as AdminAccount;
      }
      return null;
    } catch (error) {
      console.warn(`[FirestoreSync] Failed to get admin account ${adminId}:`, error);
      return null;
    }
  }

  public static async getAllAdminAccounts(): Promise<AdminAccount[]> {
    const db = this.getDb();
    if (!db) return [];

    try {
      const adminsRef = collection(db, 'admins');
      const snapshot = await getDocs(adminsRef);
      const admins: AdminAccount[] = [];
      snapshot.forEach((d) => {
        admins.push({ ...d.data(), id: d.id } as AdminAccount);
      });
      return admins;
    } catch (error) {
      console.warn('[FirestoreSync] Failed to get all admin accounts:', error);
      return [];
    }
  }

  public static async deleteAdminAccount(adminId: string): Promise<boolean> {
    const db = this.getDb();
    if (!db || !adminId) return false;
    try {
      await deleteDoc(doc(db, 'admins', adminId));
      return true;
    } catch (error) {
      console.warn(`[FirestoreSync] Failed to delete admin account ${adminId}:`, error);
      return false;
    }
  }

  public static async saveAdminAccount(admin: AdminAccount): Promise<boolean> {
    const db = this.getDb();
    if (!db || !admin || !admin.id) return false;

    try {
      const adminRef = doc(db, 'admins', admin.id);
      const cleanData = JSON.parse(JSON.stringify(admin));
      cleanData.updatedAt = Date.now();
      await setDoc(adminRef, cleanData, { merge: true });
      return true;
    } catch (error) {
      console.warn(`[FirestoreSync] Failed to save admin account ${admin.id}:`, error);
      return false;
    }
  }

  public static subscribeToAdminAccounts(callback: (admins: AdminAccount[]) => void): () => void {
    const db = this.getDb();
    if (!db) return () => {};

    const adminsRef = collection(db, 'admins');
    return onSnapshot(adminsRef, (snapshot) => {
      const admins: AdminAccount[] = [];
      snapshot.forEach((d) => {
        admins.push({ ...d.data(), id: d.id } as AdminAccount);
      });
      callback(admins);
    }, (error) => {
      console.warn('[FirestoreSync] Admins listener error:', error);
    });
  }

  public static startAdminListener(callback: (admins: AdminAccount[]) => void): void {
    const db = this.getDb();
    if (!db) return;

    if (this.adminUnsubscribe) {
      this.adminUnsubscribe();
    }

    const adminsRef = collection(db, 'admins');
    this.adminUnsubscribe = onSnapshot(adminsRef, (snapshot) => {
      const admins: AdminAccount[] = [];
      snapshot.forEach((doc) => {
        admins.push({ ...doc.data(), id: doc.id } as AdminAccount);
      });
      callback(admins);
    }, (error) => {
      console.warn('[FirestoreSync] Admins listener error:', error);
    });
  }

  public static stopAdminListener(): void {
    if (this.adminUnsubscribe) {
      this.adminUnsubscribe();
      this.adminUnsubscribe = null;
    }
  }

  public static async saveAdminLog(entry: AdminLogEntry): Promise<boolean> {
    return this.logAdminActivity(entry);
  }

  public static async logAdminActivity(entry: AdminLogEntry): Promise<boolean> {
    const db = this.getDb();
    if (!db || !entry) return false;

    try {
      const logId = entry.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const logRef = doc(db, 'admin_logs', logId);
      const cleanData = JSON.parse(JSON.stringify(entry));
      cleanData.timestamp = Date.now();
      await setDoc(logRef, cleanData);
      return true;
    } catch (error) {
      console.warn('[FirestoreSync] Failed to log admin activity:', error);
      return false;
    }
  }

  public static startLogsListener(callback: (logs: AdminLogEntry[]) => void): void {
    const db = this.getDb();
    if (!db) return;

    if (this.logsUnsubscribe) {
      this.logsUnsubscribe();
    }

    const logsRef = collection(db, 'admin_logs');
    this.logsUnsubscribe = onSnapshot(logsRef, (snapshot) => {
      const logs: AdminLogEntry[] = [];
      snapshot.forEach((doc) => {
        logs.push({ ...doc.data(), id: doc.id } as AdminLogEntry);
      });
      // 최신 로그가 위로 오도록 시간 역순 정렬
      logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      callback(logs);
    }, (error) => {
      console.warn('[FirestoreSync] Logs listener error:', error);
    });
  }

  public static stopLogsListener(): void {
    if (this.logsUnsubscribe) {
      this.logsUnsubscribe();
      this.logsUnsubscribe = null;
    }
  }

  // =========================================================================
  // // 4. BULLETIN BOARD & SYSTEM NOTICES
  // =========================================================================

  public static async saveBoardPost(post: AdminBoardPost): Promise<boolean> {
    const db = this.getDb();
    if (!db || !post) return false;

    try {
      const postId = post.id || `post_${Date.now()}`;
      const postRef = doc(db, 'board_posts', postId);
      const cleanData = JSON.parse(JSON.stringify(post));
      cleanData.id = postId;
      cleanData.updatedAt = Date.now();
      if (!cleanData.createdAt) cleanData.createdAt = Date.now();
      
      await setDoc(postRef, cleanData, { merge: true });
      return true;
    } catch (error) {
      console.warn('[FirestoreSync] Failed to save board post:', error);
      return false;
    }
  }

  public static async deleteBoardPost(postId: string): Promise<boolean> {
    const db = this.getDb();
    if (!db || !postId) return false;

    try {
      await deleteDoc(doc(db, 'board_posts', postId));
      return true;
    } catch (error) {
      console.warn(`[FirestoreSync] Failed to delete board post ${postId}:`, error);
      return false;
    }
  }

  public static subscribeToBoardPosts(callback: (posts: AdminBoardPost[]) => void): () => void {
    const db = this.getDb();
    if (!db) return () => {};

    const boardRef = collection(db, 'board_posts');
    return onSnapshot(boardRef, (snapshot) => {
      const posts: AdminBoardPost[] = [];
      snapshot.forEach((d) => {
        posts.push({ ...d.data(), id: d.id } as AdminBoardPost);
      });
      posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(posts);
    }, (error) => {
      console.warn('[FirestoreSync] Board listener error:', error);
    });
  }

  public static startBoardListener(callback: (posts: AdminBoardPost[]) => void): void {
    const db = this.getDb();
    if (!db) return;

    if (this.boardUnsubscribe) {
      this.boardUnsubscribe();
    }

    const boardRef = collection(db, 'board_posts');
    this.boardUnsubscribe = onSnapshot(boardRef, (snapshot) => {
      const posts: AdminBoardPost[] = [];
      snapshot.forEach((doc) => {
        posts.push({ ...doc.data(), id: doc.id } as AdminBoardPost);
      });
      // 최신 공지가 상단에 오도록 정렬
      posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(posts);
    }, (error) => {
      console.warn('[FirestoreSync] Board listener error:', error);
    });
  }

  public static stopBoardListener(): void {
    if (this.boardUnsubscribe) {
      this.boardUnsubscribe();
      this.boardUnsubscribe = null;
    }
  }

  // =========================================================================
  // 6. REPORTS & MODERATION (Real-time user reports to Cloud Firestore)
  // =========================================================================

  public static async saveReport(report: UserReport): Promise<boolean> {
    const db = this.getDb();
    if (!db || !report || !report.id) return false;

    try {
      const reportRef = doc(db, 'reports', report.id);
      const cleanData = JSON.parse(JSON.stringify(report));
      cleanData.updatedAt = Date.now();
      await setDoc(reportRef, cleanData, { merge: true });
      return true;
    } catch (error) {
      console.warn(`[FirestoreSync] Failed to save report ${report.id}:`, error);
      return false;
    }
  }

  public static async getAllReports(): Promise<UserReport[]> {
    const db = this.getDb();
    if (!db) return [];

    try {
      const reportsRef = collection(db, 'reports');
      const snapshot = await getDocs(reportsRef);
      const reports: UserReport[] = [];
      snapshot.forEach((d) => {
        reports.push({ ...d.data(), id: d.id } as UserReport);
      });
      reports.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return reports;
    } catch (error) {
      console.warn('[FirestoreSync] Failed to get all reports:', error);
      return [];
    }
  }

  public static subscribeToReports(callback: (reports: UserReport[]) => void): () => void {
    const db = this.getDb();
    if (!db) return () => {};

    const reportsRef = collection(db, 'reports');
    return onSnapshot(reportsRef, (snapshot) => {
      const reports: UserReport[] = [];
      snapshot.forEach((d) => {
        reports.push({ ...d.data(), id: d.id } as UserReport);
      });
      reports.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      callback(reports);
    }, (error) => {
      console.warn('[FirestoreSync] Reports listener error:', error);
    });
  }
}

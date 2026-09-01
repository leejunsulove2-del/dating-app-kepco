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
import { UserProfile, AdminAccount, AdminLogEntry, AdminBoardPost, LikeAction, UserInventory } from '../types';

export class FirestoreSyncService {
  private static userUnsubscribe: Unsubscribe | null = null;
  private static adminUnsubscribe: Unsubscribe | null = null;
  private static boardUnsubscribe: Unsubscribe | null = null;
  private static logsUnsubscribe: Unsubscribe | null = null;

  /**
   * Helper to obtain active Firestore instance
   */
  public static getDb() {
    const { db } = initFirebaseApp();
    return db;
  }

  // =========================================================================
  // 1. USERS COLLECTION (Real-time multi-device sync)
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
      const usersCol = collection(db, 'users');
      const snapshot = await getDocs(usersCol);
      const users: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.exists()) {
          users.push(docSnap.data() as UserProfile);
        }
      });
      return users;
    } catch (error) {
      console.warn('[FirestoreSync] Failed to fetch all users:', error);
      return [];
    }
  }

  public static subscribeToUsers(callback: (users: UserProfile[]) => void): Unsubscribe | null {
    const db = this.getDb();
    if (!db) return null;

    try {
      if (this.userUnsubscribe) {
        this.userUnsubscribe();
      }

      const usersCol = collection(db, 'users');
      this.userUnsubscribe = onSnapshot(
        usersCol,
        (snapshot) => {
          const users: UserProfile[] = [];
          snapshot.forEach((docSnap) => {
            if (docSnap.exists()) {
              users.push(docSnap.data() as UserProfile);
            }
          });
          callback(users);
        },
        (error) => {
          console.warn('[FirestoreSync] Users subscription error:', error);
        }
      );
      return this.userUnsubscribe;
    } catch (error) {
      console.warn('[FirestoreSync] subscribeToUsers failed to attach:', error);
      return null;
    }
  }

  public static async deleteUser(userId: string): Promise<boolean> {
    const db = this.getDb();
    if (!db || !userId) return false;

    try {
      const userRef = doc(db, 'users', userId);
      await deleteDoc(userRef);
      return true;
    } catch (error) {
      console.warn(`[FirestoreSync] Failed to delete user ${userId}:`, error);
      return false;
    }
  }

  // =========================================================================
  // 2. ADMIN ACCOUNTS (Master & Agency Admins)
  // =========================================================================

  public static async saveAdminAccount(admin: AdminAccount): Promise<boolean> {
    const db = this.getDb();
    if (!db || !admin || !admin.id) return false;

    try {
      const adminRef = doc(db, 'admin_accounts', admin.id);
      const cleanData = JSON.parse(JSON.stringify(admin));
      cleanData.updatedAt = Date.now();
      await setDoc(adminRef, cleanData, { merge: true });
      return true;
    } catch (error) {
      console.warn(`[FirestoreSync] Failed to save admin account ${admin.id}:`, error);
      return false;
    }
  }

  public static async getAllAdminAccounts(): Promise<AdminAccount[]> {
    const db = this.getDb();
    if (!db) return [];

    try {
      const col = collection(db, 'admin_accounts');
      const snapshot = await getDocs(col);
      const admins: AdminAccount[] = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.exists()) {
          admins.push(docSnap.data() as AdminAccount);
        }
      });
      return admins;
    } catch (error) {
      console.warn('[FirestoreSync] Failed to fetch admin accounts:', error);
      return [];
    }
  }

  public static subscribeToAdminAccounts(callback: (admins: AdminAccount[]) => void): Unsubscribe | null {
    const db = this.getDb();
    if (!db) return null;

    try {
      if (this.adminUnsubscribe) {
        this.adminUnsubscribe();
      }

      const col = collection(db, 'admin_accounts');
      this.adminUnsubscribe = onSnapshot(
        col,
        (snapshot) => {
          const admins: AdminAccount[] = [];
          snapshot.forEach((docSnap) => {
            if (docSnap.exists()) {
              admins.push(docSnap.data() as AdminAccount);
            }
          });
          callback(admins);
        },
        (error) => {
          console.warn('[FirestoreSync] Admin subscription error:', error);
        }
      );
      return this.adminUnsubscribe;
    } catch (error) {
      console.warn('[FirestoreSync] subscribeToAdminAccounts failed:', error);
      return null;
    }
  }

  public static async deleteAdminAccount(adminId: string): Promise<boolean> {
    const db = this.getDb();
    if (!db || !adminId) return false;

    try {
      const ref = doc(db, 'admin_accounts', adminId);
      await deleteDoc(ref);
      return true;
    } catch (error) {
      console.warn(`[FirestoreSync] Failed to delete admin account ${adminId}:`, error);
      return false;
    }
  }

  // =========================================================================
  // 3. ADMIN COMMUNICATION BOARD
  // =========================================================================

  public static async saveBoardPost(post: AdminBoardPost): Promise<boolean> {
    const db = this.getDb();
    if (!db || !post || !post.id) return false;

    try {
      const postRef = doc(db, 'admin_board', post.id);
      const cleanData = JSON.parse(JSON.stringify(post));
      await setDoc(postRef, cleanData, { merge: true });
      return true;
    } catch (error) {
      console.warn(`[FirestoreSync] Failed to save board post:`, error);
      return false;
    }
  }

  public static subscribeToBoardPosts(callback: (posts: AdminBoardPost[]) => void): Unsubscribe | null {
    const db = this.getDb();
    if (!db) return null;

    try {
      if (this.boardUnsubscribe) {
        this.boardUnsubscribe();
      }

      const col = collection(db, 'admin_board');
      this.boardUnsubscribe = onSnapshot(
        col,
        (snapshot) => {
          const posts: AdminBoardPost[] = [];
          snapshot.forEach((docSnap) => {
            if (docSnap.exists()) {
              posts.push(docSnap.data() as AdminBoardPost);
            }
          });
          callback(posts.sort((a, b) => b.createdAt - a.createdAt));
        },
        (error) => {
          console.warn('[FirestoreSync] Board subscription error:', error);
        }
      );
      return this.boardUnsubscribe;
    } catch (error) {
      console.warn('[FirestoreSync] subscribeToBoardPosts failed:', error);
      return null;
    }
  }

  // =========================================================================
  // 4. ADMIN AUDIT LOGS
  // =========================================================================

  public static async saveAdminLog(log: AdminLogEntry): Promise<boolean> {
    const db = this.getDb();
    if (!db || !log || !log.id) return false;

    try {
      const logRef = doc(db, 'admin_logs', log.id);
      const cleanData = JSON.parse(JSON.stringify(log));
      await setDoc(logRef, cleanData, { merge: true });
      return true;
    } catch (error) {
      console.warn(`[FirestoreSync] Failed to save admin log:`, error);
      return false;
    }
  }

  public static subscribeToAdminLogs(callback: (logs: AdminLogEntry[]) => void): Unsubscribe | null {
    const db = this.getDb();
    if (!db) return null;

    try {
      if (this.logsUnsubscribe) {
        this.logsUnsubscribe();
      }

      const col = collection(db, 'admin_logs');
      this.logsUnsubscribe = onSnapshot(
        col,
        (snapshot) => {
          const logs: AdminLogEntry[] = [];
          snapshot.forEach((docSnap) => {
            if (docSnap.exists()) {
              logs.push(docSnap.data() as AdminLogEntry);
            }
          });
          callback(logs.sort((a, b) => b.timestamp - a.timestamp));
        },
        (error) => {
          console.warn('[FirestoreSync] Logs subscription error:', error);
        }
      );
      return this.logsUnsubscribe;
    } catch (error) {
      console.warn('[FirestoreSync] subscribeToAdminLogs failed:', error);
      return null;
    }
  }

  // =========================================================================
  // 5. USER INVENTORY
  // =========================================================================

  public static async saveUserInventory(userId: string, inventory: UserInventory): Promise<boolean> {
    const db = this.getDb();
    if (!db || !userId) return false;

    try {
      const invRef = doc(db, 'user_inventories', userId);
      await setDoc(invRef, inventory, { merge: true });
      return true;
    } catch (error) {
      console.warn(`[FirestoreSync] Failed to save inventory for ${userId}:`, error);
      return false;
    }
  }

  public static async getUserInventory(userId: string): Promise<UserInventory | null> {
    const db = this.getDb();
    if (!db || !userId) return null;

    try {
      const invRef = doc(db, 'user_inventories', userId);
      const snapshot = await getDoc(invRef);
      if (snapshot.exists()) {
        return snapshot.data() as UserInventory;
      }
      return null;
    } catch (error) {
      console.warn(`[FirestoreSync] Failed to get inventory for ${userId}:`, error);
      return null;
    }
  }

  // =========================================================================
  // 6. LIKES & MATCHES
  // =========================================================================

  public static async saveLikeAction(like: LikeAction): Promise<boolean> {
    const db = this.getDb();
    if (!db || !like || !like.id) return false;

    try {
      const likeRef = doc(db, 'likes', like.id);
      await setDoc(likeRef, like, { merge: true });
      return true;
    } catch (error) {
      console.warn('[FirestoreSync] Failed to save like action:', error);
      return false;
    }
  }

  public static async getAllLikes(): Promise<LikeAction[]> {
    const db = this.getDb();
    if (!db) return [];

    try {
      const likesCol = collection(db, 'likes');
      const snapshot = await getDocs(likesCol);
      const likes: LikeAction[] = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.exists()) {
          likes.push(docSnap.data() as LikeAction);
        }
      });
      return likes;
    } catch (error) {
      console.warn('[FirestoreSync] Failed to get likes:', error);
      return [];
    }
  }

  /**
   * Batch seed initial users to Firestore
   */
  public static async seedUsersToFirestore(users: UserProfile[]): Promise<void> {
    const db = this.getDb();
    if (!db || users.length === 0) return;

    try {
      const batch = writeBatch(db);
      for (const user of users) {
        if (user && user.id) {
          const ref = doc(db, 'users', user.id);
          const clean = JSON.parse(JSON.stringify(user));
          clean.updatedAt = Date.now();
          batch.set(ref, clean, { merge: true });
        }
      }
      await batch.commit();
      console.log(`[FirestoreSync] Successfully seeded ${users.length} users to Cloud Firestore`);
    } catch (error) {
      console.warn('[FirestoreSync] Batch seed failed:', error);
    }
  }
}

import { UserProfile, AdminAccount, AdminBoardPost, AdminLogEntry, LikeAction, UserInventory } from '../types';
import { FirestoreSyncService } from './firestoreSyncService';
import { isFirebaseConfigured, getStoredFirebaseConfig, saveCustomFirebaseConfig, FirebaseProjectConfig } from './firebaseConfig';

export class ApiSyncService {
  private static isSyncing = false;
  private static lastSyncTimestamp = 0;

  /**
   * Check if server API is available
   */
  public static async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch('/api/health');
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Pull complete state from Server and/or Firestore
   */
  public static async fetchAllData(): Promise<{
    users?: UserProfile[];
    adminAccounts?: AdminAccount[];
    adminBoard?: AdminBoardPost[];
    adminLogs?: AdminLogEntry[];
    userInventories?: Record<string, UserInventory>;
    likes?: LikeAction[];
    userPasswords?: Record<string, string>;
    firebaseConfig?: FirebaseProjectConfig | null;
  } | null> {
    try {
      const res = await fetch('/api/sync/all');
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn('[ApiSync] Server fetchAllData fallback to Firestore/Local:', e);
    }
    return null;
  }

  // =========================================================================
  // USER SYNC & REGISTRATION
  // =========================================================================

  public static async fetchUsers(): Promise<UserProfile[]> {
    try {
      const res = await fetch('/api/sync/users');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return [];
  }

  public static async fetchPasswords(): Promise<Record<string, string>> {
    try {
      const res = await fetch('/api/sync/passwords');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return {};
  }

  public static async checkUser(email: string): Promise<{
    exists: boolean;
    user?: UserProfile;
    approvalStatus?: string;
    hasPassword?: boolean;
  }> {
    try {
      const res = await fetch('/api/auth/check-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return { exists: false };
  }

  public static async registerUser(user: UserProfile, passwordPlain: string): Promise<boolean> {
    try {
      const res = await fetch('/api/sync/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, passwordPlain }),
      });
      if (res.ok) {
        return true;
      }
    } catch (e) {
      console.warn('[ApiSync] registerUser server failed:', e);
    }
    return false;
  }

  public static async approveUser(userId: string, adminEmail: string, adminName: string): Promise<boolean> {
    try {
      const res = await fetch('/api/sync/approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, adminEmail, adminName }),
      });
      if (res.ok) {
        return true;
      }
    } catch (e) {
      console.warn('[ApiSync] approveUser server failed:', e);
    }
    return false;
  }

  public static async rejectUser(userId: string, reason: string, adminName: string): Promise<boolean> {
    try {
      const res = await fetch('/api/sync/reject-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reason, adminName }),
      });
      if (res.ok) {
        return true;
      }
    } catch (e) {
      console.warn('[ApiSync] rejectUser server failed:', e);
    }
    return false;
  }

  public static async syncUsers(users: UserProfile[]): Promise<void> {
    // 1. Send to server
    try {
      await fetch('/api/sync/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users }),
      });
    } catch (e) {
      // server offline fallback
    }

    // 2. Send to Cloud Firestore
    if (isFirebaseConfigured()) {
      FirestoreSyncService.seedUsersToFirestore(users).catch(() => {});
    }
  }

  public static async saveUser(user: UserProfile): Promise<void> {
    // 1. Send to server
    try {
      await fetch('/api/sync/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
    } catch (e) {
      // fallback
    }

    // 2. Send to Firestore
    FirestoreSyncService.saveUser(user).catch(() => {});
  }

  public static async deleteUser(userId: string): Promise<void> {
    try {
      await fetch(`/api/sync/user/${userId}`, { method: 'DELETE' });
    } catch (e) {}
    FirestoreSyncService.deleteUser(userId).catch(() => {});
  }

  // =========================================================================
  // ADMIN ACCOUNTS SYNC
  // =========================================================================

  public static async syncAdminAccounts(adminAccounts: AdminAccount[]): Promise<void> {
    try {
      await fetch('/api/sync/admin-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminAccounts }),
      });
    } catch (e) {}

    adminAccounts.forEach((admin) => {
      FirestoreSyncService.saveAdminAccount(admin).catch(() => {});
    });
  }

  public static async saveAdminAccount(admin: AdminAccount): Promise<void> {
    try {
      await fetch('/api/sync/admin-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(admin),
      });
    } catch (e) {}

    FirestoreSyncService.saveAdminAccount(admin).catch(() => {});
  }

  public static async deleteAdminAccount(adminId: string): Promise<void> {
    try {
      await fetch(`/api/sync/admin-account/${adminId}`, { method: 'DELETE' });
    } catch (e) {}
    FirestoreSyncService.deleteAdminAccount(adminId).catch(() => {});
  }

  // =========================================================================
  // BOARD & LOGS
  // =========================================================================

  public static async saveBoardPost(post: AdminBoardPost): Promise<void> {
    try {
      await fetch('/api/sync/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post),
      });
    } catch (e) {}

    FirestoreSyncService.saveBoardPost(post).catch(() => {});
  }

  public static async saveAdminLog(log: AdminLogEntry): Promise<void> {
    try {
      await fetch('/api/sync/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      });
    } catch (e) {}

    FirestoreSyncService.saveAdminLog(log).catch(() => {});
  }

  // =========================================================================
  // INVENTORY & LIKES
  // =========================================================================

  public static async saveInventory(userId: string, inventory: UserInventory): Promise<void> {
    try {
      await fetch(`/api/sync/inventory/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inventory),
      });
    } catch (e) {}

    FirestoreSyncService.saveUserInventory(userId, inventory).catch(() => {});
  }

  public static async saveLike(like: LikeAction): Promise<void> {
    try {
      await fetch('/api/sync/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(like),
      });
    } catch (e) {}

    FirestoreSyncService.saveLikeAction(like).catch(() => {});
  }

  // =========================================================================
  // FIREBASE CONFIG SYNC
  // =========================================================================

  public static async getFirebaseConfig(): Promise<{
    config: FirebaseProjectConfig | null;
    envConfig: any;
  } | null> {
    try {
      const res = await fetch('/api/sync/firebase-config');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return null;
  }

  public static async saveFirebaseConfig(config: FirebaseProjectConfig): Promise<void> {
    saveCustomFirebaseConfig(config);
    try {
      await fetch('/api/sync/firebase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
    } catch (e) {}
  }
}

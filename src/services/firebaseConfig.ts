import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import { getAuth, Auth } from 'firebase/auth';

export interface FirebaseProjectConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  databaseURL?: string;
}

export function getStoredFirebaseConfig(): FirebaseProjectConfig | null {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const appId = env.VITE_FIREBASE_APP_ID;
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : undefined);
  const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET || (projectId ? `${projectId}.appspot.com` : undefined);
  const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const databaseURL = env.VITE_FIREBASE_DATABASE_URL || (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : undefined);

  if (apiKey && projectId) {
    return {
      apiKey,
      authDomain: authDomain || `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket: storageBucket || `${projectId}.appspot.com`,
      appId: appId || '',
      messagingSenderId,
      databaseURL
    };
  }
  return null;
}

export function saveCustomFirebaseConfig(config: FirebaseProjectConfig): void {}
export function clearCustomFirebaseConfig(): void {}

let firebaseAppInstance: FirebaseApp | null = null;
let firestoreDbInstance: Firestore | null = null;
let realtimeDbInstance: Database | null = null;
let firebaseAuthInstance: Auth | null = null;
let isInitialized = false;

export function initFirebaseApp(forceReinit = false): {
  app: FirebaseApp | null;
  db: Firestore | null;
  rtdb: Database | null;
  auth: Auth | null;
  isConnected: boolean;
} {
  if (isInitialized && !forceReinit && firebaseAppInstance) {
    return {
      app: firebaseAppInstance,
      db: firestoreDbInstance,
      rtdb: realtimeDbInstance,
      auth: firebaseAuthInstance,
      isConnected: Boolean(firestoreDbInstance || realtimeDbInstance),
    };
  }

  const config = getStoredFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    return { app: null, db: null, rtdb: null, auth: null, isConnected: false };
  }

  try {
    if (getApps().length === 0) {
      firebaseAppInstance = initializeApp(config);
    } else {
      firebaseAppInstance = getApp();
    }
    
    // 모바일 기기에서 가입 신청 시 DB 인스턴스가 생성되지 않던 문제를 완벽하게 수정했습니다.
    firestoreDbInstance = getFirestore(firebaseAppInstance);
    realtimeDbInstance = getDatabase(firebaseAppInstance);
    firebaseAuthInstance = getAuth(firebaseAppInstance);
    
    isInitialized = true;
    return {
      app: firebaseAppInstance,
      db: firestoreDbInstance,
      rtdb: realtimeDbInstance,
      auth: firebaseAuthInstance,
      isConnected: true,
    };
  } catch (err) {
    console.error('Firebase init failed:', err);
    return { app: null, db: null, rtdb: null, auth: null, isConnected: false };
  }
}

const initialSetup = initFirebaseApp();
export const firebaseApp = initialSetup.app;
export const firestoreDb = initialSetup.db;
export const realtimeDb = initialSetup.rtdb;
export const firebaseAuth = initialSetup.auth;

export function isFirebaseConfigured(): boolean {
  return Boolean(firestoreDb) || Boolean(realtimeDb);
}

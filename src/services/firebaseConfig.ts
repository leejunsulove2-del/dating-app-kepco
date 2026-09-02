import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
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

// 깃허브 배포 시 주입되는 실제 환경 변수 로드
const env = (import.meta as any).env || {};

export function getStoredFirebaseConfig(): FirebaseProjectConfig | null {
  // 빌드 타임에 주입된 진짜 파이어베이스 키가 존재하면 이를 최우선으로 사용합니다.
  if (env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID) {
    const projectId = env.VITE_FIREBASE_PROJECT_ID;
    return {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: `${projectId}.firebaseapp.com`,
      projectId: projectId,
      storageBucket: `${projectId}.appspot.com`,
      appId: env.VITE_FIREBASE_APP_ID || '',
      databaseURL: `https://${projectId}://firebaseio.com`
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
      isConnected: Boolean(firestoreDbInstance),
    };
  }

  const config = getStoredFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    return {
      app: null,
      db: null,
      rtdb: null,
      auth: null,
      isConnected: false,
    };
  }

  try {
    if (getApps().length === 0) {
      firebaseAppInstance = initializeApp(config);
    } else {
      firebaseAppInstance = getApp();
    }

    firestoreDbInstance = getFirestore(firebaseAppInstance);
    
    // 오프라인 캐시 지속성 유지 (실패해도 정상 작동하도록 보완)
    try {
      if (typeof window !== 'undefined') {
        enableIndexedDbPersistence(firestoreDbInstance).catch(() => {});
      }
    } catch {}

    try {
      realtimeDbInstance = getDatabase(firebaseAppInstance);
    } catch {}

    try {
      firebaseAuthInstance = getAuth(firebaseAppInstance);
      firebaseAuthInstance.languageCode = 'ko';
    } catch {}

    isInitialized = true;
    return {
      app: firebaseAppInstance,
      db: firestoreDbInstance,
      rtdb: realtimeDbInstance,
      auth: firebaseAuthInstance,
      isConnected: true,
    };
  } catch (err) {
    console.error('Firebase initialization failed:', err);
    return {
      app: null,
      db: null,
      rtdb: null,
      auth: null,
      isConnected: false,
    };
  }
}

// 초기 부트스트랩 시도
const initialSetup = initFirebaseApp();
export const firebaseApp = initialSetup.app;
export const firestoreDb = initialSetup.db;
export const realtimeDb = initialSetup.rtdb;
export const firebaseAuth = initialSetup.auth;

export function isFirebaseConfigured(): boolean {
  return Boolean(firestoreDb);
}

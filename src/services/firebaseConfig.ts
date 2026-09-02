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
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;

  if (apiKey && projectId) {
    return {
      apiKey: apiKey,
      authDomain: `${projectId}.firebaseapp.com`,
      projectId: projectId,
      storageBucket: `${projectId}.appspot.com`,
      appId: appId || '',
      // 가입 요청 데이터가 쌓이는 리얼타임 DB 연결 주소 오타를 올바르게 수정했습니다.
      databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`
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

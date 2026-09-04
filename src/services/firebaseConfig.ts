// [FILE LOCATION]: src/services/firebaseConfig.ts
// [ROLE]: Vite 클라이언트 환경변수(import.meta.env.VITE_FIREBASE_...) 로드 및 Firebase 안전 초기화 모듈

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
  measurementId?: string;
}

const CUSTOM_CONFIG_KEY = 'love_app_firebase_custom_config';

/**
 * 환경변수 또는 사용자 지정 Firebase 구성을 불러오고 안전하게 보정(Normalize)합니다.
 */
export function getStoredFirebaseConfig(): FirebaseProjectConfig | null {
  // 1. 관리자 패널 등에서 직접 저장한 커스텀 설정이 있을 경우 우선 확인
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(CUSTOM_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.apiKey || parsed.projectId || parsed.databaseURL)) {
          return normalizeFirebaseConfig(parsed);
        }
      }
    }
  } catch (e) {
    console.warn('[FirebaseConfig] 커스텀 설정 파싱 실패:', e);
  }

  // 2. Vite 클라이언트 환경변수 (import.meta.env.VITE_FIREBASE_...) 로드
  const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
  const apiKey = env.VITE_FIREBASE_API_KEY || '';
  const projectId = env.VITE_FIREBASE_PROJECT_ID || 'dating-app-kepco';
  const appId = env.VITE_FIREBASE_APP_ID || '';
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN;
  const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const databaseURL = env.VITE_FIREBASE_DATABASE_URL;
  const measurementId = env.VITE_FIREBASE_MEASUREMENT_ID;

  if (apiKey || projectId || databaseURL) {
    return normalizeFirebaseConfig({
      apiKey,
      authDomain: authDomain || `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket: storageBucket || `${projectId}.appspot.com`,
      appId: appId || '1:420973603361:web:dc059dfc3ad10fd8bf1160',
      messagingSenderId: messagingSenderId || '420973603361',
      databaseURL,
      measurementId,
    });
  }

  return null;
}

/**
 * 싱가포르(asia-southeast1) RTDB 및 축약/결손 도메인 안전 자동 보정
 */
export function normalizeFirebaseConfig(raw: Partial<FirebaseProjectConfig>): FirebaseProjectConfig {
  const projectId = (raw.projectId || 'dating-app-kepco').trim();
  let authDomain = (raw.authDomain || '').trim();
  let storageBucket = (raw.storageBucket || '').trim();
  let databaseURL = (raw.databaseURL || '').trim().replace(/\/$/, '');

  // authDomain 보정 ("://firebaseapp.com" 등 결손 입력 시)
  if (!authDomain || authDomain === '://firebaseapp.com' || !authDomain.includes('.')) {
    authDomain = `${projectId}.firebaseapp.com`;
  }

  // storageBucket 보정 ("://appspot.com" 등 결손 입력 시)
  if (!storageBucket || storageBucket === '://appspot.com' || !storageBucket.includes('.')) {
    storageBucket = `${projectId}.appspot.com`;
  }

  // databaseURL 보정 (싱가포르 리전 RTDB 기본 주소)
  if (
    !databaseURL ||
    databaseURL === 'https://firebasedatabase.app' ||
    databaseURL === 'http://firebasedatabase.app' ||
    databaseURL === '://firebasedatabase.app'
  ) {
    // 싱가포르(asia-southeast1) 리전의 표준 RTDB 인스턴스 주소 형식
    databaseURL = `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`;
  }

  return {
    apiKey: raw.apiKey || '',
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId: raw.messagingSenderId || '420973603361',
    appId: raw.appId || '1:420973603361:web:dc059dfc3ad10fd8bf1160',
    databaseURL,
    measurementId: raw.measurementId || 'G-2CJB9ZRMRN',
  };
}

export function saveCustomFirebaseConfig(config: FirebaseProjectConfig): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CUSTOM_CONFIG_KEY, JSON.stringify(config));
    }
  } catch (e) {
    console.warn('[FirebaseConfig] 커스텀 설정 저장 오류:', e);
  }
  initFirebaseApp(true);
}

export function clearCustomFirebaseConfig(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CUSTOM_CONFIG_KEY);
    }
  } catch (e) {
    console.warn('[FirebaseConfig] 커스텀 설정 삭제 오류:', e);
  }
}

let firebaseAppInstance: FirebaseApp | null = null;
let firestoreDbInstance: Firestore | null = null;
let realtimeDbInstance: Database | null = null;
let firebaseAuthInstance: Auth | null = null;
let isInitialized = false;

/**
 * 안전한 Firebase 초기화 함수 (initializeApp)
 * - 유효한 apiKey 및 projectId가 있을 때만 SDK 인스턴스를 생성하여 콘솔 오류를 방지합니다.
 * - apiKey가 없더라도 순수 REST API(HTTP fetch) 모드로 동작할 수 있도록 안전하게 인스턴스를 관리합니다.
 */
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
  if (!config || !config.projectId) {
    return { app: null, db: null, rtdb: null, auth: null, isConnected: false };
  }

  // apiKey가 비어있거나 플레이스홀더인 경우 SDK 초기화는 건너뛰고 REST 통신 모드로 유지
  if (!config.apiKey || config.apiKey.startsWith('YOUR_') || config.apiKey === 'SPARK_REST_MODE') {
    console.info('[FirebaseConfig] ⚡ RTDB REST API 모드로 안전 통신 준비 완료 (웹소켓 0개 유지)');
    return { app: null, db: null, rtdb: null, auth: null, isConnected: true };
  }

  try {
    if (getApps().length === 0) {
      firebaseAppInstance = initializeApp(config);
    } else {
      firebaseAppInstance = getApp();
    }

    firestoreDbInstance = getFirestore(firebaseAppInstance);
    realtimeDbInstance = getDatabase(firebaseAppInstance);
    firebaseAuthInstance = getAuth(firebaseAppInstance);

    isInitialized = true;
    console.log('[FirebaseConfig] 🔥 Firebase SDK 및 RTDB 인스턴스 초기화 성공:', config.projectId);
    return {
      app: firebaseAppInstance,
      db: firestoreDbInstance,
      rtdb: realtimeDbInstance,
      auth: firebaseAuthInstance,
      isConnected: true,
    };
  } catch (err) {
    console.warn('[FirebaseConfig] Firebase SDK 초기화 경고 (REST 전송은 정상 지속됩니다):', err);
    return { app: null, db: null, rtdb: null, auth: null, isConnected: false };
  }
}

const initialSetup = initFirebaseApp();
export const firebaseApp = initialSetup.app;
export const firestoreDb = initialSetup.db;
export const realtimeDb = initialSetup.rtdb;
export const firebaseAuth = initialSetup.auth;

export function isFirebaseConfigured(): boolean {
  const config = getStoredFirebaseConfig();
  return Boolean(config?.databaseURL || config?.projectId);
}

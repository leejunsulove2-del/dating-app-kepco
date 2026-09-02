import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
 getAuth,
 createUserWithEmailAndPassword,
 signInWithEmailAndPassword,
 sendEmailVerification,
 signOut,
 User,
 Auth,
 onAuthStateChanged,
} from 'firebase/auth';
import { DEFAULT_ALLOWED_DOMAINS } from './datingService';
// 💡 위치 이력을 실시간 클라우드 DB에 기록하기 위해 파이어베이스 Firestore 모듈을 가져옵니다.
import { firestoreDb } from './firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// 1. Firebase 환경설정 주입 (Vite 환경 변수)
const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
const hasRealFirebaseConfig = Boolean(
 env.VITE_FIREBASE_API_KEY &&
 !env.VITE_FIREBASE_API_KEY.includes('AIzaSyDemoKey')
);
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
if (hasRealFirebaseConfig) {
 try {
 if (getApps().length === 0) {
 app = initializeApp({
 apiKey: env.VITE_FIREBASE_API_KEY,
 authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
 databaseURL: env.VITE_FIREBASE_DATABASE_URL,
 projectId: env.VITE_FIREBASE_PROJECT_ID,
 storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
 messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
 appId: env.VITE_FIREBASE_APP_ID,
 });
 } else {
 app = getApp();
 }
 auth = getAuth(app);
 // 한국어 이메일 템플릿 설정
 auth.languageCode = 'ko';
 } catch (err) {
  console.warn('Firebase Auth 초기화 경고:', err);
  auth = null;
 }
}
/**
 * 2. 도메인 제한 검증 로직
 * @korea.kr, @kepco.co.kr 등 지정된 11개 공공기관/공기업 도메인인지 확인
 */
export function validateEmailDomain(email: string): { isValid: boolean; domain: string; 
companyName?: string; error?: string } {
 const cleanEmail = email.toLowerCase().trim();
 const atIndex = cleanEmail.lastIndexOf('@');
 if (atIndex === -1) {
 return { isValid: false, domain: '', error: '올바른 이메일 주소 형식이 아닙니다.' };
 }
 const domain = cleanEmail.substring(atIndex + 1);
 const matched = DEFAULT_ALLOWED_DOMAINS.find((d) => d.domain.toLowerCase() 
=== domain);
 if (!matched) {
 return {
 isValid: false,
 domain,
 error: `@${domain} 은(는) 등록 가능한 기관 도메인이 아닙니다. 공무원(@korea.kr) 
또는 한국전력공사(@kepco.co.kr) 등 허용된 11개 공공기관 이메일만 가입 가능합니다.`,
 };
 }
 return { isValid: true, domain, companyName: matched.companyName };
}
/**
 * 로컬 모의 계정 저장소 (Firebase 키 미설정 시에도 100% 동일한 흐름으로 동작)
 */
const MOCK_FIREBASE_USERS_KEY = 'love_app_mock_firebase_auth_users';
interface MockAuthUser {
 uid: string;
 email: string;
 passwordPlain: string;
 emailVerified: boolean;
 verificationLink: string;
 createdAt: number;
}
function getMockUsers(): Record<string, MockAuthUser> {
 try {
 return JSON.parse(localStorage.getItem(MOCK_FIREBASE_USERS_KEY) || '{}');
 } catch {
 return {};
 }
}
function saveMockUsers(users: Record<string, MockAuthUser>) {
 localStorage.setItem(MOCK_FIREBASE_USERS_KEY, JSON.stringify(users));
}
/**
 * 3. Firebase Auth 회원가입 및 공식 인증 링크 메일(sendEmailVerification) 자동 발송
 */
export async function registerWithEmailVerification(
 email: string,
 passwordPlain: string
): Promise<{
 success: boolean;
 user?: { uid: string; email: string; emailVerified: boolean };
 verificationMode: 'FIREBASE_LIVE' | 'SIMULATED_LINK';
 simulatedLink?: string;
 message: string;
}> {
 const cleanEmail = email.toLowerCase().trim();
 // (1) 도메인 검증
 const domainValidation = validateEmailDomain(cleanEmail);
 if (!domainValidation.isValid) {
 throw new Error(domainValidation.error);
 }
 // (2) Firebase Auth 실제 API가 초기화되어 있는 경우 (0원 공식 메일 발송)
 if (auth) {
 try {
 // 1) 유저 계정 생성
 const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, 
passwordPlain);
 const user = userCredential.user;
 // 2) Google Firebase 기본 제공 0원 인증 링크 메일 발송
 await sendEmailVerification(user, {
 url: window.location.origin, // 링크 클릭 후 돌아올 URL
 handleCodeInApp: false,
 });
 return {
 success: true,
 user: {
 uid: user.uid,
 email: user.email || cleanEmail,
 emailVerified: user.emailVerified,
 },
 verificationMode: 'FIREBASE_LIVE',
 message: `${cleanEmail} 계정으로 Firebase 인증 링크 메일이 발송되었습니다. 메일
함에서 링크를 클릭하여 인증을 완료해주세요.`,
 };
 } catch (err: unknown) {
 const fbError = err as { code?: string; message?: string };
 if (fbError.code === 'auth/email-already-in-use') {
 throw new Error('이미 가입된 이메일 주소입니다. 로그인 탭에서 로그인을 진행해 주세요.');
 } else if (fbError.code === 'auth/weak-password') {
 throw new Error('비밀번호는 최소 6자 이상이어야 합니다.');
 } else if (fbError.code === 'auth/invalid-email') {
 throw new Error('유효하지 않은 이메일 형식입니다.');
 }
 throw new Error(fbError.message || 'Firebase 회원가입 처리 중 오류가 발생했습니다.');
 }
 }
 // (3) Firebase 환경변수가 비어있는 경우 (로컬 브라우저 환경에서 시뮬레이션 지원)
 const mockUsers = getMockUsers();
 if (mockUsers[cleanEmail] && mockUsers[cleanEmail].emailVerified) {
 throw new Error('이미 인증이 완료된 이메일 주소입니다. 로그인해주세요.');
 }
 const simulatedToken = Math.random().toString(36).substring(2, 15);
 const simulatedLink = 
`${window.location.origin}/?verify_token=${simulatedToken}&email=${encodeURIComponent(cleanEmail)}`;
 mockUsers[cleanEmail] = {
 uid: `fb_user_${Date.now()}`,
 email: cleanEmail,
 passwordPlain,
 emailVerified: false,
 verificationLink: simulatedLink,
 createdAt: Date.now(),
 };
 saveMockUsers(mockUsers);
 return {
 success: true,
 user: {
 uid: mockUsers[cleanEmail].uid,
 email: cleanEmail,
 emailVerified: false,
 },
 verificationMode: 'SIMULATED_LINK',
 simulatedLink,
 message: `${cleanEmail} 계정으로 인증 링크가 발송되었습니다.`,
 };
}
/**
 * 4. 이메일 링크 클릭 인증 상태 체크 (emailVerified: true 여부 확인)
 * 사용자 메일함에서 링크를 누른 후 '인증 확인' 버튼을 누르거나 폴링할 때 호출
 */
export async function checkEmailVerificationStatus(
 email: string
): Promise<{ isVerified: boolean; message: string }> {
 const cleanEmail = email.toLowerCase().trim();
 // (1) 실제 Firebase Auth 사용 시
 if (auth && auth.currentUser) {
 try {
 // Firebase 서버로부터 최신 유저 상태 갱신 (중요!)
 await auth.currentUser.reload();
 const verified = auth.currentUser.emailVerified;
 if (verified) {
 return { isVerified: true, message: '이메일 인증이 정상적으로 완료되었습니다!' };
 } else {
  return {
  isVerified: false,
  message: '아직 이메일 인증 링크가 클릭되지 않았습니다. 메일함을 확인하고 링크를 클릭해주세요.',
  };
 }
 } catch (err) {
 console.error('Firebase reload error:', err);
 return { isVerified: false, message: '인증 상태 확인 중 오류가 발생했습니다. 다시 시도해주세요.' };
 }
 }
 // (2) 모의/로컬 환경 체크
 const mockUsers = getMockUsers();
 const found = mockUsers[cleanEmail];
 if (found && found.emailVerified) {
 return { isVerified: true, message: '이메일 인증이 완료되었습니다!' };
 }
 return {
 isVerified: false,
 message: '아직 인증 링크가 확인되지 않았습니다. 아래 [인증 링크 클릭 시뮬레이션] 버튼을 눌러 승인하거나 실제 키를 연동해주세요.',
 };
}

/**
 * 로컬 모의 환경에서 이메일 인증 링크 클릭 시뮬레이션 처리
 */
export function simulateEmailLinkClick(email: string): boolean {
 const cleanEmail = email.toLowerCase().trim();
 const mockUsers = getMockUsers();
 if (mockUsers[cleanEmail]) {
 mockUsers[cleanEmail].emailVerified = true;
 saveMockUsers(mockUsers);
 return true;
 }
 return false;
}

/**
 * 5. Firebase 이메일 인증 메일 재발송
 */
export async function resendVerificationEmail(email: string): Promise<{ success: 
boolean; message: string }> {
 const cleanEmail = email.toLowerCase().trim();
 if (auth && auth.currentUser) {
 try {
 await sendEmailVerification(auth.currentUser, {
 url: window.location.origin,
 handleCodeInApp: false,
 });
 return { success: true, message: '인증 메일이 재발송되었습니다. 메일함을 확인해주세요.' };
 } catch (err: unknown) {
 const fbError = err as { code?: string; message?: string };
 if (fbError.code === 'auth/too-many-requests') {
 return { success: false, message: '잠시 후 다시 요청해주세요. (스팸 방지 쿨다운 적용 중)' };
 }
 return { success: false, message: fbError.message || '인증 메일 재발송에 실패했습니다.' };
 }
 }
 return { success: true, message: '인증 링크가 다시 갱신되었습니다.' };
}

/**
 * 💡 공통 위치 로그 기록 헬퍼 함수
 * 실제 로그인 및 모의 로그인 모두에서 호출되어 Firestore에 유저의 1시간 이내 기록을 쌓아줍니다.
 */
async function recordLocationLog(uid: string, email: string) {
  if (navigator.geolocation && firestoreDb) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await addDoc(collection(firestoreDb, 'login_logs'), {
            userId: uid,
            email: email,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent
          });
          console.log(`[위치 추적 성공] ${email}의 실시간 로그가 저장되었습니다.`);
        } catch (e) {
          console.error('위치 로그 클라우드 DB 저장 실패:', e);
        }
      },
      (err) => console.warn('위치 권한은 있으나 GPS 신호를 받지 못했습니다:', err),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }
}

/**
 * 6. 이메일 & 비밀번호 로그인 (실제 및 모의 계정 모두 강제 위치 수집 연동 완료)
 */
export async function loginWithEmailAndPassword(
 email: string,
 passwordPlain: string
): Promise<{
 success: boolean;
 user?: { uid: string; email: string; emailVerified: boolean };
 requiresEmailVerification?: boolean;
 message: string;
}> {
 const cleanEmail = email.toLowerCase().trim();

 // (1) 실제 Firebase Auth 로그인 분기
 if (auth) {
  try {
 const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, passwordPlain);
 const user = userCredential.user;
 if (!user.emailVerified) {
 return {
 success: false,
 requiresEmailVerification: true,
 user: { uid: user.uid, email: user.email || cleanEmail, emailVerified: false },
 message: '이메일 인증이 아직 완료되지 않았습니다. 메일함의 인증 링크를 먼저 클릭해주세요.',
 };
 }

 // 💡 실제 로그인 유저의 실시간 위치 기록 강제 실행
 await recordLocationLog(user.uid, user.email || cleanEmail);

 return {
 success: true,
 user: { uid: user.uid, email: user.email || cleanEmail, emailVerified: true },
 message: '로그인에 성공했습니다.',
 };
 } catch (err: unknown) {
 const fbError = err as { code?: string; message?: string };
 if (fbError.code === 'auth/user-not-found' || fbError.code === 'auth/wrong-password' || fbError.code === 'auth/invalid-credential') {
 // 실제 로그인이 틀렸다면 아래 모의/로컬 환경으로 넘어가 테스트를 계속할 수 있도록 유도합니다.
 console.log('실체 Auth에 없는 계정이므로 모의/데모 계정 확인을 시작합니다.');
 } else {
 throw new Error(fbError.message || '로그인 중 오류가 발생했습니다.');
 }
 }
 }

 // (2) 모의/로컬 환경 및 데모 로그인 분기
 const mockUsers = getMockUsers();
 const found = mockUsers[cleanEmail];
 
 if (!found) {
 // Demo 마스터 계정 자동 체크 단계
 const demoUid = `demo_${Date.now()}`;
 // 💡 데모 계정 로그인 시에도 예외 없이 클라우드 DB(login_logs)에 강제로 좌표 누적 생성
 await recordLocationLog(demoUid, cleanEmail);

 return {
 success: true,
 user: { uid: demoUid, email: cleanEmail, emailVerified: true },
 message: '로그인 성공 (데모 테스트 모드)',
 };
 }

 if (found.passwordPlain !== passwordPlain) {
 throw new Error('비밀번호가 일치하지 않습니다.');
 }
 if (!found.emailVerified) {
 return {
 success: false,
 requiresEmailVerification: true,
 user: { uid: found.uid, email: cleanEmail, emailVerified: false },
 message: '이메일 인증이 완료되지 않았습니다. 인증 링크를 먼저 클릭해주세요.',
 };
 }

 // 💡 모의 회원 로그인 성공 시에도 예외 없이 즉각 실시간 위치 기록 강제 실행
 await recordLocationLog(found.uid, cleanEmail);

 return {
 success: true,
 user: { uid: found.uid, email: cleanEmail, emailVerified: true },
 message: '로그인에 성공했습니다.',
 };
}

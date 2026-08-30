import React, { useState, useEffect } from 'react';
import {
  Mail,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Heart,
  ShieldCheck,
  Building2,
  ExternalLink,
  Send,
} from 'lucide-react';
import { DEFAULT_ALLOWED_DOMAINS } from '../services/datingService';
import {
  registerWithEmailVerification,
  checkEmailVerificationStatus,
  simulateEmailLinkClick,
  resendVerificationEmail,
  loginWithEmailAndPassword,
  validateEmailDomain,
} from '../services/firebaseAuthService';
import { UserProfile } from '../types';
import { DatingService } from '../services/datingService';

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (user: UserProfile, isNewUser: boolean) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onSuccess }) => {
  const [isLoginTab, setIsLoginTab] = useState(false);

  // Email input state
  const [emailPrefix, setEmailPrefix] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('korea.kr');
  const [loginEmail, setLoginEmail] = useState('');

  // Password state
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  // Firebase Email Verification State
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verificationMode, setVerificationMode] = useState<'FIREBASE_LIVE' | 'SIMULATED_LINK'>('SIMULATED_LINK');
  const [simulatedLink, setSimulatedLink] = useState<string | null>(null);

  // Status & loading
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Re-send cooldown
  const [resendCooldown, setResendCooldown] = useState(0);

  const fullSignupEmail = `${emailPrefix.trim()}@${selectedDomain}`;

  // Cooldown ticker
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Periodic polling for Firebase Auth email verification when waiting
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    if (isEmailSent && !isEmailVerified) {
      pollInterval = setInterval(async () => {
        try {
          const res = await checkEmailVerificationStatus(fullSignupEmail);
          if (res.isVerified) {
            setIsEmailVerified(true);
            setSuccessNotice('이메일 인증이 완료되었습니다! 아래 버튼을 눌러 프로필을 작성해주세요.');
          }
        } catch {
          // silent polling fail
        }
      }, 4000); // Check every 4 seconds
    }
    return () => clearInterval(pollInterval);
  }, [isEmailSent, isEmailVerified, fullSignupEmail]);

  if (!isOpen) return null;

  /**
   * [1단계] 회원가입 제출 및 Firebase 공식 이메일 인증 링크 발송
   */
  const handleSignUpAndSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    // 1. 도메인 유효성 및 필수 입력 검사
    if (!emailPrefix.trim()) {
      setError('이메일 아이디를 입력해주세요.');
      return;
    }

    const domainValidation = validateEmailDomain(fullSignupEmail);
    if (!domainValidation.isValid) {
      setError(domainValidation.error || '허용되지 않은 기관 도메인입니다.');
      return;
    }

    // 2. 비밀번호 유효성 검사
    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상으로 설정해주세요.');
      return;
    }

    if (password !== passwordConfirm) {
      setError('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);

    try {
      // 3. Firebase Auth 회원가입 및 sendEmailVerification 호출 (비용 0원 공식 메일)
      const res = await registerWithEmailVerification(fullSignupEmail, password);
      setIsLoading(false);

      setIsEmailSent(true);
      setVerificationMode(res.verificationMode);
      if (res.simulatedLink) {
        setSimulatedLink(res.simulatedLink);
      }
      setResendCooldown(60); // 1분 재발송 쿨다운
      setSuccessNotice(res.message);
    } catch (err: unknown) {
      setIsLoading(false);
      const errMsg = err instanceof Error ? err.message : '회원가입 중 오류가 발생했습니다.';
      setError(errMsg);
    }
  };

  /**
   * [2단계] 사용자가 이메일 링크 클릭 후 '인증 확인' 버튼 수동 클릭
   */
  const handleManualCheckVerification = async () => {
    setError(null);
    setIsCheckingStatus(true);

    try {
      const res = await checkEmailVerificationStatus(fullSignupEmail);
      setIsCheckingStatus(false);

      if (res.isVerified) {
        setIsEmailVerified(true);
        setSuccessNotice('이메일 인증이 확인되었습니다! 프로필 작성을 진행하실 수 있습니다.');
      } else {
        setError(res.message);
      }
    } catch {
      setIsCheckingStatus(false);
      setError('인증 상태 확인 중 오류가 발생했습니다.');
    }
  };

  /**
   * 로컬/개발 환경용 즉시 인증 완료 시뮬레이션
   */
  const handleSimulateVerificationClick = () => {
    simulateEmailLinkClick(fullSignupEmail);
    setIsEmailVerified(true);
    setSuccessNotice('이메일 인증 링크 클릭이 시뮬레이션 승인되었습니다! 프로필을 완성해주세요.');
    setError(null);
  };

  /**
   * 인증메일 재발송
   */
  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await resendVerificationEmail(fullSignupEmail);
      setIsLoading(false);
      setResendCooldown(60);
      setSuccessNotice(res.message);
    } catch (err: unknown) {
      setIsLoading(false);
      const errMsg = err instanceof Error ? err.message : '재발송 중 오류가 발생했습니다.';
      setError(errMsg);
    }
  };

  /**
   * [3단계] 이메일 인증 완료 후 프로필 작성 단계로 이동
   */
  const handleProceedToProfileSetup = () => {
    if (!isEmailVerified) {
      setError('이메일 링크 인증이 완료되지 않았습니다.');
      return;
    }

    const domainCheck = DatingService.isEmailDomainAllowed(fullSignupEmail);
    const companyGuess = domainCheck.matchedItem?.companyName || '공공기관/공기업';

    // 비밀번호 로컬 백업 저장
    DatingService.saveUserPassword(fullSignupEmail, password);

    const newUser: UserProfile = {
      id: `user_${Date.now()}`,
      email: fullSignupEmail.toLowerCase().trim(),
      name: '',
      gender: 'female',
      birthDate: '',
      age: 0,
      company: companyGuess,
      photoUrl: '',
      bio: '',
      interests: [],
      isOnline: true,
      verifiedEmail: true,
      createdAt: Date.now(),
      lastActive: Date.now(),
      popularity: 100,
      stickers: {},
    };

    onSuccess(newUser, true);
  };

  /**
   * 로그인 처리
   */
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !password) {
      setError('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await loginWithEmailAndPassword(loginEmail, password);
      setIsLoading(false);

      if (res.requiresEmailVerification) {
        setError(res.message);
        return;
      }

      // 기존 프로필 유저 로드
      const allUsers = DatingService.getAllUsers();
      let foundUser = allUsers.find((u) => u.email.toLowerCase() === loginEmail.toLowerCase().trim());

      if (!foundUser) {
        // 프로필 자동 복구
        const domainCheck = DatingService.isEmailDomainAllowed(loginEmail);
        foundUser = {
          id: res.user?.uid || `user_${Date.now()}`,
          email: loginEmail.toLowerCase().trim(),
          name: '회원',
          gender: 'female',
          birthDate: '1996-01-01',
          age: 28,
          company: domainCheck.matchedItem?.companyName || '공공기관',
          photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
          bio: '소중한 인연을 만나고 싶습니다.',
          interests: ['☕ 카페투어', '🏃 러닝/마라톤'],
          isOnline: true,
          verifiedEmail: true,
          createdAt: Date.now(),
          lastActive: Date.now(),
          popularity: 100,
          stickers: {},
        };
      }

      DatingService.saveCurrentUser(foundUser);
      onSuccess(foundUser, false);
    } catch (err: unknown) {
      setIsLoading(false);
      const errMsg = err instanceof Error ? err.message : '로그인에 실패했습니다.';
      setError(errMsg);
    }
  };

  const handleQuickDemoLogin = (demoType: 'female' | 'male') => {
    const demoUser: UserProfile = demoType === 'female'
      ? {
          id: `demo_user_f_${Date.now()}`,
          email: 'officer.kim@korea.kr',
          name: '윤아름',
          gender: 'female',
          birthDate: '1997-06-15',
          age: 27,
          company: '공무원 (대한민국 정부)',
          photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80',
          bio: '주말엔 브런치 카페 가고 음악 듣는 걸 좋아해요. 대화가 잘 통하는 따뜻한 인연을 만나고 싶습니다 ✨',
          interests: ['☕ 카페투어', '🍷 와인/위스키', '🎸 음악감상/공연', '✈️ 해외여행'],
          isOnline: true,
          verifiedEmail: true,
          createdAt: Date.now(),
          lastActive: Date.now(),
          popularity: 128,
          stickers: { '✨ 훈훈비주얼': 14, '☕ 커피메이트': 11, '💬 티키타카장인': 8 },
        }
      : {
          id: `demo_user_m_${Date.now()}`,
          email: 'engineer.park@kepco.co.kr',
          name: '김서준',
          gender: 'male',
          birthDate: '1995-09-22',
          age: 29,
          company: '한국전력공사',
          photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
          bio: '퇴근 후 러닝과 테니스를 즐깁니다. 함께 맛있는 음식 먹으러 갈 좋은 분 찾아요!',
          interests: ['🏃 러닝/마라톤', '🍣 맛집탐방', '🎾 테니스/골프', '🏕️ 캠핑/글램핑'],
          isOnline: true,
          verifiedEmail: true,
          createdAt: Date.now(),
          lastActive: Date.now(),
          popularity: 135,
          stickers: { '🏃 운동메이트': 16, '🍣 맛집네비게이터': 12, '🌟 프로갓생러': 9 },
        };

    DatingService.saveUserPassword(demoUser.email, 'demo1234');
    DatingService.saveCurrentUser(demoUser);
    onSuccess(demoUser, false);
  };

  const currentOrg = DEFAULT_ALLOWED_DOMAINS.find((d) => d.domain === selectedDomain);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-stone-100 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 p-6 text-white text-center relative shrink-0">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-2.5 backdrop-blur-md shadow-inner">
            <Heart className="w-6 h-6 text-white fill-white" />
          </div>
          <h2 className="text-xl font-black tracking-tight">
            공공기관 & 공기업 임직원 매칭
          </h2>
          <p className="text-xs text-rose-100 mt-1 font-medium">
            Firebase 0원 이메일 인증 링크(sendEmailVerification) 연동
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-stone-100 bg-stone-50/70 p-1 shrink-0">
          <button
            type="button"
            id="tab-signup-btn"
            onClick={() => {
              setIsLoginTab(false);
              setError(null);
              setSuccessNotice(null);
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition ${
              !isLoginTab ? 'bg-white text-rose-600 shadow-sm' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            신규 회원가입 (이메일 링크 인증)
          </button>
          <button
            type="button"
            id="tab-login-btn"
            onClick={() => {
              setIsLoginTab(true);
              setError(null);
              setSuccessNotice(null);
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition ${
              isLoginTab ? 'bg-white text-rose-600 shadow-sm' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            이메일 & 비밀번호 로그인
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {successNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-emerald-800 text-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span className="leading-relaxed">{successNotice}</span>
            </div>
          )}

          {!isLoginTab ? (
            /* ================= Sign Up Flow ================= */
            !isEmailSent ? (
              /* [1단계] 이메일 및 비밀번호 입력 후 인증 링크 발송 */
              <form onSubmit={handleSignUpAndSendEmail} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-stone-700 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                      <span>소속 기관 공식 이메일</span>
                      <span className="text-rose-500 text-[11px] font-extrabold">*지정 11개 기관만 가능</span>
                    </label>
                  </div>

                  {/* Prefix + Strict Select */}
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input
                        id="signup-email-prefix-input"
                        type="text"
                        required
                        placeholder="이메일 아이디"
                        value={emailPrefix}
                        onChange={(e) => setEmailPrefix(e.target.value.replace(/@.*$/, '').trim())}
                        className="w-full pl-8 pr-2 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
                      />
                    </div>

                    <span className="text-stone-400 font-bold text-sm select-none">@</span>

                    <div className="relative flex-1">
                      <select
                        id="signup-domain-select"
                        value={selectedDomain}
                        onChange={(e) => setSelectedDomain(e.target.value)}
                        className="w-full px-2 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition cursor-pointer"
                      >
                        {DEFAULT_ALLOWED_DOMAINS.map((d) => (
                          <option key={d.domain} value={d.domain}>
                            {d.domain} ({d.companyName})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-200/80">
                    <span className="flex items-center gap-1.5 text-stone-700 font-medium">
                      <Building2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>선택 기관: <strong className="text-stone-900">{currentOrg?.companyName}</strong></span>
                    </span>
                    <span className="text-stone-500 font-mono text-[10px]">
                      @{selectedDomain}
                    </span>
                  </div>
                </div>

                {/* Password Setting */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    로그인 비밀번호 설정 (최소 6자)
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      id="signup-password-input"
                      type="password"
                      required
                      placeholder="6자 이상 입력"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    비밀번호 확인
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      id="signup-password-confirm-input"
                      type="password"
                      required
                      placeholder="비밀번호 재입력"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                <button
                  id="signup-send-email-btn"
                  type="submit"
                  disabled={isLoading || !emailPrefix.trim()}
                  className="w-full py-3.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:from-stone-300 disabled:to-stone-300 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-md shadow-rose-200 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Firebase 인증 메일 발송 중...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Firebase 인증 링크 메일 발송하기</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* [2단계] 인증 링크 발송 후 대기 화면 (Firebase sendEmailVerification 대기) */
              <div className="space-y-4 animate-in fade-in">
                <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                    <Mail className="w-5 h-5" />
                    <span>Firebase 인증 링크 메일 발송 완료!</span>
                  </div>

                  <p className="text-xs text-stone-700 leading-relaxed">
                    <strong className="text-stone-900 font-bold">{fullSignupEmail}</strong> 주소로 Google Firebase의 공식 인증 링크가 발송되었습니다.
                  </p>

                  <div className="bg-white p-3 rounded-xl border border-rose-100 text-xs text-stone-600 space-y-1.5">
                    <div className="font-bold text-stone-800 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      <span>인증 진행 방법:</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-stone-600 pl-1">
                      <li>기관 메일함으로 이동하여 수신된 메일을 확인합니다.</li>
                      <li>본문의 <strong>[이메일 주소 확인 / 인증 링크]</strong>를 클릭합니다.</li>
                      <li>인증이 완료되면 아래 <strong>[인증 완료 확인]</strong> 버튼을 누릅니다.</li>
                    </ol>
                  </div>

                  {/* Simulated Link helper when in local testing */}
                  {verificationMode === 'SIMULATED_LINK' && (
                    <div className="pt-2 border-t border-rose-200/60">
                      <p className="text-[11px] text-stone-500 mb-1.5">
                        * Firebase Live 키 미연동 시 로컬 즉시 승인:
                      </p>
                      <button
                        type="button"
                        onClick={handleSimulateVerificationClick}
                        className="w-full py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>[인증 링크 클릭 완료 시뮬레이션]</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Verification Status Badge & Action */}
                <div className="space-y-2">
                  <button
                    type="button"
                    id="check-verification-status-btn"
                    onClick={handleManualCheckVerification}
                    disabled={isCheckingStatus || isEmailVerified}
                    className={`w-full py-3 text-xs font-bold rounded-xl border transition flex items-center justify-center gap-2 ${
                      isEmailVerified
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-white border-stone-200 hover:bg-stone-50 text-stone-800'
                    }`}
                  >
                    {isCheckingStatus ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
                        <span>Firebase 서버에서 인증 상태 확인 중...</span>
                      </>
                    ) : isEmailVerified ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>이메일 링크 인증 완료됨 (emailVerified: true)</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 text-stone-500" />
                        <span>링크 클릭 후 여기를 눌러 인증 확인 (새로고침)</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between px-1">
                    <button
                      type="button"
                      onClick={() => setIsEmailSent(false)}
                      className="text-xs text-stone-500 hover:text-stone-800 underline"
                    >
                      이메일 주소 다시 입력
                    </button>

                    <button
                      type="button"
                      disabled={resendCooldown > 0 || isLoading}
                      onClick={handleResendEmail}
                      className="text-xs text-rose-600 hover:text-rose-700 disabled:text-stone-400 font-bold"
                    >
                      {resendCooldown > 0 ? `재발송 대기 (${resendCooldown}초)` : '인증메일 재발송'}
                    </button>
                  </div>
                </div>

                {/* Final Profile Button */}
                <button
                  id="proceed-to-profile-btn"
                  type="button"
                  disabled={!isEmailVerified}
                  onClick={handleProceedToProfileSetup}
                  className="w-full py-3.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:from-stone-300 disabled:to-stone-300 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-md shadow-rose-200 cursor-pointer disabled:cursor-not-allowed"
                >
                  <span>인증 완료 & 최종 프로필 작성 시작하기</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )
          ) : (
            /* ================= Login Flow ================= */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  소속 기관 이메일 계정
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    id="login-email-input"
                    type="email"
                    required
                    placeholder="officer@korea.kr 또는 user@kepco.co.kr"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  비밀번호
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    id="login-password-input"
                    type="password"
                    required
                    placeholder="가입 시 설정한 비밀번호"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-sm transition shadow-md shadow-rose-200 cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>로그인 중...</span>
                  </>
                ) : (
                  <span>로그인</span>
                )}
              </button>
            </form>
          )}

          {/* Quick Demo Instant Entry */}
          <div className="pt-3 border-t border-stone-100">
            <p className="text-center text-[11px] text-stone-400 font-medium mb-2">
              빠른 체험을 위한 기관 임직원 테스트 계정
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="demo-login-female-btn"
                onClick={() => handleQuickDemoLogin('female')}
                className="p-2 border border-stone-200 rounded-xl bg-white hover:bg-rose-50/50 hover:border-rose-300 text-stone-700 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>공무원(@korea.kr)</span>
              </button>
              <button
                type="button"
                id="demo-login-male-btn"
                onClick={() => handleQuickDemoLogin('male')}
                className="p-2 border border-stone-200 rounded-xl bg-white hover:bg-blue-50/50 hover:border-blue-300 text-stone-700 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>한전(@kepco.co.kr)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

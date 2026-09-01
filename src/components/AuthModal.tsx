import React, { useState } from 'react';
import {
  Mail,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Building2,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { DEFAULT_ALLOWED_DOMAINS, DatingService } from '../services/datingService';
import { AdminService } from '../services/adminService';
import { UserProfile, AdminAccount } from '../types';
import { BirthDatePicker } from './BirthDatePicker';

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (user: UserProfile, isNewUser: boolean) => void;
  onAdminLogin?: (admin: AdminAccount) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onSuccess,
  onAdminLogin,
}) => {
  type AuthTab = 'login' | 'register';
  const [activeTab, setActiveTab] = useState<AuthTab>('login');

  // Register Form State (Admin Approval Model)
  const [emailPrefix, setEmailPrefix] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('kepco.co.kr');
  const [customDomain, setCustomDomain] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [birthDate, setBirthDate] = useState('1995-05-15');
  const [company, setCompany] = useState('한국전력공사');
  const [bio, setBio] = useState('따뜻하고 진솔한 인연을 만나고 싶습니다.');
  const [interests] = useState<string[]>(['산책', '맛집탐방', '커피']);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Common UI State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successModalData, setSuccessModalData] = useState<{
    title: string;
    message: string;
    subText?: string;
  } | null>(null);

  if (!isOpen) return null;

  const currentDomain = selectedDomain === 'custom' ? customDomain.trim().replace(/^@/, '') : selectedDomain;
  const fullSignupEmail = `${emailPrefix.trim()}@${currentDomain}`;

  const calculateAgeFromBirth = (bDate: string) => {
    try {
      const birthYear = new Date(bDate).getFullYear();
      const currentYear = new Date().getFullYear();
      return Math.max(20, currentYear - birthYear + 1);
    } catch {
      return 29;
    }
  };

  // ==========================================
  // 1. REGISTER SUBMISSION (Admin Approval Request)
  // ==========================================
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!emailPrefix.trim()) {
      setError('이메일 아이디를 입력해주세요.');
      return;
    }

    if (!currentDomain) {
      setError('기관 도메인을 선택하거나 입력해주세요.');
      return;
    }

    if (registerPassword.length < 4) {
      setError('비밀번호는 최소 4자 이상이어야 합니다.');
      return;
    }

    if (registerPassword !== registerPasswordConfirm) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    if (!name.trim()) {
      setError('성명(이름)을 입력해주세요.');
      return;
    }

    setIsLoading(true);

    const calculatedAge = calculateAgeFromBirth(birthDate);

    // Call DatingService.requestUserRegistration
    const res = DatingService.requestUserRegistration({
      email: fullSignupEmail,
      passwordPlain: registerPassword,
      name: name.trim(),
      gender,
      birthDate,
      age: calculatedAge,
      company: company.trim() || '공공기관',
      bio: bio.trim(),
      interests,
    });

    setIsLoading(false);

    if (!res.success) {
      setError(res.message);
      return;
    }

    // Show Success Modal for Admin Approval Notice
    setSuccessModalData({
      title: '가입 신청 완료 (소속 기관 승인 대기)',
      message: `[${res.user?.company || '소속 기관'}] 가입 신청서가 성공적으로 제출되었습니다.`,
      subText: '사칭 및 도용 방지를 위해 해당 기관 관리자의 승인 심사 완료 후 로그인이 가능합니다. 승인 즉시 환영박스 1개가 자동 지급됩니다.',
    });

    // Reset Form
    setEmailPrefix('');
    setRegisterPassword('');
    setRegisterPasswordConfirm('');
  };

  // ==========================================
  // 2. UNIFIED LOGIN (Member & Admin)
  // ==========================================
  const handleUserLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = loginEmail.trim();
    const cleanPassword = loginPassword.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);

    // 1) First check if entered credentials belong to an Administrator (Master or Agency Admin)
    const adminRes = AdminService.verifyAdminLogin(cleanEmail, cleanPassword);
    if (adminRes.isAdmin && adminRes.adminAccount) {
      setIsLoading(false);
      if (onAdminLogin) {
        onAdminLogin(adminRes.adminAccount);
      }
      return;
    }

    // 2) If not an admin, proceed with standard member authentication
    const userRes = DatingService.loginUserWithApprovalCheck(cleanEmail, cleanPassword);
    setIsLoading(false);

    if (!userRes.success) {
      setError(userRes.message || '로그인에 실패했습니다.');
      return;
    }

    if (userRes.user) {
      onSuccess(userRes.user, false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="bg-stone-950/80 border-b border-stone-800 p-5 text-center relative shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-400 flex items-center justify-center mx-auto mb-2.5 shadow-lg shadow-rose-950/50">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            공공기관 매칭 시스템
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            철저한 기관 인증 및 관리자 승인 기반의 안심 소통 플랫폼
          </p>

          {/* Navigation Tabs (2 Tabs: Login & Agency Registration) */}
          <div className="grid grid-cols-2 gap-1 bg-stone-900 p-1 rounded-xl mt-4 border border-stone-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setError(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'login'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              회원 로그인
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setError(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'register'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              기관 가입 신청
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: UNIFIED LOGIN (Members & Admins) */}
          {/* ========================================================================= */}
          {activeTab === 'login' && (
            <form onSubmit={handleUserLogin} className="space-y-4">
              <div>
                <label className="text-stone-300 font-semibold mb-1 block">아이디 (공식 이메일)</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="예: gildong@kepco.co.kr"
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-9 pr-3 py-2.5 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-rose-500 text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-stone-300 font-semibold mb-1 block">비밀번호</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-9 pr-3 py-2.5 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-rose-500 text-xs"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-950/60 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                <span>{isLoading ? '로그인 확인 중...' : '로그인하기'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: AGENCY REGISTER (ADMIN APPROVAL REQUEST) */}
          {/* ========================================================================= */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* Notice Banner */}
              <div className="p-3 bg-stone-950/90 border border-stone-800 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>기관 관리자 직접 승인제 안내</span>
                </div>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  가입 신청서 제출 시 소속 기관 담당 관리자에게 심사 요청이 전달됩니다. 관리자가 승인한 후 정식 이용이 가능합니다.
                </p>
              </div>

              {/* Email & Agency Domain Selection */}
              <div>
                <label className="text-stone-300 font-semibold mb-1 block">소속 기관 공식 이메일</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={emailPrefix}
                    onChange={(e) => setEmailPrefix(e.target.value)}
                    placeholder="이메일 아이디"
                    className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-stone-100 text-xs focus:outline-none focus:border-rose-500"
                    required
                  />
                  <span className="flex items-center text-stone-500 font-bold">@</span>
                  <select
                    value={selectedDomain}
                    onChange={(e) => {
                      const dom = e.target.value;
                      setSelectedDomain(dom);
                      const matched = DEFAULT_ALLOWED_DOMAINS.find((d) => d.domain === dom);
                      if (matched) setCompany(matched.companyName);
                    }}
                    className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-stone-100 text-xs focus:outline-none focus:border-rose-500"
                  >
                    {DEFAULT_ALLOWED_DOMAINS.map((d) => (
                      <option key={d.domain} value={d.domain}>
                        {d.domain} ({d.companyName})
                      </option>
                    ))}
                    <option value="custom">직접 입력...</option>
                  </select>
                </div>

                {selectedDomain === 'custom' && (
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="도메인 입력 (예: kepco.co.kr)"
                    className="w-full mt-2 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-rose-500"
                  />
                )}
              </div>

              {/* Passwords */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-stone-300 font-semibold mb-1 block">비밀번호 (4자 이상)</label>
                  <input
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="비밀번호"
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-stone-300 font-semibold mb-1 block">비밀번호 확인</label>
                  <input
                    type="password"
                    value={registerPasswordConfirm}
                    onChange={(e) => setRegisterPasswordConfirm(e.target.value)}
                    placeholder="비밀번호 재입력"
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
              </div>

              {/* Name & Gender */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-stone-300 font-semibold mb-1 block">성명 (이름)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="이름"
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-stone-300 font-semibold mb-1 block">성별</label>
                  <div className="grid grid-cols-2 gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800">
                    <button
                      type="button"
                      onClick={() => setGender('male')}
                      className={`py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                        gender === 'male' ? 'bg-blue-600 text-white' : 'text-stone-400'
                      }`}
                    >
                      남성
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('female')}
                      className={`py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                        gender === 'female' ? 'bg-rose-600 text-white' : 'text-stone-400'
                      }`}
                    >
                      여성
                    </button>
                  </div>
                </div>
              </div>

              {/* Birthdate & Company */}
              <div className="space-y-2.5">
                <div>
                  <label className="text-stone-300 text-xs font-semibold mb-1 block">
                    생년월일 (연도 / 월 / 일)
                  </label>
                  <BirthDatePicker
                    value={birthDate}
                    onChange={(val) => setBirthDate(val)}
                    theme="dark"
                  />
                </div>
                <div>
                  <label className="text-stone-300 text-xs font-semibold mb-1 block">소속 기관명</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="예: 한국전력공사"
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
              </div>

              {/* Profile Image Notice */}
              <div className="p-3 bg-stone-950 rounded-xl border border-stone-800 flex items-center gap-3">
                <img
                  src={gender === 'female' ? '/assets/profiles/woman_1.svg' : '/assets/profiles/man_1.svg'}
                  alt="Official Avatar"
                  className="w-10 h-10 rounded-xl object-cover border border-stone-700 bg-stone-800"
                />
                <div className="text-[11px] text-stone-400">
                  <span className="font-bold text-stone-200 block">공식 지정 프로필 아바타 자동 배정</span>
                  <span>사칭 방지를 위해 성별에 따른 캐릭터 아바타가 자동 적용됩니다.</span>
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="text-stone-300 font-semibold mb-1 block">한 줄 소개</label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="자신을 표현하는 한 줄 소개"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-950/60 transition-all flex items-center justify-center gap-2 mt-3 cursor-pointer"
              >
                <span>{isLoading ? '신청서 제출 중...' : '가입 신청서 제출하기 (승인 대기)'}</span>
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* SUCCESS POPUP MODAL */}
      {successModalData && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl animate-scaleUp">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white">{successModalData.title}</h3>
            <p className="text-xs text-stone-300 leading-relaxed">{successModalData.message}</p>
            {successModalData.subText && (
              <p className="text-[11px] text-stone-400 bg-stone-950 p-3 rounded-xl border border-stone-800">
                {successModalData.subText}
              </p>
            )}
            <button
              onClick={() => {
                setSuccessModalData(null);
                setActiveTab('login');
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              확인 (로그인 화면으로 이동)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

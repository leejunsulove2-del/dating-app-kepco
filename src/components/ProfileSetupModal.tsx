import React, { useState } from 'react';
import { Camera, Building2, Calendar, User, Heart, Sparkles, Check, Plus, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { UserProfile } from '../types';
import { calculateAge } from '../utils/geo';
import { INITIAL_INTEREST_TAGS } from '../services/mockProfiles';
import { DatingService } from '../services/datingService';
import { AdminService } from '../services/adminService';
import { handleAvatarError, getAvatarForUser } from '../utils/avatarUtils';
import { BirthDatePicker } from './BirthDatePicker';

interface ProfileSetupModalProps {
  isOpen: boolean;
  initialUser: UserProfile;
  onComplete: (completedUser: UserProfile) => void;
}

const OFFICIAL_MALE_AVATARS = [
  '/assets/profiles/man_1.svg',
  '/assets/profiles/man_2.svg',
  '/assets/profiles/man_3.svg',
  '/assets/profiles/man_4.svg',
  '/assets/profiles/man_5.svg',
];

const OFFICIAL_FEMALE_AVATARS = [
  '/assets/profiles/woman_1.svg',
  '/assets/profiles/woman_2.svg',
  '/assets/profiles/woman_3.svg',
  '/assets/profiles/woman_4.svg',
  '/assets/profiles/woman_5.svg',
];

export const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({
  isOpen,
  initialUser,
  onComplete,
}) => {
  const [name, setName] = useState(initialUser.name || '');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(initialUser.gender || 'female');
  const [birthDate, setBirthDate] = useState(initialUser.birthDate || '1998-05-20');
  const [company, setCompany] = useState(initialUser.company || '');
  const [photoUrl, setPhotoUrl] = useState(
    initialUser.photoUrl || (gender === 'female' ? OFFICIAL_FEMALE_AVATARS[0] : OFFICIAL_MALE_AVATARS[0])
  );
  const [bio, setBio] = useState(initialUser.bio || '');
  const [interests, setInterests] = useState<string[]>(initialUser.interests || ['☕ 카페투어', '🍷 와인/위스키']);
  const [customInterest, setCustomInterest] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentAvatarList = gender === 'female' ? OFFICIAL_FEMALE_AVATARS : OFFICIAL_MALE_AVATARS;

  const handleInterestToggle = (tag: string) => {
    if (interests.includes(tag)) {
      setInterests(interests.filter((t) => t !== tag));
    } else {
      if (interests.length >= 8) {
        setError('관심사는 최대 8개까지 선택 가능합니다.');
        return;
      }
      setError(null);
      setInterests([...interests, tag]);
    }
  };

  const handleAddCustomInterest = () => {
    if (!customInterest.trim()) return;
    const formatted = customInterest.startsWith('#')
      ? customInterest.trim()
      : `#${customInterest.trim()}`;
    if (!interests.includes(formatted)) {
      setInterests([...interests, formatted]);
    }
    setCustomInterest('');
  };

  // Direct photo upload block with user notice requirement
  const handleDirectUploadAttempt = () => {
    alert('임시로 직접 프로필사진등록 기능을 정지했습니다.');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!photoUrl) {
      setError('프로필 사진은 필수 항목입니다.');
      return;
    }
    if (!name.trim()) {
      setError('이름(닉네임)을 입력해주세요.');
      return;
    }
    if (!birthDate) {
      setError('생년월일은 필수 항목입니다.');
      return;
    }
    if (!company.trim()) {
      setError('기업명(직장명/소속)은 필수 항목입니다.');
      return;
    }

    const calculatedAge = calculateAge(birthDate);
    if (calculatedAge < 19) {
      setError('만 19세 이상만 가입 가능합니다.');
      return;
    }

    const updatedUser: UserProfile = {
      ...initialUser,
      name: name.trim(),
      gender,
      birthDate,
      age: calculatedAge,
      company: company.trim(),
      photoUrl,
      bio: bio.trim() || '안녕하세요! 좋은 인연 만나고 싶어요.',
      interests: interests.length > 0 ? interests : ['☕ 카페투어', '🍣 맛집탐방'],
      lastActive: Date.now(),
    };

    DatingService.saveCurrentUser(updatedUser);
    AdminService.recordBioChange(updatedUser.id, updatedUser, 'user');

    onComplete(updatedUser);
  };

  return (
    <div id="profile-setup-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/75 backdrop-blur-sm overflow-y-auto">
      <div id="profile-setup-container" className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-6 text-white text-center">
          <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
            필수 프로필 등록
          </span>
          <h2 className="text-2xl font-bold">프로필 완성하기</h2>
          <p className="text-rose-100 text-xs mt-1">
            공식 아바타, 생년월일, 소속을 등록하고 인근의 멋진 인연을 만나보세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Official Avatar Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-800">
                공식 프로필 캐릭터 <span className="text-rose-500">* 필수</span>
              </label>
              <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-amber-600" />
                사칭 방지 공식 캐릭터 적용
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative shrink-0">
                <img
                  src={photoUrl || getAvatarForUser(gender, initialUser.id)}
                  alt="Profile Preview"
                  onError={(e) => handleAvatarError(e, gender, initialUser.id)}
                  className="w-24 h-24 rounded-2xl object-cover border-2 border-rose-300 shadow-md bg-stone-100"
                />
              </div>
              <div className="w-full space-y-2">
                <p className="text-xs text-stone-600 font-medium">원하시는 공식 캐릭터 아바타를 선택하세요:</p>
                <div className="flex flex-wrap gap-2">
                  {currentAvatarList.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPhotoUrl(url)}
                      className={`w-10 h-10 rounded-xl overflow-hidden border-2 transition ${
                        photoUrl === url ? 'border-rose-500 scale-105 ring-2 ring-rose-200' : 'border-stone-200 hover:border-stone-400 bg-stone-50'
                      }`}
                    >
                      <img 
                        src={url} 
                        alt={`avatar-${i}`} 
                        onError={(e) => handleAvatarError(e, gender, `opt_${i}`)}
                        className="w-full h-full object-cover" 
                      />
                    </button>
                  ))}

                  {/* Direct Photo Registration Button */}
                  <button
                    type="button"
                    onClick={handleDirectUploadAttempt}
                    className="h-10 px-3 rounded-xl border border-dashed border-stone-300 hover:border-stone-400 bg-stone-50 flex items-center justify-center text-stone-500 text-xs transition"
                  >
                    <Camera className="w-3.5 h-3.5 mr-1 text-stone-400" />
                    직접 사진등록
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Name & Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                닉네임 / 이름 <span className="text-rose-500">* 필수</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  id="profile-name-input"
                  type="text"
                  required
                  placeholder="예: 김민지"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">성별</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setGender('female');
                    setPhotoUrl(OFFICIAL_FEMALE_AVATARS[0]);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                    gender === 'female' ? 'bg-rose-500 text-white shadow-sm' : 'bg-stone-50 border border-stone-200 text-stone-600'
                  }`}
                >
                  여성
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGender('male');
                    setPhotoUrl(OFFICIAL_MALE_AVATARS[0]);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                    gender === 'male' ? 'bg-blue-500 text-white shadow-sm' : 'bg-stone-50 border border-stone-200 text-stone-600'
                  }`}
                >
                  남성
                </button>
              </div>
            </div>
          </div>

          {/* Birth Date & Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                생년월일 (연도 / 월 / 일) <span className="text-rose-500">* 필수</span>
              </label>
              <BirthDatePicker
                value={birthDate}
                onChange={(val) => setBirthDate(val)}
                theme="light"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                기업명 / 소속 <span className="text-rose-500">* 필수</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  id="profile-company-input"
                  type="text"
                  required
                  placeholder="예: 한국전력공사"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">한 줄 소개</label>
            <textarea
              id="profile-bio-input"
              rows={2}
              placeholder="자신을 표현하는 매력적인 소개글을 남겨보세요."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full p-3 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
            />
          </div>

          {/* Interests */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-800">관심사 키워드 (최대 8개)</label>
              <span className="text-[11px] text-stone-500">{interests.length}/8 선택됨</span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
              {INITIAL_INTEREST_TAGS.map((tag) => {
                const isSelected = interests.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleInterestToggle(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1 ${
                      isSelected
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    {tag}
                  </button>
                );
              })}
            </div>

            {/* Custom Tag Input */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="직접 관심사 추가 (예: 클라이밍)"
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomInterest();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-rose-500"
              />
              <button
                type="button"
                onClick={handleAddCustomInterest}
                className="px-3 py-1.5 bg-stone-800 text-white rounded-xl text-xs font-semibold hover:bg-stone-700 transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                추가
              </button>
            </div>
          </div>

          <button
            id="profile-setup-submit-btn"
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-sm rounded-2xl shadow-lg shadow-rose-200 transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>프로필 저장하고 시작하기</span>
          </button>
        </form>
      </div>
    </div>
  );
};

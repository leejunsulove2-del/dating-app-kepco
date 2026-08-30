import React, { useState } from 'react';
import { Camera, Building2, Calendar, User, Heart, Sparkles, Check, Plus, AlertCircle } from 'lucide-react';
import { UserProfile } from '../types';
import { calculateAge } from '../utils/geo';
import { INITIAL_INTEREST_TAGS } from '../services/mockProfiles';
import { DatingService } from '../services/datingService';

interface ProfileSetupModalProps {
  isOpen: boolean;
  initialUser: UserProfile;
  onComplete: (completedUser: UserProfile) => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&auto=format&fit=crop&q=80',
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
  const [photoUrl, setPhotoUrl] = useState(initialUser.photoUrl || PRESET_AVATARS[0]);
  const [bio, setBio] = useState(initialUser.bio || '');
  const [interests, setInterests] = useState<string[]>(initialUser.interests || ['☕ 카페투어', '🍷 와인/위스키']);
  const [customInterest, setCustomInterest] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Mandatory validation check as specified in requirements:
    // "기본적으로 프로필사진, 생년월일, 기업명을 기록해야만 하며, 자기소개와 관심사 항목을 추가하여 프로필의 완성도를 높일 수 있도록 해주세요."
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
            사진, 생년월일, 기업명을 등록하고 인근의 멋진 인연을 만나보세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mandatory: Profile Photo */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-stone-800">
              프로필 사진 <span className="text-rose-500">* 필수</span>
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative group shrink-0">
                <img
                  src={photoUrl}
                  alt="Profile Preview"
                  className="w-24 h-24 rounded-2xl object-cover border-2 border-rose-200 shadow-md"
                />
                <label className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer text-white text-xs">
                  <Camera className="w-5 h-5 mr-1" /> 변경
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
              <div className="w-full space-y-1.5">
                <p className="text-xs text-stone-500 font-medium">추천 아바타 또는 사진 업로드</p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_AVATARS.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPhotoUrl(url)}
                      className={`w-9 h-9 rounded-xl overflow-hidden border-2 transition ${
                        photoUrl === url ? 'border-rose-500 scale-105 ring-2 ring-rose-200' : 'border-stone-200 hover:border-stone-400'
                      }`}
                    >
                      <img src={url} alt="preset" className="w-full h-full object-cover" />
                    </button>
                  ))}
                  <label className="h-9 px-2.5 rounded-xl border border-dashed border-stone-300 hover:border-rose-400 bg-stone-50 flex items-center justify-center text-stone-600 text-xs cursor-pointer transition">
                    <Camera className="w-3.5 h-3.5 mr-1 text-rose-500" />
                    직접 등록
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
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
                  className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                성별 <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGender('female')}
                  className={`py-2.5 text-xs font-semibold rounded-xl border transition ${
                    gender === 'female'
                      ? 'bg-rose-50 border-rose-400 text-rose-600 ring-2 ring-rose-200'
                      : 'bg-stone-50 border-stone-200 text-stone-600'
                  }`}
                >
                  여성
                </button>
                <button
                  type="button"
                  onClick={() => setGender('male')}
                  className={`py-2.5 text-xs font-semibold rounded-xl border transition ${
                    gender === 'male'
                      ? 'bg-blue-50 border-blue-400 text-blue-600 ring-2 ring-blue-200'
                      : 'bg-stone-50 border-stone-200 text-stone-600'
                  }`}
                >
                  남성
                </button>
              </div>
            </div>
          </div>

          {/* Mandatory: Date of Birth */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                생년월일 <span className="text-rose-500">* 필수</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  id="profile-birthdate-input"
                  type="date"
                  required
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white font-sans"
                />
              </div>
              <p className="text-[11px] text-stone-400 mt-1">
                현재 만 <span className="font-bold text-stone-700">{calculateAge(birthDate)}세</span>로 표시됩니다
              </p>
            </div>

            {/* Mandatory: Company Name */}
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                기업명 / 직장명 <span className="text-rose-500">* 필수</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  id="profile-company-input"
                  type="text"
                  required
                  placeholder="예: 카카오, 네이버, 스타트업"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                />
              </div>
              <p className="text-[11px] text-stone-400 mt-1">
                신뢰도 높은 매칭을 위해 필수 입력입니다
              </p>
            </div>
          </div>

          {/* Self-Introduction (자기소개) */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">
              자기소개 <span className="text-stone-400 text-[11px] font-normal">(프로필 매칭률 상승)</span>
            </label>
            <textarea
              id="profile-bio-input"
              rows={3}
              placeholder="자신의 성향, 취향, 주말에 즐겨하는 일 등을 자유롭게 작성해주세요."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white resize-none"
            />
          </div>

          {/* Interests (관심사 항목) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800">
                관심사 선택 <span className="text-stone-400 text-[11px] font-normal">({interests.length}/8개 선택)</span>
              </label>
            </div>
            
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-stone-50 rounded-xl border border-stone-200">
              {INITIAL_INTEREST_TAGS.map((tag) => {
                const isSelected = interests.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleInterestToggle(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    {tag}
                  </button>
                );
              })}
            </div>

            {/* Add Custom Tag */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="새 관심사 직접 입력 (예: 보드게임, 베이커리)"
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomInterest();
                  }
                }}
                className="flex-1 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <button
                type="button"
                onClick={handleAddCustomInterest}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> 추가
              </button>
            </div>
          </div>

          <button
            id="profile-complete-btn"
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-rose-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>프로필 저장하고 주변 이성 찾기</span>
          </button>
        </form>
      </div>
    </div>
  );
};

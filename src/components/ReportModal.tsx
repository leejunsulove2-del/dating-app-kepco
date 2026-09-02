import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, X, Check, AlertCircle, Clock, Info, UserX } from 'lucide-react';
import { UserProfile, ReportReason } from '../types';
import { AdminService } from '../services/adminService';
import { DatingService } from '../services/datingService';

interface ReportModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  targetUser: UserProfile;
  onClose: () => void;
  onReportSubmitted: (message: string) => void;
}

const REPORT_REASONS: { key: ReportReason; label: string; desc: string }[] = [
  {
    key: 'fake_profile',
    label: '허위 프로필 및 사진 도용',
    desc: '타인의 사진을 도용하거나 허위 인적사항을 기재한 경우',
  },
  {
    key: 'inappropriate_purpose',
    label: '목적에 맞지 않는 이용자',
    desc: '건전한 만남 목적이 아니거나 금전 요구, 불건전 만남 유도',
  },
  {
    key: 'commercial_ad',
    label: '광고 및 스팸/홍보 게시',
    desc: '상업적 광고, 타 서비스 유도, 스팸 링크 전송',
  },
  {
    key: 'harassment_abuse',
    label: '욕설, 비매너 및 성희롱',
    desc: '불쾌감을 주는 언행, 비매너 대화, 괴롭힘',
  },
  {
    key: 'other',
    label: '기타 운영정책 위반',
    desc: '기타 부적절한 행위 및 커뮤니티 가이드라인 위반',
  },
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  currentUser,
  targetUser,
  onClose,
  onReportSubmitted,
}) => {
  const [selectedReason, setSelectedReason] = useState<ReportReason>('fake_profile');
  const [customDetail, setCustomDetail] = useState('');
  const [blockTogether, setBlockTogether] = useState(true);
  const [isConfirmStep, setIsConfirmStep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentSanctionRound = (targetUser.sanctionCount || 0) + 1;
  const nextHours = currentSanctionRound >= 10 ? '영구 접속 차단' : `${currentSanctionRound}시간 이용제재`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmStep) {
      setIsConfirmStep(true);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = AdminService.submitReport(
      currentUser,
      targetUser,
      selectedReason,
      customDetail.trim() || undefined
    );

    setIsSubmitting(false);

    if (result.success) {
      if (blockTogether) {
        DatingService.blockUser(currentUser.id, targetUser.id);
      }
      onReportSubmitted(result.message);
      onClose();
    } else {
      setError(result.message);
      setIsConfirmStep(false);
    }
  };

  return (
    <div id="report-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div id="report-modal-container" className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">사용자 신고하기</h3>
              <p className="text-rose-100 text-xs mt-0.5">상대방: {targetUser.name} ({targetUser.company})</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-stone-800">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!isConfirmStep ? (
            <>
              {/* Sanction Rules Summary */}
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-1.5 text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>신고 및 제재 정책 안내</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-800/90 leading-relaxed">
                  <li>피신고자: 즉시 <strong>{nextHours}</strong> 조치 (누적제: 1회 1시간, 2회 2시간... 10회 영구차단)</li>
                  <li>신고자: 무차별 신고 방지를 위해 신고자 본인에게도 <strong>즉시 3시간 사용제한</strong> 적용</li>
                  <li>허위 신고 판정 시: <strong>허위누적 3회 발생 시 영구 탈퇴 및 재가입 중지</strong></li>
                </ul>
              </div>

              {/* Reason Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-700">
                  신고 사유 선택 <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2">
                  {REPORT_REASONS.map((r) => (
                    <label
                      key={r.key}
                      className={`flex items-start gap-3 p-3 rounded-2xl border transition cursor-pointer ${
                        selectedReason === r.key
                          ? 'border-rose-500 bg-rose-50/60 ring-1 ring-rose-300'
                          : 'border-stone-200 hover:border-stone-300 bg-stone-50/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reportReason"
                        value={r.key}
                        checked={selectedReason === r.key}
                        onChange={() => setSelectedReason(r.key)}
                        className="mt-1 text-rose-600 focus:ring-rose-500 h-4 w-4"
                      />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-stone-800">{r.label}</p>
                        <p className="text-[11px] text-stone-500 mt-0.5">{r.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Detailed reason */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-700">
                  상세 내용 작성 (선택)
                </label>
                <textarea
                  rows={2}
                  value={customDetail}
                  onChange={(e) => setCustomDetail(e.target.value)}
                  placeholder="관리자 심사를 위한 구체적인 상황을 적어주세요."
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white resize-none"
                />
              </div>

              {/* Instant Block Option */}
              <label className="flex items-center gap-2.5 p-3 bg-stone-50 hover:bg-stone-100/80 rounded-2xl border border-stone-200 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={blockTogether}
                  onChange={(e) => setBlockTogether(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4"
                />
                <div className="flex-1">
                  <p className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <UserX className="w-3.5 h-3.5 text-rose-600" />
                    <span>신고와 동시에 이 사용자 즉시 차단하기</span>
                  </p>
                  <p className="text-[11px] text-stone-500 mt-0.5">내 지도 및 피드 추천에서 숨겨지며 1:1 대화가 차단됩니다.</p>
                </div>
              </label>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-2xl transition cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-2xl transition cursor-pointer shadow-md shadow-rose-200"
                >
                  다음 (확인하기)
                </button>
              </div>
            </>
          ) : (
            /* Reconfirmation Step */
            <div className="space-y-4 text-center py-2">
              <div className="w-14 h-14 mx-auto rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                <ShieldAlert className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <h4 className="text-base font-bold text-stone-900">
                  정말 {targetUser.name}님을 신고하시겠습니까?
                </h4>
                <p className="text-xs text-stone-500 leading-relaxed max-w-xs mx-auto">
                  신고 즉시 상대방에게 <strong>{nextHours}</strong>이 부과되며, 신고자 본인에게도 <strong>3시간 이용제한</strong>이 적용됩니다.
                </p>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl text-left text-xs space-y-1">
                <div className="flex justify-between text-stone-600">
                  <span>선택된 사유:</span>
                  <span className="font-bold text-stone-800">
                    {REPORT_REASONS.find((r) => r.key === selectedReason)?.label}
                  </span>
                </div>
                {customDetail && (
                  <div className="text-stone-500 text-[11px] pt-1 border-t border-stone-200">
                    "{customDetail}"
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmStep(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-2xl transition cursor-pointer"
                >
                  이전으로
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-2xl transition cursor-pointer shadow-md shadow-rose-200"
                >
                  {isSubmitting ? '처리 중...' : '신고 확정 및 제재 실행'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

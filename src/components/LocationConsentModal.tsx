import React, { useState } from 'react';
import { MapPin, ShieldCheck, Zap, Navigation, CheckCircle, Clock } from 'lucide-react';
import { DatingService } from '../services/datingService';

interface LocationConsentModalProps {
  isOpen: boolean;
  onConsent: (coords: { latitude: number; longitude: number }) => void;
}

export const LocationConsentModal: React.FC<LocationConsentModalProps> = ({
  isOpen,
  onConsent,
}) => {
  const [isLocating, setIsLocating] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(true);

  if (!isOpen) return null;

  const handleRequestLocation = () => {
    setIsLocating(true);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocating(false);
          onConsent({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (err) => {
          console.warn('Browser geolocation denied or unavailable in iframe, falling back to default location center:', err);
          setIsLocating(false);
          // Fallback to vibrant center (Seoul Gangnam)
          onConsent(DatingService.DEFAULT_CENTER);
        },
        {
          enableHighAccuracy: true,
          timeout: 7000,
          maximumAge: 30000,
        }
      );
    } else {
      setIsLocating(false);
      onConsent(DatingService.DEFAULT_CENTER);
    }
  };

  const handleDefaultCenter = () => {
    onConsent(DatingService.DEFAULT_CENTER);
  };

  return (
    <div id="location-consent-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-md animate-in fade-in duration-200">
      <div id="location-consent-container" className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden">
        
        {/* Top Graphic */}
        <div className="bg-gradient-to-br from-rose-500 via-rose-600 to-pink-600 p-6 text-white text-center relative overflow-hidden">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-3 shadow-inner">
            <MapPin className="w-10 h-10 text-white animate-bounce" />
          </div>
          <h2 className="text-xl font-bold">위치정보 이용 동의</h2>
          <p className="text-rose-100 text-xs mt-1">
            내 주변 반경의 상대방 프로필을 지도에 표시하기 위해 동의가 필요합니다
          </p>
        </div>

        {/* Value Points */}
        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-100">
              <Clock className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-stone-800">30초 간격 저부하 위치 갱신</p>
                <p className="text-stone-500 mt-0.5">
                  실시간 과다 전송을 방지하고 배터리와 데이터 소모를 줄이기 위해 30초마다 위치만 가볍게 갱신합니다.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-100">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-stone-800">프라이버시 안심 보호</p>
                <p className="text-stone-500 mt-0.5">
                  상세 지번이나 집 주소는 노출되지 않으며, 대략적인 반경 거리(m/km)로만 매칭됩니다.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-100">
              <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-stone-800">오픈스트리트 무료 지도 사용</p>
                <p className="text-stone-500 mt-0.5">
                  유료 지도 API 비용 발생 없이 가볍고 빠른 오픈스트리트맵(OSM)을 사용합니다.
                </p>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 p-2 rounded-xl hover:bg-stone-50 cursor-pointer text-xs text-stone-700">
            <input
              type="checkbox"
              checked={privacyAgreed}
              onChange={(e) => setPrivacyAgreed(e.target.checked)}
              className="w-4 h-4 text-rose-500 rounded border-stone-300 focus:ring-rose-500"
            />
            <span className="font-medium">[필수] 위치기반 서비스 이용 약관에 동의합니다.</span>
          </label>

          <div className="space-y-2 pt-2">
            <button
              id="location-agree-btn"
              type="button"
              disabled={!privacyAgreed || isLocating}
              onClick={handleRequestLocation}
              className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 disabled:bg-stone-300 text-white font-bold rounded-2xl text-sm transition shadow-lg shadow-rose-200 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? '현재 위치 확인 중...' : '위치 권한 허용 및 시작하기'}</span>
            </button>

            <button
              type="button"
              onClick={handleDefaultCenter}
              className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-xl text-xs transition"
            >
              서울 중심지(강남/역삼) 기준으로 먼저 둘러보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// [FILE LOCATION]: src/services/firebaseRtdbRestService.ts
// [ROLE]: 싱가포르(asia-southeast1) Firebase Realtime Database(RTDB) 순수 REST API 통신 엔진
// [FEATURE]: 
//   1. WebSocket 상시 연결 완전 배제 (단기 HTTP fetch 사용으로 동시 접속 100개 제한 영향 0)
//   2. 60초 주기 위치 전송 및 50m 이내 미세 이동 시 업로드 패스 (Pass)
//   3. 반경 30km 위도 슬라이싱 REST 쿼리 및 Haversine 30km 정밀 필터링

import { UserProfile } from '../types';
import { calculateDistanceKm } from '../utils/geo';
import { getStoredFirebaseConfig } from './firebaseConfig';

// Base32 characters for Geohash
const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * 위도/경도를 Geohash 문자열로 인코딩하는 경량 고속 유틸리티
 */
export function encodeGeohash(lat: number, lng: number, precision = 6): string {
  let latMin = -90.0;
  let latMax = 90.0;
  let lngMin = -180.0;
  let lngMax = 180.0;

  let geohash = '';
  let isEven = true;
  let bit = 0;
  let ch = 0;

  while (geohash.length < precision) {
    if (isEven) {
      const mid = (lngMin + lngMax) / 2;
      if (lng > mid) {
        ch |= 1 << (4 - bit);
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat > mid) {
        ch |= 1 << (4 - bit);
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      geohash += GEOHASH_BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}

export interface RTDBUserLocationRecord {
  userId: string;
  email?: string;
  name: string;
  gender: string;
  company: string;
  age?: number;
  birthDate?: string;
  photoUrl: string;
  bio?: string;
  interests?: string[];
  lat: number;
  lng: number;
  geohash: string;
  geohash4: string;
  lastUpdated: number;
  createdAt?: number;
  lastActive?: number;
}

export class FirebaseRtdbRestService {
  // [업로드 최적화]: 직전에 파이어베이스 RTDB에 성공적으로 업로드된 사용자별 GPS 좌표 캐시
  private static lastUploadedCoords = new Map<string, { lat: number; lng: number; time: number }>();

  // [다운로드 최적화]: 메모리 캐시 (대역폭 중복 낭비 방지)
  private static cachedNearbyUsers: UserProfile[] = [];
  private static lastNearbyFetchTime = 0;
  private static lastFetchCenter: { lat: number; lng: number } | null = null;

  /**
   * 싱가포르(asia-southeast1) 또는 설정된 Firebase RTDB Base URL 반환
   */
  public static getDatabaseUrl(): string {
    const config = getStoredFirebaseConfig();
    let url = config?.databaseURL || '';
    if (!url) {
      const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
      url = env.VITE_FIREBASE_DATABASE_URL || '';
    }

    url = url.trim().replace(/\/$/, '');

    // 사용자 입력이 불완전하거나 결손되었을 경우 싱가포르 기본 엔드포인트 자동 조립
    if (
      !url ||
      url === 'https://firebasedatabase.app' ||
      url === 'http://firebasedatabase.app' ||
      url === '://firebasedatabase.app'
    ) {
      const projectId = config?.projectId || 'dating-app-kepco';
      url = `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`;
    }

    return url;
  }

  // =========================================================================
  // 1. [업로드 최적화] 50m 이내 미세 이동 시 HTTP 요청 Pass / 50m 초과 시만 HTTP PUT
  // =========================================================================
  public static async uploadMyLocation(
    user: UserProfile,
    latitude: number,
    longitude: number,
    force = false
  ): Promise<{ uploaded: boolean; reason: string }> {
    if (!user || !user.id || !latitude || !longitude) {
      return { uploaded: false, reason: 'invalid_arguments' };
    }

    const prev = this.lastUploadedCoords.get(user.id);

    // 📍 [최적화 규칙 1]: 사용자의 현재 GPS 좌표가 이전 좌표와 비교해 50m(0.05km) 이내이면 패스
    if (!force && prev) {
      const movedDistanceKm = calculateDistanceKm(prev.lat, prev.lng, latitude, longitude);
      if (movedDistanceKm <= 0.05) {
        const movedMeters = Math.round(movedDistanceKm * 1000);
        console.log(`[RTDB REST] 위치 변화 미미 (${movedMeters}m <= 50m). HTTP 요청 생략 (Spark 플랜 쿼터 절약)`);
        return { uploaded: false, reason: `movement_under_50m (${movedMeters}m)` };
      }
    }

    const geohash = encodeGeohash(latitude, longitude, 6);
    const geohash4 = geohash.slice(0, 4);
    const now = Date.now();

    const payload: RTDBUserLocationRecord = {
      userId: user.id,
      email: user.email,
      name: user.name || '무명 회원',
      gender: user.gender || 'male',
      company: user.company || '공공기관',
      age: user.age,
      birthDate: user.birthDate,
      photoUrl: user.photoUrl || '/assets/profiles/man_1.svg',
      bio: user.bio,
      interests: user.interests,
      lat: latitude,
      lng: longitude,
      geohash,
      geohash4,
      lastUpdated: now,
      createdAt: user.createdAt,
      lastActive: now,
    };

    const dbUrl = this.getDatabaseUrl();

    // 1) RTDB REST API 전송 (HTTP PUT - 단기 일회성 통신으로 동시 접속 0개 유지)
    if (dbUrl) {
      try {
        const targetUrl = `${dbUrl}/locations/${encodeURIComponent(user.id)}.json`;
        const res = await fetch(targetUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Connection': 'close',
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          this.lastUploadedCoords.set(user.id, { lat: latitude, lng: longitude, time: now });
          console.log(`[RTDB REST] 싱가포르 RTDB 위치 업로드 완료 (${user.name}: lat=${latitude.toFixed(4)}, lng=${longitude.toFixed(4)})`);
          return { uploaded: true, reason: 'rtdb_put_success' };
        } else {
          console.warn(`[RTDB REST] RTDB HTTP 상태코드: ${res.status} ${res.statusText}`);
        }
      } catch (err) {
        console.warn('[RTDB REST] 싱가포르 RTDB 위치 전송 오류 (백엔드 로컬 DB로 백업):', err);
      }
    }

    // 2) 백엔드 서버 로컬 데이터베이스에도 병렬 반영
    try {
      await fetch('/api/sync/user-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          location: { latitude, longitude, lastUpdated: now },
        }),
      });
    } catch {}

    this.lastUploadedCoords.set(user.id, { lat: latitude, lng: longitude, time: now });
    return { uploaded: true, reason: 'synced_local_db' };
  }

  // =========================================================================
  // 2. [반경 30km 다운로드 최적화] 위도 범위 쿼리(orderBy="lat") 및 Haversine 30km 필터
  // =========================================================================
  public static async fetchNearbyUsersWithin30Km(
    currentLat: number,
    currentLng: number,
    currentUserId?: string
  ): Promise<UserProfile[]> {
    const now = Date.now();

    // 1분(60초) 이내 동일 지점 요청 시 인메모리 캐시 재활용 (대역폭 낭비 방지)
    if (
      this.cachedNearbyUsers.length > 0 &&
      now - this.lastNearbyFetchTime < 45000 &&
      this.lastFetchCenter &&
      calculateDistanceKm(this.lastFetchCenter.lat, this.lastFetchCenter.lng, currentLat, currentLng) < 0.2
    ) {
      return this.cachedNearbyUsers;
    }

    const RADIUS_KM = 30.0;
    // 지구 위도 1도당 약 111.0km
    // 반경 30km에 해당하는 위도 변화량 (약 ±0.2703도)
    const deltaLat = +(RADIUS_KM / 111.0).toFixed(4);
    const minLat = +(currentLat - deltaLat).toFixed(4);
    const maxLat = +(currentLat + deltaLat).toFixed(4);

    const dbUrl = this.getDatabaseUrl();
    let records: RTDBUserLocationRecord[] = [];

    // 📍 [최적화 규칙 2]: 전체 다운로드가 아닌 내 위치 기준 '반경 30km' 위도 구간만 REST 쿼리
    if (dbUrl) {
      try {
        const queryUrl = `${dbUrl}/locations.json?orderBy="lat"&startAt=${minLat}&endAt=${maxLat}`;
        const res = await fetch(queryUrl, {
          method: 'GET',
          headers: { 'Connection': 'close' },
        });

        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            records = Object.values(data);
            console.log(`[RTDB REST 30km 최적화] 위도 구간 (${minLat}~${maxLat}) 내 ${records.length}명 수신`);
          }
        } else if (res.status === 400) {
          // 인덱스(.indexOn)가 아직 미등록된 경우 전체 목록으로 안전 폴백 후 클라이언트 거리 계산
          const fallbackRes = await fetch(`${dbUrl}/locations.json`, {
            headers: { 'Connection': 'close' },
          });
          if (fallbackRes.ok) {
            const fbData = await fallbackRes.json();
            if (fbData && typeof fbData === 'object') {
              records = Object.values(fbData);
            }
          }
        }
      } catch (err) {
        console.warn('[RTDB REST] 싱가포르 RTDB 30km 쿼리 실패, 백엔드 폴백 사용:', err);
      }
    }

    // RTDB 응답이 없거나 비어있는 경우 백엔드 서버에서 사용자 조회
    if (records.length === 0) {
      try {
        const res = await fetch('/api/sync/users');
        if (res.ok) {
          const allUsers = await res.json();
          if (Array.isArray(allUsers)) {
            records = allUsers
              .filter((u) => u.location?.latitude && u.location?.longitude)
              .map((u) => ({
                userId: u.id,
                name: u.name,
                gender: u.gender,
                company: u.company,
                age: u.age,
                photoUrl: u.photoUrl,
                bio: u.bio,
                interests: u.interests,
                lat: u.location.latitude,
                lng: u.location.longitude,
                geohash: encodeGeohash(u.location.latitude, u.location.longitude, 6),
                geohash4: encodeGeohash(u.location.latitude, u.location.longitude, 4),
                lastUpdated: u.location.lastUpdated || now,
              }));
          }
        }
      } catch {}
    }

    // 📍 Haversine 거리 공식으로 정확히 30km 이내의 회원만 정밀 필터링
    const nearbyFiltered: UserProfile[] = [];

    for (const r of records) {
      if (currentUserId && r.userId === currentUserId) continue;
      if (!r.lat || !r.lng) continue;

      const distKm = calculateDistanceKm(currentLat, currentLng, r.lat, r.lng);
      if (distKm <= RADIUS_KM) {
        nearbyFiltered.push({
          id: r.userId,
          email: r.email || `${r.userId}@kepco.co.kr`,
          name: r.name,
          gender: (r.gender as 'male' | 'female') || 'male',
          birthDate: r.birthDate || '1996-01-01',
          company: r.company,
          age: r.age || 28,
          photoUrl: r.photoUrl,
          bio: r.bio || '',
          interests: r.interests || [],
          location: {
            latitude: r.lat,
            longitude: r.lng,
            lastUpdated: r.lastUpdated,
          },
          approvalStatus: 'approved',
          verifiedEmail: true,
          isOnline: true,
          createdAt: r.createdAt || now - 86400000,
          lastActive: r.lastActive || now,
          popularity: 120,
        });
      }
    }

    this.cachedNearbyUsers = nearbyFiltered;
    this.lastNearbyFetchTime = now;
    this.lastFetchCenter = { lat: currentLat, lng: currentLng };

    return nearbyFiltered;
  }

  // =========================================================================
  // 3. [기관담당자 60초 자동심사 설정 RTDB REST 영구 기록]
  // =========================================================================
  public static async saveAutoApprove60sSetting(
    enabled: boolean,
    adminEmail?: string
  ): Promise<boolean> {
    const now = Date.now();
    const payload = {
      enabled,
      updatedAt: now,
      updatedBy: adminEmail || 'admin',
    };

    // 1) Firebase RTDB에 HTTP PUT 기록
    const dbUrl = this.getDatabaseUrl();
    if (dbUrl) {
      try {
        await fetch(`${dbUrl}/system_settings/autoApprove60s.json`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Connection': 'close',
          },
          body: JSON.stringify(payload),
        });
        console.log(`[RTDB REST] 60초 자동승인 설정 (${enabled ? 'ON' : 'OFF'}) 싱가포르 RTDB 기록 완료`);
      } catch (err) {
        console.warn('[RTDB REST] 60초 자동승인 RTDB 저장 실패:', err);
      }
    }

    // 2) 백엔드 서버 DB(/api/sync/settings)에 영구 기록
    try {
      const res = await fetch('/api/sync/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoApprove60sEnabled: enabled,
          updatedBy: adminEmail,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public static async getAutoApprove60sSetting(): Promise<boolean | null> {
    // 1) 백엔드 서버 DB 확인
    try {
      const res = await fetch('/api/sync/settings');
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.autoApprove60sEnabled === 'boolean') {
          return data.autoApprove60sEnabled;
        }
      }
    } catch {}

    // 2) Firebase RTDB 확인
    const dbUrl = this.getDatabaseUrl();
    if (dbUrl) {
      try {
        const res = await fetch(`${dbUrl}/system_settings/autoApprove60s.json`, {
          headers: { 'Connection': 'close' },
        });
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.enabled === 'boolean') {
            return data.enabled;
          }
        }
      } catch {}
    }

    return null;
  }
}

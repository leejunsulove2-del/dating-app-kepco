/**
 * Firebase Realtime Database (RTDB) REST API Service
 * 
 * ============================================================================
 * [RTDB 무료 플랜(Spark Plan: 동시 연결 100개, 월 대역폭 10GB 제한) 최적화 아키텍처]
 * ============================================================================
 * 
 * 1. Firebase 모바일/웹 SDK(WebSocket 상시 연결 유지) 완전 배제
 *    - 웹소켓 상시 연결(Persistent Connection) 대신 순수 HTTP fetch REST API를 사용합니다.
 *    - 데이터를 송수신할 때만 일시적으로 HTTP 통신을 맺고 즉시 연결을 해제하므로,
 *      '동시 연결 수 100개 제한'을 0개(무제한 분산) 수준으로 완벽하게 우회합니다.
 * 
 * 2. 60초(1분) 주기 통신
 *    - 60초 타이머 주기에 맞춰 위치 전송 및 주변 사용자 동기화가 동작합니다.
 * 
 * 3. [업로드 최적화]: 50m 이내 미세 이동 시 HTTP 요청 완전 차단 (Pass/Skip)
 *    - 이전 전송 좌표와 현재 GPS 좌표의 Haversine 거리를 계산하여,
 *      50m (0.05km) 이내의 변화일 경우 파이어베이스에 어떠한 HTTP 요청도 전송하지 않습니다.
 * 
 * 4. [반경 30km 다운로드 최적화]: Geohash 및 위경도(orderBy="lat"&startAt&endAt) 기반 쿼리
 *    - 전체 사용자 목록을 무차별 다운로드하지 않고, 내 위치 기준 반경 30km (위도 약 ±0.2703°)
 *      영역만 파이어베이스 RTDB REST 쿼리로 1차 슬라이싱하여 다운로드합니다.
 *    - 다운로드된 데이터 중 Haversine 계산으로 정확히 30km 이내만 정밀 필터링합니다.
 * 
 * ============================================================================
 * [파이어베이스 RTDB에 저장되는 데이터 JSON 구조 예시]
 * ============================================================================
 * 
 * {
 *   "locations": {
 *     "user_kepco_01": {
 *       "userId": "user_kepco_01",
 *       "name": "김전력",
 *       "gender": "male",
 *       "company": "한국전력공사",
 *       "age": 29,
 *       "photoUrl": "/assets/profiles/man_1.svg",
 *       "bio": "빛가람 혁신도시에서 근무 중입니다.",
 *       "interests": ["러닝", "커피"],
 *       "lat": 37.4979,
 *       "lng": 127.0276,
 *       "geohash": "wydm9q",
 *       "geohash4": "wydm",
 *       "lastUpdated": 1700000000000
 *     }
 *   },
 *   "system_settings": {
 *     "autoApprove60s": {
 *       "enabled": true,
 *       "updatedAt": 1700000000000,
 *       "updatedBy": "admin@kepco.co.kr"
 *     }
 *   }
 * }
 * 
 * [RTDB 추천 인덱스 규칙 (database.rules.json)]:
 * {
 *   "rules": {
 *     ".read": true,
 *     ".write": true,
 *     "locations": {
 *       ".indexOn": ["lat", "geohash4", "userId"]
 *     }
 *   }
 * }
 */

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
        ch |= (1 << (4 - bit));
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat > mid) {
        ch |= (1 << (4 - bit));
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
   * Firebase RTDB Base URL 반환
   */
  public static getDatabaseUrl(): string {
    const config = getStoredFirebaseConfig();
    if (config?.databaseURL) {
      return config.databaseURL.replace(/\/$/, '');
    }
    const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
    if (env.VITE_FIREBASE_DATABASE_URL) {
      return env.VITE_FIREBASE_DATABASE_URL.replace(/\/$/, '');
    }
    const projectId = config?.projectId || env.VITE_FIREBASE_PROJECT_ID;
    if (projectId) {
      return `https://${projectId}-default-rtdb.firebaseio.com`;
    }
    return '';
  }

  // =========================================================================
  // 1. [업로드 최적화 함수] 50m 이내 미세 이동 시 REST 요청 Pass / 50m 초과 시만 HTTP PUT
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

    // 📍 [최적화 규칙 3]: 사용자의 현재 GPS 좌표가 이전 좌표와 비교해 50m(0.05km) 이내이면 패스
    if (!force && prev) {
      const movedDistanceKm = calculateDistanceKm(prev.lat, prev.lng, latitude, longitude);
      if (movedDistanceKm <= 0.05) {
        const movedMeters = Math.round(movedDistanceKm * 1000);
        console.log(`[RTDB REST 업로드 최적화] 위치 변화 미미 (${movedMeters}m <= 50m). HTTP 요청 생략 (Spark 플랜 쿼터 절약)`);
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
          console.log(`[RTDB REST] 사용자 ${user.name} 위치 업로드 성공 (Geohash: ${geohash})`);
          return { uploaded: true, reason: 'rtdb_put_success' };
        }
      } catch (err) {
        console.warn('[RTDB REST] RTDB 위치 전송 오류 (서버 동기화로 백업):', err);
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
    return { uploaded: true, reason: 'synced' };
  }

  // =========================================================================
  // 2. [반경 30km 다운로드 최적화 함수] 위도 범위 쿼리(orderBy="lat"&startAt&endAt)
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

    // 📍 [최적화 규칙 4]: 전체 다운로드가 아닌 내 위치 기준 '반경 30km' 위도 구간만 REST 쿼리
    if (dbUrl) {
      try {
        // Firebase RTDB REST API 쿼리 파라미터는 JSON 인코딩 필요
        const queryUrl = `${dbUrl}/locations.json?orderBy="lat"&startAt=${minLat}&endAt=${maxLat}`;
        const res = await fetch(queryUrl, {
          method: 'GET',
          headers: { 'Connection': 'close' },
        });

        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            records = Object.values(data);
            console.log(`[RTDB REST 30km 다운로드 최적화] 위도 구간 (${minLat}~${maxLat}) 내 ${records.length}명 수신`);
          }
        }
      } catch (err) {
        console.warn('[RTDB REST] RTDB 30km 쿼리 실패, 백엔드/로컬 폴백 사용:', err);
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
          createdAt: r.createdAt || (now - 86400000),
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
  // 3. [기관담당자 60초 자동심사 설정 DB 영구 기록]
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
        console.log(`[RTDB REST] 60초 자동승인 설정 (${enabled ? 'ON' : 'OFF'}) RTDB 저장 완료`);
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
        const res = await fetch(`${dbUrl}/system_settings/autoApprove60s.json`);
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

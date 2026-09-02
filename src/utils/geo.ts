/**
 * Haversine formula to calculate distance between two coordinates in kilometers
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 1000) / 1000; // 3 decimal places (meter precision)
}

/**
 * Format distance to human friendly string (m or km)
 */
export function formatDistance(distanceKm?: number): string {
  if (distanceKm === undefined || isNaN(distanceKm)) return '위치 확인중';
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
}

/**
 * Calculate age from birth date string (YYYY-MM-DD)
 */
export function calculateAge(birthDateString: string): number {
  if (!birthDateString) return 20;
  const birth = new Date(birthDateString);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return isNaN(age) || age < 0 ? 25 : age;
}

/**
 * Format relative active time
 */
export function formatLastActive(lastActiveTimestamp?: number): string {
  if (!lastActiveTimestamp) return '방금 전';
  const diffMs = Math.max(0, Date.now() - lastActiveTimestamp);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 45) return '방금 접속';
  if (diffMin < 3) return '실시간 접속 중';
  if (diffMin < 60) return `${diffMin}분 전 접속`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}시간 전 접속`;
  return '오프라인';
}

/**
 * Determine user activity status category
 */
export function getUserActiveStatus(lastActiveTimestamp?: number): {
  status: 'online' | 'recent' | 'offline';
  label: string;
  minutesAgo: number;
  badgeColor: string;
  dotColor: string;
} {
  if (!lastActiveTimestamp) {
    return {
      status: 'online',
      label: '접속 중',
      minutesAgo: 0,
      badgeColor: 'bg-emerald-500/90 text-white',
      dotColor: 'bg-emerald-500',
    };
  }

  const diffMs = Math.max(0, Date.now() - lastActiveTimestamp);
  const minutesAgo = Math.floor(diffMs / 60000);

  if (minutesAgo < 3) {
    return {
      status: 'online',
      label: '접속 중',
      minutesAgo,
      badgeColor: 'bg-emerald-500/90 text-white',
      dotColor: 'bg-emerald-500',
    };
  } else if (minutesAgo <= 60) {
    return {
      status: 'recent',
      label: `${minutesAgo}분 전 접속`,
      minutesAgo,
      badgeColor: 'bg-amber-500/90 text-white',
      dotColor: 'bg-amber-400',
    };
  } else {
    return {
      status: 'offline',
      label: '1시간 이상 경과',
      minutesAgo,
      badgeColor: 'bg-stone-500/80 text-white',
      dotColor: 'bg-stone-400',
    };
  }
}

/**
 * Generate random coordinate offset around a center location (within km radius)
 */
export function getRandomCoordinateNearby(
  centerLat: number,
  centerLng: number,
  radiusKm: number
): { latitude: number; longitude: number } {
  // 1 degree latitude ~= 111.32 km
  const r = radiusKm / 111.32;
  const u = Math.random();
  const v = Math.random();
  const w = r * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  const x = w * Math.cos(t);
  const y = w * Math.sin(t);
  const newLat = centerLat + y;
  const newLng = centerLng + x / Math.cos((centerLat * Math.PI) / 180);

  return {
    latitude: Math.round(newLat * 100000) / 100000,
    longitude: Math.round(newLng * 100000) / 100000,
  };
}


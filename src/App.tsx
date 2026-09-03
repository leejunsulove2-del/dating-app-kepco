import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile, UserLocation, FilterOptions, AdminAccount } from './types';
import { DatingService } from './services/datingService';
import { FirebaseChatService } from './services/firebaseChatService';
import { ItemService } from './services/itemService';
import { AdminService } from './services/adminService';
import { FirestoreSyncService } from './services/firestoreSyncService'; // 📍 실시간 백엔드 연결 추가
import { calculateDistanceKm } from './utils/geo';
import { AuthModal } from './components/AuthModal';
import { ProfileSetupModal } from './components/ProfileSetupModal';
import { LocationConsentModal } from './components/LocationConsentModal';
import { MapView } from './components/MapView';
import { ProfileDetailModal } from './components/ProfileDetailModal';
import { ChatModal } from './components/ChatModal';
import { ChatListModal } from './components/ChatListModal';
import { NearbyUserList } from './components/NearbyUserList';
import { FilterDrawer } from './components/FilterDrawer';
import { Header } from './components/Header';
import { AttendanceWelcomeModal } from './components/AttendanceWelcomeModal';
import { TimeRewardModal } from './components/TimeRewardModal';
import { InventoryModal } from './components/InventoryModal';
import { BoxOpenModal } from './components/BoxOpenModal';
import { AdminDashboard } from './components/AdminDashboard';
import { SanctionNoticeModal } from './components/SanctionNoticeModal';

export default function App() {
  const [currentAdmin, setCurrentAdmin] = useState<AdminAccount | null>(() => {
    return AdminService.getCurrentAdminSession();
  });

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    return DatingService.getCurrentUser();
  });

  const [authModalOpen, setAuthModalOpen] = useState(!currentUser);
  const [profileSetupOpen, setProfileSetupOpen] = useState(false);
  const [tempUserForSetup, setTempUserForSetup] = useState<UserProfile | null>(null);

  const [locationConsentOpen, setLocationConsentOpen] = useState(false);
  const [hasLocationConsent, setHasLocationConsent] = useState(false);

  const [currentLocation, setCurrentLocation] = useState<UserLocation>(() => {
    if (currentUser?.location) return currentUser.location;
    return {
      latitude: DatingService.DEFAULT_CENTER.latitude,
      longitude: DatingService.DEFAULT_CENTER.longitude,
      lastUpdated: Date.now(),
    };
  });

  const [nearbyUsers, setNearbyUsers] = useState<UserProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [chatTarget, setChatTarget] = useState<UserProfile | null>(null);
  const [isChatListOpen, setIsChatListOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isTrayExpanded, setIsTrayExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Gamification Modals
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [timeRewardModalOpen, setTimeRewardModalOpen] = useState(false);
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [boxOpenModalOpen, setBoxOpenModalOpen] = useState(false);
  const [inventoryVersion, setInventoryVersion] = useState(0);

  // Filter state
  const [filter, setFilter] = useState<FilterOptions>({
    maxDistanceKm: 1, // Default 1km per user specification
    minAge: 20,
    maxAge: 40,
    selectedInterests: [],
    genderFilter: 'all',
  });
  // Keep latest refs to avoid re-creating callbacks and triggering infinite effect loops
  const currentUserRef = useRef<UserProfile | null>(currentUser);
  currentUserRef.current = currentUser;

  const currentLocationRef = useRef<UserLocation>(currentLocation);
  currentLocationRef.current = currentLocation;

  const filterRef = useRef<FilterOptions>(filter);
  filterRef.current = filter;

  // 📍 [파이어베이스 Spark 요금제 최적화] 이전 동기화 위치 추적 Ref (50m 이내 미세 이동 시 Firestore 쓰기 스킵)
  const lastSyncedLocationRef = useRef<{ latitude: number; longitude: number } | null>(
    currentUser?.location ? { latitude: currentUser.location.latitude, longitude: currentUser.location.longitude } : null
  );

  // 120-Second (2-Minute) batch interval synchronization state (individualized per session/active time)
  const [syncCountdown, setSyncCountdown] = useState(120);
  const [isSyncing, setIsSyncing] = useState(false);

  const triggerInventoryReload = useCallback(() => {
    setInventoryVersion((v) => v + 1);
  }, []);

  // 📍 [개정] 기기의 GPS 하드웨어 데이터를 파이어베이스 실시간 서버 인프라에 즉각 스트리밍 (50m 이내 미세 이동 최적화)
  const requestAccurateLocation = useCallback((silent = false) => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      if (!silent) setIsSyncing(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const loc: UserLocation = {
            latitude,
            longitude,
            accuracy,
            lastUpdated: Date.now(),
          };
          setCurrentLocation(loc);
          setHasLocationConsent(true);

          const user = currentUserRef.current;
          if (user) {
            const updatedUser = {
              ...user,
              location: loc,
              lastActive: Date.now(),
            };
            DatingService.saveCurrentUser(updatedUser);
            setCurrentUser(updatedUser);
            
            // 📍 [Spark 무료 플랜 최적화] 이전 동기화 위치와 비교하여 50m(0.05km) 이하 미세 변화 시 Firestore 업로드 생략(스킵)
            const prev = lastSyncedLocationRef.current;
            const distanceChangedKm = prev
              ? calculateDistanceKm(prev.latitude, prev.longitude, latitude, longitude)
              : 999;

            if (distanceChangedKm > 0.05) {
              lastSyncedLocationRef.current = { latitude, longitude };
              // 🚀 실시간 위치 데이터베이스로 전송 단차 연결
              FirestoreSyncService.uploadMyLocation(user.id, latitude, longitude);
            }
          }

          DatingService.initDatabase(latitude, longitude, true);
          if (!silent) {
            setTimeout(() => setIsSyncing(false), 300);
          }
        },
        (err) => {
          console.warn('GPS location retrieval info:', err);
          if (!silent) setIsSyncing(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    }
  }, []);

  // Real-time unread messages count listener
  useEffect(() => {
    const userId = currentUser?.id;
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    const unsubscribe = FirebaseChatService.subscribeToUserRooms(userId, (rooms) => {
      const total = FirebaseChatService.calculateTotalUnread(rooms, userId);
      setUnreadCount(total);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id]);

  // 📍 [개정] 최초 컴포넌트 마운트 시 실시간 위치 스트리밍 가동 및 상호 작용 구독
  useEffect(() => {
    try {
      FirebaseChatService.purgeExpiredAndOptimizeMessages();
    } catch {
      // ignore
    }

    DatingService.initDatabase(currentLocation.latitude, currentLocation.longitude);
    requestAccurateLocation(true);

    // 🚀 Multi-device real-time users synchronization
    const unsubLiveUsers = DatingService.subscribeToLiveUsers(() => {
      if (currentUserRef.current) {
        const isAntennaOn = ItemService.isBoostRadiusActive(currentUserRef.current.id);
        const effectiveFilter = {
          ...filterRef.current,
          maxDistanceKm: isAntennaOn ? filterRef.current.maxDistanceKm : 1.0,
        };
        const filteredNearby = DatingService.fetchNearbyUsers(
          currentLocationRef.current.latitude,
          currentLocationRef.current.longitude,
          currentUserRef.current.id,
          effectiveFilter
        );
        setNearbyUsers(filteredNearby);
      }
    });

    let unsubLiveLocation: (() => void) | null = null;

    if (currentUser) {
      // 🚀 클라우드 파이어베이스 서버의 다른 모든 회원 실시간 위치 구독 개시 (onSnapshot 연동)
      FirestoreSyncService.subscribeMembersLocation(currentUser.id, (cloudUsers) => {
        const isAntennaOn = ItemService.isBoostRadiusActive(currentUser.id);
        const effectiveFilter = {
          ...filterRef.current,
          maxDistanceKm: isAntennaOn ? filterRef.current.maxDistanceKm : 1.0,
        };

        // 메모리 DB 동기화 동시 처리
        DatingService.updateInternalUsersData(cloudUsers);
        
        const filteredNearby = DatingService.fetchNearbyUsers(
          currentLocationRef.current.latitude,
          currentLocationRef.current.longitude,
          currentUser.id,
          effectiveFilter
        );
        setNearbyUsers(filteredNearby);
      });

      unsubLiveLocation = () => {
        FirestoreSyncService.unsubscribeMembersLocation();
      };

      if (!currentUser.company || !currentUser.birthDate || !currentUser.photoUrl) {
        setTempUserForSetup(currentUser);
        setProfileSetupOpen(true);
      } else {
        setHasLocationConsent(true);

        // Check if attendance is unclaimed today
        const daily = ItemService.getDailyActivity(currentUser.id);
        if (!daily.attendanceClaimed) {
          setTimeout(() => {
            setAttendanceModalOpen(true);
          }, 800);
        } else {
          const timeRewardStatus = ItemService.getTimeRewardStatus(currentUser.id);
          if (timeRewardStatus.isEligibleNow) {
            setTimeout(() => {
              setTimeRewardModalOpen(true);
            }, 800);
          }
        }
      }
    } else if (!currentAdmin) {
      setAuthModalOpen(true);
    }

    return () => {
      if (unsubLiveUsers) unsubLiveUsers();
      if (unsubLiveLocation) unsubLiveLocation();
    };
  }, [currentUser?.id]);
  // 📍 [개정] 수동 고속 새로고침 및 하드웨어 동기화 핸들러 개조 (120초 주기 및 50m 이내 스킵 최적화)
  const performLocationSync = useCallback(() => {
    const user = currentUserRef.current;
    if (!user) return;

    setIsSyncing(true);

    // 하드웨어 실시간 GPS 정보 전송 트래킹 강제 호출
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        const loc = { latitude, longitude, lastUpdated: Date.now() };
        
        setCurrentLocation(loc);

        // 📍 [Spark 무료 플랜 최적화] 이전 동기화 위치와 비교하여 50m(0.05km) 이하 미세 변화 시 Firestore 업로드 및 위치 동기화 생략(스킵)
        const prev = lastSyncedLocationRef.current;
        const distanceChangedKm = prev
          ? calculateDistanceKm(prev.latitude, prev.longitude, latitude, longitude)
          : 999;

        if (distanceChangedKm > 0.05) {
          lastSyncedLocationRef.current = { latitude, longitude };
          FirestoreSyncService.uploadMyLocation(user.id, latitude, longitude);
          DatingService.syncUserLocation(user.id, loc);
        }

        const isAntennaOn = ItemService.isBoostRadiusActive(user.id);
        const effectiveFlt = {
          ...filterRef.current,
          maxDistanceKm: isAntennaOn ? filterRef.current.maxDistanceKm : 1.0,
        };
        const users = DatingService.fetchNearbyUsers(latitude, longitude, user.id, effectiveFlt);
        setNearbyUsers(users);
        setSyncCountdown(120);
        setIsSyncing(false);
      }, () => {
        setIsSyncing(false);
      }, { enableHighAccuracy: true });
    }
  }, []);

  // 120초(2분) 단위로 수동 타이머 동기화 보조 가동 (안전 장치)
  useEffect(() => {
    if (!currentUser?.id || !hasLocationConsent) return;

    const interval = setInterval(() => {
      setSyncCountdown((prev) => {
        if (prev <= 1) {
          performLocationSync();
          return 120;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentUser?.id, hasLocationConsent, performLocationSync]);

  // 필터 혹은 인벤토리 변경에 대응하는 수동 가속 트리거
  useEffect(() => {
    if (currentUser && hasLocationConsent) {
      const isAntennaOn = ItemService.isBoostRadiusActive(currentUser.id);
      const effectiveFilter = {
        ...filter,
        maxDistanceKm: isAntennaOn ? filter.maxDistanceKm : 1.0,
      };
      const users = DatingService.fetchNearbyUsers(
        currentLocation.latitude,
        currentLocation.longitude,
        currentUser.id,
        effectiveFilter
      );
      setNearbyUsers(users);
    }
  }, [
    filter.maxDistanceKm,
    filter.minAge,
    filter.maxAge,
    filter.genderFilter,
    filter.selectedInterests,
    currentUser?.id,
    hasLocationConsent,
    currentLocation.latitude,
    currentLocation.longitude,
    inventoryVersion,
  ]);

  // Auth Success Handlers
  const handleAuthSuccess = (user: UserProfile, isNewUser: boolean) => {
    setAuthModalOpen(false);
    if (isNewUser || !user.company || !user.birthDate || !user.photoUrl) {
      setTempUserForSetup(user);
      setProfileSetupOpen(true);
    } else {
      setCurrentUser(user);
      setHasLocationConsent(true);
      DatingService.saveCurrentUser(user);
      
      // 로그인 완료 시 내 기기 위치 최초 전송 쏘기
      lastSyncedLocationRef.current = { latitude: currentLocation.latitude, longitude: currentLocation.longitude };
      FirestoreSyncService.uploadMyLocation(user.id, currentLocation.latitude, currentLocation.longitude);
      
      const users = DatingService.fetchNearbyUsers(
        currentLocation.latitude,
        currentLocation.longitude,
        user.id,
        filter
      );
      setNearbyUsers(users);

      const daily = ItemService.getDailyActivity(user.id);
      if (!daily.attendanceClaimed) {
        setTimeout(() => {
          setAttendanceModalOpen(true);
        }, 800);
      }
    }
  };

  const handleProfileComplete = (completedUser: UserProfile) => {
    setCurrentUser(completedUser);
    setProfileSetupOpen(false);
    setHasLocationConsent(true);
    DatingService.saveCurrentUser(completedUser);

    lastSyncedLocationRef.current = { latitude: currentLocation.latitude, longitude: currentLocation.longitude };
    FirestoreSyncService.uploadMyLocation(completedUser.id, currentLocation.latitude, currentLocation.longitude);

    const users = DatingService.fetchNearbyUsers(
      currentLocation.latitude,
      currentLocation.longitude,
      completedUser.id,
      filter
    );
    setNearbyUsers(users);

    const daily = ItemService.getDailyActivity(completedUser.id);
    if (!daily.attendanceClaimed) {
      setTimeout(() => {
        setAttendanceModalOpen(true);
      }, 800);
    }
  };

  const handleLocationConsent = (coords: { latitude: number; longitude: number }) => {
    const loc: UserLocation = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      lastUpdated: Date.now(),
    };

    setCurrentLocation(loc);
    setHasLocationConsent(true);
    setLocationConsentOpen(false);

    if (currentUser) {
      const updated = DatingService.syncUserLocation(currentUser.id, loc);
      if (updated) setCurrentUser(updated);

      // 📍 [개정] 위치 권한 동의 완료 시 즉각 클라우드 전송 트리거
      lastSyncedLocationRef.current = { latitude: coords.latitude, longitude: coords.longitude };
      FirestoreSyncService.uploadMyLocation(currentUser.id, coords.latitude, coords.longitude);
      DatingService.initDatabase(coords.latitude, coords.longitude);
      
      const users = DatingService.fetchNearbyUsers(
        coords.latitude,
        coords.longitude,
        currentUser.id,
        filter
      );
      setNearbyUsers(users);
    }
  };

  const handleLogout = () => {
    DatingService.logout();
    setCurrentUser(null);
    setHasLocationConsent(false);
    setAuthModalOpen(true);
  };

  const handleAdminLogin = (admin: AdminAccount) => {
    AdminService.saveCurrentAdminSession(admin);
    setCurrentAdmin(admin);
    setAuthModalOpen(false);
  };

  const handleAdminLogout = () => {
    AdminService.saveCurrentAdminSession(null);
    setCurrentAdmin(null);
    setAuthModalOpen(true);
  };

  const handleStartChatFromProfile = (target: UserProfile) => {
    setSelectedProfile(null);
    setChatTarget(target);
  };

  const handleProfileDataChanged = () => {
    if (currentUser) {
      const users = DatingService.fetchNearbyUsers(
        currentLocation.latitude,
        currentLocation.longitude,
        currentUser.id,
        filter
      );
      setNearbyUsers(users);
      triggerInventoryReload();
    }
  };

  const [hasTestAccounts, setHasTestAccounts] = useState<boolean>(() => DatingService.hasTestAccounts());

  const handleDeleteAllTestAccounts = useCallback(() => {
    const res = DatingService.deleteAllTestAccounts();
    setHasTestAccounts(false);
    if (currentUserRef.current) {
      const users = DatingService.fetchNearbyUsers(
        currentLocationRef.current.latitude,
        currentLocationRef.current.longitude,
        currentUserRef.current.id,
        filterRef.current
      );
      setNearbyUsers(users);
    }
    alert(`테스트 계정 ${res.count}개가 모두 삭제되었습니다.`);
  }, []);

  const handleRecreateTestAccounts = useCallback(() => {
    DatingService.recreateTestAccounts(
      currentLocationRef.current.latitude,
      currentLocationRef.current.longitude
    );
    setHasTestAccounts(true);
    if (currentUserRef.current) {
      const users = DatingService.fetchNearbyUsers(
        currentLocationRef.current.latitude,
        currentLocationRef.current.longitude,
        currentUserRef.current.id,
        filterRef.current
      );
      setNearbyUsers(users);
    }
    alert('내 주변에 다양한 거리(0.2km ~ 28km)의 테스트 계정이 다시 배치되었습니다.');
  }, []);

  const handleResetAndRecreateTestAccounts = useCallback(() => {
    const res = DatingService.resetAndRecreateRandomDistanceTestAccounts(
      currentLocationRef.current.latitude,
      currentLocationRef.current.longitude
    );
    setHasTestAccounts(true);
    if (currentUserRef.current) {
      const users = DatingService.fetchNearbyUsers(
        currentLocationRef.current.latitude,
        currentLocationRef.current.longitude,
        currentUserRef.current.id,
        filterRef.current
      );
      setNearbyUsers(users);
    }
    alert(`[완료] 기존 테스트 계정을 모두 삭제하고, 내 주변 랜덤 반경(0.2km ~ 28km)으로 새 테스트 계정 ${res.newUsers.length}명이 생성되었습니다!`);
  }, []);
  // Get active search radius (1km base or user-selected distance up to 30km when antenna is active)
  const isAntennaActive = currentUser ? ItemService.isBoostRadiusActive(currentUser.id) : false;
  const activeRadiusKm = isAntennaActive ? filter.maxDistanceKm : 1.0;

  // If logged in as Admin, render Admin Dashboard interface
  if (currentAdmin) {
    return (
      <AdminDashboard
        currentAdmin={currentAdmin}
        onLogout={handleAdminLogout}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-stone-100 font-sans text-stone-900">
      {/* Top Navigation Header */}
      {currentUser && (
        <Header
          key={`header-${inventoryVersion}`}
          currentUser={currentUser}
          syncCountdown={syncCountdown}
          isSyncing={isSyncing}
          activeRadiusKm={activeRadiusKm}
          onManualRefresh={performLocationSync}
          onOpenFilter={() => setIsFilterOpen(true)}
          onOpenProfile={() => {
            setTempUserForSetup(currentUser);
            setProfileSetupOpen(true);
          }}
          onOpenChatList={() => setIsChatListOpen(true)}
          onOpenAttendance={() => setAttendanceModalOpen(true)}
          onOpenTimeReward={() => setTimeRewardModalOpen(true)}
          onOpenInventory={() => setInventoryModalOpen(true)}
          onLogout={handleLogout}
          unreadCount={unreadCount}
        />
      )}

      {/* Main Map View Area */}
      <main className="flex-1 relative w-full h-full overflow-hidden">
        {currentUser && hasLocationConsent ? (
          <>
            <MapView
              currentLocation={currentLocation}
              currentUser={currentUser}
              nearbyUsers={nearbyUsers}
              selectedUser={selectedProfile}
              onSelectUser={(user) => setSelectedProfile(user)}
              radiusKm={activeRadiusKm}
              onManualRefresh={performLocationSync}
              onRefreshGpsLocation={() => requestAccurateLocation(false)}
              syncCountdown={syncCountdown}
            />

            {/* Bottom Nearby List Drawer */}
            <NearbyUserList
              nearbyUsers={nearbyUsers}
              currentUserId={currentUser.id}
              selectedUser={selectedProfile}
              onSelectUser={(user) => setSelectedProfile(user)}
              isExpanded={isTrayExpanded}
              onToggleExpand={() => setIsTrayExpanded(!isTrayExpanded)}
            />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-stone-50">
            <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-500 flex items-center justify-center mb-4">
              <span className="text-3xl">💘</span>
            </div>
            <h2 className="text-xl font-bold text-stone-800">연애의 지도 시작하기</h2>
            <p className="text-stone-500 text-sm max-w-sm mt-1 mb-4">
              회원가입 및 로그인 후 위치 권한에 동의하시면 실시간으로 반경 내 상대방을 탐색할 수 있습니다.
            </p>
            <button
              type="button"
              id="start-login-btn"
              onClick={() => setAuthModalOpen(true)}
              className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm rounded-2xl shadow-lg shadow-rose-200 transition cursor-pointer"
            >
              로그인 / 회원가입
            </button>
          </div>
        )}
      </main>

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        onSuccess={handleAuthSuccess}
        onAdminLogin={handleAdminLogin}
      />

      {/* Active Sanctions / Ban / Compensation Modal */}
      {currentUser && (
        <SanctionNoticeModal
          user={currentUser}
          onLogout={handleLogout}
          onRewardClaimed={triggerInventoryReload}
        />
      )}

      {tempUserForSetup && (
        <ProfileSetupModal
          isOpen={profileSetupOpen}
          initialUser={tempUserForSetup}
          onComplete={handleProfileComplete}
        />
      )}

      <LocationConsentModal
        isOpen={locationConsentOpen}
        onConsent={handleLocationConsent}
      />

      <ProfileDetailModal
        user={selectedProfile}
        currentUserId={currentUser?.id || ''}
        onClose={() => setSelectedProfile(null)}
        onStartChat={handleStartChatFromProfile}
        onProfileUpdated={handleProfileDataChanged}
      />

      {currentUser && (
        <ChatModal
          isOpen={!!chatTarget}
          currentUser={currentUser}
          targetUser={chatTarget}
          onClose={() => setChatTarget(null)}
          onInventoryUpdated={triggerInventoryReload}
          onOpenInventory={() => setInventoryModalOpen(true)}
        />
      )}

      {currentUser && (
        <ChatListModal
          isOpen={isChatListOpen}
          currentUser={currentUser}
          nearbyUsers={nearbyUsers}
          onClose={() => setIsChatListOpen(false)}
          onSelectChat={(user) => setChatTarget(user)}
        />
      )}

      <FilterDrawer
        isOpen={isFilterOpen}
        filter={filter}
        onChange={setFilter}
        onClose={() => setIsFilterOpen(false)}
        currentUser={currentUser}
        onInventoryUpdated={triggerInventoryReload}
        hasTestAccounts={hasTestAccounts}
        onDeleteTestAccounts={handleDeleteAllTestAccounts}
        onRecreateTestAccounts={handleRecreateTestAccounts}
        onResetAndRecreateTestAccounts={handleResetAndRecreateTestAccounts}
      />

      {/* Daily Attendance Modal (Focused exclusively on daily reward claiming) */}
      {currentUser && (
        <AttendanceWelcomeModal
          isOpen={attendanceModalOpen}
          onClose={() => setAttendanceModalOpen(false)}
          currentUser={currentUser}
          onInventoryUpdated={triggerInventoryReload}
          onOpenBoxModal={() => setBoxOpenModalOpen(true)}
        />
      )}

      {/* Special Time-Based Reward Modal (Weekday Lunch 11:30~13:00 or Weekend/Holiday All Day x3) */}
      {currentUser && (
        <TimeRewardModal
          isOpen={timeRewardModalOpen}
          onClose={() => setTimeRewardModalOpen(false)}
          currentUser={currentUser}
          onInventoryUpdated={triggerInventoryReload}
          onOpenBoxModal={() => setBoxOpenModalOpen(true)}
        />
      )}

      {/* Consumable Items Inventory Modal */}
      {currentUser && (
        <InventoryModal
          isOpen={inventoryModalOpen}
          onClose={() => setInventoryModalOpen(false)}
          currentUser={currentUser}
          onInventoryUpdated={triggerInventoryReload}
          onOpenBoxModal={() => setBoxOpenModalOpen(true)}
        />
      )}

      {/* Dedicated Clean Welcome Box Opening Modal */}
      {currentUser && (
        <BoxOpenModal
          isOpen={boxOpenModalOpen}
          onClose={() => setBoxOpenModalOpen(false)}
          currentUser={currentUser}
          onInventoryUpdated={triggerInventoryReload}
        />
      )}
    </div>
  );
}

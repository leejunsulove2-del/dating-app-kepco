import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile, UserLocation, FilterOptions, AdminAccount } from './types';
import { DatingService } from './services/datingService';
import { FirebaseChatService } from './services/firebaseChatService';
import { ItemService } from './services/itemService';
import { AdminService } from './services/adminService';
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

  // 30-Second batch interval synchronization state (individualized per session/active time)
  const [syncCountdown, setSyncCountdown] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);

  const triggerInventoryReload = useCallback(() => {
    setInventoryVersion((v) => v + 1);
  }, []);

  // Accurate Geolocation Retrieval
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
          }

          // Relocate nearby pool around the user's real GPS coordinates
          DatingService.initDatabase(latitude, longitude, true);

          if (user) {
            const users = DatingService.fetchNearbyUsers(
              latitude,
              longitude,
              user.id,
              filterRef.current
            );
            setNearbyUsers(users);
          }
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

  // Check login, location consent & daily attendance prompt upon mount + DB Optimization Sweep + Cloud Firestore Sync
  useEffect(() => {
    // Run 72-hour TTL message purge & local storage DB optimization
    try {
      FirebaseChatService.purgeExpiredAndOptimizeMessages();
    } catch {
      // ignore
    }

    DatingService.initDatabase(currentLocation.latitude, currentLocation.longitude);
    requestAccurateLocation(true);

    // Sync all users from Cloud Firestore & subscribe to real-time changes
    DatingService.syncFromCloudFirestore().then((cloudUsers) => {
      if (currentUserRef.current) {
        const freshCurrent = cloudUsers.find((u) => u.id === currentUserRef.current?.id);
        if (freshCurrent) {
          setCurrentUser(freshCurrent);
        }
        const users = DatingService.fetchNearbyUsers(
          currentLocationRef.current.latitude,
          currentLocationRef.current.longitude,
          currentUserRef.current.id,
          filterRef.current
        );
        setNearbyUsers(users);
      }
    });

    const unsubLiveUsers = DatingService.subscribeToLiveUsers((allUsers) => {
      if (currentUserRef.current) {
        const freshCurrent = allUsers.find((u) => u.id === currentUserRef.current?.id);
        if (freshCurrent) {
          setCurrentUser(freshCurrent);
        }
        const users = DatingService.fetchNearbyUsers(
          currentLocationRef.current.latitude,
          currentLocationRef.current.longitude,
          currentUserRef.current.id,
          filterRef.current
        );
        setNearbyUsers(users);
      }
    });

    if (currentUser) {
      if (!currentUser.company || !currentUser.birthDate || !currentUser.photoUrl) {
        setTempUserForSetup(currentUser);
        setProfileSetupOpen(true);
      } else {
        setHasLocationConsent(true);
        const users = DatingService.fetchNearbyUsers(
          currentLocation.latitude,
          currentLocation.longitude,
          currentUser.id,
          filter
        );
        setNearbyUsers(users);

        // Check if attendance is unclaimed today
        const daily = ItemService.getDailyActivity(currentUser.id);
        if (!daily.attendanceClaimed) {
          setTimeout(() => {
            setAttendanceModalOpen(true);
          }, 800);
        } else {
          // If attendance is already claimed, check if time-based reward is available right now
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
      unsubLiveUsers();
    };
  }, []);

  // Location synchronization handler (Transmits only coordinates, fetches nearby, runs on individual 30s cycle)
  const performLocationSync = useCallback(() => {
    const user = currentUserRef.current;
    if (!user) return;

    const loc = currentLocationRef.current;
    const currentFlt = filterRef.current;

    setIsSyncing(true);
    DatingService.syncUserLocation(user.id, loc);

    // Fetch updated nearby users within permitted radius (1km base or user chosen radius up to 30km when antenna active)
    const isAntennaOn = ItemService.isBoostRadiusActive(user.id);
    const effectiveFlt = {
      ...currentFlt,
      maxDistanceKm: isAntennaOn ? currentFlt.maxDistanceKm : 1.0,
    };
    const users = DatingService.fetchNearbyUsers(
      loc.latitude,
      loc.longitude,
      user.id,
      effectiveFlt
    );

    setNearbyUsers(users);
    setSyncCountdown(30);

    setTimeout(() => {
      setIsSyncing(false);
    }, 400);
  }, []);

  // 30-Second interval timer based on individual session connection timestamp
  useEffect(() => {
    if (!currentUser?.id || !hasLocationConsent) return;

    const interval = setInterval(() => {
      setSyncCountdown((prev) => {
        if (prev <= 1) {
          performLocationSync();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentUser?.id, hasLocationConsent, performLocationSync]);

  // Re-fetch when filter or inventory changes (e.g. radius boost activated)
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

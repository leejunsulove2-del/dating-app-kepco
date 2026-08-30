import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { UserProfile, UserLocation } from '../types';
import { formatDistance, getUserActiveStatus } from '../utils/geo';
import { Compass, ZoomIn, ZoomOut, Navigation, LocateFixed, Clock, Radio } from 'lucide-react';

interface MapViewProps {
  currentLocation: UserLocation;
  currentUser: UserProfile;
  nearbyUsers: UserProfile[];
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  radiusKm: number;
  onManualRefresh: () => void;
  onRefreshGpsLocation?: () => void;
  syncCountdown: number;
}

export const MapView: React.FC<MapViewProps> = ({
  currentLocation,
  currentUser,
  nearbyUsers,
  selectedUser,
  onSelectUser,
  radiusKm,
  onManualRefresh,
  onRefreshGpsLocation,
  syncCountdown,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // Safety: clean up any stale leaflet instance attached to the DOM container
    if ((container as unknown as { _leaflet_id?: string | number })._leaflet_id) {
      delete (container as unknown as { _leaflet_id?: string | number })._leaflet_id;
    }

    try {
      if (!mapInstanceRef.current) {
        const map = L.map(container, {
          center: [currentLocation.latitude, currentLocation.longitude],
          zoom: 14,
          zoomControl: false,
          attributionControl: false,
        });

        // Free OpenStreetMap Tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        const markersGroup = L.layerGroup().addTo(map);
        markersGroupRef.current = markersGroup;

        const userLayer = L.layerGroup().addTo(map);
        userLayerRef.current = userLayer;

        mapInstanceRef.current = map;

        // Force Leaflet to recalculate container geometry
        setTimeout(() => {
          map.invalidateSize();
        }, 150);
        setTimeout(() => {
          map.invalidateSize();
        }, 600);
      }
    } catch (err) {
      console.warn('Leaflet map initialization warning:', err);
    }

    // Auto-resize on layout or window changes
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && container) {
      resizeObserver = new ResizeObserver(() => {
        mapInstanceRef.current?.invalidateSize();
      });
      resizeObserver.observe(container);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        userLayerRef.current = null;
        markersGroupRef.current = null;
      }
      if (container && (container as unknown as { _leaflet_id?: string | number })._leaflet_id) {
        delete (container as unknown as { _leaflet_id?: string | number })._leaflet_id;
      }
    };
  }, []);

  // Update Center & Current User ("나") Marker & Range Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    const userLayer = userLayerRef.current;
    if (!map || !userLayer) return;

    userLayer.clearLayers();

    const lat = currentLocation.latitude;
    const lng = currentLocation.longitude;

    // Radius circle
    const circle = L.circle([lat, lng], {
      radius: radiusKm * 1000,
      color: '#f43f5e',
      fillColor: '#f43f5e',
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '4, 6',
    });
    userLayer.addLayer(circle);

    // Profile photo fallback
    const userPhoto = currentUser.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
    const isSelected = selectedUser?.id === currentUser.id;

    // "나" (Current User) Profile Pin with exact matching profile card shape and prominent "나" badge
    const userHtml = `
      <div class="relative w-14 h-14 flex items-center justify-center cursor-pointer select-none group transition-transform duration-200 hover:scale-110">
        <!-- Subtle pulsing background radar for "나" -->
        <div class="absolute inset-0 m-auto w-14 h-14 bg-rose-500/25 rounded-full animate-ping pointer-events-none"></div>

        <!-- Avatar Container (Matching other profiles) -->
        <div class="relative w-11 h-11 rounded-2xl border-2 ${
          isSelected ? 'border-rose-600 ring-4 ring-rose-300 shadow-2xl' : 'border-rose-500 ring-4 ring-rose-200/90 shadow-xl'
        } overflow-hidden bg-rose-50 flex items-center justify-center">
          <img src="${userPhoto}" alt="나" class="w-full h-full object-cover" />
          
          <!-- Online status dot -->
          <span class="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-emerald-500 animate-pulse ring-1 ring-white border-2 border-white rounded-full"></span>
        </div>

        <!-- Floating Name & "나" Pill with Status -->
        <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-rose-600 text-white border border-rose-700 px-2 py-0.5 rounded-full shadow-md text-[10px] font-extrabold flex items-center gap-1 whitespace-nowrap z-30">
          <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
          <span>나 (${currentUser.name})</span>
          <span class="text-[9px] bg-white/25 px-1 py-0.2 rounded text-rose-100 font-semibold">내 위치</span>
        </div>
      </div>
    `;

    const userIcon = L.divIcon({
      html: userHtml,
      className: 'custom-user-marker',
      iconSize: [56, 56],
      iconAnchor: [28, 28],
    });

    const userMarker = L.marker([lat, lng], {
      icon: userIcon,
      zIndexOffset: 9000,
    });

    userMarker.on('click', () => {
      onSelectUser(currentUser);
    });

    userLayer.addLayer(userMarker);
  }, [currentLocation, currentUser, radiusKm, selectedUser, onSelectUser]);

  // Auto pan to user location on update
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.panTo([currentLocation.latitude, currentLocation.longitude], { animate: true });
  }, [currentLocation.latitude, currentLocation.longitude]);

  // Update Nearby Markers with clear Online (🟢) vs Recent (🟡 1-Hour) visual distinction
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    nearbyUsers.forEach((user) => {
      if (!user.location) return;

      const isSelected = selectedUser?.id === user.id;
      const statusInfo = getUserActiveStatus(user.lastActive);
      const isOnline = statusInfo.status === 'online';

      const markerHtml = `
        <div class="relative w-12 h-12 flex items-center justify-center cursor-pointer select-none group transition-transform duration-200 ${
          isSelected ? 'scale-125 z-50' : 'hover:scale-110'
        }">
          <!-- Avatar Container -->
          <div class="relative w-10 h-10 rounded-2xl border-2 ${
            isSelected
              ? 'border-rose-500 ring-4 ring-rose-300 shadow-2xl'
              : isOnline
              ? 'border-white shadow-lg ring-2 ring-emerald-400'
              : 'border-white shadow-md opacity-95'
          } overflow-hidden bg-stone-100 flex items-center justify-center">
            <img src="${user.photoUrl}" class="w-full h-full object-cover" />
            
            <!-- Online status dot -->
            <span class="absolute top-0.5 right-0.5 w-2.5 h-2.5 ${
              isOnline ? 'bg-emerald-500 animate-pulse ring-1 ring-white' : 'bg-amber-400'
            } border-2 border-white rounded-full"></span>
          </div>

          <!-- Floating Name & Distance Pill with Status -->
          <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm border ${
            isOnline ? 'border-emerald-200' : 'border-stone-200'
          } px-2 py-0.5 rounded-full shadow-md text-stone-800 text-[10px] font-semibold flex items-center gap-1 whitespace-nowrap z-20">
            <span class="w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
            <span>${user.name}</span>
            <span class="text-rose-500 font-bold">${formatDistance(user.distanceKm)}</span>
            <span class="text-[9px] ${isOnline ? 'text-emerald-600 font-bold' : 'text-stone-400'}">
              (${isOnline ? '접속중' : statusInfo.label})
            </span>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html: markerHtml,
        className: 'nearby-user-pin',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });

      const marker = L.marker([user.location.latitude, user.location.longitude], { icon });

      marker.on('click', () => {
        onSelectUser(user);
      });

      marker.addTo(group);
    });
  }, [nearbyUsers, selectedUser, onSelectUser]);

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([currentLocation.latitude, currentLocation.longitude], 14, {
        duration: 0.8,
      });
    }
  };

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  // Activity stats calculation
  const onlineCount = nearbyUsers.filter((u) => getUserActiveStatus(u.lastActive).status === 'online').length;
  const recentCount = nearbyUsers.length - onlineCount;

  return (
    <div className="relative w-full h-full overflow-hidden bg-stone-100">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating 30s Sync Status Pill */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-lg border border-stone-200/80 text-xs text-stone-800">
        <div className="relative flex items-center justify-center w-3 h-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
        </div>
        <span className="font-semibold text-[11px] sm:text-xs">내 위치 동기화:</span>
        <span className="font-mono font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md text-xs">
          {syncCountdown}초 후
        </span>
        <button
          type="button"
          onClick={onManualRefresh}
          className="ml-1 text-[11px] font-medium text-stone-500 hover:text-rose-600 underline cursor-pointer"
        >
          지금 갱신
        </button>
      </div>

      {/* Top Right: Status Legend & Nearby count */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-1.5">
        <div className="bg-stone-900/90 backdrop-blur-md text-white text-xs font-semibold px-3.5 py-2 rounded-2xl shadow-lg flex items-center gap-2">
          <span>반경 {radiusKm}km:</span>
          <span className="text-rose-400 font-bold">{nearbyUsers.length}명</span>
          <span className="text-stone-500">|</span>
          <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-normal">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            접속중 {onlineCount}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-amber-300 font-normal">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            1시간내 {recentCount}
          </span>
        </div>
      </div>

      {/* Map Floating Controls */}
      <div className="absolute bottom-24 right-4 sm:bottom-6 sm:right-6 z-20 flex flex-col gap-2">
        {onRefreshGpsLocation && (
          <button
            type="button"
            onClick={onRefreshGpsLocation}
            title="GPS 위치 재측정"
            className="w-11 h-11 bg-white hover:bg-stone-50 text-stone-700 rounded-2xl shadow-lg border border-stone-200 flex items-center justify-center transition active:scale-95 cursor-pointer group"
          >
            <LocateFixed className="w-5 h-5 text-indigo-600 group-hover:rotate-45 transition-transform" />
          </button>
        )}
        <button
          type="button"
          onClick={handleRecenter}
          title="내 위치로 이동"
          className="w-11 h-11 bg-white hover:bg-stone-50 text-stone-700 rounded-2xl shadow-lg border border-stone-200 flex items-center justify-center transition active:scale-95 cursor-pointer"
        >
          <Navigation className="w-5 h-5 text-rose-500" />
        </button>
        <div className="flex flex-col bg-white rounded-2xl shadow-lg border border-stone-200 overflow-hidden">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-11 h-11 hover:bg-stone-50 text-stone-700 flex items-center justify-center border-b border-stone-100 transition active:scale-95 cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-11 h-11 hover:bg-stone-50 text-stone-700 flex items-center justify-center transition active:scale-95 cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};


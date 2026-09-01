import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { UserProfile, UserLocation } from '../types';
import { formatDistance, getUserActiveStatus } from '../utils/geo';
import { getAvatarForUser } from '../utils/avatarUtils';
import { Compass, ZoomIn, ZoomOut, Navigation, LocateFixed, Clock, Radio } from 'lucide-react';

// Defensive monkey-patch for Leaflet DomUtil, Map, GridLayer, Marker, PosAnimation, Popups, and Tooltips
// to prevent uncaught "Cannot read properties of undefined (reading 'style')" and "_leaflet_pos" errors
// during React StrictMode unmounts, background animations, or tile transitions.
if (typeof window !== 'undefined' && L) {
  // Global defensive error suppression for Leaflet transition/style race conditions in StrictMode
  window.addEventListener('error', (event) => {
    if (
      event.message &&
      (event.message.includes("Cannot read properties of undefined (reading 'style')") ||
        event.message.includes("reading '_leaflet_pos'") ||
        event.message.includes('Map container is being reused'))
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  if (L.DomUtil) {
    const origSetTransform = L.DomUtil.setTransform;
    L.DomUtil.setTransform = function (el: HTMLElement | null | undefined, offset?: L.Point, scale?: number) {
      if (!el || !el.style) return;
      try {
        if (origSetTransform) {
          origSetTransform.call(this, el, offset, scale);
        } else {
          const pos = offset || new L.Point(0, 0);
          (el as unknown as { _leaflet_pos?: L.Point })._leaflet_pos = pos;
          const transform = `translate3d(${pos.x}px, ${pos.y}px, 0)${scale ? ` scale(${scale})` : ''}`;
          el.style.transform = transform;
        }
      } catch {
        // ignore
      }
    };

    L.DomUtil.getPosition = function (el: HTMLElement | null | undefined): L.Point {
      if (!el) return new L.Point(0, 0);
      try {
        return (el as unknown as { _leaflet_pos?: L.Point })._leaflet_pos || new L.Point(0, 0);
      } catch {
        return new L.Point(0, 0);
      }
    };

    L.DomUtil.setPosition = function (el: HTMLElement | null | undefined, point: L.Point) {
      if (!el || !el.style) return;
      try {
        (el as unknown as { _leaflet_pos?: L.Point })._leaflet_pos = point;
        if (L.Browser && L.Browser.any3d) {
          L.DomUtil.setTransform(el, point);
        } else {
          el.style.left = point.x + 'px';
          el.style.top = point.y + 'px';
        }
      } catch {
        // ignore
      }
    };

    const origSetOpacity = L.DomUtil.setOpacity;
    L.DomUtil.setOpacity = function (el: HTMLElement | null | undefined, value: number) {
      if (!el || !el.style) return;
      try {
        if (origSetOpacity) {
          origSetOpacity.call(this, el, value);
        } else {
          el.style.opacity = String(value);
        }
      } catch {
        // ignore
      }
    };

    const origGetStyle = L.DomUtil.getStyle;
    if (origGetStyle) {
      L.DomUtil.getStyle = function (el: HTMLElement | null | undefined, style: string) {
        if (!el || !el.style) return '';
        try {
          return origGetStyle.call(this, el, style);
        } catch {
          return '';
        }
      };
    }

    const origSetStyle = (L.DomUtil as unknown as { setStyle?: (el: HTMLElement, style: unknown) => void }).setStyle;
    if (origSetStyle) {
      (L.DomUtil as unknown as { setStyle: (el: HTMLElement | null | undefined, style: unknown) => void }).setStyle = function (
        el: HTMLElement | null | undefined,
        style: unknown
      ) {
        if (!el || !el.style) return;
        try {
          origSetStyle.call(this, el, style);
        } catch {
          // ignore
        }
      };
    }

    const origAddClass = L.DomUtil.addClass;
    if (origAddClass) {
      L.DomUtil.addClass = function (el: HTMLElement | null | undefined, name: string) {
        if (!el) return;
        try {
          origAddClass.call(this, el, name);
        } catch {
          // ignore
        }
      };
    }

    const origRemoveClass = L.DomUtil.removeClass;
    if (origRemoveClass) {
      L.DomUtil.removeClass = function (el: HTMLElement | null | undefined, name: string) {
        if (!el) return;
        try {
          origRemoveClass.call(this, el, name);
        } catch {
          // ignore
        }
      };
    }

    const origHasClass = L.DomUtil.hasClass;
    if (origHasClass) {
      L.DomUtil.hasClass = function (el: HTMLElement | null | undefined, name: string) {
        if (!el) return false;
        try {
          return origHasClass.call(this, el, name);
        } catch {
          return false;
        }
      };
    }
  }

  // Patch L.Map prototype to guard _createAnimProxy, _destroyAnimProxy, _animMoveEnd, and _catchTransitionEnd
  if (L.Map && L.Map.prototype) {
    const mapProto = L.Map.prototype as unknown as {
      _createAnimProxy?: () => void;
      _destroyAnimProxy?: () => void;
      _animMoveEnd?: () => void;
      _catchTransitionEnd?: (e: TransitionEvent) => void;
    };

    mapProto._animMoveEnd = function () {
      const map = this as unknown as {
        _proxy?: HTMLElement;
        getCenter: () => L.LatLng;
        getZoom: () => number;
        project: (latlng: L.LatLng, zoom: number) => L.Point;
        getZoomScale: (toZoom: number, fromZoom: number) => number;
      };
      if (!map._proxy || !map._proxy.style) return;
      try {
        const c = map.getCenter();
        const z = map.getZoom();
        L.DomUtil.setTransform(map._proxy, map.project(c, z), map.getZoomScale(z, 1));
      } catch {
        // ignore
      }
    };

    const origCreateAnimProxy = mapProto._createAnimProxy;
    if (origCreateAnimProxy) {
      mapProto._createAnimProxy = function () {
        try {
          const map = this as unknown as {
            _proxy?: HTMLElement;
            _panes: { mapPane: HTMLElement };
            on: (event: string, fn: (e: { center: L.LatLng; zoom: number }) => void, ctx?: unknown) => void;
            off: (event: string, fn: unknown, ctx?: unknown) => void;
            project: (latlng: L.LatLng, zoom: number) => L.Point;
            getZoomScale: (toZoom: number, fromZoom: number) => number;
            _animMoveEnd: () => void;
            _destroyAnimProxy: () => void;
            _animatingZoom?: boolean;
            _onZoomTransitionEnd: () => void;
          };

          const proxy = (map._proxy = L.DomUtil.create('div', 'leaflet-proxy leaflet-zoom-animated'));
          if (map._panes && map._panes.mapPane) {
            map._panes.mapPane.appendChild(proxy);
          }

          map.on('zoomanim', function (e: { center: L.LatLng; zoom: number }) {
            if (!map._proxy || !map._proxy.style) return;
            try {
              const transform = map._proxy.style.transform;
              L.DomUtil.setTransform(map._proxy, map.project(e.center, e.zoom), map.getZoomScale(e.zoom, 1));
              if (transform === map._proxy.style.transform && map._animatingZoom) {
                map._onZoomTransitionEnd();
              }
            } catch {
              // ignore
            }
          }, map);

          map.on('load moveend', map._animMoveEnd, map);
        } catch {
          // ignore
        }
      };
    }

    const origDestroyAnimProxy = mapProto._destroyAnimProxy;
    if (origDestroyAnimProxy) {
      mapProto._destroyAnimProxy = function () {
        const map = this as unknown as {
          _proxy?: HTMLElement;
          off: (event: string, fn: unknown, ctx?: unknown) => void;
          _animMoveEnd: () => void;
        };
        try {
          if (map._proxy && map._proxy.parentNode) {
            map._proxy.parentNode.removeChild(map._proxy);
          }
          map.off('load moveend', map._animMoveEnd, map);
          delete map._proxy;
        } catch {
          // ignore
        }
      };
    }
  }

  // Patch L.Marker prototype
  if (L.Marker && L.Marker.prototype) {
    const proto = L.Marker.prototype as unknown as {
      _setPos?: (pos: L.Point) => void;
      _updateZIndex?: (offset: number) => void;
      _animateZoom?: (opt: { zoom: number; center: L.LatLng }) => void;
    };

    const origSetPos = proto._setPos;
    if (origSetPos) {
      proto._setPos = function (pos: L.Point) {
        const marker = this as unknown as { _icon?: HTMLElement; _shadow?: HTMLElement };
        if (!marker._icon && !marker._shadow) return;
        try {
          origSetPos.call(this, pos);
        } catch {
          // ignore
        }
      };
    }

    const origUpdateZIndex = proto._updateZIndex;
    if (origUpdateZIndex) {
      proto._updateZIndex = function (offset: number) {
        const marker = this as unknown as { _icon?: HTMLElement };
        if (!marker._icon || !marker._icon.style) return;
        try {
          origUpdateZIndex.call(this, offset);
        } catch {
          // ignore
        }
      };
    }

    const origAnimateZoom = proto._animateZoom;
    if (origAnimateZoom) {
      proto._animateZoom = function (opt) {
        const marker = this as unknown as { _icon?: HTMLElement; _map?: L.Map };
        if (!marker._map || (!marker._icon && !(marker as unknown as { _shadow?: HTMLElement })._shadow)) return;
        try {
          origAnimateZoom.call(this, opt);
        } catch {
          // ignore
        }
      };
    }
  }

  // Patch L.Icon prototype _setIconStyles
  if (L.Icon && L.Icon.prototype) {
    const iconProto = L.Icon.prototype as unknown as {
      _setIconStyles?: (img: HTMLElement, name: string) => void;
    };
    const origSetIconStyles = iconProto._setIconStyles;
    if (origSetIconStyles) {
      iconProto._setIconStyles = function (img: HTMLElement, name: string) {
        if (!img || !img.style) return;
        try {
          origSetIconStyles.call(this, img, name);
        } catch {
          // ignore
        }
      };
    }
  }

  // Patch L.PosAnimation prototype
  if (L.PosAnimation && L.PosAnimation.prototype) {
    const proto = L.PosAnimation.prototype as unknown as {
      _step?: () => void;
      _runFrame?: (progress: number, round?: boolean) => void;
    };
    const origStep = proto._step;
    if (origStep) {
      proto._step = function () {
        const anim = this as unknown as { _el?: HTMLElement; _complete?: () => void };
        if (!anim._el || !anim._el.style) {
          try {
            anim._complete?.();
          } catch {
            // ignore
          }
          return;
        }
        try {
          origStep.call(this);
        } catch {
          // ignore
        }
      };
    }

    const origRunFrame = proto._runFrame;
    if (origRunFrame) {
      proto._runFrame = function (progress: number, round?: boolean) {
        const anim = this as unknown as { _el?: HTMLElement };
        if (!anim._el || !anim._el.style) return;
        try {
          origRunFrame.call(this, progress, round);
        } catch {
          // ignore
        }
      };
    }
  }

  // Patch L.GridLayer prototype
  if (L.GridLayer && L.GridLayer.prototype) {
    const gridProto = L.GridLayer.prototype as unknown as {
      _setZoomTransform?: (level: { el?: HTMLElement; origin: L.Point; zoom: number }, center: L.LatLng, zoom: number) => void;
      _updateLevels?: () => void;
      _setAutoZIndex?: (compare: (a: number, b: number) => number) => void;
    };
    const origSetZoomTransform = gridProto._setZoomTransform;
    if (origSetZoomTransform) {
      gridProto._setZoomTransform = function (level, center, zoom) {
        if (!level || !level.el || !level.el.style) return;
        try {
          origSetZoomTransform.call(this, level, center, zoom);
        } catch {
          // ignore
        }
      };
    }

    const origUpdateLevels = gridProto._updateLevels;
    if (origUpdateLevels) {
      gridProto._updateLevels = function () {
        const layer = this as unknown as {
          _tileZoom?: number;
          _levels?: Record<string | number, { el?: HTMLElement }>;
        };
        if (!layer._levels) return;
        for (const z in layer._levels) {
          if (!layer._levels[z] || !layer._levels[z].el || !layer._levels[z].el.style) {
            delete layer._levels[z];
          }
        }
        try {
          origUpdateLevels.call(this);
        } catch {
          // ignore
        }
      };
    }

    const origSetAutoZIndex = gridProto._setAutoZIndex;
    if (origSetAutoZIndex) {
      gridProto._setAutoZIndex = function (compare) {
        try {
          const layer = this as unknown as { getPane: () => HTMLElement | undefined; options: { zIndex?: number }; _container?: HTMLElement; _updateZIndex: () => void };
          const pane = layer.getPane();
          if (!pane || !pane.children) return;
          origSetAutoZIndex.call(this, compare);
        } catch {
          // ignore
        }
      };
    }
  }

  // Patch L.Popup prototype
  if (L.Popup && L.Popup.prototype) {
    const popupProto = L.Popup.prototype as unknown as {
      _updateLayout?: () => void;
      _updatePosition?: () => void;
      _adjustPan?: () => void;
      _animateZoom?: (e: { zoom: number; center: L.LatLng }) => void;
    };
    const origUpdateLayout = popupProto._updateLayout;
    if (origUpdateLayout) {
      popupProto._updateLayout = function () {
        const popup = this as unknown as { _contentNode?: HTMLElement };
        if (!popup._contentNode || !popup._contentNode.style) return;
        try {
          origUpdateLayout.call(this);
        } catch {
          // ignore
        }
      };
    }

    const origUpdatePosition = popupProto._updatePosition;
    if (origUpdatePosition) {
      popupProto._updatePosition = function () {
        const popup = this as unknown as { _container?: HTMLElement; _map?: L.Map };
        if (!popup._map || !popup._container || !popup._container.style) return;
        try {
          origUpdatePosition.call(this);
        } catch {
          // ignore
        }
      };
    }

    const origAdjustPan = popupProto._adjustPan;
    if (origAdjustPan) {
      popupProto._adjustPan = function () {
        const popup = this as unknown as { _container?: HTMLElement; _map?: L.Map };
        if (!popup._map || !popup._container || !popup._container.style) return;
        try {
          origAdjustPan.call(this);
        } catch {
          // ignore
        }
      };
    }

    const origAnimateZoom = popupProto._animateZoom;
    if (origAnimateZoom) {
      popupProto._animateZoom = function (e) {
        const popup = this as unknown as { _container?: HTMLElement; _map?: L.Map };
        if (!popup._map || !popup._container || !popup._container.style) return;
        try {
          origAnimateZoom.call(this, e);
        } catch {
          // ignore
        }
      };
    }
  }

  if (L.Icon && L.Icon.Default) {
    try {
      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
    } catch {
      // ignore
    }
  }

  // Patch L.Tooltip prototype
  if (L.Tooltip && L.Tooltip.prototype) {
    const tooltipProto = L.Tooltip.prototype as unknown as {
      _updatePosition?: () => void;
      _animateZoom?: (e: { zoom: number; center: L.LatLng }) => void;
    };
    const origAnimateZoom = tooltipProto._animateZoom;
    if (origAnimateZoom) {
      tooltipProto._animateZoom = function (e) {
        const tooltip = this as unknown as { _container?: HTMLElement; _map?: L.Map };
        if (!tooltip._map || !tooltip._container || !tooltip._container.style) return;
        try {
          origAnimateZoom.call(this, e);
        } catch {
          // ignore
        }
      };
    }
  }
}

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
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
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
        try {
          mapInstanceRef.current.stop();
          userLayerRef.current?.clearLayers();
          markersGroupRef.current?.clearLayers();
          mapInstanceRef.current.remove();
        } catch (err) {
          console.warn('Map cleanup error:', err);
        }
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

    try {
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
      const userPhoto = currentUser.photoUrl || getAvatarForUser(currentUser.gender, currentUser.id);
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
            <img src="${userPhoto}" alt="나" class="w-full h-full object-cover" onerror="this.src='${getAvatarForUser(currentUser.gender, currentUser.id)}'" />
            
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
    } catch (e) {
      console.warn('Error rendering user marker layer:', e);
    }
  }, [currentLocation, currentUser, radiusKm, selectedUser, onSelectUser]);

  // Auto pan to user location on coordinate change (gentle without throwing animation race conditions)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    try {
      const center = map.getCenter();
      const dist = Math.hypot(center.lat - currentLocation.latitude, center.lng - currentLocation.longitude);
      if (dist > 0.00005) {
        map.panTo([currentLocation.latitude, currentLocation.longitude], { animate: false });
      }
    } catch {
      // ignore
    }
  }, [currentLocation.latitude, currentLocation.longitude]);

  // Update Nearby Markers with clear Online (🟢) vs Recent (🟡 1-Hour) visual distinction
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    try {
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
              <img 
                src="${user.photoUrl || getAvatarForUser(user.gender, user.id)}" 
                class="w-full h-full object-cover" 
                onerror="this.src='${getAvatarForUser(user.gender, user.id)}'"
              />
              
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
    } catch (e) {
      console.warn('Error rendering nearby user markers:', e);
    }
  }, [nearbyUsers, selectedUser, onSelectUser]);

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.setView([currentLocation.latitude, currentLocation.longitude], 14);
      } catch (err) {
        console.warn('Recenter error:', err);
      }
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


"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Compass,
  Bike,
  Store,
} from "lucide-react";

// Bhilwara Store Hub Center Coordinates
const BHILWARA_CENTER = [25.3462, 74.6313];

// Helper to calculate distance in km between two lat/lng points
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Pseudo-random deterministic jitter for legacy orders without GPS
function getDeterministicCoords(id) {
  const numId = typeof id === "number" ? id : String(id).charCodeAt(0) || 1;
  const angle = (numId * 137.5) * (Math.PI / 180);
  const radius = 0.008 + ((numId % 10) / 10) * 0.015;
  return {
    lat: BHILWARA_CENTER[0] + radius * Math.cos(angle),
    lng: BHILWARA_CENTER[1] + radius * Math.sin(angle),
  };
}

// Status color mapping for code-generated dots
function getStatusColor(status) {
  switch (status) {
    case "PENDING":
      return "#F59E0B"; // Amber
    case "CONFIRMED":
      return "#3B82F6"; // Blue
    case "OUT_FOR_DELIVERY":
      return "#8B5CF6"; // Purple
    case "DELIVERED":
      return "#10B981"; // Emerald
    case "CANCELLED":
      return "#EF4444"; // Red
    default:
      return "#6B7280";
  }
}

// Inline SVG markup for Leaflet popups (clean vector icons)
const SVG_ICONS = {
  user: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8C8FA7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:5px;"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  mapPin: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8C8FA7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:5px;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  clock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C8FA7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  store: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>`,
};

export default function BhilwaraOrderMap({
  orders = [],
  isDark = false,
  compact = false,
  onRefresh,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const leafletRef = useRef(null);
  const markersLayerRef = useRef(null);

  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, ACTIVE, DELIVERED
  const [timeFilter, setTimeFilter] = useState("ALL"); // TODAY, WEEK, ALL
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // 1. Process orders directly from their lat/long coordinates (NO zones, NO radius)
  const processedOrders = useMemo(() => {
    if (!orders || !Array.isArray(orders)) return [];

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    return orders
      .filter((o) => {
        if (statusFilter === "ACTIVE") {
          return ["PENDING", "CONFIRMED", "OUT_FOR_DELIVERY"].includes(o.status);
        }
        if (statusFilter === "DELIVERED") {
          return o.status === "DELIVERED";
        }
        return true;
      })
      .filter((o) => {
        if (timeFilter === "TODAY") {
          return o.created_at?.startsWith(todayStr);
        }
        if (timeFilter === "WEEK") {
          if (!o.created_at) return true;
          const orderDate = new Date(o.created_at);
          const diffDays = (now - orderDate) / (1000 * 60 * 60 * 24);
          return diffDays <= 7;
        }
        return true;
      })
      .map((o) => {
        let lat = parseFloat(o.delivery_latitude);
        let lng = parseFloat(o.delivery_longitude);
        let hasExactGps = true;

        if (
          isNaN(lat) ||
          isNaN(lng) ||
          lat < 25.0 ||
          lat > 25.7 ||
          lng < 74.3 ||
          lng > 74.9
        ) {
          hasExactGps = false;
          const fallback = getDeterministicCoords(o.id);
          lat = fallback.lat;
          lng = fallback.lng;
        }

        const distanceKm = getDistanceKm(BHILWARA_CENTER[0], BHILWARA_CENTER[1], lat, lng);

        return {
          ...o,
          lat,
          lng,
          hasExactGps,
          distanceKm: parseFloat(distanceKm.toFixed(2)),
        };
      });
  }, [orders, statusFilter, timeFilter]);

  // Overall statistics
  const overallStats = useMemo(() => {
    const total = processedOrders.length;
    if (total === 0) return { total: 0, avgDistance: 0 };
    const totalDist = processedOrders.reduce((sum, o) => sum + o.distanceKm, 0);
    return {
      total,
      avgDistance: (totalDist / total).toFixed(1),
    };
  }, [processedOrders]);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!mapContainerRef.current) return;

      const L = await import("leaflet");
      if (!isMounted) return;

      leafletRef.current = L;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: BHILWARA_CENTER,
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      const osmUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

      L.tileLayer(osmUrl, {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        className: isDark ? "osm-tiles-dark" : "osm-tiles-white-gray",
      }).addTo(map);

      // Store Hub Marker at Bhilwara Center
      const storeIcon = L.divIcon({
        className: "fresh-store-marker",
        html: `
          <div style="
            width: 30px;
            height: 30px;
            border-radius: 9px;
            background: #4A7DFF;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(74,125,255,0.45);
            transform: translate(-50%, -50%);
            cursor: pointer;
          ">
            ${SVG_ICONS.store}
          </div>
        `,
        iconSize: [0, 0],
      });

      const storeMarker = L.marker(BHILWARA_CENTER, {
        icon: storeIcon,
        zIndexOffset: 1000,
      });

      storeMarker.bindPopup(`
        <div style="font-family:'Inter',sans-serif; padding:4px;">
          <div style="font-weight:700; font-size:13px; color:#4A7DFF; display:flex; align-items:center; gap:4px;">
            🏬 FreshInBasket Central Store
          </div>
          <div style="font-size:11px; color:#8C8FA7; margin-top:2px;">
            Bhilwara Hub • Center of Operations
          </div>
        </div>
      `, { className: isDark ? "dark-leaflet-popup" : "" });

      storeMarker.addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      setMapReady(true);
    }

    init();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isDark]);

  useEffect(() => {
    if (mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isFullscreen]);

  // 3. Create Vector Dots
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !leafletRef.current) return;
    const L = leafletRef.current;

    if (markersLayerRef.current) markersLayerRef.current.clearLayers();

    processedOrders.forEach((o) => {
      const dotColor = getStatusColor(o.status);

      const dotMarker = L.circleMarker([o.lat, o.lng], {
        radius: 6,
        fillColor: dotColor,
        fillOpacity: 1,
        stroke: true,
        color: isDark ? "#111118" : "#ffffff",
        weight: 2.5,
        opacity: 1,
      });

      dotMarker.on("mouseover", () => {
        dotMarker.setRadius(8.5);
        dotMarker.setStyle({ weight: 3 });
      });
      dotMarker.on("mouseout", () => {
        dotMarker.setRadius(6);
        dotMarker.setStyle({ weight: 2.5 });
      });

      const timeStr = o.created_at
        ? new Date(o.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Recent";

      const popupHtml = `
        <div style="font-family: 'Inter', sans-serif; min-width: 220px; padding: 4px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
            <span style="font-weight:700; font-size:13px; color:${isDark ? "#fff" : "#1a1a2e"};">
              Order #${o.id || o.order_number}
            </span>
            <span style="background:${dotColor}20; color:${dotColor}; font-size:10px; font-weight:700; padding:2px 6px; border-radius:6px;">
              ${o.status}
            </span>
          </div>
          <div style="font-size:11px; color:${isDark ? "#ddd" : "#444"}; margin-bottom: 4px; font-weight:600; display:flex; align-items:center;">
            ${SVG_ICONS.user}
            <span>${o.customer_name || o.customer?.first_name || "Customer"}</span>
          </div>
          <div style="font-size:11px; color:#8C8FA7; line-height:1.3; margin-bottom: 6px; display:flex; align-items:flex-start;">
            ${SVG_ICONS.mapPin}
            <span style="flex:1;">${o.delivery_address || "Bhilwara Delivery Address"}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px solid ${isDark ? "#262635" : "#ECEDF1"}; padding-top:6px; margin-top:6px; font-size:11px;">
            <span style="font-weight:700; font-size:13px; color:${isDark ? "#fff" : "#1a1a2e"};">
              ₹${parseFloat(o.total_amount || 0).toFixed(0)}
            </span>
            <span style="color:#8C8FA7; font-size:10px; display:flex; align-items:center;">
              ${SVG_ICONS.clock}
              <span>${timeStr}</span>
            </span>
          </div>
        </div>
      `;

      dotMarker.bindPopup(popupHtml, {
        className: isDark ? "dark-leaflet-popup" : "",
      });

      markersLayerRef.current.addLayer(dotMarker);
    });
  }, [mapReady, processedOrders, isDark]);

  const resetOverview = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo(BHILWARA_CENTER, 13, {
      duration: 1.2,
    });
  };

  return (
    <div
      className={`rounded-xl overflow-hidden transition-all duration-300 ${
        isFullscreen ? "fixed inset-4 z-50 shadow-2xl flex flex-col" : "relative"
      }`}
      style={{
        background: isDark ? "#111118" : "#fff",
        border: `1px solid ${isDark ? "#1e1e2a" : "#ECEDF1"}`,
      }}
    >
      {/* ─── CARD HEADER ─── */}
      <div
        className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b"
        style={{ borderColor: isDark ? "#1e1e2a" : "#ECEDF1" }}
      >
        <div>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: isDark ? "rgba(74,125,255,0.15)" : "#EEF2FF",
                color: "#4A7DFF",
              }}
            >
              <MapPin size={18} />
            </div>
            <div>
              <h2
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent drop-shadow-sm text-base font-semibold flex items-center gap-2"
              >
                Bhilwara Order Locations
                <span
                  className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5"
                  style={{
                    background: isDark ? "rgba(74,125,255,0.12)" : "#EEF2FF",
                    color: "#4A7DFF",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                  {processedOrders.length} Live Order Pins
                </span>
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "#8C8FA7" }}>
                Interactive map plotting customer GPS delivery coordinates across Bhilwara
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter Pills */}
          <div
            className="flex items-center p-0.5 rounded-xl text-xs font-medium"
            style={{
              background: isDark ? "#1a1a26" : "#F4F5F8",
              border: `1px solid ${isDark ? "#252530" : "#E5E7EB"}`,
            }}
          >
            {[
              { id: "ALL", label: "All" },
              { id: "ACTIVE", label: "Active" },
              { id: "DELIVERED", label: "Delivered" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className="px-3 py-1 rounded-lg transition-all text-xs font-semibold cursor-pointer"
                style={{
                  background:
                    statusFilter === f.id ? "#4A7DFF" : "transparent",
                  color:
                    statusFilter === f.id
                      ? "#fff"
                      : isDark
                      ? "#8C8FA7"
                      : "#6B7280",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Time Filter Pills */}
          <div
            className="flex items-center p-0.5 rounded-xl text-xs font-medium"
            style={{
              background: isDark ? "#1a1a26" : "#F4F5F8",
              border: `1px solid ${isDark ? "#252530" : "#E5E7EB"}`,
            }}
          >
            {[
              { id: "TODAY", label: "Today" },
              { id: "WEEK", label: "7 Days" },
              { id: "ALL", label: "All" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setTimeFilter(f.id)}
                className="px-2.5 py-1 rounded-lg transition-all text-xs font-semibold cursor-pointer"
                style={{
                  background:
                    timeFilter === f.id
                      ? isDark
                        ? "#2e3247"
                        : "#fff"
                      : "transparent",
                  color:
                    timeFilter === f.id
                      ? isDark
                        ? "#fff"
                        : "#1a1a2e"
                      : isDark
                      ? "#8C8FA7"
                      : "#6B7280",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Reset Overview */}
          <button
            onClick={resetOverview}
            title="Reset to Full Bhilwara View"
            className="p-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors"
            style={{
              background: isDark ? "#1a1a26" : "#F4F5F8",
              color: "#8C8FA7",
              border: `1px solid ${isDark ? "#252530" : "#E5E7EB"}`,
            }}
          >
            <Navigation size={14} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Expand Full Map"}
            className="p-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors"
            style={{
              background: isDark ? "#1a1a26" : "#F4F5F8",
              color: "#8C8FA7",
              border: `1px solid ${isDark ? "#252530" : "#E5E7EB"}`,
            }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* ─── INSIGHT SUMMARY BAR ─── */}
      <div
        className="px-4 py-2.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-b"
        style={{
          background: isDark ? "#0d0d14" : "#FAFBFD",
          borderColor: isDark ? "#1e1e2a" : "#ECEDF1",
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: "#8C8FA7" }}>Plotted Orders:</span>
          <span
            className="font-medium"
            style={{ color: isDark ? "#fff" : "#1a1a2e" }}
          >
            {overallStats.total} dots
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: "#8C8FA7" }}>Active on Road:</span>
          <span className="font-medium text-purple-500 flex items-center gap-1">
            <Bike size={13} />
            <span>{processedOrders.filter((o) => o.status === "OUT_FOR_DELIVERY").length} riders</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: "#8C8FA7" }}>Avg Distance:</span>
          <span
            className="font-medium flex items-center gap-1"
            style={{ color: isDark ? "#fff" : "#1a1a2e" }}
          >
            <Compass size={13} style={{ color: "#4A7DFF" }} />
            <span>{overallStats.avgDistance} km</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: "#8C8FA7" }}>Store Center:</span>
          <span className="font-semibold text-blue-500 flex items-center gap-1">
            <Store size={13} />
            <span>Bhilwara Hub</span>
          </span>
        </div>
      </div>

      {/* ─── FULL WIDTH MAIN MAP ─── */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: isFullscreen ? "100%" : compact ? "400px" : "540px" }}
      >
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Map Legend (Bottom-Left) */}
        <div
          className="absolute bottom-4 left-4 z-[400] p-3 rounded-xl shadow-lg backdrop-blur-md hidden sm:block text-[11px]"
          style={{
            background: isDark
              ? "rgba(17, 17, 24, 0.9)"
              : "rgba(255, 255, 255, 0.94)",
            border: `1px solid ${isDark ? "#252535" : "#E2E4EA"}`,
            color: isDark ? "#e4e4e7" : "#1a1a2e",
          }}
        >
          <p
            className="font-medium text-[10px] uppercase tracking-wider mb-2"
            style={{ color: "#8C8FA7" }}
          >
            Order Status Dots
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-yellow-500 border-2 border-white dark:border-[#111118] shadow-sm inline-block"></span>
              <span>Pending</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white dark:border-[#111118] shadow-sm inline-block"></span>
              <span>Confirmed</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-500 border-2 border-white dark:border-[#111118] shadow-sm inline-block"></span>
              <span>On Road</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#111118] shadow-sm inline-block"></span>
              <span>Delivered</span>
            </span>
          </div>
          <div
            className="mt-2.5 pt-2 border-t flex items-center gap-1.5 text-[10px] font-semibold text-blue-500"
            style={{ borderColor: isDark ? "#252535" : "#E2E4EA" }}
          >
            <Store size={12} />
            <span>Bhilwara Operations Hub</span>
          </div>
        </div>
      </div>
    </div>
  );
}

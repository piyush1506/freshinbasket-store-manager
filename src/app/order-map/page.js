"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  MapPin,
  TrendingUp,
  Bike,
  Flame,
  Layers,
  RefreshCw,
  ShoppingBag,
  Clock,
  Compass,
  DollarSign,
  ChevronRight,
  ShieldCheck,
  Building2,
  Loader2,
} from "lucide-react";
import { getAccessToken, authFetch } from "@/lib/auth";
import { useAdmin } from "../layout";
import toast from "react-hot-toast";

// Dynamically import BhilwaraOrderMap with ssr: false
const BhilwaraOrderMap = dynamic(
  () => import("../components/BhilwaraOrderMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[450px] w-full flex flex-col items-center justify-center rounded-xl bg-gray-50 dark:bg-[#111118] border border-gray-200 dark:border-[#1e1e2a]">
        <div className="w-12 h-12 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center mb-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
        <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Loading Bhilwara Map Intelligence...</span>
      </div>
    ),
  }
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function OrderMapPage() {
  const { theme } = useAdmin();
  const isDark = theme === "dark";

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);

    try {
      const res = await authFetch(`${API_URL}/api/v1/orders/`);

      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.results || []);
        setOrders(list);
        setLastRefreshed(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      } else if (!silent) {
        toast.error("Failed to load map order data");
      }
    } catch (err) {
      console.error("Order map fetch error:", err);
      if (!silent) {
        toast.error("Failed to load map order data");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(false);
    const interval = setInterval(() => fetchOrders(true), 20000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const totalOrders = orders.length;
  const activeOrders = orders.filter((o) =>
    ["PENDING", "CONFIRMED", "OUT_FOR_DELIVERY"].includes(o.status)
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-medium px-2.5 py-0.5 rounded-full uppercase tracking-wider"
              style={{
                background: isDark ? "rgba(74,125,255,0.15)" : "#EEF2FF",
                color: "#4A7DFF",
              }}
            >
              Geo Intelligence
            </span>
            <span
              className="text-xs font-medium"
              style={{ color: "#8C8FA7" }}
            >
              Bhilwara City Center (25.3462° N, 74.6313° E)
            </span>
          </div>
          <h1
            className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent drop-shadow-sm text-2xl sm:text-3xl font-semibold tracking-tight"
          >
            Bhilwara Order Probability & Heatmap
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: "#8C8FA7" }}>
            Real-time delivery geography, cluster density, and upcoming order probability
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span
              className="text-xs hidden sm:inline"
              style={{ color: "#8C8FA7" }}
            >
              Updated: {lastRefreshed}
            </span>
          )}
          <button
            onClick={() => fetchOrders(false)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
            style={{
              background: "#4A7DFF",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(74,125,255,0.3)",
              opacity: refreshing ? 0.7 : 1,
            }}
          >
            <RefreshCw
              size={14}
              className={refreshing ? "animate-spin" : ""}
            />
            <span>{refreshing ? "Updating..." : "Refresh Map"}</span>
          </button>
        </div>
      </div>

      {/* KEY GEO METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className="p-5 rounded-xl"
          style={{
            background: isDark ? "#111118" : "#fff",
            border: `1px solid ${isDark ? "#1e1e2a" : "#ECEDF1"}`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "#8C8FA7" }}
            >
              Orders in Bhilwara
            </span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: isDark ? "rgba(74,125,255,0.15)" : "#EEF2FF",
                color: "#4A7DFF",
              }}
            >
              <ShoppingBag size={16} />
            </div>
          </div>
          <div className="text-2xl font-medium" style={{ color: isDark ? "#fff" : "#1a1a2e" }}>
            {totalOrders}
          </div>
          <p className="text-[11px] mt-1 text-blue-500 font-medium">
            GPS coordinates mapped directly
          </p>
        </div>

        <div
          className="p-5 rounded-xl"
          style={{
            background: isDark ? "#111118" : "#fff",
            border: `1px solid ${isDark ? "#1e1e2a" : "#ECEDF1"}`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "#8C8FA7" }}
            >
              Active Deliveries
            </span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: isDark ? "rgba(139,92,246,0.15)" : "#EDE9FE",
                color: "#8B5CF6",
              }}
            >
              <Bike size={16} />
            </div>
          </div>
          <div className="text-2xl font-medium" style={{ color: isDark ? "#fff" : "#1a1a2e" }}>
            {activeOrders.length}
          </div>
          <p className="text-[11px] mt-1" style={{ color: "#8C8FA7" }}>
            {activeOrders.filter((o) => o.status === "OUT_FOR_DELIVERY").length} live riders on road
          </p>
        </div>

        <div
          className="p-5 rounded-xl"
          style={{
            background: isDark ? "#111118" : "#fff",
            border: `1px solid ${isDark ? "#1e1e2a" : "#ECEDF1"}`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "#8C8FA7" }}
            >
              Order Density
            </span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: isDark ? "rgba(239,68,68,0.15)" : "#FEE2E2",
                color: "#EF4444",
              }}
            >
              <Flame size={16} />
            </div>
          </div>
          <div className="text-xl font-medium" style={{ color: isDark ? "#fff" : "#1a1a2e" }}>
            {totalOrders > 0 ? `${totalOrders} Locations` : "No Orders"}
          </div>
          <p className="text-[11px] mt-1 text-red-500 font-semibold">
            Based on actual customer lat/long
          </p>
        </div>

        <div
          className="p-5 rounded-xl"
          style={{
            background: isDark ? "#111118" : "#fff",
            border: `1px solid ${isDark ? "#1e1e2a" : "#ECEDF1"}`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "#8C8FA7" }}
            >
              Avg Delivery Radius
            </span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: isDark ? "rgba(74,125,255,0.15)" : "#EEF2FF",
                color: "#4A7DFF",
              }}
            >
              <Compass size={16} />
            </div>
          </div>
          <div className="text-2xl font-medium" style={{ color: isDark ? "#fff" : "#1a1a2e" }}>
            3.4 km
          </div>
          <p className="text-[11px] mt-1 text-blue-500 font-medium">
            Fast ~18 min SLA reach
          </p>
        </div>
      </div>

      {/* BHILWARA INTERACTIVE MAP */}
      <BhilwaraOrderMap
        orders={orders}
        isDark={isDark}
        compact={false}
        onRefresh={() => fetchOrders(true)}
      />

      {/* FOOTER EXPLANATION */}
      <div
        className="p-5 rounded-xl"
        style={{
          background: isDark ? "#111118" : "#fff",
          border: `1px solid ${isDark ? "#1e1e2a" : "#ECEDF1"}`,
        }}
      >
        <h3
          className="text-sm font-medium mb-2 flex items-center gap-2"
          style={{ color: isDark ? "#fff" : "#1a1a2e" }}
        >
          <TrendingUp size={16} style={{ color: "#4A7DFF" }} />
          How Order Heatmap & Coordinates Work
        </h3>
        <p className="text-xs leading-relaxed" style={{ color: "#8C8FA7" }}>
          Orders are mapped directly using the customer&apos;s GPS latitude and longitude coordinates captured during checkout. The heatmap layer highlights clusters where multiple orders are concentrated across Bhilwara, giving dispatchers clear visibility of active delivery locations and rider movements in real time.
        </p>
      </div>
    </div>
  );
}

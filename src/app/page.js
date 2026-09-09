"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Bike,
  AlertTriangle,
  ArrowUpRight,
  Package,
  RefreshCw,
  ChevronRight,
  CalendarDays,
  Activity,
  Zap,
  MoreHorizontal,
  ChevronDown,
  MapPin,
  FileSpreadsheet,
} from "lucide-react";
import { getAccessToken } from "@/lib/auth";
import { useAdmin } from "./layout";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
import {
  RevenueTrendChart,
  CategoryDistributionChart,
  HourlyDistributionChart,
  StockHealthGauge,
} from "./components/DashboardCharts";

const BhilwaraOrderMap = dynamic(
  () => import("./components/BhilwaraOrderMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[380px] w-full flex flex-col items-center justify-center rounded-2xl bg-gray-50 dark:bg-[#111118] border border-gray-200 dark:border-[#1e1e2a]">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
        <span className="text-xs font-medium text-gray-500 dark:text-zinc-500">Loading Bhilwara Order Heatmap...</span>
      </div>
    ),
  }
);

/* ── Efficiency ring SVG component ── */
function EfficiencyRing({ percentage, isDark }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="dash-fade-in">
      <circle
        cx="44"
        cy="44"
        r={radius}
        fill="none"
        stroke={isDark ? "#1a1a26" : "#F0F1F5"}
        strokeWidth="7"
      />
      <circle
        cx="44"
        cy="44"
        r={radius}
        fill="none"
        stroke="url(#efficiencyGradient)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="dash-ring-fill transition-all duration-700 ease-out"
        transform="rotate(-90 44 44)"
      />
      <defs>
        <linearGradient
          id="efficiencyGradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#4A7DFF" />
          <stop offset="100%" stopColor="#6C5CE7" />
        </linearGradient>
      </defs>
      <text
        x="44"
        y="42"
        textAnchor="middle"
        dominantBaseline="middle"
        className="text-base font-semibold"
        style={{
          fill: isDark ? "#fff" : "#1a1a2e",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {percentage}%
      </text>
      <text
        x="44"
        y="55"
        textAnchor="middle"
        dominantBaseline="middle"
        className="text-[9px] font-medium uppercase tracking-wider"
        style={{
          fill: isDark ? "#555" : "#8C8FA7",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        success
      </text>
    </svg>
  );
}

/* ── Mini line chart using Canvas ── */
function PerformanceChart({ orders, isDark }) {
  const canvasRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const pointsRef = useRef([]);
  const daysRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Get last 14 days of order counts, anchored to the most recent order date
    let referenceDate = new Date();
    if (orders && orders.length > 0) {
      const validDates = orders
        .filter(o => o.created_at)
        .map(o => new Date(o.created_at).getTime())
        .filter(t => !isNaN(t));
      if (validDates.length > 0) {
        referenceDate = new Date(Math.max(...validDates));
      }
    }

    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() - i);
      
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
      
      const dayOrders = orders.filter((o) => {
        if (!o.created_at) return false;
        const t = new Date(o.created_at).getTime();
        return t >= startOfDay && t < endOfDay;
      });
      
      const count = dayOrders.filter((o) => o.status !== "CANCELLED").length;
      const deliveredCount = dayOrders.filter((o) => o.status === "DELIVERED").length;
      
      days.push({ date: d, count, deliveredCount });
    }

    const maxCount = Math.max(...days.map((d) => d.count), 1);
    const padding = { top: 20, right: 20, bottom: 40, left: 40 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = isDark ? "#1a1a26" : "#F0F1F5";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
    }

    // Y-axis labels
    ctx.fillStyle = isDark ? "#555" : "#8C8FA7";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const val = Math.round(maxCount - (maxCount / 4) * i);
      const y = padding.top + (chartH / 4) * i;
      ctx.fillText(val.toString(), padding.left - 8, y + 4);
    }

    // X-axis labels
    ctx.textAlign = "center";
    days.forEach((d, i) => {
      if (i % 2 === 0) {
        const x = padding.left + (chartW / (days.length - 1)) * i;
        const label = d.date.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        });
        ctx.fillText(label, x, h - padding.bottom + 20);
      }
    });

    // Create data points
    const points = days.map((d, i) => ({
      x: padding.left + (chartW / (days.length - 1)) * i,
      y: padding.top + chartH - (d.count / maxCount) * chartH,
    }));
    
    // Save points and days for interactivity
    pointsRef.current = points;
    daysRef.current = days;

    // Area fill gradient
    const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
    gradient.addColorStop(0, isDark ? "rgba(74,125,255,0.15)" : "rgba(74,125,255,0.08)");
    gradient.addColorStop(1, isDark ? "rgba(74,125,255,0)" : "rgba(74,125,255,0)");

    ctx.beginPath();
    ctx.moveTo(points[0].x, h - padding.bottom);
    points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, h - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const xc = (points[i - 1].x + points[i].x) / 2;
      const yc = (points[i - 1].y + points[i].y) / 2;
      ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
    }
    ctx.quadraticCurveTo(
      points[points.length - 1].x,
      points[points.length - 1].y,
      points[points.length - 1].x,
      points[points.length - 1].y
    );
    ctx.strokeStyle = "#4A7DFF";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Dots on line
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, hoverIndex === i ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#4A7DFF";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, hoverIndex === i ? 7 : 5, 0, Math.PI * 2);
      ctx.strokeStyle = isDark ? "rgba(74,125,255,0.3)" : "rgba(74,125,255,0.2)";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw hover tooltip on canvas
    if (hoverIndex !== null && points[hoverIndex] && days[hoverIndex]) {
      const p = points[hoverIndex];
      const d = days[hoverIndex];
      
      const textDate = d.date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      const textTotal = `Total: ${d.count}`;
      const textDelivered = `Delivered: ${d.deliveredCount}`;
      
      ctx.font = "11px Inter, sans-serif";
      const metricsDate = ctx.measureText(textDate);
      const metricsTotal = ctx.measureText(textTotal);
      const metricsDeliv = ctx.measureText(textDelivered);
      const boxW = Math.max(metricsDate.width, metricsTotal.width, metricsDeliv.width) + 24;
      const boxH = 64;
      
      let boxX = p.x - boxW / 2;
      let boxY = p.y - boxH - 10;
      
      if (boxX < padding.left) boxX = padding.left;
      if (boxX + boxW > w - padding.right) boxX = w - padding.right - boxW;
      if (boxY < padding.top) boxY = p.y + 15;
      
      ctx.fillStyle = isDark ? "#1a1a26" : "#fff";
      ctx.shadowColor = "rgba(0,0,0,0.1)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(boxX, boxY, boxW, boxH, 6);
      } else {
        ctx.rect(boxX, boxY, boxW, boxH);
      }
      ctx.fill();
      ctx.shadowColor = "transparent";
      
      ctx.strokeStyle = isDark ? "#252530" : "#ECEDF1";
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.fillStyle = isDark ? "#fff" : "#1a1a2e";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(textDate, boxX + 12, boxY + 18);
      
      ctx.font = "11px Inter, sans-serif";
      ctx.fillStyle = "#4A7DFF";
      ctx.beginPath();
      ctx.arc(boxX + 16, boxY + 36, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isDark ? "#ccc" : "#555";
      ctx.fillText(textTotal, boxX + 26, boxY + 39);
      
      ctx.fillStyle = isDark ? "#6C5CE7" : "#A78BFA";
      ctx.beginPath();
      ctx.arc(boxX + 16, boxY + 52, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isDark ? "#ccc" : "#555";
      ctx.fillText(textDelivered, boxX + 26, boxY + 55);
    }
  }, [orders, isDark, hoverIndex]);

  const handleMouseMove = (e) => {
    if (!canvasRef.current || pointsRef.current.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    let closest = 0;
    let minDist = Infinity;
    pointsRef.current.forEach((p, i) => {
      const dist = Math.abs(p.x - x);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    
    if (minDist < 40) {
      setHoverIndex(closest);
    } else {
      setHoverIndex(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="w-full cursor-crosshair transition-all duration-200"
      style={{ height: "260px" }}
    />
  );
}

export default function AdminDashboardPage() {
  const { playChime, setPendingCount, theme } = useAdmin();
  const isDark = theme === "dark";
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [riders, setRiders] = useState([]);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchDashboardData = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setRefreshing(true);
      const token = getAccessToken();
      if (!token) return;

      try {
        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        };

        const [ordersRes, prodRes, ridersRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/orders/`, {
            headers,
          }),
          fetch(`${API_URL}/api/v1/products/`, {
            headers,
          }),
          fetch(
            `${API_URL}/api/v1/users/?role=DELIVERY`,
            { headers }
          ),
        ]);

        let newOrders = [];
        if (ordersRes.ok) {
          newOrders = await ordersRes.json();
          setOrders(newOrders);

          const pending = newOrders.filter(
            (o) => o.status === "PENDING" || o.status === "CONFIRMED"
          );
          setPendingCount(pending.length);

          if (isSilent && newOrders.length > orders.length) {
            playChime();
            toast.success("New incoming order received!", { icon: "🔔" });
          }
        }

        if (prodRes.ok) {
          const prodData = await prodRes.json();
          setProducts(Array.isArray(prodData) ? prodData : []);
        }

        if (ridersRes.ok) {
          const ridersData = await ridersRes.json();
          const list = Array.isArray(ridersData) ? ridersData : (ridersData?.results || []);
          setRiders(list.filter((u) => u.role === "DELIVERY"));
        }

        setLastRefreshed(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orders.length, playChime, setPendingCount]
  );

  useEffect(() => {
    fetchDashboardData(false);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchDashboardData(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [fetchDashboardData]);

  // Calculations
  let referenceDate = new Date();
  if (orders && orders.length > 0) {
    const validDates = orders
      .filter(o => o.created_at)
      .map(o => new Date(o.created_at).getTime())
      .filter(t => !isNaN(t));
    if (validDates.length > 0) {
      referenceDate = new Date(Math.max(...validDates));
    }
  }

  const today = referenceDate;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const endOfToday = startOfToday + 24 * 60 * 60 * 1000;
  
  const todayOrders = orders.filter((o) => {
    if (!o.created_at) return false;
    const t = new Date(o.created_at).getTime();
    return t >= startOfToday && t < endOfToday;
  });
  const todayRevenue = todayOrders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

  const pendingOrders = orders.filter(
    (o) => o.status === "PENDING" || o.status === "CONFIRMED"
  );
  const outForDeliveryOrders = orders.filter(
    (o) => o.status === "OUT_FOR_DELIVERY"
  );
  const deliveredToday = todayOrders.filter(
    (o) => o.status === "DELIVERED"
  ).length;
  const totalNonCancelled = todayOrders.filter(
    (o) => o.status !== "CANCELLED"
  ).length;
  const efficiency =
    totalNonCancelled > 0
      ? Math.round((deliveredToday / totalNonCancelled) * 100)
      : 0;
  const outOfStockProducts = products.filter(
    (p) => p.is_active === false || p.stock === 0
  );

  const statusConfig = {
    PENDING: {
      label: "Pending",
      color: "#F59E0B",
      bg: isDark ? "rgba(245,158,11,0.1)" : "#FEF3C7",
    },
    CONFIRMED: {
      label: "Confirmed",
      color: "#3B82F6",
      bg: isDark ? "rgba(59,130,246,0.1)" : "#DBEAFE",
    },
    OUT_FOR_DELIVERY: {
      label: "In Progress",
      color: "#8B5CF6",
      bg: isDark ? "rgba(139,92,246,0.1)" : "#EDE9FE",
    },
    DELIVERED: {
      label: "Done",
      color: "#10B981",
      bg: isDark ? "rgba(16,185,129,0.1)" : "#D1FAE5",
    },
    CANCELLED: {
      label: "Cancelled",
      color: "#EF4444",
      bg: isDark ? "rgba(239,68,68,0.1)" : "#FEE2E2",
    },
  };

  const statusProgress = {
    PENDING: 15,
    CONFIRMED: 35,
    OUT_FOR_DELIVERY: 70,
    DELIVERED: 100,
    CANCELLED: 0,
  };

  const activityFeed = orders
    .slice(0, 6)
    .map((o) => {
      const name =
        o.customer?.first_name || o.customer?.username || "Customer";
      const initial = name.charAt(0).toUpperCase();
      let message = "";
      switch (o.status) {
        case "PENDING":
          message = `placed a new order #${o.id}`;
          break;
        case "CONFIRMED":
          message = `order #${o.id} confirmed`;
          break;
        case "OUT_FOR_DELIVERY":
          message = `order #${o.id} out for delivery`;
          break;
        case "DELIVERED":
          message = `order #${o.id} was delivered`;
          break;
        case "CANCELLED":
          message = `cancelled order #${o.id}`;
          break;
        default:
          message = `updated order #${o.id}`;
      }
      const time = o.created_at
        ? new Date(o.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      return { name, initial, message, time, status: o.status };
    });

  const avatarColors = [
    "#4A7DFF",
    "#6C5CE7",
    "#FF6B6B",
    "#10B981",
    "#F59E0B",
    "#EC4899",
  ];

  const handleQuickStatusChange = async (orderId, newStatus) => {
    const token = getAccessToken();
    try {
      const res = await fetch(
        `${API_URL}/api/v1/orders/${orderId}/`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (res.ok) {
        toast.success(`Order #${orderId} marked as ${newStatus}`);
        fetchDashboardData(true);
      } else {
        toast.error("Failed to update order status");
      }
    } catch {
      toast.error("Network error while updating status");
    }
  };

  const currentDate = referenceDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw
          className="w-8 h-8 animate-spin mb-3"
          style={{ color: "#4A7DFF" }}
        />
        <p
          className="text-sm font-medium"
          style={{ color: "#8C8FA7" }}
        >
          Loading Store Operations...
        </p>
      </div>
    );
  }

  const isHistorical = new Date().toDateString() !== referenceDate.toDateString();
  const dateLabel = isHistorical ? "Latest Activity: " + currentDate : currentDate;

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* ─── TWO COLUMN LAYOUT ─── */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ─── LEFT COLUMN (Main Content) ─── */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Greeting Header */}
          <div className="dash-fade-up flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1
                className="bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent drop-shadow-sm text-2xl sm:text-[28px] font-medium tracking-tight"
                style={{
                  color: isDark ? "#fff" : "#1a1a2e",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Hello, Admin 👋
              </h1>
              <p
                className="text-sm mt-1"
                style={{ color: "#8C8FA7" }}
              >
                Track store progress here. Your overall result is good
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
                style={{
                  background: isDark ? (isHistorical ? "rgba(245,158,11,0.1)" : "#1a1a26") : (isHistorical ? "#FEF3C7" : "#fff"),
                  color: isDark ? (isHistorical ? "#F59E0B" : "#888") : (isHistorical ? "#D97706" : "#8C8FA7"),
                  border: `1px solid ${isDark ? (isHistorical ? "rgba(245,158,11,0.2)" : "#252530") : (isHistorical ? "#FDE68A" : "#ECEDF1")}`,
                }}
              >
                <CalendarDays size={14} />
                <span>{dateLabel}</span>
              </div>
              <button
                onClick={() => fetchDashboardData(false)}
                disabled={refreshing}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold admin-nav-item cursor-pointer"
                style={{
                  background: "#4A7DFF",
                  color: "#fff",
                  boxShadow: "0 2px 8px rgba(74,125,255,0.3)",
                  opacity: refreshing ? 0.7 : 1,
                }}
              >
                <RefreshCw
                  size={13}
                  className={refreshing ? "animate-spin" : ""}
                />
                <span>{refreshing ? "Syncing..." : "Sync"}</span>
              </button>
            </div>
          </div>

          {/* ─── STAT CARDS ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Finished Orders */}
            <div
              className="dash-fade-up dash-fade-up-d1 p-5 rounded-2xl"
              style={{
                background: isDark ? "#111118" : "#fff",
                border: `1px solid ${isDark ? "#1e1e2a" : "#ECEDF1"}`,
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <span
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: "#8C8FA7" }}
                >
                  Delivered
                </span>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: isDark
                      ? "rgba(16,185,129,0.1)"
                      : "#ECFDF5",
                  }}
                >
                  <CheckCircle2 size={16} style={{ color: "#10B981" }} />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-3xl font-medium"
                  style={{
                    color: isDark ? "#fff" : "#1a1a2e",
                  }}
                >
                  {deliveredToday}
                </span>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: isDark
                      ? "rgba(16,185,129,0.1)"
                      : "#ECFDF5",
                    color: "#10B981",
                  }}
                >
                  today
                </span>
              </div>
              <div
                className="mt-3 h-1.5 rounded-full overflow-hidden"
                style={{
                  background: isDark ? "#1a1a26" : "#F0F1F5",
                }}
              >
                <div
                  className="h-full rounded-full dash-progress-fill"
                  style={{
                    width: `${totalNonCancelled > 0 ? (deliveredToday / totalNonCancelled) * 100 : 0}%`,
                    background:
                      "linear-gradient(90deg, #10B981, #34D399)",
                  }}
                />
              </div>
            </div>

            {/* Active Orders (Tracked) */}
            <div
              className="dash-fade-up dash-fade-up-d2 p-5 rounded-2xl"
              style={{
                background: isDark ? "#111118" : "#fff",
                border: `1px solid ${isDark ? "#1e1e2a" : "#ECEDF1"}`,
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <span
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: "#8C8FA7" }}
                >
                  Active
                </span>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: isDark
                      ? "rgba(74,125,255,0.1)"
                      : "#EEF2FF",
                  }}
                >
                  <Clock size={16} style={{ color: "#4A7DFF" }} />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-3xl font-medium"
                  style={{
                    color: isDark ? "#fff" : "#1a1a2e",
                  }}
                >
                  {pendingOrders.length + outForDeliveryOrders.length}
                </span>
                <span
                  className="text-xs font-medium"
                  style={{ color: "#8C8FA7" }}
                >
                  orders
                </span>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <div
                  className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-lg"
                  style={{
                    background: isDark
                      ? "rgba(245,158,11,0.1)"
                      : "#FEF3C7",
                    color: "#F59E0B",
                  }}
                >
                  <span>{pendingOrders.length} pending</span>
                </div>
                <div
                  className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-lg"
                  style={{
                    background: isDark
                      ? "rgba(139,92,246,0.1)"
                      : "#EDE9FE",
                    color: "#8B5CF6",
                  }}
                >
                  <span>{outForDeliveryOrders.length} on road</span>
                </div>
              </div>
            </div>

            {/* Efficiency */}
            <div
              className="dash-fade-up dash-fade-up-d3 p-5 rounded-2xl flex items-center justify-between"
              style={{
                background: isDark ? "#111118" : "#fff",
                border: `1px solid ${isDark ? "#1e1e2a" : "#ECEDF1"}`,
              }}
            >
              <div>
                <span
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: "#8C8FA7" }}
                >
                  Efficiency
                </span>
                <div className="mt-3 flex items-baseline gap-1">
                  <span
                    className="text-3xl font-medium"
                    style={{
                      color: isDark ? "#fff" : "#1a1a2e",
                    }}
                  >
                    {efficiency}%
                  </span>
                </div>
                <p
                  className="text-[11px] mt-1"
                  style={{ color: "#8C8FA7" }}
                >
                  delivery success rate
                </p>
              </div>
              <EfficiencyRing percentage={efficiency} isDark={isDark} />
            </div>
          </div>

          {/* ─── PERFORMANCE CHART ─── */}
          <div
            className="dash-fade-up dash-fade-up-d4 p-5 sm:p-6 rounded-2xl"
            style={{
              background: isDark ? "#111118" : "#fff",
              border: `1px solid ${isDark ? "#1e1e2a" : "#ECEDF1"}`,
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2
                  className="bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent drop-shadow-sm text-base font-semibold"
                  style={{ color: isDark ? "#fff" : "#1a1a2e" }}
                >
                  Performance
                </h2>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "#8C8FA7" }}
                >
                  Order trends — last 14 days
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-[3px] rounded-full"
                    style={{ background: "#4A7DFF" }}
                  />
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: "#8C8FA7" }}
                  >
                    All Orders
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-[3px] rounded-full"
                    style={{
                      background: isDark ? "#6C5CE7" : "#A78BFA",
                    }}
                  />
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: "#8C8FA7" }}
                  >
                    Delivered
                  </span>
                </div>
              </div>
            </div>
            <PerformanceChart orders={orders} isDark={isDark} />
          </div>

          {/* ─── REVENUE & CASH COLLECTION CHART ─── */}
          <div className="dash-fade-up dash-fade-up-d4">
            <RevenueTrendChart orders={orders} isDark={isDark} />
          </div>

          {/* ─── 2-COLUMN ANALYTICS GRID: CATEGORY SHARE & PEAK ORDER HOURS ─── */}
          <div className="dash-fade-up dash-fade-up-d4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CategoryDistributionChart orders={orders} products={products} isDark={isDark} />
            <HourlyDistributionChart orders={orders} isDark={isDark} />
          </div>

          {/* ─── BHILWARA ORDER PROBABILITY & AREA HEATMAP ─── */}
          <div className="dash-fade-up dash-fade-up-d4">
            <BhilwaraOrderMap
              orders={orders}
              isDark={isDark}
              compact={true}
              onRefresh={() => fetchDashboardData(true)}
            />
          </div>

          {/* ─── CURRENT TASKS (Recent Orders) ─── */}
          <div
            className="dash-fade-up dash-fade-up-d5 p-5 sm:p-6 rounded-2xl"
            style={{
              background: isDark ? "#111118" : "#fff",
              border: `1px solid ${isDark ? "#1e1e2a" : "#ECEDF1"}`,
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2
                  className="bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent drop-shadow-sm text-base font-semibold"
                  style={{ color: isDark ? "#fff" : "#1a1a2e" }}
                >
                  Current Tasks
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "#8C8FA7" }}>
                  Done {deliveredToday}/{todayOrders.length || "—"}
                </p>
              </div>
              <Link
                href="/orders"
                className="flex items-center gap-1 text-xs font-semibold admin-nav-item"
                style={{ color: "#4A7DFF" }}
              >
                <span>View All</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            {orders.length === 0 ? (
              <div
                className="text-center py-12 text-sm"
                style={{ color: "#8C8FA7" }}
              >
                No orders yet.
              </div>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 6).map((order) => {
                  const config =
                    statusConfig[order.status] || statusConfig.PENDING;
                  const progress = statusProgress[order.status] || 0;

                  return (
                    <div
                      key={order.id}
                      className="flex items-center gap-4 p-3 rounded-xl admin-nav-item"
                      style={{
                        background: isDark
                          ? "rgba(255,255,255,0.02)"
                          : "#FAFBFC",
                        border: `1px solid ${isDark ? "#1a1a26" : "#F0F1F5"}`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isDark
                          ? "rgba(255,255,255,0.04)"
                          : "#F5F6FA";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isDark
                          ? "rgba(255,255,255,0.02)"
                          : "#FAFBFC";
                      }}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: isDark
                            ? "rgba(74,125,255,0.1)"
                            : "#EEF2FF",
                        }}
                      >
                        <ShoppingBag
                          size={16}
                          style={{ color: "#4A7DFF" }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-sm font-semibold truncate"
                            style={{
                              color: isDark ? "#e4e4e7" : "#1a1a2e",
                            }}
                          >
                            {order.order_number || `Order #${order.id}`}
                          </span>
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: config.bg,
                              color: config.color,
                            }}
                          >
                            {config.label}
                          </span>
                        </div>
                        <p
                          className="text-[11px] mt-0.5 truncate"
                          style={{ color: "#8C8FA7" }}
                        >
                          {order.customer?.first_name ||
                            order.customer?.username ||
                            "Customer"}{" "}
                          • ₹
                          {parseFloat(order.total_amount || 0).toFixed(0)}
                        </p>
                      </div>

                      <div className="hidden sm:flex items-center gap-3 w-40">
                        <div
                          className="flex-1 h-1.5 rounded-full overflow-hidden"
                          style={{
                            background: isDark ? "#1a1a26" : "#F0F1F5",
                          }}
                        >
                          <div
                            className="h-full rounded-full dash-progress-fill"
                            style={{
                              width: `${progress}%`,
                              background: config.color,
                            }}
                          />
                        </div>
                        <span
                          className="text-xs font-semibold w-8 text-right"
                          style={{ color: isDark ? "#888" : "#8C8FA7" }}
                        >
                          {progress}%
                        </span>
                      </div>

                      {(order.status === "PENDING" ||
                        order.status === "CONFIRMED") && (
                        <button
                          onClick={() =>
                            handleQuickStatusChange(
                              order.id,
                              "OUT_FOR_DELIVERY"
                            )
                          }
                          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold admin-nav-item cursor-pointer"
                          style={{
                            background: isDark
                              ? "rgba(74,125,255,0.15)"
                              : "#EEF2FF",
                            color: "#4A7DFF",
                          }}
                        >
                          <Bike size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT COLUMN (Profile + Activity) ─── */}
        <div className="w-full lg:w-[320px] shrink-0 space-y-6">
          {/* Quick Stats Cards */}
          <div
            className="dash-fade-up dash-fade-up-d2 p-5 rounded-2xl"
            style={{
              background: isDark ? "#111118" : "#fff",
              border: `1px solid ${isDark ? "#1e1e2a" : "#ECEDF1"}`,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-sm font-semibold"
                style={{ color: isDark ? "#fff" : "#1a1a2e" }}
              >
                Today&apos;s Summary
              </h3>
              <CalendarDays size={16} style={{ color: "#8C8FA7" }} />
            </div>

            <div className="space-y-3">
              {/* Revenue */}
              <div
                className="flex items-center justify-between p-3 rounded-xl"
                style={{
                  background: isDark
                    ? "rgba(74,125,255,0.06)"
                    : "#F8F9FE",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: isDark
                        ? "rgba(74,125,255,0.15)"
                        : "#EEF2FF",
                    }}
                  >
                    <TrendingUp size={15} style={{ color: "#4A7DFF" }} />
                  </div>
                  <div>
                    <p
                      className="text-[11px] font-medium"
                      style={{ color: "#8C8FA7" }}
                    >
                      Revenue
                    </p>
                    <p
                      className="text-sm font-medium"
                      style={{
                        color: isDark ? "#fff" : "#1a1a2e",
                      }}
                    >
                      ₹{todayRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
                <ArrowUpRight size={16} style={{ color: "#10B981" }} />
              </div>

              {/* Orders */}
              <div
                className="flex items-center justify-between p-3 rounded-xl"
                style={{
                  background: isDark
                    ? "rgba(16,185,129,0.06)"
                    : "#F0FDF8",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: isDark
                        ? "rgba(16,185,129,0.15)"
                        : "#ECFDF5",
                    }}
                  >
                    <ShoppingBag
                      size={15}
                      style={{ color: "#10B981" }}
                    />
                  </div>
                  <div>
                    <p
                      className="text-[11px] font-medium"
                      style={{ color: "#8C8FA7" }}
                    >
                      Orders
                    </p>
                    <p
                      className="text-sm font-medium"
                      style={{
                        color: isDark ? "#fff" : "#1a1a2e",
                      }}
                    >
                      {todayOrders.length}
                    </p>
                  </div>
                </div>
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "#8C8FA7" }}
                >
                  today
                </span>
              </div>

              {/* Stock Alert */}
              <Link
                href="/inventory"
                className="flex items-center justify-between p-3 rounded-xl admin-nav-item"
                style={{
                  background: isDark
                    ? "rgba(239,68,68,0.06)"
                    : "#FFF5F5",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: isDark
                        ? "rgba(239,68,68,0.15)"
                        : "#FEE2E2",
                    }}
                  >
                    <AlertTriangle
                      size={15}
                      style={{ color: "#EF4444" }}
                    />
                  </div>
                  <div>
                    <p
                      className="text-[11px] font-medium"
                      style={{ color: "#8C8FA7" }}
                    >
                      Out of Stock
                    </p>
                    <p
                      className="text-sm font-medium"
                      style={{
                        color: isDark ? "#fff" : "#1a1a2e",
                      }}
                    >
                      {outOfStockProducts.length}
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: "#8C8FA7" }} />
              </Link>
            </div>
          </div>

          {/* ─── STOCK HEALTH GAUGE ─── */}
          <div className="dash-fade-up dash-fade-up-d3">
            <StockHealthGauge products={products} isDark={isDark} />
          </div>

          {/* ─── ACTIVITY FEED ─── */}
          <div
            className="dash-fade-up dash-fade-up-d4 p-5 rounded-2xl"
            style={{
              background: isDark ? "#111118" : "#fff",
              border: `1px solid ${isDark ? "#1e1e2a" : "#ECEDF1"}`,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-sm font-semibold"
                style={{ color: isDark ? "#fff" : "#1a1a2e" }}
              >
                Activity
              </h3>
              <Activity size={16} style={{ color: "#8C8FA7" }} />
            </div>

            {activityFeed.length === 0 ? (
              <p
                className="text-xs text-center py-6"
                style={{ color: "#8C8FA7" }}
              >
                No recent activity
              </p>
            ) : (
              <div className="space-y-4">
                {activityFeed.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-medium"
                      style={{
                        background: `${avatarColors[index % avatarColors.length]}18`,
                        color: avatarColors[index % avatarColors.length],
                      }}
                    >
                      {item.initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] leading-relaxed">
                        <span
                          className="font-semibold"
                          style={{
                            color: isDark ? "#e4e4e7" : "#1a1a2e",
                          }}
                        >
                          {item.name}
                        </span>{" "}
                        <span style={{ color: "#8C8FA7" }}>
                          {item.message}
                        </span>
                      </p>
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: isDark ? "#444" : "#BFC1D0" }}
                      >
                        {item.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── QUICK LINKS ─── */}
          <div
            className="dash-fade-up dash-fade-up-d5 p-5 rounded-2xl"
            style={{
              background: isDark ? "#111118" : "#fff",
              border: `1px solid ${isDark ? "#1e1e2a" : "#ECEDF1"}`,
            }}
          >
            <h3
              className="text-sm font-semibold mb-3"
              style={{ color: isDark ? "#fff" : "#1a1a2e" }}
            >
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  name: "Orders",
                  href: "/orders",
                  icon: ShoppingBag,
                  color: "#4A7DFF",
                },
                {
                  name: "Stock",
                  href: "/inventory",
                  icon: Package,
                  color: "#10B981",
                },
                {
                  name: "Delivery Boys",
                  href: "/riders",
                  icon: Bike,
                  color: "#8B5CF6",
                },
                {
                  name: "Assignments",
                  href: "/deliveries",
                  icon: Clock,
                  color: "#06B6D4",
                },
                {
                  name: "Excel Import",
                  href: "/import",
                  icon: FileSpreadsheet,
                  color: "#F59E0B",
                },
                {
                  name: "Order Heatmap",
                  href: "/order-map",
                  icon: MapPin,
                  color: "#EF4444",
                },
              ].map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-2 p-3 rounded-xl text-xs font-medium admin-nav-item"
                  style={{
                    background: isDark
                      ? "rgba(255,255,255,0.02)"
                      : "#FAFBFC",
                    color: isDark ? "#888" : "#6B6E80",
                    border: `1px solid ${isDark ? "#1a1a26" : "#F0F1F5"}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark
                      ? "rgba(255,255,255,0.04)"
                      : "#F5F6FA";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isDark
                      ? "rgba(255,255,255,0.02)"
                      : "#FAFBFC";
                  }}
                >
                  <item.icon size={15} style={{ color: item.color }} />
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

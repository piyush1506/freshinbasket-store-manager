"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Loader2,
  Users,
  UserCheck,
  UserPlus,
  CreditCard,
} from "lucide-react";
import { getAccessToken, authFetch } from "@/lib/auth";
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
      <div className="h-[380px] w-full flex flex-col items-center justify-center rounded-xl bg-gray-50 dark:bg-[#111118] border border-gray-200 dark:border-[#1e1e2a]">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-2" />
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

    // Get last 14 days of order counts up to today
    const referenceDate = new Date();
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
  const [users, setUsers] = useState([]);
  const [riders, setRiders] = useState([]);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const [categories, setCategories] = useState([]);

  const fetchDashboardData = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setRefreshing(true);

      try {
        const [ordersRes, prodRes, usersRes, catRes] = await Promise.all([
          authFetch(`${API_URL}/api/v1/orders/`),
          authFetch(`${API_URL}/api/v1/products/`),
          authFetch(`${API_URL}/api/v1/users/`),
          authFetch(`${API_URL}/api/v1/categories/`),
        ]);

        let newOrders = [];
        if (ordersRes.ok) {
          const data = await ordersRes.json();
          newOrders = Array.isArray(data) ? data : (data?.results || []);
          setOrders(newOrders);

          const pending = newOrders.filter(
            (o) => o.status === "PENDING" || o.status === "CONFIRMED"
          );
          setPendingCount(pending.length);
        }

        if (prodRes.ok) {
          const prodData = await prodRes.json();
          setProducts(Array.isArray(prodData) ? prodData : (prodData?.results || []));
        }

        if (catRes.ok) {
          const catData = await catRes.json();
          setCategories(Array.isArray(catData) ? catData : (catData?.results || []));
        }

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          const list = Array.isArray(usersData) ? usersData : (usersData?.results || []);
          setUsers(list);
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
    [setPendingCount]
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

  // Calculations (Real-time Today)
  const today = new Date();
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

  // Fast customer & user lookup dictionary
  const usersMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      if (u.id) map[u.id] = u;
      if (u.username) map[u.username] = u;
      if (u.phone_number) map[u.phone_number] = u;
    });
    return map;
  }, [users]);

  // Dynamic customer extractor for orders
  const getCustomerDetails = useCallback((order) => {
    if (!order) return { name: "Customer", phone: "" };

    if (order.customer && typeof order.customer === "object") {
      const name = order.customer.first_name
        ? `${order.customer.first_name} ${order.customer.last_name || ""}`.trim()
        : (order.customer.username || order.customer_name || "Customer");
      const phone = order.customer.phone_number || order.customer.phone || "";
      return { name, phone };
    }

    const matchedUser = usersMap[order.customer] || (order.customer_name ? usersMap[order.customer_name] : null);
    if (matchedUser) {
      const name = matchedUser.first_name
        ? `${matchedUser.first_name} ${matchedUser.last_name || ""}`.trim()
        : (matchedUser.username || order.customer_name || `Customer #${matchedUser.id}`);
      const phone = matchedUser.phone_number || "";
      return { name, phone };
    }

    let name = order.customer_name || order.customer_username || "";
    let phone = order.customer_phone || order.phone_number || order.phone || "";

    if (!phone && name && /^\+?[0-9]{10,12}$/.test(name.trim())) {
      phone = name.trim();
      name = `Customer (${phone})`;
    }

    if (!phone && order.delivery_address) {
      const match = order.delivery_address.match(/(?:\+?91[\-\s]?)?([6-9]\d{9})/);
      if (match) {
        phone = match[1];
      }
    }

    return {
      name: name || (order.customer ? `Customer #${order.customer}` : "Customer"),
      phone: phone || "",
    };
  }, [usersMap]);

  const activityFeed = orders
    .slice(0, 6)
    .map((o) => {
      const { name } = getCustomerDetails(o);
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

  const currentDate = today.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center mb-3">
          <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
        </div>
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
          Loading Store Operations...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* ─── 1. TOP HEADER ─── */}
      <div className="dash-fade-up flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent"
          >
            Operations Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Real-time live store metrics, sales velocity, and delivery operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium shadow-xs"
            style={{
              background: isDark ? "#181824" : "#fff",
              color: isDark ? "#94a3b8" : "#64748b",
              border: `1px solid ${isDark ? "#272738" : "#e2e8f0"}`,
            }}
          >
            <CalendarDays size={14} className="text-blue-500" />
            <span>{currentDate}</span>
          </div>
          <button
            onClick={() => fetchDashboardData(false)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer disabled:opacity-60"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "Syncing..." : "Sync Live"}</span>
          </button>
        </div>
      </div>

      {/* ─── 2. KEY METRICS STAT CARDS (4 Columns) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div
          className="dash-fade-up p-5 rounded-xl border transition-all"
          style={{
            background: isDark ? "#111118" : "#fff",
            borderColor: isDark ? "#1e1e2a" : "#ECEDF1",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Today&apos;s Revenue
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
              ₹{todayRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md">
              {todayOrders.length} orders
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            Non-cancelled sales volume for {currentDate}
          </p>
        </div>


        {/* Delivered Orders */}
        <div
          className="dash-fade-up p-5 rounded-xl border transition-all"
          style={{
            background: isDark ? "#111118" : "#fff",
            borderColor: isDark ? "#1e1e2a" : "#ECEDF1",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Completed Deliveries
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
              {deliveredToday}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              of {totalNonCancelled} orders
            </span>
          </div>
          <div className="mt-3 h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
              style={{
                width: `${totalNonCancelled > 0 ? (deliveredToday / totalNonCancelled) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Pending & On-Road Fleet */}
        <div
          className="dash-fade-up p-5 rounded-xl border transition-all"
          style={{
            background: isDark ? "#111118" : "#fff",
            borderColor: isDark ? "#1e1e2a" : "#ECEDF1",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Active Orders
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
              {pendingOrders.length + outForDeliveryOrders.length}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              in pipeline
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
              {pendingOrders.length} pending
            </span>
            <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
              {outForDeliveryOrders.length} on road
            </span>
          </div>
        </div>

        {/* Fleet Efficiency & Stock Alert */}
        <div
          className="dash-fade-up p-5 rounded-xl border transition-all flex items-center justify-between"
          style={{
            background: isDark ? "#111118" : "#fff",
            borderColor: isDark ? "#1e1e2a" : "#ECEDF1",
          }}
        >
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Fulfillment Rate
            </span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
                {efficiency}%
              </span>
            </div>
            <Link
              href="/products"
              className="text-[11px] font-medium text-rose-500 hover:underline block mt-1"
            >
              {outOfStockProducts.length > 0
                ? `⚠ ${outOfStockProducts.length} items out of stock`
                : "✔ All stock healthy"}
            </Link>
          </div>
          <EfficiencyRing percentage={efficiency} isDark={isDark} />
        </div>
      </div>

      {/* ─── 3. MAIN ANALYTICS ROW (Revenue Chart & Category Donut) ─── */}
      <div className="dash-fade-up grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 flex flex-col">
          <RevenueTrendChart orders={orders} isDark={isDark} />
        </div>
        <div className="lg:col-span-5 flex flex-col">
          <CategoryDistributionChart orders={orders} products={products} categories={categories} isDark={isDark} />
        </div>
      </div>


      {/* ─── 4. OPERATIONAL INSIGHTS (Peak Hours & Live Orders) ─── */}
      <div className="dash-fade-up grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Hourly Peak Slots */}
        <div className="lg:col-span-6 flex flex-col">
          <HourlyDistributionChart orders={orders} isDark={isDark} />
        </div>

        {/* Current Tasks / Recent Orders */}
        <div
          className="lg:col-span-6 p-5 sm:p-6 rounded-xl border transition-all flex flex-col justify-between"
          style={{
            background: isDark ? "#111118" : "#fff",
            borderColor: isDark ? "#1e1e2a" : "#ECEDF1",
          }}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3
                  className="text-base font-semibold tracking-tight"
                  style={{ color: isDark ? "#fff" : "#1a1a2e" }}
                >
                  Recent Order Queue
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Live customer orders with rapid dispatch controls
                </p>
              </div>
              <Link
                href="/orders"
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span>Live Orders</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400">No active orders yet.</div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {orders.slice(0, 5).map((order) => {
                  const config = statusConfig[order.status] || statusConfig.PENDING;
                  const progress = statusProgress[order.status] || 0;

                  return (
                    <div
                      key={order.id}
                      className="flex items-center gap-3 p-3 rounded-xl border transition-all"
                      style={{
                        background: isDark ? "rgba(255,255,255,0.02)" : "#FAFBFC",
                        borderColor: isDark ? "#1e1e2a" : "#F0F1F5",
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                        <ShoppingBag size={15} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate">
                            {order.order_number || `Order #${order.id}`}
                          </span>
                          <span
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                            style={{
                              background: config.bg,
                              color: config.color,
                            }}
                          >
                            {config.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                          {getCustomerDetails(order).name} • ₹
                          {parseFloat(order.total_amount || 0).toFixed(0)} •{" "}
                          {order.payment_method || "COD"}
                        </p>
                      </div>

                      {(order.status === "PENDING" || order.status === "CONFIRMED") && (
                        <button
                          onClick={() => handleQuickStatusChange(order.id, "OUT_FOR_DELIVERY")}
                          className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Dispatch to Rider"
                        >
                          <Bike size={14} />
                          <span>Dispatch</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>Showing latest {Math.min(orders.length, 5)} orders</span>
            <Link
              href="/orders"
              className="font-medium text-slate-700 dark:text-zinc-200 hover:text-blue-600"
            >
              Open Full Manager →
            </Link>
          </div>

        </div>
      </div>

      {/* ─── 5. BOTTOM SECTION: MAP & INVENTORY HEALTH ─── */}
      <div className="dash-fade-up grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 flex flex-col">
          <BhilwaraOrderMap
            orders={orders}
            isDark={isDark}
            compact={true}
            onRefresh={() => fetchDashboardData(true)}
          />
        </div>
        <div className="lg:col-span-4 flex flex-col space-y-6">
          <StockHealthGauge products={products} isDark={isDark} />

          {/* Quick Shortcuts */}
          <div
            className="p-5 rounded-xl border transition-all flex-1"
            style={{
              background: isDark ? "#111118" : "#fff",
              borderColor: isDark ? "#1e1e2a" : "#ECEDF1",
            }}
          >
            <h3
              className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-3"
            >
              Operations Quick Links
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: "Live Orders", href: "/orders", icon: ShoppingBag, color: "#2563EB" },
                { name: "Products Catalog", href: "/products", icon: Package, color: "#3B82F6" },
                { name: "Riders Fleet", href: "/riders", icon: Bike, color: "#8B5CF6" },
                { name: "Assignments", href: "/deliveries", icon: Clock, color: "#06B6D4" },
                { name: "Excel Import", href: "/import", icon: FileSpreadsheet, color: "#F59E0B" },
                { name: "Order Map", href: "/order-map", icon: MapPin, color: "#EF4444" },
              ].map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium hover:bg-slate-50 dark:hover:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 transition-all"
                >
                  <item.icon size={15} style={{ color: item.color }} />
                  <span className="text-slate-700 dark:text-zinc-200">{item.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


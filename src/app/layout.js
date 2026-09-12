"use client";

import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Toaster, toast } from "react-hot-toast";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Bike,
  Image as ImageIcon,
  FileSpreadsheet,
  LogOut,
  Bell,
  Volume2,
  VolumeX,
  Menu,
  PlusCircle,
  X,
  ShieldCheck,
  Sun,
  Moon,
  HelpCircle,
  MapPin,
  ClipboardList,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { getAccessToken, getUser, clearAuth } from "@/lib/auth";
import "./globals.css";

// Context for global admin state (sound, active counts, theme, incoming order alarms)
export const AdminContext = createContext({
  soundEnabled: true,
  setSoundEnabled: () => { },
  pendingCount: 0,
  setPendingCount: () => { },
  playChime: () => { },
  triggerIncomingOrderAlert: () => { },
  dismissIncomingOrderAlert: () => { },
  activeIncomingOrder: null,
  theme: "light",
  toggleTheme: () => { },
});

export function useAdmin() {
  return useContext(AdminContext);
}

// High-volume, piercing merchant order alert using Web Audio API + Dynamic Compressor
function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    // Dynamics Compressor to boost perceived loudness and clarity
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-24, ctx.currentTime);
    compressor.knee.setValueAtTime(30, ctx.currentTime);
    compressor.ratio.setValueAtTime(12, ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    compressor.release.setValueAtTime(0.25, ctx.currentTime);
    compressor.connect(ctx.destination);

    // Master Gain for maximum volume
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1.8, ctx.currentTime);
    masterGain.connect(compressor);

    // High-pitch dual-tone burst sequence (Piercing Merchant Bell pattern)
    const pulses = [
      { f1: 880, f2: 1760, start: 0.00, dur: 0.16 },
      { f1: 1175, f2: 2350, start: 0.18, dur: 0.16 },
      { f1: 1568, f2: 3136, start: 0.36, dur: 0.30 },

      { f1: 880, f2: 1760, start: 0.75, dur: 0.16 },
      { f1: 1175, f2: 2350, start: 0.93, dur: 0.16 },
      { f1: 1568, f2: 3136, start: 1.11, dur: 0.45 },
    ];

    pulses.forEach(({ f1, f2, start, dur }) => {
      // Primary Oscillator (Triangle wave for rich volume penetration)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(f1, ctx.currentTime + start);
      gain1.gain.setValueAtTime(1.0, ctx.currentTime + start);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(ctx.currentTime + start);
      osc1.stop(ctx.currentTime + start + dur);

      // Harmonic Oscillator (Sine wave for bell resonance)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(f2, ctx.currentTime + start);
      gain2.gain.setValueAtTime(0.7, ctx.currentTime + start);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(ctx.currentTime + start);
      osc2.stop(ctx.currentTime + start + dur);
    });
  } catch (e) {
    console.log("Audio notification failed or blocked:", e);
  }
}

export default function RootLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [user, setUserState] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSoundPrompt, setShowSoundPrompt] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [theme, setTheme] = useState("light");

  // Continuous incoming order alert state
  const [activeIncomingOrder, setActiveIncomingOrder] = useState(null);
  const alarmIntervalRef = useRef(null);
  const knownOrderIdsRef = useRef(new Set());
  const initialFetchDoneRef = useRef(false);

  // Stop the looping chime sound
  const stopAlarmLoop = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
  }, []);

  // Trigger continuous looping chime & incoming order modal
  const triggerIncomingOrderAlert = useCallback((orderData) => {
    setActiveIncomingOrder(orderData || { id: "LIVE", order_number: "LIVE ORDER" });
    
    // Play first ring immediately
    playNotificationChime();

    // Clear previous timer
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
    }

    // Loop chime every 1800ms continuously until confirmed by admin
    alarmIntervalRef.current = setInterval(() => {
      playNotificationChime();
    }, 1800);
  }, []);

  // Dismiss popup and stop alarm
  const dismissIncomingOrderAlert = useCallback(() => {
    stopAlarmLoop();
    setActiveIncomingOrder(null);
  }, [stopAlarmLoop]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      stopAlarmLoop();
    };
  }, [stopAlarmLoop]);

  // Register PWA Service Worker
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => console.log("PWA Service Worker registered:", reg.scope))
          .catch((err) => console.log("PWA Service Worker registration error:", err));
      });
    }
  }, []);

  // Check Sound Permission on site open
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasPermission = localStorage.getItem("fib_audio_permission_granted");
      if (hasPermission !== "true" && pathname !== "/login") {
        const timer = setTimeout(() => {
          setShowSoundPrompt(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [pathname]);

  const enableSoundPermission = () => {
    setSoundEnabled(true);
    setShowSoundPrompt(false);
    localStorage.setItem("fib_audio_permission_granted", "true");
    localStorage.setItem("admin_sound_enabled", "true");
    playNotificationChime();
    toast.success("Audio Permission Granted! Loud order alerts are active.", {
      icon: "🔊",
      duration: 4000,
    });
  };

  // Background Live Order Poll across all admin pages
  useEffect(() => {
    if (!authorized || pathname === "/login") return;

    const checkLiveOrders = async () => {
      const token = getAccessToken();
      if (!token) return;

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/orders/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data?.results || []);
          const pending = list.filter((o) => o.status === "PENDING" || o.status === "CONFIRMED");
          setPendingCount(pending.length);

          if (!initialFetchDoneRef.current) {
            list.forEach((o) => knownOrderIdsRef.current.add(o.id));
            initialFetchDoneRef.current = true;
          } else {
            const newOrders = list.filter((o) => !knownOrderIdsRef.current.has(o.id));
            if (newOrders.length > 0) {
              const latest = newOrders[0];
              newOrders.forEach((o) => knownOrderIdsRef.current.add(o.id));
              triggerIncomingOrderAlert(latest);
            }
          }
        }
      } catch (e) {
        console.error("Live order polling error:", e);
      }
    };

    checkLiveOrders();
    const interval = setInterval(checkLiveOrders, 10000);
    return () => clearInterval(interval);
  }, [authorized, pathname, triggerIncomingOrderAlert]);

  // Load and apply theme preference
  useEffect(() => {
    const savedTheme = localStorage.getItem("admin_theme");
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("admin_theme", next);
  };

  // Authentication check
  useEffect(() => {
    if (pathname === "/login") {
      setAuthorized(true);
      return;
    }
    const token = getAccessToken();
    const currentUser = getUser();
    if (!token || !currentUser || currentUser.role !== "ADMIN") {
      router.push("/login?redirect=" + encodeURIComponent(pathname));
      return;
    }
    setUserState(currentUser);
    setAuthorized(true);
  }, [router, pathname]);

  // Handle Logout
  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Live Orders", href: "/orders", icon: ShoppingBag, badge: pendingCount },
    { name: "Products", href: "/products", icon: Package },
    { name: "Order Map", href: "/order-map", icon: MapPin },
    { name: "Delivery Boys", href: "/riders", icon: Bike },
    { name: "Delivery Assignments", href: "/deliveries", icon: ClipboardList },
    { name: "App Slides", href: "/slides", icon: ImageIcon },
    { name: "Excel Import", href: "/import", icon: FileSpreadsheet },
  ];

  const mobileBottomNav = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Products", href: "/products", icon: Package },
    { name: "Orders", href: "/orders", icon: ShoppingBag, badge: pendingCount },
    { name: "Boys", href: "/riders", icon: Bike },
    { name: "Assign", href: "/deliveries", icon: ClipboardList },
  ];

  const isDark = theme === "dark";

  if (pathname === "/login") {
    return (
      <html lang="en" className={isDark ? "dark" : ""} suppressHydrationWarning>
        <head>
          <title>FreshInBasket Admin | Authentication</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#2563eb" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="FreshInBasket" />
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" />
        </head>
        <body className={isDark ? "dark" : ""} suppressHydrationWarning>
          <Toaster position="top-right" />
          {children}
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className={isDark ? "dark" : ""} suppressHydrationWarning>
      <head>
        <title>FreshInBasket Admin Console</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FreshInBasket" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body className={isDark ? "dark" : ""} suppressHydrationWarning>
        <Toaster position="top-right" />
        <AdminContext.Provider
          value={{
            soundEnabled,
            setSoundEnabled,
            pendingCount,
            setPendingCount,
            playChime: () => {
              if (soundEnabled) playNotificationChime();
            },
            triggerIncomingOrderAlert,
            dismissIncomingOrderAlert,
            activeIncomingOrder,
            theme,
            toggleTheme,
          }}
        >
          {!authorized ? (
            <div
              className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors"
              style={{ background: isDark ? "#0a0a0f" : "#F7F8FA" }}
            >
              <div className="relative flex items-center justify-center mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
              </div>
              <p
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: isDark ? "#888" : "#64748b" }}
              >
                Verifying Admin Access…
              </p>
            </div>
          ) : (
            <div
              className="h-screen h-[100dvh] flex flex-col antialiased transition-colors duration-200 overflow-hidden"
              style={{
                background: isDark ? "#0a0a0f" : "#F7F8FA",
                color: isDark ? "#e4e4e7" : "#1a1a2e",
              }}
            >
              {/* ─── TOP BAR ─── */}
              <header
                className="sticky top-0 z-40 flex items-center justify-between px-4 lg:px-6 py-3 shrink-0"
                style={{
                  background: isDark ? "rgba(14,14,20,0.95)" : "rgba(255,255,255,0.92)",
                  backdropFilter: "blur(12px)",
                  borderBottom: `1px solid ${isDark ? "#1e1e2a" : "#ECEDF1"}`,
                }}
              >
                <div className="flex items-center gap-3">
                  {/* Mobile menu trigger */}
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="md:hidden p-2 rounded-xl admin-nav-item"
                    style={{ color: isDark ? "#888" : "#8C8FA7" }}
                    aria-label="Toggle menu"
                  >
                    {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                  </button>

                  {/* Mobile Brand Logo */}
                  <Link href="/" className="flex items-center gap-2.5 md:hidden">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-semibold text-sm"
                      style={{
                        background: "linear-gradient(135deg, #4A7DFF, #6C5CE7)",
                        color: "#fff",
                      }}
                    >
                      F
                    </div>
                    <span
                      className="font-medium text-sm"
                      style={{ color: isDark ? "#fff" : "#1a1a2e" }}
                    >
                      FreshInBasket
                    </span>
                  </Link>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Theme Toggle */}
                  <button
                    onClick={toggleTheme}
                    title={`Switch to ${isDark ? "Light" : "Dark"} theme`}
                    className="p-2 rounded-xl admin-nav-item cursor-pointer"
                    style={{
                      background: isDark ? "#1a1a26" : "#F0F1F5",
                      color: isDark ? "#888" : "#8C8FA7",
                    }}
                    aria-label="Toggle theme"
                  >
                    {isDark ? <Sun size={16} /> : <Moon size={16} />}
                  </button>

                  {/* Sound Toggle Icon Button */}
                  <button
                    onClick={() => {
                      const next = !soundEnabled;
                      setSoundEnabled(next);
                      if (next) {
                        playNotificationChime();
                        toast.success("Sound alerts enabled", { icon: "🔊" });
                      } else {
                        toast("Sound alerts muted", { icon: "🔇" });
                      }
                    }}
                    title={soundEnabled ? "Sound Alerts Active (Click to mute)" : "Sound Alerts Muted (Click to enable)"}
                    className="p-2 rounded-xl admin-nav-item cursor-pointer transition-colors"
                    style={{
                      background: isDark ? "#1a1a26" : "#F0F1F5",
                      color: soundEnabled ? (isDark ? "#60a5fa" : "#2563eb") : (isDark ? "#888" : "#8C8FA7"),
                    }}
                    aria-label="Toggle sound alerts"
                  >
                    {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  </button>

                  {/* Orders Bell */}
                  <Link
                    href="/orders"
                    className="relative p-2 rounded-xl admin-nav-item"
                    style={{ color: isDark ? "#888" : "#8C8FA7" }}
                    title="View Live Orders"
                  >
                    <Bell size={18} />
                    {pendingCount > 0 && (
                      <span
                        className="absolute -top-1 -right-1 min-w-[18px] h-[18px] font-medium text-[10px] rounded-full flex items-center justify-center px-1"
                        style={{
                          background: "#FF6B6B",
                          color: "#fff",
                          boxShadow: "0 2px 8px rgba(255,107,107,0.4)",
                        }}
                      >
                        {pendingCount}
                      </span>
                    )}
                  </Link>

                  {/* Admin User Chip */}
                  <div
                    className="hidden sm:flex items-center gap-3 pl-3"
                    style={{
                      borderLeft: `1px solid ${isDark ? "#1e1e2a" : "#ECEDF1"}`,
                    }}
                  >
                    <div className="text-right leading-tight">
                      <p
                        className="text-xs font-semibold"
                        style={{ color: isDark ? "#e4e4e7" : "#1a1a2e" }}
                      >
                        {user?.first_name || user?.username || "Admin"}
                      </p>
                      <p
                        className="text-[10px]"
                        style={{ color: isDark ? "#555" : "#8C8FA7" }}
                      >
                        {user?.phone_number || "9461877701"}
                      </p>
                    </div>
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-medium"
                      style={{
                        background: isDark
                          ? "linear-gradient(135deg, #4A7DFF22, #6C5CE722)"
                          : "linear-gradient(135deg, #E8EDFF, #F0EBFF)",
                        color: "#4A7DFF",
                      }}
                    >
                      {(user?.first_name || user?.username || "A").charAt(0).toUpperCase()}
                    </div>
                  </div>
                </div>
              </header>

              {/* ─── MAIN BODY: SIDEBAR + CONTENT ─── */}
              <div className="flex-1 flex overflow-hidden">
                {/* ─── DESKTOP SIDEBAR ─── */}
                <aside
                  className="admin-sidebar hidden md:flex flex-col w-[260px] shrink-0 justify-between p-4 overflow-y-auto"
                  style={{
                    background: isDark ? "#0e0e16" : "#FFFFFF",
                    borderRight: `1px solid ${isDark ? "#1a1a26" : "#ECEDF1"}`,
                  }}
                >
                  <div>
                    {/* Brand Header */}
                    <Link
                      href="/"
                      className="flex items-center gap-3 px-3 mb-8"
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-semibold text-sm"
                        style={{
                          background: "linear-gradient(135deg, #4A7DFF, #6C5CE7)",
                          color: "#fff",
                          boxShadow: "0 4px 12px rgba(74,125,255,0.25)",
                        }}
                      >
                        F
                      </div>
                      <div className="flex flex-col">
                        <span
                          className="font-medium text-[15px] leading-tight tracking-tight"
                          style={{ color: isDark ? "#fff" : "#1a1a2e" }}
                        >
                          FreshInBasket
                        </span>
                        <span
                          className="text-[10px] font-medium tracking-wide uppercase"
                          style={{ color: isDark ? "#555" : "#8C8FA7" }}
                        >
                          Admin Console
                        </span>
                      </div>
                    </Link>

                    {/* Navigation Links */}
                    <div className="space-y-1">
                      {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="admin-nav-item flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium"
                            style={{
                              background: isActive
                                ? isDark
                                  ? "rgba(74,125,255,0.15)"
                                  : "#EEF2FF"
                                : "transparent",
                              color: isActive
                                ? "#4A7DFF"
                                : isDark
                                  ? "#888"
                                  : "#6B6E80",
                              fontWeight: isActive ? 600 : 500,
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive) {
                                e.currentTarget.style.background = isDark
                                  ? "rgba(255,255,255,0.04)"
                                  : "#F5F6FA";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) {
                                e.currentTarget.style.background = "transparent";
                              }
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <Icon
                                size={18}
                                strokeWidth={isActive ? 2.2 : 1.8}
                                style={{
                                  color: isActive
                                    ? "#4A7DFF"
                                    : isDark
                                      ? "#666"
                                      : "#A0A3B5",
                                }}
                              />
                              <span>{item.name}</span>
                            </div>
                            {item.badge > 0 && (
                              <span
                                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                                style={{
                                  background: isActive ? "#4A7DFF" : "#FF6B6B",
                                  color: "#fff",
                                  fontSize: "10px",
                                }}
                              >
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bottom Session Box & Logout */}
                  <div className="space-y-2 mt-6">
                    <div
                      className="p-4 rounded-xl"
                      style={{
                        background: isDark
                          ? "linear-gradient(135deg, rgba(74,125,255,0.08), rgba(108,92,231,0.08))"
                          : "linear-gradient(135deg, #EEF2FF, #F3F0FF)",
                        border: `1px solid ${isDark ? "#1e1e2a" : "#E2E0F5"}`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck size={16} style={{ color: "#4A7DFF" }} />
                        <span
                          className="text-xs font-semibold"
                          style={{ color: isDark ? "#ccc" : "#1a1a2e" }}
                        >
                          Admin Session
                        </span>
                      </div>
                      <p
                        className="text-[11px] mb-1"
                        style={{ color: isDark ? "#666" : "#8C8FA7" }}
                      >
                        Bhilwara Operations Hub
                      </p>
                    </div>

                    <button
                      onClick={handleLogout}
                      className="admin-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium cursor-pointer"
                      style={{ color: isDark ? "#666" : "#8C8FA7" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isDark
                          ? "rgba(255,80,80,0.08)"
                          : "#FFF5F5";
                        e.currentTarget.style.color = "#FF6B6B";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = isDark ? "#666" : "#8C8FA7";
                      }}
                    >
                      <LogOut size={18} strokeWidth={1.8} />
                      <span>Log out</span>
                    </button>
                  </div>
                </aside>

                {/* ─── MOBILE DRAWER MENU ─── */}
                {mobileMenuOpen && (
                  <div
                    className="md:hidden fixed inset-0 z-50 flex"
                    style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div
                      className="w-4/5 max-w-xs h-full p-5 flex flex-col justify-between shadow-2xl"
                      style={{
                        background: isDark ? "#0e0e16" : "#FFFFFF",
                        borderRight: `1px solid ${isDark ? "#1a1a26" : "#ECEDF1"}`,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="space-y-5">
                        <div
                          className="flex items-center justify-between pb-4"
                          style={{
                            borderBottom: `1px solid ${isDark ? "#1a1a26" : "#ECEDF1"}`,
                          }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center font-semibold text-sm"
                              style={{
                                background: "linear-gradient(135deg, #4A7DFF, #6C5CE7)",
                                color: "#fff",
                              }}
                            >
                              F
                            </div>
                            <span
                              className="font-medium text-sm"
                              style={{ color: isDark ? "#fff" : "#1a1a2e" }}
                            >
                              FreshInBasket
                            </span>
                          </div>
                          <button
                            onClick={() => setMobileMenuOpen(false)}
                            className="p-1.5 rounded-lg"
                            style={{ color: isDark ? "#666" : "#8C8FA7" }}
                          >
                            <X size={18} />
                          </button>
                        </div>

                        <div className="space-y-1">
                          {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            const Icon = item.icon;
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className="admin-nav-item flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium"
                                style={{
                                  background: isActive
                                    ? isDark
                                      ? "rgba(74,125,255,0.15)"
                                      : "#EEF2FF"
                                    : "transparent",
                                  color: isActive
                                    ? "#4A7DFF"
                                    : isDark
                                      ? "#888"
                                      : "#6B6E80",
                                  fontWeight: isActive ? 600 : 500,
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                                  <span>{item.name}</span>
                                </div>
                                {item.badge > 0 && (
                                  <span
                                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                                    style={{
                                      background: "#FF6B6B",
                                      color: "#fff",
                                    }}
                                  >
                                    {item.badge}
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>

                      <div
                        className="pt-4"
                        style={{
                          borderTop: `1px solid ${isDark ? "#1a1a26" : "#ECEDF1"}`,
                        }}
                      >
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center justify-center gap-2 py-3 font-semibold text-sm rounded-xl admin-nav-item"
                          style={{
                            background: isDark ? "#1a1a26" : "#F5F6FA",
                            color: isDark ? "#888" : "#6B6E80",
                          }}
                        >
                          <LogOut size={16} />
                          <span>Log Out</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── MAIN CONTENT VIEWPORT ─── */}
                <main
                  className="admin-main-scroll flex-1 overflow-y-auto pb-24 md:pb-8 p-4 sm:p-6 lg:p-8 transition-colors duration-200"
                  style={{
                    background: isDark ? "#0a0a0f" : "#F7F8FA",
                    color: isDark ? "#e4e4e7" : "#1a1a2e",
                  }}
                >
                  {children}
                </main>
              </div>

              {/* ─── MOBILE BOTTOM NAV BAR ─── */}
              <nav
                className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 py-2 flex items-center justify-around"
                style={{
                  background: isDark ? "rgba(14,14,20,0.95)" : "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(12px)",
                  borderTop: `1px solid ${isDark ? "#1a1a26" : "#ECEDF1"}`,
                }}
              >
                {mobileBottomNav.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="relative flex flex-col items-center gap-1 py-1 px-3 rounded-xl admin-nav-item"
                      style={{
                        color: isActive
                          ? "#4A7DFF"
                          : isDark
                            ? "#555"
                            : "#8C8FA7",
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      <div className="relative">
                        <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
                        {item.badge > 0 && (
                          <span
                            className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] font-medium text-[9px] rounded-full flex items-center justify-center px-1"
                            style={{
                              background: "#FF6B6B",
                              color: "#fff",
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] tracking-tight">{item.name}</span>
                    </Link>
                  );
                })}
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="flex flex-col items-center gap-1 py-1 px-3"
                  style={{ color: isDark ? "#555" : "#8C8FA7" }}
                >
                  <Menu size={20} strokeWidth={1.8} />
                  <span className="text-[10px] tracking-tight">More</span>
                </button>
              </nav>
            </div>
          )}

          {/* SOUND PERMISSION PROMPT MODAL (Allows browser autoplay for order alerts) */}
          {showSoundPrompt && (
            <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-[#111118] border border-slate-200 dark:border-[#252530] rounded-2xl p-6 sm:p-7 max-w-sm w-full shadow-2xl space-y-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto border border-blue-200 dark:border-blue-900/60 shadow-xs">
                  <Volume2 className="w-7 h-7 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Enable Order Audio Alerts
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                    FreshInBasket needs audio permissions so you get instant loud sound alerts when a customer places a live order.
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={enableSoundPermission}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Volume2 size={16} />
                    <span>Enable Sound Alerts</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowSoundPrompt(false);
                      sessionStorage.setItem("fib_sound_prompted", "true");
                    }}
                    className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Mute for Now
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* CONTINUOUS RINGING INCOMING ORDER POPUP MODAL (Rings until confirmed by admin) */}
          {activeIncomingOrder && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-[#111118] border border-slate-200 dark:border-[#252530] rounded-2xl p-6 sm:p-7 max-w-sm w-full shadow-2xl space-y-4 text-center relative overflow-hidden">
                {/* Ringing Sound Wave Animation */}
                <div className="w-16 h-16 rounded-full bg-transparent text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-[#252530] flex items-center justify-center mx-auto relative animate-bounce">
                  <Bell className="w-8 h-8 animate-pulse" />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500"></span>
                  </span>
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 text-[11px] font-black tracking-wider uppercase mb-2">
                    <Volume2 size={13} className="animate-spin" />
                    <span>Live Order Alarm Ringing</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    New Order Received!
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Ringing continuously until you confirm & acknowledge.
                  </p>
                </div>

                {/* Order Summary Box (Clean, no colored background) */}
                <div className="bg-transparent border border-slate-200 dark:border-[#252530] rounded-xl p-4 text-left space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Order ID</span>
                    <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                      {activeIncomingOrder.order_number || `#${activeIncomingOrder.id}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Total Amount</span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      ₹{parseFloat(activeIncomingOrder.total_amount || 0).toFixed(0)}
                    </span>
                  </div>
                  {activeIncomingOrder.delivery_slot && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Delivery Slot</span>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {activeIncomingOrder.delivery_slot}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={() => {
                      dismissIncomingOrderAlert();
                      router.push("/orders");
                    }}
                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} />
                    <span>Confirm & View Order</span>
                  </button>
                  <button
                    onClick={stopAlarmLoop}
                    className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Silence Alarm Ringing
                  </button>
                </div>
              </div>
            </div>
          )}
        </AdminContext.Provider>
      </body>
    </html>
  );
}


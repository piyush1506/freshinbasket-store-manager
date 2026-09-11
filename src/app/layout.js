"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Toaster } from "react-hot-toast";
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
} from "lucide-react";
import { getAccessToken, getUser, clearAuth } from "@/lib/auth";
import "./globals.css";

// Context for global admin state (sound, active counts, theme)
export const AdminContext = createContext({
  soundEnabled: true,
  setSoundEnabled: () => {},
  pendingCount: 0,
  setPendingCount: () => {},
  playChime: () => {},
  theme: "light",
  toggleTheme: () => {},
});

export function useAdmin() {
  return useContext(AdminContext);
}

// Pleasant chime using Web Audio API
function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Tone 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Tone 2: 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    gain2.gain.setValueAtTime(0.35, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.6);
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
  const [pendingCount, setPendingCount] = useState(0);
  const [theme, setTheme] = useState("light");

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
    { name: "Quick Stock", href: "/inventory", icon: Package },
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
      <html lang="en" className={isDark ? "dark" : ""}>
        <head>
          <title>FreshInBasket Admin | Authentication</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        </head>
        <body className={isDark ? "dark" : ""}>
          <Toaster position="top-right" />
          {children}
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className={isDark ? "dark" : ""}>
      <head>
        <title>FreshInBasket Admin Console</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body className={isDark ? "dark" : ""}>
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
            theme,
            toggleTheme,
          }}
        >
          {!authorized ? (
            <div
              className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors"
              style={{ background: isDark ? "#0a0a0f" : "#F7F8FA" }}
            >
              <div
                className="w-10 h-10 rounded-full animate-spin mb-4"
                style={{
                  border: `2px solid ${isDark ? "#333" : "#E2E4EA"}`,
                  borderTopColor: isDark ? "#fff" : "#4A7DFF",
                }}
              />
              <p
                className="text-xs uppercase tracking-widest"
                style={{ color: isDark ? "#666" : "#8C8FA7" }}
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

                  {/* Sound Toggle */}
                  <button
                    onClick={() => {
                      const next = !soundEnabled;
                      setSoundEnabled(next);
                      if (next) playNotificationChime();
                    }}
                    title={soundEnabled ? "Sound Alerts Active" : "Sound Muted"}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold admin-nav-item cursor-pointer"
                    style={{
                      background: soundEnabled
                        ? "#4A7DFF"
                        : isDark
                        ? "#1a1a26"
                        : "#F0F1F5",
                      color: soundEnabled ? "#fff" : isDark ? "#666" : "#8C8FA7",
                    }}
                  >
                    {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                    <span className="hidden sm:inline">
                      {soundEnabled ? "Sound" : "Muted"}
                    </span>
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
                      className="p-4 rounded-2xl"
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
        </AdminContext.Provider>
      </body>
    </html>
  );
}

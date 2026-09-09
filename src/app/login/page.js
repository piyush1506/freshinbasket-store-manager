"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  ArrowRight,
  Shield,
  Smartphone,
  Mail,
} from "lucide-react";
import { AUTH_API, isAuthenticated, getUser, clearAuth } from "@/lib/auth";
import toast from "react-hot-toast";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("admin_theme");
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    }

    const savedId = localStorage.getItem("admin_saved_identifier");
    if (savedId) {
      setIdentifier(savedId);
    }

    if (isAuthenticated()) {
      const user = getUser();
      if (user?.role === "ADMIN") {
        router.replace(redirectPath);
      }
    }
  }, [redirectPath, router]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("admin_theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const handleKeyDown = (e) => {
    if (e.getModifierState) {
      setCapsLockOn(e.getModifierState("CapsLock"));
    }
  };

  const cleanId = identifier.trim();
  const isEmail = cleanId.includes("@");
  const isPhone = !isEmail && cleanId.length > 0 && /^[0-9+ -]+$/.test(cleanId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!cleanId) {
      setError("Please enter your admin phone number or email.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    if (rememberMe) {
      localStorage.setItem("admin_saved_identifier", cleanId);
    } else {
      localStorage.removeItem("admin_saved_identifier");
    }

    setLoading(true);
    try {
      const data = await AUTH_API.login(cleanId, password);
      if (data?.user?.role !== "ADMIN") {
        clearAuth();
        setError(
          `Access denied — account role is "${data?.user?.role || "CUSTOMER"}", but "ADMIN" role is required.`
        );
        return;
      }
      toast.success("Welcome back, Admin");
      router.push(redirectPath);
    } catch (err) {
      const msg = err.message || "Authentication failed";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setError("Cannot connect to backend server. Please verify backend is running.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const isDark = theme === "dark";

  return (
    <div
      className={`min-h-screen flex flex-col justify-between transition-colors duration-150 ${
        isDark ? "bg-[#0b0f17] text-white" : "bg-[#f8fafc] text-slate-800"
      }`}
      style={{
        backgroundImage: isDark
          ? "radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)"
          : "radial-gradient(rgba(0, 0, 0, 0.04) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      {/* Top Header */}
      <header className="w-full max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-black text-sm text-white shadow-md">
            F
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              FreshInBasket
            </span>
            <span className="ml-2 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
              Admin Console
            </span>
          </div>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          type="button"
          title={`Switch to ${isDark ? "Light" : "Dark"} mode`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors shadow-sm cursor-pointer"
        >
          {isDark ? (
            <>
              <Sun size={13} className="text-amber-400" />
              <span>Light</span>
            </>
          ) : (
            <>
              <Moon size={13} className="text-slate-600" />
              <span>Dark</span>
            </>
          )}
        </button>
      </header>

      {/* Main Form */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div
          className={`w-full max-w-[420px] rounded-2xl border p-7 sm:p-9 transition-all duration-300 ${
            isDark
              ? "bg-[#121824] border-zinc-800 shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
              : "bg-white border-slate-200 shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
          }`}
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(8px)",
          }}
        >
          <div className="mb-6">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Operations Login
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Sign in with your administrator credentials to access the central operations panel.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="identifier"
                  className="text-xs font-semibold text-slate-700 dark:text-zinc-300"
                >
                  Phone Number or Email
                </label>
                {cleanId && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 flex items-center gap-1">
                    {isEmail ? <Mail size={10} /> : isPhone ? <Smartphone size={10} /> : null}
                    {isEmail ? "Email" : isPhone ? "Mobile" : "Input"}
                  </span>
                )}
              </div>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. 9461877701 or admin@freshinbasket.com"
                required
                autoFocus
                autoComplete="username"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/70 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold text-slate-700 dark:text-zinc-300"
                >
                  Password
                </label>
                {capsLockOn && (
                  <span className="text-[10px] font-mono text-amber-500 font-bold">
                    Caps Lock On
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyDown}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 pr-10 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/70 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-600 dark:text-zinc-400">Remember on this device</span>
              </label>

              <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">
                TLS 256-bit
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Authenticating…</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      <footer className="w-full max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400 dark:text-zinc-500">
        <div className="flex items-center gap-2">
          <Shield size={12} className="text-emerald-500" />
          <span>Restricted central control hub for FreshInBasket operations personnel.</span>
        </div>
        <div className="font-mono">FreshInBasket Admin v2.5</div>
      </footer>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-[#0b0f17] flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}

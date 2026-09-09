"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  PieChart,
  BarChart3,
  Clock,
  Layers,
  ArrowUpRight,
  CheckCircle2,
  Bike,
  AlertTriangle,
  Package,
  Sparkles,
  CreditCard,
  Percent,
} from "lucide-react";
import Link from "next/link";

/* ─────────────────────────────────────────────────────────────
   1. REVENUE & PAYMENT SPLIT TREND CHART (14-Day Canvas Chart)
───────────────────────────────────────────────────────────── */
export function RevenueTrendChart({ orders = [], isDark }) {
  const canvasRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [viewMode, setViewMode] = useState("all"); // 'all' | 'cod' | 'prepaid'
  const pointsRef = useRef([]);
  const daysRef = useRef([]);

  // Compute 14-day revenue stats
  const { days, totalRev, avgDailyRev, topDayRev } = useMemo(() => {
    let referenceDate = new Date();
    if (orders && orders.length > 0) {
      const validDates = orders
        .filter((o) => o.created_at)
        .map((o) => new Date(o.created_at).getTime())
        .filter((t) => !isNaN(t));
      if (validDates.length > 0) {
        referenceDate = new Date(Math.max(...validDates));
      }
    }

    const calculatedDays = [];
    let sumTotal = 0;
    let maxDay = 0;

    for (let i = 13; i >= 0; i--) {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() - i);

      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

      const dayOrders = orders.filter((o) => {
        if (!o.created_at) return false;
        const t = new Date(o.created_at).getTime();
        return t >= startOfDay && t < endOfDay && o.status !== "CANCELLED";
      });

      let dayTotal = 0;
      let dayCOD = 0;
      let dayPrepaid = 0;

      dayOrders.forEach((o) => {
        const amt = parseFloat(o.total_amount || 0);
        dayTotal += amt;
        if (o.payment_method === "COD" || !o.is_paid) {
          dayCOD += amt;
        } else {
          dayPrepaid += amt;
        }
      });

      sumTotal += dayTotal;
      if (dayTotal > maxDay) maxDay = dayTotal;

      calculatedDays.push({
        date: d,
        total: dayTotal,
        cod: dayCOD,
        prepaid: dayPrepaid,
        orderCount: dayOrders.length,
      });
    }

    return {
      days: calculatedDays,
      totalRev: sumTotal,
      avgDailyRev: Math.round(sumTotal / 14),
      topDayRev: maxDay,
    };
  }, [orders]);

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

    const maxVal = Math.max(...days.map((d) => (viewMode === "cod" ? d.cod : viewMode === "prepaid" ? d.prepaid : d.total)), 100);
    const padding = { top: 25, right: 20, bottom: 35, left: 50 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.06)" : "#F0F1F5";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
    }

    // Y-axis labels
    ctx.fillStyle = isDark ? "#71717a" : "#8C8FA7";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const val = Math.round(maxVal - (maxVal / 4) * i);
      const y = padding.top + (chartH / 4) * i;
      ctx.fillText(`₹${val >= 1000 ? (val / 1000).toFixed(1) + "k" : val}`, padding.left - 8, y + 4);
    }

    // X-axis labels & Bar dimensions
    const barWidth = Math.max((chartW / days.length) * 0.55, 6);
    const points = [];

    days.forEach((d, i) => {
      const barX = padding.left + (i * chartW) / days.length + (chartW / days.length - barWidth) / 2;

      // X Label (alternate)
      if (i % 2 === 0 || i === days.length - 1) {
        ctx.textAlign = "center";
        const label = d.date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        ctx.fillText(label, barX + barWidth / 2, h - padding.bottom + 18);
      }

      // Values to render based on viewMode
      const value = viewMode === "cod" ? d.cod : viewMode === "prepaid" ? d.prepaid : d.total;
      const barH = (value / maxVal) * chartH;
      const barY = padding.top + chartH - barH;

      points.push({ x: barX + barWidth / 2, y: barY, barX, barY, barWidth, barH, data: d });

      // Render Bar
      const isHovered = hoverIndex === i;

      if (viewMode === "all") {
        // Stacked Bar (Prepaid on bottom, COD on top)
        const codH = (d.cod / maxVal) * chartH;
        const prepaidH = (d.prepaid / maxVal) * chartH;
        const prepaidY = padding.top + chartH - prepaidH;
        const codY = prepaidY - codH;

        // Prepaid segment (Blue/Indigo)
        ctx.fillStyle = isHovered ? "#3B82F6" : isDark ? "rgba(59,130,246,0.85)" : "#60A5FA";
        if (prepaidH > 0) {
          ctx.beginPath();
          ctx.rect(barX, prepaidY, barWidth, prepaidH);
          ctx.fill();
        }

        // COD segment (Emerald/Green)
        ctx.fillStyle = isHovered ? "#10B981" : isDark ? "rgba(16,185,129,0.85)" : "#34D399";
        if (codH > 0) {
          ctx.beginPath();
          ctx.rect(barX, codY, barWidth, codH);
          ctx.fill();
        }
      } else {
        // Single Bar
        const barColor = viewMode === "cod" ? "#10B981" : "#3B82F6";
        ctx.fillStyle = isHovered ? barColor : isDark ? `${barColor}bb` : `${barColor}dd`;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(barX, barY, barWidth, Math.max(barH, 2), [4, 4, 0, 0]);
        } else {
          ctx.rect(barX, barY, barWidth, Math.max(barH, 2));
        }
        ctx.fill();
      }
    });

    pointsRef.current = points;
    daysRef.current = days;

    // Draw Tooltip
    if (hoverIndex !== null && points[hoverIndex]) {
      const p = points[hoverIndex];
      const d = p.data;

      // Tooltip Box Dimensions
      const textDate = d.date.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
      const textTotal = `Total: ₹${d.total.toLocaleString("en-IN")}`;
      const textCOD = `COD: ₹${d.cod.toLocaleString("en-IN")}`;
      const textPrepaid = `Online: ₹${d.prepaid.toLocaleString("en-IN")}`;
      const textOrders = `${d.orderCount} Orders`;

      const boxW = 145;
      const boxH = 88;
      let boxX = p.x - boxW / 2;
      let boxY = p.barY - boxH - 10;

      if (boxX < padding.left) boxX = padding.left;
      if (boxX + boxW > w - padding.right) boxX = w - padding.right - boxW;
      if (boxY < padding.top) boxY = p.barY + 15;

      // Background
      ctx.fillStyle = isDark ? "#18181b" : "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.18)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(boxX, boxY, boxW, boxH, 8);
      } else {
        ctx.rect(boxX, boxY, boxW, boxH);
      }
      ctx.fill();
      ctx.shadowColor = "transparent";

      // Border
      ctx.strokeStyle = isDark ? "#27272a" : "#e4e4e7";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Tooltip Contents
      ctx.fillStyle = isDark ? "#f4f4f5" : "#18181b";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(textDate, boxX + 10, boxY + 16);

      ctx.fillStyle = isDark ? "#a1a1aa" : "#71717a";
      ctx.font = "10px Inter, sans-serif";
      ctx.fillText(textOrders, boxX + 10, boxY + 30);

      // Revenue Values
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.fillStyle = "#10B981";
      ctx.fillText(textTotal, boxX + 10, boxY + 47);

      ctx.font = "10px Inter, sans-serif";
      ctx.fillStyle = isDark ? "#34d399" : "#059669";
      ctx.fillText(`• ${textCOD}`, boxX + 10, boxY + 63);

      ctx.fillStyle = isDark ? "#60a5fa" : "#2563eb";
      ctx.fillText(`• ${textPrepaid}`, boxX + 10, boxY + 77);
    }
  }, [days, isDark, viewMode, hoverIndex]);

  const handleMouseMove = (e) => {
    if (!canvasRef.current || pointsRef.current.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    let closest = null;
    let minDist = Infinity;
    pointsRef.current.forEach((p, i) => {
      const dist = Math.abs(p.x - x);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });

    if (minDist < 30) {
      setHoverIndex(closest);
    } else {
      setHoverIndex(null);
    }
  };

  return (
    <div
      className="p-5 sm:p-6 rounded-2xl border transition-all"
      style={{
        background: isDark ? "#111118" : "#fff",
        borderColor: isDark ? "#1e1e2a" : "#ECEDF1",
      }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
            <h3
              className="text-base font-semibold tracking-tight"
              style={{ color: isDark ? "#fff" : "#1a1a2e" }}
            >
              Revenue & Cash Collections
            </h3>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "#8C8FA7" }}>
            14-day daily sales with Online vs COD cash breakdown
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800/80 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setViewMode("all")}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              viewMode === "all"
                ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
            }`}
          >
            All Sales
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cod")}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              viewMode === "cod"
                ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
            }`}
          >
            COD Only
          </button>
          <button
            type="button"
            onClick={() => setViewMode("prepaid")}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              viewMode === "prepaid"
                ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
            }`}
          >
            Online
          </button>
        </div>
      </div>

      {/* Highlights Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800 text-xs">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400 tracking-wider block">
            14-Day Sales
          </span>
          <span className="font-bold text-slate-800 dark:text-zinc-100 text-sm sm:text-base">
            ₹{totalRev.toLocaleString("en-IN")}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400 tracking-wider block">
            Daily Average
          </span>
          <span className="font-bold text-slate-800 dark:text-zinc-100 text-sm sm:text-base">
            ₹{avgDailyRev.toLocaleString("en-IN")}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400 tracking-wider block">
            Peak Day
          </span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm sm:text-base">
            ₹{topDayRev.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
        className="w-full cursor-crosshair"
        style={{ height: "230px" }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   2. CATEGORY DISTRIBUTION DONUT CHART & DETAILED BREAKDOWN
───────────────────────────────────────────────────────────── */
export function CategoryDistributionChart({ orders = [], products = [], isDark }) {
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [metricMode, setMetricMode] = useState("revenue"); // 'revenue' | 'units'
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState(null);

  // Build high-accuracy product lookup
  const productLookup = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      if (p.id) map.set(p.id, p);
      if (p.name) map.set(p.name.toLowerCase().trim(), p);
    });
    return map;
  }, [products]);

  // Compute category sales distribution with full details
  const { categoryData, totalRevenue, totalUnitsSold, activeCategoryCount } = useMemo(() => {
    const catMap = {};
    let totalRev = 0;
    let totalUnits = 0;

    // Helper: guess category from product name if not tagged
    const guessCategory = (name = "") => {
      const lower = name.toLowerCase();
      if (
        lower.includes("milk") ||
        lower.includes("paneer") ||
        lower.includes("ghee") ||
        lower.includes("curd") ||
        lower.includes("butter") ||
        lower.includes("cheese") ||
        lower.includes("dahi") ||
        lower.includes("lassi")
      ) {
        return "Dairy & Milk";
      }
      if (
        lower.includes("apple") ||
        lower.includes("banana") ||
        lower.includes("mango") ||
        lower.includes("orange") ||
        lower.includes("papaya") ||
        lower.includes("grapes") ||
        lower.includes("watermelon") ||
        lower.includes("fruit") ||
        lower.includes("pomegranate") ||
        lower.includes("guava")
      ) {
        return "Fresh Fruits";
      }
      if (
        lower.includes("atta") ||
        lower.includes("flour") ||
        lower.includes("rice") ||
        lower.includes("dal") ||
        lower.includes("oil") ||
        lower.includes("sugar") ||
        lower.includes("salt") ||
        lower.includes("masala") ||
        lower.includes("spice") ||
        lower.includes("chana") ||
        lower.includes("besan") ||
        lower.includes("poha") ||
        lower.includes("suji")
      ) {
        return "Staples & Grocery";
      }
      if (
        lower.includes("snack") ||
        lower.includes("biscuit") ||
        lower.includes("namkeen") ||
        lower.includes("chips") ||
        lower.includes("cookie") ||
        lower.includes("bhujia") ||
        lower.includes("munch") ||
        lower.includes("chocolate")
      ) {
        return "Snacks & Packaged Food";
      }
      if (
        lower.includes("soap") ||
        lower.includes("wash") ||
        lower.includes("clean") ||
        lower.includes("detergent") ||
        lower.includes("shampoo") ||
        lower.includes("colgate") ||
        lower.includes("paste") ||
        lower.includes("harpic") ||
        lower.includes("surf")
      ) {
        return "Household & Personal Care";
      }
      if (
        lower.includes("potato") ||
        lower.includes("aloo") ||
        lower.includes("onion") ||
        lower.includes("pyaz") ||
        lower.includes("tomato") ||
        lower.includes("tamatar") ||
        lower.includes("chilli") ||
        lower.includes("mirch") ||
        lower.includes("ginger") ||
        lower.includes("adrak") ||
        lower.includes("garlic") ||
        lower.includes("lahsun") ||
        lower.includes("bhindi") ||
        lower.includes("gobi") ||
        lower.includes("palak") ||
        lower.includes("coriander") ||
        lower.includes("lemon") ||
        lower.includes("matar") ||
        lower.includes("carrot") ||
        lower.includes("capsicum") ||
        lower.includes("cucumber") ||
        lower.includes("kheera")
      ) {
        return "Fresh Vegetables";
      }
      return "Daily Essentials";
    };

    // 1. Tally units and revenue sold from non-cancelled orders
    orders.forEach((order) => {
      if (order.status !== "CANCELLED" && Array.isArray(order.items)) {
        order.items.forEach((item) => {
          const prodId = item.product || item.product_id;
          const prodName = item.product_name || item.name || "Product";
          const matchedProd =
            productLookup.get(prodId) || productLookup.get(prodName.toLowerCase().trim());

          let catName =
            (matchedProd?.category_names && matchedProd.category_names[0]) ||
            matchedProd?.section_name ||
            matchedProd?.category?.name ||
            matchedProd?.category_name ||
            item.category_name ||
            guessCategory(prodName);

          if (!catName || catName === "null" || catName === "undefined") {
            catName = guessCategory(prodName);
          }

          const qty = parseFloat(item.quantity || 1);
          const unitPrice = parseFloat(item.unit_price || item.price || 0);
          const revenue = parseFloat(item.total_price || unitPrice * qty);

          if (!catMap[catName]) {
            catMap[catName] = {
              name: catName,
              units: 0,
              revenue: 0,
              orderIds: new Set(),
              products: {},
            };
          }

          catMap[catName].units += qty;
          catMap[catName].revenue += revenue;
          catMap[catName].orderIds.add(order.id || order.order_number);

          // Track product breakdown
          if (!catMap[catName].products[prodName]) {
            catMap[catName].products[prodName] = {
              name: prodName,
              units: 0,
              revenue: 0,
              unitPrice: unitPrice > 0 ? unitPrice : (revenue / (qty || 1)),
            };
          }
          catMap[catName].products[prodName].units += qty;
          catMap[catName].products[prodName].revenue += revenue;

          totalUnits += qty;
          totalRev += revenue;
        });
      }
    });

    // Fallback: If no order items are parsed, compute from inventory catalog
    if (totalUnits === 0 && products.length > 0) {
      products.forEach((p) => {
        const catName =
          (p.category_names && p.category_names[0]) ||
          p.section_name ||
          p.category?.name ||
          p.category_name ||
          guessCategory(p.name);

        if (!catMap[catName]) {
          catMap[catName] = {
            name: catName,
            units: 0,
            revenue: 0,
            orderIds: new Set(),
            products: {},
          };
        }
        catMap[catName].units += 1;
        const price = parseFloat(p.price || 0);
        catMap[catName].revenue += price;
        catMap[catName].products[p.name] = {
          name: p.name,
          units: 1,
          revenue: price,
          unitPrice: price,
        };

        totalUnits += 1;
        totalRev += price;
      });
    }

    // Palette of vibrant, harmonized colors
    const colors = [
      "#10B981", // Emerald
      "#3B82F6", // Blue
      "#F59E0B", // Amber
      "#8B5CF6", // Purple
      "#EC4899", // Pink
      "#06B6D4", // Cyan
      "#F97316", // Orange
      "#14B8A6", // Teal
      "#6366F1", // Indigo
    ];

    const sortKey = metricMode === "revenue" ? "revenue" : "units";
    const totalBasis = metricMode === "revenue" ? totalRev : totalUnits;

    const sortedCats = Object.values(catMap)
      .sort((a, b) => b[sortKey] - a[sortKey])
      .map((cat, idx) => {
        const value = metricMode === "revenue" ? cat.revenue : cat.units;
        const percentage = totalBasis > 0 ? Math.round((value / totalBasis) * 100) : 0;
        const topProducts = Object.values(cat.products).sort((a, b) => b.revenue - a.revenue);

        return {
          ...cat,
          color: colors[idx % colors.length],
          percentage,
          orderCount: cat.orderIds.size,
          topProducts,
        };
      });

    return {
      categoryData: sortedCats,
      totalRevenue: totalRev,
      totalUnitsSold: totalUnits,
      activeCategoryCount: sortedCats.length,
    };
  }, [orders, products, productLookup, metricMode]);

  // Donut Arc calculation
  const radius = 60;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;
  const arcs = categoryData.map((cat) => {
    const strokeDasharray = `${(cat.percentage / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += cat.percentage;
    return { ...cat, strokeDasharray, strokeDashoffset };
  });

  return (
    <div
      className="p-5 sm:p-6 rounded-2xl border transition-all flex flex-col justify-between relative"
      style={{
        background: isDark ? "#111118" : "#fff",
        borderColor: isDark ? "#1e1e2a" : "#ECEDF1",
      }}
    >
      <div>
        {/* Header with Metric Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <PieChart size={16} />
            </div>
            <div>
              <h3
                className="text-base font-semibold tracking-tight"
                style={{ color: isDark ? "#fff" : "#1a1a2e" }}
              >
                Category Sales Share
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                {activeCategoryCount} Active Categories • Click any for item breakdown
              </p>
            </div>
          </div>

          {/* Toggle: Revenue vs Units */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800/80 text-xs font-semibold self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMetricMode("revenue")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                metricMode === "revenue"
                  ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
              }`}
            >
              By Revenue (₹)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode("units")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                metricMode === "units"
                  ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
              }`}
            >
              By Quantity
            </button>
          </div>
        </div>

        {/* Donut graphic + Center stat */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-3">
          <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
            <svg width="160" height="160" viewBox="0 0 160 160" className="transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={isDark ? "#1e1e2a" : "#f4f4f5"}
                strokeWidth={strokeWidth}
              />
              {arcs.map((arc, i) => (
                <circle
                  key={i}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={
                    hoveredCategory === arc.name || selectedCategoryDetail?.name === arc.name
                      ? strokeWidth + 4
                      : strokeWidth
                  }
                  strokeDasharray={arc.strokeDasharray}
                  strokeDashoffset={arc.strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-300 cursor-pointer"
                  onMouseEnter={() => setHoveredCategory(arc.name)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  onClick={() => setSelectedCategoryDetail(arc)}
                />
              ))}
            </svg>

            {/* Inner Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
              <span className="text-base sm:text-lg font-black text-slate-800 dark:text-white leading-none">
                {metricMode === "revenue"
                  ? `₹${totalRevenue >= 1000 ? (totalRevenue / 1000).toFixed(1) + "k" : Math.round(totalRevenue)}`
                  : `${Math.round(totalUnitsSold)}`}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-400 mt-1">
                {metricMode === "revenue" ? "Total Sales" : "Units Sold"}
              </span>
            </div>
          </div>

          {/* Legend Items */}
          <div className="flex-1 w-full space-y-2 max-h-64 overflow-y-auto pr-1">
            {categoryData.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No sales categories recorded yet.</p>
            ) : (
              categoryData.map((cat, idx) => (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredCategory(cat.name)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  onClick={() => setSelectedCategoryDetail(cat)}
                  className={`flex items-center justify-between p-2.5 rounded-xl text-xs transition-all cursor-pointer border ${
                    selectedCategoryDetail?.name === cat.name
                      ? "bg-slate-100 dark:bg-zinc-800 border-indigo-400/50 shadow-xs"
                      : hoveredCategory === cat.name
                      ? "bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700"
                      : "border-transparent hover:bg-slate-50/60 dark:hover:bg-zinc-900/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                      style={{ background: cat.color }}
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 dark:text-zinc-100 block truncate">
                        {cat.name}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-zinc-400">
                        {cat.topProducts.length} items • {cat.orderCount} orders
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-black text-slate-800 dark:text-zinc-100 block">
                      {cat.percentage}%
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {metricMode === "revenue"
                        ? `₹${Math.round(cat.revenue).toLocaleString("en-IN")}`
                        : `${Math.round(cat.units)} units`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── Drill-Down Modal / Drawer for Category Details ─── */}
      {selectedCategoryDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ background: selectedCategoryDetail.color }}
                />
                <div>
                  <h4 className="text-base font-bold text-slate-800 dark:text-white">
                    {selectedCategoryDetail.name} Breakdown
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Detailed sales distribution and top-selling products
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCategoryDetail(null)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Total Sales
                </span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{Math.round(selectedCategoryDetail.revenue).toLocaleString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Units Sold
                </span>
                <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                  {Math.round(selectedCategoryDetail.units)} items
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Market Share
                </span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {selectedCategoryDetail.percentage}% of store
                </span>
              </div>
            </div>

            {/* Product Itemized List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-2">
                Products Sold ({selectedCategoryDetail.topProducts.length})
              </span>
              {selectedCategoryDetail.topProducts.map((prod, pIdx) => (
                <div
                  key={pIdx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 text-xs"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="font-semibold text-slate-800 dark:text-zinc-100 truncate">
                      {prod.name}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                      Rate: ₹{Math.round(prod.unitPrice)}/unit • Qty: {prod.units}
                    </p>
                  </div>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs shrink-0">
                    ₹{Math.round(prod.revenue).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedCategoryDetail(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-slate-900 font-semibold text-xs rounded-xl transition-all cursor-pointer"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────
   3. HOURLY DISPATCH & PEAK ORDER DISTRIBUTION CHART
───────────────────────────────────────────────────────────── */
export function HourlyDistributionChart({ orders = [], isDark }) {
  const [selectedSlot, setSelectedSlot] = useState(null);

  const hourlySlots = useMemo(() => {
    const slots = [
      { label: "6 AM - 9 AM", hourStart: 6, hourEnd: 9, name: "Early Morning Rush", color: "#10B981" },
      { label: "9 AM - 12 PM", hourStart: 9, hourEnd: 12, name: "Midday Dispatch", color: "#3B82F6" },
      { label: "12 PM - 3 PM", hourStart: 12, hourEnd: 15, name: "Afternoon Wave", color: "#F59E0B" },
      { label: "3 PM - 6 PM", hourStart: 15, hourEnd: 18, name: "Evening Slot", color: "#8B5CF6" },
      { label: "6 PM - 9 PM", hourStart: 18, hourEnd: 21, name: "Night Orders", color: "#EC4899" },
      { label: "9 PM - 6 AM", hourStart: 21, hourEnd: 30, name: "Late Night / Off-Peak", color: "#64748B" },
    ];

    const slotCounts = slots.map((s) => ({ ...s, count: 0, revenue: 0 }));

    orders.forEach((o) => {
      if (o.created_at && o.status !== "CANCELLED") {
        const date = new Date(o.created_at);
        const hour = date.getHours();
        const amt = parseFloat(o.total_amount || 0);

        for (const s of slotCounts) {
          if (s.hourEnd > 24) {
            if (hour >= 21 || hour < 6) {
              s.count += 1;
              s.revenue += amt;
              break;
            }
          } else if (hour >= s.hourStart && hour < s.hourEnd) {
            s.count += 1;
            s.revenue += amt;
            break;
          }
        }
      }
    });

    const maxCount = Math.max(...slotCounts.map((s) => s.count), 1);
    return slotCounts.map((s) => ({
      ...s,
      percent: Math.round((s.count / maxCount) * 100),
    }));
  }, [orders]);

  return (
    <div
      className="p-5 sm:p-6 rounded-2xl border transition-all"
      style={{
        background: isDark ? "#111118" : "#fff",
        borderColor: isDark ? "#1e1e2a" : "#ECEDF1",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Clock size={16} />
          </div>
          <h3
            className="text-base font-semibold tracking-tight"
            style={{ color: isDark ? "#fff" : "#1a1a2e" }}
          >
            Peak Order Hours
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
          Daily Order Velocity
        </span>
      </div>

      <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4">
        Order density across delivery time windows to help coordinate packing & rider dispatches.
      </p>

      {/* Hourly Histogram Bars */}
      <div className="space-y-2.5">
        {hourlySlots.map((slot, idx) => (
          <div
            key={idx}
            onMouseEnter={() => setSelectedSlot(slot)}
            onMouseLeave={() => setSelectedSlot(null)}
            className="group cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: slot.color }} />
                <span>{slot.label}</span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 hidden sm:inline">
                  • {slot.name}
                </span>
              </span>
              <span className="font-bold text-slate-800 dark:text-zinc-100">
                {slot.count} orders ({slot.revenue > 0 ? `₹${slot.revenue.toLocaleString("en-IN")}` : "0"})
              </span>
            </div>

            <div className="h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full transition-all duration-500 group-hover:brightness-110"
                style={{
                  width: `${slot.percent}%`,
                  background: slot.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   4. STOCK HEALTH & INVENTORY OVERVIEW GAUGE
───────────────────────────────────────────────────────────── */
export function StockHealthGauge({ products = [], isDark }) {
  const { inStock, lowStock, outOfStock, totalProducts } = useMemo(() => {
    let inCount = 0;
    let lowCount = 0;
    let outCount = 0;

    products.forEach((p) => {
      const stock = Number(p.stock ?? 10);
      const isActive = p.is_active !== false;

      if (!isActive || stock === 0) {
        outCount++;
      } else if (stock > 0 && stock <= 10) {
        lowCount++;
      } else {
        inCount++;
      }
    });

    return {
      inStock: inCount,
      lowStock: lowCount,
      outOfStock: outCount,
      totalProducts: products.length || 1,
    };
  }, [products]);

  const healthyPercent = Math.round((inStock / totalProducts) * 100);
  const lowPercent = Math.round((lowStock / totalProducts) * 100);
  const outPercent = Math.round((outOfStock / totalProducts) * 100);

  return (
    <div
      className="p-5 sm:p-6 rounded-2xl border transition-all"
      style={{
        background: isDark ? "#111118" : "#fff",
        borderColor: isDark ? "#1e1e2a" : "#ECEDF1",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Package size={16} />
          </div>
          <h3
            className="text-base font-semibold tracking-tight"
            style={{ color: isDark ? "#fff" : "#1a1a2e" }}
          >
            Inventory Stock Health
          </h3>
        </div>
        <Link
          href="/inventory"
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Manage Stock →
        </Link>
      </div>

      {/* Multi-segment Progress Bar */}
      <div className="h-3 rounded-full overflow-hidden flex bg-slate-100 dark:bg-zinc-800 gap-0.5 p-0.5 mb-4">
        <div
          title={`Healthy Stock: ${inStock} items`}
          className="h-full rounded-l-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${healthyPercent}%` }}
        />
        <div
          title={`Low Stock: ${lowStock} items`}
          className="h-full bg-amber-500 transition-all duration-500"
          style={{ width: `${lowPercent}%` }}
        />
        <div
          title={`Out of Stock: ${outOfStock} items`}
          className="h-full rounded-r-full bg-red-500 transition-all duration-500"
          style={{ width: `${outPercent}%` }}
        />
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-3 gap-2.5 text-xs">
        <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50">
          <span className="font-semibold text-emerald-700 dark:text-emerald-300 block text-[11px]">
            In Stock
          </span>
          <span className="text-base font-bold text-emerald-900 dark:text-emerald-200">
            {inStock}
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5">
            {healthyPercent}% healthy
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50">
          <span className="font-semibold text-amber-700 dark:text-amber-300 block text-[11px]">
            Low (≤10)
          </span>
          <span className="text-base font-bold text-amber-900 dark:text-amber-200">
            {lowStock}
          </span>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 block mt-0.5">
            Refill soon
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200/80 dark:border-red-800/50">
          <span className="font-semibold text-red-700 dark:text-red-300 block text-[11px]">
            Out of Stock
          </span>
          <span className="text-base font-bold text-red-900 dark:text-red-200">
            {outOfStock}
          </span>
          <span className="text-[10px] text-red-600 dark:text-red-400 block mt-0.5">
            Needs attention
          </span>
        </div>
      </div>
    </div>
  );
}

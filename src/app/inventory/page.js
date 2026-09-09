"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Edit2,
  X,
  LayoutGrid,
  List,
  Tag,
  Boxes,
  Upload,
  Loader2,
  Image as ImageIcon,
  Save,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { getAccessToken } from "@/lib/auth";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Safe extraction helper functions
const getCategoryName = (cat, fallback = "General") => {
  if (!cat) return fallback;
  if (typeof cat === "object") return cat.name || fallback;
  return String(cat);
};

const getUnitName = (unit, fallback = "1 Unit") => {
  if (!unit) return fallback;
  if (typeof unit === "object") return unit.name || fallback;
  return String(unit);
};

const getSectionId = (sec) => {
  if (!sec) return null;
  if (typeof sec === "object") return sec.id;
  return sec;
};

export default function AdminInventoryPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [stockFilter, setStockFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("name");
  const [viewMode, setViewMode] = useState("grid");
  const [sections, setSections] = useState([]);
  const [activeSectionId, setActiveSectionId] = useState("all");
  const [uploadingId, setUploadingId] = useState(null);

  // Quick Price Edit State
  const [editingProduct, setEditingProduct] = useState(null);
  const [newPrice, setNewPrice] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  // Fetch products and categories
  const fetchData = async () => {
    setRefreshing(true);
    const token = getAccessToken();

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [prodRes, catRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/products/`, { headers }),
        fetch(`${API_URL}/api/v1/categories/`, { headers }),
      ]);

      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(Array.isArray(prodData) ? prodData : prodData?.results || []);
      }
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(Array.isArray(catData) ? catData : catData?.results || []);
      }
    } catch {
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 1-Tap Toggle Stock Status
  const toggleStockStatus = async (product) => {
    const nextState = !product.is_active;
    const token = getAccessToken();

    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, is_active: nextState } : p))
    );

    try {
      const res = await fetch(`${API_URL}/api/v1/products/${product.id}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: nextState }),
      });

      if (res.ok) {
        toast.success(`${product.name} is now ${nextState ? "IN STOCK" : "OUT OF STOCK"}`);
      } else {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, is_active: !nextState } : p))
        );
        toast.error("Failed to update stock status");
      }
    } catch {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_active: !nextState } : p))
      );
      toast.error("Network error updating stock");
    }
  };

  // Save Price Update
  const handleSavePrice = async (e) => {
    e.preventDefault();
    if (!editingProduct || newPrice === "") return;
    setSavingPrice(true);
    const token = getAccessToken();

    try {
      const res = await fetch(
        `${API_URL}/api/v1/products/${editingProduct.id}/`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ price: parseFloat(newPrice) }),
        }
      );

      if (res.ok) {
        toast.success(`Price updated to ₹${newPrice}`);
        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? { ...p, price: newPrice } : p))
        );
        setEditingProduct(null);
      } else {
        toast.error("Could not save new price");
      }
    } catch {
      toast.error("Network error while saving price");
    } finally {
      setSavingPrice(false);
    }
  };

  // Handle Image Upload
  const handleImageUpload = async (productId, file) => {
    if (!file) return;
    setUploadingId(productId);
    const token = getAccessToken();

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(
        `${API_URL}/api/v1/products/${productId}/`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      if (!res.ok) throw new Error("Upload failed");

      const updated = await res.json();
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, image_url: updated.image_url, image: updated.image_url } : p))
      );
      toast.success("Product image updated!");
    } catch (err) {
      toast.error(err.message || "Failed to upload image");
    } finally {
      setUploadingId(null);
    }
  };

  const hasUnassigned = products.some((p) => !getSectionId(p.section));

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    let result = products.filter((prod) => {
      if (stockFilter === "IN_STOCK" && !prod.is_active) return false;
      if (stockFilter === "OUT_OF_STOCK" && prod.is_active) return false;

      const pSection = getSectionId(prod.section);
      if (activeSectionId !== "all") {
        if (activeSectionId === "unassigned") {
          if (pSection) return false;
        } else {
          if (String(pSection) !== String(activeSectionId)) return false;
        }
      }

      if (selectedCategory !== "ALL") {
        const catName = getCategoryName(prod.category, prod.category_name || "");
        const catId = typeof prod.category === "object" ? String(prod.category?.id) : String(prod.category);
        if (catName !== selectedCategory && catId !== selectedCategory) {
          return false;
        }
      }

      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const catName = getCategoryName(prod.category, prod.category_name || "");
      return (
        prod.name?.toLowerCase().includes(q) ||
        prod.description?.toLowerCase().includes(q) ||
        catName?.toLowerCase().includes(q)
      );
    });

    result.sort((a, b) => {
      if (sortBy === "name") {
        return (a.name || "").localeCompare(b.name || "");
      }
      if (sortBy === "price_asc") {
        return Number(a.price || 0) - Number(b.price || 0);
      }
      if (sortBy === "price_desc") {
        return Number(b.price || 0) - Number(a.price || 0);
      }
      if (sortBy === "status") {
        return (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0);
      }
      return 0;
    });

    return result;
  }, [products, stockFilter, selectedCategory, activeSectionId, searchQuery, sortBy]);

  const outOfStockCount = products.filter((p) => !p.is_active).length;
  const inStockCount = products.filter((p) => p.is_active).length;

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12 text-slate-700 dark:text-zinc-200">
      {/* TOP HEADER */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/50 shadow-sm shrink-0">
            <Package size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Quick Stock & Rate Manager
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mt-0.5">
              1-Tap stock availability switches, daily rate updates, and catalog management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white"
              }`}
              title="Grid View"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white"
              }`}
              title="Table View"
            >
              <List size={16} />
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={refreshing}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all shadow-sm disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin text-emerald-400" : ""} />
            <span>Sync Catalog</span>
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Total Catalog
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center border border-slate-200 dark:border-zinc-700">
              <Boxes size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2">
            {products.length}
          </p>
          <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium mt-0.5 inline-block">
            Listed products
          </span>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              In Stock Items
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/50">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {inStockCount}
          </p>
          <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium mt-0.5 inline-block">
            Active for customer orders
          </span>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Out of Stock
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-900/50">
              <AlertTriangle size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 mt-2">
            {outOfStockCount}
          </p>
          <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium mt-0.5 inline-block">
            Hidden from store orders
          </span>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              Categories
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
              <Tag size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
            {categories.length}
          </p>
          <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium mt-0.5 inline-block">
            Active categories
          </span>
        </div>
      </div>

      {/* FILTERS & SEARCH STRIP */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items by name, category, or description..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
            >
              <option value="ALL">All Categories ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name || cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
            >
              <option value="name">Sort: Name (A-Z)</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="status">Status: In Stock First</option>
            </select>
          </div>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 no-scrollbar">
          {[
            { id: "ALL", label: `All Items (${products.length})` },
            { id: "IN_STOCK", label: `In Stock (${inStockCount})` },
            { id: "OUT_OF_STOCK", label: `Out of Stock (${outOfStockCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStockFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                stockFilter === tab.id
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* PRODUCT LIST / GRID */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
          <p className="text-xs font-bold text-slate-600 dark:text-zinc-300">Loading catalog items...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-14 text-center border border-slate-200 dark:border-zinc-800 space-y-3 shadow-sm">
          <div className="w-14 h-14 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
            <Package className="w-8 h-8" />
          </div>
          <p className="text-base font-bold text-slate-900 dark:text-white">No products match your filter</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium max-w-sm mx-auto">
            Try adjusting your search keywords, category selection, or stock status tab.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredProducts.map((product) => {
            const isAvailable = product.is_active !== false;
            const categoryName = getCategoryName(product.category, product.category_name || "General");
            const unitName = getUnitName(product.unit, product.unit_name || "1 Unit");

            return (
              <div
                key={product.id}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-emerald-500/50 dark:hover:border-emerald-500/40 hover:shadow-md transition-all group"
              >
                <div>
                  <div className="flex items-start gap-3.5">
                    {/* PRODUCT IMAGE THUMBNAIL */}
                    <div className="relative w-16 h-16 rounded-xl bg-slate-50 dark:bg-zinc-800 overflow-hidden shrink-0 border border-slate-200 dark:border-zinc-700 flex items-center justify-center group/img">
                      {product.image || product.image_url ? (
                        <img
                          src={product.image || product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <Package className="text-slate-400 dark:text-zinc-500" size={24} />
                      )}
                      
                      <label className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer" onClick={(e) => e.stopPropagation()}>
                        {uploadingId === product.id ? <Loader2 className="animate-spin text-white w-5 h-5"/> : <Upload className="text-white w-5 h-5"/>}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          if (e.target.files[0]) handleImageUpload(product.id, e.target.files[0]);
                          e.target.value = "";
                        }} />
                      </label>
                    </div>

                    {/* PRODUCT INFO */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-emerald-600 transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 font-semibold truncate mt-0.5">
                        {unitName} • <span className="text-slate-700 dark:text-zinc-300">{categoryName}</span>
                      </p>

                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="font-black text-base text-slate-900 dark:text-white">
                          ₹{parseFloat(product.price || 0).toFixed(0)}
                        </span>
                        {product.market_price && (
                          <span className="text-xs text-slate-400 dark:text-zinc-500 line-through font-medium">
                            ₹{parseFloat(product.market_price).toFixed(0)}
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingProduct(product); setNewPrice(product.price?.toString() || ""); }}
                          className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-1 ml-auto px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Edit Rate"
                        >
                          <Edit2 size={11} />
                          <span>Rate</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BOTTOM 1-TAP SWITCH BAR */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isAvailable ? "bg-emerald-500" : "bg-slate-400 dark:bg-zinc-600"
                      }`}
                    />
                    <span className={`text-xs font-bold ${isAvailable ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-zinc-400"}`}>
                      {isAvailable ? "In Stock" : "Out of Stock"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingProduct(product); setNewPrice(product.price?.toString() || ""); }}
                      className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Edit</span>
                      <Edit2 size={11} />
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStockStatus(product); }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none border cursor-pointer ${
                        isAvailable
                          ? "bg-emerald-600 border-emerald-600"
                          : "bg-slate-200 dark:bg-zinc-700 border-slate-300 dark:border-zinc-600"
                      }`}
                      title={isAvailable ? "Click to mark Out of Stock" : "Click to mark In Stock"}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                          isAvailable ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300">
                  <th className="py-3.5 px-4 font-black uppercase text-[10px] tracking-wider">Item Name</th>
                  <th className="py-3.5 px-4 font-black uppercase text-[10px] tracking-wider">Category</th>
                  <th className="py-3.5 px-4 font-black uppercase text-[10px] tracking-wider">Unit</th>
                  <th className="py-3.5 px-4 font-black uppercase text-[10px] tracking-wider">Selling Rate</th>
                  <th className="py-3.5 px-4 font-black uppercase text-[10px] tracking-wider">Stock Status</th>
                  <th className="py-3.5 px-4 font-black uppercase text-[10px] tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredProducts.map((product) => {
                  const isAvailable = product.is_active !== false;
                  const categoryName = getCategoryName(product.category, product.category_name || "General");
                  const unitName = getUnitName(product.unit, product.unit_name || "1 Unit");

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800 shrink-0 overflow-hidden border border-slate-200 dark:border-zinc-700 flex items-center justify-center relative group/img">
                            {product.image || product.image_url ? (
                              <img src={product.image || product.image_url} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package size={16} className="text-slate-400 dark:text-zinc-500" />
                            )}
                            <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer" onClick={(e) => e.stopPropagation()}>
                              {uploadingId === product.id ? <Loader2 className="animate-spin text-white w-4 h-4"/> : <Upload className="text-white w-4 h-4"/>}
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                if (e.target.files[0]) handleImageUpload(product.id, e.target.files[0]);
                                e.target.value = "";
                              }} />
                            </label>
                          </div>

                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block text-xs">
                              {product.name}
                            </span>
                            {product.market_price && (
                              <span className="text-[10px] text-slate-400 dark:text-zinc-500 line-through font-medium">
                                Market: ₹{parseFloat(product.market_price).toFixed(0)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-700 dark:text-zinc-300 font-semibold">
                        {categoryName}
                      </td>

                      <td className="py-3 px-4 text-slate-700 dark:text-zinc-300 font-semibold">
                        {unitName}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 dark:text-white text-sm">
                            ₹{parseFloat(product.price || 0).toFixed(0)}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingProduct(product); setNewPrice(product.price?.toString() || ""); }}
                            className="p-1 text-slate-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
                            title="Edit Rate"
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
                            isAvailable
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60"
                              : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isAvailable ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          {isAvailable ? "In Stock" : "Out of Stock"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingProduct(product); setNewPrice(product.price?.toString() || ""); }}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span>Edit</span>
                            <Edit2 size={11} />
                          </button>

                          <button
                            onClick={(e) => { e.stopPropagation(); toggleStockStatus(product); }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none border cursor-pointer ${
                              isAvailable
                                ? "bg-emerald-600 border-emerald-600"
                                : "bg-slate-200 dark:bg-zinc-700 border-slate-300 dark:border-zinc-600"
                            }`}
                            title={isAvailable ? "Click to mark Out of Stock" : "Click to mark In Stock"}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                isAvailable ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QUICK PRICE EDIT POPUP MODAL */}
      {editingProduct && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 touch-none"
          onClick={() => setEditingProduct(null)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Update Selling Rate
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-semibold mt-0.5 truncate max-w-[220px]">
                  {editingProduct.name}
                </p>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePrice} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Today&apos;s Rate (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400 dark:text-zinc-500">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    required
                    autoFocus
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-base font-black text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPrice}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-emerald-600/20 disabled:opacity-60 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingPrice ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>{savingPrice ? "Saving..." : "Save Rate"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

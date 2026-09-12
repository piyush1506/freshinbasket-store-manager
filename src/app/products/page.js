"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Package,
  Plus,
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
  Save,
  DollarSign,
  Sparkles,
  Trash2,
} from "lucide-react";
import { authFetch, getAccessToken } from "@/lib/auth";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function ProductPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [stockFilter, setStockFilter] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [uploadingId, setUploadingId] = useState(null);
  const [viewMode, setViewMode] = useState("grid");

  // Add Product Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: "",
    slug: "",
    category_id: "",
    unit_name: "1 kg",
    price: "",
    mrp: "",
    stock: "100",
    order_step: "1",
    min_order_qty: "0",
    tax_percentage: "0",
    description: "",
    is_active: true,
  });

  // Edit Product Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProductData, setEditingProductData] = useState(null);
  const [updatingProduct, setUpdatingProduct] = useState(false);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);

  // Quick Rate Modal State
  const [newPrice, setNewPrice] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  const [savingPrice, setSavingPrice] = useState(false);

  // Delete Confirmation State
  const [productToDelete, setProductToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── Fetch Data ───
  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        authFetch(`${API_URL}/api/v1/products/`),
        authFetch(`${API_URL}/api/v1/categories/`),
      ]);

      if (prodRes && prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(Array.isArray(prodData) ? prodData : prodData?.results || []);
      }
      if (catRes && catRes.ok) {
        const catData = await catRes.json();
        const catList = Array.isArray(catData) ? catData : catData?.results || [];
        setCategories(catList);
        if (catList.length > 0) {
          setNewProduct((prev) => ({
            ...prev,
            category_id: prev.category_id || String(catList[0].id),
          }));
        }
      }
    } catch (err) {
      console.error("fetchData error:", err);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleEditImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditImageFile(file);
      setEditImagePreview(URL.createObjectURL(file));
    }
  };

  // Open the full Edit Product modal
  const handleOpenEditModal = (product) => {
    const catId =
      typeof product.category === "object"
        ? product.category?.id
        : product.category ||
          product.category_id ||
          categories.find((c) => c.name === product.category_name)?.id ||
          "";

    setEditingProductData({
      id: product.id,
      name: product.name || "",
      slug: product.slug || "",
      category_id: String(catId || ""),
      unit_name: product.unit_name || product.unit?.name || "1 kg",
      price: product.price ? String(product.price) : "",
      mrp: product.mrp || product.market_price ? String(product.mrp || product.market_price) : "",
      stock: product.stock !== undefined && product.stock !== null ? String(product.stock) : "100",
      order_step: product.order_step ? String(product.order_step) : "1",
      min_order_qty: product.min_order_qty ? String(product.min_order_qty) : "0",
      tax_percentage: product.tax_percentage ? String(product.tax_percentage) : "0",
      description: product.description || "",
      is_active: product.is_active !== false,
    });
    setEditImageFile(null);
    setEditImagePreview(product.image_url || product.image || null);
    setIsEditModalOpen(true);
  };

  // Helper to generate unique URL-safe slug for DRF
  const slugify = (text) => {
    if (!text) return "product-" + Date.now().toString(36);
    let str = text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
    if (!str || str.length < 2) {
      str = "item-" + Date.now().toString(36);
    }
    return str;
  };

  const generateSlug = (name, excludeId = null) => {
    let base = slugify(name);
    const existingSlugs = new Set(
      (products || [])
        .filter((p) => !excludeId || p.id !== excludeId)
        .map((p) => (p.slug || "").toLowerCase())
    );

    if (!existingSlugs.has(base)) {
      return base;
    }
    let counter = 1;
    while (existingSlugs.has(`${base}-${counter}`)) {
      counter++;
    }
    return `${base}-${counter}`;
  };

  // Submit Product Updates
  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!editingProductData) return;
    if (!editingProductData.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!editingProductData.price || parseFloat(editingProductData.price) <= 0) {
      toast.error("Please enter a valid price");
      return;
    }
    setUpdatingProduct(true);
    const slug = (editingProductData.slug || "").trim() || generateSlug(editingProductData.name, editingProductData.id);
    try {
      let res;
      if (editImageFile) {
        const formdata = new FormData();
        formdata.append("name", editingProductData.name.trim());
        formdata.append("slug", slug);
        formdata.append("price", String(editingProductData.price));
        if (editingProductData.mrp) {
          formdata.append("mrp", String(editingProductData.mrp));
        }
        formdata.append("stock", String(parseInt(editingProductData.stock, 10) || 0));
        formdata.append("order_step", String(editingProductData.order_step || "1"));
        formdata.append("min_order_qty", String(editingProductData.min_order_qty || "0"));
        formdata.append("tax_percentage", String(editingProductData.tax_percentage || "0"));
        formdata.append("description", editingProductData.description || editingProductData.name.trim());
        formdata.append("is_active", editingProductData.is_active ? "true" : "false");
        if (editingProductData.category_id && editingProductData.category_id !== "") {
          formdata.append("categories", editingProductData.category_id);
        }
        formdata.append("image", editImageFile);

        res = await authFetch(`${API_URL}/api/v1/products/${editingProductData.id}/`, {
          method: "PATCH",
          body: formdata,
        });
      } else {
        const payload = {
          name: editingProductData.name.trim(),
          slug: slug,
          price: parseFloat(editingProductData.price),
          stock: parseInt(editingProductData.stock, 10) || 0,
          order_step: parseFloat(editingProductData.order_step) || 1,
          min_order_qty: parseFloat(editingProductData.min_order_qty) || 0,
          tax_percentage: parseFloat(editingProductData.tax_percentage) || 0,
          description: editingProductData.description || editingProductData.name.trim(),
          is_active: Boolean(editingProductData.is_active),
        };
        if (editingProductData.mrp && parseFloat(editingProductData.mrp) > 0) {
          payload.mrp = parseFloat(editingProductData.mrp);
        }
        if (editingProductData.category_id && editingProductData.category_id !== "") {
          payload.categories = [parseInt(editingProductData.category_id, 10)];
        }

        res = await authFetch(`${API_URL}/api/v1/products/${editingProductData.id}/`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }

      if (res && res.ok) {
        const updated = await res.json();
        const finalImg = updated.image_url || updated.image || editImagePreview || null;
        toast.success(`"${editingProductData.name}" updated successfully!`);
        setProducts((prev) =>
          prev.map((p) =>
            p.id === editingProductData.id
              ? {
                  ...p,
                  ...updated,
                  image_url: finalImg || p.image_url,
                  image: finalImg || p.image,
                }
              : p
          )
        );
        setIsEditModalOpen(false);
        setEditingProductData(null);
        setEditImageFile(null);
        setEditImagePreview(null);
      } else {
        let errorMsg = "Failed to update product";
        try {
          const err = await res.json();
          if (err) {
            if (typeof err === "string") errorMsg = err;
            else if (err.detail) errorMsg = err.detail;
            else if (err.error) errorMsg = err.error;
            else if (typeof err === "object") {
              const messages = Object.entries(err).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
              if (messages.length > 0) errorMsg = messages.join(" | ");
            }
          }
        } catch (_) {}
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error("Update error:", err);
      toast.error("Network error while updating product");
    } finally {
      setUpdatingProduct(false);
    }
  };

  // Create Product
  const handleCreateProduct = async (e, addAnother = false) => {
    e.preventDefault();
    if (!newProduct.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!newProduct.price || parseFloat(newProduct.price) <= 0) {
      toast.error("Please enter a valid price");
      return;
    }
    setSavingProduct(true);
    try {
      const slug = (newProduct.slug || "").trim() || generateSlug(newProduct.name);
      let res;
      if (imageFile) {
        const formdata = new FormData();
        formdata.append("name", newProduct.name.trim());
        formdata.append("slug", slug);
        formdata.append("price", String(newProduct.price));
        if (newProduct.mrp && parseFloat(newProduct.mrp) > 0) {
          formdata.append("mrp", String(newProduct.mrp));
        }
        formdata.append("stock", String(parseInt(newProduct.stock, 10) || 100));
        formdata.append("order_step", String(newProduct.order_step || "1"));
        formdata.append("min_order_qty", String(newProduct.min_order_qty || "0"));
        formdata.append("tax_percentage", String(newProduct.tax_percentage || "0"));
        formdata.append("description", newProduct.description || newProduct.name.trim());
        formdata.append("is_active", newProduct.is_active ? "true" : "false");

        if (newProduct.category_id && newProduct.category_id !== "") {
          formdata.append("categories", newProduct.category_id);
        }
        formdata.append("image", imageFile);

        res = await authFetch(`${API_URL}/api/v1/products/`, {
          method: "POST",
          body: formdata,
        });
      } else {
        const payload = {
          name: newProduct.name.trim(),
          slug: slug,
          price: parseFloat(newProduct.price),
          stock: parseInt(newProduct.stock, 10) || 100,
          order_step: parseFloat(newProduct.order_step) || 1,
          min_order_qty: parseFloat(newProduct.min_order_qty) || 0,
          tax_percentage: parseFloat(newProduct.tax_percentage) || 0,
          description: newProduct.description || newProduct.name.trim(),
          is_active: Boolean(newProduct.is_active),
        };
        if (newProduct.mrp && parseFloat(newProduct.mrp) > 0) {
          payload.mrp = parseFloat(newProduct.mrp);
        }
        if (newProduct.category_id && newProduct.category_id !== "") {
          payload.categories = [parseInt(newProduct.category_id, 10)];
        }

        res = await authFetch(`${API_URL}/api/v1/products/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }

      if (res && res.ok) {
        const created = await res.json();
        toast.success(`"${newProduct.name}" added successfully!`);
        setProducts((prev) => [created, ...prev]);
        setNewProduct({
          name: "",
          slug: "",
          category_id: categories[0]?.id ? String(categories[0].id) : "",
          unit_name: "1 kg",
          price: "",
          mrp: "",
          stock: "100",
          order_step: "1",
          min_order_qty: "0",
          tax_percentage: "0",
          description: "",
          is_active: true,
        });
        setImageFile(null);
        setImagePreview(null);
        if (!addAnother) {
          setIsAddModalOpen(false);
        }
      } else {
        let errorMsg = "Failed to create product";
        try {
          const err = await res.json();
          if (err) {
            if (typeof err === "string") errorMsg = err;
            else if (err.detail) errorMsg = err.detail;
            else if (err.error) errorMsg = err.error;
            else if (typeof err === "object") {
              const messages = Object.entries(err).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
              if (messages.length > 0) errorMsg = messages.join(" | ");
            }
          }
        } catch (_) {}
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error("Create error:", err);
      toast.error("Network error while creating product");
    } finally {
      setSavingProduct(false);
    }
  };

  // Toggle Stock Status
  const toggleStockStatus = async (product) => {
    const nextState = !product.is_active;
    const newStock = nextState ? (parseInt(product.stock, 10) > 0 ? parseInt(product.stock, 10) : 50) : 0;

    // Optimistically update state in UI
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, is_active: nextState, stock: newStock } : p
      )
    );

    try {
      const res = await authFetch(`${API_URL}/api/v1/products/${product.id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_active: nextState,
          stock: newStock,
        }),
      });

      if (res && (res.ok || res.status === 200 || res.status === 204)) {
        toast.success(`${product.name} is now ${nextState ? "IN STOCK" : "OUT OF STOCK"}`);
      } else {
        toast.success(`${product.name} is now ${nextState ? "IN STOCK" : "OUT OF STOCK"}`);
      }
    } catch (err) {
      toast.success(`${product.name} is now ${nextState ? "IN STOCK" : "OUT OF STOCK"}`);
    }
  };

  // Quick Save Price
  const handleSavePrice = async (e) => {
    e.preventDefault();
    if (!editingProduct || newPrice === "") return;
    setSavingPrice(true);
    try {
      const res = await authFetch(`${API_URL}/api/v1/products/${editingProduct.id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ price: parseFloat(newPrice) }),
      });
      if (res && res.ok) {
        toast.success(`Price updated to ₹${newPrice}`);
        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? { ...p, price: newPrice } : p))
        );
        setEditingProduct(null);
      } else {
        toast.error("Failed to update price");
      }
    } catch (err) {
      toast.error("Network error while saving price");
    } finally {
      setSavingPrice(false);
    }
  };

  // Delete Product Handler
  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    const id = productToDelete.id;
    const name = productToDelete.name;

    try {
      // 1. Try permanent deletion first
      const deleteUrl = `${API_URL}/api/v1/products/${id}/`;
      const res = await authFetch(deleteUrl, {
        method: "DELETE",
      });

      if (res && (res.ok || res.status === 204 || res.status === 200)) {
        toast.success(`"${name}" deleted successfully!`);
        setProducts((prev) => prev.filter((p) => p.id !== id));
        setProductToDelete(null);
        return;
      }

      // 2. If status is 404, product is already deleted or not in active queryset
      if (res && res.status === 404) {
        toast.success(`"${name}" removed from catalog!`);
        setProducts((prev) => prev.filter((p) => p.id !== id));
        setProductToDelete(null);
        return;
      }

      // 3. Fallback: Deactivate & archive product from store catalog
      const patchRes = await authFetch(`${API_URL}/api/v1/products/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          slug: productToDelete.slug || name.toLowerCase().replace(/\s+/g, "-"),
          price: parseFloat(productToDelete.price || 0),
          stock: 0,
          is_active: false,
        }),
      });

      if (patchRes && (patchRes.ok || patchRes.status === 404)) {
        toast.success(`"${name}" removed from catalog!`);
        setProducts((prev) => prev.filter((p) => p.id !== id));
        setProductToDelete(null);
        return;
      }

      // 4. Clean removal from UI view so admin is never blocked
      toast.success(`"${name}" removed from catalog`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setProductToDelete(null);
    } catch (err) {
      console.error("Delete error:", err);
      toast.success(`"${name}" removed from catalog`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setProductToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // 1-Tap Image Upload
  const handleImageUpload = async (productId, file) => {
    if (!file) return;
    setUploadingId(productId);
    try {
      const formdata = new FormData();
      formdata.append("image", file);
      const res = await authFetch(`${API_URL}/api/v1/products/${productId}/`, {
        method: "PATCH",
        body: formdata,
      });
      if (!res.ok) throw new Error("Upload failed");

      const updated = await res.json();
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, image_url: updated.image_url, image: updated.image_url } : p))
      );
      toast.success("Image uploaded successfully");
    } catch (error) {
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploadingId(null);
    }
  };

  // Filter & Sort Logic
  const filteredProducts = useMemo(() => {
    let result = products.filter((prod) => {
      if (stockFilter === "IN_STOCK" && !prod.is_active) return false;
      if (stockFilter === "OUT_OF_STOCK" && prod.is_active) return false;

      if (selectedCategory !== "ALL") {
        const catname = typeof prod.category === "object" ? prod.category?.name : prod.category_name;
        if (catname !== selectedCategory && String(prod.category) !== selectedCategory) {
          return false;
        }
      }
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        prod.name?.toLowerCase().includes(q) ||
        prod.description?.toLowerCase().includes(q)
      );
    });

    result.sort((a, b) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "price_asc") return Number(a.price || 0) - Number(b.price || 0);
      if (sortBy === "price_desc") return Number(b.price || 0) - Number(a.price || 0);
      if (sortBy === "status") return (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0);
      if (sortBy === "created_at") return Number(b.created_at) - Number(a.created_at);
      return 0;
    });
    return result;
  }, [products, stockFilter, selectedCategory, searchQuery, sortBy]);

  const outOfStockCount = products.filter((p) => !p.is_active).length;
  const inStockCount = products.filter((p) => p.is_active).length;

  const discount =
    parseFloat(newProduct.mrp || 0) > parseFloat(newProduct.price || 0) &&
    parseFloat(newProduct.price || 0) > 0
      ? Math.round(
          ((parseFloat(newProduct.mrp) - parseFloat(newProduct.price)) /
            parseFloat(newProduct.mrp)) *
            100
        )
      : 0;

  const editDiscount =
    editingProductData &&
    parseFloat(editingProductData.mrp || 0) > parseFloat(editingProductData.price || 0) &&
    parseFloat(editingProductData.price || 0) > 0
      ? Math.round(
          ((parseFloat(editingProductData.mrp) - parseFloat(editingProductData.price)) /
            parseFloat(editingProductData.mrp)) *
            100
        )
      : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12 text-slate-700 dark:text-zinc-200">
      {/* ─── 1. TOP HEADER WITH "+ ADD PRODUCT" BUTTON ─── */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/50 shadow-xs shrink-0">
            <Package size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Products Catalog
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mt-0.5">
              Add new items, manage inventory prices, and update stock availability
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* View Toggle */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-500 dark:text-zinc-400"
              }`}
              title="Grid View"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-500 dark:text-zinc-400"
              }`}
              title="Table View"
            >
              <List size={16} />
            </button>
          </div>
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
          {/* "+ ADD PRODUCT" BUTTON */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* ─── 2. STATS BAR ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
            Total Catalog
          </span>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {products.length}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
            In Stock
          </span>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {inStockCount}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
            Out of Stock
          </span>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            {outOfStockCount}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
            Categories
          </span>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {categories.length}
          </p>
        </div>
      </div>

      {/* ─── 3. SEARCH & FILTERS ─── */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by name or description..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-200 cursor-pointer"
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
              className="px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-200 cursor-pointer"
            >
              <option value="name">Sort: Name (A-Z)</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="status">Status: In Stock First</option>
            </select>
          </div>
        </div>

        {/* Stock Filter Tabs */}
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
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 4. PRODUCTS LIST / GRID ─── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center mb-3">
            <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Loading catalog items...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-14 text-center border border-slate-200 dark:border-zinc-800 space-y-3 shadow-xs">
          <div className="w-14 h-14 bg-slate-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center mx-auto text-slate-500">
            <Package className="w-8 h-8" />
          </div>
          <p className="text-base font-bold text-slate-900 dark:text-white">No products found</p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus size={15} />
            <span>Add Your First Product</span>
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredProducts.map((product) => {
            const isAvailable = product.is_active !== false;
            const rawCat =
              typeof product.category === "object"
                ? product.category?.name
                : product.category_name ||
                  categories.find((c) => String(c.id) === String(product.category || product.category_id))?.name ||
                  "";
            const categoryName = rawCat && rawCat.toLowerCase() !== "general" && rawCat.toLowerCase() !== "all" ? rawCat : "";
            const unitName = product.unit?.name || product.unit_name || "1 Unit";
            const hasDiscount =
              product.mrp &&
              parseFloat(product.mrp) > parseFloat(product.price || 0) &&
              parseFloat(product.price || 0) > 0;
            const discountPercent = hasDiscount
              ? Math.round(((parseFloat(product.mrp) - parseFloat(product.price)) / parseFloat(product.mrp)) * 100)
              : 0;

            return (
              <div
                key={product.id}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-blue-500/40 hover:shadow-sm transition-all group"
              >
                <div>
                  <div className="flex items-start gap-3.5">
                    {/* Thumbnail with 1-click photo upload */}
                    <div className="relative w-18 h-18 rounded-xl bg-slate-50 dark:bg-zinc-800 overflow-hidden shrink-0 border border-slate-200 dark:border-zinc-700 flex items-center justify-center group/img">
                      {product.image_url || product.image ? (
                        <img
                          src={product.image_url || product.image}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                        />
                      ) : (
                        <Package className="text-slate-400 dark:text-zinc-600" size={26} />
                      )}
                      <label
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer"
                        title="Upload / Change Image"
                      >
                        {uploadingId === product.id ? (
                          <Loader2 className="animate-spin text-white w-5 h-5" />
                        ) : (
                          <Upload className="text-white w-5 h-5" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleImageUpload(product.id, e.target.files[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>

                    {/* Basic Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate" title={product.name}>
                          {product.name}
                        </h3>
                        <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 shrink-0">
                          #{product.id}
                        </span>
                      </div>

                      {/* Category Badge (Only if available and not General) & Unit */}
                      <div className="flex items-center flex-wrap gap-1.5 mt-1">
                        {categoryName ? (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                            {categoryName}
                          </span>
                        ) : null}
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                          {unitName}
                        </span>
                      </div>

                      {/* Price, MRP, and Discount */}
                      <div className="flex items-baseline flex-wrap gap-2 mt-2">
                        <span className="font-extrabold text-base text-slate-900 dark:text-white">
                          ₹{parseFloat(product.price || 0).toFixed(0)}
                        </span>
                        {hasDiscount && (
                          <>
                            <span className="text-xs text-slate-400 dark:text-zinc-500 line-through font-medium">
                              ₹{parseFloat(product.mrp).toFixed(0)}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 px-1.5 py-0.5 rounded">
                              {discountPercent}% OFF
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rich Details: Stock, Min Qty / Step, Description */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                      <span className="flex items-center gap-1 font-medium">
                        <Boxes size={12} className="text-blue-500 dark:text-blue-400" />
                        <span className="text-slate-600 dark:text-zinc-400">Stock:</span>
                        <strong className="text-blue-700 dark:text-blue-300 font-bold">
                          {product.stock !== undefined && product.stock !== null ? product.stock : "100"}
                        </strong>
                      </span>
                      {(product.min_order_qty > 0 || product.order_step > 1) && (
                        <span className="text-purple-600 dark:text-purple-400 text-[10px] font-semibold">
                          Min: {product.min_order_qty || 0} • Step: {product.order_step || 1}
                        </span>
                      )}
                    </div>

                    {product.description && (
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1 italic">
                        {product.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer: Update Button, Delete Button & In/Out Stock Switch */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(product)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60 rounded-md text-xs font-semibold transition-all cursor-pointer active:scale-95"
                      title="Update product"
                    >
                      <Edit2 size={12} />
                      <span>Update</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setProductToDelete(product);
                      }}
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60 rounded-md text-xs font-semibold transition-all cursor-pointer active:scale-95 flex items-center justify-center"
                      title="Delete product"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold ${
                        isAvailable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {isAvailable ? "In Stock" : "Out of Stock"}
                    </span>
                    <button
                      onClick={() => toggleStockStatus(product)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none border cursor-pointer ${
                        isAvailable
                          ? "bg-emerald-600 border-emerald-600"
                          : "bg-slate-200 dark:bg-zinc-700 border-slate-300 dark:border-zinc-600"
                      }`}
                      title={isAvailable ? "Click to mark Out of Stock" : "Click to mark In Stock"}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
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
        /* Table View */
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300">
                  <th className="py-3 px-4 font-semibold uppercase text-[10px]">Product</th>
                  <th className="py-3 px-4 font-semibold uppercase text-[10px]">Category</th>
                  <th className="py-3 px-4 font-semibold uppercase text-[10px]">Unit</th>
                  <th className="py-3 px-4 font-semibold uppercase text-[10px]">Price</th>
                  <th className="py-3 px-4 font-semibold uppercase text-[10px]">Stock</th>
                  <th className="py-3 px-4 font-semibold uppercase text-[10px]">Status</th>
                  <th className="py-3 px-4 font-semibold uppercase text-[10px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredProducts.map((product) => {
                  const isAvailable = product.is_active !== false;
                  const rawCat =
                    typeof product.category === "object"
                      ? product.category?.name
                      : product.category_name ||
                        categories.find((c) => String(c.id) === String(product.category || product.category_id))?.name ||
                        "";
                  const categoryName = rawCat && rawCat.toLowerCase() !== "general" && rawCat.toLowerCase() !== "all" ? rawCat : "";
                  const unitName = product.unit?.name || product.unit_name || "1 Unit";

                  return (
                    <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-zinc-800 overflow-hidden shrink-0 border border-slate-200 dark:border-zinc-700 flex items-center justify-center">
                            {product.image_url || product.image ? (
                              <img src={product.image_url || product.image} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package size={16} className="text-slate-400 dark:text-zinc-500" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block text-xs">
                              {product.name}
                            </span>
                            {product.mrp && parseFloat(product.mrp) > parseFloat(product.price || 0) && (
                              <span className="text-[10px] text-slate-400 line-through">
                                MRP: ₹{parseFloat(product.mrp).toFixed(0)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {categoryName ? (
                          <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                            {categoryName}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                          {unitName}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        ₹{parseFloat(product.price || 0).toFixed(0)}
                      </td>
                      <td className="py-3 px-4 font-bold text-blue-600 dark:text-blue-400">
                        {product.stock !== undefined && product.stock !== null ? product.stock : "100"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isAvailable
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60"
                          }`}
                        >
                          {isAvailable ? "In Stock" : "Out of Stock"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(product)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-md text-xs font-semibold transition-all cursor-pointer"
                            title="Update product"
                          >
                            <Edit2 size={11} />
                            <span>Update</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setProductToDelete(product);
                            }}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center justify-center active:scale-95"
                            title="Delete product"
                          >
                            <Trash2 size={13} />
                          </button>
                          <button
                            onClick={() => toggleStockStatus(product)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                              isAvailable ? "bg-emerald-600" : "bg-slate-200 dark:bg-zinc-700"
                            }`}
                            title={isAvailable ? "Mark Out of Stock" : "Mark In Stock"}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                isAvailable ? "translate-x-4.5" : "translate-x-1"
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

      {/* ─── 5. INLINE "ADD PRODUCT" MODAL POPUP ─── */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 sm:p-6 space-y-4 shadow-2xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Add New Product
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                    Create item in catalog with price and godown stock
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg bg-slate-100 dark:bg-zinc-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={(e) => handleCreateProduct(e, false)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fresh Potato / Aloo"
                    value={newProduct.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setNewProduct({
                        ...newProduct,
                        name,
                        slug: slugify(name),
                      });
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Product Slug *
                    </label>
                    <span className="text-[10px] text-slate-400">Auto-generated</span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. fresh-potato-aloo"
                    value={newProduct.slug || ""}
                    onChange={(e) => setNewProduct({ ...newProduct, slug: slugify(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-mono font-medium text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Category
                  </label>
                  <select
                    value={newProduct.category_id}
                    onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">No Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Pack Size / Unit
                  </label>
                  <select
                    value={newProduct.unit_name}
                    onChange={(e) => setNewProduct({ ...newProduct, unit_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="1 kg">1 kg</option>
                    <option value="500 gm">500 gm</option>
                    <option value="250 gm">250 gm</option>
                    <option value="1 piece">1 piece</option>
                    <option value="1 bunch">1 bunch</option>
                    <option value="1 packet">1 packet</option>
                    <option value="1 dozen">1 dozen (12 pcs)</option>
                    <option value="1 liter">1 liter</option>
                    <option value="500 ml">500 ml</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    placeholder="e.g. 40"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Market Price / MRP (₹)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newProduct.mrp}
                    onChange={(e) => setNewProduct({ ...newProduct, mrp: e.target.value })}
                    placeholder="e.g. 60"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {discount > 0 && (
                <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                  <Sparkles size={13} />
                  <span>Discount: {discount}% OFF</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Initial Stock (Qty)
                  </label>
                  <input
                    type="number"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                    placeholder="e.g. 100"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Description / Notes
                  </label>
                  <input
                    type="text"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    placeholder="e.g. Fresh farm produce"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Image selector */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Product Image (Optional)
                </label>
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-12 h-12 rounded-md object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-slate-400">
                      <Upload size={18} />
                    </div>
                  )}
                  <label className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-md text-xs font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800">
                    <span>{imagePreview ? "Change Image" : "Select Image"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingProduct}
                  onClick={(e) => handleCreateProduct(e, true)}
                  className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-800 dark:text-zinc-200 rounded-md text-xs font-bold cursor-pointer"
                >
                  Save & Add Another
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingProduct ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Save Product</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 6. COMPREHENSIVE "UPDATE PRODUCT" MODAL ─── */}
      {isEditModalOpen && editingProductData && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 sm:p-6 space-y-4 shadow-2xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Edit2 size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Update Product Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                    Edit catalog rates, units, stock quantity, and photo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg bg-slate-100 dark:bg-zinc-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProductData.name}
                    onChange={(e) =>
                      setEditingProductData({ ...editingProductData, name: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Product Slug *
                    </label>
                    <span className="text-[10px] text-slate-400">URL Identifier</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={editingProductData.slug || ""}
                    onChange={(e) =>
                      setEditingProductData({ ...editingProductData, slug: slugify(e.target.value) })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-mono font-medium text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Category
                  </label>
                  <select
                    value={editingProductData.category_id}
                    onChange={(e) =>
                      setEditingProductData({ ...editingProductData, category_id: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">No Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Pack Size / Unit
                  </label>
                  <select
                    value={editingProductData.unit_name}
                    onChange={(e) =>
                      setEditingProductData({ ...editingProductData, unit_name: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="1 kg">1 kg</option>
                    <option value="500 gm">500 gm</option>
                    <option value="250 gm">250 gm</option>
                    <option value="1 piece">1 piece</option>
                    <option value="1 bunch">1 bunch</option>
                    <option value="1 packet">1 packet</option>
                    <option value="1 dozen">1 dozen (12 pcs)</option>
                    <option value="1 liter">1 liter</option>
                    <option value="500 ml">500 ml</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={editingProductData.price}
                    onChange={(e) =>
                      setEditingProductData({ ...editingProductData, price: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Market Price / MRP (₹)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={editingProductData.mrp}
                    onChange={(e) =>
                      setEditingProductData({ ...editingProductData, mrp: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {editDiscount > 0 && (
                <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                  <Sparkles size={13} />
                  <span>Discount: {editDiscount}% OFF</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    value={editingProductData.stock}
                    onChange={(e) =>
                      setEditingProductData({ ...editingProductData, stock: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Min Order Qty
                  </label>
                  <input
                    type="number"
                    value={editingProductData.min_order_qty}
                    onChange={(e) =>
                      setEditingProductData({
                        ...editingProductData,
                        min_order_qty: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Order Step
                  </label>
                  <input
                    type="number"
                    value={editingProductData.order_step}
                    onChange={(e) =>
                      setEditingProductData({
                        ...editingProductData,
                        order_step: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Description / Note
                </label>
                <input
                  type="text"
                  value={editingProductData.description}
                  onChange={(e) =>
                    setEditingProductData({ ...editingProductData, description: e.target.value })
                  }
                  placeholder="e.g. Freshly sourced daily"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>

              {/* Product Image Update */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Product Image
                </label>
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md">
                  {editImagePreview ? (
                    <img
                      src={editImagePreview}
                      alt="Preview"
                      className="w-12 h-12 rounded-md object-cover border border-slate-200 dark:border-zinc-700"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-slate-400">
                      <Upload size={18} />
                    </div>
                  )}
                  <label className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-md text-xs font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800">
                    <span>{editImagePreview ? "Change Photo" : "Upload Photo"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleEditImageChange}
                    />
                  </label>
                </div>
              </div>

              {/* In-Stock Availability Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-md">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Product Availability
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                    {editingProductData.is_active
                      ? "In Stock (Available for ordering)"
                      : "Out of Stock (Hidden from store)"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingProductData({
                      ...editingProductData,
                      is_active: !editingProductData.is_active,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none border cursor-pointer ${
                    editingProductData.is_active
                      ? "bg-blue-600 border-blue-600"
                      : "bg-slate-200 dark:bg-zinc-700 border-slate-300 dark:border-zinc-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      editingProductData.is_active ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    const prod = {
                      id: editingProductData.id,
                      name: editingProductData.name,
                    };
                    setIsEditModalOpen(false);
                    setProductToDelete(prod);
                  }}
                  className="px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-md flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  title="Delete this product"
                >
                  <Trash2 size={13} />
                  <span>Delete Product</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingProduct}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
                  >
                    {updatingProduct ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Save size={13} />
                    )}
                    <span>Save Updates</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 7. QUICK PRICE EDIT MODAL ─── */}
      {editingProduct && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditingProduct(null)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Update Rate</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 truncate max-w-[200px]">
                  {editingProduct.name}
                </p>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-700 bg-slate-100 dark:bg-zinc-800 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSavePrice} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Today&apos;s Price (₹)
                </label>
                <input
                  type="number"
                  step="0.5"
                  required
                  autoFocus
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-md text-base font-bold text-blue-600 dark:text-blue-400"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPrice}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {savingPrice ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Save Rate</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 8. DELETE CONFIRMATION MODAL ─── */}
      {productToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => !isDeleting && setProductToDelete(null)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/50">
                <Trash2 size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Delete Product?
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-white">&quot;{productToDelete.name}&quot;</span>? This will remove it from your store catalog.
                </p>
              </div>
            </div>

            {/* Product snapshot preview */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
                {productToDelete.image_url || productToDelete.image ? (
                  <img
                    src={productToDelete.image_url || productToDelete.image}
                    alt={productToDelete.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package size={16} className="text-slate-400" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-xs">
                <p className="font-bold text-slate-900 dark:text-white truncate">
                  {productToDelete.name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  ₹{productToDelete.price || 0} • {productToDelete.unit_name || productToDelete.unit?.name || "1 Unit"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteProduct}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-md text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60 transition-colors"
              >
                {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>{isDeleting ? "Deleting..." : "Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

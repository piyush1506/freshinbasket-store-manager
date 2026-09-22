"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FolderTree,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  LayoutGrid,
  List,
  Upload,
  Loader2,
  Save,
  Layers,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { authFetch } from "@/lib/auth";
import { uploadImage, getImageUrl, cleanImageUrlForBackend } from "@/lib/upload";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState("ALL");
  const [viewMode, setViewMode] = useState("grid");

  // Create Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [newCategory, setNewCategory] = useState({
    name: "",
    slug: "",
    section: "",
    description: "",
  });

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [updatingCategory, setUpdatingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);

  // Delete Modal State
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(false);

  // Helper to generate unique URL-safe slug for DRF
  const slugify = (text) => {
    if (!text) return "cat-" + Date.now().toString(36);
    let str = text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
    return str || "cat-" + Date.now().toString(36);
  };

  // Helper to safely parse JSON without throwing on HTML error pages
  const safeJson = async (res) => {
    if (!res || !res.ok) return null;
    try {
      return await res.json();
    } catch (e) {
      console.warn("JSON parse error:", e);
      return null;
    }
  };

  // ─── Fetch Categories & Sections ───
  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [catRes, homeRes] = await Promise.all([
        authFetch(`${API_URL}/api/v1/categories/`).catch(() => null),
        authFetch(`${API_URL}/api/v1/home/`).catch(() => null),
      ]);

      const catData = await safeJson(catRes);
      const rawCatList = Array.isArray(catData) ? catData : catData?.results || [];
      const catList = rawCatList.map((cat) => {
        const cleanImg = getImageUrl(cat.image_url || cat.image);
        return {
          ...cat,
          image_url: cleanImg,
          image: cleanImg,
        };
      });
      if (catData !== null) {
        setCategories(catList);
      }

      const homeData = await safeJson(homeRes);
      // The /api/v1/home/ endpoint returns { sections: [...], categories: [...], slides: [...] }
      const secList = homeData?.sections || [];

      // Dynamically map API sections and category-derived sections (no hardcoded data)
      const secMap = new Map();

      // 1. Add API sections
      secList.forEach((s) => {
        if (s && s.id) secMap.set(String(s.id), s);
      });

      // 2. Derive any sections from active category data
      catList.forEach((cat) => {
        if (cat && (cat.section || cat.section_name)) {
          const secId = typeof cat.section === "object" ? cat.section?.id : cat.section;
          const key = String(secId || cat.section_name);
          if (key && !secMap.has(key)) {
            secMap.set(key, {
              id: secId || key,
              name: cat.section_name || `Section ${secId}`,
              slug: (cat.section_name || `section-${secId}`).toLowerCase().replace(/\s+/g, "-"),
            });
          }
        }
      });

      setSections(Array.from(secMap.values()));
    } catch (err) {
      console.error("fetchData error:", err);
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Image Handlers
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

  // Open Edit Modal
  const handleOpenEditModal = (cat) => {
    const sectionId =
      typeof cat.section === "object"
        ? cat.section?.id
        : cat.section ||
          sections.find((s) => s.name === cat.section_name)?.id ||
          "";

    setEditingCategory({
      id: cat.id,
      name: cat.name || "",
      slug: cat.slug || "",
      section: sectionId ? String(sectionId) : "",
      description: cat.description || "",
    });
    setEditImageFile(null);
    setEditImagePreview(cat.image_url || cat.image || null);
    setIsEditModalOpen(true);
  };

  // ─── Create Category ───
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    setSavingCategory(true);
    const slug = (newCategory.slug || "").trim() || slugify(newCategory.name);

    try {
      if (imageFile) {
        const formdata = new FormData();
        formdata.append("name", newCategory.name.trim());
        formdata.append("slug", slug);
        if (newCategory.section && String(newCategory.section).trim() !== "") {
          formdata.append("section", String(newCategory.section));
        }
        formdata.append("description", newCategory.description || "");
        formdata.append("image", imageFile);

        res = await authFetch(`${API_URL}/api/v1/categories/`, {
          method: "POST",
          body: formdata,
        });
      } else {
        const payload = {
          name: newCategory.name.trim(),
          slug: slug,
          description: newCategory.description || "",
        };
        if (newCategory.section && String(newCategory.section).trim() !== "") {
          payload.section = parseInt(newCategory.section, 10);
        }

        res = await authFetch(`${API_URL}/api/v1/categories/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res && res.ok) {
        const created = await res.json();
        const rawImg =
          created.image_url ||
          created.image ||
          (created.data && (created.data.image_url || created.data.image)) ||
          imagePreview ||
          null;

        const finalImg = getImageUrl(rawImg);

        const finalCategory = {
          ...created,
          image_url: finalImg || created.image_url,
          image: finalImg || created.image,
        };

        toast.success(`Category "${newCategory.name}" created successfully!`);
        setCategories((prev) => [finalCategory, ...prev]);
        setNewCategory({ name: "", slug: "", section: "", description: "" });
        setImageFile(null);
        setImagePreview(null);
        setIsAddModalOpen(false);
      } else {
        let errorMsg = "Failed to create category";
        try {
          const err = await res.json();
          if (typeof err === "string") errorMsg = err;
          else if (err.detail) errorMsg = err.detail;
          else if (typeof err === "object") {
            const msgs = Object.entries(err).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
            if (msgs.length > 0) errorMsg = msgs.join(" | ");
          }
        } catch (_) {}
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error("Create error:", err);
      toast.error("Network error while creating category");
    } finally {
      setSavingCategory(false);
    }
  };

  // ─── Update Category ───
  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    setUpdatingCategory(true);
    const slug = (editingCategory.slug || "").trim() || slugify(editingCategory.name);

    try {
      if (editImageFile) {
        const formdata = new FormData();
        formdata.append("name", editingCategory.name.trim());
        formdata.append("slug", slug);
        if (editingCategory.section && String(editingCategory.section).trim() !== "") {
          formdata.append("section", String(editingCategory.section));
        }
        formdata.append("description", editingCategory.description || "");
        formdata.append("image", editImageFile);

        res = await authFetch(`${API_URL}/api/v1/categories/${editingCategory.id}/`, {
          method: "PATCH",
          body: formdata,
        });
      } else {
        const payload = {
          name: editingCategory.name.trim(),
          slug: slug,
          description: editingCategory.description || "",
          section: editingCategory.section && String(editingCategory.section).trim() !== "" ? parseInt(editingCategory.section, 10) : null,
        };

        res = await authFetch(`${API_URL}/api/v1/categories/${editingCategory.id}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res && res.ok) {
        const updated = await res.json();
        const rawImg =
          updated.image_url ||
          updated.image ||
          (updated.data && (updated.data.image_url || updated.data.image)) ||
          editImagePreview ||
          null;

        const finalImg = getImageUrl(rawImg);

        toast.success(`Category "${editingCategory.name}" updated successfully!`);
        setCategories((prev) =>
          prev.map((c) =>
            c.id === editingCategory.id
              ? {
                  ...c,
                  ...updated,
                  image_url: finalImg || c.image_url,
                  image: finalImg || c.image,
                }
              : c
          )
        );
        setIsEditModalOpen(false);
        setEditingCategory(null);
        setEditImageFile(null);
        setEditImagePreview(null);
      } else {
        let errorMsg = "Failed to update category";
        try {
          const err = await res.json();
          if (typeof err === "string") errorMsg = err;
          else if (err.detail) errorMsg = err.detail;
          else if (typeof err === "object") {
            const msgs = Object.entries(err).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
            if (msgs.length > 0) errorMsg = msgs.join(" | ");
          }
        } catch (_) {}
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error("Update error:", err);
      toast.error("Network error while updating category");
    } finally {
      setUpdatingCategory(false);
    }
  };

  // ─── Delete Category ───
  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setDeletingCategory(true);

    try {
      const res = await authFetch(`${API_URL}/api/v1/categories/${categoryToDelete.id}/`, {
        method: "DELETE",
      });

      if (res && (res.ok || res.status === 204)) {
        toast.success(`Category "${categoryToDelete.name}" deleted successfully!`);
        setCategories((prev) => prev.filter((c) => c.id !== categoryToDelete.id));
        setCategoryToDelete(null);
      } else {
        toast.error("Failed to delete category");
      }
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Network error while deleting category");
    } finally {
      setDeletingCategory(false);
    }
  };

  // Filtered & Sorted Categories
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const matchesSearch =
        (cat.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cat.slug || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cat.description || "").toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedSection === "UNASSIGNED") {
        return !cat.section && !cat.section_name;
      }
      if (selectedSection !== "ALL") {
        const secId = typeof cat.section === "object" ? cat.section?.id : cat.section;
        return String(secId) === String(selectedSection) || cat.section_name === selectedSection;
      }

      return true;
    });
  }, [categories, searchQuery, selectedSection]);

  const assignedCount = useMemo(() => {
    return categories.filter((c) => c.section || c.section_name).length;
  }, [categories]);

  const unassignedCount = useMemo(() => {
    return categories.filter((c) => !c.section && !c.section_name).length;
  }, [categories]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 sm:p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <FolderTree size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Category Management
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                {categories.length} Total
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
              Create, organize, and edit storefront catalog categories
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="p-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl transition-colors cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Create Category</span>
          </button>
        </div>
      </div>

      {/* Stats Quick Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <FolderTree size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Categories</p>
            <p className="text-lg font-black text-slate-900 dark:text-white">{categories.length}</p>
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Layers size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assigned to Section</p>
            <p className="text-lg font-black text-slate-900 dark:text-white">{assignedCount}</p>
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unassigned</p>
            <p className="text-lg font-black text-slate-900 dark:text-white">{unassignedCount}</p>
          </div>
        </div>
      </div>

      {/* Control Bar (Search, Section Filter, View Mode) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories by name, slug, or description..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Section Filter */}
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">All Sections ({categories.length})</option>
            <option value="UNASSIGNED">Unassigned ({unassignedCount})</option>
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.name}
              </option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg border border-slate-200 dark:border-zinc-700">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-zinc-300"
              }`}
              title="Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === "list"
                  ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-zinc-300"
              }`}
              title="List View"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Categories Display */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl">
          <Loader2 size={32} className="animate-spin text-blue-600 mb-3" />
          <p className="text-sm font-bold text-slate-600 dark:text-zinc-400">Loading categories catalog...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 mb-3">
            <FolderTree size={26} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            No categories found
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mb-4 font-medium">
            {searchQuery || selectedSection !== "ALL"
              ? "Try adjusting your search query or section filter."
              : "No categories have been added yet. Click 'Create Category' to add one."}
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20"
          >
            <Plus size={15} />
            <span>Add First Category</span>
          </button>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCategories.map((cat) => {
            const secName = cat.section_name || sections.find((s) => String(s.id) === String(cat.section))?.name;
            const imgSrc = cat.image_url || cat.image;

            return (
              <div
                key={cat.id}
                className="group bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 rounded-2xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-all duration-200"
              >
                <div>
                  {/* Card Header & Thumbnail */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/60 overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-400">
                      {imgSrc ? (
                        <>
                          <img
                            src={getImageUrl(imgSrc)}
                            alt={cat.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const fallback = e.currentTarget.parentElement?.querySelector('.cat-img-fallback');
                              if (fallback) fallback.classList.remove('hidden');
                            }}
                          />
                          <div className="cat-img-fallback hidden w-full h-full flex items-center justify-center">
                            <FolderTree size={22} />
                          </div>
                        </>
                      ) : (
                        <FolderTree size={22} />
                      )}
                    </div>

                    {/* Section Badge */}
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        secName
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50"
                          : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {secName || "Unassigned"}
                    </span>
                  </div>

                  {/* Title & Slug */}
                  <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {cat.name}
                  </h4>
                  <p className="text-[11px] font-mono font-semibold text-slate-400 dark:text-zinc-500 truncate mb-2">
                    /{cat.slug}
                  </p>

                  {/* Description */}
                  {cat.description ? (
                    <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 font-medium mb-3">
                      {cat.description}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic mb-3">No description provided</p>
                  )}
                </div>

                {/* Footer Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800/80">
                  <span className="text-[11px] font-bold text-slate-400">ID: #{cat.id}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(cat)}
                      className="p-1.5 bg-slate-100 hover:bg-blue-50 dark:bg-zinc-800 dark:hover:bg-blue-950/40 text-slate-700 hover:text-blue-600 dark:text-zinc-300 dark:hover:text-blue-400 rounded-lg transition-colors cursor-pointer"
                      title="Edit Category"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setCategoryToDelete(cat)}
                      className="p-1.5 bg-slate-100 hover:bg-rose-50 dark:bg-zinc-800 dark:hover:bg-rose-950/40 text-slate-700 hover:text-rose-600 dark:text-zinc-300 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                      title="Delete Category"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Slug</th>
                  <th className="py-3.5 px-4">Section</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-700 dark:text-zinc-300 font-medium">
                {filteredCategories.map((cat) => {
                  const secName = cat.section_name || sections.find((s) => String(s.id) === String(cat.section))?.name;
                  const imgSrc = cat.image_url || cat.image;

                  return (
                    <tr key={cat.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-400">
                            {imgSrc ? (
                              <>
                                <img
                                  src={getImageUrl(imgSrc)}
                                  alt={cat.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const fallback = e.currentTarget.parentElement?.querySelector('.cat-tbl-fallback');
                                    if (fallback) fallback.classList.remove('hidden');
                                  }}
                                />
                                <div className="cat-tbl-fallback hidden w-full h-full flex items-center justify-center">
                                  <FolderTree size={16} />
                                </div>
                              </>
                            ) : (
                              <FolderTree size={16} />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white text-xs">{cat.name}</p>
                            <p className="text-[10px] text-slate-400">ID: #{cat.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                        /{cat.slug}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            secName
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                              : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {secName || "Unassigned"}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-500 dark:text-zinc-400">
                        {cat.description || "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(cat)}
                            className="p-1.5 bg-slate-100 hover:bg-blue-50 dark:bg-zinc-800 dark:hover:bg-blue-950/40 text-slate-700 hover:text-blue-600 dark:text-zinc-300 dark:hover:text-blue-400 rounded-lg transition-colors cursor-pointer"
                            title="Edit Category"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setCategoryToDelete(cat)}
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 dark:bg-zinc-800 dark:hover:bg-rose-950/40 text-slate-700 hover:text-rose-600 dark:text-zinc-300 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                            title="Delete Category"
                          >
                            <Trash2 size={14} />
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

      {/* ─── CREATE CATEGORY MODAL ─── */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Plus size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Create New Category
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                    Add a new category to group items on your store
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

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fresh Vegetables"
                  value={newCategory.name}
                  onChange={(e) =>
                    setNewCategory({
                      ...newCategory,
                      name: e.target.value,
                      slug: slugify(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Section Assignment
                  </label>
                  <select
                    value={newCategory.section}
                    onChange={(e) => setNewCategory({ ...newCategory, section: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">No Section (Unassigned)</option>
                    {sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Slug Identifier
                  </label>
                  <input
                    type="text"
                    placeholder="auto-generated"
                    value={newCategory.slug}
                    onChange={(e) => setNewCategory({ ...newCategory, slug: slugify(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-mono font-medium text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional summary for customers..."
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Category Image (Optional)
                </label>
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-slate-400">
                      <Upload size={18} />
                    </div>
                  )}
                  <label className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800">
                    <span>{imagePreview ? "Change Photo" : "Upload Photo"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingCategory ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Category</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT CATEGORY MODAL ─── */}
      {isEditModalOpen && editingCategory && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Edit2 size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Edit Category
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                    Modify section assignment, details, or category photo
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

            <form onSubmit={handleUpdateCategory} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingCategory.name}
                  onChange={(e) =>
                    setEditingCategory({
                      ...editingCategory,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Section Assignment
                  </label>
                  <select
                    value={editingCategory.section}
                    onChange={(e) => setEditingCategory({ ...editingCategory, section: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">No Section (Unassigned)</option>
                    {sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Slug Identifier
                  </label>
                  <input
                    type="text"
                    value={editingCategory.slug}
                    onChange={(e) => setEditingCategory({ ...editingCategory, slug: slugify(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-mono font-medium text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editingCategory.description}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Category Photo
                </label>
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl">
                  {editImagePreview ? (
                    <img src={getImageUrl(editImagePreview)} alt="Preview" className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-slate-400">
                      <Upload size={18} />
                    </div>
                  )}
                  <label className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800">
                    <span>{editImagePreview ? "Change Photo" : "Upload Photo"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleEditImageChange} />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingCategory}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
                >
                  {updatingCategory ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRMATION MODAL ─── */}
      {categoryToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setCategoryToDelete(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-500">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center flex-shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete Category?
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed font-medium">
              Are you sure you want to delete category{" "}
              <strong className="text-slate-900 dark:text-white font-bold">
                "{categoryToDelete.name}"
              </strong>
              ? Products assigned to this category will not be deleted, but will no longer be linked to this category.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingCategory}
                onClick={handleDeleteCategory}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/20 disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
              >
                {deletingCategory ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Delete Category</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

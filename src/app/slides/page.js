"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Image as ImageIcon,
  Plus,
  Loader2,
  Trash2,
  GripVertical,
  ArrowLeft,
  Eye,
  EyeOff,
  Save,
  Upload,
} from "lucide-react";
import { getAccessToken, getUser } from "@/lib/auth";
import { uploadImage, getImageUrl, cleanImageUrlForBackend } from "@/lib/upload";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function AdminSlidesPage() {
  const router = useRouter();
  const [slides, setSlides] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    tag: "Organic",
    section_id: "",
    link: "",
    button_text: "Shop Now",
    link_two: "",
    button_text_two: "View Offers",
    order: 0,
    is_active: true,
    image_url: "",
    imageFile: null,
  });
  const [preview, setPreview] = useState(null);

  const fetchSlides = async () => {
    try {
      const token = getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [slidesRes, sectionsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/slides/`, { headers }),
        fetch(`${API_URL}/api/v1/sections/`, { headers }),
      ]);

      if (slidesRes.ok) {
        const data = await slidesRes.json();
        const rawList = Array.isArray(data) ? data : data?.results || [];
        const normalizedList = rawList.map((slide) => {
          const cleanImg = getImageUrl(slide.image_url || slide.image);
          return {
            ...slide,
            image_url: cleanImg,
            image: cleanImg,
          };
        });
        setSlides(normalizedList);
      }

      if (sectionsRes.ok) {
        const secData = await sectionsRes.json();
        const secList = Array.isArray(secData) ? secData : secData?.results || [];
        setSections(secList);
      }
    } catch {
      toast.error("Failed to load slides");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.push("/login");
      return;
    }
    const user = getUser();
    if (!user || user.role !== "ADMIN") {
      router.push("/login");
      return;
    }
    fetchSlides();
  }, []);

  const resetForm = () => {
    setForm({
      title: "",
      subtitle: "",
      tag: "Organic",
      section_id: "",
      link: "",
      button_text: "Shop Now",
      link_two: "",
      button_text_two: "View Offers",
      order: 0,
      is_active: true,
      image_url: "",
      imageFile: null,
    });
    setPreview(null);
    setEditingId(null);
    setShowForm(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const editSlide = (slide) => {
    setForm({
      title: slide.title || "",
      subtitle: slide.subtitle || "",
      tag: slide.tag || "Organic",
      section_id: slide.section_id || (typeof slide.section === "object" ? slide.section?.id : slide.section) || "",
      link: slide.link || "",
      button_text: slide.button_text || "Shop Now",
      link_two: slide.link_two || "",
      button_text_two: slide.button_text_two || "View Offers",
      order: slide.order || 0,
      is_active: slide.is_active ?? true,
      image_url: slide.image_url || "",
      imageFile: null,
    });
    setPreview(slide.image_url || null);
    setEditingId(slide.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.image_url && !form.imageFile && !editingId) {
      toast.error("Please enter an image URL or upload an image");
      return;
    }
    setSaving(true);
    try {
      const token = getAccessToken();
      const url = editingId
        ? `${API_URL}/api/v1/slides/${editingId}/`
        : `${API_URL}/api/v1/slides/`;
      const method = editingId ? "PATCH" : "POST";

      if (form.imageFile) {
        const body = new FormData();
        body.append("image", form.imageFile);
        if (form.title) body.append("title", form.title);
        if (form.subtitle) body.append("subtitle", form.subtitle);
        if (form.tag) body.append("tag", form.tag);
        if (form.link) body.append("link", form.link);
        if (form.button_text) body.append("button_text", form.button_text);
        if (form.link_two) body.append("link_two", form.link_two);
        if (form.button_text_two) body.append("button_text_two", form.button_text_two);
        if (form.order !== undefined && form.order !== null) body.append("order", String(form.order));
        body.append("is_active", form.is_active ? "true" : "false");
        if (form.section_id) {
          body.append("section_id", String(form.section_id));
        } else if (editingId) {
          body.append("section_id", "");
        }

        res = await fetch(url, {
          method,
          headers: { Authorization: `Bearer ${token}` },
          body,
        });
      } else {
        const body = JSON.stringify({
          title: form.title,
          subtitle: form.subtitle,
          tag: form.tag,
          link: form.link,
          button_text: form.button_text,
          link_two: form.link_two,
          button_text_two: form.button_text_two,
          order: form.order,
          is_active: form.is_active,
          image_url: form.image_url,
          section_id: form.section_id ? parseInt(form.section_id, 10) : null,
        });

        res = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body,
        });
      }

      if (!res || !res.ok) {
        let errStr = "Failed to save slide";
        try {
          const err = await res.json();
          errStr = Object.values(err).flat().join(", ");
        } catch (_) {}
        throw new Error(errStr);
      }

      toast.success(editingId ? "Slide updated" : "Slide created");
      resetForm();
      fetchSlides();
    } catch (err) {
      toast.error(err.message || "Failed to save slide");
    } finally {
      setSaving(false);
    }
  };

  const deleteSlide = async (id) => {
    if (!confirm("Delete this slide?")) return;
    try {
      const token = getAccessToken();
      await fetch(`${API_URL}/api/v1/slides/${id}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Slide deleted");
      fetchSlides();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const toggleActive = async (slide) => {
    try {
      const token = getAccessToken();
      const body = { is_active: !slide.is_active };
      await fetch(`${API_URL}/api/v1/slides/${slide.id}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      fetchSlides();
    } catch {
      toast.error("Failed to update");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Hero & Promo Banners
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Manage carousel banners and promotional slides displayed on the customer app
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus size={16} />
          <span>Add New Slide</span>
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-5 sm:p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-4">
            {editingId ? "Edit Slide" : "Create New Slide"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Title / Headline
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Fresh Farm Vegetables"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Subtitle / Subtext
                </label>
                <textarea
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  rows={3}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  placeholder="e.g. Up to 40% OFF on daily essentials"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Badge / Tag
                </label>
                <input
                  type="text"
                  value={form.tag}
                  onChange={(e) => setForm({ ...form, tag: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Organic"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Section / Tab (Optional)
                </label>
                <select
                  value={form.section_id}
                  onChange={(e) => setForm({ ...form, section_id: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">General / Home Page (All Sections)</option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.icon ? `${sec.icon} ` : ""}{sec.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Choose which section or tab this slide will be displayed under on the app/web.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Button 1 Label
                  </label>
                  <input
                    type="text"
                    value={form.button_text}
                    onChange={(e) => setForm({ ...form, button_text: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Shop Now"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Button 1 Link
                  </label>
                  <input
                    type="text"
                    value={form.link}
                    onChange={(e) => setForm({ ...form, link: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="/category/vegetables"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Button 2 Label
                  </label>
                  <input
                    type="text"
                    value={form.button_text_two}
                    onChange={(e) => setForm({ ...form, button_text_two: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="View Offers"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Button 2 Link
                  </label>
                  <input
                    type="text"
                    value={form.link_two}
                    onChange={(e) => setForm({ ...form, link_two: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="/offers"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                    className="w-24 px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
                    min="0"
                  />
                </div>
                <div className="pt-5">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Active on storefront
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Slide Banner Image <span className="text-red-500">*</span>
                </label>
                
                <div className="space-y-3">
                  {/* File Upload Box */}
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-zinc-800/30 hover:bg-blue-50/30 dark:hover:bg-blue-950/20"
                  >
                    <input
                      type="file"
                      ref={fileRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setForm({ ...form, imageFile: file, image_url: "" });
                          setPreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Upload size={20} />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-100">
                        {preview ? "Click to change slide image" : "Click to select slide image"}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                        Supports PNG, JPG, WEBP (Recommended: 1200×500px)
                      </span>
                    </div>
                  </div>

                  {/* Or enter URL */}
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">Or paste direct image URL:</span>
                    <input
                      type="text"
                      value={form.image_url}
                      onChange={(e) => {
                        setForm({ ...form, image_url: e.target.value, imageFile: null });
                        setPreview(e.target.value);
                      }}
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="https://res.cloudinary.com/..."
                    />
                  </div>

                  {/* Preview */}
                  {preview && (
                    <div className="relative h-32 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 group/prev">
                      <img src={getImageUrl(preview)} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setForm({ ...form, imageFile: null, image_url: "" });
                          setPreview(null);
                          if (fileRef.current) fileRef.current.value = "";
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-rose-600 transition-colors cursor-pointer"
                        title="Remove Image"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {editingId ? "Update Slide" : "Create Slide"}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Slides List */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        {slides.length === 0 ? (
          <div className="p-12 text-center">
            <ImageIcon size={40} className="mx-auto text-slate-400 dark:text-zinc-600 mb-3" />
            <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">No slides configured</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Click &quot;Add New Slide&quot; to publish your first banner
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
            {slides.map((slide) => (
              <div
                key={slide.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
              >
                <div className="text-slate-400 dark:text-zinc-600 cursor-grab">
                  <GripVertical size={16} />
                </div>
                <div className="w-24 h-14 shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800">
                  {slide.image_url ? (
                    <img
                      src={getImageUrl(slide.image_url)}
                      alt={slide.title || "Slide"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon size={18} className="text-slate-400 dark:text-zinc-600" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-slate-800 dark:text-zinc-100 truncate">
                      {slide.title || "Untitled Slide"}
                    </p>
                    {slide.section_name && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40 shrink-0">
                        {slide.section_name}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                    {slide.subtitle || "No description"}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">
                    Order #{slide.order}
                  </span>
                  <button
                    onClick={() => toggleActive(slide)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      slide.is_active
                        ? "text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        : "text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
                    }`}
                    title={slide.is_active ? "Active" : "Inactive"}
                  >
                    {slide.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <button
                    onClick={() => editSlide(slide)}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteSlide(slide.id)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

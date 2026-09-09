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
} from "lucide-react";
import { getAccessToken, getUser } from "@/lib/auth";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function AdminSlidesPage() {
  const router = useRouter();
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    tag: "Organic",
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
      const res = await fetch(`${API_URL}/api/v1/slides/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSlides(Array.isArray(data) ? data : []);
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
    setForm({ title: "", subtitle: "", tag: "Organic", link: "", button_text: "Shop Now", link_two: "", button_text_two: "View Offers", order: 0, is_active: true, image_url: "", imageFile: null });
    setPreview(null);
    setEditingId(null);
    setShowForm(false);
  };

  const editSlide = (slide) => {
    setForm({
      title: slide.title || "",
      subtitle: slide.subtitle || "",
      tag: slide.tag || "Organic",
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
      let body;
      let headers = { Authorization: `Bearer ${token}` };

      if (form.imageFile) {
        body = new FormData();
        Object.keys(form).forEach((key) => {
          if (key === "imageFile" && form[key]) {
            body.append("image", form[key]);
          } else if (key !== "imageFile" && form[key] !== null && form[key] !== undefined) {
            body.append(key, form[key]);
          }
        });
      } else {
        body = JSON.stringify({
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
        });
        headers["Content-Type"] = "application/json";
      }

      const url = editingId
        ? `${API_URL}/api/v1/slides/${editingId}/`
        : `${API_URL}/api/v1/slides/`;
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(Object.values(err).flat().join(", "));
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
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
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
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus size={16} />
          <span>Add New Slide</span>
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 sm:p-6 shadow-sm">
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
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none"
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
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
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
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Organic"
                />
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
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none"
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
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none"
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
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none"
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
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none"
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
                    className="w-24 px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                    min="0"
                  />
                </div>
                <div className="pt-5">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Active on storefront
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Image URL or File
                </label>
                <input
                  type="text"
                  value={form.image_url}
                  onChange={(e) => {
                    setForm({ ...form, image_url: e.target.value, imageFile: null });
                    setPreview(e.target.value);
                  }}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none mb-2"
                  placeholder="https://..."
                />
                <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-zinc-200 cursor-pointer transition-colors">
                  <ImageIcon size={14} />
                  Choose Image File
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
                </label>
                {preview && (
                  <div className="mt-3 relative h-28 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800">
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
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
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
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
                      src={slide.image_url}
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
                  <p className="text-xs font-semibold text-slate-800 dark:text-zinc-100 truncate">
                    {slide.title || "Untitled Slide"}
                  </p>
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
                        ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
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

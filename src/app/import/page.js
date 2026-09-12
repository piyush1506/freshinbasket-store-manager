"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  FileCheck,
} from "lucide-react";
import { getAccessToken } from "@/lib/auth";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function ImportPage() {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith(".xlsx") || dropped.name.endsWith(".xls"))) {
      setFile(dropped);
      setResult(null);
      setError("");
    } else {
      setError("Please drop a valid Excel file (.xlsx or .xls)");
    }
  }, []);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setResult(null);
      setError("");
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const token = getAccessToken();
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_URL}/api/v1/import/products/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setResult(data);
      toast.success("Excel import completed successfully");
    } catch (err) {
      setError(err.message);
      toast.error(err.message || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/api/v1/import/products/template/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to download template");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "product_import_template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Template downloaded");
    } catch (err) {
      setError(err.message);
      toast.error("Could not download template");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 mb-2 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Products Catalog
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
            <FileSpreadsheet className="text-blue-600 dark:text-blue-400" size={24} />
            Bulk Excel Product Import
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Create or update catalog items, prices, and godown stock via spreadsheet
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Step 1: Download Template */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 sm:p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center">
                1
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                  Download Sample Format
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Pre-configured Excel template with correct column headers
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 mb-5 text-xs text-slate-600 dark:text-zinc-300 space-y-2">
              <span className="font-semibold text-slate-800 dark:text-zinc-200 block">
                Standard Schema Columns:
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <code className="bg-slate-200 dark:bg-zinc-700 px-1 py-0.5 rounded font-mono text-slate-800 dark:text-zinc-200">
                    name
                  </code>{" "}
                  <span className="text-rose-500 font-medium">(Required)</span>
                </div>
                <div>
                  <code className="bg-slate-200 dark:bg-zinc-700 px-1 py-0.5 rounded font-mono text-slate-800 dark:text-zinc-200">
                    price
                  </code>{" "}
                  <span className="text-rose-500 font-medium">(Required)</span>
                </div>
                <div>
                  <code className="bg-slate-200 dark:bg-zinc-700 px-1 py-0.5 rounded font-mono text-slate-800 dark:text-zinc-200">
                    stock
                  </code>{" "}
                  <span className="text-slate-400 dark:text-zinc-500">(Optional)</span>
                </div>
                <div>
                  <code className="bg-slate-200 dark:bg-zinc-700 px-1 py-0.5 rounded font-mono text-slate-800 dark:text-zinc-200">
                    mrp
                  </code>{" "}
                  <span className="text-slate-400 dark:text-zinc-500">(Optional)</span>
                </div>
                <div>
                  <code className="bg-slate-200 dark:bg-zinc-700 px-1 py-0.5 rounded font-mono text-slate-800 dark:text-zinc-200">
                    category
                  </code>{" "}
                  <span className="text-slate-400 dark:text-zinc-500">(Optional)</span>
                </div>
                <div>
                  <code className="bg-slate-200 dark:bg-zinc-700 px-1 py-0.5 rounded font-mono text-slate-800 dark:text-zinc-200">
                    unit
                  </code>{" "}
                  <span className="text-slate-400 dark:text-zinc-500">(Optional)</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleDownloadTemplate}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Download size={14} />
            Download Excel Template (.xlsx)
          </button>
        </div>

        {/* Step 2: Upload File */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 sm:p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center">
                2
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                  Upload Completed Sheet
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Select or drag your .xlsx / .xls file
                </p>
              </div>
            </div>

            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                dragging
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                  : file
                  ? "border-blue-400 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/10"
                  : "border-slate-200 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
              {file ? (
                <div className="space-y-1.5">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <FileCheck size={20} />
                  </div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-zinc-100 truncate max-w-xs mx-auto">
                    {file.name}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                    {(file.size / 1024).toFixed(1)} KB · Tap to change file
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400">
                    <UploadCloud size={20} />
                  </div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                    {dragging ? "Drop your file here" : "Click or drop Excel file"}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                    Supports .xlsx and .xls formats
                  </p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.99] cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Processing Excel Rows...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet size={14} />
                <span>Import Products</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-start gap-3 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div className="font-medium">{error}</div>
        </div>
      )}

      {/* Results Summary */}
      {result && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
              Import Completed: {result.message}
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-center">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                Created
              </span>
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {result.created || 0}
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-center">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                Updated
              </span>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {result.updated || 0}
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-center">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                Skipped
              </span>
              <span className="text-xl font-bold text-slate-600 dark:text-zinc-300">
                {result.skipped || 0}
              </span>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                Row Level Warnings ({result.errors.length}):
              </span>
              <div className="max-h-40 overflow-y-auto bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-xs text-slate-700 dark:text-zinc-300 divide-y divide-slate-100 dark:divide-zinc-800">
                {result.errors.map((err, i) => (
                  <div key={i} className="py-1">
                    <span className="font-semibold">Row {err.row}:</span> {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Link
              href="/products"
              className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl text-center transition-colors shadow-sm"
            >
              Verify in Products Catalog →
            </Link>
            <button
              onClick={() => {
                setFile(null);
                setResult(null);
              }}
              className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

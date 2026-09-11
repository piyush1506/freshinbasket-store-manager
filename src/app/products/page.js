"use client"

import { useState,useEffect,useMemo } from "react"
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

} from 'lucide-react';

import { getAccessToken } from "@/lib/auth";
import toast from "react-hot-toast";


const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function ProductPage(){
  const [products,setProducts] = useState([]);
  const [categories,setCategories] = useState([]);
  const [sections,setSections] = useState([]);

//   const [loading,setLoading] = useState(false);
  const [refreshing,setRefreshing] = useState(false);
  const [loading,setLoading] = useState(true);
  const [searchQuery,setSearchQuery] = useState('');
  const [sortBy,setSortBy] = useState('name');
  const [sortOrder,setSortOrder] = useState('asc');
  const [stockFilter,setStockFilter] = useState('ALL');
  const [selectedCategory,setSelectedCategory] = useState('ALL');
  const [uploadingId,setuploading] = useState(null);

const [viewMode, setViewMode] = useState("grid"); // 👈 ADD THIS LINE

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name:'',
    categoryId:"",
    unit_name:"",
    price:"",
    mrp:"",
    stock:"",
    stock:"",
    order_step:'1',
    min_order_qty:'0',
    tax_percentage:'0',
    description:"",
    is_active:true,
  });

const [newPrice, setNewPrice] = useState('');
  const [editingProduct,setEditingProduct] = useState(null);
//   const [newprice,setNewPrice] = useState('');
  const [savingPrice,setSavingPrice] = useState(false);

  const fetchData = async ()=>{
    setRefreshing(true);
    const token = getAccessToken();
    const headers = token ? {Authorization :`Bearer ${token}`} :{};

    try {
        const [prodRes,catres,secRes] =await Promise.all([
            fetch(`${API_URL}/api/v1/products/`,{headers}),
            fetch(`${API_URL}/api/v1/categories/`,{headers}),
            fetch(`${API_URL}/api/v1/sections/`,{headers}).catch(()=>null),
        ]);

        if (prodRes.ok) {
            const prodData = await prodRes.json();
            setProducts(Array.isArray(prodData) ? prodData : prodData?.results || [])

        }
        if(catres.ok){
            const catData = await catres.json();
            const catlist  = Array.isArray(catData) ? catData : catData?.results || [];
            setCategories(catlist);
            if (catlist.length > 0 && !newProduct.category_id) {
                setNewProduct((prev)=>({...prev,category_id:String(catlist[0].id)}))
            }
          
        }
        if(secres.ok && secRes !==null){
            const secData = await secres.json();
            setSections(Array.isArray(secData) ? secData : secData?.results || [])
        }
    } catch (err) {
        toast.error('failed to load products')
    }finally{
        setLoading(false);
        setRefreshing(false);
    }
    
  }
    useEffect(() => {
    fetchData();
  }, []);

  const handleimagechange = (e)=>{
    const file = e.target.files?.[0];
    if(file){
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    }
  }

  const handleCreateProduct  = async(e,addAnother = false)=>{
    e.preventDefault();
    if (!newProduct.name.trim()) {
      toast.error('product name is required')      
      return  
    }
    if (!newProduct.price || parseFloat(newProduct.price) <= 0) {
      toast.error("Please enter a valid price");
      return;
    }
    setSavingProduct(true);
    const token = getAccessToken();
    try {
        const formdata = new FormData();
        formdata.append('name',newProduct.name.trim());
        formdata.append('price',newProduct.price);
        if(newProduct.mrp) formdata.append('mrp',newProduct.mrp);
        formdata.append('stock',newProduct.stock);
        formdata.append('order_step',newProduct.order_step || '1');
        formdata.append('min_order_qty',newProduct.min_order_qty || '0');
        formdata.append('tax_percentage',newProduct.tax_percentage || '0');
        formdata.append('unit_name',newProduct.unit_name || '');
        formdata.append('description',newProduct.description || '');
        formdata.append('is_active',newProduct.is_active ? "true":"false");
        
        
        if(newProduct.category_id) formdata.append('category',newProduct.category_id)
            if(newProduct.section_id) formdata.append('section_id',newProduct.section_id)
        if(imageFile)formdata.append('image',imageFile);

        const res = await fetch(`${API_URL}/api/v1/products/`,{
          method:"POST",
          headers:{
            Authorization: `Bearer ${token}`
          },
          body:formdata
        })
        if(res.ok){
            const created = await res.json();
            toast.success('product created successfully');
              setNewProduct((prev) => ({
          ...prev,
          name: "",
          price: "",
          mrp: "",
          description: "",
        }));
        setImageFile(null);
        setImagePreview(null);
        setIsAddModalOpen(false);
         if (!addAnother) {
          setIsAddModalOpen(false);
        }else{
            const err = await res.json().catch(()=>({}))
            toast.error(err.detail || err.error || 'failed to fetch product');

        }

        }
    } catch (err) {
         toast.error("Network error while creating product" || err);
    }
    finally{
        setSavingProduct(false)
    }
}

const toggleStockstatus = async (product)=>{
    const nextState = !product.is_active;
    const token = getAccessToken();
    setProducts((prev)=>
        prev.map((p)=>(p.id === product.id ? {...p,is_active:nextState} : p ))
    )
    try{
      const res = await fetch(`
        ${API_URL}/api/v1/products/${product.id}/`,
        {
            method:'PATCH',
            headers:{
                Authorization: `Bearer ${token}`,
                "Content-Type":'application/json'
                },
                body:JSON.stringify({is_active:nextState})
                }
                
            )
              if (res.ok) {
        toast.success(`${product.name} is now ${nextState ? "IN STOCK" : "OUT OF STOCK"}`);
    }
}
    catch(err){

        setProducts((prev)=>prev.map((p)=>(p.id === product.id ? {...p,is_active:!nextState}: p)));
        toast.error('network error updating error ')
    }
    
    
    
}

  const handlesaveprice = async(e)=>{
    e.preventDefault();
    if (!editingProduct || newPrice === "") return;
    setSavingPrice(true);
    const token = getAccessToken();
    try {
        const res = await fetch(`${API_URL}/api/v1/products/${editingProduct.id}/`,{
            method:'PATCH',
            headers:{
                Authorization:`Bearer ${token}`
            },
            body:JSON.stringify({price:parseFloat(newPrice)})
        })
       if(res.ok){
        toast.success('Price updated to '+newPrice);
        setProducts((prev)=>prev.map((p)=>p.id === editingProduct.id ? {...p,price:newPrice}:p));
        setEditingProduct(null)
       } 
       else{
        const err = await res.json().catch(()=>({}))
        toast.error(err.detail || err.error || 'failed to update price');
       }
    } catch (err) {
         toast.error("Network error while saving price" || err);
    }finally{
        setSavingPrice(false);
    }
  }
  

  const handleimageupload = async(productId,file)=>{
    if (!file) {
        return
    }
    setuploading(productId)
    const token  = getAccessToken();
    try {
        const formdata = new FormData();
        formdata.append('image',file);
        const res = await fetch(`${API_URL}/api/v1/products/${productId}/`,{
            method:'PATCH',
            headers:{
                Authorization:`Bearer ${token}`,
            },
            body:formdata
        })
        if(!res.ok) throw new Error('upload failed')

        const updated = await res.json()
        setProducts((prev)=>prev.map((p)=>p.id === productId ? {...p,image:updated.image}: p));
        toast.success('Image uploaded successfully')
    } catch (error) {
        toast.error(error.message ||'failed to upload image')
    } finally {
        setuploading(null)
    }
  }

  const filteredProducts = useMemo(()=>{
    let result  = products.filter((prod)=>{
        if(stockFilter === 'IN_STOCK' && !prod.is_active)return false;
        if (stockFilter === 'OUT_OF_STOCK' && prod.is_active) {
            return false
            
        }
        if (selectedCategory !== 'ALL') {
         const catname= typeof prod.category === 'object' ? prod.category.name : prod.category_name   ;
            if(catname !== selectedCategory && String(prod.category) !==selectedCategory){
                return false;
            }
        }
        const q = searchQuery.toLowerCase().trim();
        if (!q) {
            return true;
        }
        return (
        prod.name?.toLowerCase().includes(q) || prod.description?.toLowerCase().includes(q)
        );
    });
    result.sort((a,b)=>{
        if (sortBy === 'name') return (a.name || "").localeCompare(b.name || "");
        if(sortBy==='price_asc')return Number(a.price || 0) - Number(b.price || 0)
            if(sortBy==='price_desc')return Number(b.price || 0) - Number(a.price || 0)
                if(sortBy=="status")return (b.is_active ? 1:0) -(a.is_active ? 1:0);
        if(sortBy === 'created_at')return Number(b.created_at)-Number(a.created_at);
        return 0;
    })
    return result;
},[products,stockFilter,selectedCategory,searchQuery,sortBy])
  const outOfStockCount  = products.filter((p)=>!p.is_active).length;
  const inStockCount  = products.filter((p)=>p.is_active).length;
  const discount = parseFloat(newProduct.mrp|| 0) > parseFloat(newProduct.price || 0) && parseFloat(newProduct.price || 0) > 0 ? Math.round(((parseFloat(newProduct.mrp)- parseFloat(newProduct.price))/parseFloat(newProduct.mrp)) *100) : 0;
  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12 text-slate-700 dark:text-zinc-200">
      {/* ─── 1. TOP HEADER WITH "+ ADD PRODUCT" BUTTON ─── */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/50 shadow-xs shrink-0">
            <Package size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
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
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
            Total Catalog
          </span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {products.length}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
            In Stock
          </span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {inStockCount}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
            Out of Stock
          </span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {outOfStockCount}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
            Categories
          </span>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {categories.length}
          </p>
        </div>
      </div>
      {/* ─── 3. SEARCH & FILTERS ─── */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by name or description..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
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
        {/* Status Filter Tabs */}
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
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
          <p className="text-xs font-bold text-slate-600 dark:text-zinc-300">Loading catalog items...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-14 text-center border border-slate-200 dark:border-zinc-800 space-y-3 shadow-xs">
          <div className="w-14 h-14 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
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
            const categoryName =
              typeof product.category === "object" ? product.category?.name : product.category_name || "General";
            const unitName = product.unit?.name || product.unit_name || "1 Unit";
            return (
              <div
                key={product.id}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:border-blue-500/50 transition-all group"
              >
                <div>
                  <div className="flex items-start gap-3.5">
                    {/* Thumbnail */}
                    <div className="relative w-16 h-16 rounded-xl bg-slate-50 dark:bg-zinc-800 overflow-hidden shrink-0 border border-slate-200 dark:border-zinc-700 flex items-center justify-center group/img">
                      {product.image || product.image_url ? (
                        <img
                          src={product.image || product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                        />
                      ) : (
                        <Package className="text-slate-400" size={24} />
                      )}
                      <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer">
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
                            if (e.target.files[0]) handleImageUpload(product.id, e.target.files[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {product.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 font-semibold truncate mt-0.5">
                        {unitName} • <span className="text-slate-700 dark:text-zinc-300">{categoryName}</span>
                      </p>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="font-black text-base text-slate-900 dark:text-white">
                          ₹{parseFloat(product.price || 0).toFixed(0)}
                        </span>
                        {product.mrp && (
                          <span className="text-xs text-slate-400 line-through font-medium">
                            ₹{parseFloat(product.mrp).toFixed(0)}
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setEditingProduct(product);
                            setNewPrice(product.price?.toString() || "");
                          }}
                          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 ml-auto px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg cursor-pointer"
                        >
                          <Edit2 size={11} />
                          <span>Rate</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Stock Switch Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isAvailable ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                    />
                    <span
                      className={`text-xs font-bold ${
                        isAvailable ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"
                      }`}
                    >
                      {isAvailable ? "In Stock" : "Out of Stock"}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleStockStatus(product)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none border cursor-pointer ${
                      isAvailable
                        ? "bg-emerald-600 border-emerald-600"
                        : "bg-slate-200 dark:bg-zinc-700 border-slate-300 dark:border-zinc-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                        isAvailable ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300">
                  <th className="py-3 px-4 font-black uppercase text-[10px]">Product</th>
                  <th className="py-3 px-4 font-black uppercase text-[10px]">Category</th>
                  <th className="py-3 px-4 font-black uppercase text-[10px]">Price</th>
                  <th className="py-3 px-4 font-black uppercase text-[10px]">Status</th>
                  <th className="py-3 px-4 font-black uppercase text-[10px] text-right">Switch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredProducts.map((product) => {
                  const isAvailable = product.is_active !== false;
                  const categoryName =
                    typeof product.category === "object" ? product.category?.name : product.category_name || "General";
                  return (
                    <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {product.name}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-zinc-300">{categoryName}</td>
                      <td className="py-3 px-4 font-black text-slate-900 dark:text-white">
                        ₹{parseFloat(product.price || 0).toFixed(0)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isAvailable
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                          }`}
                        >
                          {isAvailable ? "In Stock" : "Out of Stock"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => toggleStockStatus(product)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                            isAvailable ? "bg-emerald-600" : "bg-slate-200 dark:bg-zinc-700"
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              isAvailable ? "translate-x-4.5" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* ─── 5. INLINE "ADD PRODUCT" MODAL POPUP (ON THE SAME PAGE) ─── */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5 shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Add New Product
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Add item directly to your store catalog
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
            {/* Form */}
            <form onSubmit={(e) => handleCreateProduct(e, false)} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="e.g. Fresh Mango, Organic Potato, Shimla Apple"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Category *
                  </label>
                  <select
                    value={newProduct.category_id}
                    onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                  >
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="1 kg">1 kg</option>
                    <option value="500 gm">500 gm</option>
                    <option value="250 gm">250 gm</option>
                    <option value="1 piece">1 piece</option>
                    <option value="1 bunch">1 bunch</option>
                    <option value="1 packet">1 packet</option>
                    <option value="1 dozen">1 dozen (12 pcs)</option>
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
              {discount > 0 && (
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <Sparkles size={13} />
                  <span>Discount: {discount}% OFF</span>
                </div>
              )}
              {/* Image selector */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Product Image (Optional)
                </label>
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-slate-400">
                      <Upload size={18} />
                    </div>
                  )}
                  <label className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-100">
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
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingProduct}
                  onClick={(e) => handleCreateProduct(e, true)}
                  className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-800 dark:text-zinc-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Save & Add Another
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingProduct ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Save Product</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ─── 6. QUICK PRICE EDIT MODAL ─── */}
      {editingProduct && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditingProduct(null)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-2xl"
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-base font-black text-blue-600 dark:text-blue-400"
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
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {savingPrice ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Save Rate</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 


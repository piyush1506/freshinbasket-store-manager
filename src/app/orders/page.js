"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import {
  ShoppingBag,
  Search,
  Clock,
  CheckCircle2,
  Bike,
  Phone,
  MessageSquare,
  Printer,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  MapPin,
  Calendar,
  ArrowRight,
  Package,
} from "lucide-react";
import { getAccessToken } from "@/lib/auth";
import { useAdmin } from "../layout";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function AdminOrdersPage() {
  const { playChime, setPendingCount } = useAdmin();
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedOrders, setExpandedOrders] = useState({});
  const [assignModalOrder, setAssignModalOrder] = useState(null);
  const [assigning, setAssigning] = useState(false);

  // Fetch orders and riders
  const fetchOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    const token = getAccessToken();
    if (!token) return;

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const [ordersRes, ridersRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/orders/`, { headers }),
        fetch(`${API_URL}/api/v1/users/?role=DELIVERY`, { headers }),
      ]);

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data);

        const pending = data.filter((o) => o.status === "PENDING" || o.status === "CONFIRMED");
        setPendingCount(pending.length);

        if (isSilent && data.length > orders.length) {
          playChime();
          toast.success("New Order Received!", { icon: "🔔" });
        }
      }

      if (ridersRes.ok) {
        const ridersData = await ridersRes.json();
        const list = Array.isArray(ridersData) ? ridersData : (ridersData?.results || []);
        setRiders(list.filter((u) => u.role === "DELIVERY"));
      }
    } catch (err) {
      console.error("Orders fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orders.length, playChime, setPendingCount]);

  useEffect(() => {
    fetchOrders(false);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchOrders(true);
    }, 12000);
    return () => clearInterval(timer);
  }, [fetchOrders]);

  const toggleExpand = (id) => {
    setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    const token = getAccessToken();
    try {
      const res = await fetch(`${API_URL}/api/v1/orders/${orderId}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast.success(`Order #${orderId} set to ${newStatus}`);
        fetchOrders(true);
      } else {
        toast.error("Status update failed");
      }
    } catch {
      toast.error("Network error updating status");
    }
  };

  const handleAssignRider = async (deliveryBoyId) => {
    if (!assignModalOrder) return;
    setAssigning(true);
    const token = getAccessToken();

    try {
      const res = await fetch(`${API_URL}/api/v1/deliveries/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order: assignModalOrder.id,
          delivery_boy: deliveryBoyId,
        }),
      });

      if (res.ok) {
        await updateOrderStatus(assignModalOrder.id, "OUT_FOR_DELIVERY");
        toast.success("Rider assigned & order dispatched!");
        setAssignModalOrder(null);
        fetchOrders(true);
      } else {
        toast.error("Failed to assign rider");
      }
    } catch {
      toast.error("Network error while assigning rider");
    } finally {
      setAssigning(false);
    }
  };

  const handlePrintReceipt = (order) => {
    const printWindow = window.open("", "_blank", "width=380,height=600");
    if (!printWindow) {
      toast.error("Please allow popups to print receipt");
      return;
    }

    const itemsHtml = (order.items || [])
      .map(
        (item) => `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:12px;">
          <span>${item.product?.name || "Item"} x ${item.quantity}</span>
          <span>₹${parseFloat(item.price || 0) * parseFloat(item.quantity || 1)}</span>
        </div>
      `
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Packing Slip #${order.order_number || order.id}</title>
          <style>
            body { font-family: monospace; padding: 15px; margin: 0; color: #000; width: 280px; }
            .center { text-align: center; }
            .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
            .bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 16px;">FRESHINBASKET</div>
          <div class="center" style="font-size: 11px;">Farm Fresh Delivered • Bhilwara</div>
          <div class="divider"></div>
          <div class="bold">Order: #${order.order_number || order.id}</div>
          <div>Date: ${new Date(order.created_at).toLocaleString()}</div>
          <div>Slot: ${order.delivery_slot || "Regular Slot"}</div>
          <div class="divider"></div>
          <div><b>Customer:</b> ${order.customer?.first_name || order.customer?.username || "Customer"}</div>
          <div><b>Phone:</b> ${order.customer?.phone_number || "N/A"}</div>
          <div><b>Address:</b> ${order.delivery_address || "N/A"}</div>
          <div class="divider"></div>
          <div class="bold" style="margin-bottom: 6px;">ITEMS:</div>
          ${itemsHtml || "<div>No item details</div>"}
          <div class="divider"></div>
          <div style="display:flex; justify-content:space-between;" class="bold">
            <span>TOTAL:</span>
            <span>₹${parseFloat(order.total_amount || 0).toFixed(0)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size: 11px;">
            <span>Payment:</span>
            <span>${order.payment_method === "COD" ? "Cash on Delivery" : "PAID Online"}</span>
          </div>
          <div class="divider"></div>
          <div class="center" style="font-size: 10px;">Thank you for supporting local farmers!</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "ALL"
          ? true
          : statusFilter === "PENDING"
          ? order.status === "PENDING" || order.status === "CONFIRMED"
          : order.status === statusFilter;

      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        order.id?.toString().includes(q) ||
        (order.order_number && order.order_number.toLowerCase().includes(q)) ||
        (order.customer?.username && order.customer.username.toLowerCase().includes(q)) ||
        (order.customer?.first_name && order.customer.first_name.toLowerCase().includes(q)) ||
        (order.customer?.phone_number && order.customer.phone_number.includes(q)) ||
        (order.delivery_address && order.delivery_address.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [orders, statusFilter, searchQuery]);

  const pendingCountTotal = orders.filter((o) => o.status === "PENDING" || o.status === "CONFIRMED").length;
  const outForDeliveryCount = orders.filter((o) => o.status === "OUT_FOR_DELIVERY").length;
  const deliveredCount = orders.filter((o) => o.status === "DELIVERED").length;

  const statusConfig = {
    PENDING: {
      label: "Needs Packing",
      badge: "bg-[#4A7DFF]/10 text-[#4A7DFF] border-[#4A7DFF]/20",
      dot: "bg-[#4A7DFF]",
    },
    CONFIRMED: {
      label: "Confirmed",
      badge: "bg-[#4A7DFF]/10 text-[#4A7DFF] border-[#4A7DFF]/20",
      dot: "bg-[#4A7DFF]",
    },
    OUT_FOR_DELIVERY: {
      label: "On the Road",
      badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      dot: "bg-purple-500",
    },
    DELIVERED: {
      label: "Delivered",
      badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      dot: "bg-emerald-500",
    },
    CANCELLED: {
      label: "Cancelled",
      badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      dot: "bg-rose-500",
    },
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 pb-20">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 dash-fade-up">
        <div>
          <h1 className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent drop-shadow-sm text-2xl sm:text-3xl font-semibold flex items-center gap-2 tracking-tight">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#4A7DFF] to-[#6C5CE7] flex items-center justify-center">
              <ShoppingBag className="text-white w-5 h-5" />
            </div>
            Dispatch
          </h1>
          <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 mt-1 ml-[48px]">
            Manage live orders, assign riders, and communicate with customers
          </p>
        </div>

        <button
          onClick={() => fetchOrders(false)}
          disabled={refreshing}
          className="self-start sm:self-auto flex items-center gap-2 bg-white dark:bg-[#111118] border border-slate-300 dark:border-[#1e1e2a] px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-zinc-100 hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin text-[#4A7DFF]" : "text-gray-700 dark:text-zinc-300"} />
          <span>{refreshing ? "Syncing Orders..." : "Sync Latest"}</span>
        </button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col lg:flex-row gap-4 dash-fade-up dash-fade-up-d1">
        {/* Horizontal Tabs */}
        <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "ALL", label: "All Orders", count: orders.length },
            { id: "PENDING", label: "Needs Packing", count: pendingCountTotal, activeColor: "bg-slate-700 dark:bg-zinc-100 text-white dark:text-slate-800" },
            { id: "OUT_FOR_DELIVERY", label: "Out for Delivery", count: outForDeliveryCount },
            { id: "DELIVERED", label: "Delivered", count: deliveredCount },
            { id: "CANCELLED", label: "Cancelled" },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? tab.activeColor || "bg-slate-700 dark:bg-zinc-100 text-white dark:text-slate-800"
                    : "bg-white dark:bg-[#111118] text-slate-700 dark:text-zinc-100 border border-slate-300 dark:border-[#1e1e2a] hover:bg-slate-100 dark:hover:bg-[#1a1a26]"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isActive
                        ? tab.id === "PENDING" ? "bg-white/20 text-white dark:text-slate-800" : "bg-slate-700/20 dark:bg-slate-200/20"
                        : "bg-slate-200 dark:bg-[#1e1e2a] text-slate-700 dark:text-zinc-100"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-[320px] shrink-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 dark:text-zinc-300 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, Name, Phone..."
            className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-[#111118] border border-slate-300 dark:border-[#1e1e2a] rounded-lg text-xs text-slate-700 dark:text-zinc-100 placeholder-slate-600 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#4A7DFF]/50 transition-all font-medium"
          />
        </div>
      </div>

      {/* ORDERS LIST */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 rounded-xl bg-[#4A7DFF]/10 flex items-center justify-center mb-4">
            <RefreshCw className="w-6 h-6 text-[#4A7DFF] animate-spin" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-100">Fetching live orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-[#111118]/50 backdrop-blur-xl rounded-xl p-16 text-center border border-slate-300/80 dark:border-[#1e1e2a]/50 dash-fade-up dash-fade-up-d2">
          <div className="w-20 h-20 bg-slate-100 dark:bg-[#1a1a26] rounded-[24px] flex items-center justify-center mx-auto mb-5 rotate-3">
            <ShoppingBag className="w-8 h-8 text-slate-600 dark:text-slate-400" />
          </div>
          <p className="text-lg font-bold text-slate-700 dark:text-white">No active orders found</p>
          <p className="text-sm font-medium text-slate-700 dark:text-zinc-300 mt-2 max-w-sm mx-auto">
            {searchQuery ? "Try a different search term or clear the filters" : "There are no orders matching this exact status right now."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5 dash-fade-up dash-fade-up-d2">
          {filteredOrders.map((order) => {
            const isExpanded = !!expandedOrders[order.id];
            const cfg = statusConfig[order.status] || {
              label: order.status,
              badge: "bg-slate-100 text-slate-800 border-slate-200",
              dot: "bg-slate-400",
            };
            const isPending = order.status === "PENDING" || order.status === "CONFIRMED";
            const isOut = order.status === "OUT_FOR_DELIVERY";
            const cleanPhone = order.customer?.phone_number?.replace(/\D/g, "");

            return (
              <div
                key={order.id}
                className="bg-white dark:bg-[#111118] border border-slate-300 dark:border-[#1e1e2a] hover:border-slate-400 dark:hover:border-[#2a2a35] rounded-xl overflow-hidden shadow-sm flex flex-col justify-between transition-all group/card"
              >
                <div className="p-4 sm:p-5 pb-0 flex-1 flex flex-col relative z-10">
                  {/* HEADER ROW */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-base text-slate-800 dark:text-white tracking-tight">
                          {order.order_number || `FIB-${order.id}`}
                        </span>
                        <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-medium tracking-wide uppercase ${cfg.badge}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />
                          {cfg.label}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-zinc-300 font-medium">
                        <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#1a1a26] px-2 py-1 rounded-md">
                          <Clock size={12} className="text-slate-600 dark:text-zinc-300" />
                          {order.created_at
                            ? new Date(order.created_at).toLocaleString([], {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : ""}
                        </span>
                        {order.delivery_slot && (
                          <span className="flex items-center gap-1.5 bg-[#4A7DFF]/10 text-[#4A7DFF] dark:bg-[#4A7DFF]/20 px-2 py-1 rounded-md font-medium">
                            <Calendar size={12} />
                            {order.delivery_slot}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xl sm:text-2xl font-semibold text-slate-800 dark:text-white tracking-tight">
                        ₹{parseFloat(order.total_amount || 0).toFixed(0)}
                      </p>
                      <p className="text-[10px] font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider mt-0.5">
                        {order.payment_method === "COD" ? "Cash" : "Paid"} • {(order.items || []).length} items
                      </p>
                    </div>
                  </div>

                  {/* CUSTOMER & DELIVERY INFO BLOCK */}
                  <div className="bg-slate-50 dark:bg-[#1a1a26]/50 rounded-xl p-3 mb-3 border border-slate-200 dark:border-[#252530]">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">
                          {order.customer?.first_name || order.customer?.username || "Valued Customer"}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-zinc-300 font-mono mt-0.5 font-medium">
                          {order.customer?.phone_number || "No phone number"}
                        </p>
                      </div>
                      {cleanPhone && (
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${cleanPhone}`}
                            className="w-8 h-8 rounded-md bg-white dark:bg-[#252530] border border-slate-300 dark:border-[#2a2a35] flex items-center justify-center text-slate-700 dark:text-slate-100 hover:border-[#4A7DFF] hover:text-[#4A7DFF] transition-colors"
                            title="Call Customer"
                          >
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" className="opacity-90">
                              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                            </svg>
                          </a>
                          <a
                            href={`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(
                              `Hello! Your FreshInBasket order #${order.order_number || order.id} is being packed.`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="w-8 h-8 rounded-md bg-white dark:bg-[#252530] border border-slate-300 dark:border-[#2a2a35] flex items-center justify-center text-slate-700 dark:text-slate-100 hover:border-[#4A7DFF] hover:text-[#4A7DFF] transition-colors"
                            title="Message on WhatsApp"
                          >
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" className="opacity-90">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                            </svg>
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="flex items-start gap-2 text-[11px] font-medium text-slate-700 dark:text-zinc-200 leading-snug">
                      <MapPin size={14} className="text-[#4A7DFF] shrink-0 mt-0.5" />
                      <span>{order.delivery_address || "Delivery address not provided."}</span>
                    </div>
                  </div>

                  {/* PRODUCT ITEMS */}
                  <div className="mb-4">
                    <button
                      onClick={() => toggleExpand(order.id)}
                      className="w-full flex items-center justify-between py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 group/btn cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Package size={14} className="text-slate-400 group-hover/btn:text-[#4A7DFF] transition-colors" />
                        Package Contents
                      </span>
                      <div className="flex items-center gap-1.5 text-slate-400 group-hover/btn:text-slate-600 dark:group-hover/btn:text-slate-300 transition-colors bg-slate-100 dark:bg-[#1a1a26] px-2 py-1 rounded-lg">
                        <span>{isExpanded ? "Hide" : "Expand"}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 space-y-2 border border-slate-100 dark:border-[#252530] rounded-xl p-2 bg-white dark:bg-[#111118]">
                        {(order.items || []).map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-[#1a1a26] transition-colors group/item"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-[#252530] flex items-center justify-center overflow-hidden shrink-0 border border-slate-200 dark:border-[#2a2a35]">
                                {item.product_image_url ? (
                                  <img 
                                    src={item.product_image_url} 
                                    alt={item.product_name || "Product"} 
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <ShoppingBag size={14} className="text-slate-400" />
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-medium text-slate-700 dark:text-white line-clamp-1">
                                  {item.product_name || "Fresh Produce Item"}
                                </span>
                                <span className="text-[10px] font-medium text-slate-500">
                                  {!isNaN(Number(item.quantity)) ? Number(item.quantity) : (item.quantity || 1)} × {item.unit_name || item.unit || item.product?.unit || item.product?.unit_name || "kg"}
                                </span>
                              </div>
                            </div>
                            <span className="text-xs font-semibold text-slate-700 dark:text-white shrink-0">
                              ₹{(parseFloat(item.unit_price || item.price || 0) * (!isNaN(Number(item.quantity)) ? Number(item.quantity) : (parseFloat(item.quantity) || 1))).toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* BOTTOM ACTION BAR */}
                <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-[#1e1e2a] flex items-center gap-2 mt-auto">
                  <button
                    onClick={() => handlePrintReceipt(order)}
                    title="Print Receipt"
                    className="w-10 h-10 shrink-0 bg-white dark:bg-[#252530] border border-slate-200 dark:border-[#2a2a35] hover:border-[#4A7DFF] hover:text-[#4A7DFF] text-slate-600 dark:text-slate-400 rounded-md flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                  >
                    <Printer size={16} />
                  </button>

                  {isPending && (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        onClick={() => updateOrderStatus(order.id, "CONFIRMED")}
                        className="flex-1 px-3 py-2.5 bg-white dark:bg-[#252530] border border-slate-200 dark:border-[#2a2a35] hover:border-[#4A7DFF] hover:text-[#4A7DFF] text-slate-700 dark:text-white rounded-md text-xs font-medium transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 size={14} />
                        <span>Confirm</span>
                      </button>

                      <button
                        onClick={() => setAssignModalOrder(order)}
                        className="flex-1 px-3 py-2.5 bg-gradient-to-r from-[#4A7DFF] to-[#6C5CE7] text-white rounded-md text-xs font-medium transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Bike size={14} />
                        <span>Assign Rider</span>
                      </button>
                    </div>
                  )}

                  {isOut && (
                    <button
                      onClick={() => updateOrderStatus(order.id, "DELIVERED")}
                      className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                       <CheckCircle2 size={14} />
                       <span>Mark Delivered</span>
                    </button>
                  )}

                  {order.status !== "CANCELLED" && order.status !== "DELIVERED" && (
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to cancel order #${order.order_number || order.id}?`)) {
                          updateOrderStatus(order.id, "CANCELLED");
                        }
                      }}
                      className="px-3 py-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md text-[11px] font-medium transition-all active:scale-95 shrink-0 cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ASSIGN RIDER POPUP MODAL */}
      {assignModalOrder && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all"
          onClick={() => setAssignModalOrder(null)}
        >
          <div
            className="w-full sm:max-w-md bg-white dark:bg-[#111118] border border-slate-300 dark:border-[#1e1e2a] rounded-xl p-6 sm:p-8 space-y-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-[#1e1e2a]">
              <div>
                <h3 className="text-xl font-semibold text-slate-700 dark:text-white tracking-tight">
                  Dispatch Rider
                </h3>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">
                  Order #{assignModalOrder.order_number || assignModalOrder.id} • <span className="font-medium text-slate-700 dark:text-slate-300">₹{assignModalOrder.total_amount}</span>
                </p>
              </div>
              <button
                onClick={() => setAssignModalOrder(null)}
                className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-[#1a1a26] text-slate-600 hover:text-slate-700 dark:hover:text-white rounded-full transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-widest pl-1">
                Active Riders ({riders.length})
              </p>

              {riders.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-[#1a1a26]/50 rounded-xl border border-dashed border-slate-300 dark:border-[#252530]">
                  <Bike className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-600">No riders available.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {riders.map((rider) => (
                    <button
                      key={rider.id}
                      disabled={assigning}
                      onClick={() => handleAssignRider(rider.id)}
                      className="w-full flex items-center justify-between p-3 bg-white dark:bg-[#111118] hover:bg-slate-50 dark:hover:bg-[#1a1a26] border border-slate-300 dark:border-[#252530] hover:border-[#4A7DFF] dark:hover:border-[#4A7DFF] rounded-xl transition-all group text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-[#252530] text-slate-600 dark:text-slate-400 group-hover:bg-[#4A7DFF] group-hover:text-white flex items-center justify-center transition-colors overflow-hidden shrink-0">
                          {rider.avatar ? (
                            <img src={rider.avatar} alt="Rider" className="w-full h-full object-cover" />
                          ) : (
                            <Bike size={20} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700 dark:text-white tracking-tight">
                            {rider.first_name || rider.username}
                          </p>
                          <p className="text-[11px] font-mono text-slate-600 mt-0.5">
                            {rider.phone_number}
                          </p>
                        </div>
                      </div>

                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#252530] group-hover:bg-[#4A7DFF]/10 text-slate-400 group-hover:text-[#4A7DFF] flex items-center justify-center transition-colors">
                        <ArrowRight size={16} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
  Loader2,
  Trash2,
} from "lucide-react";
import { getAccessToken, authFetch } from "@/lib/auth";
import { useAdmin } from "../layout";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function AdminOrdersPage() {
  const { playChime, setPendingCount, triggerIncomingOrderAlert } = useAdmin();
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedOrders, setExpandedOrders] = useState({});
  const [assignModalOrder, setAssignModalOrder] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  // Fetch orders and all users
  const fetchOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);

    try {
      const [ordersRes, usersRes] = await Promise.all([
        authFetch(`${API_URL}/api/v1/orders/`),
        authFetch(`${API_URL}/api/v1/users/`),
      ]);

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        const list = Array.isArray(data) ? data : (data?.results || []);
        setOrders(list);

        const pending = list.filter((o) => o.status === "PENDING" || o.status === "CONFIRMED");
        setPendingCount(pending.length);

        if (isSilent && list.length > orders.length) {
          const newOrder = list[0] || { id: "LIVE", order_number: "LIVE ORDER" };
          triggerIncomingOrderAlert(newOrder);
          toast.success("🚨 New Live Order Received!", { icon: "🔔" });
        }
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const list = Array.isArray(usersData) ? usersData : (usersData?.results || []);
        setUsers(list);
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

  // Fast customer & user lookup dictionary
  const usersMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      if (u.id) map[u.id] = u;
      if (u.username) map[u.username] = u;
      if (u.phone_number) map[u.phone_number] = u;
    });
    return map;
  }, [users]);

  // Dynamic customer extractor for orders
  const getCustomerDetails = useCallback((order) => {
    if (!order) return { name: "Valued Customer", phone: "" };

    // 1. If order.customer is already a populated object
    if (order.customer && typeof order.customer === "object") {
      const name = order.customer.first_name
        ? `${order.customer.first_name} ${order.customer.last_name || ""}`.trim()
        : (order.customer.username || order.customer_name || "Customer");
      const phone = order.customer.phone_number || order.customer.phone || "";
      return { name, phone };
    }

    // 2. Lookup in users list by customer ID or customer_name
    const matchedUser = usersMap[order.customer] || (order.customer_name ? usersMap[order.customer_name] : null);
    if (matchedUser) {
      const name = matchedUser.first_name
        ? `${matchedUser.first_name} ${matchedUser.last_name || ""}`.trim()
        : (matchedUser.username || order.customer_name || `Customer #${matchedUser.id}`);
      const phone = matchedUser.phone_number || "";
      return { name, phone };
    }

    // 3. Check direct order properties
    let name = order.customer_name || order.customer_username || "";
    let phone = order.customer_phone || order.phone_number || order.phone || "";

    // 4. If name looks like a phone number (e.g. 10-digit number like 9461877701)
    if (!phone && name && /^\+?[0-9]{10,12}$/.test(name.trim())) {
      phone = name.trim();
      name = `Customer (${phone})`;
    }

    // 5. Extract phone number embedded in delivery address string
    if (!phone && order.delivery_address) {
      const match = order.delivery_address.match(/(?:\+?91[\-\s]?)?([6-9]\d{9})/);
      if (match) {
        phone = match[1];
      }
    }

    return {
      name: name || (order.customer ? `Customer #${order.customer}` : "Valued Customer"),
      phone: phone || "",
    };
  }, [usersMap]);

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

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;
    setIsDeletingOrder(true);
    const orderId = orderToDelete.id;
    const orderNumber = orderToDelete.order_number || orderToDelete.id;

    try {
      const res = await authFetch(`${API_URL}/api/v1/orders/${orderId}/`, {
        method: "DELETE",
      });

      if (res.ok || res.status === 204) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        toast.success(`Order #${orderNumber} deleted successfully`);
        setOrderToDelete(null);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.detail || data.error || "Failed to delete order");
      }
    } catch (err) {
      console.error("Delete order error:", err);
      toast.error("Network error deleting order");
    } finally {
      setIsDeletingOrder(false);
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
          <div><b>Customer:</b> ${getCustomerDetails(order).name}</div>
          <div><b>Phone:</b> ${getCustomerDetails(order).phone || "N/A"}</div>
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
      const { name: custName, phone: custPhone } = getCustomerDetails(order);

      const matchesSearch =
        !q ||
        order.id?.toString().includes(q) ||
        (order.order_number && order.order_number.toLowerCase().includes(q)) ||
        (custName && custName.toLowerCase().includes(q)) ||
        (custPhone && custPhone.includes(q)) ||
        (order.delivery_address && order.delivery_address.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [orders, statusFilter, searchQuery, getCustomerDetails]);

  const pendingCountTotal = orders.filter((o) => o.status === "PENDING" || o.status === "CONFIRMED").length;
  const outForDeliveryCount = orders.filter((o) => o.status === "OUT_FOR_DELIVERY").length;
  const deliveredCount = orders.filter((o) => o.status === "DELIVERED").length;

  const statusConfig = {
    PENDING: {
      label: "Needs Packing",
      badge: "bg-transparent text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700/80",
      dot: "bg-amber-500",
    },
    CONFIRMED: {
      label: "Confirmed",
      badge: "bg-transparent text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700/80",
      dot: "bg-blue-500",
    },
    OUT_FOR_DELIVERY: {
      label: "On the Road",
      badge: "bg-transparent text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-700/80",
      dot: "bg-purple-500",
    },
    DELIVERED: {
      label: "Delivered",
      badge: "bg-transparent text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/80",
      dot: "bg-emerald-500",
    },
    UNDELIVERED: {
      label: "Undelivered",
      badge: "bg-transparent text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-700/80",
      dot: "bg-rose-500",
    },
    CANCELLED: {
      label: "Cancelled",
      badge: "bg-transparent text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-700/80",
      dot: "bg-rose-500",
    },
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 pb-20">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 dash-fade-up">
        <div>
          <h1 className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-300 dark:to-purple-400 bg-clip-text text-transparent drop-shadow-sm text-2xl sm:text-3xl font-extrabold flex items-center gap-2 tracking-tight">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm">
              <ShoppingBag className="text-white w-5 h-5" />
            </div>
            Dispatch
          </h1>
          <p className="text-sm font-medium text-slate-600 dark:text-zinc-300 mt-1 ml-[48px]">
            Manage live orders, assign riders, and communicate with customers
          </p>
        </div>

        <button
          onClick={() => fetchOrders(false)}
          disabled={refreshing}
          className="self-start sm:self-auto flex items-center gap-2 bg-white dark:bg-[#111118] border border-slate-200 dark:border-[#1e1e2a] px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-zinc-100 hover:border-blue-500 hover:text-blue-600 active:scale-95 transition-all cursor-pointer shadow-xs"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin text-blue-600" : "text-blue-600 dark:text-blue-400"} />
          <span>{refreshing ? "Syncing Orders..." : "Sync Latest"}</span>
        </button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col lg:flex-row gap-4 dash-fade-up dash-fade-up-d1">
        {/* Horizontal Tabs */}
        <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "ALL", label: "All Orders", count: orders.length, textColor: "text-slate-900 dark:text-white", countColor: "text-blue-600 dark:text-blue-400" },
            { id: "PENDING", label: "Needs Packing", count: pendingCountTotal, textColor: "text-amber-600 dark:text-amber-400", countColor: "text-amber-600 dark:text-amber-400" },
            { id: "OUT_FOR_DELIVERY", label: "Out for Delivery", count: outForDeliveryCount, textColor: "text-purple-600 dark:text-purple-400", countColor: "text-purple-600 dark:text-purple-400" },
            { id: "DELIVERED", label: "Delivered", count: deliveredCount, textColor: "text-emerald-600 dark:text-emerald-400", countColor: "text-emerald-600 dark:text-emerald-400" },
            { id: "CANCELLED", label: "Cancelled", textColor: "text-rose-600 dark:text-rose-400", countColor: "text-rose-600 dark:text-rose-400" },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  isActive
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm"
                    : `bg-white dark:bg-[#111118] ${tab.textColor} border-slate-200 dark:border-[#1e1e2a] hover:border-slate-300 dark:hover:border-[#2a2a38]`
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                      isActive
                        ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900"
                        : `${tab.countColor} bg-slate-100 dark:bg-[#1a1a26]`
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
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, Name, Phone..."
            className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-[#111118] border border-slate-200 dark:border-[#1e1e2a] rounded-lg text-xs text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all font-medium"
          />
        </div>
      </div>

      {/* ORDERS LIST */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 rounded-xl bg-white dark:bg-[#111118] flex items-center justify-center mb-4 border border-slate-200 dark:border-[#1e1e2a] shadow-xs">
            <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Fetching live orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-[#111118] rounded-xl p-16 text-center border border-slate-200 dark:border-[#1e1e2a] dash-fade-up dash-fade-up-d2">
          <div className="w-20 h-20 bg-white dark:bg-[#1a1a26] rounded-[24px] flex items-center justify-center mx-auto mb-5 rotate-3 border border-slate-200 dark:border-[#2a2a35]">
            <ShoppingBag className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-lg font-bold text-slate-800 dark:text-white">No active orders found</p>
          <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 mt-2 max-w-sm mx-auto">
            {searchQuery ? "Try a different search term or clear the filters" : "There are no orders matching this exact status right now."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5 dash-fade-up dash-fade-up-d2">
          {filteredOrders.map((order) => {
            const isExpanded = !!expandedOrders[order.id];
            const cfg = statusConfig[order.status] || {
              label: order.status,
              badge: "bg-transparent text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-[#252530]",
              dot: "bg-slate-400",
            };
            const isPending = order.status === "PENDING" || order.status === "CONFIRMED";
            const isOut = order.status === "OUT_FOR_DELIVERY";
            const { name: customerName, phone: customerPhone } = getCustomerDetails(order);
            const cleanPhone = customerPhone ? customerPhone.replace(/\D/g, "") : "";
            const displayPhone = cleanPhone
              ? (cleanPhone.length >= 10 ? `+91 ${cleanPhone.slice(-10)}` : cleanPhone)
              : (customerPhone || "No phone number");

            const isCOD = order.payment_method === "COD";

            return (
              <div
                key={order.id}
                className="bg-white dark:bg-[#111118] rounded-xl overflow-hidden flex flex-col justify-between transition-all group/card border border-slate-200 dark:border-[#1e1e2a] hover:border-slate-300 dark:hover:border-[#2a2a38] hover:shadow-md"
              >
                <div className="p-4 sm:p-5 pb-0 flex-1 flex flex-col relative z-10">
                  {/* HEADER ROW */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-extrabold text-base sm:text-lg text-blue-600 dark:text-blue-400 tracking-tight">
                          {order.order_number || `FIB-${order.id}`}
                        </span>
                        <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold tracking-wide uppercase ${cfg.badge}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />
                          {cfg.label}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
                        <span className="flex items-center gap-1.5 bg-transparent text-slate-600 dark:text-zinc-300 px-2 py-1 rounded-md border border-slate-200 dark:border-[#252530]">
                          <Clock size={12} className="text-blue-500 shrink-0" />
                          <span>
                            {order.created_at
                              ? new Date(order.created_at).toLocaleString([], {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })
                              : ""}
                          </span>
                        </span>
                        {order.delivery_slot && (
                          <span className="flex items-center gap-1.5 bg-transparent text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-md font-bold border border-slate-200 dark:border-[#252530]">
                            <Calendar size={12} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span>{order.delivery_slot}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                        ₹{parseFloat(order.total_amount || 0).toFixed(0)}
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-0.5 text-[10px] font-bold uppercase tracking-wider">
                        <span className={isCOD ? "text-purple-600 dark:text-purple-400 font-extrabold" : "text-emerald-600 dark:text-emerald-400 font-extrabold"}>
                          {isCOD ? "CASH" : "PAID"}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-blue-600 dark:text-blue-400 font-bold">
                          {(order.items || []).length} ITEMS
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CUSTOMER & DELIVERY INFO BLOCK */}
                  <div className="bg-white dark:bg-[#111118] rounded-xl p-3 mb-3 border border-slate-200 dark:border-[#252530]">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                          {customerName}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-mono mt-0.5 font-bold">
                          {displayPhone}
                        </p>
                      </div>
                      {cleanPhone && (
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${cleanPhone.length >= 10 ? `+91${cleanPhone.slice(-10)}` : cleanPhone}`}
                            className="w-8 h-8 rounded-md bg-white dark:bg-[#1a1a26] border border-slate-200 dark:border-[#2a2a35] flex items-center justify-center text-blue-600 dark:text-blue-400 hover:border-blue-400 hover:text-blue-700 transition-colors shadow-xs"
                            title={`Call ${customerName}`}
                          >
                            <Phone size={13} />
                          </a>
                          <a
                            href={`https://wa.me/91${cleanPhone.slice(-10)}?text=${encodeURIComponent(
                              `Hello ${customerName}! Your FreshInBasket order #${order.order_number || order.id} is being packed.`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="w-8 h-8 rounded-md bg-white dark:bg-[#1a1a26] border border-slate-200 dark:border-[#2a2a35] flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:border-emerald-400 hover:text-emerald-700 transition-colors shadow-xs"
                            title="Message on WhatsApp"
                          >
                            <MessageSquare size={13} />
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="flex items-start gap-2 text-[11px] font-medium text-slate-600 dark:text-zinc-300 leading-snug pt-2 border-t border-slate-100 dark:border-[#1e1e2a]">
                      <MapPin size={14} className="text-rose-500 shrink-0 mt-0.5" />
                      <span>{order.delivery_address || "Delivery address not provided."}</span>
                    </div>
                  </div>

                  {/* PRODUCT ITEMS */}
                  <div className="mb-4">
                    <button
                      onClick={() => toggleExpand(order.id)}
                      className="w-full flex items-center justify-between py-2 text-xs font-bold text-slate-800 dark:text-zinc-100 group/btn cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Package size={14} className="text-indigo-500 group-hover/btn:text-indigo-600 transition-colors" />
                        <span className="text-slate-800 dark:text-white">Package Contents</span>
                      </span>
                      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold transition-colors bg-white dark:bg-[#1a1a26] border border-slate-200 dark:border-[#252530] px-2.5 py-1 rounded-lg">
                        <span>{isExpanded ? "Hide" : "Expand"}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 space-y-2 border border-slate-200 dark:border-[#252530] rounded-xl p-2 bg-white dark:bg-[#111118]">
                        {(order.items || []).map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-3 p-2 rounded-lg bg-white dark:bg-[#1a1a26] border border-slate-200/80 dark:border-[#252530] hover:border-slate-300 dark:hover:border-[#2a2a38] transition-colors group/item"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-[#252530] flex items-center justify-center overflow-hidden shrink-0 border border-slate-200 dark:border-[#2a2a35]">
                                {item.product_image_url ? (
                                  <img 
                                    src={item.product_image_url} 
                                    alt={item.product_name || "Product"} 
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <ShoppingBag size={14} className="text-blue-500" />
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                                  {item.product_name || "Fresh Produce Item"}
                                </span>
                                <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
                                  {!isNaN(Number(item.quantity)) ? Number(item.quantity) : (item.quantity || 1)} × {item.unit_name || item.unit || item.product?.unit || item.product?.unit_name || "kg"}
                                </span>
                              </div>
                            </div>
                            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0">
                              ₹{(parseFloat(item.unit_price || item.price || 0) * (!isNaN(Number(item.quantity)) ? Number(item.quantity) : (parseFloat(item.quantity) || 1))).toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* BOTTOM ACTION BAR */}
                <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-[#1e1e2a] flex items-center gap-2 mt-auto bg-white dark:bg-[#111118]">
                  <button
                    onClick={() => handlePrintReceipt(order)}
                    title="Print Receipt"
                    className="w-10 h-10 shrink-0 bg-transparent border border-slate-200 dark:border-[#2a2a35] hover:border-blue-500 hover:text-blue-600 text-slate-600 dark:text-slate-300 rounded-md flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-xs"
                  >
                    <Printer size={16} />
                  </button>

                  <button
                    onClick={() => setOrderToDelete(order)}
                    title="Delete Order"
                    className="w-10 h-10 shrink-0 bg-transparent border border-slate-200 dark:border-[#2a2a35] hover:border-rose-400 dark:hover:border-rose-600 text-rose-500 hover:text-rose-600 dark:text-rose-400 rounded-md flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-xs"
                  >
                    <Trash2 size={16} />
                  </button>

                  {isPending && (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        onClick={() => updateOrderStatus(order.id, "CONFIRMED")}
                        className="flex-1 px-3 py-2.5 bg-white dark:bg-[#1a1a26] border border-blue-300 dark:border-blue-700/80 text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-[#252530] rounded-md text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <CheckCircle2 size={14} className="text-blue-600 dark:text-blue-400" />
                        <span>Confirm</span>
                      </button>

                      <button
                        onClick={() => setAssignModalOrder(order)}
                        className="flex-1 px-3 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-md text-xs font-bold shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Bike size={14} />
                        <span>Assign Rider</span>
                      </button>
                    </div>
                  )}

                  {isOut && (
                    <button
                      onClick={() => updateOrderStatus(order.id, "DELIVERED")}
                      className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
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
                      className="px-3 py-2.5 text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-white dark:bg-[#1a1a26] border border-slate-200 dark:border-[#252530] hover:border-rose-300 dark:hover:border-rose-800 rounded-md text-[11px] font-bold transition-all active:scale-95 shrink-0 cursor-pointer shadow-xs"
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
                <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Dispatch Rider
                </h3>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">
                  Order <span className="text-blue-600 dark:text-blue-400 font-bold">#{assignModalOrder.order_number || assignModalOrder.id}</span> • <span className="font-extrabold text-emerald-600 dark:text-emerald-400">₹{assignModalOrder.total_amount}</span>
                </p>
              </div>
              <button
                onClick={() => setAssignModalOrder(null)}
                className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-[#1a1a26] text-slate-600 hover:text-slate-900 dark:hover:text-white rounded-full transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">
                Active Riders ({riders.length})
              </p>

              {riders.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-[#1a1a26]/50 rounded-xl border border-dashed border-slate-200 dark:border-[#252530]">
                  <Bike className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">No riders available.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {riders.map((rider) => (
                    <button
                      key={rider.id}
                      disabled={assigning}
                      onClick={() => handleAssignRider(rider.id)}
                      className="w-full flex items-center justify-between p-3 bg-white dark:bg-[#111118] hover:bg-slate-50 dark:hover:bg-[#1a1a26] border border-slate-200 dark:border-[#252530] hover:border-slate-300 dark:hover:border-slate-700 rounded-xl transition-all group text-left cursor-pointer shadow-xs"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-slate-50 dark:bg-[#1a1a26] text-blue-600 dark:text-blue-400 flex items-center justify-center transition-colors overflow-hidden shrink-0 border border-slate-200 dark:border-[#2a2a35]">
                          {rider.avatar ? (
                            <img src={rider.avatar} alt="Rider" className="w-full h-full object-cover" />
                          ) : (
                            <Bike size={20} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {rider.first_name || rider.username}
                          </p>
                          <p className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                            {rider.phone_number || "No phone registered"}
                          </p>
                        </div>
                      </div>

                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#252530] text-slate-400 group-hover:text-blue-600 flex items-center justify-center transition-colors">
                        <ArrowRight size={15} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE ORDER CONFIRMATION MODAL */}
      {orderToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 transition-all animate-in fade-in duration-150"
          onClick={() => setOrderToDelete(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#111118] border border-slate-200 dark:border-[#252530] rounded-2xl p-6 sm:p-7 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-transparent text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/80 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Delete Order #{orderToDelete.order_number || orderToDelete.id}?
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Are you sure you want to permanently delete this order for{" "}
                <span className="font-bold text-slate-700 dark:text-zinc-200">
                  {getCustomerDetails(orderToDelete).name}
                </span>{" "}
                (₹{parseFloat(orderToDelete.total_amount || 0).toFixed(0)})? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingOrder}
                onClick={() => setOrderToDelete(null)}
                className="flex-1 py-2.5 px-4 bg-transparent border border-slate-200 dark:border-[#252530] hover:border-slate-300 text-slate-700 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingOrder}
                onClick={handleDeleteOrder}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                {isDeletingOrder ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Delete Order</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

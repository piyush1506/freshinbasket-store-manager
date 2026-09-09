"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Bike,
  Phone,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  Search,
  DollarSign,
  ShieldCheck,
  Package,
  Plus,
  UserPlus,
  X,
  AlertCircle,
  Truck,
  ClipboardList,
  UserCheck,
  CreditCard,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ShoppingBag,
  Calendar,
} from "lucide-react";
import { getAccessToken } from "@/lib/auth";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

function RiderAssignedOrdersList({ assignments = [], orders = [] }) {
  const scrollContainerRef = useRef(null);
  const ongoing = assignments.filter((a) => !a.delivered_at);

  const handleScroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === "up" ? -60 : 60;
      scrollContainerRef.current.scrollBy({ top: scrollAmount, behavior: "smooth" });
    }
  };

  if (ongoing.length === 0) return null;

  return (
    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
          <span>Active In-Transit Orders</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-[10px] font-bold">
            {ongoing.length}
          </span>
        </p>

        {/* Up / Down Scroll Buttons */}
        {ongoing.length > 2 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleScroll("up")}
              className="p-1 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors shadow-xs cursor-pointer"
              title="Scroll Up"
              aria-label="Scroll Up"
            >
              <ChevronUp size={13} />
            </button>
            <button
              type="button"
              onClick={() => handleScroll("down")}
              className="p-1 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors shadow-xs cursor-pointer"
              title="Scroll Down"
              aria-label="Scroll Down"
            >
              <ChevronDown size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Capped scrollable order list */}
      <div
        ref={scrollContainerRef}
        className="max-h-36 overflow-y-auto pr-1 space-y-1.5 scroll-smooth overscroll-contain rounded-lg border border-slate-200 dark:border-zinc-800 p-1.5 bg-slate-50/70 dark:bg-zinc-950/40"
        style={{ scrollbarWidth: "thin" }}
      >
        {ongoing.map((a, idx) => {
          const orderObj = typeof a.order === "object" ? a.order : orders.find((o) => o.id === a.order);
          return (
            <div
              key={idx}
              className="flex items-center justify-between p-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-md text-xs shadow-2xs hover:border-slate-300 dark:hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 flex items-center justify-center shrink-0">
                  <Package size={13} />
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-slate-800 dark:text-zinc-100 block text-xs truncate">
                    Order #{orderObj?.order_number || orderObj?.id || a.order}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium block truncate">
                    ₹{orderObj?.total_amount || 0} • {orderObj?.payment_method || "COD"}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 px-2 py-0.5 rounded shrink-0">
                In Transit
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminRidersPage({ defaultTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const isDeliveriesRoute = pathname?.includes("/deliveries");
  const computedInitialTab =
    defaultTab ||
    (isDeliveriesRoute ? "assignments" : searchParams.get("tab") === "assignments" ? "assignments" : "boys");
  
  const [activeTab, setActiveTab] = useState(computedInitialTab);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    } else if (isDeliveriesRoute) {
      setActiveTab("assignments");
    } else if (searchParams.get("tab")) {
      setActiveTab(searchParams.get("tab") === "assignments" ? "assignments" : "boys");
    }
  }, [defaultTab, isDeliveriesRoute, searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "boys" && pathname !== "/riders") {
      router.push("/riders");
    } else if (tab === "assignments" && pathname !== "/deliveries") {
      router.push("/deliveries");
    }
  };
  const [allUsers, setAllUsers] = useState([]);
  const [riders, setRiders] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedOrders, setExpandedOrders] = useState({});
  const [orderDrafts, setOrderDrafts] = useState({});
  const [savingOrders, setSavingOrders] = useState({});

  const toggleExpandOrder = (id) => {
    setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Modal states
  const [showAddRiderModal, setShowAddRiderModal] = useState(false);
  const [newRiderData, setNewRiderData] = useState({
    username: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    password: "",
  });
  const [submittingRider, setSubmittingRider] = useState(false);

  // Reassign Modal State
  const [assignModalOrder, setAssignModalOrder] = useState(null);
  const [assigning, setAssigning] = useState(false);

  const fetchData = async () => {
    setRefreshing(true);
    const token = getAccessToken();

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const [ridersRes, assignRes, ordersRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/users/`, { headers }),
        fetch(`${API_URL}/api/v1/deliveries/`, { headers }),
        fetch(`${API_URL}/api/v1/orders/`, { headers }),
      ]);

      if (ridersRes.ok) {
        const rData = await ridersRes.json();
        const usersList = Array.isArray(rData) ? rData : (rData?.results || []);
        setAllUsers(usersList);
        setRiders(usersList.filter((u) => u.role === "DELIVERY"));
      }
      if (assignRes.ok) {
        const aData = await assignRes.json();
        setAssignments(Array.isArray(aData) ? aData : []);
      }
      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        setOrders(Array.isArray(oData) ? oData : (oData?.results || []));
      }
    } catch {
      toast.error("Failed to load delivery fleet and assignments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle create new Delivery Boy
  const handleCreateRider = async (e) => {
    e.preventDefault();
    if (!newRiderData.username || !newRiderData.password || !newRiderData.phone_number) {
      toast.error("Username, Phone number, and Password are required");
      return;
    }

    setSubmittingRider(true);
    const token = getAccessToken();

    try {
      const res = await fetch(`${API_URL}/api/v1/users/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newRiderData,
          role: "DELIVERY",
        }),
      });

      if (res.ok) {
        toast.success("Delivery Boy registered successfully!");
        setShowAddRiderModal(false);
        setNewRiderData({ username: "", first_name: "", last_name: "", phone_number: "", password: "" });
        fetchData();
      } else {
        const errData = await res.json().catch(() => ({}));
        const errStr = Object.values(errData).flat().join(", ") || "Failed to register delivery boy";
        toast.error(errStr);
      }
    } catch {
      toast.error("Network error while creating delivery boy");
    } finally {
      setSubmittingRider(false);
    }
  };

  // Assign or Reassign Rider to an Order
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
        await fetch(`${API_URL}/api/v1/orders/${assignModalOrder.id}/update_status/`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "OUT_FOR_DELIVERY" }),
        });

        toast.success("Rider assigned & order dispatched!");
        setAssignModalOrder(null);
        fetchData();
      } else {
        toast.error("Failed to assign rider");
      }
    } catch {
      toast.error("Network error assigning rider");
    } finally {
      setAssigning(false);
    }
  };

  // Save both status and delivery boy for an order
  const handleSaveOrderChanges = async (orderId, assignmentId, newStatus, newRiderId, hasStatusChanged, hasRiderChanged) => {
    const token = getAccessToken();
    setSavingOrders((prev) => ({ ...prev, [orderId]: true }));

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      if (hasRiderChanged && newRiderId) {
        const assignRes = await fetch(`${API_URL}/api/v1/deliveries/`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            order: orderId,
            delivery_boy: newRiderId,
          }),
        });
        if (!assignRes.ok) {
          throw new Error("Failed to assign delivery boy");
        }
      }

      if (hasStatusChanged) {
        const statusRes = await fetch(
          `${API_URL}/api/v1/orders/${orderId}/update_status/`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ status: newStatus }),
          }
        );
        if (!statusRes.ok) {
          throw new Error("Failed to update status");
        }
        if (newStatus === "DELIVERED" && assignmentId) {
          await fetch(`${API_URL}/api/v1/deliveries/${assignmentId}/`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ delivered_at: new Date().toISOString() }),
          }).catch(() => {});
        }
      }

      toast.success("Dispatch updates saved successfully!");
      setOrderDrafts((prev) => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });
      await fetchData();
    } catch (err) {
      toast.error(err.message || "Network error while saving changes");
    } finally {
      setSavingOrders((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  // Helper calculations for riders
  const getRiderStats = (riderId) => {
    const riderAssignments = assignments.filter(
      (a) => a.delivery_boy?.id === riderId || a.delivery_boy === riderId
    );

    let pendingCOD = 0;
    let collectedCOD = 0;
    let ongoingCount = 0;
    let completedCount = 0;

    riderAssignments.forEach((a) => {
      const orderObj = typeof a.order === "object" ? a.order : orders.find((o) => o.id === a.order);
      const amount = Number(orderObj?.total_amount || 0);
      const isCOD = orderObj?.payment_method === "COD" || !orderObj?.is_paid;
      const isDelivered = Boolean(a.delivered_at) || orderObj?.status === "DELIVERED";

      if (isDelivered) {
        completedCount += 1;
        if (isCOD) collectedCOD += amount;
      } else {
        ongoingCount += 1;
        if (isCOD) pendingCOD += amount;
      }
    });

    return {
      riderAssignments,
      ongoingCount,
      completedCount,
      pendingCOD,
      collectedCOD,
      totalCOD: pendingCOD + collectedCOD,
    };
  };

  // Filter riders
  const filteredRiders = riders.filter((rider) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      rider.username?.toLowerCase().includes(q) ||
      rider.first_name?.toLowerCase().includes(q) ||
      rider.phone_number?.includes(q)
    );
  });

  // Merge assignments with orders for the Delivery Assignments tab
  const allDispatches = orders.map((order) => {
    const assignment = assignments.find(
      (a) => (a.order?.id || a.order) === order.id
    );
    const assignedRider = assignment
      ? typeof assignment.delivery_boy === "object"
        ? assignment.delivery_boy
        : riders.find((r) => r.id === assignment.delivery_boy)
      : null;

    const customerObj = typeof order.customer === "object"
      ? order.customer
      : allUsers.find((u) => u.id === order.customer);

    const customerUsername = order.customer_name || customerObj?.username || customerObj?.first_name || (typeof order.customer === "string" ? order.customer : "");
    const customerPhone = customerObj?.phone_number || (customerUsername && String(customerUsername).match(/^\d{10}$/) ? customerUsername : (order.phone_number || ""));

    return {
      order,
      assignment,
      rider: assignedRider,
      customerObj,
      customerUsername: customerUsername || "User",
      customerPhone: customerPhone || "",
      isAssigned: Boolean(assignment),
      status: order.status,
    };
  });

  // Filter Dispatches
  const filteredDispatches = allDispatches.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      String(item.order.id).includes(q) ||
      item.order.order_number?.toLowerCase().includes(q) ||
      item.customerUsername?.toLowerCase().includes(q) ||
      item.customerPhone?.includes(q) ||
      item.order.delivery_address?.toLowerCase().includes(q) ||
      item.rider?.username?.toLowerCase().includes(q) ||
      item.rider?.first_name?.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (statusFilter === "OUT_FOR_DELIVERY") {
      return item.order.status === "OUT_FOR_DELIVERY" || (item.isAssigned && !item.assignment?.delivered_at);
    }
    if (statusFilter === "DELIVERED") {
      return item.order.status === "DELIVERED" || Boolean(item.assignment?.delivered_at);
    }
    if (statusFilter === "UNASSIGNED") {
      return !item.isAssigned && item.order.status !== "DELIVERED" && item.order.status !== "CANCELLED";
    }

    return true;
  });

  const totalRidersCount = riders.length;
  const activeDispatchesCount = assignments.filter((a) => !a.delivered_at).length;
  const completedDispatchesCount = assignments.filter((a) => a.delivered_at).length;
  
  let globalPendingCOD = 0;
  let globalCollectedCOD = 0;

  assignments.forEach((a) => {
    const orderObj = typeof a.order === "object" ? a.order : orders.find((o) => o.id === a.order);
    const amount = Number(orderObj?.total_amount || 0);
    const isCOD = orderObj?.payment_method === "COD" || !orderObj?.is_paid;
    if (isCOD) {
      if (a.delivered_at || orderObj?.status === "DELIVERED") {
        globalCollectedCOD += amount;
      } else {
        globalPendingCOD += amount;
      }
    }
  });

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12">
      {/* TOP HEADER */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 flex items-center justify-center border border-slate-300 dark:border-zinc-700">
              {activeTab === "boys" ? <Bike size={22} /> : <ClipboardList size={22} />}
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent drop-shadow-sm text-xl sm:text-2xl font-semibold tracking-tight">
                {activeTab === "boys" ? "Delivery Fleet & Boys" : "Order Delivery Assignments"}
              </h1>
              <p className="text-xs font-medium text-gray-700 dark:text-zinc-300 mt-0.5">
                {activeTab === "boys"
                  ? "Manage registered delivery boys, track cash collections, and monitor active orders"
                  : "Assign delivery boys to orders, update live delivery progress, and manage route dispatches"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {activeTab === "boys" ? (
            <button
              onClick={() => setShowAddRiderModal(true)}
              className="flex items-center gap-2 bg-slate-700 dark:bg-zinc-100 hover:bg-gray-700 text-white dark:text-slate-900 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <UserPlus size={16} />
              <span>Add Delivery Boy</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAddRiderModal(true)}
              className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-300 dark:border-zinc-700 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-200 shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <UserPlus size={15} />
              <span>+ Rider</span>
            </button>
          )}

          <button
            onClick={fetchData}
            disabled={refreshing}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-300 dark:border-zinc-700 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-200 active:scale-95 transition-all cursor-pointer"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin text-slate-700 dark:text-zinc-200" : "text-gray-700 dark:text-zinc-300"} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 p-4 rounded-xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200 uppercase tracking-wider">
              Total Delivery Fleet
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 flex items-center justify-center border border-slate-300 dark:border-zinc-700">
              <Bike size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-700 dark:text-white mt-2">
            {totalRidersCount}
          </p>
          <span className="text-[11px] text-gray-700 dark:text-zinc-300 font-medium mt-1 inline-block">
            Registered riders
          </span>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 p-4 rounded-xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200 uppercase tracking-wider">
              Active Dispatches
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 flex items-center justify-center border border-slate-300 dark:border-zinc-700">
              <Truck size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-700 dark:text-white mt-2">
            {activeDispatchesCount}
          </p>
          <span className="text-[11px] text-gray-700 dark:text-zinc-300 font-medium mt-1 inline-block">
            Currently on road
          </span>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 p-4 rounded-xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200 uppercase tracking-wider">
              Pending COD Cash
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 flex items-center justify-center border border-slate-300 dark:border-zinc-700">
              <DollarSign size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-700 dark:text-white mt-2">
            ₹{globalPendingCOD.toLocaleString("en-IN")}
          </p>
          <span className="text-[11px] text-gray-700 dark:text-zinc-300 font-medium mt-1 inline-block">
            To collect from customers
          </span>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 p-4 rounded-xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200 uppercase tracking-wider">
              Collected COD Total
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 flex items-center justify-center border border-slate-300 dark:border-zinc-700">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-700 dark:text-white mt-2">
            ₹{globalCollectedCOD.toLocaleString("en-IN")}
          </p>
          <span className="text-[11px] text-gray-700 dark:text-zinc-300 font-medium mt-1 inline-block">
            Collected on delivered orders
          </span>
        </div>
      </div>

      {/* NAVIGATION TABS & SEARCH BAR */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl p-3 shadow-sm space-y-3">
        <div className="flex items-center gap-2 p-1 bg-slate-200/90 dark:bg-zinc-800 rounded-lg">
          <button
            onClick={() => handleTabChange("boys")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "boys"
                ? "bg-white dark:bg-zinc-900 text-slate-700 dark:text-white shadow-sm"
                : "text-slate-700 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <Bike size={16} />
            <span>Delivery Boys ({riders.length})</span>
          </button>

          <button
            onClick={() => handleTabChange("assignments")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "assignments"
                ? "bg-white dark:bg-zinc-900 text-slate-700 dark:text-white shadow-sm"
                : "text-slate-700 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <ClipboardList size={16} />
            <span>Order Assignments ({allDispatches.length})</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-1">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-700 dark:text-zinc-300 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === "boys"
                  ? "Search delivery boy by name or phone..."
                  : "Search dispatches by Order #, Rider, or Customer..."
              }
              className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-600 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-slate-500/40 font-medium"
            />
          </div>

          {activeTab === "assignments" && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: "ALL", label: "All Dispatches" },
                { id: "OUT_FOR_DELIVERY", label: "In Transit" },
                { id: "DELIVERED", label: "Delivered" },
                { id: "UNASSIGNED", label: "Unassigned" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 transition-all cursor-pointer ${
                    statusFilter === f.id
                      ? "bg-slate-700 dark:bg-zinc-100 text-white dark:text-slate-900 shadow-sm"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700 hover:bg-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: DELIVERY BOYS */}
      {activeTab === "boys" && (
        <>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-zinc-900 rounded-xl border border-slate-300 dark:border-zinc-800">
              <RefreshCw className="w-8 h-8 text-slate-700 dark:text-zinc-300 animate-spin mb-3" />
              <p className="text-xs text-slate-700 dark:text-zinc-200 font-semibold">Loading delivery fleet...</p>
            </div>
          ) : filteredRiders.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-12 text-center border border-slate-300 dark:border-zinc-800 space-y-3 shadow-sm">
              <div className="w-14 h-14 bg-slate-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center mx-auto text-slate-700 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700">
                <Bike className="w-8 h-8" />
              </div>
              <p className="text-base font-semibold text-slate-900 dark:text-white">No Delivery Boys Found</p>
              <p className="text-xs text-slate-800 dark:text-zinc-200 max-w-sm mx-auto font-medium">
                Click "+ Add Delivery Boy" above to register a new rider account for your fleet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRiders.map((rider) => {
                const stats = getRiderStats(rider.id);
                const cleanPhone = rider.phone_number?.replace(/\D/g, "");

                return (
                  <div
                    key={rider.id}
                    className="bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-sm hover:shadow-md hover:border-slate-400 dark:hover:border-zinc-700 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 flex items-center justify-center font-normal text-base border border-slate-300 dark:border-zinc-700">
                          <Bike size={22} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-base text-slate-700 dark:text-white">
                              {rider.first_name || rider.username}
                            </h3>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-700 dark:bg-zinc-300 animate-pulse" />
                              Active Rider
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-zinc-200 font-medium mt-0.5">
                            @{rider.username} • {rider.phone_number || "No Phone"}
                          </p>
                        </div>
                      </div>

                      {cleanPhone && (
                        <a
                          href={`tel:${cleanPhone}`}
                          className="p-2 bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded-lg hover:bg-slate-200 transition-colors shadow-sm"
                          title="Call Rider"
                        >
                          <Phone size={16} />
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-zinc-800/80 rounded-lg border border-slate-300 dark:border-zinc-700 text-xs">
                      <div>
                        <span className="text-slate-800 dark:text-zinc-200 block text-[10px] uppercase font-bold tracking-wider">
                          Pending COD Cash
                        </span>
                        <span className="font-bold text-slate-700 dark:text-white text-base">
                          ₹{stats.pendingCOD.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-800 dark:text-zinc-200 block text-[10px] uppercase font-bold tracking-wider">
                          Collected COD Total
                        </span>
                        <span className="font-bold text-slate-700 dark:text-white text-base">
                          ₹{stats.collectedCOD.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-50 dark:bg-zinc-800/60 border border-slate-300 dark:border-zinc-700 rounded-lg flex items-center justify-between">
                        <span className="text-slate-800 dark:text-zinc-200 text-[11px] font-semibold">On-Road:</span>
                        <span className="font-bold text-slate-700 dark:text-white text-sm">{stats.ongoingCount} orders</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 dark:bg-zinc-800/60 border border-slate-300 dark:border-zinc-700 rounded-lg flex items-center justify-between">
                        <span className="text-slate-800 dark:text-zinc-200 text-[11px] font-semibold">Completed:</span>
                        <span className="font-bold text-slate-700 dark:text-white text-sm">{stats.completedCount} orders</span>
                      </div>
                    </div>

                    <RiderAssignedOrdersList
                      assignments={stats.riderAssignments}
                      orders={orders}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: ORDER DELIVERY ASSIGNMENTS */}
      {activeTab === "assignments" && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-zinc-900 rounded-xl border border-slate-300 dark:border-zinc-800">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
              <p className="text-xs text-slate-700 dark:text-zinc-200 font-semibold">Loading delivery assignments...</p>
            </div>
          ) : filteredDispatches.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-12 text-center border border-slate-300 dark:border-zinc-800 space-y-3 shadow-sm">
              <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl flex items-center justify-center mx-auto text-indigo-600">
                <ClipboardList className="w-8 h-8" />
              </div>
              <p className="text-base font-semibold text-slate-700 dark:text-white">No Dispatches Found</p>
              <p className="text-xs text-slate-800 dark:text-zinc-200 font-medium">
                No orders match your search or filter criteria.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDispatches.map(({ order, assignment, rider, isAssigned, status, customerUsername, customerPhone }) => {
                const isDelivered = status === "DELIVERED" || Boolean(assignment?.delivered_at);
                const isCOD = order.payment_method === "COD" || !order.is_paid;
                const isExpanded = Boolean(expandedOrders[order.id]);
                const items = order.items || [];
                const cleanPhone = customerPhone?.replace(/\D/g, "");

                return (
                  <div
                    key={order.id}
                    className={`bg-white dark:bg-zinc-900 border rounded-xl overflow-hidden shadow-sm transition-all ${
                      isExpanded
                        ? "border-indigo-400 dark:border-indigo-500/60 ring-1 ring-indigo-500/20 shadow-md"
                        : "border-slate-300 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1 min-w-[240px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => toggleExpandOrder(order.id)}
                            className="font-bold text-sm sm:text-base text-slate-800 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 transition-colors cursor-pointer text-left"
                            title="Click to view order details & items"
                          >
                            <span>Order #{order.order_number || order.id}</span>
                          </button>

                          {isDelivered ? (
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <CheckCircle2 size={13} />
                              Delivered
                            </span>
                          ) : (
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                status === "OUT_FOR_DELIVERY"
                                  ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60"
                                  : status === "CONFIRMED"
                                  ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60"
                                  : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-slate-300 dark:border-zinc-700"
                              }`}
                            >
                              <Truck size={13} />
                              {status === "OUT_FOR_DELIVERY" ? "In Transit" : status}
                            </span>
                          )}

                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border-slate-300 dark:border-zinc-700">
                            {isCOD ? `COD • ₹${order.total_amount}` : `Prepaid • ₹${order.total_amount}`}
                          </span>

                          <button
                            type="button"
                            onClick={() => toggleExpandOrder(order.id)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer active:scale-95 ${
                              isExpanded
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 border-slate-300 dark:border-zinc-700"
                            }`}
                            title={isExpanded ? "Hide items" : "Click to view items & quantities"}
                          >
                            <Package size={13} className={isExpanded ? "text-indigo-600 dark:text-indigo-400" : ""} />
                            <span>{items.length} {items.length === 1 ? "Item" : "Items"}</span>
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </div>

                        <p className="text-xs text-slate-700 dark:text-zinc-200 font-medium flex items-center gap-2 flex-wrap">
                          <span>
                            User: <span className="font-bold text-slate-800 dark:text-white">{customerUsername}</span>
                          </span>
                          {customerPhone && (
                            <span className="flex items-center gap-1 font-mono font-bold text-slate-700 dark:text-zinc-200">
                              • {customerPhone}
                              {cleanPhone && (
                                <a
                                  href={`tel:${cleanPhone}`}
                                  className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-500"
                                  title="Call Customer"
                                >
                                  <Phone size={12} />
                                </a>
                              )}
                            </span>
                          )}
                        </p>

                        <p className="text-xs text-slate-600 dark:text-zinc-300 flex items-center gap-1 font-medium">
                          <MapPin size={13} className="shrink-0 text-slate-500 dark:text-zinc-400" />
                          <span className="truncate">{order.delivery_address || order.address || "No address provided"}</span>
                        </p>
                      </div>

                      {/* CONTROLS (STATUS + RIDER ASSIGNMENT + SAVE BUTTON) */}
                      {(() => {
                        const currentStatus = orderDrafts[order.id]?.status !== undefined ? orderDrafts[order.id].status : status;
                        const originalRiderId = rider?.id ? String(rider.id) : "";
                        const currentRiderId = orderDrafts[order.id]?.riderId !== undefined ? orderDrafts[order.id].riderId : originalRiderId;
                        const hasStatusChanged = orderDrafts[order.id]?.status !== undefined && orderDrafts[order.id].status !== status;
                        const hasRiderChanged = orderDrafts[order.id]?.riderId !== undefined && orderDrafts[order.id].riderId !== originalRiderId;
                        const hasChanges = hasStatusChanged || hasRiderChanged;
                        const isSaving = Boolean(savingOrders[order.id]);

                        return (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                            {/* STATUS CONTROL */}
                            <div className="space-y-1 w-full sm:w-auto">
                              <label className="block text-[10px] font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wider">
                                Order Status
                              </label>
                              {isDelivered ? (
                                <div className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-1.5">
                                  <CheckCircle2 size={14} />
                                  Delivered
                                </div>
                              ) : (
                                <select
                                  disabled={isDelivered || isSaving}
                                  value={currentStatus}
                                  onChange={(e) => {
                                    setOrderDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        ...prev[order.id],
                                        status: e.target.value,
                                        riderId: prev[order.id]?.riderId !== undefined ? prev[order.id].riderId : originalRiderId,
                                      },
                                    }));
                                  }}
                                  className={`w-full sm:w-40 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                    hasStatusChanged
                                      ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-200 ring-1 ring-amber-400/50"
                                      : "bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 border-slate-300 dark:border-zinc-700 hover:border-slate-500"
                                  }`}
                                >
                                  <option value="PENDING">Pending</option>
                                  <option value="CONFIRMED">Confirmed</option>
                                  <option value="OUT_FOR_DELIVERY">In Transit (Out for Delivery)</option>
                                  <option value="DELIVERED">Delivered</option>
                                  <option value="CANCELLED">Cancelled</option>
                                </select>
                              )}
                            </div>

                            {/* RIDER SELECTION DROPDOWN */}
                            <div className="space-y-1 w-full sm:w-auto">
                              <label className="block text-[10px] font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wider">
                                Assigned Delivery Boy
                              </label>
                              <select
                                disabled={isDelivered || isSaving}
                                value={currentRiderId}
                                onChange={(e) => {
                                  setOrderDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: {
                                      ...prev[order.id],
                                      riderId: e.target.value,
                                      status: prev[order.id]?.status !== undefined ? prev[order.id].status : status,
                                    },
                                  }));
                                }}
                                className={`w-full sm:w-44 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                  isDelivered
                                    ? "bg-slate-100 dark:bg-zinc-800/90 text-slate-500 dark:text-zinc-400 border-slate-300 dark:border-zinc-700 cursor-not-allowed"
                                    : hasRiderChanged
                                    ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-200 ring-1 ring-amber-400/50 cursor-pointer"
                                    : "bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 border-slate-300 dark:border-zinc-700 hover:border-slate-500 cursor-pointer"
                                }`}
                              >
                                <option value="">-- Select Rider --</option>
                                {riders.map((r) => (
                                  <option key={r.id} value={String(r.id)}>
                                    {r.first_name || r.username} ({r.phone_number || "No Phone"})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* SAVE BUTTON */}
                            <div className="space-y-1 w-full sm:w-auto self-end">
                              <label className="block text-[10px] font-bold text-transparent select-none uppercase tracking-wider hidden sm:block">
                                Action
                              </label>
                              <button
                                type="button"
                                disabled={!hasChanges || isSaving || isDelivered}
                                onClick={() => handleSaveOrderChanges(order.id, assignment?.id, currentStatus, currentRiderId, hasStatusChanged, hasRiderChanged)}
                                className={`w-full sm:w-auto px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-95 ${
                                  hasChanges && !isSaving
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer ring-2 ring-emerald-500/30 shadow-md font-bold"
                                    : "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-zinc-700 cursor-not-allowed opacity-70"
                                }`}
                                title={hasChanges ? "Click to save changes" : "No unsaved changes"}
                              >
                                {isSaving ? (
                                  <>
                                    <RefreshCw size={13} className="animate-spin" />
                                    <span>Saving...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 size={13} />
                                    <span>Save</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* EXPANDED ORDER ITEMS & DETAILS DRAWER */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/40 p-4 sm:p-5 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-zinc-800">
                          <div className="flex items-center gap-2">
                            <Package size={16} className="text-indigo-600 dark:text-indigo-400" />
                            <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-100 uppercase tracking-wider">
                              Package Items & Quantities ({items.length})
                            </h4>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-zinc-400 font-medium">
                            {order.created_at && (
                              <span className="flex items-center gap-1">
                                <Clock size={12} className="text-slate-500" />
                                {new Date(order.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                              </span>
                            )}
                            {order.delivery_slot && (
                              <span className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold">
                                <Calendar size={11} />
                                {order.delivery_slot}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* ITEMS GRID */}
                        {items.length === 0 ? (
                          <p className="text-xs text-slate-500 italic py-2">
                            No individual product item breakdown available for this order.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {items.map((item, idx) => {
                              const itemName = item.product_name || item.product?.name || item.name || "Item";
                              const itemImg = item.product_image_url || item.product?.image_url || item.image;
                              const rawQty = item.quantity;
                              const itemQty = !isNaN(Number(rawQty)) ? Number(rawQty) : (rawQty || 1);
                              const itemUnit = item.unit_name || item.unit || item.product?.unit || item.product?.unit_name || "kg";
                              const unitPrice = parseFloat(item.unit_price || item.price || 0);
                              const itemTotal = parseFloat(item.total_price || unitPrice * Number(itemQty) || 0);

                              return (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between gap-3 p-2.5 bg-white dark:bg-zinc-800/90 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-2xs hover:border-slate-300 dark:hover:border-zinc-600 transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-zinc-700 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200 dark:border-zinc-600">
                                      {itemImg ? (
                                        <img
                                          src={itemImg}
                                          alt={itemName}
                                          className="w-full h-full object-cover"
                                          loading="lazy"
                                        />
                                      ) : (
                                        <ShoppingBag size={18} className="text-slate-400" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-slate-800 dark:text-zinc-100 text-xs truncate" title={itemName}>
                                        {itemName}
                                      </p>
                                      <p className="text-[11px] text-slate-600 dark:text-zinc-300 font-semibold mt-0.5">
                                        Qty: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{itemQty} × {itemUnit}</span>
                                      </p>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <p className="font-bold text-slate-800 dark:text-zinc-100 text-xs">
                                      ₹{itemTotal.toFixed(0)}
                                    </p>
                                    {unitPrice > 0 && (
                                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                                        ₹{unitPrice.toFixed(0)}/{itemUnit}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* SUMMARY FOOTER */}
                        <div className="pt-2 flex flex-wrap items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300 gap-2 border-t border-slate-200 dark:border-zinc-800">
                          <span className="text-slate-600 dark:text-zinc-400">
                            Delivery Address: <span className="font-bold text-slate-800 dark:text-zinc-200">{order.delivery_address || order.address || "N/A"}</span>
                          </span>
                          <div className="flex items-center gap-3">
                            <span>
                              Payment: <span className="font-bold text-slate-800 dark:text-zinc-200">{order.payment_method === "COD" ? "Cash on Delivery" : "Paid Online"}</span>
                            </span>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                              Total: ₹{order.total_amount || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD NEW DELIVERY BOY */}
      {showAddRiderModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowAddRiderModal(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <h3 className="text-lg font-semibold text-slate-700 dark:text-white flex items-center gap-2">
                <UserPlus size={20} className="text-indigo-600 dark:text-indigo-400" />
                Register New Delivery Boy
              </h3>
              <button
                onClick={() => setShowAddRiderModal(false)}
                className="p-1.5 text-slate-700 hover:text-slate-950 dark:hover:text-white rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRider} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-200 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  value={newRiderData.username}
                  onChange={(e) => setNewRiderData({ ...newRiderData, username: e.target.value })}
                  placeholder="Enter username for login"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-white placeholder-slate-600 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-200 mb-1">
                  Full / First Name
                </label>
                <input
                  type="text"
                  value={newRiderData.first_name}
                  onChange={(e) => setNewRiderData({ ...newRiderData, first_name: e.target.value })}
                  placeholder="Enter full name"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-white placeholder-slate-600 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-200 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={newRiderData.phone_number}
                  onChange={(e) => setNewRiderData({ ...newRiderData, phone_number: e.target.value })}
                  placeholder="Enter 10-digit mobile number"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-white placeholder-slate-600 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-200 mb-1">
                  Account Password *
                </label>
                <input
                  type="password"
                  required
                  value={newRiderData.password}
                  onChange={(e) => setNewRiderData({ ...newRiderData, password: e.target.value })}
                  placeholder="Set password for delivery boy"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-white placeholder-slate-600 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddRiderModal(false)}
                  className="px-4 py-2.5 text-slate-700 dark:text-zinc-200 font-semibold hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRider}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  {submittingRider ? "Creating..." : "Create Delivery Boy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ASSIGN RIDER MODAL */}
      {assignModalOrder && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAssignModalOrder(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl p-6 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <h3 className="text-lg font-semibold text-slate-700 dark:text-white">
                  Dispatch Delivery Boy
                </h3>
                <p className="text-xs text-slate-700 dark:text-zinc-200 font-medium mt-0.5">
                  Order #{assignModalOrder.order_number || assignModalOrder.id} • ₹{assignModalOrder.total_amount}
                </p>
              </div>
              <button
                onClick={() => setAssignModalOrder(null)}
                className="p-1.5 text-slate-700 hover:text-slate-950 dark:hover:text-white rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5">
              <p className="text-[10px] font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wider">
                Select Active Delivery Boy ({riders.length})
              </p>

              {riders.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700">
                  <Bike className="w-8 h-8 text-slate-600 dark:text-zinc-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">No riders registered yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {riders.map((rider) => (
                    <button
                      key={rider.id}
                      disabled={assigning}
                      onClick={() => handleAssignRider(rider.id)}
                      className="w-full flex items-center justify-between p-3.5 bg-slate-50 dark:bg-zinc-800/70 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl transition-all text-left group shadow-sm cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 flex items-center justify-center font-medium text-xs">
                          <Bike size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-700 dark:text-white group-hover:text-slate-900">
                            {rider.first_name || rider.username}
                          </p>
                          <p className="text-[11px] text-slate-700 dark:text-zinc-200 font-medium">
                            {rider.phone_number || "No Phone"}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-700 group-hover:text-slate-950 transition-colors" />
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

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

// ─── shadcn/ui Components ─────────────────────────────────────────────────────
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Colors (matching existing app) ───────────────────────────────────────────

const C = {
  lime: "#9AFF01",
  pink: "#E461AD",
  cyan: "#16B1DE",
  dark: "#0A0A0A",
  text: "#1A1A2E",
  textMuted: "#6B7280",
  lightPink: "#F9E4EE",
  lightBlue: "#F1FBFD",
  lightestPink: "#FFF1F9",
  white: "#FFFFFF",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "dashboard" | "users" | "credits" | "settings";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  creditsUsed: number;
  creditsLimit: number;
  createdAt: string;
  updatedAt?: string;
  subscription: { status: string; startDate: string; endDate: string | null } | null;
  _count: { transactions: number };
}

interface CreditSummary {
  totalUsers: number;
  totalCreditsUsed: number;
  totalCreditsAvailable: number;
  recentTransactions: Array<{
    id: string;
    amount: number;
    type: string;
    description: string;
    jobId: string | null;
    createdAt: string;
    user: { name: string; email: string };
  }>;
}

interface UserCreditDetail {
  id: string;
  name: string;
  email: string;
  plan: string;
  creditsUsed: number;
  creditsLimit: number;
  available: number;
  transactions: Array<{
    id: string;
    amount: number;
    type: string;
    description: string;
    jobId: string | null;
    createdAt: string;
  }>;
}

interface AdminSettings {
  id: string;
  siteName: string;
  stripePublicKey: string | null;
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
  planFreeCredits: number;
  planProCredits: number;
  planEnterpriseCredits: number;
  planFreePrice: string;
  planProPrice: string;
  planEnterprisePrice: string;
  creditCostPerScene: number;
  enableRegistration: boolean;
  enableStripePayment: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Icons (inline SVG) ──────────────────────────────────────────────────────

function IconDashboard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconCredits() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
  );
}

function IconMinus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

// ─── Toast helper ─────────────────────────────────────────────────────────────

function showToast(toast: ReturnType<typeof useToast>["toast"], title: string, description: string, variant: "default" | "destructive" = "default") {
  toast({ title, description, variant });
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

// ─── Plan badge colors ───────────────────────────────────────────────────────

function planBadge(plan: string) {
  const colors: Record<string, { bg: string; text: string }> = {
    free: { bg: "#F3F4F6", text: "#6B7280" },
    pro: { bg: C.lightBlue, text: C.cyan },
    enterprise: { bg: C.lightPink, text: C.pink },
  };
  const c = colors[plan] || colors.free;
  return (
    <Badge
      variant="secondary"
      className="uppercase text-[10px] font-bold tracking-wider px-2 py-0.5"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {plan}
    </Badge>
  );
}

function roleBadge(role: string) {
  return (
    <Badge
      variant="secondary"
      className="uppercase text-[10px] font-bold tracking-wider px-2 py-0.5"
      style={{
        backgroundColor: role === "admin" ? C.dark : "#F3F4F6",
        color: role === "admin" ? C.white : C.textMuted,
      }}
    >
      {role}
    </Badge>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const session = user ? { user } : null;
  const status = authLoading ? "loading" : (user ? "authenticated" : "unauthenticated");
  const { toast } = useToast();

  // ── Navigation ──
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Dashboard data ──
  const [creditSummary, setCreditSummary] = useState<CreditSummary | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // ── Users data ──
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersSearchInput, setUsersSearchInput] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  // ── User edit dialog ──
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState({ plan: "", creditsUsed: "", creditsLimit: "", role: "" });
  const [savingUser, setSavingUser] = useState(false);

  // ── Delete user dialog ──
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // ── Credit management ──
  const [creditUsers, setCreditUsers] = useState<UserRecord[]>([]);
  const [selectedCreditUserId, setSelectedCreditUserId] = useState<string>("");
  const [creditUserDetail, setCreditUserDetail] = useState<UserCreditDetail | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDescription, setCreditDescription] = useState("");
  const [creditMode, setCreditMode] = useState<"grant" | "revoke">("grant");
  const [creditLimitAmount, setCreditLimitAmount] = useState("");
  const [creditResetUsage, setCreditResetUsage] = useState(false);
  const [processingCredits, setProcessingCredits] = useState(false);
  const [settingLimit, setSettingLimit] = useState(false);
  const [loadingCreditDetail, setLoadingCreditDetail] = useState(false);
  const [loadingCreditUsers, setLoadingCreditUsers] = useState(false);

  // ── Settings ──
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState<Record<string, string | number | boolean>>({});
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // ─── Auth gate ─────────────────────────────────────────────────────────

  // Firebase handles auth state - redirect if not admin
  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.href = "/";
    }
  }, [status]);

  // ─── Fetch functions ───────────────────────────────────────────────────

  const fetchDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const res = await authFetch("/api/admin/credits");
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      const data = await res.json();
      setCreditSummary(data.summary);
    } catch {
      showToast(toast, "Error", "Failed to load dashboard data", "destructive");
    } finally {
      setLoadingDashboard(false);
    }
  }, [toast]);

  const fetchUsers = useCallback(async (page: number, search: string) => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await authFetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users);
      setUsersTotal(data.total);
      setUsersTotalPages(data.totalPages);
      setUsersPage(data.page);
    } catch {
      showToast(toast, "Error", "Failed to load users", "destructive");
    } finally {
      setLoadingUsers(false);
    }
  }, [toast]);

  const fetchCreditUsers = useCallback(async () => {
    setLoadingCreditUsers(true);
    try {
      const res = await authFetch("/api/admin/users?limit=100");
      if (!res.ok) throw new Error("Failed to fetch users for credit management");
      const data = await res.json();
      setCreditUsers(data.users);
    } catch {
      showToast(toast, "Error", "Failed to load users", "destructive");
    } finally {
      setLoadingCreditUsers(false);
    }
  }, [toast]);

  const fetchCreditUserDetail = useCallback(async (userId: string) => {
    setLoadingCreditDetail(true);
    try {
      const res = await authFetch(`/api/admin/credits?userId=${userId}`);
      if (!res.ok) throw new Error("Failed to fetch user credit details");
      const data = await res.json();
      setCreditUserDetail(data.user);
    } catch {
      showToast(toast, "Error", "Failed to load credit details", "destructive");
    } finally {
      setLoadingCreditDetail(false);
    }
  }, [toast]);

  const fetchSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const res = await authFetch("/api/admin/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      setSettings(data);
      setSettingsForm({
        siteName: data.siteName || "",
        stripePublicKey: data.stripePublicKey || "",
        stripeSecretKey: data.stripeSecretKey || "",
        stripeWebhookSecret: data.stripeWebhookSecret || "",
        planFreeCredits: data.planFreeCredits ?? 3,
        planProCredits: data.planProCredits ?? 50,
        planEnterpriseCredits: data.planEnterpriseCredits ?? 999999,
        planFreePrice: data.planFreePrice || "0",
        planProPrice: data.planProPrice || "19.99",
        planEnterprisePrice: data.planEnterprisePrice || "49.99",
        creditCostPerScene: data.creditCostPerScene ?? 1,
        enableRegistration: data.enableRegistration ?? true,
        enableStripePayment: data.enableStripePayment ?? false,
      });
    } catch {
      showToast(toast, "Error", "Failed to load settings", "destructive");
    } finally {
      setLoadingSettings(false);
    }
  }, [toast]);

  // ─── Load data on tab switch ───────────────────────────────────────────

  useEffect(() => {
    if (session?.user && (session.user as Record<string, unknown>).role === "admin") {
      if (activeTab === "dashboard" && !creditSummary) fetchDashboard();
      if (activeTab === "users") fetchUsers(usersPage, usersSearch);
      if (activeTab === "credits") {
        fetchCreditUsers();
      }
      if (activeTab === "settings" && !settings) fetchSettings();
    }
  }, [activeTab, session, creditSummary, settings, usersPage, usersSearch, fetchDashboard, fetchUsers, fetchCreditUsers, fetchSettings]);

  // ─── Actions ───────────────────────────────────────────────────────────

  const handleSaveUser = async () => {
    if (!editUser) return;
    setSavingUser(true);
    try {
      const body: Record<string, unknown> = { userId: editUser.id };
      if (editForm.plan && editForm.plan !== editUser.plan) body.plan = editForm.plan;
      if (editForm.creditsUsed !== "") body.creditsUsed = parseInt(editForm.creditsUsed, 10);
      if (editForm.creditsLimit !== "") body.creditsLimit = parseInt(editForm.creditsLimit, 10);
      if (editForm.role && editForm.role !== editUser.role) body.role = editForm.role;

      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update user");
      }
      showToast(toast, "Success", "User updated successfully");
      setEditUser(null);
      fetchUsers(usersPage, usersSearch);
    } catch (err) {
      showToast(toast, "Error", err instanceof Error ? err.message : "Failed to update user", "destructive");
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeletingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: deleteTarget.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete user");
      }
      showToast(toast, "Success", `User "${deleteTarget.email}" deleted`);
      setDeleteTarget(null);
      fetchUsers(usersPage, usersSearch);
    } catch (err) {
      showToast(toast, "Error", err instanceof Error ? err.message : "Failed to delete user", "destructive");
    } finally {
      setDeletingUser(false);
    }
  };

  const handleOpenEditUser = (user: UserRecord) => {
    setEditUser(user);
    setEditForm({
      plan: user.plan,
      creditsUsed: String(user.creditsUsed),
      creditsLimit: String(user.creditsLimit),
      role: user.role,
    });
  };

  const handleCreditOperation = async () => {
    if (!selectedCreditUserId || !creditAmount) return;
    const amount = parseInt(creditAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      showToast(toast, "Error", "Please enter a valid positive amount", "destructive");
      return;
    }
    setProcessingCredits(true);
    try {
      const finalAmount = creditMode === "grant" ? amount : -amount;
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedCreditUserId,
          amount: finalAmount,
          description: creditDescription || `Admin ${creditMode} ${amount} credits`,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Credit operation failed");
      }
      const data = await res.json();
      showToast(toast, "Success", data.message);
      setCreditAmount("");
      setCreditDescription("");
      fetchCreditUserDetail(selectedCreditUserId);
    } catch (err) {
      showToast(toast, "Error", err instanceof Error ? err.message : "Credit operation failed", "destructive");
    } finally {
      setProcessingCredits(false);
    }
  };

  const handleSetCreditLimit = async () => {
    if (!selectedCreditUserId || creditLimitAmount === "") return;
    const limit = parseInt(creditLimitAmount, 10);
    if (isNaN(limit) || limit < 0) {
      showToast(toast, "Error", "Please enter a valid credit limit", "destructive");
      return;
    }
    setSettingLimit(true);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedCreditUserId,
          creditsLimit: limit,
          resetUsage: creditResetUsage,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to set credit limit");
      }
      showToast(toast, "Success", `Credit limit updated to ${limit}`);
      setCreditLimitAmount("");
      setCreditResetUsage(false);
      fetchCreditUserDetail(selectedCreditUserId);
    } catch (err) {
      showToast(toast, "Error", err instanceof Error ? err.message : "Failed to update credit limit", "destructive");
    } finally {
      setSettingLimit(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save settings");
      }
      showToast(toast, "Success", "Settings saved successfully");
      // Refresh settings
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
        setSettingsForm({
          siteName: data.settings.siteName || "",
          stripePublicKey: data.settings.stripePublicKey || "",
          stripeSecretKey: data.settings.stripeSecretKey || "",
          stripeWebhookSecret: data.settings.stripeWebhookSecret || "",
          planFreeCredits: data.settings.planFreeCredits ?? 3,
          planProCredits: data.settings.planProCredits ?? 50,
          planEnterpriseCredits: data.settings.planEnterpriseCredits ?? 999999,
          planFreePrice: data.settings.planFreePrice || "0",
          planProPrice: data.settings.planProPrice || "19.99",
          planEnterprisePrice: data.settings.planEnterprisePrice || "49.99",
          creditCostPerScene: data.settings.creditCostPerScene ?? 1,
          enableRegistration: data.settings.enableRegistration ?? true,
          enableStripePayment: data.settings.enableStripePayment ?? false,
        });
      }
    } catch (err) {
      showToast(toast, "Error", err instanceof Error ? err.message : "Failed to save settings", "destructive");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUsersSearch = () => {
    setUsersSearch(usersSearchInput);
    setUsersPage(1);
    fetchUsers(1, usersSearchInput);
  };

  // ─── Sidebar navigation items ──────────────────────────────────────────

  const navItems: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "Dashboard", icon: <IconDashboard /> },
    { key: "users", label: "Users", icon: <IconUsers /> },
    { key: "credits", label: "Credits", icon: <IconCredits /> },
    { key: "settings", label: "Settings", icon: <IconSettings /> },
  ];

  // ─── Auth Loading ──────────────────────────────────────────────────────

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.white }}>
        <div className="text-center">
          <Skeleton className="h-8 w-48 mx-auto mb-4" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  // ─── Access Denied ─────────────────────────────────────────────────────

  const isAdmin = session?.user && (session.user as Record<string, unknown>).role === "admin";

  if (!session || !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: C.white }}>
        <div className="text-center px-6">
          <div className="flex justify-center mb-6" style={{ color: C.textMuted }}>
            <IconLock />
          </div>
          <h1
            className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-3"
            style={{ color: C.dark }}
          >
            Access Denied
          </h1>
          <p className="text-base mb-8" style={{ color: C.textMuted }}>
            You don&apos;t have permission to view this page. Admin access is required.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: C.pink }}
          >
            <IconArrowLeft />
            Back to App
          </Link>
        </div>
      </div>
    );
  }

  // ─── Sidebar content ───────────────────────────────────────────────────

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo / Title */}
      <div className="p-5 border-b" style={{ borderColor: "#F3F4F6" }}>
        <Link href="/" className="flex items-center gap-2 mb-1 no-underline">
          <span className="text-xl font-black tracking-tight" style={{ color: C.dark }}>
            AI AVATAR
          </span>
        </Link>
        <span
          className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded-full mt-1"
          style={{ backgroundColor: C.dark, color: C.lime }}
        >
          Admin Panel
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => {
                setActiveTab(item.key);
                setSidebarOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold transition-all cursor-pointer"
              style={{
                backgroundColor: isActive ? C.lightPink : "transparent",
                color: isActive ? C.pink : C.textMuted,
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = "#F9FAFB";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {item.label}
              {isActive && (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: C.pink }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t" style={{ borderColor: "#F3F4F6" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: C.pink }}
          >
            {(session?.user?.name || "A")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate" style={{ color: C.text }}>
              {session?.user?.name || "Admin"}
            </p>
            <p className="text-[10px] truncate" style={{ color: C.textMuted }}>
              {session?.user?.email || ""}
            </p>
          </div>
        </div>
        <Link
          href="/"
          className="flex items-center justify-center gap-1.5 mt-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all no-underline"
          style={{ color: C.textMuted, backgroundColor: "#F9FAFB" }}
        >
          <IconArrowLeft />
          Back to App
        </Link>
      </div>
    </div>
  );

  // ─── Dashboard Section ─────────────────────────────────────────────────

  function DashboardSection() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight" style={{ color: C.dark }}>
            Dashboard
          </h2>
          <p className="text-sm mt-1" style={{ color: C.textMuted }}>
            Overview of your platform&apos;s performance
          </p>
        </div>

        {loadingDashboard ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : creditSummary ? (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Total Users */}
              <div
                className="rounded-2xl p-5 border-2 transition-all hover:shadow-md"
                style={{ borderColor: "#F3F4F6", backgroundColor: C.white }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                    Total Users
                  </span>
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: C.lightPink }}
                  >
                    <IconUsers />
                  </div>
                </div>
                <p className="text-3xl font-black" style={{ color: C.dark }}>
                  {creditSummary.totalUsers.toLocaleString()}
                </p>
                <p className="text-xs mt-1" style={{ color: C.textMuted }}>
                  Registered accounts
                </p>
              </div>

              {/* Credits Used */}
              <div
                className="rounded-2xl p-5 border-2 transition-all hover:shadow-md"
                style={{ borderColor: "#F3F4F6", backgroundColor: C.white }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                    Credits Used
                  </span>
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: C.lightBlue }}
                  >
                    <IconCredits />
                  </div>
                </div>
                <p className="text-3xl font-black" style={{ color: C.cyan }}>
                  {creditSummary.totalCreditsUsed.toLocaleString()}
                </p>
                <p className="text-xs mt-1" style={{ color: C.textMuted }}>
                  Total credits consumed
                </p>
              </div>

              {/* Available Credits */}
              <div
                className="rounded-2xl p-5 border-2 transition-all hover:shadow-md"
                style={{ borderColor: "#F3F4F6", backgroundColor: C.white }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                    Available
                  </span>
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: "#F0FDF4" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-black" style={{ color: "#22C55E" }}>
                  {creditSummary.totalCreditsAvailable.toLocaleString()}
                </p>
                <p className="text-xs mt-1" style={{ color: C.textMuted }}>
                  Credits still available
                </p>
              </div>
            </div>

            {/* Recent Transactions */}
            <div
              className="rounded-2xl border-2 overflow-hidden"
              style={{ borderColor: "#F3F4F6", backgroundColor: C.white }}
            >
              <div className="flex items-center justify-between p-5 pb-0">
                <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: C.dark }}>
                  Recent Transactions
                </h3>
                <button
                  onClick={fetchDashboard}
                  className="p-1.5 rounded-lg transition-colors cursor-pointer"
                  style={{ color: C.textMuted }}
                  title="Refresh"
                >
                  <IconRefresh />
                </button>
              </div>
              <div className="p-5">
                {creditSummary.recentTransactions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm" style={{ color: C.textMuted }}>No transactions yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow style={{ borderColor: "#F3F4F6" }}>
                          <TableHead className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>User</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>Type</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right" style={{ color: C.textMuted }}>Amount</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-wider hidden sm:table-cell" style={{ color: C.textMuted }}>Description</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right hidden md:table-cell" style={{ color: C.textMuted }}>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {creditSummary.recentTransactions.map((tx) => (
                          <TableRow key={tx.id} style={{ borderColor: "#F9FAFB" }}>
                            <TableCell>
                              <div>
                                <p className="text-xs font-semibold" style={{ color: C.text }}>{tx.user.name}</p>
                                <p className="text-[10px]" style={{ color: C.textMuted }}>{tx.user.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-bold px-1.5 py-0"
                                style={{
                                  backgroundColor: tx.amount > 0 ? "#F0FDF4" : "#FEF2F2",
                                  color: tx.amount > 0 ? "#22C55E" : "#EF4444",
                                }}
                              >
                                {tx.type.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className="text-sm font-bold"
                                style={{ color: tx.amount > 0 ? "#22C55E" : "#EF4444" }}
                              >
                                {tx.amount > 0 ? "+" : ""}{tx.amount}
                              </span>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <p className="text-xs max-w-[200px] truncate" style={{ color: C.textMuted }}>
                                {tx.description}
                              </p>
                            </TableCell>
                            <TableCell className="text-right hidden md:table-cell">
                              <p className="text-[10px]" style={{ color: C.textMuted }}>
                                {formatDateTime(tx.createdAt)}
                              </p>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: C.textMuted }}>Failed to load dashboard data</p>
            <Button
              onClick={fetchDashboard}
              variant="outline"
              className="mt-3"
              size="sm"
            >
              <IconRefresh className="mr-1" /> Retry
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ─── Users Section ─────────────────────────────────────────────────────

  function UsersSection() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight" style={{ color: C.dark }}>
            Users
          </h2>
          <p className="text-sm mt-1" style={{ color: C.textMuted }}>
            Manage user accounts, roles, and plans
          </p>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.textMuted }} />
            <Input
              placeholder="Search by name or email..."
              value={usersSearchInput}
              onChange={(e) => setUsersSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUsersSearch()}
              className="pl-9 rounded-xl border-2"
              style={{ borderColor: "#E5E7EB" }}
            />
          </div>
          <Button
            onClick={handleUsersSearch}
            className="rounded-xl px-4 font-semibold text-white"
            style={{ backgroundColor: C.dark }}
          >
            Search
          </Button>
        </div>

        {/* Users Table */}
        <div
          className="rounded-2xl border-2 overflow-hidden"
          style={{ borderColor: "#F3F4F6", backgroundColor: C.white }}
        >
          {loadingUsers ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <IconUsers className="mx-auto mb-3" style={{ color: C.textMuted }} />
              <p className="text-sm font-semibold" style={{ color: C.textMuted }}>
                {usersSearch ? "No users found matching your search" : "No users yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: "#F3F4F6", backgroundColor: "#FAFAFA" }}>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>User</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>Plan</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>Credits</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider hidden sm:table-cell" style={{ color: C.textMuted }}>Role</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider hidden md:table-cell" style={{ color: C.textMuted }}>Joined</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right" style={{ color: C.textMuted }}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} style={{ borderColor: "#F9FAFB" }}>
                      <TableCell>
                        <div>
                          <p className="text-xs font-bold" style={{ color: C.text }}>{user.name}</p>
                          <p className="text-[10px]" style={{ color: C.textMuted }}>{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{planBadge(user.plan)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold" style={{ color: C.text }}>
                            {user.creditsUsed}/{user.creditsLimit}
                          </span>
                          <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#F3F4F6" }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${user.creditsLimit > 0 ? Math.min((user.creditsUsed / user.creditsLimit) * 100, 100) : 0}%`,
                                backgroundColor: user.creditsUsed >= user.creditsLimit ? "#EF4444" : C.cyan,
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{roleBadge(user.role)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-[10px]" style={{ color: C.textMuted }}>{formatDate(user.createdAt)}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-lg"
                            >
                              <IconMore />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={() => handleOpenEditUser(user)}
                              className="text-xs font-semibold cursor-pointer"
                            >
                              <IconSettings className="mr-2 h-3.5 w-3.5" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedCreditUserId(user.id);
                                setActiveTab("credits");
                                fetchCreditUsers().then(() => fetchCreditUserDetail(user.id));
                              }}
                              className="text-xs font-semibold cursor-pointer"
                            >
                              <IconCredits className="mr-2 h-3.5 w-3.5" />
                              Manage Credits
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(user)}
                              className="text-xs font-semibold cursor-pointer"
                              style={{ color: "#EF4444" }}
                            >
                              <svg className="mr-2 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {usersTotalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: "#F3F4F6" }}>
              <p className="text-xs" style={{ color: C.textMuted }}>
                {usersTotal} users total
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg"
                  disabled={usersPage <= 1}
                  onClick={() => fetchUsers(usersPage - 1, usersSearch)}
                >
                  <IconChevronLeft />
                </Button>
                <span className="text-xs font-semibold px-2" style={{ color: C.text }}>
                  {usersPage} / {usersTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg"
                  disabled={usersPage >= usersTotalPages}
                  onClick={() => fetchUsers(usersPage + 1, usersSearch)}
                >
                  <IconChevronRight />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Credit Management Section ─────────────────────────────────────────

  function CreditsSection() {
    const selectedUser = creditUsers.find((u) => u.id === selectedCreditUserId);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight" style={{ color: C.dark }}>
            Credit Management
          </h2>
          <p className="text-sm mt-1" style={{ color: C.textMuted }}>
            Grant, revoke credits and manage credit limits for users
          </p>
        </div>

        {/* User Selector */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Selection */}
          <div
            className="rounded-2xl border-2 p-5"
            style={{ borderColor: "#F3F4F6", backgroundColor: C.white }}
          >
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: C.dark }}>
              Select User
            </h3>
            {loadingCreditUsers ? (
              <Skeleton className="h-10 rounded-xl" />
            ) : (
              <Select
                value={selectedCreditUserId}
                onValueChange={(val) => {
                  setSelectedCreditUserId(val);
                  setCreditUserDetail(null);
                  setCreditAmount("");
                  setCreditDescription("");
                  setCreditLimitAmount("");
                  fetchCreditUserDetail(val);
                }}
              >
                <SelectTrigger className="rounded-xl border-2" style={{ borderColor: "#E5E7EB" }}>
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {creditUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{u.name}</span>
                        <span className="text-[10px]" style={{ color: C.textMuted }}>({u.email})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* User Credit Balance */}
            {creditUserDetail && (
              <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: "#FAFAFA" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: C.pink }}
                  >
                    {creditUserDetail.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: C.text }}>{creditUserDetail.name}</p>
                    <p className="text-[10px]" style={{ color: C.textMuted }}>{creditUserDetail.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded-lg" style={{ backgroundColor: C.white }}>
                    <p className="text-lg font-black" style={{ color: C.dark }}>{creditUserDetail.creditsUsed}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>Used</p>
                  </div>
                  <div className="text-center p-2 rounded-lg" style={{ backgroundColor: C.white }}>
                    <p className="text-lg font-black" style={{ color: C.cyan }}>{creditUserDetail.available}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>Available</p>
                  </div>
                  <div className="text-center p-2 rounded-lg" style={{ backgroundColor: C.white }}>
                    <p className="text-lg font-black" style={{ color: C.pink }}>{creditUserDetail.creditsLimit}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>Limit</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3 w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${creditUserDetail.creditsLimit > 0 ? Math.min((creditUserDetail.creditsUsed / creditUserDetail.creditsLimit) * 100, 100) : 0}%`,
                      backgroundColor: creditUserDetail.creditsUsed >= creditUserDetail.creditsLimit ? "#EF4444" : C.pink,
                    }}
                  />
                </div>
                <p className="text-[10px] text-center mt-1" style={{ color: C.textMuted }}>
                  {planBadge(creditUserDetail.plan)}
                  <span className="ml-1">
                    {Math.round(creditUserDetail.creditsLimit > 0 ? (creditUserDetail.creditsUsed / creditUserDetail.creditsLimit) * 100 : 0)}% used
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Grant / Revoke Credits */}
          <div
            className="rounded-2xl border-2 p-5"
            style={{ borderColor: "#F3F4F6", backgroundColor: C.white }}
          >
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: C.dark }}>
              Grant / Revoke Credits
            </h3>

            {!selectedCreditUserId ? (
              <div className="text-center py-8">
                <IconCredits className="mx-auto mb-2" style={{ color: C.textMuted }} />
                <p className="text-xs" style={{ color: C.textMuted }}>Select a user first</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Mode Toggle */}
                <div className="flex rounded-xl overflow-hidden border-2" style={{ borderColor: "#E5E7EB" }}>
                  <button
                    onClick={() => setCreditMode("grant")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all cursor-pointer"
                    style={{
                      backgroundColor: creditMode === "grant" ? "#F0FDF4" : C.white,
                      color: creditMode === "grant" ? "#22C55E" : C.textMuted,
                    }}
                  >
                    <IconPlus />
                    Grant
                  </button>
                  <button
                    onClick={() => setCreditMode("revoke")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all cursor-pointer"
                    style={{
                      backgroundColor: creditMode === "revoke" ? "#FEF2F2" : C.white,
                      color: creditMode === "revoke" ? "#EF4444" : C.textMuted,
                    }}
                  >
                    <IconMinus />
                    Revoke
                  </button>
                </div>

                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                    Amount
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="mt-1 rounded-xl border-2"
                    style={{ borderColor: "#E5E7EB" }}
                  />
                </div>

                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                    Description (optional)
                  </Label>
                  <Textarea
                    value={creditDescription}
                    onChange={(e) => setCreditDescription(e.target.value)}
                    placeholder="Reason for credit change..."
                    className="mt-1 rounded-xl border-2 text-xs resize-none"
                    rows={2}
                    style={{ borderColor: "#E5E7EB" }}
                  />
                </div>

                <Button
                  onClick={handleCreditOperation}
                  disabled={processingCredits || !creditAmount}
                  className="w-full rounded-xl font-bold text-white text-xs"
                  style={{
                    backgroundColor: creditMode === "grant" ? "#22C55E" : "#EF4444",
                    opacity: processingCredits || !creditAmount ? 0.5 : 1,
                  }}
                >
                  {processingCredits ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 justify-center">
                      {creditMode === "grant" ? <IconPlus /> : <IconMinus />}
                      {creditMode === "grant" ? "Grant" : "Revoke"} Credits
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Set Credit Limit */}
          <div
            className="rounded-2xl border-2 p-5"
            style={{ borderColor: "#F3F4F6", backgroundColor: C.white }}
          >
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: C.dark }}>
              Set Credit Limit
            </h3>

            {!selectedCreditUserId ? (
              <div className="text-center py-8">
                <IconSettings className="mx-auto mb-2" style={{ color: C.textMuted }} />
                <p className="text-xs" style={{ color: C.textMuted }}>Select a user first</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                    Credit Limit
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={creditLimitAmount}
                    onChange={(e) => setCreditLimitAmount(e.target.value)}
                    placeholder={String(creditUserDetail?.creditsLimit || "Enter limit")}
                    className="mt-1 rounded-xl border-2"
                    style={{ borderColor: "#E5E7EB" }}
                  />
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "#FAFAFA" }}>
                  <Switch
                    checked={creditResetUsage}
                    onCheckedChange={setCreditResetUsage}
                  />
                  <Label className="text-xs font-semibold cursor-pointer" style={{ color: C.text }}>
                    Reset usage to 0
                  </Label>
                </div>

                <Button
                  onClick={handleSetCreditLimit}
                  disabled={settingLimit || creditLimitAmount === ""}
                  className="w-full rounded-xl font-bold text-white text-xs"
                  style={{
                    backgroundColor: C.dark,
                    opacity: settingLimit || creditLimitAmount === "" ? 0.5 : 1,
                  }}
                >
                  {settingLimit ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Updating...
                    </span>
                  ) : (
                    "Update Credit Limit"
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* User Transaction History */}
        {creditUserDetail && (
          <div
            className="rounded-2xl border-2 overflow-hidden"
            style={{ borderColor: "#F3F4F6", backgroundColor: C.white }}
          >
            <div className="flex items-center justify-between p-5 pb-0">
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: C.dark }}>
                Transaction History for {creditUserDetail.name}
              </h3>
              <button
                onClick={() => fetchCreditUserDetail(selectedCreditUserId)}
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ color: C.textMuted }}
              >
                <IconRefresh />
              </button>
            </div>
            <div className="p-5">
              {loadingCreditDetail ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 rounded-xl" />
                  ))}
                </div>
              ) : creditUserDetail.transactions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs" style={{ color: C.textMuted }}>No transactions for this user</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-xl">
                  <Table>
                    <TableHeader>
                      <TableRow style={{ borderColor: "#F3F4F6" }}>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>Type</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right" style={{ color: C.textMuted }}>Amount</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider hidden sm:table-cell" style={{ color: C.textMuted }}>Description</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right" style={{ color: C.textMuted }}>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creditUserDetail.transactions.map((tx) => (
                        <TableRow key={tx.id} style={{ borderColor: "#F9FAFB" }}>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-bold px-1.5 py-0"
                              style={{
                                backgroundColor: tx.amount > 0 ? "#F0FDF4" : "#FEF2F2",
                                color: tx.amount > 0 ? "#22C55E" : "#EF4444",
                              }}
                            >
                              {tx.type.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className="text-xs font-bold"
                              style={{ color: tx.amount > 0 ? "#22C55E" : "#EF4444" }}
                            >
                              {tx.amount > 0 ? "+" : ""}{tx.amount}
                            </span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <p className="text-xs max-w-[250px] truncate" style={{ color: C.textMuted }}>
                              {tx.description}
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            <p className="text-[10px]" style={{ color: C.textMuted }}>
                              {formatDateTime(tx.createdAt)}
                            </p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Settings Section ──────────────────────────────────────────────────

  function SettingsSection() {
    if (loadingSettings) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-black tracking-tight" style={{ color: C.dark }}>Settings</h2>
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        </div>
      );
    }

    if (!settings) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-black tracking-tight" style={{ color: C.dark }}>Settings</h2>
          </div>
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: C.textMuted }}>Failed to load settings</p>
            <Button onClick={fetchSettings} variant="outline" size="sm" className="mt-3">
              <IconRefresh className="mr-1" /> Retry
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight" style={{ color: C.dark }}>
              Settings
            </h2>
            <p className="text-sm mt-1" style={{ color: C.textMuted }}>
              Configure your platform settings and integrations
            </p>
          </div>
          <Button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="rounded-xl font-bold text-white text-xs"
            style={{ backgroundColor: C.pink, opacity: savingSettings ? 0.5 : 1 }}
          >
            {savingSettings ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>

        {/* General */}
        <div
          className="rounded-2xl border-2 p-5 space-y-4"
          style={{ borderColor: "#F3F4F6", backgroundColor: C.white }}
        >
          <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: C.dark }}>
            <IconDashboard />
            General
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                Site Name
              </Label>
              <Input
                value={String(settingsForm.siteName || "")}
                onChange={(e) => setSettingsForm((f) => ({ ...f, siteName: e.target.value }))}
                className="mt-1 rounded-xl border-2 text-sm"
                style={{ borderColor: "#E5E7EB" }}
              />
            </div>
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                Credits Cost Per Scene
              </Label>
              <Input
                type="number"
                min="1"
                value={String(settingsForm.creditCostPerScene || "")}
                onChange={(e) => setSettingsForm((f) => ({ ...f, creditCostPerScene: parseInt(e.target.value, 10) || 0 }))}
                className="mt-1 rounded-xl border-2 text-sm"
                style={{ borderColor: "#E5E7EB" }}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: "#FAFAFA" }}>
              <div>
                <Label className="text-xs font-semibold" style={{ color: C.text }}>Enable Registration</Label>
                <p className="text-[10px]" style={{ color: C.textMuted }}>Allow new users to sign up</p>
              </div>
              <Switch
                checked={Boolean(settingsForm.enableRegistration)}
                onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, enableRegistration: v }))}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: "#FAFAFA" }}>
              <div>
                <Label className="text-xs font-semibold" style={{ color: C.text }}>Enable Stripe Payment</Label>
                <p className="text-[10px]" style={{ color: C.textMuted }}>Accept payments via Stripe</p>
              </div>
              <Switch
                checked={Boolean(settingsForm.enableStripePayment)}
                onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, enableStripePayment: v }))}
              />
            </div>
          </div>
        </div>

        {/* Stripe Integration */}
        <div
          className="rounded-2xl border-2 p-5 space-y-4"
          style={{ borderColor: "#F3F4F6", backgroundColor: C.white }}
        >
          <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: C.dark }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2.5" />
              <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
            </svg>
            Stripe Integration
          </h3>
          <div className="space-y-3">
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                Stripe Public Key
              </Label>
              <Input
                value={String(settingsForm.stripePublicKey || "")}
                onChange={(e) => setSettingsForm((f) => ({ ...f, stripePublicKey: e.target.value }))}
                placeholder="pk_live_..."
                className="mt-1 rounded-xl border-2 text-sm"
                style={{ borderColor: "#E5E7EB" }}
              />
            </div>
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                Stripe Secret Key
              </Label>
              <Input
                type="password"
                value={String(settingsForm.stripeSecretKey || "")}
                onChange={(e) => setSettingsForm((f) => ({ ...f, stripeSecretKey: e.target.value }))}
                placeholder="sk_live_... (leave unchanged to keep current)"
                className="mt-1 rounded-xl border-2 text-sm"
                style={{ borderColor: "#E5E7EB" }}
              />
              <p className="text-[10px] mt-1" style={{ color: C.textMuted }}>
                Current: {settings.stripeSecretKey || "Not set"}
              </p>
            </div>
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                Stripe Webhook Secret
              </Label>
              <Input
                type="password"
                value={String(settingsForm.stripeWebhookSecret || "")}
                onChange={(e) => setSettingsForm((f) => ({ ...f, stripeWebhookSecret: e.target.value }))}
                placeholder="whsec_... (leave unchanged to keep current)"
                className="mt-1 rounded-xl border-2 text-sm"
                style={{ borderColor: "#E5E7EB" }}
              />
              <p className="text-[10px] mt-1" style={{ color: C.textMuted }}>
                Current: {settings.stripeWebhookSecret || "Not set"}
              </p>
            </div>
          </div>
        </div>

        {/* Plan Configuration */}
        <div
          className="rounded-2xl border-2 p-5 space-y-4"
          style={{ borderColor: "#F3F4F6", backgroundColor: C.white }}
        >
          <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: C.dark }}>
            <IconCredits />
            Plan Configuration
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Free Plan */}
            <div className="p-4 rounded-xl border-2 space-y-3" style={{ borderColor: "#E5E7EB", backgroundColor: "#FAFAFA" }}>
              <div className="flex items-center gap-2">
                {planBadge("free")}
                <span className="text-xs font-bold" style={{ color: C.text }}>Free Plan</span>
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                  Credits
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={String(settingsForm.planFreeCredits ?? "")}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, planFreeCredits: parseInt(e.target.value, 10) || 0 }))}
                  className="mt-1 rounded-xl border-2 text-sm"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                  Price ($)
                </Label>
                <Input
                  value={String(settingsForm.planFreePrice || "")}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, planFreePrice: e.target.value }))}
                  className="mt-1 rounded-xl border-2 text-sm"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>
            </div>

            {/* Pro Plan */}
            <div className="p-4 rounded-xl border-2 space-y-3" style={{ borderColor: C.cyan + "40", backgroundColor: C.lightBlue }}>
              <div className="flex items-center gap-2">
                {planBadge("pro")}
                <span className="text-xs font-bold" style={{ color: C.text }}>Pro Plan</span>
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                  Credits
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={String(settingsForm.planProCredits ?? "")}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, planProCredits: parseInt(e.target.value, 10) || 0 }))}
                  className="mt-1 rounded-xl border-2 text-sm"
                  style={{ borderColor: C.cyan + "40" }}
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                  Price ($)
                </Label>
                <Input
                  value={String(settingsForm.planProPrice || "")}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, planProPrice: e.target.value }))}
                  className="mt-1 rounded-xl border-2 text-sm"
                  style={{ borderColor: C.cyan + "40" }}
                />
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className="p-4 rounded-xl border-2 space-y-3" style={{ borderColor: C.pink + "40", backgroundColor: C.lightPink }}>
              <div className="flex items-center gap-2">
                {planBadge("enterprise")}
                <span className="text-xs font-bold" style={{ color: C.text }}>Enterprise Plan</span>
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                  Credits
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={String(settingsForm.planEnterpriseCredits ?? "")}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, planEnterpriseCredits: parseInt(e.target.value, 10) || 0 }))}
                  className="mt-1 rounded-xl border-2 text-sm"
                  style={{ borderColor: C.pink + "40" }}
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                  Price ($)
                </Label>
                <Input
                  value={String(settingsForm.planEnterprisePrice || "")}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, planEnterprisePrice: e.target.value }))}
                  className="mt-1 rounded-xl border-2 text-sm"
                  style={{ borderColor: C.pink + "40" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save Footer */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="rounded-xl font-bold text-white text-xs px-8"
            style={{ backgroundColor: C.pink, opacity: savingSettings ? 0.5 : 1 }}
          >
            {savingSettings ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              "Save All Settings"
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Main Render ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#FAFAFA" }}>
      {/* ─── Mobile Overlay ─── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 border-r bg-white transform transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ borderColor: "#F3F4F6" }}
      >
        {sidebarContent}
      </aside>

      {/* ─── Main Content ─── */}
      <main className="flex-1 min-w-0">
        {/* Top Bar */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 border-b bg-white/80 backdrop-blur-md"
          style={{ borderColor: "#F3F4F6" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl transition-colors cursor-pointer"
              style={{ color: C.text }}
            >
              {sidebarOpen ? <IconX /> : <IconMenu />}
            </button>
            <div>
              <h1 className="text-sm font-bold" style={{ color: C.dark }}>
                {navItems.find((i) => i.key === activeTab)?.label || "Admin"}
              </h1>
              <p className="text-[10px] hidden sm:block" style={{ color: C.textMuted }}>
                {activeTab === "dashboard" && "Platform overview and statistics"}
                {activeTab === "users" && `${usersTotal} total users`}
                {activeTab === "credits" && "Manage user credits"}
                {activeTab === "settings" && "Platform configuration"}
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all no-underline"
            style={{ color: C.textMuted, backgroundColor: "#F3F4F6" }}
          >
            <IconArrowLeft />
            App
          </Link>
        </header>

        {/* Page Content */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
          {activeTab === "dashboard" && <DashboardSection />}
          {activeTab === "users" && <UsersSection />}
          {activeTab === "credits" && <CreditsSection />}
          {activeTab === "settings" && <SettingsSection />}
        </div>
      </main>

      {/* ─── Edit User Dialog ─── */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl border-2" style={{ borderColor: "#F3F4F6" }}>
          <DialogHeader>
            <DialogTitle className="text-lg font-black" style={{ color: C.dark }}>
              Edit User
            </DialogTitle>
            <DialogDescription className="text-xs" style={{ color: C.textMuted }}>
              Update user details, plan, and credit settings
            </DialogDescription>
          </DialogHeader>

          {editUser && (
            <div className="space-y-4">
              {/* User Info */}
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "#FAFAFA" }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: C.pink }}
                >
                  {editUser.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: C.text }}>{editUser.name}</p>
                  <p className="text-[10px]" style={{ color: C.textMuted }}>{editUser.email}</p>
                </div>
              </div>

              <Separator />

              {/* Plan */}
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                  Plan
                </Label>
                <Select
                  value={editForm.plan}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, plan: v }))}
                >
                  <SelectTrigger className="mt-1 rounded-xl border-2" style={{ borderColor: "#E5E7EB" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Role */}
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                  Role
                </Label>
                <Select
                  value={editForm.role}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}
                >
                  <SelectTrigger className="mt-1 rounded-xl border-2" style={{ borderColor: "#E5E7EB" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Credits Used */}
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                  Credits Used
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={editForm.creditsUsed}
                  onChange={(e) => setEditForm((f) => ({ ...f, creditsUsed: e.target.value }))}
                  className="mt-1 rounded-xl border-2"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>

              {/* Credits Limit */}
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
                  Credits Limit
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={editForm.creditsLimit}
                  onChange={(e) => setEditForm((f) => ({ ...f, creditsLimit: e.target.value }))}
                  className="mt-1 rounded-xl border-2"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setEditUser(null)}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveUser}
              disabled={savingUser}
              className="rounded-xl text-xs font-bold text-white"
              style={{ backgroundColor: C.pink, opacity: savingUser ? 0.5 : 1 }}
            >
              {savingUser ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete User Confirmation ─── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="sm:max-w-md rounded-2xl border-2" style={{ borderColor: "#F3F4F6" }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black" style={{ color: C.dark }}>
              Delete User
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs" style={{ color: C.textMuted }}>
              Are you sure you want to delete <strong>{deleteTarget?.email}</strong>? This action is
              permanent and will remove all associated data including transactions and subscriptions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl text-xs font-semibold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deletingUser}
              className="rounded-xl text-xs font-bold text-white"
              style={{ backgroundColor: "#EF4444", opacity: deletingUser ? 0.5 : 1 }}
            >
              {deletingUser ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Deleting...
                </span>
              ) : (
                "Delete User"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

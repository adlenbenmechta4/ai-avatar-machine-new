"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import crypto from "crypto";

// ══════════════════════════════════════════════════════════════════════════════
// SECURITY: Client-side HMAC secret (matches server-side)
// In production, this should be fetched from a secure endpoint or env at build time
// ══════════════════════════════════════════════════════════════════════════════
const HMAC_SECRET = "avm_secure_grant_2024_xK9mZ";

function generateSignature(targetEmail: string, credits: number, plan: string, timestamp: number): string {
  const payload = `${targetEmail}:${credits}:${plan}:${timestamp}`;
  return crypto.createHmac("sha256", HMAC_SECRET).update(payload).digest("hex");
}

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

interface GrantLog {
  id: string;
  target: string;
  credits: number;
  plan: string;
  message: string;
  timestamp: string;
  success: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════════════════════

export default function AdminGrantPage() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const router = useRouter();

  // Form state
  const [targetEmail, setTargetEmail] = useState("");
  const [credits, setCredits] = useState("");
  const [plan, setPlan] = useState<"free" | "pro" | "enterprise">("enterprise");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Activity log
  const [logs, setLogs] = useState<GrantLog[]>([]);

  // Confirmation dialog
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ── Auth gate: redirect non-admins ──
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  const isAdmin = user?.role === "admin";

  // ── Handle grant ──
  const handleGrant = useCallback(async () => {
    if (!targetEmail.trim() || !credits) return;

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(targetEmail.trim())) {
      setResult({ success: false, message: "Invalid email format" });
      return;
    }

    const creditNum = parseInt(credits, 10);
    if (isNaN(creditNum) || creditNum < 0 || creditNum > 9999999) {
      setResult({ success: false, message: "Credits must be between 0 and 9,999,999" });
      return;
    }

    setProcessing(true);
    setResult(null);
    setConfirmOpen(false);

    const timestamp = Date.now();
    const signature = generateSignature(targetEmail.toLowerCase().trim(), creditNum, plan, timestamp);

    try {
      const res = await authFetch("/api/admin/secure-grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetEmail: targetEmail.toLowerCase().trim(),
          credits: creditNum,
          plan,
          timestamp,
          signature,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult({ success: true, message: data.message });
        setLogs((prev) => [
          {
            id: crypto.randomUUID(),
            target: data.target || targetEmail,
            credits: data.credits || creditNum,
            plan: data.plan || plan,
            message: data.message,
            timestamp: data.timestamp || new Date().toISOString(),
            success: true,
          },
          ...prev,
        ]);
        setTargetEmail("");
        setCredits("");
      } else {
        setResult({
          success: false,
          message: data.error || "Operation failed",
        });
        setLogs((prev) => [
          {
            id: crypto.randomUUID(),
            target: targetEmail.toLowerCase().trim(),
            credits: creditNum,
            plan,
            message: data.error || "Operation failed",
            timestamp: new Date().toISOString(),
            success: false,
          },
          ...prev,
        ]);
      }
    } catch (error) {
      setResult({ success: false, message: "Network error. Please try again." });
    } finally {
      setProcessing(false);
    }
  }, [targetEmail, credits, plan, authFetch]);

  // ── Loading state ──
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A0A0A" }}>
        <div className="text-center">
          <div
            className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: "#E461AD", borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: "#6B7280" }}>Verifying access...</p>
        </div>
      </div>
    );
  }

  // ── Access denied ──
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: "#0A0A0A" }}>
        <div className="text-center max-w-md">
          <div className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: "#1E1E1E" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-3xl font-black mb-3" style={{ color: "#FFFFFF" }}>Access Denied</h1>
          <p className="text-sm mb-8" style={{ color: "#6B7280" }}>
            This section is restricted to authorized administrators only. All access attempts are logged and monitored.
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:scale-105"
            style={{ backgroundColor: "#E461AD" }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN UI
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A" }}>
      {/* ── Header ── */}
      <header className="border-b" style={{ borderColor: "#1E1E1E", backgroundColor: "#0A0A0A" }}>
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105"
              style={{ backgroundColor: "#1E1E1E" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-black tracking-tight" style={{ color: "#FFFFFF" }}>
                Secure Credit Grant
              </h1>
              <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "#6B7280" }}>
                Admin Only — 7-Layer Security
              </p>
            </div>
          </div>

          {/* Admin badge */}
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: "#E461AD", color: "#FFFFFF" }}
            >
              {user.name?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-bold" style={{ color: "#FFFFFF" }}>{user.name}</p>
              <p className="text-[10px]" style={{ color: "#6B7280" }}>{user.email}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* ── Security Shield ── */}
        <div
          className="rounded-2xl p-5 border"
          style={{
            backgroundColor: "#0F0F0F",
            borderColor: "#1E1E1E",
            background: "linear-gradient(135deg, #0F0F0F 0%, #111118 100%)",
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#16B1DE15", border: "1px solid #16B1DE30" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16B1DE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold mb-1" style={{ color: "#16B1DE" }}>Protected Endpoint</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>
                This panel is secured with 7 layers of protection:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                {[
                  { label: "Firebase Auth", icon: "🔑" },
                  { label: "VIP Whitelist", icon: "📋" },
                  { label: "HMAC Signing", icon: "🔐" },
                  { label: "Rate Limiting", icon: "⏱️" },
                  { label: "Anti-Replay", icon: "🛡️" },
                  { label: "Input Sanitize", icon: "✅" },
                  { label: "Audit Logging", icon: "📝" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                    style={{ backgroundColor: "#1E1E1E" }}
                  >
                    <span className="text-xs">{item.icon}</span>
                    <span className="text-[10px] font-semibold" style={{ color: "#9CA3AF" }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Grant Form ── */}
        <div
          className="rounded-2xl p-6 border"
          style={{ backgroundColor: "#0F0F0F", borderColor: "#1E1E1E" }}
        >
          <h2 className="text-base font-bold mb-1" style={{ color: "#FFFFFF" }}>Grant Credits</h2>
          <p className="text-xs mb-6" style={{ color: "#6B7280" }}>
            Enter the target user&apos;s email and the number of credits to grant. All operations are permanently logged.
          </p>

          <div className="space-y-4">
            {/* Target Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#9CA3AF" }}>
                Target User Email
              </label>
              <input
                type="email"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all focus:ring-2"
                style={{
                  backgroundColor: "#1A1A1A",
                  color: "#FFFFFF",
                  border: "1px solid #2E2E2E",
                  focusRingColor: "#E461AD40",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#E461AD")}
                onBlur={(e) => (e.target.style.borderColor = "#2E2E2E")}
              />
            </div>

            {/* Credits + Plan row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Credits */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#9CA3AF" }}>
                  Credits Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={credits}
                    onChange={(e) => setCredits(e.target.value)}
                    placeholder="999999"
                    min="0"
                    max="9999999"
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all"
                    style={{
                      backgroundColor: "#1A1A1A",
                      color: "#FFFFFF",
                      border: "1px solid #2E2E2E",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#9AFF01")}
                    onBlur={(e) => (e.target.style.borderColor = "#2E2E2E")}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase" style={{ color: "#6B7280" }}>
                    credits
                  </span>
                </div>
              </div>

              {/* Plan */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#9CA3AF" }}>
                  Plan
                </label>
                <div className="flex gap-2">
                  {(["free", "pro", "enterprise"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlan(p)}
                      className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                      style={{
                        backgroundColor: plan === p ? (p === "enterprise" ? "#E461AD20" : p === "pro" ? "#16B1DE20" : "#9CA3AF20") : "#1A1A1A",
                        color: plan === p ? (p === "enterprise" ? "#E461AD" : p === "pro" ? "#16B1DE" : "#9CA3AF") : "#4B5563",
                        border: `1px solid ${plan === p ? (p === "enterprise" ? "#E461AD40" : p === "pro" ? "#16B1DE40" : "#9CA3AF40") : "#2E2E2E"}`,
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Presets */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "#6B7280" }}>Quick Presets</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "10 Credits", value: 10 },
                  { label: "50 Credits", value: 50 },
                  { label: "100 Credits", value: 100 },
                  { label: "500 Credits", value: 500 },
                  { label: "Unlimited", value: 999999 },
                ].map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setCredits(String(preset.value))}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-105"
                    style={{
                      backgroundColor: "#1E1E1E",
                      color: "#9CA3AF",
                      border: "1px solid #2E2E2E",
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Result message */}
            {result && (
              <div
                className="rounded-xl p-3 flex items-center gap-2"
                style={{
                  backgroundColor: result.success ? "#052e16" : "#2e0505",
                  border: `1px solid ${result.success ? "#166534" : "#7f1d1d"}`,
                }}
              >
                <span className="text-sm">{result.success ? "✅" : "❌"}</span>
                <p className="text-xs font-medium" style={{ color: result.success ? "#4ADE80" : "#FCA5A5" }}>
                  {result.message}
                </p>
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={() => {
                if (!targetEmail.trim() || !credits) return;
                setConfirmOpen(true);
              }}
              disabled={processing || !targetEmail.trim() || !credits}
              className="w-full py-4 rounded-2xl text-sm font-black uppercase tracking-wider transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                background: processing
                  ? "linear-gradient(135deg, #374151 0%, #1F2937 100%)"
                  : "linear-gradient(135deg, #E461AD 0%, #C7488E 100%)",
                color: "#FFFFFF",
                boxShadow: "0 4px 24px #E461AD30",
              }}
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: "#FFFFFF", borderTopColor: "transparent" }}
                  />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                  </svg>
                  Grant Credits
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Activity Log ── */}
        {logs.length > 0 && (
          <div
            className="rounded-2xl p-6 border"
            style={{ backgroundColor: "#0F0F0F", borderColor: "#1E1E1E" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold" style={{ color: "#FFFFFF" }}>Activity Log</h2>
              <button
                onClick={() => setLogs([])}
                className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg transition-all hover:opacity-80"
                style={{ color: "#6B7280", backgroundColor: "#1E1E1E" }}
              >
                Clear
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ backgroundColor: "#1A1A1A" }}
                >
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: log.success ? "#22C55E" : "#EF4444" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold" style={{ color: "#FFFFFF" }}>{log.target}</span>
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: log.plan === "enterprise" ? "#E461AD20" : "#16B1DE20",
                          color: log.plan === "enterprise" ? "#E461AD" : "#16B1DE",
                        }}
                      >
                        {log.plan}
                      </span>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>
                      {log.credits.toLocaleString()} credits —{" "}
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0" style={{
                    color: log.success ? "#22C55E" : "#EF4444",
                    backgroundColor: log.success ? "#052e16" : "#2e0505",
                  }}>
                    {log.success ? "OK" : "FAIL"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Confirmation Dialog ── */}
      {confirmOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.8)", zIndex: 99999 }}
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 border"
            style={{ backgroundColor: "#111111", borderColor: "#2E2E2E" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: "#FEF3C7" }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3 className="text-lg font-black mb-1" style={{ color: "#FFFFFF" }}>Confirm Grant</h3>
              <p className="text-xs" style={{ color: "#6B7280" }}>
                You are about to grant <span className="font-bold" style={{ color: "#FFFFFF" }}>{parseInt(credits || "0").toLocaleString()} credits</span> to:
              </p>
              <p className="text-sm font-bold mt-1" style={{ color: "#E461AD" }}>{targetEmail}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all"
                style={{ backgroundColor: "#1E1E1E", color: "#9CA3AF" }}
              >
                Cancel
              </button>
              <button
                onClick={handleGrant}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                style={{ backgroundColor: "#E461AD" }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

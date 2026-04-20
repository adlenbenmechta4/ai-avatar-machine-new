"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { signOutUser } from "@/lib/firebase";

// ─── Types ──────────────────────────────────────────────────────────────────

interface UserProfilePanelProps {
  name: string;
  email: string;
  role: string;
  plan: string;
  creditsUsed: number;
  creditsLimit: number;
  /** Called when user clicks "Upgrade Plan" — optional, hides button if not provided */
  onUpgrade?: () => void;
  /** Called when user clicks "Admin Panel" — optional, hides button if not provided */
  onAdmin?: () => void;
  /** Called after sign out */
  onSignOut?: () => void;
  /** Light or dark theme variant */
  variant?: "dark" | "light";
}

// ─── Profile Panel Component ───────────────────────────────────────────────

export default function UserProfilePanel({
  name,
  email,
  role,
  plan,
  creditsUsed,
  creditsLimit,
  onUpgrade,
  onAdmin,
  onSignOut,
  variant = "dark",
}: UserProfilePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDark] = useState(variant === "dark");
  const triggerRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [panelPos, setPanelPos] = useState({ top: 80, right: 20 });

  // Get portal target on mount
  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  // Calculate panel position from trigger button
  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPanelPos({
        top: rect.bottom + 10,
        right: window.innerWidth - rect.right,
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      return () => window.removeEventListener("resize", updatePosition);
    }
  }, [isOpen, updatePosition]);

  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const planColors: Record<string, string> = {
    free: "#9CA3AF",
    pro: "#E461AD",
    enterprise: "#16B1DE",
  };

  const planNames: Record<string, string> = {
    free: "Free",
    pro: "Pro",
    enterprise: "Enterprise",
  };

  const planFeatures: Record<string, string[]> = {
    free: ["3 AI avatar credits", "Standard resolution", "Basic support"],
    pro: ["50 AI avatar credits", "HD resolution (1080p)", "Priority processing", "Priority support"],
    enterprise: ["Unlimited credits", "4K resolution", "Priority processing", "API access", "Dedicated support"],
  };

  const planColor = planColors[plan] || "#9CA3AF";
  const creditsPercent = plan === "enterprise" ? 100 : Math.min((creditsUsed / creditsLimit) * 100, 100);
  const features = planFeatures[plan] || planFeatures.free;

  const handleSignOut = () => {
    setIsOpen(false);
    try { localStorage.clear(); } catch(e) {}
    try { sessionStorage.clear(); } catch(e) {}
    try {
      document.cookie.split(";").forEach(function(c) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
    } catch(e) {}
    signOutUser().catch(() => {});
    if (onSignOut) {
      onSignOut();
    } else {
      window.location.href = "/";
    }
  };

  // ─── Trigger Button ───────────────────────────────────────────────────
  const triggerButton = isDark ? (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className="flex items-center gap-2 px-2 py-1.5 rounded-2xl transition-all duration-200 hover:shadow-md"
      style={{ backgroundColor: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)" }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold"
        style={{ backgroundColor: "#E461AD", color: "#FFFFFF" }}
      >
        {initials}
      </div>
      <span className="hidden sm:inline text-xs font-bold max-w-20 truncate" style={{ color: "#FFFFFF" }}>
        {name}
      </span>
      <svg
        className="w-3 h-3 hidden sm:block transition-transform duration-200"
        style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        viewBox="0 0 20 20" fill="white"
      >
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
      </svg>
    </button>
  ) : (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className="flex items-center gap-2 px-2 py-1.5 rounded-2xl transition-all duration-200 hover:shadow-md"
      style={{ backgroundColor: "#FFF1F9" }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold"
        style={{ backgroundColor: "#E461AD", color: "#FFFFFF" }}
      >
        {initials}
      </div>
      <span className="hidden sm:inline text-xs font-bold max-w-20 truncate" style={{ color: "#1A1A2E" }}>
        {name}
      </span>
      <svg
        className="w-3.5 h-3.5 hidden sm:block transition-transform duration-200"
        style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        viewBox="0 0 20 20" fill="#6B7280"
      >
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
      </svg>
    </button>
  );

  // ─── Panel Content ────────────────────────────────────────────────────
  const panelContent = (
    <div
      className="animate-fade-in w-[340px] sm:w-[360px] rounded-3xl border overflow-hidden"
      style={{
        backgroundColor: "#111111",
        borderColor: "#1E1E1E",
        boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)",
      }}
    >
      {/* ── User Info Section ── */}
      <div
        className="relative px-6 pt-7 pb-5 text-center"
        style={{
          background: `linear-gradient(135deg, ${planColor}18 0%, ${planColor}08 100%)`,
          borderBottom: "1px solid #1E1E1E",
        }}
      >
        {/* Decorative glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ backgroundColor: planColor }}
        />

        {/* Large Avatar */}
        <div
          className="relative mx-auto w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black mb-4"
          style={{
            backgroundColor: planColor,
            color: "#FFFFFF",
            boxShadow: `0 0 0 4px #111111, 0 0 0 5px ${planColor}40, 0 8px 24px ${planColor}30`,
          }}
        >
          {initials}
        </div>

        <h3 className="text-lg font-bold mb-0.5" style={{ color: "#F3F4F6" }}>{name}</h3>
        <p className="text-xs" style={{ color: "#9CA3AF" }}>{email}</p>
      </div>

      {/* ── Plan Card Section ── */}
      <div className="px-6 pt-5 pb-4">
        {/* Plan badge row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: planColor, boxShadow: `0 0 8px ${planColor}80` }}
            />
            <span
              className="text-sm font-bold uppercase tracking-wider"
              style={{ color: planColor }}
            >
              {planNames[plan] || "Free"} Plan
            </span>
          </div>
          <span className="text-xs font-medium" style={{ color: "#9CA3AF" }}>
            {role === "admin" ? "\u2B50 Admin" : "User"}
          </span>
        </div>

        {/* Credits Progress */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: "#9CA3AF" }}>Credits Usage</span>
            <span className="text-xs font-bold" style={{ color: "#F3F4F6" }}>
              {creditsUsed}/{plan === "enterprise" ? "\u221E" : creditsLimit}
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "#1E1E1E" }}>
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${creditsPercent}%`,
                backgroundColor: planColor,
                boxShadow: `0 0 12px ${planColor}60`,
              }}
            />
          </div>
        </div>

        {/* Plan Features */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#9CA3AF" }}>
            Plan Features
          </p>
          {features.map((feature, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 20 20" fill={planColor}>
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium" style={{ color: "#F3F4F6" }}>{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Action Buttons Section ── */}
      <div className="px-6 pb-6 pt-3 space-y-2.5" style={{ borderTop: "1px solid #1E1E1E" }}>
        {/* Upgrade Plan Button */}
        {onUpgrade && plan !== "enterprise" && (
          <button
            onClick={() => { setIsOpen(false); onUpgrade(); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${planColor} 0%, ${planColor}CC 100%)`,
              color: "#FFFFFF",
              boxShadow: `0 4px 16px ${planColor}40`,
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
            </svg>
            Upgrade Plan
          </button>
        )}

        {/* Admin Panel Button */}
        {role === "admin" && onAdmin && (
          <button
            onClick={() => { setIsOpen(false); onAdmin(); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              backgroundColor: "#1E1E1E",
              color: "#16B1DE",
              border: "1px solid #16B1DE30",
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
            Admin Panel
          </button>
        )}

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all duration-200 hover:bg-red-500/10"
          style={{
            backgroundColor: "transparent",
            color: "#EF4444",
            border: "1px solid #EF444430",
          }}
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z" clipRule="evenodd" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );

  // ─── Render with Portal ───────────────────────────────────────────────
  return (
    <div ref={triggerRef}>
      {triggerButton}

      {isOpen && portalTarget && createPortal(
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9998 }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: "fixed",
              top: panelPos.top,
              right: panelPos.right,
              zIndex: 9999,
              maxWidth: "calc(100vw - 2rem)",
            }}
          >
            {panelContent}
          </div>
        </>,
        portalTarget
      )}
    </div>
  );
}

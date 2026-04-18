"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import { signOutUser } from "@/lib/firebase";
import AIAvatarMachine from "@/components/AIAvatarMachine";
import MainMenu from "@/components/MainMenu";

// ─── Colors (matching the existing design) ────────────────────────────────────

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

// ─── Loading Screen ──────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.white }}>
      <div className="text-center">
        <div
          className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-4"
          style={{ borderColor: `${C.pink}33`, borderTopColor: C.pink }}
        />
        <p className="text-sm font-medium" style={{ color: C.textMuted }}>Loading...</p>
      </div>
    </div>
  );
}

// ─── Subscription Screen ─────────────────────────────────────────────────────

function SubscriptionScreen({ userData, onComplete }: {
  userData: Record<string, unknown>;
  onComplete: () => void;
}) {
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const plan = (userData.plan as string) || "free";
  const creditsUsed = (userData.creditsUsed as number) || 0;
  const creditsLimit = (userData.creditsLimit as number) || 3;
  const name = (userData.name as string) || "User";

  const plans = [
    {
      id: "free" as const,
      name: "Free",
      price: "$0",
      period: "forever",
      credits: 3,
      features: ["3 AI avatar credits", "Standard resolution", "Basic support", "1 concurrent job"],
      highlight: false,
      color: "#9CA3AF",
    },
    {
      id: "pro" as const,
      name: "Pro",
      price: "$19.99",
      period: "/month",
      credits: 50,
      features: ["50 AI avatar credits", "HD resolution (1080p)", "Priority processing", "3 concurrent jobs", "Priority support"],
      highlight: true,
      color: C.pink,
    },
    {
      id: "enterprise" as const,
      name: "Enterprise",
      price: "$49.99",
      period: "/month",
      credits: 999999,
      features: ["Unlimited AI avatar credits", "4K resolution", "Priority processing", "10 concurrent jobs", "Custom branding", "API access", "Dedicated support"],
      highlight: false,
      color: C.cyan,
    },
  ];

  const handleUpgrade = useCallback(async (planId: string) => {
    setUpgrading(planId);
    setMessage(null);

    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to update plan." });
        return;
      }

      setMessage({ type: "success", text: `Successfully upgraded to ${planId.charAt(0).toUpperCase() + planId.slice(1)} plan!` });

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch {
      setMessage({ type: "error", text: "Something went wrong. Please try again." });
    } finally {
      setUpgrading(null);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: C.white }}>
      {/* Top decorative bar */}
      <div className="w-full py-2.5 overflow-hidden" style={{ backgroundColor: C.pink }}>
        <div className="flex animate-ticker whitespace-nowrap">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="inline-flex items-center gap-6 mx-8 text-sm font-semibold uppercase tracking-wider"
              style={{ color: C.white }}
            >
              YOUR AI AVATAR MACHINE
              <span className="opacity-50">&#9679;</span>
            </span>
          ))}
        </div>
      </div>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Header */}
          <div className="text-center mb-10">
            <p className="text-sm font-medium mb-1" style={{ color: C.textMuted }}>
              Welcome, <span className="font-bold" style={{ color: C.pink }}>{name}</span>
            </p>
            <h1
              className="text-3xl sm:text-4xl font-black tracking-tight uppercase mb-3"
              style={{ color: C.dark }}
            >
              Choose Your Plan
            </h1>
            <p className="text-sm" style={{ color: C.textMuted }}>
              Your current plan: <span className="font-bold" style={{
                color: plan === "free" ? "#9CA3AF" : plan === "pro" ? C.pink : C.cyan
              }}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</span>
              {" "}&mdash;{" "}
              {creditsUsed}/{plan === "enterprise" ? "\u221E" : creditsLimit} credits used
            </p>
          </div>

          {/* Message */}
          {message && (
            <div
              className="max-w-md mx-auto rounded-2xl px-5 py-3 mb-8 text-sm font-medium text-center"
              style={{
                backgroundColor: message.type === "success" ? "#F0FDF4" : "#FEF2F2",
                color: message.type === "success" ? "#16A34A" : "#DC2626",
                border: `1px solid ${message.type === "success" ? "#BBF7D0" : "#FECACA"}`,
              }}
            >
              {message.text}
            </div>
          )}

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 mb-10">
            {plans.map((p) => {
              const isCurrent = plan === p.id;
              const displayCredits = p.credits === 999999 ? "Unlimited" : p.credits;

              return (
                <div
                  key={p.id}
                  className="relative rounded-3xl p-6 sm:p-8 flex flex-col transition-all duration-300"
                  style={{
                    backgroundColor: C.white,
                    border: `2px solid ${isCurrent ? p.color : p.highlight ? `${C.pink}30` : "#F3F4F6"}`,
                    boxShadow: p.highlight ? `0 0 0 1px ${C.pink}20, 0 8px 32px ${C.pink}15` : "0 1px 3px rgba(0,0,0,0.05)",
                    transform: p.highlight ? "scale(1.02)" : "scale(1)",
                  }}
                >
                  {p.highlight && (
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                      style={{ backgroundColor: C.pink, color: C.white }}
                    >
                      Most Popular
                    </div>
                  )}

                  <div className="mb-6">
                    <h3
                      className="text-lg font-black uppercase tracking-wide mb-1"
                      style={{ color: p.color }}
                    >
                      {p.name}
                    </h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black" style={{ color: C.dark }}>{p.price}</span>
                      {p.period !== "forever" && (
                        <span className="text-sm" style={{ color: C.textMuted }}>{p.period}</span>
                      )}
                    </div>
                    <p className="text-xs mt-1" style={{ color: C.textMuted }}>
                      {displayCredits} credits
                    </p>
                  </div>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {p.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: C.text }}>
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill={p.color}>
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="font-light">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => {
                      if (p.id === "free") {
                        onComplete();
                      } else {
                        handleUpgrade(p.id);
                      }
                    }}
                    disabled={isCurrent || upgrading !== null}
                    className="w-full py-3 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all duration-200 disabled:opacity-40"
                    style={{
                      backgroundColor: isCurrent ? "#F3F4F6" : p.id === "free" ? C.dark : p.color,
                      color: isCurrent ? C.textMuted : C.white,
                    }}
                  >
                    {upgrading === p.id ? (
                      <span className="inline-flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        Processing...
                      </span>
                    ) : isCurrent ? (
                      "Current Plan"
                    ) : p.id === "free" ? (
                      "Continue with Free"
                    ) : (
                      `Upgrade to ${p.name}`
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Go to Dashboard link */}
          <div className="text-center">
            <button
              onClick={onComplete}
              className="inline-flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-70"
              style={{ color: C.pink }}
            >
              Skip for now &rarr; Go to Dashboard
            </button>
          </div>
        </div>
      </main>

      {/* Bottom decorative bar */}
      <div className="w-full py-2.5 overflow-hidden" style={{ backgroundColor: C.cyan }}>
        <div className="flex animate-ticker whitespace-nowrap">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="inline-flex items-center gap-6 mx-8 text-sm font-semibold uppercase tracking-wider"
              style={{ color: C.white }}
            >
              YOUR AI AVATAR MACHINE
              <span className="opacity-50">&#9679;</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── User Menu (overlay on app) ──────────────────────────────────────────────

function UserMenu({ userData, onShowSubscription, theme }: {
  userData: Record<string, unknown>;
  onShowSubscription: () => void;
  theme?: string;
}) {
  const isDark = theme === "dark";
  const { signOut } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  const handleSignOut = () => {
    // Nuclear sign out - clear everything
    setShowMenu(false);
    
    // Clear all browser storage
    try { localStorage.clear(); } catch(e) {}
    try { sessionStorage.clear(); } catch(e) {}
    // Clear all cookies  
    try {
      document.cookie.split(";").forEach(function(c) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
    } catch(e) {}
    
    // Sign out from Firebase (fire and forget)
    signOutUser().catch(() => {});
    
    // Force hard redirect
    window.location.href = "/";
  };

  const name = (userData.name as string) || "User";
  const email = (userData.email as string) || "";
  const plan = (userData.plan as string) || "free";
  const creditsUsed = (userData.creditsUsed as number) || 0;
  const creditsLimit = (userData.creditsLimit as number) || 3;
  const role = (userData.role as string) || "user";
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const planColors: Record<string, string> = {
    free: "#9CA3AF",
    pro: C.pink,
    enterprise: C.cyan,
  };

  return (
    <div className="fixed top-4 right-4 z-[60]">
      {/* Desktop Menu */}
      <div className="hidden sm:flex items-center gap-3">
        {/* Credits Badge */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
          style={{ backgroundColor: `${planColors[plan] || "#9CA3AF"}15`, color: planColors[plan] || "#9CA3AF" }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
          </svg>
          {creditsUsed}/{plan === "enterprise" ? "\u221E" : creditsLimit}
        </div>

        {/* Plan Badge */}
        <div
          className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
          style={{
            backgroundColor: `${planColors[plan] || "#9CA3AF"}15`,
            color: planColors[plan] || "#9CA3AF",
          }}
        >
          {plan}
        </div>

        {/* Avatar Button */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-2xl transition-all duration-200 hover:shadow-md"
            style={{ backgroundColor: `${C.lightPink}` }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: C.pink, color: C.white }}
            >
              {initials}
            </div>
            <span className="text-xs font-bold max-w-20 truncate" style={{ color: C.text }}>{name}</span>
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill={C.textMuted}>
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Dropdown */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div
                className="absolute right-0 top-full mt-2 w-56 rounded-2xl py-2 z-50 shadow-lg border"
                style={{ backgroundColor: C.white, borderColor: "#F3F4F6" }}
              >
                <div className="px-4 py-2 mb-1" style={{ borderBottom: `1px solid #F3F4F6` }}>
                  <p className="text-sm font-bold" style={{ color: C.text }}>{name}</p>
                  <p className="text-xs" style={{ color: C.textMuted }}>{email}</p>
                </div>

                <button
                  onClick={() => { setShowMenu(false); onShowSubscription(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50"
                  style={{ color: C.text }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill={C.pink}>
                    <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                  </svg>
                  My Plan & Subscription
                </button>

                {/* Admin Panel Link */}
                {role === "admin" && (
                  <a
                    href="/admin"
                    onClick={() => setShowMenu(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50"
                    style={{ color: C.dark }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill={C.cyan}>
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                    </svg>
                    Admin Panel
                  </a>
                )}

                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-red-50"
                  style={{ color: "#DC2626" }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="#DC2626">
                    <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z" clipRule="evenodd" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile Menu Button */}
      <div className="sm:hidden relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-3 py-2 rounded-2xl shadow-md"
          style={{ backgroundColor: C.white }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: C.pink, color: C.white }}
          >
            {initials}
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs font-bold" style={{ color: C.text }}>{name}</span>
            <span
              className="text-[10px] font-bold uppercase"
              style={{ color: planColors[plan] }}
            >
              {plan} &middot; {creditsUsed}/{plan === "enterprise" ? "\u221E" : creditsLimit}
            </span>
          </div>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div
              className="absolute right-0 top-full mt-2 w-56 rounded-2xl py-2 z-50 shadow-lg border"
              style={{ backgroundColor: C.white, borderColor: "#F3F4F6" }}
            >
              <button
                onClick={() => { setShowMenu(false); onShowSubscription(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50"
                style={{ color: C.text }}
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill={C.pink}>
                  <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                </svg>
                My Plan & Subscription
              </button>

              {role === "admin" && (
                <a
                  href="/admin"
                  onClick={() => setShowMenu(false)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50"
                  style={{ color: C.dark }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill={C.cyan}>
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                  </svg>
                  Admin Panel
                </a>
              )}

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-red-50"
                style={{ color: "#DC2626" }}
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="#DC2626">
                  <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z" clipRule="evenodd" />
                </svg>
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Home() {
  const { user, loading, signOut } = useAuth();
  const [showSubscription, setShowSubscription] = useState(false);
  const [currentView, setCurrentView] = useState<"menu" | "avatar">("menu");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";

  // Redirect to menu if user logs out while on avatar view
  useEffect(() => {
    if (!loading && !user && currentView === "avatar") {
      setCurrentView("menu");
    }
  }, [user, loading, currentView]);

  if (loading) {
    return <LoadingScreen />;
  }

  const isAdmin = user?.role === "admin";
  const userData: Record<string, unknown> = {
    name: user?.name || "User",
    email: user?.email || "",
    role: user?.role || "user",
    plan: user?.plan || "free",
    creditsUsed: user?.creditsUsed || 0,
    creditsLimit: user?.creditsLimit || 3,
  };

  if (showSubscription) {
    return (
      <SubscriptionScreen
        userData={userData}
        onComplete={() => setShowSubscription(false)}
      />
    );
  }

  // Main Menu — always visible (for logged-in and non-logged-in users)
  if (currentView === "menu") {
    return (
      <MainMenu
        onNavigate={(dest) => {
          if (dest === "ai-avatar-machine") {
            setCurrentView("avatar");
          }
        }}
      />
    );
  }

  // AI Avatar Machine view — only for authenticated users
  if (!user) {
    return null;
  }

  return (
    <div className="relative">
      {/* Top Bar: Back + Theme Toggle + User Menu */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3"
        style={{
          backgroundColor: isDark ? "#111111" : C.white,
          borderBottom: `1px solid ${isDark ? "#222222" : "#F3F4F6"}`,
        }}
      >
        {/* Back to Menu button */}
        <button
          onClick={() => setCurrentView("menu")}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 hover:shadow-lg"
          style={{
            backgroundColor: isDark ? "#1A1A1A" : C.white,
            color: isDark ? "#E0E0E0" : C.text,
            border: `1.5px solid ${isDark ? "#333333" : C.lightPink}`,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke={C.pink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Menu
        </button>

        {/* Theme Toggle */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl" style={{ backgroundColor: isDark ? "#1A1A1A" : "#F3F4F6" }}>
          {/* Light mode icon (sun) */}
          <button
            onClick={() => setTheme("light")}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200"
            style={{
              backgroundColor: !isDark ? C.white : "transparent",
              boxShadow: !isDark ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            }}
            title="Light theme"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={!isDark ? C.pink : "#666"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
          {/* Dark mode icon (moon) */}
          <button
            onClick={() => setTheme("dark")}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200"
            style={{
              backgroundColor: isDark ? "#2A2A2A" : "transparent",
              boxShadow: isDark ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
            }}
            title="Dark theme"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isDark ? C.pink : "#666"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>
        </div>

        {/* Spacer to balance the back button */}
        <div className="w-[90px]" />
      </div>

      <UserMenu
        userData={userData}
        onShowSubscription={() => setShowSubscription(true)}
        theme={theme}
      />

      {/* Direct Sign Out Button - visible in top bar, no dropdown needed */}
      <button
        onClick={() => {
          try { localStorage.clear(); } catch(e) {}
          try { sessionStorage.clear(); } catch(e) {}
          try {
            document.cookie.split(";").forEach(function(c) {
              document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });
          } catch(e) {}
          signOutUser().catch(() => {});
          window.location.href = "/";
        }}
        className="fixed bottom-6 right-6 z-[70] flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-bold transition-all duration-200 hover:shadow-xl hover:scale-105 active:scale-95"
        style={{
          backgroundColor: "#DC2626",
          color: "#FFFFFF",
        }}
        title="Sign Out"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
          <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z" clipRule="evenodd" />
        </svg>
        Sign Out
      </button>
      <div style={{ marginTop: isDark ? "52px" : "52px" }}>
        <AIAvatarMachine isAdmin={isAdmin} theme={theme} />
      </div>
    </div>
  );
}

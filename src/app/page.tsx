"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import AIAvatarMachine from "@/components/AIAvatarMachine";
import MainMenu from "@/components/MainMenu";
import CarouselView from "@/components/CarouselView";
import PodcastMachineView from "@/components/PodcastMachineView";
import UnifiedVideoLibrary from "@/components/UnifiedVideoLibrary";
import VideoEditor from "@/components/VideoEditor";
import CaptionPanelModal from "@/components/CaptionPanelModal";
import { updateVideoUrlInStorage } from "@/lib/video-store";
import UserProfilePanel from "@/components/UserProfilePanel";

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
              {plan === "enterprise" ? "0/\u221E" : `${creditsUsed}/${creditsLimit}`} credits used
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
                    className="w-full py-3 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all duration-300 disabled:opacity-40 hover:scale-[1.02]"
                    style={{
                      backgroundColor: isCurrent ? "#F3F4F6" : p.id === "free" ? C.dark : p.color,
                      color: isCurrent ? C.textMuted : C.white,
                      boxShadow: !isCurrent ? `0 4px 20px ${p.color}35, 0 0 30px ${p.color}15` : "none",
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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Home() {
  const { user, loading, signOut } = useAuth();
  const [showSubscription, setShowSubscription] = useState(false);
  const [currentView, setCurrentView] = useState<"menu" | "avatar" | "carousel" | "podcast" | "library">("menu");
  const [initialView, setInitialView] = useState<string>("create");
  const [libraryEditorUrl, setLibraryEditorUrl] = useState("");
  const [libraryCaptionUrl, setLibraryCaptionUrl] = useState("");
  const [libraryCaptionId, setLibraryCaptionId] = useState("");
  const [libraryEditorCaptionUploading, setLibraryEditorCaptionUploading] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";

  // Redirect to menu if user logs out while on avatar view
  useEffect(() => {
    if (!loading && !user && (currentView === "avatar" || currentView === "carousel" || currentView === "podcast" || currentView === "library")) {
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
            setInitialView("create");
            setCurrentView("avatar");
          } else if (dest === "ai-viral-carousel") {
            setCurrentView("carousel");
          } else if (dest === "ai-podcast-machine") {
            setCurrentView("podcast");
          }
        }}
        onOpenLibrary={() => {
          setCurrentView("library");
        }}
      />
    );
  }

  // AI Carousel view
  if (currentView === "carousel") {
    return <CarouselView onBack={() => setCurrentView("menu")} isAdmin={!!isAdmin} />;
  }

  // AI Podcast Machine view
  if (currentView === "podcast") {
    return <PodcastMachineView onBack={() => setCurrentView("menu")} isAdmin={!!isAdmin} />;
  }

  // Unified Library view
  if (currentView === "library") {
    const handleCaptionEditedVideo = async (blobUrl: string) => {
      setLibraryEditorCaptionUploading(true);
      try {
        const res = await fetch(blobUrl);
        const blob = await res.blob();
        const file = new File([blob], "edited-video.mp4", { type: "video/mp4" });
        const formData = new FormData();
        formData.append("video", file);

        const uploadRes = await fetch("/api/upload-temp-video", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("Upload failed");
        const data = await uploadRes.json();
        if (!data.url) throw new Error("No URL returned");

        setLibraryCaptionUrl(data.url);
        setLibraryCaptionId("");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to upload edited video";
        console.error("Caption upload error:", msg);
        throw new Error(msg);
      } finally {
        setLibraryEditorCaptionUploading(false);
      }
    };

    return (
      <div className="relative">
        {/* Video Editor for library videos */}
        {libraryEditorUrl && (
          <div ref={(el) => { if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
            <VideoEditor
              videoUrl={libraryEditorUrl}
              onClose={(editedUrl) => {
                setLibraryEditorUrl("");
                if (editedUrl) {
                  // Could update the video URL in storage here
                }
              }}
              onCaptionEditedVideo={handleCaptionEditedVideo}
              accentColor={C.pink}
            />
          </div>
        )}
        <UnifiedVideoLibrary
          onBack={() => { setLibraryEditorUrl(""); setLibraryCaptionUrl(""); setCurrentView("menu"); }}
          onEditVideo={(url) => {
            setLibraryEditorUrl(url);
            setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
          }}
          onCaptionVideo={(url, id) => {
            setLibraryCaptionUrl(url);
            setLibraryCaptionId(id);
          }}
          theme={theme}
        />
        {/* Caption Modal for library videos */}
        {libraryCaptionUrl && (
          <CaptionPanelModal
            videoUrl={libraryCaptionUrl}
            onClose={(captionedUrl) => {
              if (captionedUrl && libraryCaptionId) {
                const userEmail = user?.email || "";
                if (userEmail) {
                  updateVideoUrlInStorage(userEmail, libraryCaptionId, captionedUrl);
                }
              }
              setLibraryCaptionUrl("");
              setLibraryCaptionId("");
            }}
            accentColor={C.cyan}
          />
        )}
      </div>
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
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:shadow-lg"
          style={{
            backgroundColor: isDark ? "#1A1A1A" : C.white,
            color: isDark ? "#E0E0E0" : C.text,
            border: `1.5px solid ${isDark ? "#333333" : C.lightPink}`,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 20px ${C.pink}25, 0 4px 12px ${C.pink}15`; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
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

        {/* User Profile Panel */}
        <UserProfilePanel
          name={userData.name as string}
          email={userData.email as string}
          role={userData.role as string}
          plan={userData.plan as string}
          creditsUsed={userData.creditsUsed as number}
          creditsLimit={userData.creditsLimit as number}
          variant={isDark ? "dark" : "light"}
          onUpgrade={() => setShowSubscription(true)}
          onAdmin={() => { window.location.href = "/admin"; }}
          onSignOut={() => { signOut(); }}
        />
      </div>

      <div style={{ marginTop: isDark ? "52px" : "52px" }}>
        <AIAvatarMachine isAdmin={isAdmin} theme={theme} initialView={initialView} />
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";
import UserProfilePanel from "@/components/UserProfilePanel";

// ─── Colors ─────────────────────────────────────────────────────────────────

const C = {
  pink: "#E461AD",
  dark: "#0A0A0A",
  text: "#1A1A2E",
  white: "#FFFFFF",
  cream: "#FFF8F0",
  beige: "#F5E6D3",
  warmGray: "#B8A99A",
  gold: "#C9A96E",
  softPink: "#FDE8F0",
  lightPink: "#F9E4EE",
  overlay: "rgba(10, 10, 10, 0.45)",
  cardBg: "rgba(255, 255, 255, 0.85)",
  cardBorder: "rgba(228, 97, 173, 0.25)",
};

// ─── Cursor Effect ──────────────────────────────────────────────────────────

function CursorEffect() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const trailPosRef = useRef({ x: 0, y: 0 });
  const isVisible = useRef(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    posRef.current = { x: e.clientX, y: e.clientY };
    if (!isVisible.current) {
      isVisible.current = true;
      if (cursorRef.current) cursorRef.current.style.opacity = "1";
      if (trailRef.current) trailRef.current.style.opacity = "1";
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    isVisible.current = false;
    if (cursorRef.current) cursorRef.current.style.opacity = "0";
    if (trailRef.current) trailRef.current.style.opacity = "0";
  }, []);

  useEffect(() => {
    // Check for touch device
    if (typeof window !== "undefined" && "ontouchstart" in window) return;

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    let rafId: number;

    const animate = () => {
      // Main cursor - snappy
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${posRef.current.x - 6}px, ${posRef.current.y - 6}px)`;
      }
      // Trail - smooth lag
      trailPosRef.current.x += (posRef.current.x - trailPosRef.current.x) * 0.15;
      trailPosRef.current.y += (posRef.current.y - trailPosRef.current.y) * 0.15;
      if (trailRef.current) {
        trailRef.current.style.transform = `translate(${trailPosRef.current.x - 20}px, ${trailPosRef.current.y - 20}px)`;
      }
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(rafId);
    };
  }, [handleMouseMove, handleMouseLeave]);

  return (
    <>
      {/* Glow trail */}
      <div
        ref={trailRef}
        className="fixed top-0 left-0 pointer-events-none z-[10001] rounded-full"
        style={{
          width: 40,
          height: 40,
          opacity: 0,
          background: `radial-gradient(circle, ${C.pink}30 0%, transparent 70%)`,
          transition: "opacity 0.3s ease",
          willChange: "transform",
        }}
      />
      {/* Main dot */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[10001] rounded-full"
        style={{
          width: 12,
          height: 12,
          opacity: 0,
          background: C.pink,
          boxShadow: `0 0 12px ${C.pink}80, 0 0 24px ${C.pink}40`,
          transition: "opacity 0.3s ease",
          willChange: "transform",
        }}
      />
    </>
  );
}

// ─── Auth Modal ─────────────────────────────────────────────────────────────

function AuthModal({ isOpen, onClose, defaultMode }: {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "login" | "signup";
}) {
  const { signIn, signUp, signInGoogle } = useAuth();
  const [isLogin, setIsLogin] = useState(defaultMode !== "signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLogin(defaultMode !== "signup");
      setName("");
      setEmail("");
      setPassword("");
      setError("");
      setLoading(false);
      setGoogleLoading(false);
    }
  }, [isOpen, defaultMode]);

  if (!isOpen) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let result;
      if (isLogin) {
        result = await signIn(email.toLowerCase().trim(), password);
      } else {
        result = await signUp(email.toLowerCase().trim(), password, name.trim());
      }

      if (result.error) {
        setError(result.error);
      } else {
        onClose();
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const result = await signInGoogle();
      if (result.error && result.error.length > 0) {
        setError(result.error);
      } else {
        onClose();
      }
    } catch {
      setError("Google sign-in failed. Please try email sign-in.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
        style={{
          animation: "authModalIn 0.35s ease-out",
          backgroundColor: C.white,
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ backgroundColor: "#F3F4F6", color: C.dark }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Top pink bar */}
        <div className="w-full h-1.5" style={{ backgroundColor: C.pink }} />

        <div className="p-7 sm:p-9">
          {/* Logo */}
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
              style={{ backgroundColor: `${C.softPink}` }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.pink} strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
              </svg>
            </div>
            <h2 className="text-xl font-bold uppercase tracking-wide" style={{ color: C.dark }}>
              {isLogin ? "Welcome Back" : "Create Account"}
            </h2>
          </div>

          {/* ─── Google Button ───────────────────────────────── */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 mb-4"
            style={{
              backgroundColor: "#F3F4F6",
              color: C.dark,
              border: "1.5px solid #E5E7EB",
            }}
          >
            {googleLoading ? (
              <div className="w-5 h-5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px" style={{ backgroundColor: "#E5E7EB" }} />
            <span className="text-xs font-medium" style={{ color: "#9CA3AF" }}>or</span>
            <div className="flex-1 h-px" style={{ backgroundColor: "#E5E7EB" }} />
          </div>

          {/* Tab Toggle */}
          <div
            className="flex rounded-2xl p-1 mb-5"
            style={{ backgroundColor: `${C.lightPink}` }}
          >
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(""); }}
              className="flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200"
              style={{
                backgroundColor: isLogin ? C.pink : "transparent",
                color: isLogin ? C.white : "#6B7280",
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(""); }}
              className="flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200"
              style={{
                backgroundColor: !isLogin ? C.pink : "transparent",
                color: !isLogin ? C.white : "#6B7280",
              }}
            >
              Sign Up
            </button>
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-sm font-medium"
              style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            {!isLogin && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: C.text }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required={!isLogin}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    backgroundColor: `${C.lightPink}40`,
                    border: `1.5px solid ${C.lightPink}`,
                    color: C.text,
                  }}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: C.text }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  backgroundColor: `${C.lightPink}40`,
                  border: `1.5px solid ${C.lightPink}`,
                  color: C.text,
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: C.text }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all"
                  style={{
                    backgroundColor: `${C.lightPink}40`,
                    border: `1.5px solid ${C.lightPink}`,
                    color: C.text,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#9CA3AF" }}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              style={{ backgroundColor: C.pink, color: C.white }}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  {isLogin ? "Signing in..." : "Creating..."}
                </span>
              ) : (
                isLogin ? "Sign In" : "Create Account"
              )}
            </button>
          </form>
        </div>
      </div>

      <style jsx>{`
        @keyframes authModalIn {
          from {
            opacity: 0;
            transform: scale(0.92) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

// ─── Plans Section ──────────────────────────────────────────────────────────

function PlansSection({ onGetStarted }: { onGetStarted: () => void }) {
  const [hoveredPlan, setHoveredPlan] = useState<number | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "",
      credits: "3",
      creditsLabel: "credits",
      features: [
        "3 AI avatar credits",
        "Standard resolution",
        "Basic support",
        "1 concurrent job",
      ],
      color: "#B8A99A",
      highlight: false,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="#B8A99A" strokeWidth="1.5" fill="none" />
        </svg>
      ),
    },
    {
      name: "Pro",
      price: "$19",
      period: ".99/mo",
      credits: "50",
      creditsLabel: "credits",
      features: [
        "50 AI avatar credits",
        "HD 1080p resolution",
        "Priority processing",
        "3 concurrent jobs",
        "Priority support",
      ],
      color: C.pink,
      highlight: true,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke={C.pink} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      name: "Enterprise",
      price: "$49",
      period: ".99/mo",
      credits: "\u221E",
      creditsLabel: "unlimited",
      features: [
        "Unlimited credits",
        "4K resolution",
        "Priority processing",
        "10 concurrent jobs",
        "Custom branding",
        "API access",
      ],
      color: C.gold,
      highlight: false,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7l3-7z" stroke={C.gold} strokeWidth="1.5" fill="none" />
          <circle cx="12" cy="12" r="3" fill={C.gold} opacity="0.3" />
        </svg>
      ),
    },
  ];

  return (
    <div
      ref={sectionRef}
      className="w-full max-w-5xl mx-auto px-5 sm:px-10 py-10 sm:py-16"
    >
      {/* Section Header */}
      <div
        className="text-center mb-10 sm:mb-14 transition-all duration-700"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0)" : "translateY(30px)",
        }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4" style={{ backgroundColor: "rgba(228,97,173,0.15)" }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.pink }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: C.pink }}>Pricing</span>
        </div>
        <h3
          className="text-2xl sm:text-4xl font-bold uppercase tracking-wide mb-3"
          style={{ color: C.white, textShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
        >
          Choose Your <span style={{ color: C.pink }}>Plan</span>
        </h3>
        <p className="text-sm max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.55)" }}>
          Start free and scale as you grow. No hidden fees, cancel anytime.
        </p>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        {plans.map((plan, index) => (
          <div
            key={plan.name}
            className="relative transition-all duration-700 cursor-pointer"
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateY(0)" : "translateY(40px)",
              transitionDelay: `${200 + index * 150}ms`,
            }}
            onMouseEnter={() => setHoveredPlan(index)}
            onMouseLeave={() => setHoveredPlan(null)}
          >
            {/* Highlight glow behind Pro card */}
            {plan.highlight && (
              <div
                className="absolute -inset-1 rounded-3xl transition-opacity duration-500"
                style={{
                  opacity: hoveredPlan === index ? 1 : 0.5,
                  background: `linear-gradient(135deg, ${C.pink}60, ${C.gold}60)`,
                  filter: "blur(12px)",
                }}
              />
            )}

            <div
              className="relative rounded-2xl sm:rounded-3xl p-6 sm:p-7 h-full transition-all duration-300 overflow-hidden"
              style={{
                background: hoveredPlan === index
                  ? "rgba(255,255,255,0.12)"
                  : "rgba(255,255,255,0.06)",
                border: `1.5px solid ${
                  plan.highlight
                    ? `${C.pink}${hoveredPlan === index ? "80" : "50"}`
                    : hoveredPlan === index
                    ? "rgba(255,255,255,0.20)"
                    : "rgba(255,255,255,0.08)"
                }`,
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                transform: hoveredPlan === index ? "translateY(-8px)" : "translateY(0)",
                boxShadow: hoveredPlan === index
                  ? `0 20px 60px ${plan.color}25`
                  : "none",
              }}
            >
              {/* Top gradient line */}
              <div
                className="absolute top-0 left-0 right-0 h-0.5"
                style={{
                  background: plan.highlight
                    ? `linear-gradient(90deg, transparent, ${C.pink}, ${C.gold}, transparent)`
                    : `linear-gradient(90deg, transparent, ${plan.color}60, transparent)`,
                }}
              />

              {/* Popular badge */}
              {plan.highlight && (
                <div className="absolute top-4 right-4">
                  <div
                    className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest"
                    style={{
                      background: `linear-gradient(135deg, ${C.pink}, ${C.gold})`,
                      color: C.white,
                    }}
                  >
                    Popular
                  </div>
                </div>
              )}

              {/* Icon + Name */}
              <div className="mb-5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-all duration-300"
                  style={{
                    backgroundColor: `${plan.color}15`,
                    border: `1px solid ${plan.color}25`,
                    transform: hoveredPlan === index ? "scale(1.1) rotate(-3deg)" : "scale(1)",
                  }}
                >
                  {plan.icon}
                </div>
                <h4
                  className="text-sm font-bold uppercase tracking-wider"
                  style={{ color: plan.color }}
                >
                  {plan.name}
                </h4>
              </div>

              {/* Price */}
              <div className="mb-5">
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-3xl sm:text-4xl font-black"
                    style={{ color: C.white }}
                  >
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {plan.period}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: `${plan.color}20` }}>
                    <svg width="8" height="8" viewBox="0 0 20 20" fill={plan.color}>
                      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {plan.credits} {plan.creditsLabel}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div
                className="h-px mb-5"
                style={{
                  background: `linear-gradient(90deg, transparent, ${plan.color}30, transparent)`,
                }}
              />

              {/* Features */}
              <ul className="space-y-2.5 mb-6">
                {plan.features.map((feature, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs sm:text-sm transition-all duration-500"
                    style={{
                      color: hoveredPlan === index ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.5)",
                      opacity: isVisible ? 1 : 0,
                      transform: isVisible ? "translateX(0)" : "translateX(-10px)",
                      transitionDelay: `${500 + i * 80}ms`,
                    }}
                  >
                    <svg
                      className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                      viewBox="0 0 20 20"
                      fill={plan.color}
                      style={{ opacity: hoveredPlan === index ? 1 : 0.6 }}
                    >
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                onClick={onGetStarted}
                className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300"
                style={{
                  background: plan.highlight
                    ? `linear-gradient(135deg, ${C.pink}, ${C.gold})`
                    : hoveredPlan === index
                    ? `${plan.color}25`
                    : "rgba(255,255,255,0.06)",
                  color: plan.highlight ? C.white : plan.color,
                  border: plan.highlight
                    ? "none"
                    : `1.5px solid ${hoveredPlan === index ? `${plan.color}50` : "rgba(255,255,255,0.10)"}`,
                  boxShadow: plan.highlight && hoveredPlan === index
                    ? `0 8px 30px ${C.pink}40`
                    : "none",
                  transform: hoveredPlan === index ? "scale(1.02)" : "scale(1)",
                }}
              >
                {plan.name === "Free" ? "Get Started" : `Upgrade to ${plan.name}`}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Video Carousel Display for Cards ──────────────────────────────────

const CARD_VIDEOS = ["/videos/1.mp4", "/videos/2.mp4", "/videos/3.mp4", "/videos/4.mp4", "/videos/5.mp4"];

function VideoCardDisplay({ isHovered }: { isHovered: boolean }) {
  const [currentIdx, setCurrentIdx] = useState(() => Math.floor(Math.random() * CARD_VIDEOS.length));
  const [fading, setFading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-rotate videos every 3.5s with fade
  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrentIdx((prev) => (prev + 1) % CARD_VIDEOS.length);
        setFading(false);
      }, 350);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // 9:16 aspect ratio - vertical phone-style
  const frameW = 140;
  const frameH = Math.round(frameW * (16 / 9)); // ~249

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center"
      style={{
        transition: "transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)",
        transform: isHovered ? "scale(1.03)" : "scale(1)",
      }}
    >
      {/* Phone Frame */}
      <div
        className="relative"
        style={{
          width: frameW,
          height: frameH,
          borderRadius: "22px",
          background: "linear-gradient(145deg, #1a1a2e 0%, #0A0A0A 100%)",
          padding: "4px",
          boxShadow: isHovered
            ? `0 12px 40px rgba(228,97,173,0.35), 0 4px 12px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(228,97,173,0.2)`
            : `0 6px 24px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(255,255,255,0.08)`,
          transition: "box-shadow 0.5s ease",
        }}
      >
        {/* Inner screen */}
        <div
          className="relative w-full h-full overflow-hidden"
          style={{
            borderRadius: "18px",
            background: "#000",
          }}
        >
          {/* Video */}
          <video
            key={currentIdx}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full"
            style={{
              objectFit: "cover",
              borderRadius: "18px",
              objectPosition: "center center",
              opacity: fading ? 0 : 1,
              transition: "opacity 0.35s ease",
            }}
          >
            <source src={CARD_VIDEOS[currentIdx]} type="video/mp4" />
          </video>

          {/* Top gradient overlay (notch area) */}
          <div
            className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
            style={{
              height: 32,
              background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)",
              borderRadius: "18px 18px 0 0",
            }}
          >
            {/* Dynamic Island / Notch */}
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                top: 7,
                width: 40,
                height: 10,
                borderRadius: 6,
                backgroundColor: "rgba(0,0,0,0.7)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
          </div>

          {/* Bottom gradient overlay */}
          <div
            className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none"
            style={{
              height: 40,
              background: "linear-gradient(0deg, rgba(0,0,0,0.6) 0%, transparent 100%)",
              borderRadius: "0 0 18px 18px",
            }}
          />

          {/* Play icon overlay */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
            style={{
              opacity: isHovered ? 0 : 0.35,
              transition: "opacity 0.4s ease",
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                backgroundColor: "rgba(0,0,0,0.45)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 18 18" fill="white">
                <path d="M6 3l10 6-10 6V3z" />
              </svg>
            </div>
          </div>

          {/* Hover shimmer */}
          {isHovered && (
            <div
              className="absolute inset-0 z-10 pointer-events-none"
              style={{
                background: "linear-gradient(105deg, transparent 30%, rgba(228,97,173,0.08) 50%, transparent 70%)",
                animation: "cardShimmer 2s ease-in-out infinite",
                borderRadius: "18px",
              }}
            />
          )}
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mt-2">
        {CARD_VIDEOS.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-400"
            style={{
              width: currentIdx === i ? 14 : 4,
              height: 4,
              backgroundColor: currentIdx === i ? C.pink : "rgba(255,255,255,0.25)",
              boxShadow: currentIdx === i ? `0 0 8px ${C.pink}80` : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── MainMenu Component ─────────────────────────────────────────────────────

interface MainMenuProps {
  onNavigate: (destination: string) => void;
}

export default function MainMenu({
  onNavigate,
}: MainMenuProps) {
  const { user, loading, signOut } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [activeCard, setActiveCard] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const isAuthenticated = !!user;
  const userName = user?.name || "User";
  const userPlan = user?.plan || "free";
  const creditsUsed = user?.creditsUsed || 0;
  const creditsLimit = user?.creditsLimit || 3;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleVideoCanPlay = () => {
    setVideoLoaded(true);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  // Fallback: if video doesn't fire canplaythrough within 4s, show it anyway
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!videoLoaded) setVideoLoaded(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [videoLoaded]);

  const handleCardClick = (id: string) => {
    if (!isAuthenticated) {
      setAuthMode("signup");
      setShowAuth(true);
      return;
    }
    onNavigate(id);
  };

  const openSignIn = () => {
    setAuthMode("login");
    setShowAuth(true);
  };

  const openSignUp = () => {
    setAuthMode("signup");
    setShowAuth(true);
  };

  const userEmail = user?.email || "";
  const userRole = user?.role || "user";
  const initials = userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const menuItems = [
    {
      id: "ai-avatar-machine",
      title: "AI Avatar Machine",
      subtitle: "Create AI-Powered Talking Videos",
      description: "Transform your scripts into stunning talking avatar videos with consistent characters across multiple scenes.",
      icon: (
        <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
          <rect x="4" y="8" width="40" height="32" rx="6" stroke={C.pink} strokeWidth="2.5" fill="none" />
          <circle cx="16" cy="20" r="4" stroke={C.pink} strokeWidth="2" fill="none" />
          <path d="M8 36c0-5 3.5-8 8-8s8 3 8 8" stroke={C.pink} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M30 18l4 4m0-4l-4 4" stroke={C.gold} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M28 28h12" stroke={C.pink} strokeWidth="2" strokeLinecap="round" />
          <path d="M28 33h8" stroke={C.pink} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        </svg>
      ),
      accentColor: C.pink,
    },
    {
      id: "coming-soon-1",
      title: "AI Scene Creator",
      subtitle: "Coming Soon",
      description: "Generate beautiful scene backgrounds and environments for your avatar videos using AI image generation.",
      icon: (
        <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
          <rect x="6" y="6" width="36" height="36" rx="6" stroke={C.gold} strokeWidth="2" fill="none" />
          <circle cx="18" cy="18" r="3" stroke={C.gold} strokeWidth="2" fill="none" />
          <path d="M6 32l10-10 8 8 6-6 12 12" stroke={C.gold} strokeWidth="2" fill="none" strokeLinejoin="round" />
        </svg>
      ),
      accentColor: C.gold,
      disabled: true,
    },
    {
      id: "coming-soon-2",
      title: "AI Script Writer",
      subtitle: "Coming Soon",
      description: "Let AI help you craft compelling scripts tailored for avatar video production with natural dialogue.",
      icon: (
        <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="6" width="32" height="36" rx="4" stroke={C.warmGray} strokeWidth="2" fill="none" />
          <path d="M14 16h20M14 22h16M14 28h12" stroke={C.warmGray} strokeWidth="2" strokeLinecap="round" />
          <path d="M30 30l4 4 6-8" stroke={C.pink} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      accentColor: C.warmGray,
      disabled: true,
    },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ fontFamily: "var(--font-etna), 'Etna', sans-serif" }}>
      {/* ─── Cursor Effect ─────────────────────────────────── */}
      <CursorEffect />

      {/* ─── Video Background ─────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        {!videoLoaded && (
          <div className="absolute inset-0" style={{ backgroundColor: C.cream }} />
        )}
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          onCanPlayThrough={handleVideoCanPlay}
          onLoadedData={handleVideoCanPlay}
          preload="auto"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${videoLoaded ? "opacity-100" : "opacity-0"}`}
          style={{ objectFit: "cover" }}
        >
          <source src="/videos/menu-bg.mp4" type="video/mp4" />
        </video>
        <div
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            background: `linear-gradient(180deg, rgba(10,10,10,0.50) 0%, rgba(10,10,10,0.55) 40%, rgba(10,10,10,0.72) 100%)`,
          }}
        />
      </div>

      {/* ─── Content ──────────────────────────────────────────── */}
      <div className="relative z-10 min-h-screen flex flex-col">

        {/* ─── Top Bar ─────────────────────────────────────── */}
        <header className="w-full px-5 sm:px-10 py-5">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            {/* Logo */}
            <div
              className="flex items-center gap-3 transition-all duration-700"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0)" : "translateY(-20px)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: C.pink, boxShadow: `0 4px 15px ${C.pink}40` }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className="hidden sm:block">
                <h1
                  className="text-lg sm:text-xl font-bold uppercase tracking-wider leading-none"
                  style={{ color: C.white, textShadow: "0 2px 10px rgba(0,0,0,0.3)" }}
                >
                  Your AI
                </h1>
                <p
                  className="text-xs sm:text-sm uppercase tracking-widest leading-none"
                  style={{ color: C.pink, textShadow: "0 1px 8px rgba(228,97,173,0.4)" }}
                >
                  Avatar Machine
                </p>
              </div>
            </div>

            {/* Right Side: Auth buttons OR User info */}
            <div
              className="flex items-center gap-2.5 transition-all duration-700 delay-200"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0)" : "translateY(-20px)",
              }}
            >
              {isAuthenticated ? (
                <>
                  {/* Credits Pill */}
                  <div
                    className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-full backdrop-blur-md"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.12)",
                      border: "1px solid rgba(255,255,255,0.18)",
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 20 20" fill={C.gold}>
                      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
                    </svg>
                    <span className="text-xs font-bold" style={{ color: C.white }}>
                      {creditsUsed}/{userPlan === "enterprise" ? "\u221E" : creditsLimit}
                    </span>
                  </div>

                  {/* Plan Badge */}
                  <div
                    className="hidden sm:block px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md"
                    style={{
                      backgroundColor: `${C.pink}25`,
                      color: C.pink,
                      border: `1px solid ${C.pink}35`,
                    }}
                  >
                    {userPlan}
                  </div>

                  {/* User Profile Panel */}
                  <UserProfilePanel
                    name={userName}
                    email={userEmail}
                    role={userRole}
                    plan={userPlan}
                    creditsUsed={creditsUsed}
                    creditsLimit={creditsLimit}
                    variant="dark"
                    onSignOut={() => { signOut(); }}
                  />
                </>
              ) : (
                <>
                  {/* Sign In Button */}
                  <button
                    onClick={openSignIn}
                    className="px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-200 hover:shadow-lg"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.12)",
                      color: C.white,
                      border: "1.5px solid rgba(255,255,255,0.25)",
                      backdropFilter: "blur(10px)",
                    }}
                  >
                    Sign In
                  </button>

                  {/* Sign Up Button */}
                  <button
                    onClick={openSignUp}
                    className="px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-200 hover:shadow-lg"
                    style={{
                      backgroundColor: C.pink,
                      color: C.white,
                      boxShadow: `0 4px 20px ${C.pink}40`,
                    }}
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ─── Main Content ────────────────────────────────── */}
        <main className="flex-1 flex flex-col items-center justify-center px-5 sm:px-10 py-6 sm:py-8">
          <div className="max-w-5xl w-full">
            {/* Hero Text */}
            <div
              className="text-center mb-8 sm:mb-14 transition-all duration-700 delay-100"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0)" : "translateY(20px)",
              }}
            >
              <p
                className="text-sm sm:text-base font-medium uppercase tracking-[0.3em] mb-3"
                style={{ color: C.gold, textShadow: "0 1px 6px rgba(0,0,0,0.3)" }}
              >
                {isAuthenticated ? `Welcome back, ${userName.split(" ")[0]}` : "Create stunning AI videos"}
              </p>
              <h2
                className="text-3xl sm:text-5xl lg:text-6xl font-bold uppercase leading-tight mb-4"
                style={{
                  color: C.white,
                  textShadow: "0 4px 20px rgba(0,0,0,0.4)",
                }}
              >
                What would you
                <br />
                <span style={{ color: C.pink }}>like to create?</span>
              </h2>
              <p
                className="text-sm sm:text-base max-w-lg mx-auto leading-relaxed"
                style={{ color: "rgba(255,255,255,0.65)", textShadow: "0 1px 4px rgba(0,0,0,0.2)" }}
              >
                {isAuthenticated
                  ? "Choose a tool below to start bringing your ideas to life"
                  : "Sign up to start creating AI-powered content with our suite of tools"}
              </p>
            </div>

            {/* Menu Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {menuItems.map((item, index) => {
                const isVideoCard = !item.disabled && item.id === "ai-avatar-machine";
                const isHovered = activeCard === index && !item.disabled;
                return (
                <div
                  key={item.id}
                  className={`transition-all duration-700 ${item.disabled ? "cursor-default" : "cursor-pointer"} ${isVideoCard ? "sm:col-span-1 lg:col-span-1" : ""}`}
                  style={{
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? "translateY(0)" : "translateY(40px)",
                    transitionDelay: `${300 + index * 150}ms`,
                  }}
                  onMouseEnter={() => !item.disabled && setActiveCard(index)}
                  onMouseLeave={() => setActiveCard(null)}
                  onClick={() => !item.disabled && handleCardClick(item.id)}
                >
                  <div
                    className={`relative overflow-hidden rounded-2xl sm:rounded-3xl h-full transition-all duration-500 ${isVideoCard ? "p-5 sm:p-6 flex flex-col items-center" : "p-6 sm:p-7"}`}
                    style={{
                      background: item.disabled
                        ? "rgba(255,255,255,0.06)"
                        : isVideoCard
                          ? "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)"
                          : C.cardBg,
                      border: `1.5px solid ${
                        isHovered
                          ? `${item.accentColor}60`
                          : item.disabled
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(255,255,255,0.25)"
                      }`,
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      boxShadow:
                        isHovered
                          ? isVideoCard
                            ? `0 25px 60px ${item.accentColor}30, 0 8px 30px rgba(0,0,0,0.2)`
                            : `0 20px 60px ${item.accentColor}20, 0 8px 24px rgba(0,0,0,0.1)`
                          : "0 4px 24px rgba(0,0,0,0.06)",
                      transform: isHovered
                        ? isVideoCard
                          ? "translateY(-8px) scale(1.02)"
                          : "translateY(-6px) scale(1.02)"
                        : "translateY(0) scale(1)",
                    }}
                  >
                    {item.disabled && (
                      <div className="absolute inset-0 z-10" style={{ backgroundColor: "rgba(0,0,0,0.15)" }} />
                    )}

                    {!item.disabled && isHovered && (
                      <div
                        className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl transition-opacity duration-500"
                        style={{ backgroundColor: `${item.accentColor}30`, opacity: 1 }}
                      />
                    )}

                    {/* Video display for AI Avatar Machine card - phone mockup */}
                    {isVideoCard && (
                      <div className="relative z-10 mb-5">
                        <VideoCardDisplay isHovered={isHovered} />
                      </div>
                    )}

                    {/* Icon - only show for non-video cards */}
                    {!isVideoCard && (
                    <div className="relative z-10 mb-5">
                      <div
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-300"
                        style={{
                          backgroundColor: item.disabled ? "rgba(255,255,255,0.08)" : `${item.accentColor}10`,
                          border: `1.5px solid ${item.disabled ? "rgba(255,255,255,0.08)" : `${item.accentColor}28`}`,
                          transform: isHovered ? "scale(1.1) rotate(-3deg)" : "scale(1)",
                        }}
                      >
                        {item.icon}
                      </div>
                    </div>
                    )}

                    {/* Title */}
                    <div className={`relative z-10 ${isVideoCard ? "text-center w-full" : ""}`}>
                      <div className={`items-center gap-2 mb-1.5 ${isVideoCard ? "flex justify-center" : "flex"}`}>
                        <h3
                          className="text-base sm:text-lg font-bold uppercase tracking-wide"
                          style={{
                            color: item.disabled ? "rgba(255,255,255,0.35)" : C.dark,
                          }}
                        >
                          {item.title}
                        </h3>
                        {item.disabled && (
                          <span
                            className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: "rgba(255,255,255,0.12)",
                              color: "rgba(255,255,255,0.45)",
                            }}
                          >
                            Soon
                          </span>
                        )}
                      </div>

                      {!item.disabled && (
                        <p
                          className="text-xs font-medium uppercase tracking-wider mb-3"
                          style={{ color: item.accentColor }}
                        >
                          {item.subtitle}
                        </p>
                      )}

                      <p
                        className={`text-xs sm:text-sm leading-relaxed ${isVideoCard ? "max-w-[200px] mx-auto" : ""}`}
                        style={{
                          color: item.disabled ? "rgba(255,255,255,0.3)" : "#6B7280",
                        }}
                      >
                        {item.description}
                      </p>
                    </div>

                    {/* CTA Arrow */}
                    {!item.disabled && (
                      <div className={`relative z-10 mt-5 flex items-center gap-2 ${isVideoCard ? "justify-center" : ""}`}>
                        <span
                          className="text-xs font-bold uppercase tracking-wider"
                          style={{
                            color: item.accentColor,
                            opacity: isHovered ? 1 : 0.6,
                            transition: "opacity 0.3s",
                          }}
                        >
                          {isAuthenticated ? "Get Started" : "Sign Up to Start"}
                        </span>
                        <svg
                          width="16" height="16" viewBox="0 0 16 16" fill="none"
                          style={{
                            color: item.accentColor,
                            transform: isHovered ? "translateX(6px)" : "translateX(0)",
                            transition: "transform 0.3s",
                            opacity: isHovered ? 1 : 0.6,
                          }}
                        >
                          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              );})}
            </div>
          </div>
        </main>

        {/* ─── Plans Section ───────────────────────────────── */}
        <PlansSection onGetStarted={openSignUp} />

        {/* ─── Footer ──────────────────────────────────────── */}
        <footer
          className="w-full px-5 sm:px-10 py-5 transition-all duration-700 delay-700"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(20px)",
          }}
        >
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              Your AI Avatar Machine &middot; Powered by Advanced AI
            </p>
            <div className="flex items-center gap-4">
              {[
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Terms of Service", href: "/terms" },
                { label: "Support", href: "/support" },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-xs font-medium transition-colors hover:opacity-80"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </footer>
      </div>

      {/* ─── Direct Sign Out Button (for logged-in users) ─── */}
      {isAuthenticated && (
        <button
          onClick={() => {
            try { localStorage.clear(); } catch(e) {}
            try { sessionStorage.clear(); } catch(e) {}
            try {
              document.cookie.split(";").forEach(function(c) {
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
              });
            } catch(e) {}
            // Sign out is handled by the auth provider via UserProfilePanel
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
      )}

      {/* ─── Auth Modal ───────────────────────────────────── */}
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        defaultMode={authMode}
      />

      {/* ─── Global Styles ─────────────────────────────────── */}
      <style jsx global>{`
        /* Hide default cursor on desktop for the custom effect */
        @media (pointer: fine) {
          * {
            cursor: none !important;
          }
        }
      `}</style>
    </div>
  );
}

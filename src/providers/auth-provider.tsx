"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import {
  signInWithEmailRest,
  signUpWithEmailRest,
  signInWithGoogleRest,
  updateProfileRest,
  saveAuthSession,
  loadAuthSession,
  clearAuthSession,
  refreshIdToken,
  type StoredAuthSession,
  type RestAuthResponse,
} from "@/lib/firebase";

import {
  getAuth,
  signInWithPopup as firebaseSignInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getApps, initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyAmC4nz1cpnmo-7OVw1E9HaqCf69LsJPBU",
  authDomain: "ai-avatar-machine.firebaseapp.com",
  projectId: "ai-avatar-machine",
  storageBucket: "ai-avatar-machine.firebasestorage.app",
  messagingSenderId: "121083068310",
  appId: "1:121083068310:web:8ec3c4e1461644ad5527b7",
  measurementId: "G-V42TGR1LGE",
};

const fbApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const fbAuth = getAuth(fbApp);
const fbGoogleProvider = new GoogleAuthProvider();

// VIP users with unlimited credits (enterprise access)
const VIP_EMAILS = new Set([
  "adlenbenmechta3@gmail.com",
]);

function isVipUser(email: string): boolean {
  return VIP_EMAILS.has(email.toLowerCase().trim());
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  creditsUsed: number;
  creditsLimit: number;
}

interface AuthContextType {
  firebaseUser: StoredAuthSession | null;
  user: AppUser | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signInGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// ─── Sync user with backend ────────────────────────────────────────────────

async function syncUserWithBackend(idToken: string): Promise<AppUser | null> {
  try {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
      console.error("Session API error:", res.status, errorData.error);
      return null;
    }

    const data = await res.json();
    return data.user;
  } catch (error) {
    console.error("Error syncing user with backend:", error);
    return null;
  }
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StoredAuthSession | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const syncLock = useRef(false);

  // Sync and update user state
  const doSync = useCallback(async (idToken: string, sessionData: StoredAuthSession) => {
    if (syncLock.current) return;
    syncLock.current = true;
    try {
      const appUser = await syncUserWithBackend(idToken);
      if (appUser) {
        setUser(appUser);
        setSession(sessionData);
      } else {
        // Backend sync failed — use session data directly
        console.warn("doSync: Backend sync failed, using session data");
        const email = sessionData.email || "";
        setUser({
          id: sessionData.localId,
          name: sessionData.displayName || sessionData.email?.split("@")[0] || "User",
          email,
          role: isVipUser(email) ? "admin" : "user",
          plan: isVipUser(email) ? "enterprise" : "free",
          creditsUsed: 0,
          creditsLimit: isVipUser(email) ? 999999 : 3,
        });
        setSession(sessionData);
      }
    } finally {
      syncLock.current = false;
    }
  }, []);

  // On mount, check for existing session
  useEffect(() => {
    const initAuth = async () => {
      const stored = loadAuthSession();

      if (stored) {
        let idToken = stored.idToken;

        // Check if token needs refresh
        if (Date.now() > stored.expiresAt - 5 * 60 * 1000) {
          try {
            const refreshed = await refreshIdToken(stored.refreshToken);
            const newSession = saveAuthSession(refreshed);
            idToken = refreshed.idToken;
            setSession(newSession);
          } catch {
            // Refresh failed, clear session
            clearAuthSession();
            setSession(null);
            setLoading(false);
            return;
          }
        } else {
          setSession(stored);
        }

        // Sync with backend
        await doSync(idToken, stored);
      }

      setLoading(false);
    };

    initAuth();
  }, [doSync]);

  // Sign up with email/password
  const signUp = useCallback(async (email: string, password: string, name: string) => {
    try {
      // Use REST API to create account (bypasses domain check)
      const data = await signUpWithEmailRest(email.toLowerCase().trim(), password);

      // Update display name
      try {
        await updateProfileRest(data.idToken, name.trim());
      } catch (e) {
        console.warn("Could not update profile name:", e);
      }

      // Save session
      const sessionData = saveAuthSession(data);
      setSession(sessionData);

      // Sync with backend
      const appUser = await syncUserWithBackend(data.idToken);
      if (appUser) setUser(appUser);

      return {};
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const code = err.code || "";
      const msg = err.message || "Something went wrong.";

      if (code.includes("EMAIL_EXISTS")) {
        return { error: "An account with this email already exists." };
      }
      if (code.includes("WEAK_PASSWORD")) {
        return { error: "Password should be at least 6 characters." };
      }
      if (code.includes("INVALID_EMAIL")) {
        return { error: "Invalid email address." };
      }
      console.error("Sign up error:", code, msg);
      return { error: msg };
    }
  }, []);

  // Sign in with email/password
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      // Use REST API to sign in (bypasses domain check)
      const data = await signInWithEmailRest(email.toLowerCase().trim(), password);

      // Save session
      const sessionData = saveAuthSession(data);
      setSession(sessionData);

      // Sync with backend
      const appUser = await syncUserWithBackend(data.idToken);
      if (appUser) setUser(appUser);

      return {};
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const code = err.code || "";
      const msg = err.message || "Something went wrong.";

      if (code.includes("INVALID_LOGIN_CREDENTIALS") || code.includes("USER_NOT_FOUND") || code.includes("WRONG_PASSWORD")) {
        return { error: "Invalid email or password." };
      }
      if (code.includes("TOO_MANY_ATTEMPTS")) {
        return { error: "Too many attempts. Please try again later." };
      }
      if (code.includes("INVALID_EMAIL")) {
        return { error: "Invalid email address." };
      }
      console.error("Sign in error:", code, msg);
      return { error: msg };
    }
  }, []);

  // Sign in with Google
  // Strategy 1: Firebase signInWithPopup (requires domain in Firebase authorized domains)
  // Strategy 2: REST API with Google ID token (bypasses domain check)
  const signInGoogle = useCallback(async () => {
    // ── Strategy 1: Firebase SDK signInWithPopup (most reliable) ──
    try {
      const result = await firebaseSignInWithPopup(fbAuth, fbGoogleProvider);
      const firebaseUser = result.user;
      const idToken = await firebaseUser.getIdToken();

      // Build session from Firebase user
      const sessionData: RestAuthResponse = {
        idToken,
        refreshToken: firebaseUser.refreshToken,
        expiresIn: "3600",
        localId: firebaseUser.uid,
        email: firebaseUser.email || "",
        displayName: firebaseUser.displayName || "",
        photoUrl: firebaseUser.photoURL || "",
      };

      const savedSession = saveAuthSession(sessionData);
      setSession(savedSession);

      // Sync with backend — use fallback if backend fails
      let appUser = await syncUserWithBackend(idToken);
      if (!appUser) {
        // Backend sync failed — create a local user from Firebase data
        console.warn("Backend sync failed, using local Firebase user data");
        const email = firebaseUser.email || "";
        appUser = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
          email,
          role: isVipUser(email) ? "admin" : "user",
          plan: isVipUser(email) ? "enterprise" : "free",
          creditsUsed: 0,
          creditsLimit: isVipUser(email) ? 999999 : 3,
        };
      }
      setUser(appUser);

      return {};
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.warn("Firebase signInWithPopup failed:", err.code, err.message);

      // If popup was closed by user, don't show error
      if (err.code === "auth/popup-closed-by-user") {
        return { error: "" };
      }

      // If domain is not authorized, show clear message
      if (err.code === "auth/unauthorized-domain") {
        const currentDomain = typeof window !== "undefined" ? window.location.hostname : "";
        return {
          error: `Domain "${currentDomain}" is not authorized. Please add it in Firebase Console → Authentication → Settings → Authorized domains, then try again.`,
        };
      }

      // For other errors, try REST API fallback
    }

    // ── Strategy 2: GIS One Tap → REST API (bypasses domain check) ──
    try {
      const { initGoogleSignIn } = await import("@/lib/firebase");
      const gis = await initGoogleSignIn();
      if (gis) {
        const token = await gis.getToken();
        if (token) {
          const data = await signInWithGoogleRest(token);
          const sessionData = saveAuthSession(data);
          setSession(sessionData);

          let appUser = await syncUserWithBackend(data.idToken);
          if (!appUser) {
            console.warn("Backend sync failed, using local user data from REST");
            const email = data.email || "";
            appUser = {
              id: data.localId,
              name: data.displayName || data.email?.split("@")[0] || "User",
              email,
              role: isVipUser(email) ? "admin" : "user",
              plan: isVipUser(email) ? "enterprise" : "free",
              creditsUsed: 0,
              creditsLimit: isVipUser(email) ? 999999 : 3,
            };
          }
          setUser(appUser);

          return {};
        }
      }
    } catch (error) {
      console.warn("GIS fallback failed:", error);
    }

    // ── All strategies failed ──
    return { error: "Google sign-in failed. Please try again or sign in with email." };
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    clearAuthSession();
    setUser(null);
    setSession(null);
  }, []);

  // Refresh user data from database
  const refreshUser = useCallback(async () => {
    const stored = loadAuthSession();
    if (stored) {
      let idToken = stored.idToken;
      if (Date.now() > stored.expiresAt - 5 * 60 * 1000) {
        try {
          const refreshed = await refreshIdToken(stored.refreshToken);
          saveAuthSession(refreshed);
          idToken = refreshed.idToken;
        } catch {
          clearAuthSession();
          setUser(null);
          return;
        }
      }
      const appUser = await syncUserWithBackend(idToken);
      if (appUser) setUser(appUser);
    }
  }, []);

  // Authenticated fetch - attaches Firebase ID token
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const stored = loadAuthSession();
    if (stored) {
      let token = stored.idToken;
      // Refresh if needed
      if (Date.now() > stored.expiresAt - 5 * 60 * 1000) {
        try {
          const refreshed = await refreshIdToken(stored.refreshToken);
          saveAuthSession(refreshed);
          token = refreshed.idToken;
        } catch {
          // Ignore, use expired token
        }
      }

      if (token) {
        const headers = new Headers(options.headers);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(url, { ...options, headers });
      }
    }
    return fetch(url, options);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser: session,
        user,
        loading,
        signUp,
        signIn,
        signInGoogle,
        signOut,
        refreshUser,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

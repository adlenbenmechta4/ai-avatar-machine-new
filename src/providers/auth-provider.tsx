"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import {
  getCurrentUser,
  onAuthChange,
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  type User,
} from "@/lib/firebase";

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
  firebaseUser: User | null;
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

async function syncUserWithBackend(fbUser: User): Promise<AppUser | null> {
  try {
    const token = await fbUser.getIdToken(true); // forceRefresh=true to get fresh token
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
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
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const syncLock = useRef(false);

  // Sync and update user state
  const doSync = useCallback(async (fbUser: User | null) => {
    if (!fbUser || syncLock.current) return;

    syncLock.current = true;
    try {
      const appUser = await syncUserWithBackend(fbUser);
      if (appUser) {
        setUser(appUser);
      }
    } finally {
      syncLock.current = false;
    }
  }, []);

  // Listen for Firebase auth state changes
  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthChange(async (fbUser) => {
      if (!mounted) return;

      setFirebaseUser(fbUser);
      setLoading(false);

      if (fbUser) {
        await doSync(fbUser);
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [doSync]);

  // Sign up with email/password
  const signUp = useCallback(async (email: string, password: string, name: string) => {
    try {
      const fbUser = await signUpWithEmail(email, password);
      await fbUser.updateProfile({ displayName: name });

      // Wait for onAuthChange to fire and sync
      // Give it a moment then try manual sync as backup
      let appUser = await syncUserWithBackend(fbUser);
      if (appUser) {
        setUser(appUser);
      }

      return {};
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const code = err.code || "";

      if (code === "auth/email-already-in-use") {
        return { error: "An account with this email already exists." };
      }
      if (code === "auth/weak-password") {
        return { error: "Password should be at least 6 characters." };
      }
      if (code === "auth/invalid-email") {
        return { error: "Invalid email address." };
      }
      console.error("Sign up error:", code, err.message);
      return { error: err.message || "Something went wrong." };
    }
  }, []);

  // Sign in with email/password
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmail(email, password);
      // onAuthChange will handle syncing
      return {};
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const code = err.code || "";

      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        return { error: "Invalid email or password." };
      }
      if (code === "auth/too-many-requests") {
        return { error: "Too many attempts. Please try again later." };
      }
      console.error("Sign in error:", code, err.message);
      return { error: err.message || "Something went wrong." };
    }
  }, []);

  // Sign in with Google
  const signInGoogle = useCallback(async () => {
    try {
      const result = await signInWithGoogle();

      // Explicitly sync after Google sign-in (don't rely only on onAuthChange)
      const appUser = await syncUserWithBackend(result);
      if (appUser) {
        setUser(appUser);
        setFirebaseUser(result);
      } else {
        // Retry once after a short delay
        await new Promise(r => setTimeout(r, 1000));
        const retryUser = await syncUserWithBackend(result);
        if (retryUser) {
          setUser(retryUser);
          setFirebaseUser(result);
        } else {
          console.error("Google sign-in sync failed after retry");
        }
      }

      return {};
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error("Google sign-in error:", err.code, err.message);
      if (err.code === "auth/popup-closed-by-user") {
        return { error: "" }; // User closed popup, not an error
      }
      return { error: err.message || "Google sign-in failed." };
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await signOutUser();
    } catch (e) {
      console.error("Firebase sign-out error:", e);
    }
    setUser(null);
    setFirebaseUser(null);
  }, []);

  // Refresh user data from database
  const refreshUser = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      const appUser = await syncUserWithBackend(currentUser);
      if (appUser) setUser(appUser);
    }
  }, []);

  // Authenticated fetch - attaches Firebase ID token
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      try {
        const token = await currentUser.getIdToken();
        const headers = new Headers(options.headers);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(url, { ...options, headers });
      } catch {
        // If token fails, just make normal request
      }
    }
    return fetch(url, options);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
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

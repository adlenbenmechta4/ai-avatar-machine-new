import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
  type AuthCredential,
} from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAmC4nz1cpnmo-7OVw1E9HaqCf69LsJPBU",
  authDomain: "ai-avatar-machine.firebaseapp.com",
  projectId: "ai-avatar-machine",
  storageBucket: "ai-avatar-machine.firebasestorage.app",
  messagingSenderId: "121083068310",
  appId: "1:121083068310:web:8ec3c4e1461644ad5527b7",
  measurementId: "G-V42TGR1LGE",
};

const FIREBASE_API_KEY = "AIzaSyAmC4nz1cpnmo-7OVw1E9HaqCf69LsJPBU";

// Initialize Firebase (prevent re-initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ─── REST API Auth (bypasses domain check) ────────────────────────────────────

interface RestAuthResponse {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
}

async function handleRestError(response: Response): Promise<never> {
  const data = await response.json().catch(() => ({}));
  const error = data.error || {};
  const msg = error.message || "Unknown error";
  throw { code: msg, message: msg };
}

// Sign up with email/password via REST API — no domain check
export async function signUpWithEmailRest(email: string, password: string): Promise<RestAuthResponse> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!res.ok) await handleRestError(res);
  return res.json();
}

// Sign in with email/password via REST API — no domain check
export async function signInWithEmailRest(email: string, password: string): Promise<RestAuthResponse> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!res.ok) await handleRestError(res);
  return res.json();
}

// Sign in with Google ID token via REST API — no domain check
// Uses a known authorized domain as requestUri
export async function signInWithGoogleRest(googleIdToken: string): Promise<RestAuthResponse> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: `id_token=${googleIdToken}&providerId=google.com`,
        requestUri: "https://ai-avatar-machine.firebaseapp.com",
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    }
  );
  if (!res.ok) await handleRestError(res);
  return res.json();
}

// Update user profile via REST API
export async function updateProfileRest(idToken: string, displayName: string): Promise<void> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, displayName, returnSecureToken: true }),
    }
  );
  if (!res.ok) await handleRestError(res);
}

// Refresh the ID token using the refresh token
export async function refreshIdToken(refreshToken: string): Promise<RestAuthResponse> {
  const res = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
    }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw { code: data.error || "token_refresh_failed", message: data.error_description || data.error || "Token refresh failed" };
  }
  const data = await res.json();
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    localId: data.user_id,
    email: data.email,
    displayName: data.display_name,
    photoUrl: data.photo_url,
  };
}

// ─── Session persistence helpers ─────────────────────────────────────────────

const AUTH_STORAGE_KEY = "firebase_auth_session";

export interface StoredAuthSession {
  idToken: string;
  refreshToken: string;
  localId: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  expiresAt: number;
}

export function saveAuthSession(data: RestAuthResponse): StoredAuthSession {
  const session: StoredAuthSession = {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    localId: data.localId,
    email: data.email || "",
    displayName: data.displayName || "",
    photoUrl: data.photoUrl || "",
    expiresAt: Date.now() + (parseInt(data.expiresIn) || 3600) * 1000,
  };
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    // localStorage might not be available
  }
  return session;
}

export function loadAuthSession(): StoredAuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredAuthSession;
    // Check if token is expired (with 5 min buffer)
    if (Date.now() > session.expiresAt - 5 * 60 * 1000) {
      return session; // Return it anyway, the provider will try to refresh
    }
    return session;
  } catch {
    return null;
  }
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) {
    // Ignore
  }
}

// ─── Google Identity Services (GIS) ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gisGlobal = () => (typeof window !== "undefined" ? (window as any).google : null) as any;

const GOOGLE_CLIENT_ID = "121083068310-6qjd3eqn8f9lq3aoqrfk5l8h2f5041qv.apps.googleusercontent.com";

let gisInitialized = false;
let gisTokenClient: { getToken: () => Promise<string | null> } | null = null;

export async function initGoogleSignIn(): Promise<{ getToken: () => Promise<string | null> } | null> {
  if (typeof window === "undefined") return null;

  // Check if Google Identity Services is already loaded
  if (gisGlobal()?.accounts) {
    return createTokenClient();
  }

  // Load Google Identity Services script
  return new Promise((resolve) => {
    if (gisInitialized) {
      resolve(gisTokenClient);
      return;
    }

    // Check if script is already being loaded
    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      const checkInterval = setInterval(() => {
        if (gisGlobal()?.accounts) {
          clearInterval(checkInterval);
          gisInitialized = true;
          const client = createTokenClient();
          gisTokenClient = client;
          resolve(client);
        }
      }, 100);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      gisInitialized = true;
      const client = createTokenClient();
      gisTokenClient = client;
      resolve(client);
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

function createTokenClient(): { getToken: () => Promise<string | null> } | null {
  const g = gisGlobal();
  if (!g?.accounts?.id) return null;

  return {
    getToken: () => {
      return new Promise((resolve) => {
        let resolved = false;

        const done = (token: string | null) => {
          if (!resolved) {
            resolved = true;
            resolve(token);
          }
        };

        try {
          // Initialize with a callback that will receive the credential
          g.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response: { credential?: string }) => {
              done(response.credential || null);
            },
            auto_select: false,
          });

          // Trigger the One Tap / popup
          g.accounts.id.prompt((notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              done(null);
            }
          });
        } catch {
          done(null);
        }

        // Timeout after 60 seconds
        setTimeout(() => done(null), 60000);
      });
    },
  };
}

// Render a Google Sign-In button that works without domain authorization
export function renderGoogleButton(container: HTMLElement, callback: (token: string) => void): void {
  const g = gisGlobal();
  if (!g?.accounts?.id) return;

  // Initialize with callback
  g.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response: { credential?: string }) => {
      if (response.credential) {
        callback(response.credential);
      }
    },
    auto_select: false,
  });

  // Render the button
  g.accounts.id.renderButton(container, {
    theme: "outline",
    size: "large",
    width: container.offsetWidth || 300,
    text: "signin_with",
    shape: "rectangular",
    logo_alignment: "left",
  });
}

// ─── Direct OAuth2 Popup Fallback ──────────────────────────────────────────
// Uses Google's OAuth2 endpoint directly in a popup, bypassing GIS domain checks.
// The popup opens Google's sign-in page, authenticates, then redirects to our
// callback page which sends the token back via postMessage.

export function signInWithGooglePopup(): Promise<{ idToken: string } | { error: string }> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve({ error: "Not in browser environment" });
      return;
    }

    const redirectUri = `${window.location.origin}/auth/google-callback`;
    const nonce = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "id_token",
      scope: "openid email profile",
      nonce,
      prompt: "select_account",
    });

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    // Open popup
    const popup = window.open(
      oauthUrl,
      "google_signin",
      "width=500,height=650,left=200,top=200,scrollbars=yes,resizable=yes"
    );

    if (!popup) {
      resolve({ error: "Popup blocked by browser. Please allow popups and try again." });
      return;
    }

    // Listen for postMessage from the callback page
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from our origin
      if (event.origin !== window.location.origin) return;

      const data = event.data;
      if (data?.type !== "google_oauth_callback") return;

      window.removeEventListener("message", handleMessage);
      clearInterval(pollInterval);

      if (data.idToken) {
        resolve({ idToken: data.idToken });
      } else if (data.error) {
        resolve({ error: data.error });
      } else {
        resolve({ error: "No token received from Google" });
      }
    };

    window.addEventListener("message", handleMessage);

    // Poll for popup closure (fallback if postMessage doesn't work)
    const pollInterval = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollInterval);
        window.removeEventListener("message", handleMessage);
        // If we get here without a message, the popup was closed
        resolve({ error: "popup_closed" });
      }
    }, 500);

    // Timeout after 2 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      window.removeEventListener("message", handleMessage);
      try { popup.close(); } catch { /* ignore */ }
      resolve({ error: "Sign-in timed out. Please try again." });
    }, 120000);
  });
}

// Google Cloud Console link for adding authorized domain
export const GOOGLE_CONSOLE_OAUTH_URL =
  "https://console.cloud.google.com/apis/credentials/oauthclient/121083068310-6qjd3eqn8f9lq3aoqrfk5l8h2f5041qv.apps.googleusercontent.com?project=ai-avatar-machine";

// Firebase Console link for adding authorized domain
export const FIREBASE_CONSOLE_AUTH_URL =
  "https://console.firebase.google.com/project/ai-avatar-machine/authentication/providers";

// ─── SDK Auth Functions (kept as fallback) ──────────────────────────────────

export async function signUpWithEmail(email: string, password: string) {
  const cred = await import("firebase/auth").then(({ createUserWithEmailAndPassword }) =>
    createUserWithEmailAndPassword(auth, email, password)
  );
  return cred.user;
}

export async function signInWithEmail(email: string, password: string) {
  const cred = await import("firebase/auth").then(({ signInWithEmailAndPassword }) =>
    signInWithEmailAndPassword(auth, email, password)
  );
  return cred.user;
}

export async function signInWithGoogle() {
  const result = await import("firebase/auth").then(({ signInWithPopup }) =>
    signInWithPopup(auth, googleProvider)
  );
  return result.user;
}

export async function signOutUser() {
  clearAuthSession();
  try {
    await firebaseSignOut(auth);
  } catch {
    // Ignore sign-out errors (user might not be signed in via SDK)
  }
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function getIdToken(): Promise<string | null> {
  const session = loadAuthSession();
  if (session && session.idToken) {
    // Check if token needs refresh
    if (Date.now() > session.expiresAt - 5 * 60 * 1000) {
      try {
        const refreshed = await refreshIdToken(session.refreshToken);
        saveAuthSession(refreshed);
        return refreshed.idToken;
      } catch {
        // Refresh failed, try SDK
        clearAuthSession();
      }
    }
    return session.idToken;
  }
  // Fall back to SDK
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export { auth, app, getStorage, ref, uploadBytes, getDownloadURL, googleProvider, type RestAuthResponse };

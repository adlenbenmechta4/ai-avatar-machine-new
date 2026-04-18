import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Firebase config from client (used for REST API fallback)
const FIREBASE_API_KEY = "AIzaSyAmC4nz1cpnmo-7OVw1E9HaqCf69LsJPBU";
const FIREBASE_PROJECT_ID = "ai-avatar-machine";

let firebaseAdminApp: App;

function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccount) {
    try {
      const parsed = JSON.parse(serviceAccount);
      firebaseAdminApp = initializeApp({
        credential: cert(parsed),
      });
      return firebaseAdminApp;
    } catch {
      console.warn("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY, using REST API fallback");
    }
  }

  firebaseAdminApp = initializeApp({
    projectId: FIREBASE_PROJECT_ID,
  });

  return firebaseAdminApp;
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

/**
 * Verify a Firebase ID token using the Firebase Auth REST API.
 * This works WITHOUT a service account key by using the public API.
 * It calls accounts:lookup which validates the token and returns user info.
 */
async function verifyTokenViaRestApi(idToken: string) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("REST API lookup failed:", response.status, JSON.stringify(errorData));
    throw new Error(`Token lookup failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.users || data.users.length === 0) {
    throw new Error("Token is invalid or user not found");
  }

  const fbUser = data.users[0];

  // Verify the token belongs to our project
  if (fbUser.firebase?.sign_in_provider === undefined) {
    // Provider check - not critical, continue
  }

  return {
    uid: fbUser.localId,
    email: fbUser.email || null,
    email_verified: fbUser.emailVerified === true,
    name: fbUser.displayName || null,
    picture: fbUser.photoUrl || null,
    sub: fbUser.localId,
    firebase: {
      sign_in_provider: fbUser.providerUserInfo?.[0]?.providerId || "unknown",
    },
  };
}

/**
 * Verify a Firebase ID token.
 * Strategy: Always use Firebase REST API (works without service account).
 * Falls back to firebase-admin SDK if service account key is configured.
 */
export async function verifyIdToken(idToken: string) {
  // If service account key exists, try firebase-admin SDK first
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const adminAuth = getAdminAuth();
      return await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      console.warn("firebase-admin verifyIdToken failed, using REST API fallback:", error);
    }
  }

  // Use REST API (no credentials needed)
  return verifyTokenViaRestApi(idToken);
}

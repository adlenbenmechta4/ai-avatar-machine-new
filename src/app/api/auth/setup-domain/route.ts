import { NextRequest, NextResponse } from "next/server";

const FIREBASE_API_KEY = "AIzaSyAmC4nz1cpnmo-7OVw1E9HaqCf69LsJPBU";
const FIREBASE_PROJECT_ID = "ai-avatar-machine";

/**
 * POST /api/auth/setup-domain
 *
 * Attempts to add the current domain to Firebase's authorized domains list.
 * This is a helper endpoint that the frontend can call to auto-configure
 * the domain when Google Sign-In fails.
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_KEY environment variable (for admin API access)
 * Falls back to: Firebase REST API (limited capabilities)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const domain = body.domain;

    if (!domain) {
      return NextResponse.json(
        { success: false, error: "Domain is required" },
        { status: 400 }
      );
    }

    const fullDomain = domain.startsWith("http") ? domain : `https://${domain}`;
    const results: { step: string; success: boolean; message: string }[] = [];

    // ── Step 1: Try to add domain via Firebase Admin API (needs service account) ──
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (serviceAccountKey) {
      try {
        const sa = JSON.parse(serviceAccountKey);
        const { googleAuth } = await import("google-auth-library");
        const auth = new googleAuth.GoogleAuth({
          credentials: {
            client_email: sa.client_email,
            private_key: sa.private_key,
          },
          scopes: ["https://www.googleapis.com/auth/firebase.auth.config"],
        });

        const client = await auth.getClient();
        const projectId = sa.project_id || FIREBASE_PROJECT_ID;

        // Get current config
        const url = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`;
        const currentConfig = await fetch(url, {
          headers: {
            Authorization: `Bearer ${(await client.getAccessToken()).token}`,
          },
        }).then((r) => r.json());

        const currentDomains: string[] = currentConfig.authorizedDomains || [];

        // Check if domain is already there
        if (!currentDomains.includes(domain) && !currentDomains.includes(fullDomain)) {
          // Add the domain
          currentDomains.push(domain);

          const updateRes = await fetch(url, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${(await client.getAccessToken()).token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ authorizedDomains: currentDomains }),
          });

          if (updateRes.ok) {
            results.push({
              step: "Firebase authorized domains",
              success: true,
              message: `Added ${domain} to Firebase authorized domains`,
            });
          } else {
            const errText = await updateRes.text();
            results.push({
              step: "Firebase authorized domains",
              success: false,
              message: `Failed to update: ${errText}`,
            });
          }
        } else {
          results.push({
            step: "Firebase authorized domains",
            success: true,
            message: `${domain} is already in Firebase authorized domains`,
          });
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        results.push({
          step: "Firebase authorized domains (Admin SDK)",
          success: false,
          message: `Admin SDK failed: ${msg}`,
        });
      }
    } else {
      results.push({
        step: "Firebase authorized domains (Admin SDK)",
        success: false,
        message: "FIREBASE_SERVICE_ACCOUNT_KEY not configured — cannot update programmatically",
      });
    }

    // ── Step 2: Provide manual setup instructions ──
    results.push({
      step: "Google Cloud Console (manual)",
      success: false,
      message: `Go to: https://console.cloud.google.com/apis/credentials/oauthclient/121083068310-6qjd3eqn8f9lq3aoqrfk5l8h2f5041qv.apps.googleusercontent.com?project=${FIREBASE_PROJECT_ID} — Add "${fullDomain}" to "Authorized JavaScript origins" and "Authorized redirect URIs"`,
    });

    results.push({
      step: "Firebase Console (manual)",
      success: false,
      message: `Go to: https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings — Add "${domain}" to "Authorized domains"`,
    });

    const anySuccess = results.some((r) => r.success);
    return NextResponse.json({
      success: anySuccess,
      domain,
      results,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

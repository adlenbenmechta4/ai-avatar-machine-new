"use client";

import { useEffect } from "react";

/**
 * Google OAuth Callback Page
 *
 * This page handles the redirect from Google's OAuth consent screen.
 * It extracts the ID token from the URL hash fragment and sends it
 * back to the parent window via postMessage, then closes the popup.
 *
 * This is used as a fallback when Google Identity Services (GIS) One Tap
 * is not available (e.g., domain not in authorized JavaScript origins).
 */
export default function GoogleOAuthCallback() {
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1));

    const idToken = params.get("id_token");
    const access_token = params.get("access_token");
    const error = params.get("error");

    if (idToken) {
      // Send the Google ID token to the parent window
      window.opener?.postMessage(
        { type: "google_oauth_callback", idToken, access_token },
        window.location.origin
      );
    } else if (error) {
      window.opener?.postMessage(
        { type: "google_oauth_callback", error: decodeURIComponent(error || "OAuth error") },
        window.location.origin
      );
    } else {
      // No token found - might be an auth code flow
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        window.opener?.postMessage(
          { type: "google_oauth_callback", code },
          window.location.origin
        );
      } else {
        window.opener?.postMessage(
          { type: "google_oauth_callback", error: "No token or code received" },
          window.location.origin
        );
      }
    }

    // Close the popup after sending the message
    setTimeout(() => {
      window.close();
    }, 500);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "system-ui, sans-serif",
        background: "#0A0A0A",
        color: "#fff",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 40,
            height: 40,
            border: "3px solid rgba(228, 97, 173, 0.3)",
            borderTopColor: "#E461AD",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 16px",
          }}
        />
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>
          Completing sign-in...
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

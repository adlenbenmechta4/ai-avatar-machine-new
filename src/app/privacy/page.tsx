"use client";

import { useAuth } from "@/providers/auth-provider";

const COLORS = {
  pink: "#E461AD",
  cyan: "#16B1DE",
  bg: "#0A0A0A",
  cardBg: "#111111",
  cardBorder: "#1E1E1E",
  text: "#F3F4F6",
  textMuted: "#9CA3AF",
  lightPink: "rgba(228,97,173,0.08)",
};

export default function PrivacyPolicyPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.bg, color: COLORS.text }}>
      {/* Back button */}
      <div className="max-w-3xl mx-auto px-5 pt-6">
        <button
          onClick={() => window.location.href = user ? "/" : "/"}
          className="flex items-center gap-2 text-sm font-medium transition-all hover:opacity-80"
          style={{ color: COLORS.textMuted }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back
        </button>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-5 py-10">
        <div className="rounded-3xl p-1 mb-8" style={{ backgroundColor: COLORS.lightPink }}>
          <div className="rounded-[22px] p-8 sm:p-10" style={{ backgroundColor: COLORS.cardBg }}>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-wide mb-2">
              <span style={{ color: COLORS.pink }}>Privacy</span> Policy
            </h1>
            <p className="text-sm" style={{ color: COLORS.textMuted }}>Last updated: April 2026</p>
          </div>
        </div>

        <div className="space-y-6 text-sm sm:text-base leading-relaxed" style={{ color: COLORS.textMuted }}>
          <section className="rounded-2xl p-6 border" style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.cardBorder }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: COLORS.text }}>1. Information We Collect</h2>
            <p className="mb-2">We collect information you provide directly to us, including your name, email address, and any images or content you upload to create AI avatars and videos. We also collect usage data such as generation history, preferences, and interaction patterns to improve our service.</p>
            <p>Account credentials are securely stored using industry-standard hashing. We never store your API keys in plain text and they are transmitted only over encrypted connections.</p>
          </section>

          <section className="rounded-2xl p-6 border" style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.cardBorder }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: COLORS.text }}>2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To provide and maintain our AI avatar and video generation services</li>
              <li>To process your requests for image and video creation using third-party AI APIs</li>
              <li>To manage your account, credits, and subscription status</li>
              <li>To communicate with you about updates, changes, or support inquiries</li>
              <li>To improve our platform through anonymous usage analytics</li>
              <li>To prevent fraud and ensure platform security</li>
            </ul>
          </section>

          <section className="rounded-2xl p-6 border" style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.cardBorder }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: COLORS.text }}>3. Third-Party Services</h2>
            <p className="mb-2">Our service relies on third-party AI providers (such as Kie.ai and HeyGen) to generate images and videos. When you submit a generation request, your prompt and uploaded images are sent to these providers under their own privacy policies. We encourage you to review their privacy policies as well.</p>
            <p>We use Firebase for authentication and may use Stripe for payment processing. These services handle your data according to their respective privacy policies and industry security standards.</p>
          </section>

          <section className="rounded-2xl p-6 border" style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.cardBorder }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: COLORS.text }}>4. Data Storage & Security</h2>
            <p>Your data is stored on secure, encrypted servers. Generated images and videos are stored temporarily and may be cached for performance. You can delete your generated content at any time from your video library. We implement security measures to protect against unauthorized access, alteration, or disclosure of your data.</p>
          </section>

          <section className="rounded-2xl p-6 border" style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.cardBorder }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: COLORS.text }}>5. Your Rights</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong style={{ color: COLORS.text }}>Access:</strong> You can view all data associated with your account</li>
              <li><strong style={{ color: COLORS.text }}>Deletion:</strong> You can request complete deletion of your account and associated data</li>
              <li><strong style={{ color: COLORS.text }}>Modification:</strong> You can update your profile information at any time</li>
              <li><strong style={{ color: COLORS.text }}>Export:</strong> You can request a copy of your generated content</li>
            </ul>
          </section>

          <section className="rounded-2xl p-6 border" style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.cardBorder }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: COLORS.text }}>6. Cookies</h2>
            <p>We use essential cookies for authentication and session management. We do not use advertising or tracking cookies. Your session data is stored securely and expires automatically after a defined period.</p>
          </section>

          <section className="rounded-2xl p-6 border" style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.cardBorder }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: COLORS.text }}>7. Contact</h2>
            <p>If you have questions about this Privacy Policy or your data, please contact us at <span style={{ color: COLORS.pink }}>support</span> or visit our <a href="/support" style={{ color: COLORS.cyan }} className="underline">Support page</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

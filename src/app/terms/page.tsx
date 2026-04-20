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

export default function TermsOfServicePage() {
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
              <span style={{ color: COLORS.cyan }}>Terms</span> of Service
            </h1>
            <p className="text-sm" style={{ color: COLORS.textMuted }}>Last updated: April 2026</p>
          </div>
        </div>

        <div className="space-y-6 text-sm sm:text-base leading-relaxed" style={{ color: COLORS.textMuted }}>
          <section className="rounded-2xl p-6 border" style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.cardBorder }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: COLORS.text }}>1. Acceptance of Terms</h2>
            <p>By accessing or using AI Avatar Machine, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service. We reserve the right to modify these terms at any time, and continued use of the service constitutes acceptance of any changes.</p>
          </section>

          <section className="rounded-2xl p-6 border" style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.cardBorder }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: COLORS.text }}>2. Service Description</h2>
            <p>AI Avatar Machine provides AI-powered tools for generating avatar images and videos from text prompts and reference images. The service uses third-party AI models and APIs to process your requests. Results may vary and we do not guarantee specific outputs. The service is provided &quot;as is&quot; without warranties of any kind.</p>
          </section>

          <section className="rounded-2xl p-6 border" style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.cardBorder }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: COLORS.text }}>3. User Accounts</h2>
            <p className="mb-2">You must create an account to use our generation features. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate and complete information during registration.</p>
            <p>Each user is entitled to a free tier with limited generation credits. Additional credits can be obtained through paid subscriptions or promotional offers. Credits are non-transferable and expire as specified in your plan details.</p>
          </section>

          <section className="rounded-2xl p-6 border" style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.cardBorder }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: COLORS.text }}>4. Acceptable Use</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You must not use the service to generate illegal, harmful, threatening, abusive, or defamatory content</li>
              <li>You must not generate content that violates any third-party intellectual property rights</li>
              <li>You must not attempt to reverse-engineer, hack, or disrupt the service infrastructure</li>
              <li>You must not use the service for spam, fraud, or deceptive purposes</li>
              <li>You must not resell or redistribute the service or generated content without authorization</li>
              <li>You must not use automated systems or bots to access the service</li>
            </ul>
          </section>

          <section className="rounded-2xl p-6 border" style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.cardBorder }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: COLORS.text }}>5. Intellectual Property</h2>
            <p className="mb-2">Content you generate using the service belongs to you. You have full rights to use, modify, and distribute your generated images and videos. However, you acknowledge that AI-generated content may inadvertently resemble existing works.</p>
            <p>The AI Avatar Machine platform, including its design, code, branding, and documentation, is our proprietary property and is protected by intellectual property laws. You may not copy, modify, or distribute any part of the platform itself.</p>
          </section>

          <section className="rounded-2xl p-6 border" style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.cardBorder }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: COLORS.text }}>6. Payments & Refunds</h2>
            <p>Paid subscriptions are billed according to the plan you select. All payments are processed securely through our payment provider. Subscription fees are non-refundable except as required by applicable law. We reserve the right to change pricing with reasonable notice. Your subscription will automatically renew unless cancelled before the renewal date.</p>
          </section>

          <section className="rounded-2xl p-6 border" style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.cardBorder }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: COLORS.text }}>7. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the service. Our total liability shall not exceed the amount you have paid to us in the twelve months preceding the claim.</p>
          </section>

          <section className="rounded-2xl p-6 border" style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.cardBorder }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: COLORS.text }}>8. Termination</h2>
            <p>We may suspend or terminate your account at our sole discretion for violation of these terms or for any other reason with or without notice. You may terminate your account at any time by contacting support. Upon termination, your right to use the service ceases immediately, and your data may be deleted in accordance with our privacy policy.</p>
          </section>

          <section className="rounded-2xl p-6 border" style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.cardBorder }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: COLORS.text }}>9. Contact</h2>
            <p>For questions about these Terms of Service, please visit our <a href="/support" style={{ color: COLORS.cyan }} className="underline">Support page</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

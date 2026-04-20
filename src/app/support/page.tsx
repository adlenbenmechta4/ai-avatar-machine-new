"use client";

import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";

const COLORS = {
  pink: "#E461AD",
  cyan: "#16B1DE",
  lime: "#9AFF01",
  bg: "#0A0A0A",
  cardBg: "#111111",
  cardBorder: "#1E1E1E",
  inputBg: "#0F0F0F",
  text: "#F3F4F6",
  textMuted: "#9CA3AF",
  lightPink: "rgba(228,97,173,0.08)",
  lightCyan: "rgba(22,177,222,0.08)",
};

const FAQS = [
  {
    q: "How do I generate my first AI avatar?",
    a: "Go to the AI Avatar Machine, enter a detailed description of your desired character in the 'Create Your Avatar' section, select your preferred aspect ratio (9:16 vertical or 16:9 landscape), and click Generate. The AI will create an image based on your description.",
  },
  {
    q: "How do I create a video with my avatar?",
    a: "After uploading or generating an avatar, switch to the 'Create Video' section. You can either use AI to auto-generate scenes from a topic, or manually write scene descriptions. Then click 'Generate Video' and the pipeline will create frames, generate videos for each scene, and merge them into one final video.",
  },
  {
    q: "How do credits work?",
    a: "Free plan users get a limited number of credits (usually 3). Each video generation uses credits based on the number of scenes. Pro and Enterprise plans offer significantly more credits. You can check your remaining credits in the app interface.",
  },
  {
    q: "My generation failed. What should I do?",
    a: "Generation failures can occur due to API timeouts or rate limits. Try again after a few minutes. If the problem persists, make sure your API key is valid and has sufficient quota. You can check the Generation Logs section for detailed error information.",
  },
  {
    q: "How do I upgrade to a paid plan?",
    a: "Click on your profile/user icon in the top bar and select the upgrade option. You can choose between Pro and Enterprise plans. Payment is processed securely through Stripe.",
  },
  {
    q: "Can I use my own API key?",
    a: "Yes! You can enter your own Kie.ai API key and HeyGen API key in the Create Video section. This allows you to use your own API quota for generations.",
  },
  {
    q: "What video formats are supported?",
    a: "Generated videos are in MP4 format. The default aspect ratio is 9:16 (vertical, ideal for Stories and Reels) or 16:9 (landscape, ideal for YouTube). You can download your videos from the Video Library.",
  },
];

export default function SupportPage() {
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = () => {
    if (subject.trim().length < 3 || message.trim().length < 10) return;
    setSent(true);
    setSubject("");
    setMessage("");
    setTimeout(() => setSent(false), 5000);
  };

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

      <div className="max-w-3xl mx-auto px-5 py-10">
        {/* Header */}
        <div className="rounded-3xl p-1 mb-8" style={{ backgroundColor: COLORS.lightCyan }}>
          <div className="rounded-[22px] p-8 sm:p-10" style={{ backgroundColor: COLORS.cardBg }}>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-wide mb-2">
              <span style={{ color: COLORS.cyan }}>Support</span> Center
            </h1>
            <p className="text-sm" style={{ color: COLORS.textMuted }}>
              Find answers to common questions or send us a message
            </p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-10">
          <h2 className="text-xl font-bold uppercase tracking-wide mb-5 flex items-center gap-2">
            <span>❓</span> Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-2xl border overflow-hidden transition-all duration-300"
                style={{
                  backgroundColor: COLORS.cardBg,
                  borderColor: openFaq === i ? COLORS.cyan : COLORS.cardBorder,
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left cursor-pointer"
                >
                  <span className="text-sm sm:text-base font-semibold pr-4">{faq.q}</span>
                  <svg
                    className="w-5 h-5 flex-shrink-0 transition-transform duration-300"
                    fill="none" viewBox="0 0 24 24" stroke={COLORS.cyan} strokeWidth={2}
                    style={{ transform: openFaq === i ? "rotate(180deg)" : "rotate(0)" }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 animate-fade-in">
                    <p className="text-sm leading-relaxed" style={{ color: COLORS.textMuted }}>
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact Form */}
        <div className="rounded-3xl p-1" style={{ backgroundColor: COLORS.lightPink }}>
          <div className="rounded-[22px] p-6 sm:p-8" style={{ backgroundColor: COLORS.cardBg }}>
            <h2 className="text-xl font-bold uppercase tracking-wide mb-1 flex items-center gap-2">
              <span>✉️</span> Contact Us
            </h2>
            <p className="text-xs mb-6" style={{ color: COLORS.textMuted }}>
              Have a question not covered above? Send us a message and we&apos;ll get back to you.
            </p>

            {sent ? (
              <div className="rounded-2xl p-6 text-center animate-fade-in" style={{ backgroundColor: `${COLORS.lime}10`, border: `1px solid ${COLORS.lime}40` }}>
                <p className="text-2xl mb-2">✅</p>
                <p className="font-bold" style={{ color: COLORS.lime }}>Message Sent!</p>
                <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>We&apos;ll get back to you as soon as possible.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: COLORS.textMuted }}>
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief description of your issue"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                    style={{
                      backgroundColor: COLORS.inputBg,
                      border: `1px solid ${COLORS.cardBorder}`,
                      color: COLORS.text,
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: COLORS.textMuted }}>
                    Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="Describe your issue in detail..."
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 resize-none"
                    style={{
                      backgroundColor: COLORS.inputBg,
                      border: `1px solid ${COLORS.cardBorder}`,
                      color: COLORS.text,
                    }}
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={subject.trim().length < 3 || message.trim().length < 10}
                  className="w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all duration-300 disabled:opacity-30 cursor-pointer"
                  style={{
                    backgroundColor: COLORS.pink,
                    color: "#fff",
                  }}
                >
                  Send Message
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";

interface FileItem {
  name: string;
  size: number;
  uploadedAt: string;
  proxyUrl: string;
  label?: string;
  description?: string;
}

export default function DownloadPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"full" | "single">("full");

  // Full project files (split parts)
  const fullFiles: FileItem[] = [
    {
      name: "ai-avatar-machine-full-part1.zip",
      size: 419430400,
      uploadedAt: "",
      proxyUrl: "/api/download/parts?part=1",
      label: "Part 1 of 2",
      description: "400 MB — Download both parts, then combine"
    },
    {
      name: "ai-avatar-machine-full-part2.zip",
      size: 298071554,
      uploadedAt: "",
      proxyUrl: "/api/download/parts?part=2",
      label: "Part 2 of 2",
      description: "285 MB — Download both parts, then combine"
    },
  ];

  useEffect(() => {
    fetch("/api/download")
      .then(r => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then(data => {
        if (data.error) throw new Error(data.error);
        setFiles(data.files || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = (file: FileItem) => {
    setDownloading(file.name);
    const a = document.createElement("a");
    a.href = file.proxyUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => setDownloading(null), 5000);
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "—";
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(0) + " MB";
    return (bytes / 1024).toFixed(0) + " KB";
  };

  const renderFile = (file: FileItem) => (
    <div key={file.name} style={{
      backgroundColor: "#111", border: "1px solid #222",
      borderRadius: 16, padding: 20,
      display: "flex", alignItems: "center", gap: 16
    }}>
      <div style={{ fontSize: 36, flexShrink: 0 }}>📦</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: "#fff", fontSize: 14, fontWeight: 600, marginBottom: 4, wordBreak: "break-all" }}>
          {file.name}
        </p>
        <p style={{ color: "#6B7280", fontSize: 12, marginBottom: 4 }}>
          {formatSize(file.size)}
        </p>
        {file.label && (
          <span style={{
            display: "inline-block",
            backgroundColor: file.label.includes("Part") ? "rgba(154,255,1,0.15)" : "rgba(228,97,173,0.15)",
            color: file.label.includes("Part") ? "#9AFF01" : "#E461AD",
            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6
          }}>
            {file.label}
          </span>
        )}
        {file.description && (
          <p style={{ color: "#6B7280", fontSize: 11, marginTop: 4 }}>{file.description}</p>
        )}
      </div>
      <button
        onClick={() => handleDownload(file)}
        disabled={downloading !== null}
        style={{
          backgroundColor: downloading === file.name ? "#9AFF01" : "#E461AD",
          color: downloading === file.name ? "#0A0A0A" : "#fff",
          border: "none", borderRadius: 12,
          padding: "10px 20px", fontSize: 13, fontWeight: 700,
          cursor: downloading !== null ? "wait" : "pointer",
          opacity: downloading !== null ? 0.7 : 1,
          whiteSpace: "nowrap", flexShrink: 0
        }}
      >
        {downloading === file.name ? "✓ Started!" : "⬇ Download"}
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0A0A0A", fontFamily: "sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 600, margin: "0 auto", paddingTop: 20 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
          <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Download Project</h1>
          <p style={{ color: "#9CA3AF", fontSize: 14 }}>AI Avatar Machine — Complete Source Code</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <button
            onClick={() => setActiveTab("full")}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 12, border: "none",
              backgroundColor: activeTab === "full" ? "#9AFF01" : "#1A1A1A",
              color: activeTab === "full" ? "#0A0A0A" : "#9CA3AF",
              fontWeight: 700, fontSize: 13, cursor: "pointer"
            }}
          >
            FULL (685 MB) — Everything
          </button>
          <button
            onClick={() => setActiveTab("single")}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 12, border: "none",
              backgroundColor: activeTab === "single" ? "#E461AD" : "#1A1A1A",
              color: activeTab === "single" ? "#fff" : "#9CA3AF",
              fontWeight: 700, fontSize: 13, cursor: "pointer"
            }}
          >
            Single Files — Quick Download
          </button>
        </div>

        {/* Full Project Tab */}
        {activeTab === "full" && (
          <>
            <div style={{
              backgroundColor: "rgba(154,255,1,0.08)", border: "1px solid rgba(154,255,1,0.2)",
              borderRadius: 12, padding: 16, marginBottom: 20
            }}>
              <p style={{ color: "#9AFF01", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                FULL PROJECT — Complete without any reduction
              </p>
              <p style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 8 }}>
                Includes: source code + node_modules + all assets + upload history + everything
              </p>
              <p style={{ color: "#6B7280", fontSize: 11 }}>
                Total size: 685 MB (split into 2 parts for reliable download)
              </p>
            </div>

            {/* Combine instructions */}
            <div style={{
              backgroundColor: "#1A1A1A", border: "1px solid #333",
              borderRadius: 12, padding: 16, marginBottom: 20
            }}>
              <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                After downloading both parts:
              </p>
              <div style={{ backgroundColor: "#0A0A0A", borderRadius: 8, padding: 12, fontFamily: "monospace", fontSize: 11 }}>
                <p style={{ color: "#9AFF01", marginBottom: 4 }}># Windows (Command Prompt):</p>
                <p style={{ color: "#E0E0E0", marginBottom: 8 }}>copy /b ai-avatar-machine-full-part1.zip+ai-avatar-machine-full-part2.zip ai-avatar-machine-FULL.zip</p>
                <p style={{ color: "#9AFF01", marginBottom: 4 }}># Mac / Linux:</p>
                <p style={{ color: "#E0E0E0", marginBottom: 8 }}>cat ai-avatar-machine-full-part1.zip ai-avatar-machine-full-part2.zip &gt; ai-avatar-machine-FULL.zip</p>
                <p style={{ color: "#9AFF01", marginBottom: 4 }}># Then extract normally — no need for npm install!</p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {fullFiles.map(renderFile)}
            </div>
          </>
        )}

        {/* Single Files Tab */}
        {activeTab === "single" && (
          <>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{
                  width: 32, height: 32, border: "3px solid #333", borderTopColor: "#E461AD",
                  borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto"
                }} />
                <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 16 }}>Loading files...</p>
              </div>
            ) : error ? (
              <div style={{ textAlign: "center", padding: 40, backgroundColor: "#111", borderRadius: 16 }}>
                <p style={{ color: "#EF4444", fontSize: 14 }}>{error}</p>
              </div>
            ) : files.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, backgroundColor: "#111", borderRadius: 16 }}>
                <p style={{ color: "#9CA3AF", fontSize: 14 }}>No files available</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {files
                  .sort((a, b) => a.size - b.size)
                  .map(file => ({
                    ...file,
                    label: file.name.includes("backup-src")
                      ? "Recommended"
                      : file.name.includes("FULL")
                      ? "With node_modules"
                      : undefined
                  }))
                  .map(renderFile)}
              </div>
            )}

            <div style={{
              marginTop: 20, backgroundColor: "#1A1A1A", borderRadius: 12,
              padding: 16, border: "1px solid #333"
            }}>
              <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>After extracting:</p>
              <code style={{ color: "#E461AD", fontSize: 11, display: "block", marginBottom: 4 }}>npm install</code>
              <code style={{ color: "#E461AD", fontSize: 11, display: "block", marginBottom: 4 }}>npx prisma db push</code>
              <code style={{ color: "#E461AD", fontSize: 11, display: "block" }}>npm run dev</code>
            </div>
          </>
        )}

        <p style={{ color: "#4B5563", fontSize: 11, textAlign: "center", marginTop: 24 }}>
          Tip: Use the &quot;FULL&quot; tab for the complete project without any files missing.
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

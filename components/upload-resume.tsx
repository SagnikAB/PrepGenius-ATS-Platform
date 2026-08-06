"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

async function readTextPreview(file: File) {
  if (file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".md") || file.name.toLowerCase().endsWith(".txt") || file.name.toLowerCase().endsWith(".rtf")) {
    try {
      const text = await file.text();
      return text.replace(/\s+/g, " ").trim().slice(0, 180);
    } catch {
      return "";
    }
  }

  return "";
}

const ACCEPTED_FILE_TYPES = [
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".rtf",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/rtf",
];

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeBadge(file: File) {
  if (file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) return { label: "PDF", icon: "📄" };
  if (file.type.includes("word") || file.name.toLowerCase().endsWith(".docx")) return { label: "DOCX", icon: "📝" };
  if (file.name.toLowerCase().endsWith(".txt") || file.type.includes("text/plain")) return { label: "TXT", icon: "📃" };
  if (file.name.toLowerCase().endsWith(".md") || file.type.includes("markdown")) return { label: "MD", icon: "📘" };
  if (file.name.toLowerCase().endsWith(".rtf") || file.type.includes("rtf")) return { label: "RTF", icon: "📄" };
  return { label: "FILE", icon: "📁" };
}

export function UploadResume() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [dragActive, setDragActive] = useState(false);

  async function upload(file?: File) {
    if (!file) return;
    setSelectedFile(file);
    setPreviewText("");
    setStatus("Uploading and extracting structured profile…");

    const excerpt = await readTextPreview(file);
    setPreviewText(excerpt);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/resumes/process", { method: "POST", body: form });
    const data = await res.json();
    setStatus(data.error || `${data.candidate.full_name} is ready.`);
    if (!data.error) {
      router.refresh();
      input.current!.value = "";
    }
  }

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        upload(e.dataTransfer.files[0]);
      }}
      className={`glass-panel rounded-[1.5rem] border-2 border-dashed p-6 text-left transition ${dragActive ? "border-indigo-400/60 bg-indigo-500/10" : ""}`}
      style={{ borderColor: "var(--card-border)", color: "var(--card-foreground)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-label">Resume intake</p>
          <h3 className="mt-2 text-xl font-semibold">Drop a document here</h3>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--card-muted)" }}>
            Files are private to your team, limited to 10 MB, and ready for structured extraction.
          </p>
        </div>
        <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-3 text-xl">⬆️</div>
      </div>

      <input
        ref={input}
        className="hidden"
        type="file"
        accept={ACCEPTED_FILE_TYPES.join(",")}
        onChange={(e) => upload(e.target.files?.[0])}
      />

      <button type="button" onClick={() => input.current?.click()} className="mt-5 accent-btn">
        Choose file
      </button>

      {selectedFile && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{selectedFile.name}</p>
              <p className="mt-1 text-sm" style={{ color: "var(--card-muted)" }}>
                {selectedFile.type || "Unknown type"} · {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <div className="status-pill">Ready</div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="rounded-2xl border border-white/10 bg-slate-950/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--accent-text)" }}>Document summary</p>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--card-muted)" }}>
                {previewText ? `Preview excerpt: “${previewText}”` : "The file is ready to be parsed into a structured candidate profile."}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-3 py-2 text-sm font-medium text-indigo-300">
              <span className="text-base">{getFileTypeBadge(selectedFile).icon}</span>
              <span>{getFileTypeBadge(selectedFile).label}</span>
            </div>
          </div>
        </div>
      )}

      {status && (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm" style={{ color: "var(--card-muted)" }}>
          {status}
        </p>
      )}

      {!status && !selectedFile && (
        <p className="mt-4 text-sm" style={{ color: "var(--card-muted)" }}>
          Supports PDF, DOCX, TXT, MD, and RTF files with secure parsing for your hiring workflow.
        </p>
      )}
    </section>
  );
}

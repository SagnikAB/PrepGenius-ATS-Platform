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

type UploadStatus = {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  message: string;
  preview: string;
};

export function UploadResume() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  async function processFile(file: File) {
    const excerpt = await readTextPreview(file);
    const response = await fetch("/api/resumes/process", {
      method: "POST",
      body: (() => {
        const form = new FormData();
        form.append("file", file);
        return form;
      })(),
    });
    const data = await response.json();
    return {
      success: !data.error,
      message: data.error || `${data.candidate.full_name} is ready.`,
      preview: excerpt,
    };
  }

  async function uploadFiles(files: FileList | File[]) {
    const fileArray = Array.from(files).filter((file) =>
      ACCEPTED_FILE_TYPES.includes(file.type) ||
      ACCEPTED_FILE_TYPES.some((type) => file.name.toLowerCase().endsWith(type))
    );

    if (fileArray.length === 0) {
      alert("No supported files selected. Please use PDF, DOCX, TXT, MD, or RTF files.");
      return;
    }

    const newUploads: UploadStatus[] = fileArray.map((file) => ({
      file,
      status: "pending",
      message: "Queued for processing…",
      preview: "",
    }));

    setUploads((prev) => [...prev, ...newUploads]);
    setIsProcessing(true);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const index = uploads.length + i;

      setUploads((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], status: "uploading", message: "Uploading and extracting…" };
        return updated;
      });

      try {
        const result = await processFile(file);
        setUploads((prev) => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            status: result.success ? "success" : "error",
            message: result.message,
            preview: result.preview,
          };
          return updated;
        });

        if (result.success) {
          router.refresh();
        }
      } catch (error) {
        setUploads((prev) => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            status: "error",
            message: error instanceof Error ? error.message : "Upload failed.",
          };
          return updated;
        });
      }
    }

    setIsProcessing(false);
    if (input.current) input.current.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    uploadFiles(e.dataTransfer.files);
  }

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      className={`glass-panel rounded-[1.5rem] border-2 border-dashed p-6 text-left transition ${dragActive ? "border-indigo-400/60 bg-indigo-500/10" : ""}`}
      style={{ borderColor: "var(--card-border)", color: "var(--card-foreground)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-label">Resume intake</p>
          <h3 className="mt-2 text-xl font-semibold">Drop documents here</h3>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--card-muted)" }}>
            Upload one or multiple resumes. Files are private to your team, limited to 10 MB each, and ready for structured extraction.
          </p>
        </div>
        <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-3 text-xl">⬆️</div>
      </div>

      <input
        ref={input}
        type="file"
        accept={ACCEPTED_FILE_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={(e) => uploadFiles(e.target.files || [])}
        disabled={isProcessing}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => input.current?.click()}
          disabled={isProcessing}
          className="accent-btn text-sm"
        >
          {isProcessing ? "Processing…" : "Choose files"}
        </button>
      </div>

      {uploads.length > 0 && (
        <div className="mt-6 space-y-3 border-t border-white/10 pt-4">
          <p className="text-sm font-semibold">Upload progress ({uploads.filter((u) => u.status === "success").length}/{uploads.length})</p>
          {uploads.map((upload, idx) => {
            const badge = getFileTypeBadge(upload.file);
            return (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
              >
                <span className="text-lg">{badge.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{upload.file.name}</p>
                  <p className="text-xs" style={{ color: "var(--card-muted)" }}>
                    {formatFileSize(upload.file.size)} • {badge.label}
                  </p>
                  {upload.preview && (
                    <p className="mt-1 truncate text-xs" style={{ color: "var(--card-muted)" }}>
                      {upload.preview}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {upload.status === "success" && <span className="text-lg">✓</span>}
                  {upload.status === "error" && <span className="text-lg">✗</span>}
                  {upload.status === "uploading" && <span className="animate-spin">⟳</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

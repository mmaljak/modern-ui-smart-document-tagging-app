import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Upload, Loader2, FileSearch } from "lucide-react";
import { useSession } from "@/lib/session-store";
import { tagDocument, readTextFromFile } from "@/lib/api";
import type { TaggedDocument } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_BYTES = 24 * 1024 * 1024;

export function UploadDropzone() {
  const navigate = useNavigate();
  const apiBaseUrl = useSession((s) => s.apiBaseUrl);
  const apiHeaders = useSession((s) => s.apiHeaders);
  const embeddingModel = useSession((s) => s.embeddingModel);
  const openaiApiKey = useSession((s) => s.openaiApiKey);
  const addUpload = useSession((s) => s.addUpload);
  const [busy, setBusy] = useState(false);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      if (file.size > MAX_BYTES) {
        toast.error("File too large (max 24MB)");
        return;
      }
      setBusy(true);
      const id = crypto.randomUUID();
      try {
        const fallbackText = await readTextFromFile(file);
        const { data, latencyMs } = await tagDocument(apiBaseUrl, apiHeaders, file, {
          model: embeddingModel,
          openaiKey: openaiApiKey,
        });
        const doc: TaggedDocument = {
          id,
          filename: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
          uploadedAt: Date.now(),
          latencyMs,
          extractedText: data.extracted_text ?? fallbackText,
          tags: [...data.tags].sort((a, b) => b.confidence - a.confidence),
          keySentences: data.key_sentences ?? [],
          entities: data.entities ?? [],
          backend: data.backend,
          modelVersion: data.model_version,
        };
        addUpload(doc);
        toast.success(`Classified in ${latencyMs}ms`);
        navigate({ to: "/results/$id", params: { id } });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Tagging failed: ${msg}`, {
          description: `Check that ${apiBaseUrl}/tag is reachable.`,
        });
      } finally {
        setBusy(false);
      }
    },
    [apiBaseUrl, apiHeaders, embeddingModel, openaiApiKey, addUpload, navigate],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
    disabled: busy,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "group relative flex h-72 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-card transition-colors",
        isDragActive ? "border-accent bg-accent/[0.04]" : "border-border hover:border-accent/50",
        busy && "pointer-events-none border-solid",
        (busy || isDragActive) && "glow-border",
      )}
    >
      <input {...getInputProps()} />

      {/* drifting aura — intensifies on drag/classify */}
      <div
        className={cn(
          "aura absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500",
          isDragActive || busy ? "opacity-80" : "opacity-0 group-hover:opacity-40",
        )}
      />
      {busy && <div className="shimmer absolute inset-0" />}

      <div className="relative flex flex-col items-center gap-3">
        <motion.div
          animate={
            busy
              ? { scale: [1, 1.08, 1] }
              : isDragActive
                ? { scale: 1.12, y: -4 }
                : { scale: 1, y: 0 }
          }
          transition={busy ? { duration: 1.4, repeat: Infinity } : { type: "spring", stiffness: 300, damping: 18 }}
          className={cn(
            "grid size-14 place-items-center rounded-xl border bg-muted",
            (busy || isDragActive) && "border-accent/50 bg-accent/10 halo-pulse",
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {busy ? (
              <motion.span key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Loader2 className="size-6 animate-spin text-accent" />
              </motion.span>
            ) : isDragActive ? (
              <motion.span key="drag" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <FileSearch className="size-6 text-accent" />
              </motion.span>
            ) : (
              <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Upload className="size-6 text-muted-foreground" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="text-center">
          <p className="font-display text-base font-semibold text-foreground">
            {busy
              ? "Classifying document…"
              : isDragActive
                ? "Release to classify"
                : "Drop a document to classify"}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            PDF · DOCX · TXT &middot; up to 24MB
          </p>
        </div>
      </div>
    </div>
  );
}

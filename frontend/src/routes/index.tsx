import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { FileText, FileType2, FileCode } from "lucide-react";
import { UploadDropzone } from "@/components/upload-dropzone";
import { ApiStatusDot } from "@/components/api-status-dot";
import { useSession } from "@/lib/session-store";
import { getModelOption } from "@/lib/models";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Upload · Smart Document Tagging API" },
      { name: "description", content: "Upload a document to extract tags and key sentences." },
      { property: "og:title", content: "Upload · Smart Document Tagging API" },
      { property: "og:description", content: "Upload a document to extract tags." },
    ],
  }),
  component: IndexPage,
});

function fileIcon(mime: string, name: string) {
  if (mime.includes("pdf") || name.endsWith(".pdf")) return FileText;
  if (mime.includes("word") || name.endsWith(".docx")) return FileType2;
  return FileCode;
}

function IndexPage() {
  const uploads = useSession((s) => s.uploads);
  const embeddingModel = useSession((s) => s.embeddingModel);
  const activeModel = getModelOption(embeddingModel);
  const recent = uploads.slice(0, 8);

  return (
    <div className="relative min-h-full overflow-hidden bg-grid p-8">
      {/* atmospheric auras */}
      <div className="aura absolute -left-24 -top-28 size-[30rem]" />
      <div
        className="aura absolute right-10 top-10 size-72 opacity-40"
        style={{ animationDelay: "-7s" }}
      />

      <div className="relative max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-end justify-between mb-8"
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">
              // zero-shot classifier
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground mt-1">
              Document Intelligence
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-[60ch]">
              Classify documents against a business taxonomy. Drop a file to extract tags,
              confidence scores, and key sentences from your tagging service.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <ApiStatusDot />
            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 rounded-full border bg-card/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
              title="Change classification model"
            >
              <span
                className={
                  activeModel.provider === "openai"
                    ? "size-1.5 rounded-full bg-accent"
                    : "size-1.5 rounded-full bg-muted-foreground"
                }
              />
              {activeModel.label}
            </Link>
          </div>
        </motion.div>

        <div className="grid grid-cols-12 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
            className="col-span-12 lg:col-span-8"
          >
            <UploadDropzone />
            <div className="mt-3 flex items-center gap-2 text-[11px] font-mono text-muted-foreground uppercase tracking-widest">
              <span className="bg-muted px-1.5 py-0.5 rounded">POST /tag</span>
              <span>multipart/form-data · field: file</span>
            </div>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.16 }}
            className="col-span-12 lg:col-span-4"
          >
            <div className="bg-card/80 backdrop-blur-sm border rounded-xl p-5 h-full">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
                Recent Analysis
              </h3>
            {recent.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">
                No documents tagged yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {recent.map((u) => {
                  const Icon = fileIcon(u.mime, u.filename);
                  const top = u.tags[0];
                  return (
                    <li key={u.id}>
                      <Link
                        to="/results/$id"
                        params={{ id: u.id }}
                        className="flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-8 bg-muted rounded border grid place-items-center shrink-0">
                            <Icon className="size-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate group-hover:text-accent transition-colors">
                              {u.filename}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono uppercase">
                              {formatDistanceToNow(u.uploadedAt, { addSuffix: true })} ·{" "}
                              {u.latencyMs}ms
                            </p>
                          </div>
                        </div>
                        {top && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-muted text-foreground rounded shrink-0 font-medium">
                            {top.category}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            </div>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}

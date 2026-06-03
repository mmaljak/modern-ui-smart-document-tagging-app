import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { useSession } from "@/lib/session-store";
import { DocumentViewer } from "@/components/document-viewer";
import { ConfidenceBar } from "@/components/confidence-bar";
import { ApiStatusDot } from "@/components/api-status-dot";
import { AnimatedNumber } from "@/components/animated-number";
import { TaxonomySuggestion } from "@/components/taxonomy-suggestion";
import { KeySentencePanel } from "@/components/key-sentence-panel";

export const Route = createFileRoute("/results/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Results · ${params.id.slice(0, 8)} · Smart Document Tagging API` },
      { name: "description", content: "Tag results and key-sentence highlights for a document." },
      { property: "og:title", content: "Document Tag Results · Smart Document Tagging API" },
      { property: "og:description", content: "Tag results and key-sentence highlights." },
    ],
  }),
  component: ResultsPage,
  notFoundComponent: () => (
    <div className="p-12 text-center">
      <h2 className="text-lg font-semibold">Result not found</h2>
      <p className="text-sm text-muted-foreground mt-1">
        This document is no longer in your session.
      </p>
      <Link
        to="/"
        className="mt-4 inline-flex items-center gap-2 text-sm text-accent hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Back to upload
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-12 text-center text-destructive">
      <p>{error.message}</p>
    </div>
  ),
});

function ResultsPage() {
  const { id } = Route.useParams();
  const doc = useSession((s) => s.uploads.find((u) => u.id === id));
  if (!doc) throw notFound();

  const top = doc.tags[0];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="h-12 border-b flex items-center justify-between px-6 bg-card shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="text-sm font-medium truncate">{doc.filename}</div>
          <span className="text-[10px] bg-muted text-muted-foreground font-mono px-1.5 py-0.5 rounded uppercase tracking-widest">
            POST /tag
          </span>
          {doc.modelVersion && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded uppercase tracking-widest border border-accent/30 bg-accent/[0.06] text-accent"
              title={`Classified by ${doc.modelVersion}`}
            >
              {doc.modelVersion}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground font-mono">
            {doc.latencyMs}ms · {(doc.size / 1024).toFixed(1)} KB
          </span>
        </div>
        <ApiStatusDot />
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-1 overflow-y-auto p-12 bg-muted/40 border-r">
          <DocumentViewer
            text={doc.extractedText}
            sentences={doc.keySentences}
            filename={doc.filename}
          />
        </div>

        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-96 overflow-y-auto p-6 flex flex-col space-y-8 bg-card shrink-0"
        >
          <div>
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4">
              Classification
            </h3>
            <div className="space-y-3">
              {doc.tags.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tags returned.</p>
              ) : (
                doc.tags.map((t, i) => (
                  <ConfidenceBar
                    key={t.category + i}
                    label={t.category}
                    value={t.confidence}
                    primary={i === 0}
                    index={i}
                  />
                ))
              )}
            </div>
          </div>

          <TaxonomySuggestion tags={doc.tags} />

          <div>
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4">
              Key Sentences
            </h3>
            <KeySentencePanel sentences={doc.keySentences} />
          </div>

          {doc.entities.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4">
                Extracted Entities
              </h3>
              <div className="flex flex-wrap gap-2">
                {doc.entities.map((e, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-muted text-foreground text-[11px] font-medium rounded border"
                  >
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4">
              Document Stats
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground font-mono uppercase text-[10px]">Top tag</div>
                <div className="font-display font-semibold mt-1">{top?.category ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground font-mono uppercase text-[10px]">
                  Confidence
                </div>
                <div className="font-semibold mt-1 font-mono text-accent">
                  {top ? (
                    <AnimatedNumber value={top.confidence * 100} format={(n) => `${n.toFixed(1)}%`} />
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground font-mono uppercase text-[10px]">
                  Key sentences
                </div>
                <div className="font-semibold mt-1 font-mono">
                  <AnimatedNumber value={doc.keySentences.length} />
                </div>
              </div>
              <div>
                <div className="text-muted-foreground font-mono uppercase text-[10px]">
                  Multi-label
                </div>
                <div className="font-semibold mt-1 font-mono">
                  <AnimatedNumber value={doc.tags.filter((t) => t.confidence >= 0.5).length} />
                </div>
              </div>
            </div>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}

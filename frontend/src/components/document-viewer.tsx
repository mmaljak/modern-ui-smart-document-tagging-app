import { useMemo } from "react";
import { motion } from "motion/react";
import type { KeySentence } from "@/lib/types";

export const HIGHLIGHT_CLASSES = [
  "bg-accent/10 text-accent border-b border-accent/40 hover:bg-accent/20",
  "bg-emerald-500/10 text-emerald-700 border-b border-emerald-500/40 hover:bg-emerald-500/20 dark:text-emerald-300",
  "bg-amber-500/10 text-amber-700 border-b border-amber-500/40 hover:bg-amber-500/20 dark:text-amber-300",
  "bg-fuchsia-500/10 text-fuchsia-700 border-b border-fuchsia-500/40 hover:bg-fuchsia-500/20 dark:text-fuchsia-300",
];

interface Segment {
  text: string;
  highlight?: KeySentence;
  classIdx?: number;
  order?: number;
}

/** Stable color index per category — shared with the key-sentence panel. */
export function categoryColorMap(sentences: KeySentence[]) {
  const map = new Map<string, number>();
  sentences.forEach((s) => {
    const key = s.category ?? "_";
    if (!map.has(key)) map.set(key, map.size % HIGHLIGHT_CLASSES.length);
  });
  return map;
}

export function DocumentViewer({
  text,
  sentences,
  filename,
}: {
  text: string;
  sentences: KeySentence[];
  filename: string;
}) {
  const segments = useMemo<Segment[]>(() => {
    if (!text) return [];
    if (!sentences.length) return [{ text }];
    const catIdx = categoryColorMap(sentences);

    const matches: { start: number; end: number; s: KeySentence; idx: number; order: number }[] =
      [];
    sentences.forEach((s, order) => {
      if (!s.text) return;
      const i = text.indexOf(s.text);
      if (i >= 0) {
        matches.push({
          start: i,
          end: i + s.text.length,
          s,
          idx: catIdx.get(s.category ?? "_") ?? 0,
          order,
        });
      }
    });
    matches.sort((a, b) => a.start - b.start);

    const out: Segment[] = [];
    let cursor = 0;
    for (const m of matches) {
      if (m.start < cursor) continue; // skip overlaps
      if (m.start > cursor) out.push({ text: text.slice(cursor, m.start) });
      out.push({ text: text.slice(m.start, m.end), highlight: m.s, classIdx: m.idx, order: m.order });
      cursor = m.end;
    }
    if (cursor < text.length) out.push({ text: text.slice(cursor) });
    return out;
  }, [text, sentences]);

  if (!text) {
    return (
      <div className="mx-auto max-w-[70ch] rounded-sm border bg-card p-12 shadow-sm">
        <div className="mb-8 border-b pb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
          {filename} &mdash; preview unavailable
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The backend did not return extracted text and the client cannot decode this file type.
          Configure your FastAPI <code className="font-mono text-xs">/tag</code> response to include
          an <code className="font-mono text-xs">extracted_text</code> field to render the full
          document here.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto max-w-[70ch] rounded-sm border bg-card p-12 shadow-sm"
    >
      <div className="mb-8 border-b pb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
        {filename} &mdash; document_classified
      </div>
      <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground">
        {segments.map((seg, i) =>
          seg.highlight ? (
            <motion.mark
              key={i}
              id={`ks-${seg.order}`}
              initial={{ opacity: 0.25 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.4,
                delay: 0.5 + (seg.order ?? 0) * 0.18,
                ease: "easeOut",
              }}
              className={`scroll-mt-24 cursor-help rounded-sm bg-transparent px-1 transition-colors duration-300 ${
                HIGHLIGHT_CLASSES[seg.classIdx ?? 0]
              }`}
              title={
                seg.highlight.category
                  ? `${seg.highlight.category}${
                      seg.highlight.score != null
                        ? ` · ${(seg.highlight.score * 100).toFixed(1)}%`
                        : ""
                    }`
                  : "Key sentence"
              }
            >
              {seg.text}
            </motion.mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </div>
    </motion.div>
  );
}

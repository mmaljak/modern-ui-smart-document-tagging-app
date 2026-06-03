import { motion } from "motion/react";
import { Quote } from "lucide-react";
import type { KeySentence } from "@/lib/types";
import { categoryColorMap, HIGHLIGHT_CLASSES } from "@/components/document-viewer";

const DOT_COLORS = ["bg-accent", "bg-emerald-500", "bg-amber-500", "bg-fuchsia-500"];

function jumpTo(order: number) {
  const el = document.getElementById(`ks-${order}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("sentence-ping");
  // reflow so the animation can re-trigger on repeat clicks
  void el.offsetWidth;
  el.classList.add("sentence-ping");
}

export function KeySentencePanel({ sentences }: { sentences: KeySentence[] }) {
  if (!sentences.length) {
    return <p className="text-xs text-muted-foreground">No key sentences extracted.</p>;
  }
  const colorMap = categoryColorMap(sentences);

  return (
    <ul className="space-y-2">
      {sentences.map((s, i) => {
        const ci = colorMap.get(s.category ?? "_") ?? 0;
        return (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              type="button"
              onClick={() => jumpTo(i)}
              className="group flex w-full gap-2.5 rounded-lg border border-transparent bg-muted/40 p-2.5 text-left transition-all hover:border-border hover:bg-muted hover:shadow-sm"
            >
              <span className={`mt-1 h-full w-0.5 shrink-0 rounded-full ${DOT_COLORS[ci]}`} />
              <div className="min-w-0">
                <Quote className="mb-1 size-3 text-muted-foreground/50" />
                <p className="line-clamp-3 text-xs leading-relaxed text-foreground/90">{s.text}</p>
                {(s.category || s.score != null) && (
                  <div className="mt-1.5 flex items-center gap-2">
                    {s.category && (
                      <span
                        className={`rounded px-1 py-px text-[10px] font-semibold ${HIGHLIGHT_CLASSES[ci]}`}
                      >
                        {s.category}
                      </span>
                    )}
                    {s.score != null && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {(s.score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          </motion.li>
        );
      })}
    </ul>
  );
}

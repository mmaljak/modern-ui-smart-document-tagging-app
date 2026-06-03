import { motion } from "motion/react";
import { Lightbulb, Layers, ArrowUpRight } from "lucide-react";
import type { TagResult } from "@/lib/types";
import { assessTaxonomy } from "@/lib/taxonomy";

export function TaxonomySuggestion({ tags }: { tags: TagResult[] }) {
  const verdict = assessTaxonomy(tags);
  if (!verdict.suggest) return null;

  const isExpand = verdict.kind === "expand";
  const Icon = isExpand ? Lightbulb : Layers;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      className="glow-border relative overflow-hidden rounded-xl border bg-card p-4"
    >
      {/* faint aura wash — kept to the bottom-right corner, away from the heading text */}
      <div className="aura absolute -bottom-12 -right-10 size-28 opacity-20" />

      <div className="relative flex items-start gap-3">
        <motion.div
          initial={{ rotate: -12, scale: 0.6 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 16, delay: 0.3 }}
          className="grid size-8 shrink-0 place-items-center rounded-lg border bg-accent/10 text-accent"
        >
          <Icon className="size-4" />
        </motion.div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-display text-sm font-semibold text-foreground">
              {verdict.headline}
            </h4>
            <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide text-accent-foreground">
              {isExpand ? "expand" : "multi-label"}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">{verdict.detail}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {verdict.candidates.map((c: TagResult, i: number) => (
              <motion.span
                key={c.category}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.07 }}
                className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/5 px-2 py-0.5 text-[11px] font-medium text-foreground"
              >
                {c.category}
                <span className="font-mono text-[10px] text-accent">
                  {(c.confidence * 100).toFixed(0)}%
                </span>
              </motion.span>
            ))}
          </div>

          {isExpand && (
            <div className="mt-3 flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <ArrowUpRight className="size-3" />
              suggest a new taxonomy label
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

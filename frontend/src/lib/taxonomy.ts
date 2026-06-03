import type { TagResult } from "./types";

export type TaxonomyVerdict =
  | { suggest: false }
  | {
      suggest: true;
      /** "expand" = nothing fits well → maybe a missing category.
       *  "ambiguous" = several fit equally → genuinely multi-label. */
      kind: "expand" | "ambiguous";
      headline: string;
      detail: string;
      /** Categories worth surfacing as the basis for the suggestion. */
      candidates: TagResult[];
      topConfidence: number;
    };

const LOW_CONFIDENCE = 0.6; // nothing clears this → taxonomy may be missing a class
const CLUSTER_DELTA = 0.08; // top labels within this band → ambiguous
const RELEVANT = 0.45; // a label must clear this to count as a contender

/**
 * Heuristic over the (already sorted) tag confidences. Purely client-side —
 * derived from existing scores, no backend change. Flags documents that the
 * fixed 8-category taxonomy classifies poorly, either because nothing fits
 * (candidate for a new category) or because several categories fit at once.
 */
export function assessTaxonomy(tags: TagResult[]): TaxonomyVerdict {
  const sorted = [...tags].sort((a, b) => b.confidence - a.confidence);
  const top = sorted[0];
  if (!top) return { suggest: false };

  // Case 1 — nothing fits confidently → the doc may need a new category.
  if (top.confidence < LOW_CONFIDENCE) {
    return {
      suggest: true,
      kind: "expand",
      headline: "Weak taxonomy fit",
      detail:
        "No category cleared a confident threshold. This document may not fit the current 8-category taxonomy — consider adding a new label.",
      candidates: sorted.slice(0, 3),
      topConfidence: top.confidence,
    };
  }

  // Case 2 — multiple strong, tightly-clustered labels → genuinely multi-label.
  const contenders = sorted.filter((t) => t.confidence >= RELEVANT);
  const second = contenders[1];
  if (second && top.confidence - second.confidence < CLUSTER_DELTA) {
    const names = contenders
      .filter((t) => top.confidence - t.confidence < CLUSTER_DELTA)
      .map((t) => t.category);
    return {
      suggest: true,
      kind: "ambiguous",
      headline: "Multiple strong matches",
      detail: `This document scores almost equally as ${names.join(" & ")}. It likely spans categories — apply multi-label tags rather than one.`,
      candidates: contenders.slice(0, 3),
      topConfidence: top.confidence,
    };
  }

  return { suggest: false };
}

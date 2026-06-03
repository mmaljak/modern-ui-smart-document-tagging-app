import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/animated-number";

export function ConfidenceBar({
  label,
  value,
  primary = false,
  index = 0,
}: {
  label: string;
  value: number;
  primary?: boolean;
  index?: number;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: index * 0.08 }}
      className={cn(
        "relative overflow-hidden rounded-lg border p-3 transition-colors",
        primary
          ? "glow-border border-accent/40 bg-accent/[0.04]"
          : "border-border/60 hover:border-border",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className={cn(
            "flex items-center gap-2 text-sm",
            primary ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
          )}
        >
          {primary && <span className="size-1.5 rounded-full bg-accent halo-pulse" />}
          {label}
        </span>
        <AnimatedNumber
          value={pct}
          format={(n) => `${n.toFixed(1)}%`}
          className={cn(
            "font-mono text-[11px] font-bold tabular-nums",
            primary ? "text-accent" : "text-muted-foreground",
          )}
        />
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: index * 0.08 + 0.1 }}
          className={cn(
            "h-full rounded-full",
            primary
              ? "bg-gradient-to-r from-accent/70 to-accent shadow-[0_0_12px_-1px_var(--color-accent)]"
              : "bg-muted-foreground/40",
          )}
        />
      </div>
    </motion.div>
  );
}

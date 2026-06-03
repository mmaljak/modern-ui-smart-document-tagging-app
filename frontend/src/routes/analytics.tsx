import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  PieChart,
  Pie,
  Cell,
  Sector,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useSession } from "@/lib/session-store";
import { AnimatedNumber } from "@/components/animated-number";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics · Smart Document Tagging API" },
      {
        name: "description",
        content: "Session distribution of document types, confidence, and latency.",
      },
      { property: "og:title", content: "Analytics · Smart Document Tagging API" },
      { property: "og:description", content: "Session distribution and analytics." },
    ],
  }),
  component: AnalyticsPage,
});

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function p(n: number[], q: number) {
  if (!n.length) return 0;
  const sorted = [...n].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return sorted[i];
}

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 8px 30px -12px rgba(0,0,0,0.3)",
};

function AnalyticsPage() {
  const uploads = useSession((s) => s.uploads);
  const [active, setActive] = useState<number | null>(null);

  const { categoryData, fileTypeData, confidenceByCat, stats } = useMemo(() => {
    const catCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();
    const catConfidence = new Map<string, number[]>();
    const confidences: number[] = [];
    const latencies: number[] = [];
    for (const u of uploads) {
      const top = u.tags[0];
      if (top) {
        catCounts.set(top.category, (catCounts.get(top.category) ?? 0) + 1);
        confidences.push(top.confidence);
        const arr = catConfidence.get(top.category) ?? [];
        arr.push(top.confidence);
        catConfidence.set(top.category, arr);
      }
      const ext = u.filename.split(".").pop()?.toUpperCase() ?? "?";
      typeCounts.set(ext, (typeCounts.get(ext) ?? 0) + 1);
      latencies.push(u.latencyMs);
    }
    return {
      categoryData: [...catCounts.entries()].map(([name, value]) => ({ name, value })),
      fileTypeData: [...typeCounts.entries()].map(([name, value]) => ({ name, value })),
      confidenceByCat: [...catConfidence.entries()]
        .map(([name, arr]) => ({
          name,
          value: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100),
        }))
        .sort((a, b) => b.value - a.value),
      stats: {
        total: uploads.length,
        avgConfidence: confidences.length
          ? confidences.reduce((a, b) => a + b, 0) / confidences.length
          : 0,
        p50: p(latencies, 0.5),
        p95: p(latencies, 0.95),
      },
    };
  }, [uploads]);

  const totalDocs = categoryData.reduce((a, b) => a + b.value, 0);
  const center =
    active != null && categoryData[active]
      ? { label: categoryData[active].name, value: categoryData[active].value }
      : { label: "Total", value: totalDocs };

  return (
    <div className="relative min-h-full overflow-hidden bg-grid">
      {/* atmospheric auras */}
      <div className="aura absolute -left-20 -top-24 size-[28rem]" />
      <div
        className="aura absolute right-0 top-40 size-80 opacity-40"
        style={{ animationDelay: "-6s" }}
      />

      <div className="relative p-8 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">
            // session telemetry
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-1">Session Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Distribution of document classifications across this browser session.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Documents" value={stats.total} delay={0} />
          <StatCard
            label="Avg Confidence"
            value={stats.avgConfidence * 100}
            format={(n) => `${n.toFixed(1)}%`}
            accent
            delay={0.06}
          />
          <StatCard label="Latency p50" value={stats.p50} suffix="ms" mono delay={0.12} />
          <StatCard label="Latency p95" value={stats.p95} suffix="ms" mono delay={0.18} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── Donut: top-tag distribution ─────────────────────────────── */}
          <Panel className="lg:col-span-2" title="Top-Tag Distribution" delay={0.1}>
            {categoryData.length === 0 ? (
              <EmptyChart />
            ) : (
              <>
                <div className="relative h-64">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={62}
                        outerRadius={92}
                        paddingAngle={3}
                        cornerRadius={4}
                        activeIndex={active ?? undefined}
                        activeShape={(props: any) => (
                          <Sector {...props} outerRadius={props.outerRadius + 8} />
                        )}
                        onMouseEnter={(_, i) => setActive(i)}
                        onMouseLeave={() => setActive(null)}
                        animationDuration={900}
                        animationBegin={150}
                      >
                        {categoryData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={COLORS[i % COLORS.length]}
                            stroke="var(--color-card)"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* live center label */}
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="text-center">
                      <AnimatedNumber
                        value={center.value}
                        className="font-display block text-3xl font-bold tabular-nums text-foreground"
                      />
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {center.label}
                      </div>
                    </div>
                  </div>
                </div>
                <ul className="mt-4 space-y-1.5">
                  {categoryData.map((c, i) => (
                    <li
                      key={c.name}
                      onMouseEnter={() => setActive(i)}
                      onMouseLeave={() => setActive(null)}
                      className={`flex cursor-default items-center justify-between rounded-md px-2 py-1 text-xs transition-colors ${
                        active === i ? "bg-muted" : ""
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full transition-transform"
                          style={{
                            background: COLORS[i % COLORS.length],
                            transform: active === i ? "scale(1.5)" : "scale(1)",
                          }}
                        />
                        {c.name}
                      </span>
                      <span className="font-mono text-muted-foreground">{c.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          {/* ── Avg confidence per category ─────────────────────────────── */}
          <Panel className="lg:col-span-3" title="Avg Confidence by Category" delay={0.18}>
            {confidenceByCat.length === 0 ? (
              <EmptyChart />
            ) : (
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={confidenceByCat} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      stroke="var(--color-muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      unit="%"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="var(--color-muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={90}
                    />
                    <Tooltip cursor={{ fill: "var(--color-muted)" }} contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} animationDuration={900} unit="%">
                      {confidenceByCat.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          {/* ── File-type counts ────────────────────────────────────────── */}
          <Panel className="lg:col-span-5" title="File Type Counts" delay={0.24}>
            {fileTypeData.length === 0 ? (
              <EmptyChart />
            ) : (
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={fileTypeData}>
                    <XAxis
                      dataKey="name"
                      stroke="var(--color-muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip cursor={{ fill: "var(--color-muted)" }} contentStyle={tooltipStyle} />
                    <Bar
                      dataKey="value"
                      fill="var(--color-accent)"
                      radius={[6, 6, 0, 0]}
                      animationDuration={900}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
  className,
  delay = 0,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay }}
      className={`rounded-xl border bg-card/80 p-6 backdrop-blur-sm ${className ?? ""}`}
    >
      <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </motion.div>
  );
}

function StatCard({
  label,
  value,
  format,
  suffix = "",
  accent,
  mono,
  delay = 0,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  suffix?: string;
  accent?: boolean;
  mono?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay }}
      whileHover={{ y: -3 }}
      className="group relative overflow-hidden rounded-xl border bg-card/80 p-4 backdrop-blur-sm transition-shadow hover:shadow-[0_0_24px_-8px_var(--color-accent)]"
    >
      <div
        className="aura absolute -right-6 -top-8 size-24 opacity-0 transition-opacity duration-500 group-hover:opacity-60"
      />
      <div className="relative">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
        <div
          className={`mt-2 text-2xl font-bold tracking-tight ${
            accent ? "text-accent" : "text-foreground"
          } ${mono ? "font-mono" : "font-display"}`}
        >
          <AnimatedNumber value={value} format={format} />
          {suffix}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyChart() {
  return (
    <div className="grid h-64 place-items-center text-xs text-muted-foreground">
      No data yet — tag a document first.
    </div>
  );
}

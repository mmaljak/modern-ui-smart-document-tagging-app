import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Check, KeyRound, Lock, Sparkles } from "lucide-react";
import { useSession } from "@/lib/session-store";
import { checkHealth } from "@/lib/api";
import { MODEL_OPTIONS, getModelOption, type ModelOption } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Smart Document Tagging API" },
      { name: "description", content: "Choose a classification model and configure the API." },
      { property: "og:title", content: "Settings · Smart Document Tagging API" },
      { property: "og:description", content: "Configure the tagging service connection." },
    ],
  }),
  component: SettingsPage,
});

function ModelCard({
  opt,
  active,
  onSelect,
}: {
  opt: ModelOption;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "group relative flex flex-col rounded-xl border p-4 text-left transition-colors",
        active
          ? "glow-border border-accent/40 bg-accent/[0.04]"
          : "border-border hover:border-accent/40 hover:bg-muted/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-display text-sm font-semibold leading-tight">{opt.label}</span>
        <span
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
            active ? "border-accent bg-accent text-accent-foreground" : "border-border text-transparent",
          )}
        >
          <Check className="size-3" />
        </span>
      </div>

      {opt.tagline && (
        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {opt.requiresKey ? <Lock className="size-2.5" /> : null}
          {opt.tagline}
        </span>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{opt.description}</p>
      {opt.bestFor && (
        <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-foreground/80">
          {opt.bestFor}
        </p>
      )}

      <div className="mt-3 flex items-baseline gap-1">
        <span
          className={cn(
            "font-display text-lg font-bold",
            opt.requiresKey ? "text-foreground" : "text-accent",
          )}
        >
          {opt.price}
        </span>
        {opt.priceNote && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {opt.priceNote}
          </span>
        )}
      </div>
    </button>
  );
}

function SettingsPage() {
  const apiBaseUrl = useSession((s) => s.apiBaseUrl);
  const apiHeaders = useSession((s) => s.apiHeaders);
  const storedModel = useSession((s) => s.embeddingModel);
  const storedKey = useSession((s) => s.openaiApiKey);
  const setApiBaseUrl = useSession((s) => s.setApiBaseUrl);
  const setApiHeaders = useSession((s) => s.setApiHeaders);
  const setEmbeddingModel = useSession((s) => s.setEmbeddingModel);
  const setOpenaiApiKey = useSession((s) => s.setOpenaiApiKey);
  const clearUploads = useSession((s) => s.clearUploads);

  const [model, setModel] = useState(storedModel);
  const [apiKey, setApiKey] = useState(storedKey);
  const [url, setUrl] = useState(apiBaseUrl);
  const [rows, setRows] = useState<Array<[string, string]>>(
    Object.entries(apiHeaders).length ? Object.entries(apiHeaders) : [["", ""]],
  );
  const [testing, setTesting] = useState(false);

  const selected = getModelOption(model);
  const needsKey = selected.requiresKey;

  const save = () => {
    if (needsKey && !apiKey.trim()) {
      toast.error(`${selected.label} requires an OpenAI API key`, {
        description: "Paste your key below, or switch back to the free local model.",
      });
      return;
    }
    setEmbeddingModel(model);
    setOpenaiApiKey(apiKey.trim());
    setApiBaseUrl(url);
    const headers: Record<string, string> = {};
    for (const [k, v] of rows) if (k.trim()) headers[k.trim()] = v;
    setApiHeaders(headers);
    toast.success("Settings saved", {
      description: `Classifying with ${selected.label}.`,
    });
  };

  const test = async () => {
    setTesting(true);
    const headers: Record<string, string> = {};
    for (const [k, v] of rows) if (k.trim()) headers[k.trim()] = v;
    const ok = await checkHealth(url.replace(/\/$/, ""), headers);
    setTesting(false);
    if (ok) toast.success("Connection OK");
    else toast.error("Could not reach /health on that URL");
  };

  return (
    <div className="relative min-h-full overflow-hidden bg-grid">
      <div className="aura absolute -left-20 -top-28 size-[26rem]" />

      <div className="relative p-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">
            // configuration
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-1">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a classification model and configure your tagging service. Everything is stored
            locally in this browser — your API key never leaves your machine except to call the
            backend.
          </p>
        </div>

        {/* ── Classification model ──────────────────────────────────────────── */}
        <section className="bg-card border rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="size-4 text-accent" />
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Classification Model
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            Local models are free, run on the server, and keep your documents private. OpenAI
            models are higher quality but paid — they use your own API key and send text to OpenAI.
          </p>

          {/* Local — free & private */}
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Local · free &amp; private
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODEL_OPTIONS.filter((o) => o.provider !== "openai").map((opt) => (
              <ModelCard
                key={opt.id}
                opt={opt}
                active={model === opt.id}
                onSelect={() => setModel(opt.id)}
              />
            ))}
          </div>

          {/* OpenAI — paid, cloud */}
          <h3 className="mb-2 mt-5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            <Lock className="size-3" /> OpenAI · paid, cloud
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODEL_OPTIONS.filter((o) => o.provider === "openai").map((opt) => (
              <ModelCard
                key={opt.id}
                opt={opt}
                active={model === opt.id}
                onSelect={() => setModel(opt.id)}
              />
            ))}
          </div>

          {/* Conditional API key field */}
          {needsKey && (
            <div className="mt-5 space-y-2">
              <Label
                htmlFor="openai-key"
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground"
              >
                <KeyRound className="size-3.5" /> OpenAI API Key
                <span className="text-accent">*</span>
              </Label>
              <Input
                id="openai-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-…"
                autoComplete="off"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Sent only with each tagging request via the{" "}
                <code className="font-mono">X-OpenAI-Key</code> header. Stored locally; never logged
                or persisted by the backend. Get one at{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  platform.openai.com
                </a>
                .
              </p>
            </div>
          )}
        </section>

        {/* ── API connection ────────────────────────────────────────────────── */}
        <section className="bg-card border rounded-xl p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="api-url" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              API Base URL
            </Label>
            <Input
              id="api-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:8000/api/v1"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              POST <code className="font-mono">{url || "<base>"}/tag</code> · GET{" "}
              <code className="font-mono">{url || "<base>"}/health</code>
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Custom Headers
              </Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setRows([...rows, ["", ""]])}
              >
                <Plus className="size-3.5 mr-1" /> Add header
              </Button>
            </div>
            <div className="space-y-2">
              {rows.map(([k, v], i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Header name"
                    value={k}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = [e.target.value, v];
                      setRows(next);
                    }}
                    className="font-mono text-xs"
                  />
                  <Input
                    placeholder="Value"
                    value={v}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = [k, e.target.value];
                      setRows(next);
                    }}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={save}>Save</Button>
            <Button variant="outline" onClick={test} disabled={testing}>
              {testing ? "Testing…" : "Test connection"}
            </Button>
          </div>
        </section>

        <div className="mt-6 bg-card border rounded-xl p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Session
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Clear all tagged documents from this browser session.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              clearUploads();
              toast.success("Session cleared");
            }}
          >
            <Trash2 className="size-4 mr-2" /> Clear session
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useSession } from "@/lib/session-store";
import { checkHealth } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ApiStatusDot({ showUrl = true }: { showUrl?: boolean }) {
  const apiBaseUrl = useSession((s) => s.apiBaseUrl);
  const apiHeaders = useSession((s) => s.apiHeaders);
  const [status, setStatus] = useState<"unknown" | "ok" | "down">("unknown");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const ping = async () => {
      const ok = await checkHealth(apiBaseUrl, apiHeaders, controller.signal);
      if (!cancelled) setStatus(ok ? "ok" : "down");
    };
    ping();
    const id = window.setInterval(ping, 30_000);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(id);
    };
  }, [apiBaseUrl, apiHeaders]);

  const color =
    status === "ok"
      ? "bg-emerald-500"
      : status === "down"
        ? "bg-destructive"
        : "bg-muted-foreground";

  return (
    <div className="flex items-center gap-2">
      {showUrl && (
        <span className="text-xs text-muted-foreground font-mono truncate max-w-[280px]">
          {apiBaseUrl}
        </span>
      )}
      <span
        className={cn("size-2 rounded-full", color, status === "ok" && "animate-pulse")}
        title={`API ${status}`}
      />
    </div>
  );
}

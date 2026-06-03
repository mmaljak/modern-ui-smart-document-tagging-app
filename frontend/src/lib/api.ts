import { DEFAULT_MODEL_ID } from "./models";
import type { TagResponse } from "./types";

export interface TagCallResult {
  data: TagResponse;
  latencyMs: number;
}

export interface TagOptions {
  /** Backend id sent on the `model` form field (e.g. "local", "openai-3-small"). */
  model?: string;
  /** OpenAI key — sent via the X-OpenAI-Key header when present (paid backends). */
  openaiKey?: string;
}

export async function tagDocument(
  baseUrl: string,
  headers: Record<string, string>,
  file: File,
  options: TagOptions = {},
  signal?: AbortSignal,
): Promise<TagCallResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("model", options.model ?? DEFAULT_MODEL_ID);

  const reqHeaders: Record<string, string> = { ...headers };
  if (options.openaiKey?.trim()) {
    reqHeaders["X-OpenAI-Key"] = options.openaiKey.trim();
  }

  const start = performance.now();
  const res = await fetch(`${baseUrl}/tag?include_text=true`, {
    method: "POST",
    body: form,
    headers: reqHeaders,
    signal,
  });
  const latencyMs = Math.round(performance.now() - start);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  const data = (await res.json()) as TagResponse;
  if (!data || !Array.isArray(data.tags)) {
    throw new Error("Invalid response: missing 'tags' array");
  }
  if (Array.isArray(data.key_sentences)) {
    data.key_sentences = data.key_sentences.map((s: unknown) =>
      typeof s === "string" ? { text: s } : s,
    ) as TagResponse["key_sentences"];
  }
  return { data, latencyMs };
}

export async function checkHealth(
  baseUrl: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/health`, { headers, signal });
    return res.ok;
  } catch {
    return false;
  }
}

export async function readTextFromFile(file: File): Promise<string> {
  if (file.type === "text/plain" || file.name.endsWith(".txt")) {
    return await file.text();
  }
  return "";
}

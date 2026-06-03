import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TaggedDocument } from "./types";
import { DEFAULT_MODEL_ID } from "./models";

// Baked in at build time (Vite inlines import.meta.env.VITE_*). Set
// VITE_API_BASE_URL when the API is not reachable at localhost — e.g. the stack
// runs on a remote host. Falls back to localhost for local dev.
const DEFAULT_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

interface SessionState {
  apiBaseUrl: string;
  apiHeaders: Record<string, string>;
  /** Selected classification backend id — mirrors lib/models.ts / backend registry. */
  embeddingModel: string;
  /** User-supplied OpenAI key for the paid backends. Stored only in this browser. */
  openaiApiKey: string;
  uploads: TaggedDocument[];
  setApiBaseUrl: (url: string) => void;
  setApiHeaders: (headers: Record<string, string>) => void;
  setEmbeddingModel: (id: string) => void;
  setOpenaiApiKey: (key: string) => void;
  addUpload: (doc: TaggedDocument) => void;
  getUpload: (id: string) => TaggedDocument | undefined;
  clearUploads: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      apiBaseUrl: DEFAULT_API_BASE_URL,
      apiHeaders: {},
      embeddingModel: DEFAULT_MODEL_ID,
      openaiApiKey: "",
      uploads: [],
      setApiBaseUrl: (apiBaseUrl) => set({ apiBaseUrl: apiBaseUrl.replace(/\/$/, "") }),
      setApiHeaders: (apiHeaders) => set({ apiHeaders }),
      setEmbeddingModel: (embeddingModel) => set({ embeddingModel }),
      setOpenaiApiKey: (openaiApiKey) => set({ openaiApiKey }),
      addUpload: (doc) => set((s) => ({ uploads: [doc, ...s.uploads].slice(0, 50) })),
      getUpload: (id) => get().uploads.find((u) => u.id === id),
      clearUploads: () => set({ uploads: [] }),
    }),
    {
      name: "doc-tagging-session",
      version: 2,
      migrate: (state: unknown, version: number) => {
        const s = state as Partial<SessionState>;
        if (version < 1 && s.apiBaseUrl === "http://localhost:8000") {
          s.apiBaseUrl = "http://localhost:8000/api/v1";
        }
        if (version < 2) {
          s.embeddingModel ??= DEFAULT_MODEL_ID;
          s.openaiApiKey ??= "";
        }
        return s;
      },
    },
  ),
);

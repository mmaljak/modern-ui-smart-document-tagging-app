// Single source of truth for the classification-model picker. The `id` values mirror
// the backend registry (src/document_tagger/services/registry.py) and are sent on the
// `/tag` `model` form field.

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  /** One-line "best for" guidance shown under the description. */
  bestFor?: string;
  /** Display price, e.g. "Free" or "$0.02". `priceNote` carries the unit. */
  price: string;
  priceNote?: string;
  /** Short tagline shown as a chip, e.g. "Fastest". */
  tagline?: string;
  requiresKey: boolean;
  provider: "local" | "openai";
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "bge-small",
    label: "BGE-small",
    description:
      "Fast local sentence-embeddings (BAAI/bge-small-en-v1.5). Tiny (~130 MB), runs on the server, nothing leaves your machine.",
    bestFor: "Best for speed and most everyday documents — instant, light, private.",
    price: "Free",
    tagline: "Fastest",
    requiresKey: false,
    provider: "local",
  },
  {
    id: "local",
    label: "BART zero-shot",
    description:
      "Local zero-shot classifier (facebook/bart-large-mnli). Larger (~1.6 GB) and slower, but reasons about each label directly via natural-language inference.",
    bestFor: "Best for tricky or ambiguous documents where nuance matters more than speed.",
    price: "Free",
    tagline: "Most thorough",
    requiresKey: false,
    provider: "local",
  },
  {
    id: "openai-3-small",
    label: "text-embedding-3-small",
    description:
      "OpenAI cloud embeddings — high quality at low cost. Your text is sent to OpenAI for classification.",
    bestFor: "Best value when you want top accuracy and don't mind a cloud call.",
    price: "$0.02",
    priceNote: "per 1M tokens",
    tagline: "Best value",
    requiresKey: true,
    provider: "openai",
  },
  {
    id: "openai-3-large",
    label: "text-embedding-3-large",
    description:
      "OpenAI cloud embeddings — maximum quality. Your text is sent to OpenAI for classification.",
    bestFor: "Best for the most demanding accuracy; highest cost.",
    price: "$0.13",
    priceNote: "per 1M tokens",
    tagline: "Max quality",
    requiresKey: true,
    provider: "openai",
  },
];

export const DEFAULT_MODEL_ID = "bge-small";

export function getModelOption(id: string | undefined): ModelOption {
  return MODEL_OPTIONS.find((m) => m.id === id) ?? MODEL_OPTIONS[0];
}

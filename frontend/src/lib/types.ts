export interface TagResult {
  category: string;
  confidence: number;
}

export interface KeySentence {
  text: string;
  category?: string;
  score?: number;
}

export interface TagResponse {
  tags: TagResult[];
  key_sentences?: KeySentence[];
  extracted_text?: string;
  entities?: string[];
  model_version?: string;
  backend?: string;
}

export interface TaggedDocument {
  id: string;
  filename: string;
  mime: string;
  size: number;
  uploadedAt: number;
  latencyMs: number;
  extractedText: string;
  tags: TagResult[];
  keySentences: KeySentence[];
  entities: string[];
  /** Registry id of the backend that produced this result (e.g. "local"). */
  backend?: string;
  /** Concrete model name echoed by the API (e.g. "text-embedding-3-small"). */
  modelVersion?: string;
  error?: string;
}

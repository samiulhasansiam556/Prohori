
const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";

const EMBEDDING_MODEL =
  process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text";

export const EMBEDDING_DIMENSIONS = 768;

export async function generateEmbedding(
  text: string,
): Promise<number[]> {
  if (!text.trim()) {
    throw new Error("Cannot generate embedding for empty text");
  }

  const response = await fetch(
    `${OLLAMA_BASE_URL}/api/embeddings`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        prompt: text,
      }),
      signal: AbortSignal.timeout(60_000),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama embedding failed: ${error}`);
  }

  const data = (await response.json()) as {
    embedding?: number[];
  };

  if (
    !Array.isArray(data.embedding) ||
    data.embedding.length !== EMBEDDING_DIMENSIONS
  ) {
    throw new Error(
      `Invalid embedding dimensions. Expected ${EMBEDDING_DIMENSIONS}`,
    );
  }

  return data.embedding;
}

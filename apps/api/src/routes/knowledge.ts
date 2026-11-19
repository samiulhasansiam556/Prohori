import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { createUserSupabaseClient } from "../lib/supabase.js";
import { generateEmbedding } from "../lib/embeddings.js";

export const knowledgeRouter = Router();

const ingestSchema = z.object({
  title: z.string().trim().min(3).max(200),
  source: z.string().trim().min(1).max(500).default("synthetic-policy"),
  content: z.string().trim().min(50).max(100_000),
});

const searchSchema = z.object({
  query: z.string().trim().min(3).max(2000),
  limit: z.number().int().min(1).max(10).default(5),
});

function getSupabase(accessToken: string) {
  return createUserSupabaseClient(accessToken);
}

// Approximate 650-word chunks with 100-word overlap.
function chunkText(content: string): string[] {
  const words = content.split(/\s+/).filter(Boolean);
  const chunkSize = 650;
  const overlap = 100;
  const chunks: string[] = [];

  for (let start = 0; start < words.length; start += chunkSize - overlap) {
    const chunk = words.slice(start, start + chunkSize).join(" ");
    if (chunk.length >= 30) chunks.push(chunk);
  }

  return chunks;
}

knowledgeRouter.post(
  "/documents",
  requireAuth,
  requireRole("admin", "operator"),
  async (req, res) => {
    try {
      const parsed = ingestSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid document",
          errors: parsed.error.flatten(),
        });
      }

      const { title, source, content } = parsed.data;
      const chunks = chunkText(content);

      const embeddedChunks = [];

      for (let index = 0; index < chunks.length; index++) {
        const chunk = chunks[index]!;
        const embedding = await generateEmbedding(chunk);

        embeddedChunks.push({
          content: chunk,
          embedding: `[${embedding.join(",")}]`,
          metadata: {
            chunk_index: index,
            embedding_model: "nomic-embed-text",
            dimensions: embedding.length,
          },
        });
      }

      const accessToken = req.headers.authorization!.slice(7);
      const supabase = getSupabase(accessToken);

      const { data, error } = await supabase.rpc(
        "kb_ingest_document",
        {
          p_title: title,
          p_source: source,
          p_chunks: embeddedChunks,
        },
      );

      if (error) {
        console.error("Knowledge ingestion error:", error.message);
        return res.status(500).json({
          success: false,
          message: "Document storage failed",
        });
      }

      return res.status(201).json({
        success: true,
        message: "Document ingested successfully",
        document: data,
      });
    } catch (error) {
      console.error("Knowledge ingestion error:", error);

      return res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Knowledge ingestion failed",
      });
    }
  },
);

knowledgeRouter.post(
  "/search",
  requireAuth,
  async (req, res) => {
    try {
      const parsed = searchSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid search request",
          errors: parsed.error.flatten(),
        });
      }

      const { query, limit } = parsed.data;
      const embedding = await generateEmbedding(query);

      const accessToken = req.headers.authorization!.slice(7);
      const supabase = getSupabase(accessToken);

      const { data, error } = await supabase.rpc("kb_search", {
        p_embedding: `[${embedding.join(",")}]`,
        p_match_count: limit,
      });

      if (error) {
        console.error("Knowledge search error:", error.message);
        return res.status(500).json({
          success: false,
          message: "Policy search failed",
        });
      }

      const citations = (data ?? []).map((item: {
        chunk_id: string;
        document_id: string;
        title: string;
        source: string | null;
        content: string;
        similarity: number;
      }) => ({
        chunkId: item.chunk_id,
        documentId: item.document_id,
        title: item.title,
        source: item.source,
        content: item.content,
        score: Number(item.similarity),
      }));

      return res.status(200).json({
        success: true,
        query,
        results: citations,
        count: citations.length,
      });
    } catch (error) {
      console.error("Knowledge search error:", error);

      return res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Policy search failed",
      });
    }
  },
);

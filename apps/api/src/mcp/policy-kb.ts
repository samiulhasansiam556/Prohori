
import { z } from "zod";
import { generateEmbedding } from "../lib/embeddings.js";
import {
  createMcpServer,
  getMcpContext,
  jsonResult,
  errorResult,
  startMcpServer,
} from "./shared.js";

const server = createMcpServer("policy-kb");

server.registerTool(
  "search_policy",
  {
    description:
      "Search the tenant's policy knowledge base. Returns relevant policy chunks with source citations and similarity scores.",
    inputSchema: {
      query: z.string().min(3).max(2000),
      k: z.number().int().min(1).max(10).optional(),
    },
  },
  async ({ query, k }) => {
    try {
      const { supabase } = await getMcpContext();
      const embedding = await generateEmbedding(query);

      const { data, error } = await supabase.rpc("kb_search", {
        p_embedding: `[${embedding.join(",")}]`,
        p_match_count: k ?? 5,
      });

      if (error) throw error;

      return jsonResult({
        query,
        results: (data ?? []).map((item: {
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
        })),
      });
    } catch (error) {
      return errorResult(error);
    }
  },
);

await startMcpServer(server);


-- Prohori Step 3: Knowledge Base + RAG
-- Embedding model: Ollama nomic-embed-text (768 dimensions)

-- Fix embedding dimensions.
alter table public.kb_chunks
  alter column embedding type extensions.vector(768)
  using embedding::extensions.vector(768);

-- Cosine similarity index.
create index if not exists idx_kb_chunks_embedding_cosine
on public.kb_chunks
using hnsw (embedding extensions.vector_cosine_ops);

-- Save one document and all its chunks for the authenticated tenant.
create or replace function public.kb_ingest_document(
  p_title text,
  p_source text,
  p_chunks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_document_id uuid;
  v_role text;
  v_count integer;
  v_chunk jsonb;
begin
  select tenant_id, role
    into v_tenant_id, v_role
  from public.profiles
  where id = auth.uid();

  if v_tenant_id is null or v_role not in ('admin', 'operator') then
    raise exception 'Insufficient permissions';
  end if;

  if length(trim(p_title)) = 0
     or jsonb_typeof(p_chunks) <> 'array'
     or jsonb_array_length(p_chunks) = 0 then
    raise exception 'Invalid document payload';
  end if;

  insert into public.documents (tenant_id, title, source)
  values (v_tenant_id, p_title, p_source)
  returning id into v_document_id;

  for v_chunk in
    select value from jsonb_array_elements(p_chunks)
  loop
    insert into public.kb_chunks (
      document_id,
      content,
      embedding,
      metadata
    )
    values (
      v_document_id,
      v_chunk->>'content',
      (v_chunk->>'embedding')::extensions.vector(768),
      coalesce(v_chunk->'metadata', '{}'::jsonb)
    );
  end loop;

  get diagnostics v_count = row_count;

  return jsonb_build_object(
    'document_id', v_document_id,
    'chunks_inserted', v_count
  );
end;
$$;

-- Tenant-scoped semantic search with source citations.
create or replace function public.kb_search(
  p_embedding extensions.vector(768),
  p_match_count integer default 5
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  source text,
  content text,
  similarity double precision
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id
    into v_tenant_id
  from public.profiles
  where id = auth.uid();

  if v_tenant_id is null then
    raise exception 'Authenticated profile not found';
  end if;

  return query
  select
    c.id,
    d.id,
    d.title,
    d.source,
    c.content,
    (1 - (c.embedding <=> p_embedding))::double precision
  from public.kb_chunks c
  join public.documents d on d.id = c.document_id
  where d.tenant_id = v_tenant_id
    and c.embedding is not null
  order by c.embedding <=> p_embedding
  limit greatest(1, least(p_match_count, 10));
end;
$$;

-- Restrict RPC access to authenticated users.
revoke all on function public.kb_ingest_document(text, text, jsonb)
from public, anon;

revoke all on function public.kb_search(extensions.vector, integer)
from public, anon;

grant execute on function public.kb_ingest_document(text, text, jsonb)
to authenticated;

grant execute on function public.kb_search(extensions.vector, integer)
to authenticated;

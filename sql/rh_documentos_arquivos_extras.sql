-- ============================================================================
-- Migration: múltiplos arquivos por documento RH
-- Data: 2026-05
--
-- Adiciona a coluna `arquivos_extras` em `colaborador_documentos` para permitir
-- anexar mais de um PDF/foto no mesmo registro (ex.: ASO frente+verso, RG dos
-- dois lados, contrato com aditivos).
--
-- A coluna principal `arquivo_url` continua existindo e é o "arquivo principal"
-- mostrado nos badges; `arquivos_extras` armazena uma lista JSON de objetos
-- `{url, nome, enviado_em}` adicionais.
--
-- Executar no SQL Editor do Supabase:
-- ============================================================================

ALTER TABLE public.colaborador_documentos
  ADD COLUMN IF NOT EXISTS arquivos_extras jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.colaborador_documentos.arquivos_extras IS
  'Lista JSON de arquivos adicionais (frente+verso, aditivos). Formato: [{"url":"...","nome":"...","enviado_em":"YYYY-MM-DD"}]';

-- Garante que valores antigos NULL virem array vazio
UPDATE public.colaborador_documentos
  SET arquivos_extras = '[]'::jsonb
  WHERE arquivos_extras IS NULL;

-- ============================================================
-- 031: Campo "Pedido SAP" (opcional) na NFSe emitida
-- ============================================================
-- Adiciona referência opcional do pedido SAP na nota fiscal de serviço.
-- Idempotente.
-- ============================================================

ALTER TABLE public.notas_fiscais_servico
  ADD COLUMN IF NOT EXISTS pedido_sap text;

COMMENT ON COLUMN public.notas_fiscais_servico.pedido_sap IS
  'Número do pedido no SAP vinculado à NFSe (opcional).';

-- Recarrega o cache de schema do PostgREST.
NOTIFY pgrst, 'reload schema';

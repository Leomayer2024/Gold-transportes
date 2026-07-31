-- ============================================================
-- 036: NFSe → contrato + tipo de serviço + chave de acesso
-- Liga a NFSe emitida a um contrato operacional (auto-preenchimento
-- no lançamento) e classifica o que está sendo cobrado (HORA EXTRA,
-- SERVIÇO, CONTRATO...) — o tipo espelha na Conta a Receber (obrigacao).
-- Executar no Supabase Dashboard > SQL Editor. Idempotente.
-- ============================================================

ALTER TABLE notas_fiscais_servico
    ADD COLUMN IF NOT EXISTS chave_acesso            text,
    ADD COLUMN IF NOT EXISTS contrato_operacional_id bigint REFERENCES contratos_operacionais(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tipo_servico            text DEFAULT 'SERVIÇO';  -- HORA EXTRA | SERVIÇO | CONTRATO | KM RODADO | OUTRO

CREATE INDEX IF NOT EXISTS idx_nfse_contrato ON notas_fiscais_servico(contrato_operacional_id);

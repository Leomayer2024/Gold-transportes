-- ============================================================
-- Complementa contratos:
--  1. Adiciona `tipo_contrato` em contratos_operacionais.
--  2. Adiciona valores 'veiculo_proprio' e 'pacote_motorista_veiculo'
--     ao enum tipo_item_enum usado por contratos_colaboradores.
--
-- A coluna veiculo_proprio_id já foi criada em
-- 008_contratos_colaboradores_veiculo_proprio.sql.
--
-- Idempotente.
-- ============================================================

-- 1. tipo_contrato (text + check) — coluna nova
ALTER TABLE contratos_operacionais
    ADD COLUMN IF NOT EXISTS tipo_contrato TEXT DEFAULT 'rtm';

ALTER TABLE contratos_operacionais
    DROP CONSTRAINT IF EXISTS contratos_operacionais_tipo_contrato_check;

ALTER TABLE contratos_operacionais
    ADD CONSTRAINT contratos_operacionais_tipo_contrato_check
    CHECK (tipo_contrato IN ('rtm', 'veiculos', 'misto'));

UPDATE contratos_operacionais
    SET tipo_contrato = 'rtm'
    WHERE tipo_contrato IS NULL;

ALTER TABLE contratos_operacionais
    ALTER COLUMN tipo_contrato SET NOT NULL;

-- 2. Enum tipo_item_enum — adiciona valores novos sem quebrar existentes.
-- ALTER TYPE ADD VALUE precisa rodar fora de transação em alguns clientes,
-- mas no Supabase SQL Editor cada statement é commitado isoladamente.
ALTER TYPE tipo_item_enum ADD VALUE IF NOT EXISTS 'veiculo_proprio';
ALTER TYPE tipo_item_enum ADD VALUE IF NOT EXISTS 'pacote_motorista_veiculo';

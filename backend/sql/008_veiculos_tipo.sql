-- ============================================================
-- Adiciona coluna `tipo` em veiculos para classificar o uso
-- operacional do veículo: rota, transferencia, diaria, multidia.
-- Coexiste com `tipo_veiculo` (categoria física: caminhão, van...).
-- Idempotente.
-- ============================================================
ALTER TABLE veiculos
    ADD COLUMN IF NOT EXISTS tipo TEXT;

-- Constraint de valores permitidos (recria para garantir consistência).
ALTER TABLE veiculos
    DROP CONSTRAINT IF EXISTS veiculos_tipo_check;

ALTER TABLE veiculos
    ADD CONSTRAINT veiculos_tipo_check
    CHECK (tipo IS NULL OR tipo IN ('rota', 'transferencia', 'diaria', 'multidia'));

-- ============================================================
-- Amplia coluna `placa` em veiculos de VARCHAR(10) para TEXT.
-- Necessário para placas combo cavalo/carreta no formato
-- "ABC1D23/XYZ4W56" (15 chars).
-- Idempotente.
-- ============================================================
ALTER TABLE veiculos
    ALTER COLUMN placa TYPE TEXT;

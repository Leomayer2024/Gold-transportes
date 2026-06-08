-- Adiciona valor unitário e total a estoque_movimentos
ALTER TABLE estoque_movimentos ADD COLUMN IF NOT EXISTS valor_unitario NUMERIC;
ALTER TABLE estoque_movimentos ADD COLUMN IF NOT EXISTS valor_total NUMERIC;
NOTIFY pgrst, 'reload schema';

-- Adiciona coluna data_vencimento na tabela pedidos_compra
-- Executar no Supabase Dashboard > SQL Editor

ALTER TABLE pedidos_compra
  ADD COLUMN IF NOT EXISTS data_vencimento DATE;

-- Verificar resultado
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'pedidos_compra'
  AND column_name = 'data_vencimento';

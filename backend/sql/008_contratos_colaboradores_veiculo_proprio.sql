-- 008_contratos_colaboradores_veiculo_proprio.sql
-- Adiciona suporte a veículos próprios (frota Gold) como item do contrato.
-- Aplicar via Supabase Dashboard > SQL Editor.

ALTER TABLE contratos_colaboradores
  ADD COLUMN IF NOT EXISTS veiculo_proprio_id BIGINT
  REFERENCES veiculos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contratos_colaboradores_veiculo_proprio_id
  ON contratos_colaboradores(veiculo_proprio_id);

COMMENT ON COLUMN contratos_colaboradores.veiculo_proprio_id IS
  'FK para veiculos(id). Preenchido quando tipo_item = ''veiculo_proprio'' (frota Gold alocada ao contrato).';

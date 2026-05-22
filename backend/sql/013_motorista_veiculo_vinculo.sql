-- ============================================================
-- Vínculo motorista ↔ veículo via coluna em `colaboradores`.
-- Decisão de design: NÃO criar tabela separada. Cada motorista
-- tem 1 veículo padrão direto no próprio cadastro.
-- A RPC `get_veiculo_padrao_motorista` lê dessa coluna com
-- fallback em `contratos_colaboradores` (legado).
-- ============================================================

ALTER TABLE colaboradores
    ADD COLUMN IF NOT EXISTS veiculo_padrao_id BIGINT REFERENCES veiculos(id);

CREATE INDEX IF NOT EXISTS idx_colab_veiculo_padrao
    ON colaboradores(veiculo_padrao_id)
    WHERE veiculo_padrao_id IS NOT NULL;

-- RPC: nova coluna em colaboradores, fallback no contratos_colaboradores legado
CREATE OR REPLACE FUNCTION get_veiculo_padrao_motorista(p_colaborador_id BIGINT)
RETURNS TABLE (
    veiculo_id  BIGINT,
    placa       TEXT,
    marca       TEXT,
    modelo      TEXT,
    filial_id   BIGINT
)
LANGUAGE sql STABLE AS $$
    -- Fonte nova: coluna direta em colaboradores
    SELECT v.id, v.placa::TEXT, v.marca::TEXT, v.modelo::TEXT, v.filial_id
      FROM colaboradores c
      JOIN veiculos v ON v.id = c.veiculo_padrao_id
     WHERE c.id = p_colaborador_id
       AND c.veiculo_padrao_id IS NOT NULL
     LIMIT 1
    UNION ALL
    -- Fallback legado (contratos_colaboradores) — só se coluna nova vazia
    SELECT v.id, v.placa::TEXT, v.marca::TEXT, v.modelo::TEXT, v.filial_id
      FROM contratos_colaboradores cc
      JOIN veiculos v ON v.id = cc.veiculo_proprio_id
     WHERE cc.tipo_item = 'pacote_motorista_veiculo'
       AND cc.colaborador_id = p_colaborador_id
       AND COALESCE(cc.ativo, true) = true
       AND NOT EXISTS (
           SELECT 1 FROM colaboradores c2
            WHERE c2.id = p_colaborador_id AND c2.veiculo_padrao_id IS NOT NULL
       )
     ORDER BY cc.id DESC
     LIMIT 1
$$;

-- Limpa a tabela criada por engano em rev anterior (se existir)
DROP TABLE IF EXISTS motorista_veiculo_vinculo CASCADE;

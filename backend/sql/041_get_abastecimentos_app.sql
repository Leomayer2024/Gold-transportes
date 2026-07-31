-- ============================================================
-- 041: RPC get_abastecimentos_app — lista de abastecimentos p/ o app
-- ============================================================
-- Contexto:
--   * A tela "Solicitações" do app só listava Pedido de Compra
--     (get_pedidos_compra_app). Abastecimentos pendentes não apareciam.
--   * A RLS direta (policy abast_select_meus, 038) só deixa o motorista ler
--     o PRÓPRIO lançamento — um aprovador não enxerga os da filial.
--   * Igual aos pedidos, o app precisa de uma RPC SECURITY DEFINER que
--     devolve os abastecimentos (contornando a RLS de leitura restrita).
--
-- Somente LEITURA (o app mostra read-only; aprovação de combustível segue
-- só na web). Idempotente (DROP + CREATE).
-- ============================================================

DROP FUNCTION IF EXISTS get_abastecimentos_app();

CREATE OR REPLACE FUNCTION get_abastecimentos_app()
RETURNS TABLE (
  id                 BIGINT,
  numero_solicitacao TEXT,
  filial_id          BIGINT,
  filial_nome        TEXT,
  placa              TEXT,
  colaborador_nome   TEXT,
  data_abastecimento DATE,
  tipo_combustivel   TEXT,
  litros             NUMERIC,
  valor_litro        NUMERIC,
  valor_total        NUMERIC,
  odometro_km        NUMERIC,
  status             TEXT,
  fornecedor         TEXT,
  observacoes        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id::BIGINT,
    a.numero_solicitacao::TEXT,
    a.filial_id::BIGINT,
    (f.parceira || ' · ' || f.cidade || '/' || f.uf)::TEXT AS filial_nome,
    v.placa::TEXT,
    c.nome_completo::TEXT                                  AS colaborador_nome,
    a.data_abastecimento,
    a.tipo_combustivel::TEXT,
    a.litros,
    a.valor_litro,
    COALESCE(a.valor_total, a.litros * a.valor_litro, 0)   AS valor_total,
    a.odometro_km,
    a.status::TEXT,
    a.fornecedor::TEXT,
    a.observacoes::TEXT
  FROM veiculos_abastecimentos a
  LEFT JOIN filiais       f ON f.id = a.filial_id
  LEFT JOIN veiculos      v ON v.id = a.veiculo_id
  LEFT JOIN colaboradores c ON c.id = a.motorista_id
  WHERE a.ativo = TRUE
  ORDER BY a.data_abastecimento DESC, a.id DESC
  LIMIT 300;
END;
$$;

GRANT EXECUTE ON FUNCTION get_abastecimentos_app() TO authenticated;

NOTIFY pgrst, 'reload schema';

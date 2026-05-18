-- ============================================================
-- RPCs para o app mobile: pedidos de compra
-- Executar no Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 0. Remove funções antigas (necessário para trocar assinatura) ──

DROP FUNCTION IF EXISTS get_pedidos_compra_app();
DROP FUNCTION IF EXISTS get_itens_pedido(INTEGER);
DROP FUNCTION IF EXISTS aprovar_pedido(INTEGER, TEXT, TEXT);

-- ── 1. Lista de pedidos para o app ──────────────────────────

CREATE OR REPLACE FUNCTION get_pedidos_compra_app()
RETURNS TABLE (
  id                INTEGER,
  numero_pedido     TEXT,
  numero_solicitacao TEXT,
  filial_id         INTEGER,
  filial_nome       TEXT,
  data_pedido       DATE,
  status            TEXT,
  valor_total       NUMERIC,
  observacoes       TEXT,
  motivo_reprovacao TEXT,
  criador           JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.numero_pedido::TEXT,
    p.numero_solicitacao::TEXT,
    p.filial_id::INTEGER,
    (f.parceira || ' · ' || f.cidade || '/' || f.uf)::TEXT AS filial_nome,
    p.data_pedido,
    p.status::TEXT,
    COALESCE(
      (SELECT SUM(i.valor_total)
         FROM pedidos_compra_itens i
        WHERE i.pedido_id = p.id AND i.ativo = TRUE),
      p.valor_total,
      0
    )                   AS valor_total,
    p.observacoes::TEXT,
    p.motivo_reprovacao::TEXT,
    CASE
      WHEN c.id IS NOT NULL
        THEN jsonb_build_object('nome_completo', c.nome_completo)
      ELSE NULL
    END                 AS criador
  FROM pedidos_compra p
  LEFT JOIN filiais       f ON f.id = p.filial_id
  LEFT JOIN colaboradores c ON c.id = p.criado_por
  WHERE p.ativo = TRUE
  ORDER BY p.data_pedido DESC, p.id DESC;
END;
$$;

-- ── 2. Itens de um pedido específico ────────────────────────

CREATE OR REPLACE FUNCTION get_itens_pedido(p_pedido_id INTEGER)
RETURNS TABLE (
  id             INTEGER,
  descricao      TEXT,
  categoria      TEXT,
  quantidade     NUMERIC,
  unidade        TEXT,
  valor_unitario NUMERIC,
  valor_total    NUMERIC,
  observacoes    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.descricao::TEXT,
    i.categoria::TEXT,
    i.quantidade,
    i.unidade::TEXT,
    i.valor_unitario,
    i.valor_total,
    i.observacoes::TEXT
  FROM pedidos_compra_itens i
  WHERE i.pedido_id = p_pedido_id
    AND i.ativo = TRUE
  ORDER BY i.id;
END;
$$;

-- ── 3. Aprovar / Enviar para análise / Reprovar pedido ──────

CREATE OR REPLACE FUNCTION aprovar_pedido(
  p_pedido_id INTEGER,
  p_status    TEXT,
  p_motivo    TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_colab_id INTEGER;
  v_status_real TEXT;
BEGIN
  -- Resolve colaborador_id a partir do user_id do auth
  SELECT id INTO v_colab_id FROM colaboradores WHERE user_id = v_uid LIMIT 1;

  -- Normaliza status
  v_status_real := CASE p_status
    WHEN 'analise' THEN 'em_analise'
    ELSE p_status
  END;

  IF v_status_real = 'em_analise' THEN
    UPDATE pedidos_compra
    SET status         = 'em_analise',
        em_analise_por = v_colab_id,
        em_analise_em  = NOW(),
        updated_at     = NOW()
    WHERE id = p_pedido_id AND ativo = TRUE;

  ELSIF v_status_real = 'aprovado' THEN
    UPDATE pedidos_compra
    SET status       = 'aprovado',
        aprovado_por = v_colab_id,
        aprovado_em  = NOW(),
        atualizado_em = NOW()
    WHERE id = p_pedido_id AND ativo = TRUE;

  ELSIF v_status_real = 'reprovado' THEN
    UPDATE pedidos_compra
    SET status             = 'reprovado',
        motivo_reprovacao  = p_motivo,
        reprovado_por      = v_colab_id,
        reprovado_em       = NOW(),
        atualizado_em      = NOW()
    WHERE id = p_pedido_id AND ativo = TRUE;
  END IF;
END;
$$;

-- ── 4. Permissões ─────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION get_pedidos_compra_app()             TO authenticated;
GRANT EXECUTE ON FUNCTION get_itens_pedido(INTEGER)            TO authenticated;
GRANT EXECUTE ON FUNCTION aprovar_pedido(INTEGER, TEXT, TEXT)  TO authenticated;

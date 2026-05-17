-- ============================================================
-- MIGRATION: Pedidos de Compra Completo (v2 — corrigido)
-- Executar no Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. NOVOS CAMPOS EM pedidos_compra ───────────────────────
-- (numero_solicitacao já existe, os demais precisam ser criados)

ALTER TABLE pedidos_compra
  ADD COLUMN IF NOT EXISTS tipo_reembolso    VARCHAR(30)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS chave_pix         VARCHAR(200) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dados_bancarios   TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS aprovado_por      INTEGER      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS aprovado_em       TIMESTAMPTZ  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS em_analise_por    INTEGER      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS em_analise_em     TIMESTAMPTZ  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS motivo_reprovacao TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reprovado_por     INTEGER      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reprovado_em      TIMESTAMPTZ  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contas_pagar_id   INTEGER      DEFAULT NULL;

-- ── 2. TABELA itens_catalogo ─────────────────────────────────

CREATE TABLE IF NOT EXISTS itens_catalogo (
  id                  SERIAL PRIMARY KEY,
  filial_id           INTEGER       REFERENCES filiais(id) ON DELETE SET NULL,
  nome                VARCHAR(200)  NOT NULL,
  categoria           VARCHAR(50)   NOT NULL DEFAULT 'outro',
  unidade             VARCHAR(20)   NOT NULL DEFAULT 'un',
  valor_referencia    NUMERIC(12,2) DEFAULT NULL,
  fornecedor_habitual VARCHAR(200)  DEFAULT NULL,
  observacoes         TEXT          DEFAULT NULL,
  ativo               BOOLEAN       NOT NULL DEFAULT TRUE,
  criado_em           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_itens_catalogo_filial    ON itens_catalogo(filial_id);
CREATE INDEX IF NOT EXISTS idx_itens_catalogo_categoria ON itens_catalogo(categoria);
CREATE INDEX IF NOT EXISTS idx_itens_catalogo_ativo     ON itens_catalogo(ativo);

-- ── 3. solicitacao_counters já existe com coluna "ultimo_num" ─
-- Garante que o registro de pedidos_compra existe

INSERT INTO solicitacao_counters (tipo, prefixo, ultimo_num)
VALUES ('pedidos_compra', 'P', 0)
ON CONFLICT (tipo) DO NOTHING;

-- Função para gerar número de solicitação
-- Usa "ultimo_num" conforme a estrutura real da tabela

CREATE OR REPLACE FUNCTION gerar_numero_solicitacao(p_tipo VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_prefixo  VARCHAR;
  v_proximo  INTEGER;
BEGIN
  UPDATE solicitacao_counters
  SET    ultimo_num = ultimo_num + 1,
         atualizado_em = NOW()
  WHERE  tipo = p_tipo
  RETURNING prefixo, ultimo_num
  INTO v_prefixo, v_proximo;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN v_prefixo || LPAD(v_proximo::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ── 4. ATUALIZA approval_workflow_configs ───────────────────

INSERT INTO approval_workflow_configs
  (resource_type, label, tabela, status_field, pending_statuses,
   approved_status, rejected_status, view_scope, approval_scope,
   require_comment_on_approve, require_comment_on_reject, ativo)
VALUES (
  'pedidos_compra', 'Pedidos de Compra', 'pedidos_compra', 'status',
  ARRAY['pendente_aprovacao', 'em_analise'],
  'aprovado', 'reprovado',
  'menu.pedidos_compra', 'aprovar.pedidos_compra',
  FALSE, TRUE, TRUE
)
ON CONFLICT (resource_type) DO UPDATE SET
  pending_statuses          = ARRAY['pendente_aprovacao', 'em_analise'],
  approved_status           = 'aprovado',
  rejected_status           = 'reprovado',
  require_comment_on_reject = TRUE,
  ativo                     = TRUE;

-- ── 5. ÍNDICES ÚTEIS ────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_pedidos_compra_status      ON pedidos_compra(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_filial      ON pedidos_compra(filial_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_data_pedido ON pedidos_compra(data_pedido DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_itens       ON pedidos_compra_itens(pedido_id);

-- ── 6. VERIFICAÇÃO FINAL ────────────────────────────────────

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pedidos_compra'
  AND column_name IN (
    'tipo_reembolso','chave_pix','dados_bancarios',
    'aprovado_por','aprovado_em','em_analise_por','em_analise_em',
    'motivo_reprovacao','reprovado_por','reprovado_em','contas_pagar_id'
  )
ORDER BY column_name;

SELECT 'itens_catalogo criada/existente: ' || COUNT(*)::TEXT FROM itens_catalogo;
SELECT 'Migration concluída com sucesso!' AS resultado;

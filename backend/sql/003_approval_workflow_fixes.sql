-- ============================================================
-- Fix 1: manutencoes — status corretos do CHECK constraint
--   CHECK: 'aberta','aguardando_aprovacao','aprovada',
--          'em_execucao','concluida','cancelada','reprovada'
-- Os valores anteriores ('pendente_aprovacao','aprovado','reprovado')
-- violavam o constraint e impediam approve/reject de funcionar.
-- ============================================================
INSERT INTO approval_workflow_configs
    (resource_type, label, tabela, status_field, pending_statuses,
     approved_status, rejected_status, view_scope, approval_scope,
     require_comment_on_approve, require_comment_on_reject, ativo)
VALUES (
    'manutencoes', 'Manutenção de Frota', 'manutencoes', 'status',
    ARRAY['aguardando_aprovacao'], 'aprovada', 'reprovada',
    'menu.manutencoes', 'aprovar.manutencoes',
    FALSE, TRUE, TRUE
)
ON CONFLICT (resource_type) DO UPDATE SET
    pending_statuses = ARRAY['aguardando_aprovacao'],
    approved_status  = 'aprovada',
    rejected_status  = 'reprovada',
    atualizado_em    = NOW();

-- ============================================================
-- Fix 2: horas_extras — pending_status correto
--   Registros novos ficam com status='solicitado' (DEFAULT do DB).
--   O fallback Python usava 'pendente', causando lista vazia.
-- ============================================================
INSERT INTO approval_workflow_configs
    (resource_type, label, tabela, status_field, pending_statuses,
     approved_status, rejected_status, view_scope, approval_scope,
     require_comment_on_approve, require_comment_on_reject, ativo)
VALUES (
    'horas_extras', 'Horas Extras', 'horas_extras', 'status',
    ARRAY['solicitado'], 'aprovado', 'reprovado',
    'menu.horas_extras', 'aprovar.horas_extras',
    FALSE, TRUE, TRUE
)
ON CONFLICT (resource_type) DO UPDATE SET
    pending_statuses = ARRAY['solicitado'],
    atualizado_em    = NOW();

-- ============================================================
-- Fix 3: pedidos_compra — garantir linha no DB
-- ============================================================
INSERT INTO approval_workflow_configs
    (resource_type, label, tabela, status_field, pending_statuses,
     approved_status, rejected_status, view_scope, approval_scope,
     require_comment_on_approve, require_comment_on_reject, ativo)
VALUES (
    'pedidos_compra', 'Pedidos de Compra', 'pedidos_compra', 'status',
    ARRAY['pendente_aprovacao'], 'aprovado', 'cancelado',
    'menu.pedidos_compra', 'aprovar.pedidos_compra',
    FALSE, TRUE, TRUE
)
ON CONFLICT (resource_type) DO NOTHING;

-- ============================================================
-- Fix 4: CHECK constraints para status de aprovação
--   veiculos_abastecimentos e veiculos_pneus não tinham constraint.
--   Os valores possíveis cobrem todos os estados do workflow.
-- ============================================================
ALTER TABLE veiculos_abastecimentos
    DROP CONSTRAINT IF EXISTS chk_abastecimentos_status;
ALTER TABLE veiculos_abastecimentos
    ADD CONSTRAINT chk_abastecimentos_status
    CHECK (status IN ('pendente_aprovacao', 'aprovado', 'reprovado'));

ALTER TABLE veiculos_pneus
    DROP CONSTRAINT IF EXISTS chk_pneus_status_aprovacao;
ALTER TABLE veiculos_pneus
    ADD CONSTRAINT chk_pneus_status_aprovacao
    CHECK (status_aprovacao IN ('pendente_aprovacao', 'aprovado', 'reprovado'));

-- ============================================================
-- Fix 5: Remover tabelas legadas não utilizadas
-- ============================================================
DROP TABLE IF EXISTS manutencao_aprovacoes_config;
DROP TABLE IF EXISTS contract_metrics_cache;
DROP TABLE IF EXISTS auditoria_calculos;

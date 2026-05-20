-- ============================================================
-- Registra Diárias/Hotelaria, Abastecimentos e Pneus em
-- approval_workflow_configs. Sem isso, a aba "Aprovações" da
-- tela de Permissões não lista esses processos, mesmo com os
-- escopos aprovar.* funcionando no backend.
-- Idempotente.
-- ============================================================
INSERT INTO approval_workflow_configs
    (resource_type, label, tabela, status_field, pending_statuses,
     approved_status, rejected_status, view_scope, approval_scope,
     require_comment_on_approve, require_comment_on_reject, ativo)
VALUES (
    'diarias_solicitacoes', 'Diárias e Hotelaria', 'diarias_solicitacoes', 'status',
    ARRAY['pendente'], 'aprovado', 'reprovado',
    'menu.diarias', 'aprovar.diarias',
    FALSE, TRUE, TRUE
)
ON CONFLICT (resource_type) DO UPDATE SET
    label            = EXCLUDED.label,
    tabela           = EXCLUDED.tabela,
    status_field     = EXCLUDED.status_field,
    pending_statuses = EXCLUDED.pending_statuses,
    approved_status  = EXCLUDED.approved_status,
    rejected_status  = EXCLUDED.rejected_status,
    view_scope       = EXCLUDED.view_scope,
    approval_scope   = EXCLUDED.approval_scope,
    atualizado_em    = NOW();

INSERT INTO approval_workflow_configs
    (resource_type, label, tabela, status_field, pending_statuses,
     approved_status, rejected_status, view_scope, approval_scope,
     require_comment_on_approve, require_comment_on_reject, ativo)
VALUES (
    'abastecimentos', 'Abastecimentos', 'veiculos_abastecimentos', 'status',
    ARRAY['pendente_aprovacao'], 'aprovado', 'reprovado',
    'menu.abastecimentos', 'aprovar.abastecimentos',
    FALSE, TRUE, TRUE
)
ON CONFLICT (resource_type) DO NOTHING;

INSERT INTO approval_workflow_configs
    (resource_type, label, tabela, status_field, pending_statuses,
     approved_status, rejected_status, view_scope, approval_scope,
     require_comment_on_approve, require_comment_on_reject, ativo)
VALUES (
    'pneus', 'Controle de Pneus', 'veiculos_pneus', 'status_aprovacao',
    ARRAY['pendente_aprovacao'], 'aprovado', 'reprovado',
    'menu.pneus', 'aprovar.pneus',
    FALSE, TRUE, TRUE
)
ON CONFLICT (resource_type) DO NOTHING;

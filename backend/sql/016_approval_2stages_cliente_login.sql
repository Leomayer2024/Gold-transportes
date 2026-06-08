-- ============================================================
-- 016 — Aprovação em 2 etapas + tipo pagador HE + login cliente
-- ------------------------------------------------------------
-- Fluxos:
--   HE:          solicitado -> aprovado_lider -> aprovado (cliente aprova etapa 2)
--   Combustível: pendente_aprovacao -> aprovado_lider -> aprovado
--   Manutenção:  aguardando_aprovacao -> aprovado_lider -> aprovada
--   Diárias:     pendente -> aprovado_lider -> aprovado
-- Idempotente.
-- ============================================================

-- ── 1. Quem é líder/responsável: 100% via permissões de escopo ─
-- Permissões catalogadas (PERMISSION_SCOPE_GROUPS no app.py):
--   aprovar.horas_extras.lider
--   aprovar.manutencoes.lider / aprovar.manutencoes.responsavel
--   aprovar.abastecimentos.lider / aprovar.abastecimentos.responsavel
--   aprovar.diarias.lider / aprovar.diarias.responsavel
-- Filial é controlada pelo escopo de filial já existente (allowed_filial_ids).

-- ── 2. Horas extras: tipo pagador + 2 etapas ─────────────────
ALTER TABLE horas_extras
    ADD COLUMN IF NOT EXISTS tipo_pagador          VARCHAR(10),
    ADD COLUMN IF NOT EXISTS cliente_id            INT,
    ADD COLUMN IF NOT EXISTS aprovado_lider_por    INT,
    ADD COLUMN IF NOT EXISTS aprovado_lider_em     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS aprovado_cliente_por  INT,
    ADD COLUMN IF NOT EXISTS aprovado_cliente_em   TIMESTAMPTZ;

-- FK condicional (drop+recreate pra ser idempotente)
ALTER TABLE horas_extras DROP CONSTRAINT IF EXISTS fk_he_cliente;
ALTER TABLE horas_extras
    ADD CONSTRAINT fk_he_cliente FOREIGN KEY (cliente_id)
    REFERENCES clientes(id) ON DELETE SET NULL;

ALTER TABLE horas_extras DROP CONSTRAINT IF EXISTS chk_he_tipo_pagador;
ALTER TABLE horas_extras
    ADD CONSTRAINT chk_he_tipo_pagador
    CHECK (tipo_pagador IS NULL OR tipo_pagador IN ('cliente', 'gold'));

-- Atualizar CHECK constraint de status (incluir aprovado_lider)
ALTER TABLE horas_extras DROP CONSTRAINT IF EXISTS chk_he_status;
ALTER TABLE horas_extras
    ADD CONSTRAINT chk_he_status
    CHECK (status IS NULL OR status IN ('solicitado', 'pendente', 'aprovado_lider', 'aprovado', 'reprovado'));

COMMENT ON COLUMN horas_extras.tipo_pagador IS
    'Quem paga a HE: cliente (cliente_id obrigatório) ou gold (interno).';
COMMENT ON COLUMN horas_extras.cliente_id IS
    'FK clientes — preenchido quando tipo_pagador=cliente. Cliente loga no portal e aprova etapa 2.';

-- ── 3. Diárias: 2 etapas ──────────────────────────────────────
ALTER TABLE diarias_solicitacoes
    ADD COLUMN IF NOT EXISTS aprovado_lider_por  INT,
    ADD COLUMN IF NOT EXISTS aprovado_lider_em   TIMESTAMPTZ;

ALTER TABLE diarias_solicitacoes DROP CONSTRAINT IF EXISTS chk_diarias_status;
ALTER TABLE diarias_solicitacoes
    ADD CONSTRAINT chk_diarias_status
    CHECK (status IN ('pendente', 'em_analise', 'aprovado_lider', 'aprovado', 'reprovado', 'cancelado'));

-- ── 4. Abastecimentos: 2 etapas ───────────────────────────────
ALTER TABLE veiculos_abastecimentos
    ADD COLUMN IF NOT EXISTS aprovado_lider_por  INT,
    ADD COLUMN IF NOT EXISTS aprovado_lider_em   TIMESTAMPTZ;

ALTER TABLE veiculos_abastecimentos DROP CONSTRAINT IF EXISTS chk_abastecimentos_status;
ALTER TABLE veiculos_abastecimentos
    ADD CONSTRAINT chk_abastecimentos_status
    CHECK (status IN ('pendente_aprovacao', 'aprovado_lider', 'aprovado', 'reprovado'));

-- ── 5. Manutenções: 2 etapas ──────────────────────────────────
ALTER TABLE manutencoes
    ADD COLUMN IF NOT EXISTS aprovado_lider_por  INT,
    ADD COLUMN IF NOT EXISTS aprovado_lider_em   TIMESTAMPTZ;

-- Tabela manutencoes já tem status com check estendido. Adicionar aprovado_lider à lista.
ALTER TABLE manutencoes DROP CONSTRAINT IF EXISTS manutencoes_status_check;
ALTER TABLE manutencoes DROP CONSTRAINT IF EXISTS chk_manutencoes_status;
ALTER TABLE manutencoes
    ADD CONSTRAINT chk_manutencoes_status
    CHECK (status IN ('aberta', 'aguardando_aprovacao', 'aprovado_lider', 'aprovada',
                      'em_execucao', 'concluida', 'cancelada', 'reprovada'));

-- ── 6. Clientes: campos de login (portal cliente) ─────────────
ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS email_login    VARCHAR(255),
    ADD COLUMN IF NOT EXISTS senha_hash     TEXT,
    ADD COLUMN IF NOT EXISTS ativo_login    BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS ultimo_login   TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_email_login
    ON clientes(LOWER(email_login)) WHERE email_login IS NOT NULL;

COMMENT ON COLUMN clientes.email_login IS
    'E-mail usado pelo cliente pra logar no portal /portal-cliente. Único.';
COMMENT ON COLUMN clientes.senha_hash IS
    'Bcrypt hash da senha do cliente (portal cliente).';
COMMENT ON COLUMN clientes.ativo_login IS
    'Permite cliente logar. Se false, login negado.';

-- ── 7. Sessões cliente (tokens portal) ────────────────────────
CREATE TABLE IF NOT EXISTS clientes_sessoes (
    token         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id    INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expira_em     TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    ip_origem     TEXT,
    user_agent    TEXT
);

CREATE INDEX IF NOT EXISTS idx_clientes_sessoes_cliente
    ON clientes_sessoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_clientes_sessoes_expira
    ON clientes_sessoes(expira_em);

-- ── 8. Approval workflow configs: marcar processos 2 etapas ───
ALTER TABLE approval_workflow_configs
    ADD COLUMN IF NOT EXISTS two_stage           BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS stage1_label        VARCHAR(80),
    ADD COLUMN IF NOT EXISTS stage2_label        VARCHAR(80),
    ADD COLUMN IF NOT EXISTS stage1_scope        VARCHAR(80),
    ADD COLUMN IF NOT EXISTS stage2_scope        VARCHAR(80),
    ADD COLUMN IF NOT EXISTS stage1_intermediate_status VARCHAR(40);

UPDATE approval_workflow_configs SET
    two_stage = true,
    stage1_label = 'Líder da base',
    stage2_label = 'Responsável de frota',
    stage1_scope = 'aprovar.diarias.lider',
    stage2_scope = 'aprovar.diarias.responsavel',
    stage1_intermediate_status = 'aprovado_lider'
WHERE resource_type = 'diarias_solicitacoes';

UPDATE approval_workflow_configs SET
    two_stage = true,
    stage1_label = 'Líder da base',
    stage2_label = 'Responsável de frota',
    stage1_scope = 'aprovar.abastecimentos.lider',
    stage2_scope = 'aprovar.abastecimentos.responsavel',
    stage1_intermediate_status = 'aprovado_lider'
WHERE resource_type = 'abastecimentos';

UPDATE approval_workflow_configs SET
    two_stage = true,
    stage1_label = 'Líder da base',
    stage2_label = 'Responsável de frota',
    stage1_scope = 'aprovar.manutencoes.lider',
    stage2_scope = 'aprovar.manutencoes.responsavel',
    stage1_intermediate_status = 'aprovado_lider'
WHERE resource_type = 'manutencoes';

-- HE: 2 etapas, mas etapa 2 é o CLIENTE (não tem scope interno)
UPDATE approval_workflow_configs SET
    two_stage = true,
    stage1_label = 'Líder da base (Gold)',
    stage2_label = 'Cliente (portal externo)',
    stage1_scope = 'aprovar.horas_extras.lider',
    stage2_scope = 'cliente',
    stage1_intermediate_status = 'aprovado_lider'
WHERE resource_type = 'horas_extras';

-- Nada de backfill em colaboradores. Permissões são atribuídas via cargo
-- na tela de Permissões (Gestão de Acessos).

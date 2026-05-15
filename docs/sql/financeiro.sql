-- ============================================================
-- MÓDULO FINANCEIRO: Contas a Receber, Contas a Pagar, Banco
-- ============================================================

-- 1. tipo_hora no RTM (fixo = WM paga | extra = Gold absorve o custo)
ALTER TABLE horas_extras_rtm_registros
    ADD COLUMN IF NOT EXISTS tipo_hora text DEFAULT 'extra'
        CHECK (tipo_hora IN ('fixo', 'extra'));

CREATE INDEX IF NOT EXISTS idx_rtm_tipo_hora ON horas_extras_rtm_registros(tipo_hora);

-- ============================================================
-- 2. CONTAS A RECEBER
-- ============================================================
CREATE TABLE IF NOT EXISTS contas_a_receber (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    filial_id bigint REFERENCES filiais(id) ON DELETE SET NULL,
    filial_nome text,
    competencia date NOT NULL,
    obrigacao text NOT NULL,            -- HORA EXTRA | KM RODADO | HOSPEDAGEM | PEDAGIO | DESPESAS EXTRAS | OUTRO
    descricao text,

    -- Prazo de cobrança
    limite_dia int DEFAULT 10,          -- dia do mês limite
    data_limite date,                   -- data_limite calculada
    ult_dia_competencia date,
    prazo_envio text,                   -- 'ATÉ O DIA 10 - SUB' etc

    -- Valores
    valor_gold numeric(10,2) DEFAULT 0,     -- VALOR PG. GOLD (custo que Gold teve)
    data_pagamento_gold date,
    cobrado_wm numeric(10,2) DEFAULT 0,     -- COBRADO A WM (o que foi enviado para cobrança)
    data_envio date,                         -- DATA do envio da cobrança
    data_ajuste date,
    vlr_ajustado_wm numeric(10,2) DEFAULT 0,

    -- Frete / CTE
    frete numeric(10,2) DEFAULT 0,
    vlr_cte numeric(10,2) DEFAULT 0,
    vlr_fixo_icms numeric(10,2) DEFAULT 0,

    -- Documentos
    emissao date,
    nd text,                -- Nota de Débito
    cte text,               -- CT-e
    tipo_documento text,    -- 'ND' | 'CTE'
    ferramenta text,        -- 'SASCAR' | 'GW SISTEMAS' | 'E-MAIL RH' | 'PLANILHA DE CONTRATOS' etc
    prestacao text,
    contato text,

    -- Aprovação / autorização
    double_check text,
    autorizacao text,
    o_que_falta text,
    motivo_pendencia text,
    setor_responsavel text,
    previsao date,

    -- Status
    status_fat text DEFAULT 'NÃO FATURADO',  -- NÃO FATURADO | FATURADO | PARCIAL
    status text DEFAULT 'AGUARDANDO',         -- AGUARDANDO | COBRANÇA REALIZADA | FALTA COBRAR | RECEBIDO

    -- Vencimento e SLA
    data_vencimento date,
    sla int,

    -- Origem automática (RTM)
    horas_extras_rtm_mes date,    -- mes_referencia do fechamento RTM
    tipo_hora text,               -- 'fixo' | 'extra'

    -- Conciliação bancária
    banco_lancamento_id uuid,     -- FK adicionada após criar banco_lancamentos

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cr_filial ON contas_a_receber(filial_id);
CREATE INDEX IF NOT EXISTS idx_cr_competencia ON contas_a_receber(competencia);
CREATE INDEX IF NOT EXISTS idx_cr_obrigacao ON contas_a_receber(obrigacao);
CREATE INDEX IF NOT EXISTS idx_cr_status_fat ON contas_a_receber(status_fat);

-- RLS
ALTER TABLE contas_a_receber ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contas_a_receber' AND policyname='cr_auth_select') THEN
    CREATE POLICY "cr_auth_select" ON contas_a_receber FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contas_a_receber' AND policyname='cr_auth_insert') THEN
    CREATE POLICY "cr_auth_insert" ON contas_a_receber FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contas_a_receber' AND policyname='cr_auth_update') THEN
    CREATE POLICY "cr_auth_update" ON contas_a_receber FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contas_a_receber' AND policyname='cr_auth_delete') THEN
    CREATE POLICY "cr_auth_delete" ON contas_a_receber FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- ============================================================
-- 3. CONTAS A PAGAR
-- ============================================================
CREATE TABLE IF NOT EXISTS contas_a_pagar (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    filial_id bigint REFERENCES filiais(id) ON DELETE SET NULL,
    filial_nome text,
    competencia date NOT NULL,
    tipo_despesa text NOT NULL,   -- HORAS EXTRAS | FORNECEDOR | COLABORADOR | HOSPEDAGEM | KM | PEDAGIO | OUTRO
    descricao text,
    fornecedor_nome text,
    colaborador_id bigint REFERENCES colaboradores(id) ON DELETE SET NULL,

    -- Valores
    valor numeric(10,2) NOT NULL DEFAULT 0,
    data_vencimento date,
    data_pagamento date,
    valor_pago numeric(10,2) DEFAULT 0,

    -- Status
    status text DEFAULT 'PENDENTE',   -- PENDENTE | PAGO | VENCIDO | CANCELADO
    tipo_documento text,
    numero_documento text,
    observacoes text,

    -- Origem automática (RTM horas extras)
    horas_extras_rtm_mes date,
    colaboradores_count int DEFAULT 0,

    -- Conciliação bancária
    banco_lancamento_id uuid,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cp_filial ON contas_a_pagar(filial_id);
CREATE INDEX IF NOT EXISTS idx_cp_competencia ON contas_a_pagar(competencia);
CREATE INDEX IF NOT EXISTS idx_cp_status ON contas_a_pagar(status);
CREATE INDEX IF NOT EXISTS idx_cp_vencimento ON contas_a_pagar(data_vencimento);

-- RLS
ALTER TABLE contas_a_pagar ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contas_a_pagar' AND policyname='cp_auth_select') THEN
    CREATE POLICY "cp_auth_select" ON contas_a_pagar FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contas_a_pagar' AND policyname='cp_auth_insert') THEN
    CREATE POLICY "cp_auth_insert" ON contas_a_pagar FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contas_a_pagar' AND policyname='cp_auth_update') THEN
    CREATE POLICY "cp_auth_update" ON contas_a_pagar FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contas_a_pagar' AND policyname='cp_auth_delete') THEN
    CREATE POLICY "cp_auth_delete" ON contas_a_pagar FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- ============================================================
-- 4. BANCO — CONTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS banco_contas (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    filial_id bigint REFERENCES filiais(id) ON DELETE SET NULL,
    filial_nome text,
    banco_nome text NOT NULL,
    agencia text,
    conta text,
    tipo text DEFAULT 'corrente',   -- corrente | poupanca | investimento | caixa
    saldo_inicial numeric(15,2) DEFAULT 0,
    ativo boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banco_contas_filial ON banco_contas(filial_id);

-- RLS
ALTER TABLE banco_contas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='banco_contas' AND policyname='bc_auth_select') THEN
    CREATE POLICY "bc_auth_select" ON banco_contas FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='banco_contas' AND policyname='bc_auth_insert') THEN
    CREATE POLICY "bc_auth_insert" ON banco_contas FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='banco_contas' AND policyname='bc_auth_update') THEN
    CREATE POLICY "bc_auth_update" ON banco_contas FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='banco_contas' AND policyname='bc_auth_delete') THEN
    CREATE POLICY "bc_auth_delete" ON banco_contas FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- ============================================================
-- 5. BANCO — LANÇAMENTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS banco_lancamentos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conta_id uuid REFERENCES banco_contas(id) ON DELETE CASCADE,
    filial_id bigint REFERENCES filiais(id) ON DELETE SET NULL,
    filial_nome text,
    data_lancamento date NOT NULL,
    tipo text NOT NULL,       -- ENTRADA | SAIDA
    categoria text,           -- RECEBIMENTO_WM | PAGAMENTO_HE | PAGAMENTO_FORNECEDOR | TRANSFERENCIA | OUTRO
    descricao text NOT NULL,
    valor numeric(15,2) NOT NULL,
    conciliado boolean DEFAULT false,

    -- Links às outras tabelas
    conta_receber_id uuid REFERENCES contas_a_receber(id) ON DELETE SET NULL,
    conta_pagar_id uuid REFERENCES contas_a_pagar(id) ON DELETE SET NULL,

    observacoes text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bl_conta ON banco_lancamentos(conta_id);
CREATE INDEX IF NOT EXISTS idx_bl_filial ON banco_lancamentos(filial_id);
CREATE INDEX IF NOT EXISTS idx_bl_data ON banco_lancamentos(data_lancamento);
CREATE INDEX IF NOT EXISTS idx_bl_conciliado ON banco_lancamentos(conciliado);

-- RLS
ALTER TABLE banco_lancamentos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='banco_lancamentos' AND policyname='bl_auth_select') THEN
    CREATE POLICY "bl_auth_select" ON banco_lancamentos FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='banco_lancamentos' AND policyname='bl_auth_insert') THEN
    CREATE POLICY "bl_auth_insert" ON banco_lancamentos FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='banco_lancamentos' AND policyname='bl_auth_update') THEN
    CREATE POLICY "bl_auth_update" ON banco_lancamentos FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='banco_lancamentos' AND policyname='bl_auth_delete') THEN
    CREATE POLICY "bl_auth_delete" ON banco_lancamentos FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- FK reversa: contas_a_receber.banco_lancamento_id → banco_lancamentos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_cr_banco_lancamento' AND table_name = 'contas_a_receber'
  ) THEN
    ALTER TABLE contas_a_receber
      ADD CONSTRAINT fk_cr_banco_lancamento
      FOREIGN KEY (banco_lancamento_id) REFERENCES banco_lancamentos(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_cp_banco_lancamento' AND table_name = 'contas_a_pagar'
  ) THEN
    ALTER TABLE contas_a_pagar
      ADD CONSTRAINT fk_cp_banco_lancamento
      FOREIGN KEY (banco_lancamento_id) REFERENCES banco_lancamentos(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 6. COLUNAS CLIENTE/CONTRATO em contas_a_receber
-- ============================================================
ALTER TABLE contas_a_receber
    ADD COLUMN IF NOT EXISTS cliente_nome text,
    ADD COLUMN IF NOT EXISTS contrato_operacional_id bigint
        REFERENCES contratos_operacionais(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS contrato_nome text;

CREATE INDEX IF NOT EXISTS idx_cr_cliente ON contas_a_receber(cliente_nome);
CREATE INDEX IF NOT EXISTS idx_cr_contrato ON contas_a_receber(contrato_operacional_id);

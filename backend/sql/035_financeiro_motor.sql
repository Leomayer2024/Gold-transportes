-- ============================================================
-- 035 · MOTOR FINANCEIRO
-- Interliga documentos fiscais (NF/CT-e e NFSe) às Contas a
-- Pagar/Receber e adiciona parcelamento.
--
-- Aditivo e idempotente. Rodar no Supabase Dashboard > SQL Editor.
-- Nada aqui apaga dados; só cria colunas/tabelas se faltarem.
-- ============================================================

-- ── 1. Vínculo doc fiscal → conta gerada ────────────────────
-- notas_cte (documentos a pagar/receber): guarda a natureza do
-- lançamento e o id da conta que ele gerou.
ALTER TABLE public.notas_cte
    ADD COLUMN IF NOT EXISTS natureza        text DEFAULT 'pagar',   -- pagar | receber | nenhum
    ADD COLUMN IF NOT EXISTS gera_financeiro boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS conta_pagar_id   uuid,
    ADD COLUMN IF NOT EXISTS conta_receber_id uuid;

-- notas_fiscais_servico (NFSe = Gold prestadora → sempre a receber)
ALTER TABLE public.notas_fiscais_servico
    ADD COLUMN IF NOT EXISTS gera_financeiro  boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS conta_receber_id uuid;

-- ── 2. Metadados de origem e parcelamento nas contas ────────
ALTER TABLE public.contas_a_pagar
    ADD COLUMN IF NOT EXISTS origem_tipo    text,   -- pedido_compra | nota_cte | nfse | manual | rtm
    ADD COLUMN IF NOT EXISTS origem_id      text,   -- id do documento de origem (uuid/bigint como texto)
    ADD COLUMN IF NOT EXISTS parcelado      boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS parcelas_total int DEFAULT 1;

ALTER TABLE public.contas_a_receber
    ADD COLUMN IF NOT EXISTS origem_tipo    text,   -- nfse | nota_cte | manual | rtm
    ADD COLUMN IF NOT EXISTS origem_id      text,
    ADD COLUMN IF NOT EXISTS parcelado      boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS parcelas_total int DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_cp_origem ON public.contas_a_pagar(origem_tipo, origem_id);
CREATE INDEX IF NOT EXISTS idx_cr_origem ON public.contas_a_receber(origem_tipo, origem_id);

-- ── 3. Tabela de parcelas ───────────────────────────────────
-- Uma parcela pertence a uma conta a pagar OU a receber.
CREATE TABLE IF NOT EXISTS public.financeiro_parcelas (
    id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conta_tipo        text NOT NULL,               -- pagar | receber
    conta_pagar_id    uuid REFERENCES public.contas_a_pagar(id)   ON DELETE CASCADE,
    conta_receber_id  uuid REFERENCES public.contas_a_receber(id) ON DELETE CASCADE,
    filial_id         bigint REFERENCES public.filiais(id) ON DELETE SET NULL,

    numero            int  NOT NULL DEFAULT 1,      -- 1..total
    total             int  NOT NULL DEFAULT 1,
    valor             numeric(14,2) NOT NULL DEFAULT 0,
    data_vencimento   date,
    data_pagamento    date,
    valor_pago        numeric(14,2) DEFAULT 0,
    status            text DEFAULT 'PENDENTE',      -- PENDENTE | PAGO | VENCIDO | CANCELADO

    banco_lancamento_id uuid REFERENCES public.banco_lancamentos(id) ON DELETE SET NULL,
    observacoes       text,
    created_at        timestamptz DEFAULT now(),
    updated_at        timestamptz DEFAULT now(),

    CONSTRAINT chk_parcela_vinculo CHECK (
        (conta_tipo = 'pagar'   AND conta_pagar_id   IS NOT NULL) OR
        (conta_tipo = 'receber' AND conta_receber_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_parc_cp     ON public.financeiro_parcelas(conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_parc_cr     ON public.financeiro_parcelas(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_parc_venc   ON public.financeiro_parcelas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_parc_status ON public.financeiro_parcelas(status);
CREATE INDEX IF NOT EXISTS idx_parc_filial ON public.financeiro_parcelas(filial_id);

ALTER TABLE public.financeiro_parcelas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='financeiro_parcelas' AND policyname='fp_auth_select') THEN
    CREATE POLICY "fp_auth_select" ON public.financeiro_parcelas FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='financeiro_parcelas' AND policyname='fp_auth_insert') THEN
    CREATE POLICY "fp_auth_insert" ON public.financeiro_parcelas FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='financeiro_parcelas' AND policyname='fp_auth_update') THEN
    CREATE POLICY "fp_auth_update" ON public.financeiro_parcelas FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='financeiro_parcelas' AND policyname='fp_auth_delete') THEN
    CREATE POLICY "fp_auth_delete" ON public.financeiro_parcelas FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

COMMENT ON TABLE public.financeiro_parcelas IS 'Parcelas de contas a pagar/receber. Geradas manualmente ou ao lançar documento fiscal parcelado.';

SELECT 'motor financeiro 035 aplicado' AS resultado;

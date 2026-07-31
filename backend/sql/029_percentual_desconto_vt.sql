-- ============================================================
-- 029: Percentual de desconto de Vale Transporte por colaborador
-- ============================================================
-- Contexto:
--   Por lei (Lei 7.418/85 + Decreto 95.247/87), a empresa desconta do
--   colaborador ATÉ 6% do salário base a título de vale transporte, limitado
--   ao custo real do VT (o funcionário nunca paga mais que o benefício vale).
--
--   desconto = min(percentual% * salario_base, valor_total_VT)
--
--   Esse desconto reduz o custo LÍQUIDO da empresa no painel de Custos RH.
--   O percentual é editável por colaborador (padrão 6%) — algumas empresas
--   descontam menos ou nada.
-- ============================================================

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS percentual_desconto_vt numeric(5, 2) NOT NULL DEFAULT 6.00;

-- Garante faixa 0–100 (idempotente).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_colaboradores_percentual_desconto_vt'
  ) THEN
    ALTER TABLE public.colaboradores
      ADD CONSTRAINT chk_colaboradores_percentual_desconto_vt
      CHECK (percentual_desconto_vt >= 0 AND percentual_desconto_vt <= 100);
  END IF;
END $$;

COMMENT ON COLUMN public.colaboradores.percentual_desconto_vt IS
  'Percentual do salário base descontado do colaborador a título de VT (padrão 6%, máx. legal 6%). Aplicado limitado ao valor do VT no cálculo de custo líquido.';

-- Recarrega o cache de schema do PostgREST.
NOTIFY pgrst, 'reload schema';

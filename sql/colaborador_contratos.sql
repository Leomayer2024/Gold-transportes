-- ============================================================================
-- Migration: vínculo contratual do colaborador
-- Data: 2026-05
--
-- Modela o "vínculo contratual" como um conjunto de fases ligadas por um
-- vinculo_id. Caso CLT clássico:
--    fase=experiencia     (45 dias, ex.: 2026-01-01 → 2026-02-14)
--    fase=prorrogacao     (45 dias, ex.: 2026-02-15 → 2026-03-31)
--    fase=indeterminado   (sem data_fim, encerra apenas no desligamento)
--
-- Outros tipos (estágio, PJ, temporário, aprendiz) não usam "fase" — usam
-- apenas data_inicio / data_fim de cada termo (e podem ter renovações em
-- novas linhas com o mesmo vinculo_id).
--
-- Executar no SQL Editor do Supabase:
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.colaborador_contratos (
  id              bigserial PRIMARY KEY,
  colaborador_id  bigint NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  filial_id       bigint REFERENCES public.filiais(id) ON DELETE SET NULL,

  -- Agrupa as fases do mesmo emprego. Quando um vínculo termina (desligamento),
  -- todas as fases ficam marcadas com a mesma data_desligamento.
  vinculo_id      uuid NOT NULL DEFAULT gen_random_uuid(),

  tipo_vinculo    text NOT NULL CHECK (tipo_vinculo IN ('clt', 'estagio', 'pj', 'temporario', 'aprendiz')),
  fase            text CHECK (fase IN ('experiencia', 'prorrogacao', 'indeterminado', 'termo_unico', 'renovacao')),

  data_inicio     date NOT NULL,
  data_fim        date,           -- NULL = sem data fim (indeterminado em curso)

  data_desligamento     date,
  motivo_desligamento   text,

  cargo           text,
  salario         numeric(12, 2),
  observacoes     text,

  ativo           boolean NOT NULL DEFAULT true,

  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contratos_colaborador ON public.colaborador_contratos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_contratos_vinculo     ON public.colaborador_contratos(vinculo_id);
CREATE INDEX IF NOT EXISTS idx_contratos_filial      ON public.colaborador_contratos(filial_id);
CREATE INDEX IF NOT EXISTS idx_contratos_ativo       ON public.colaborador_contratos(ativo) WHERE ativo = true;

-- Trigger para atualizar atualizado_em automaticamente
CREATE OR REPLACE FUNCTION public.set_atualizado_em_contratos()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contratos_atualizado_em ON public.colaborador_contratos;
CREATE TRIGGER trg_contratos_atualizado_em
  BEFORE UPDATE ON public.colaborador_contratos
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em_contratos();

-- RLS (mesmo padrão das outras tabelas — desabilitado e acesso via service_role)
ALTER TABLE public.colaborador_contratos DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  public.colaborador_contratos      IS 'Vínculos contratuais dos colaboradores (CLT em fases 45+45→indeterminado, estágio, PJ, temporário, aprendiz)';
COMMENT ON COLUMN public.colaborador_contratos.vinculo_id IS 'Agrupa as fases do mesmo emprego. Desligamento fecha todas as fases com mesmo vinculo_id';
COMMENT ON COLUMN public.colaborador_contratos.fase       IS 'Apenas para CLT: experiencia (45d) → prorrogacao (+45d) → indeterminado. Outros tipos usam termo_unico ou renovacao';

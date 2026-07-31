-- ============================================================
-- 043: Tela de Checklist no app (seg_app) — tabela + RLS
-- ============================================================
-- Contexto:
--   O app Flutter (seg_app) fala DIRETO com o Supabase (JWT do usuário =>
--   role "authenticated"), igual ao módulo Treinamentos (030). A nova tela
--   de Checklist grava aqui.
--
-- Schema flexível: as respostas ficam em `respostas` (JSONB), no formato
--   { "<id_item>": { "resposta": "conforme|nao_conforme|na", "obs": "..." } }
-- Assim as PERGUNTAS podem mudar no app sem migração de coluna.
--
-- Segurança (segue o padrão do 028/030):
--   RLS on + policy "FOR ALL TO authenticated USING(true) WITH CHECK(true)".
--   anon (chave pública, sem login) fica BLOQUEADO.
--   Isolamento por filial não é feito no banco (igual ao resto do sistema).
--
-- Idempotente: CREATE ... IF NOT EXISTS, DROP POLICY IF EXISTS. Seguro re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.checklists (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    filial_id      BIGINT,
    colaborador_id BIGINT,
    tipo           TEXT         NOT NULL DEFAULT 'geral',
    identificacao  TEXT,                         -- placa / equipamento / setor
    cabecalho      JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- unidade, tripulação, veículo…
    respostas      JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- { id: {resposta, validade?, afericao?, ca?} }
    rodape         JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- realizado_por, alfa, assinatura, obs por seção
    observacoes    TEXT,
    status         TEXT         NOT NULL DEFAULT 'concluido',
    data           DATE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Colunas novas em bases que já tinham a tabela (idempotente).
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS cabecalho JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS rodape    JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Índices de consulta mais comuns (por filial / por colaborador / recentes).
CREATE INDEX IF NOT EXISTS idx_checklists_filial     ON public.checklists (filial_id);
CREATE INDEX IF NOT EXISTS idx_checklists_colaborador ON public.checklists (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_checklists_created    ON public.checklists (created_at DESC);

-- RLS: authenticated pode tudo; anon bloqueado.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklists TO authenticated;
REVOKE ALL ON public.checklists FROM anon;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS checklists_auth_all ON public.checklists;
CREATE POLICY checklists_auth_all ON public.checklists
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Escopo de menu p/ o app: concede 'menu.checklist' a quem já tem
-- 'menu.ordens_servico' (mesmo público operacional). Idempotente.
INSERT INTO public.permissoes (colaborador_id, permissao_nome, ativo, descricao)
SELECT DISTINCT p.colaborador_id, 'menu.checklist', true, 'Ver / preencher checklist'
FROM public.permissoes p
WHERE p.permissao_nome = 'menu.ordens_servico'
  AND p.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.permissoes p2
    WHERE p2.colaborador_id = p.colaborador_id
      AND p2.permissao_nome = 'menu.checklist'
  );

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- ROLLBACK:
--   DROP POLICY IF EXISTS checklists_auth_all ON public.checklists;
--   DROP TABLE IF EXISTS public.checklists;
--   DELETE FROM public.permissoes WHERE permissao_nome = 'menu.checklist';
-- ============================================================

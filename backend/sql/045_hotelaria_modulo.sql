-- ============================================================
-- 045: Módulo HOTELARIA (banco próprio, separado de Diária)
-- ============================================================
-- Hotelaria deixa de dividir tabela com diárias. Passa a ter tabela própria,
-- modelada 1:1 com o documento "SOLICITAÇÃO DE DEPÓSITO BANCÁRIO":
--
--   Solicitante      MOT. <motorista>, APROVADO POR <aprovador>
--   Chave Pix        <chave_pix>
--   Favorecido       <favorecido>
--   Placa/Motorista  <placa> - MOTORISTA: <motorista>;
--   Valor            R$ <valor>            DATA  <data_deposito>
--   Referente        Pernoite em <cidade>, Hotel <hotel>, UNIDADE: <filial>.
--
-- Fluxo de aprovação em 2 etapas:
--   pendente --(aprovar.hotelaria.lider)--> em_analise --(aprovar.hotelaria.responsavel)--> aprovado
--   qualquer etapa pode reprovar (com motivo).
--
-- Todo evento de status é gravado em hotelaria_historico por TRIGGER, então o
-- histórico ("quem aprovou, quando, o que escreveu") nunca depende da aplicação
-- lembrar de registrar. Idempotente. Seguro re-run.
-- ============================================================

-- ── 1. Solicitações ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hotelaria_solicitacoes (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_solicitacao TEXT UNIQUE,
    filial_id          BIGINT      NOT NULL,

    -- Corpo do documento
    motorista_nome     TEXT        NOT NULL,
    placa              TEXT,
    chave_pix          TEXT,
    favorecido         TEXT,
    valor              NUMERIC(12,2) NOT NULL DEFAULT 0,
    data_deposito      DATE,
    cidade             TEXT,
    hotel              TEXT,
    observacoes        TEXT,

    -- Fluxo
    status             TEXT        NOT NULL DEFAULT 'pendente',
    criado_por         BIGINT,
    criado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    analisado_por      BIGINT,     -- etapa 1 (líder)
    analisado_em       TIMESTAMPTZ,
    aprovado_por       BIGINT,     -- etapa 2 (responsável)
    aprovado_em        TIMESTAMPTZ,
    reprovado_por      BIGINT,
    reprovado_em       TIMESTAMPTZ,
    motivo_reprovacao  TEXT,

    CONSTRAINT chk_hotelaria_status
        CHECK (status IN ('pendente','em_analise','aprovado','reprovado','cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_hotelaria_filial   ON public.hotelaria_solicitacoes (filial_id);
CREATE INDEX IF NOT EXISTS idx_hotelaria_status   ON public.hotelaria_solicitacoes (status);
CREATE INDEX IF NOT EXISTS idx_hotelaria_criador  ON public.hotelaria_solicitacoes (criado_por);
CREATE INDEX IF NOT EXISTS idx_hotelaria_criado   ON public.hotelaria_solicitacoes (criado_em DESC);

-- ── 2. Histórico (trilha de aprovação) ──────────────────────
CREATE TABLE IF NOT EXISTS public.hotelaria_historico (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    solicitacao_id BIGINT NOT NULL REFERENCES public.hotelaria_solicitacoes(id) ON DELETE CASCADE,
    acao           TEXT   NOT NULL,   -- criado | em_analise | aprovado | reprovado | cancelado
    de_status      TEXT,
    para_status    TEXT,
    ator_id        BIGINT,
    ator_nome      TEXT,
    observacao     TEXT,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotelaria_hist_sol ON public.hotelaria_historico (solicitacao_id, criado_em DESC);

-- ── 3. Trigger: registra automaticamente cada transição ─────
CREATE OR REPLACE FUNCTION public.hotelaria_log_evento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ator  BIGINT;
    v_nome  TEXT;
    v_obs   TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_ator := NEW.criado_por;
        SELECT nome_completo INTO v_nome FROM colaboradores WHERE id = v_ator;
        INSERT INTO hotelaria_historico (solicitacao_id, acao, de_status, para_status, ator_id, ator_nome)
        VALUES (NEW.id, 'criado', NULL, NEW.status, v_ator, v_nome);
        RETURN NEW;
    END IF;

    -- UPDATE: só loga quando o status muda de fato.
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        v_ator := CASE NEW.status
            WHEN 'em_analise' THEN NEW.analisado_por
            WHEN 'aprovado'   THEN NEW.aprovado_por
            WHEN 'reprovado'  THEN NEW.reprovado_por
            ELSE NULL
        END;
        v_obs := CASE WHEN NEW.status = 'reprovado' THEN NEW.motivo_reprovacao ELSE NEW.observacoes END;
        SELECT nome_completo INTO v_nome FROM colaboradores WHERE id = v_ator;
        INSERT INTO hotelaria_historico (solicitacao_id, acao, de_status, para_status, ator_id, ator_nome, observacao)
        VALUES (NEW.id, NEW.status, OLD.status, NEW.status, v_ator, v_nome, v_obs);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hotelaria_log ON public.hotelaria_solicitacoes;
CREATE TRIGGER trg_hotelaria_log
    AFTER INSERT OR UPDATE ON public.hotelaria_solicitacoes
    FOR EACH ROW EXECUTE FUNCTION public.hotelaria_log_evento();

-- ── 4. Numeração própria (prefixo H) ────────────────────────
INSERT INTO public.solicitacao_counters (tipo, prefixo)
VALUES ('hotelaria', 'H')
ON CONFLICT (tipo) DO NOTHING;

-- ── 5. RLS: authenticated pode; anon bloqueado ──────────────
--     (isolamento por filial é aplicado na aplicação, igual ao resto do sistema)
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['hotelaria_solicitacoes','hotelaria_historico'] LOOP
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
        EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_all', t);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
                       t || '_auth_all', t);
    END LOOP;
END $$;

-- ── 6. Permissões do módulo (grupo próprio) ─────────────────
-- Migra quem já aprovava diárias para os escopos novos de hotelaria.
INSERT INTO public.permissoes (colaborador_id, permissao_nome, ativo, descricao)
SELECT DISTINCT p.colaborador_id, novo.nome, true, novo.descr
FROM public.permissoes p
CROSS JOIN LATERAL (VALUES
    ('menu.hotelaria',              'Ver hotelaria'),
    ('create.hotelaria',            'Solicitar hotelaria')
) AS novo(nome, descr)
WHERE p.permissao_nome IN ('menu.diarias','create.diarias')
  AND p.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.permissoes p2
    WHERE p2.colaborador_id = p.colaborador_id AND p2.permissao_nome = novo.nome
  );

INSERT INTO public.permissoes (colaborador_id, permissao_nome, ativo, descricao)
SELECT DISTINCT p.colaborador_id, novo.nome, true, novo.descr
FROM public.permissoes p
CROSS JOIN LATERAL (VALUES
    ('menu.hotelaria_aprovacoes',   'Ver aprovações de hotelaria')
) AS novo(nome, descr)
WHERE p.permissao_nome IN ('aprovar.diarias.lider','aprovar.diarias.responsavel','aprovar.diarias')
  AND p.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.permissoes p2
    WHERE p2.colaborador_id = p.colaborador_id AND p2.permissao_nome = novo.nome
  );

-- Etapa 1 e 2 mapeadas 1:1 a partir dos escopos antigos de diárias.
INSERT INTO public.permissoes (colaborador_id, permissao_nome, ativo, descricao)
SELECT DISTINCT p.colaborador_id, 'aprovar.hotelaria.lider', true, 'Aprovar hotelaria — etapa 1'
FROM public.permissoes p
WHERE p.permissao_nome = 'aprovar.diarias.lider' AND p.ativo = true
  AND NOT EXISTS (SELECT 1 FROM public.permissoes p2
                  WHERE p2.colaborador_id = p.colaborador_id AND p2.permissao_nome = 'aprovar.hotelaria.lider');

INSERT INTO public.permissoes (colaborador_id, permissao_nome, ativo, descricao)
SELECT DISTINCT p.colaborador_id, 'aprovar.hotelaria.responsavel', true, 'Aprovar hotelaria — etapa 2'
FROM public.permissoes p
WHERE p.permissao_nome IN ('aprovar.diarias.responsavel','aprovar.diarias') AND p.ativo = true
  AND NOT EXISTS (SELECT 1 FROM public.permissoes p2
                  WHERE p2.colaborador_id = p.colaborador_id AND p2.permissao_nome = 'aprovar.hotelaria.responsavel');

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_hotelaria_log ON public.hotelaria_solicitacoes;
--   DROP FUNCTION IF EXISTS public.hotelaria_log_evento();
--   DROP TABLE IF EXISTS public.hotelaria_historico;
--   DROP TABLE IF EXISTS public.hotelaria_solicitacoes;
--   DELETE FROM public.solicitacao_counters WHERE tipo = 'hotelaria';
--   DELETE FROM public.permissoes WHERE permissao_nome LIKE '%hotelaria%';
-- ============================================================

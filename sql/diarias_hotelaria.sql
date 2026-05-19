-- ============================================================================
-- Diárias (e depois Hotelaria)
-- Cabeçalho + itens + tabela de valores por cidade
-- ============================================================================

-- Valores de refeição por cidade (configurável; ex.: Londrina café 15, almoço 34,50)
CREATE TABLE IF NOT EXISTS public.diarias_valores (
  id          bigserial PRIMARY KEY,
  cidade      text NOT NULL,
  uf          text,
  cafe        numeric(10,2) NOT NULL DEFAULT 0,
  almoco      numeric(10,2) NOT NULL DEFAULT 0,
  jantar      numeric(10,2) NOT NULL DEFAULT 0,
  pernoite    numeric(10,2) NOT NULL DEFAULT 0,
  ativo       boolean NOT NULL DEFAULT true,
  observacoes text,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cidade, uf)
);

-- Cabeçalho da solicitação (uma viagem/uma data)
CREATE TABLE IF NOT EXISTS public.diarias_solicitacoes (
  id              bigserial PRIMARY KEY,
  filial_id       bigint NOT NULL REFERENCES public.filiais(id) ON DELETE CASCADE,
  numero_solicitacao text UNIQUE,
  tipo            text NOT NULL DEFAULT 'diaria' CHECK (tipo IN ('diaria','hotelaria')),
  cidade_destino  text NOT NULL,
  uf_destino      text,
  data_solicitacao date NOT NULL DEFAULT CURRENT_DATE,
  data_inicio     date NOT NULL,
  data_fim        date NOT NULL,
  rota            text,
  status          text NOT NULL DEFAULT 'rascunho'
                  CHECK (status IN ('rascunho','pendente','em_analise','aprovado','reprovado','pago','cancelado')),
  valor_total     numeric(12,2) NOT NULL DEFAULT 0,
  criado_por      bigint REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  aprovado_por    bigint REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  aprovado_em     timestamptz,
  motivo_reprovacao text,
  reprovado_por   bigint REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  reprovado_em    timestamptz,
  banco           text DEFAULT 'Itau',
  observacoes     text,
  ativo           boolean NOT NULL DEFAULT true,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

-- Itens: 1 linha por motorista/placa
CREATE TABLE IF NOT EXISTS public.diarias_itens (
  id                bigserial PRIMARY KEY,
  solicitacao_id    bigint NOT NULL REFERENCES public.diarias_solicitacoes(id) ON DELETE CASCADE,
  filial_id         bigint NOT NULL REFERENCES public.filiais(id) ON DELETE CASCADE,
  colaborador_id    bigint REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  motorista_nome    text NOT NULL,  -- copiado pra preservar histórico
  placa             text,
  data_inicio       date,
  data_fim          date,
  qtd_diarias       integer NOT NULL DEFAULT 0,
  qtd_pernoites     integer NOT NULL DEFAULT 0,
  inclui_cafe       boolean NOT NULL DEFAULT true,
  inclui_almoco     boolean NOT NULL DEFAULT true,
  inclui_jantar     boolean NOT NULL DEFAULT true,
  -- Snapshot dos valores aplicados (preserva mesmo se a tabela de valores mudar depois)
  valor_cafe        numeric(10,2) NOT NULL DEFAULT 0,
  valor_almoco      numeric(10,2) NOT NULL DEFAULT 0,
  valor_jantar      numeric(10,2) NOT NULL DEFAULT 0,
  valor_pernoite    numeric(10,2) NOT NULL DEFAULT 0,
  valor_total       numeric(12,2) NOT NULL DEFAULT 0,
  observacoes       text,
  -- Hotelaria (opcional)
  hotel_nome        text,
  hotel_fornecedor_id bigint,
  ativo             boolean NOT NULL DEFAULT true,
  criado_em         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diarias_filial      ON public.diarias_solicitacoes(filial_id);
CREATE INDEX IF NOT EXISTS idx_diarias_status      ON public.diarias_solicitacoes(status);
CREATE INDEX IF NOT EXISTS idx_diarias_data        ON public.diarias_solicitacoes(data_inicio);
CREATE INDEX IF NOT EXISTS idx_diarias_itens_sol   ON public.diarias_itens(solicitacao_id);

-- Trigger atualizado_em
CREATE OR REPLACE FUNCTION public.set_atualizado_em_diarias()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_diarias_sol_at ON public.diarias_solicitacoes;
CREATE TRIGGER trg_diarias_sol_at BEFORE UPDATE ON public.diarias_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em_diarias();

DROP TRIGGER IF EXISTS trg_diarias_valores_at ON public.diarias_valores;
CREATE TRIGGER trg_diarias_valores_at BEFORE UPDATE ON public.diarias_valores
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em_diarias();

ALTER TABLE public.diarias_valores       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.diarias_solicitacoes  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.diarias_itens         DISABLE ROW LEVEL SECURITY;

-- Seed: Londrina/PR (você pode ajustar depois)
INSERT INTO public.diarias_valores (cidade, uf, cafe, almoco, jantar, pernoite)
VALUES ('LONDRINA', 'PR', 15.00, 34.50, 34.50, 17.00)
ON CONFLICT (cidade, uf) DO NOTHING;

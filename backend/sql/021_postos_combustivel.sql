-- ============================================================
-- 021: Cadastro de postos de combustível + vínculo no abastecimento
-- ============================================================
-- Contexto:
--   * Antes, o posto era digitado à mão (texto livre "fornecedor") e o
--     preço por litro era redigitado em todo abastecimento.
--   * Agora existe um cadastro de postos com o preço por tipo de
--     combustível. Na tela de abastecimento basta escolher o posto e o
--     preço/nome são puxados automaticamente (o usuário ainda pode ajustar).
-- Idempotente: CREATE/ALTER ... IF NOT EXISTS. Seguro para re-run.
-- Requer Postgres >= 14 (Supabase roda 15+).
-- ============================================================

-- 1. Tabela de postos ------------------------------------------
CREATE TABLE IF NOT EXISTS public.postos_combustivel (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    filial_id         BIGINT      NOT NULL REFERENCES filiais (id) ON DELETE CASCADE,
    nome              TEXT        NOT NULL,
    cnpj              TEXT,
    endereco          TEXT,
    preco_diesel      NUMERIC(10, 3),
    preco_diesel_s10  NUMERIC(10, 3),
    preco_gasolina    NUMERIC(10, 3),
    preco_flex        NUMERIC(10, 3),
    preco_gnv         NUMERIC(10, 3),
    preco_arla        NUMERIC(10, 3),
    observacoes       TEXT,
    ativo             BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_postos_combustivel_filial
    ON public.postos_combustivel (filial_id, ativo);

COMMENT ON TABLE public.postos_combustivel IS
    'Cadastro de postos/fornecedores de combustível com preço por tipo de combustível.';

-- Idempotência: garante a coluna de ARLA mesmo se a tabela já existia antes.
ALTER TABLE public.postos_combustivel
    ADD COLUMN IF NOT EXISTS preco_arla NUMERIC(10, 3);

-- 2. Vínculo do posto no abastecimento -------------------------
--    Mantemos também a coluna texto "fornecedor" (preenchida com o nome do
--    posto) para preservar o histórico caso o posto seja excluído depois.
ALTER TABLE public.veiculos_abastecimentos
    ADD COLUMN IF NOT EXISTS posto_id BIGINT REFERENCES postos_combustivel (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_abastecimentos_posto
    ON public.veiculos_abastecimentos (posto_id);

COMMENT ON COLUMN public.veiculos_abastecimentos.posto_id IS
    'Posto escolhido no cadastro. Preenche automaticamente preço/nome no lançamento.';

-- Recarrega o cache de schema do PostgREST (evita PGRST204 logo após migrar).
NOTIFY pgrst, 'reload schema';

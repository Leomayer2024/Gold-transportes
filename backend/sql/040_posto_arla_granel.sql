-- ============================================================
-- 040: Preço de ARLA a granel no cadastro de postos
-- ============================================================
-- Contexto:
--   * O posto já tinha "preco_arla" (ARLA 32 em galão/embalado).
--   * Alguns postos também vendem ARLA a granel (da bomba/tanque),
--     geralmente com preço diferente. Adiciona coluna separada.
-- Idempotente: ADD COLUMN IF NOT EXISTS. Seguro para re-run.
-- ============================================================

ALTER TABLE public.postos_combustivel
    ADD COLUMN IF NOT EXISTS preco_arla_granel NUMERIC(10, 3);

COMMENT ON COLUMN public.postos_combustivel.preco_arla_granel IS
    'Preço por litro do ARLA 32 vendido a granel (bomba/tanque).';

-- Recarrega o cache de schema do PostgREST (evita PGRST204 logo após migrar).
NOTIFY pgrst, 'reload schema';

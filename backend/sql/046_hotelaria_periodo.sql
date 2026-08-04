-- ============================================================
-- 046: Período de hospedagem na Hotelaria (entrada → saída)
-- ============================================================
-- A solicitação passa a registrar o período do pernoite ("de dia tal a dia
-- tal"). A quantidade de NOITES é coluna GERADA pelo banco a partir das duas
-- datas — não dá para ficar inconsistente com o período informado.
--
-- Depende de 045_hotelaria_modulo.sql. Idempotente.
-- ============================================================

ALTER TABLE public.hotelaria_solicitacoes
    ADD COLUMN IF NOT EXISTS data_entrada DATE,
    ADD COLUMN IF NOT EXISTS data_saida   DATE;

-- Noites = diferença entre as datas (check-out menos check-in).
-- STORED + GENERATED: o banco recalcula sozinho a cada gravação.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'hotelaria_solicitacoes'
          AND column_name = 'noites'
    ) THEN
        ALTER TABLE public.hotelaria_solicitacoes
            ADD COLUMN noites INT GENERATED ALWAYS AS (
                CASE
                    WHEN data_entrada IS NOT NULL AND data_saida IS NOT NULL
                    THEN GREATEST(data_saida - data_entrada, 0)
                    ELSE NULL
                END
            ) STORED;
    END IF;
END $$;

-- Saída nunca antes da entrada.
ALTER TABLE public.hotelaria_solicitacoes DROP CONSTRAINT IF EXISTS chk_hotelaria_periodo;
ALTER TABLE public.hotelaria_solicitacoes
    ADD CONSTRAINT chk_hotelaria_periodo
    CHECK (data_entrada IS NULL OR data_saida IS NULL OR data_saida >= data_entrada);

COMMENT ON COLUMN public.hotelaria_solicitacoes.data_entrada IS 'Check-in do pernoite.';
COMMENT ON COLUMN public.hotelaria_solicitacoes.data_saida   IS 'Check-out do pernoite.';
COMMENT ON COLUMN public.hotelaria_solicitacoes.noites       IS 'Gerada: data_saida - data_entrada.';

NOTIFY pgrst, 'reload schema';

-- ROLLBACK:
--   ALTER TABLE public.hotelaria_solicitacoes DROP CONSTRAINT IF EXISTS chk_hotelaria_periodo;
--   ALTER TABLE public.hotelaria_solicitacoes
--     DROP COLUMN IF EXISTS noites, DROP COLUMN IF EXISTS data_saida, DROP COLUMN IF EXISTS data_entrada;

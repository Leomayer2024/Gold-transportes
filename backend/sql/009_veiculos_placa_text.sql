-- ============================================================
-- Amplia coluna `placa` em veiculos de VARCHAR(10) para TEXT.
-- View vw_manutencoes_abertas depende da coluna — dropa, altera,
-- recria preservando definição original via pg_get_viewdef.
-- Idempotente.
-- ============================================================
DO $$
DECLARE
    view_def TEXT;
BEGIN
    BEGIN
        SELECT pg_get_viewdef('vw_manutencoes_abertas'::regclass, true) INTO view_def;
    EXCEPTION WHEN undefined_table THEN
        view_def := NULL;
    END;

    IF view_def IS NOT NULL THEN
        EXECUTE 'DROP VIEW vw_manutencoes_abertas';
    END IF;

    ALTER TABLE veiculos ALTER COLUMN placa TYPE TEXT;

    IF view_def IS NOT NULL THEN
        EXECUTE 'CREATE VIEW vw_manutencoes_abertas AS ' || view_def;
    END IF;
END $$;

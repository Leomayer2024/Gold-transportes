-- ============================================================
-- 026: Índices faltando em colunas de Foreign Key
-- ============================================================
-- Contexto:
--   * O Supabase/Postgres cria índice automático só para PRIMARY KEY e
--     UNIQUE. Colunas de FOREIGN KEY (filial_id, colaborador_id, veiculo_id,
--     pedido_id, etc.) NÃO ganham índice sozinhas.
--   * Sem esse índice: todo JOIN por FK e toda checagem de ON DELETE varre a
--     tabela inteira (seq scan). Em multi-filial isso fica lento conforme cresce.
-- O que faz:
--   * Bloco dinâmico: varre TODAS as FKs de coluna única do schema public e
--     cria "idx_<tabela>_<coluna>" só onde ainda não existe índice liderado
--     por aquela coluna. Não duplica nada.
-- Segurança:
--   * IF NOT EXISTS + checagem em pg_index => 100% idempotente, seguro re-run.
--   * NÃO usa CONCURRENTLY (não roda dentro de bloco/DO). Usa CREATE INDEX
--     normal: pega SHARE lock por milissegundos por tabela. Como as tabelas
--     aqui são pequenas (milhares de linhas), o lock é imperceptível.
--   * Se alguma tabela virar gigante (>1M linhas) no futuro, rode o índice
--     daquela tabela à parte com CREATE INDEX CONCURRENTLY (fora de transação).
-- ============================================================

DO $$
DECLARE
    r          RECORD;
    v_idxname  TEXT;
BEGIN
    FOR r IN
        SELECT
            con.conrelid                       AS relid,
            con.conrelid::regclass::text        AS tbl,
            att.attname                         AS colname,
            con.conkey[1]                       AS first_attnum
        FROM pg_constraint con
        JOIN pg_class      cl  ON cl.oid  = con.conrelid
        JOIN pg_namespace  ns  ON ns.oid  = cl.relnamespace
        JOIN pg_attribute  att ON att.attrelid = con.conrelid
                              AND att.attnum   = con.conkey[1]
        WHERE con.contype = 'f'                 -- só foreign keys
          AND ns.nspname  = 'public'
          AND array_length(con.conkey, 1) = 1   -- FKs de coluna única
    LOOP
        -- Pula se já existe índice que começa por essa coluna
        IF NOT EXISTS (
            SELECT 1
            FROM pg_index i
            WHERE i.indrelid = r.relid
              AND i.indkey[0] = r.first_attnum
        ) THEN
            -- nome: idx_<tabela>_<coluna>, sem "public.", limitado a 63 chars
            v_idxname := left(
                'idx_' || replace(r.tbl, 'public.', '') || '_' || r.colname,
                63
            );
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %s (%I)',
                v_idxname, r.tbl, r.colname
            );
            RAISE NOTICE 'criado: % em %(%)', v_idxname, r.tbl, r.colname;
        END IF;
    END LOOP;
END $$;

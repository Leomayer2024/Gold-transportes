-- ============================================================
-- 017: Remover triggers/funções órfãs do cache legado de contratos
-- ============================================================
-- A tabela contract_metrics_cache foi dropada em 003, mas restaram:
--   - triggers em colaborador_beneficios (e outras) chamando funções
--     que mexem em contract_metrics_cache → erro 42P01
--   - funções como invalidar_cache_contrato(...) com assinatura
--     diferente da que os triggers esperam → erro 42883
-- Solução: dropar qualquer trigger/função que referencie no corpo
-- a tabela contract_metrics_cache OU a função invalidar_cache_contrato.
-- ============================================================

DO $$
DECLARE
    trig RECORD;
    fn_oid OID;
    fn_schema TEXT;
    fn_name TEXT;
    fn_args TEXT;
    pattern TEXT := '%(contract_metrics_cache|invalidar_cache_contrato)%';
BEGIN
    -- Dropa triggers cuja função do trigger referencia qualquer um dos
    -- nomes órfãos. Subquery isola filtro prokind='f'.
    FOR trig IN
        SELECT t.tgname AS trigger_name,
               c.relname AS table_name,
               n.nspname AS schema_name
          FROM pg_trigger t
          JOIN pg_class c ON c.oid = t.tgrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE NOT t.tgisinternal
           AND t.tgfoid IN (
               SELECT p.oid
                 FROM pg_proc p
                WHERE p.prokind = 'f'
                  AND p.prosrc ~* '(contract_metrics_cache|invalidar_cache_contrato)'
           )
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I',
                       trig.trigger_name, trig.schema_name, trig.table_name);
        RAISE NOTICE 'Removido trigger % em %.%',
                     trig.trigger_name, trig.schema_name, trig.table_name;
    END LOOP;

    -- Dropa funções órfãs que mencionam qualquer um dos nomes alvo.
    -- Coleta OIDs primeiro (subquery isolada), depois resolve assinatura.
    FOR fn_oid IN
        SELECT p.oid
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE p.prokind = 'f'
           AND (
                 p.prosrc ~* '(contract_metrics_cache|invalidar_cache_contrato)'
                 OR p.proname = 'invalidar_cache_contrato'
           )
           AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    LOOP
        SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
          INTO fn_schema, fn_name, fn_args
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE p.oid = fn_oid;

        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE',
                       fn_schema, fn_name, fn_args);
        RAISE NOTICE 'Removida função %.%(%)', fn_schema, fn_name, fn_args;
    END LOOP;
END $$;

-- ============================================================
-- 028: SEGURANÇA - fecha tabelas expostas ao role anon (chave pública)
-- ============================================================
-- Achado (auditoria 2026-07):
--   * A chave anon é pública (vai no bundle JS do frontend). Tudo que o role
--     "anon" pode fazer, qualquer pessoa na internet pode fazer via API REST
--     do Supabase, SEM login, ignorando a UI.
--   * 5 tabelas estavam com GRANT total (SELECT/INSERT/UPDATE/DELETE) pro anon
--     E com RLS DESLIGADO => escancaradas:
--       - colaborador_contratos  (salário, motivo de desligamento)
--       - veiculos               (frota; DELETE = apagar tudo)
--       - diarias_solicitacoes   (financeiro)
--       - diarias_itens          (financeiro)
--       - diarias_valores        (tabela de valores)
--   * jornadas_carregamento e rotas_carregamento tinham RLS off MAS sem grant
--     pro anon (só authenticated). Não estavam expostas; aqui só ligamos RLS
--     por defesa em profundidade.
--
-- Por que NÃO quebra o sistema atual:
--   * Backend usa service_role => tem BYPASSRLS e grants próprios; REVOKE de
--     anon e ENABLE RLS não afetam o backend.
--   * Frontend web NÃO consulta essas tabelas direto (vai pelo backend).
--   * App (Flutter) opera logado => role "authenticated", que MANTÉM o grant e
--     ganha policy permissiva. Continua funcionando igual.
--   * Só o acesso ANÔNIMO (sem login, chave pública crua) é bloqueado.
--
-- Idempotente: REVOKE e ENABLE RLS são no-op se já aplicados; policies usam
-- DROP ... IF EXISTS antes de criar. Seguro re-run.
--
-- >>> TESTE APÓS APLICAR: abrir tela de Veículos e criar uma Diária no app
--     (usuário logado). Se funcionar, está OK. Rollback no rodapé.
-- ============================================================

-- 1. TIRA o acesso do anônimo nas 5 tabelas expostas ----------
--    (authenticated e service_role permanecem intactos)
REVOKE ALL ON public.colaborador_contratos  FROM anon;
REVOKE ALL ON public.veiculos               FROM anon;
REVOKE ALL ON public.diarias_solicitacoes   FROM anon;
REVOKE ALL ON public.diarias_itens          FROM anon;
REVOKE ALL ON public.diarias_valores        FROM anon;

-- 2. Liga RLS nas 7 (defesa em profundidade) e cria policy que
--    libera só o usuário LOGADO. service_role ignora RLS de qualquer forma.
DO $$
DECLARE
    t TEXT;
    tabelas TEXT[] := ARRAY[
        'colaborador_contratos','veiculos','diarias_solicitacoes',
        'diarias_itens','diarias_valores','jornadas_carregamento',
        'rotas_carregamento'
    ];
BEGIN
    FOREACH t IN ARRAY tabelas LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                       t || '_auth_all', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
            'USING (true) WITH CHECK (true)',
            t || '_auth_all', t);
        RAISE NOTICE 'RLS on + policy authenticated: %', t;
    END LOOP;
END $$;

-- Recarrega o cache de schema do PostgREST.
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- OBS de segurança (fora do escopo deste script):
--   * Isolamento por FILIAL não é aplicado no banco: authenticated ainda vê
--     TODAS as linhas (igual hoje). Isolar por filial exige claim de filial no
--     JWT + policy "USING (filial_id = auth.jwt()...)". É projeto à parte.
--   * Rode a MESMA auditoria de grant/anon nas OUTRAS tabelas: pode haver mais
--     tabela com RLS off + grant anon fora dessas 7.
-- ============================================================

-- ROLLBACK (se algo legítimo usava anon e quebrou):
--   GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabela> TO anon;
--   ALTER TABLE public.<tabela> DISABLE ROW LEVEL SECURITY;

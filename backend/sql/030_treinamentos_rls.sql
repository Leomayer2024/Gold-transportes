-- ============================================================
-- 030: RLS do módulo Treinamentos (acesso DIRETO do frontend web)
-- ============================================================
-- Contexto:
--   A tela de Treinamentos (TreinamentosPage.jsx) fala DIRETO com o Supabase
--   pelo client do browser (JWT do usuário logado => role "authenticated"),
--   NÃO passa pelo backend/service_role. Igual ao app Flutter.
--
-- Sintoma:
--   * Matricular curso: "new row violates row-level security policy for
--     table trein_matriculas"  (INSERT bloqueado)
--   * Cursos já designados não aparecem na lista (SELECT volta 0 linhas)
--
-- Causa:
--   RLS está LIGADO em trein_matriculas mas SEM policy para authenticated.
--   Com RLS on e nenhuma policy permissiva: INSERT falha e SELECT retorna
--   vazio (sem erro). O service_role ignora RLS, mas aqui quem acessa é o
--   authenticated — então precisa de policy.
--
-- Correção (segue o padrão do 028):
--   RLS on + policy "FOR ALL TO authenticated USING(true) WITH CHECK(true)".
--   anon (chave pública) permanece BLOQUEADO.
--
-- Idempotente: GRANT/REVOKE/ENABLE são no-op se já aplicados; a policy usa
-- DROP ... IF EXISTS antes de criar. Seguro re-run.
--
-- >>> TESTE APÓS APLICAR: abrir Treinamentos (logado), designar um curso e
--     ver a lista carregar. Rollback no rodapé.
-- ============================================================

DO $$
DECLARE
    t TEXT;
    tabelas TEXT[] := ARRAY['trein_cursos', 'trein_matriculas'];
BEGIN
    FOREACH t IN ARRAY tabelas LOOP
        -- authenticated precisa do GRANT (verbo) + policy (linhas).
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
        -- anon (chave pública, sem login) fica de fora.
        EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_all', t);
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
-- OBS: isolamento por FILIAL não é aplicado no banco (igual ao resto do
-- sistema): authenticated vê TODAS as matrículas. Exigiria claim de filial
-- no JWT + USING (filial_id = ...). Projeto à parte.
-- ============================================================
--
-- ROLLBACK (se algo quebrar):
--   DROP POLICY IF EXISTS trein_matriculas_auth_all ON public.trein_matriculas;
--   DROP POLICY IF EXISTS trein_cursos_auth_all     ON public.trein_cursos;
--   ALTER TABLE public.trein_matriculas DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.trein_cursos     DISABLE ROW LEVEL SECURITY;

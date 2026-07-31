-- ============================================================
-- 038: Abastecimento no app — número da solicitação + histórico próprio
-- ============================================================
-- Fecha 2 sintomas do app (relato do usuário):
--   (1) Abastecimento salvo SEM numero_solicitacao (app não gera).
--   (2) Aba "Histórico" e card "Combust. pend." vazios (motorista não lê o
--       próprio lançamento avulso).
--
-- Causa (1): gerar_numero_solicitacao() rodava como o PAPEL CHAMADOR. A web gera
--   pelo backend (service_role, ignora RLS); o app fala direto (authenticated) e
--   o UPDATE no counter não achava linha => EXCEPTION => app salva sem número.
--   Idem (2): as policies liberavam a leitura só via os_motorista_id (rota da
--   OS); o abastecimento AVULSO grava motorista_id, sem os_motorista_id.
--
-- Este script é idempotente e ADITIVO (não altera o estado de RLS da tabela).
-- Consolida o fix de número (era o 032, aparentemente não aplicado) + a policy
-- de leitura do próprio histórico. Aplicar SÓ este 038 destrava os dois.
-- ============================================================

-- 1. Counter do tipo 'abastecimentos' (prefixo C) --------------
INSERT INTO public.solicitacao_counters (tipo, prefixo)
VALUES ('abastecimentos', 'C')
ON CONFLICT (tipo) DO NOTHING;

-- 2. Colunas que o app grava (idempotente) --------------------
ALTER TABLE public.veiculos_abastecimentos
    ADD COLUMN IF NOT EXISTS numero_solicitacao VARCHAR(20),
    ADD COLUMN IF NOT EXISTS motorista_id       BIGINT,
    ADD COLUMN IF NOT EXISTS registrado_por     BIGINT;

-- 3. gerar_numero_solicitacao como SECURITY DEFINER -----------
--    (roda como dono → o app authenticated consegue incrementar o counter)
DROP FUNCTION IF EXISTS public.gerar_numero_solicitacao(character varying);
CREATE OR REPLACE FUNCTION public.gerar_numero_solicitacao(p_tipo TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prefixo TEXT;
    v_num     INTEGER;
BEGIN
    UPDATE solicitacao_counters
       SET ultimo_num    = ultimo_num + 1,
           atualizado_em = NOW()
     WHERE tipo = p_tipo
    RETURNING prefixo, ultimo_num INTO v_prefixo, v_num;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tipo de solicitação desconhecido: %', p_tipo;
    END IF;

    RETURN v_prefixo || LPAD(v_num::TEXT, 5, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION public.gerar_numero_solicitacao(TEXT) TO authenticated, anon;

-- 4. Leitura do PRÓPRIO histórico (motorista) -----------------
--    Policy permissiva a mais (combina por OR com as existentes). Não faz
--    ENABLE/DISABLE de RLS pra não quebrar acessos já existentes.
GRANT SELECT ON public.veiculos_abastecimentos TO authenticated;

DROP POLICY IF EXISTS "abast_select_meus" ON public.veiculos_abastecimentos;
CREATE POLICY "abast_select_meus" ON public.veiculos_abastecimentos
    FOR SELECT TO authenticated
    USING (
        auth.uid() IS NOT NULL
        AND (
            motorista_id IN (
                SELECT id FROM public.colaboradores WHERE user_id = auth.uid()
            )
            OR registrado_por IN (
                SELECT id FROM public.colaboradores WHERE user_id = auth.uid()
            )
        )
    );

-- Recarrega o cache de schema do PostgREST.
NOTIFY pgrst, 'reload schema';

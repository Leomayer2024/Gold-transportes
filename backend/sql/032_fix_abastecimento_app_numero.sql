-- ============================================================
-- 032: App gera número de solicitação + garante colunas do abastecimento
-- ============================================================
-- Sintomas (relato do usuário):
--   * App: abastecimento salvo SEM "numero_solicitacao".
--   * Web/Acompanhamento: sem nome do colaborador / placa.
--
-- Causa nº 1 (número não gera pelo app):
--   gerar_numero_solicitacao() é LANGUAGE plpgsql SEM SECURITY DEFINER, então
--   roda como o PAPEL QUE CHAMA. O app fala direto com o Supabase logado
--   (role "authenticated"); a web gera pelo backend (service_role, ignora RLS).
--   O UPDATE em solicitacao_counters, chamado por "authenticated", não acha
--   linha (RLS/privilégio) => NOT FOUND => RAISE EXCEPTION => o app engole o
--   erro e salva sem número. Corrigido tornando a função SECURITY DEFINER
--   (roda como dono, ignora RLS do chamador) + GRANT EXECUTE aos papéis do app.
--
-- Causa nº 2 (colunas): garante numero_solicitacao / motorista_id /
--   registrado_por em veiculos_abastecimentos (o app grava esses campos).
--
-- Idempotente. Seguro re-run. NÃO aplica migrations 021-025 — rode o
-- APLICAR_TUDO_abastecimento_021_025.sql antes se ainda não rodou (fotos/itens/posto).
-- ============================================================

-- 1. Garante o contador do tipo 'abastecimentos' (prefixo C) ---
INSERT INTO public.solicitacao_counters (tipo, prefixo)
VALUES ('abastecimentos', 'C')
ON CONFLICT (tipo) DO NOTHING;

-- 2. Garante TODAS as colunas que o app grava (idempotente) ----
--    Inclui as de 021/022/024 (posto_id/itens/fotos): se aquelas migrations
--    não rodaram, o insert do app falha inteiro (o app só tem fallback p/ 'itens').
--    Assim, aplicar SÓ este 032 já destrava o lançamento pelo app.
ALTER TABLE public.veiculos_abastecimentos
    ADD COLUMN IF NOT EXISTS numero_solicitacao VARCHAR(20),
    ADD COLUMN IF NOT EXISTS motorista_id       BIGINT,
    ADD COLUMN IF NOT EXISTS registrado_por     BIGINT,
    ADD COLUMN IF NOT EXISTS posto_id           BIGINT,
    ADD COLUMN IF NOT EXISTS itens              JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS foto_painel_url    TEXT,
    ADD COLUMN IF NOT EXISTS foto_bomba_url     TEXT,
    ADD COLUMN IF NOT EXISTS foto_cupom_url     TEXT,
    ADD COLUMN IF NOT EXISTS foto_nota_url      TEXT;

COMMENT ON COLUMN public.veiculos_abastecimentos.motorista_id IS
    'Colaborador que fez a solicitação de abastecimento (app). FK lógica -> colaboradores.id.';
COMMENT ON COLUMN public.veiculos_abastecimentos.registrado_por IS
    'Colaborador que registrou o lançamento (app = mesmo do motorista).';

-- 3. Remove overload VARCHAR duplicado (evita PGRST203) --------
DROP FUNCTION IF EXISTS public.gerar_numero_solicitacao(character varying);

-- 4. Recria a função como SECURITY DEFINER --------------------
--    A ÚNICA diferença funcional vs. 004/023 é SECURITY DEFINER + search_path
--    fixo. Assim o app (authenticated) consegue incrementar o contador.
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

-- 5. Papéis do app podem EXECUTAR a função --------------------
GRANT EXECUTE ON FUNCTION public.gerar_numero_solicitacao(TEXT) TO authenticated, anon;

-- Recarrega o cache de schema do PostgREST.
NOTIFY pgrst, 'reload schema';

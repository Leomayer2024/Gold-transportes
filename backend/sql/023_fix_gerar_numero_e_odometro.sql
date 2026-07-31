-- ============================================================
-- 023: Corrige overload duplicado de gerar_numero_solicitacao (PGRST203)
-- ============================================================
-- Sintoma:
--   PGRST203 "Could not choose the best candidate function between
--   gerar_numero_solicitacao(p_tipo => character varying) e (p_tipo => text)".
-- Causa:
--   A função foi criada 2x com assinaturas diferentes: TEXT (004_os_numbers.sql)
--   e VARCHAR (pedidos_compra_completo.sql). O PostgREST não sabe qual chamar.
-- Correção:
--   Remove a versão VARCHAR e garante a versão canônica TEXT. Idempotente.
-- ============================================================

-- 1. Remove o overload VARCHAR duplicado ----------------------
DROP FUNCTION IF EXISTS public.gerar_numero_solicitacao(character varying);

-- 2. Garante a versão canônica TEXT (mesma de 004_os_numbers.sql) -------
CREATE OR REPLACE FUNCTION gerar_numero_solicitacao(p_tipo TEXT)
RETURNS TEXT
LANGUAGE plpgsql
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

-- Recarrega o cache de schema do PostgREST.
NOTIFY pgrst, 'reload schema';

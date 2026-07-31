-- ============================================================
-- 042 — Auto-cura da numeração de solicitações
-- ------------------------------------------------------------
-- Bug: POST /api/pedidos_compra caía em 409 / 23505
--   "duplicate key ... pedidos_compra_numero_solicitacao_key
--    Key (numero_solicitacao)=(P00012) already exists."
--
-- Causa: solicitacao_counters.ultimo_num ficou ATRÁS do MAX real
-- da tabela. Linhas entraram por fora do RPC (importação / numeração
-- antiga), o contador não acompanhou, e o RPC devolveu um número que
-- já existia -> estoura a unique constraint.
--
-- Correção: o RPC passa a reconciliar com o dado real antes de
-- incrementar: ultimo_num = GREATEST(ultimo_num, MAX_real) + 1.
-- Concorrência continua segura: o SELECT do MAX ocorre antes do
-- UPDATE, mas o row-lock do UPDATE serializa as chamadas simultâneas,
-- então dois processos nunca recebem o mesmo número.
-- ============================================================

CREATE OR REPLACE FUNCTION public.gerar_numero_solicitacao(p_tipo TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prefixo TEXT;
    v_num     INTEGER;
    v_tabela  TEXT;
    v_realmax INTEGER := 0;
BEGIN
    -- Mapa tipo -> tabela (todas usam a coluna numero_solicitacao).
    v_tabela := CASE p_tipo
        WHEN 'manutencoes'    THEN 'manutencoes'
        WHEN 'abastecimentos' THEN 'veiculos_abastecimentos'
        WHEN 'pedidos_compra' THEN 'pedidos_compra'
        WHEN 'horas_extras'   THEN 'horas_extras'
        WHEN 'pneus'          THEN 'veiculos_pneus'
        ELSE NULL
    END;

    -- MAX real já usado na tabela (extrai só os dígitos do numero_solicitacao).
    -- Defensivo: só roda se a tabela existir; senão mantém comportamento antigo.
    IF v_tabela IS NOT NULL AND to_regclass('public.' || v_tabela) IS NOT NULL THEN
        EXECUTE format(
            'SELECT COALESCE(MAX(NULLIF(regexp_replace(numero_solicitacao, ''\D'', '''', ''g''), '''')::int), 0)
               FROM public.%I',
            v_tabela
        ) INTO v_realmax;
    END IF;

    UPDATE solicitacao_counters
       SET ultimo_num    = GREATEST(ultimo_num, v_realmax) + 1,
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

-- Reseed imediato: alinha os contadores ao MAX real já existente, para
-- corrigir o estado agora (o RPC também se auto-cura na próxima chamada).
-- Defensivo: só toca em tabela/coluna que existem — não derruba a migração.
DO $$
DECLARE
    r          RECORD;
    v_realmax  INTEGER;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            ('manutencoes',    'manutencoes'),
            ('abastecimentos', 'veiculos_abastecimentos'),
            ('pedidos_compra', 'pedidos_compra'),
            ('horas_extras',   'horas_extras'),
            ('pneus',          'veiculos_pneus')
        ) AS t(tipo, tabela)
    LOOP
        IF to_regclass('public.' || r.tabela) IS NULL THEN
            CONTINUE;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = r.tabela
               AND column_name = 'numero_solicitacao'
        ) THEN
            CONTINUE;
        END IF;

        EXECUTE format(
            'SELECT COALESCE(MAX(NULLIF(regexp_replace(numero_solicitacao, ''\D'', '''', ''g''), '''')::int), 0)
               FROM public.%I',
            r.tabela
        ) INTO v_realmax;

        UPDATE solicitacao_counters
           SET ultimo_num = GREATEST(ultimo_num, v_realmax)
         WHERE tipo = r.tipo;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

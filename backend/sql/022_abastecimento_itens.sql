-- ============================================================
-- 022: Abastecimento com vários itens (combustíveis) no MESMO registro
-- ============================================================
-- Contexto:
--   * Antes, cada abastecimento tinha 1 combustível (tipo + litros + preço).
--   * Agora um único lançamento pode ter vários itens (ex.: Diesel + ARLA),
--     cada um com litros e preço. O detalhe fica na coluna JSONB "itens".
--   * As colunas litros / valor_litro / tipo_combustivel continuam existindo e
--     passam a guardar o CONSOLIDADO (litros = soma, valor_litro = média
--     ponderada, tipo = 'multiplo' quando há mais de um). Assim valor_total
--     (litros * valor_litro) e os relatórios de frota seguem corretos.
-- Idempotente: ADD COLUMN IF NOT EXISTS + backfill condicional. Seguro re-run.
-- ============================================================

-- 1. Coluna de itens -------------------------------------------
ALTER TABLE public.veiculos_abastecimentos
    ADD COLUMN IF NOT EXISTS itens JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.veiculos_abastecimentos.itens IS
    'Itens do abastecimento: [{tipo_combustivel, litros, valor_litro}]. litros/valor_litro/tipo_combustivel guardam o consolidado.';

-- 2. Backfill: registros antigos viram 1 item, preservando o histórico -------
UPDATE public.veiculos_abastecimentos
SET itens = jsonb_build_array(
        jsonb_build_object(
            'tipo_combustivel', COALESCE(tipo_combustivel, 'diesel'),
            'litros',           litros,
            'valor_litro',      valor_litro
        )
    )
WHERE (itens IS NULL OR itens = '[]'::jsonb)
  AND litros IS NOT NULL;

-- Recarrega o cache de schema do PostgREST (evita PGRST204 logo após migrar).
NOTIFY pgrst, 'reload schema';

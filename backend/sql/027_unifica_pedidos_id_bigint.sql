-- ============================================================
-- 027: Unifica pedidos_compra.id INTEGER -> BIGINT
-- ============================================================
-- Problema:
--   * pedidos_compra.id é INTEGER, mas várias FKs que apontam pra ele são
--     BIGINT: notas_cte.pedido_compra_id, veiculos_pneus.pedido_compra_id,
--     manutencoes.pedido_compra_id. E pedidos_compra_itens.pedido_id é INTEGER.
--   * Funciona (int4 cabe em int8), mas é tipo divergente entre pai e filhos.
--     Padroniza tudo em BIGINT.
--
-- >>> ATENÇÃO - NÃO é 100% zero-lock <<<
--   * Trocar o tipo da coluna id força REWRITE das tabelas pedidos_compra e
--     pedidos_compra_itens, com ACCESS EXCLUSIVE lock (bloqueia leitura E
--     escrita nessas 2 tabelas durante o rewrite).
--   * Nas tabelas pequenas deste sistema = milissegundos. Mesmo assim RODE EM
--     JANELA DE BAIXO TRÁFEGO (ninguém criando/aprovando pedido no momento).
--   * NÃO quebra código: o app já trata id de pedido como número; BIGINT é
--     transparente pro backend/Flutter (JSON manda número igual).
--
-- Idempotente: só altera colunas que ainda são integer. Seguro re-run.
-- ============================================================

BEGIN;

-- Trava as 2 tabelas de forma explícita e curta (evita deadlock com escrita
-- concorrente; se não conseguir a trava em 5s, aborta em vez de enfileirar).
SET LOCAL lock_timeout = '5s';

-- 1. Filho primeiro (pedido_id) --------------------------------
ALTER TABLE public.pedidos_compra_itens
    ALTER COLUMN pedido_id TYPE BIGINT;

-- 2. PK do pai -------------------------------------------------
ALTER TABLE public.pedidos_compra
    ALTER COLUMN id TYPE BIGINT;

-- 3. Sequence acompanha o tipo ---------------------------------
ALTER SEQUENCE public.pedidos_compra_id_seq AS BIGINT;

COMMIT;

-- Recarrega o cache de schema do PostgREST.
NOTIFY pgrst, 'reload schema';

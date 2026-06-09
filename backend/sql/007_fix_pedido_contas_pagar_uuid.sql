-- ============================================================
-- Corrige FK pedidos_compra.contas_pagar_id
--   contas_a_pagar.id é uuid, mas a coluna foi criada INTEGER.
--   Gravar o uuid falhava -> CP virava órfão e a sincronização
--   duplicava o lançamento a cada execução.
-- Este script:
--   1) troca a coluna INTEGER -> uuid
--   2) remove os Contas a Pagar duplicados gerados automaticamente
--   3) religa cada pedido ao CP restante
-- Idempotente. Rodar uma vez no Supabase (SQL editor).
-- ============================================================

-- 1) Coluna int -> uuid (valores atuais são órfãos/inválidos -> zera antes)
UPDATE pedidos_compra SET contas_pagar_id = NULL WHERE contas_pagar_id IS NOT NULL;

ALTER TABLE pedidos_compra ALTER COLUMN contas_pagar_id DROP DEFAULT;
ALTER TABLE pedidos_compra
    ALTER COLUMN contas_pagar_id TYPE uuid
    USING NULLIF(contas_pagar_id::text, '')::uuid;

-- (opcional) FK formal — descomente se quiser integridade referencial
-- ALTER TABLE pedidos_compra
--     ADD CONSTRAINT fk_pedido_contas_pagar
--     FOREIGN KEY (contas_pagar_id) REFERENCES contas_a_pagar(id) ON DELETE SET NULL;

-- 2) Dedup: mantém 1 CP por pedido.
--    Prioriza pago/finalizado > maior valor > mais antigo.
WITH auto AS (
    SELECT id, status, valor, created_at,
           (regexp_match(observacoes, 'pedido de compra #(\d+)'))[1]::int AS pedido_id
    FROM contas_a_pagar
    WHERE observacoes LIKE 'Gerado automaticamente do pedido de compra #%'
),
ranked AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY pedido_id
               ORDER BY (status IN ('PAGO', 'FINALIZADO')) DESC,
                        valor DESC,
                        created_at ASC
           ) AS rn
    FROM auto
)
DELETE FROM contas_a_pagar c
USING ranked r
WHERE c.id = r.id AND r.rn > 1;

-- 3) Religa pedido -> CP remanescente
WITH auto AS (
    SELECT id,
           (regexp_match(observacoes, 'pedido de compra #(\d+)'))[1]::int AS pedido_id
    FROM contas_a_pagar
    WHERE observacoes LIKE 'Gerado automaticamente do pedido de compra #%'
)
UPDATE pedidos_compra p
SET contas_pagar_id = a.id
FROM auto a
WHERE a.pedido_id = p.id;

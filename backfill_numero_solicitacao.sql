-- ============================================================
-- BACKFILL: Preenche numero_solicitacao nos pedidos que ficaram
-- sem número (criados antes ou durante falha transitória).
-- Executar no Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Verificar quais pedidos estão sem número
SELECT id, numero_pedido, data_pedido, status
FROM pedidos_compra
WHERE numero_solicitacao IS NULL
  AND ativo = TRUE
ORDER BY id;

-- 2. Preencher (execute apenas após verificar o SELECT acima)
DO $$
DECLARE
  r   RECORD;
  num TEXT;
BEGIN
  FOR r IN
    SELECT id
    FROM pedidos_compra
    WHERE numero_solicitacao IS NULL
      AND ativo = TRUE
    ORDER BY id
  LOOP
    num := gerar_numero_solicitacao('pedidos_compra');
    IF num IS NOT NULL THEN
      UPDATE pedidos_compra
      SET numero_solicitacao = num
      WHERE id = r.id;
      RAISE NOTICE 'Pedido % → %', r.id, num;
    END IF;
  END LOOP;
END;
$$;

-- 3. Confirmar resultado
SELECT id, numero_pedido, numero_solicitacao
FROM pedidos_compra
WHERE ativo = TRUE
ORDER BY id;

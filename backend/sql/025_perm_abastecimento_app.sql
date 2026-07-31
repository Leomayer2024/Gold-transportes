-- ============================================================
-- 025: Escopo de abastecimento no app + backfill
-- ============================================================
-- Contexto:
--   * Agora o botão "Combustível" na Ordem de Serviço (app) é liberado pelo
--     escopo 'menu.abastecimentos' (que passou a valer também no app).
--   * Sem backfill, quem já lançava combustível (tinha só 'menu.ordens_servico')
--     perderia o botão. Este script concede 'menu.abastecimentos' a todos que
--     já têm 'menu.ordens_servico' ativo.
-- Idempotente: NOT EXISTS impede duplicar. Seguro re-run.
-- ============================================================

INSERT INTO public.permissoes (colaborador_id, permissao_nome, ativo, descricao)
SELECT DISTINCT p.colaborador_id, 'menu.abastecimentos', true,
       'Ver / lançar abastecimentos'
FROM public.permissoes p
WHERE p.permissao_nome = 'menu.ordens_servico'
  AND p.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.permissoes p2
    WHERE p2.colaborador_id = p.colaborador_id
      AND p2.permissao_nome = 'menu.abastecimentos'
  );

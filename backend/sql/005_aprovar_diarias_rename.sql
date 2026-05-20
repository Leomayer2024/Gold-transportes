-- ============================================================
-- Renomeia escopo legado action.diarias.aprovar -> aprovar.diarias
-- Alinha o fluxo de aprovação de diárias ao padrão dos outros
-- recursos (aprovar.*) usado pela tela de Acompanhamento.
-- Idempotente: pode rodar várias vezes sem efeito colateral.
-- ============================================================

-- 1. Remove legado para colaboradores que JÁ têm o novo escopo
--    (evita duplicate key na constraint colaborador_id+permissao_nome)
DELETE FROM permissoes
 WHERE permissao_nome = 'action.diarias.aprovar'
   AND colaborador_id IN (
     SELECT colaborador_id
       FROM permissoes
      WHERE permissao_nome = 'aprovar.diarias'
   );

-- 2. Renomeia os restantes
UPDATE permissoes
   SET permissao_nome = 'aprovar.diarias'
 WHERE permissao_nome = 'action.diarias.aprovar';

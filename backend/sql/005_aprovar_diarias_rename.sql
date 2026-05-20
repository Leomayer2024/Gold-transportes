-- ============================================================
-- Renomeia escopo legado action.diarias.aprovar -> aprovar.diarias
-- Alinha o fluxo de aprovação de diárias ao padrão dos outros
-- recursos (aprovar.*) usado pela tela de Acompanhamento.
-- Idempotente: pode rodar várias vezes sem efeito colateral.
-- ============================================================

-- Atualiza registros existentes
UPDATE permissoes
   SET permissao_nome = 'aprovar.diarias'
 WHERE permissao_nome = 'action.diarias.aprovar';

-- Remove possíveis duplicatas que tenham aparecido após o rename
DELETE FROM permissoes p1
 USING permissoes p2
 WHERE p1.id > p2.id
   AND p1.colaborador_id = p2.colaborador_id
   AND p1.permissao_nome = p2.permissao_nome
   AND p1.permissao_nome = 'aprovar.diarias';

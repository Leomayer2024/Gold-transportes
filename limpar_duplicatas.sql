-- ============================================================
-- LIMPEZA DE DUPLICATAS - Executar no Supabase Dashboard > SQL Editor
-- Data: 2026-05-16
-- Duplicatas criadas pelo import em massa (IDs 168-182)
-- ============================================================

-- PASSO 1: Verifique se alguma duplicata já foi vinculada a contratos
-- Se retornar linhas, NÃO delete sem tratar antes.
SELECT cc.colaborador_id, c.nome_completo, cc.id as contrato_colab_id
FROM contratos_colaboradores cc
JOIN colaboradores c ON c.id = cc.colaborador_id
WHERE cc.colaborador_id IN (170, 173, 175, 176, 178, 179, 182);

-- PASSO 2: Verifique vínculos em outras tabelas
SELECT colaborador_id, COUNT(*) as total FROM presencas_diarias
WHERE colaborador_id IN (170, 173, 175, 176, 178, 179, 182) GROUP BY colaborador_id;

SELECT colaborador_id, COUNT(*) as total FROM horas_extras_rtm_registros
WHERE colaborador_id IN (170, 173, 175, 176, 178, 179, 182) GROUP BY colaborador_id;

-- ============================================================
-- PASSO 3: Depois de confirmar que não há vínculos, delete as duplicatas confirmadas.
-- Duplicatas certas (nome idêntico ao original, apenas maiúsculas):
--   175 = MAICON MACHADO     (original: id=7  Maicon Machado)
--   176 = PABLO LEAL...      (original: id=11 Pablo leal da Silva dos Santos)
--   173 = KEVEN RODRIGUES... (original: id=78 Keven Rodrigues Azambuja)
--   178 = PAULO ROBERTO...   (original: id=79 Paulo Roberto Rapetti Baptista)
--   179 = RAFAEL DE LACERDA  (original: id=3  Rafael De Lacerda)
--   182 = WESLEY RENE...     (original: id=86 Wesley Rene Reis Martins)
--   170 = GLEITON BENTO...   (original: id=81 Gleiton Bento De Vargas)
-- ============================================================

-- Descomente a linha abaixo apenas após verificar os passos 1 e 2:
-- DELETE FROM colaboradores WHERE id IN (170, 173, 175, 176, 178, 179, 182);

-- ============================================================
-- PASSO 4: Registros ambíguos — confirme manualmente se são a mesma pessoa:
--   172 = JORDI DA SILVA DIAS      (original: id=84 Jordi da Silva — DIAS adicionado)
--   171 = GUILHERME DO NASCIMENTO MONTERO (original: id=77 Guilherme do Nascimento — MONTERO adicionado)
--
-- Se for a mesma pessoa, delete:
-- DELETE FROM colaboradores WHERE id IN (171, 172);
-- ============================================================

-- PASSO 5: Registros genuinamente novos (NÃO delete):
--   168 = ALEXANDRE MARQUES RODRIGUES
--   169 = EVANDRO DA SILVA
--   174 = MAICON KELEMANN SILVA
--   177 = PAULO OLIVEIRA BITTENCOURT
--   180 = RENATO VOGT DOS SANTOS
--   181 = RICARDO LIMA
-- Estes precisam ter os dados completados (turno, horário, salário, CPF correto).

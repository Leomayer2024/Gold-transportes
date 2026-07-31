-- ============================================================
-- LIMPEZA DE DUPLICATAS — horas_extras_rtm_registros
-- Causa: import rodado 2x criava linhas duplicadas (delete antigo
--        chaveava por filial_nome texto livre e escapava no reimport).
-- Correção do código já aplicada em salvar_horas_extras_rtm (app.py).
-- Este script limpa as duplicatas que JÁ existem no banco.
-- Rodar no Supabase Dashboard > SQL Editor.
-- ============================================================

-- PASSO 1: veja as duplicatas antes de apagar (mesma pessoa, mesmo mês).
--          Agrupa por (mês, funcionario_nome) — chave visível na tela.
SELECT mes_referencia, funcionario_nome, COUNT(*) AS copias,
       array_agg(id ORDER BY created_at) AS ids
FROM horas_extras_rtm_registros
GROUP BY mes_referencia, funcionario_nome
HAVING COUNT(*) > 1
ORDER BY mes_referencia, funcionario_nome;

-- ============================================================
-- PASSO 2: apaga as duplicatas, mantendo a linha MAIS RECENTE
--          (maior created_at) de cada (mês, funcionario_nome).
--          Descomente para executar depois de conferir o PASSO 1.
-- ============================================================
-- DELETE FROM horas_extras_rtm_registros t
-- USING (
--   SELECT id,
--          ROW_NUMBER() OVER (
--            PARTITION BY mes_referencia, funcionario_nome
--            ORDER BY created_at DESC, id DESC
--          ) AS rn
--   FROM horas_extras_rtm_registros
-- ) d
-- WHERE t.id = d.id AND d.rn > 1;

-- PASSO 3: confirme que zerou (deve retornar 0 linhas).
-- SELECT mes_referencia, funcionario_nome, COUNT(*)
-- FROM horas_extras_rtm_registros
-- GROUP BY mes_referencia, funcionario_nome
-- HAVING COUNT(*) > 1;

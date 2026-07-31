-- ============================================================
-- 044: Campos de depósito bancário na solicitação de hotelaria/diárias
-- ============================================================
-- A "Solicitação de Depósito Bancário" (pernoite/hotel) precisa dos dados de
-- pagamento preenchidos por QUEM SOLICITA. O resto do documento (motorista,
-- placa, cidade, hotel, unidade, valor, data) é derivado da solicitação/itens.
--
-- Fluxo de aprovação em 2 etapas já existe (016): pendente -> aprovado_lider
-- (etapa 1, aprovar.diarias.lider) -> aprovado (etapa 2, aprovar.diarias.responsavel).
-- Este script só adiciona as colunas financeiras. Idempotente.
-- ============================================================

ALTER TABLE public.diarias_solicitacoes
    ADD COLUMN IF NOT EXISTS chave_pix       TEXT,   -- PIX do favorecido
    ADD COLUMN IF NOT EXISTS favorecido      TEXT,   -- nome de quem recebe
    ADD COLUMN IF NOT EXISTS dados_bancarios TEXT;   -- banco/agência/conta (livre)

COMMENT ON COLUMN public.diarias_solicitacoes.chave_pix IS 'Chave PIX do favorecido (depósito de hotelaria).';
COMMENT ON COLUMN public.diarias_solicitacoes.favorecido IS 'Nome do favorecido do depósito.';
COMMENT ON COLUMN public.diarias_solicitacoes.dados_bancarios IS 'Banco/agência/conta (texto livre) do depósito.';

-- Escopo de menu da tela dedicada: concede a quem já aprova diárias (qualquer etapa).
INSERT INTO public.permissoes (colaborador_id, permissao_nome, ativo, descricao)
SELECT DISTINCT p.colaborador_id, 'menu.hotelaria_aprovacoes', true, 'Ver Hotelaria — Aprovações'
FROM public.permissoes p
WHERE p.permissao_nome IN ('aprovar.diarias.lider', 'aprovar.diarias.responsavel', 'aprovar.diarias')
  AND p.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.permissoes p2
    WHERE p2.colaborador_id = p.colaborador_id
      AND p2.permissao_nome = 'menu.hotelaria_aprovacoes'
  );

NOTIFY pgrst, 'reload schema';

-- ROLLBACK:
--   ALTER TABLE public.diarias_solicitacoes
--     DROP COLUMN IF EXISTS chave_pix, DROP COLUMN IF EXISTS favorecido, DROP COLUMN IF EXISTS dados_bancarios;

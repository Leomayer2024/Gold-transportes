-- ============================================================
-- 019: Email do colaborador + campos de ajuste manual de ponto
-- ============================================================
-- Contexto:
--   * Ao bater ponto (app facial), o backend envia um email ao
--     colaborador com a batida + histórico do dia. Precisa de um
--     email destino por colaborador.
--   * A tela de Ponto do SEG permite ajuste manual das batidas
--     (corrigir horário, adicionar/remover). Registramos quem
--     ajustou, o motivo e quando, para auditoria.
-- Idempotente: ADD COLUMN IF NOT EXISTS. Seguro para re-run.
-- Pré-requisito: rodar antes o SQL_PONTO_FACIAL.sql (cria batidas_ponto).
-- Requer Postgres >= 14 (Supabase roda 15+).
-- ============================================================

-- 1. Email destino do colaborador (notificação de ponto) -------
ALTER TABLE public.colaboradores
    ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN public.colaboradores.email IS
    'Email pessoal do colaborador para receber a notificação de ponto batido.';

-- 2. Campos de ajuste manual em batidas_ponto ------------------
--    Guardado para não falhar caso batidas_ponto ainda não exista.
DO $$
BEGIN
  IF to_regclass('public.batidas_ponto') IS NOT NULL THEN
    ALTER TABLE public.batidas_ponto
      ADD COLUMN IF NOT EXISTS ajustado_por  TEXT,
      ADD COLUMN IF NOT EXISTS ajuste_motivo TEXT,
      ADD COLUMN IF NOT EXISTS editado_em    TIMESTAMPTZ;
  END IF;
END $$;

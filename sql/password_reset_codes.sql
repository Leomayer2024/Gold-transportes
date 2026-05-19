-- ============================================================================
-- Migration: códigos OTP de recuperação de senha
-- Data: 2026-05
--
-- Armazena códigos de 6 dígitos para o fluxo "esqueci minha senha".
-- O backend usa essa tabela quando o e-mail do Supabase Auth é fictício
-- (não chega na caixa real do colaborador) — então o código é enviado
-- via SMTP para um e-mail Gmail informado pelo próprio usuário na hora.
--
-- Executar no SQL Editor do Supabase:
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.password_reset_codes (
  id              bigserial PRIMARY KEY,

  -- E-mail do auth.users (login fictício) que pediu o reset
  email_login     text NOT NULL,
  -- E-mail Gmail informado para receber o código
  email_destino   text NOT NULL,

  -- Código de 6 dígitos enviado por e-mail
  codigo          text NOT NULL,

  -- IP de origem da solicitação (rate limit/auditoria)
  ip_origem       text,

  -- Estados do código
  usado           boolean NOT NULL DEFAULT false,
  tentativas      integer NOT NULL DEFAULT 0,

  -- Token de reset gerado após validar o código (usado para definir nova senha)
  reset_token     text,

  expira_em       timestamptz NOT NULL,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  usado_em        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pwd_reset_email_login  ON public.password_reset_codes (email_login);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_codigo       ON public.password_reset_codes (codigo) WHERE NOT usado;
CREATE INDEX IF NOT EXISTS idx_pwd_reset_token        ON public.password_reset_codes (reset_token) WHERE reset_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pwd_reset_criado       ON public.password_reset_codes (criado_em);

-- RLS desabilitada — acesso só via service_role (backend)
ALTER TABLE public.password_reset_codes DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  public.password_reset_codes IS 'Códigos OTP de recuperação de senha enviados para Gmail informado na hora pela pessoa';
COMMENT ON COLUMN public.password_reset_codes.email_login   IS 'E-mail do auth.users que pediu o reset (login fictício do sistema)';
COMMENT ON COLUMN public.password_reset_codes.email_destino IS 'E-mail Gmail informado pelo usuário no momento — recebe o código por SMTP';
COMMENT ON COLUMN public.password_reset_codes.reset_token   IS 'Token de uso único gerado após validar o código, dura 10 min, permite chamar redefinir-senha';

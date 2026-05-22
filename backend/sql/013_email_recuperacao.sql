-- Adiciona endereço de recuperação de senha por colaborador.
-- Cada colaborador pode ter um e-mail externo (Gmail pessoal, p.ex.) onde
-- receberá o código OTP de reset. Esse campo SUBSTITUI o input livre antigo
-- (que permitia tomada de conta — qualquer um podia redirecionar o OTP).
ALTER TABLE colaboradores
    ADD COLUMN IF NOT EXISTS email_recuperacao text;

COMMENT ON COLUMN colaboradores.email_recuperacao IS
    'E-mail externo usado APENAS para envio de OTP de recuperação de senha. NUNCA deve ser definível via request público — apenas pelo admin no cadastro do colaborador.';

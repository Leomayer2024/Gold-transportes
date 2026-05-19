# Configurar SMTP para recuperação de senha

A funcionalidade "Esqueci minha senha" envia um código de 6 dígitos por e-mail
usando SMTP do backend. Configure 5 variáveis de ambiente no servidor.

## 1) Crie a conta de envio

### Opção A — Gmail (mais simples, gratuito até 500 emails/dia)

1. Crie ou use uma conta Gmail dedicada (ex: `noreply@goldtransportes.com.br` ou `goldtransportes.sistema@gmail.com`)
2. Ative **verificação em 2 etapas** em https://myaccount.google.com/security
3. Em **Senhas de app** (https://myaccount.google.com/apppasswords), crie uma senha
   - Aplicativo: "Outro" → digite "SEG Backend"
   - Copie a senha de 16 caracteres gerada (sem espaços)

### Opção B — SendGrid / AWS SES / Mailgun

Use as credenciais SMTP que o provedor te dá. Limites maiores, sem CAPTCHA.

## 2) Adicione no `.env` do backend

```bash
# SMTP de saída para recuperação de senha
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=goldtransportes.sistema@gmail.com
SMTP_PASS=xxxxxxxxxxxxxxxx
SMTP_FROM=goldtransportes.sistema@gmail.com
SMTP_FROM_NAME=SEG - Gold Transportes
```

Em Render/Railway/Vercel/etc, adicione como variáveis de ambiente do serviço.

## 3) Rode a migration uma vez

No SQL Editor do Supabase, cole o conteúdo de
`sql/password_reset_codes.sql` e execute. Cria a tabela usada pelos códigos.

## 4) Reinicie o backend

As variáveis de ambiente só são lidas na inicialização. Reinicie o Flask
depois de configurar.

## 5) Teste

1. Abra `/login`, clique em "Esqueci minha senha"
2. Informe o e-mail de login fictício + um Gmail real seu
3. Cheque o Gmail (e a pasta spam) — o código deve chegar em ~10 segundos
4. Valide o código, defina nova senha

## Segurança / limites do backend

- Máximo 3 pedidos por hora para o mesmo e-mail de login
- Máximo 10 pedidos por hora vindos do mesmo IP
- Código expira em 15 minutos
- Após 5 tentativas erradas, o código é invalidado
- Reset token (gerado após validar código) dura 10 minutos e é de uso único

## Problemas comuns

| Erro | Causa |
|---|---|
| "SMTP não configurado no servidor" | Faltam variáveis de ambiente — passo 2 acima |
| "Não conseguimos enviar o e-mail" | Senha de app errada ou 2FA não ativado no Gmail |
| Código não chega | Verifique spam; teste outro provedor que não bloqueie Gmail |
| "Limite de 3 pedidos" | Aguarde 1h ou faça delete manual em `password_reset_codes` |

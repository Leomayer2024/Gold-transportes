**Deploy Produção — Guia Rápido (HTTPS + nginx)**

- **Objetivo:** configurar um servidor reverso (nginx) com TLS, proteger headers e servir o backend Flask (.venv) e frontend (build do Vite).

Pré-requisitos:
- VPS (Ubuntu 22.04+ recomendado)
- Domínio apontado para o servidor (A/AAAA)
- Certbot instalado (ou outro ACME client)
- Usuário com sudo

1) Build frontend

```bash
# no workspace frontend
cd frontend
npm install
npm run build
# gera dist/ (padrão Vite)
```

2) Estrutura recomendada no servidor

- `/var/www/seg/frontend` → copiar `frontend/dist/*`
- `/srv/seg/backend` → clonar repo e criar virtualenv, instalar requirements

3) Exemplo de serviço systemd para o backend (gunicorn)

`/etc/systemd/system/seg-backend.service`

```ini
[Unit]
Description=SEG Backend (gunicorn)
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/srv/seg/backend
Environment="PATH=/srv/seg/backend/.venv/bin"
Environment="FLASK_ENV=production"
Environment="SUPABASE_SERVICE_ROLE_KEY=<<COLOQUE_AQUI>>"
ExecStart=/srv/seg/backend/.venv/bin/gunicorn -b unix:/run/seg-backend.sock -w 4 "backend.app:create_app()"
Restart=always

[Install]
WantedBy=multi-user.target
```

4) Exemplo nginx (substitua `example.com`)

`/etc/nginx/sites-available/seg.conf`

```nginx
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/seg/frontend;
    index index.html;

    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to gunicorn via unix socket
    location /api/ {
        include proxy_params;
        proxy_pass http://unix:/run/seg-backend.sock:
    }

    # Files/uploads (se for servidos pelo nginx)
    location /uploads/ {
        alias /var/www/seg/uploads/;
        access_log off;
        expires 7d;
    }
}
```

5) Obter certificados (Certbot)

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

6) Boas práticas
- Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no frontend. Defina no systemd env ou em arquivo `.env` no servidor e restrinja permissões.
- Use `SECRET_KEY` forte para Flask e rode Gunicorn/uvicorn por trás do nginx.
- Rotacione chaves periodicamente e audite acessos.
- Habilite logging centralizado e alertas.

7) Testes rápidos
- Acesse `https://example.com` e verifique CSP/headers via devtools → security
- Teste endpoints `/api/*` para garantir backend responde via nginx

Se quiser, eu crio os arquivos de configuração com valores adaptados ao seu domínio e preparo comandos prontos para executar no servidor (incluindo `rsync` para enviar os build artifacts).
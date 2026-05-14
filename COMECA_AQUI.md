# 🎯 RESUMO RÁPIDO - COLOCA NA WEB EM 5 MINUTOS

## 1️⃣ Compile o Frontend
```bash
# Windows: duplo-clique em BUILD.bat
# Ou no terminal:
cd frontend
npm install
npm run build
```

## 2️⃣ Vai aparecer uma pasta `frontend/dist/`

## 3️⃣ Acesse Render.com
- Crie conta grátis
- Click "+ New" → "Web Service"
- Configure:
  - Build: `cd backend && pip install -r requirements.txt`
  - Start: `cd backend && python app.py`

## 4️⃣ Adicione Variáveis (Settings → Environment)
```
SUPABASE_URL=sua_url
SUPABASE_KEY=sua_chave
PORT=10000
```

## 5️⃣ Click Deploy
- Aguarde 3-5 min
- Render gera URL automática
- Pronto! 🚀

## ⚠️ Importante
- Seu projeto **JÁ ESTÁ PRONTO**
- Basta fazer o build do frontend
- Backend já configurado para servir tudo

---

**Dúvida?** Veja o arquivo `DEPLOY_MANUAL.md` para passos detalhados.

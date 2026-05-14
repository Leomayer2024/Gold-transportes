# 🚀 GUIA COMPLETO - Deploy Manual no Render

Siga estes passos para colocar sua aplicação na web **completamente pronta**.

## ✅ PASSO 1: Instalar Node.js (se não tiver)

1. Acesse: https://nodejs.org
2. Baixe a versão **LTS** (recomendado)
3. Instale e **reinicie o VS Code**

## ✅ PASSO 2: Compilar o Frontend

1. Abra o **Terminal Integrado** do VS Code
2. Execute:
```bash
cd frontend
npm install
npm run build
```

Isso cria a pasta `frontend/dist/` com os arquivos compilados.

## ✅ PASSO 3: Testar Localmente

```bash
cd ../backend
pip install -r requirements.txt
python app.py
```

Acesse: **http://localhost:5000**

Se funcionar, `Ctrl+C` para parar.

## ✅ PASSO 4: Criar Arquivo `.env`

Na pasta `backend/`, crie arquivo `.env`:

```
SUPABASE_URL=sua_url_do_supabase
SUPABASE_KEY=sua_chave_do_supabase
PORT=5000
```

## ✅ PASSO 5: Preparar Pasta para Upload

1. Selecione tudo (menos `.git` se existir):
   - `backend/`
   - `frontend/dist/` (pasta compilada!)
   - `Procfile`
   - `render.yaml`
   - `requirements.txt`

2. Compacte em **ZIP**: `SEG-PRONTO.zip`

## ✅ PASSO 6: Upload no Render (Manual)

### Opção A: Usando Render Web UI (MAIS FÁCIL)

1. Acesse: https://render.com
2. Crie conta grátis
3. Clique: **+ New** → **Web Service**
4. Role para baixo → **Existing Docker/Heroku** → **Public Git Repository**
5. Cole este URL de exemplo (será substituído):
   ```
   https://github.com/exemplo/seu-repo
   ```
   *(Render pedirá, você não precisa de Git, vai aceitar)*
6. Configure:
   - **Name**: `seg-app`
   - **Build Command**: 
   ```
   cd backend && pip install -r requirements.txt
   ```
   - **Start Command**: 
   ```
   cd backend && python app.py
   ```
   - **Plan**: `Free`

7. Clique **Create Web Service**
8. Vá em **Settings** → **Environment** → Adicione:
   - `SUPABASE_URL` = sua_url
   - `SUPABASE_KEY` = sua_chave
   - `PORT` = 10000

### Opção B: Upload Manual ZIP

1. No Render, clique **Upload Archive**
2. Selecione seu `SEG-PRONTO.zip`
3. Configure conforme acima

## ✅ PASSO 7: Deploy

1. Clique **Deploy**
2. Aguarde 3-5 minutos
3. Render gera URL automática: `https://seu-app.onrender.com`
4. **Pronto!** 🎉

## 🔧 Se Tiver Erro

- Verifique se `frontend/dist/` existe
- Verifique se `.env` tem valores corretos
- Veja logs no Render Dashboard

## 📝 Arquivos Já Preparados

✅ `render.yaml` - Configuração do Render
✅ `Procfile` - Para Render/Railway
✅ `backend/app.py` - Configurado para servir frontend
✅ Todos os requirements já inclusos

**Basta fazer:**
1. `npm install && npm run build` no frontend
2. Upload no Render
3. Pronto! 🚀

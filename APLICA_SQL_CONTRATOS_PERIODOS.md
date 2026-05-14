# 🚀 APLICAR SQL NO SUPABASE — Instruções Rápidas

## Opção 1: Via Supabase Dashboard (RECOMENDADO - Mais rápido)

1. Acesse: https://app.supabase.com
2. Selecione seu projeto
3. Vá em SQL Editor (sidebar esquerda)
4. Clique em "New Query"
5. Cole TODO o conteúdo do arquivo `docs/sql/alter_contratos_colaboradores_periodos.sql`
6. Clique em "Run" (Ctrl+Enter ou botão verde)
7. ✅ Pronto! Os campos foram adicionados

---

## Opção 2: Via Script Python (Se preferir automático)

No terminal, na raiz do projeto:

```bash
cd backend
source .venv/Scripts/activate  # Windows: .venv\Scripts\activate.bat
cd ..
python scripts/apply_contratos_periodos.py
```

---

## ✅ Verificação pós-aplicação

Para confirmar que funcionou, execute esta query no SQL Editor do Supabase:

```sql
-- Verificar se os campos foram criados
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'contratos_colaboradores' 
  AND column_name IN ('tipo_periodo', 'dias_duracao_periodo', 'dias_alerta_antes')
ORDER BY ordinal_position;
```

Deve retornar 3 linhas com os novos campos.

---

## 🎯 Após aplicar o SQL:

1. **Reinicie o backend** (pressione Ctrl+C e rode novamente)
2. **Frontend já vai puxar** os novos campos automaticamente
3. **Teste criando** um novo contrato com colaborador

---

## 📝 O que foi adicionado:

- ✅ Coluna `tipo_periodo` (normal/prorrogacao)
- ✅ Coluna `dias_duracao_periodo` (dias do contrato)  
- ✅ Coluna `dias_alerta_antes` (dias para alertar antes)
- ✅ Função SQL: `calcular_data_vencimento_contrato()`
- ✅ Função SQL: `calcular_data_alerta_contrato()`
- ✅ View: `contratos_colaboradores_com_vencimento` (para consultas futuras)
- ✅ Índice para performance

Backend + Frontend já estão configurados para usar! 🚀

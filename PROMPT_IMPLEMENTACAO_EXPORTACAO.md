# 🎯 PROMPT - Implementação de Exportação em Massa

## Contexto
Sistema SEG (Sistema de Estrutura de Gestão) - Aplicação Flask + React para gestão de presença de colaboradores.

Já existe um endpoint individual `/api/presenca-colaborador-calendario` que gera calendário visual em Excel para um colaborador.

Necessário criar dois novos endpoints para exportação em massa de TODOS os colaboradores.

---

## 📋 Requisitos Funcionais

### 1️⃣ ENDPOINT: Excel Multi-Aba
**URL:** `GET /api/presenca-calendario-massa-xlsx`

**Parâmetros:**
- `mes` (obrigatório) - Formato YYYY-MM (ex: 2026-04)
- `filial_id` (opcional) - Limitar a uma filial específica
- `incluir_desligados` (opcional, default: false) - Incluir colaboradores desligados

**Validações:**
- Requer autenticação JWT
- Requer permissão: `menu.presenca`
- Respeita RLS (usuário só vê suas filiais)
- Retorna erro 403 se sem permissão

**Saída:**
- Arquivo Excel (.xlsx) com múltiplas abas
- Nome: `presencas_massa_{mes}.xlsx` (ex: presencas_massa_2026-04.xlsx)
- Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

**Estrutura do Excel:**

1. **Aba "SUMÁRIO"** (primeira aba)
   - Cabeçalho: Logo/Nome empresa + Mês
   - Período do relatório
   - Estatísticas consolidadas:
     - Total de colaboradores
     - Presenças totais
     - Faltas totais
     - Atrasos totais
     - Assiduidade média (%)
     - Colaboradores por faixa de assiduidade (≥90%, 70-90%, <70%)
   - Lista resumida de colaboradores com assiduidade individual

2. **Abas individuais** (uma para cada colaborador)
   - Nome: Nome do colaborador (ex: "ADRIANO SILVA")
   - Conteúdo: Calendário visual idêntico ao endpoint individual
   - Layout: Grid 7 colunas (dias da semana), cores por status

**Cores e Símbolos:**
- 🟢 Verde (#27AE60) = Presente
- 🟠 Laranja (#F39C12) = Atraso
- 🔴 Vermelho (#E74C3C) = Falta
- ⚫ Cinza (#95A5A6) = Fim de semana/Folga

---

### 2️⃣ ENDPOINT: PDF Consolidado
**URL:** `GET /api/presenca-calendario-pdf`

**Parâmetros:**
- `mes` (obrigatório) - Formato YYYY-MM (ex: 2026-04)
- `filial_id` (opcional) - Limitar a uma filial específica
- `incluir_desligados` (opcional, default: false) - Incluir colaboradores desligados

**Validações:**
- Requer autenticação JWT
- Requer permissão: `menu.presenca`
- Respeita RLS (usuário só vê suas filiais)
- Retorna erro 403 se sem permissão

**Saída:**
- Arquivo PDF com todos os calendários
- Nome: `presencas_massa_{mes}.pdf` (ex: presencas_massa_2026-04.pdf)
- Content-Type: application/pdf

**Estrutura do PDF:**

1. **Capa (Página 1)**
   - Título: "RELATÓRIO DE PRESENÇA - {MÊS/ANO}"
   - Logo empresa (se disponível)
   - Período
   - Data de geração
   - Filial(is)

2. **Sumário (Página 2)**
   - Índice com links para cada colaborador
   - Estatísticas consolidadas (igual ao Excel)

3. **Calendários (Uma página por colaborador)**
   - Quebra de página entre colaboradores
   - Cabeçalho com nome + mês
   - Grid 7 colunas com cores
   - Rodapé com assiduidade individual

4. **Últimas páginas: Estatísticas Detalhadas**
   - Tabela com ranking de assiduidade
   - Gráficos (se houver library disponível)
   - Sumário de faltas e atrasos

---

## 🔧 Requisitos Técnicos

### Dependências Python:
```python
# Já existentes no projeto:
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side

# Novas (se não tiverem):
# Para PDF: reportlab OU python-pptx para converter para PDF
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, PageBreak, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

# Para ZIP (se implementar):
import zipfile
```

### Estrutura de Dados:
1. Buscar todos os colaboradores da(s) filial(is)
2. Para cada colaborador, buscar presenças do mês
3. Calcular estatísticas:
   - Dias presentes
   - Dias com falta
   - Dias com atraso
   - Assiduidade (%)
4. Gerar calendário visual (reutilizar lógica existente)

### Performance:
- Considerar cache para datasets grandes
- Executar em background para >50 colaboradores (possível com Celery?)
- Timeout: máximo 30 segundos

---

## 📊 Fluxo de Dados

```
GET /api/presenca-calendario-massa-xlsx
       ↓
[Validar JWT + Permissões]
       ↓
[Buscar colaboradores da filial]
       ↓
[Para cada colaborador: Buscar presenças do mês]
       ↓
[Calcular estatísticas]
       ↓
[Gerar Aba SUMÁRIO]
       ↓
[Para cada colaborador: Gerar aba com calendário visual]
       ↓
[Empacotar em Workbook + Salvar em memória]
       ↓
[Retornar arquivo Excel]
```

---

## 🎨 Exemplos de Conteúdo

### SUMÁRIO - Dados Esperados:
```
EMPRESA: GOLD TRANSPORTES
CNPJ: 12.345.678/0001-90

RELATÓRIO DE PRESENÇA - ABRIL/2026
Período: 01/04/2026 a 30/04/2026
Data de Geração: 29/04/2026 13:51:34

FILIAL: São Paulo - SP

─────────────────────────────────
ESTATÍSTICAS CONSOLIDADAS
─────────────────────────────────

Total de Colaboradores: 28

Colaboradores Ativos: 28
Colaboradores Desligados: 2

Presença Total: 624 dias
Faltas Total: 56 dias
Atrasos Total: 12 dias

Assiduidade Média: 88%

DISTRIBUIÇÃO POR FAIXA:
├─ Excelente (≥95%): 12 colaboradores
├─ Bom (90-94%): 10 colaboradores
├─ Atenção (80-89%): 4 colaboradores
└─ Crítico (<80%): 2 colaboradores

─────────────────────────────────
TOP 5 MELHORES ASSIDUIDADES
─────────────────────────────────
1. ADRIANO SILVA SANTOS       96%
2. CARLOS MENDES REIS         94%
3. JOÃO SANTOS OLIVEIRA       92%
4. MARIA DA SILVA             91%
5. PEDRO COSTA FERREIRA       90%

─────────────────────────────────
COLABORADORES COM ATENÇÃO
─────────────────────────────────
1. MARCELO ALVES              75%  ⚠️ 7 faltas + 2 atrasos
2. JULIANA ROCHA              68%  🔴 10 faltas + 1 atraso
```

---

## ✅ Checklist de Implementação

### Código Backend:
- [ ] Criar função auxiliar para gerar calendário (reutilizar do endpoint individual)
- [ ] Implementar endpoint `/api/presenca-calendario-massa-xlsx`
  - [ ] Validar parâmetros
  - [ ] Buscar colaboradores
  - [ ] Gerar aba SUMÁRIO
  - [ ] Gerar aba para cada colaborador
  - [ ] Retornar arquivo
- [ ] Implementar endpoint `/api/presenca-calendario-pdf`
  - [ ] Validar parâmetros
  - [ ] Buscar colaboradores
  - [ ] Gerar PDF com estrutura especificada
  - [ ] Retornar arquivo
- [ ] Testes manuais com dados reais
- [ ] Testes de permissão (RLS)

### Frontend:
- [ ] Adicionar botões na PresencePage.jsx:
  - [ ] "📊 Excel Multi-Aba"
  - [ ] "📄 PDF Consolidado"
- [ ] Funções de download
- [ ] Loading/Progress indicators
- [ ] Error handling

### Documentação:
- [ ] Atualizar EXCEL_COLABORADOR_PRESENCA.md
- [ ] Adicionar exemplos de uso
- [ ] Adicionar guia de testes

---

## 🧪 Testes Sugeridos

### Via cURL:
```bash
# Excel multi-aba
curl -X GET \
  "http://localhost:5000/api/presenca-calendario-massa-xlsx?mes=2026-04&filial_id=1" \
  -H "Authorization: Bearer {TOKEN}" \
  -o presencas_2026-04.xlsx

# PDF
curl -X GET \
  "http://localhost:5000/api/presenca-calendario-pdf?mes=2026-04&filial_id=1" \
  -H "Authorization: Bearer {TOKEN}" \
  -o presencas_2026-04.pdf
```

### Casos de Teste:
1. ✅ Mês válido com colaboradores = sucesso (200)
2. ✅ Mês inválido = erro 400
3. ✅ Sem token = erro 401
4. ✅ Sem permissão = erro 403
5. ✅ Filial sem acesso = erro 403
6. ✅ Nenhum colaborador = arquivo vazio/erro apropriado
7. ✅ Arquivo gerado com tamanho correto
8. ✅ Excel abre sem erro
9. ✅ PDF abre sem erro

---

## 📝 Notas Importantes

1. **Reutilizar código:** A lógica de geração do calendário já existe em `presence_collaborator_calendar()`, reutilizar!

2. **Performance:** Para muitos colaboradores, considerar:
   - Cache de resultados
   - Processamento em background
   - Limitar período máximo a 90 dias

3. **Compatibilidade:** 
   - Excel deve funcionar em Excel 2010+
   - PDF deve ser visualizável em qualquer PDF reader

4. **Segurança:**
   - Validar RLS rigorosamente
   - Não expor dados de colaboradores desligados sem permissão
   - Limitar tamanho máximo de arquivo

5. **Erro Handling:**
   - Database indisponível
   - Timeout de processamento
   - Falta de espaço em disco

---

## 🚀 Prioridade

1. **ALTA:** Excel multi-aba (mais requisitado)
2. **ALTA:** PDF consolidado (relatórios)
3. **MÉDIA:** Otimizações de performance

---

**Status:** 🎯 Pronto para implementação
**Data:** 29 de Abril de 2026
**Versão:** 1.0

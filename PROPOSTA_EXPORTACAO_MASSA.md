# 📤 Exportação em Massa - Todos os Colaboradores

## 🎯 O que será implementado

Opções para exportar calendários visuais de **TODOS os colaboradores** de uma vez:

---

## 📊 OPÇÃO 1: Excel com Múltiplas Abas (RECOMENDADO)

### Endpoint:
```
GET /api/presenca-calendario-massa-xlsx?mes=2026-04&filial_id=1
```

### Características:
- ✅ Um arquivo Excel único
- ✅ Cada colaborador em uma aba separada
- ✅ Calendário visual em cada aba
- ✅ Aba de sumário no início
- ✅ Arquivo pequeno (comprimido)

### Exemplo de arquivo:
```
Arquivo: presencas_massa_2026-04.xlsx

Abas:
├─ SUMÁRIO (Resumo geral + estatísticas)
├─ ADRIANO SILVA
├─ CARLOS MENDES
├─ JOÃO SANTOS
└─ MARIA OLIVEIRA
```

### Vantagens:
- 📦 Um arquivo só
- 🔄 Fácil de compartilhar
- 📊 Comparação entre colaboradores
- 🖨️ Imprimir um por um

---

## 📁 OPÇÃO 2: ZIP com Arquivos Individuais

### Endpoint:
```
GET /api/presenca-calendario-zip?mes=2026-04&filial_id=1
```

### Características:
- ✅ Um arquivo ZIP com vários Excel
- ✅ Cada colaborador em seu próprio arquivo
- ✅ Nomes descritivos: `calendario_ADRIANO_2026-04.xlsx`
- ✅ Estrutura organizada

### Exemplo:
```
presencas_2026-04.zip
├─ calendario_ADRIANO_SILVA_2026-04.xlsx
├─ calendario_CARLOS_MENDES_2026-04.xlsx
├─ calendario_JOAO_SANTOS_2026-04.xlsx
└─ calendario_MARIA_OLIVEIRA_2026-04.xlsx
```

### Vantagens:
- 📧 Fácil de distribuir por e-mail
- 👤 Cada um pega seu arquivo
- 🎨 Customização individual
- 📌 Cada arquivo pode ser impresso na parede

---

## 📄 OPÇÃO 3: PDF Consolidado

### Endpoint:
```
GET /api/presenca-calendario-pdf?mes=2026-04&filial_id=1
```

### Características:
- ✅ Um PDF único com todos
- ✅ Quebra de página entre colaboradores
- ✅ Sumário no início
- ✅ Índice com links

### Exemplo:
```
presencas_massa_2026-04.pdf

Página 1: Capa + Sumário
Página 2: Calendário ADRIANO
Página 3: Calendário CARLOS
Página 4: Calendário JOÃO
Página 5: Calendário MARIA
Página 6: Estatísticas Consolidadas
```

### Vantagens:
- 📖 Relatório profissional
- 🔍 Índice com navegação
- 🎨 Formatação consistente
- 📧 Um arquivo só

---

## 🎯 Recomendação de Uso

| Situação | Formato | Razão |
|----------|---------|-------|
| **Gerente quer analisar todos** | Excel Multi-aba | Fácil comparação |
| **Distribuir para cada funcionário** | ZIP | Personalizado |
| **Enviar para cliente/reunião** | PDF | Profissional |
| **Imprimir e colar na parede** | ZIP | Qualidade individual |
| **Auditoria/Compliance** | PDF | Rastreabilidade |

---

## 🔧 Implementação Proposta

### Backend (app.py):

```python
# OPÇÃO 1: Excel com múltiplas abas
@app.get('/api/presenca-calendario-massa-xlsx')
@require_auth
def presence_calendar_mass_xlsx(profile):
    """Gera Excel com calendários de TODOS os colaboradores"""
    # 1. Validar permissões
    # 2. Buscar todos os colaboradores da filial
    # 3. Gerar calendário para cada um
    # 4. Criar abas no workbook
    # 5. Retornar Excel
    pass

# OPÇÃO 2: ZIP com arquivos individuais
@app.get('/api/presenca-calendario-zip')
@require_auth
def presence_calendar_zip(profile):
    """Gera ZIP com calendários individuais"""
    # 1. Validar permissões
    # 2. Buscar todos os colaboradores
    # 3. Gerar um Excel para cada um
    # 4. Empacotar em ZIP
    # 5. Retornar ZIP
    pass

# OPÇÃO 3: PDF consolidado
@app.get('/api/presenca-calendario-pdf')
@require_auth
def presence_calendar_pdf(profile):
    """Gera PDF com calendários consolidados"""
    # 1. Validar permissões
    # 2. Buscar todos os colaboradores
    # 3. Gerar PDF com uma página por colaborador
    # 4. Retornar PDF
    pass
```

---

## 🎨 Sumário do Excel/PDF

Primeira página/aba com estatísticas consolidadas:

```
┌─────────────────────────────────────┐
│ RELATÓRIO DE PRESENÇA - ABRIL/2026  │
├─────────────────────────────────────┤
│ Filial: São Paulo - SP              │
│ Período: 01/04/2026 a 30/04/2026    │
│ Data de Geração: 29/04/2026 13:51   │
├─────────────────────────────────────┤
│                                     │
│ COLABORADORES POR STATUS:           │
│ ✅ Total: 28 colaboradores          │
│ 🟢 Com boa presença (≥90%): 22     │
│ 🟡 Com atenção (70-90%): 5         │
│ 🔴 Com problemas (<70%): 1         │
│                                     │
│ ESTATÍSTICAS GERAIS:                │
│ Total de presenças: 624             │
│ Total de faltas: 56                 │
│ Total de atrasos: 12                │
│ Assiduidade média: 88%              │
│                                     │
│ COLABORADORES:                      │
│ 1. ADRIANO SILVA SANTOS      96%    │
│ 2. CARLOS MENDES REIS        94%    │
│ 3. JOÃO SANTOS OLIVEIRA      92%    │
│ 4. MARIA DA SILVA            88%    │
│ ...                                 │
└─────────────────────────────────────┘
```

---

## 📋 Parâmetros

Para todos os endpoints:

```
GET /api/presenca-calendario-*/mes=YYYY-MM&filial_id=X&incluir_desligados=true
```

**Parâmetros:**
- `mes` (obrigatório) - Mês no formato YYYY-MM (ex: 2026-04)
- `filial_id` (opcional) - Limita a uma filial específica
- `incluir_desligados` (opcional) - Incluir colaboradores desligados (default: false)
- `apenas_ativos` (opcional) - Apenas colaboradores ativos (default: true)

---

## 🔒 Permissões

- Requer token JWT válido
- Requer permissão: `menu.presenca`
- Respeita RLS (Row Level Security) - usuário só vê sua(s) filial(is)

---

## 📊 Tamanho Estimado dos Arquivos

Para 28 colaboradores em um mês:

| Formato | Tamanho | Tempo |
|---------|---------|-------|
| Excel (multi-aba) | ~150 KB | ~2s |
| ZIP (individuais) | ~180 KB | ~3s |
| PDF (consolidado) | ~500 KB | ~4s |

---

## 🚀 Frontend - Botões Sugeridos

```jsx
<div className="export-buttons">
  <button onClick={() => exportMassaXlsx()}>
    📊 Excel (Múltiplas Abas)
  </button>
  
  <button onClick={() => exportMassaZip()}>
    📁 ZIP (Arquivos Individuais)
  </button>
  
  <button onClick={() => exportMassaPdf()}>
    📄 PDF (Consolidado)
  </button>
</div>
```

---

## ✨ Qual Formato Você Prefere?

**Qual desses você quer que eu implemente?**

1. ✅ **Excel com múltiplas abas** (RECOMENDADO - mais fácil)
2. ✅ **ZIP com arquivos** (melhor para distribuição)
3. ✅ **PDF consolidado** (mais profissional)
4. ✅ **Todos os 3** (solução completa)

Qual é sua preferência? 🎯

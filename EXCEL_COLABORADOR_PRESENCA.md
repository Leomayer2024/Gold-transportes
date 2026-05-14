# 📊 Excel Individual por Colaborador - Implementação

## O que foi criado

Dois novos endpoints backend para gerar **Excels de presença individual**:

### 1. **Calendário Visual** `/api/presenca-colaborador-calendario`
Gera um calendário estilo **parede de presença**, visualmente atrativo:
- ✅ Grid com 7 colunas (dias da semana)
- ✅ Cada dia em uma célula grande e colorida
- ✅ Nome + Mês em destaque no topo
- ✅ Cores visuais por status (🟢 Verde = Presente, 🔴 Vermelho = Falta, 🟠 Laranja = Atraso)
- ✅ Observações/duração abaixo de cada dia

### 2. **Tabela Detalhada** `/api/presenca-colaborador-xlsx` (legado)
Gera um relatório em tabela com:
- ✅ Todas as datas do mês
- ✅ Status de cada dia (Presente, Falta, Atraso, Folga, Fim de semana)
- ✅ Horários de entrada e saída
- ✅ Resumo de presentes, faltas e atrasos

---

## 🎯 Como Usar

### Calendário Visual (NOVO):

```
GET /api/presenca-colaborador-calendario?mes=2026-04&colaborador_id=123
```

**Exemplo completo:**
```
http://localhost:5000/api/presenca-colaborador-calendario?mes=2026-04&colaborador_id=1245
```

### Tabela Detalhada (Legado):

```
GET /api/presenca-colaborador-xlsx?mes=2026-04&colaborador_id=123
```

**Parâmetros:**
- `mes` - Mês no formato YYYY-MM (ex: 2026-04)
- `colaborador_id` - ID do colaborador (ex: 123)

**Exemplo completo:**
```
http://localhost:5000/api/presenca-colaborador-xlsx?mes=2026-04&colaborador_id=1245
```

---

## � Visuais Gerados

### 🎨 Calendário Visual (Novo)

```
┌─────────────────────────────────────────────────────────────────┐
│  ADRIANO SILVA SANTOS - ABRIL/2026                              │
├─────────────────────────────────────────────────────────────────┤
│ Do      Se      Te      Qu      Qu      Se      Sa              │
│ 29      30      31      01      02      03      04              │
│ ⚫      ⚫      ⚫      🟢      🟢      🟢      🟢              │
│ -       -       -       -       -       -       -               │
│                                                                 │
│ 05      06      07      08      09      10      11              │
│ 🟢      🟢      🟢      🟢      🟠      🟢      ⚫              │
│ -       -       -       -      15 min  -       -               │
│                                                                 │
│ 12      13      14      15      16      17      18              │
│ 🟢      🟢      🟢      🟢      🟢      🟢      ⚫              │
│ -       -       -       -       -       -       -               │
│                                                                 │
│ 19      20      21      22      23      24      25              │
│ 🟢      🟢      🟢      🟢      🟢      🟢      🔴              │
│ -       -       -       -       -       -      OBS             │
│                                                                 │
│ 26      27      28      29      30      01      02              │
│ 🟢      🟢      🟢      🟢      🟢                              │
│ -       -       -       -       -                               │
└─────────────────────────────────────────────────────────────────┘
```

**Legenda de Cores:**
- 🟢 Verde = Presente
- 🟠 Laranja = Atraso  
- 🔴 Vermelho = Falta
- ⚫ Cinza/Preto = Fim de semana ou Folga

---

## 📋 Tabela Detalhada (Formato Legado)

```
┌─────────────────────────────────────────┐
│  RELATÓRIO DE PRESENÇA - COLABORADOR    │
├─────────────────────────────────────────┤
│ Empresa: GOLD TRANSPORTES               │
│ CNPJ: 12.345.678/0001-90                │
├─────────────────────────────────────────┤
│ Colaborador: ADRIANO SILVA SANTOS       │
│ Cargo: Motorista | Turno: Manhã | Horário: 06:00 às 14:00
│ Período: 01/04/2026 a 30/04/2026        │
├────────┬──────────────┬──────────┬──────┬────────┬────────────┤
│ Data   │ Dia Semana  │ Status   │ Entr │ Saída  │ Observaçõs │
├────────┼──────────────┼──────────┼──────┼────────┼────────────┤
│01/04/26│ Segunda     │ ✓ Present│ 06:00│ 14:00  │ -          │
│02/04/26│ Terça       │ ✓ Present│ 06:00│ 14:00  │ -          │
│03/04/26│ Quarta      │ ✓ Present│ 06:00│ 14:00  │ -          │
│04/04/26│ Quinta      │ - Folga  │ -    │ -      │ -          │
│05/04/26│ Sexta       │ ✓ Present│ 06:00│ 14:00  │ -          │
│06/04/26│ Sábado      │ Fim sem. │ -    │ -      │ -          │
│07/04/26│ Domingo     │ Fim sem. │ -    │ -      │ -          │
│...     │ ...         │ ...      │ ...  │ ...    │ ...        │
│11/04/26│ Sexta       │ ✗ Falta  │ -    │ -      │ -          │
│...     │ ...         │ ...      │ ...  │ ...    │ ...        │
│09/04/26│ Quarta      │ ⏱ Atraso │ 06:15│ 14:00  │ 15 min     │
│...     │ ...         │ ...      │ ...  │ ...    │ ...        │
├────────┴──────────────┴──────────┴──────┴────────┴────────────┤
│                                                                │
│ RESUMO                                                        │
│ Presenças:  18                                               │
│ Faltas:      2                                               │
│ Atrasos:     1                                               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Cores de Status

| Status | Cor | Significado |
|--------|-----|------------|
| ✓ Presente | 🟢 Verde | Compareceu ao trabalho |
| ✗ Falta | 🔴 Vermelho | Não compareceu |
| ⏱ Atraso | 🟠 Laranja | Chegou atrasado |
| - Folga | ⚫ Cinza | Dia de folga/escala |
| Fim semana | ⚫ Cinza | Sábado/Domingo |

---

## 🚀 Integração no Frontend

Adicionar botões na tela de **Presença** (PresencePage.jsx) para ambas as opções:

```javascript
// Download do Calendário Visual (NOVO)
const downloadCalendarioVisual = async (colaboradorId, mes) => {
  try {
    const response = await fetch(
      `/api/presenca-colaborador-calendario?mes=${mes}&colaborador_id=${colaboradorId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      }
    );
    
    if (!response.ok) throw new Error('Erro ao baixar calendário');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendario_${colaboradorId}_${mes}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao baixar calendário:', error);
  }
};

// Download do Relatório Detalhado (Tabela)
const downloadRelatorioDetalhado = async (colaboradorId, mes) => {
  try {
    const response = await fetch(
      `/api/presenca-colaborador-xlsx?mes=${mes}&colaborador_id=${colaboradorId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      }
    );
    
    if (!response.ok) throw new Error('Erro ao baixar relatório');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presenca_${colaboradorId}_${mes}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao baixar relatório:', error);
  }
};
```

**Botões sugeridos na UI:**
```jsx
<button onClick={() => downloadCalendarioVisual(colaboradorId, mes)}>
  📅 Calendário Visual
</button>

<button onClick={() => downloadRelatorioDetalhado(colaboradorId, mes)}>
  📊 Relatório Detalhado
</button>
```

---

## 📝 Exemplo de Uso

### Calendário Visual (RECOMENDADO PARA IMPRESSÃO):
1. Acesse a tela de Presença
2. Selecione um colaborador (ex: Adriano)
3. Clique em **"📅 Calendário Visual"**
4. Arquivo é gerado: `calendario_ADRIANO_2026-04.xlsx`
5. Imprima e cole na parede! 🎯

### Relatório Detalhado (ANÁLISE COMPLETA):
1. Acesse a tela de Presença
2. Selecione um colaborador
3. Clique em **"📊 Relatório Detalhado"**
4. Arquivo é gerado: `presenca_ADRIANO_2026-04.xlsx`
5. Abra e analise os dados com horários e resumos

---

## 🔧 API Endpoints

### Calendário Visual
```http
GET /api/presenca-colaborador-calendario?mes=2026-04&colaborador_id=1245
Authorization: Bearer seu_token_jwt
```

### Relatório Detalhado
```http
GET /api/presenca-colaborador-xlsx?mes=2026-04&colaborador_id=1245
Authorization: Bearer seu_token_jwt
```

**Parâmetros (para ambos):**
- `mes` - Mês no formato YYYY-MM (ex: 2026-04)
- `colaborador_id` - ID do colaborador (ex: 1245)

**Resposta:**
- **Status 200**: Arquivo Excel (binary)
- **Status 400**: Parâmetros inválidos
- **Status 403**: Sem permissão para ver este colaborador
- **Status 404**: Colaborador não encontrado
- **Status 500**: Erro ao gerar arquivo

---

## 💾 Campo da Tabela de Presença

O backend procura por:
- `data_referencia` - Data do registro
- `status` - Status da presença (presente, falta, atraso, folga)
- `entrada` - Hora de entrada
- `saida` - Hora de saída
- `observacoes` - Observações adicionais

**Obs:** Se esses campos não existirem na tabela, será necessário adicioná-los.

---

## 📱 Para Celular

Excel abre perfeitamente em:
- ✅ Excel Mobile (Microsoft)
- ✅ Google Sheets
- ✅ LibreOffice Calc
- ✅ Qualquer app de planilha

---

## Próximos Passos

1. ✅ Função backend criada
2. ⏳ Adicionar botão no frontend (PresencePage.jsx)
3. ⏳ Testar geração e download
4. ⏳ Validar permissões de acesso


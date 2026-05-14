# 🎯 PROMPT PRONTO PARA USAR - Copiar e Colar

## Para implementar Excel Multi-Aba + PDF

---

## COPIE E COLE TUDO ABAIXO:

```
Você está trabalhando em um projeto Flask + React chamado SEG (Sistema de Estrutura de Gestão) para gestão de presença de colaboradores.

CONTEXTO:
- Já existe endpoint individual: GET /api/presenca-colaborador-calendario que gera Excel com calendário visual para um colaborador
- Código está em: backend/app.py (linhas ~5869)
- Função reutilizável já existe para gerar calendário

TAREFA:
Implementar 2 novos endpoints para exportação em MASSA de calendários visuais de TODOS os colaboradores.

---

## ENDPOINT 1: Excel Multi-Aba

URL: GET /api/presenca-calendario-massa-xlsx
Parâmetros: mes=YYYY-MM (obrigatório), filial_id=X (opcional), incluir_desligados=true (opcional)
Saída: Arquivo Excel (.xlsx) com nome: presencas_massa_2026-04.xlsx

Estrutura do Excel:
- ABA 1 ("SUMÁRIO"):
  * Cabeçalho: "RELATÓRIO DE PRESENÇA - {MÊS/ANO}"
  * Empresa, CNPJ, Filial, Período
  * Estatísticas consolidadas:
    - Total colaboradores
    - Presenças/Faltas/Atrasos (totais)
    - Assiduidade média (%)
    - Distribuição por faixa: ≥95%, 90-94%, 80-89%, <80%
  * Top 5 melhores assiduidades
  * Colaboradores com problemas

- ABAS 2 em diante (Uma por colaborador):
  * Nome da aba: Nome do colaborador
  * Conteúdo: Calendário visual (grid 7x6, cores por status)
  * Cores: Verde(Presente), Laranja(Atraso), Vermelho(Falta), Cinza(Fim de semana)

Validações:
- Requer autenticação JWT
- Requer permissão 'menu.presenca'
- Respeita RLS (usuário só vê suas filiais)
- Erro 403 se sem permissão, 404 se colaborador não existe

---

## ENDPOINT 2: PDF Consolidado

URL: GET /api/presenca-calendario-pdf
Parâmetros: mes=YYYY-MM (obrigatório), filial_id=X (opcional), incluir_desligados=true (opcional)
Saída: Arquivo PDF com nome: presencas_massa_2026-04.pdf

Estrutura do PDF:
- Página 1 (Capa): Título, empresa, período, data geração
- Página 2 (Sumário): Índice com links + estatísticas consolidadas
- Páginas 3+ (Calendários): Uma página por colaborador, calendário visual, quebra de página entre eles
- Páginas finais: Ranking de assiduidade, gráficos se possível

Validações: Mesmas do Excel

---

## REQUISITOS TÉCNICOS:

1. Reutilizar a lógica de geração do calendário que já existe em presence_collaborator_calendar()
2. Para PDF, usar reportlab (instalar se necessário)
3. Validar autenticação e permissões
4. Respeitar RLS (usuário só vê suas filiais)
5. Tratar erro quando houver 0 colaboradores
6. Arquivo em memória (io.BytesIO()), não criar arquivos no servidor

---

## DADOS ESPERADOS NO SUMÁRIO:

Total de Colaboradores: 28
Presenças Totais: 624
Faltas Totais: 56
Atrasos Totais: 12
Assiduidade Média: 88%
≥95%: 12 colaboradores
90-94%: 10 colaboradores
80-89%: 4 colaboradores
<80%: 2 colaboradores

---

## TESTES:

Testar com:
- Mês válido com vários colaboradores ✓
- Mês inválido (deve retornar erro 400)
- Sem token (deve retornar erro 401)
- Sem permissão (deve retornar erro 403)
- Filial diferente (deve retornar erro 403 por RLS)
- Arquivo gerado deve abrir sem erros

---

## LOCALIZAÇÃO DO CÓDIGO:

Arquivo: backend/app.py
Adicionar próximo ao endpoint existente: @app.get('/api/presenca-colaborador-calendario') (linha ~5869)
Reutilizar: Variáveis de cor (color_presente, color_falta, etc), lógica de calendário

---

IMPLEMENTE os dois endpoints agora. Mostre o código completo. Se tiver dúvidas sobre a estrutura, veja o endpoint presence_collaborator_calendar() que já existe.
```

---

## OU VOCÊ PODE SIMPLIFICAR:

Se preferir um prompt mais curto e direto:

```
Sistema SEG em Flask + React.

Crie 2 endpoints para EXPORTAR calendários visuais de TODOS os colaboradores em Excel multi-aba e PDF consolidado:

1. GET /api/presenca-calendario-massa-xlsx → Excel com aba SUMÁRIO + uma aba por colaborador
2. GET /api/presenca-calendario-pdf → PDF com capa + sumário + calendário por página

Parâmetros: mes=YYYY-MM (obrigatório), filial_id (opcional)
Validar: JWT, permissão menu.presenca, RLS
Reutilizar: Lógica do endpoint presence_collaborator_calendar() que já existe

Aba SUMÁRIO/Capa PDF: incluir estatísticas consolidadas (total colaboradores, assiduidade média, top 5)
Cada aba/página: calendário visual (grid 7 colunas, cores por status)

Use openpyxl para Excel e reportlab para PDF.
Arquivo em memória (io.BytesIO()).

Implemente agora.
```

---

## PARA USAR:

1. **Copie TODO o texto acima** (entre os ```  ``` )
2. **Cole para um Claude/Copilot/Desenvolvedor**
3. **Ele implementará os endpoints**
4. **Você testa com:** 
   ```bash
   curl -X GET "http://localhost:5000/api/presenca-calendario-massa-xlsx?mes=2026-04&filial_id=1" -H "Authorization: Bearer {TOKEN}" -o presencas.xlsx
   ```

---

## CHECKLIST DO QUE O DESENVOLVEDOR DEVE ENTREGAR:

- [ ] Endpoint Excel multi-aba funcionando
- [ ] Endpoint PDF funcionando
- [ ] Aba SUMÁRIO com estatísticas corretas
- [ ] Calendários visuais em cada aba/página
- [ ] Validação JWT e permissões
- [ ] RLS funcionando
- [ ] Tratamento de erros (400, 401, 403, 404, 500)
- [ ] Testado com vários colaboradores
- [ ] Arquivo Excel abre sem erros
- [ ] PDF abre sem erros
- [ ] Nomes de arquivo corretos

---

**Salve este arquivo e use quando precisar implementar!**

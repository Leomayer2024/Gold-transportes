# 📋 Processos e Fluxos - SEG Gestão Operacional

## 1. CONTROLE DE PNEUS

### 📊 Visão Geral
Gerenciar ciclo de vida completo dos pneus: instalação → monitoramento → rodízio → troca → sucata.

### 🔄 Fluxo Operacional

```
PNEU NOVO
    ↓
[1] INSTALAÇÃO (criar registro em veiculos_pneus)
    - Posição no veículo (traseiro esquerdo, dianteiro direito, etc)
    - Marca, modelo, medida
    - Número de série, DOT
    - Odômetro de instalação
    - Vida = 1ª vida (primeira recapagem)
    ↓
[2] MONITORAMENTO (ver em tela Pneus)
    - Odômetro atual atualizado via manutenção
    - Km rodados vs. vida útil estimada
    - Status: ATIVO, RODIZIAR, TROCAR, SUCATA
    ↓
[3] RODÍZIO (dentro da vida útil)
    - Trocar pneu de posição
    - Mesmo pneu, outra posição
    - Gera histórico via auditoria_movimentacoes
    ↓
[4] TROCA (fim da vida útil)
    - Criar Pedido de Compra (pneu novo)
    - Marcar pneu atual como TROCAR
    - Após aprovação do PC: criar novo registro (vida += 1)
    - Pneu velho vai para SUCATA
    ↓
[5] SUCATA (descarte)
    - Status = SUCATA
    - Ativo = false
    - Mantém histórico completo
```

### 📌 Campos da Tabela `veiculos_pneus`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | bigint | ✅ | Identificador único |
| filial_id | bigint | ✅ | Filial responsável |
| veiculo_id | bigint | ✅ | Veículo que tem o pneu |
| posicao | text | ✅ | Ex: dianteiro_esq, traseiro_dir |
| marca | text | ❌ | Ex: Michelin, Pirelli |
| modelo | text | ❌ | Ex: XR2000 |
| medida | text | ❌ | Ex: 11R22.5 |
| numero_serie | text | ❌ | Número único do pneu |
| dot | text | ❌ | DOT (data fabricação) |
| odometro_instalacao | integer | ❌ | Km quando instalado |
| odometro_atual | integer | ❌ | Km último registro |
| data_instalacao | date | ❌ | Quando foi colocado |
| vida | integer | ✅ (default 1) | Quantas recapagens teve (1-4) |
| status | text | ✅ | ativo, rodiziar, trocar, sucata |
| pedido_compra_id | bigint | ❌ | PC que originou a compra |
| observacoes | text | ❌ | Notas adicionais |
| ativo | boolean | ✅ (default true) | Logicamente deletável |

### 🎯 Quem Aprova o Quê?
- **Gestor de Frota**: Solicita troca (marca como TROCAR)
- **Gerente de Manutenção**: Aprova Pedido de Compra
- **Diretor/Admin**: Aprova valores acima do limite

---

## 2. MANUTENÇÃO DE VEÍCULOS

### 📊 Visão Geral
Controlar todas as manutenções: preventivas, corretivas, recalls. Com aprovação em cascata.

### 🔄 Fluxo de Manutenção

```
SOLICITAÇÃO DE MANUTENÇÃO
    ↓
[1] ABRIR CHAMADO (status = ABERTA)
    - Tipo: preventiva, corretiva, preditiva, recall
    - Descrição do problema
    - Prioridade: baixa, normal, alta, crítica
    - Valor estimado (opcional)
    - Filial + Veículo obrigatórios
    ↓
[2] REVISAR & ESTIMAR (gestor responsável)
    - Adicionar itens de manutenção (peças, serviços, fluidos)
    - Cada item: quantidade, valor unitário, fornecedor
    - Calcular valor_estimado total
    ↓
[3] ENVIAR PARA APROVAÇÃO (status = AGUARDANDO_APROVACAO)
    - Sistema busca aprovador baseado em:
      a) Prioridade + Valor → nível requerido
      b) Configuração manutencao_aprovacoes_config
    - Notifica aprovador
    ↓
[4] APROVAÇÃO (com 3 caminhos possíveis)
    
    └─ APROVADO (status = APROVADA)
    │   ↓
    │   [5a] Executar manutenção (status = EM_EXECUCAO)
    │   ↓
    │   [6a] Registrar conclusão (status = CONCLUIDA)
    │       - Data conclusão
    │       - Valor final real
    │       - Observações
    │
    ├─ REPROVADO (status = REPROVADA)
    │   ↓
    │   [5b] Voltar à edição
    │       - Revisar valor/escopo
    │       - Reenviar para aprovação
    │
    └─ CANCELADO (status = CANCELADA)
        ↓
        [5c] Arquivo histórico
            - Motivo do cancelamento
            - Mantém rastreabilidade
```

### 📌 Campos da Tabela `manutencoes`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | bigint | ✅ | Identificador |
| filial_id | bigint | ✅ | Filial |
| veiculo_id | bigint | ✅ | Qual veículo |
| tipo | text | ✅ | preventiva, corretiva, preditiva, recall |
| status | text | ✅ | aberta, aguardando_aprovacao, aprovada, em_execucao, concluida, cancelada, reprovada |
| titulo | text | ✅ | Resumo do problema |
| descricao | text | ❌ | Descrição detalhada |
| prioridade | text | ✅ | baixa, normal, alta, critica |
| valor_estimado | numeric | ❌ | Orçamento inicial |
| valor_final | numeric | ❌ | Custo real (preenchido ao concluir) |
| data_abertura | date | ✅ | Quando foi aberta |
| data_previsao | date | ❌ | Quando espera fazer |
| data_inicio | date | ❌ | Quando começou |
| data_conclusao | date | ❌ | Quando terminou |
| solicitado_por | bigint | ❌ | Quem abriu |
| aprovado_por | bigint | ❌ | Quem aprovou |
| aprovado_em | timestamp | ❌ | Quando aprovou |
| reprovado_por | bigint | ❌ | Quem rejeitou |
| reprovado_em | timestamp | ❌ | Quando rejeitou |
| motivo_reprovacao | text | ❌ | Por quê foi rejeitado |
| observacoes | text | ❌ | Anotações |
| ativo | boolean | ✅ | Logicamente deletável |

### 📌 Tabela de Itens `manutencao_itens`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | bigint | Identificador |
| manutencao_id | bigint | Qual manutenção |
| tipo | text | peca, servico, fluido, outros |
| descricao | text | O quê é (ex: "Óleo 15W40") |
| quantidade | numeric | Quantos itens |
| unidade | text | un, litro, galão, etc |
| valor_unitario | numeric | Preço por unidade |
| valor_total | numeric | quantidade × valor_unitario |
| numero_nota | text | NF da compra |
| fornecedor | text | Quem vendeu |
| estoque_item_id | bigint | Se veio do estoque interno |
| observacoes | text | Notas extras |

### 🎯 Aprovação Configurável

Tabela: `manutencao_aprovacoes_config`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | bigint | Identificador |
| filial_id | bigint | Aplica para qual filial (null = todas) |
| tipo_manutencao | text | Qual tipo (preventiva, corretiva, etc) - null = todas |
| prioridade_minima | text | Acima dessa prioridade requer aprovação |
| valor_limite | numeric | Acima desse valor requer aprovação |
| aprovador_id | bigint | Quem aprova (colaborador) |
| ativo | boolean | Esta regra está ativa? |

**Exemplo de Configuração:**
```
Filial: São Paulo | Tipo: Corretiva | Prioridade: ALTA | Valor: > 5000 → Gerente de Manutenção (João)
Filial: São Paulo | Tipo: Qualquer | Prioridade: CRÍTICA | Valor: > 10000 → Diretor (Maria)
Filial: Qualquer | Tipo: Preventiva | Prioridade: Qualquer | Valor: > 0 → Coordenador (Pedro)
```

---

## 3. COMPRAS (PEDIDOS DE COMPRA)

### 📊 Visão Geral
Gerenciar solicitações de compra desde a criação até o recebimento.

### 🔄 Fluxo de Compra

```
NECESSIDADE DE COMPRA
    ↓
[1] CRIAR PEDIDO (status = RASCUNHO)
    - Filial + Fornecedor obrigatórios
    - Adicionar itens (descrição, qtd, valor unitário)
    - Centro de custo
    - Forma de pagamento
    - Prazo de pagamento
    ↓
[2] REVISAR & COTAR (permanecer em RASCUNHO)
    - Validar fornecedores
    - Confirmar preços com 2-3 cotações
    - Atualizar valores
    ↓
[3] SUBMETER PARA APROVAÇÃO (status = RASCUNHO → AGUARDANDO_APROVACAO)
    - Sistema determina aprovador:
      a) Valor total do PC
      b) Centro de custo
      c) Tipo de item (pneus, peças, serviços)
    - Notifica(m) aprovador(es)
    ↓
[4] APROVAÇÃO (com 3 caminhos)
    
    └─ APROVADO (status = APROVADO)
    │   ↓
    │   [5a] Emitir PC formal
    │       - Gera número NF ou protocolo
    │       - Envia para fornecedor
    │
    ├─ REPROVADO (status = REPROVADO)
    │   ↓
    │   [5b] Voltar a RASCUNHO
    │       - Revisar itens/valores
    │       - Reenviar
    │
    └─ AGUARDANDO (fica em AGUARDANDO_APROVACAO)
        ↓
        [5c] Comentários/Esclarecimentos
            - Solicitante responde dúvidas
            - Resubmete se necessário
```

### 📌 Campos da Tabela `pedidos_compra`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | integer | ✅ | Identificador |
| filial_id | integer | ✅ | Filial solicitante |
| numero_pedido | text | ✅ UNIQUE | PC-2026-00001 |
| data_pedido | date | ✅ | Quando foi criado |
| data_necessidade | date | ❌ | Quando precisa chegar |
| status | text | ✅ | rascunho, aguardando_aprovacao, aprovado, reprovado |
| fornecedor | text | ❌ | Nome do fornecedor |
| forma_pagamento | text | ❌ | boleto, cartão, pix, etc |
| prazo_pagamento | text | ❌ | à vista, 30/60/90 dias |
| centro_custo | text | ❌ | CCusto (para contabilidade) |
| criado_por | integer | ❌ | Colaborador que abriu |
| observacoes | text | ❌ | Notas adicionais |
| valor_total | numeric | ✅ (default 0) | Soma dos itens |
| ativo | boolean | ✅ | Logicamente deletável |

### 📌 Tabela de Itens `pedidos_compra_itens`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | integer | Identificador |
| pedido_id | integer | Qual PC |
| filial_id | integer | Filial (redundante para filtros) |
| descricao | text | O quê está comprando |
| categoria | text | pneus, peças, combustível, etc |
| unidade | text | un, litro, kg, m, etc |
| quantidade | numeric | Quantos |
| valor_unitario | numeric | Preço unitário |
| valor_total | numeric | quantidade × valor_unitario |
| observacoes | text | Notas |
| ativo | boolean | Logicamente deletável |

### 🎯 Quem Aprova?
- **Coordenador**: até R$ 2.000
- **Gerente**: até R$ 10.000
- **Diretor**: acima de R$ 10.000

---

## 4. TELA DE ACOMPANHAMENTO/APROVAÇÕES

### 📊 O que mostra?

**Para Colaboradores (geral):**
- ✅ Status de minhas solicitações (PC, Manutenção, Pneus)
- 📊 Dashboard de status
- 🔄 Histórico de mudanças

**Para Aprovadores:**
- 🔴 **PENDENTES** (aguardando minha aprovação)
  - Manutenções (com detalhes: prioridade, valor, descrição)
  - Pedidos de Compra (com itens, valores)
  - Horas extras (se aplicável)
- ✅ **APROVADAS** (que aprovei)
- ❌ **REPROVADAS** (que rejeitei)
- 📋 **EM EXECUÇÃO** (que estou acompanhando)

### 🎨 Layout da Tela

```
┌─────────────────────────────────────────────────────────┐
│  ACOMPANHAMENTO DE SOLICITAÇÕES                         │
│  [Filtro: Tipo] [Filtro: Status] [Filtro: Período]     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🔴 PENDENTES PARA MINHA APROVAÇÃO (3)                 │
│  ├─ [1] PC-2026-00045 | Pneus Michelin | R$ 5.200      │
│  │   Criado: 13/05 | Prioridade: NORMAL                │
│  │   [👁️ VER DETALHES] [✅ APROVAR] [❌ REJEITAR]      │
│  │                                                      │
│  ├─ [2] MAN-2026-00012 | Corretiva | R$ 8.500          │
│  │   Criado: 13/05 | Prioridade: ALTA                  │
│  │   Veículo: Scania JJJ-5500                          │
│  │   [👁️ VER DETALHES] [✅ APROVAR] [❌ REJEITAR]      │
│  │                                                      │
│  ├─ [3] PC-2026-00046 | Combustível | R$ 12.000        │
│  │   Criado: 13/05 | Prioridade: CRÍTICA               │
│  │   [👁️ VER DETALHES] [✅ APROVAR] [❌ REJEITAR]      │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ✅ APROVADAS (últimas 10)                             │
│  ├─ PC-2026-00040 | Aprovado em 12/05 por Maria       │
│  ├─ MAN-2026-00010 | Aprovado em 12/05 por João       │
│  └─ ...                                                │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ❌ REPROVADAS (últimas 5)                             │
│  ├─ PC-2026-00039 | Rejeitado em 12/05 por Maria      │
│  │   Motivo: "Valores acima da cotação de mercado"     │
│  └─ ...                                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 📋 Ações Possíveis

| Ação | Quem | Status Anterior → Status Novo | Observação |
|------|------|------------------------------|-----------|
| Aprovar | Aprovador | Aguardando → Aprovado | Gera auditoria + notificação |
| Rejeitar | Aprovador | Aguardando → Reprovado | Solicita motivo da rejeição |
| Solicitar Info | Aprovador | Aguardando → Aguardando Esclarecimento | Comentário interno |
| Refazer | Solicitante | Reprovado → Rascunho | Volta para edição |
| Concluir | Executor | Aprovado → Concluído | Registra data/valor final (manutenção) |
| Cancelar | Solicitante/Admin | Qualquer → Cancelado | Apenas se ainda não iniciado |

---

## 5. NOTIFICAÇÕES & ALERTAS

### 📬 Sistema de Notificação

**Via Email/Sistema:**
1. ✉️ "Nova solicitação de aprovação: PC-2026-00045" → Aprovador
2. ✉️ "Sua solicitação foi aprovada" → Solicitante
3. ✉️ "Sua solicitação foi reprovada" → Solicitante (com motivo)
4. ✉️ "Manutenção venceu o prazo" → Gerente (se passar da data prevista)

### 🔔 Dashboard de Alertas
- Solicitações pendentes há mais de 5 dias
- Manutenções com prazo próximo (< 3 dias)
- PCs reprovadas (ação necessária)

---

## 6. RELATÓRIOS & HISTÓRICO

### 📊 Relatórios Disponíveis

1. **Histórico Completo de Pneus** (por veículo)
   - Todas as trocas, rodízios, datas, km
   - Vida útil restante estimada

2. **Manutenções por Período**
   - Filtro: Filial, Veículo, Tipo, Período
   - Tempo médio de aprovação
   - Custo total vs. orçado

3. **Compras por Centro de Custo**
   - Valor aprovado vs. realizado
   - Tempo médio do ciclo (criação → aprovação → entrega)
   - Fornecedores mais usados

4. **Aprovações Pendentes**
   - Por aprovador
   - Tempo em espera
   - Prioridade

---

## 7. PERMISSÕES & PAPÉIS

### 👥 Papéis de Usuários

| Papel | Pode Ver | Pode Criar | Pode Aprovar | Pode Editar |
|-------|----------|-----------|--------------|-------------|
| **Assistente de Manutenção** | Próprias + Filial | Manutenção, PC | Não | Próprias |
| **Coordenador de Frota** | Todas filial | Manutenção, PC, Pneus | até R$2k | Próprias |
| **Gerente de Manutenção** | Todas filial | Manutenção, PC | até R$10k | Próprias |
| **Diretor Operacional** | Todas | Tudo | Sem limite | Tudo |
| **Admin** | Tudo | Tudo | Tudo | Tudo |

---

## 8. RESUMO DOS ARQUIVOS ENVOLVIDOS

### 📁 Backend (Flask)

- `manutencoes` - CRUD de manutenções
- `manutencao_itens` - Itens da manutenção
- `manutencao_aprovacoes_config` - Configuração de quem aprova o quê
- `pedidos_compra` - CRUD de PCs
- `pedidos_compra_itens` - Itens do PC
- `veiculos_pneus` - Registro de pneus
- `auditoria_movimentacoes` - Histórico de tudo

### 🎨 Frontend (React)

- `ManutencoesPage.jsx` - Listagem de manutenções
- `PneusPage.jsx` - Listagem de pneus
- `PedidosCompraPage.jsx` - Listagem de PCs
- **`AprovacoesPage.jsx`** ← NOVA (a criar)
- `ResourcePage.jsx` - Componente genérico (usado por todos)

### 📊 API Endpoints

```
GET  /api/me → Info do usuário logado
GET  /api/permissoes → Permissões do usuário
GET  /api/manutencoes → Lista de manutenções
POST /api/manutencoes → Criar manutenção
PATCH /api/manutencoes/:id → Editar manutenção
POST /api/manutencoes/:id/aprovar → Aprovar
POST /api/manutencoes/:id/rejeitar → Rejeitar

GET  /api/pedidos_compra → Lista de PCs
POST /api/pedidos_compra → Criar PC
PATCH /api/pedidos_compra/:id → Editar PC

GET  /api/veiculos_pneus → Lista de pneus
POST /api/veiculos_pneus → Criar/instalar pneu
PATCH /api/veiculos_pneus/:id → Atualizar posição/status
```

---

## 📝 Próximos Passos

1. ✅ Criar tela `AprovacoesPage.jsx`
2. ✅ Implementar endpoints de aprovação no backend
3. ✅ Adicionar notificações por email
4. ✅ Gerar relatórios exportáveis
5. ✅ Testar fluxos completos

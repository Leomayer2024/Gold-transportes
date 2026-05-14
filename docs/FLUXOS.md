# Fluxos do Sistema SEG — Gold Transportes v2.0

Diagramas Mermaid de todos os processos principais com rastreamento de tabelas e campos.
Renderize em qualquer editor compatível (GitHub, VS Code + extensão Mermaid, Notion, Obsidian).

---

## Mapa de Interligações

```mermaid
graph LR
    COL[colaboradores]
    FIL[filiais]
    CON[contratos_operacionais]
    CC[contratos_colaboradores]
    EVT[eventos_rh]
    PRE[presencas_diarias]
    HE[horas_extras]
    JOR[jornadas_rtm]
    VEI[veiculos]
    VDO[veiculos_documentos]
    ABA[veiculos_abastecimentos]
    PNE[veiculos_pneus]
    MAN[manutencoes]
    MAN_I[manutencao_itens]
    PDC[pedidos_compra]
    PDC_I[pedidos_compra_itens]
    NFC[notas_cte]

    FIL --> COL
    FIL --> CON
    COL --> CC
    CON --> CC
    COL --> EVT
    EVT --> PRE
    COL --> PRE
    COL --> HE
    CON --> HE
    CON --> JOR
    VEI --> VDO
    VEI --> ABA
    VEI --> PNE
    VEI --> MAN
    MAN --> MAN_I
    MAN --> PDC
    PDC --> PDC_I
    PDC --> NFC
    PNE --> MAN
```

---

## 1. Admissão de Colaborador (RH)

**Início:** Aprovação da vaga &nbsp;→&nbsp; **Fim:** Colaborador ativo com acesso ao sistema

```mermaid
flowchart TD
    A([Vaga aprovada]) --> B

    B["ESCREVE colaboradores\nnome_completo · cpf · filial_id · cargo\ndata_admissao · ativo = true"]
    B --> C

    C["ESCREVE colaboradores\nturno · escala_servico\nhorario_padrao_inicio/fim · carga_horaria_semanal\nintervalo_almoco_minutos"]
    C --> D

    D["ESCREVE colaboradores\nsalario_base_mensal · percentual_periculosidade\npercentual_adicional_clt · adicional_noturno\nbeneficio_tipos · beneficios_mensais"]
    D --> E

    E["ESCREVE contratos_colaboradores\ncolaborador_id → colaboradores.id\ncontrato_id → contratos_operacionais.id\ntipo · percentual_alocacao\ninicio_vigencia · data_inicio_vinculo"]
    E --> F

    F["ESCREVE colaboradores\npermission_scopes — escopos de acesso\ntipo_acesso · permissao_app / desktop / editar / excluir"]
    F --> G

    G{Tem CNH/ASO?}
    G -- Sim --> H["ESCREVE documentos_colaboradores\n(tabela futura — hoje via observações)"]
    G -- Não --> I
    H --> I

    I([Colaborador ativo\nPresença começa a ser lançada\nCusto RH entra no contrato])
```

**Interligações geradas:**
| Módulo seguinte | Como se conecta |
|---|---|
| Presença Diária | `colaboradores.id` é buscado diariamente por filial |
| Custo de Contrato | `contratos_colaboradores.percentual_alocacao` entra no cálculo de custo |
| Horas Extras | `colaboradores.id` + `filial_id` são FK na tabela `horas_extras` |
| Eventos RH | `colaboradores.id` é FK em `eventos_rh` |

**Campos críticos:**
| Campo | Tabela | Detalhe |
|---|---|---|
| `escala_servico` | colaboradores | Define dias úteis — usado em presença e cálculo de dias |
| `salario_base_mensal` | colaboradores | Base para custo no dashboard de contratos |
| `percentual_alocacao` | contratos_colaboradores | % do custo imputado ao contrato |
| `inicio_vigencia` | contratos_colaboradores | Início do vínculo com o contrato operacional |

---

## 2. Planejamento e Aprovação de Férias (RH)

**Início:** RH identifica período aquisitivo &nbsp;→&nbsp; **Fim:** Presença atualizada automaticamente

```mermaid
flowchart TD
    A([RH identifica direito — 12 meses após admissão]) --> B

    B["LÊ colaboradores\n→ verifica data_admissao e cargo"]
    B --> C

    C["ESCREVE eventos_rh\ncolaborador_id · filial_id\ntipo_evento = ferias\ndata_inicio · data_fim\nstatus = planejado"]
    C --> D

    D{Férias parceladas?}
    D -- 1 período --> E["ESCREVE eventos_rh\ndias_uteis = 30 · parcela = 1"]
    D -- 2 períodos --> F["ESCREVE 2 registros em eventos_rh\nparcela = 1 e parcela = 2\n(mínimo 10 dias cada)"]
    D -- 3 períodos --> G["ESCREVE 3 registros em eventos_rh\n(um deve ter ≥ 14 dias)"]
    E --> H
    F --> H
    G --> H

    H{Abono pecuniário?}
    H -- Sim --> I["ESCREVE eventos_rh\nabono_pecuniario = true\n1/3 dos dias convertido em $"]
    H -- Não --> J
    I --> J

    J["Gestor revisa — status = aprovado\naprovado_por · aprovado_em"]
    J --> K

    K["impacta_presenca = true\nSistema atualiza presencas_diarias\npara os dias do período:\nstatus = ferias"]
    K --> L([Colaborador em férias\nPresença preenchida automaticamente])
```

**Interligações:**
| Módulo | Como se conecta |
|---|---|
| Presença Diária | `eventos_rh.impacta_presenca = true` → `presencas_diarias.status = 'ferias'` para cada dia do período |
| Cálculo de custo | Dias de férias entram no cálculo de encargos no dashboard de contratos |

**Campos críticos:**
| Campo | Tabela | Detalhe |
|---|---|---|
| `tipo_evento` | eventos_rh | ferias · afastamento · licenca · atestado · folga_programada · suspensao |
| `impacta_presenca` | eventos_rh | true = preenche presença automaticamente no período |
| `parcela` | eventos_rh | 1, 2 ou 3 — cada parcela é um registro separado |
| `abono_pecuniario` | eventos_rh | true = 1/3 dos dias viram dinheiro (CLT art. 143) |
| `dias_uteis` | eventos_rh | Dias úteis do período (excluindo fins de semana e feriados) |

---

## 3. Horas Extras — Solicitação e Aprovação (RH/Operação)

**Início:** Colaborador ou gestor registra HE &nbsp;→&nbsp; **Fim:** HE aprovada e disponível para fechamento

```mermaid
flowchart TD
    A([Operação exige presença fora do turno]) --> B

    B["LÊ colaboradores → verifica filial_id e cargo\nLÊ contratos_operacionais → qual serviço gerou a HE?\nLÊ jornadas_rtm → qual jornada de carregamento?"]
    B --> C

    C["ESCREVE horas_extras\ncolaborador_id · filial_id\nservico_id (contratos_operacionais.id)\njornada_id (jornadas_rtm.id)\nmotivo · qtd_horas · data_solicitacao\nstatus = pendente"]
    C --> D

    D{Gestor avalia}
    D -- Aprova --> E["ESCREVE horas_extras\nstatus = aprovado\njustificativa_gestor\ndata_aprovacao · aprovado_por"]
    D -- Reprova --> F["ESCREVE horas_extras\nstatus = reprovado\njustificativa_gestor com motivo"]

    E --> G["LÊ horas_extras + colaboradores\n→ entra no cálculo de custo do contrato"]
    G --> H([HE aprovada — reflete no custo mensal])
    F --> I([HE arquivada como reprovada])
```

**Interligações:**
| Módulo | Como se conecta |
|---|---|
| Contratos Operacionais | `horas_extras.servico_id` → `contratos_operacionais.id` — HE é rateada no custo do contrato |
| Carregamento RTM | `horas_extras.jornada_id` → `jornadas_rtm.id` — HE originada de uma jornada específica |
| Presença Diária | Colaborador com HE aprovada pode ter `presencas_diarias.status = 'presente'` no mesmo dia com observação |

**Campos críticos:**
| Campo | Tabela | Detalhe |
|---|---|---|
| `qtd_horas` | horas_extras | Decimal (ex: 1.5 = 1h30min) |
| `servico_id` | horas_extras | Qual contrato/serviço gerou a necessidade |
| `status` | horas_extras | pendente → aprovado ou reprovado |
| `aprovado_por` | horas_extras | UUID do usuário aprovador (auth.users) |

---

## 4. Desligamento de Colaborador (RH)

**Início:** Decisão de desligamento &nbsp;→&nbsp; **Fim:** Colaborador inativo, acesso revogado

```mermaid
flowchart TD
    A([Decisão de desligamento]) --> B

    B["ESCREVE colaboradores\ndata_desligamento = data do último dia\nativo = false"]
    B --> C

    C["ESCREVE contratos_colaboradores\nfim_vigencia = data_desligamento\ndata_fim_vinculo = data_desligamento\nativo = false"]
    C --> D

    D["ESCREVE colaboradores\npermission_scopes = array vazio\ntipo_acesso = null"]
    D --> E

    E["LÊ eventos_rh WHERE status IN (planejado, aprovado)\n→ cancelar férias/afastamentos futuros\nESCREVE eventos_rh → status = cancelado"]
    E --> F

    F["LÊ horas_extras WHERE status = pendente\n→ resolver pendências de aprovação\nESCREVE horas_extras → status conforme decisão"]
    F --> G

    G["Emitir documentação\nRescisão · Seguro-desemprego · CTPS"]
    G --> H([Colaborador inativo\nNão aparece nas listas por padrão\nHistórico preservado no banco])
```

**Interligações:**
| Módulo | O que muda |
|---|---|
| Presença Diária | `colaboradores.ativo = false` → não aparece mais no lançamento diário |
| Contratos | `contratos_colaboradores.ativo = false` → sai do cálculo de custo do contrato |
| Horas Extras | Pendências devem ser encerradas antes do desligamento |

---

## 5. Presença Diária (Operação)

**Início:** Início do dia de trabalho &nbsp;→&nbsp; **Fim:** Presença registrada com status correto para todos

```mermaid
flowchart TD
    A([Início do dia de trabalho]) --> B

    B["LÊ colaboradores WHERE filial_id = X AND ativo = true\nLÊ feriados WHERE data = hoje AND filial_id IN (X, null)\nLÊ eventos_rh WHERE data_inicio <= hoje <= data_fim AND status = aprovado"]
    B --> C

    C{Para cada colaborador}
    C --> D{Tem evento RH ativo?}

    D -- ferias / afastamento --> E["ESCREVE presencas_diarias\nstatus = ferias ou afastado\norigen = auto"]
    D -- licenca / atestado --> F["ESCREVE presencas_diarias\nstatus = atestado\norigem = auto"]
    D -- Nenhum --> G{Feriado?}

    G -- Sim --> H["ESCREVE presencas_diarias\nstatus = folga · origem = auto"]
    G -- Não --> I{Compareceu?}

    I -- Sim, no horário --> J["ESCREVE presencas_diarias\nstatus = presente\nhora_entrada · hora_saida"]
    I -- Sim, com atraso --> K["ESCREVE presencas_diarias\nstatus = atraso\nhora_entrada · observacoes"]
    I -- Não --> L["ESCREVE presencas_diarias\nstatus = falta\nobservacoes = justificativa"]

    E --> M
    F --> M
    H --> M
    J --> M
    K --> M
    L --> M

    M["Atualização feita via UPSERT\nChave única: colaborador_id + data_referencia\nAlterado_por = usuário logado"]
    M --> C
    C -- Todos registrados --> N

    N["LÊ presencas_diarias\n→ Dashboard mostra assiduidade do dia\n→ Exportar XLSX/PDF disponível"]
    N --> O([Presença do dia concluída])
```

**Interligações:**
| Módulo | Como se conecta |
|---|---|
| Eventos RH | `eventos_rh.impacta_presenca = true` → preenche automático; status copiado para `presencas_diarias.status` |
| Feriados | `feriados` tabela — dia é checado antes de lançar falta |
| Horas Extras | HE aprovada no mesmo dia: `presencas_diarias.status = presente` com observação |
| Dashboard | `presencas_diarias` alimenta indicadores de assiduidade por filial e contrato |
| Exportação | `/api/presenca-mes-xlsx`, `/api/presenca-calendario-massa-xlsx`, `/api/presenca-calendario-pdf` |

**Campos críticos:**
| Campo | Tabela | Detalhe |
|---|---|---|
| `status` | presencas_diarias | presente · falta · folga · atraso · atestado · ferias · afastado · pendente |
| `data_referencia` | presencas_diarias | Data do registro — chave junto com `colaborador_id` |
| `origem` | presencas_diarias | manual (digitado pelo gestor) · app (registrado pelo colaborador) · auto (evento RH/feriado) |
| `alterado_por` | presencas_diarias | UUID do usuário que fez a última alteração |

---

## 6. Contrato Operacional — Equipe e Custos

**Início:** Novo contrato com cliente &nbsp;→&nbsp; **Fim:** Custo real monitorado mensalmente

```mermaid
flowchart TD
    A([Contrato fechado com cliente]) --> B

    B["ESCREVE contratos_operacionais\nfilial_id · codigo_contrato · nome_contrato · cliente_nome\nvalor_mensal_contrato\nhoras_50_cobradas_contrato · horas_100_cobradas_contrato"]
    B --> C

    C["ESCREVE contratos_colaboradores\ncontrato_id · colaborador_id\ntipo = colaborador\npercentual_alocacao · valor_cobrado_colaborador\ninicio_vigencia · data_inicio_vinculo"]
    C --> D

    D["ESCREVE contratos_colaboradores\nveiculo_carregamento_id (para cada caminhão alocado)\ntipo = veiculo"]
    D --> E

    E["ESCREVE despesas_operacionais\nContrato + mês + descrição + valor"]
    E --> F

    F["LÊ colaboradores → salario_base + encargos\nLÊ contratos_colaboradores → percentual_alocacao\nLÊ horas_extras → qtd HE aprovadas\nLÊ despesas_operacionais → gastos extras\n→ CALCULA custo real do contrato"]
    F --> G

    G{Acuracidade}
    G -- Verde: custo < valor_contrato --> H[Contrato lucrativo\nManter configuração]
    G -- Vermelho: custo > valor_contrato --> I[Revisar alocação\nou renegociar com cliente]
    H --> J([Monitoramento mensal contínuo])
    I --> J
```

**Interligações:**
| Módulo | Como se conecta |
|---|---|
| Colaboradores | `contratos_colaboradores.colaborador_id` → salário e encargos entram no custo |
| Horas Extras | `horas_extras.servico_id` → HE aprovadas são somadas ao custo do contrato |
| Carregamento RTM | `jornadas_rtm.contrato_id` → jornadas de carregamento são vinculadas ao contrato |
| Despesas | `despesas_operacionais.contrato_id` → gastos avulsos do mês |

---

## 7. Operação de Carregamento RTM (Diária)

**Início:** Início do turno &nbsp;→&nbsp; **Fim:** Jornada fechada com bonificação calculada

```mermaid
flowchart TD
    A([Início do turno]) --> B

    B["ESCREVE jornadas_rtm\nfilial_id · contrato_id · data · turno\nstatus = em_andamento\nLÊ contratos_operacionais → meta de cilindros/dia"]
    B --> C

    C["ESCREVE carregamentos_rtm\njornada_id · veiculo_carregamento_id\nhorario_inicio_carga · status = em_andamento"]
    C --> D

    D{Paradas durante operação?}
    D -- Sim --> E["ESCREVE paradas_carregamento_rtm\ncarregamento_id · motivo_id\nhorario_inicio · horario_fim · observacoes\nLÊ motivos_parada_carregamento → exige_observacao?"]
    E --> D
    D -- Não --> F

    F["ESCREVE carregamentos_rtm\nqtd_cilindros_carregados · horario_fim_carga\nstatus = concluido"]
    F --> G

    G{Ocorrências?}
    G -- Sim --> H["ESCREVE ocorrencias\ncarregamento_id · tipo · descricao\nhorario · gravidade"]
    G -- Não --> I
    H --> I

    I["ESCREVE jornadas_rtm\nstatus = fechada\ntotal_cilindros · total_caminhoes\nhora_fechamento"]
    I --> J

    J["CALCULA bonificação\nLÊ bonificacao_metricas → critérios\nLÊ jornadas_rtm → dados da jornada\n→ ESCREVE em resultado de bonificação"]
    J --> K([Jornada concluída\nDados disponíveis para Dashboard])
```

**Interligações:**
| Módulo | Como se conecta |
|---|---|
| Contratos Operacionais | `jornadas_rtm.contrato_id` → meta de cilindros definida em `contratos_operacionais` |
| Horas Extras | `horas_extras.jornada_id` → HE gerada por uma jornada específica |
| Veículos | `carregamentos_rtm.veiculo_carregamento_id` → veículo usado no carregamento |
| Motivos de Parada | `paradas_carregamento_rtm.motivo_id` → `motivos_parada_carregamento.id` |

---

## 8. Documentos de Frota (Frota)

**Início:** Cadastro de documento do veículo &nbsp;→&nbsp; **Fim:** Alerta de vencimento e renovação

```mermaid
flowchart TD
    A([Documento obtido ou a vencer]) --> B

    B["LÊ veiculos → placa · marca · modelo\npara confirmar qual veículo"]
    B --> C

    C["ESCREVE veiculos_documentos\nveiculo_id → veiculos.id\ntipo_documento: crlv | seguro | tacografo | ipva | antt | certificado | vistoria | outros\nnumero_documento · orgao_emissor\ndata_emissao · data_validade\nprazo_renovacao_dias · arquivo_url\nstatus = ativo"]
    C --> D

    D["Dashboard de Frota\nLÊ veiculos_documentos WHERE data_validade <= hoje + prazo_renovacao_dias\n→ exibe alertas de vencimento próximo"]
    D --> E

    E{Situação}
    E -- Dentro da validade --> F[Monitoramento periódico\nStatus = ativo]
    E -- Próximo ao vencimento --> G["ATUALIZA veiculos_documentos\nstatus = a_vencer\nResponsável inicia processo de renovação"]
    E -- Vencido --> H["ATUALIZA veiculos_documentos\nstatus = vencido\nVeículo pode ser bloqueado para operação"]

    G --> I["Renovação realizada\nESCREVE novo registro em veiculos_documentos\ncom nova data_validade\nANTIGO: status = substituido"]
    H --> I
    I --> J([Documento renovado · histórico preservado])

    F --> D
```

**Interligações:**
| Módulo | Como se conecta |
|---|---|
| Veículos | `veiculos_documentos.veiculo_id` → `veiculos.id` — todo documento pertence a um veículo |
| Dashboard Frota | `/api/dashboard/frota` lê documentos próximos ao vencimento |
| Manutenção | Documentos vencidos (tacógrafo, ANTT) podem originar OS de manutenção preventiva |

**Campos críticos:**
| Campo | Tabela | Detalhe |
|---|---|---|
| `tipo_documento` | veiculos_documentos | crlv · seguro · tacografo · ipva · antt · certificado · vistoria · outros |
| `data_validade` | veiculos_documentos | Data de expiração — base para alertas |
| `prazo_renovacao_dias` | veiculos_documentos | Quantos dias antes do vencimento gera alerta |
| `status` | veiculos_documentos | ativo · a_vencer · vencido · substituido |

---

## 9. Manutenção de Veículo (OS)

**Início:** Problema identificado ou manutenção programada &nbsp;→&nbsp; **Fim:** OS encerrada, compras registradas

```mermaid
flowchart TD
    A([Problema identificado / revisão programada]) --> B

    B["LÊ veiculos → placa · odometro_atual\nConfirma quilometragem do veículo"]
    B --> C

    C["ESCREVE manutencoes\nveiculo_id → veiculos.id\ntitulo · tipo: preventiva | corretiva | preditiva | recall\nprioridade: critica | alta | normal | baixa\ndata_abertura · status = aberta\nkm_abertura · oficina · valor_estimado"]
    C --> D

    D{Requer aprovação?}
    D -- Sim --> E["ESCREVE manutencoes\nstatus = aguardando_aprovacao\nLÊ manutencao_aprovacoes_config → quem aprova + limite de valor"]
    E --> F{Aprovador decide}
    F -- Aprova --> G["ESCREVE manutencoes\nstatus = aprovada\naprovado_por · aprovado_em"]
    F -- Reprova --> H["ESCREVE manutencoes\nstatus = reprovada\nmotivo_reprovacao"]
    D -- Não --> G

    G --> I["ESCREVE manutencoes\nstatus = em_execucao\ndata_inicio"]
    I --> J["ESCREVE manutencao_itens\nmanutencao_id · tipo_item: peca | servico | fluido | mao_de_obra\ndescricao · quantidade · valor_unitario\nfornecedor"]
    J --> K{Peças precisam ser compradas?}

    K -- Sim --> L["ESCREVE pedidos_compra\nfilial_id · data_pedido\nLÊ manutencao_itens → itens do pedido\nstatus = rascunho"]
    L --> M["ESCREVE pedidos_compra_itens\npedido_id · descricao · categoria\nunidade · quantidade · valor_unitario"]
    M --> N[Fluxo de Pedido de Compra\nVer Fluxo 11]
    N --> O

    K -- Não → estoque/mão de obra --> O

    O["ESCREVE manutencoes\nstatus = concluida\ndata_conclusao · valor_final\npedido_compra_id se gerou compra\nLÊ veiculos → ATUALIZA odometro_atual se km_saida maior"]
    O --> P([OS encerrada · histórico preservado])

    H --> Q([OS reprovada — reavaliar necessidade])
```

**Interligações:**
| Módulo | Como se conecta |
|---|---|
| Veículos | `manutencoes.veiculo_id` → `veiculos.id`; odômetro atualizado ao concluir |
| Pedidos de Compra | `manutencoes.pedido_compra_id` → `pedidos_compra.id` (gerado para as peças) |
| Pneus | Pneu com `status = trocar` origina OS de manutenção |
| Documentos de Frota | Tacógrafo vencido pode gerar OS preventiva |

---

## 10. Controle de Pneus (Frota)

**Início:** Instalação de pneu novo &nbsp;→&nbsp; **Fim:** Pneu descartado após vida útil

```mermaid
flowchart TD
    A([Pneu novo disponível]) --> B

    B["LÊ veiculos → odometro_atual\nConfirma quilometragem no momento da instalação"]
    B --> C

    C["ESCREVE veiculos_pneus\nveiculo_id → veiculos.id\nposicao · marca · medida · dot\nvida: 1 = original | 2 = recauchutado\nkm_instalacao = veiculos.odometro_atual\nstatus = ativo"]
    C --> D

    D{Monitoramento periódico}
    D --> E["LÊ veiculos.odometro_atual\nCalcula km rodado = atual - km_instalacao"]
    E --> F{Diagnóstico}

    F -- OK → sem ação --> D
    F -- Rodízio programado --> G["ATUALIZA veiculos_pneus\nposicao nova · km_rodizio\nstatus = ativo"]
    G --> D

    F -- Desgaste crítico → trocar --> H["ATUALIZA veiculos_pneus\nstatus = trocar\nkm_retirada"]
    H --> I{Tem recauchutagem viável?}
    I -- Sim e vida = 1 --> J["Recauchutagem externa\nNovo registro: vida = 2 · km_instalacao = atual\nStatus = ativo"]
    I -- Não --> K["ATUALIZA veiculos_pneus\nstatus = sucata\nESCREVE manutencoes (OS de troca)\nVer Fluxo 9"]
    J --> D
    K --> L([Pneu descartado · novo pneu instalado no Fluxo 9])
```

**Interligações:**
| Módulo | Como se conecta |
|---|---|
| Veículos | `veiculos_pneus.veiculo_id` + lê `veiculos.odometro_atual` para calcular km rodado |
| Manutenção | `status = trocar` → gera OS de manutenção corretiva |
| Pedidos de Compra | OS de troca de pneu → pedido de compra para aquisição |

---

## 11. Abastecimento de Veículo (Frota)

**Início:** Veículo vai abastecer &nbsp;→&nbsp; **Fim:** Consumo registrado e dashboard atualizado

```mermaid
flowchart TD
    A([Veículo para no posto]) --> B

    B["LÊ veiculos → placa · odometro_atual · combustivel · capacidade_tanque\nConferência antes do registro"]
    B --> C

    C["ESCREVE veiculos_abastecimentos\nveiculo_id → veiculos.id\nfilial_id\ndata_abastecimento · odometro_abastecimento\ncombustivel · litros · preco_por_litro\nnome_posto · numero_nota_fiscal\nvalor_total = litros × preco_por_litro"]
    C --> D

    D["ATUALIZA veiculos\nodometro_atual = odometro_abastecimento\n(se maior que o registrado)"]
    D --> E

    E["Dashboard de Frota\nLÊ veiculos_abastecimentos WHERE mes = atual\n→ gasto_mes = SUM(valor_total)\n→ litros_mes = SUM(litros)\n→ km_por_litro = km_percorrido / litros_mes"]
    E --> F

    F{Consumo anormal?}
    F -- Consumo acima do esperado --> G["Alerta no dashboard\nPossível vazamento · pneu murchando · motor\nLÊ veiculos_pneus → checar pneus\n→ Abrir OS corretiva (Fluxo 9)"]
    F -- Consumo normal --> H([Registro concluído · dashboard atualizado])
    G --> H
```

**Interligações:**
| Módulo | Como se conecta |
|---|---|
| Veículos | `veiculos_abastecimentos.veiculo_id`; `veiculos.odometro_atual` atualizado |
| Dashboard Frota | `/api/dashboard/frota` agrega abastecimentos por mês |
| Manutenção | Consumo alto → OS corretiva |
| Pneus | Pneu com baixa calibragem aumenta consumo — checagem cruzada |

---

## 12. Pedido de Compra (Financeiro)

**Início:** Necessidade identificada &nbsp;→&nbsp; **Fim:** Pagamento registrado, nota vinculada

```mermaid
flowchart TD
    A([Necessidade identificada\nManual ou via OS de Manutenção]) --> B

    B["ESCREVE pedidos_compra\nfilial_id · numero_pedido · data_pedido\ndata_necessidade · fornecedor\nforma_pagamento · prazo_pagamento\ncentro_custo · criado_por\nstatus = rascunho"]
    B --> C

    C["ESCREVE pedidos_compra_itens\npedido_id · descricao · categoria\nunidade · quantidade · valor_unitario\nobservacoes\n→ valor_total = SUM(qtd × valor_unit) calculado"]
    C --> D

    D{Revisão}
    D -- Corrigir itens --> C
    D -- OK --> E["ATUALIZA pedidos_compra\nstatus = aguardando_aprovacao"]

    E --> F{Aprovação}
    F -- Aprovado --> G["ATUALIZA pedidos_compra\nstatus = aprovado"]
    F -- Recusado --> H["ATUALIZA pedidos_compra\nstatus = cancelado · observacoes = motivo"]

    G --> I["Pedido enviado ao fornecedor\nstatus = enviado"]
    I --> J{Recebimento}

    J -- Parcial --> K["ATUALIZA pedidos_compra\nstatus = recebido_parcial"]
    K --> J
    J -- Total --> L["ATUALIZA pedidos_compra\nstatus = recebido"]

    L --> M["ESCREVE notas_cte\nfilial_id · tipo: nfe | cte | nfse\nnumero_documento · emitente\nvalor_total · data_vencimento\npedido_compra_id → pedidos_compra.id"]
    M --> N["ATUALIZA pedidos_compra\nstatus = pago"]
    N --> O([Pedido encerrado\nNota fiscal vinculada])

    H --> P([Pedido cancelado])
```

**Interligações:**
| Módulo | Como se conecta |
|---|---|
| Manutenção | `manutencoes.pedido_compra_id` → gerado para compra de peças |
| Notas CTE | `notas_cte.pedido_compra_id` → vínculo com a nota fiscal do fornecedor |
| Dashboard | Pedidos aprovados entram em DRE e fluxo de caixa |

---

## 13. Gestão de Escopos e Permissões (Admin)

**Início:** Admin configura escopos &nbsp;→&nbsp; **Fim:** Colaborador vê apenas o que tem permissão

```mermaid
flowchart TD
    A([Admin master acessa permissões]) --> B

    B["LÊ colaboradores WHERE filial_id IN (filiais do admin)\n→ lista de usuários para configurar"]
    B --> C

    C["LÊ PERMISSION_SCOPE_GROUPS\n→ Mostra escopos disponíveis agrupados por categoria\n(Menus, Criar, Aprovar, Gerenciar, Admin)"]
    C --> D

    D["ESCREVE colaboradores.permission_scopes\nArray de strings — cada string é um escopo\nEx: [menu.colaboradores, create.colaboradores, menu.presenca]"]
    D --> E

    E{Tipo de escopo adicionado}
    E -- menu.X --> F[Colaborador vê o link no menu\nPode listar e visualizar registros de X]
    E -- create.X --> G[Pode criar e editar registros em X]
    E -- aprovar.X --> H[Pode aprovar itens em X\nEx: aprovar.manutencoes · aprovar.horas_extras]
    E -- manage.X --> I[Operação avançada em X\nEx: manage.presenca = alterar presença de outros]
    E -- admin.filial ou superadmin --> J[Acesso a todas as filiais / configuração do sistema]

    F --> K([Permissões aplicadas imediatamente\nSem necessidade de logout/login])
    G --> K
    H --> K
    I --> K
    J --> K
```

**Tabela completa de escopos:**
| Módulo | Ver | Criar/Editar | Aprovar | Gerenciar |
|---|---|---|---|---|
| Colaboradores | `menu.colaboradores` | `create.colaboradores` | — | — |
| Contratos Operacionais | `menu.contratos_operacionais` | `create.contratos_operacionais` | — | — |
| Contratos Colaboradores | `menu.contratos_colaboradores` | `create.contratos_colaboradores` | — | — |
| Presença | `menu.presenca` | — | — | `manage.presenca` |
| Eventos RH | `menu.eventos_rh` | `create.eventos_rh` | — | — |
| Horas Extras | `menu.horas_extras` | `create.horas_extras` | `aprovar.horas_extras` | — |
| Carregamento | `menu.carregamento` | — | — | `manage.programacao_carregamento` |
| Veículos | `menu.veiculos` | `create.veiculos` | — | — |
| Documentos de Frota | `menu.veiculos_documentos` | `create.veiculos_documentos` | — | — |
| Abastecimentos | `menu.abastecimentos` | `create.abastecimentos` | — | — |
| Pneus | `menu.pneus` | `create.pneus` | — | — |
| Manutenções | `menu.manutencoes` | `create.manutencoes` | `aprovar.manutencoes` | — |
| Pedidos de Compra | `menu.pedidos_compra` | `create.pedidos_compra` | — | — |
| Notas CTE | `menu.notas_cte` | `create.notas_cte` | — | — |
| Estoque | `menu.estoque` | `create.estoque` | — | — |
| Filiais | `menu.filiais` | `create.filiais` | — | — |
| Permissões | `menu.permissoes` | — | — | `manage.permissoes` |
| Auditoria | `menu.auditoria` | — | — | — |

---

## Referência Rápida — Tabelas e Módulos

| Tabela | Módulo no SEG | Ligada a |
|---|---|---|
| `colaboradores` | RH → Colaboradores | filiais, contratos, presença, eventos, horas_extras |
| `contratos_operacionais` | RH → Contratos Operacionais | colaboradores (via CC), jornadas, horas_extras |
| `contratos_colaboradores` | RH → Contratos → Equipe | colaboradores, contratos_operacionais |
| `eventos_rh` | RH → Eventos RH | colaboradores → presencas_diarias (auto) |
| `presencas_diarias` | Operação → Presença | colaboradores, filiais, eventos_rh |
| `horas_extras` | RH → Horas Extras | colaboradores, filiais, contratos_operacionais, jornadas_rtm |
| `jornadas_rtm` | Operação → Carregamento | contratos_operacionais, veiculos_carregamento |
| `veiculos` | Frota → Veículos | filiais, abastecimentos, pneus, manutencoes, documentos |
| `veiculos_documentos` | Frota → Documentos de Frota | veiculos |
| `veiculos_abastecimentos` | Frota → Abastecimentos | veiculos, filiais |
| `veiculos_pneus` | Frota → Pneus | veiculos → manutencoes |
| `manutencoes` | Frota → Manutenções | veiculos, pedidos_compra, manutencao_itens |
| `pedidos_compra` | Financeiro → Pedidos de Compra | filiais, manutencoes, notas_cte |
| `notas_cte` | Financeiro → Notas CTE | filiais, pedidos_compra |

---

*SEG v2.0 — Gerado em 2026-05-12. Atualizar a cada nova funcionalidade implementada.*

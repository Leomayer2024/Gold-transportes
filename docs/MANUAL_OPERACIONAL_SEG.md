# Manual Operacional Completo - SEG Web

Versao: 2.0  
Data: 01/04/2026

## 1. Objetivo deste manual
Este manual explica, de forma pratica e passo a passo:
1. Como cada tela funciona.
2. Para que serve cada processo.
3. Quais modulos se conectam entre si.
4. Quem deve operar cada etapa.
5. O que automatizar para deixar o sistema quase rodando sozinho.

## 2. Visao geral do sistema
O SEG Web centraliza operacao, RH e cadastros.

Resultados esperados:
1. Acesso certo para a pessoa certa.
2. Dados padronizados e confiaveis.
3. Menos operacao manual repetitiva.
4. Melhor previsibilidade do dia operacional.

## 3. Arquitetura e fluxo tecnico
Tecnologias:
1. Frontend: React + Vite.
2. Backend: Flask.
3. Banco/Auth/Storage: Supabase.

Fluxo principal:
1. Usuario faz login no Supabase Auth.
2. Frontend recebe token de sessao.
3. Frontend chama API Flask com Authorization Bearer.
4. Backend valida token e monta perfil com permissoes.
5. Frontend monta menu e libera botoes conforme escopos.
6. CRUD e operacao sao gravados no banco Supabase.

## 4. Perfis e responsabilidades (RACI simplificado)
### 4.1 Super admin
1. Define padrao de permissao.
2. Resolve excecoes criticas.
3. Audita conformidade e governanca.

### 4.2 RH
1. Mantem colaboradores.
2. Mantem documentos RH.
3. Planeja eventos RH.
4. Trata pendencias de validade/documentacao.

### 4.3 Lider Operacao
1. Valida presenca diaria.
2. Programa e opera carregamento.
3. Fecha jornadas.

### 4.4 Administrativo/Cadastro
1. Mantem filiais.
2. Mantem frota e referencias.
3. Mantem motivos operacionais.

### 4.5 TI/Produto
1. Monitora disponibilidade.
2. Evolui automacoes.
3. Mantem backup, trilha e seguranca.

## 5. Mapa de telas e conexoes
### 5.1 Autenticacao e base
1. Login -> gera sessao.
2. Permissoes -> define visibilidade e poder de acao.

### 5.2 RH
1. Colaboradores -> base para Documentos RH, Planejamento RH, Presenca, Carregamento.
2. Documentos RH -> gera status de risco documental.
3. Planejamento RH -> alimenta sugestao de status na Presenca.
4. Quadro de funcionarios -> consolidado de status da equipe por base.

### 5.3 Operacao
1. Presenca -> status diario real da equipe.
2. Carregamento -> jornada por turno e caminhao.

### 5.4 Cadastros
1. Filiais -> referencia para quase todos os modulos.
2. Veiculos -> frota base.
3. Referencias de carregamento -> apoio para jornada.
4. Veiculos de carregamento -> caminhao operacional do turno.
5. Motivos de parada -> padroniza eventos de parada.
6. Estoque -> placeholder.

## 6. Passo a passo tela por tela

## 6.1 Tela Login
Objetivo:
1. Autenticar usuario.

Passo a passo:
1. Informar email e senha.
2. Clicar em Entrar.
3. Sistema valida no Supabase.
4. Sistema busca perfil e permissoes.
5. Redireciona para primeira rota autorizada.

Entradas:
1. Email.
2. Senha.

Saidas:
1. Sessao autenticada.
2. Perfil carregado.

Conexao com outras telas:
1. Todas (sem sessao, nada abre).

## 6.2 Tela Dashboard
Objetivo:
1. Mostrar resumo executivo rapido.

Passo a passo:
1. Acessar Dashboard.
2. Ler cards de resumo por modulo.
3. Validar bases e alertas principais.

Entradas:
1. Nenhuma manual (consulta).

Saidas:
1. Visao consolidada para decisao diaria.

Conexao:
1. Consumidor de dados de RH, colaboradores, estoque, carregamento.

## 6.3 Tela Permissoes
Objetivo:
1. Controlar quem ve e quem altera cada modulo.

Passo a passo:
1. Selecionar colaborador.
2. Marcar flags basicas (editar/excluir/aprovar etc.).
3. Marcar escopos de menu (menu.*).
4. Marcar escopos operacionais (manage.* e create.*).
5. Definir filiais permitidas.
6. Salvar.
7. Pedir novo login do usuario para refletir tudo.

Entradas:
1. Flags.
2. Escopos.
3. Filiais.

Saidas:
1. Perfil com novos poderes e limites.

Conexao:
1. Controla diretamente todas as outras telas.

## 6.4 Tela Filiais
Objetivo:
1. Manter unidades/base operacional.

Passo a passo:
1. Cadastrar cidade, UF e parceira.
2. Completar endereco se necessario.
3. Ativar/Inativar.

Conexao:
1. Colaboradores, Documentos RH, Planejamento RH, Presenca, Carregamento, Veiculos, Rotas.

## 6.5 Tela Colaboradores
Objetivo:
1. Manter cadastro de pessoas da operacao.

Passo a passo:
1. Cadastrar nome, email, filial, cargo, CPF, data de admissao.
2. Definir tipo de acesso e flags basicas.
3. Salvar.
4. Ajustar permissoes detalhadas na tela Permissoes.

Automacao atual:
1. Na criacao, backend tenta garantir usuario no Supabase Auth.

Conexao:
1. Base para Documentos RH, Planejamento RH, Presenca, Quadro e Carregamento.

## 6.6 Tela Documentos RH
Objetivo:
1. Controlar conformidade documental.

Passo a passo:
1. Selecionar colaborador e filial.
2. Informar categoria e tipo de documento.
3. Informar emissao, validade e dias de alerta.
4. Anexar arquivo (opcional, recomendavel).
5. Salvar.
6. Monitorar colunas Status atual e Dias p/ vencer.

Automacao atual:
1. status_calculado automatico por validade e dias_alerta.
2. dias_para_vencer calculado automaticamente.
3. Resumo de vencidos/vencendo aparece no dashboard.

Status e operacao:
1. Campo status e manual.
2. Campo status_calculado e automatico.

Conexao:
1. Dashboard (alertas).
2. Governanca RH.

## 6.7 Tela Planejamento RH
Objetivo:
1. Planejar ausencias e eventos de RH com antecedencia.

Passo a passo:
1. Selecionar colaborador e filial.
2. Selecionar tipo de evento.
3. Definir data inicio e data fim.
4. Definir status (planejado/aprovado/etc.).
5. Marcar impacta presenca quando aplicavel.
6. Informar cobertura e observacoes.
7. Salvar.

Automacao atual:
1. Se impacta_presenca estiver ativo, evento pode sugerir status na Presenca.

Conexao:
1. Presenca diaria.
2. Quadro de funcionarios.

## 6.8 Tela Quadro de funcionarios
Objetivo:
1. Mostrar consolidado operacional por base.

Passo a passo:
1. Selecionar filial (opcional).
2. Avaliar totais por status (presentes, faltas, ferias, afastados etc.).
3. Tomar decisao de cobertura e alocacao.

Conexao:
1. Presenca + Planejamento RH + Colaboradores.

## 6.9 Tela Presenca
Objetivo:
1. Registrar presenca oficial do dia.

Passo a passo:
1. Selecionar data e filial.
2. Sistema carrega equipe ativa.
3. Conferir status sugeridos (quando houver evento RH impactando).
4. Ajustar manualmente excecoes.
5. Salvar lote.

Automacao atual:
1. Sugestao de status baseada em evento RH ativo.

Conexao:
1. Quadro de funcionarios.
2. Indicadores diarios.

## 6.10 Tela Carregamento
Objetivo:
1. Controlar ciclo de jornada por turno.

Passo a passo de programacao:
1. Selecionar data, filial e turno.
2. Selecionar um ou mais veiculos de carregamento.
3. Definir referencia operacional (rota).
4. Abrir jornada.

Passo a passo de operacao:
1. Iniciar carga.
2. Registrar parada quando necessario.
3. Encerrar parada.
4. Registrar ocorrencia quando houver.
5. Encerrar carga.

Passo a passo de fechamento:
1. Informar quantidade de cilindros.
2. Informar divergencias/observacao.
3. Finalizar jornada.

Regras:
1. Nao finaliza se carga/parada estiver aberta.
2. Valida permissao e escopo por modulo.

Conexao:
1. Veiculos de carregamento.
2. Referencias de carregamento.
3. Motivos de parada.
4. Dashboard.

## 6.11 Tela Veiculos
Objetivo:
1. Manter frota de referencia.

Passo a passo:
1. Cadastrar placa, marca, modelo, filial e status.
2. Atualizar odometro e observacoes.

Conexao:
1. Base de cadastro de frota.

## 6.12 Tela Referencias de carregamento
Objetivo:
1. Manter referencias operacionais usadas na jornada.

Passo a passo:
1. Selecionar filial.
2. Definir nome da referencia.
3. Ajustar origem/destino quando fizer sentido.
4. Salvar.

Conexao:
1. Veiculos de carregamento.
2. Carregamento.

## 6.13 Tela Veiculos de carregamento
Objetivo:
1. Manter caminhao operacional por base e referencia.

Passo a passo:
1. Selecionar filial.
2. Definir rota/referencia padrao.
3. Cadastrar placa, transportadora, tipo e capacidade.
4. Salvar.

Conexao:
1. Carregamento.

## 6.14 Tela Motivos de parada
Objetivo:
1. Padronizar classificacao de parada operacional.

Passo a passo:
1. Cadastrar descricao.
2. Definir ordem.
3. Definir se exige observacao.
4. Salvar.

Conexao:
1. Carregamento (eventos de parada).

## 6.15 Tela Estoque
Objetivo:
1. Placeholder para evolucao futura.

## 7. O que ja esta automatizado hoje
1. Autenticacao e sessao por Supabase.
2. Controle de menu por escopo.
3. Controle de CRUD por permissao.
4. Restricao por filial.
5. Calculo automatico de status documental.
6. Sugestao de status de presenca por evento RH.
7. Validacoes de integridade no carregamento.

## 8. O que automatizar para rodar quase sozinho

## 8.1 Prioridade alta
1. Motor de alertas diario:
1.1 Documentos vencidos e vencendo.
1.2 Eventos RH iniciando em D+1.
1.3 Jornadas abertas sem fechamento.

2. Escalonamento automatico:
2.1 Sem tratativa em X horas -> notifica lider.
2.2 Sem tratativa em Y horas -> notifica RH/gestor.
2.3 Sem tratativa critica -> notifica super admin.

3. Presenca auto-gerada no inicio do dia:
3.1 Snapshot automatico por base.
3.2 Lider so trata excecoes.

4. Checklist automatico de fechamento:
4.1 Bloqueios claros e sugestoes objetivas.

## 8.2 Prioridade media
1. Workflow formal de aprovacao em RH.
2. Trilha de auditoria por campo.
3. Semaforo visual por status nas tabelas.
4. KPIs com metas e donos.

## 8.3 Prioridade avancada
1. Regras auto-executaveis:
1.1 Documento obrigatorio vencido -> gera tarefa e bloqueio de escala conforme politica.
1.2 Evento RH aprovado -> abre tarefa de cobertura automaticamente.

2. Integracoes:
2.1 Ponto eletronico.
2.2 Sistemas de frota/telemetria.
2.3 Mensageria corporativa.

3. Analise preditiva:
3.1 Risco de falta por base/turno.
3.2 Risco de gargalo de carregamento.

## 9. Governanca operacional (quem mexe em que)
1. Super admin:
1.1 Permissoes, excecoes, governanca.

2. RH:
2.1 Colaboradores.
2.2 Documentos RH.
2.3 Planejamento RH.

3. Lider Operacao:
3.1 Presenca.
3.2 Carregamento.

4. Administrativo:
4.1 Cadastros base.

5. TI:
5.1 Disponibilidade tecnica.
5.2 Evolucao de automacoes.

## 10. Rotina diaria recomendada (operacao padrao)
Inicio do dia:
1. RH abre painel de alertas.
2. Lider valida presenca sugerida.
3. Operacao programa jornadas.

Durante o dia:
1. Operacao registra eventos em tempo real.
2. RH trata pendencias criticas.

Fim do dia:
1. Lider fecha jornadas.
2. RH valida eventos encerrados.
3. Super admin confere indicadores e excecoes.

## 11. Plano de implantacao de automacao (90 dias)
Dias 1-15:
1. Definir regras de alerta e escalonamento.
2. Definir donos e SLAs por tipo de alerta.

Dias 16-30:
1. Implementar job diario.
2. Publicar painel de alertas operacionais.

Dias 31-60:
1. Implementar trilha de auditoria.
2. Implementar workflow de aprovacao RH.

Dias 61-90:
1. Implementar regras auto-executaveis.
2. Consolidar dashboard de KPIs e metas.

## 12. Checklist para operacao quase autonoma
- [ ] Escopos e filiais revisados para 100% dos usuarios.
- [ ] Alertas diarios ativos e com dono.
- [ ] Escalonamento ativo para criticos.
- [ ] Presenca auto-gerada no inicio do dia.
- [ ] Trilha de auditoria ativa.
- [ ] KPIs com meta e responsavel.
- [ ] Ritual diario formalizado.

## 13. Como salvar este manual em PDF
Opcao A (VS Code):
1. Abrir este arquivo.
2. Pressionar Ctrl+Shift+V para preview.
3. Pressionar Ctrl+P no preview.
4. Escolher Salvar como PDF.
5. Salvar como MANUAL_OPERACIONAL_SEG.pdf.

Opcao B (Word/Google Docs):
1. Copiar todo o conteudo.
2. Colar no Word/Docs.
3. Exportar para PDF.

## 14. Observacoes finais
1. O sistema ja esta com boa base de regras e seguranca.
2. O maior ganho de escala vem de alertas + auditoria + workflow.
3. Com esses pilares, a operacao passa de reativa para proativa.

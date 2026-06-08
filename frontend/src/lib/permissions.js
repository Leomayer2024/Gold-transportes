export const navigationGroups = [
  {
    title: 'Visão geral',
    items: [
      { to: '/dashboard', label: 'Dashboard', scope: 'menu.dashboard' },
      { to: '/acompanhamento', label: 'Acompanhamento de solicitações', scope: 'menu.acompanhamento' },
    ],
  },
  {
    title: 'RH',
    items: [
      { to: '/colaboradores', label: 'Colaboradores', scope: 'menu.colaboradores' },
      { to: '/contratos-operacionais', label: 'Contratos operacionais', scope: 'menu.contratos_operacionais' },
      { to: '/teste-contrato', label: 'Teste Contrato (preview)', scope: 'menu.contratos_operacionais' },
      { to: '/rh-documentos', label: 'Documentos RH', scope: 'menu.colaborador_documentos' },
      { to: '/diarias', label: 'Diárias / Hotelaria', scope: 'menu.diarias' },
      { to: '/rh-planejamento', label: 'Planejamento RH', scope: 'menu.eventos_rh' },
      { to: '/horas-extras', label: 'Horas extras', scope: 'menu.horas_extras' },
      { to: '/quadro-funcionarios', label: 'Quadro de funcionários', scope: 'menu.quadro_funcionarios' },
      { to: '/bonificacao', label: 'Bonificação', scope: 'menu.bonificacao' },
      { to: '/bonificacao-metricas', label: 'Métricas de bonificação', scope: 'menu.bonificacao_metricas' },
    ],
  },
  {
    title: 'Compras',
    items: [
      { to: '/pedidos-compra', label: 'Pedidos de compra', scope: 'menu.pedidos_compra' },
      { to: '/fornecedores', label: 'Fornecedores', scope: 'menu.fornecedores' },
      { to: '/clientes', label: 'Clientes', scope: 'menu.clientes' },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { to: '/notas-cte', label: 'Notas Fiscais / CT-e', scope: 'menu.notas_cte' },
      { to: '/contas-receber', label: 'Contas a Receber', scope: 'menu.contas_receber' },
      { to: '/contas-pagar', label: 'Contas a Pagar', scope: 'menu.contas_pagar' },
      { to: '/banco', label: 'Banco / Conciliação', scope: 'menu.banco' },
    ],
  },
  {
    title: 'Configurações',
    items: [
      { to: '/feriados', label: 'Feriados', scope: 'menu.feriados' },
      { to: '/gestao-acessos', label: 'Gestão de acessos', scope: 'menu.gestao_acessos' },
    ],
  },
  {
    title: 'Frota',
    items: [
      { to: '/frota-dashboard', label: 'Dashboard de frota', scope: 'menu.frota_dashboard' },
      { to: '/veiculos', label: 'Veículos', scope: 'menu.veiculos' },
      { to: '/veiculos-documentos', label: 'Documentos de frota', scope: 'menu.veiculos_documentos' },
      { to: '/abastecimentos', label: 'Abastecimentos', scope: 'menu.abastecimentos' },
      { to: '/pneus', label: 'Controle de pneus', scope: 'menu.pneus' },
      { to: '/manutencoes', label: 'Manutenções', scope: 'menu.manutencoes' },
    ],
  },
  {
    title: 'Cadastros',
    items: [
      { to: '/filiais', label: 'Filiais', scope: 'menu.filiais' },
      { to: '/rotas-carregamento', label: 'Referências de carregamento', scope: 'menu.rotas_carregamento' },
      { to: '/veiculos-carregamento', label: 'Veículos de carregamento', scope: 'menu.veiculos_carregamento' },
      { to: '/motivos-parada', label: 'Motivos de parada', scope: 'menu.motivos_parada_carregamento' },
      { to: '/estoque', label: 'Estoque', scope: 'menu.estoque' },
      { to: '/estoque/movimentos', label: 'Movimentos de estoque', scope: 'menu.estoque' },
    ],
  },
  {
    title: 'Administração',
    items: [
      { to: '/permissoes', label: 'Permissões', scope: 'menu.permissoes' },
      { to: '/auditoria', label: 'Auditoria', scope: 'menu.auditoria' },
    ],
  },
  {
    title: 'Operação RTM',
    items: [
      { to: '/presenca', label: 'Presença', scope: 'menu.presenca' },
      { to: '/ponto', label: 'Ponto (batidas faciais)', scope: 'menu.ponto' },
      { to: '/carregamento', label: 'Carregamento', scope: 'menu.carregamento' },
      { to: '/horas-extras-rtm', label: 'Calc. Horas Extras', scope: 'menu.horas_extras_rtm' },
      { to: '/ordens-servico', label: 'Ordens de Serviço (motorista)', scope: 'menu.ordens_servico' },
    ],
  },
]

export function hasScopePermission(profile, scope) {
  if (!scope) {
    return true
  }

  // Profile ainda não carregou (ex.: logo após login) → não libera nada.
  if (!profile) {
    return false
  }

  if (profile.is_super_admin) {
    return true
  }

  // SEGURANÇA: usuário sem nenhum escopo = SEM ACESSO.
  // Antes liberava tudo — vetor de escalada de privilégio.
  return (profile.permission_scopes || []).includes(scope)
}

export function getVisibleNavigation(profile) {
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasScopePermission(profile, item.scope)),
    }))
    .filter((group) => group.items.length > 0)
}

export function getAllNavigation(profile) {
  return navigationGroups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      locked: !hasScopePermission(profile, item.scope),
    })),
  }))
}

export function getDefaultAuthorizedPath(profile) {
  const firstItem = getVisibleNavigation(profile)[0]?.items[0]
  return firstItem?.to || '/dashboard'
}

export function canCreateResource(profile, resourceName, createScope) {
  const targetScope = createScope || `create.${resourceName}`
  return hasScopePermission(profile, targetScope)
}

/**
 * Verifica se o usuário tem permissão para uma ação granular (botões dentro
 * de telas, ex.: 'action.documentos_rh.renovar').
 *
 * Compat retroativa: se o usuário não tem NENHUM escopo `action.*` configurado,
 * todas as ações ficam liberadas — assim cadastros antigos sem ações marcadas
 * não perdem botões. Quando o admin marca ao menos uma ação, apenas as
 * marcadas ficam visíveis.
 */
export function hasActionPermission(profile, actionName) {
  if (!actionName) return true
  if (!profile) return false
  if (profile.is_super_admin) return true
  const scopes = profile.permission_scopes || []

  // Se já tem o escopo explícito, libera.
  if (scopes.includes(actionName)) return true

  // Compat: usuário sem NENHUM action.* configurado -> tudo liberado para
  // ações granulares (apenas action.*; menus/criação continuam exigindo escopo).
  const hasAnyAction = scopes.some((s) => s.startsWith('action.'))
  if (!hasAnyAction) return true

  return false
}
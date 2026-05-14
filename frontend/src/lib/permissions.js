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
      { to: '/rh-documentos', label: 'Documentos RH', scope: 'menu.colaborador_documentos' },
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
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { to: '/notas-cte', label: 'Notas Fiscais / CT-e', scope: 'menu.notas_cte' },
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
      { to: '/carregamento', label: 'Carregamento', scope: 'menu.carregamento' },
      { to: '/horas-extras-rtm', label: 'Calc. Horas Extras', scope: 'menu.horas_extras_rtm' },
    ],
  },
]

export function hasScopePermission(profile, scope) {
  if (!scope) {
    return true
  }

  if (!profile?.has_scope_permissions) {
    return true
  }

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

export function getDefaultAuthorizedPath(profile) {
  const firstItem = getVisibleNavigation(profile)[0]?.items[0]
  return firstItem?.to || '/dashboard'
}

export function canCreateResource(profile, resourceName, createScope) {
  const targetScope = createScope || `create.${resourceName}`
  return hasScopePermission(profile, targetScope)
}
import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`
let accessToken = null

supabase.auth.getSession().then(({ data: { session } }) => {
  accessToken = session?.access_token || null
})

supabase.auth.onAuthStateChange((_event, session) => {
  accessToken = session?.access_token || null
})

function buildHeaders(extraHeaders = {}) {
  return {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...extraHeaders,
  }
}

const TRANSIENT_STATUS = new Set([502, 503, 504])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function makeApiError(message, { status = 0, transient = false } = {}) {
  return Object.assign(new Error(message || 'Falha na comunicação com a API.'), { status, transient })
}

// Só reenvia automaticamente métodos idempotentes. Reenviar POST/PUT/DELETE
// poderia duplicar gravações — nesses casos falha na 1ª e o chamador decide.
function isIdempotent(method) {
  const m = (method || 'GET').toUpperCase()
  return m === 'GET' || m === 'HEAD'
}

async function request(path, options = {}) {
  const maxAttempts = isIdempotent(options.method) ? 3 : 1
  let lastErr

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response
    try {
      response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: buildHeaders(options.headers),
      })
    } catch {
      // Falha de rede (offline, conexão abortada) — transitório.
      lastErr = makeApiError('Conexão instável. Tente novamente.', { status: 0, transient: true })
      if (attempt < maxAttempts) { await sleep(300 * attempt); continue }
      throw lastErr
    }

    const isJson = response.headers.get('content-type')?.includes('application/json')
    const payload = isJson ? await response.json() : null

    if (!response.ok) {
      const transient = payload?.transient === true || TRANSIENT_STATUS.has(response.status)
      const err = makeApiError(payload?.error || 'Falha na comunicação com a API.', {
        status: response.status,
        transient,
      })
      if (transient && attempt < maxAttempts) { lastErr = err; await sleep(300 * attempt); continue }
      throw err
    }

    return payload
  }

  throw lastErr
}

export const api = {
  getProfile: () => request('/me'),
  getDashboard: (params = {}) => {
    const search = new URLSearchParams(params)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/dashboard${suffix}`)
  },
  getLoadingConfig: () => request('/carregamento/config'),
  getLoadingMetrics: (params = {}) => {
    const search = new URLSearchParams(params)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/carregamento/metricas${suffix}`)
  },
  getLoadingJourneys: (params = {}) => {
    const search = new URLSearchParams(params)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/carregamento/jornadas${suffix}`)
  },
  createLoadingJourney: (payload) =>
    request('/carregamento/jornadas', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  registerLoadingEvent: (journeyId, payload) =>
    request(`/carregamento/jornadas/${journeyId}/eventos`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  closeLoadingJourney: (journeyId, payload) =>
    request(`/carregamento/jornadas/${journeyId}/fechamento`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateLoadingEvent: (journeyId, eventId, payload) =>
    request(`/carregamento/jornadas/${journeyId}/eventos/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteLoadingEvent: (journeyId, eventId) =>
    request(`/carregamento/jornadas/${journeyId}/eventos/${eventId}`, {
      method: 'DELETE',
    }),
  deleteLoadingJourney: (journeyId) =>
    request(`/carregamento/jornadas/${journeyId}`, {
      method: 'DELETE',
    }),
  reopenLoadingJourney: (journeyId) =>
    request(`/carregamento/jornadas/${journeyId}/reabrir`, {
      method: 'POST',
    }),
  closeLoadingShift: (payload) =>
    request('/carregamento/turno/fechamento', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  reopenLoadingShift: (params = {}) => {
    const search = new URLSearchParams(params)
    return request(`/carregamento/turno/fechamento?${search.toString()}`, {
      method: 'DELETE',
    })
  },
  getPermissionsConfig: () => request('/permissoes/config'),
  getPermissionsDetail: (collaboratorId) => request(`/permissoes/${collaboratorId}`),
  updatePermissions: (collaboratorId, payload) =>
    request(`/permissoes/${collaboratorId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  permissoesPorEscopo: (scope) => request(`/permissoes/por-escopo?scope=${encodeURIComponent(scope)}`),
  colaboradoresComEscopo: (scope) => request(`/colaboradores/com-escopo?scope=${encodeURIComponent(scope)}`),
  filiaisDisponiveis: () => request('/filiais/disponiveis'),
  toggleEscopo: (colaborador_id, scope_name, ativo) =>
    request('/permissoes/toggle-escopo', {
      method: 'POST',
      body: JSON.stringify({ colaborador_id, scope_name, ativo }),
    }),
  getApprovalConfigs: () => request('/approval-configs'),
  updateApprovalConfig: (resourceType, payload) =>
    request(`/approval-configs/${resourceType}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getAuditConfig: () => request('/auditoria/config'),
  getAuditEvents: (params = {}) => {
    const search = new URLSearchParams(params)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/auditoria${suffix}`)
  },
  getPresenceConfig: () => request('/presenca-config'),
  getWorkforceBoard: (params = {}) => {
    const search = new URLSearchParams(params)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/quadro-funcionarios${suffix}`)
  },
  getCostsRhDashboard: (params = {}) => {
    const search = new URLSearchParams(params)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/custos-rh${suffix}`)
  },
  getPresence: (params = {}) => {
    const search = new URLSearchParams(params)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/presenca${suffix}`)
  },
  getPresenceByMonth: (params = {}) => {
    const search = new URLSearchParams(params)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/presenca-mes${suffix}`)
  },
  updatePresence: (payload) =>
    request('/presenca', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getBonificacaoBoard: (params = {}) => {
    const search = new URLSearchParams(params)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/bonificacao${suffix}`)
  },
  saveBonificacaoBoard: (payload) =>
    request('/bonificacao', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  importCollaborators: (payload) =>
    request('/colaboradores/importar', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  importVeiculos: (payload) =>
    request('/veiculos/importar', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  list: (resource, params = {}) => {
    const search = new URLSearchParams(params)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/${resource}${suffix}`)
  },
  create: (resource, payload) =>
    request(`/${resource}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (resource, id, payload) =>
    request(`/${resource}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  remove: (resource, id) =>
    request(`/${resource}/${id}`, {
      method: 'DELETE',
    }),
  getPedidoDetalhes: (pedidoId) => request(`/pedidos_compra/${pedidoId}/detalhes`),
  updatePedidoStatus: (pedidoId, status) =>
    request(`/pedidos_compra/${pedidoId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  sincronizarFinanceiroPedidos: () =>
    request('/pedidos_compra/sincronizar-financeiro', { method: 'POST' }),
  getFeriadosCalendario: (params = {}) => {
    const search = new URLSearchParams(params)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/feriados/calendario${suffix}`)
  },
  getNotasCteResumo: (params = {}) => {
    const search = new URLSearchParams(params)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/notas_cte/resumo${suffix}`)
  },
  updateNotaStatus: (notaId, status, dataPagamento) =>
    request(`/notas_cte/${notaId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, data_pagamento: dataPagamento || null }),
    }),

  // ─── Cargos ────────────────────────────────────────────────────────────────
  getCargosModelos: () => request('/cargos/modelos'),

  // ─── Estoque ───────────────────────────────────────────────────────────────
  getEstoqueResumo: () => request('/estoque/resumo'),
  getEstoqueHistorico: (params = {}) => {
    const search = new URLSearchParams(params)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/estoque_movimentos/historico${suffix}`)
  },
  criarMovimentoEstoque: (payload) =>
    request('/estoque_movimentos', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  criarMovimentoEstoqueBatch: (payload) =>
    request('/estoque_movimentos/batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ─── Gestão de acessos (somente super admin) ───────────────────────────────
  adminListarAcessos: () => request('/admin/acessos'),
  adminResetarSenha: (colaboradorId, novaSenha) =>
    request(`/admin/resetar-senha/${colaboradorId}`, {
      method: 'POST',
      body: JSON.stringify({ nova_senha: novaSenha }),
    }),
  adminAtualizarEmail: (colaboradorId, novoEmail) =>
    request(`/admin/atualizar-email/${colaboradorId}`, {
      method: 'POST',
      body: JSON.stringify({ novo_email: novoEmail }),
    }),

  // ─── Assinatura SaaS ───────────────────────────────────────────────────────
  getAssinatura: () => request('/assinatura'),
  getPlanos: () => request('/planos'),
  criarCheckout: (planoId) =>
    request('/assinatura/checkout', {
      method: 'POST',
      body: JSON.stringify({ plano_id: planoId }),
    }),
  abrirPortal: () =>
    request('/assinatura/portal', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  getDashboardFrota: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString()
    return request(`/dashboard/frota${qs ? `?${qs}` : ''}`)
  },
  getDashboardAndamento: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString()
    return request(`/dashboard/andamento-filiais${qs ? `?${qs}` : ''}`)
  },
  getDashboardCarregamento: (data) =>
    request(`/dashboard/carregamento${data ? `?data=${encodeURIComponent(data)}` : ''}`),

  // ─── Pedidos de Compra ────────────────────────────────────────────────────
  preAlocarNumeroPedido: () => request('/pedidos_compra/pre-alocar-numero'),
  emAnalise: (id) =>
    request(`/approvals/${id}/em-analise`, {
      method: 'POST',
      body: JSON.stringify({ resource_type: 'pedidos_compra' }),
    }),
  aprovacaoAprovar: (id, resourceType, comentario) =>
    request(`/approvals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ resource_type: resourceType, comentario: comentario || '' }),
    }),
  aprovacaoReprovar: (id, resourceType, motivo) =>
    request(`/approvals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ resource_type: resourceType, motivo }),
    }),
  getPedidosCompraMetricas: (params = {}) => {
    const search = new URLSearchParams(params)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/pedidos-compra/metricas${suffix}`)
  },

  // ─── Acompanhamento / Aprovações ──────────────────────────────────────────
  getApprovals: (params = {}) => {
    const search = new URLSearchParams(params)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/approvals${suffix}`)
  },
  getApprovalsHistory: (params = {}) => {
    const search = new URLSearchParams(params)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/approvals/history${suffix}`)
  },
  approveRequest: (id, resourceType, comentario) =>
    request(`/approvals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ resource_type: resourceType, comentario: comentario || '' }),
    }),
  aprovarLider: (id, resourceType, comentario) =>
    request(`/approvals/${id}/aprovar-lider`, {
      method: 'POST',
      body: JSON.stringify({ resource_type: resourceType, comentario: comentario || '' }),
    }),
  rejectRequest: (id, resourceType, motivo) =>
    request(`/approvals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ resource_type: resourceType, motivo }),
    }),
  // ─── Portal Cliente (sem auth Supabase, usa Bearer token próprio) ──────────
  clienteLogin: async (email, senha) => {
    const resp = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/cliente/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error || 'Erro no login')
    return data
  },
  clienteRequest: async (path, token, opts = {}) => {
    const resp = await fetch(`${import.meta.env.VITE_API_URL || ''}/api${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) throw new Error(data.error || 'Erro')
    return data
  },
  adminSetSenhaCliente: (clienteId, senha) =>
    request(`/clientes/${clienteId}/set-senha`, {
      method: 'POST',
      body: JSON.stringify({ senha }),
    }),
  // RTM — Horas Extras fechamentos
  post: (path, payload) => request(path, { method: 'POST', body: JSON.stringify(payload) }),
  rtmSalvar: (mes_referencia, registros) =>
    request('/horas-extras-rtm/salvar', { method: 'POST', body: JSON.stringify({ mes_referencia, registros }) }),
  rtmMeses: () => request('/horas-extras-rtm/meses'),
  rtmMesesFiliais: () => request('/horas-extras-rtm/meses-filiais'),
  rtmDetalhe: (mes) => request(`/horas-extras-rtm/detalhe?mes=${mes}`),
  rtmDeletar: (mes, filial_nome) => {
    const qs = filial_nome ? `?filial_nome=${encodeURIComponent(filial_nome)}` : ''
    return request(`/horas-extras-rtm/mes/${mes}${qs}`, { method: 'DELETE' })
  },
  rtmEditarRegistro: (id, payload) => request(`/horas-extras-rtm/registro/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  rtmRecalcularTipoHora: (mes, filial_nome) => request('/horas-extras-rtm/recalcular-tipo-hora', { method: 'POST', body: JSON.stringify({ mes, filial_nome }) }),
  rtmReprocessarFinanceiro: (mes) => request('/horas-extras-rtm/reprocessar-financeiro', { method: 'POST', body: JSON.stringify({ mes }) }),
  rtmMetricas: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
    const qs = new URLSearchParams(clean).toString()
    return request(`/horas-extras-rtm/metricas${qs ? `?${qs}` : ''}`)
  },
  rtmTipoHoraMapa: (mes) => request(`/horas-extras-rtm/tipo-hora-mapa?mes=${mes}`),
  // Contas a Receber
  contasReceber: (params) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : ''
    return request(`/contas-receber${q}`)
  },
  contasReceberAlertas: () => request('/contas-receber/alertas'),
  criarContaReceber: (payload) => request('/contas-receber', { method: 'POST', body: JSON.stringify(payload) }),
  editarContaReceber: (id, payload) => request(`/contas-receber/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deletarContaReceber: (id) => request(`/contas-receber/${id}`, { method: 'DELETE' }),
  // Contas a Pagar
  contasPagar: (params) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : ''
    return request(`/contas-pagar${q}`)
  },
  contasPagarAlertas: () => request('/contas-pagar/alertas'),
  criarContaPagar: (payload) => request('/contas-pagar', { method: 'POST', body: JSON.stringify(payload) }),
  editarContaPagar: (id, payload) => request(`/contas-pagar/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deletarContaPagar: (id) => request(`/contas-pagar/${id}`, { method: 'DELETE' }),
  // Banco
  bancoContas: () => request('/banco/contas'),
  criarBancoConta: (payload) => request('/banco/contas', { method: 'POST', body: JSON.stringify(payload) }),
  editarBancoConta: (id, payload) => request(`/banco/contas/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deletarBancoConta: (id) => request(`/banco/contas/${id}`, { method: 'DELETE' }),
  bancoLancamentos: (params) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : ''
    return request(`/banco/lancamentos${q}`)
  },
  criarBancoLancamento: (payload) => request('/banco/lancamentos', { method: 'POST', body: JSON.stringify(payload) }),
  editarBancoLancamento: (id, payload) => request(`/banco/lancamentos/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deletarBancoLancamento: (id) => request(`/banco/lancamentos/${id}`, { method: 'DELETE' }),
  conciliarLancamento: (id, payload) => request(`/banco/lancamentos/${id}/conciliar`, { method: 'POST', body: JSON.stringify(payload) }),
  bancoSaldos: () => request('/banco/saldos'),

  // ─── Motor financeiro (painel + interligação + parcelas) ───────────────────
  financeiroPainel: (mes) => request(`/financeiro/painel${mes ? `?mes=${mes}` : ''}`),
  sincronizarNotasCteFinanceiro: () => request('/notas-cte/sincronizar-financeiro', { method: 'POST' }),
  sincronizarNfseFinanceiro: () => request('/notas-fiscais-servico/sincronizar-financeiro', { method: 'POST' }),
  listarParcelas: (params = {}) => {
    const search = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    )
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/financeiro/parcelas${suffix}`)
  },
  gerarParcelas: (payload) => request('/financeiro/parcelas/gerar', { method: 'POST', body: JSON.stringify(payload) }),
  editarParcela: (id, payload) => request(`/financeiro/parcelas/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deletarParcela: (id) => request(`/financeiro/parcelas/${id}`, { method: 'DELETE' }),

  // ─── Ponto (batidas faciais) ───────────────────────────────────────────────
  pontoBatidas: (params = {}) => {
    const search = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    )
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/ponto/batidas${suffix}`)
  },
  pontoResumo: (params = {}) => {
    const search = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    )
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/ponto/resumo${suffix}`)
  },
  pontoCriarBatida: (payload) =>
    request('/ponto/batida', { method: 'POST', body: JSON.stringify(payload) }),
  pontoEditarBatida: (id, payload) =>
    request(`/ponto/batida/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  pontoExcluirBatida: (id) =>
    request(`/ponto/batida/${id}`, { method: 'DELETE' }),
  pontoExportUrl: (params = {}) => {
    const search = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    )
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return `${API_URL}/ponto/export-xlsx${suffix}`
  },

  // ─── iopoint (ponto eletrônico externo — proxy do backend) ─────────────────
  iopointStatus: () => request('/iopoint/status'),
  iopointEspelho: (params = {}) => request(`/iopoint/espelho${qs(params)}`),
  iopointEspelhoExportUrl: (params = {}) => `${API_URL}/iopoint/espelho/export-xlsx${qs(params)}`,
  iopointAlertas: (params = {}) => request(`/iopoint/alertas${qs(params)}`),
  iopointConciliacaoPresenca: (params = {}) => request(`/iopoint/conciliacao-presenca${qs(params)}`),
  iopointConciliacaoHE: (params = {}) => request(`/iopoint/conciliacao-he${qs(params)}`),
  iopointHorasExtrasApuradas: (params = {}) => request(`/iopoint/horas-extras-apuradas${qs(params)}`),
  iopointForaCerca: (params = {}) => request(`/iopoint/fora-cerca${qs(params)}`),
  iopointDashboard: (params = {}) => request(`/iopoint/dashboard${qs(params)}`),
}

function qs(params = {}) {
  const search = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  )
  return search.toString() ? `?${search.toString()}` : ''
}

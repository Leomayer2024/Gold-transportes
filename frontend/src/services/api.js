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

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: buildHeaders(options.headers),
  })

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await response.json() : null

  if (!response.ok) {
    throw new Error(payload?.error || 'Falha na comunicação com a API.')
  }

  return payload
}

export const api = {
  getProfile: () => request('/me'),
  getDashboard: (params = {}) => {
    const search = new URLSearchParams(params)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request(`/dashboard${suffix}`)
  },
  getLoadingConfig: () => request('/carregamento/config'),
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
  getPermissionsConfig: () => request('/permissoes/config'),
  getPermissionsDetail: (collaboratorId) => request(`/permissoes/${collaboratorId}`),
  updatePermissions: (collaboratorId, payload) =>
    request(`/permissoes/${collaboratorId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
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
  rejectRequest: (id, resourceType, motivo) =>
    request(`/approvals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ resource_type: resourceType, motivo }),
    }),
  // RTM — Horas Extras fechamentos
  post: (path, payload) => request(path, { method: 'POST', body: JSON.stringify(payload) }),
  rtmSalvar: (mes_referencia, registros) =>
    request('/horas-extras-rtm/salvar', { method: 'POST', body: JSON.stringify({ mes_referencia, registros }) }),
  rtmMeses: () => request('/horas-extras-rtm/meses'),
  rtmDetalhe: (mes) => request(`/horas-extras-rtm/detalhe?mes=${mes}`),
  rtmDeletar: (mes) => request(`/horas-extras-rtm/mes/${mes}`, { method: 'DELETE' }),
  rtmMetricas: () => request('/horas-extras-rtm/metricas'),
}

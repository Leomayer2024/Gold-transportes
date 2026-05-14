import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import '../styles/acompanhamento.css'

// ─── Constantes ──────────────────────────────────────────────────────────────

const TIPOS = {
  manutencoes:    'Manutenção',
  pedidos_compra: 'Pedido de Compra',
  horas_extras:   'Hora Extra',
  abastecimentos: 'Abastecimento',
  pneus:          'Pneu',
}

const STATUS_PENDENTE  = ['pendente', 'pendente_aprovacao', 'aguardando_aprovacao', 'solicitado']
const STATUS_APROVADO  = ['aprovado', 'aprovada']
const STATUS_REJEITADO = ['reprovado', 'reprovada', 'cancelado']

const STATUS_LABEL = {
  pendente:             'Pendente',
  pendente_aprovacao:   'Aguard. Aprovação',
  aguardando_aprovacao: 'Aguard. Aprovação',
  solicitado:           'Solicitado',
  aprovado:             'Aprovado',
  aprovada:             'Aprovada',
  reprovado:            'Reprovado',
  reprovada:            'Reprovada',
  cancelado:            'Cancelado',
  aberta:               'Aberta',
  em_execucao:          'Em Execução',
  concluida:            'Concluída',
}

// Campos a exibir no modal por tipo, em ordem
const CAMPOS_MODAL = {
  manutencoes: [
    { k: 'numero_solicitacao', l: 'N° Solicitação' },
    { k: 'titulo',           l: 'Título' },
    { k: 'tipo_manutencao',  l: 'Tipo de manutenção' },
    { k: 'descricao',        l: 'Descrição', full: true },
    { k: 'prioridade',       l: 'Prioridade' },
    { k: 'data_abertura',    l: 'Data de abertura', date: true },
    { k: 'veiculo_id',       l: 'ID Veículo' },
    { k: 'km_atual',         l: 'KM atual' },
    { k: 'valor_estimado',   l: 'Valor estimado', moeda: true },
    { k: 'fornecedor',       l: 'Fornecedor' },
    { k: 'observacoes',      l: 'Observações', full: true },
  ],
  abastecimentos: [
    { k: 'numero_solicitacao', l: 'N° Solicitação' },
    { k: 'veiculo_id',         l: 'ID Veículo' },
    { k: 'tipo_combustivel',   l: 'Combustível' },
    { k: 'litros',             l: 'Litros' },
    { k: 'valor_litro',        l: 'Valor/litro', moeda: true },
    { k: 'valor_total',        l: 'Total', moeda: true },
    { k: 'data_abastecimento', l: 'Data', date: true },
    { k: 'km_atual',           l: 'KM atual' },
    { k: 'posto',              l: 'Posto' },
    { k: 'observacoes',        l: 'Observações', full: true },
  ],
  pedidos_compra: [
    { k: 'numero_solicitacao', l: 'N° Solicitação' },
    { k: 'numero_pedido',    l: 'N° Pedido' },
    { k: 'fornecedor',       l: 'Fornecedor' },
    { k: 'data_pedido',      l: 'Data do pedido', date: true },
    { k: 'data_necessidade', l: 'Necessário até', date: true },
    { k: 'forma_pagamento',  l: 'Forma de pagamento' },
    { k: 'prazo_pagamento',  l: 'Prazo de pagamento' },
    { k: 'centro_custo',     l: 'Centro de custo' },
    { k: 'valor_total_calculado', l: 'Valor total', moeda: true },
    { k: 'observacoes',      l: 'Observações', full: true },
  ],
  horas_extras: [
    { k: 'numero_solicitacao', l: 'N° Solicitação' },
    { k: 'colaborador_nome',   l: 'Colaborador' },
    { k: 'data_hora_inicio',   l: 'Início', datetime: true },
    { k: 'data_hora_fim',      l: 'Fim', datetime: true },
    { k: 'total_horas',        l: 'Total horas' },
    { k: 'data_solicitacao',   l: 'Data solicitação', date: true },
    { k: 'justificativa',      l: 'Justificativa', full: true },
    { k: 'justificativa_gestor', l: 'Parecer do gestor', full: true },
  ],
  pneus: [
    { k: 'numero_solicitacao', l: 'N° Solicitação' },
    { k: 'veiculo_id',     l: 'ID Veículo' },
    { k: 'posicao',        l: 'Posição' },
    { k: 'marca',          l: 'Marca' },
    { k: 'modelo',         l: 'Modelo' },
    { k: 'medida',         l: 'Medida' },
    { k: 'sulco_atual',    l: 'Sulco atual (mm)' },
    { k: 'data_instalacao',l: 'Data instalação', date: true },
    { k: 'km_instalacao',  l: 'KM instalação' },
    { k: 'observacoes',    l: 'Observações', full: true },
  ],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusTone(status) {
  if (STATUS_APROVADO.includes(status))  return 'success'
  if (STATUS_REJEITADO.includes(status)) return 'danger'
  if (STATUS_PENDENTE.includes(status))  return 'warning'
  return 'neutral'
}

function fmtDate(d) {
  if (!d) return null
  const p = String(d).slice(0, 10).split('-')
  return `${p[2]}/${p[1]}/${p[0]}`
}

function fmtDatetime(d) {
  if (!d) return null
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtMoeda(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function buildDetalhesResumido(s) {
  const fi = s.full_item || {}
  const out = []
  if (fi.valor_estimado != null) out.push(`Valor: ${fmtMoeda(fi.valor_estimado)}`)
  if (fi.fornecedor)             out.push(`Fornecedor: ${fi.fornecedor}`)
  if (fi.colaborador_nome)       out.push(fi.colaborador_nome)
  if (fi.litros != null)         out.push(`${fi.litros} L ${fi.tipo_combustivel || ''}`)
  if (s.resource_type === 'abastecimentos' && fi.valor_litro != null && fi.litros != null)
    out.push(`Total: ${fmtMoeda(fi.valor_litro * fi.litros)}`)
  if (fi.posicao)                out.push(`Pos: ${fi.posicao}`)
  if (fi.marca || fi.modelo)     out.push([fi.marca, fi.modelo].filter(Boolean).join(' '))
  return out.slice(0, 3)
}

const TABS = [
  { id: 'pendentes',  label: 'Pendentes' },
  { id: 'aprovadas',  label: 'Aprovadas' },
  { id: 'rejeitadas', label: 'Rejeitadas' },
  { id: 'todas',      label: 'Todas' },
  { id: 'historico',  label: 'Histórico' },
]

// ─── Modal de atendimento ─────────────────────────────────────────────────────

function ModalAtender({ solicitacao, onClose, onRefresh, podeAprovar }) {
  const [acao, setAcao]         = useState(null) // 'aprovar' | 'rejeitar'
  const [motivo, setMotivo]     = useState('')
  const [processando, setProc]  = useState(false)
  const [osGerada, setOsGerada] = useState(null)
  const [erroAcao, setErroAcao] = useState('')

  const fi    = solicitacao.full_item || {}
  const tipo  = solicitacao.resource_type
  const campos = CAMPOS_MODAL[tipo] || []

  function renderValor(campo) {
    const v = fi[campo.k]
    if (v == null || v === '') return null
    if (campo.moeda)    return fmtMoeda(v)
    if (campo.date)     return fmtDate(v)
    if (campo.datetime) return fmtDatetime(v)
    return String(v)
  }

  async function confirmar() {
    if (acao === 'rejeitar' && !motivo.trim()) {
      setErroAcao('Informe o motivo da rejeição.')
      return
    }
    setErroAcao('')
    setProc(true)
    try {
      if (acao === 'aprovar') {
        const res = await api.approveRequest(solicitacao.id, tipo, motivo)
        if (res?.numero_solicitacao) setOsGerada(res.numero_solicitacao)
        else setOsGerada(null)
      } else {
        await api.rejectRequest(solicitacao.id, tipo, motivo)
      }
      onRefresh()
      if (acao === 'rejeitar') onClose()
    } catch (err) {
      setErroAcao(err.message || 'Falha ao processar.')
    } finally {
      setProc(false)
    }
  }

  // Tela de sucesso após aprovar
  if (osGerada !== undefined && acao === 'aprovar' && !processando && osGerada !== null && erroAcao === '') {
    return (
      <div className="acomp-overlay" onClick={onClose}>
        <div className="acomp-modal" onClick={e => e.stopPropagation()}>
          <div style={{ padding: '32px 24px', textAlign: 'center', display: 'grid', gap: 16 }}>
            <div className="acomp-num-sol-grande">{osGerada}</div>
            <div>
              <strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
                Solicitação aprovada com sucesso!
              </strong>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Número de OS gerado e vinculado ao registro.
              </span>
            </div>
            <button className="button-primary" onClick={onClose} type="button">
              Fechar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="acomp-overlay" onClick={!processando ? onClose : undefined}>
      <div className="acomp-modal acomp-modal-lg" onClick={e => e.stopPropagation()}>

        {/* Cabeçalho */}
        <div className="acomp-modal-hdr">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`acomp-tipo tipo-${tipo}`}>{TIPOS[tipo] || tipo}</span>
            <span className={`status-chip tone-${statusTone(solicitacao.status)}`}>
              {STATUS_LABEL[solicitacao.status] || solicitacao.status}
            </span>
            {fi.numero_solicitacao && (
              <span className="acomp-num-sol">{fi.numero_solicitacao}</span>
            )}
          </div>
          <button type="button" className="button-secondary" onClick={onClose} disabled={processando}>✕</button>
        </div>

        <div style={{ padding: '0 16px 16px' }}>
          {/* Título */}
          <h2 style={{ margin: '12px 0 10px', fontSize: 15 }}>
            {solicitacao.titulo || `#${solicitacao.id}`}
          </h2>

          {/* Grade de campos */}
          <div className="acomp-campos-grid">
            {campos.map(campo => {
              const val = renderValor(campo)
              if (val == null) return null
              return (
                <div
                  key={campo.k}
                  className={`acomp-campo-item${campo.full ? ' acomp-campo-full' : ''}`}
                >
                  <span className="acomp-campo-label">{campo.l}</span>
                  <span className="acomp-campo-valor">{val}</span>
                </div>
              )
            })}
          </div>

          {/* Histórico de aprovação já existente */}
          {(fi.aprovado_por || fi.reprovado_por) && (
            <div className="acomp-hist-bloco">
              {fi.aprovado_por && (
                <span style={{ color: 'var(--success)', fontSize: 11 }}>
                  ✓ Aprovado por ID {fi.aprovado_por}
                  {fi.aprovado_em && ` em ${fmtDatetime(fi.aprovado_em)}`}
                </span>
              )}
              {fi.reprovado_por && (
                <span style={{ color: 'var(--danger)', fontSize: 11 }}>
                  ✗ Reprovado por ID {fi.reprovado_por}
                  {fi.reprovado_em && ` em ${fmtDatetime(fi.reprovado_em)}`}
                  {fi.motivo_reprovacao && ` — ${fi.motivo_reprovacao}`}
                </span>
              )}
            </div>
          )}

          {/* Ações — só para pendentes com permissão */}
          {STATUS_PENDENTE.includes(solicitacao.status) && podeAprovar && (
            <div className="acomp-modal-acoes">
              {acao === null ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="button-secondary acomp-btn-no"
                    style={{ flex: 1 }}
                    onClick={() => setAcao('rejeitar')}
                  >
                    Rejeitar solicitação
                  </button>
                  <button
                    type="button"
                    className="button-primary"
                    style={{ flex: 1 }}
                    onClick={() => setAcao('aprovar')}
                  >
                    Aprovar solicitação
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`status-chip tone-${acao === 'aprovar' ? 'success' : 'danger'}`}>
                      {acao === 'aprovar' ? 'Aprovando' : 'Rejeitando'}
                    </span>
                    <button
                      type="button"
                      className="button-link"
                      onClick={() => { setAcao(null); setMotivo(''); setErroAcao('') }}
                      disabled={processando}
                    >
                      ← voltar
                    </button>
                  </div>

                  <label className="field">
                    <span>
                      {acao === 'rejeitar' ? 'Motivo da rejeição (obrigatório)' : 'Comentário (opcional)'}
                    </span>
                    <textarea
                      rows={3}
                      placeholder={acao === 'rejeitar'
                        ? 'Explique o motivo da rejeição...'
                        : 'Deixe um comentário sobre esta aprovação...'}
                      value={motivo}
                      onChange={e => setMotivo(e.target.value)}
                      disabled={processando}
                      style={{ resize: 'vertical' }}
                    />
                  </label>

                  {erroAcao && <div className="alert-error">{erroAcao}</div>}

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => { setAcao(null); setMotivo(''); setErroAcao('') }}
                      disabled={processando}
                    >
                      Cancelar
                    </button>
                    {acao === 'aprovar' ? (
                      <button
                        type="button"
                        className="button-primary"
                        disabled={processando}
                        onClick={confirmar}
                      >
                        {processando ? 'Aprovando...' : 'Confirmar aprovação'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button-secondary acomp-btn-no"
                        disabled={processando || !motivo.trim()}
                        onClick={confirmar}
                        style={{ padding: '5px 14px' }}
                      >
                        {processando ? 'Rejeitando...' : 'Confirmar rejeição'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {STATUS_PENDENTE.includes(solicitacao.status) && !podeAprovar && (
            <div className="alert-warn" style={{ marginTop: 12 }}>
              Você não tem permissão para aprovar este tipo de solicitação.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AcompanhamentoPage() {
  const [solicitacoes, setSolicitacoes] = useState([])
  const [historico, setHistorico]       = useState([])
  const [permissoes, setPermissoes]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [erro, setErro]                 = useState('')
  const [aba, setAba]                   = useState('pendentes')
  const [fTipo, setFTipo]               = useState('')
  const [fBusca, setFBusca]             = useState('')
  const [atendendo, setAtendendo]       = useState(null)

  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 30000)
    return () => clearInterval(t)
  }, [])

  async function carregar() {
    try {
      setLoading(true)
      setErro('')
      const [meRes, apRes, histRes] = await Promise.all([
        api.getProfile().catch(() => ({})),
        api.getApprovals({ limit: 500, status: 'all' }),
        api.getApprovalsHistory({ days: 30, limit: 100 }),
      ])
      setPermissoes(meRes?.permission_scopes || meRes?.permissions || [])
      setSolicitacoes(apRes.items || [])
      setHistorico(histRes.items || [])
    } catch (err) {
      setErro('Falha ao carregar solicitações.')
    } finally {
      setLoading(false)
    }
  }

  function podeAprovar(resourceType) {
    if (!permissoes) return false
    if (Array.isArray(permissoes)) {
      return (
        permissoes.includes('admin') ||
        permissoes.includes(`aprovar.${resourceType}`) ||
        (permissoes.includes('menu.pedidos_compra') && resourceType === 'pedidos_compra')
      )
    }
    return Boolean(permissoes.edit || permissoes[`aprovar.${resourceType}`])
  }

  const stats = useMemo(() => ({
    pendentes:  solicitacoes.filter(s => STATUS_PENDENTE.includes(s.status)).length,
    aprovadas:  solicitacoes.filter(s => STATUS_APROVADO.includes(s.status)).length,
    rejeitadas: solicitacoes.filter(s => STATUS_REJEITADO.includes(s.status)).length,
    total:      solicitacoes.length,
  }), [solicitacoes])

  const filtrada = useMemo(() => {
    let lista = solicitacoes
    if (aba === 'pendentes')  lista = lista.filter(s => STATUS_PENDENTE.includes(s.status))
    if (aba === 'aprovadas')  lista = lista.filter(s => STATUS_APROVADO.includes(s.status))
    if (aba === 'rejeitadas') lista = lista.filter(s => STATUS_REJEITADO.includes(s.status))
    if (fTipo) lista = lista.filter(s => s.resource_type === fTipo)
    const q = fBusca.trim().toLowerCase()
    if (q) lista = lista.filter(s =>
      [s.titulo, s.resource_type].filter(Boolean).some(v => String(v).toLowerCase().includes(q))
    )
    return lista
  }, [solicitacoes, aba, fTipo, fBusca])

  const histFiltrado = useMemo(() => {
    const q = fBusca.trim().toLowerCase()
    if (!q) return historico
    return historico.filter(h =>
      [h.recurso, h.nome_colaborador].filter(Boolean).some(v => String(v).toLowerCase().includes(q))
    )
  }, [historico, fBusca])

  return (
    <section className="page-shell">
      {/* Cabeçalho */}
      <div className="page-header">
        <div>
          <span className="eyebrow">Gestão</span>
          <h1>Acompanhamento de Aprovações</h1>
          <p>Visualize e gerencie aprovações de manutenções, horas extras, compras e outros recursos.</p>
        </div>
        <button className="button-secondary" onClick={carregar} type="button" disabled={loading}>
          {loading ? 'Carregando...' : '↻ Atualizar'}
        </button>
      </div>

      {/* KPIs clicáveis */}
      <div className="stats-grid">
        {[
          { label: 'Pendentes',  value: stats.pendentes,  tone: 'warning', tab: 'pendentes' },
          { label: 'Aprovadas',  value: stats.aprovadas,  tone: 'success', tab: 'aprovadas' },
          { label: 'Rejeitadas', value: stats.rejeitadas, tone: 'danger',  tab: 'rejeitadas' },
          { label: 'Total',      value: stats.total,      tone: 'neutral', tab: 'todas' },
        ].map(({ label, value, tone, tab }) => (
          <button
            key={tab}
            type="button"
            className={`surface-card stat-card acomp-kpi tone-${tone}${aba === tab ? ' is-active' : ''}`}
            onClick={() => setAba(tab)}
          >
            <span>{label}</span>
            <strong>{value}</strong>
          </button>
        ))}
      </div>

      {/* Tabs + filtros */}
      <div className="surface-card" style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              className={`button-secondary${aba === t.id ? ' active' : ''}`}
              onClick={() => setAba(t.id)}
            >
              {t.label}
              {t.id === 'pendentes' && stats.pendentes > 0 && (
                <span className="acomp-count-badge">{stats.pendentes}</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          <label className="field filter-field">
            <span>Tipo</span>
            <select value={fTipo} onChange={e => setFTipo(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(TIPOS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="field filter-field" style={{ gridColumn: 'span 3' }}>
            <span>Buscar</span>
            <input
              type="text"
              placeholder="Título, tipo, colaborador..."
              value={fBusca}
              onChange={e => setFBusca(e.target.value)}
            />
          </label>
        </div>
      </div>

      {erro && <div className="alert-error">{erro}</div>}

      {/* Tabela principal */}
      {aba !== 'historico' ? (
        <div className="surface-card">
          {loading ? (
            <div className="empty-state">Carregando solicitações...</div>
          ) : filtrada.length === 0 ? (
            <div className="empty-state">
              <strong>Nenhuma solicitação encontrada.</strong>
              <p>Tente ajustar os filtros ou aguarde novos registros.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="acomp-table">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>Tipo</th>
                    <th style={{ width: 100 }}>N° Solicitação</th>
                    <th>Título / Descrição</th>
                    <th style={{ width: 150 }}>Detalhes</th>
                    <th style={{ width: 90 }}>Data</th>
                    <th style={{ width: 120 }}>Status</th>
                    <th style={{ width: 100 }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrada.map(s => {
                    const detalhes = buildDetalhesResumido(s)
                    const numOs    = s.full_item?.numero_solicitacao
                    return (
                      <tr key={`${s.resource_type}-${s.id}`} className="acomp-row">
                        <td>
                          <span className={`acomp-tipo tipo-${s.resource_type}`}>
                            {TIPOS[s.resource_type] || s.resource_type}
                          </span>
                        </td>
                        <td>
                          {numOs
                            ? <span className="acomp-num-sol">{numOs}</span>
                            : <span style={{ color: 'var(--muted)' }}>—</span>
                          }
                        </td>
                        <td>
                          <strong style={{ fontSize: 11 }}>{s.titulo || `#${s.id}`}</strong>
                          {(s.detalhes?.aprovado_por || s.detalhes?.reprovado_por) && (
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                              {s.detalhes.aprovado_por && `Aprovado por: ${s.detalhes.aprovado_por}`}
                              {s.detalhes.reprovado_por && `Rejeitado: ${s.detalhes.motivo_reprovacao || ''}`}
                            </div>
                          )}
                        </td>
                        <td>
                          {detalhes.length > 0 ? (
                            <div className="acomp-detalhes">
                              {detalhes.map((d, i) => (
                                <span key={i} className="acomp-detalhe-item">{d}</span>
                              ))}
                            </div>
                          ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: 11 }}>
                          {fmtDate(s.data_criacao)}
                        </td>
                        <td>
                          <span className={`status-chip tone-${statusTone(s.status)}`}>
                            {STATUS_LABEL[s.status] || s.status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`button-secondary acomp-btn-atender${
                              STATUS_PENDENTE.includes(s.status) ? ' acomp-btn-atender-pendente' : ''
                            }`}
                            onClick={() => setAtendendo(s)}
                          >
                            Atender
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Tab Histórico */
        <div className="surface-card">
          {loading ? (
            <div className="empty-state">Carregando histórico...</div>
          ) : histFiltrado.length === 0 ? (
            <div className="empty-state">Nenhum registro nos últimos 30 dias.</div>
          ) : (
            <div className="table-wrap">
              <table className="acomp-table">
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>Tipo</th>
                    <th>Recurso</th>
                    <th style={{ width: 90 }}>Decisão</th>
                    <th style={{ width: 150 }}>Responsável</th>
                    <th style={{ width: 120 }}>Data/Hora</th>
                    <th>Comentário</th>
                  </tr>
                </thead>
                <tbody>
                  {histFiltrado.map((h, idx) => {
                    const tipo     = h.recurso?.split(':')[0] || ''
                    const aprovado = h.acao === 'approve'
                    return (
                      <tr key={h.id || idx} className="acomp-row">
                        <td>
                          <span className={`acomp-tipo tipo-${tipo}`}>
                            {TIPOS[tipo] || tipo || '—'}
                          </span>
                        </td>
                        <td style={{ fontSize: 11 }}>{h.recurso || '—'}</td>
                        <td>
                          <span className={`status-chip tone-${aprovado ? 'success' : 'danger'}`}>
                            {aprovado ? 'Aprovado' : 'Rejeitado'}
                          </span>
                        </td>
                        <td style={{ fontSize: 11 }}>{h.nome_colaborador || '—'}</td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 11, color: 'var(--muted)' }}>
                          {fmtDatetime(h.criado_em)}
                        </td>
                        <td style={{ fontSize: 10, color: 'var(--muted)' }}>
                          {h.detalhes?.comentario || h.detalhes?.motivo || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de atendimento */}
      {atendendo && (
        <ModalAtender
          solicitacao={atendendo}
          onClose={() => setAtendendo(null)}
          onRefresh={carregar}
          podeAprovar={podeAprovar(atendendo.resource_type)}
        />
      )}
    </section>
  )
}

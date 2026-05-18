import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v) {
  if (!v) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
}

function fmtDate(v) {
  if (!v) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(v))
  } catch { return '—' }
}

function fmtDateOnly(v) {
  if (!v) return '—'
  try { return new Intl.DateTimeFormat('pt-BR').format(new Date(v + 'T00:00:00')) } catch { return '—' }
}

const STATUS_LABEL = {
  rascunho: 'Rascunho',
  pendente_aprovacao: 'Pendente',
  em_analise: 'Em Análise',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  cancelado: 'Cancelado',
  em_compra: 'Em Compra',
  recebido: 'Recebido',
}

const STATUS_TONE = {
  rascunho: 'neutral',
  pendente_aprovacao: 'warning',
  em_analise: 'info',
  aprovado: 'success',
  reprovado: 'danger',
  cancelado: 'neutral',
  em_compra: 'info',
  recebido: 'success',
}

const FORMA_LABEL = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao_debito: 'Cartão Débito',
  cartao_credito: 'Cartão Crédito',
  boleto: 'Boleto',
  credito_fornecedor: 'Crédito Fornecedor',
}

const REEMBOLSO_LABEL = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  cartao: 'Cartão',
  nenhum: 'Nenhum',
}

// ─── Badge de Status ─────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const tone = STATUS_TONE[status] || 'neutral'
  const label = STATUS_LABEL[status] || status
  return (
    <span className={`badge badge--${tone}`} style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 12 }}>
      {label}
    </span>
  )
}

// ─── Modal de detalhe + ações ────────────────────────────────────────────────

function DetalheModal({ pedido, onClose, onAction, actionLoading, podeAnalisar, podeAprovar }) {
  const [motivo, setMotivo] = useState('')
  const [showMotivo, setShowMotivo] = useState(false)

  const isEtapa1 = ['pendente_aprovacao', 'pendente'].includes(pedido.status)
  const isEtapa2 = ['em_analise', 'analise'].includes(pedido.status)
  const canAnalise  = isEtapa1 && podeAnalisar
  const canAprovar  = isEtapa2 && podeAprovar
  const canReprovar = canAnalise || canAprovar

  function handleReprovar() {
    if (!motivo.trim()) { alert('Informe o motivo da reprovação.'); return }
    onAction('reprovar', pedido, motivo)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface-card, #1e2330)', borderRadius: 12,
          padding: 28, maxWidth: 640, width: '100%', maxHeight: '90vh',
          overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Pedido de Compra
            </p>
            <h2 style={{ margin: '2px 0 6px', fontSize: '1.15rem' }}>
              {pedido.numero_pedido || `#${pedido.id}`}
              {pedido.numero_solicitacao && (
                <span style={{ marginLeft: 10, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Sol. {pedido.numero_solicitacao}
                </span>
              )}
            </h2>
            <StatusBadge status={pedido.status} />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* Dados principais */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', marginBottom: 16 }}>
          {[
            ['Fornecedor', pedido.fornecedor || '—'],
            ['Valor total', fmt(pedido.valor_total_calculado ?? pedido.valor_total)],
            ['Data do pedido', fmtDateOnly(pedido.data_pedido)],
            ['Precisa até', fmtDateOnly(pedido.data_necessidade)],
            ['Forma de pagamento', FORMA_LABEL[pedido.forma_pagamento] || pedido.forma_pagamento || '—'],
            pedido.prazo_pagamento && ['Prazo pagamento', pedido.prazo_pagamento],
            pedido.centro_custo && ['Centro de custo', pedido.centro_custo],
            pedido.tipo_reembolso && ['Tipo de reembolso', REEMBOLSO_LABEL[pedido.tipo_reembolso] || pedido.tipo_reembolso],
            pedido.chave_pix && ['Chave PIX', pedido.chave_pix],
            pedido.dados_bancarios && ['Dados bancários', pedido.dados_bancarios],
          ].filter(Boolean).map(([label, value]) => (
            <div key={label}>
              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</p>
              <p style={{ margin: '2px 0 0', fontWeight: 500, fontSize: '0.9rem', wordBreak: 'break-all' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Itens do pedido */}
        {Array.isArray(pedido.itens) && pedido.itens.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 8px', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Itens ({pedido.itens.length})
            </p>
            <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-card-2, rgba(255,255,255,0.04))' }}>
                    {['Descrição', 'Cat.', 'Qtd', 'Un', 'Valor unit.', 'Total'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Descrição' || h === 'Cat.' ? 'left' : 'right', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pedido.itens.map((it, i) => {
                    const tot = (parseFloat(it.quantidade) || 0) * (parseFloat(it.valor_unitario) || 0)
                    return (
                      <tr key={it.id || i} style={{ borderTop: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
                        <td style={{ padding: '5px 10px' }}>{it.descricao}</td>
                        <td style={{ padding: '5px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{it.categoria}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right' }}>{it.quantidade}</td>
                        <td style={{ padding: '5px 6px', color: 'var(--text-muted)' }}>{it.unidade}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmt(it.valor_unitario)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 600 }}>{fmt(tot)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border, rgba(255,255,255,0.12))' }}>
                    <td colSpan={5} style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>Total:</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, color: '#51cf66' }}>
                      {fmt(pedido.valor_total_calculado ?? pedido.valor_total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {pedido.observacoes && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--surface-card-2, rgba(255,255,255,0.04))', borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Observações</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.88rem' }}>{pedido.observacoes}</p>
          </div>
        )}

        {/* Rastreio de aprovação */}
        {(pedido.em_analise_por_nome || pedido.aprovado_por_nome || pedido.reprovado_por_nome) && (
          <div style={{ marginBottom: 16, borderTop: '1px solid var(--border, rgba(255,255,255,0.08))', paddingTop: 14 }}>
            <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Histórico de aprovação</p>
            {pedido.em_analise_por_nome && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1rem' }}>🔍</span>
                <div>
                  <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Em análise por {pedido.em_analise_por_nome}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(pedido.em_analise_em)}</p>
                </div>
              </div>
            )}
            {pedido.aprovado_por_nome && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1rem' }}>✅</span>
                <div>
                  <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Aprovado por {pedido.aprovado_por_nome}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(pedido.aprovado_em)}</p>
                </div>
              </div>
            )}
            {pedido.reprovado_por_nome && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1rem' }}>❌</span>
                <div>
                  <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Reprovado por {pedido.reprovado_por_nome}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(pedido.reprovado_em)}</p>
                  {pedido.motivo_reprovacao && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#ff6b6b', fontStyle: 'italic' }}>
                      "{pedido.motivo_reprovacao}"
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contas a pagar vinculado */}
        {pedido.contas_pagar_id && (
          <div style={{ marginBottom: 16, padding: '8px 14px', background: 'rgba(81,207,102,0.08)', borderRadius: 8, border: '1px solid rgba(81,207,102,0.2)' }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#51cf66' }}>
              ✅ Conta a pagar gerada automaticamente (ID #{pedido.contas_pagar_id})
            </p>
          </div>
        )}

        {/* Ações */}
        {(canAnalise || canAprovar || canReprovar) && (
          <div style={{ borderTop: '1px solid var(--border, rgba(255,255,255,0.08))', paddingTop: 18, marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: showMotivo ? 14 : 0 }}>
              {canAnalise && (
                <button
                  className="btn btn--neutral"
                  onClick={() => onAction('em_analise', pedido)}
                  disabled={actionLoading}
                  style={{ fontSize: '0.85rem' }}
                >
                  🔍 Iniciar Análise
                </button>
              )}
              {canAprovar && (
                <button
                  className="btn btn--primary"
                  onClick={() => onAction('aprovar', pedido)}
                  disabled={actionLoading}
                  style={{ fontSize: '0.85rem' }}
                >
                  ✅ Aprovar
                </button>
              )}
              {canReprovar && (
                <button
                  className="btn btn--danger"
                  onClick={() => setShowMotivo(v => !v)}
                  disabled={actionLoading}
                  style={{ fontSize: '0.85rem' }}
                >
                  ❌ Reprovar
                </button>
              )}
            </div>
            {showMotivo && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input
                  className="field-input"
                  placeholder="Motivo da reprovação (obrigatório)"
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  style={{ flex: 1, fontSize: '0.88rem' }}
                />
                <button
                  className="btn btn--danger"
                  onClick={handleReprovar}
                  disabled={actionLoading || !motivo.trim()}
                  style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                >
                  Confirmar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Card de pedido na lista ─────────────────────────────────────────────────

function PedidoCard({ pedido, onOpen }) {
  return (
    <div
      onClick={() => onOpen(pedido)}
      style={{
        padding: '14px 18px', borderRadius: 10, cursor: 'pointer',
        background: 'var(--surface-card, #1e2330)',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent, #4a90e2)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border, rgba(255,255,255,0.08))')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>
            {pedido.numero_pedido || `Pedido #${pedido.id}`}
          </p>
          {pedido.numero_solicitacao && (
            <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Sol. {pedido.numero_solicitacao}
            </p>
          )}
        </div>
        <StatusBadge status={pedido.status} />
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        <span>{pedido.fornecedor || 'Fornecedor não informado'}</span>
        <span style={{ fontWeight: 600, color: 'var(--text)', marginLeft: 'auto' }}>{fmt(pedido.valor_total_calculado ?? pedido.valor_total)}</span>
      </div>
      {pedido.data_pedido && (
        <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {fmtDateOnly(pedido.data_pedido)}
          {pedido.data_necessidade && ` · precisa até ${fmtDateOnly(pedido.data_necessidade)}`}
        </p>
      )}
      {pedido.motivo_reprovacao && (
        <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#ff6b6b', fontStyle: 'italic' }}>
          Motivo: "{pedido.motivo_reprovacao}"
        </p>
      )}
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────

const TABS = [
  { id: 'pendente', label: 'Pendentes', statuses: ['pendente_aprovacao'] },
  { id: 'em_analise', label: 'Em Análise', statuses: ['em_analise'] },
  { id: 'aprovado', label: 'Aprovados', statuses: ['aprovado'] },
  { id: 'reprovado', label: 'Reprovados', statuses: ['reprovado'] },
  { id: 'todos', label: 'Todos', statuses: null },
]

export default function AprovacoesPage() {
  const { profile } = useAuth()
  const _perms = profile?.permission_scopes || []
  const _isAdmin = _perms.includes('admin')
  const podeAnalisar = _isAdmin || _perms.includes('analisar.pedidos_compra')
  const podeAprovar  = _isAdmin || _perms.includes('aprovar.pedidos_compra')
  const [pedidos, setPedidos] = useState([])
  const [colaboradores, setColaboradores] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('pendente')
  const [selected, setSelected] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const _loaded = useRef(false)

  async function openModal(pedido) {
    setSelected(pedido)
    try {
      const det = await api.getPedidoDetalhes(pedido.id)
      setSelected(prev => prev?.id === pedido.id ? { ...prev, itens: det.itens || [] } : prev)
    } catch (_) {}
  }

  const load = useCallback(async () => {
    try {
      if (!_loaded.current) setLoading(true)
      setError('')

      const [pedidosResp, colabsResp] = await Promise.all([
        api.list('pedidos_compra', { ativo: 'true', per_page: 200 }),
        api.list('colaboradores', {}),
      ])

      const pedidosData = Array.isArray(pedidosResp) ? pedidosResp : (pedidosResp?.data || [])
      const colabsData = Array.isArray(colabsResp) ? colabsResp : (colabsResp?.data || [])

      const colabMap = {}
      for (const c of colabsData) {
        if (c.id) colabMap[c.id] = c.nome_completo
      }
      setColaboradores(colabMap)

      // Enriquece com nomes dos colaboradores
      const enriched = pedidosData.map(p => ({
        ...p,
        em_analise_por_nome: p.em_analise_por ? (colabMap[p.em_analise_por] || `#${p.em_analise_por}`) : null,
        aprovado_por_nome: p.aprovado_por ? (colabMap[p.aprovado_por] || `#${p.aprovado_por}`) : null,
        reprovado_por_nome: p.reprovado_por ? (colabMap[p.reprovado_por] || `#${p.reprovado_por}`) : null,
      }))

      setPedidos(enriched)
    } catch (err) {
      console.error(err)
      setError('Falha ao carregar aprovações.')
    } finally {
      _loaded.current = true
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAction(action, pedido, motivo = '') {
    setActionLoading(true)
    setFeedback('')
    try {
      if (action === 'em_analise') {
        await api.emAnalise(pedido.id)
        setFeedback('Pedido marcado como em análise.')
      } else if (action === 'aprovar') {
        await api.aprovacaoAprovar(pedido.id, 'pedidos_compra')
        setFeedback('Pedido aprovado! Conta a pagar gerada automaticamente.')
      } else if (action === 'reprovar') {
        await api.aprovacaoReprovar(pedido.id, 'pedidos_compra', motivo)
        setFeedback('Pedido reprovado.')
      }
      setSelected(null)
      await load()
    } catch (err) {
      alert(`Erro: ${err.message || 'Falha na operação.'}`)
    } finally {
      setActionLoading(false)
    }
  }

  const tabData = TABS.find(t => t.id === activeTab)
  const filtered = tabData?.statuses
    ? pedidos.filter(p => tabData.statuses.includes(p.status))
    : pedidos

  const counts = {}
  for (const t of TABS) {
    counts[t.id] = t.statuses
      ? pedidos.filter(p => t.statuses.includes(p.status)).length
      : pedidos.length
  }

  if (loading) {
    return (
      <section className="page-shell">
        <div className="page-header"><div><h1>Aprovações</h1></div></div>
        <p style={{ padding: 24, color: 'var(--text-muted)' }}>Carregando...</p>
      </section>
    )
  }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Compras</span>
          <h1>Aprovações de Pedidos</h1>
          <p>Fluxo: Pendente → Em Análise → Aprovado → Conta a Pagar gerada automaticamente</p>
        </div>
        <button className="btn btn--ghost" onClick={load} style={{ fontSize: '0.85rem' }}>
          ↺ Atualizar
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 16px', background: 'rgba(255,107,107,0.12)', borderRadius: 8, marginBottom: 16, color: '#ff6b6b' }}>
          {error}
        </div>
      )}

      {feedback && (
        <div style={{ padding: '10px 16px', background: 'rgba(81,207,102,0.12)', borderRadius: 8, marginBottom: 16, color: '#51cf66' }}>
          {feedback}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: '0.83rem', fontWeight: 600, transition: 'all 0.15s',
              background: activeTab === t.id ? 'var(--accent, #4a90e2)' : 'var(--surface-card, #1e2330)',
              color: activeTab === t.id ? '#fff' : 'var(--text-muted)',
            }}
          >
            {t.label}
            {counts[t.id] > 0 && (
              <span style={{
                marginLeft: 6, background: activeTab === t.id ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '1px 6px', fontSize: '0.72rem',
              }}>
                {counts[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Resumo numérico */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Pendentes', count: counts.pendente, color: '#ffd43b' },
          { label: 'Em Análise', count: counts.em_analise, color: '#74c0fc' },
          { label: 'Aprovados', count: counts.aprovado, color: '#51cf66' },
          { label: 'Reprovados', count: counts.reprovado, color: '#ff6b6b' },
        ].map(({ label, count, color }) => (
          <div key={label} style={{
            padding: '10px 18px', borderRadius: 10, background: 'var(--surface-card, #1e2330)',
            border: `1px solid ${color}33`, minWidth: 100, textAlign: 'center',
          }}>
            <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color }}>{count}</p>
            <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="surface-card empty-state">
          <p>Nenhum pedido {tabData?.label?.toLowerCase() || ''} encontrado.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(p => (
            <PedidoCard key={p.id} pedido={p} onOpen={openModal} />
          ))}
        </div>
      )}

      {/* Modal */}
      {selected && (
        <DetalheModal
          pedido={selected}
          onClose={() => setSelected(null)}
          onAction={handleAction}
          actionLoading={actionLoading}
          podeAnalisar={podeAnalisar}
          podeAprovar={podeAprovar}
        />
      )}
    </section>
  )
}

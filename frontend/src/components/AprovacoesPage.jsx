import { useEffect, useState } from 'react'
import { api } from '../services/api'
import '../styles/approvals.css'

export default function AprovacoesPage() {
  const [approvals, setApprovals] = useState({
    pending: [],
    approved: [],
    rejected: [],
    inProgress: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedApproval, setSelectedApproval] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [actionInProgress, setActionInProgress] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [activeTab, setActiveTab] = useState('pending')
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    loadApprovals()
  }, [filterType])

  async function loadApprovals() {
    try {
      setLoading(true)
      setError('')

      // Buscar dados de múltiplas tabelas em paralelo
      const [manutencoes, pedidos, pneus, horasExtras] = await Promise.all([
        api.get('/api/manutencoes?ativo=true'),
        api.get('/api/pedidos_compra?ativo=true'),
        api.get('/api/veiculos_pneus?ativo=true'),
        api.get('/api/horas_extras'),
      ])

      // Agrupar por status
      const pending = []
      const approved = []
      const rejected = []
      const inProgress = []

      // Processar Manutenções
      if (manutencoes?.data) {
        manutencoes.data.forEach((m) => {
          if (m.status === 'aguardando_aprovacao') {
            pending.push({
              id: m.id,
              type: 'manutencao',
              numero: `MAN-${String(m.id).padStart(6, '0')}`,
              descricao: m.titulo,
              valor: m.valor_estimado || 0,
              prioridade: m.prioridade,
              data_criacao: m.data_abertura,
              solicitado_por: m.solicitado_por,
              veiculo: m.veiculo?.placa || `Veículo #${m.veiculo_id}`,
              observacoes: m.descricao,
              detalhes: m,
            })
          } else if (m.status === 'aprovada') {
            approved.push({
              id: m.id,
              type: 'manutencao',
              numero: `MAN-${String(m.id).padStart(6, '0')}`,
              descricao: m.titulo,
              valor: m.valor_estimado || 0,
              data_acao: m.aprovado_em,
              aprovado_por: m.aprovado_por,
            })
          } else if (m.status === 'reprovada') {
            rejected.push({
              id: m.id,
              type: 'manutencao',
              numero: `MAN-${String(m.id).padStart(6, '0')}`,
              descricao: m.titulo,
              valor: m.valor_estimado || 0,
              motivo: m.motivo_reprovacao,
              data_acao: m.reprovado_em,
              rejeitado_por: m.reprovado_por,
            })
          } else if (m.status === 'em_execucao') {
            inProgress.push({
              id: m.id,
              type: 'manutencao',
              numero: `MAN-${String(m.id).padStart(6, '0')}`,
              descricao: m.titulo,
              valor: m.valor_estimado || 0,
              prioridade: m.prioridade,
              data_criacao: m.data_inicio,
              veiculo: m.veiculo?.placa || `Veículo #${m.veiculo_id}`,
            })
          }
        })
      }

      // Processar Pedidos de Compra
      if (pedidos?.data) {
        pedidos.data.forEach((pc) => {
          if (pc.status === 'aguardando_aprovacao') {
            pending.push({
              id: pc.id,
              type: 'pedido_compra',
              numero: pc.numero_pedido,
              descricao: `Compra de ${pc.pedidos_compra_itens?.length || 0} itens`,
              valor: pc.valor_total || 0,
              prioridade: 'normal',
              data_criacao: pc.data_pedido,
              solicitado_por: pc.criado_por,
              fornecedor: pc.fornecedor,
              observacoes: pc.observacoes,
              detalhes: pc,
            })
          } else if (pc.status === 'aprovado') {
            approved.push({
              id: pc.id,
              type: 'pedido_compra',
              numero: pc.numero_pedido,
              descricao: `Compra de ${pc.pedidos_compra_itens?.length || 0} itens`,
              valor: pc.valor_total || 0,
              data_acao: pc.data_pedido,
              aprovado_por: 'Sistema',
            })
          } else if (pc.status === 'reprovado') {
            rejected.push({
              id: pc.id,
              type: 'pedido_compra',
              numero: pc.numero_pedido,
              descricao: `Compra de ${pc.pedidos_compra_itens?.length || 0} itens`,
              valor: pc.valor_total || 0,
              motivo: 'Não informado',
              data_acao: pc.data_pedido,
            })
          }
        })
      }

      setApprovals({
        pending: filterType === 'all' ? pending : pending.filter((a) => a.type === filterType),
        approved: filterType === 'all' ? approved : approved.filter((a) => a.type === filterType),
        rejected: filterType === 'all' ? rejected : rejected.filter((a) => a.type === filterType),
        inProgress: filterType === 'all' ? inProgress : inProgress.filter((a) => a.type === filterType),
      })
    } catch (err) {
      console.error('Erro ao carregar aprovações:', err)
      setError('Falha ao carregar solicitações. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(approval) {
    if (!window.confirm(`Tem certeza que deseja aprovar ${approval.numero}?`)) return

    try {
      setActionInProgress(true)
      if (approval.type === 'manutencao') {
        await api.patch(`/api/manutencoes/${approval.id}`, {
          status: 'aprovada',
        })
      } else if (approval.type === 'pedido_compra') {
        await api.patch(`/api/pedidos_compra/${approval.id}`, {
          status: 'aprovado',
        })
      }
      setShowModal(false)
      loadApprovals()
    } catch (err) {
      alert(`Erro ao aprovar: ${err.message}`)
    } finally {
      setActionInProgress(false)
    }
  }

  async function handleReject(approval) {
    if (!rejectionReason.trim()) {
      alert('Informe o motivo da rejeição')
      return
    }

    if (!window.confirm(`Tem certeza que deseja rejeitar ${approval.numero}?`)) return

    try {
      setActionInProgress(true)
      if (approval.type === 'manutencao') {
        await api.patch(`/api/manutencoes/${approval.id}`, {
          status: 'reprovada',
          motivo_reprovacao: rejectionReason,
        })
      } else if (approval.type === 'pedido_compra') {
        await api.patch(`/api/pedidos_compra/${approval.id}`, {
          status: 'reprovado',
        })
      }
      setShowModal(false)
      setRejectionReason('')
      loadApprovals()
    } catch (err) {
      alert(`Erro ao rejeitar: ${err.message}`)
    } finally {
      setActionInProgress(false)
    }
  }

  function getStatusBadge(status) {
    const badges = {
      pending: { color: '#ff6b6b', label: '🔴 Pendente' },
      approved: { color: '#51cf66', label: '✅ Aprovado' },
      rejected: { color: '#ff6b6b', label: '❌ Reprovado' },
      inProgress: { color: '#ffd43b', label: '⚙️ Em Execução' },
    }
    return badges[status] || badges.pending
  }

  function getPriorityColor(prioridade) {
    const colors = {
      baixa: '#95a5a6',
      normal: '#3498db',
      alta: '#f39c12',
      critica: '#e74c3c',
    }
    return colors[prioridade?.toLowerCase()] || colors.normal
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(value || 0))
  }

  function formatDate(dateString) {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  if (loading) {
    return (
      <div className="approvals-page">
        <h1>⏳ Carregando aprovações...</h1>
      </div>
    )
  }

  return (
    <div className="approvals-page">
      <div className="approvals-header">
        <h1>📋 Acompanhamento de Solicitações</h1>
        <p>Gerencie aprovações de manutenções, compras e solicitações</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="approvals-controls">
        <div className="filter-group">
          <label>Filtrar por tipo:</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">Todos os tipos</option>
            <option value="manutencao">Manutenções</option>
            <option value="pedido_compra">Pedidos de Compra</option>
          </select>
        </div>
      </div>

      <div className="approvals-tabs">
        <button
          className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          🔴 Pendentes ({approvals.pending.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'inProgress' ? 'active' : ''}`}
          onClick={() => setActiveTab('inProgress')}
        >
          ⚙️ Em Execução ({approvals.inProgress.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'approved' ? 'active' : ''}`}
          onClick={() => setActiveTab('approved')}
        >
          ✅ Aprovadas ({approvals.approved.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'rejected' ? 'active' : ''}`}
          onClick={() => setActiveTab('rejected')}
        >
          ❌ Rejeitadas ({approvals.rejected.length})
        </button>
      </div>

      <div className="approvals-content">
        {activeTab === 'pending' && (
          <div className="approval-section">
            {approvals.pending.length === 0 ? (
              <div className="empty-state">
                <p>✅ Nenhuma solicitação pendente de aprovação!</p>
              </div>
            ) : (
              <div className="approval-list">
                {approvals.pending.map((approval) => (
                  <div key={`${approval.type}-${approval.id}`} className="approval-card">
                    <div className="approval-header">
                      <div className="approval-title">
                        <h3>{approval.numero}</h3>
                        <span className="type-badge">{approval.type === 'manutencao' ? '🔧 Manutenção' : '📦 Compra'}</span>
                        {approval.prioridade && (
                          <span
                            className="priority-badge"
                            style={{ backgroundColor: getPriorityColor(approval.prioridade) }}
                          >
                            {approval.prioridade?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="approval-value">{formatCurrency(approval.valor)}</div>
                    </div>

                    <div className="approval-details">
                      <p className="descricao">{approval.descricao}</p>
                      {approval.veiculo && <p className="veiculo">🚛 {approval.veiculo}</p>}
                      {approval.fornecedor && <p className="fornecedor">🏭 {approval.fornecedor}</p>}
                      <p className="data">📅 {formatDate(approval.data_criacao)}</p>
                      {approval.observacoes && <p className="obs">{approval.observacoes}</p>}
                    </div>

                    <div className="approval-actions">
                      <button
                        className="btn-primary"
                        onClick={() => {
                          setSelectedApproval(approval)
                          setShowModal(true)
                          setRejectionReason('')
                        }}
                      >
                        👁️ Ver Detalhes
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'inProgress' && (
          <div className="approval-section">
            {approvals.inProgress.length === 0 ? (
              <div className="empty-state">
                <p>Nenhuma solicitação em execução</p>
              </div>
            ) : (
              <div className="approval-list">
                {approvals.inProgress.map((approval) => (
                  <div key={`${approval.type}-${approval.id}`} className="approval-card in-progress">
                    <div className="approval-header">
                      <div className="approval-title">
                        <h3>{approval.numero}</h3>
                        <span className="status-badge">⚙️ Em Execução</span>
                      </div>
                      <div className="approval-value">{formatCurrency(approval.valor)}</div>
                    </div>

                    <div className="approval-details">
                      <p className="descricao">{approval.descricao}</p>
                      {approval.veiculo && <p className="veiculo">🚛 {approval.veiculo}</p>}
                      <p className="data">📅 Iniciado em {formatDate(approval.data_criacao)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'approved' && (
          <div className="approval-section">
            {approvals.approved.length === 0 ? (
              <div className="empty-state">
                <p>Nenhuma solicitação aprovada</p>
              </div>
            ) : (
              <div className="approval-list">
                {approvals.approved.map((approval) => (
                  <div key={`${approval.type}-${approval.id}`} className="approval-card approved">
                    <div className="approval-header">
                      <div className="approval-title">
                        <h3>{approval.numero}</h3>
                        <span className="status-badge" style={{ backgroundColor: '#51cf66' }}>
                          ✅ Aprovado
                        </span>
                      </div>
                      <div className="approval-value">{formatCurrency(approval.valor)}</div>
                    </div>

                    <div className="approval-details">
                      <p className="descricao">{approval.descricao}</p>
                      <p className="data">✅ Aprovado em {formatDate(approval.data_acao)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'rejected' && (
          <div className="approval-section">
            {approvals.rejected.length === 0 ? (
              <div className="empty-state">
                <p>Nenhuma solicitação rejeitada</p>
              </div>
            ) : (
              <div className="approval-list">
                {approvals.rejected.map((approval) => (
                  <div key={`${approval.type}-${approval.id}`} className="approval-card rejected">
                    <div className="approval-header">
                      <div className="approval-title">
                        <h3>{approval.numero}</h3>
                        <span className="status-badge" style={{ backgroundColor: '#ff6b6b' }}>
                          ❌ Rejeitado
                        </span>
                      </div>
                      <div className="approval-value">{formatCurrency(approval.valor)}</div>
                    </div>

                    <div className="approval-details">
                      <p className="descricao">{approval.descricao}</p>
                      {approval.motivo && <p className="motivo">📝 Motivo: {approval.motivo}</p>}
                      <p className="data">❌ Rejeitado em {formatDate(approval.data_acao)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && selectedApproval && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedApproval.numero}</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-group">
                <label>Tipo:</label>
                <p>{selectedApproval.type === 'manutencao' ? '🔧 Manutenção' : '📦 Pedido de Compra'}</p>
              </div>

              <div className="detail-group">
                <label>Descrição:</label>
                <p>{selectedApproval.descricao}</p>
              </div>

              <div className="detail-group">
                <label>Valor:</label>
                <p style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#2ecc71' }}>
                  {formatCurrency(selectedApproval.valor)}
                </p>
              </div>

              {selectedApproval.veiculo && (
                <div className="detail-group">
                  <label>Veículo:</label>
                  <p>{selectedApproval.veiculo}</p>
                </div>
              )}

              {selectedApproval.prioridade && (
                <div className="detail-group">
                  <label>Prioridade:</label>
                  <p style={{ color: getPriorityColor(selectedApproval.prioridade), fontWeight: 'bold' }}>
                    {selectedApproval.prioridade?.toUpperCase()}
                  </p>
                </div>
              )}

              {selectedApproval.observacoes && (
                <div className="detail-group">
                  <label>Observações:</label>
                  <p>{selectedApproval.observacoes}</p>
                </div>
              )}

              <div className="detail-group">
                <label>Motivo da Rejeição (se aplicável):</label>
                <textarea
                  className="rejection-input"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explique por que está rejeitando esta solicitação..."
                  disabled={actionInProgress}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)} disabled={actionInProgress}>
                ❌ Fechar
              </button>
              <button
                className="btn-danger"
                onClick={() => handleReject(selectedApproval)}
                disabled={actionInProgress || !rejectionReason.trim()}
              >
                {actionInProgress ? '⏳ Processando...' : '❌ Rejeitar'}
              </button>
              <button
                className="btn-primary"
                onClick={() => handleApprove(selectedApproval)}
                disabled={actionInProgress}
              >
                {actionInProgress ? '⏳ Processando...' : '✅ Aprovar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

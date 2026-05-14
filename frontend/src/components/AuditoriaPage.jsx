import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'

function statusTone(value) {
  const normalized = String(value || '').toLowerCase()
  if (['ok', 'ativo', 'presente', 'concluido', 'concluído', 'vigente'].includes(normalized)) {
    return 'success'
  }
  if (['error', 'erro', 'falha', 'falta', 'vencido', 'inativo'].includes(normalized)) {
    return 'danger'
  }
  return 'warning'
}

export default function AuditoriaPage() {
  const [config, setConfig] = useState({ database_ready: true, filiais: [] })
  const [items, setItems] = useState([])
  const [filters, setFilters] = useState({ action: '', resource: '', status: '', filial_id: '', date_from: '', date_to: '' })
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true

    async function loadConfig() {
      try {
        const response = await api.getAuditConfig()
        if (!active) {
          return
        }
        setConfig(response)
      } catch (error) {
        if (active) {
          setErrorMessage(error.message)
        }
      }
    }

    loadConfig()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadItems() {
      setLoading(true)
      setErrorMessage('')

      try {
        const response = await api.getAuditEvents(filters)
        if (!active) {
          return
        }
        setItems(response.items || [])
      } catch (error) {
        if (active) {
          setErrorMessage(error.message)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadItems()

    return () => {
      active = false
    }
  }, [filters])

  const resources = useMemo(() => {
    return [...new Set(items.map((item) => item.recurso).filter(Boolean))]
  }, [items])

  const actions = useMemo(() => {
    return [...new Set(items.map((item) => item.acao).filter(Boolean))]
  }, [items])

  function setFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Administração</span>
          <h1>Auditoria de movimentações</h1>
          <p>Rastreio centralizado de alterações, importações, cadastros e ações operacionais.</p>
        </div>
      </div>

      <div className="surface-card table-card">
        <div className="filter-panel">
          <div className="filter-grid">
            <label className="field filter-field">
              <span>Ação</span>
              <select onChange={(event) => setFilter('action', event.target.value)} value={filters.action}>
                <option value="">Todas</option>
                {actions.map((action) => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </label>
            <label className="field filter-field">
              <span>Recurso</span>
              <select onChange={(event) => setFilter('resource', event.target.value)} value={filters.resource}>
                <option value="">Todos</option>
                {resources.map((resource) => (
                  <option key={resource} value={resource}>{resource}</option>
                ))}
              </select>
            </label>
            <label className="field filter-field">
              <span>Status</span>
              <select onChange={(event) => setFilter('status', event.target.value)} value={filters.status}>
                <option value="">Todos</option>
                <option value="ok">OK</option>
                <option value="error">Erro</option>
              </select>
            </label>
            <label className="field filter-field">
              <span>Filial</span>
              <select onChange={(event) => setFilter('filial_id', event.target.value)} value={filters.filial_id}>
                <option value="">Todas</option>
                {(config.filiais || []).map((filial) => (
                  <option key={filial.id} value={filial.id}>{filial.cidade}/{filial.uf}</option>
                ))}
              </select>
            </label>
            <label className="field filter-field">
              <span>De</span>
              <input onChange={(event) => setFilter('date_from', event.target.value)} type="date" value={filters.date_from} />
            </label>
            <label className="field filter-field">
              <span>Até</span>
              <input onChange={(event) => setFilter('date_to', event.target.value)} type="date" value={filters.date_to} />
            </label>
          </div>
        </div>

        {!config.database_ready && <div className="alert-error">A tabela de auditoria ainda não existe no banco. Rode a migration do módulo.</div>}
        {errorMessage && <div className="alert-error">{errorMessage}</div>}

        {loading ? (
          <div className="empty-state">Carregando auditoria...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">Nenhuma movimentação encontrada para os filtros informados.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data/hora</th>
                  <th>Ação</th>
                  <th>Recurso</th>
                  <th>Status</th>
                  <th>Usuário</th>
                  <th>Entidade</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.criado_em || '-'}</td>
                    <td><span className={`status-chip tone-${statusTone(item.acao)}`}>{item.acao}</span></td>
                    <td>{item.recurso || '-'}</td>
                    <td><span className={`status-chip tone-${statusTone(item.status)}`}>{item.status || '-'}</span></td>
                    <td>{item.nome_colaborador || '-'}</td>
                    <td>{item.entidade_id || '-'}</td>
                    <td>{item.detalhes ? JSON.stringify(item.detalhes) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

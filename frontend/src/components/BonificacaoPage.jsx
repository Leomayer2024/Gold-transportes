import { useEffect, useMemo, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'

function monthInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0))
}

function buildSelectionMap(lancamentos = []) {
  return lancamentos.reduce((accumulator, item) => {
    const key = `${item.colaborador_id}:${item.metrica_id}`
    accumulator[key] = {
      atingiu: Boolean(item.atingiu),
      observacoes: item.observacoes || '',
    }
    return accumulator
  }, {})
}

export default function BonificacaoPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => monthInputValue())
  const [selectedFilial, setSelectedFilial] = useState('')
  const [search, setSearch] = useState('')
  const [board, setBoard] = useState({
    database_ready: true,
    can_manage: false,
    filiais: [],
    metricas: [],
    colaboradores: [],
    lancamentos: [],
    summary: {
      monthly_total_paid: 0,
      annual_total_paid: 0,
      collaborator_totals: [],
      metric_totals: [],
    },
  })
  const [selectionMap, setSelectionMap] = useState({})
  const [loading, setLoading] = useState(true)
  const _loaded = useRef(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (board.filiais?.length === 1 && !selectedFilial) {
      setSelectedFilial(String(board.filiais[0].id))
    }
  }, [board.filiais])

  useEffect(() => {
    let active = true

    async function loadBoard() {
      if (!_loaded.current) setLoading(true)
      setErrorMessage('')

      try {
        const response = await api.getBonificacaoBoard({
          mes: selectedMonth,
          ...(selectedFilial ? { filial_id: selectedFilial } : {}),
        })

        if (!active) {
          return
        }

        setBoard(response)
        setSelectionMap(buildSelectionMap(response.lancamentos || []))
      } catch (error) {
        if (active) {
          setErrorMessage(error.message)
        }
      } finally {
        if (active) {
          _loaded.current = true
          setLoading(false)
        }
      }
    }

    loadBoard()

    return () => {
      active = false
    }
  }, [selectedMonth, selectedFilial])

  const metricValues = useMemo(
    () =>
      (board.metricas || []).reduce((accumulator, item) => {
        accumulator[item.id] = Number(item.valor || 0)
        return accumulator
      }, {}),
    [board.metricas],
  )

  const filteredCollaborators = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) {
      return board.colaboradores || []
    }

    return (board.colaboradores || []).filter((item) => {
      return [item.nome_completo, item.cargo]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))
    })
  }, [board.colaboradores, search])

  const visibleTotal = useMemo(() => {
    return filteredCollaborators.reduce((accumulator, collaborator) => {
      return accumulator + (board.metricas || []).reduce((lineTotal, metric) => {
        const key = `${collaborator.id}:${metric.id}`
        const selected = selectionMap[key]?.atingiu
        return selected ? lineTotal + (metricValues[metric.id] || 0) : lineTotal
      }, 0)
    }, 0)
  }, [board.metricas, filteredCollaborators, metricValues, selectionMap])

  function toggleMetric(collaboratorId, metricId, checked) {
    const key = `${collaboratorId}:${metricId}`
    setSelectionMap((current) => {
      if (!checked) {
        const next = { ...current }
        delete next[key]
        return next
      }

      return {
        ...current,
        [key]: {
          atingiu: true,
          observacoes: current[key]?.observacoes || '',
        },
      }
    })
  }

  function lineTotal(collaboratorId) {
    return (board.metricas || []).reduce((accumulator, metric) => {
      const key = `${collaboratorId}:${metric.id}`
      if (!selectionMap[key]?.atingiu) {
        return accumulator
      }
      return accumulator + (metricValues[metric.id] || 0)
    }, 0)
  }

  async function handleSave() {
    setSaving(true)
    setFeedback('')
    setErrorMessage('')

    try {
      const entries = Object.entries(selectionMap)
        .filter(([, value]) => Boolean(value?.atingiu))
        .map(([key, value]) => {
          const [rawCollaboratorId, rawMetricId] = key.split(':')
          return {
            colaborador_id: Number(rawCollaboratorId),
            metrica_id: Number(rawMetricId),
            atingiu: true,
            observacoes: value?.observacoes || '',
          }
        })

      await api.saveBonificacaoBoard({
        mes: selectedMonth,
        filial_id: selectedFilial || null,
        entries,
      })

      setFeedback('Controle mensal de bonificação salvo com sucesso.')

      const refreshed = await api.getBonificacaoBoard({
        mes: selectedMonth,
        ...(selectedFilial ? { filial_id: selectedFilial } : {}),
      })
      setBoard(refreshed)
      setSelectionMap(buildSelectionMap(refreshed.lancamentos || []))
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">RH</span>
          <h1>Bonificação mensal</h1>
          <p>Controle por colaborador com métricas configuráveis, total mensal pago e visão acumulada do ano.</p>
        </div>
      </div>

      <div className="surface-card table-card bonus-shell">
        <div className="filter-panel bonus-filter-panel">
          <div className="filter-grid bonus-top-grid">
            <label className="field filter-field">
              <span>Mês de referência</span>
              <input onChange={(event) => setSelectedMonth(event.target.value)} type="month" value={selectedMonth} />
            </label>

            <label className="field filter-field">
              <span>Filial</span>
              <select onChange={(event) => setSelectedFilial(event.target.value)} value={selectedFilial}>
                {(board.filiais || []).length !== 1 && <option value="">Todas</option>}
                {(board.filiais || []).map((filial) => (
                  <option key={filial.id} value={filial.id}>
                    {filial.cidade}/{filial.uf}
                  </option>
                ))}
              </select>
            </label>

            <label className="field filter-field span-2 presence-search-field">
              <span>Buscar colaborador</span>
              <input onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou cargo" value={search} />
            </label>
          </div>

          <div className="button-row filter-actions">
            <button className="button-primary" disabled={!board.can_manage || !board.database_ready || saving} onClick={handleSave} type="button">
              {saving ? 'Salvando...' : 'Salvar bonificação'}
            </button>
            <Link className="button-secondary bonus-link-button" to="/bonificacao-metricas">
              Gerenciar métricas
            </Link>
          </div>
        </div>

        {!board.database_ready && !loading && (
          <div className="alert-error">As tabelas de bonificação ainda não existem no banco. Rode a migration do módulo para habilitar a gravação.</div>
        )}

        {!board.can_manage && !loading && (
          <div className="alert-error">Seu usuário está com acesso de visualização. Para editar o controle é necessário o escopo Modificar bonificação.</div>
        )}

        {feedback && <div className="alert-success">{feedback}</div>}
        {errorMessage && <div className="alert-error">{errorMessage}</div>}

        {loading ? (
          <div className="empty-state">Carregando controle de bonificação...</div>
        ) : (
          <>
            <div className="bonus-summary-grid">
              <article className="surface-card bonus-summary-card">
                <span>Total pago no mês</span>
                <strong>{formatCurrency(visibleTotal)}</strong>
                <small>Referência: {board.month_label || selectedMonth}</small>
              </article>
              <article className="surface-card bonus-summary-card">
                <span>Total pago no ano</span>
                <strong>{formatCurrency(board.summary?.annual_total_paid || 0)}</strong>
                <small>Ano: {board.year || selectedMonth.slice(0, 4)}</small>
              </article>
              <article className="surface-card bonus-summary-card">
                <span>Métricas ativas</span>
                <strong>{(board.metricas || []).length}</strong>
                <small>Configure e ajuste na tela de métricas</small>
              </article>
            </div>

            {(board.metricas || []).length === 0 ? (
              <div className="empty-state">Nenhuma métrica ativa encontrada. Cadastre métricas para iniciar o controle de bonificação.</div>
            ) : filteredCollaborators.length === 0 ? (
              <div className="empty-state">Nenhum colaborador ativo encontrado para os filtros informados.</div>
            ) : (
              <div className="table-wrap">
                <table className="bonus-table">
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>Cargo</th>
                      {(board.metricas || []).map((metric) => (
                        <th key={metric.id}>
                          <div className="bonus-metric-header">
                            <strong>{metric.nome}</strong>
                            <span>{metric.categoria}</span>
                            <small>{formatCurrency(metric.valor)}</small>
                          </div>
                        </th>
                      ))}
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCollaborators.map((collaborator) => (
                      <tr key={collaborator.id}>
                        <td><strong>{collaborator.nome_completo}</strong></td>
                        <td>{collaborator.cargo || '-'}</td>
                        {(board.metricas || []).map((metric) => {
                          const key = `${collaborator.id}:${metric.id}`
                          const checked = Boolean(selectionMap[key]?.atingiu)

                          return (
                            <td key={`${collaborator.id}-${metric.id}`}>
                              <label className="bonus-checkbox-cell">
                                <input
                                  checked={checked}
                                  disabled={!board.can_manage || !board.database_ready}
                                  onChange={(event) => toggleMetric(collaborator.id, metric.id, event.target.checked)}
                                  type="checkbox"
                                />
                                <span>{checked ? 'Atingiu' : 'Não'}</span>
                              </label>
                            </td>
                          )
                        })}
                        <td><strong>{formatCurrency(lineTotal(collaborator.id))}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

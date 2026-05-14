import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'

const LOADING_CACHE_KEY = 'seg-loading-cache'

function readLoadingCache() {
  try {
    const raw = window.sessionStorage.getItem(LOADING_CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeLoadingCache(payload) {
  try {
    window.sessionStorage.setItem(LOADING_CACHE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore cache persistence failures.
  }
}

function formatMinutes(totalMinutes) {
  const safeMinutes = Number(totalMinutes || 0)
  const hours = Math.floor(safeMinutes / 60)
  const minutes = safeMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function formatDateTime(value) {
  if (!value) {
    return '-'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString('pt-BR')
}

function timelineLabel(evento, motivosMap) {
  if (evento.tipo_evento === 'parada') {
    return `Parada${evento.motivo_parada_id ? ` - ${motivosMap[evento.motivo_parada_id] || 'Motivo'}` : ''}`
  }

  if (evento.tipo_evento === 'carga') {
    return 'Carga'
  }

  return 'Ocorrência'
}

export default function LoadingPage() {
  const cachedLoading = readLoadingCache()
  const [config, setConfig] = useState({
    ...(cachedLoading?.config || {}),
    filiais: cachedLoading?.config?.filiais || [],
    rotas: cachedLoading?.config?.rotas || [],
    veiculos: cachedLoading?.config?.veiculos || [],
    motivos: cachedLoading?.config?.motivos || [],
    shift_options: cachedLoading?.config?.shift_options || [],
    current_leader: cachedLoading?.config?.current_leader || null,
    database_ready: cachedLoading?.config?.database_ready ?? null,
    can_plan: cachedLoading?.config?.can_plan || false,
    can_operate: cachedLoading?.config?.can_operate || false,
    today: cachedLoading?.config?.today || '',
  })
  const [selectedDate, setSelectedDate] = useState(cachedLoading?.selectedDate || '')
  const [selectedFilial, setSelectedFilial] = useState(cachedLoading?.selectedFilial || '')
  const [selectedTurno, setSelectedTurno] = useState(cachedLoading?.selectedTurno || 'noite')
  const [journeyForm, setJourneyForm] = useState({
    filial_id: '',
    veiculo_carregamento_ids: [],
    rota_id: '',
    observacao_abertura: '',
  })
  const [journeys, setJourneys] = useState(cachedLoading?.journeys || [])
  const [activeTab, setActiveTab] = useState('programacao')
  const [loading, setLoading] = useState(!cachedLoading)
  const [refreshing, setRefreshing] = useState(Boolean(cachedLoading))
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [expandedJourneyIds, setExpandedJourneyIds] = useState([])
  const [pauseDrafts, setPauseDrafts] = useState({})
  const [occurrenceDrafts, setOccurrenceDrafts] = useState({})
  const [closingDrafts, setClosingDrafts] = useState({})

  useEffect(() => {
    let active = true

    async function loadConfig() {
      setLoading(!cachedLoading)
      setRefreshing(Boolean(cachedLoading))
      setErrorMessage('')

      try {
        const response = await api.getLoadingConfig()
        if (!active) {
          return
        }

        setConfig(response)
        setSelectedDate((current) => current || response.today)
        setSelectedTurno((current) => current || (response.shift_options?.includes('noite') ? 'noite' : response.shift_options?.[0] || ''))

        if (response.filiais?.length === 1) {
          const filialId = String(response.filiais[0].id)
          setSelectedFilial(filialId)
          setJourneyForm((current) => ({ ...current, filial_id: filialId }))
        }
      } catch (error) {
        if (active) {
          setErrorMessage(error.message)
        }
      } finally {
        if (active) {
          setLoading(false)
          setRefreshing(false)
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

    async function loadJourneys() {
      if (!selectedDate) {
        return
      }

      setLoading(!cachedLoading && journeys.length === 0)
      setRefreshing(Boolean(cachedLoading || journeys.length > 0))
      setErrorMessage('')

      try {
        const response = await api.getLoadingJourneys({
          data: selectedDate,
          ...(selectedFilial ? { filial_id: selectedFilial } : {}),
          ...(selectedTurno ? { turno: selectedTurno } : {}),
        })
        if (!active) {
          return
        }

        setConfig((current) => ({ ...current, database_ready: response.database_ready }))
        setJourneys(response.items || [])
        writeLoadingCache({
          config: {
            ...config,
            database_ready: response.database_ready,
          },
          selectedDate,
          selectedFilial,
          selectedTurno,
          journeys: response.items || [],
        })
      } catch (error) {
        if (active) {
          setErrorMessage(error.message)
        }
      } finally {
        if (active) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    loadJourneys()

    return () => {
      active = false
    }
  }, [selectedDate, selectedFilial, selectedTurno])

  const motivosMap = useMemo(
    () =>
      (config.motivos || []).reduce((accumulator, item) => {
        accumulator[item.id] = item.descricao
        return accumulator
      }, {}),
    [config.motivos],
  )

  const filteredVehicles = useMemo(() => {
    if (!selectedFilial) {
      return config.veiculos || []
    }
    return (config.veiculos || []).filter((item) => String(item.filial_id) === String(selectedFilial))
  }, [config.veiculos, selectedFilial])

  const filteredRoutes = useMemo(() => {
    if (!selectedFilial) {
      return config.rotas || []
    }
    return (config.rotas || []).filter((item) => String(item.filial_id) === String(selectedFilial))
  }, [config.rotas, selectedFilial])

  const scheduledVehicleIds = useMemo(
    () => new Set((journeys || []).map((item) => String(item.veiculo_carregamento_id))),
    [journeys],
  )

  const availableVehicles = useMemo(
    () => filteredVehicles.filter((item) => !scheduledVehicleIds.has(String(item.id))),
    [filteredVehicles, scheduledVehicleIds],
  )

  const selectedVehicleIds = useMemo(
    () => new Set((journeyForm.veiculo_carregamento_ids || []).map(String)),
    [journeyForm.veiculo_carregamento_ids],
  )

  const sortedVehicles = useMemo(
    () => [...filteredVehicles].sort((left, right) => String(left.placa || '').localeCompare(String(right.placa || ''))),
    [filteredVehicles],
  )

  const operationMetrics = useMemo(() => {
    const summary = {
      total: journeys.length,
      finalized: 0,
      loading: 0,
      paused: 0,
      pending: 0,
      occurrences: 0,
      divergences: 0,
    }

    journeys.forEach((journey) => {
      if (journey.status === 'finalizado') {
        summary.finalized += 1
      } else if (journey.parada_em_aberto) {
        summary.paused += 1
      } else if (journey.carga_em_aberto) {
        summary.loading += 1
      } else {
        summary.pending += 1
      }

      if (Number(journey.ocorrencias_count || 0) > 0) {
        summary.occurrences += 1
      }

      if (String(journey.fechamento?.divergencias || '').trim()) {
        summary.divergences += 1
      }
    })

    return summary
  }, [journeys])

  useEffect(() => {
    setExpandedJourneyIds((current) => {
      const validIds = current.filter((journeyId) => journeys.some((journey) => String(journey.id) === journeyId))

      if (validIds.length > 0 || journeys.length === 0) {
        return validIds
      }

      const suggestedJourney = journeys.find((journey) => journey.status !== 'finalizado') || journeys[0]
      return suggestedJourney ? [String(suggestedJourney.id)] : []
    })
  }, [journeys])

  function updateJourneyForm(fieldName, value) {
    setJourneyForm((current) => ({ ...current, [fieldName]: value }))
  }

  function toggleVehicleSelection(vehicleId) {
    setJourneyForm((current) => {
      const selectedIds = new Set((current.veiculo_carregamento_ids || []).map(String))
      const normalizedId = String(vehicleId)
      if (selectedIds.has(normalizedId)) {
        selectedIds.delete(normalizedId)
      } else {
        selectedIds.add(normalizedId)
      }

      return {
        ...current,
        veiculo_carregamento_ids: Array.from(selectedIds),
      }
    })
  }

  function selectAllAvailableVehicles() {
    setJourneyForm((current) => ({
      ...current,
      veiculo_carregamento_ids: availableVehicles.map((item) => String(item.id)),
    }))
  }

  function clearSelectedVehicles() {
    setJourneyForm((current) => ({
      ...current,
      veiculo_carregamento_ids: [],
    }))
  }

  function toggleJourneyExpanded(journeyId) {
    setExpandedJourneyIds((current) => {
      const normalizedId = String(journeyId)
      if (current.includes(normalizedId)) {
        return current.filter((item) => item !== normalizedId)
      }

      return [...current, normalizedId]
    })
  }

  function updatePauseDraft(journeyId, fieldName, value) {
    setPauseDrafts((current) => ({
      ...current,
      [journeyId]: {
        motivo_parada_id: '',
        observacao: '',
        ...(current[journeyId] || {}),
        [fieldName]: value,
      },
    }))
  }

  function updateClosingDraft(journeyId, fieldName, value) {
    setClosingDrafts((current) => ({
      ...current,
      [journeyId]: {
        quantidade_cilindros: '',
        divergencias: '',
        observacao_fechamento: '',
        ...(current[journeyId] || {}),
        [fieldName]: value,
      },
    }))
  }

  async function refreshJourneys() {
    const response = await api.getLoadingJourneys({
      data: selectedDate,
      ...(selectedFilial ? { filial_id: selectedFilial } : {}),
      ...(selectedTurno ? { turno: selectedTurno } : {}),
    })
    setJourneys(response.items || [])
    setConfig((current) => ({ ...current, database_ready: response.database_ready }))
  }

  async function handleCreateJourney() {
    setSaving(true)
    setFeedback('')
    setErrorMessage('')

    try {
      await api.createLoadingJourney({
        data_operacao: selectedDate,
        filial_id: journeyForm.filial_id || selectedFilial,
        turno: selectedTurno,
        veiculo_carregamento_ids: journeyForm.veiculo_carregamento_ids,
        rota_id: journeyForm.rota_id,
        observacao_abertura: journeyForm.observacao_abertura,
      })
      setJourneyForm((current) => ({ ...current, veiculo_carregamento_ids: [], rota_id: '', observacao_abertura: '' }))
      await refreshJourneys()
      setFeedback('Programação do turno salva com sucesso.')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleEvent(journeyId, payload, successMessage) {
    setSaving(true)
    setFeedback('')
    setErrorMessage('')

    try {
      await api.registerLoadingEvent(journeyId, payload)
      await refreshJourneys()
      setFeedback(successMessage)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCloseJourney(journeyId) {
    const draft = closingDrafts[journeyId] || {}
    setSaving(true)
    setFeedback('')
    setErrorMessage('')

    try {
      await api.closeLoadingJourney(journeyId, draft)
      await refreshJourneys()
      setFeedback('Jornada finalizada com sucesso.')
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
          <span className="eyebrow">Operação RTM</span>
          <h1>Carregamento</h1>
          <p>O líder logado vira o responsável da jornada e registra início de carga, paradas, ocorrências, tempo parado e fechamento do caminhão.</p>
        </div>
      </div>

      <div className="surface-card table-card loading-shell">
        <div className="filter-panel loading-filter-panel">
          <div className="filter-grid loading-top-grid">
            <label className="field filter-field">
              <span>Data</span>
              <input onChange={(event) => setSelectedDate(event.target.value)} type="date" value={selectedDate} />
            </label>
            <label className="field filter-field">
              <span>Base</span>
              <select
                onChange={(event) => {
                  setSelectedFilial(event.target.value)
                  updateJourneyForm('filial_id', event.target.value)
                  clearSelectedVehicles()
                }}
                value={selectedFilial}
              >
                <option value="">Todas</option>
                {(config.filiais || []).map((filial) => (
                  <option key={filial.id} value={filial.id}>
                    {filial.cidade}/{filial.uf}
                  </option>
                ))}
              </select>
            </label>
            <label className="field filter-field">
              <span>Turno</span>
              <select onChange={(event) => setSelectedTurno(event.target.value)} value={selectedTurno}>
                {(config.shift_options || []).map((turno) => (
                  <option key={turno} value={turno}>
                    {turno}
                  </option>
                ))}
              </select>
            </label>
            <div className="loading-leader-box">
              <span className="eyebrow">Responsável</span>
              <strong>{config.current_leader?.nome_completo || '-'}</strong>
              <small>{config.current_leader?.cargo || 'Usuário logado'}</small>
            </div>
          </div>

          <div className="dashboard-tab-row loading-tab-row">
            <button
              className={`button-secondary dashboard-tab-button${activeTab === 'programacao' ? ' active' : ''}`}
              onClick={() => setActiveTab('programacao')}
              type="button"
            >
              Programação do turno
            </button>
            <button
              className={`button-secondary dashboard-tab-button${activeTab === 'operacao' ? ' active' : ''}`}
              onClick={() => setActiveTab('operacao')}
              type="button"
            >
              Operação do turno
            </button>
          </div>

          {activeTab === 'programacao' && (
            <>
              <div className="loading-program-grid">
                <label className="field filter-field">
                  <span>Referência comum do dia</span>
                  <select disabled={!config.can_plan} onChange={(event) => updateJourneyForm('rota_id', event.target.value)} value={journeyForm.rota_id}>
                    <option value="">Usar a referência padrão de cada caminhão</option>
                    {filteredRoutes.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.nome}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field filter-field span-2">
                  <span>Observação de abertura</span>
                  <input
                    disabled={!config.can_plan}
                    onChange={(event) => updateJourneyForm('observacao_abertura', event.target.value)}
                    placeholder="Observação inicial do turno"
                    value={journeyForm.observacao_abertura}
                  />
                </label>
              </div>

              <div className="loading-selection-summary">
                <div className="loading-selection-kpi">
                  <span>Disponíveis</span>
                  <strong>{availableVehicles.length}</strong>
                </div>
                <div className="loading-selection-kpi">
                  <span>Selecionados</span>
                  <strong>{journeyForm.veiculo_carregamento_ids.length}</strong>
                </div>
                <div className="loading-selection-kpi">
                  <span>Já programados</span>
                  <strong>{journeys.length}</strong>
                </div>
                <div className="button-row">
                  <button className="button-secondary" disabled={!config.can_plan || availableVehicles.length === 0 || saving} onClick={selectAllAvailableVehicles} type="button">
                    Selecionar todos
                  </button>
                  <button className="button-secondary" disabled={!config.can_plan || journeyForm.veiculo_carregamento_ids.length === 0 || saving} onClick={clearSelectedVehicles} type="button">
                    Limpar seleção
                  </button>
                </div>
              </div>

              {sortedVehicles.length === 0 ? (
                <div className="empty-state">Nenhum caminhão cadastrado para esta base.</div>
              ) : (
                <div className="table-wrap loading-program-table-wrap">
                  <table className="loading-program-table">
                    <thead>
                      <tr>
                        <th>Selecionar</th>
                        <th>Placa</th>
                        <th>Transportadora</th>
                        <th>Tipo</th>
                        <th>Referência padrão</th>
                        <th>Status no turno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedVehicles.map((vehicle) => {
                        const isScheduled = scheduledVehicleIds.has(String(vehicle.id))
                        const isSelected = selectedVehicleIds.has(String(vehicle.id))
                        const routeName = filteredRoutes.find((route) => String(route.id) === String(vehicle.rota_id))?.nome || '-'

                        return (
                          <tr className={isScheduled ? 'loading-program-row is-scheduled' : ''} key={vehicle.id}>
                            <td>
                              <input
                                checked={isSelected}
                                disabled={!config.can_plan || isScheduled || saving}
                                onChange={() => toggleVehicleSelection(vehicle.id)}
                                type="checkbox"
                              />
                            </td>
                            <td><strong>{vehicle.placa}</strong></td>
                            <td>{vehicle.transportadora || '-'}</td>
                            <td>{vehicle.tipo_veiculo || '-'}</td>
                            <td>{routeName}</td>
                            <td>{isScheduled ? 'Já programado' : 'Disponível'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="button-row filter-actions">
                <button className="button-primary" disabled={!config.can_plan || !config.database_ready || saving || journeyForm.veiculo_carregamento_ids.length === 0} onClick={handleCreateJourney} type="button">
                  {saving ? 'Salvando...' : 'Programar turno'}
                </button>
              </div>
            </>
          )}
        </div>

        {config.database_ready === false && !loading && !refreshing && (
          <div className="alert-error">
            As tabelas do módulo ainda não existem no banco. Rode a migration de carregamento antes de usar esta tela.
          </div>
        )}

        {feedback && <div className="alert-success">{feedback}</div>}
        {errorMessage && <div className="alert-error">{errorMessage}</div>}
        {refreshing && !loading && <div className="alert-success">Atualizando dados do carregamento...</div>}

        {activeTab === 'operacao' && loading ? (
          <div className="empty-state">Carregando jornadas do turno...</div>
        ) : activeTab === 'operacao' && journeys.length === 0 ? (
          <div className="empty-state">Nenhuma jornada programada para a data, base e turno selecionados.</div>
        ) : activeTab === 'operacao' ? (
          <div className="loading-operation-shell">
            <div className="loading-operation-summary">
              <div className="loading-selection-kpi">
                <span>Veículos no turno</span>
                <strong>{operationMetrics.total}</strong>
              </div>
              <div className="loading-selection-kpi">
                <span>Finalizados</span>
                <strong>{operationMetrics.finalized}</strong>
              </div>
              <div className="loading-selection-kpi">
                <span>Em carga</span>
                <strong>{operationMetrics.loading}</strong>
              </div>
              <div className="loading-selection-kpi">
                <span>Parados</span>
                <strong>{operationMetrics.paused}</strong>
              </div>
              <div className="loading-selection-kpi">
                <span>Pendentes</span>
                <strong>{operationMetrics.pending}</strong>
              </div>
              <div className="loading-selection-kpi">
                <span>Com ocorrência</span>
                <strong>{operationMetrics.occurrences}</strong>
              </div>
              <div className="loading-selection-kpi">
                <span>Com divergência</span>
                <strong>{operationMetrics.divergences}</strong>
              </div>
            </div>

            <div className="loading-card-grid loading-card-grid-compact">
            {journeys.map((journey) => {
              const pauseDraft = pauseDrafts[journey.id] || {}
              const closingDraft = closingDrafts[journey.id] || {}
              const isExpanded = expandedJourneyIds.includes(String(journey.id))

              let operationStatus = 'Pendente'
              if (journey.status === 'finalizado') {
                operationStatus = 'Finalizado'
              } else if (journey.parada_em_aberto) {
                operationStatus = 'Parado'
              } else if (journey.carga_em_aberto) {
                operationStatus = 'Em carga'
              }

              return (
                <article className={`surface-card loading-card loading-card-accordion${isExpanded ? ' is-expanded' : ''}`} key={journey.id}>
                  <button className="loading-accordion-toggle" onClick={() => toggleJourneyExpanded(journey.id)} type="button">
                    <div className="loading-accordion-main">
                      <span className="eyebrow">{operationStatus}</span>
                      <h2>{journey.placa || 'Sem placa'}</h2>
                      <p>
                        {journey.rota_nome || 'Sem referência'} | {journey.transportadora || 'Sem transportadora'} | {journey.filial_nome}
                      </p>
                    </div>
                    <div className="loading-accordion-summary">
                      <div className="loading-kpi-grid loading-kpi-grid-compact">
                        <div className="loading-kpi">
                          <span>Tempo carga</span>
                          <strong>{formatMinutes(journey.tempo_carregamento_minutos)}</strong>
                        </div>
                        <div className="loading-kpi">
                          <span>Tempo parado</span>
                          <strong>{formatMinutes(journey.tempo_parado_minutos)}</strong>
                        </div>
                        <div className="loading-kpi">
                          <span>Ocorrências</span>
                          <strong>{journey.ocorrencias_count}</strong>
                        </div>
                      </div>
                      <span className="loading-accordion-indicator">{isExpanded ? 'Recolher' : 'Expandir'}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="loading-accordion-body">
                      <div className="detail-grid loading-meta-grid">
                        <div className="detail-field">
                          <span>Base</span>
                          <div className="readonly-box">{journey.filial_nome}</div>
                        </div>
                        <div className="detail-field">
                          <span>Turno</span>
                          <div className="readonly-box">{journey.turno}</div>
                        </div>
                        <div className="detail-field">
                          <span>Líder responsável</span>
                          <div className="readonly-box">{journey.lider_nome}</div>
                        </div>
                        <div className="detail-field">
                          <span>Capacidade</span>
                          <div className="readonly-box">{journey.capacidade_cilindros || '-'}</div>
                        </div>
                        <div className="detail-field">
                          <span>Iniciado em</span>
                          <div className="readonly-box">{formatDateTime(journey.iniciado_em)}</div>
                        </div>
                        <div className="detail-field">
                          <span>Finalizado em</span>
                          <div className="readonly-box">{formatDateTime(journey.finalizado_em || journey.fechamento?.finalizado_em)}</div>
                        </div>
                      </div>

                      {journey.observacao_abertura && <div className="readonly-box">Abertura: {journey.observacao_abertura}</div>}

                      <div className="button-row loading-action-row">
                        <button
                          className="button-primary"
                          disabled={!config.can_operate || journey.status === 'finalizado' || journey.carga_em_aberto || saving}
                          onClick={() => handleEvent(journey.id, { action: 'iniciar_carga' }, 'Carga iniciada com sucesso.')}
                          type="button"
                        >
                          Iniciar carga
                        </button>
                        <button
                          className="button-secondary"
                          disabled={!config.can_operate || !journey.carga_em_aberto || saving}
                          onClick={() => handleEvent(journey.id, { action: 'encerrar_carga' }, 'Carga encerrada com sucesso.')}
                          type="button"
                        >
                          Encerrar carga
                        </button>
                      </div>

                      <div className="loading-inline-grid">
                        <label className="field">
                          <span>Motivo da parada</span>
                          <select
                            disabled={!config.can_operate || !journey.carga_em_aberto || journey.parada_em_aberto || saving}
                            onChange={(event) => updatePauseDraft(journey.id, 'motivo_parada_id', event.target.value)}
                            value={pauseDraft.motivo_parada_id || ''}
                          >
                            <option value="">Selecione</option>
                            {(config.motivos || []).map((motivo) => (
                              <option key={motivo.id} value={motivo.id}>
                                {motivo.descricao}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field span-2">
                          <span>Observação da parada</span>
                          <input
                            disabled={!config.can_operate || !journey.carga_em_aberto || saving}
                            onChange={(event) => updatePauseDraft(journey.id, 'observacao', event.target.value)}
                            placeholder="Detalhes da parada ou motivo"
                            value={pauseDraft.observacao || ''}
                          />
                        </label>
                      </div>

                      <div className="button-row loading-action-row">
                        <button
                          className="button-primary"
                          disabled={!config.can_operate || !journey.carga_em_aberto || journey.parada_em_aberto || saving}
                          onClick={() =>
                            handleEvent(
                              journey.id,
                              {
                                action: 'iniciar_parada',
                                motivo_parada_id: pauseDraft.motivo_parada_id,
                                observacao: pauseDraft.observacao,
                              },
                              'Parada iniciada com sucesso.',
                            )
                          }
                          type="button"
                        >
                          Iniciar parada
                        </button>
                        <button
                          className="button-secondary"
                          disabled={!config.can_operate || !journey.parada_em_aberto || saving}
                          onClick={() =>
                            handleEvent(
                              journey.id,
                              { action: 'encerrar_parada', observacao: pauseDraft.observacao },
                              'Parada encerrada com sucesso.',
                            )
                          }
                          type="button"
                        >
                          Encerrar parada
                        </button>
                      </div>

                      <div className="loading-inline-grid">
                        <label className="field span-2">
                          <span>Ocorrência</span>
                          <input
                            disabled={!config.can_operate || journey.status === 'finalizado' || saving}
                            onChange={(event) => setOccurrenceDrafts((current) => ({ ...current, [journey.id]: event.target.value }))}
                            placeholder="Descreva a ocorrência do caminhão ou da operação"
                            value={occurrenceDrafts[journey.id] || ''}
                          />
                        </label>
                        <div className="button-row loading-action-row">
                          <button
                            className="button-secondary"
                            disabled={!config.can_operate || journey.status === 'finalizado' || saving}
                            onClick={() =>
                              handleEvent(
                                journey.id,
                                { action: 'registrar_ocorrencia', observacao: occurrenceDrafts[journey.id] },
                                'Ocorrência registrada com sucesso.',
                              )
                            }
                            type="button"
                          >
                            Registrar ocorrência
                          </button>
                        </div>
                      </div>

                      <div className="loading-inline-grid">
                        <label className="field">
                          <span>Qtd. cilindros</span>
                          <input
                            disabled={!config.can_operate || journey.status === 'finalizado' || saving}
                            onChange={(event) => updateClosingDraft(journey.id, 'quantidade_cilindros', event.target.value)}
                            placeholder="0"
                            type="number"
                            value={closingDraft.quantidade_cilindros || ''}
                          />
                        </label>
                        <label className="field span-2">
                          <span>Divergências</span>
                          <input
                            disabled={!config.can_operate || journey.status === 'finalizado' || saving}
                            onChange={(event) => updateClosingDraft(journey.id, 'divergencias', event.target.value)}
                            placeholder="Resumo das divergências do caminhão"
                            value={closingDraft.divergencias || ''}
                          />
                        </label>
                        <label className="field span-2">
                          <span>Observação final</span>
                          <textarea
                            disabled={!config.can_operate || journey.status === 'finalizado' || saving}
                            onChange={(event) => updateClosingDraft(journey.id, 'observacao_fechamento', event.target.value)}
                            placeholder="Fechamento da jornada"
                            rows="2"
                            value={closingDraft.observacao_fechamento || ''}
                          />
                        </label>
                      </div>

                      <div className="button-row loading-action-row">
                        <button
                          className="button-primary"
                          disabled={!config.can_operate || journey.status === 'finalizado' || saving}
                          onClick={() => handleCloseJourney(journey.id)}
                          type="button"
                        >
                          Finalizar jornada
                        </button>
                      </div>

                      {journey.fechamento?.quantidade_cilindros !== null && journey.fechamento?.quantidade_cilindros !== undefined && (
                        <div className="readonly-box loading-closure-box">
                          Fechamento: {journey.fechamento.quantidade_cilindros} cilindros | Divergências: {journey.fechamento.divergencias || 'Nenhuma'}
                        </div>
                      )}

                      <div className="loading-timeline">
                        <span className="eyebrow">Linha do tempo</span>
                        {journey.eventos.length === 0 ? (
                          <div className="empty-state">Nenhum evento lançado ainda.</div>
                        ) : (
                          <ul className="loading-timeline-list">
                            {journey.eventos.map((evento) => (
                              <li className="loading-timeline-item" key={evento.id}>
                                <strong>{timelineLabel(evento, motivosMap)}</strong>
                                <span>
                                  {formatDateTime(evento.inicio_evento)}
                                  {evento.fim_evento ? ` até ${formatDateTime(evento.fim_evento)}` : ' em aberto'}
                                </span>
                                <small>
                                  {evento.tipo_evento === 'ocorrencia' ? evento.observacao || 'Sem detalhe' : `Duração ${formatMinutes(evento.duration_minutes)}`}
                                </small>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
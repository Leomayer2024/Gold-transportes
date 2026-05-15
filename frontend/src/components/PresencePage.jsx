import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { supabase } from '../lib/supabase'

const PRESENCE_CACHE_KEY = 'seg-presence-cache'

// Helper para obter token sempre
async function getValidToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

function readPresenceCache() {
  try {
    const raw = window.sessionStorage.getItem(PRESENCE_CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writePresenceCache(payload) {
  try {
    window.sessionStorage.setItem(PRESENCE_CACHE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore cache persistence failures.
  }
}

function getFilialLabel(filiais, filialId) {
  const filial = filiais.find((item) => item.id === filialId)
  return filial ? `${filial.cidade}/${filial.uf}` : '-'
}

function statusTone(value) {
  const normalized = String(value || '').toLowerCase()
  if (['presente'].includes(normalized)) {
    return 'success'
  }
  if (['falta', 'afastado', 'vencido'].includes(normalized)) {
    return 'danger'
  }
  return 'warning'
}

function formatPresenceStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase()
  const labels = {
    pendente: 'Pendente',
    presente: 'Presente',
    falta: 'Falta',
    folga: 'Folga',
    atestado: 'Atestado',
    ferias: 'Férias',
    afastado: 'Afastado',
  }
  return labels[normalized] || status
}

function formatWeekdayLabel(isoDate) {
  if (!isoDate) {
    return ''
  }
  const date = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date)
}

export default function PresencePage() {
  const cachedPresence = readPresenceCache()
  const [config, setConfig] = useState(cachedPresence?.config || { filiais: [], status_options: [], today: '', database_ready: null, can_manage: false })
  const [selectedDate, setSelectedDate] = useState(cachedPresence?.selectedDate || '')
  const [selectedFilial, setSelectedFilial] = useState(cachedPresence?.selectedFilial || '')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState(cachedPresence?.items || [])
  const [loading, setLoading] = useState(!cachedPresence)
  const [refreshing, setRefreshing] = useState(Boolean(cachedPresence))
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // Estado para filtro de mês e controle de exportação
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date()
    return today.toISOString().slice(0, 7)
  })
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (config.filiais?.length === 1 && !selectedFilial) {
      setSelectedFilial(String(config.filiais[0].id))
    }
  }, [config.filiais])

  useEffect(() => {
    let active = true

    async function loadConfig() {
      setLoading(!cachedPresence)
      setRefreshing(Boolean(cachedPresence))
      setErrorMessage('')

      try {
        const response = await api.getPresenceConfig()
        if (!active) {
          return
        }

        setConfig(response)
        setSelectedDate((current) => current || response.today)
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

    async function loadPresence() {
      if (!selectedDate) {
        return
      }

      setLoading(!cachedPresence && items.length === 0)
      setRefreshing(Boolean(cachedPresence || items.length > 0))
      setErrorMessage('')

      try {
        const response = await api.getPresence({
          data: selectedDate,
          ...(selectedFilial ? { filial_id: selectedFilial } : {}),
        })
        if (!active) {
          return
        }

        setConfig((current) => ({
          ...current,
          database_ready: response.database_ready,
        }))
        setItems(response.items || [])
        writePresenceCache({
          config: {
            ...config,
            database_ready: response.database_ready,
          },
          selectedDate,
          selectedFilial,
          items: response.items || [],
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

    loadPresence()

    return () => {
      active = false
    }
  }, [selectedDate, selectedFilial])

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) {
      return items
    }

    return items.filter((item) => {
      return [item.nome_completo, item.cargo]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))
    })
  }, [items, search])

  const selectedWeekdayLabel = useMemo(() => formatWeekdayLabel(selectedDate), [selectedDate])

  function handleItemChange(index, fieldName, value) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [fieldName]: value } : item)))
  }

  async function handleSave() {
    setSaving(true)
    setFeedback('')
    setErrorMessage('')

    try {
      await api.updatePresence({
        data: selectedDate,
        entries: items,
      })
      setFeedback('Controle de presença salvo com sucesso.')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleExportExcel() {
    setExporting(true)
    setErrorMessage('')
    setFeedback('')
    try {
      const token = await getValidToken()
      if (!token) {
        throw new Error('Sessão expirada. Faça login novamente.')
      }

      const response = await fetch(
        `/api/presenca-calendario-massa-xlsx?mes=${selectedMonth}${selectedFilial ? `&filial_id=${selectedFilial}` : ''}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `presencas_massa_${selectedMonth}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setFeedback('✅ Calendário em Excel baixado com sucesso!')
    } catch (error) {
      setErrorMessage(error.message || 'Erro ao baixar calendário em massa')
    } finally {
      setExporting(false)
    }
  }

  async function handleExportCsv() {
    // Legado: exporta dados tabulares em CSV
    setExporting(true)
    setErrorMessage('')
    try {
      if (!api.getPresenceByMonth) {
        setErrorMessage('API não suporta exportação por mês no momento.')
        setExporting(false)
        return
      }

      const response = await api.getPresenceByMonth({ mes: selectedMonth, ...(selectedFilial ? { filial_id: selectedFilial } : {}) })
      const data = response.items || []
      if (!data.length) {
        setErrorMessage('Nenhuma presença encontrada para o mês selecionado.')
        setExporting(false)
        return
      }

      // Gerar CSV compatível com Excel (UTF-8 com BOM) para evitar dependências
      const rows = [
        ['Data', 'Colaborador', 'Filial', 'Cargo', 'Turno', 'Escala', 'Horário', 'Status', 'Origem', 'Observações'],
        ...data.map((item) => [
          item.data_referencia,
          item.nome_completo || '',
          getFilialLabel(config.filiais, item.filial_id),
          item.cargo || '',
          item.turno || '',
          item.escala_servico || '',
          item.horario_padrao_inicio && item.horario_padrao_fim ? `${item.horario_padrao_inicio} às ${item.horario_padrao_fim}` : '',
          formatPresenceStatusLabel(item.status),
          item.origem || '',
          item.observacoes || '',
        ]),
      ]

      const escapeCsv = (value) => {
        if (value == null) return ''
        const s = String(value)
        if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
          return '"' + s.replace(/"/g, '""') + '"'
        }
        return s
      }

      const csvContent = rows.map(r => r.map(escapeCsv).join(',')).join('\r\n')
      const bom = '\uFEFF'
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `presencas_${selectedMonth}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErrorMessage(err.message || 'Erro ao exportar CSV.')
    } finally {
      setExporting(false)
    }
  }



  async function downloadCalendarioPdf() {
    setExporting(true)
    setErrorMessage('')
    try {
      const token = await getValidToken()
      if (!token) {
        throw new Error('Sessão expirada. Faça login novamente.')
      }

      const response = await fetch(
        `/api/presenca-calendario-pdf?mes=${selectedMonth}${selectedFilial ? `&filial_id=${selectedFilial}` : ''}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `presencas_massa_${selectedMonth}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setFeedback('✅ PDF baixado com sucesso!')
    } catch (error) {
      setErrorMessage(error.message || 'Erro ao baixar PDF')
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Operação RTM</span>
          <h1>Presença</h1>
          <p>Lançamento diário do status da equipe, usando o turno, a escala e o horário padrão já definidos no cadastro.</p>
        </div>
      </div>

      <div className="surface-card table-card presence-shell">
        <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <label className="field filter-field" style={{ marginBottom: 0 }}>
            <span>Mês</span>
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
          </label>
          {config.filiais.length !== 1 && (
            <label className="field filter-field" style={{ marginBottom: 0 }}>
              <span>Filial (exportar)</span>
              <select value={selectedFilial} onChange={(e) => setSelectedFilial(e.target.value)}>
                <option value="">Todas</option>
                {config.filiais.map((filial) => (
                  <option key={filial.id} value={filial.id}>
                    {filial.cidade}/{filial.uf}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="button-primary" type="button" disabled={exporting} onClick={handleExportExcel}>
            {exporting ? 'Exportando...' : '📊 Exportar Excel (Calendário)'}
          </button>
          <button className="button-secondary" type="button" disabled={exporting} onClick={handleExportCsv}>
            {exporting ? 'Exportando...' : '📋 CSV (Tabela)'}
          </button>
          <button className="button-info" type="button" disabled={exporting} onClick={downloadCalendarioPdf}>
            {exporting ? 'Exportando...' : '📄 PDF'}
          </button>
        </div>
        <div className="filter-panel presence-filter-panel">
          <div className="filter-grid presence-top-grid">
            <label className="field filter-field">
              <span>Data</span>
              <input onChange={(event) => setSelectedDate(event.target.value)} type="date" value={selectedDate} />
            </label>

            {config.filiais.length !== 1 && (
              <label className="field filter-field">
                <span>Filial</span>
                <select onChange={(event) => setSelectedFilial(event.target.value)} value={selectedFilial}>
                  <option value="">Todas</option>
                  {config.filiais.map((filial) => (
                    <option key={filial.id} value={filial.id}>
                      {filial.cidade}/{filial.uf}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="field filter-field span-2 presence-search-field">
              <span>Buscar colaborador</span>
              <input onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou cargo" value={search} />
            </label>
          </div>

          {selectedWeekdayLabel && (
            <div className="helper-text">
              Dia selecionado: {selectedWeekdayLabel}. O quadro já respeita a escala cadastrada por colaborador.
            </div>
          )}

          <div className="button-row filter-actions">
            <button className="button-primary" disabled={!config.can_manage || !config.database_ready || saving} onClick={handleSave} type="button">
              {saving ? 'Salvando...' : 'Salvar quadro do dia'}
            </button>
          </div>
        </div>

        {config.database_ready === false && !loading && !refreshing && (
          <div className="alert-error">
            A tabela do módulo ainda não existe no banco. A tela já funciona para visualização da base, mas para gravar é preciso rodar a migration do controle de presença.
          </div>
        )}

        {!config.can_manage && !loading && (
          <div className="alert-error">Seu usuário está com acesso de visualização. A edição do quadro exige o escopo Modificar presença.</div>
        )}

        {feedback && <div className="alert-success">{feedback}</div>}
        {errorMessage && <div className="alert-error">{errorMessage}</div>}

        {loading ? (
          <div className="empty-state">Carregando quadro diário...</div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">Nenhum colaborador ativo encontrado para a data e filtros informados.</div>
        ) : (
          <div className="table-wrap">
            {refreshing && <div className="alert-success">Atualizando dados da presença...</div>}
            <table className="presence-table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Filial</th>
                  <th>Cargo</th>
                  <th>Turno</th>
                  <th>Escala</th>
                  <th>Horário padrão</th>
                  <th>Status</th>
                  <th>Origem</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => (
                  <tr key={`${item.colaborador_id}-${item.data_referencia}`}>
                    <td>
                      <strong>{item.nome_completo}</strong>
                    </td>
                    <td>{getFilialLabel(config.filiais, item.filial_id)}</td>
                    <td>{item.cargo || '-'}</td>
                    <td>{item.turno || '-'}</td>
                    <td>{item.escala_servico || '-'}</td>
                    <td>{item.horario_padrao_inicio || item.horario_padrao_fim ? `${item.horario_padrao_inicio || '--:--'} às ${item.horario_padrao_fim || '--:--'}` : '-'}</td>
                    <td>
                      <select
                        disabled={!config.can_manage}
                        onChange={(event) => handleItemChange(index, 'status', event.target.value)}
                        value={item.status}
                      >
                        {config.status_options.map((statusOption) => (
                          <option key={statusOption} value={statusOption}>
                            {formatPresenceStatusLabel(statusOption)}
                          </option>
                        ))}
                      </select>
                      <div><span className={`status-chip tone-${statusTone(item.status)}`}>{formatPresenceStatusLabel(item.status)}</span></div>
                    </td>
                    <td><span className={`status-chip tone-${statusTone(item.origem === 'rh' ? 'planejado' : item.origem || 'web')}`}>{item.origem === 'rh' ? 'Planejamento RH' : item.origem || 'web'}</span></td>
                    <td>
                      <input
                        disabled={!config.can_manage}
                        onChange={(event) => handleItemChange(index, 'observacoes', event.target.value)}
                        placeholder="Observações do dia"
                        value={item.observacoes || ''}
                      />
                    </td>
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
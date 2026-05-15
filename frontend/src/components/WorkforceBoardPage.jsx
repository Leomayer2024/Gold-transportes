import { useEffect, useMemo, useState, useRef } from 'react'
import { api } from '../services/api'

function summaryCardsForBase(base) {
  return [
    { label: 'Ativos', value: base.ativos },
    { label: 'Inativos', value: base.inativos },
    { label: 'Férias', value: base.ferias },
    { label: 'Afastados', value: base.afastados },
    { label: 'Atestados', value: base.atestados },
    { label: 'Faltas', value: base.faltas },
    { label: 'Folgas', value: base.folgas },
    { label: 'Pendentes', value: base.pendentes },
  ]
}

function statusTone(value) {
  const normalized = String(value || '').toLowerCase()
  if (['ativo', 'presente'].includes(normalized)) {
    return 'success'
  }
  if (['inativo', 'falta', 'afastado', 'atestado'].includes(normalized)) {
    return 'danger'
  }
  return 'warning'
}

export default function WorkforceBoardPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedFilial, setSelectedFilial] = useState('')
  const [search, setSearch] = useState('')
  const [board, setBoard] = useState({ filiais: [], summary_by_filial: [], employees: [], reference_date: '' })
  const [loading, setLoading] = useState(true)
  const _loaded = useRef(false)
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
        const response = await api.getWorkforceBoard({
          ...(selectedDate ? { data: selectedDate } : {}),
          ...(selectedFilial ? { filial_id: selectedFilial } : {}),
        })
        if (!active) {
          return
        }

        setBoard(response)
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
  }, [selectedDate, selectedFilial])

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) {
      return board.employees || []
    }

    return (board.employees || []).filter((item) => {
      return [item.nome_completo, item.cargo, item.filial_nome, item.turno, item.escala_servico, item.status_cadastro]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))
    })
  }, [board.employees, search])

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">RH</span>
          <h1>Quadro de funcionários</h1>
          <p>Visão por base do quadro ativo, disponibilidade diária e impactos de férias e afastamentos planejados.</p>
        </div>
      </div>

      <div className="surface-card table-card workforce-shell">
        <div className="filter-panel workforce-filter-panel">
          <div className="filter-grid workforce-top-grid">
            <label className="field filter-field">
              <span>Data de referência</span>
              <input onChange={(event) => setSelectedDate(event.target.value)} type="date" value={selectedDate} />
            </label>
            <label className="field filter-field">
              <span>Base</span>
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
              <span>Buscar no quadro</span>
              <input onChange={(event) => setSearch(event.target.value)} placeholder="Nome, cargo, turno, escala ou status" value={search} />
            </label>
          </div>
          {board.reference_date && <div className="helper-text">Status calculado para {board.reference_date.split('-').reverse().join('/')}.</div>}
        </div>

        {errorMessage && <div className="alert-error">{errorMessage}</div>}

        {loading ? (
          <div className="empty-state">Carregando quadro de funcionários...</div>
        ) : (
          <>
            <div className="workforce-summary-grid">
              {(board.summary_by_filial || []).map((base) => (
                <article className="surface-card workforce-summary-card" key={base.filial_id}>
                  <div className="section-title">
                    <span className="eyebrow">Base</span>
                    <h2>{base.filial_nome}</h2>
                  </div>
                  <div className="workforce-kpi-grid">
                    {summaryCardsForBase(base).map((item) => (
                      <div className="workforce-kpi" key={`${base.filial_id}-${item.label}`}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            {filteredEmployees.length === 0 ? (
              <div className="empty-state">Nenhum colaborador encontrado para os filtros informados.</div>
            ) : (
              <div className="table-wrap">
                <table className="workforce-table">
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>Base</th>
                      <th>Cargo</th>
                      <th>Turno</th>
                      <th>Escala</th>
                      <th>Horário padrão</th>
                      <th>Status cadastro</th>
                      <th>Status do dia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((item) => (
                      <tr key={`${item.colaborador_id}-${item.filial_id}-${item.status_cadastro}-${item.status_dia}`}>
                        <td><strong>{item.nome_completo}</strong></td>
                        <td>{item.filial_nome}</td>
                        <td>{item.cargo || '-'}</td>
                        <td>{item.turno || '-'}</td>
                        <td>{item.escala_servico || '-'}</td>
                        <td>{item.horario_padrao_inicio || item.horario_padrao_fim ? `${item.horario_padrao_inicio || '--:--'} às ${item.horario_padrao_fim || '--:--'}` : '-'}</td>
                        <td><span className={`status-chip tone-${statusTone(item.status_cadastro)}`}>{item.status_cadastro || '-'}</span></td>
                        <td><span className={`status-chip tone-${statusTone(item.status_dia)}`}>{item.status_dia || '-'}</span></td>
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
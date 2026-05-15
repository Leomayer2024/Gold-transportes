import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { api } from '../services/api'

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS_FERIADO = [
  { value: 'nacional', label: 'Nacional' },
  { value: 'estadual', label: 'Estadual' },
  { value: 'municipal', label: 'Municipal' },
  { value: 'interno', label: 'Ponto facultativo / interno' },
]

const TIPO_LABELS = Object.fromEntries(TIPOS_FERIADO.map((t) => [t.value, t.label]))

const TIPO_COR = {
  nacional: '#1a73e8',
  estadual: '#0d9488',
  municipal: '#9333ea',
  interno: '#ea580c',
}

const UFS_BR = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA',
  'MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN',
  'RO','RR','RS','SC','SE','SP','TO',
]

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function todayIso() { return new Date().toISOString().slice(0, 10) }

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = String(dateStr).split('-')
  return `${d}/${m}/${y}`
}

function emptyForm() {
  return {
    nome: '',
    data: todayIso(),
    tipo: 'nacional',
    uf: '',
    municipio: '',
    filial_id: '',
    recorrente: false,
    tem_expediente: false,
    horario_expediente: '',
    observacoes: '',
    ativo: true,
  }
}

// Gera array dos dias do mês: [{date, dayOfWeek, feriados:[]}]
function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month - 1, 1).getDay() // 0=Dom
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)      // vazio antes
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    cells.push({ iso, day: d, week: new Date(year, month - 1, d).getDay() })
  }
  return cells
}

// ─── Modal de formulário ──────────────────────────────────────────────────────

function FeriadoModal({ feriado, filiais, onSave, onClose }) {
  const [form, setForm] = useState(() => feriado
    ? {
        ...feriado,
        filial_id: feriado.filial_id != null ? String(feriado.filial_id) : '',
        recorrente: Boolean(feriado.recorrente),
        tem_expediente: Boolean(feriado.tem_expediente),
        horario_expediente: feriado.horario_expediente || '',
        uf: feriado.uf || '',
        municipio: feriado.municipio || '',
        observacoes: feriado.observacoes || '',
      }
    : emptyForm()
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setField(f, v) { setForm((p) => ({ ...p, [f]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) { setError('Informe o nome do feriado.'); return }
    if (!form.data) { setError('Informe a data.'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        nome: form.nome.trim(),
        data: form.data,
        tipo: form.tipo || 'nacional',
        uf: (form.uf || '').trim().toUpperCase() || null,
        municipio: (form.municipio || '').trim() || null,
        filial_id: form.filial_id ? Number(form.filial_id) : null,
        recorrente: Boolean(form.recorrente),
        tem_expediente: Boolean(form.tem_expediente),
        horario_expediente: form.tem_expediente ? ((form.horario_expediente || '').trim() || null) : null,
        observacoes: (form.observacoes || '').trim() || null,
        ativo: true,
      }
      if (feriado?.id) {
        await api.update('feriados', feriado.id, payload)
      } else {
        await api.create('feriados', payload)
      }
      onSave()
    } catch (err) {
      setError(err.message || 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{feriado?.id ? 'Editar feriado' : 'Novo feriado'}</h2>
          <button className="button-secondary" onClick={onClose} type="button">✕</button>
        </div>

        {error && <div className="alert-error" style={{ margin: '0 0 12px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Nome do feriado *</span>
              <input
                type="text"
                placeholder="Ex.: Aniversário de Curitiba"
                value={form.nome}
                onChange={(e) => setField('nome', e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Data *</span>
              <input type="date" value={form.data} onChange={(e) => setField('data', e.target.value)} required />
            </label>

            <label className="field">
              <span>Tipo</span>
              <select value={form.tipo} onChange={(e) => setField('tipo', e.target.value)}>
                {TIPOS_FERIADO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Estado (UF)</span>
              <select value={form.uf} onChange={(e) => setField('uf', e.target.value)}>
                <option value="">Todos os estados</option>
                {UFS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Município</span>
              <input
                type="text"
                placeholder="Ex.: Curitiba"
                value={form.municipio}
                disabled={!form.uf}
                onChange={(e) => setField('municipio', e.target.value)}
              />
            </label>

            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Filial específica</span>
              <select value={form.filial_id} onChange={(e) => setField('filial_id', e.target.value)}>
                <option value="">Todas as filiais</option>
                {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
              </select>
            </label>

            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Observações</span>
              <input type="text" placeholder="Informações adicionais..." value={form.observacoes} onChange={(e) => setField('observacoes', e.target.value)} />
            </label>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0', cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={form.recorrente} onChange={(e) => setField('recorrente', e.target.checked)} />
            <span>Feriado recorrente (repete todo ano na mesma data)</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={form.tem_expediente} onChange={(e) => setField('tem_expediente', e.target.checked)} />
            <span>Haverá expediente de trabalho neste feriado</span>
          </label>

          {form.tem_expediente && (
            <label className="field" style={{ marginBottom: 12 }}>
              <span>Horário do expediente</span>
              <input
                type="text"
                placeholder="Ex.: 08:00 às 12:00"
                value={form.horario_expediente}
                onChange={(e) => setField('horario_expediente', e.target.value)}
              />
            </label>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="button-primary" disabled={saving}>
              {saving ? 'Salvando...' : feriado?.id ? 'Salvar' : 'Criar feriado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Calendário ───────────────────────────────────────────────────────────────

function CalendarioMes({ year, month, feriadoPorDia, onDayClick, selectedDay }) {
  const cells = useMemo(() => buildCalendarDays(year, month), [year, month])
  const hoje = todayIso()

  return (
    <div className="feriados-cal">
      <div className="feriados-cal-header">
        {DIAS_SEMANA.map((d) => <div key={d} className="feriados-cal-wd">{d}</div>)}
      </div>
      <div className="feriados-cal-grid">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`e-${idx}`} className="feriados-cal-empty" />
          const fs = feriadoPorDia[cell.iso] || []
          const isToday = cell.iso === hoje
          const isSelected = cell.iso === selectedDay
          const isDomingo = cell.week === 0
          const isSabado = cell.week === 6
          return (
            <button
              key={cell.iso}
              type="button"
              className={[
                'feriados-cal-day',
                isToday ? 'is-today' : '',
                isSelected ? 'is-selected' : '',
                isDomingo ? 'is-domingo' : '',
                isSabado ? 'is-sabado' : '',
                fs.length > 0 ? 'has-feriado' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onDayClick(cell.iso)}
            >
              <span className="cal-day-num">{cell.day}</span>
              {fs.slice(0, 2).map((f) => (
                <span
                  key={f.id}
                  className="cal-feriado-dot"
                  style={{ background: TIPO_COR[f.tipo] || '#888' }}
                  title={`${f.nome} (${TIPO_LABELS[f.tipo] || f.tipo})`}
                />
              ))}
              {fs.length > 2 && <span className="cal-feriado-more">+{fs.length - 2}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function FeriadosPage() {
  const today = new Date()
  const [ano, setAno] = useState(today.getFullYear())
  const [mes, setMes] = useState(today.getMonth() + 1)
  const [filiais, setFiliais] = useState([])
  const [filtroFilial, setFiltroFilial] = useState('')

  useEffect(() => {
    if (filiais?.length === 1 && !filtroFilial) {
      setFiltroFilial(String(filiais[0].id))
    }
  }, [filiais])
  const [filtroUf, setFiltroUf] = useState('')
  const [feriados, setFeriados] = useState([])
  const [loading, setLoading] = useState(false)
  const _loaded = useRef(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedDay, setSelectedDay] = useState(null)
  const [modalFeriado, setModalFeriado] = useState(null) // null=fechado, {}=novo, {...}=editar
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    api.list('filiais', { ativo: true }).then(setFiliais).catch(() => {})
  }, [])

  useEffect(() => {
    let active = true
    if (!_loaded.current) setLoading(true)
    const params = { ano, mes }
    if (filtroUf) params.uf = filtroUf
    if (filtroFilial) params.filial_id = filtroFilial
    api.getFeriadosCalendario(params)
      .then((rows) => { if (active) setFeriados(rows || []) })
      .catch(() => { if (active) setFeriados([]) })
      .finally(() => { if (active) { _loaded.current = true; setLoading(false) } })
    return () => { active = false }
  }, [ano, mes, filtroUf, filtroFilial, refreshKey])

  const feriadoPorDia = useMemo(() => {
    const map = {}
    for (const f of feriados) {
      const key = f.data
      if (!map[key]) map[key] = []
      map[key].push(f)
    }
    return map
  }, [feriados])

  const feriadosDoDia = selectedDay ? (feriadoPorDia[selectedDay] || []) : []

  // Feriados listados na lateral (dia selecionado ou todos do mês)
  const feriadosLista = selectedDay ? feriadosDoDia : feriados

  function prevMes() {
    if (mes === 1) { setMes(12); setAno((y) => y - 1) }
    else setMes((m) => m - 1)
    setSelectedDay(null)
  }
  function nextMes() {
    if (mes === 12) { setMes(1); setAno((y) => y + 1) }
    else setMes((m) => m + 1)
    setSelectedDay(null)
  }

  const handleDayClick = useCallback((iso) => {
    setSelectedDay((prev) => prev === iso ? null : iso)
  }, [])

  function openNew(data) {
    setModalFeriado({ _new: true, data: data || (selectedDay || todayIso()) })
  }

  function openEdit(feriado) {
    setModalFeriado(feriado)
  }

  async function handleDelete(id) {
    setDeleting(id)
    try {
      await api.remove('feriados', id)
      setRefreshKey((k) => k + 1)
      if (feriadosDoDia.length <= 1) setSelectedDay(null)
    } catch {
    } finally {
      setDeleting(null)
    }
  }

  function handleSaved() {
    setModalFeriado(null)
    setRefreshKey((k) => k + 1)
  }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Calendário</span>
          <h1>Feriados</h1>
          <p>Cadastre feriados nacionais, estaduais e municipais por filial. O sistema considera feriados no cálculo de benefícios.</p>
        </div>
        <button className="button-primary" type="button" onClick={() => openNew(null)}>+ Novo feriado</button>
      </div>

      {/* Filtros */}
      <div className="surface-card" style={{ padding: '12px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <label className="field filter-field" style={{ minWidth: 140 }}>
            <span>Estado (UF)</span>
            <select value={filtroUf} onChange={(e) => setFiltroUf(e.target.value)}>
              <option value="">Todos</option>
              {UFS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </label>
          <label className="field filter-field" style={{ minWidth: 180 }}>
            <span>Filial</span>
            <select value={filtroFilial} onChange={(e) => setFiltroFilial(e.target.value)}>
              {filiais.length !== 1 && <option value="">Todas</option>}
              {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
            </select>
          </label>
          {(filtroUf || filtroFilial) && (
            <button
              type="button"
              className="button-secondary"
              style={{ fontSize: 12 }}
              onClick={() => { setFiltroUf(''); setFiltroFilial('') }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      <div className="feriados-layout">
        {/* ── Calendário ── */}
        <div className="surface-card feriados-cal-card">
          {/* Navegação mês */}
          <div className="feriados-nav">
            <button type="button" className="cal-nav-btn" onClick={prevMes}>‹</button>
            <strong className="cal-titulo">{MESES[mes - 1]} {ano}</strong>
            <button type="button" className="cal-nav-btn" onClick={nextMes}>›</button>
          </div>

          {loading
            ? <div className="empty-state" style={{ minHeight: 200 }}>Carregando...</div>
            : (
              <CalendarioMes
                year={ano}
                month={mes}
                feriadoPorDia={feriadoPorDia}
                onDayClick={handleDayClick}
                selectedDay={selectedDay}
              />
            )
          }

          {/* Legenda */}
          <div className="cal-legenda">
            {TIPOS_FERIADO.map((t) => (
              <span key={t.value} className="cal-legenda-item">
                <span style={{ background: TIPO_COR[t.value], display: 'inline-block', width: 10, height: 10, borderRadius: '50%' }} />
                {t.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Lista lateral ── */}
        <div className="surface-card feriados-lista-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong style={{ fontSize: 14 }}>
              {selectedDay ? `Feriados em ${formatDate(selectedDay)}` : `Feriados de ${MESES[mes - 1]}`}
            </strong>
            {selectedDay && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="button-primary" style={{ fontSize: 12, padding: '4px 12px' }} type="button" onClick={() => openNew(selectedDay)}>+ Neste dia</button>
                <button className="button-secondary" style={{ fontSize: 12 }} type="button" onClick={() => setSelectedDay(null)}>Ver todos</button>
              </div>
            )}
          </div>

          {feriadosLista.length === 0 ? (
            <div className="empty-state" style={{ minHeight: 120 }}>
              <p>{selectedDay ? 'Nenhum feriado neste dia.' : 'Nenhum feriado neste mês.'}</p>
              <button className="button-secondary" type="button" style={{ marginTop: 8 }} onClick={() => openNew(selectedDay)}>
                Cadastrar feriado
              </button>
            </div>
          ) : (
            <ul className="feriados-lista">
              {feriadosLista.map((f) => (
                <li key={f.id} className="feriado-item">
                  <div className="feriado-item-cor" style={{ background: TIPO_COR[f.tipo] || '#888' }} />
                  <div className="feriado-item-body">
                    <span className="feriado-item-nome">{f.nome}</span>
                    <div className="feriado-item-meta">
                      <span>{formatDate(f.data)}</span>
                      <span className="feriado-chip">{TIPO_LABELS[f.tipo] || f.tipo}</span>
                      {f.uf && <span className="feriado-chip feriado-chip-uf">{f.uf}{f.municipio ? ` / ${f.municipio}` : ''}</span>}
                      {f.recorrente && <span className="feriado-chip feriado-chip-rec">↺ recorrente</span>}
                      {f.tem_expediente && (
                        <span className="feriado-chip" style={{ background: '#fffde7', color: '#b45309', border: '1px solid #fde68a' }}>
                          🏢 {f.horario_expediente ? `Expediente ${f.horario_expediente}` : 'Com expediente'}
                        </span>
                      )}
                    </div>
                    {f.observacoes && <small style={{ color: '#888', fontSize: 11 }}>{f.observacoes}</small>}
                  </div>
                  <div className="feriado-item-actions">
                    <button className="button-secondary" style={{ fontSize: 12, padding: '2px 8px' }} type="button" onClick={() => openEdit(f)}>Editar</button>
                    <button
                      className="button-secondary"
                      style={{ fontSize: 12, padding: '2px 8px', color: 'var(--danger, #c00)' }}
                      type="button"
                      disabled={deleting === f.id}
                      onClick={() => handleDelete(f.id)}
                    >
                      {deleting === f.id ? '...' : 'Excluir'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {modalFeriado !== null && (
        <FeriadoModal
          feriado={modalFeriado?._new ? { data: modalFeriado.data } : modalFeriado}
          filiais={filiais}
          onSave={handleSaved}
          onClose={() => setModalFeriado(null)}
        />
      )}
    </section>
  )
}

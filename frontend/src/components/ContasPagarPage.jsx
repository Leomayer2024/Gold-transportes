import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { api } from '../services/api'

const TIPOS = ['HORAS EXTRAS', 'FORNECEDOR', 'COLABORADOR', 'HOSPEDAGEM', 'KM', 'PEDAGIO', 'DESPESAS EXTRAS', 'COMPRAS', 'OUTRO']
const STATUS_OPTS = ['PENDENTE', 'PAGO', 'VENCIDO', 'FINALIZADO', 'CANCELADO']
const TIPO_DOCS = ['NF', 'BOLETO', 'RECIBO', 'PIX', 'TED', 'OUTRO']

const XL = { border: '1px solid #d1d5db' }
const XL_TH = { ...XL, padding: '4px 7px', background: '#e8edf2', fontWeight: 700, whiteSpace: 'nowrap', fontSize: 11, position: 'sticky', top: 0, zIndex: 2 }
const XL_TD = (i) => ({ ...XL, padding: '3px 7px', background: i % 2 === 0 ? '#fff' : '#f7f9fb', fontSize: 11, whiteSpace: 'nowrap' })

function fmtBRL(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0) }
function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function diasAbertos(data_vencimento, hoje) {
  if (!data_vencimento) return null
  const ms = new Date(hoje) - new Date(data_vencimento)
  return Math.floor(ms / 86400000)
}
function pct(a, b) { return b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '—' }

function StatusChip({ v }) {
  const map = { PAGO: ['#059669', '#f0fdf4'], PENDENTE: ['#d97706', '#fffbeb'], VENCIDO: ['#dc2626', '#fef2f2'], FINALIZADO: ['#4338ca', '#eef2ff'], CANCELADO: ['#64748b', '#f8fafc'] }
  const [c, bg] = map[v] || ['#64748b', '#f8fafc']
  return <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: bg, color: c, border: `1px solid ${c}44`, whiteSpace: 'nowrap' }}>{v || '—'}</span>
}
function TipoChip({ v }) {
  if (!v) return <span style={{ color: '#cbd5e1', fontSize: 10 }}>—</span>
  const isFixo = v === 'fixo'
  return <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: isFixo ? '#eff6ff' : '#fef3c7', color: isFixo ? '#1d4ed8' : '#92400e', border: `1px solid ${isFixo ? '#bfdbfe' : '#fde68a'}` }}>{isFixo ? 'NO CONTRATO' : 'FORA CONTRATO'}</span>
}
function OpenBadge({ dias }) {
  if (dias === null) return <span style={{ color: '#cbd5e1' }}>—</span>
  const c = dias > 0 ? '#dc2626' : '#059669'
  return <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, background: dias > 0 ? '#fef2f2' : '#f0fdf4', color: c, border: `1px solid ${c}44` }}>{dias > 0 ? `+${dias}d` : `${dias}d`}</span>
}
function AlertaCard({ label, value, sub, color, bg, warn }) {
  return (
    <div style={{ flex: '1 1 140px', minWidth: 140, padding: '10px 14px', background: bg || '#fff', border: `1.5px solid ${color}33`, borderRadius: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: warn ? '#dc2626' : color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#666' }}>{sub}</div>}
    </div>
  )
}
function SectionHeader({ title, color = '#1e40af' }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color, letterSpacing: '.07em', marginBottom: 8, paddingBottom: 5, borderBottom: `2px solid ${color}22`, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-block', width: 3, height: 14, background: color, borderRadius: 2 }} />
      {title}
    </div>
  )
}
function ModalField({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: 3 }}>{label}</label>
      {children}
    </div>
  )
}
function ModalInput({ value, onChange, type = 'text', opts, style = {}, list, placeholder }) {
  const base = { fontSize: 12, padding: '5px 8px', border: '1px solid #c7d2e0', borderRadius: 5, background: '#fff', width: '100%', boxSizing: 'border-box', ...style }
  if (opts) return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={base}>
      <option value="">—</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  if (type === 'number') return <input type="number" step="0.01" value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={{ ...base, textAlign: 'right' }} />
  if (type === 'textarea') return <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={3} style={{ ...base, resize: 'vertical' }} />
  return <input type={type} value={value || ''} list={list} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={base} />
}

export default function ContasPagarPage() {
  const [rows, setRows] = useState([])
  const [alertas, setAlertas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filiais, setFiliais] = useState([])
  const [fornecedoresDB, setFornecedoresDB] = useState([])

  const [filterFilial, setFilterFilial] = useState('')
  const [filterMes, setFilterMes] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ tipo_despesa: 'HORAS EXTRAS', status: 'PENDENTE', valor: '' })
  const [creatingNew, setCreatingNew] = useState(false)

  const [ctxMenu, setCtxMenu] = useState(null)
  const [showMetricas, setShowMetricas] = useState(true)
  const [prioridades, setPrioridades] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cp-prioridade') || '{}') } catch { return {} }
  })
  const ctxRef = useRef(null)
  const _loaded = useRef(false)

  const hoje = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (filiais?.length === 1 && !filterFilial) setFilterFilial(String(filiais[0].id))
  }, [filiais])

  useEffect(() => {
    if (!ctxMenu) return
    function dismiss(e) {
      if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null)
    }
    window.addEventListener('mousedown', dismiss)
    return () => window.removeEventListener('mousedown', dismiss)
  }, [ctxMenu])

  const carregar = useCallback(() => {
    if (!_loaded.current) setLoading(true)
    Promise.all([
      api.contasPagar(),
      api.contasPagarAlertas(),
      api.list('filiais', { limit: 500 }),
      api.list('fornecedores', { ativo: true, limit: 500 }),
    ])
      .then(([cp, al, fil, forn]) => {
        setRows(cp.data || [])
        setAlertas(al)
        setFiliais(fil.items || fil || [])
        setFornecedoresDB(forn.items || forn || [])
      })
      .catch(() => {})
      .finally(() => { _loaded.current = true; setLoading(false) })
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const mesesDisponiveis = useMemo(() => {
    const s = new Set(rows.map((r) => r.competencia?.slice(0, 7)).filter(Boolean))
    return [...s].sort().reverse()
  }, [rows])

  const filtradas = useMemo(() => rows.filter((r) => {
    if (filterFilial) {
      const selectedCidade = filiais.find((f) => String(f.id) === String(filterFilial))?.cidade
      if (r.filial_nome && selectedCidade) {
        if (r.filial_nome.trim().toUpperCase() !== selectedCidade.trim().toUpperCase()) return false
      } else if (r.filial_id != null) {
        if (String(r.filial_id) !== String(filterFilial)) return false
      }
    }
    if (filterMes && r.competencia?.slice(0, 7) !== filterMes) return false
    if (filterTipo && r.tipo_despesa !== filterTipo) return false
    if (filterStatus && r.status !== filterStatus) return false
    return true
  }), [rows, filiais, filterFilial, filterMes, filterTipo, filterStatus])

  const metricas = useMemo(() => {
    const valor = filtradas.reduce((s, r) => s + (r.valor || 0), 0)
    const pago = filtradas.reduce((s, r) => s + (r.valor_pago || 0), 0)
    const saldo = filtradas.filter((r) => r.status !== 'PAGO' && r.status !== 'CANCELADO').reduce((s, r) => s + (r.valor || 0) - (r.valor_pago || 0), 0)
    const byStatus = {}
    for (const r of filtradas) byStatus[r.status] = (byStatus[r.status] || 0) + 1
    const byTipo = {}
    for (const r of filtradas) byTipo[r.tipo_despesa] = (byTipo[r.tipo_despesa] || 0) + 1
    return { valor, pago, saldo, byStatus, byTipo, n: filtradas.length }
  }, [filtradas])

  const totais = useMemo(() => ({
    valor: filtradas.reduce((s, r) => s + (r.valor || 0), 0),
    pago: filtradas.reduce((s, r) => s + (r.valor_pago || 0), 0),
    saldo: filtradas.filter((r) => r.status !== 'PAGO' && r.status !== 'CANCELADO').reduce((s, r) => s + (r.valor || 0) - (r.valor_pago || 0), 0),
  }), [filtradas])

  const filialGroups = useMemo(() => {
    const map = new Map()
    filtradas.forEach((r) => {
      const key = r.filial_nome || r.filial_id || 'sem_filial'
      if (!map.has(key)) map.set(key, { nome: r.filial_nome || `Filial ${r.filial_id}`, rows: [], totais: { valor: 0, pago: 0, saldo: 0 } })
      const g = map.get(key)
      g.rows.push(r)
      g.totais.valor += r.valor || 0
      g.totais.pago += r.valor_pago || 0
      if (r.status !== 'PAGO' && r.status !== 'CANCELADO') g.totais.saldo += (r.valor || 0) - (r.valor_pago || 0)
    })
    const groups = [...map.values()].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
    for (const g of groups) {
      g.rows.sort((a, b) => (prioridades[b.id] ? 1 : 0) - (prioridades[a.id] ? 1 : 0))
    }
    return groups
  }, [filtradas, prioridades])

  function ef(f) { return editForm[f] }
  function setF(f, v) { setEditForm((p) => ({ ...p, [f]: v })) }
  function abrirEdicao(r) { setEditId(r.id); setEditForm({ ...r }); setCtxMenu(null) }

  function togglePrioridade(id) {
    setPrioridades((p) => {
      const next = { ...p, [id]: !p[id] }
      localStorage.setItem('cp-prioridade', JSON.stringify(next))
      return next
    })
    setCtxMenu(null)
  }

  function openCtxMenu(e, row) {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setCtxMenu({ row, x: rect.left, y: rect.bottom + 4 })
  }

  async function quickStatus(id, status) {
    const extra = status === 'PAGO' ? { data_pagamento: hoje } : {}
    try { await api.editarContaPagar(id, { status, ...extra }); carregar() }
    catch (err) { alert(err.message || 'Erro.') }
    setCtxMenu(null)
  }

  async function salvarEdicao() {
    setSaving(true)
    try { await api.editarContaPagar(editId, editForm); setEditId(null); carregar() }
    catch (e) { alert(e.message || 'Erro ao salvar.') }
    finally { setSaving(false) }
  }

  async function deletar(id) {
    if (!confirm('Excluir este lançamento?')) return
    setCtxMenu(null)
    try { await api.deletarContaPagar(id); carregar() }
    catch (e) { alert(e.message || 'Erro ao excluir.') }
  }

  async function criarNovo() {
    if (!newForm.filial_id || !newForm.competencia || !newForm.tipo_despesa || !newForm.valor) {
      alert('Filial, competência, tipo e valor são obrigatórios.'); return
    }
    setCreatingNew(true)
    try {
      await api.criarContaPagar(newForm)
      setShowNew(false)
      setNewForm({ tipo_despesa: 'HORAS EXTRAS', status: 'PENDENTE', valor: '' })
      carregar()
    } catch (e) { alert(e.message || 'Erro ao criar.') }
    finally { setCreatingNew(false) }
  }

  const metBtnSt = { fontSize: 11, padding: '2px 10px', borderRadius: 4, border: '1px solid #c7d2e0', background: '#f8fafc', cursor: 'pointer', color: '#334155' }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Financeiro</span>
          <h1>Contas a Pagar</h1>
          <p>Obrigações Gold — horas extras fora do contrato, fornecedores, hospedagens e outras despesas operacionais</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={metBtnSt} onClick={() => setShowMetricas((m) => !m)}>
            {showMetricas ? '▲ Métricas' : '▼ Métricas'}
          </button>
          <button className="button-primary" onClick={() => setShowNew(true)} type="button">+ Nova despesa</button>
        </div>
      </div>

      {/* Alertas */}
      {alertas && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <AlertaCard label="Total a Pagar" value={fmtBRL(alertas.total_a_pagar)} sub="saldo pendente" color="#dc2626" bg="#fef2f2" />
          <AlertaCard label="Pendentes" value={alertas.pendente} sub="aguardando pagamento" color="#d97706" bg="#fffbeb" warn={alertas.pendente > 0} />
          <AlertaCard label="Vencidos" value={alertas.vencidos} sub="prazo ultrapassado" color="#dc2626" bg="#fef2f2" warn={alertas.vencidos > 0} />
          <AlertaCard label="Pago no Mês" value={fmtBRL(alertas.pago_mes)} sub="pagamentos do mês atual" color="#059669" bg="#f0fdf4" />
        </div>
      )}

      {/* Métricas detalhadas */}
      {showMetricas && filtradas.length > 0 && (
        <div style={{ marginBottom: 10, padding: '12px 16px', background: '#f8fafc', border: '1px solid #dce1e8', borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: 8, letterSpacing: '.06em' }}>
            Métricas — {metricas.n} lançamentos com os filtros atuais
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '0 0 auto', padding: '8px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, minWidth: 140 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3 }}>Total Despesas</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#dc2626', fontFamily: 'monospace' }}>{fmtBRL(metricas.valor)}</div>
            </div>
            <div style={{ flex: '0 0 auto', padding: '8px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, minWidth: 140 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3 }}>Total Pago</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#059669', fontFamily: 'monospace' }}>{fmtBRL(metricas.pago)}</div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>quitado: {pct(metricas.pago, metricas.valor)}</div>
            </div>
            <div style={{ flex: '0 0 auto', padding: '8px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, minWidth: 140 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3 }}>Saldo Pendente</div>
              <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: metricas.saldo > 0 ? '#dc2626' : '#059669' }}>{fmtBRL(metricas.saldo)}</div>
            </div>
            <div style={{ flex: '1 1 200px', padding: '8px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Por Status</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {Object.entries(metricas.byStatus).map(([st, cnt]) => (
                  <span key={st} onClick={() => setFilterStatus(filterStatus === st ? '' : st)} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, cursor: 'pointer', border: '1px solid #e2e8f0', background: filterStatus === st ? '#dbeafe' : '#f8fafc', color: '#334155' }}>
                    {st} <span style={{ fontWeight: 900 }}>{cnt}</span>
                  </span>
                ))}
              </div>
            </div>
            <div style={{ flex: '1 1 160px', padding: '8px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Por Tipo</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {Object.entries(metricas.byTipo).map(([st, cnt]) => (
                  <span key={st} onClick={() => setFilterTipo(filterTipo === st ? '' : st)} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, cursor: 'pointer', border: '1px solid #e2e8f0', background: filterTipo === st ? '#fef9c3' : '#f8fafc', color: '#334155' }}>
                    {st} <span style={{ fontWeight: 900 }}>{cnt}</span>
                  </span>
                ))}
              </div>
            </div>
            {Object.values(prioridades).filter(Boolean).length > 0 && (
              <div style={{ flex: '0 0 auto', padding: '8px 14px', background: '#fff8ed', border: '1px solid #fde68a', borderRadius: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', marginBottom: 3 }}>Prioritários</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#d97706' }}>{Object.values(prioridades).filter(Boolean).length}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, padding: '8px 12px', background: '#f5f7fa', border: '1px solid #dce1e8', borderRadius: 6 }}>
        <div><label className="field-label">Filial</label><select className="input" value={filterFilial} onChange={(e) => setFilterFilial(e.target.value)} style={{ minWidth: 130 }}>{filiais.length !== 1 && <option value="">Todas</option>}{filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}</option>)}</select></div>
        <div><label className="field-label">Mês</label><select className="input" value={filterMes} onChange={(e) => setFilterMes(e.target.value)} style={{ minWidth: 110 }}><option value="">Todos</option>{mesesDisponiveis.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
        <div><label className="field-label">Tipo</label><select className="input" value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} style={{ minWidth: 140 }}><option value="">Todos</option>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        <div><label className="field-label">Status</label><select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ minWidth: 120 }}><option value="">Todos</option>{STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        {(filterFilial || filterMes || filterTipo || filterStatus) && (
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><button className="button-secondary" type="button" style={{ fontSize: 11 }} onClick={() => { setFilterFilial(''); setFilterMes(''); setFilterTipo(''); setFilterStatus('') }}>Limpar</button></div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end' }}><span style={{ fontSize: 11, color: 'var(--muted)' }}>{filtradas.length} reg.</span></div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Carregando…</div>
      ) : filtradas.length === 0 ? (
        <div className="surface-card empty-state"><strong>Nenhuma despesa</strong><p>As horas extras fora do contrato aparecem aqui automaticamente ao fechar o RTM.</p></div>
      ) : (
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 340px)', border: '1px solid #c8d2dc', borderRadius: 6 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, width: 'max-content', minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...XL_TH, width: 28 }} title="Prioridade / Ações">⋮</th>
                <th style={XL_TH}>#</th>
                <th style={XL_TH}>Unidade</th>
                <th style={XL_TH}>Tipo Despesa</th>
                <th style={XL_TH}>Contrato</th>
                <th style={XL_TH}>Competência</th>
                <th style={XL_TH}>Beneficiário / Empresa</th>
                <th style={XL_TH}>Nº Documento</th>
                <th style={XL_TH}>Descrição</th>
                <th style={{ ...XL_TH, textAlign: 'right' }}>Valor</th>
                <th style={{ ...XL_TH, textAlign: 'right' }}>Pago</th>
                <th style={{ ...XL_TH, textAlign: 'right' }}>Saldo</th>
                <th style={XL_TH}>Vencimento</th>
                <th style={XL_TH}>Dt. Pagamento</th>
                <th style={XL_TH}>Status</th>
                <th style={{ ...XL_TH, textAlign: 'center' }}>Open</th>
              </tr>
            </thead>
            <tbody>
              {filialGroups.map((g) => (
                <Fragment key={g.nome}>
                  <tr>
                    <td colSpan={16} style={{ ...XL, padding: '4px 10px', background: '#1e3a5f', color: '#fff', fontWeight: 800, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                      {g.nome} <span style={{ fontWeight: 400, fontSize: 10, opacity: .75 }}>— {g.rows.length} lançamento{g.rows.length !== 1 ? 's' : ''}</span>
                    </td>
                  </tr>
                  {g.rows.map((r, i) => {
                    const saldo = (r.valor || 0) - (r.valor_pago || 0)
                    const dias = (r.status !== 'PAGO' && r.status !== 'CANCELADO') ? diasAbertos(r.data_vencimento, hoje) : null
                    const isPrio = Boolean(prioridades[r.id])
                    const td = XL_TD(i)
                    const rowStyle = isPrio
                      ? { ...td, background: i % 2 === 0 ? '#fffbeb' : '#fef9c3', borderLeft: '3px solid #f59e0b' }
                      : td
                    return (
                      <tr key={r.id} style={{ cursor: 'default' }}>
                        <td style={{ ...XL, padding: '2px 4px', background: isPrio ? '#fef9c3' : (i % 2 === 0 ? '#fff' : '#f7f9fb'), textAlign: 'center', borderLeft: isPrio ? '3px solid #f59e0b' : undefined }}>
                          <button
                            type="button"
                            onClick={(e) => openCtxMenu(e, r)}
                            style={{ fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: isPrio ? '#d97706' : '#94a3b8', padding: '0 2px', lineHeight: 1 }}
                            title="Ações rápidas"
                          >
                            {isPrio ? '★' : '⋮'}
                          </button>
                        </td>
                        <td style={{ ...rowStyle, color: '#94a3b8', fontFamily: 'monospace' }}>{i + 1}</td>
                        <td style={{ ...rowStyle, fontWeight: 700 }}>{r.filial_nome || '—'}</td>
                        <td style={rowStyle}><span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 99, background: '#f0f4f8', color: '#334155', border: '1px solid #e2e8f0', fontWeight: 700 }}>{r.tipo_despesa}</span></td>
                        <td style={{ ...rowStyle, textAlign: 'center' }}><TipoChip v={r.tipo_hora} /></td>
                        <td style={{ ...rowStyle, fontFamily: 'monospace' }}>{fmtDate(r.competencia)}</td>
                        <td style={{ ...rowStyle, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, color: r.fornecedor_nome ? '#1e293b' : '#94a3b8' }} title={r.fornecedor_nome}>
                          {r.fornecedor_nome || (r.colaboradores_count ? `${r.colaboradores_count} colab.` : '—')}
                        </td>
                        <td style={{ ...rowStyle, fontFamily: 'monospace' }}>
                          {r.tipo_documento && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', marginRight: 4 }}>{r.tipo_documento}</span>}
                          {r.numero_documento || <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                        <td style={{ ...rowStyle, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.descricao}>
                          <div>{r.descricao || '—'}</div>
                          {r.observacoes && <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{r.observacoes}</div>}
                        </td>
                        <td style={{ ...rowStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtBRL(r.valor)}</td>
                        <td style={{ ...rowStyle, textAlign: 'right', fontFamily: 'monospace', color: '#059669' }}>{r.valor_pago ? fmtBRL(r.valor_pago) : '—'}</td>
                        <td style={{ ...rowStyle, textAlign: 'right', fontFamily: 'monospace', color: saldo > 0 ? '#dc2626' : '#059669', fontWeight: saldo > 0 ? 700 : 400 }}>{fmtBRL(saldo)}</td>
                        <td style={{ ...rowStyle, fontFamily: 'monospace', color: (dias !== null && dias > 0) ? '#dc2626' : '#555', fontWeight: (dias !== null && dias > 0) ? 700 : 400 }}>{fmtDate(r.data_vencimento)}</td>
                        <td style={{ ...rowStyle, fontFamily: 'monospace' }}>{fmtDate(r.data_pagamento)}</td>
                        <td style={rowStyle}><StatusChip v={r.status} /></td>
                        <td style={{ ...rowStyle, textAlign: 'center' }}><OpenBadge dias={dias} /></td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: '#dce8f5', fontWeight: 700 }}>
                    <td style={{ ...XL, padding: '3px 7px', fontSize: 10, color: '#1e3a5f' }} colSpan={9}>Subtotal — {g.nome}</td>
                    <td style={{ ...XL, padding: '3px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11 }}>{fmtBRL(g.totais.valor)}</td>
                    <td style={{ ...XL, padding: '3px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11, color: '#059669' }}>{fmtBRL(g.totais.pago)}</td>
                    <td style={{ ...XL, padding: '3px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11, color: g.totais.saldo > 0 ? '#dc2626' : '#059669' }}>{fmtBRL(g.totais.saldo)}</td>
                    <td style={XL} colSpan={4} />
                  </tr>
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#e8edf2', fontWeight: 700, position: 'sticky', bottom: 0 }}>
                <td style={{ ...XL, padding: '4px 7px', fontSize: 11 }} colSpan={9}>TOTAIS — {filtradas.length} lançamentos</td>
                <td style={{ ...XL, padding: '4px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtBRL(totais.valor)}</td>
                <td style={{ ...XL, padding: '4px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: '#059669' }}>{fmtBRL(totais.pago)}</td>
                <td style={{ ...XL, padding: '4px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: totais.saldo > 0 ? '#dc2626' : '#059669' }}>{fmtBRL(totais.saldo)}</td>
                <td style={XL} colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          style={{
            position: 'fixed',
            top: Math.min(ctxMenu.y, window.innerHeight - 280),
            left: Math.min(ctxMenu.x, window.innerWidth - 220),
            zIndex: 2000,
            background: '#fff',
            border: '1px solid #c7d2e0',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,.14)',
            minWidth: 210,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '8px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700, color: '#334155' }}>
            {ctxMenu.row.filial_nome || '—'} · {fmtDate(ctxMenu.row.competencia)}
          </div>
          {[
            { label: '✎ Editar', action: () => abrirEdicao(ctxMenu.row), color: '#1e3a5f' },
            { label: prioridades[ctxMenu.row.id] ? '★ Remover prioridade' : '☆ Marcar como prioritário', action: () => togglePrioridade(ctxMenu.row.id), color: '#d97706' },
            null,
            ctxMenu.row.status !== 'PAGO' ? { label: '✔ Marcar como Pago', action: () => quickStatus(ctxMenu.row.id, 'PAGO'), color: '#059669' } : null,
            ctxMenu.row.status !== 'PENDENTE' ? { label: '→ Marcar como Pendente', action: () => quickStatus(ctxMenu.row.id, 'PENDENTE'), color: '#d97706' } : null,
            ctxMenu.row.status !== 'FINALIZADO' ? { label: '⚑ Finalizar', action: () => quickStatus(ctxMenu.row.id, 'FINALIZADO'), color: '#4338ca' } : null,
            ctxMenu.row.status !== 'CANCELADO' ? { label: '⊘ Cancelar', action: () => quickStatus(ctxMenu.row.id, 'CANCELADO'), color: '#64748b' } : null,
            null,
            { label: '✕ Excluir', action: () => deletar(ctxMenu.row.id), color: '#dc2626' },
          ].map((item, idx) => {
            if (item === null) return <div key={idx} style={{ height: 1, background: '#e2e8f0', margin: '2px 0' }} />
            if (!item) return null
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: item.color, fontWeight: 600 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Modal de edição */}
      {editId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="surface-card" style={{ maxWidth: 860, width: '100%', margin: 16, maxHeight: '92vh', overflowY: 'auto', borderTop: '4px solid #dc2626' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>Editando lançamento</div>
                <h3 style={{ margin: 0, color: '#1e3a5f' }}>{editForm.filial_nome} — {editForm.tipo_despesa}</h3>
                <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {editForm.competencia && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 600 }}>{fmtDate(editForm.competencia)}</span>}
                  {editForm.fornecedor_nome && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0', fontWeight: 600 }}>{editForm.fornecedor_nome}</span>}
                  <StatusChip v={editForm.status} />
                </div>
              </div>
              <button className="button-secondary" style={{ fontSize: 11 }} onClick={() => setEditId(null)}>✕ Cancelar</button>
            </div>

            {/* Identificação */}
            <div style={{ marginBottom: 16, padding: '12px 14px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <SectionHeader title="Identificação" color="#1e40af" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <div style={{ gridColumn: '1/3' }}>
                  <ModalField label="Tipo de Despesa"><ModalInput value={ef('tipo_despesa')} onChange={(v) => setF('tipo_despesa', v)} opts={TIPOS} /></ModalField>
                </div>
                <div><ModalField label="Contrato"><ModalInput value={ef('tipo_hora')} onChange={(v) => setF('tipo_hora', v)} opts={['fixo', 'extra']} /></ModalField></div>
                <div><ModalField label="Competência"><ModalInput value={ef('competencia')} onChange={(v) => setF('competencia', v)} type="date" /></ModalField></div>
              </div>
            </div>

            {/* Beneficiário / Documento */}
            <div style={{ marginBottom: 16, padding: '12px 14px', background: '#fefce8', borderRadius: 6, border: '1px solid #fde68a' }}>
              <SectionHeader title="Beneficiário e Documento" color="#ca8a04" />
              <datalist id="dl-fornecedores-cp-edit">{fornecedoresDB.map((f) => <option key={f.id} value={f.nome} />)}</datalist>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <div style={{ gridColumn: '1/3' }}>
                  <ModalField label="Beneficiário / Empresa">
                    <ModalInput value={ef('fornecedor_nome')} onChange={(v) => setF('fornecedor_nome', v)} list="dl-fornecedores-cp-edit" placeholder="Nome do fornecedor ou colaborador" />
                  </ModalField>
                </div>
                <div><ModalField label="Tipo de Documento"><ModalInput value={ef('tipo_documento')} onChange={(v) => setF('tipo_documento', v)} opts={TIPO_DOCS} /></ModalField></div>
                <div><ModalField label="Nº do Documento"><ModalInput value={ef('numero_documento')} onChange={(v) => setF('numero_documento', v)} style={{ fontFamily: 'monospace' }} /></ModalField></div>
                <div style={{ gridColumn: '1/-1' }}><ModalField label="Descrição"><ModalInput value={ef('descricao')} onChange={(v) => setF('descricao', v)} placeholder="Ex: Horas Extras Fora Contrato – Abril/2026" /></ModalField></div>
                <div style={{ gridColumn: '1/-1' }}><ModalField label="Observações"><ModalInput value={ef('observacoes')} onChange={(v) => setF('observacoes', v)} type="textarea" /></ModalField></div>
              </div>
            </div>

            {/* Valores */}
            <div style={{ marginBottom: 16, padding: '12px 14px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca' }}>
              <SectionHeader title="Valores Financeiros" color="#dc2626" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <div><ModalField label="Valor (R$)"><ModalInput value={ef('valor')} onChange={(v) => setF('valor', v)} type="number" /></ModalField></div>
                <div><ModalField label="Valor Pago (R$)"><ModalInput value={ef('valor_pago')} onChange={(v) => setF('valor_pago', v)} type="number" /></ModalField></div>
                <div><ModalField label="Vencimento"><ModalInput value={ef('data_vencimento')} onChange={(v) => setF('data_vencimento', v)} type="date" /></ModalField></div>
                <div><ModalField label="Data Pagamento"><ModalInput value={ef('data_pagamento')} onChange={(v) => setF('data_pagamento', v)} type="date" /></ModalField></div>
              </div>
            </div>

            {/* Status */}
            <div style={{ marginBottom: 16, padding: '12px 14px', background: '#fff7ed', borderRadius: 6, border: '1px solid #fed7aa' }}>
              <SectionHeader title="Status" color="#ea580c" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <div><ModalField label="Status"><ModalInput value={ef('status')} onChange={(v) => setF('status', v)} opts={STATUS_OPTS} /></ModalField></div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
              <button className="button-secondary" type="button" onClick={() => setEditId(null)}>Cancelar</button>
              <button className="button-primary" type="button" onClick={salvarEdicao} disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nova despesa */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="surface-card" style={{ maxWidth: 600, width: '100%', margin: 16, maxHeight: '90vh', overflowY: 'auto', borderTop: '4px solid #dc2626' }}>
            <h3 style={{ marginTop: 0 }}>Nova Despesa a Pagar</h3>
            <datalist id="dl-fornecedores-cp">{fornecedoresDB.map((f) => <option key={f.id} value={f.nome} />)}</datalist>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="field-label">Filial *</label>
                <select className="input" value={newForm.filial_id || ''} onChange={(e) => setNewForm((p) => ({ ...p, filial_id: parseInt(e.target.value), filial_nome: filiais.find((f) => f.id === parseInt(e.target.value))?.cidade || '' }))}>
                  <option value="">Selecione</option>
                  {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Competência *</label>
                <input type="date" className="input" value={newForm.competencia || ''} onChange={(e) => setNewForm((p) => ({ ...p, competencia: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Tipo de Despesa *</label>
                <select className="input" value={newForm.tipo_despesa || ''} onChange={(e) => setNewForm((p) => ({ ...p, tipo_despesa: e.target.value }))}>
                  {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Valor *</label>
                <input type="number" step="0.01" className="input" value={newForm.valor || ''} onChange={(e) => setNewForm((p) => ({ ...p, valor: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field-label">Beneficiário / Empresa</label>
                <input list="dl-fornecedores-cp" className="input" value={newForm.fornecedor_nome || ''} onChange={(e) => setNewForm((p) => ({ ...p, fornecedor_nome: e.target.value }))} placeholder="Ex: João da Silva, Hotel XYZ, Posto ABC…" />
              </div>
              <div>
                <label className="field-label">Tipo de Documento</label>
                <select className="input" value={newForm.tipo_documento || ''} onChange={(e) => setNewForm((p) => ({ ...p, tipo_documento: e.target.value }))}>
                  <option value="">—</option>
                  {TIPO_DOCS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Nº do Documento</label>
                <input className="input" value={newForm.numero_documento || ''} onChange={(e) => setNewForm((p) => ({ ...p, numero_documento: e.target.value }))} placeholder="Ex: 001234" style={{ fontFamily: 'monospace' }} />
              </div>
              <div>
                <label className="field-label">Vencimento</label>
                <input type="date" className="input" value={newForm.data_vencimento || ''} onChange={(e) => setNewForm((p) => ({ ...p, data_vencimento: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Status</label>
                <select className="input" value={newForm.status || 'PENDENTE'} onChange={(e) => setNewForm((p) => ({ ...p, status: e.target.value }))}>
                  {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field-label">Descrição</label>
                <input className="input" value={newForm.descricao || ''} onChange={(e) => setNewForm((p) => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Horas Extras Fora Contrato – Abril/2026 – Belém" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field-label">Observações</label>
                <textarea className="input" rows={2} value={newForm.observacoes || ''} onChange={(e) => setNewForm((p) => ({ ...p, observacoes: e.target.value }))} placeholder="Informações adicionais, referências, protocolo interno…" style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="button-secondary" type="button" onClick={() => setShowNew(false)}>Cancelar</button>
              <button className="button-primary" type="button" onClick={criarNovo} disabled={creatingNew}>{creatingNew ? 'Salvando…' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

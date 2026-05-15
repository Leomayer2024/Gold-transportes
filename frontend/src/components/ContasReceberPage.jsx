import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { api } from '../services/api'

const OBRIGACOES = ['HORA EXTRA', 'KM RODADO', 'HOSPEDAGEM', 'PEDAGIO', 'DESPESAS EXTRAS', 'OUTRO']
const STATUS_FAT = ['NÃO FATURADO', 'FATURADO', 'PARCIAL']
const STATUS_OPTS = ['AGUARDANDO', 'AGUARDANDO PEDIDO DO CLIENTE', 'COBRANÇA REALIZADA', 'FALTA COBRAR', 'RECEBIDO']
const FERRAMENTAS = ['SISTEMA SASCAR DA WHITE', 'GW SISTEMAS - C.APAGAR', 'E-MAIL RH (ENVIO APÓS O PAG.)', 'PLANILHA DE CONTRATOS', 'OUTRO']
const TIPO_DOC = ['ND', 'CTE']

const XL = { border: '1px solid #d1d5db' }
const XL_TH = { ...XL, padding: '4px 7px', background: '#e8edf2', fontWeight: 700, whiteSpace: 'nowrap', fontSize: 11, position: 'sticky', top: 0, zIndex: 2 }
const XL_TD = (i) => ({ ...XL, padding: '3px 7px', background: i % 2 === 0 ? '#fff' : '#f7f9fb', fontSize: 11, whiteSpace: 'nowrap' })

function fmtBRL(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0) }
function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function diasAbertos(data_limite, hoje) {
  if (!data_limite) return null
  const ms = new Date(hoje) - new Date(data_limite)
  return Math.floor(ms / 86400000)
}
function pct(a, b) { return b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '—' }

function StatusFatChip({ v }) {
  const map = { 'FATURADO': ['#059669', '#f0fdf4'], 'NÃO FATURADO': ['#d97706', '#fffbeb'], 'PARCIAL': ['#7c3aed', '#f5f3ff'] }
  const [c, bg] = map[v] || ['#64748b', '#f8fafc']
  return <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: bg, color: c, border: `1px solid ${c}44` }}>{v || '—'}</span>
}
function StatusChip({ v }) {
  const map = { 'RECEBIDO': ['#059669', '#f0fdf4'], 'COBRANÇA REALIZADA': ['#0369a1', '#eff6ff'], 'FALTA COBRAR': ['#dc2626', '#fef2f2'], 'AGUARDANDO': ['#d97706', '#fffbeb'], 'AGUARDANDO PEDIDO DO CLIENTE': ['#7c3aed', '#f5f3ff'] }
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
function ModalInput({ value, onChange, type = 'text', opts, style = {} }) {
  const base = { fontSize: 12, padding: '5px 8px', border: '1px solid #c7d2e0', borderRadius: 5, background: '#fff', width: '100%', boxSizing: 'border-box', ...style }
  if (opts) return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={base}>
      <option value="">—</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  if (type === 'number') return <input type="number" step="0.01" value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={{ ...base, textAlign: 'right' }} />
  return <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} style={base} />
}

export default function ContasReceberPage() {
  const [rows, setRows] = useState([])
  const [alertas, setAlertas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filiais, setFiliais] = useState([])

  const [filterFilial, setFilterFilial] = useState('')
  const [filterObrigacao, setFilterObrigacao] = useState('')
  const [filterMes, setFilterMes] = useState('')
  const [filterStatusFat, setFilterStatusFat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ obrigacao: 'HORA EXTRA', status_fat: 'NÃO FATURADO', status: 'FALTA COBRAR', limite_dia: 10 })
  const [creatingNew, setCreatingNew] = useState(false)

  const [ctxMenu, setCtxMenu] = useState(null) // { row, x, y }
  const [showMetricas, setShowMetricas] = useState(true)
  const [prioridades, setPrioridades] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cr-prioridade') || '{}') } catch { return {} }
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
    Promise.all([api.contasReceber(), api.contasReceberAlertas(), api.list('filiais', { limit: 500 })])
      .then(([cr, al, fil]) => { setRows(cr.data || []); setAlertas(al); setFiliais(fil.items || fil || []) })
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
    if (filterObrigacao && r.obrigacao !== filterObrigacao) return false
    if (filterMes && r.competencia?.slice(0, 7) !== filterMes) return false
    if (filterStatusFat && r.status_fat !== filterStatusFat) return false
    if (filterStatus && r.status !== filterStatus) return false
    return true
  }), [rows, filiais, filterFilial, filterObrigacao, filterMes, filterStatusFat, filterStatus])

  const metricas = useMemo(() => {
    const vlr = filtradas.reduce((s, r) => s + (r.valor_gold || 0), 0)
    const cobrado = filtradas.reduce((s, r) => s + (r.cobrado_wm || 0), 0)
    const ajustado = filtradas.reduce((s, r) => s + (r.vlr_ajustado_wm || 0), 0)
    const byStatus = {}
    for (const r of filtradas) byStatus[r.status] = (byStatus[r.status] || 0) + 1
    const byFat = {}
    for (const r of filtradas) byFat[r.status_fat] = (byFat[r.status_fat] || 0) + 1
    return { vlr, cobrado, ajustado, byStatus, byFat, n: filtradas.length }
  }, [filtradas])

  const totais = useMemo(() => ({
    valor_gold: filtradas.reduce((s, r) => s + (r.valor_gold || 0), 0),
    cobrado_wm: filtradas.reduce((s, r) => s + (r.cobrado_wm || 0), 0),
    vlr_ajustado_wm: filtradas.reduce((s, r) => s + (r.vlr_ajustado_wm || 0), 0),
    frete: filtradas.reduce((s, r) => s + (r.frete || 0), 0),
    vlr_cte: filtradas.reduce((s, r) => s + (r.vlr_cte || 0), 0),
  }), [filtradas])

  const filialGroups = useMemo(() => {
    const map = new Map()
    filtradas.forEach((r) => {
      const key = r.filial_nome || r.filial_id || 'sem_filial'
      if (!map.has(key)) map.set(key, { nome: r.filial_nome || `Filial ${r.filial_id}`, rows: [], totais: { valor_gold: 0, cobrado_wm: 0, vlr_ajustado_wm: 0, frete: 0, vlr_cte: 0 } })
      const g = map.get(key)
      g.rows.push(r)
      g.totais.valor_gold += r.valor_gold || 0
      g.totais.cobrado_wm += r.cobrado_wm || 0
      g.totais.vlr_ajustado_wm += r.vlr_ajustado_wm || 0
      g.totais.frete += r.frete || 0
      g.totais.vlr_cte += r.vlr_cte || 0
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
    setPrioridades(p => {
      const next = { ...p, [id]: !p[id] }
      localStorage.setItem('cr-prioridade', JSON.stringify(next))
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
    try { await api.editarContaReceber(id, { status }); carregar() }
    catch (err) { alert(err.message || 'Erro.') }
    setCtxMenu(null)
  }

  async function salvarEdicao() {
    setSaving(true)
    try { await api.editarContaReceber(editId, editForm); setEditId(null); carregar() }
    catch (e) { alert(e.message || 'Erro ao salvar.') }
    finally { setSaving(false) }
  }

  async function deletar(id) {
    if (!confirm('Excluir este lançamento?')) return
    setCtxMenu(null)
    try { await api.deletarContaReceber(id); carregar() }
    catch (e) { alert(e.message || 'Erro ao excluir.') }
  }

  async function criarNovo() {
    if (!newForm.filial_id || !newForm.competencia || !newForm.obrigacao) {
      alert('Filial, competência e obrigação são obrigatórios.'); return
    }
    setCreatingNew(true)
    try {
      await api.criarContaReceber(newForm)
      setShowNew(false)
      setNewForm({ obrigacao: 'HORA EXTRA', status_fat: 'NÃO FATURADO', status: 'FALTA COBRAR', limite_dia: 10 })
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
          <h1>Contas a Receber</h1>
          <p>Obrigações de clientes — horas extras no contrato, KM, hospedagem, pedágio e despesas</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={metBtnSt} onClick={() => setShowMetricas(m => !m)}>
            {showMetricas ? '▲ Métricas' : '▼ Métricas'}
          </button>
          <button className="button-primary" onClick={() => setShowNew(true)} type="button">+ Nova obrigação</button>
        </div>
      </div>

      {/* Alertas */}
      {alertas && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <AlertaCard label="Total a Receber" value={fmtBRL(alertas.total_a_receber)} sub="cobrado cliente pendente" color="var(--success)" bg="#f0fdf4" />
          <AlertaCard label="Não Faturado" value={alertas.nao_faturado} sub="sem fatura" color="#d97706" bg="#fffbeb" warn={alertas.nao_faturado > 5} />
          <AlertaCard label="Falta Cobrar" value={alertas.falta_cobrar} sub="cobrança não enviada" color="#7c3aed" bg="#f5f3ff" warn={alertas.falta_cobrar > 0} />
          <AlertaCard label="Vencidos" value={alertas.vencidos} sub="prazo ultrapassado" color="#dc2626" bg="#fef2f2" warn={alertas.vencidos > 0} />
          <AlertaCard label="Pend. Autorização" value={alertas.pendentes_autorizacao} sub="campo 'o que falta'" color="#0369a1" bg="#f0f9ff" warn={alertas.pendentes_autorizacao > 0} />
        </div>
      )}

      {/* Métricas detalhadas */}
      {showMetricas && filtradas.length > 0 && (
        <div style={{ marginBottom: 10, padding: '12px 16px', background: '#f8fafc', border: '1px solid #dce1e8', borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: 8, letterSpacing: '.06em' }}>
            Métricas — {metricas.n} lançamentos com os filtros atuais
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {/* Valores */}
            <div style={{ flex: '0 0 auto', padding: '8px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, minWidth: 140 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3 }}>Valor Gold</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#1e40af', fontFamily: 'monospace' }}>{fmtBRL(metricas.vlr)}</div>
            </div>
            <div style={{ flex: '0 0 auto', padding: '8px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, minWidth: 140 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3 }}>Cobrado Cliente</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#059669', fontFamily: 'monospace' }}>{fmtBRL(metricas.cobrado)}</div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>recuperação: {pct(metricas.cobrado, metricas.vlr)}</div>
            </div>
            <div style={{ flex: '0 0 auto', padding: '8px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, minWidth: 140 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3 }}>Diferença Gold-Cliente</div>
              <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: (metricas.vlr - metricas.ajustado) > 0 ? '#059669' : '#dc2626' }}>{fmtBRL(metricas.vlr - metricas.ajustado)}</div>
            </div>
            {/* Status breakdown */}
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
            {/* Faturamento breakdown */}
            <div style={{ flex: '1 1 160px', padding: '8px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Faturamento</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {Object.entries(metricas.byFat).map(([st, cnt]) => (
                  <span key={st} onClick={() => setFilterStatusFat(filterStatusFat === st ? '' : st)} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, cursor: 'pointer', border: '1px solid #e2e8f0', background: filterStatusFat === st ? '#fef9c3' : '#f8fafc', color: '#334155' }}>
                    {st} <span style={{ fontWeight: 900 }}>{cnt}</span>
                  </span>
                ))}
              </div>
            </div>
            {/* Prioridades */}
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
        <div><label className="field-label">Obrigação</label><select className="input" value={filterObrigacao} onChange={(e) => setFilterObrigacao(e.target.value)} style={{ minWidth: 130 }}><option value="">Todas</option>{OBRIGACOES.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
        <div><label className="field-label">Status Fat.</label><select className="input" value={filterStatusFat} onChange={(e) => setFilterStatusFat(e.target.value)} style={{ minWidth: 120 }}><option value="">Todos</option>{STATUS_FAT.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label className="field-label">Status</label><select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ minWidth: 150 }}><option value="">Todos</option>{STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        {(filterFilial || filterMes || filterObrigacao || filterStatusFat || filterStatus) && (
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><button className="button-secondary" type="button" style={{ fontSize: 11 }} onClick={() => { setFilterFilial(''); setFilterMes(''); setFilterObrigacao(''); setFilterStatusFat(''); setFilterStatus('') }}>Limpar</button></div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end' }}><span style={{ fontSize: 11, color: 'var(--muted)' }}>{filtradas.length} reg.</span></div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Carregando…</div>
      ) : filtradas.length === 0 ? (
        <div className="surface-card empty-state"><strong>Nenhum lançamento</strong><p>Salve um fechamento RTM ou crie uma obrigação manualmente.</p></div>
      ) : (
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 340px)', border: '1px solid #c8d2dc', borderRadius: 6 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, width: 'max-content', minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...XL_TH, width: 28 }} title="Prioridade / Ações">⋮</th>
                <th style={XL_TH}>#</th>
                <th style={XL_TH}>Unidade</th>
                <th style={XL_TH}>Cliente</th>
                <th style={XL_TH}>Obrigação</th>
                <th style={XL_TH}>Contrato</th>
                <th style={XL_TH}>Competência</th>
                <th style={{ ...XL_TH, textAlign: 'right' }}>Vlr. Gold</th>
                <th style={XL_TH}>Dt. Pag. Gold</th>
                <th style={{ ...XL_TH, textAlign: 'right' }}>Cobrado Cliente</th>
                <th style={XL_TH}>Dt. Envio</th>
                <th style={{ ...XL_TH, textAlign: 'right' }}>Vlr. Ajustado</th>
                <th style={{ ...XL_TH, textAlign: 'right' }}>Dif Gold-Cli</th>
                <th style={{ ...XL_TH, textAlign: 'right' }}>Frete</th>
                <th style={{ ...XL_TH, textAlign: 'right' }}>Vlr CTE</th>
                <th style={XL_TH}>ND</th>
                <th style={XL_TH}>CTE</th>
                <th style={XL_TH}>Ferramenta</th>
                <th style={XL_TH}>Autorização</th>
                <th style={XL_TH}>O Que Falta?</th>
                <th style={XL_TH}>Setor</th>
                <th style={XL_TH}>Previsão</th>
                <th style={XL_TH}>Prazo Envio</th>
                <th style={XL_TH}>Status Fat.</th>
                <th style={XL_TH}>Status</th>
                <th style={XL_TH}>Dt. Limite</th>
                <th style={{ ...XL_TH, textAlign: 'center' }}>Open</th>
              </tr>
            </thead>
            <tbody>
              {filialGroups.map((g) => (
                <Fragment key={g.nome}>
                  <tr>
                    <td colSpan={27} style={{ ...XL, padding: '4px 10px', background: '#1e3a5f', color: '#fff', fontWeight: 800, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                      {g.nome} <span style={{ fontWeight: 400, fontSize: 10, opacity: .75 }}>— {g.rows.length} lançamento{g.rows.length !== 1 ? 's' : ''}</span>
                    </td>
                  </tr>
                  {g.rows.map((r, i) => {
                    const dif = (r.valor_gold || 0) - (r.vlr_ajustado_wm || 0)
                    const dias = diasAbertos(r.data_limite || r.data_vencimento, hoje)
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
                        <td style={{ ...rowStyle, color: r.cliente_nome ? '#0369a1' : '#cbd5e1', fontWeight: 600, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.cliente_nome}>{r.cliente_nome || '—'}</td>
                        <td style={rowStyle}>{r.obrigacao}</td>
                        <td style={{ ...rowStyle, textAlign: 'center' }}><TipoChip v={r.tipo_hora} /></td>
                        <td style={{ ...rowStyle, fontFamily: 'monospace' }}>{fmtDate(r.competencia)}</td>
                        <td style={{ ...rowStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{r.valor_gold ? fmtBRL(r.valor_gold) : '—'}</td>
                        <td style={{ ...rowStyle, fontFamily: 'monospace' }}>{fmtDate(r.data_pagamento_gold)}</td>
                        <td style={{ ...rowStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: r.cobrado_wm ? 700 : 400 }}>{r.cobrado_wm ? fmtBRL(r.cobrado_wm) : '—'}</td>
                        <td style={{ ...rowStyle, fontFamily: 'monospace' }}>{fmtDate(r.data_envio)}</td>
                        <td style={{ ...rowStyle, textAlign: 'right', fontFamily: 'monospace' }}>{r.vlr_ajustado_wm ? fmtBRL(r.vlr_ajustado_wm) : '—'}</td>
                        <td style={{ ...rowStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: dif < 0 ? '#dc2626' : dif > 0 ? '#059669' : '#999' }}>{fmtBRL(dif)}</td>
                        <td style={{ ...rowStyle, textAlign: 'right', fontFamily: 'monospace' }}>{r.frete ? fmtBRL(r.frete) : '—'}</td>
                        <td style={{ ...rowStyle, textAlign: 'right', fontFamily: 'monospace' }}>{r.vlr_cte ? fmtBRL(r.vlr_cte) : '—'}</td>
                        <td style={{ ...rowStyle, fontFamily: 'monospace' }}>{r.nd || '—'}</td>
                        <td style={{ ...rowStyle, fontFamily: 'monospace' }}>{r.cte || '—'}</td>
                        <td style={{ ...rowStyle, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.ferramenta}>{r.ferramenta || '—'}</td>
                        <td style={{ ...rowStyle, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.autorizacao}>{r.autorizacao || '—'}</td>
                        <td style={rowStyle}>
                          {r.o_que_falta
                            ? <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 99, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', fontWeight: 700 }}>{r.o_que_falta}</span>
                            : <span style={{ color: '#ccc' }}>—</span>}
                        </td>
                        <td style={{ ...rowStyle, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.setor_responsavel}>{r.setor_responsavel || '—'}</td>
                        <td style={{ ...rowStyle, fontFamily: 'monospace' }}>{fmtDate(r.previsao)}</td>
                        <td style={{ ...rowStyle, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', color: '#7c3aed', fontSize: 10 }} title={r.prazo_envio}>{r.prazo_envio || '—'}</td>
                        <td style={rowStyle}><StatusFatChip v={r.status_fat} /></td>
                        <td style={rowStyle}><StatusChip v={r.status} /></td>
                        <td style={{ ...rowStyle, fontFamily: 'monospace', color: dias > 0 ? '#dc2626' : '#555' }}>{fmtDate(r.data_limite || r.data_vencimento)}</td>
                        <td style={{ ...rowStyle, textAlign: 'center' }}><OpenBadge dias={dias} /></td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: '#dce8f5', fontWeight: 700 }}>
                    <td style={{ ...XL, padding: '3px 7px', fontSize: 10, color: '#1e3a5f' }} colSpan={7}>Subtotal — {g.nome}</td>
                    <td style={{ ...XL, padding: '3px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11 }}>{fmtBRL(g.totais.valor_gold)}</td>
                    <td style={XL} />
                    <td style={{ ...XL, padding: '3px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11, color: 'var(--success)' }}>{fmtBRL(g.totais.cobrado_wm)}</td>
                    <td style={XL} />
                    <td style={{ ...XL, padding: '3px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11 }}>{fmtBRL(g.totais.vlr_ajustado_wm)}</td>
                    <td style={{ ...XL, padding: '3px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11, color: (g.totais.valor_gold - g.totais.vlr_ajustado_wm) < 0 ? '#dc2626' : '#059669' }}>{fmtBRL(g.totais.valor_gold - g.totais.vlr_ajustado_wm)}</td>
                    <td style={{ ...XL, padding: '3px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11 }}>{fmtBRL(g.totais.frete)}</td>
                    <td style={{ ...XL, padding: '3px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11 }}>{fmtBRL(g.totais.vlr_cte)}</td>
                    <td style={XL} colSpan={13} />
                  </tr>
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#e8edf2', fontWeight: 700, position: 'sticky', bottom: 0 }}>
                <td style={{ ...XL, padding: '4px 7px', fontSize: 11 }} colSpan={7}>TOTAIS — {filtradas.length} lançamentos</td>
                <td style={{ ...XL, padding: '4px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtBRL(totais.valor_gold)}</td>
                <td style={XL} />
                <td style={{ ...XL, padding: '4px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: 'var(--success)' }}>{fmtBRL(totais.cobrado_wm)}</td>
                <td style={XL} />
                <td style={{ ...XL, padding: '4px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtBRL(totais.vlr_ajustado_wm)}</td>
                <td style={{ ...XL, padding: '4px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: (totais.valor_gold - totais.vlr_ajustado_wm) < 0 ? '#dc2626' : '#059669' }}>{fmtBRL(totais.valor_gold - totais.vlr_ajustado_wm)}</td>
                <td style={{ ...XL, padding: '4px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtBRL(totais.frete)}</td>
                <td style={{ ...XL, padding: '4px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtBRL(totais.vlr_cte)}</td>
                <td style={XL} colSpan={13} />
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
            top: Math.min(ctxMenu.y, window.innerHeight - 260),
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
          {/* header */}
          <div style={{ padding: '8px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700, color: '#334155' }}>
            {ctxMenu.row.filial_nome || '—'} · {fmtDate(ctxMenu.row.competencia)}
          </div>
          {/* actions */}
          {[
            { label: '✎ Editar', action: () => abrirEdicao(ctxMenu.row), color: '#1e3a5f' },
            { label: prioridades[ctxMenu.row.id] ? '★ Remover prioridade' : '☆ Marcar como prioritário', action: () => togglePrioridade(ctxMenu.row.id), color: '#d97706' },
            null, // divider
            { label: '✔ Marcar Recebido', action: () => quickStatus(ctxMenu.row.id, 'RECEBIDO'), color: '#059669' },
            { label: '→ Cobrança Realizada', action: () => quickStatus(ctxMenu.row.id, 'COBRANÇA REALIZADA'), color: '#0369a1' },
            { label: '⚑ Falta Cobrar', action: () => quickStatus(ctxMenu.row.id, 'FALTA COBRAR'), color: '#7c3aed' },
            { label: '⏳ Aguardando', action: () => quickStatus(ctxMenu.row.id, 'AGUARDANDO'), color: '#d97706' },
            null,
            { label: '✕ Excluir', action: () => deletar(ctxMenu.row.id), color: '#dc2626' },
          ].map((item, idx) =>
            item === null
              ? <div key={idx} style={{ height: 1, background: '#e2e8f0', margin: '2px 0' }} />
              : (
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
          )}
        </div>
      )}

      {/* Modal de edição */}
      {editId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="surface-card" style={{ maxWidth: 900, width: '100%', margin: 16, maxHeight: '92vh', overflowY: 'auto', borderTop: '4px solid #1e40af' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>Editando lançamento</div>
                <h3 style={{ margin: 0, color: '#1e3a5f' }}>{editForm.filial_nome} — {editForm.obrigacao}</h3>
                <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {editForm.competencia && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 600 }}>{fmtDate(editForm.competencia)}</span>}
                  {editForm.cliente_nome && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0', fontWeight: 600 }}>{editForm.cliente_nome}</span>}
                  <StatusChip v={editForm.status} />
                  <StatusFatChip v={editForm.status_fat} />
                </div>
              </div>
              <button className="button-secondary" style={{ fontSize: 11 }} onClick={() => setEditId(null)}>✕ Cancelar</button>
            </div>

            {/* Identificação */}
            <div style={{ marginBottom: 16, padding: '12px 14px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <SectionHeader title="Identificação" color="#1e40af" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <div style={{ gridColumn: '1/3' }}>
                  <ModalField label="Obrigação"><ModalInput value={ef('obrigacao')} onChange={(v) => setF('obrigacao', v)} opts={OBRIGACOES} /></ModalField>
                </div>
                <div><ModalField label="Tipo"><ModalInput value={ef('tipo_hora')} onChange={(v) => setF('tipo_hora', v)} opts={['fixo', 'extra']} /></ModalField></div>
                <div><ModalField label="Competência"><ModalInput value={ef('competencia')} onChange={(v) => setF('competencia', v)} type="date" /></ModalField></div>
                <div style={{ gridColumn: '1/3' }}><ModalField label="Cliente / Empresa"><ModalInput value={ef('cliente_nome')} onChange={(v) => setF('cliente_nome', v)} /></ModalField></div>
                <div style={{ gridColumn: '3/5' }}><ModalField label="Contrato / Referência"><ModalInput value={ef('contrato_nome')} onChange={(v) => setF('contrato_nome', v)} /></ModalField></div>
              </div>
            </div>

            {/* Valores */}
            <div style={{ marginBottom: 16, padding: '12px 14px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
              <SectionHeader title="Valores Financeiros" color="#059669" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                <div><ModalField label="Vlr. Gold (R$)"><ModalInput value={ef('valor_gold')} onChange={(v) => setF('valor_gold', v)} type="number" /></ModalField></div>
                <div><ModalField label="Dt. Pag. Gold"><ModalInput value={ef('data_pagamento_gold')} onChange={(v) => setF('data_pagamento_gold', v)} type="date" /></ModalField></div>
                <div><ModalField label="Cobrado Cliente (R$)"><ModalInput value={ef('cobrado_wm')} onChange={(v) => setF('cobrado_wm', v)} type="number" /></ModalField></div>
                <div><ModalField label="Vlr. Ajustado (R$)"><ModalInput value={ef('vlr_ajustado_wm')} onChange={(v) => setF('vlr_ajustado_wm', v)} type="number" /></ModalField></div>
                <div><ModalField label="Dt. Ajuste"><ModalInput value={ef('data_ajuste')} onChange={(v) => setF('data_ajuste', v)} type="date" /></ModalField></div>
                <div><ModalField label="Frete (R$)"><ModalInput value={ef('frete')} onChange={(v) => setF('frete', v)} type="number" /></ModalField></div>
                <div><ModalField label="Vlr CTE (R$)"><ModalInput value={ef('vlr_cte')} onChange={(v) => setF('vlr_cte', v)} type="number" /></ModalField></div>
                <div><ModalField label="Vlr. Fixo ICMS (R$)"><ModalInput value={ef('vlr_fixo_icms')} onChange={(v) => setF('vlr_fixo_icms', v)} type="number" /></ModalField></div>
                <div><ModalField label="Dt. Envio"><ModalInput value={ef('data_envio')} onChange={(v) => setF('data_envio', v)} type="date" /></ModalField></div>
                <div><ModalField label="Emissão"><ModalInput value={ef('emissao')} onChange={(v) => setF('emissao', v)} type="date" /></ModalField></div>
              </div>
            </div>

            {/* Documentação */}
            <div style={{ marginBottom: 16, padding: '12px 14px', background: '#fefce8', borderRadius: 6, border: '1px solid #fde68a' }}>
              <SectionHeader title="Documentação" color="#ca8a04" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <div><ModalField label="ND"><ModalInput value={ef('nd')} onChange={(v) => setF('nd', v)} /></ModalField></div>
                <div><ModalField label="CTE"><ModalInput value={ef('cte')} onChange={(v) => setF('cte', v)} /></ModalField></div>
                <div><ModalField label="Tipo Documento"><ModalInput value={ef('tipo_documento')} onChange={(v) => setF('tipo_documento', v)} opts={TIPO_DOC} /></ModalField></div>
                <div><ModalField label="Ferramenta"><ModalInput value={ef('ferramenta')} onChange={(v) => setF('ferramenta', v)} opts={FERRAMENTAS} /></ModalField></div>
                <div style={{ gridColumn: '1/3' }}><ModalField label="Prestação / Referência"><ModalInput value={ef('prestacao')} onChange={(v) => setF('prestacao', v)} /></ModalField></div>
                <div style={{ gridColumn: '3/5' }}><ModalField label="Contato"><ModalInput value={ef('contato')} onChange={(v) => setF('contato', v)} /></ModalField></div>
              </div>
            </div>

            {/* Acompanhamento */}
            <div style={{ marginBottom: 16, padding: '12px 14px', background: '#fdf4ff', borderRadius: 6, border: '1px solid #e9d5ff' }}>
              <SectionHeader title="Acompanhamento" color="#7c3aed" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <div><ModalField label="Double Check"><ModalInput value={ef('double_check')} onChange={(v) => setF('double_check', v)} /></ModalField></div>
                <div><ModalField label="Autorização"><ModalInput value={ef('autorizacao')} onChange={(v) => setF('autorizacao', v)} /></ModalField></div>
                <div><ModalField label="O Que Falta?"><ModalInput value={ef('o_que_falta')} onChange={(v) => setF('o_que_falta', v)} /></ModalField></div>
                <div><ModalField label="Motivo Pendência"><ModalInput value={ef('motivo_pendencia')} onChange={(v) => setF('motivo_pendencia', v)} /></ModalField></div>
                <div><ModalField label="Setor Responsável"><ModalInput value={ef('setor_responsavel')} onChange={(v) => setF('setor_responsavel', v)} /></ModalField></div>
                <div><ModalField label="Previsão"><ModalInput value={ef('previsao')} onChange={(v) => setF('previsao', v)} type="date" /></ModalField></div>
              </div>
            </div>

            {/* Status e Prazos */}
            <div style={{ marginBottom: 16, padding: '12px 14px', background: '#fff7ed', borderRadius: 6, border: '1px solid #fed7aa' }}>
              <SectionHeader title="Status e Prazos" color="#ea580c" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <div><ModalField label="Status Fat."><ModalInput value={ef('status_fat')} onChange={(v) => setF('status_fat', v)} opts={STATUS_FAT} /></ModalField></div>
                <div><ModalField label="Status"><ModalInput value={ef('status')} onChange={(v) => setF('status', v)} opts={STATUS_OPTS} /></ModalField></div>
                <div><ModalField label="Prazo de Envio"><ModalInput value={ef('prazo_envio')} onChange={(v) => setF('prazo_envio', v)} /></ModalField></div>
                <div><ModalField label="Limite (dia do mês)"><ModalInput value={ef('limite_dia')} onChange={(v) => setF('limite_dia', v)} type="number" /></ModalField></div>
                <div><ModalField label="Data Limite"><ModalInput value={ef('data_limite')} onChange={(v) => setF('data_limite', v)} type="date" /></ModalField></div>
                <div><ModalField label="Data Vencimento"><ModalInput value={ef('data_vencimento')} onChange={(v) => setF('data_vencimento', v)} type="date" /></ModalField></div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
              <button className="button-secondary" type="button" onClick={() => setEditId(null)}>Cancelar</button>
              <button className="button-primary" type="button" onClick={salvarEdicao} disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nova obrigação */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="surface-card" style={{ maxWidth: 600, width: '100%', margin: 16, maxHeight: '90vh', overflowY: 'auto', borderTop: '4px solid #059669' }}>
            <h3 style={{ marginTop: 0 }}>Nova Obrigação a Receber</h3>
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
                <label className="field-label">Obrigação *</label>
                <select className="input" value={newForm.obrigacao || ''} onChange={(e) => setNewForm((p) => ({ ...p, obrigacao: e.target.value }))}>
                  {OBRIGACOES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Tipo</label>
                <select className="input" value={newForm.tipo_hora || ''} onChange={(e) => setNewForm((p) => ({ ...p, tipo_hora: e.target.value }))}>
                  <option value="">—</option>
                  <option value="fixo">FIXO (cliente paga)</option>
                  <option value="extra">EXTRA (Gold absorve)</option>
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="field-label">Cliente / Empresa</label>
                <input className="input" value={newForm.cliente_nome || ''} onChange={(e) => setNewForm((p) => ({ ...p, cliente_nome: e.target.value }))} placeholder="Ex: WHITE MARTINS, AIR LIQUIDE, BOC GASES…" />
              </div>
              <div>
                <label className="field-label">Valor Gold (R$)</label>
                <input type="number" step="0.01" className="input" value={newForm.valor_gold || ''} onChange={(e) => setNewForm((p) => ({ ...p, valor_gold: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="field-label">Cobrado Cliente (R$)</label>
                <input type="number" step="0.01" className="input" value={newForm.cobrado_wm || ''} onChange={(e) => setNewForm((p) => ({ ...p, cobrado_wm: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="field-label">Status Faturamento</label>
                <select className="input" value={newForm.status_fat || 'NÃO FATURADO'} onChange={(e) => setNewForm((p) => ({ ...p, status_fat: e.target.value }))}>
                  {STATUS_FAT.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Status</label>
                <select className="input" value={newForm.status || 'FALTA COBRAR'} onChange={(e) => setNewForm((p) => ({ ...p, status: e.target.value }))}>
                  {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="field-label">Descrição</label>
                <input className="input" value={newForm.descricao || ''} onChange={(e) => setNewForm((p) => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Horas Extras Rota Cidade – Belém – Abril/2026" />
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

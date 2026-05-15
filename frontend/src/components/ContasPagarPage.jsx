import { Fragment, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { api } from '../services/api'

const TIPOS = ['HORAS EXTRAS', 'FORNECEDOR', 'COLABORADOR', 'HOSPEDAGEM', 'KM', 'PEDAGIO', 'DESPESAS EXTRAS', 'OUTRO']
const STATUS_OPTS = ['PENDENTE', 'PAGO', 'VENCIDO', 'CANCELADO']
const TIPO_DOCS = ['NF', 'BOLETO', 'RECIBO', 'PIX', 'TED', 'OUTRO']

const XL = { border: '1px solid #d1d5db' }
const XL_TH = { ...XL, padding: '4px 7px', background: '#e8edf2', fontWeight: 700, whiteSpace: 'nowrap', fontSize: 11, position: 'sticky', top: 0, zIndex: 2 }
const XL_TD = (i) => ({ ...XL, padding: '3px 7px', background: i % 2 === 0 ? '#fff' : '#f7f9fb', fontSize: 11, whiteSpace: 'nowrap' })

function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}
function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function AlertaCard({ label, value, sub, color, bg, warn }) {
  return (
    <div style={{ flex: '1 1 160px', minWidth: 160, padding: '14px 18px', background: bg || '#fff', border: `1.5px solid ${color}33`, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: warn ? '#dc2626' : color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function StatusChip({ v }) {
  const map = { PAGO: ['#059669', '#f0fdf4'], PENDENTE: ['#d97706', '#fffbeb'], VENCIDO: ['#dc2626', '#fef2f2'], CANCELADO: ['#64748b', '#f8fafc'] }
  const [c, bg] = map[v] || ['#64748b', '#f8fafc']
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: bg, color: c, border: `1px solid ${c}44` }}>{v || '—'}</span>
}

function TipoDocBadge({ tipo, numero }) {
  if (!tipo && !numero) return <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>
  return (
    <div style={{ fontSize: 11, lineHeight: 1.3 }}>
      {tipo && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', marginRight: 4 }}>{tipo}</span>}
      {numero && <span style={{ fontFamily: 'monospace', color: '#334155' }}>{numero}</span>}
    </div>
  )
}

function InlineInput({ value, onChange, type = 'text', style = {}, opts }) {
  if (opts) return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #c7d2e0', borderRadius: 5, background: '#fff', minWidth: 120, ...style }}>
      <option value="">—</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  if (type === 'date') return (
    <input type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #c7d2e0', borderRadius: 5, background: '#fff', width: 130, ...style }} />
  )
  if (type === 'number') return (
    <input type="number" step="0.01" value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #c7d2e0', borderRadius: 5, background: '#fff', width: 100, textAlign: 'right', ...style }} />
  )
  if (type === 'textarea') return (
    <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={2} style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #c7d2e0', borderRadius: 5, background: '#fff', width: '100%', resize: 'vertical', ...style }} />
  )
  return <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #c7d2e0', borderRadius: 5, background: '#fff', minWidth: 90, ...style }} />
}

function TipoChip({ v }) {
  if (!v) return <span style={{ color: '#cbd5e1', fontSize: 10 }}>—</span>
  const isFixo = v === 'fixo'
  return <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: isFixo ? '#eff6ff' : '#fef3c7', color: isFixo ? '#1d4ed8' : '#92400e', border: `1px solid ${isFixo ? '#bfdbfe' : '#fde68a'}` }}>{isFixo ? 'NO CONTRATO' : 'FORA CONTRATO'}</span>
}

function DetalheLabel({ label, value }) {
  return (
    <div style={{ minWidth: 140 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: '#1e293b' }}>{value || <span style={{ color: '#cbd5e1' }}>—</span>}</div>
    </div>
  )
}

export default function ContasPagarPage() {
  const [rows, setRows] = useState([])
  const [alertas, setAlertas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filiais, setFiliais] = useState([])

  const [filterFilial, setFilterFilial] = useState('')
  const [filterMes, setFilterMes] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    if (filiais?.length === 1 && !filterFilial) {
      setFilterFilial(String(filiais[0].id))
    }
  }, [filiais])

  const [editRow, setEditRow] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ tipo_despesa: 'HORAS EXTRAS', status: 'PENDENTE', valor: '' })
  const [creatingNew, setCreatingNew] = useState(false)

  const [detailRow, setDetailRow] = useState(null)
  const _loaded = useRef(false)

  const hoje = new Date().toISOString().split('T')[0]

  const carregar = useCallback(() => {
    if (!_loaded.current) setLoading(true)
    Promise.all([
      api.contasPagar(),
      api.contasPagarAlertas(),
      api.list('filiais', { limit: 500 }),
    ])
      .then(([cp, al, fil]) => {
        setRows(cp.data || [])
        setAlertas(al)
        setFiliais(fil.items || fil || [])
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
        // filial_nome is authoritative — filial_id may be stale/wrong from RTM fallback
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
    return [...map.values()].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  }, [filtradas])

  function setField(f, v) { setEditForm((p) => ({ ...p, [f]: v })) }

  async function salvarEdicao() {
    setSaving(true)
    try {
      await api.editarContaPagar(editRow, editForm)
      setEditRow(null)
      carregar()
    } catch (e) { alert(e.message || 'Erro ao salvar.') }
    finally { setSaving(false) }
  }

  async function marcarPago(id, valor) {
    try {
      await api.editarContaPagar(id, { status: 'PAGO', data_pagamento: hoje, valor_pago: valor })
      carregar()
    } catch (e) { alert(e.message || 'Erro.') }
  }

  async function deletar(id) {
    if (!confirm('Excluir este lançamento?')) return
    try {
      await api.deletarContaPagar(id)
      carregar()
    } catch (e) { alert(e.message || 'Erro ao excluir.') }
  }

  async function criarNovo() {
    if (!newForm.filial_id || !newForm.competencia || !newForm.tipo_despesa || !newForm.valor) {
      alert('Filial, competência, tipo e valor são obrigatórios.')
      return
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

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Financeiro</span>
          <h1>Contas a Pagar</h1>
          <p>Obrigações Gold — horas extras fora do contrato, fornecedores, hospedagens e outras despesas operacionais</p>
        </div>
        <button className="button-primary" onClick={() => setShowNew(true)} type="button">+ Nova despesa</button>
      </div>

      {/* Alertas */}
      {alertas && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <AlertaCard label="Total a Pagar" value={fmtBRL(alertas.total_a_pagar)} sub="saldo pendente" color="#dc2626" bg="#fef2f2" />
          <AlertaCard label="Pendentes" value={alertas.pendente} sub="aguardando pagamento" color="#d97706" bg="#fffbeb" warn={alertas.pendente > 0} />
          <AlertaCard label="Vencidos" value={alertas.vencidos} sub="prazo ultrapassado" color="#dc2626" bg="#fef2f2" warn={alertas.vencidos > 0} />
          <AlertaCard label="Pago no Mês" value={fmtBRL(alertas.pago_mes)} sub="pagamentos do mês atual" color="#059669" bg="#f0fdf4" />
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, padding: '10px 14px', background: '#f5f7fa', border: '1px solid #dce1e8', borderRadius: 8 }}>
        <div>
          <label className="field-label">Filial</label>
          <select className="input" value={filterFilial} onChange={(e) => setFilterFilial(e.target.value)} style={{ minWidth: 140 }}>
            {filiais.length !== 1 && <option value="">Todas</option>}
            {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Mês</label>
          <select className="input" value={filterMes} onChange={(e) => setFilterMes(e.target.value)} style={{ minWidth: 120 }}>
            <option value="">Todos</option>
            {mesesDisponiveis.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Tipo</label>
          <select className="input" value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} style={{ minWidth: 140 }}>
            <option value="">Todos</option>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Status</label>
          <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ minWidth: 120 }}>
            <option value="">Todos</option>
            {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {(filterFilial || filterMes || filterTipo || filterStatus) && (
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="button-secondary" type="button" style={{ fontSize: 11 }} onClick={() => { setFilterFilial(''); setFilterMes(''); setFilterTipo(''); setFilterStatus('') }}>Limpar</button>
          </div>
        )}
      </div>

      {/* Tabela Excel */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Carregando…</div>
      ) : filtradas.length === 0 ? (
        <div className="surface-card empty-state">
          <strong>Nenhuma despesa</strong>
          <p>As horas extras fora do contrato aparecem aqui automaticamente ao fechar o RTM.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 320px)', border: '1px solid #c8d2dc', borderRadius: 6 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, width: 'max-content', minWidth: '100%' }}>
            <thead>
              <tr>
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
                <th style={XL_TH}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filialGroups.map((g) => (
                <Fragment key={g.nome}>
                  <tr>
                    <td colSpan={15} style={{ ...XL, padding: '4px 10px', background: '#1e3a5f', color: '#fff', fontWeight: 800, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                      {g.nome} <span style={{ fontWeight: 400, fontSize: 10, opacity: .75 }}>— {g.rows.length} lançamento{g.rows.length !== 1 ? 's' : ''}</span>
                    </td>
                  </tr>
                  {g.rows.map((r, i) => {
                    const isEdit = editRow === r.id
                    const saldo = (r.valor || 0) - (r.valor_pago || 0)
                    const vencido = r.data_vencimento && r.data_vencimento < hoje && r.status !== 'PAGO' && r.status !== 'CANCELADO'
                    const editBg = { ...XL, padding: '3px 4px', background: '#fffde7', borderTop: '2px solid #f59e0b', borderBottom: '2px solid #f59e0b' }
                    const editBgFirst = { ...editBg, borderLeft: '4px solid #f59e0b', color: '#78350f', fontWeight: 700, fontFamily: 'monospace', fontSize: 10 }
                    const td = vencido ? { ...XL_TD(i), background: '#fff5f5' } : XL_TD(i)
                    if (isEdit) {
                      const ef = editForm
                      return (
                        <tr key={r.id}>
                          <td style={editBgFirst} title="Editando">✎</td>
                          <td style={{ ...editBg, fontWeight: 700, color: '#1e3a5f' }}>{r.filial_nome || '—'}</td>
                          <td style={editBg}><InlineInput value={ef.tipo_despesa} onChange={(v) => setField('tipo_despesa', v)} opts={TIPOS} /></td>
                          <td style={editBg}><InlineInput value={ef.tipo_hora} onChange={(v) => setField('tipo_hora', v)} opts={['fixo', 'extra']} /></td>
                          <td style={editBg}><InlineInput value={ef.competencia} onChange={(v) => setField('competencia', v)} type="date" /></td>
                          <td style={editBg}>
                            <InlineInput value={ef.fornecedor_nome} onChange={(v) => setField('fornecedor_nome', v)} style={{ width: 140 }} />
                            <div style={{ marginTop: 2 }}><InlineInput value={ef.tipo_documento} onChange={(v) => setField('tipo_documento', v)} opts={TIPO_DOCS} style={{ minWidth: 70 }} /></div>
                          </td>
                          <td style={editBg}><InlineInput value={ef.numero_documento} onChange={(v) => setField('numero_documento', v)} style={{ width: 110, fontFamily: 'monospace' }} /></td>
                          <td style={editBg}>
                            <InlineInput value={ef.descricao} onChange={(v) => setField('descricao', v)} style={{ width: 190 }} />
                            <div style={{ marginTop: 2 }}><InlineInput value={ef.observacoes} onChange={(v) => setField('observacoes', v)} style={{ width: 190, fontSize: 10 }} /></div>
                          </td>
                          <td style={editBg}><InlineInput value={ef.valor} onChange={(v) => setField('valor', v)} type="number" /></td>
                          <td style={editBg}><InlineInput value={ef.valor_pago} onChange={(v) => setField('valor_pago', v)} type="number" /></td>
                          <td style={{ ...editBg, textAlign: 'right', fontFamily: 'monospace', color: saldo > 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>{fmtBRL(saldo)}</td>
                          <td style={editBg}><InlineInput value={ef.data_vencimento} onChange={(v) => setField('data_vencimento', v)} type="date" /></td>
                          <td style={editBg}><InlineInput value={ef.data_pagamento} onChange={(v) => setField('data_pagamento', v)} type="date" /></td>
                          <td style={editBg}><InlineInput value={ef.status} onChange={(v) => setField('status', v)} opts={STATUS_OPTS} /></td>
                          <td style={{ ...editBg, padding: '2px 4px' }}>
                            <div style={{ display: 'flex', gap: 3 }}>
                              <button className="button-primary" type="button" style={{ fontSize: 10, padding: '2px 8px' }} onClick={salvarEdicao} disabled={saving}>{saving ? '…' : 'Salvar'}</button>
                              <button className="button-secondary" type="button" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => setEditRow(null)}>✕</button>
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={r.id}>
                        <td style={{ ...td, color: '#94a3b8', fontFamily: 'monospace' }}>{i + 1}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{r.filial_nome || '—'}</td>
                        <td style={td}><span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 99, background: '#f0f4f8', color: '#334155', border: '1px solid #e2e8f0', fontWeight: 700 }}>{r.tipo_despesa}</span></td>
                        <td style={{ ...td, textAlign: 'center' }}><TipoChip v={r.tipo_hora} /></td>
                        <td style={{ ...td, fontFamily: 'monospace' }}>{fmtDate(r.competencia)}</td>
                        <td style={{ ...td, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <div style={{ fontWeight: 600, color: r.fornecedor_nome ? '#1e293b' : '#94a3b8' }} title={r.fornecedor_nome}>
                            {r.fornecedor_nome || (r.colaboradores_count ? `${r.colaboradores_count} colab.` : '—')}
                          </div>
                        </td>
                        <td style={td}><TipoDocBadge tipo={r.tipo_documento} numero={r.numero_documento} /></td>
                        <td style={{ ...td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.descricao}>
                          <div>{r.descricao || '—'}</div>
                          {r.observacoes && <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{r.observacoes}</div>}
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtBRL(r.valor)}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: '#059669' }}>{r.valor_pago ? fmtBRL(r.valor_pago) : '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: saldo > 0 ? '#dc2626' : '#059669', fontWeight: saldo > 0 ? 700 : 400 }}>{fmtBRL(saldo)}</td>
                        <td style={{ ...td, fontFamily: 'monospace', color: vencido ? '#dc2626' : undefined, fontWeight: vencido ? 700 : 400 }}>{fmtDate(r.data_vencimento)}</td>
                        <td style={{ ...td, fontFamily: 'monospace' }}>{fmtDate(r.data_pagamento)}</td>
                        <td style={td}><StatusChip v={r.status} /></td>
                        <td style={{ ...td, padding: '2px 4px' }}>
                          <div style={{ display: 'flex', gap: 3 }}>
                            <button type="button" style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, border: '1px solid #c7d2e0', background: '#f8fafc', cursor: 'pointer', color: '#334155' }} onClick={() => setDetailRow(r)}>Ver</button>
                            <button type="button" style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, border: '1px solid #c7d2e0', background: '#f8fafc', cursor: 'pointer', color: '#334155' }} onClick={() => { setEditRow(r.id); setEditForm({ ...r }) }}>Editar</button>
                            {r.status !== 'PAGO' && r.status !== 'CANCELADO' && (
                              <button type="button" style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, border: '1px solid #6ee7b7', background: '#f0fdf4', cursor: 'pointer', color: '#059669', fontWeight: 700 }} onClick={() => marcarPago(r.id, r.valor)}>Pagar</button>
                            )}
                            <button type="button" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: '1px solid #fca5a5', background: '#fef2f2', cursor: 'pointer', color: '#dc2626' }} onClick={() => deletar(r.id)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: '#dce8f5', fontWeight: 700 }}>
                    <td style={{ ...XL, padding: '3px 7px', fontSize: 10, color: '#1e3a5f' }} colSpan={8}>Subtotal — {g.nome}</td>
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
                <td style={{ ...XL, padding: '4px 7px', fontSize: 11 }} colSpan={8}>TOTAIS — {filtradas.length} lançamentos</td>
                <td style={{ ...XL, padding: '4px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtBRL(totais.valor)}</td>
                <td style={{ ...XL, padding: '4px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: '#059669' }}>{fmtBRL(totais.pago)}</td>
                <td style={{ ...XL, padding: '4px 7px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: totais.saldo > 0 ? '#dc2626' : '#059669' }}>{fmtBRL(totais.saldo)}</td>
                <td style={XL} colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Modal detalhes (leitura) */}
      {detailRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="surface-card" style={{ maxWidth: 620, width: '100%', margin: 16, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Detalhes da despesa</div>
                <h3 style={{ margin: 0 }}>{detailRow.tipo_despesa} — {detailRow.filial_nome || '—'}</h3>
                <div style={{ marginTop: 6 }}><StatusChip v={detailRow.status} /></div>
              </div>
              <button className="button-secondary" type="button" style={{ fontSize: 11 }} onClick={() => setDetailRow(null)}>✕ Fechar</button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
              <DetalheLabel label="Unidade" value={detailRow.filial_nome} />
              <DetalheLabel label="Competência" value={fmtDate(detailRow.competencia)} />
              <DetalheLabel label="Tipo de Despesa" value={detailRow.tipo_despesa} />
              <DetalheLabel label="Status" value={detailRow.status} />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 16 }}>
              <DetalheLabel label="Beneficiário / Empresa" value={detailRow.fornecedor_nome || (detailRow.colaboradores_count ? `${detailRow.colaboradores_count} colaboradores` : null)} />
              <DetalheLabel label="Tipo de Documento" value={detailRow.tipo_documento} />
              <DetalheLabel label="Nº Documento" value={detailRow.numero_documento} />
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 6 }}>Descrição</div>
              <div style={{ fontSize: 12, color: '#1e293b', lineHeight: 1.5 }}>{detailRow.descricao || <span style={{ color: '#cbd5e1' }}>—</span>}</div>
              {detailRow.observacoes && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: '#f8fafc', borderLeft: '3px solid #94a3b8', borderRadius: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 2 }}>OBSERVAÇÕES</div>
                  <div style={{ fontSize: 12, color: '#334155' }}>{detailRow.observacoes}</div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>Valor</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#dc2626', fontFamily: 'monospace' }}>{fmtBRL(detailRow.valor)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>Valor Pago</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#059669', fontFamily: 'monospace' }}>{fmtBRL(detailRow.valor_pago)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>Saldo</div>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color: ((detailRow.valor || 0) - (detailRow.valor_pago || 0)) > 0 ? '#dc2626' : '#059669' }}>{fmtBRL((detailRow.valor || 0) - (detailRow.valor_pago || 0))}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 16 }}>
              <DetalheLabel label="Vencimento" value={fmtDate(detailRow.data_vencimento)} />
              <DetalheLabel label="Data de Pagamento" value={fmtDate(detailRow.data_pagamento)} />
              {detailRow.horas_extras_rtm_mes && <DetalheLabel label="Gerado do RTM" value={detailRow.horas_extras_rtm_mes?.slice(0, 7)} />}
              {detailRow.colaboradores_count > 0 && <DetalheLabel label="Qtd. Colaboradores" value={String(detailRow.colaboradores_count)} />}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
              <button className="button-secondary" type="button" onClick={() => { setDetailRow(null); setEditRow(detailRow.id); setEditForm({ ...detailRow }) }}>Editar</button>
              <button className="button-secondary" type="button" onClick={() => setDetailRow(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="surface-card" style={{ maxWidth: 560, width: '100%', margin: 16, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>Nova Despesa a Pagar</h3>
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
                <input className="input" value={newForm.fornecedor_nome || ''} onChange={(e) => setNewForm((p) => ({ ...p, fornecedor_nome: e.target.value }))} placeholder="Ex: João da Silva, Hotel XYZ, Posto ABC…" />
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
                <input className="input" value={newForm.numero_documento || ''} onChange={(e) => setNewForm((p) => ({ ...p, numero_documento: e.target.value }))} placeholder="Ex: 001234, 2024/05…" style={{ fontFamily: 'monospace' }} />
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

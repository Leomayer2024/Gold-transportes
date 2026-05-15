import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'

const TIPO_DESPESA_OPTS = [
  'horas_extras_rtm',
  'combustivel',
  'manutencao',
  'pneus',
  'pedagio',
  'hospedagem',
  'fornecedor',
  'salario_extra',
  'outros',
]

const STATUS_OPTS = ['PENDENTE', 'PAGO', 'CANCELADO']

function todayIso() { return new Date().toISOString().slice(0, 10) }
function fmtBR(d) { if (!d) return '—'; const [y, m, day] = String(d).split('-'); return `${day}/${m}/${y}` }
function fmtMoney(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0)) }
function mesLabel(c) { if (!c) return '—'; const [y, m] = c.split('-'); const n = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']; return `${n[Number(m) - 1] || ''}/${y.slice(2)}` }

function emptyForm() {
  return {
    filial_id: '',
    competencia: todayIso().slice(0, 7) + '-01',
    tipo_despesa: 'outros',
    descricao: '',
    fornecedor_nome: '',
    colaborador_id: '',
    valor: '',
    data_vencimento: '',
    data_pagamento: '',
    valor_pago: '',
    status: 'PENDENTE',
    tipo_documento: '',
    numero_documento: '',
    observacoes: '',
  }
}

function ResumoCard({ label, valor, contagem, tone }) {
  return (
    <div className="surface-card" style={{ padding: 14, borderLeft: `4px solid var(--${tone || 'primary'})`, minWidth: 180, flex: 1 }}>
      <div style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{fmtMoney(valor)}</div>
      {contagem != null && <div style={{ fontSize: 11, color: '#888' }}>{contagem} lançamento{contagem === 1 ? '' : 's'}</div>}
    </div>
  )
}

function EditModal({ row, filiais, colaboradores, onSave, onClose }) {
  const [form, setForm] = useState(() => row
    ? { ...emptyForm(), ...row, filial_id: row.filial_id != null ? String(row.filial_id) : '', colaborador_id: row.colaborador_id != null ? String(row.colaborador_id) : '' }
    : emptyForm()
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  function set(f, v) { setForm((p) => ({ ...p, [f]: v })) }

  async function submit(e) {
    e.preventDefault()
    if (!form.filial_id) { setErr('Filial obrigatória.'); return }
    if (!form.tipo_despesa) { setErr('Tipo obrigatório.'); return }
    if (!form.valor) { setErr('Valor obrigatório.'); return }
    setSaving(true); setErr('')
    try {
      const filialNome = filiais.find((f) => Number(f.id) === Number(form.filial_id))
      const payload = {
        ...form,
        filial_id: Number(form.filial_id),
        filial_nome: filialNome ? `${filialNome.cidade}/${filialNome.uf}` : (form.filial_nome || ''),
        colaborador_id: form.colaborador_id ? Number(form.colaborador_id) : null,
        valor: Number(form.valor),
        valor_pago: form.valor_pago === '' ? null : Number(form.valor_pago),
      }
      for (const k of Object.keys(payload)) if (payload[k] === '') payload[k] = null
      await onSave(payload, row?.id)
      onClose()
    } catch (e2) { setErr(e2.message || 'Erro.') } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800, width: '95vw' }}>
        <form onSubmit={submit}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>{row ? 'Editar' : 'Novo'} — Contas a Pagar</h2>
            <button type="button" className="button-secondary" onClick={onClose}>✕</button>
          </header>
          {err && <div style={{ background: '#fde7e7', color: '#9b1c1c', padding: 10, borderRadius: 8, marginBottom: 12 }}>{err}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <label>Filial *
              <select value={form.filial_id} onChange={(e) => set('filial_id', e.target.value)} required>
                <option value="">—</option>
                {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
              </select>
            </label>
            <label>Competência *
              <input type="date" value={form.competencia || ''} onChange={(e) => set('competencia', e.target.value)} required />
            </label>
            <label>Tipo de Despesa *
              <select value={form.tipo_despesa} onChange={(e) => set('tipo_despesa', e.target.value)} required>
                {TIPO_DESPESA_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label style={{ gridColumn: '1 / span 3' }}>Descrição
              <input type="text" value={form.descricao || ''} onChange={(e) => set('descricao', e.target.value)} />
            </label>
            <label>Fornecedor
              <input type="text" value={form.fornecedor_nome || ''} onChange={(e) => set('fornecedor_nome', e.target.value)} />
            </label>
            <label>Colaborador
              <select value={form.colaborador_id || ''} onChange={(e) => set('colaborador_id', e.target.value)}>
                <option value="">—</option>
                {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome_completo}</option>)}
              </select>
            </label>
            <label>Valor *
              <input type="number" step="0.01" value={form.valor || ''} onChange={(e) => set('valor', e.target.value)} required />
            </label>
            <label>Vencimento
              <input type="date" value={form.data_vencimento || ''} onChange={(e) => set('data_vencimento', e.target.value)} />
            </label>
            <label>Pagamento
              <input type="date" value={form.data_pagamento || ''} onChange={(e) => set('data_pagamento', e.target.value)} />
            </label>
            <label>Valor Pago
              <input type="number" step="0.01" value={form.valor_pago || ''} onChange={(e) => set('valor_pago', e.target.value)} />
            </label>
            <label>Status
              <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                {STATUS_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label>Tipo Doc.
              <input type="text" value={form.tipo_documento || ''} onChange={(e) => set('tipo_documento', e.target.value)} />
            </label>
            <label>Nº Documento
              <input type="text" value={form.numero_documento || ''} onChange={(e) => set('numero_documento', e.target.value)} />
            </label>
            <label style={{ gridColumn: '1 / span 3' }}>Observações
              <textarea rows={2} value={form.observacoes || ''} onChange={(e) => set('observacoes', e.target.value)} />
            </label>
          </div>
          <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" className="button-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="button-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
          </footer>
        </form>
      </div>
    </div>
  )
}

export default function ContasAPagarPage() {
  const [rows, setRows] = useState([])
  const [filiais, setFiliais] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [metricas, setMetricas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const [fFilial, setFFilial] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fComp, setFComp] = useState('')

  async function carregar() {
    setLoading(true)
    try {
      const params = {}
      if (fFilial) params.filial_id = fFilial
      if (fTipo) params.tipo_despesa = fTipo
      if (fStatus) params.status = fStatus
      const [r, met] = await Promise.all([
        api.list('contas_a_pagar', params),
        api.getContasAPagarMetricas().catch(() => null),
      ])
      setRows(Array.isArray(r) ? r : (r?.data || []))
      setMetricas(met)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    api.list('filiais', { ativo: true }).then((d) => setFiliais(Array.isArray(d) ? d : (d?.data || []))).catch(() => {})
    api.list('colaboradores', { ativo: true }).then((d) => setColaboradores(Array.isArray(d) ? d : (d?.data || []))).catch(() => {})
  }, [])

  useEffect(() => { carregar() /* eslint-disable-next-line */ }, [fFilial, fTipo, fStatus])

  const visibleRows = useMemo(() => {
    let arr = rows
    if (fComp) arr = arr.filter((r) => (r.competencia || '').slice(0, 7) === fComp)
    return arr
  }, [rows, fComp])

  const resumo = useMemo(() => {
    let total = 0, pago = 0, pendente = 0, vencido = 0
    const hoje = todayIso()
    for (const r of visibleRows) {
      const v = Number(r.valor || 0)
      total += v
      const stt = (r.status || '').toUpperCase()
      if (stt === 'PAGO') pago += v
      else {
        pendente += v
        if (r.data_vencimento && r.data_vencimento < hoje) vencido += v
      }
    }
    return { total, pago, pendente, vencido, qtd: visibleRows.length }
  }, [visibleRows])

  async function handleSave(payload, id) {
    if (id) await api.update('contas_a_pagar', id, payload)
    else await api.create('contas_a_pagar', payload)
    await carregar()
  }

  async function handleDelete(id) {
    await api.remove('contas_a_pagar', id)
    setConfirmDel(null)
    await carregar()
  }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Financeiro</span>
          <h1>Contas a Pagar</h1>
          <p>Gastos extras Gold, fornecedores, despesas operacionais por competência.</p>
        </div>
        <div>
          <button className="button-primary" onClick={() => { setEditing(null); setShowModal(true) }}>+ Novo lançamento</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <ResumoCard label="Total (filtrado)" valor={resumo.total} contagem={resumo.qtd} tone="primary" />
        <ResumoCard label="Pago" valor={resumo.pago} tone="success" />
        <ResumoCard label="Pendente" valor={resumo.pendente} tone="warning" />
        <ResumoCard label="Vencido" valor={resumo.vencido} tone="danger" />
      </div>

      <div className="surface-card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ minWidth: 140 }}>Filial
            <select value={fFilial} onChange={(e) => setFFilial(e.target.value)}>
              <option value="">Todas</option>
              {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
            </select>
          </label>
          <label style={{ minWidth: 160 }}>Tipo Despesa
            <select value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
              <option value="">Todos</option>
              {TIPO_DESPESA_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label style={{ minWidth: 140 }}>Competência
            <input type="month" value={fComp} onChange={(e) => setFComp(e.target.value)} />
          </label>
          <label style={{ minWidth: 140 }}>Status
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <button className="button-secondary" type="button" onClick={() => { setFFilial(''); setFTipo(''); setFComp(''); setFStatus('') }}>Limpar</button>
        </div>
      </div>

      <div className="surface-card" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? <div style={{ padding: 24, textAlign: 'center' }}>Carregando…</div> :
          visibleRows.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>Sem lançamentos.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ background: '#1f2a44', color: '#fff' }}>
              <tr>
                {['FILIAL', 'COMPETÊNCIA', 'TIPO', 'DESCRIÇÃO', 'FORNECEDOR/COLAB.', 'VALOR', 'VENCIMENTO', 'PAGAMENTO', 'STATUS', '⚙'].map((h) =>
                  <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700 }}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const isVenc = r.data_vencimento && r.data_vencimento < todayIso() && (r.status || '').toUpperCase() !== 'PAGO'
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #eef0f3', background: isVenc ? '#fff5f5' : undefined }}>
                    <td style={{ padding: '5px 8px', fontWeight: 700 }}>{r.filial_nome || '—'}</td>
                    <td style={{ padding: '5px 8px' }}>{mesLabel(r.competencia)}</td>
                    <td style={{ padding: '5px 8px' }}>{r.tipo_despesa || '—'}</td>
                    <td style={{ padding: '5px 8px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descricao}>{r.descricao || '—'}</td>
                    <td style={{ padding: '5px 8px' }}>{r.fornecedor_nome || (colaboradores.find((c) => c.id === r.colaborador_id)?.nome_completo) || '—'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>{fmtMoney(r.valor)}</td>
                    <td style={{ padding: '5px 8px' }}>{fmtBR(r.data_vencimento)}</td>
                    <td style={{ padding: '5px 8px' }}>{fmtBR(r.data_pagamento)}</td>
                    <td style={{ padding: '5px 8px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, background: r.status === 'PAGO' ? '#e6f7ed' : (isVenc ? '#fde7e7' : '#fff4e0'), color: r.status === 'PAGO' ? '#1b7c45' : (isVenc ? '#9b1c1c' : '#a35a00'), fontSize: 10, fontWeight: 700 }}>{r.status || 'PENDENTE'}</span>
                    </td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>
                      <button className="button-secondary" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => { setEditing(r); setShowModal(true) }}>Editar</button>
                      <button className="button-secondary" style={{ fontSize: 10, padding: '2px 6px', marginLeft: 4, color: '#c62828' }} onClick={() => setConfirmDel(r)}>×</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {metricas && (
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <div className="surface-card" style={{ padding: 14 }}>
            <h3 style={{ marginTop: 0, fontSize: 14 }}>Por tipo de despesa (global)</h3>
            <table style={{ width: '100%', fontSize: 12 }}>
              <tbody>
                {(metricas.por_tipo || []).slice(0, 10).map((o) => (
                  <tr key={o.tipo}>
                    <td style={{ padding: '3px 0' }}>{o.tipo}</td>
                    <td style={{ padding: '3px 0', textAlign: 'right' }}>{o.qtd}</td>
                    <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 700 }}>{fmtMoney(o.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="surface-card" style={{ padding: 14 }}>
            <h3 style={{ marginTop: 0, fontSize: 14 }}>Por filial (global)</h3>
            <table style={{ width: '100%', fontSize: 12 }}>
              <tbody>
                {(metricas.por_filial || []).slice(0, 10).map((o) => (
                  <tr key={o.filial}>
                    <td style={{ padding: '3px 0' }}>{o.filial}</td>
                    <td style={{ padding: '3px 0', textAlign: 'right' }}>{o.qtd}</td>
                    <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 700 }}>{fmtMoney(o.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <EditModal
          row={editing}
          filiais={filiais}
          colaboradores={colaboradores}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null) }}
        />
      )}

      {confirmDel && (
        <div className="modal-backdrop" onClick={() => setConfirmDel(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3>Excluir lançamento?</h3>
            <p>{confirmDel.descricao || confirmDel.tipo_despesa}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="button-secondary" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="button-primary" style={{ background: '#c62828' }} onClick={() => handleDelete(confirmDel.id)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

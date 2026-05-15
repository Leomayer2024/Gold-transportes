import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'

// ─── Padronizações (dropdowns) ────────────────────────────────────────────────

const OBRIGACAO_OPTS = ['FRETES', 'PEDAGIO', 'HORA EXTRA', 'HOSPEDAGEM', 'DESPESAS EXTRAS', 'RTM', 'PREMIAÇÃO']
const STATUS_OPTS = ['AGUARDANDO', 'COBRANÇA REALIZADA', 'AGUARDANDO PEDIDO DO CLIENTE', 'PAGO', 'CANCELADO']
const STATUS_FAT_OPTS = ['NÃO FATURADO', 'FATURADO']
const PRAZO_ENVIO_OPTS = ['ATÉ O DIA 10 - SUB', '(FATURADO NO MÊS CORRENTE)', 'NÃO SE APLICA']
const TIPO_DOC_OPTS = ['CTE', 'ND', 'NÃO SE APLICA']
const FERRAMENTA_OPTS = [
  'SOB DEMANDA', 'SISTEMA SASCAR DA WHITE', 'SOLICITAÇÕES DE PERNOITES',
  'PLANILHA DE CONTRATOS', 'RELATÓRIO SEM PARAR', 'E-MAIL RH (ENVIO APÓS O PAG.)',
]
const PRESTACAO_OPTS = ['ATÉ O DIA 20', 'NÃO SE APLICA']
const SETOR_OPTS = [
  'RELATÓRIO FINANCEIRO', 'VIDE OPÇÃO', 'E-MAIL DO DPTO. PESSOAL',
  'CTE - DO MÊS SUBSEQUENTE', 'CTE - DO MÊS CORRENTE (ULT. DIA DO MÊS)', 'NÃO SE APLICA',
]
const TIPO_HORA_OPTS = ['extra', 'fixo']

// Templates de auto-fill por obrigação (defaults mais comuns na operação)
const TEMPLATES = {
  'FRETES':            { limite_dia: 0,  prazo_envio: 'ATÉ O DIA 10 - SUB', tipo_documento: 'CTE', prestacao: 'ATÉ O DIA 20' },
  'PEDAGIO':           { limite_dia: 10, prazo_envio: 'ATÉ O DIA 10 - SUB', tipo_documento: 'CTE', ferramenta: 'SOB DEMANDA', prestacao: 'ATÉ O DIA 20' },
  'HORA EXTRA':        { limite_dia: 10, prazo_envio: '(FATURADO NO MÊS CORRENTE)', tipo_documento: 'CTE', ferramenta: 'PLANILHA DE CONTRATOS', prestacao: 'ATÉ O DIA 20', setor_responsavel: 'CTE - DO MÊS CORRENTE (ULT. DIA DO MÊS)' },
  'HOSPEDAGEM':        { limite_dia: 10, prazo_envio: 'ATÉ O DIA 10 - SUB', tipo_documento: 'CTE', ferramenta: 'SOLICITAÇÕES DE PERNOITES', prestacao: 'ATÉ O DIA 20', setor_responsavel: 'RELATÓRIO FINANCEIRO' },
  'DESPESAS EXTRAS':   { limite_dia: 10, prazo_envio: 'ATÉ O DIA 10 - SUB', tipo_documento: 'ND', ferramenta: 'SOB DEMANDA', prestacao: 'ATÉ O DIA 20', setor_responsavel: 'RELATÓRIO FINANCEIRO' },
  'RTM':               { limite_dia: 10, prazo_envio: 'ATÉ O DIA 10 - SUB', tipo_documento: 'CTE', ferramenta: 'E-MAIL RH (ENVIO APÓS O PAG.)', prestacao: 'ATÉ O DIA 20' },
  'PREMIAÇÃO':         { limite_dia: 10, prazo_envio: 'ATÉ O DIA 10 - SUB', tipo_documento: 'CTE', ferramenta: 'PLANILHA DE CONTRATOS', prestacao: 'ATÉ O DIA 20', setor_responsavel: 'CTE - DO MÊS SUBSEQUENTE' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIso() { return new Date().toISOString().slice(0, 10) }
function fmtBR(d) { if (!d) return '—'; const [y, m, day] = String(d).split('-'); return `${day}/${m}/${y}` }
function fmtMoney(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0)) }
function fmtPct(v) { if (v == null || !isFinite(v)) return '—'; return `${Number(v).toFixed(1)}%` }
function fmtNum(v) { if (v == null || !isFinite(v)) return '—'; return Number(v).toFixed(0) }

function daysBetween(a, b) {
  if (!a || !b) return null
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
  return Math.round((db - da) / 86400000)
}

function lastDayOfMonthISO(yyyy_mm_01) {
  if (!yyyy_mm_01) return ''
  const d = new Date(yyyy_mm_01 + 'T00:00:00')
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return next.toISOString().slice(0, 10)
}

function addMonthsISO(yyyy_mm_01, monthsAdd) {
  if (!yyyy_mm_01) return ''
  const d = new Date(yyyy_mm_01 + 'T00:00:00')
  const next = new Date(d.getFullYear(), d.getMonth() + monthsAdd, 1)
  return next.toISOString().slice(0, 10)
}

function dataLimiteFor(competencia, limite_dia) {
  if (!competencia) return ''
  if (!limite_dia || Number(limite_dia) === 0) return lastDayOfMonthISO(competencia)
  const nextMonth = addMonthsISO(competencia, 1)
  const d = new Date(nextMonth + 'T00:00:00')
  // garante que limite_dia exista no mês
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  const day = Math.min(Number(limite_dia), lastDay)
  return new Date(d.getFullYear(), d.getMonth(), day).toISOString().slice(0, 10)
}

function aReceberValor(r) {
  const v1 = Number(r.vlr_ajustado_wm || 0)
  if (v1 > 0) return v1
  const v2 = Number(r.cobrado_wm || 0)
  if (v2 > 0) return v2
  return Number(r.valor_gold || 0)
}

function mesLabel(competencia) {
  if (!competencia) return '—'
  const [y, m] = String(competencia).split('-')
  const nomes = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
  return `${nomes[Number(m) - 1] || ''}/${y.slice(2)}`
}

function statusFatDerivado(r) {
  if (r.status_fat) return r.status_fat
  if (r.cte || r.nd) return 'FATURADO'
  return 'NÃO FATURADO'
}

function emptyForm() {
  return {
    filial_id: '',
    competencia: todayIso().slice(0, 7) + '-01',
    obrigacao: '',
    descricao: '',
    limite_dia: 10,
    valor_gold: '',
    data_pagamento_gold: '',
    cobrado_wm: '',
    data_envio: '',
    data_ajuste: '',
    vlr_ajustado_wm: '',
    frete: '',
    vlr_cte: '',
    vlr_fixo_icms: '',
    emissao: '',
    nd: '',
    cte: '',
    tipo_documento: '',
    ferramenta: '',
    prestacao: '',
    contato: '',
    double_check: '',
    autorizacao: 'VISTO DE JOSÉ',
    o_que_falta: '',
    motivo_pendencia: '',
    setor_responsavel: '',
    previsao: '',
    status_fat: 'NÃO FATURADO',
    status: 'AGUARDANDO',
    data_vencimento: '',
    cliente_nome: '',
    contrato_nome: '',
    tipo_hora: '',
    prazo_envio: '',
  }
}

// ─── Card de resumo ───────────────────────────────────────────────────────────

function ResumoCard({ label, valor, contagem, tone }) {
  return (
    <div className="surface-card" style={{ padding: 14, borderLeft: `4px solid var(--${tone || 'primary'})`, minWidth: 180, flex: 1 }}>
      <div style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{fmtMoney(valor)}</div>
      {contagem != null && <div style={{ fontSize: 11, color: '#888' }}>{contagem} lançamento{contagem === 1 ? '' : 's'}</div>}
    </div>
  )
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

function EditModal({ row, filiais, contratos, onSave, onClose }) {
  const [form, setForm] = useState(() => row
    ? { ...emptyForm(), ...row, filial_id: row.filial_id != null ? String(row.filial_id) : '' }
    : emptyForm()
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })) }

  function applyTemplate(obrig) {
    const t = TEMPLATES[obrig]
    if (!t) return
    setForm((p) => {
      const next = { ...p, obrigacao: obrig }
      for (const k of Object.keys(t)) {
        if (!p[k]) next[k] = t[k]
      }
      return next
    })
  }

  // Cálculos derivados (preview)
  const ult_dia_competencia = lastDayOfMonthISO(form.competencia)
  const data_limite = dataLimiteFor(form.competencia, form.limite_dia)
  const a_receber = aReceberValor(form)
  const dif_g_wm = Number(form.valor_gold || 0) - a_receber
  const dif_cte_frete = Number(form.vlr_cte || 0) - Number(form.frete || 0)
  const dif_cte_frete_pct = Number(form.frete || 0) > 0 ? (dif_cte_frete / Number(form.frete)) * 100 : null

  async function submit(e) {
    e.preventDefault()
    if (!form.filial_id) { setErr('Selecione a filial.'); return }
    if (!form.obrigacao) { setErr('Selecione a obrigação.'); return }
    if (!form.competencia) { setErr('Informe a competência.'); return }
    setSaving(true); setErr('')
    try {
      const filialNome = filiais.find((f) => Number(f.id) === Number(form.filial_id))
      const payload = {
        ...form,
        filial_id: Number(form.filial_id),
        filial_nome: filialNome ? `${filialNome.cidade}/${filialNome.uf}` : (form.filial_nome || ''),
        limite_dia: form.limite_dia === '' ? null : Number(form.limite_dia),
        valor_gold: form.valor_gold === '' ? null : Number(form.valor_gold),
        cobrado_wm: form.cobrado_wm === '' ? null : Number(form.cobrado_wm),
        vlr_ajustado_wm: form.vlr_ajustado_wm === '' ? null : Number(form.vlr_ajustado_wm),
        frete: form.frete === '' ? null : Number(form.frete),
        vlr_cte: form.vlr_cte === '' ? null : Number(form.vlr_cte),
        vlr_fixo_icms: form.vlr_fixo_icms === '' ? null : Number(form.vlr_fixo_icms),
        data_limite,
        ult_dia_competencia,
        status_fat: form.status_fat || statusFatDerivado(form),
      }
      // remove campos vazios string para evitar problemas no banco
      for (const k of Object.keys(payload)) {
        if (payload[k] === '') payload[k] = null
      }
      // contrato_operacional_id: converter pra number ou null
      if (payload.contrato_operacional_id) payload.contrato_operacional_id = Number(payload.contrato_operacional_id)

      await onSave(payload, row?.id)
      onClose()
    } catch (e2) {
      setErr(e2.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1100, width: '95vw', maxHeight: '92vh', overflow: 'auto' }}>
        <form onSubmit={submit}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>{row ? 'Editar lançamento' : 'Novo lançamento'} — Contas a Receber</h2>
            <button type="button" className="button-secondary" onClick={onClose}>✕</button>
          </header>

          {err && <div style={{ background: '#fde7e7', color: '#9b1c1c', padding: 10, borderRadius: 8, marginBottom: 12 }}>{err}</div>}

          {/* Seção: Identificação */}
          <fieldset style={{ border: '1px solid #e1e5ea', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <legend style={{ fontWeight: 700, fontSize: 12, color: '#555' }}>IDENTIFICAÇÃO</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <label>Filial *
                <select value={form.filial_id} onChange={(e) => set('filial_id', e.target.value)} required>
                  <option value="">—</option>
                  {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
                </select>
              </label>
              <label>Obrigação *
                <select value={form.obrigacao} onChange={(e) => applyTemplate(e.target.value)} required>
                  <option value="">—</option>
                  {OBRIGACAO_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label>Competência *
                <input type="date" value={form.competencia || ''} onChange={(e) => set('competencia', e.target.value)} required />
              </label>
              <label>Descrição
                <input type="text" value={form.descricao || ''} onChange={(e) => set('descricao', e.target.value)} />
              </label>
              <label>Cliente
                <input type="text" value={form.cliente_nome || ''} onChange={(e) => set('cliente_nome', e.target.value)} />
              </label>
              <label>Contrato (vincular)
                <select value={form.contrato_operacional_id || ''} onChange={(e) => {
                  const c = contratos.find((x) => String(x.id) === e.target.value)
                  setForm((p) => ({ ...p, contrato_operacional_id: e.target.value || null, contrato_nome: c?.nome_contrato || p.contrato_nome }))
                }}>
                  <option value="">—</option>
                  {contratos.map((c) => <option key={c.id} value={c.id}>{c.nome_contrato} ({c.codigo_contrato})</option>)}
                </select>
              </label>
              <label>Contrato (nome livre)
                <input type="text" value={form.contrato_nome || ''} onChange={(e) => set('contrato_nome', e.target.value)} />
              </label>
              <label>Tipo de Hora
                <select value={form.tipo_hora || ''} onChange={(e) => set('tipo_hora', e.target.value)}>
                  <option value="">—</option>
                  {TIPO_HORA_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            </div>
          </fieldset>

          {/* Seção: Prazos */}
          <fieldset style={{ border: '1px solid #e1e5ea', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <legend style={{ fontWeight: 700, fontSize: 12, color: '#555' }}>PRAZOS</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <label>P1 (dia limite)
                <input type="number" min="0" max="31" value={form.limite_dia ?? ''} onChange={(e) => set('limite_dia', e.target.value)} />
              </label>
              <label>Limite (auto)
                <input type="date" value={data_limite || ''} disabled />
              </label>
              <label>Últ. dia comp. (auto)
                <input type="date" value={ult_dia_competencia || ''} disabled />
              </label>
              <label>Data Vencimento
                <input type="date" value={form.data_vencimento || ''} onChange={(e) => set('data_vencimento', e.target.value)} />
              </label>
              <label>Emissão
                <input type="date" value={form.emissao || ''} onChange={(e) => set('emissao', e.target.value)} />
              </label>
              <label>Envio
                <input type="date" value={form.data_envio || ''} onChange={(e) => set('data_envio', e.target.value)} />
              </label>
              <label>Data Ajuste
                <input type="date" value={form.data_ajuste || ''} onChange={(e) => set('data_ajuste', e.target.value)} />
              </label>
              <label>Data Pgto Gold
                <input type="date" value={form.data_pagamento_gold || ''} onChange={(e) => set('data_pagamento_gold', e.target.value)} />
              </label>
              <label>Previsão
                <input type="date" value={form.previsao || ''} onChange={(e) => set('previsao', e.target.value)} />
              </label>
              <label>Prazo de envio
                <select value={form.prazo_envio || ''} onChange={(e) => set('prazo_envio', e.target.value)}>
                  <option value="">—</option>
                  {PRAZO_ENVIO_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            </div>
          </fieldset>

          {/* Seção: Valores */}
          <fieldset style={{ border: '1px solid #e1e5ea', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <legend style={{ fontWeight: 700, fontSize: 12, color: '#555' }}>VALORES</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <label>Valor PG. Gold
                <input type="number" step="0.01" value={form.valor_gold ?? ''} onChange={(e) => set('valor_gold', e.target.value)} />
              </label>
              <label>Cobrado a WM
                <input type="number" step="0.01" value={form.cobrado_wm ?? ''} onChange={(e) => set('cobrado_wm', e.target.value)} />
              </label>
              <label>Vlr. Ajustado WM
                <input type="number" step="0.01" value={form.vlr_ajustado_wm ?? ''} onChange={(e) => set('vlr_ajustado_wm', e.target.value)} />
              </label>
              <label>Frete
                <input type="number" step="0.01" value={form.frete ?? ''} onChange={(e) => set('frete', e.target.value)} />
              </label>
              <label>Vlr CTE
                <input type="number" step="0.01" value={form.vlr_cte ?? ''} onChange={(e) => set('vlr_cte', e.target.value)} />
              </label>
              <label>Vlr Fixo/ICMS
                <input type="number" step="0.01" value={form.vlr_fixo_icms ?? ''} onChange={(e) => set('vlr_fixo_icms', e.target.value)} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, padding: 10, background: '#f6f9fc', borderRadius: 6, fontSize: 12 }}>
              <span><strong>A Receber:</strong> {fmtMoney(a_receber)}</span>
              <span><strong>Dif. G - WM:</strong> {fmtMoney(dif_g_wm)}</span>
              <span><strong>Dif. CTE - Frete:</strong> {fmtMoney(dif_cte_frete)} ({fmtPct(dif_cte_frete_pct)})</span>
            </div>
          </fieldset>

          {/* Seção: Documentos */}
          <fieldset style={{ border: '1px solid #e1e5ea', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <legend style={{ fontWeight: 700, fontSize: 12, color: '#555' }}>DOCUMENTOS</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <label>ND
                <input type="text" value={form.nd || ''} onChange={(e) => set('nd', e.target.value)} />
              </label>
              <label>CTE
                <input type="text" value={form.cte || ''} onChange={(e) => set('cte', e.target.value)} />
              </label>
              <label>Tipo Documento
                <select value={form.tipo_documento || ''} onChange={(e) => set('tipo_documento', e.target.value)}>
                  <option value="">—</option>
                  {TIPO_DOC_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label>Ferramenta
                <select value={form.ferramenta || ''} onChange={(e) => set('ferramenta', e.target.value)}>
                  <option value="">—</option>
                  {FERRAMENTA_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label>Prestação
                <select value={form.prestacao || ''} onChange={(e) => set('prestacao', e.target.value)}>
                  <option value="">—</option>
                  {PRESTACAO_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label>Setor Resp.
                <select value={form.setor_responsavel || ''} onChange={(e) => set('setor_responsavel', e.target.value)}>
                  <option value="">—</option>
                  {SETOR_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            </div>
          </fieldset>

          {/* Seção: Status & Acompanhamento */}
          <fieldset style={{ border: '1px solid #e1e5ea', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <legend style={{ fontWeight: 700, fontSize: 12, color: '#555' }}>STATUS & ACOMPANHAMENTO</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <label>Status Faturamento
                <select value={form.status_fat || ''} onChange={(e) => set('status_fat', e.target.value)}>
                  {STATUS_FAT_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label>Status
                <select value={form.status || ''} onChange={(e) => set('status', e.target.value)}>
                  {STATUS_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label>Contato
                <input type="text" value={form.contato || ''} onChange={(e) => set('contato', e.target.value)} />
              </label>
              <label>Double Check
                <input type="text" value={form.double_check || ''} onChange={(e) => set('double_check', e.target.value)} />
              </label>
              <label>Autorização
                <input type="text" value={form.autorizacao || ''} onChange={(e) => set('autorizacao', e.target.value)} />
              </label>
              <label>O que falta?
                <input type="text" value={form.o_que_falta || ''} onChange={(e) => set('o_que_falta', e.target.value)} />
              </label>
              <label>Motivo pendência
                <input type="text" value={form.motivo_pendencia || ''} onChange={(e) => set('motivo_pendencia', e.target.value)} />
              </label>
            </div>
          </fieldset>

          <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="button-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="button-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
          </footer>
        </form>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ContasAReceberPage() {
  const [rows, setRows] = useState([])
  const [filiais, setFiliais] = useState([])
  const [contratos, setContratos] = useState([])
  const [metricas, setMetricas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)

  // Filtros
  const [fFilial, setFFilial] = useState('')
  const [fObrigacao, setFObrigacao] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fStatusFat, setFStatusFat] = useState('')
  const [fComp, setFComp] = useState('') // YYYY-MM
  const [fBusca, setFBusca] = useState('')

  async function carregar() {
    setLoading(true)
    try {
      const params = {}
      if (fFilial) params.filial_id = fFilial
      if (fObrigacao) params.obrigacao = fObrigacao
      if (fStatus) params.status = fStatus
      if (fStatusFat) params.status_fat = fStatusFat
      const [r, met] = await Promise.all([
        api.list('contas_a_receber', params),
        api.getContasAReceberMetricas().catch(() => null),
      ])
      const arr = Array.isArray(r) ? r : (r?.data || [])
      setRows(arr)
      setMetricas(met)
    } catch (e) {
      console.error('Erro ao carregar contas a receber:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    api.list('filiais', { ativo: true }).then((d) => setFiliais(Array.isArray(d) ? d : (d?.data || []))).catch(() => {})
    api.list('contratos_operacionais', { ativo: true }).then((d) => setContratos(Array.isArray(d) ? d : (d?.data || []))).catch(() => {})
  }, [])

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fFilial, fObrigacao, fStatus, fStatusFat])

  // Filtros locais (comp + busca)
  const visibleRows = useMemo(() => {
    let arr = rows
    if (fComp) arr = arr.filter((r) => (r.competencia || '').slice(0, 7) === fComp)
    if (fBusca) {
      const q = fBusca.toLowerCase()
      arr = arr.filter((r) =>
        [r.descricao, r.cte, r.nd, r.cliente_nome, r.contrato_nome, r.filial_nome, r.obrigacao]
          .some((s) => (s || '').toLowerCase().includes(q))
      )
    }
    return arr
  }, [rows, fComp, fBusca])

  // Resumo derivado do filtro atual
  const resumoFiltrado = useMemo(() => {
    let totalAReceber = 0, totalFaturado = 0, totalNaoFaturado = 0, totalVencido = 0
    const hoje = todayIso()
    for (const r of visibleRows) {
      const v = aReceberValor(r)
      totalAReceber += v
      const sf = statusFatDerivado(r)
      if (sf === 'FATURADO') totalFaturado += v
      else totalNaoFaturado += v
      if (r.data_vencimento && r.data_vencimento < hoje && (r.status || '').toUpperCase() !== 'PAGO') totalVencido += v
    }
    return { totalAReceber, totalFaturado, totalNaoFaturado, totalVencido, qtd: visibleRows.length }
  }, [visibleRows])

  async function handleSave(payload, id) {
    if (id) await api.update('contas_a_receber', id, payload)
    else await api.create('contas_a_receber', payload)
    await carregar()
  }

  async function handleDelete(id) {
    await api.remove('contas_a_receber', id)
    setConfirmDel(null)
    await carregar()
  }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Financeiro</span>
          <h1>Contas a Receber</h1>
          <p>Faturamento por obrigação, competência e cliente — fluxo fiel à planilha financeira.</p>
        </div>
        <div>
          <button className="button-primary" onClick={() => { setEditing(null); setShowModal(true) }}>+ Novo lançamento</button>
        </div>
      </div>

      {/* Resumo */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <ResumoCard label="A Receber (filtrado)" valor={resumoFiltrado.totalAReceber} contagem={resumoFiltrado.qtd} tone="primary" />
        <ResumoCard label="Faturado" valor={resumoFiltrado.totalFaturado} tone="success" />
        <ResumoCard label="Não Faturado" valor={resumoFiltrado.totalNaoFaturado} tone="warning" />
        <ResumoCard label="Vencido" valor={resumoFiltrado.totalVencido} tone="danger" />
      </div>

      {/* Filtros */}
      <div className="surface-card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ minWidth: 140 }}>Filial
            <select value={fFilial} onChange={(e) => setFFilial(e.target.value)}>
              <option value="">Todas</option>
              {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
            </select>
          </label>
          <label style={{ minWidth: 140 }}>Obrigação
            <select value={fObrigacao} onChange={(e) => setFObrigacao(e.target.value)}>
              <option value="">Todas</option>
              {OBRIGACAO_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
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
          <label style={{ minWidth: 140 }}>Status Fat.
            <select value={fStatusFat} onChange={(e) => setFStatusFat(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_FAT_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label style={{ flex: 1, minWidth: 200 }}>Busca livre
            <input type="text" placeholder="descrição, CTE, ND, cliente…" value={fBusca} onChange={(e) => setFBusca(e.target.value)} />
          </label>
          <button className="button-secondary" type="button" onClick={() => { setFFilial(''); setFObrigacao(''); setFComp(''); setFStatus(''); setFStatusFat(''); setFBusca('') }}>Limpar</button>
        </div>
      </div>

      {/* Tabela — fiel à planilha */}
      <div className="surface-card" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center' }}>Carregando…</div>
        ) : visibleRows.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>Nenhum lançamento encontrado para os filtros atuais.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 2400 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#1f2a44', color: '#fff', zIndex: 1 }}>
              <tr>
                {['UNIDADE', 'OBRIGAÇÃO', 'P1', 'LIMITE', 'ÚLT. DIA COMP.', 'COMPETÊNCIA', 'ENVIADOS', 'VALOR PG. GOLD', 'DATA P.', 'EMISSÃO', 'ND', 'CTE', 'DESCRIÇÃO', 'ENVIO', 'COBRADO WM', 'DATA AJUSTE', 'VLR. AJUSTADO WM', 'DIF. G - WM', 'FRETE', 'VLR CTE', 'VLR FIXO/ICMS', 'DIF. CTE-FRETE', '%', 'DATA V.', 'OPEN', 'A RECEBER', 'STATUS FAT.', 'STATUS', 'PRAZO ENVIO', 'TIPO', 'FERRAMENTA', 'PRESTAÇÃO', 'CONTATO', 'DOUBLE CHECK', 'AUTORIZAÇÃO', 'O QUE FALTA', 'MOTIVO PENDÊNCIA', 'SETOR RESP.', 'PREVISÃO', 'CLIENTE', 'CONTRATO', '⚙'].map((h) => (
                  <th key={h} style={{ padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: 10, fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const ult = lastDayOfMonthISO(r.competencia)
                const lim = r.data_limite || dataLimiteFor(r.competencia, r.limite_dia)
                const aRec = aReceberValor(r)
                const difGwm = Number(r.valor_gold || 0) - aRec
                const difCteFrete = Number(r.vlr_cte || 0) - Number(r.frete || 0)
                const difCtePct = Number(r.frete || 0) > 0 ? (difCteFrete / Number(r.frete)) * 100 : null
                const open = daysBetween(todayIso(), r.data_vencimento)
                const statusFat = statusFatDerivado(r)
                const isVencido = r.data_vencimento && r.data_vencimento < todayIso() && (r.status || '').toUpperCase() !== 'PAGO'
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #eef0f3', background: isVencido ? '#fff5f5' : undefined }}>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap', fontWeight: 700 }}>{r.filial_nome || '—'}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{r.obrigacao || '—'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'center' }}>{r.limite_dia ?? '—'}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{fmtBR(lim)}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{fmtBR(ult)}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{mesLabel(r.competencia)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'center' }}>{r.data_envio ? 'SIM' : 'NÃO'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtMoney(r.valor_gold)}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{fmtBR(r.data_pagamento_gold)}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{fmtBR(r.emissao)}</td>
                    <td style={{ padding: '5px 8px' }}>{r.nd || '—'}</td>
                    <td style={{ padding: '5px 8px' }}>{r.cte || '—'}</td>
                    <td style={{ padding: '5px 8px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descricao}>{r.descricao || '—'}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{fmtBR(r.data_envio)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtMoney(r.cobrado_wm)}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{fmtBR(r.data_ajuste)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtMoney(r.vlr_ajustado_wm)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap', color: difGwm !== 0 ? '#c62828' : undefined }}>{fmtMoney(difGwm)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtMoney(r.frete)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtMoney(r.vlr_cte)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtMoney(r.vlr_fixo_icms)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtMoney(difCteFrete)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right' }}>{fmtPct(difCtePct)}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{fmtBR(r.data_vencimento)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'center', color: open != null && open < 0 ? '#c62828' : (open != null && open <= 5 ? '#ef6c00' : undefined), fontWeight: 700 }}>{fmtNum(open)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{fmtMoney(aRec)}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, background: statusFat === 'FATURADO' ? '#e6f7ed' : '#fff4e0', color: statusFat === 'FATURADO' ? '#1b7c45' : '#a35a00', fontSize: 10, fontWeight: 700 }}>{statusFat}</span>
                    </td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{r.status || '—'}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{r.prazo_envio || '—'}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{r.tipo_documento || '—'}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{r.ferramenta || '—'}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{r.prestacao || '—'}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.contato}>{r.contato || '—'}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{r.double_check || '—'}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{r.autorizacao || '—'}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{r.o_que_falta || '—'}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{r.motivo_pendencia || '—'}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{r.setor_responsavel || '—'}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{fmtBR(r.previsao)}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{r.cliente_nome || '—'}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{r.contrato_nome || '—'}</td>
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

      {/* Métricas globais (não filtradas) */}
      {metricas && (
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <div className="surface-card" style={{ padding: 14 }}>
            <h3 style={{ marginTop: 0, fontSize: 14 }}>Por obrigação (global)</h3>
            <table style={{ width: '100%', fontSize: 12 }}>
              <tbody>
                {(metricas.por_obrigacao || []).slice(0, 10).map((o) => (
                  <tr key={o.obrigacao}>
                    <td style={{ padding: '3px 0' }}>{o.obrigacao}</td>
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
          contratos={contratos}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null) }}
        />
      )}

      {confirmDel && (
        <div className="modal-backdrop" onClick={() => setConfirmDel(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3>Excluir lançamento?</h3>
            <p>{confirmDel.descricao || confirmDel.obrigacao}</p>
            <p style={{ fontSize: 12, color: '#888' }}>Esta ação não pode ser desfeita.</p>
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

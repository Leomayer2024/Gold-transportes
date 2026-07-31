import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'

// ─── Painel financeiro por filial ────────────────────────────────────────────
// Busca os meses do período selecionado via /dashboard/andamento-filiais (um
// request por mês, com cache por mês) e agrega client-side: KPIs + cards por
// filial somam todos os meses do intervalo. Filtro de filial é client-side.

const MES_ATUAL = new Date().toISOString().slice(0, 7)
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const CAP_MESES = 24 // teto de requests por período

// Campos numéricos somados por filial ao agregar o período.
const NUM_FIELDS = [
  'receita_total', 'saida_total', 'despesas_total', 'despesas_pago', 'saldo', 'he_margem',
  'faturamento_pago', 'faturamento_pendente', 'contas_receber_faturado', 'contas_receber_aberto',
  'pedidos_finalizados_valor', 'pedidos_finalizados_qtd', 'he_calculado', 'he_real', 'he_horas',
]

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function mesLabel(ym) {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return `${MESES_ABREV[Number(m) - 1] || '?'}/${(y || '').slice(2)}`
}
// Soma o YM `base` deslocado de `delta` meses (delta negativo = passado).
function addMeses(base, delta) {
  const [y, m] = base.split('-').map(Number)
  const idx = y * 12 + (m - 1) + delta
  const yy = Math.floor(idx / 12)
  const mm = (idx % 12 + 12) % 12
  return `${yy}-${String(mm + 1).padStart(2, '0')}`
}
// Lista de meses YM do intervalo [de, ate] (inclusivo), ordenados e com teto.
function mesesRange(de, ate) {
  const [ay, am] = de.split('-').map(Number)
  const [by, bm] = ate.split('-').map(Number)
  let start = ay * 12 + (am - 1)
  let end = by * 12 + (bm - 1)
  if (start > end) [start, end] = [end, start]
  if (end - start + 1 > CAP_MESES) start = end - CAP_MESES + 1
  const out = []
  for (let i = start; i <= end; i++) {
    out.push(`${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`)
  }
  return out
}
function somaFiliais(filiais) {
  const t = { receita_total: 0, saida_total: 0, despesas_total: 0, despesas_pago: 0, saldo: 0, he_margem: 0, faturamento_pago: 0, faturamento_pendente: 0, contas_receber_faturado: 0, contas_receber_aberto: 0 }
  for (const f of filiais || []) {
    for (const k of Object.keys(t)) t[k] += Number(f[k] || 0)
  }
  return t
}

export default function AndamentoBI() {
  const [de, setDe] = useState(() => addMeses(MES_ATUAL, -5)) // padrão: últimos 6 meses
  const [ate, setAte] = useState(MES_ATUAL)
  const [filialSel, setFilialSel] = useState('') // '' = todas
  const [porMes, setPorMes] = useState({}) // { 'YYYY-MM': [filiais...] }
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const meses = useMemo(() => mesesRange(de, ate), [de, ate])
  const periodoLabel = `${mesLabel(meses[0])} – ${mesLabel(meses[meses.length - 1])}`

  useEffect(() => {
    let vivo = true
    setLoading(true); setErro('')
    Promise.all(meses.map((m) =>
      api.getDashboardAndamento({ mes: m })
        .then((r) => [m, r?.filiais || []])
        .catch(() => [m, []]),
    ))
      .then((pares) => {
        if (!vivo) return
        setPorMes(Object.fromEntries(pares))
      })
      .catch((e) => { if (vivo) setErro(e.message || 'Erro ao carregar.') })
      .finally(() => { if (vivo) setLoading(false) })
    return () => { vivo = false }
  }, [meses])

  // Agrega o período: soma os campos numéricos por filial ao longo dos meses.
  const filiaisPeriodo = useMemo(() => {
    const map = new Map()
    for (const m of meses) for (const f of (porMes[m] || [])) {
      if (f.filial_id == null) continue
      const cur = map.get(f.filial_id) || { filial_id: f.filial_id, filial_nome: f.filial_nome }
      for (const k of NUM_FIELDS) cur[k] = (cur[k] || 0) + Number(f[k] || 0)
      map.set(f.filial_id, cur)
    }
    return [...map.values()].sort((a, b) => (a.filial_nome || '').localeCompare(b.filial_nome || ''))
  }, [porMes, meses])

  // Opções de filial derivadas do próprio dado (respeita escopo/liberação).
  const opcoesFilial = useMemo(
    () => filiaisPeriodo.map((f) => ({ id: f.filial_id, nome: f.filial_nome })),
    [filiaisPeriodo],
  )

  const casaFilial = (f) => !filialSel || String(f.filial_id) === String(filialSel)
  const view = useMemo(() => filiaisPeriodo.filter(casaFilial), [filiaisPeriodo, filialSel])
  const kpis = useMemo(() => somaFiliais(view), [view])

  const semDados = !loading && meses.every((m) => (porMes[m] || []).length === 0)

  // Aplica um preset de N meses terminando no mês atual.
  const presetMeses = (n) => { setAte(MES_ATUAL); setDe(addMeses(MES_ATUAL, -(n - 1))) }
  const presetAno = () => { setAte(MES_ATUAL); setDe(`${MES_ATUAL.slice(0, 4)}-01`) }

  return (
    <div className="bi">
      {/* Filtros por período */}
      <div className="bi-filters">
        <label className="field filter-field" style={{ marginBottom: 0, minWidth: 150 }}>
          <span>Período · início</span>
          <input type="month" value={de} max={ate} onChange={(e) => setDe(e.target.value || MES_ATUAL)} />
        </label>
        <label className="field filter-field" style={{ marginBottom: 0, minWidth: 150 }}>
          <span>Período · fim</span>
          <input type="month" value={ate} min={de} onChange={(e) => setAte(e.target.value || MES_ATUAL)} />
        </label>
        <label className="field filter-field" style={{ marginBottom: 0, minWidth: 180 }}>
          <span>Filial</span>
          <select value={filialSel} onChange={(e) => setFilialSel(e.target.value)}>
            <option value="">Todas as filiais</option>
            {opcoesFilial.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </label>
        {/* Presets de período */}
        <div className="bi-quickmonths">
          <button type="button" className="bi-chip" onClick={() => presetMeses(3)}>3 meses</button>
          <button type="button" className="bi-chip" onClick={() => presetMeses(6)}>6 meses</button>
          <button type="button" className="bi-chip" onClick={() => presetMeses(12)}>12 meses</button>
          <button type="button" className="bi-chip" onClick={presetAno}>Ano</button>
        </div>
        {filialSel && <button type="button" className="bi-chip" onClick={() => setFilialSel('')}>✕ limpar filial</button>}
        {loading && <span className="dsh-live"><span className="dsh-live-dot" /> carregando…</span>}
      </div>

      {erro && <div className="alert-error">{erro}</div>}
      {semDados && <div className="dsh-empty"><strong>Sem dados</strong>Nenhum lançamento nas filiais liberadas neste período.</div>}

      {!semDados && (
        <>
          {/* KPIs */}
          <div className="dsh-exec">
            <div className="dsh-tile tone-success"><div><span className="dsh-tile-value" style={{ fontSize: 18 }}>{fmtBRL(kpis.receita_total)}</span><span className="dsh-tile-label">Receita total</span></div></div>
            <div className="dsh-tile tone-danger"><div><span className="dsh-tile-value" style={{ fontSize: 18 }}>{fmtBRL(kpis.despesas_total)}</span><span className="dsh-tile-label">Despesas (contas a pagar)</span></div></div>
            <div className={`dsh-tile tone-${kpis.saldo >= 0 ? 'success' : 'danger'}`}><div><span className="dsh-tile-value" style={{ fontSize: 18 }}>{fmtBRL(kpis.saldo)}</span><span className="dsh-tile-label">Saldo</span></div></div>
            <div className={`dsh-tile tone-${kpis.he_margem >= 0 ? 'success' : 'danger'}`}><div><span className="dsh-tile-value" style={{ fontSize: 18 }}>{fmtBRL(kpis.he_margem)}</span><span className="dsh-tile-label">Margem hora extra</span></div></div>
          </div>

          {/* Cards por filial */}
          <div className="dsh-section-head" style={{ marginTop: 4 }}><h2>Detalhe por filial · {periodoLabel}</h2></div>
          <div className="dsh-bases" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))' }}>
            {view.map((f) => (
              <article className="dsh-base-card" key={`bi-${f.filial_id}`}>
                <div className="dsh-base-title">
                  <div>
                    <small>Andamento · {periodoLabel}</small>
                    <h3>{f.filial_nome}</h3>
                  </div>
                </div>
                <table className="dsh-table bi-table">
                  <tbody>
                    <tr><td>Faturamento pago</td><td className="dsh-num-success">{fmtBRL(f.faturamento_pago)}</td></tr>
                    <tr><td>Faturamento pendente</td><td className="dsh-num-warning">{fmtBRL(f.faturamento_pendente)}</td></tr>
                    <tr><td>A receber faturado</td><td>{fmtBRL(f.contas_receber_faturado)}</td></tr>
                    <tr><td>A receber em aberto</td><td className="dsh-num-warning">{fmtBRL(f.contas_receber_aberto)}</td></tr>
                    <tr><td>Despesas</td><td className="dsh-num-danger">{fmtBRL(f.despesas_total)}</td></tr>
                    <tr><td>Margem HE</td><td className={(f.he_margem || 0) >= 0 ? 'dsh-num-success' : 'dsh-num-danger'}>{fmtBRL(f.he_margem)}</td></tr>
                  </tbody>
                </table>
                <div className="bi-card-foot">
                  <div>
                    <small>Saldo do período</small>
                    <strong style={{ color: (f.saldo || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtBRL(f.saldo)}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <small>Receita · Despesa</small>
                    <strong>{fmtBRL(f.receita_total)} · {fmtBRL(f.despesas_total)}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

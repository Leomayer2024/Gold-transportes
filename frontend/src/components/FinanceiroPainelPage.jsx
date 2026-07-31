import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import '../styles/financeiro.css'

// ─── Helpers ───────────────────────────────────────────────────────────────
function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0))
}
function fmtDate(d) {
  if (!d) return '—'
  const [y, m, dd] = String(d).slice(0, 10).split('-')
  return `${dd}/${m}/${y}`
}
function mesLabel(mm) {
  const [y, m] = mm.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(m) - 1]}/${y.slice(2)}`
}
function thisMonth() { return new Date().toISOString().slice(0, 7) }

// ─── Card KPI ──────────────────────────────────────────────────────────────
function KpiCard({ label, valor, sub, tone, icon }) {
  return (
    <div className={`fin-kpi tone-${tone}`}>
      <div className="fin-kpi-icon">{icon}</div>
      <div className="fin-kpi-body">
        <div className="fin-kpi-label">{label}</div>
        <div className="fin-kpi-valor">{fmtBRL(valor)}</div>
        {sub != null && <div className="fin-kpi-sub">{sub}</div>}
      </div>
    </div>
  )
}

// ─── Detalhe de bloco (a pagar / a receber) ─────────────────────────────────
function BlocoContas({ titulo, dados, tone, icon }) {
  return (
    <div className="surface-card fin-bloco">
      <div className="fin-bloco-head">
        <span className={`fin-bloco-icon tone-${tone}`}>{icon}</span>
        <div>
          <div className="fin-bloco-titulo">{titulo}</div>
          <div className="fin-bloco-total">{fmtBRL(dados.aberto)} <small>em aberto · {dados.qtd} lanç.</small></div>
        </div>
      </div>
      <div className="fin-bloco-grid">
        <div className="fin-mini tone-danger">
          <span>Vencidas</span>
          <strong>{fmtBRL(dados.vencido)}</strong>
          <small>{dados.vencido_qtd} lanç.</small>
        </div>
        <div className="fin-mini tone-warning">
          <span>Vence hoje</span>
          <strong>{fmtBRL(dados.vence_hoje)}</strong>
        </div>
        <div className="fin-mini tone-info">
          <span>Próx. 7 dias</span>
          <strong>{fmtBRL(dados.vence_7d)}</strong>
        </div>
        <div className="fin-mini tone-success">
          <span>{titulo.includes('pagar') ? 'Pago no mês' : 'Recebido no mês'}</span>
          <strong>{fmtBRL(dados.pago_mes ?? dados.recebido_mes)}</strong>
        </div>
      </div>
    </div>
  )
}

// ─── Mini gráfico de barras (evolução) ──────────────────────────────────────
function EvolucaoChart({ evolucao }) {
  const max = Math.max(1, ...evolucao.flatMap((e) => [e.pagar, e.receber]))
  return (
    <div className="surface-card fin-evol">
      <div className="fin-bloco-titulo" style={{ marginBottom: 12 }}>Evolução — últimos 6 meses</div>
      <div className="fin-evol-grid">
        {evolucao.map((e) => (
          <div key={e.mes} className="fin-evol-col">
            <div className="fin-evol-bars">
              <div className="fin-evol-bar receber" style={{ height: `${(e.receber / max) * 100}%` }} title={`Receber: ${fmtBRL(e.receber)}`} />
              <div className="fin-evol-bar pagar" style={{ height: `${(e.pagar / max) * 100}%` }} title={`Pagar: ${fmtBRL(e.pagar)}`} />
            </div>
            <div className="fin-evol-label">{mesLabel(e.mes)}</div>
          </div>
        ))}
      </div>
      <div className="fin-evol-legend">
        <span><i className="dot receber" /> A receber</span>
        <span><i className="dot pagar" /> A pagar</span>
      </div>
    </div>
  )
}

// ─── Página ────────────────────────────────────────────────────────────────
export default function FinanceiroPainelPage() {
  const [mes, setMes] = useState(thisMonth())
  const [painel, setPainel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncMsg, setSyncMsg] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    api.financeiroPainel(mes)
      .then((r) => { if (active) setPainel(r) })
      .catch(() => { if (active) setPainel(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [mes, refreshKey])

  async function sincronizar() {
    setSyncing(true)
    setSyncMsg('')
    try {
      const [cte, nfse] = await Promise.all([
        api.sincronizarNotasCteFinanceiro().catch(() => ({ geradas: 0 })),
        api.sincronizarNfseFinanceiro().catch(() => ({ geradas: 0 })),
      ])
      const total = (cte.geradas || 0) + (nfse.geradas || 0)
      setSyncMsg(total > 0
        ? `✓ ${total} conta(s) sincronizada(s) a partir dos documentos fiscais.`
        : '✓ Tudo em dia — nenhuma conta nova a gerar.')
      setRefreshKey((k) => k + 1)
    } catch {
      setSyncMsg('Falha ao sincronizar. Tente novamente.')
    } finally {
      setSyncing(false)
    }
  }

  const ap = painel?.a_pagar || {}
  const ar = painel?.a_receber || {}
  const saldoPrevistoTone = (painel?.saldo_previsto ?? 0) >= 0 ? 'success' : 'danger'
  const agenda = painel?.agenda || []
  const evolucao = painel?.evolucao || []

  const totalVencido = useMemo(() => (ap.vencido || 0) + (ar.vencido || 0), [ap, ar])

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Financeiro</span>
          <h1>Painel financeiro</h1>
          <p>Visão consolidada de contas a pagar e a receber, vencimentos, fluxo de caixa e saldo bancário. Os documentos fiscais (NF/CT-e e NFSe) alimentam as contas automaticamente.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="field" style={{ minWidth: 150 }}>
            <span>Mês de referência</span>
            <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </label>
          <button className="button-primary" type="button" onClick={sincronizar} disabled={syncing}>
            {syncing ? 'Sincronizando...' : '⟳ Sincronizar documentos'}
          </button>
        </div>
      </div>

      {syncMsg && <div className="alert-success" style={{ marginBottom: 12 }}>{syncMsg}</div>}

      {loading ? (
        <div className="surface-card"><div className="empty-state">Carregando painel...</div></div>
      ) : !painel ? (
        <div className="surface-card"><div className="empty-state"><strong>Sem dados.</strong><p>Não foi possível carregar o painel.</p></div></div>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="fin-kpi-grid">
            <KpiCard label="Total a pagar (aberto)" valor={ap.aberto} sub={`${ap.qtd || 0} lançamentos`} tone="danger" icon="↑" />
            <KpiCard label="Total a receber (aberto)" valor={ar.aberto} sub={`${ar.qtd || 0} lançamentos`} tone="success" icon="↓" />
            <KpiCard label="Saldo bancário" valor={painel.saldo_bancario} sub="contas ativas" tone="info" icon="🏦" />
            <KpiCard label="Saldo previsto" valor={painel.saldo_previsto} sub="saldo + receber − pagar" tone={saldoPrevistoTone} icon="≈" />
          </div>

          {totalVencido > 0 && (
            <div className="alert-error" style={{ marginBottom: 16 }}>
              <strong>Atenção:</strong> {fmtBRL(totalVencido)} em vencidos — {fmtBRL(ap.vencido)} a pagar e {fmtBRL(ar.vencido)} a receber.
            </div>
          )}

          {/* Blocos detalhados */}
          <div className="fin-blocos">
            <BlocoContas titulo="Contas a pagar" dados={ap} tone="danger" icon="↑" />
            <BlocoContas titulo="Contas a receber" dados={ar} tone="success" icon="↓" />
          </div>

          <div className="fin-lower">
            {/* Agenda de vencimentos */}
            <div className="surface-card fin-agenda">
              <div className="fin-bloco-titulo" style={{ marginBottom: 8 }}>Próximos vencimentos</div>
              {agenda.length === 0 ? (
                <div className="empty-state" style={{ padding: 20 }}>Nada a vencer nos próximos dias.</div>
              ) : (
                <div className="table-wrap">
                  <table className="notas-table">
                    <thead>
                      <tr><th>Vencimento</th><th>Tipo</th><th>Descrição</th><th style={{ textAlign: 'right' }}>Valor</th></tr>
                    </thead>
                    <tbody>
                      {agenda.map((a, i) => (
                        <tr key={i}>
                          <td>{fmtDate(a.data)}</td>
                          <td>
                            <span className={`status-chip tone-${a.tipo === 'pagar' ? 'danger' : 'success'}`}>
                              {a.tipo === 'pagar' ? 'A pagar' : 'A receber'}
                            </span>
                          </td>
                          <td>{a.descricao}{a.filial ? <small style={{ display: 'block', color: '#888' }}>{a.filial}</small> : null}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtBRL(a.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Evolução */}
            <EvolucaoChart evolucao={evolucao} />
          </div>
        </>
      )}
    </section>
  )
}

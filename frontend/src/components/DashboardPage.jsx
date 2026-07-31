import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { hasScopePermission } from '../lib/permissions'
import { api } from '../services/api'
import { formatMinutes, formatSeverityLabel } from '../lib/formatters'
import AndamentoBI from './AndamentoBI'
import '../styles/dashboard.css'

const TIPO_FERIADO_LABELS = {
  nacional: 'Nacional',
  estadual: 'Estadual',
  municipal: 'Municipal',
  interno: 'Ponto facultativo',
}

const MES_ATUAL = new Date().toISOString().slice(0, 7)

function formatBRL(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function saudacao() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function dataLonga() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function primeiroNome(nome) {
  return (nome || 'Operador').trim().split(/\s+/)[0]
}

function iniciais(nome) {
  const parts = (nome || 'OP').trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'OP'
}

// ─── Ícones (stroke = currentColor) ────────────────────────────────────────
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
function Ico({ name }) {
  const paths = {
    building: <><rect x="4" y="3" width="16" height="18" rx="1.5" {...P} /><path d="M9 7h.01M12 7h.01M15 7h.01M9 11h.01M12 11h.01M15 11h.01M10 21v-4h4v4" {...P} /></>,
    users: <><circle cx="9" cy="8" r="3.2" {...P} /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 6.5a3 3 0 0 1 0 5.8M18 20a4.8 4.8 0 0 0-3-4.4" {...P} /></>,
    doc: <><path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" {...P} /><path d="M14 3v4h4M8 12h8M8 16h8" {...P} /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="16" rx="1.5" {...P} /><path d="M3.5 9.5h17M8 3v4M16 3v4" {...P} /></>,
    truck: <><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" {...P} /><circle cx="7" cy="18" r="1.8" {...P} /><circle cx="17.5" cy="18" r="1.8" {...P} /></>,
    box: <><path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9L12 3Z" {...P} /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" {...P} /></>,
    alert: <><path d="M12 3 2.5 20h19L12 3Z" {...P} /><path d="M12 10v4M12 17h.01" {...P} /></>,
    cart: <><path d="M3 4h2l1.6 10.5a1.5 1.5 0 0 0 1.5 1.3h8.4a1.5 1.5 0 0 0 1.5-1.2L20 8H6" {...P} /><circle cx="9" cy="20" r="1.4" {...P} /><circle cx="17" cy="20" r="1.4" {...P} /></>,
    shield: <><path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z" {...P} /><path d="m9 12 2 2 4-4" {...P} /></>,
    check: <><circle cx="12" cy="12" r="9" {...P} /><path d="m8.5 12 2.3 2.3L15.5 9.5" {...P} /></>,
    people: <><circle cx="12" cy="8" r="3.4" {...P} /><path d="M5 20a7 7 0 0 1 14 0" {...P} /></>,
    heart: <><path d="M12 20s-7-4.4-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7 2.7C19 15.6 12 20 12 20Z" {...P} /></>,
    refresh: <><path d="M20 11a8 8 0 1 0-.6 4M20 5v6h-6" {...P} /></>,
    chart: <><path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" {...P} /></>,
    fuel: <><path d="M4 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16M3 21h12" {...P} /><path d="M13 8h3l2 2v7a2 2 0 0 0 2-2v-6l-3-3" {...P} /></>,
    pin: <><path d="M12 21s6-5.3 6-10a6 6 0 0 0-12 0c0 4.7 6 10 6 10Z" {...P} /><circle cx="12" cy="11" r="2.2" {...P} /></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name] || paths.box}</svg>
}

const KPI_META = {
  'Filiais':         { icon: 'building', tone: 'info' },
  'Colaboradores':   { icon: 'users',    tone: 'success' },
  'Documentos RH':   { icon: 'doc',      tone: 'warning' },
  'Planejamento RH': { icon: 'calendar', tone: 'info' },
  'Veículos':        { icon: 'truck',    tone: 'default' },
  'Estoque (itens)': { icon: 'box',      tone: 'default' },
}

function DistBar({ ativos, faltas, ferias, afastados }) {
  const total = (ativos || 0) + (faltas || 0) + (ferias || 0) + (afastados || 0)
  if (total === 0) return <div className="dsh-dist" />
  const pct = (n) => `${((n || 0) / total) * 100}%`
  return (
    <div className="dsh-dist" title={`${total} colaboradores`}>
      <span className="seg-ativos" style={{ width: pct(ativos) }} />
      <span className="seg-faltas" style={{ width: pct(faltas) }} />
      <span className="seg-ferias" style={{ width: pct(ferias) }} />
      <span className="seg-afastados" style={{ width: pct(afastados) }} />
    </div>
  )
}

export default function DashboardPage() {
  const DASHBOARD_REFRESH_INTERVAL_MS = 30 * 60 * 1000
  const { profile, user, profileLoading } = useAuth()
  const [selectedFilialId, setSelectedFilialId] = useState('')
  const cacheKey = user?.id ? `seg-dashboard-cache:${user.id}:${selectedFilialId || 'all'}` : null
  const cachedDashboard = readDashboardCache(cacheKey)

  // Estado do Dashboard
  const [stats, setStats] = useState(cachedDashboard?.resumo || [])
  const [baseStats, setBaseStats] = useState(cachedDashboard?.bases || [])
  const [loadingSummary, setLoadingSummary] = useState(cachedDashboard?.carregamento || { available: false, database_ready: false, cards: [], highlights: [] })
  const [rhDocumentsSummary, setRhDocumentsSummary] = useState(cachedDashboard?.rh_documentos || { available: false, database_ready: false, cards: [] })
  const [alertsSnapshot, setAlertsSnapshot] = useState(cachedDashboard?.alertas || {
    summary: { total: 0, critical: 0, warning: 0, info: 0 },
    items: [],
    last_run_at: null,
    last_error: null,
  })
  const [feriadosProximos, setFeriadosProximos] = useState(cachedDashboard?.feriados_proximos || [])
  const [estoqueAlertas, setEstoqueAlertas] = useState(cachedDashboard?.estoque_alertas || [])
  const [pedidosPendentes, setPedidosPendentes] = useState(cachedDashboard?.pedidos_pendentes || 0)
  const [filiais, setFiliais] = useState([])
  const [activeTab, setActiveTab] = useState('geral')
  const [errorMessage, setErrorMessage] = useState('')
  const [dashboardLoading, setDashboardLoading] = useState(!cachedDashboard)
  const [refreshing, setRefreshing] = useState(false)

  // Aba Carregamento — filtro por data (período)
  const [carregData, setCarregData] = useState(() => new Date().toISOString().slice(0, 10))
  const [carregSummary, setCarregSummary] = useState(null)
  const [carregLoading, setCarregLoading] = useState(false)

  const allowedBasesText = profile?.has_filial_scope
    ? (profile.allowed_filial_labels || []).join(', ')
    : 'Todas as bases liberadas'

  async function reloadDashboard() {
    try {
      setRefreshing(true)
      const response = await api.getDashboard(selectedFilialId ? { filial_id: selectedFilialId } : {})
      setStats(response.resumo || [])
      setBaseStats(response.bases || [])
      setRhDocumentsSummary(response.rh_documentos || { available: false, database_ready: false, cards: [] })
      setLoadingSummary(response.carregamento || { available: false, database_ready: false, cards: [], highlights: [] })
      setFeriadosProximos(response.feriados_proximos || [])
      setEstoqueAlertas(response.estoque_alertas || [])
      setPedidosPendentes(response.pedidos_pendentes || 0)
      setAlertsSnapshot(response.alertas || { summary: { total: 0, critical: 0, warning: 0, info: 0 }, items: [], last_run_at: null, last_error: null })
      writeDashboardCache(cacheKey, response)
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setDashboardLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      try {
        const response = await api.getDashboard(selectedFilialId ? { filial_id: selectedFilialId } : {})
        if (!active) {
          return
        }

        setStats(response.resumo || [])
        setBaseStats(response.bases || [])
        setRhDocumentsSummary(response.rh_documentos || { available: false, database_ready: false, cards: [] })
        setLoadingSummary(response.carregamento || { available: false, database_ready: false, cards: [], highlights: [] })
        setFeriadosProximos(response.feriados_proximos || [])
        setEstoqueAlertas(response.estoque_alertas || [])
        setPedidosPendentes(response.pedidos_pendentes || 0)
        setAlertsSnapshot(
          response.alertas || {
            summary: { total: 0, critical: 0, warning: 0, info: 0 },
            items: [],
            last_run_at: null,
            last_error: null,
          },
        )
        writeDashboardCache(cacheKey, response)
        setErrorMessage('')
      } catch (error) {
        if (active) {
          setErrorMessage(error.message)
        }
      } finally {
        if (active) {
          setDashboardLoading(false)
          setRefreshing(false)
        }
      }
    }

    setDashboardLoading(!cachedDashboard)
    setRefreshing(Boolean(cachedDashboard))

    void loadDashboard()

    api.list('filiais', { ativo: true }).then(setFiliais).catch(() => {})

    const intervalId = window.setInterval(() => {
      if (!active) {
        return
      }
      setRefreshing(true)
      void loadDashboard()
    }, DASHBOARD_REFRESH_INTERVAL_MS)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [cacheKey])

  useEffect(() => {
    if (activeTab !== 'carregamento') return
    let active = true
    setCarregLoading(true)
    api.getDashboardCarregamento(carregData)
      .then((r) => { if (active) setCarregSummary(r) })
      .catch(() => { if (active) setCarregSummary(null) })
      .finally(() => { if (active) setCarregLoading(false) })
    return () => { active = false }
  }, [activeTab, carregData])

  const showGeneralSkeleton = dashboardLoading && stats.length === 0 && baseStats.length === 0
  const showLoadingHighlights = refreshing || profileLoading

  // Dados para gráficos
  const baseStatsFiltered = baseStats.filter((base) => !selectedFilialId || String(base.filial_id) === String(selectedFilialId))

  const totalColaboradores = baseStatsFiltered.reduce(
    (s, b) => s + (b.ativos || 0) + (b.faltas || 0) + (b.ferias || 0) + (b.afastados || 0), 0,
  )

  const systemHealthScore = Math.round(
    100 - (((alertsSnapshot.summary?.critical || 0) * 10 + (alertsSnapshot.summary?.warning || 0) * 3) % 100)
  )

  const criticos = alertsSnapshot.summary?.critical || 0

  const execTiles = [
    { icon: 'people', label: 'Colaboradores', value: totalColaboradores, tone: 'info' },
    { icon: 'alert', label: 'Alertas críticos', value: criticos, tone: criticos > 0 ? 'danger' : 'success' },
    { icon: 'box', label: 'Estoque baixo', value: estoqueAlertas.length, tone: estoqueAlertas.length > 0 ? 'warning' : 'neutral' },
    { icon: 'cart', label: 'Pedidos pendentes', value: pedidosPendentes, tone: pedidosPendentes > 0 ? 'warning' : 'neutral' },
    { icon: 'heart', label: 'Saúde do sistema', value: `${systemHealthScore}%`, tone: systemHealthScore >= 75 ? 'success' : systemHealthScore >= 50 ? 'warning' : 'danger' },
  ]

  const TABS = [
    { id: 'geral', label: 'Visão geral', icon: 'chart' },
    { id: 'andamento', label: 'Andamento por filial', icon: 'building' },
    ...(loadingSummary.available ? [{ id: 'carregamento', label: 'Carregamento', icon: 'truck' }] : []),
  ]

  return (
    <section className="dsh">
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <div className="dsh-hero">
        <div className="dsh-hero-main">
          <span className="dsh-hero-eyebrow"><Ico name="pin" /> Painel operacional</span>
          <h1>{saudacao()}, {primeiroNome(profile?.nome_completo)} 👋</h1>
          <p className="dsh-hero-sub">
            {dataLonga().charAt(0).toUpperCase() + dataLonga().slice(1)} · Visão geral de pessoas, frota, estoque e aprovações.
          </p>
        </div>
        <div className="dsh-hero-actions">
          {showLoadingHighlights && (
            <span className="dsh-live"><span className="dsh-live-dot" /> Atualizando…</span>
          )}
          {filiais.length > 1 && (
            <label className="dsh-hero-field">
              <span>Base</span>
              <select value={selectedFilialId} onChange={(e) => setSelectedFilialId(e.target.value)}>
                <option value="">Todas as bases</option>
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>
                ))}
              </select>
            </label>
          )}
          <button className="dsh-btn-refresh" onClick={reloadDashboard} type="button" disabled={refreshing}>
            <Ico name="refresh" /> {refreshing ? 'Atualizando' : 'Atualizar'}
          </button>
        </div>
      </div>

      {errorMessage && <div className="alert-error">{errorMessage}</div>}

      {/* ── TABS ─────────────────────────────────────────────────────── */}
      <div className="dsh-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`dsh-tab${activeTab === t.id ? ' is-active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════ TAB: VISÃO GERAL ══════════════ */}
      {activeTab === 'geral' && (
        <>
          {/* KPIs cadastrais */}
          {showGeneralSkeleton ? (
            <div className="dsh-kpis">
              {Array.from({ length: 6 }).map((_, i) => <div className="dsh-skel" key={`k-${i}`} />)}
            </div>
          ) : (
            <div className="dsh-kpis">
              {stats.map((item) => {
                const meta = KPI_META[item.label] || { icon: 'box', tone: 'default' }
                return (
                  <article className={`dsh-kpi${meta.tone !== 'default' ? ` tone-${meta.tone}` : ''}`} key={item.label}>
                    <div className="dsh-kpi-icon"><Ico name={meta.icon} /></div>
                    <div className="dsh-kpi-body">
                      <span className="dsh-kpi-value">{item.value}</span>
                      <span className="dsh-kpi-label">{item.label}</span>
                      {item.hint && <span className="dsh-kpi-hint">{item.hint}</span>}
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {/* Resumo executivo */}
          {!showGeneralSkeleton && (
            <>
              <div className="dsh-section-head"><Ico name="chart" /><h2>Resumo executivo</h2></div>
              <div className="dsh-exec">
                {execTiles.map((t) => (
                  <div className={`dsh-tile tone-${t.tone}`} key={t.label}>
                    <div className="dsh-tile-icon"><Ico name={t.icon} /></div>
                    <div>
                      <span className="dsh-tile-value">{t.value}</span>
                      <span className="dsh-tile-label">{t.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Bases / força de trabalho */}
          {showGeneralSkeleton ? (
            <div className="dsh-bases">
              {Array.from({ length: 2 }).map((_, i) => <div className="dsh-skel" style={{ height: 150 }} key={`b-${i}`} />)}
            </div>
          ) : baseStatsFiltered.length > 0 && (
            <>
              <div className="dsh-section-head">
                <Ico name="people" /><h2>Força de trabalho por base</h2>
                <span className="dsh-section-count">{baseStatsFiltered.length} base(s) · {totalColaboradores} pessoas</span>
              </div>
              <div className="dsh-bases">
                {baseStatsFiltered.map((base) => (
                  <article className="dsh-base-card" key={`base-${base.filial_id}`}>
                    <div className="dsh-base-title">
                      <div className="dsh-base-ic"><Ico name="building" /></div>
                      <div>
                        <small>Base do gestor</small>
                        <h3>{base.filial_nome}</h3>
                      </div>
                    </div>
                    <div className="dsh-base-kpis">
                      <div className="dsh-mini ativos"><strong>{base.ativos || 0}</strong><span>Ativos</span></div>
                      <div className="dsh-mini faltas"><strong>{base.faltas || 0}</strong><span>Faltas</span></div>
                      <div className="dsh-mini ferias"><strong>{base.ferias || 0}</strong><span>Férias</span></div>
                      <div className="dsh-mini afastados"><strong>{base.afastados || 0}</strong><span>Afastados</span></div>
                    </div>
                    <DistBar {...base} />
                  </article>
                ))}
              </div>
            </>
          )}

          {/* Painéis */}
          <div className="dsh-panels">
            {/* Alertas automáticos — largura maior */}
            <article className="dsh-panel dsh-col-7">
              <div className="dsh-panel-head">
                <div className="dsh-panel-ic"><Ico name="alert" /></div>
                <div>
                  <span className="dsh-eyebrow">Motor de alertas</span>
                  <h3>Notificações automáticas</h3>
                </div>
                {alertsSnapshot.last_run_at && (
                  <span className="dsh-panel-head-right" style={{ fontSize: 10, color: 'var(--muted)' }}>
                    {new Date(alertsSnapshot.last_run_at).toLocaleString('pt-BR')}
                  </span>
                )}
              </div>

              {alertsSnapshot.last_error && <div className="alert-error">Falha no motor de alertas: {alertsSnapshot.last_error}</div>}

              <div className="dsh-alert-summary">
                <span className="dsh-alert-pill"><span className="dsh-dot" /> Total {alertsSnapshot.summary?.total || 0}</span>
                <span className="dsh-alert-pill crit"><span className="dsh-dot" /> Críticos {alertsSnapshot.summary?.critical || 0}</span>
                <span className="dsh-alert-pill warn"><span className="dsh-dot" /> Atenção {alertsSnapshot.summary?.warning || 0}</span>
                <span className="dsh-alert-pill info"><span className="dsh-dot" /> Info {alertsSnapshot.summary?.info || 0}</span>
              </div>

              {alertsSnapshot.items?.length ? (
                <div className="dsh-feed">
                  {alertsSnapshot.items.slice(0, 8).map((item) => {
                    const sev = item.severity === 'critical' ? 'crit' : item.severity === 'warning' ? 'warn' : 'info'
                    return (
                      <div className={`dsh-feed-item ${sev}`} key={`${item.type}-${item.reference_id}`}>
                        <div className="dsh-feed-body">
                          <span className="dsh-feed-title">{item.title}</span>
                          {item.message && <span className="dsh-feed-msg">{item.message}</span>}
                          <div className="dsh-feed-meta">
                            {item.status && <span>{item.status}</span>}
                            {item.date_limit && <span>Prazo: {item.date_limit}</span>}
                          </div>
                        </div>
                        <span className="dsh-feed-sev">{formatSeverityLabel(item.severity)}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="dsh-empty"><strong>Tudo sob controle</strong>Sem alertas ativos no momento.</div>
              )}
            </article>

            {/* Coluna direita: pedidos + estoque */}
            <div className="dsh-col-5" style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr', alignContent: 'start' }}>
              {hasScopePermission(profile, 'menu.pedidos_compra') && (
                <article className="dsh-panel">
                  <div className="dsh-panel-head">
                    <div className="dsh-panel-ic"><Ico name="cart" /></div>
                    <div>
                      <span className="dsh-eyebrow">Compras</span>
                      <h3>Pedidos pendentes</h3>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <strong style={{ fontSize: 40, fontWeight: 700, color: pedidosPendentes > 0 ? 'var(--warning)' : 'var(--success)', lineHeight: 1 }}>
                      {pedidosPendentes}
                    </strong>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>aguardando aprovação</span>
                  </div>
                </article>
              )}

              {estoqueAlertas.length > 0 && hasScopePermission(profile, 'menu.estoque') && (
                <article className="dsh-panel">
                  <div className="dsh-panel-head">
                    <div className="dsh-panel-ic"><Ico name="box" /></div>
                    <div>
                      <span className="dsh-eyebrow">Estoque</span>
                      <h3>Estoque baixo</h3>
                    </div>
                    <span className="dsh-panel-head-right" style={{ fontSize: 11, color: 'var(--muted)' }}>{estoqueAlertas.length} item(ns)</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="dsh-table">
                      <thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>Atual</th><th style={{ textAlign: 'right' }}>Mínimo</th></tr></thead>
                      <tbody>
                        {estoqueAlertas.slice(0, 6).map((item) => (
                          <tr key={item.id}>
                            <td><strong>{item.nome}</strong></td>
                            <td style={{ textAlign: 'right' }} className="dsh-num-danger">{Number(item.estoque_atual || 0).toFixed(2)}</td>
                            <td style={{ textAlign: 'right' }}>{Number(item.estoque_minimo || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              )}
            </div>

            {/* Próximos feriados */}
            {feriadosProximos.length > 0 && hasScopePermission(profile, 'menu.feriados') && (
              <article className="dsh-panel dsh-col-6">
                <div className="dsh-panel-head">
                  <div className="dsh-panel-ic"><Ico name="calendar" /></div>
                  <div>
                    <span className="dsh-eyebrow">Calendário</span>
                    <h3>Próximos feriados</h3>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="dsh-table">
                    <thead><tr><th>Data</th><th>Feriado</th><th>Tipo</th><th>Expediente</th></tr></thead>
                    <tbody>
                      {feriadosProximos.map((f) => (
                        <tr key={f.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{f.data ? f.data.split('-').reverse().join('/') : '—'}</td>
                          <td><strong>{f.nome}</strong></td>
                          <td>{TIPO_FERIADO_LABELS[f.tipo] || f.tipo}</td>
                          <td>{f.tem_expediente ? (f.horario_expediente || 'Sim') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            )}

            {/* Alertas documentais RH */}
            {rhDocumentsSummary.available && (
              <article className="dsh-panel dsh-col-6">
                <div className="dsh-panel-head">
                  <div className="dsh-panel-ic"><Ico name="doc" /></div>
                  <div>
                    <span className="dsh-eyebrow">RH</span>
                    <h3>Alertas documentais</h3>
                  </div>
                </div>
                {!rhDocumentsSummary.database_ready ? (
                  <div className="alert-error">A migration de documentos RH ainda não foi executada no banco.</div>
                ) : (
                  <div className="dsh-exec" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                    {(rhDocumentsSummary.cards || []).map((item) => (
                      <div className={`dsh-tile tone-${item.tone || 'neutral'}`} key={item.label}>
                        <div>
                          <span className="dsh-tile-value">{item.value}</span>
                          <span className="dsh-tile-label">{item.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            )}

            {/* Usuário autenticado */}
            <article className="dsh-panel dsh-col-6">
              <div className="dsh-user-head">
                <div className="dsh-avatar">{iniciais(profile?.nome_completo)}</div>
                <div>
                  <h3>{profile?.nome_completo || 'Operador'}</h3>
                  <small>{profile?.cargo || 'Sem cargo definido'}</small>
                </div>
              </div>
              <div className="dsh-meta">
                <div><span>CPF</span><strong>{profile?.cpf || '—'}</strong></div>
                <div><span>Acesso</span><strong>{profile?.tipo_acesso || '—'}</strong></div>
                <div><span>Status</span><strong style={{ color: profile?.ativo ? 'var(--success)' : 'var(--danger)' }}>{profile?.ativo ? 'Ativo' : 'Inativo'}</strong></div>
                <div><span>Bases visíveis</span><strong>{allowedBasesText}</strong></div>
              </div>
            </article>

            {/* Permissões */}
            <article className="dsh-panel dsh-col-6">
              <div className="dsh-panel-head">
                <div className="dsh-panel-ic"><Ico name="shield" /></div>
                <div>
                  <span className="dsh-eyebrow">Permissões</span>
                  <h3>Regras principais</h3>
                </div>
              </div>
              <div className="dsh-perm-row">
                {[
                  { l: 'Web', on: profile?.permissions?.app },
                  { l: 'Desktop', on: profile?.permissions?.desktop },
                  { l: 'Editar', on: profile?.permissions?.edit },
                  { l: 'Excluir', on: profile?.permissions?.delete },
                  { l: 'Aprovar HE', on: profile?.permissions?.approve_he },
                ].map((p) => (
                  <span className={`dsh-perm${p.on ? ' on' : ''}`} key={p.l}>
                    <span className="dsh-perm-dot" />{p.l}
                  </span>
                ))}
              </div>
            </article>
          </div>
        </>
      )}

      {/* ══════════════ TAB: ANDAMENTO POR FILIAL (BI) ══════════════ */}
      {activeTab === 'andamento' && <AndamentoBI />}

      {/* ══════════════ TAB: CARREGAMENTO ══════════════ */}
      {activeTab === 'carregamento' && (() => {
        const carregView = carregSummary || loadingSummary
        return (
          <>
            {/* Filtro por período (data) */}
            <div className="bi-filters">
              <label className="field filter-field" style={{ marginBottom: 0, minWidth: 160 }}>
                <span>Data</span>
                <input type="date" value={carregData} onChange={(e) => setCarregData(e.target.value || new Date().toISOString().slice(0, 10))} />
              </label>
              {carregLoading && <span className="dsh-live"><span className="dsh-live-dot" /> carregando…</span>}
            </div>

            {!carregView.database_ready ? (
              <div className="alert-error">A migration de carregamento ainda não foi executada no banco.</div>
            ) : (
              <>
                <div className="dsh-kpis">
                  {(carregView.cards || []).map((item) => (
                    <article className={`dsh-kpi${item.tone ? ` tone-${item.tone}` : ''}`} key={item.label}>
                      <div className="dsh-kpi-icon"><Ico name="truck" /></div>
                      <div className="dsh-kpi-body">
                        <span className="dsh-kpi-value">{item.value}</span>
                        <span className="dsh-kpi-label">{item.label}</span>
                        {item.hint && <span className="dsh-kpi-hint">{item.hint}</span>}
                      </div>
                    </article>
                  ))}
                </div>

                <article className="dsh-panel">
                  <div className="dsh-panel-head">
                    <div className="dsh-panel-ic"><Ico name="truck" /></div>
                    <div>
                      <span className="dsh-eyebrow">Carregamento · {carregData.split('-').reverse().join('/')}</span>
                      <h3>Maiores impactos operacionais</h3>
                    </div>
                  </div>
                  {carregView.highlights?.length ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="dsh-table">
                        <thead>
                          <tr><th>Placa</th><th>Base</th><th>Rota</th><th>Status</th><th>Tempo parado</th><th>Ocorrências</th></tr>
                        </thead>
                        <tbody>
                          {carregView.highlights.map((item) => (
                            <tr key={`loading-highlight-${item.id}`}>
                              <td><strong>{item.placa}</strong></td>
                              <td>{item.filial_nome}</td>
                              <td>{item.rota_nome}</td>
                              <td>{item.status}</td>
                              <td>{formatMinutes(item.tempo_parado_minutos)}</td>
                              <td>{item.ocorrencias_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="dsh-empty"><strong>Sem jornadas</strong>Nenhuma jornada registrada nesta data.</div>
                  )}
                </article>
              </>
            )}
          </>
        )
      })()}
    </section>
  )
}

function readDashboardCache(cacheKey) {
  if (!cacheKey) {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(cacheKey)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeDashboardCache(cacheKey, payload) {
  if (!cacheKey) {
    return
  }

  try {
    window.sessionStorage.setItem(cacheKey, JSON.stringify(payload))
  } catch {
    // Ignore dashboard cache persistence failures.
  }
}

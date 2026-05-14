import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { hasScopePermission } from '../lib/permissions'
import { api } from '../services/api'
import { formatMinutes, formatSeverityLabel } from '../lib/formatters'
import StatCard from './StatCard'
import PieChart from './Charts/PieChart'
import BarChart from './Charts/BarChart'
import LineChart from './Charts/LineChart'
import GaugeChart from './Charts/GaugeChart'

const TIPO_FERIADO_LABELS = {
  nacional: 'Nacional',
  estadual: 'Estadual',
  municipal: 'Municipal',
  interno: 'Ponto facultativo',
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

  const allowedBasesText = profile?.has_filial_scope
    ? (profile.allowed_filial_labels || []).join(', ')
    : 'Todas as bases liberadas'

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

  const showGeneralSkeleton = dashboardLoading && stats.length === 0 && baseStats.length === 0
  const showLoadingHighlights = refreshing || profileLoading

  // Dados para gráficos
  const baseStatsFiltered = baseStats.filter((base) => !selectedFilialId || String(base.filial_id) === String(selectedFilialId))

  const workforceChartData = baseStatsFiltered.map((base) => ({
    label: base.filial_nome?.split('/')[0] || 'Base',
    value: base.ativos || 0,
  }))

  const statusChartData = baseStatsFiltered.length > 0 ? [
    { label: 'Ativos', value: baseStatsFiltered.reduce((s, b) => s + (b.ativos || 0), 0) },
    { label: 'Faltas', value: baseStatsFiltered.reduce((s, b) => s + (b.faltas || 0), 0) },
    { label: 'Férias', value: baseStatsFiltered.reduce((s, b) => s + (b.ferias || 0), 0) },
    { label: 'Afastados', value: baseStatsFiltered.reduce((s, b) => s + (b.afastados || 0), 0) },
  ] : []

  const alertsChartData = [
    { label: 'Críticos', value: alertsSnapshot.summary?.critical || 0 },
    { label: 'Atenção', value: alertsSnapshot.summary?.warning || 0 },
    { label: 'Info', value: alertsSnapshot.summary?.info || 0 },
  ]

  const systemHealthScore = Math.round(
    100 - (((alertsSnapshot.summary?.critical || 0) * 10 + (alertsSnapshot.summary?.warning || 0) * 3) % 100)
  )

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Painel</span>
          <h1>Dashboard operacional</h1>
          <p>Visão resumida de módulos, permissões ativas e base cadastral.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          {filiais.length > 1 && (
            <label className="field filter-field" style={{ minWidth: 180, marginBottom: 0 }}>
              <span>Base</span>
              <select value={selectedFilialId} onChange={(e) => setSelectedFilialId(e.target.value)}>
                <option value="">Todas as bases</option>
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>
                ))}
              </select>
            </label>
          )}
          {showLoadingHighlights && <div className="profile-chip">Atualizando dados...</div>}
        </div>
      </div>

      {errorMessage && <div className="alert-error">{errorMessage}</div>}

      <div className="dashboard-tab-row">
        <button className={`button-secondary dashboard-tab-button${activeTab === 'geral' ? ' active' : ''}`} onClick={() => setActiveTab('geral')} type="button">
          Visão geral
        </button>
        <button className={`button-secondary dashboard-tab-button${activeTab === 'graficos' ? ' active' : ''}`} onClick={() => setActiveTab('graficos')} type="button">
          Análise com gráficos
        </button>
        {loadingSummary.available && (
          <button
            className={`button-secondary dashboard-tab-button${activeTab === 'carregamento' ? ' active' : ''}`}
            onClick={() => setActiveTab('carregamento')}
            type="button"
          >
            Carregamento hoje
          </button>
        )}
      </div>

      {activeTab === 'geral' ? (
        <>
          {showGeneralSkeleton ? (
            <div className="stats-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <article className="stat-card stat-card-skeleton" key={`stat-skeleton-${index}`}>
                  <span className="skeleton-line skeleton-line-short" />
                  <strong className="skeleton-line skeleton-line-value" />
                  <small className="skeleton-line skeleton-line-medium" />
                </article>
              ))}
            </div>
          ) : (
            <div className="stats-grid">
              {stats.map((item) => (
                <StatCard item={item} key={item.label} />
              ))}
            </div>
          )}

          {showGeneralSkeleton ? (
            <div className="workforce-summary-grid dashboard-base-grid">
              {Array.from({ length: 2 }).map((_, index) => (
                <article className="surface-card workforce-summary-card skeleton-panel" key={`base-skeleton-${index}`}>
                  <div className="section-title">
                    <span className="skeleton-line skeleton-line-short" />
                    <h2 className="skeleton-line skeleton-line-title" />
                  </div>
                  <div className="workforce-kpi-grid">
                    {Array.from({ length: 4 }).map((_, itemIndex) => (
                      <div className="workforce-kpi" key={`base-skeleton-kpi-${itemIndex}`}>
                        <span className="skeleton-line skeleton-line-short" />
                        <strong className="skeleton-line skeleton-line-value" />
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : baseStats.length > 0 && (
            <div className="workforce-summary-grid dashboard-base-grid">
              {baseStats.filter((base) => !selectedFilialId || String(base.filial_id) === String(selectedFilialId)).map((base) => (
                <article className="surface-card workforce-summary-card" key={`dashboard-${base.filial_id}`}>
                  <div className="section-title">
                    <span className="eyebrow">Base do gestor</span>
                    <h2>{base.filial_nome}</h2>
                  </div>
                  <div className="workforce-kpi-grid">
                    <div className="workforce-kpi">
                      <span>Ativos</span>
                      <strong>{base.ativos}</strong>
                    </div>
                    <div className="workforce-kpi">
                      <span>Faltas</span>
                      <strong>{base.faltas}</strong>
                    </div>
                    <div className="workforce-kpi">
                      <span>Férias</span>
                      <strong>{base.ferias}</strong>
                    </div>
                    <div className="workforce-kpi">
                      <span>Afastados</span>
                      <strong>{base.afastados}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {feriadosProximos.length > 0 && hasScopePermission(profile, 'menu.feriados') && (
            <article className="surface-card panel-card">
              <div className="section-title">
                <span className="eyebrow">Calendário</span>
                <h2>Próximos feriados</h2>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Feriado</th>
                      <th>Tipo</th>
                      <th>Expediente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feriadosProximos.map((f) => (
                      <tr key={f.id}>
                        <td>{f.data ? f.data.split('-').reverse().join('/') : '—'}</td>
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

          <div className="dashboard-grid">
            {estoqueAlertas.length > 0 && hasScopePermission(profile, 'menu.estoque') && (
              <article className="surface-card panel-card">
                <div className="section-title">
                  <span className="eyebrow">Estoque</span>
                  <h2>Alerta: estoque baixo</h2>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Em estoque</th>
                        <th>Mínimo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estoqueAlertas.map((item) => (
                        <tr key={item.id}>
                          <td><strong>{item.nome}</strong></td>
                          <td style={{ color: '#dc2626', fontWeight: 600 }}>{Number(item.estoque_atual || 0).toFixed(2)}</td>
                          <td>{Number(item.estoque_minimo || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            )}

            {pedidosPendentes > 0 && hasScopePermission(profile, 'menu.pedidos_compra') && (
              <article className="surface-card panel-card">
                <div className="section-title">
                  <span className="eyebrow">Compras</span>
                  <h2>Pedidos pendentes</h2>
                </div>
                <div className="workforce-kpi-grid">
                  <div className="workforce-kpi">
                    <span>Aguardando aprovação</span>
                    <strong style={{ fontSize: 28, color: '#d97706' }}>{pedidosPendentes}</strong>
                  </div>
                </div>
              </article>
            )}

            <article className="surface-card panel-card">
              <div className="section-title">
                <span className="eyebrow">Motor de alertas</span>
                <h2>Notificações automáticas</h2>
              </div>

              {alertsSnapshot.last_error && <div className="alert-error">Falha no motor de alertas: {alertsSnapshot.last_error}</div>}

              <div className="badge-row">
                <span className="permission-badge enabled">Total: {alertsSnapshot.summary?.total || 0}</span>
                <span className={`permission-badge${(alertsSnapshot.summary?.critical || 0) > 0 ? ' enabled' : ''}`}>
                  Críticos: {alertsSnapshot.summary?.critical || 0}
                </span>
                <span className={`permission-badge${(alertsSnapshot.summary?.warning || 0) > 0 ? ' enabled' : ''}`}>
                  Atenção: {alertsSnapshot.summary?.warning || 0}
                </span>
                <span className="permission-badge">Info: {alertsSnapshot.summary?.info || 0}</span>
              </div>

              {alertsSnapshot.last_run_at && (
                <small className="field-help-text">Última atualização automática: {new Date(alertsSnapshot.last_run_at).toLocaleString('pt-BR')}</small>
              )}

              {alertsSnapshot.items?.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nível</th>
                        <th>Alerta</th>
                        <th>Status</th>
                        <th>Prazo/Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertsSnapshot.items.slice(0, 8).map((item) => (
                        <tr key={`${item.type}-${item.reference_id}`}>
                          <td><strong>{formatSeverityLabel(item.severity)}</strong></td>
                          <td>
                            <strong>{item.title}</strong>
                            <br />
                            <small>{item.message}</small>
                          </td>
                          <td>{item.status || '-'}</td>
                          <td>{item.date_limit || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">Sem alertas ativos no momento.</div>
              )}
            </article>

            {rhDocumentsSummary.available && (
              <article className="surface-card panel-card">
                <div className="section-title">
                  <span className="eyebrow">RH</span>
                  <h2>Alertas documentais</h2>
                </div>
                {!rhDocumentsSummary.database_ready ? (
                  <div className="alert-error">A migration de documentos RH ainda não foi executada no banco.</div>
                ) : (
                  <div className="stats-grid compact-stats-grid">
                    {(rhDocumentsSummary.cards || []).map((item) => (
                      <StatCard item={item} key={item.label} />
                    ))}
                  </div>
                )}
              </article>
            )}

            <article className="surface-card panel-card">
              <div className="section-title">
                <span className="eyebrow">Usuário autenticado</span>
                <h2>{profile?.nome_completo || 'Operador'}</h2>
              </div>
              <div className="meta-grid">
                <div>
                  <span>Cargo</span>
                  <strong>{profile?.cargo || '-'}</strong>
                </div>
                <div>
                  <span>CPF</span>
                  <strong>{profile?.cpf || '-'}</strong>
                </div>
                <div>
                  <span>Acesso</span>
                  <strong>{profile?.tipo_acesso || '-'}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{profile?.ativo ? 'Ativo' : 'Inativo'}</strong>
                </div>
                <div>
                  <span>Bases visíveis</span>
                  <strong>{allowedBasesText}</strong>
                </div>
              </div>
            </article>

            <article className="surface-card panel-card">
              <div className="section-title">
                <span className="eyebrow">Permissões</span>
                <h2>Regras principais</h2>
              </div>
              <div className="badge-row">
                <span className={`permission-badge${profile?.permissions?.app ? ' enabled' : ''}`}>Web</span>
                <span className={`permission-badge${profile?.permissions?.desktop ? ' enabled' : ''}`}>Desktop</span>
                <span className={`permission-badge${profile?.permissions?.edit ? ' enabled' : ''}`}>Editar</span>
                <span className={`permission-badge${profile?.permissions?.delete ? ' enabled' : ''}`}>Excluir</span>
                <span className={`permission-badge${profile?.permissions?.approve_he ? ' enabled' : ''}`}>Aprovar HE</span>
              </div>
            </article>
          </div>
        </>
      ) : null}

      {/* ===== TAB: ANÁLISE COM GRÁFICOS ===== */}
      {activeTab === 'graficos' ? (
        <>
          <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '40px' }}>
            {/* Health Score Gauge */}
            <article className="surface-card panel-card">
              <GaugeChart value={systemHealthScore} max={100} title="Saúde do Sistema" unit="%" color="#10b981" width={300} height={300} />
            </article>

            {/* Status Distribution Pie */}
            {statusChartData.length > 0 && (
              <article className="surface-card panel-card">
                <PieChart data={statusChartData} title="Distribuição de Pessoal" width={350} height={350} />
              </article>
            )}
          </div>

          <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '40px' }}>
            {/* Workforce by Base Bar */}
            {workforceChartData.length > 0 && (
              <article className="surface-card panel-card">
                <BarChart data={workforceChartData} title="Colaboradores por Base" width={400} height={300} />
              </article>
            )}

            {/* Alerts Distribution */}
            {alertsChartData.some((d) => d.value > 0) && (
              <article className="surface-card panel-card">
                <BarChart
                  data={alertsChartData}
                  title="Distribuição de Alertas"
                  width={400}
                  height={300}
                />
              </article>
            )}
          </div>

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
            <article className="surface-card panel-card" style={{ textAlign: 'center' }}>
              <small style={{ color: '#556371' }}>Total de Colaboradores</small>
              <strong style={{ fontSize: '28px', color: '#10b981', display: 'block' }}>
                {baseStatsFiltered.reduce((s, b) => s + (b.ativos || 0) + (b.faltas || 0) + (b.ferias || 0) + (b.afastados || 0), 0)}
              </strong>
            </article>

            <article className="surface-card panel-card" style={{ textAlign: 'center' }}>
              <small style={{ color: '#556371' }}>Alertas Críticos</small>
              <strong style={{ fontSize: '28px', color: (alertsSnapshot.summary?.critical || 0) > 0 ? '#ef4444' : '#10b981', display: 'block' }}>
                {alertsSnapshot.summary?.critical || 0}
              </strong>
            </article>

            <article className="surface-card panel-card" style={{ textAlign: 'center' }}>
              <small style={{ color: '#556371' }}>Estoque Baixo</small>
              <strong style={{ fontSize: '28px', color: '#f59e0b', display: 'block' }}>
                {estoqueAlertas.length}
              </strong>
            </article>

            <article className="surface-card panel-card" style={{ textAlign: 'center' }}>
              <small style={{ color: '#556371' }}>Pedidos Pendentes</small>
              <strong style={{ fontSize: '28px', color: '#8b5cf6', display: 'block' }}>
                {pedidosPendentes}
              </strong>
            </article>
          </div>
        </>
      ) : null}

      {/* ===== TAB: CARREGAMENTO ===== */}
      {activeTab === 'carregamento' ? (
        <>
          {!loadingSummary.database_ready ? (
            <div className="alert-error">A migration de carregamento ainda não foi executada no banco.</div>
          ) : (
            <>
              <div className="stats-grid">
                {(loadingSummary.cards || []).map((item) => (
                  <StatCard item={item} key={item.label} />
                ))}
              </div>

              <article className="surface-card panel-card">
                <div className="section-title">
                  <span className="eyebrow">Carregamento do dia</span>
                  <h2>Maiores impactos operacionais</h2>
                </div>
                {loadingSummary.highlights?.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Placa</th>
                          <th>Base</th>
                          <th>Rota</th>
                          <th>Status</th>
                          <th>Tempo parado</th>
                          <th>Ocorrências</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingSummary.highlights.map((item) => (
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
                  <div className="empty-state">Nenhuma jornada registrada para hoje.</div>
                )}
              </article>
            </>
          )}
        </>
      ) : null}
    </section>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

const FILIAL_COLORS = ['#1a73e8', '#22c55e', '#f59e0b', '#6366f1', '#ef4444', '#14b8a6', '#ec4899', '#8b5cf6', '#f97316', '#06b6d4']
const TURNO_COLORS = { manha: '#f59e0b', tarde: '#f97316', noite: '#6366f1', madrugada: '#1a73e8' }

function pad(value) {
  return String(value).padStart(2, '0')
}

function toISODate(dateObj) {
  return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`
}

function formatMinutes(totalMinutes) {
  const safe = Math.round(Number(totalMinutes || 0))
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60
  if (hours <= 0) {
    return `${minutes}min`
  }
  return `${hours}h${pad(minutes)}`
}

function formatDiaLabel(value) {
  if (!value) return ''
  const [, m, d] = value.split('-')
  return `${d}/${m}`
}

function formatTurno(value) {
  if (!value) return '-'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function BarChart({ data, valueKey, labelKey, color = '#1a73e8', formatValue, colorFn, maxItems = 12, unitKey, unitSuffix }) {
  const slice = data?.slice(0, maxItems) || []
  if (!slice.length) {
    return <div style={{ color: '#aaa', fontSize: 13, padding: '12px 0' }}>Sem dados no período.</div>
  }
  const max = Math.max(...slice.map((d) => d[valueKey] || 0), 0.001)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {slice.map((d, i) => {
        const pct = Math.max((d[valueKey] / max) * 100, 1)
        const bg = colorFn ? colorFn(d, i) : color
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 130, fontSize: 12, textAlign: 'right', color: '#444', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }} title={d[labelKey]}>
              {d[labelKey]}
            </div>
            <div style={{ flex: 1, background: '#f0f4f8', borderRadius: 4, height: 26, position: 'relative', minWidth: 80 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: bg, borderRadius: 4, transition: 'width 0.4s ease' }} />
              <span style={{ position: 'absolute', left: 10, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 700, color: pct > 35 ? '#fff' : '#333', zIndex: 1 }}>
                {formatValue ? formatValue(d[valueKey]) : d[valueKey]}
              </span>
            </div>
            {unitKey && d[unitKey] != null && (
              <span style={{ fontSize: 11, color: '#888', minWidth: 48, textAlign: 'right' }}>{d[unitKey]}{unitSuffix || ''}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function LineChart({ data, valueKey, labelKey, color = '#1a73e8', formatValue }) {
  if (!data?.length || data.length < 2) {
    return <div style={{ color: '#aaa', fontSize: 13, padding: '12px 0' }}>Período curto demais para o gráfico de linha.</div>
  }
  const values = data.map((d) => d[valueKey] || 0)
  const max = Math.max(...values, 0.001)
  const h = 150
  const w = Math.max(560, data.length * 46)
  const padBox = { top: 14, right: 20, bottom: 34, left: 56 }
  const innerW = w - padBox.left - padBox.right
  const innerH = h - padBox.top - padBox.bottom

  const points = data.map((d, i) => ({
    x: padBox.left + (i / Math.max(data.length - 1, 1)) * innerW,
    y: padBox.top + (1 - (d[valueKey] || 0) / max) * innerH,
    d,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padBox.top + innerH} L ${points[0].x} ${padBox.top + innerH} Z`

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={w} height={h} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="lmAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padBox.top + t * innerH
          return (
            <g key={t}>
              <line x1={padBox.left - 4} y1={y} x2={padBox.left + innerW} y2={y} stroke="#f0f0f0" strokeWidth="1" />
              <text x={padBox.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#aaa">
                {Math.round(max * (1 - t))}
              </text>
            </g>
          )
        })}
        <path d={areaD} fill="url(#lmAreaGrad)" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke={color} strokeWidth="2" />
            <text x={p.x} y={padBox.top + innerH + 18} textAnchor="middle" fontSize={9} fill="#666">
              {p.d[labelKey]}
            </text>
            {(i === 0 || i === data.length - 1 || p.d[valueKey] === max) && (
              <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={10} fontWeight="700" fill={color}>
                {formatValue ? formatValue(p.d[valueKey]) : p.d[valueKey]}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

function StatCard({ label, value, sub, color = '#1a73e8' }) {
  return (
    <div className="surface-card" style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#888', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function ChartCard({ title, children, hint }) {
  return (
    <div className="surface-card" style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#888', marginBottom: hint ? 2 : 14, letterSpacing: '0.05em' }}>
        {title}
      </div>
      {hint && <div style={{ fontSize: 12, color: '#aaa', marginBottom: 14 }}>{hint}</div>}
      {children}
    </div>
  )
}

export default function LoadingMetricsPage() {
  const navigate = useNavigate()
  const today = useMemo(() => new Date(), [])
  const firstOfMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today])

  const [dataInicio, setDataInicio] = useState(toISODate(firstOfMonth))
  const [dataFim, setDataFim] = useState(toISODate(today))
  const [filial, setFilial] = useState('')
  const [turno, setTurno] = useState('')
  const [filiais, setFiliais] = useState([])
  const [turnoOptions, setTurnoOptions] = useState([])
  const [metricas, setMetricas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  function load() {
    setLoading(true)
    setErro('')
    const params = { data_inicio: dataInicio, data_fim: dataFim }
    if (filial) params.filial_id = filial
    if (turno) params.turno = turno
    api.getLoadingMetrics(params)
      .then((data) => {
        setMetricas(data)
        if (data?.filiais_disponiveis?.length) setFiliais(data.filiais_disponiveis)
        if (data?.turno_options?.length) setTurnoOptions(data.turno_options)
      })
      .catch((err) => setErro(err.message || 'Falha ao carregar métricas.'))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [dataInicio, dataFim, filial, turno])

  function aplicarPreset(preset) {
    const now = new Date()
    if (preset === 'mes') {
      setDataInicio(toISODate(new Date(now.getFullYear(), now.getMonth(), 1)))
      setDataFim(toISODate(now))
    } else if (preset === 'mesPassado') {
      setDataInicio(toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)))
      setDataFim(toISODate(new Date(now.getFullYear(), now.getMonth(), 0)))
    } else if (preset === '30dias') {
      const inicio = new Date(now)
      inicio.setDate(inicio.getDate() - 29)
      setDataInicio(toISODate(inicio))
      setDataFim(toISODate(now))
    } else if (preset === 'ano') {
      setDataInicio(toISODate(new Date(now.getFullYear(), 0, 1)))
      setDataFim(toISODate(now))
    }
  }

  const m = metricas || {}
  const porDia = (m.por_dia || []).map((d) => ({ ...d, dia_label: formatDiaLabel(d.chave) }))
  const porTurno = (m.por_turno || []).map((d) => ({ ...d, turno_label: formatTurno(d.chave) }))

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Operação RTM</span>
          <h1>Controle de carregamento — Métricas</h1>
          <p>Cilindros carregados, tempo médio de carga, paradas e desempenho por base, turno, caminhão e referência.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="button-secondary" onClick={() => navigate('/carregamento')} type="button">
            ← Operação
          </button>
        </div>
      </div>

      {/* Filtros interativos */}
      <div className="surface-card" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <label className="field" style={{ flex: '0 1 160px' }}>
            <span>De</span>
            <input type="date" value={dataInicio} max={dataFim} onChange={(e) => setDataInicio(e.target.value)} />
          </label>
          <label className="field" style={{ flex: '0 1 160px' }}>
            <span>Até</span>
            <input type="date" value={dataFim} min={dataInicio} onChange={(e) => setDataFim(e.target.value)} />
          </label>
          <label className="field" style={{ flex: '0 1 180px' }}>
            <span>Base</span>
            <select value={filial} onChange={(e) => setFilial(e.target.value)}>
              <option value="">Todas</option>
              {filiais.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </label>
          <label className="field" style={{ flex: '0 1 160px' }}>
            <span>Turno</span>
            <select value={turno} onChange={(e) => setTurno(e.target.value)}>
              <option value="">Todos</option>
              {turnoOptions.map((t) => (
                <option key={t} value={t}>{formatTurno(t)}</option>
              ))}
            </select>
          </label>
          <div className="button-row" style={{ flex: '1 1 auto', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="button-secondary" type="button" onClick={() => aplicarPreset('mes')}>Este mês</button>
            <button className="button-secondary" type="button" onClick={() => aplicarPreset('mesPassado')}>Mês passado</button>
            <button className="button-secondary" type="button" onClick={() => aplicarPreset('30dias')}>Últimos 30 dias</button>
            <button className="button-secondary" type="button" onClick={() => aplicarPreset('ano')}>Este ano</button>
          </div>
        </div>
      </div>

      {erro && <div className="alert-error">{erro}</div>}
      {m.database_ready === false && (
        <div className="alert-error">As tabelas do módulo de carregamento ainda não existem no banco. Rode a migration primeiro.</div>
      )}
      {loading && <div className="empty-state">Carregando métricas...</div>}

      {!loading && m.database_ready !== false && (
        <>
          {/* Cards de resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 16 }}>
            <StatCard label="Cilindros no período" value={(m.total_cilindros || 0).toLocaleString('pt-BR')} color="#1a7340" />
            <StatCard label="Jornadas" value={m.total_jornadas || 0} sub={`${m.total_finalizadas || 0} finalizadas`} />
            <StatCard label="Tempo médio de carga" value={formatMinutes(m.tempo_medio_carga_min)} sub="por jornada com carga" color="#6366f1" />
            <StatCard label="Tempo médio parado" value={formatMinutes(m.tempo_medio_parado_min)} sub="por jornada com parada" color="#f59e0b" />
            <StatCard label="Média cilindros/jornada" value={(m.media_cilindros_jornada || 0).toLocaleString('pt-BR')} color="#14b8a6" />
            <StatCard label="Ocorrências" value={m.total_ocorrencias || 0} color="#ef4444" />
          </div>

          {/* Evolução diária de cilindros */}
          <ChartCard title="Cilindros carregados por dia">
            <LineChart data={porDia} valueKey="cilindros" labelKey="dia_label" color="#1a7340" />
          </ChartCard>

          <div style={{ height: 16 }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, marginBottom: 16 }}>
            {/* Top caminhões por cilindros */}
            <ChartCard title="Caminhões com mais cilindros" hint="Quem mais carregou no período">
              <BarChart
                data={m.por_veiculo}
                valueKey="cilindros"
                labelKey="label"
                colorFn={(_, i) => FILIAL_COLORS[i % FILIAL_COLORS.length]}
                unitKey="jornadas"
                unitSuffix=" jorn."
                maxItems={10}
              />
            </ChartCard>

            {/* Tempo médio de carga por caminhão */}
            <ChartCard title="Tempo médio de carga por caminhão" hint="Quem carrega mais rápido / mais devagar">
              <BarChart
                data={[...(m.por_veiculo || [])].filter((d) => d.tempo_medio > 0).sort((a, b) => b.tempo_medio - a.tempo_medio)}
                valueKey="tempo_medio"
                labelKey="label"
                formatValue={formatMinutes}
                color="#6366f1"
                maxItems={10}
              />
            </ChartCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, marginBottom: 16 }}>
            {/* Por base */}
            <ChartCard title="Cilindros por base">
              <BarChart
                data={m.por_filial}
                valueKey="cilindros"
                labelKey="label"
                colorFn={(_, i) => FILIAL_COLORS[i % FILIAL_COLORS.length]}
                unitKey="jornadas"
                unitSuffix=" jorn."
              />
            </ChartCard>

            {/* Por turno */}
            <ChartCard title="Cilindros por turno">
              <BarChart
                data={porTurno}
                valueKey="cilindros"
                labelKey="turno_label"
                colorFn={(d) => TURNO_COLORS[d.chave] || '#94a3b8'}
                unitKey="jornadas"
                unitSuffix=" jorn."
              />
            </ChartCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
            {/* Por referência/rota */}
            <ChartCard title="Cilindros por referência">
              <BarChart
                data={m.por_rota}
                valueKey="cilindros"
                labelKey="label"
                color="#14b8a6"
                unitKey="jornadas"
                unitSuffix=" jorn."
                maxItems={10}
              />
            </ChartCard>

            {/* Motivos de parada por tempo */}
            <ChartCard title="Motivos de parada (tempo total)" hint="Onde o tempo está sendo perdido">
              <BarChart
                data={m.por_motivo}
                valueKey="minutos"
                labelKey="label"
                formatValue={formatMinutes}
                color="#f59e0b"
                unitKey="ocorrencias"
                unitSuffix="x"
                maxItems={10}
              />
            </ChartCard>
          </div>

          {!m.total_jornadas && (
            <div className="surface-card empty-state" style={{ marginTop: 16 }}>
              <strong>Nenhuma jornada no período selecionado.</strong>
              <p>Ajuste o intervalo de datas ou os filtros acima.</p>
            </div>
          )}
        </>
      )}
    </section>
  )
}

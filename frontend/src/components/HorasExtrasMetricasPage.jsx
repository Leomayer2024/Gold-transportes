import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

function formatBRL(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

function formatHHMM(dec) {
  const totalMin = Math.round((dec || 0) * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatMesLabel(mes) {
  if (!mes) return ''
  const [ano, m] = mes.split('-')
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${nomes[parseInt(m, 10) - 1]}/${ano.slice(2)}`
}

function BarChart({ data, valueKey, labelKey, color = 'var(--primary)', formatValue, title }) {
  const max = Math.max(...data.map((d) => d[valueKey] || 0), 0.001)
  return (
    <div>
      {title && <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10, letterSpacing: '0.05em' }}>{title}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((d, i) => {
          const pct = Math.max((d[valueKey] / max) * 100, 1)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 140, fontSize: 11, textAlign: 'right', color: '#444', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }} title={d[labelKey]}>
                {d[labelKey]}
              </div>
              <div style={{ flex: 1, background: '#f0f4f8', borderRadius: 4, height: 22, position: 'relative', minWidth: 80 }}>
                <div
                  style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${pct}%`, background: color, borderRadius: 4,
                    transition: 'width 0.4s ease',
                  }}
                />
                <span style={{ position: 'absolute', left: 8, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: pct > 30 ? '#fff' : '#333', zIndex: 1 }}>
                  {formatValue ? formatValue(d[valueKey]) : d[valueKey]}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LineChart({ data, valueKey, labelKey, color = 'var(--primary)', formatValue, title }) {
  const values = data.map((d) => d[valueKey] || 0)
  const max = Math.max(...values, 0.001)
  const min = 0
  const h = 120
  const w = 600
  const pad = { top: 10, right: 20, bottom: 30, left: 60 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom

  const points = data.map((d, i) => {
    const x = pad.left + (i / Math.max(data.length - 1, 1)) * innerW
    const y = pad.top + (1 - (d[valueKey] - min) / (max - min)) * innerH
    return { x, y, d }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${pad.top + innerH} L ${points[0].x} ${pad.top + innerH} Z`
    : ''

  return (
    <div>
      {title && <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10, letterSpacing: '0.05em' }}>{title}</div>}
      {data.length < 2 ? (
        <div style={{ color: 'var(--muted)', fontSize: 12, padding: '12px 0' }}>Dados insuficientes para o gráfico (mínimo 2 meses).</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', minWidth: 300, height: h }}>
            {/* Area */}
            <defs>
              <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={color} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={areaD} fill="url(#area-grad)" />
            <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {/* Pontos */}
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="4" fill={color} stroke="#fff" strokeWidth="2" />
                {/* Label eixo X */}
                <text x={p.x} y={h - 4} textAnchor="middle" fontSize="9" fill="#888">{p.d[labelKey]}</text>
                {/* Valor acima do ponto */}
                <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill={color} fontWeight="700">
                  {formatValue ? formatValue(p.d[valueKey]) : p.d[valueKey]}
                </text>
              </g>
            ))}
            {/* Eixo Y */}
            <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + innerH} stroke="#ddd" strokeWidth="1" />
            <line x1={pad.left} y1={pad.top + innerH} x2={pad.left + innerW} y2={pad.top + innerH} stroke="#ddd" strokeWidth="1" />
          </svg>
        </div>
      )}
    </div>
  )
}

export default function HorasExtrasMetricasPage() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('filiais')

  useEffect(() => {
    api.rtmMetricas()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const totalFuncionarios = data?.top_funcionarios?.reduce((s, f) => s + (f.meses || 0), 0) || 0
  const totalHorasExtra = data?.evolucao_mensal?.reduce((s, m) => s + (m.horas_extra_100 || 0), 0) || 0
  const totalGeral = data?.evolucao_mensal?.reduce((s, m) => s + (m.total || 0), 0) || 0
  const mesesComDados = data?.evolucao_mensal?.length || 0

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Operação RTM</span>
          <h1>Métricas de Horas Extras</h1>
          <p>Análise histórica e rankings por filial, funcionário e evolução mensal</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="button-secondary" onClick={() => navigate('/horas-extras-rtm')} type="button">← Calculadora</button>
          <button className="button-secondary" onClick={() => navigate('/horas-extras-historico')} type="button">Histórico</button>
        </div>
      </div>

      {loading ? (
        <div className="surface-card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Carregando métricas…</div>
      ) : !data || mesesComDados === 0 ? (
        <div className="surface-card empty-state">
          <strong>Nenhum dado encontrado</strong>
          <p>Salve ao menos um fechamento na calculadora RTM para ver as métricas.</p>
          <button className="button-primary" onClick={() => navigate('/horas-extras-rtm')} type="button">Ir para Calculadora</button>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            {[
              { label: 'Meses fechados', value: mesesComDados, mono: true },
              { label: 'Total H. Extra 100%', value: formatHHMM(totalHorasExtra), mono: true },
              { label: 'Custo total acumulado', value: formatBRL(totalGeral), color: 'var(--success)' },
              { label: 'Filiais com horas', value: data.top_filiais?.length || 0, mono: true },
            ].map((k, i) => (
              <div key={i} style={{ padding: '12px 20px', background: '#fff', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', minWidth: 160 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: k.mono ? 'monospace' : undefined, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Evolução mensal */}
          <div className="surface-card" style={{ marginBottom: 16 }}>
            <LineChart
              title="Evolução mensal — Custo total (R$)"
              data={(data.evolucao_mensal || []).map((m) => ({ ...m, label: formatMesLabel(m.mes) }))}
              valueKey="total"
              labelKey="label"
              color="var(--primary)"
              formatValue={(v) => `R$${(v / 1000).toFixed(0)}k`}
            />
          </div>

          <div className="surface-card" style={{ marginBottom: 16 }}>
            <LineChart
              title="Evolução mensal — Horas extras 100% (h)"
              data={(data.evolucao_mensal || []).map((m) => ({ ...m, label: formatMesLabel(m.mes) }))}
              valueKey="horas_extra_100"
              labelKey="label"
              color="#f0b429"
              formatValue={(v) => formatHHMM(v)}
            />
          </div>

          {/* Tabs ranking */}
          <div className="surface-card">
            <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border-light)' }}>
              {[
                { key: 'filiais', label: 'Top Filiais — H. Extra 100%' },
                { key: 'filiais_custo', label: 'Top Filiais — Custo' },
                { key: 'funcionarios', label: 'Top Funcionários — H. Extra 100%' },
                { key: 'funcionarios_custo', label: 'Top Funcionários — Custo' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  type="button"
                  style={{
                    padding: '8px 14px', fontSize: 12, fontWeight: tab === t.key ? 700 : 400,
                    background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
                    color: tab === t.key ? 'var(--primary)' : 'var(--muted)', cursor: 'pointer',
                    marginBottom: -1,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'filiais' && (
              <BarChart
                title="Filiais com mais horas extras 100%"
                data={data.top_filiais || []}
                valueKey="horas_extra_100"
                labelKey="filial"
                color="#f0b429"
                formatValue={formatHHMM}
              />
            )}
            {tab === 'filiais_custo' && (
              <BarChart
                title="Filiais com maior custo total"
                data={[...(data.top_filiais || [])].sort((a, b) => b.total - a.total)}
                valueKey="total"
                labelKey="filial"
                color="var(--primary)"
                formatValue={(v) => formatBRL(v)}
              />
            )}
            {tab === 'funcionarios' && (
              <BarChart
                title="Funcionários com mais horas extras 100%"
                data={data.top_funcionarios || []}
                valueKey="horas_extra_100"
                labelKey="funcionario"
                color="#f0b429"
                formatValue={formatHHMM}
              />
            )}
            {tab === 'funcionarios_custo' && (
              <BarChart
                title="Funcionários com maior custo total"
                data={[...(data.top_funcionarios || [])].sort((a, b) => b.total - a.total)}
                valueKey="total"
                labelKey="funcionario"
                color="var(--primary)"
                formatValue={(v) => formatBRL(v)}
              />
            )}
          </div>
        </>
      )}
    </section>
  )
}

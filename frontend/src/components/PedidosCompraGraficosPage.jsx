import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

function formatBRL(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

function formatMes(mes) {
  if (!mes) return ''
  const [ano, m] = mes.split('-')
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${nomes[parseInt(m, 10) - 1]}/${ano.slice(2)}`
}

const STATUS_LABELS = {
  rascunho: 'Rascunho',
  pendente: 'Pendente',
  pendente_aprovacao: 'Pend. aprovação',
  analise: 'Em análise',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  em_compra: 'Em compra',
  recebido: 'Recebido',
  cancelado: 'Cancelado',
}

const STATUS_COLORS = {
  aprovado: '#22c55e',
  recebido: '#16a34a',
  em_compra: '#f59e0b',
  analise: '#6366f1',
  em_analise: '#6366f1',
  pendente: '#94a3b8',
  pendente_aprovacao: '#94a3b8',
  rascunho: '#cbd5e1',
  reprovado: '#ef4444',
  cancelado: '#f87171',
}

const CATEGORIA_LABELS = {
  limpeza: 'Limpeza', manutencao: 'Manutenção', epi: 'EPI',
  escritorio: 'Escritório', alimentacao: 'Alimentação', combustivel: 'Combustível',
  informatica: 'Informática', uniforme: 'Uniforme', ferramentas: 'Ferramentas', outro: 'Outro',
}

const FILIAL_COLORS = ['#1a73e8','#22c55e','#f59e0b','#6366f1','#ef4444','#14b8a6','#ec4899','#8b5cf6','#f97316','#06b6d4']

function BarChart({ data, valueKey, labelKey, color = 'var(--accent, #1a73e8)', formatValue, title, colorFn, maxItems = 12 }) {
  const slice = data?.slice(0, maxItems) || []
  if (!slice.length) return <div style={{ color: '#aaa', fontSize: 13, padding: '12px 0' }}>Sem dados suficientes.</div>
  const max = Math.max(...slice.map((d) => d[valueKey] || 0), 0.001)
  return (
    <div>
      {title && (
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted, #888)', marginBottom: 12, letterSpacing: '0.05em' }}>
          {title}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {slice.map((d, i) => {
          const pct = Math.max((d[valueKey] / max) * 100, 1)
          const bg = colorFn ? colorFn(d, i) : color
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 150, fontSize: 12, textAlign: 'right', color: '#444', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }} title={d[labelKey]}>
                {d[labelKey]}
              </div>
              <div style={{ flex: 1, background: '#f0f4f8', borderRadius: 4, height: 26, position: 'relative', minWidth: 80 }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: bg, borderRadius: 4, transition: 'width 0.4s ease' }} />
                <span style={{ position: 'absolute', left: 10, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 700, color: pct > 35 ? '#fff' : '#333', zIndex: 1 }}>
                  {formatValue ? formatValue(d[valueKey]) : d[valueKey]}
                </span>
              </div>
              {d.quantidade != null && (
                <span style={{ fontSize: 11, color: '#888', minWidth: 36, textAlign: 'right' }}>{d.quantidade} ped.</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LineChart({ data, valueKey, labelKey, color = 'var(--accent, #1a73e8)', formatValue, title }) {
  if (!data?.length || data.length < 2) {
    return (
      <div>
        {title && <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted, #888)', marginBottom: 12, letterSpacing: '0.05em' }}>{title}</div>}
        <div style={{ color: '#aaa', fontSize: 13, padding: '12px 0' }}>Dados insuficientes para o gráfico de linha.</div>
      </div>
    )
  }
  const values = data.map((d) => d[valueKey] || 0)
  const max = Math.max(...values, 0.001)
  const h = 130, w = 560
  const pad = { top: 12, right: 20, bottom: 32, left: 70 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom

  const points = data.map((d, i) => ({
    x: pad.left + (i / Math.max(data.length - 1, 1)) * innerW,
    y: pad.top + (1 - (d[valueKey] || 0) / max) * innerH,
    d,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `${pathD} L ${points[points.length - 1].x} ${pad.top + innerH} L ${points[0].x} ${pad.top + innerH} Z`

  return (
    <div>
      {title && <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted, #888)', marginBottom: 12, letterSpacing: '0.05em' }}>{title}</div>}
      <div style={{ overflowX: 'auto' }}>
        <svg width={w} height={h} style={{ display: 'block' }}>
          <defs>
            <linearGradient id="pcAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#pcAreaGrad)" />
          <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={5} fill="#fff" stroke={color} strokeWidth="2" />
              <text x={p.x} y={pad.top + innerH + 18} textAnchor="middle" fontSize={10} fill="#666">
                {p.d[labelKey]}
              </text>
              {i === data.length - 1 && (
                <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={10} fontWeight="700" fill={color}>
                  {formatValue ? formatValue(p.d[valueKey]) : p.d[valueKey]}
                </text>
              )}
            </g>
          ))}
          <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + innerH} stroke="#e0e0e0" strokeWidth="1" />
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = pad.top + t * innerH
            return (
              <g key={t}>
                <line x1={pad.left - 4} y1={y} x2={pad.left + innerW} y2={y} stroke="#f0f0f0" strokeWidth="1" />
                <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#aaa">
                  {formatValue ? formatValue(max * (1 - t)) : Math.round(max * (1 - t))}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color = 'var(--accent, #1a73e8)' }) {
  return (
    <div className="surface-card" style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted, #888)', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function PedidosCompraGraficosPage() {
  const navigate = useNavigate()
  const [metricas, setMetricas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [fFilial, setFFilial] = useState('')
  const [filiais, setFiliais] = useState([])

  function load(filialId) {
    setLoading(true)
    setErro('')
    const params = {}
    if (filialId) params.filial_id = filialId
    api.getPedidosCompraMetricas(params)
      .then((data) => {
        setMetricas(data)
        if (data?.filiais_disponiveis?.length) {
          setFiliais(data.filiais_disponiveis)
        }
      })
      .catch((err) => setErro(err.message || 'Falha ao carregar métricas.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load('') }, [])

  function handleFilialChange(val) {
    setFFilial(val)
    load(val)
  }

  if (loading) {
    return (
      <section className="page-shell">
        <div className="empty-state">Carregando métricas...</div>
      </section>
    )
  }

  if (erro) {
    return (
      <section className="page-shell">
        <div className="alert-error">{erro}</div>
      </section>
    )
  }

  const {
    por_mes = [],
    por_status = [],
    por_pagamento = [],
    por_categoria = [],
    top_fornecedores = [],
    top_filiais = [],
    total_pedidos = 0,
    valor_total_geral = 0,
    ticket_medio = 0,
  } = metricas || {}

  const porMesFormatado = por_mes.map((d) => ({ ...d, mes_label: formatMes(d.mes) }))

  const porStatusFormatado = por_status.map((d) => ({
    ...d,
    label: STATUS_LABELS[d.status] || d.status,
  }))

  const porCategoriaFormatado = por_categoria.map((d) => ({
    ...d,
    categoria_label: CATEGORIA_LABELS[d.categoria] || d.categoria,
  }))

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Compras</span>
          <h1>Gráficos — Pedidos de compra</h1>
          <p>Visão analítica dos pedidos: volume, valor, filiais, fornecedores e categorias.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {filiais.length > 1 && (
            <select
              value={fFilial}
              onChange={(e) => handleFilialChange(e.target.value)}
              style={{ fontSize: 13, padding: '6px 10px', borderRadius: 6, border: '1px solid #d0d5dd', minWidth: 160 }}
            >
              <option value="">Todas as filiais</option>
              {filiais.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          )}
          <button className="button-secondary" onClick={() => navigate('/pedidos-compra')} type="button">
            ← Pedidos
          </button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard label="Total de pedidos" value={total_pedidos} />
        <StatCard label="Valor total" value={formatBRL(valor_total_geral)} color="#1a7340" />
        <StatCard label="Ticket médio" value={formatBRL(ticket_medio)} sub="por pedido com valor" color="#6366f1" />
        <StatCard label="Fornecedores únicos" value={top_fornecedores.length} color="#f59e0b" />
        {!fFilial && <StatCard label="Filiais ativas" value={top_filiais.length} color="#14b8a6" />}
      </div>

      {/* Linha do tempo de gastos */}
      {porMesFormatado.length > 0 && (
        <div className="surface-card" style={{ padding: '20px 24px', marginBottom: 16 }}>
          <LineChart
            title="Gasto por mês (R$)"
            data={porMesFormatado}
            valueKey="valor_total"
            labelKey="mes_label"
            formatValue={formatBRL}
            color="#1a73e8"
          />
        </div>
      )}

      {/* Top Filiais — só quando não há filtro de filial */}
      {!fFilial && top_filiais.length > 0 && (
        <div className="surface-card" style={{ padding: '20px 24px', marginBottom: 16 }}>
          <BarChart
            title="Top filiais por valor (R$)"
            data={top_filiais}
            valueKey="valor_total"
            labelKey="filial"
            formatValue={formatBRL}
            colorFn={(_, i) => FILIAL_COLORS[i % FILIAL_COLORS.length]}
            maxItems={10}
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 16 }}>
        {/* Por status */}
        <div className="surface-card" style={{ padding: '20px 24px' }}>
          <BarChart
            title="Pedidos por status"
            data={porStatusFormatado}
            valueKey="quantidade"
            labelKey="label"
            colorFn={(d) => STATUS_COLORS[d.status] || '#94a3b8'}
          />
        </div>

        {/* Por forma de pagamento */}
        <div className="surface-card" style={{ padding: '20px 24px' }}>
          <BarChart
            title="Valor por forma de pagamento (R$)"
            data={por_pagamento}
            valueKey="valor_total"
            labelKey="forma_pagamento"
            formatValue={formatBRL}
            color="#6366f1"
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* Por categoria */}
        {porCategoriaFormatado.length > 0 && (
          <div className="surface-card" style={{ padding: '20px 24px' }}>
            <BarChart
              title="Gasto por categoria (R$)"
              data={porCategoriaFormatado}
              valueKey="valor_total"
              labelKey="categoria_label"
              formatValue={formatBRL}
              color="#f59e0b"
            />
          </div>
        )}

        {/* Top fornecedores */}
        {top_fornecedores.length > 0 && (
          <div className="surface-card" style={{ padding: '20px 24px' }}>
            <BarChart
              title="Top fornecedores por valor (R$)"
              data={top_fornecedores}
              valueKey="valor_total"
              labelKey="fornecedor"
              formatValue={formatBRL}
              colorFn={(_, i) => FILIAL_COLORS[i % FILIAL_COLORS.length]}
              maxItems={10}
            />
          </div>
        )}
      </div>

      {!por_mes.length && !por_status.length && !top_fornecedores.length && (
        <div className="surface-card empty-state">
          <strong>Nenhum dado disponível ainda.</strong>
          <p>Crie pedidos de compra para visualizar as métricas aqui.</p>
        </div>
      )}
    </section>
  )
}

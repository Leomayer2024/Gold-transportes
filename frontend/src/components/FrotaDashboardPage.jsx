import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

const MES_ATUAL = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})()

const C = {
  primary: '#0969da',
  success: '#1a7f37',
  warning: '#bf8700',
  danger: '#cf222e',
  info: '#0a8d6f',
  purple: '#8250df',
  orange: '#e16f24',
  muted: '#57606a',
  border: '#e2e7ed',
  bg: '#f6f8fa',
}

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0))
}
function formatPrecoLitro(v) {
  if (v == null || isNaN(Number(v))) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v))
}
function diasAte(dataIso) {
  if (!dataIso) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(dataIso)
  alvo.setHours(0, 0, 0, 0)
  return Math.floor((alvo - hoje) / (1000 * 60 * 60 * 24))
}

// ═══ Componentes visuais ═══════════════════════════════════════════════════════

function KPI({ label, value, sub, color, icon }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: 16,
      border: `1px solid ${C.border}`,
      borderLeft: `4px solid ${color || C.primary}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minHeight: 92,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: C.muted,
          textTransform: 'uppercase', letterSpacing: 0.4,
        }}>{label}</span>
        {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      </div>
      <strong style={{ fontSize: 26, fontWeight: 800, color: color || '#24292f', lineHeight: 1, letterSpacing: -0.5 }}>
        {value}
      </strong>
      {sub && <span style={{ fontSize: 11, color: C.muted }}>{sub}</span>}
    </div>
  )
}

// Donut chart SVG
function Donut({ value, total, color, label, suffix = '' }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0
  const r = 42
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={r} fill="none" stroke={C.bg} strokeWidth={10} />
        <circle
          cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
        <text x={55} y={52} textAnchor="middle" fontSize={20} fontWeight={800} fill="#24292f">
          {Math.round(pct)}%
        </text>
        <text x={55} y={68} textAnchor="middle" fontSize={10} fill={C.muted}>
          {value}{suffix} / {total}{suffix}
        </text>
      </svg>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textAlign: 'center' }}>{label}</span>
    </div>
  )
}

// Barras horizontais
function BarChart({ data, color }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 110, fontSize: 12, color: '#24292f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {d.label}
          </div>
          <div style={{ flex: 1, height: 22, background: C.bg, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              width: `${(d.value / max) * 100}%`,
              height: '100%', background: color,
              transition: 'width .5s ease',
              borderRadius: 4,
            }} />
            <span style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              fontSize: 11, fontWeight: 700, color: '#24292f',
            }}>{d.value}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Pie/Donut multi-segmento
function PieMulti({ segments, size = 140 }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const cx = size / 2, cy = size / 2, r = size / 2 - 6
  let cur = -Math.PI / 2
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((s, i) => {
          if (s.value === 0) return null
          const ang = (s.value / total) * 2 * Math.PI
          const x1 = cx + r * Math.cos(cur)
          const y1 = cy + r * Math.sin(cur)
          cur += ang
          const x2 = cx + r * Math.cos(cur)
          const y2 = cy + r * Math.sin(cur)
          const large = ang > Math.PI ? 1 : 0
          return (
            <path key={i}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
              fill={s.color}
              stroke="#fff"
              strokeWidth={2}
            />
          )
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, background: s.color, borderRadius: 3, display: 'inline-block' }} />
            <span style={{ color: '#24292f' }}>{s.label}</span>
            <strong style={{ color: s.color }}>{s.value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

// Painel container
function Panel({ children, title, eyebrow, color }) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 18,
      marginTop: 18,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {(title || eyebrow) && (
        <div style={{ marginBottom: 14 }}>
          {eyebrow && <div style={{
            fontSize: 10, fontWeight: 700, color: color || C.primary,
            letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2,
          }}>{eyebrow}</div>}
          {title && <div style={{ fontSize: 15, fontWeight: 700, color: '#24292f' }}>{title}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

// Grid row de KPIs (FORÇA layout horizontal)
function KPIRow({ children }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 12,
      marginTop: 10,
    }}>{children}</div>
  )
}

// Status chip
function Chip({ status, custom }) {
  if (custom) {
    return (
      <span style={{
        display: 'inline-block', padding: '3px 9px', borderRadius: 12,
        fontSize: 11, fontWeight: 600, color: custom.color, background: custom.bg,
      }}>{custom.label}</span>
    )
  }
  const cfg = {
    aberta:               { c: C.warning, b: '#fff8c5', l: 'Aberta' },
    em_andamento:         { c: C.primary, b: '#dff1ff', l: 'Em andamento' },
    em_execucao:          { c: C.primary, b: '#dff1ff', l: 'Em execução' },
    aguardando_aprovacao: { c: C.warning, b: '#fff8c5', l: 'Aguard.' },
    aprovada:             { c: C.success, b: '#ddf4e4', l: 'Aprovada' },
    aprovado:             { c: C.success, b: '#ddf4e4', l: 'Aprovado' },
    concluida:            { c: C.success, b: '#ddf4e4', l: 'Concluída' },
    finalizada:           { c: C.success, b: '#ddf4e4', l: 'Finalizada' },
    cancelada:            { c: C.muted,   b: C.bg,      l: 'Cancelada' },
    reprovada:            { c: C.danger,  b: '#ffebed', l: 'Reprovada' },
    reprovado:            { c: C.danger,  b: '#ffebed', l: 'Reprovado' },
    rascunho:             { c: C.muted,   b: C.bg,      l: 'Rascunho' },
    pendente:             { c: C.warning, b: '#fff8c5', l: 'Pendente' },
    pendente_aprovacao:   { c: C.warning, b: '#fff8c5', l: 'Pendente' },
    em_analise:           { c: C.orange,  b: '#fff1e5', l: 'Em análise' },
  }[status] || { c: C.muted, b: C.bg, l: status }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 12,
      fontSize: 11, fontWeight: 600, color: cfg.c, background: cfg.b,
    }}>{cfg.l}</span>
  )
}

function PrioChip({ p }) {
  const cfg = {
    critica: { c: '#fff', b: C.danger,  l: 'Crítica' },
    alta:    { c: '#fff', b: C.orange,  l: 'Alta' },
    normal:  { c: C.muted, b: C.bg,     l: 'Normal' },
    baixa:   { c: C.success, b: '#ddf4e4', l: 'Baixa' },
  }[p] || { c: C.muted, b: C.bg, l: p || '—' }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 12,
      fontSize: 11, fontWeight: 700, color: cfg.c, background: cfg.b,
    }}>{cfg.l}</span>
  )
}

function MiniTable({ headers, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{
                textAlign: 'left', padding: '10px 12px',
                background: C.bg, fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 0.3, color: C.muted,
                borderBottom: `1px solid ${C.border}`,
                position: 'sticky', top: 0,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#fafbfc' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid #eef0f3',
                  color: '#24292f',
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LinkBtn({ to, color, children }) {
  return (
    <Link to={to} style={{
      display: 'inline-block', padding: '7px 14px', borderRadius: 6,
      fontSize: 12, fontWeight: 600, background: '#fff',
      color: color || C.primary, border: `1px solid ${color || C.primary}`,
      textDecoration: 'none', marginTop: 12,
    }}>{children}</Link>
  )
}

// ═══ Página ═══════════════════════════════════════════════════════════════════

export default function FrotaDashboardPage() {
  const { profile } = useAuth()
  const [filiais, setFiliais] = useState([])
  const [selectedFilial, setSelectedFilial] = useState('')
  const [mes, setMes] = useState(MES_ATUAL)

  useEffect(() => {
    if (filiais?.length === 1 && !selectedFilial) {
      setSelectedFilial(String(filiais[0].id))
    }
  }, [filiais])

  const [data, setData] = useState(null)
  const [manutAbertas, setManutAbertas] = useState([])
  const [pneusAlerta, setPneusAlerta] = useState([])
  const [docsVencer, setDocsVencer] = useState([])
  const [osMotoristaAtivas, setOsMotoristaAtivas] = useState([])
  const [hePendentes, setHePendentes] = useState([])
  const [abastPendentes, setAbastPendentes] = useState([])
  const [diariasPendentes, setDiariasPendentes] = useState([])
  const [veiculosLista, setVeiculosLista] = useState([])
  const [motoristasLista, setMotoristasLista] = useState([])
  const [vinculos, setVinculos] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const _loaded = useRef(false)

  useEffect(() => {
    api.list('filiais').then(r => setFiliais(Array.isArray(r) ? r : r.data || [])).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    if (!_loaded.current) setLoading(true)
    setError('')
    try {
      const params = {}
      if (selectedFilial) params.filial_id = selectedFilial
      if (mes) params.mes = mes
      const filialParam = params.filial_id ? { filial_id: params.filial_id } : {}

      const safeList = (resource, p = {}) =>
        api.list(resource, p).catch(() => ({ data: [] }))

      const tasks = [
        () => api.getDashboardFrota(params).catch(() => null),
        () => safeList('manutencoes', { ...filialParam, ativo: 'true', page: 1 }),
        () => safeList('veiculos_pneus', { ...filialParam, ativo: 'true', page: 1 }),
        () => safeList('veiculos_documentos', { ...filialParam, page: 1 }),
        () => safeList('ordens_servico_motorista', { ...filialParam, page: 1 }),
        () => safeList('horas_extras', { ...filialParam, page: 1 }),
        () => safeList('veiculos_abastecimentos', { ...filialParam, page: 1 }),
        () => safeList('diarias_solicitacoes', { ...filialParam, page: 1 }),
        () => safeList('veiculos', { ...filialParam, page: 1, per_page: 500 }),
        () => safeList('colaboradores', { ...filialParam, ativo: 'true', page: 1, per_page: 500 }),
        () => safeList('motorista_veiculo', { ...filialParam, ativo: 'true', page: 1, per_page: 1000 }),
      ]
      const results = []
      const batchSize = 3
      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize).map(fn => fn())
        results.push(...await Promise.all(batch))
      }
      const [dash, manut, pneus, docs, osMot, he, abast, diarias, veics, colabs, mvs] = results
      const arr = (x) => (Array.isArray(x) ? x : (x?.data || []))

      setData(dash || {})
      setManutAbertas(
        arr(manut)
          .filter(m => !['concluida', 'cancelada'].includes(m.status))
          .sort((a, b) => {
            const ord = { critica: 0, alta: 1, normal: 2, baixa: 3 }
            return (ord[a.prioridade] ?? 9) - (ord[b.prioridade] ?? 9)
          })
          .slice(0, 10),
      )
      setPneusAlerta(arr(pneus).filter(p => ['trocar', 'rodiziar'].includes(p.status)).slice(0, 8))
      setDocsVencer(arr(docs)
        .map(d => ({ ...d, dias: diasAte(d.data_validade) }))
        .filter(d => d.dias !== null && d.dias <= 60)
        .sort((a, b) => a.dias - b.dias)
        .slice(0, 12))
      setOsMotoristaAtivas(arr(osMot).filter(o => ['aberta', 'em_andamento'].includes(o.status)).slice(0, 10))
      setHePendentes(arr(he).filter(h => ['pendente', 'solicitado'].includes(h.status)))
      setAbastPendentes(arr(abast).filter(a => ['pendente_aprovacao', 'pendente'].includes(a.status)))
      setDiariasPendentes(arr(diarias).filter(d => ['pendente', 'em_analise'].includes(d.status)))
      setVeiculosLista(arr(veics))
      setMotoristasLista(arr(colabs).filter(c => String(c.cargo || '').toLowerCase().includes('motorista')))
      setVinculos(arr(mvs))
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados da frota.')
    } finally {
      _loaded.current = true
      setLoading(false)
    }
  }, [selectedFilial, mes])

  useEffect(() => { void load() }, [load])

  const veiculosPorId = useMemo(() => {
    const m = new Map()
    for (const v of veiculosLista) m.set(v.id, v)
    return m
  }, [veiculosLista])

  const motoristasSemVeiculo = useMemo(() => {
    const comVinculo = new Set(vinculos.map(v => v.motorista_id))
    return motoristasLista.filter(m => !comVinculo.has(m.id))
  }, [motoristasLista, vinculos])

  const veiculosSemMotorista = useMemo(() => {
    const comVinculo = new Set(vinculos.map(v => v.veiculo_id))
    return veiculosLista.filter(v => !comVinculo.has(v.id))
  }, [veiculosLista, vinculos])

  const topVeiculosOS = useMemo(() => {
    const cont = new Map()
    for (const m of manutAbertas) cont.set(m.veiculo_id, (cont.get(m.veiculo_id) || 0) + 1)
    return Array.from(cont.entries())
      .map(([vid, n]) => ({ veiculo: veiculosPorId.get(vid), qtd: n }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 5)
  }, [manutAbertas, veiculosPorId])

  const veic = data?.veiculos || {}
  const mnt = data?.manutencoes || {}
  const comb = data?.combustivel || {}
  const pn = data?.pneus || {}

  const totalHE = hePendentes.reduce((s, h) => s + Number(h.qtd_horas || 0), 0)
  const totalAbast = abastPendentes.reduce((s, a) => s + (Number(a.litros || 0) * Number(a.valor_litro || 0)), 0)
  const totalDiarias = diariasPendentes.reduce((s, d) => s + Number(d.valor_total || 0), 0)
  const docsVencidos = docsVencer.filter(d => d.dias < 0).length
  const docsProx30 = docsVencer.filter(d => d.dias >= 0 && d.dias <= 30).length

  const totalVeic = veic.total ?? veiculosLista.length
  const ativos = veic.ativos ?? 0
  const emManut = veic.em_manutencao ?? 0

  // Dados para gráficos
  const statusOSMot = useMemo(() => {
    const map = { rascunho: 0, aberta: 0, em_andamento: 0, finalizada: 0, cancelada: 0 }
    for (const o of osMotoristaAtivas) map[o.status] = (map[o.status] || 0) + 1
    return [
      { label: 'Abertas', value: map.aberta || 0, color: C.warning },
      { label: 'Em andamento', value: map.em_andamento || 0, color: C.primary },
    ].filter(s => s.value > 0)
  }, [osMotoristaAtivas])

  const distAprovacoes = [
    { label: 'HE', value: hePendentes.length, color: C.warning },
    { label: 'Combustível', value: abastPendentes.length, color: C.orange },
    { label: 'Diárias', value: diariasPendentes.length, color: C.purple },
  ]
  const totalAprovacoes = distAprovacoes.reduce((s, x) => s + x.value, 0)

  return (
    <section className="page-shell">
      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 14, marginBottom: 18,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: 0.8, textTransform: 'uppercase' }}>
            Frota
          </div>
          <h1 style={{ margin: '2px 0 4px', fontSize: 26, fontWeight: 800, color: '#1a2332' }}>
            Dashboard de Frota
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
            Acompanhamento geral: frota, operação, custos, documentos e vínculos.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={selectedFilial}
            onChange={e => setSelectedFilial(e.target.value)}
            style={{ padding: '8px 12px', fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff', minWidth: 160 }}
          >
            {filiais.length !== 1 && <option value="">Todas as filiais</option>}
            {filiais.map(f => (<option key={f.id} value={f.id}>{f.cidade}</option>))}
          </select>
          <input
            type="month" value={mes} onChange={e => setMes(e.target.value)}
            style={{ padding: '8px 12px', fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff' }}
          />
          <button
            onClick={load} type="button"
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: `1px solid ${C.primary}`, cursor: 'pointer', background: C.primary, color: '#fff' }}
          >🔄 Atualizar</button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#ffebed', border: '1px solid #ffc1c7', color: C.danger, padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <Panel><div style={{ padding: 40, textAlign: 'center', color: C.muted }}>⏳ Carregando dados…</div></Panel>
      ) : (
        <>
          {/* ── KPIs principais ── */}
          <KPIRow>
            <KPI icon="🚛" label="Total veículos" value={totalVeic} color={C.primary} sub={`${ativos} ativos`} />
            <KPI icon="🛣️" label="Viagens ativas" value={osMotoristaAtivas.length} color={C.success} sub="OS em curso" />
            <KPI icon="🔧" label="OS manutenção" value={mnt.os_abertas ?? 0} color={emManut > 0 ? C.warning : C.success} sub={formatBRL(mnt.custo_mes)} />
            <KPI icon="⛽" label="Combustível" value={formatBRL(comb.gasto_mes)} color={C.orange} sub={`${comb.litros_mes?.toFixed?.(0) || 0} L · ${comb.abastecimentos_count || 0} abast.`} />
            <KPI icon="📋" label="Aprovações" value={totalAprovacoes} color={C.danger} sub={`${hePendentes.length} HE · ${abastPendentes.length} comb · ${diariasPendentes.length} diárias`} />
            <KPI icon="📄" label="Docs a vencer" value={docsVencer.length} color={docsVencidos > 0 ? C.danger : C.muted} sub={`${docsVencidos} vencidos · ${docsProx30} em 30d`} />
          </KPIRow>

          {/* ── Gráficos linha 1 ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 14, marginTop: 18,
          }}>
            <Panel eyebrow="Frota" title="Disponibilidade" color={C.primary}>
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                <Donut value={ativos} total={totalVeic} color={C.success} label="Ativos" />
                <Donut value={emManut} total={totalVeic} color={C.warning} label="Em manut." />
              </div>
            </Panel>

            <Panel eyebrow="Operação" title="OS de motorista" color={C.success}>
              {statusOSMot.length > 0
                ? <PieMulti segments={statusOSMot} />
                : <div style={{ padding: 24, textAlign: 'center', color: C.muted, fontSize: 13 }}>Sem viagens ativas</div>}
            </Panel>

            <Panel eyebrow="Aprovações" title="Pendências" color={C.danger}>
              {totalAprovacoes > 0
                ? <PieMulti segments={distAprovacoes.filter(d => d.value > 0)} />
                : <div style={{ padding: 24, textAlign: 'center', color: C.success, fontSize: 13 }}>✓ Tudo em dia</div>}
            </Panel>
          </div>

          {/* ── Manutenção + Combustível detalhe ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginTop: 14,
          }}>
            <Panel eyebrow="Manutenção" title={`OS — ${mes}`} color={C.warning}>
              <KPIRow>
                <KPI label="OS abertas" value={mnt.os_abertas ?? 0} color={mnt.os_abertas > 0 ? C.warning : C.success} />
                <KPI label="Aguardando" value={mnt.os_aguardando_aprovacao ?? 0} color={mnt.os_aguardando_aprovacao > 0 ? C.danger : C.muted} />
                <KPI label="Total mês" value={mnt.total_os_mes ?? 0} color={C.muted} />
              </KPIRow>
            </Panel>

            <Panel eyebrow="Combustível" title={`Abastecimentos — ${mes}`} color={C.orange}>
              <KPIRow>
                <KPI label="Litros" value={comb.litros_mes != null ? `${Number(comb.litros_mes).toFixed(1)} L` : '—'} color={C.orange} />
                <KPI label="Médio/L" value={formatPrecoLitro(comb.media_preco_litro)} color={C.muted} />
                <KPI label="Abast." value={comb.abastecimentos_count ?? 0} color={C.muted} />
              </KPIRow>
            </Panel>

            <Panel eyebrow="Pneus" title="Estado" color={C.info}>
              <KPIRow>
                <KPI label="Montados" value={pn.total_montados ?? 0} color={C.info} />
                <KPI label="Trocar" value={pn.para_trocar ?? 0} color={pn.para_trocar > 0 ? C.danger : C.success} />
                <KPI label="Rodiziar" value={pn.para_rodiziar ?? 0} color={pn.para_rodiziar > 0 ? C.warning : C.muted} />
              </KPIRow>
            </Panel>

            <Panel eyebrow="Operação" title="Vínculos" color={C.purple}>
              <KPIRow>
                <KPI label="Motorista s/ veículo" value={motoristasSemVeiculo.length} color={motoristasSemVeiculo.length > 0 ? C.warning : C.success} />
                <KPI label="Veículo s/ motorista" value={veiculosSemMotorista.length} color={veiculosSemMotorista.length > 0 ? C.warning : C.success} />
              </KPIRow>
            </Panel>
          </div>

          {/* ── Bar chart: top veículos ── */}
          {topVeiculosOS.length > 0 && (
            <Panel eyebrow="Análise" title="Veículos com mais OS abertas" color={C.muted}>
              <BarChart
                color={C.warning}
                data={topVeiculosOS.map(t => ({
                  label: t.veiculo?.placa || '—',
                  value: t.qtd,
                }))}
              />
            </Panel>
          )}

          {/* ── Viagens ativas ── */}
          {osMotoristaAtivas.length > 0 && (
            <Panel eyebrow="Operação" title="Viagens em andamento / abertas" color={C.success}>
              <MiniTable
                headers={['N° OS', 'Veículo', 'Origem → Destino', 'Status', 'Prev. início']}
                rows={osMotoristaAtivas.map(os => {
                  const v = veiculosPorId.get(os.veiculo_id)
                  return [
                    <strong key="n">{os.numero_solicitacao || os.id}</strong>,
                    v ? <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{v.placa}</span> : '—',
                    <span key="r">{os.origem} → <strong>{os.destino}</strong></span>,
                    <Chip key="s" status={os.status} />,
                    os.data_prevista_inicio ? new Date(os.data_prevista_inicio).toLocaleDateString('pt-BR') : '—',
                  ]
                })}
              />
              <LinkBtn to="/ordens-servico" color={C.success}>Ver todas as OS →</LinkBtn>
            </Panel>
          )}

          {/* ── Docs vencendo ── */}
          {docsVencer.length > 0 && (
            <Panel eyebrow="Documentação" title="Documentos a vencer / vencidos" color={C.purple}>
              <MiniTable
                headers={['Veículo', 'Documento', 'Validade', 'Situação']}
                rows={docsVencer.map(d => {
                  const v = veiculosPorId.get(d.veiculo_id)
                  const tone = d.dias < 0
                    ? { color: '#fff', bg: C.danger, label: `Vencido ${Math.abs(d.dias)}d` }
                    : d.dias <= 30
                      ? { color: '#fff', bg: C.warning, label: `Em ${d.dias}d` }
                      : { color: C.muted, bg: C.bg, label: `${d.dias}d` }
                  return [
                    v ? <span style={{ fontFamily: 'monospace' }}>{v.placa}</span> : `#${d.veiculo_id}`,
                    d.tipo_documento,
                    d.data_validade ? new Date(d.data_validade).toLocaleDateString('pt-BR') : '—',
                    <Chip key="c" custom={tone} />,
                  ]
                })}
              />
              <LinkBtn to="/veiculos-documentos" color={C.purple}>Ver documentos →</LinkBtn>
            </Panel>
          )}

          {/* ── Manutenção pendente ── */}
          {manutAbertas.length > 0 && (
            <Panel eyebrow="Manutenção" title="OS pendentes" color={C.warning}>
              <MiniTable
                headers={['Prioridade', 'Veículo', 'Tipo', 'Título', 'Status', 'Abertura', 'Estimado']}
                rows={manutAbertas.map(os => {
                  const v = veiculosPorId.get(os.veiculo_id)
                  return [
                    <PrioChip key="p" p={os.prioridade} />,
                    v ? <span style={{ fontFamily: 'monospace' }}>{v.placa}</span> : os.veiculo_id,
                    os.tipo,
                    os.titulo,
                    <Chip key="s" status={os.status} />,
                    os.data_abertura ? new Date(os.data_abertura).toLocaleDateString('pt-BR') : '—',
                    os.valor_estimado ? formatBRL(os.valor_estimado) : '—',
                  ]
                })}
              />
              <LinkBtn to="/manutencoes" color={C.warning}>Ver todas as OS →</LinkBtn>
            </Panel>
          )}

          {/* ── Pneus alerta ── */}
          {pneusAlerta.length > 0 && (
            <Panel eyebrow="Pneus" title="Pneus que precisam de atenção" color={C.info}>
              <MiniTable
                headers={['Veículo', 'Posição', 'Marca', 'Medida', 'Status', 'Vida']}
                rows={pneusAlerta.map(p => {
                  const v = veiculosPorId.get(p.veiculo_id)
                  const cfg = p.status === 'trocar'
                    ? { color: '#fff', bg: C.danger, label: 'Trocar' }
                    : { color: '#fff', bg: C.warning, label: 'Rodiziar' }
                  return [
                    v ? <span style={{ fontFamily: 'monospace' }}>{v.placa}</span> : p.veiculo_id,
                    p.posicao, p.marca || '—', p.medida || '—',
                    <Chip key="c" custom={cfg} />,
                    p.vida ?? '—',
                  ]
                })}
              />
              <LinkBtn to="/pneus" color={C.info}>Ver pneus →</LinkBtn>
            </Panel>
          )}

          {/* ── Gaps vínculo ── */}
          {(motoristasSemVeiculo.length > 0 || veiculosSemMotorista.length > 0) && (
            <Panel eyebrow="Atenção" title="Gaps de vínculo motorista ↔ veículo" color={C.danger}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14,
              }}>
                <GapList
                  title={`Motoristas sem veículo (${motoristasSemVeiculo.length})`}
                  items={motoristasSemVeiculo.slice(0, 8).map(m => m.nome_completo)}
                  extra={motoristasSemVeiculo.length - 8}
                  color={C.danger}
                />
                <GapList
                  title={`Veículos sem motorista (${veiculosSemMotorista.length})`}
                  items={veiculosSemMotorista.slice(0, 8).map(v => `${v.placa} — ${v.marca || ''} ${v.modelo || ''}`.trim())}
                  extra={veiculosSemMotorista.length - 8}
                  color={C.danger}
                />
              </div>
              <LinkBtn to="/veiculos" color={C.danger}>Gerenciar vínculos →</LinkBtn>
            </Panel>
          )}
        </>
      )}
    </section>
  )
}

function GapList({ title, items, extra, color }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {title}
      </div>
      {items.length === 0
        ? <div style={{ fontSize: 12, color: C.success }}>Tudo certo ✓</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {items.map((it, i) => (
              <div key={i} style={{
                fontSize: 12, color: '#24292f', padding: '5px 10px',
                background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4,
              }}>{it}</div>
            ))}
            {extra > 0 && (
              <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginTop: 4 }}>
                + {extra} outros
              </div>
            )}
          </div>
        )}
    </div>
  )
}

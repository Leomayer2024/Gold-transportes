import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import StatCard from './StatCard'

const MES_ATUAL = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})()

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0))
}

function PrioridadeBadge({ prioridade }) {
  const map = {
    critica: { label: 'Crítica', tone: 'danger' },
    alta: { label: 'Alta', tone: 'warning' },
    normal: { label: 'Normal', tone: 'neutral' },
    baixa: { label: 'Baixa', tone: 'success' },
  }
  const { label, tone } = map[prioridade] || { label: prioridade, tone: 'neutral' }
  return <span className={`status-chip tone-${tone}`}>{label}</span>
}

function StatusBadge({ status }) {
  const map = {
    aberta: 'neutral',
    aguardando_aprovacao: 'warning',
    aprovada: 'success',
    em_execucao: 'info',
    concluida: 'success',
    cancelada: 'danger',
    reprovada: 'danger',
  }
  const labels = {
    aberta: 'Aberta',
    aguardando_aprovacao: 'Ag. aprovação',
    aprovada: 'Aprovada',
    em_execucao: 'Em execução',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
    reprovada: 'Reprovada',
  }
  return <span className={`status-chip tone-${map[status] || 'neutral'}`}>{labels[status] || status}</span>
}

export default function FrotaDashboardPage() {
  const { profile } = useAuth()
  const [filiais, setFiliais] = useState([])
  const [selectedFilial, setSelectedFilial] = useState('')
  const [mes, setMes] = useState(MES_ATUAL)
  const [data, setData] = useState(null)
  const [manutAbertas, setManutAbertas] = useState([])
  const [pneusAlerta, setPneusAlerta] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.list('filiais').then(r => setFiliais(Array.isArray(r) ? r : r.data || [])).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (selectedFilial) params.filial_id = selectedFilial
      if (mes) params.mes = mes

      const [dash, manut, pneus] = await Promise.all([
        api.getDashboardFrota(params),
        api.list('manutencoes', { ...params.filial_id ? { filial_id: params.filial_id } : {}, ativo: 'true', page: 1 }),
        api.list('veiculos_pneus', { ...params.filial_id ? { filial_id: params.filial_id } : {}, ativo: 'true', page: 1 }),
      ])

      setData(dash)

      const manutRows = Array.isArray(manut) ? manut : (manut.data || [])
      setManutAbertas(
        manutRows
          .filter(m => !['concluida', 'cancelada'].includes(m.status))
          .sort((a, b) => {
            const ord = { critica: 0, alta: 1, normal: 2, baixa: 3 }
            return (ord[a.prioridade] ?? 9) - (ord[b.prioridade] ?? 9)
          })
          .slice(0, 10)
      )

      const pneusRows = Array.isArray(pneus) ? pneus : (pneus.data || [])
      setPneusAlerta(pneusRows.filter(p => ['trocar', 'rodiziar'].includes(p.status)).slice(0, 8))
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados da frota.')
    } finally {
      setLoading(false)
    }
  }, [selectedFilial, mes])

  useEffect(() => { void load() }, [load])

  const veic = data?.veiculos || {}
  const mnt = data?.manutencoes || {}
  const comb = data?.combustivel || {}
  const pn = data?.pneus || {}

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Frota</span>
          <h1>Dashboard de Frota</h1>
          <p>Visão consolidada de veículos, manutenções, combustível e pneus.</p>
        </div>
        <div className="header-actions">
          <select
            className="filter-select"
            value={selectedFilial}
            onChange={e => setSelectedFilial(e.target.value)}
          >
            <option value="">Todas as filiais</option>
            {filiais.map(f => (
              <option key={f.id} value={f.id}>{f.cidade}</option>
            ))}
          </select>
          <input
            className="filter-select"
            type="month"
            value={mes}
            onChange={e => setMes(e.target.value)}
          />
          <button className="button-secondary" onClick={load} type="button">Atualizar</button>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : (
        <>
          {/* ── Veículos ── */}
          <div className="section-title" style={{ marginBottom: '0.75rem' }}>
            <span className="eyebrow">Frota</span>
            <h2>Veículos</h2>
          </div>
          <div className="stats-row">
            <StatCard label="Total de veículos" value={veic.total ?? '—'} />
            <StatCard label="Ativos" value={veic.ativos ?? '—'} tone="success" />
            <StatCard label="Em manutenção" value={veic.em_manutencao ?? '—'} tone={veic.em_manutencao > 0 ? 'warning' : 'neutral'} />
            <StatCard
              label="Disponibilidade"
              value={veic.disponibilidade_pct != null ? `${veic.disponibilidade_pct}%` : '—'}
              tone={veic.disponibilidade_pct >= 90 ? 'success' : veic.disponibilidade_pct >= 70 ? 'warning' : 'danger'}
            />
          </div>

          {/* ── Manutenções ── */}
          <div className="section-title" style={{ marginTop: '2rem', marginBottom: '0.75rem' }}>
            <span className="eyebrow">Manutenção</span>
            <h2>Ordens de Serviço — {mes}</h2>
          </div>
          <div className="stats-row">
            <StatCard label="OS abertas" value={mnt.os_abertas ?? '—'} tone={mnt.os_abertas > 0 ? 'warning' : 'success'} />
            <StatCard label="Aguardando aprovação" value={mnt.os_aguardando_aprovacao ?? '—'} tone={mnt.os_aguardando_aprovacao > 0 ? 'danger' : 'neutral'} />
            <StatCard label="Total OS no mês" value={mnt.total_os_mes ?? '—'} />
            <StatCard label="Custo manutenção" value={formatBRL(mnt.custo_mes)} tone="neutral" />
          </div>

          {/* ── Combustível ── */}
          <div className="section-title" style={{ marginTop: '2rem', marginBottom: '0.75rem' }}>
            <span className="eyebrow">Combustível</span>
            <h2>Abastecimentos — {mes}</h2>
          </div>
          <div className="stats-row">
            <StatCard label="Litros abastecidos" value={comb.litros_mes != null ? `${Number(comb.litros_mes).toFixed(1)} L` : '—'} />
            <StatCard label="Gasto total" value={formatBRL(comb.gasto_mes)} tone="neutral" />
            <StatCard label="Preço médio/litro" value={comb.media_preco_litro ? `R$ ${Number(comb.media_preco_litro).toFixed(3)}` : '—'} />
            <StatCard label="Abastecimentos" value={comb.abastecimentos_count ?? '—'} />
          </div>

          {/* ── Pneus ── */}
          <div className="section-title" style={{ marginTop: '2rem', marginBottom: '0.75rem' }}>
            <span className="eyebrow">Pneus</span>
            <h2>Estado dos pneus</h2>
          </div>
          <div className="stats-row">
            <StatCard label="Pneus montados" value={pn.total_montados ?? '—'} />
            <StatCard label="Para trocar" value={pn.para_trocar ?? '—'} tone={pn.para_trocar > 0 ? 'danger' : 'success'} />
            <StatCard label="Para rodiziar" value={pn.para_rodiziar ?? '—'} tone={pn.para_rodiziar > 0 ? 'warning' : 'neutral'} />
          </div>

          {/* ── OS abertas ── */}
          {manutAbertas.length > 0 && (
            <div className="surface-card" style={{ marginTop: '2rem' }}>
              <div className="section-title">
                <span className="eyebrow">Atenção</span>
                <h2>OS pendentes</h2>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Prioridade</th>
                    <th>Veículo</th>
                    <th>Tipo</th>
                    <th>Título</th>
                    <th>Status</th>
                    <th>Abertura</th>
                    <th>Estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {manutAbertas.map(os => (
                    <tr key={os.id}>
                      <td><PrioridadeBadge prioridade={os.prioridade} /></td>
                      <td>{os.veiculo_id}</td>
                      <td>{os.tipo}</td>
                      <td>{os.titulo}</td>
                      <td><StatusBadge status={os.status} /></td>
                      <td>{os.data_abertura}</td>
                      <td>{os.valor_estimado ? formatBRL(os.valor_estimado) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="button-row" style={{ marginTop: '0.75rem' }}>
                <Link className="button-secondary" to="/manutencoes">Ver todas as OS</Link>
              </div>
            </div>
          )}

          {/* ── Pneus com alerta ── */}
          {pneusAlerta.length > 0 && (
            <div className="surface-card" style={{ marginTop: '2rem' }}>
              <div className="section-title">
                <span className="eyebrow">Pneus</span>
                <h2>Pneus que precisam de atenção</h2>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Veículo</th>
                    <th>Posição</th>
                    <th>Marca</th>
                    <th>Medida</th>
                    <th>Status</th>
                    <th>Vida</th>
                  </tr>
                </thead>
                <tbody>
                  {pneusAlerta.map(p => (
                    <tr key={p.id}>
                      <td>{p.veiculo_id}</td>
                      <td>{p.posicao}</td>
                      <td>{p.marca || '—'}</td>
                      <td>{p.medida || '—'}</td>
                      <td><span className={`status-chip tone-${p.status === 'trocar' ? 'danger' : 'warning'}`}>{p.status}</span></td>
                      <td>{p.vida ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="button-row" style={{ marginTop: '0.75rem' }}>
                <Link className="button-secondary" to="/pneus">Ver todos os pneus</Link>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

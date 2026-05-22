import { useEffect, useMemo, useState, useCallback } from 'react'
import { api } from '../services/api'

// ─── Tela de teste — versão simplificada de Contratos Operacionais ───────────
//
// Objetivo: mesma funcionalidade da tela atual, porém sem o "tipo caminhão"
// (veiculo_carregamento) e com a parte de vínculos quebrada em abas claras
// por tipo de item.
//
// NÃO substitui ContratosOperacionaisPage. Reusa os mesmos endpoints e
// tabelas — apenas reorganiza a UI.
//
// Ligações preservadas (não saem):
//   /api/contratos_operacionais          (lista + cadastro principal)
//   /api/contratos_colaboradores         (vínculos: pessoas/veículos/pacotes/outros)
//   /api/contratos_gastos_extras         (gastos extras do contrato)
//   /api/custos-rh                       (métricas: headcount, custo, margem, RTM)
//   /api/filiais, /api/colaboradores, /api/veiculos, /api/clientes
//
// Telas que dependem dos mesmos dados (não tocadas):
//   - CustosRhPage, HorasExtrasRTMPage, HorasExtrasHistoricoPage,
//     HorasExtrasMetricasPage, BonificacaoPage, DashboardPage.

const TIPO_TABS = [
  { key: 'pessoas',  label: 'Pessoas',           tipos: ['colaborador', 'colaborador_fora_contrato'] },
  { key: 'veiculos', label: 'Veículos próprios', tipos: ['veiculo_proprio'] },
  { key: 'pacotes',  label: 'Pacotes',           tipos: ['pacote_motorista_veiculo'] },
  { key: 'outros',   label: 'Outros itens',      tipos: ['outro'] },
]

// ─── Helpers de formatação ──────────────────────────────────────────────────
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}
function formatPercent(value) {
  if (value === null || value === undefined) return '-'
  return `${Number(value).toFixed(1)}%`
}
function marginTone(value) { return Number(value || 0) < 0 ? 'danger' : 'success' }
function accuracyTone(value) {
  if (value === null || value === undefined) return 'neutral'
  const v = Number(value)
  if (v >= 95) return 'success'
  if (v >= 85) return 'warning'
  return 'danger'
}
function headcountTone(real, contratado) {
  if (!contratado) return 'neutral'
  const ratio = real / contratado
  if (ratio >= 0.95 && ratio <= 1.05) return 'success'
  if (ratio >= 0.85) return 'warning'
  return 'danger'
}
function monthInputValue(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

// ─── Página ─────────────────────────────────────────────────────────────────
export default function TesteContratoPage() {
  // Dados base
  const [filiais, setFiliais] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [veiculos, setVeiculos] = useState([])
  const [clientes, setClientes] = useState([])
  const [contratos, setContratos] = useState([])
  const [loadingBase, setLoadingBase] = useState(true)
  const [erroBase, setErroBase] = useState('')

  // Seleção + UI
  const [filtroFilial, setFiltroFilial] = useState('')
  const [busca, setBusca] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [activeTab, setActiveTab] = useState('resumo')
  const [mesRef, setMesRef] = useState(() => monthInputValue())
  const [showModalContrato, setShowModalContrato] = useState(false)
  const [contratoEditando, setContratoEditando] = useState(null)

  // Itens vinculados + gastos
  const [vinculos, setVinculos] = useState([])
  const [gastos, setGastos] = useState([])
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)
  const [contractMetrics, setContractMetrics] = useState(null)
  const [metricsError, setMetricsError] = useState('')

  // ─── Carga inicial ────────────────────────────────────────────────────────
  const carregarBase = useCallback(async () => {
    setLoadingBase(true)
    setErroBase('')
    try {
      const [fil, col, vei, cli, con] = await Promise.all([
        api.list('filiais', { limit: 500 }),
        api.list('colaboradores', { limit: 5000 }),
        api.list('veiculos', { limit: 2000 }),
        api.list('clientes', { limit: 2000 }).catch(() => ({ data: [] })),
        api.list('contratos_operacionais', { limit: 2000 }),
      ])
      setFiliais(fil?.data || fil || [])
      setColaboradores(col?.data || col || [])
      setVeiculos(vei?.data || vei || [])
      setClientes(cli?.data || cli || [])
      setContratos(con?.data || con || [])
    } catch (e) {
      setErroBase(e.message || 'Falha ao carregar dados.')
    } finally {
      setLoadingBase(false)
    }
  }, [])

  useEffect(() => { void carregarBase() }, [carregarBase])

  // ─── Carga do detalhe ao selecionar contrato ──────────────────────────────
  const carregarDetalhe = useCallback(async (contratoId) => {
    if (!contratoId) {
      setVinculos([]); setGastos([]); setContractMetrics(null); return
    }
    setLoadingDetalhe(true)
    setMetricsError('')
    try {
      const [vRes, gRes] = await Promise.all([
        api.list('contratos_colaboradores', { contrato_operacional_id: contratoId, limit: 1000 }),
        api.list('contratos_gastos_extras',  { contrato_operacional_id: contratoId, limit: 1000 }),
      ])
      setVinculos(vRes?.data || vRes || [])
      setGastos(gRes?.data || gRes || [])
    } catch (e) {
      setMetricsError(e.message || 'Falha ao carregar itens do contrato.')
    } finally {
      setLoadingDetalhe(false)
    }
  }, [])

  const carregarMetricas = useCallback(async (contrato, mes) => {
    if (!contrato?.id) { setContractMetrics(null); return }
    try {
      const dash = await api.getCostsRhDashboard({
        mes,
        ...(contrato.filial_id ? { filial_id: contrato.filial_id } : {}),
      })
      const found = (dash.contracts || []).find((c) => Number(c.id) === Number(contrato.id))
      setContractMetrics(found || null)
      setMetricsError('')
    } catch (e) {
      setMetricsError(e.message || 'Falha ao carregar métricas.')
      setContractMetrics(null)
    }
  }, [])

  const selectedContract = useMemo(
    () => contratos.find((c) => Number(c.id) === Number(selectedId)) || null,
    [contratos, selectedId],
  )

  useEffect(() => { void carregarDetalhe(selectedId) }, [selectedId, carregarDetalhe])
  useEffect(() => { void carregarMetricas(selectedContract, mesRef) }, [selectedContract, mesRef, carregarMetricas])

  // ─── Listas computadas ────────────────────────────────────────────────────
  const filiaisAtivas = useMemo(() => filiais.filter((f) => f.ativo !== false), [filiais])
  const colaboradoresFil = useMemo(() => {
    if (!selectedContract?.filial_id) return colaboradores.filter((c) => c.ativo !== false)
    return colaboradores.filter((c) => (c.ativo !== false) && Number(c.filial_id) === Number(selectedContract.filial_id))
  }, [colaboradores, selectedContract])
  const veiculosFil = useMemo(() => {
    if (!selectedContract?.filial_id) return veiculos.filter((v) => v.ativo !== false)
    return veiculos.filter((v) => (v.ativo !== false) && Number(v.filial_id) === Number(selectedContract.filial_id))
  }, [veiculos, selectedContract])

  const contratosFiltrados = useMemo(() => {
    let arr = contratos
    if (filtroFilial) arr = arr.filter((c) => Number(c.filial_id) === Number(filtroFilial))
    if (busca.trim()) {
      const q = busca.trim().toLowerCase()
      arr = arr.filter((c) => (
        String(c.codigo_contrato || '').toLowerCase().includes(q) ||
        String(c.nome_contrato || '').toLowerCase().includes(q) ||
        String(c.cliente_nome || '').toLowerCase().includes(q)
      ))
    }
    return arr.sort((a, b) => String(a.codigo_contrato || '').localeCompare(String(b.codigo_contrato || '')))
  }, [contratos, filtroFilial, busca])

  // Vínculos por aba (esconde tipo caminhao — legado)
  const vinculosPorAba = useMemo(() => {
    const out = { pessoas: [], veiculos: [], pacotes: [], outros: [], legados: [] }
    for (const v of vinculos) {
      const t = v.tipo_item
      if (t === 'caminhao') { out.legados.push(v); continue }
      const tab = TIPO_TABS.find((x) => x.tipos.includes(t))
      if (tab) out[tab.key].push(v)
      else out.outros.push(v)
    }
    return out
  }, [vinculos])

  // ─── Mutações ────────────────────────────────────────────────────────────
  async function salvarContrato(payload, editandoId) {
    if (editandoId) {
      const r = await api.update('contratos_operacionais', editandoId, payload)
      const updated = r?.data || r
      setContratos((arr) => arr.map((c) => Number(c.id) === Number(editandoId) ? { ...c, ...updated } : c))
    } else {
      const r = await api.create('contratos_operacionais', payload)
      const novo = r?.data || r
      if (novo?.id) {
        setContratos((arr) => [...arr, novo])
        setSelectedId(novo.id)
      }
    }
  }

  async function recalcularValorContrato() {
    if (!selectedContract?.id) return
    try {
      const dash = await api.getCostsRhDashboard({
        mes: mesRef,
        ...(selectedContract.filial_id ? { filial_id: selectedContract.filial_id } : {}),
      })
      const found = (dash.contracts || []).find((c) => Number(c.id) === Number(selectedContract.id))
      const novoValor = found?.valor_mensal_contrato_itens ?? 0
      const atual = parseFloat(selectedContract.valor_mensal_contrato || 0)
      if (Number(novoValor) !== Number(atual)) {
        try {
          await api.update('contratos_operacionais', selectedContract.id, { valor_mensal_contrato: novoValor })
          setContratos((arr) => arr.map((c) => Number(c.id) === Number(selectedContract.id) ? { ...c, valor_mensal_contrato: novoValor } : c))
        } catch (e) { console.error('Falha ao atualizar valor do contrato', e) }
      }
      setContractMetrics(found || null)
    } catch (e) {
      console.error('Falha ao recarregar métricas', e)
    }
  }

  async function salvarVinculo(payload, editandoId) {
    if (editandoId) {
      const r = await api.update('contratos_colaboradores', editandoId, payload)
      const upd = r?.data || r
      setVinculos((arr) => arr.map((v) => Number(v.id) === Number(editandoId) ? { ...v, ...upd } : v))
    } else {
      const r = await api.create('contratos_colaboradores', payload)
      const novo = r?.data || r
      if (novo?.id) setVinculos((arr) => [...arr, novo])
    }
    await recalcularValorContrato()
  }

  async function excluirVinculo(id) {
    if (!window.confirm('Remover este item do contrato?')) return
    await api.remove('contratos_colaboradores', id)
    setVinculos((arr) => arr.filter((v) => Number(v.id) !== Number(id)))
    await recalcularValorContrato()
  }

  async function salvarGasto(payload, editandoId) {
    if (editandoId) {
      const r = await api.update('contratos_gastos_extras', editandoId, payload)
      const upd = r?.data || r
      setGastos((arr) => arr.map((g) => Number(g.id) === Number(editandoId) ? { ...g, ...upd } : g))
    } else {
      const r = await api.create('contratos_gastos_extras', payload)
      const novo = r?.data || r
      if (novo?.id) setGastos((arr) => [...arr, novo])
    }
    await recalcularValorContrato()
  }

  async function excluirGasto(id) {
    if (!window.confirm('Remover este gasto?')) return
    await api.remove('contratos_gastos_extras', id)
    setGastos((arr) => arr.filter((g) => Number(g.id) !== Number(id)))
    await recalcularValorContrato()
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  if (loadingBase) {
    return (
      <section className="page-shell">
        <div className="surface-card empty-state"><strong>Carregando…</strong></div>
      </section>
    )
  }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Tela de teste</span>
          <h1>Teste Contrato</h1>
          <p>Versão simplificada de "Contratos operacionais". Sem tipo "caminhão terceiro" (legado), com vínculos separados em abas por tipo. Tudo numa tela só, sem perder funcionalidade.</p>
        </div>
        <button className="button-primary" type="button" onClick={() => { setContratoEditando(null); setShowModalContrato(true) }}>
          + Novo contrato
        </button>
      </div>

      {erroBase && <div className="alert-danger">{erroBase}</div>}

      {/* Filtros + lista de contratos */}
      <div className="surface-card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
          <label className="field" style={{ minWidth: 180 }}>
            <span>Filial</span>
            <select value={filtroFilial} onChange={(e) => setFiltroFilial(e.target.value)}>
              <option value="">Todas</option>
              {filiaisAtivas.map((f) => (
                <option key={f.id} value={f.id}>{f.cidade || f.nome || `Filial ${f.id}`}</option>
              ))}
            </select>
          </label>
          <label className="field" style={{ flex: 1, minWidth: 220 }}>
            <span>Buscar</span>
            <input type="text" placeholder="Código, nome ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
          <span style={{ color: 'var(--muted)', fontSize: 11 }}>
            {contratosFiltrados.length} contrato(s)
          </span>
        </div>

        <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid var(--border-light, #e0e4ea)', borderRadius: 6 }}>
          <table style={{ width: '100%', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f5f7fa' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Código</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Contrato</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Cliente</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Filial</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Valor ref.</th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>Ativo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contratosFiltrados.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 16, textAlign: 'center', color: 'var(--muted)' }}>Nenhum contrato.</td></tr>
              )}
              {contratosFiltrados.map((c) => {
                const isSel = Number(c.id) === Number(selectedId)
                const filial = filiais.find((f) => Number(f.id) === Number(c.filial_id))
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    style={{ cursor: 'pointer', background: isSel ? '#fff7d6' : 'transparent', borderTop: '1px solid var(--border-light, #e0e4ea)' }}
                  >
                    <td style={{ padding: '6px 8px' }}>{c.codigo_contrato || '—'}</td>
                    <td style={{ padding: '6px 8px' }}><strong>{c.nome_contrato || '—'}</strong></td>
                    <td style={{ padding: '6px 8px' }}>{c.cliente_nome || '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{filial?.cidade || filial?.nome || '—'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatCurrency(c.valor_mensal_contrato)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{c.ativo === false ? '—' : '✓'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                      <button type="button" className="button-link" onClick={(e) => { e.stopPropagation(); setContratoEditando(c); setShowModalContrato(true) }}>
                        ✏
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalhe do contrato selecionado */}
      {selectedContract && (
        <div className="surface-card" style={{ padding: 12 }}>
          {/* Cabeçalho contrato */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            <div>
              <span className="eyebrow">Contrato</span>
              <h2 style={{ margin: '2px 0' }}>
                {selectedContract.codigo_contrato ? `${selectedContract.codigo_contrato} — ` : ''}
                {selectedContract.nome_contrato}
              </h2>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12 }}>
                {selectedContract.cliente_nome && `Cliente: ${selectedContract.cliente_nome} · `}
                {selectedContract.cargos_contrato && `Cargos: ${selectedContract.cargos_contrato}`}
              </p>
            </div>
            <label className="field" style={{ minWidth: 160 }}>
              <span>Mês de referência</span>
              <input type="month" value={mesRef} onChange={(e) => setMesRef(e.target.value)} />
            </label>
          </div>

          {/* Abas do detalhe */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {['resumo', 'variavel', ...TIPO_TABS.map((t) => t.key), 'gastos'].map((k) => {
              const labels = {
                resumo: 'Resumo (Fixo)',
                variavel: 'Variável (RTM)',
                pessoas: 'Pessoas',
                veiculos: 'Veículos próprios',
                pacotes: 'Pacotes',
                outros: 'Outros itens',
                gastos: 'Gastos extras',
              }
              const counts = {
                pessoas: vinculosPorAba.pessoas.length,
                veiculos: vinculosPorAba.veiculos.length,
                pacotes: vinculosPorAba.pacotes.length,
                outros: vinculosPorAba.outros.length,
                gastos: gastos.length,
              }
              const isActive = activeTab === k
              return (
                <button
                  key={k}
                  type="button"
                  className={`button-secondary${isActive ? ' active' : ''}`}
                  onClick={() => setActiveTab(k)}
                  style={{ fontSize: 12 }}
                >
                  {labels[k]}{counts[k] !== undefined && ` (${counts[k]})`}
                </button>
              )
            })}
          </div>

          {metricsError && <div className="alert-danger" style={{ marginBottom: 8 }}>{metricsError}</div>}
          {loadingDetalhe && <div className="empty-state">Carregando itens…</div>}

          {/* Aviso de itens legados (caminhao) */}
          {vinculosPorAba.legados.length > 0 && (
            <div style={{ background: '#fef8e6', border: '1px solid #e0c76a', borderRadius: 6, padding: 10, marginBottom: 10, fontSize: 12 }}>
              ⚠️ Este contrato tem <strong>{vinculosPorAba.legados.length}</strong> item(ns) do tipo "caminhão terceiro" (legado).
              Eles continuam no banco e nas métricas, mas não aparecem mais nas abas. Migrar para "veículo próprio" ou "outro item" na tela de Contratos operacionais antiga, se quiser que apareçam aqui.
            </div>
          )}

          {activeTab === 'resumo' && (
            <ResumoTab metrics={contractMetrics} contrato={selectedContract} vinculosPorAba={vinculosPorAba} gastos={gastos} />
          )}

          {activeTab === 'variavel' && (
            <VariavelTab metrics={contractMetrics} mesRef={mesRef} onTrocarMes={setMesRef} colaboradores={colaboradores} />
          )}

          {TIPO_TABS.map((tab) => activeTab === tab.key && (
            <VinculosTab
              key={tab.key}
              tab={tab}
              itens={vinculosPorAba[tab.key]}
              contrato={selectedContract}
              colaboradores={colaboradores}
              colaboradoresAtivos={colaboradoresFil}
              veiculos={veiculosFil}
              onSalvar={salvarVinculo}
              onExcluir={excluirVinculo}
            />
          ))}

          {activeTab === 'gastos' && (
            <GastosTab
              gastos={gastos}
              contrato={selectedContract}
              colaboradores={colaboradores}
              colaboradoresAtivos={colaboradoresFil}
              metrics={contractMetrics}
              onSalvar={salvarGasto}
              onExcluir={excluirGasto}
            />
          )}
        </div>
      )}

      {/* Modal de contrato (criar/editar) */}
      {showModalContrato && (
        <ContratoModal
          contrato={contratoEditando}
          filiais={filiaisAtivas}
          clientes={clientes}
          onClose={() => { setShowModalContrato(false); setContratoEditando(null) }}
          onSalvar={async (payload, id) => {
            await salvarContrato(payload, id)
            setShowModalContrato(false); setContratoEditando(null)
          }}
        />
      )}
    </section>
  )
}

// ─── Aba Resumo ─────────────────────────────────────────────────────────────
function ResumoTab({ metrics, contrato, vinculosPorAba, gastos }) {
  if (!metrics) {
    return (
      <div className="empty-state">
        Sem dados consolidados para este contrato no mês selecionado.<br />
        <small>Adicione itens nas abas Pessoas / Veículos / Pacotes / Outros / Gastos.</small>
      </div>
    )
  }

  // Contagens por categoria (vinculosPorAba é o agrupamento já feito na página).
  // Considera apenas itens ativos pra contagem operacional.
  const ativos = (lista) => (lista || []).filter((x) => x.ativo !== false)
  const qtdPessoas  = ativos(vinculosPorAba?.pessoas).length
  const qtdVeiculos = ativos(vinculosPorAba?.veiculos).length
  const qtdPacotes  = ativos(vinculosPorAba?.pacotes).length
  const qtdOutros   = ativos(vinculosPorAba?.outros).length
  const qtdGastos   = ativos(gastos).length

  // Total de pessoas inclui motorista do pacote. Total de veículos idem pra veículo do pacote.
  const totalPessoas  = qtdPessoas + qtdPacotes
  const totalVeiculos = qtdVeiculos + qtdPacotes

  return (
    <>
      {/* Linha 1: contagens por categoria ─────────────────────────────────── */}
      <div className="contract-metrics-section-title">Itens do contrato</div>
      <div className="contract-metrics-grid" style={{ marginBottom: 12 }}>
        <article className={`tone-${headcountTone(totalPessoas, metrics.qtd_colaboradores_contratados)}`}>
          <span>Colaboradores</span>
          <strong>{totalPessoas}</strong>
          <small>
            {qtdPessoas} fixo(s){qtdPacotes > 0 ? ` + ${qtdPacotes} pacote(s)` : ''} · Contratado: {metrics.qtd_colaboradores_contratados || 0}
          </small>
        </article>
        <article>
          <span>Veículos</span>
          <strong>{totalVeiculos}</strong>
          <small>
            {qtdVeiculos} próprio(s){qtdPacotes > 0 ? ` + ${qtdPacotes} em pacote(s)` : ''}
          </small>
        </article>
        <article>
          <span>Outros itens</span>
          <strong>{qtdOutros}</strong>
          <small>Equipamentos / custos fixos avulsos</small>
        </article>
        <article>
          <span>Gastos extras</span>
          <strong>{qtdGastos}</strong>
          <small>Despesas variáveis registradas</small>
        </article>
      </div>

      {/* Linha 2: efetivo real (calculado pelo backend) ───────────────────── */}
      <div className="contract-metrics-section-title">Efetivo no mês</div>
      <div className="contract-metrics-grid" style={{ marginBottom: 12 }}>
        <article className={`tone-${headcountTone(metrics.headcount_real, metrics.qtd_colaboradores_contratados)}`}>
          <span>Efetivo real (mês)</span>
          <strong>{metrics.headcount_real || 0}</strong>
          <small>Vínculos ativos no mês · Contratado: {metrics.qtd_colaboradores_contratados || 0}</small>
        </article>
        <article>
          <span>Valor cobrado (soma dos itens)</span>
          <strong>{formatCurrency(metrics.valor_mensal_contrato_itens)}</strong>
          <small>Ref. cadastro: {formatCurrency(metrics.valor_mensal_contrato_cadastro)}</small>
        </article>
        <article className={`tone-${accuracyTone(metrics.acuracidade_headcount)}`}>
          <span>Acurácia efetivo</span>
          <strong>{formatPercent(metrics.acuracidade_headcount)}</strong>
          <small>{metrics.itens_vinculados_total || 0} item(s) vinculado(s)</small>
        </article>
      </div>

      <div className="contract-metrics-section-title">Composição do custo</div>
      <div className="contract-metrics-grid" style={{ marginBottom: 12 }}>
        <article><span>Salários (CLT + adicionais)</span><strong>{formatCurrency(metrics.gasto_salario_mensal)}</strong></article>
        <article>
          <span>Benefícios</span>
          <strong>{formatCurrency(metrics.gasto_beneficios_sem_bonificacao_mensal)}</strong>
          {metrics.gasto_bonificacao_mensal > 0 && <small>+ Bônus: {formatCurrency(metrics.gasto_bonificacao_mensal)}</small>}
        </article>
        <article>
          <span>Custo equipe</span>
          <strong>{formatCurrency(metrics.custo_mensal_vinculos_contrato)}</strong>
          <small>Colaboradores alocados</small>
        </article>
        {metrics.custos_extras_gold_fixo_mensais > 0 && (
          <article>
            <span>Custos fixos Gold</span>
            <strong>{formatCurrency(metrics.custos_extras_gold_fixo_mensais)}</strong>
          </article>
        )}
      </div>

      <div className="contract-metrics-section-title">Resultado</div>
      <div className="contract-metrics-grid contract-metrics-result" style={{ marginBottom: 12 }}>
        <article>
          <span>Custo total Gold</span>
          <strong>{formatCurrency(metrics.custo_total_gold_real)}</strong>
          <small>Equipe + gastos extras</small>
        </article>
        <article className={`tone-${marginTone(metrics.margem_contrato)}`}>
          <span>Margem</span>
          <strong>{formatCurrency(metrics.margem_contrato)}</strong>
          <small>{formatPercent(metrics.margem_percentual)} sobre o valor cobrado</small>
        </article>
        <article className={`tone-${accuracyTone(metrics.acuracidade_valor)}`}>
          <span>Acurácia valor</span>
          <strong>{formatPercent(metrics.acuracidade_valor)}</strong>
        </article>
        <article>
          <span>Valor por colaborador</span>
          <strong>{formatCurrency(metrics.valor_por_colaborador_real)}</strong>
          <small>Ref. cadastro: {formatCurrency(metrics.valor_por_colaborador)}</small>
        </article>
      </div>

      <div className="contract-metrics-equation">
        <span className="eq-item"><small>Valor cobrado</small><strong>{formatCurrency(metrics.valor_mensal_contrato_itens)}</strong></span>
        <span className="eq-op">−</span>
        <span className="eq-item"><small>Custo equipe</small><strong>{formatCurrency(metrics.custo_mensal_vinculos_contrato)}</strong></span>
        <span className="eq-op">−</span>
        <span className="eq-item"><small>Gastos extras</small><strong>{formatCurrency(metrics.custos_extras_gold_mensais)}</strong></span>
        <span className="eq-op">=</span>
        <span className={`eq-item eq-result tone-${marginTone(metrics.margem_contrato)}`}>
          <small>Margem</small><strong>{formatCurrency(metrics.margem_contrato)}</strong>
        </span>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 12 }}>
        Horas extras (RTM) e gastos variáveis ficam na aba <strong>Variável (RTM)</strong>.
      </p>
    </>
  )
}

// ─── Aba Variável (por colaborador — Calc. Hora Extra) ──────────────────────
//
// Variável é POR COLABORADOR. Lista todos os colaboradores vinculados ao
// contrato (fixos + extras) com o valor variável do mês (hora extra/RTM),
// mesmo que seja zero. Cada colab tem sua linha — quem tem zero fica
// visível mas com valor R$ 0,00 (não some).
function VariavelTab({ metrics, mesRef, onTrocarMes, colaboradores }) {
  const [mostrarInativos, setMostrarInativos] = useState(false)

  if (!metrics) {
    return (
      <div className="empty-state">
        Sem dados consolidados para este contrato no mês selecionado.<br />
        <small>O valor variável de cada colaborador é puxado automaticamente da tela "Cálculo de Horas Extras" quando há registros no mês.</small>
      </div>
    )
  }

  const todosColabs = (metrics.colaboradores_detalhe || [])
  const mesesDisponiveis = metrics.rtm_meses_disponiveis || []
  const totalRtmGeral = Number(metrics.rtm_valor_total_geral || 0)

  // Colaboradores com hora extra MAS SEM vínculo em contratos_colaboradores.
  // O backend retorna is_fora_contrato=true quando o colab fez RTM no contrato
  // mas não tem linha em contratos_colaboradores apontando pra ele.
  const semVinculoComRtm = todosColabs.filter((c) => c.is_fora_contrato && Number(c.rtm_total_geral || 0) > 0)
  const valorSemVinculo = semVinculoComRtm.reduce((acc, c) => acc + Number(c.rtm_total_geral || 0), 0)

  // Função: colab está inativo? (vínculo off OU pessoa desligada)
  function ehInativo(c) {
    if (c.vinculo_ativo === false) return true
    const row = colaboradores.find((x) => Number(x.id) === Number(c.colaborador_id))
    if (row && row.ativo === false) return true
    if (c.ativo === false) return true
    return false
  }

  const colabsAtivos = todosColabs.filter((c) => !ehInativo(c))
  const colabsInativosComRtm = todosColabs.filter((c) => ehInativo(c) && Number(c.rtm_total_geral || 0) > 0)
  const colabsInativosSemRtm = todosColabs.filter((c) => ehInativo(c) && Number(c.rtm_total_geral || 0) === 0)

  const linhas = mostrarInativos
    ? [...colabsAtivos, ...colabsInativosComRtm, ...colabsInativosSemRtm]
    : [...colabsAtivos, ...colabsInativosComRtm]  // inativos com RTM sempre aparecem (RTM conta no mês)

  const totalAtivos = colabsAtivos.reduce((acc, c) => acc + Number(c.rtm_total_geral || 0), 0)

  return (
    <>
      <div className="contract-metrics-section-title">Variável por colaborador (Calc. Hora Extra)</div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: -4, marginBottom: 8 }}>
        Cada colaborador vinculado a este contrato tem uma parte variável (hora extra/RTM) calculada no mês.
        Fonte: tela "Cálculo de Horas Extras". Colaborador sem horas extras no mês aparece com R$ 0,00.
        <br />
        Gastos extras do contrato ficam na aba <strong>Gastos extras</strong>.
      </p>

      {totalRtmGeral === 0 && mesesDisponiveis.length > 0 && (
        <div style={{ background: '#fef8e6', borderLeft: '3px solid #e0c76a', padding: '8px 12px', marginBottom: 8, fontSize: 12 }}>
          Sem dados de hora extra para <strong>{mesRef}</strong>. Disponível em:{' '}
          {mesesDisponiveis.map((m, idx) => (
            <button
              key={m}
              type="button"
              className="button-link"
              onClick={() => onTrocarMes(m)}
              style={{ padding: '0 4px', fontWeight: 700 }}
            >
              {m}{idx < mesesDisponiveis.length - 1 ? ',' : ''}
            </button>
          ))}
        </div>
      )}

      {semVinculoComRtm.length > 0 && (
        <div style={{ background: '#fce8e8', borderLeft: '3px solid #d04040', padding: '8px 12px', marginBottom: 8, fontSize: 12 }}>
          ⚠️ <strong>{semVinculoComRtm.length} colaborador(es) com hora extra mas SEM vínculo neste contrato</strong> ({formatCurrency(valorSemVinculo)}).
          O Cálculo de Hora Extra marcou estes funcionários como "FORA CONTRATO" porque não há linha em <code>contratos_colaboradores</code> apontando pra eles.
          <br />
          <strong>Ação:</strong> abra a aba <strong>Pessoas</strong> e adicione cada um deles como colaborador do contrato pra que o valor pare de cair em "fora contrato".
          <details style={{ marginTop: 6 }}>
            <summary style={{ cursor: 'pointer', fontSize: 11 }}>Ver lista</summary>
            <ul style={{ margin: '4px 0 0 18px', fontSize: 11 }}>
              {semVinculoComRtm.map((c) => (
                <li key={c.colaborador_id || c.nome}>{c.nome || 'Sem nome'} — {formatCurrency(c.rtm_total_geral)}</li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {colabsInativosSemRtm.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={mostrarInativos}
              onChange={(e) => setMostrarInativos(e.target.checked)}
            />
            Mostrar {colabsInativosSemRtm.length} inativo(s) sem hora extra
          </label>
        </div>
      )}

      {linhas.length === 0 ? (
        <p className="contract-gastos-empty">Nenhum colaborador vinculado a este contrato.</p>
      ) : (
        <div className="contract-gastos-extras-card" style={{ marginBottom: 12 }}>
          <table className="contract-gastos-table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Tipo</th>
                <th style={{ textAlign: 'right' }}>Hora extra (R$)</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((c) => {
                const vinculoOff = c.vinculo_ativo === false
                const colabRow = colaboradores.find((x) => Number(x.id) === Number(c.colaborador_id))
                const colabDesligado = colabRow && colabRow.ativo === false
                const inativo = vinculoOff || colabDesligado
                const valor = Number(c.rtm_total_geral || 0)
                return (
                  <tr key={c.colaborador_id} style={inativo ? { opacity: 0.55, background: '#f5f5f5', color: '#666' } : undefined}>
                    <td>
                      {c.nome || '—'}
                      {vinculoOff && (
                        <span className="badge badge-danger" style={{ marginLeft: 6, fontSize: 9 }} title="Vínculo desativado no contrato — hora extra contabilizada porque ocorreu no mês">
                          Vínculo off
                        </span>
                      )}
                      {colabDesligado && (
                        <span className="badge badge-danger" style={{ marginLeft: 6, fontSize: 9 }}>Desligado</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${c.is_fora_contrato ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: 9 }}>
                        {c.is_fora_contrato ? 'Extra' : 'Fixo'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(valor)}</td>
                  </tr>
                )
              })}
              <tr className="contract-gastos-table-footer">
                <td colSpan={2}><strong>Total ativos</strong></td>
                <td style={{ textAlign: 'right' }}>
                  <strong>{formatCurrency(totalAtivos)}</strong>
                </td>
              </tr>
              {colabsInativosComRtm.length > 0 && (
                <tr className="contract-gastos-table-footer" style={{ opacity: 0.7 }}>
                  <td colSpan={2}>Total geral (inclui {colabsInativosComRtm.length} inativo com hora extra)</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalRtmGeral)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ─── Aba genérica de vínculos (Pessoas / Veículos / Pacotes / Outros) ──────
function VinculosTab({ tab, itens, contrato, colaboradores, colaboradoresAtivos, veiculos, onSalvar, onExcluir }) {
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [mostrarInativos, setMostrarInativos] = useState(false)

  function abrirNovo() { setEditando(null); setShowForm(true) }
  function abrirEditar(item) { setEditando(item); setShowForm(true) }

  // Determina se um item está "inativo" — vínculo desativado OU colaborador desligado
  function ehInativo(it) {
    if (it.ativo === false) return true
    if (it.colaborador_id) {
      const c = colaboradores.find((x) => Number(x.id) === Number(it.colaborador_id))
      if (c && c.ativo === false) return true
    }
    return false
  }

  const itensVisiveis = mostrarInativos ? itens : itens.filter((it) => !ehInativo(it))
  const qtdInativos = itens.length - itens.filter((it) => !ehInativo(it)).length

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13 }}>{tab.label} alocados</strong>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {qtdInativos > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)' }}>
              <input
                type="checkbox"
                checked={mostrarInativos}
                onChange={(e) => setMostrarInativos(e.target.checked)}
              />
              Mostrar {qtdInativos} inativo(s)
            </label>
          )}
          <button type="button" className="button-primary" onClick={abrirNovo} style={{ fontSize: 12 }}>+ Adicionar</button>
        </div>
      </div>

      {itensVisiveis.length === 0 && !showForm && (
        <div className="empty-state">
          {itens.length === 0 ? 'Nenhum item nesta aba.' : 'Apenas itens inativos — marque o checkbox acima pra ver.'}
        </div>
      )}

      {itensVisiveis.length > 0 && (
        <table className="contract-gastos-table" style={{ marginBottom: 12 }}>
          <thead>
            <tr>
              <th>{tab.key === 'pacotes' ? 'Motorista + Veículo' : tab.key === 'veiculos' ? 'Veículo' : tab.key === 'outros' ? 'Descrição' : 'Colaborador'}</th>
              {(tab.key === 'pessoas') && <th>Tipo</th>}
              <th style={{ textAlign: 'right' }}>Aloc. %</th>
              <th style={{ textAlign: 'right' }}>Valor cobrado</th>
              <th>Vigência</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {itensVisiveis.map((it) => {
              const colab = colaboradores.find((c) => Number(c.id) === Number(it.colaborador_id))
              const veic  = veiculos.find((v) => Number(v.id) === Number(it.veiculo_proprio_id))
              const inativo = ehInativo(it)
              const colabDesligado = colab && colab.ativo === false
              const vinculoOff = it.ativo === false

              const descricao =
                tab.key === 'pacotes' ? `${colab?.nome_completo || '?'} + ${veic?.placa || '?'}` :
                tab.key === 'veiculos' ? (veic?.placa || '—') :
                tab.key === 'outros'   ? (it.nome_item || '—') :
                                         (colab?.nome_completo || '—')

              return (
                <tr key={it.id} style={inativo ? { opacity: 0.55, background: '#f5f5f5', color: '#666' } : undefined}>
                  <td>
                    {descricao}
                    {colabDesligado && <span className="badge badge-danger" style={{ marginLeft: 6, fontSize: 9 }}>Colab desligado</span>}
                  </td>
                  {tab.key === 'pessoas' && (
                    <td>
                      {it.tipo_item === 'colaborador_fora_contrato'
                        ? <span className="badge badge-warning" title="Tipo legado — virou Gasto extra. Migrar quando puder.">Extra (legado)</span>
                        : <span className="badge badge-success">Fixo</span>}
                    </td>
                  )}
                  <td style={{ textAlign: 'right' }}>{it.percentual_alocacao ?? 100}%</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(it.valor_cobrado_colaborador)}</td>
                  <td style={{ fontSize: 11 }}>
                    {it.inicio_vigencia || '—'} <br /> {it.fim_vigencia || 'sem fim'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {vinculoOff
                      ? <span className="badge badge-danger" style={{ fontSize: 9 }}>Vínculo off</span>
                      : <span className="badge badge-success" style={{ fontSize: 9 }}>Ativo</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="button-link" onClick={() => abrirEditar(it)} title="Editar">✏</button>
                    <button type="button" className="button-link" onClick={() => onExcluir(it.id)} title="Remover" style={{ marginLeft: 6 }}>🗑</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {showForm && (
        <VinculoForm
          tab={tab}
          editando={editando}
          contrato={contrato}
          colaboradores={colaboradoresAtivos}
          veiculos={veiculos}
          onCancel={() => { setShowForm(false); setEditando(null) }}
          onSubmit={async (payload) => {
            await onSalvar(payload, editando?.id)
            setShowForm(false); setEditando(null)
          }}
        />
      )}
    </>
  )
}

// ─── Form de vínculo (campos só do tipo da aba) ─────────────────────────────
function VinculoForm({ tab, editando, contrato, colaboradores, veiculos, onCancel, onSubmit }) {
  // Pessoas: sempre tipo_item='colaborador' (Extra foi removido — virou Gasto extra)
  // Mantém o tipo original se está editando registro legado com 'colaborador_fora_contrato'.
  const tipoInicial = editando?.tipo_item || tab.tipos[0]
  const [form, setForm] = useState({
    tipo_item: tipoInicial,
    colaborador_id: editando?.colaborador_id || '',
    veiculo_proprio_id: editando?.veiculo_proprio_id || '',
    nome_item: editando?.nome_item || '',
    percentual_alocacao: editando?.percentual_alocacao ?? 100,
    valor_cobrado_colaborador: editando?.valor_cobrado_colaborador ?? 0,
    horas_50_cobradas: editando?.horas_50_cobradas ?? 0,
    horas_100_cobradas: editando?.horas_100_cobradas ?? 0,
    inicio_vigencia: editando?.inicio_vigencia || '',
    fim_vigencia: editando?.fim_vigencia || '',
    ativo: editando?.ativo !== false,
    observacoes: editando?.observacoes || '',
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  function update(p) { setForm((f) => ({ ...f, ...p })) }

  async function submit(e) {
    e.preventDefault()
    // Validação por tipo
    if (tab.key === 'pessoas' && !form.colaborador_id) { setErro('Selecione um colaborador.'); return }
    if (tab.key === 'veiculos' && !form.veiculo_proprio_id) { setErro('Selecione um veículo.'); return }
    if (tab.key === 'pacotes' && (!form.colaborador_id || !form.veiculo_proprio_id)) { setErro('Selecione motorista E veículo.'); return }
    if (tab.key === 'outros' && !form.nome_item.trim()) { setErro('Informe a descrição do item.'); return }

    setSaving(true); setErro('')
    try {
      // Pessoas: registro novo sempre 'colaborador'. Edição preserva o tipo original.
      const tipoFinal = (tab.key === 'pessoas' && !editando) ? 'colaborador' : form.tipo_item
      const payload = {
        filial_id: contrato.filial_id,
        contrato_operacional_id: contrato.id,
        tipo_item: tipoFinal,
        percentual_alocacao: Number(form.percentual_alocacao) || 0,
        valor_cobrado_colaborador: Number(form.valor_cobrado_colaborador) || 0,
        inicio_vigencia: form.inicio_vigencia || null,
        fim_vigencia: form.fim_vigencia || null,
        ativo: form.ativo !== false,
        observacoes: form.observacoes || null,
      }
      // Campos por tipo
      if (tab.key === 'pessoas') {
        payload.colaborador_id = Number(form.colaborador_id)
        payload.horas_50_cobradas = Number(form.horas_50_cobradas) || 0
        payload.horas_100_cobradas = Number(form.horas_100_cobradas) || 0
      } else if (tab.key === 'veiculos') {
        payload.veiculo_proprio_id = Number(form.veiculo_proprio_id)
      } else if (tab.key === 'pacotes') {
        payload.colaborador_id = Number(form.colaborador_id)
        payload.veiculo_proprio_id = Number(form.veiculo_proprio_id)
        payload.horas_50_cobradas = Number(form.horas_50_cobradas) || 0
        payload.horas_100_cobradas = Number(form.horas_100_cobradas) || 0
      } else if (tab.key === 'outros') {
        payload.nome_item = form.nome_item
      }
      await onSubmit(payload)
    } catch (e2) {
      setErro(e2.message || 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="surface-card" style={{ padding: 12, background: '#fafbfc' }}>
      <strong style={{ display: 'block', marginBottom: 8 }}>
        {editando ? 'Editar item' : `Adicionar ${tab.label.toLowerCase()}`}
      </strong>

      <div className="rh-doc-form-grid">
        {tab.key === 'pessoas' && (
          <>
            <label className="rh-doc-form-full">
              <span>Colaborador *</span>
              <select value={form.colaborador_id} onChange={(e) => update({ colaborador_id: e.target.value, tipo_item: 'colaborador' })} required>
                <option value="">Selecione</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome_completo}</option>
                ))}
              </select>
              <small style={{ color: 'var(--muted)', fontSize: 10 }}>
                Despesas avulsas (RTM extra, combustível, etc.) vão na aba <strong>Gastos extras</strong>, não aqui.
              </small>
            </label>
          </>
        )}

        {tab.key === 'veiculos' && (
          <label>
            <span>Veículo próprio *</span>
            <select value={form.veiculo_proprio_id} onChange={(e) => update({ veiculo_proprio_id: e.target.value })} required>
              <option value="">Selecione</option>
              {veiculos.map((v) => (
                <option key={v.id} value={v.id}>{v.placa} {v.modelo ? `· ${v.modelo}` : ''}</option>
              ))}
            </select>
          </label>
        )}

        {tab.key === 'pacotes' && (
          <>
            <label>
              <span>Motorista *</span>
              <select value={form.colaborador_id} onChange={(e) => update({ colaborador_id: e.target.value })} required>
                <option value="">Selecione</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome_completo}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Veículo próprio *</span>
              <select value={form.veiculo_proprio_id} onChange={(e) => update({ veiculo_proprio_id: e.target.value })} required>
                <option value="">Selecione</option>
                {veiculos.map((v) => (
                  <option key={v.id} value={v.id}>{v.placa} {v.modelo ? `· ${v.modelo}` : ''}</option>
                ))}
              </select>
            </label>
          </>
        )}

        {tab.key === 'outros' && (
          <label className="rh-doc-form-full">
            <span>Descrição *</span>
            <input type="text" placeholder="Ex.: equipamento, custo fixo, retroescavadeira"
              value={form.nome_item} onChange={(e) => update({ nome_item: e.target.value })} required />
          </label>
        )}

        <label>
          <span>Alocação no contrato (%)</span>
          <input type="number" min="0" max="100" value={form.percentual_alocacao}
            onChange={(e) => update({ percentual_alocacao: e.target.value })} />
        </label>

        <label>
          <span>Valor cobrado ao cliente (R$)</span>
          <input type="number" step="0.01" min="0" value={form.valor_cobrado_colaborador}
            onChange={(e) => update({ valor_cobrado_colaborador: e.target.value })} />
        </label>

        {(tab.key === 'pessoas' || tab.key === 'pacotes') && (
          <>
            <label>
              <span>HE 50% inclusas</span>
              <input type="number" min="0" value={form.horas_50_cobradas}
                onChange={(e) => update({ horas_50_cobradas: e.target.value })} />
            </label>
            <label>
              <span>HE 100% inclusas</span>
              <input type="number" min="0" value={form.horas_100_cobradas}
                onChange={(e) => update({ horas_100_cobradas: e.target.value })} />
            </label>
          </>
        )}

        <label>
          <span>Início vigência</span>
          <input type="date" value={form.inicio_vigencia || ''}
            onChange={(e) => update({ inicio_vigencia: e.target.value })} />
        </label>
        <label>
          <span>Fim vigência</span>
          <input type="date" value={form.fim_vigencia || ''}
            onChange={(e) => update({ fim_vigencia: e.target.value })} />
        </label>
      </div>

      <label className="rh-doc-form-full" style={{ marginTop: 8 }}>
        <span>Observações</span>
        <textarea rows={2} value={form.observacoes}
          onChange={(e) => update({ observacoes: e.target.value })} />
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <input type="checkbox" checked={form.ativo !== false}
          onChange={(e) => update({ ativo: e.target.checked })} />
        <span>Item ativo</span>
      </label>

      {erro && <div className="alert-danger" style={{ marginTop: 8 }}>{erro}</div>}

      <footer className="modal-footer" style={{ marginTop: 10 }}>
        <button type="button" className="button-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="button-primary" disabled={saving}>
          {saving ? 'Salvando…' : (editando ? 'Salvar alterações' : 'Adicionar')}
        </button>
      </footer>
    </form>
  )
}

// ─── Aba Gastos extras ──────────────────────────────────────────────────────
function GastosTab({ gastos, contrato, colaboradores, colaboradoresAtivos, metrics, onSalvar, onExcluir }) {
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [mostrarInativos, setMostrarInativos] = useState(false)

  // Backend retorna valor_mensal_calculado em metrics.gastos_extras_linhas
  // quando o gasto tem colaborador vinculado e valor_mensal=0 (= "calcular do colab").
  // Indexa por id pra cruzar com a lista bruta.
  const calcMap = useMemo(() => {
    const m = new Map()
    for (const lin of (metrics?.gastos_extras_linhas || [])) {
      if (lin.id != null) m.set(Number(lin.id), lin)
    }
    return m
  }, [metrics])

  // Decide qual valor mostrar: explícito (>0) tem prioridade; senão usa calculado.
  function resolverValor(g) {
    const v = Number(g.valor_mensal || 0)
    if (v > 0) return { valor: v, origem: 'manual' }
    if (g.colaborador_id) {
      const lin = calcMap.get(Number(g.id))
      const calc = Number(lin?.valor_mensal_calculado || 0)
      if (calc > 0) return { valor: calc, origem: 'calculado' }
    }
    return { valor: 0, origem: 'manual' }
  }

  function abrirNovo() { setEditando(null); setShowForm(true) }
  function abrirEditar(g) { setEditando(g); setShowForm(true) }

  function ehInativo(g) {
    if (g.ativo === false) return true
    if (g.colaborador_id) {
      const c = colaboradores.find((x) => Number(x.id) === Number(g.colaborador_id))
      if (c && c.ativo === false) return true
    }
    return false
  }

  const gastosVisiveis = mostrarInativos ? gastos : gastos.filter((g) => !ehInativo(g))
  const qtdInativos = gastos.length - gastos.filter((g) => !ehInativo(g)).length

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13 }}>Gastos extras do contrato</strong>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {qtdInativos > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)' }}>
              <input
                type="checkbox"
                checked={mostrarInativos}
                onChange={(e) => setMostrarInativos(e.target.checked)}
              />
              Mostrar {qtdInativos} inativo(s)
            </label>
          )}
          <button type="button" className="button-primary" onClick={abrirNovo} style={{ fontSize: 12 }}>+ Adicionar gasto</button>
        </div>
      </div>

      {gastosVisiveis.length === 0 && !showForm && (
        <div className="empty-state">
          {gastos.length === 0 ? 'Nenhum gasto extra registrado.' : 'Apenas gastos inativos — marque o checkbox acima pra ver.'}
        </div>
      )}

      {gastosVisiveis.length > 0 && (
        <table className="contract-gastos-table" style={{ marginBottom: 12 }}>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Colaborador (se vinculado)</th>
              <th style={{ textAlign: 'right' }}>Aloc. %</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
              <th>Vigência</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {gastosVisiveis.map((g) => {
              const colab = colaboradores.find((c) => Number(c.id) === Number(g.colaborador_id))
              const inativo = ehInativo(g)
              const colabDesligado = colab && colab.ativo === false
              const { valor, origem } = resolverValor(g)
              return (
                <tr key={g.id} style={inativo ? { opacity: 0.55, background: '#f5f5f5', color: '#666' } : undefined}>
                  <td>{g.nome_gasto || '—'}</td>
                  <td>
                    {colab?.nome_completo || '—'}
                    {colabDesligado && <span className="badge badge-danger" style={{ marginLeft: 6, fontSize: 9 }}>Desligado</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>{g.percentual_alocacao ?? '—'}{g.percentual_alocacao != null && '%'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {formatCurrency(valor)}
                    {origem === 'calculado' && (
                      <span
                        className="badge badge-warning"
                        style={{ marginLeft: 6, fontSize: 9 }}
                        title="Valor calculado automaticamente pelo custo do colaborador (salário + benefícios proporcional à alocação). Para sobrescrever, edite e informe um valor manual."
                      >
                        calc. colab
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 11 }}>
                    {g.inicio_vigencia || '—'} <br /> {g.fim_vigencia || 'sem fim'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {g.ativo === false
                      ? <span className="badge badge-danger" style={{ fontSize: 9 }}>Off</span>
                      : <span className="badge badge-success" style={{ fontSize: 9 }}>Ativo</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="button-link" onClick={() => abrirEditar(g)} title="Editar">✏</button>
                    <button type="button" className="button-link" onClick={() => onExcluir(g.id)} title="Remover" style={{ marginLeft: 6 }}>🗑</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {showForm && (
        <GastoForm
          editando={editando}
          contrato={contrato}
          colaboradores={colaboradoresAtivos}
          onCancel={() => { setShowForm(false); setEditando(null) }}
          onSubmit={async (payload) => {
            await onSalvar(payload, editando?.id)
            setShowForm(false); setEditando(null)
          }}
        />
      )}
    </>
  )
}

function GastoForm({ editando, contrato, colaboradores, onCancel, onSubmit }) {
  const [form, setForm] = useState({
    nome_gasto: editando?.nome_gasto || '',
    colaborador_id: editando?.colaborador_id || '',
    percentual_alocacao: editando?.percentual_alocacao ?? 100,
    valor_mensal: editando?.valor_mensal ?? 0,
    inicio_vigencia: editando?.inicio_vigencia || '',
    fim_vigencia: editando?.fim_vigencia || '',
    ativo: editando?.ativo !== false,
    observacoes: editando?.observacoes || '',
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  function update(p) { setForm((f) => ({ ...f, ...p })) }

  async function submit(e) {
    e.preventDefault()
    if (!form.nome_gasto.trim()) { setErro('Informe a descrição.'); return }
    setSaving(true); setErro('')
    try {
      const payload = {
        filial_id: contrato.filial_id,
        contrato_operacional_id: contrato.id,
        nome_gasto: form.nome_gasto,
        colaborador_id: form.colaborador_id ? Number(form.colaborador_id) : null,
        percentual_alocacao: form.colaborador_id ? Number(form.percentual_alocacao) || 0 : null,
        valor_mensal: form.valor_mensal === '' || form.valor_mensal == null ? null : Number(form.valor_mensal),
        inicio_vigencia: form.inicio_vigencia || null,
        fim_vigencia: form.fim_vigencia || null,
        ativo: form.ativo !== false,
        observacoes: form.observacoes || null,
      }
      await onSubmit(payload)
    } catch (e2) {
      setErro(e2.message || 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="surface-card" style={{ padding: 12, background: '#fafbfc' }}>
      <strong style={{ display: 'block', marginBottom: 8 }}>
        {editando ? 'Editar gasto' : 'Adicionar gasto extra'}
      </strong>

      <div className="rh-doc-form-grid">
        <label className="rh-doc-form-full">
          <span>Descrição *</span>
          <input type="text" placeholder="Ex.: combustível, pedágio, diária"
            value={form.nome_gasto} onChange={(e) => update({ nome_gasto: e.target.value })} required />
        </label>
        <label>
          <span>Colaborador (opcional)</span>
          <select value={form.colaborador_id} onChange={(e) => update({ colaborador_id: e.target.value })}>
            <option value="">— sem colaborador —</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>{c.nome_completo}</option>
            ))}
          </select>
        </label>
        {form.colaborador_id && (
          <label>
            <span>Alocação (%)</span>
            <input type="number" min="0" max="100" value={form.percentual_alocacao}
              onChange={(e) => update({ percentual_alocacao: e.target.value })} />
          </label>
        )}
        <label>
          <span>Valor (R$)</span>
          <input type="number" step="0.01" min="0" value={form.valor_mensal}
            onChange={(e) => update({ valor_mensal: e.target.value })}
            placeholder={form.colaborador_id ? '0 = calc. automático pelo custo do colab' : '0,00'} />
        </label>
        <label>
          <span>Início vigência</span>
          <input type="date" value={form.inicio_vigencia || ''}
            onChange={(e) => update({ inicio_vigencia: e.target.value })} />
        </label>
        <label>
          <span>Fim vigência</span>
          <input type="date" value={form.fim_vigencia || ''}
            onChange={(e) => update({ fim_vigencia: e.target.value })} />
        </label>
      </div>

      <label className="rh-doc-form-full" style={{ marginTop: 8 }}>
        <span>Observações</span>
        <textarea rows={2} value={form.observacoes}
          onChange={(e) => update({ observacoes: e.target.value })} />
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <input type="checkbox" checked={form.ativo !== false}
          onChange={(e) => update({ ativo: e.target.checked })} />
        <span>Gasto ativo</span>
      </label>

      {erro && <div className="alert-danger" style={{ marginTop: 8 }}>{erro}</div>}

      <footer className="modal-footer" style={{ marginTop: 10 }}>
        <button type="button" className="button-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="button-primary" disabled={saving}>
          {saving ? 'Salvando…' : (editando ? 'Salvar alterações' : 'Adicionar')}
        </button>
      </footer>
    </form>
  )
}

// ─── Modal Contrato (cadastro principal) ────────────────────────────────────
function ContratoModal({ contrato, filiais, clientes, onClose, onSalvar }) {
  const [form, setForm] = useState({
    filial_id: contrato?.filial_id || '',
    codigo_contrato: contrato?.codigo_contrato || '',
    nome_contrato: contrato?.nome_contrato || '',
    tipo_contrato: contrato?.tipo_contrato || 'rtm',
    cliente_nome: contrato?.cliente_nome || '',
    valor_mensal_contrato: contrato?.valor_mensal_contrato ?? 0,
    qtd_colaboradores_contratados: contrato?.qtd_colaboradores_contratados ?? 0,
    cargos_contrato: contrato?.cargos_contrato || '',
    valor_por_colaborador: contrato?.valor_por_colaborador ?? 0,
    custos_extras_gold_mensais: contrato?.custos_extras_gold_mensais ?? 0,
    inicio_vigencia: contrato?.inicio_vigencia || '',
    fim_vigencia: contrato?.fim_vigencia || '',
    observacoes: contrato?.observacoes || '',
    ativo: contrato?.ativo !== false,
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  function update(p) { setForm((f) => ({ ...f, ...p })) }

  async function submit(e) {
    e.preventDefault()
    if (!form.filial_id || !form.codigo_contrato || !form.nome_contrato || !form.tipo_contrato) {
      setErro('Filial, código, nome e tipo são obrigatórios.'); return
    }
    setSaving(true); setErro('')
    try {
      const payload = {
        filial_id: Number(form.filial_id),
        codigo_contrato: form.codigo_contrato,
        nome_contrato: form.nome_contrato,
        tipo_contrato: form.tipo_contrato,
        cliente_nome: form.cliente_nome || null,
        valor_mensal_contrato: Number(form.valor_mensal_contrato) || 0,
        qtd_colaboradores_contratados: Number(form.qtd_colaboradores_contratados) || 0,
        cargos_contrato: form.cargos_contrato || null,
        valor_por_colaborador: form.valor_por_colaborador === '' ? null : Number(form.valor_por_colaborador),
        custos_extras_gold_mensais: Number(form.custos_extras_gold_mensais) || 0,
        inicio_vigencia: form.inicio_vigencia || null,
        fim_vigencia: form.fim_vigencia || null,
        observacoes: form.observacoes || null,
        ativo: form.ativo !== false,
      }
      await onSalvar(payload, contrato?.id)
    } catch (e2) {
      setErro(e2.message || 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-card rh-doc-modal">
        <header className="modal-header">
          <h3>{contrato?.id ? 'Editar contrato' : 'Novo contrato operacional'}</h3>
          <button className="button-link" onClick={onClose} type="button">✕</button>
        </header>

        <form onSubmit={submit} className="rh-doc-form">
          <div className="rh-doc-form-grid">
            <label>
              <span>Filial *</span>
              <select value={form.filial_id} onChange={(e) => update({ filial_id: e.target.value })} required>
                <option value="">Selecione</option>
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>{f.cidade || f.nome || `Filial ${f.id}`}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Código *</span>
              <input type="text" value={form.codigo_contrato} onChange={(e) => update({ codigo_contrato: e.target.value })}
                placeholder="Ex.: CT-UDI-2026-001" required />
            </label>
            <label className="rh-doc-form-full">
              <span>Nome do contrato *</span>
              <input type="text" value={form.nome_contrato} onChange={(e) => update({ nome_contrato: e.target.value })}
                placeholder="Ex.: Contrato operação base Uberlândia" required />
            </label>
            <label>
              <span>Tipo *</span>
              <select value={form.tipo_contrato} onChange={(e) => update({ tipo_contrato: e.target.value })} required>
                <option value="rtm">RTM (Carregamento)</option>
                <option value="veiculos">Veículos</option>
                <option value="misto">Misto (RTM + Veículos)</option>
              </select>
            </label>
            <label>
              <span>Cliente</span>
              <input type="text" list="teste-contrato-clientes" value={form.cliente_nome}
                onChange={(e) => update({ cliente_nome: e.target.value })} placeholder="Nome do cliente" />
              <datalist id="teste-contrato-clientes">
                {clientes.map((c) => <option key={c.id} value={c.nome} />)}
              </datalist>
            </label>
            <label>
              <span>Valor mensal de referência (R$)</span>
              <input type="number" step="0.01" min="0" value={form.valor_mensal_contrato}
                onChange={(e) => update({ valor_mensal_contrato: e.target.value })} />
            </label>
            <label>
              <span>Qtd. colaboradores contratados</span>
              <input type="number" min="0" value={form.qtd_colaboradores_contratados}
                onChange={(e) => update({ qtd_colaboradores_contratados: e.target.value })} />
            </label>
            <label>
              <span>Valor por colaborador (R$)</span>
              <input type="number" step="0.01" min="0" value={form.valor_por_colaborador}
                onChange={(e) => update({ valor_por_colaborador: e.target.value })} />
            </label>
            <label>
              <span>Custos extras Gold (R$/mês)</span>
              <input type="number" step="0.01" min="0" value={form.custos_extras_gold_mensais}
                onChange={(e) => update({ custos_extras_gold_mensais: e.target.value })} />
            </label>
            <label>
              <span>Início vigência</span>
              <input type="date" value={form.inicio_vigencia || ''}
                onChange={(e) => update({ inicio_vigencia: e.target.value })} />
            </label>
            <label>
              <span>Fim vigência</span>
              <input type="date" value={form.fim_vigencia || ''}
                onChange={(e) => update({ fim_vigencia: e.target.value })} />
            </label>
            <label className="rh-doc-form-full">
              <span>Cargos previstos</span>
              <textarea rows={2} value={form.cargos_contrato}
                onChange={(e) => update({ cargos_contrato: e.target.value })}
                placeholder="Ex.: 2 motoristas, 4 ajudantes, 1 líder" />
            </label>
            <label className="rh-doc-form-full">
              <span>Observações</span>
              <textarea rows={2} value={form.observacoes}
                onChange={(e) => update({ observacoes: e.target.value })} />
            </label>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <input type="checkbox" checked={form.ativo !== false}
              onChange={(e) => update({ ativo: e.target.checked })} />
            <span>Contrato ativo</span>
          </label>

          {erro && <div className="alert-danger" style={{ marginTop: 8 }}>{erro}</div>}

          <footer className="modal-footer">
            <button type="button" className="button-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="button-primary" disabled={saving}>
              {saving ? 'Salvando…' : (contrato?.id ? 'Salvar alterações' : 'Criar contrato')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

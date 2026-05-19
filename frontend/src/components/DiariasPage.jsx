import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { canCreateResource, hasActionPermission } from '../lib/permissions'

const STATUS_LABELS = {
  rascunho: 'Rascunho',
  pendente: 'Pendente',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  pago: 'Pago',
  cancelado: 'Cancelado',
}

const STATUS_OPTS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))

function formatBR(iso) {
  if (!iso) return ''
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function brl(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function DiariasPage() {
  const { profile } = useAuth()
  const podeCriar = canCreateResource(profile, 'diarias')
  const podeAprovar = hasActionPermission(profile, 'action.diarias.aprovar')

  const [solicitacoes, setSolicitacoes] = useState([])
  const [itensPorSol, setItensPorSol] = useState({}) // {solId: [itens]}
  const [valoresCidade, setValoresCidade] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [filiais, setFiliais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroFilial, setFiltroFilial] = useState('')
  const [filtroBusca, setFiltroBusca] = useState('')
  const [modalSol, setModalSol] = useState(null) // null | 'nova' | { sol, itens }
  const [expandedId, setExpandedId] = useState(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const [sols, vals, colabs, fils] = await Promise.all([
        api.list('diarias_solicitacoes', { limit: 1000 }),
        api.list('diarias_valores', { limit: 200, ativo: true }),
        api.list('colaboradores', { limit: 1000 }),
        api.list('filiais', { limit: 200 }),
      ])
      const solRows = sols?.data || sols || []
      setSolicitacoes(solRows)
      setValoresCidade(vals?.data || vals || [])
      setColaboradores(colabs?.data || colabs || [])
      setFiliais(fils?.data || fils || [])
      // Carrega itens das solicitações abertas
      const ids = solRows.map((s) => s.id)
      const itensMap = {}
      if (ids.length > 0) {
        const itensRes = await api.list('diarias_itens', { limit: 5000 })
        const itens = itensRes?.data || itensRes || []
        for (const it of itens) {
          if (!itensMap[it.solicitacao_id]) itensMap[it.solicitacao_id] = []
          itensMap[it.solicitacao_id].push(it)
        }
      }
      setItensPorSol(itensMap)
    } catch (e) {
      setErro(e.message || 'Falha ao carregar.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const filtradas = useMemo(() => {
    let list = solicitacoes
    if (filtroStatus) list = list.filter((s) => s.status === filtroStatus)
    if (filtroFilial) list = list.filter((s) => String(s.filial_id) === String(filtroFilial))
    const q = filtroBusca.trim().toLowerCase()
    if (q) {
      list = list.filter((s) => {
        const itens = itensPorSol[s.id] || []
        const blob = [
          s.cidade_destino, s.uf_destino, s.rota, s.numero_solicitacao,
          ...itens.map((it) => `${it.motorista_nome} ${it.placa || ''}`),
        ].filter(Boolean).join(' ').toLowerCase()
        return blob.includes(q)
      })
    }
    return [...list].sort((a, b) => String(b.data_solicitacao || '').localeCompare(String(a.data_solicitacao || '')))
  }, [solicitacoes, itensPorSol, filtroStatus, filtroFilial, filtroBusca])

  const totais = useMemo(() => {
    let pendentes = 0, aprovados = 0, pagos = 0, valorTotal = 0
    for (const s of solicitacoes) {
      if (s.status === 'pendente' || s.status === 'em_analise') pendentes++
      if (s.status === 'aprovado') aprovados++
      if (s.status === 'pago') pagos++
      valorTotal += Number(s.valor_total || 0)
    }
    return { pendentes, aprovados, pagos, valorTotal, total: solicitacoes.length }
  }, [solicitacoes])

  async function aprovar(sol) {
    if (!window.confirm(`Aprovar solicitação #${sol.numero_solicitacao || sol.id}?`)) return
    try {
      await api.update('diarias_solicitacoes', sol.id, {
        status: 'aprovado',
        aprovado_por: profile?.id || null,
        aprovado_em: new Date().toISOString(),
      })
      carregar()
    } catch (e) { setErro(e.message) }
  }
  async function reprovar(sol) {
    const motivo = window.prompt('Motivo da reprovação?')
    if (!motivo) return
    try {
      await api.update('diarias_solicitacoes', sol.id, {
        status: 'reprovado',
        motivo_reprovacao: motivo,
        reprovado_por: profile?.id || null,
        reprovado_em: new Date().toISOString(),
      })
      carregar()
    } catch (e) { setErro(e.message) }
  }
  async function marcarPago(sol) {
    if (!window.confirm('Marcar como pago?')) return
    try {
      await api.update('diarias_solicitacoes', sol.id, { status: 'pago' })
      carregar()
    } catch (e) { setErro(e.message) }
  }

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <span className="eyebrow">Operação</span>
          <h1>Diárias e hotelaria</h1>
          <p>Solicite diárias por viagem. O financeiro recebe, valida e marca como pago.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {podeCriar && (
            <button className="button-primary" onClick={() => setModalSol('nova')} type="button">+ Nova solicitação</button>
          )}
        </div>
      </header>

      {erro && <div className="alert-danger">{erro}</div>}

      <section className="rh-doc-alert-cards">
        <div className="rh-doc-card pendentes"><span>Pendentes</span><strong>{totais.pendentes}</strong><small>Aguardando financeiro</small></div>
        <div className="rh-doc-card vigentes"><span>Aprovados</span><strong>{totais.aprovados}</strong><small>Falta pagamento</small></div>
        <div className="rh-doc-card vencidos"><span>Pagos</span><strong>{totais.pagos}</strong><small>Histórico</small></div>
        <div className="rh-doc-card alerta"><span>Valor total geral</span><strong style={{ fontSize: 18 }}>{brl(totais.valorTotal)}</strong><small>{totais.total} solicitação(ões)</small></div>
      </section>

      <section className="rh-doc-filtros">
        <input type="search" placeholder="Buscar por motorista, placa, rota, cidade..." value={filtroBusca} onChange={(e) => setFiltroBusca(e.target.value)} />
        <select value={filtroFilial} onChange={(e) => setFiltroFilial(e.target.value)}>
          <option value="">Todas as filiais</option>
          {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
        </select>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {STATUS_OPTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </section>

      {carregando ? (
        <div className="muted" style={{ padding: 16 }}>Carregando…</div>
      ) : filtradas.length === 0 ? (
        <div className="muted" style={{ padding: 16 }}>Nenhuma solicitação encontrada.</div>
      ) : (
        <div className="rh-doc-table-wrapper">
          <table className="rh-doc-table">
            <thead>
              <tr>
                <th></th>
                <th>Solicitação</th>
                <th>Filial</th>
                <th>Destino</th>
                <th>Período</th>
                <th>Rota</th>
                <th>Motoristas</th>
                <th>Valor total</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((s) => {
                const itens = itensPorSol[s.id] || []
                const filial = filiais.find((f) => Number(f.id) === Number(s.filial_id))
                const open = expandedId === s.id
                return (
                  <>
                    <tr key={s.id} className={`rh-status-${s.status}`}>
                      <td>
                        <button type="button" className="button-link" onClick={() => setExpandedId(open ? null : s.id)}>
                          {open ? '▼' : '▶'}
                        </button>
                      </td>
                      <td>{s.numero_solicitacao || `#${s.id}`}</td>
                      <td>{filial?.cidade || `Filial ${s.filial_id}`}</td>
                      <td>{s.cidade_destino}{s.uf_destino ? `/${s.uf_destino}` : ''}</td>
                      <td>{formatBR(s.data_inicio)} → {formatBR(s.data_fim)}</td>
                      <td>{s.rota || '—'}</td>
                      <td>{itens.length}</td>
                      <td>{brl(s.valor_total)}</td>
                      <td><span className={`rh-status-badge ${s.status}`}>{STATUS_LABELS[s.status] || s.status}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className="button-link" onClick={() => setModalSol({ sol: s, itens })}>editar</button>
                        {podeAprovar && (s.status === 'pendente' || s.status === 'em_analise') && (
                          <>
                            <button type="button" className="button-link" onClick={() => aprovar(s)}>aprovar</button>
                            <button type="button" className="button-link danger" onClick={() => reprovar(s)}>reprovar</button>
                          </>
                        )}
                        {podeAprovar && s.status === 'aprovado' && (
                          <button type="button" className="button-link" onClick={() => marcarPago(s)}>marcar pago</button>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr><td colSpan={10} style={{ background: 'var(--surface-2, #f7f8fa)', padding: 12 }}>
                        <DetalheSolicitacao sol={s} itens={itens} filiais={filiais} />
                      </td></tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalSol && (
        <DiariasModal
          modo={modalSol === 'nova' ? 'nova' : 'edicao'}
          solicitacao={modalSol === 'nova' ? null : modalSol.sol}
          itensIniciais={modalSol === 'nova' ? [] : modalSol.itens}
          valoresCidade={valoresCidade}
          colaboradores={colaboradores}
          filiais={filiais}
          onClose={() => setModalSol(null)}
          onSaved={() => { setModalSol(null); carregar() }}
        />
      )}
    </section>
  )
}

// ── Detalhe expandido com o texto formatado pra mandar ao financeiro ────────
function DetalheSolicitacao({ sol, itens, filiais }) {
  const filial = filiais.find((f) => Number(f.id) === Number(sol.filial_id))
  const texto = useMemo(() => {
    const cabe = `DIARIAS ${(sol.cidade_destino || '').toUpperCase()}${sol.uf_destino ? '-' + sol.uf_destino.toUpperCase() : ''}\n\n`
    const ref = itens[0]
    const tabela = ref
      ? `Café ${brl(ref.valor_cafe)} / Almoço ${brl(ref.valor_almoco)} / Jantar ${brl(ref.valor_jantar)} / Pernoite ${brl(ref.valor_pernoite)} = Completa ${brl(Number(ref.valor_cafe) + Number(ref.valor_almoco) + Number(ref.valor_jantar) + Number(ref.valor_pernoite))} / Sem pernoite ${brl(Number(ref.valor_cafe) + Number(ref.valor_almoco) + Number(ref.valor_jantar))}\n\n`
      : ''
    const banco = `Banco: ${sol.banco || 'Itau'}\n\n`
    const linhas = itens.map((it) => {
      const semAlmoco = !it.inclui_almoco
      const det = semAlmoco ? `${it.qtd_diarias} diarias(sem almoço) ${it.qtd_pernoites} pernoites` : `${it.qtd_diarias} diarias e ${it.qtd_pernoites} pernoites`
      return `${(it.motorista_nome || '').toUpperCase()} - Mot ${filial?.cidade || ''}/ Placa ${it.placa || '—'}\n${det} ${formatBR(it.data_inicio)} a ${formatBR(it.data_fim)}\n${brl(it.valor_total)}\n`
    }).join('\n')
    return cabe + tabela + banco + 'FUNCIONARIO | REFERENCIA | VALOR\n\n' + linhas + `\nTotal geral: ${brl(sol.valor_total)}`
  }, [sol, itens, filial])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>Texto pronto para o financeiro</strong>
        <button type="button" className="button-secondary" onClick={() => { navigator.clipboard.writeText(texto); alert('Copiado!') }}>📋 Copiar</button>
      </div>
      <pre style={{ background: '#fff', padding: 12, borderRadius: 6, fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', border: '1px solid var(--border, #ddd)' }}>{texto}</pre>
      {sol.observacoes && <p style={{ fontSize: 12, marginTop: 8 }}><strong>Obs:</strong> {sol.observacoes}</p>}
    </div>
  )
}

// ── Modal de criar/editar ───────────────────────────────────────────────────
function DiariasModal({ modo, solicitacao, itensIniciais, valoresCidade, colaboradores, filiais, onClose, onSaved }) {
  const { profile } = useAuth()
  const [sol, setSol] = useState(() => solicitacao || {
    filial_id: profile?.filial_id || (filiais[0]?.id ?? ''),
    tipo: 'diaria',
    cidade_destino: '',
    uf_destino: '',
    data_solicitacao: new Date().toISOString().slice(0, 10),
    data_inicio: '',
    data_fim: '',
    rota: '',
    status: 'pendente',
    banco: 'Itau',
    observacoes: '',
  })
  const [itens, setItens] = useState(() => itensIniciais.length > 0 ? itensIniciais : [novoItem()])
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  function novoItem() {
    return {
      _key: Math.random(),
      motorista_nome: '',
      colaborador_id: null,
      placa: '',
      qtd_diarias: 0,
      qtd_pernoites: 0,
      inclui_cafe: true,
      inclui_almoco: true,
      inclui_jantar: true,
      valor_cafe: 0, valor_almoco: 0, valor_jantar: 0, valor_pernoite: 0,
      valor_total: 0,
      observacoes: '',
    }
  }

  // Aplica valores da cidade quando ela muda
  useEffect(() => {
    if (!sol.cidade_destino) return
    const c = valoresCidade.find((v) => v.cidade?.toUpperCase() === sol.cidade_destino.toUpperCase())
    if (!c) return
    setItens((arr) => arr.map((it) => ({
      ...it,
      valor_cafe: c.cafe, valor_almoco: c.almoco, valor_jantar: c.jantar, valor_pernoite: c.pernoite,
    })))
    if (c.uf && !sol.uf_destino) setSol((s) => ({ ...s, uf_destino: c.uf }))
  }, [sol.cidade_destino, valoresCidade])

  // Auto-calcula qtds e total quando datas/checks mudam
  useEffect(() => {
    setItens((arr) => arr.map((it) => recalcItem(it, sol.data_inicio, sol.data_fim)))
  }, [sol.data_inicio, sol.data_fim])

  function recalcItem(it, ini, fim) {
    const inicio = it.data_inicio || ini
    const fimEf = it.data_fim || fim
    let qtdDiarias = it.qtd_diarias
    let qtdPern = it.qtd_pernoites
    if (inicio && fimEf) {
      const d1 = new Date(`${inicio}T00:00:00`); const d2 = new Date(`${fimEf}T00:00:00`)
      if (!isNaN(d1) && !isNaN(d2)) {
        const dias = Math.max(0, Math.round((d2 - d1) / 86400000) + 1)
        qtdDiarias = dias
        qtdPern = Math.max(0, dias - 1)
      }
    }
    const valorDia = (it.inclui_cafe ? Number(it.valor_cafe || 0) : 0)
      + (it.inclui_almoco ? Number(it.valor_almoco || 0) : 0)
      + (it.inclui_jantar ? Number(it.valor_jantar || 0) : 0)
    const total = valorDia * qtdDiarias + Number(it.valor_pernoite || 0) * qtdPern
    return { ...it, qtd_diarias: qtdDiarias, qtd_pernoites: qtdPern, valor_total: Number(total.toFixed(2)) }
  }

  function updItem(idx, patch) {
    setItens((arr) => arr.map((it, i) => {
      if (i !== idx) return it
      return recalcItem({ ...it, ...patch }, sol.data_inicio, sol.data_fim)
    }))
  }

  function removerItem(idx) {
    setItens((arr) => arr.filter((_, i) => i !== idx))
  }

  function adicionarItem() {
    setItens((arr) => [...arr, recalcItem(novoItem(), sol.data_inicio, sol.data_fim)])
  }

  function escolherColaborador(idx, colabId) {
    const colab = colaboradores.find((c) => Number(c.id) === Number(colabId))
    updItem(idx, { colaborador_id: colab?.id || null, motorista_nome: colab?.nome_completo || '' })
  }

  const valorTotal = useMemo(() => itens.reduce((acc, it) => acc + Number(it.valor_total || 0), 0), [itens])

  async function salvar(event) {
    event.preventDefault()
    if (!sol.cidade_destino || !sol.data_inicio || !sol.data_fim) {
      setErro('Preencha cidade destino e período.')
      return
    }
    if (itens.length === 0 || itens.some((it) => !it.motorista_nome.trim())) {
      setErro('Adicione pelo menos um motorista com nome.')
      return
    }
    setSaving(true); setErro('')
    try {
      const solPayload = {
        filial_id: Number(sol.filial_id),
        tipo: sol.tipo || 'diaria',
        cidade_destino: sol.cidade_destino.toUpperCase(),
        uf_destino: sol.uf_destino?.toUpperCase() || null,
        data_solicitacao: sol.data_solicitacao,
        data_inicio: sol.data_inicio,
        data_fim: sol.data_fim,
        rota: sol.rota || null,
        status: sol.status || 'pendente',
        valor_total: valorTotal,
        banco: sol.banco || 'Itau',
        observacoes: sol.observacoes || null,
        criado_por: profile?.id || null,
      }
      let solId
      if (modo === 'nova') {
        const created = await api.create('diarias_solicitacoes', solPayload)
        solId = created.id
      } else {
        await api.update('diarias_solicitacoes', solicitacao.id, solPayload)
        solId = solicitacao.id
        // Apaga itens antigos e recria (simples — N < 50)
        for (const old of itensIniciais) {
          try { await api.remove('diarias_itens', old.id) } catch {}
        }
      }
      for (const it of itens) {
        const payload = {
          solicitacao_id: solId,
          filial_id: Number(sol.filial_id),
          colaborador_id: it.colaborador_id || null,
          motorista_nome: it.motorista_nome,
          placa: it.placa || null,
          data_inicio: it.data_inicio || sol.data_inicio,
          data_fim: it.data_fim || sol.data_fim,
          qtd_diarias: Number(it.qtd_diarias || 0),
          qtd_pernoites: Number(it.qtd_pernoites || 0),
          inclui_cafe: !!it.inclui_cafe,
          inclui_almoco: !!it.inclui_almoco,
          inclui_jantar: !!it.inclui_jantar,
          valor_cafe: Number(it.valor_cafe || 0),
          valor_almoco: Number(it.valor_almoco || 0),
          valor_jantar: Number(it.valor_jantar || 0),
          valor_pernoite: Number(it.valor_pernoite || 0),
          valor_total: Number(it.valor_total || 0),
          observacoes: it.observacoes || null,
        }
        await api.create('diarias_itens', payload)
      }
      onSaved?.()
    } catch (e) {
      setErro(e.message || 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-card rh-doc-modal-lg">
        <header className="modal-header">
          <h3>{modo === 'nova' ? 'Nova solicitação de diárias' : `Editar solicitação #${solicitacao?.numero_solicitacao || solicitacao?.id}`}</h3>
          <button className="button-link" onClick={onClose} type="button">✕</button>
        </header>
        <form onSubmit={salvar} className="rh-doc-form">
          <div className="rh-doc-form-grid">
            <label>
              <span>Filial *</span>
              <select value={sol.filial_id} onChange={(e) => setSol({ ...sol, filial_id: e.target.value })} required>
                <option value="">Selecione</option>
                {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
              </select>
            </label>
            <label>
              <span>Cidade destino *</span>
              <input
                list="diarias-cidades"
                type="text"
                value={sol.cidade_destino}
                onChange={(e) => setSol({ ...sol, cidade_destino: e.target.value })}
                placeholder="Ex.: LONDRINA"
                required
              />
              <datalist id="diarias-cidades">
                {valoresCidade.map((v) => <option key={v.id} value={v.cidade}>{v.cidade}/{v.uf}</option>)}
              </datalist>
            </label>
            <label>
              <span>UF</span>
              <input type="text" maxLength={2} value={sol.uf_destino || ''} onChange={(e) => setSol({ ...sol, uf_destino: e.target.value.toUpperCase() })} />
            </label>
            <label>
              <span>Rota</span>
              <input type="text" value={sol.rota || ''} onChange={(e) => setSol({ ...sol, rota: e.target.value })} placeholder="Ex.: 03" />
            </label>
            <label>
              <span>Data início *</span>
              <input type="date" value={sol.data_inicio || ''} onChange={(e) => setSol({ ...sol, data_inicio: e.target.value })} required />
            </label>
            <label>
              <span>Data fim *</span>
              <input type="date" value={sol.data_fim || ''} onChange={(e) => setSol({ ...sol, data_fim: e.target.value })} required />
            </label>
            <label>
              <span>Banco</span>
              <input type="text" value={sol.banco || 'Itau'} onChange={(e) => setSol({ ...sol, banco: e.target.value })} />
            </label>
            <label>
              <span>Status</span>
              <select value={sol.status} onChange={(e) => setSol({ ...sol, status: e.target.value })}>
                {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
            <strong>Motoristas / placas</strong>
            <button type="button" className="button-secondary" onClick={adicionarItem} style={{ fontSize: 11, padding: '3px 10px' }}>+ Adicionar motorista</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="rh-doc-table" style={{ fontSize: 11 }}>
              <thead>
                <tr>
                  <th>Motorista</th>
                  <th>Placa</th>
                  <th>Café</th>
                  <th>Almoço</th>
                  <th>Jantar</th>
                  <th>Pernoite</th>
                  <th>Diárias</th>
                  <th>Pernoites</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, idx) => (
                  <tr key={it._key || it.id || idx}>
                    <td>
                      <select value={it.colaborador_id || ''} onChange={(e) => escolherColaborador(idx, e.target.value)} style={{ width: 160 }}>
                        <option value="">— digitar —</option>
                        {colaboradores.filter((c) => c.ativo !== false).map((c) => <option key={c.id} value={c.id}>{c.nome_completo}</option>)}
                      </select>
                      <input type="text" value={it.motorista_nome} onChange={(e) => updItem(idx, { motorista_nome: e.target.value })} placeholder="Nome" style={{ width: 160, marginTop: 4 }} />
                    </td>
                    <td><input type="text" value={it.placa || ''} onChange={(e) => updItem(idx, { placa: e.target.value.toUpperCase() })} style={{ width: 80 }} /></td>
                    <td><input type="checkbox" checked={!!it.inclui_cafe} onChange={(e) => updItem(idx, { inclui_cafe: e.target.checked })} /> <small>{brl(it.valor_cafe)}</small></td>
                    <td><input type="checkbox" checked={!!it.inclui_almoco} onChange={(e) => updItem(idx, { inclui_almoco: e.target.checked })} /> <small>{brl(it.valor_almoco)}</small></td>
                    <td><input type="checkbox" checked={!!it.inclui_jantar} onChange={(e) => updItem(idx, { inclui_jantar: e.target.checked })} /> <small>{brl(it.valor_jantar)}</small></td>
                    <td><small>{brl(it.valor_pernoite)}</small></td>
                    <td><input type="number" min={0} value={it.qtd_diarias} onChange={(e) => updItem(idx, { qtd_diarias: Number(e.target.value) })} style={{ width: 50 }} /></td>
                    <td><input type="number" min={0} value={it.qtd_pernoites} onChange={(e) => updItem(idx, { qtd_pernoites: Number(e.target.value) })} style={{ width: 50 }} /></td>
                    <td><strong>{brl(it.valor_total)}</strong></td>
                    <td><button type="button" className="button-link danger" onClick={() => removerItem(idx)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={8} style={{ textAlign: 'right' }}><strong>Total da solicitação:</strong></td><td><strong>{brl(valorTotal)}</strong></td><td></td></tr>
              </tfoot>
            </table>
          </div>

          <label className="rh-doc-form-full">
            <span>Observações</span>
            <textarea rows={2} value={sol.observacoes || ''} onChange={(e) => setSol({ ...sol, observacoes: e.target.value })} />
          </label>

          {erro && <div className="alert-danger" style={{ marginTop: 8 }}>{erro}</div>}

          <footer className="modal-footer">
            <button type="button" className="button-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="button-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
          </footer>
        </form>
      </div>
    </div>
  )
}

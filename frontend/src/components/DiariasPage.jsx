import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { canCreateResource } from '../lib/permissions'

// ── Constantes ──────────────────────────────────────────────────────────────
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

const BANCOS = [
  '', 'Itaú', 'Bradesco', 'Banco do Brasil', 'Caixa Econômica', 'Santander',
  'Nubank', 'Inter', 'BTG Pactual', 'Sicoob', 'Sicredi', 'C6 Bank', 'Safra', 'Original', 'Outro',
]

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmtBR = (iso) => {
  if (!iso) return ''
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const isOwner = (sol, profile) =>
  profile && (Number(sol.criado_por) === Number(profile.id) || profile.is_super_admin)

const podeEditar = (sol, profile) =>
  isOwner(sol, profile) && (sol.status === 'pendente' || sol.status === 'rascunho')

// ── Página ──────────────────────────────────────────────────────────────────
export default function DiariasPage() {
  const { profile } = useAuth()
  const podeCriar = canCreateResource(profile, 'diarias')

  const [solicitacoes, setSolicitacoes] = useState([])
  const [itensPorSol, setItensPorSol] = useState({})
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
    setCarregando(true); setErro('')
    try {
      const [sols, colabs, fils] = await Promise.all([
        api.list('diarias_solicitacoes', { limit: 1000 }),
        api.list('colaboradores', { limit: 1000 }),
        api.list('filiais', { limit: 200 }),
      ])
      const solRows = sols?.data || sols || []
      setSolicitacoes(solRows)
      setColaboradores(colabs?.data || colabs || [])
      setFiliais(fils?.data || fils || [])

      const itensMap = {}
      if (solRows.length > 0) {
        const itensRes = await api.list('diarias_itens', { limit: 5000 })
        const itens = itensRes?.data || itensRes || []
        for (const it of itens) {
          (itensMap[it.solicitacao_id] ||= []).push(it)
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
    return [...list].sort((a, b) =>
      String(b.data_solicitacao || '').localeCompare(String(a.data_solicitacao || ''))
    )
  }, [solicitacoes, itensPorSol, filtroStatus, filtroFilial, filtroBusca])

  const totais = useMemo(() => {
    let pendentes = 0, aprovados = 0, pagos = 0, valorTotal = 0
    for (const s of solicitacoes) {
      if (s.status === 'pendente' || s.status === 'em_analise') pendentes++
      else if (s.status === 'aprovado') aprovados++
      else if (s.status === 'pago') pagos++
      valorTotal += Number(s.valor_total || 0)
    }
    return { pendentes, aprovados, pagos, valorTotal, total: solicitacoes.length }
  }, [solicitacoes])

  async function cancelar(sol) {
    if (!window.confirm(`Cancelar a solicitação #${sol.numero_solicitacao || sol.id}?`)) return
    try {
      await api.update('diarias_solicitacoes', sol.id, { status: 'cancelado' })
      carregar()
    } catch (e) { setErro(e.message) }
  }

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <span className="eyebrow">Operação</span>
          <h1>Diárias e hotelaria</h1>
          <p>Solicite diárias por viagem. Aprovação, valores e pagamento são feitos pelo financeiro na tela de Acompanhamento.</p>
        </div>
        {podeCriar && (
          <button className="button-primary" onClick={() => setModalSol('nova')} type="button">
            + Nova solicitação
          </button>
        )}
      </header>

      {erro && <div className="alert-danger">{erro}</div>}

      <section className="rh-doc-alert-cards">
        <div className="rh-doc-card pendentes"><span>Pendentes</span><strong>{totais.pendentes}</strong><small>Aguardando financeiro</small></div>
        <div className="rh-doc-card vigentes"><span>Aprovados</span><strong>{totais.aprovados}</strong><small>Falta pagamento</small></div>
        <div className="rh-doc-card vencidos"><span>Pagos</span><strong>{totais.pagos}</strong><small>Histórico</small></div>
        <div className="rh-doc-card alerta"><span>Valor total geral</span><strong style={{ fontSize: 18 }}>{brl(totais.valorTotal)}</strong><small>{totais.total} solicitação(ões)</small></div>
      </section>

      <section className="rh-doc-filtros">
        <input type="search" placeholder="Buscar motorista, placa, rota, cidade..." value={filtroBusca} onChange={(e) => setFiltroBusca(e.target.value)} />
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
                const editavel = podeEditar(s, profile)
                return (
                  <Fragment key={s.id}>
                    <tr className={`rh-status-${s.status}`}>
                      <td>
                        <button type="button" className="button-link" onClick={() => setExpandedId(open ? null : s.id)}>
                          {open ? '▼' : '▶'}
                        </button>
                      </td>
                      <td>{s.numero_solicitacao || `#${s.id}`}</td>
                      <td>{filial?.cidade || `Filial ${s.filial_id}`}</td>
                      <td>{s.cidade_destino}{s.uf_destino ? `/${s.uf_destino}` : ''}</td>
                      <td>{fmtBR(s.data_inicio)} → {fmtBR(s.data_fim)}</td>
                      <td>{s.rota || '—'}</td>
                      <td>{itens.length}</td>
                      <td>{brl(s.valor_total)}</td>
                      <td><span className={`rh-status-badge ${s.status}`}>{STATUS_LABELS[s.status] || s.status}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {editavel && (
                          <>
                            <button type="button" className="button-link" onClick={() => setModalSol({ sol: s, itens })}>editar</button>
                            <button type="button" className="button-link danger" onClick={() => cancelar(s)}>cancelar</button>
                          </>
                        )}
                        {!editavel && <span className="muted" style={{ fontSize: 11 }}>—</span>}
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={10} style={{ background: 'var(--surface-2, #f7f8fa)', padding: 12 }}>
                          <DetalheSolicitacao sol={s} itens={itens} filiais={filiais} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
          colaboradores={colaboradores}
          filiais={filiais}
          onClose={() => setModalSol(null)}
          onSaved={() => { setModalSol(null); carregar() }}
        />
      )}
    </section>
  )
}

// ── Detalhe expandido (texto pra mandar ao financeiro) ──────────────────────
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
      const sem = !it.inclui_almoco
      const det = sem
        ? `${it.qtd_diarias} diarias(sem almoço) ${it.qtd_pernoites} pernoites`
        : `${it.qtd_diarias} diarias e ${it.qtd_pernoites} pernoites`
      return `${(it.motorista_nome || '').toUpperCase()} - Mot ${filial?.cidade || ''}/ Placa ${it.placa || '—'}\n${det} ${fmtBR(it.data_inicio)} a ${fmtBR(it.data_fim)}\n${brl(it.valor_total)}\n`
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

// ── Modal criar/editar (sem valores; só dados básicos) ──────────────────────
function DiariasModal({ modo, solicitacao, itensIniciais, colaboradores, filiais, onClose, onSaved }) {
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
    banco: '',
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

  // Auto-calc qtds quando datas mudam (valores ficam zerados; financeiro preenche)
  useEffect(() => {
    setItens((arr) => arr.map((it) => recalcQtds(it, sol.data_inicio, sol.data_fim)))
  }, [sol.data_inicio, sol.data_fim])

  function recalcQtds(it, ini, fim) {
    const inicio = it.data_inicio || ini
    const fimEf = it.data_fim || fim
    if (!inicio || !fimEf) return it
    const d1 = new Date(`${inicio}T00:00:00`), d2 = new Date(`${fimEf}T00:00:00`)
    if (isNaN(d1) || isNaN(d2)) return it
    const dias = Math.max(0, Math.round((d2 - d1) / 86400000) + 1)
    return { ...it, qtd_diarias: dias, qtd_pernoites: Math.max(0, dias - 1) }
  }

  const updItem = (idx, patch) => setItens((arr) =>
    arr.map((it, i) => i === idx ? recalcQtds({ ...it, ...patch }, sol.data_inicio, sol.data_fim) : it)
  )
  const removerItem = (idx) => setItens((arr) => arr.filter((_, i) => i !== idx))
  const adicionarItem = () => setItens((arr) => [...arr, recalcQtds(novoItem(), sol.data_inicio, sol.data_fim)])

  async function salvar(event) {
    event.preventDefault()
    if (!sol.cidade_destino || !sol.data_inicio || !sol.data_fim) {
      return setErro('Preencha cidade destino e período.')
    }
    if (itens.length === 0 || itens.some((it) => !it.motorista_nome.trim())) {
      return setErro('Adicione ao menos um motorista com nome.')
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
        status: modo === 'nova' ? 'pendente' : (sol.status || 'pendente'),
        banco: sol.banco || null,
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
        for (const old of itensIniciais) {
          try { await api.remove('diarias_itens', old.id) } catch {}
        }
      }
      for (const it of itens) {
        await api.create('diarias_itens', {
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
        })
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
          <h3>{modo === 'nova'
            ? 'Nova solicitação de diárias'
            : `Editar solicitação #${solicitacao?.numero_solicitacao || solicitacao?.id}`}</h3>
          <button className="button-link" onClick={onClose} type="button">✕</button>
        </header>
        <form onSubmit={salvar} className="rh-doc-form">
          <div className="rh-doc-form-grid">
            <label><span>Filial *</span>
              <select value={sol.filial_id} onChange={(e) => setSol({ ...sol, filial_id: e.target.value })} required>
                <option value="">Selecione</option>
                {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
              </select>
            </label>
            <label><span>Cidade destino *</span>
              <input type="text" value={sol.cidade_destino}
                onChange={(e) => setSol({ ...sol, cidade_destino: e.target.value.toUpperCase() })}
                placeholder="Ex.: LONDRINA" required style={{ textTransform: 'uppercase' }} />
            </label>
            <label><span>UF</span>
              <input type="text" maxLength={2} value={sol.uf_destino || ''}
                onChange={(e) => setSol({ ...sol, uf_destino: e.target.value.toUpperCase() })} />
            </label>
            <label><span>Rota</span>
              <input type="text" value={sol.rota || ''} onChange={(e) => setSol({ ...sol, rota: e.target.value })} placeholder="Ex.: 03" />
            </label>
            <label><span>Data início *</span>
              <input type="date" value={sol.data_inicio || ''} onChange={(e) => setSol({ ...sol, data_inicio: e.target.value })} required />
            </label>
            <label><span>Data fim *</span>
              <input type="date" value={sol.data_fim || ''} onChange={(e) => setSol({ ...sol, data_fim: e.target.value })} required />
            </label>
            <label><span>Banco</span>
              <select value={sol.banco || ''} onChange={(e) => setSol({ ...sol, banco: e.target.value })}>
                {BANCOS.map((b) => <option key={b} value={b}>{b || '— selecione —'}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
            <strong>Motoristas / placas</strong>
            <button type="button" className="button-secondary" onClick={adicionarItem} style={{ fontSize: 11, padding: '3px 10px' }}>+ Adicionar motorista</button>
          </div>
          <small style={{ color: 'var(--text-muted, #666)', display: 'block', marginBottom: 6 }}>
            Valores (café/almoço/jantar/pernoite) são definidos pelo financeiro durante a aprovação, na tela de Acompanhamento.
          </small>

          <div style={{ overflowX: 'auto' }}>
            <table className="rh-doc-table" style={{ fontSize: 11 }}>
              <thead>
                <tr>
                  <th>Motorista</th>
                  <th>Placa</th>
                  <th>Diárias</th>
                  <th>Pernoites</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, idx) => (
                  <tr key={it._key || it.id || idx}>
                    <td>
                      <MotoristaCombo
                        colaboradores={colaboradores}
                        valor={it.motorista_nome}
                        colaboradorId={it.colaborador_id}
                        onSelect={(c) => updItem(idx, { colaborador_id: c?.id || null, motorista_nome: c?.nome_completo || '' })}
                        onTextChange={(text) => updItem(idx, { motorista_nome: text, colaborador_id: null })}
                      />
                    </td>
                    <td><input type="text" value={it.placa || ''} onChange={(e) => updItem(idx, { placa: e.target.value.toUpperCase() })} style={{ width: 90 }} /></td>
                    <td>{it.qtd_diarias}</td>
                    <td>{it.qtd_pernoites}</td>
                    <td><button type="button" className="button-link danger" onClick={() => removerItem(idx)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="rh-doc-form-full">
            <span>Observações</span>
            <textarea rows={2} value={sol.observacoes || ''} onChange={(e) => setSol({ ...sol, observacoes: e.target.value })} />
          </label>

          {erro && <div className="alert-danger" style={{ marginTop: 8 }}>{erro}</div>}

          <footer className="modal-footer">
            <button type="button" className="button-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="button-primary" disabled={saving}>
              {saving ? 'Salvando…' : (modo === 'nova' ? 'Enviar para aprovação' : 'Salvar alterações')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

// ── Combobox de motorista (3+ letras filtra) ────────────────────────────────
function MotoristaCombo({ colaboradores, valor, colaboradorId, onSelect, onTextChange }) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState(valor || '')

  useEffect(() => { setBusca(valor || '') }, [valor])

  const ativos = useMemo(() => colaboradores.filter((c) => c.ativo !== false), [colaboradores])
  const filtrados = useMemo(() => {
    const q = (busca || '').trim().toLowerCase()
    if (q.length < 3) return ativos.slice(0, 20)
    const termos = q.split(/\s+/).filter(Boolean)
    return ativos.filter((c) => {
      const nome = (c.nome_completo || '').toLowerCase()
      return termos.every((t) => nome.includes(t))
    }).slice(0, 30)
  }, [busca, ativos])

  function selecionar(c) {
    onSelect?.(c)
    setBusca(c.nome_completo)
    setAberto(false)
  }

  return (
    <div style={{ position: 'relative', width: 220 }}>
      <input
        type="text"
        value={busca}
        onChange={(e) => { setBusca(e.target.value); onTextChange?.(e.target.value); setAberto(true) }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder="Digite 3+ letras..."
        style={{ width: '100%' }}
      />
      {aberto && filtrados.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
          background: '#fff', border: '1px solid var(--border, #ccc)', borderRadius: 4,
          maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
        }}>
          {filtrados.map((c) => (
            <div
              key={c.id}
              onMouseDown={() => selecionar(c)}
              style={{
                padding: '6px 8px', cursor: 'pointer', fontSize: 11,
                background: Number(c.id) === Number(colaboradorId) ? 'var(--surface-2, #f0f4ff)' : 'transparent',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f4ff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = Number(c.id) === Number(colaboradorId) ? '#f0f4ff' : 'transparent')}
            >
              {c.nome_completo}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { canCreateResource } from '../lib/permissions'

// ─── Opções ───────────────────────────────────────────────────────────────────

const TIPO_OPTS = [
  { value: 'entrada', label: 'Entrada', icon: '↑', cor: '#388e3c', desc: 'Recebimento de material (compra, doação...)' },
  { value: 'saida_colaborador', label: 'Saída — Colaborador', icon: '↓', cor: '#1565c0', desc: 'Entrega de item a um colaborador (EPI, uniforme...)' },
  { value: 'saida_geral', label: 'Saída geral', icon: '↓', cor: '#e65100', desc: 'Saída para uso interno, descarte ou perda' },
  { value: 'saida_fornecedor', label: 'Devolução a fornecedor', icon: '↓', cor: '#6a1b9a', desc: 'Devolução de item ao fornecedor' },
  { value: 'troca', label: 'Troca', icon: '⇄', cor: '#00838f', desc: 'Troca de item danificado/usado por novo' },
  { value: 'ajuste_positivo', label: 'Ajuste positivo', icon: '+', cor: '#558b2f', desc: 'Correção de inventário para mais' },
  { value: 'ajuste_negativo', label: 'Ajuste negativo', icon: '−', cor: '#ad1457', desc: 'Correção de inventário para menos' },
]

const TIPO_LABELS = Object.fromEntries(TIPO_OPTS.map((o) => [o.value, o.label]))
const TIPO_CORES = Object.fromEntries(TIPO_OPTS.map((o) => [o.value, o.cor]))

const TIPOS_QUE_SAEM = new Set(['saida_colaborador', 'saida_geral', 'saida_fornecedor', 'troca', 'ajuste_negativo'])
const TIPOS_COM_COLABORADOR = new Set(['saida_colaborador', 'troca'])
const TIPOS_COM_FORNECEDOR = new Set(['entrada', 'saida_fornecedor'])

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatQtd(value, unidade) {
  const n = parseFloat(value) || 0
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)} ${unidade || ''}`
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const [y, m, d] = String(dateStr).split('-')
  return `${d}/${m}/${y}`
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function emptyForm(filialId, itemId) {
  return {
    filial_id: filialId || '',
    item_id: itemId || '',
    tipo: 'entrada',
    quantidade: '',
    colaborador_id: '',
    fornecedor: '',
    numero_nota: '',
    motivo: '',
    data_movimento: todayIso(),
    observacoes: '',
  }
}

// ─── Modal de lançamento ──────────────────────────────────────────────────────

function LancarModal({ filiais, colaboradores, itens, filialId, preItemId, preItemNome, onSave, onClose }) {
  const [form, setForm] = useState(() => emptyForm(filialId, preItemId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { profile } = useAuth()

  // itens filtrados pela filial selecionada
  const itensDaFilial = useMemo(
    () => itens.filter((i) => !form.filial_id || String(i.filial_id) === String(form.filial_id)),
    [itens, form.filial_id],
  )

  const colaboradoresDaFilial = useMemo(
    () => colaboradores.filter((c) => !form.filial_id || String(c.filial_id) === String(form.filial_id)),
    [colaboradores, form.filial_id],
  )

  const itemSelecionado = itens.find((i) => String(i.id) === String(form.item_id))
  const saldoAtual = itemSelecionado ? parseFloat(itemSelecionado.estoque_atual) || 0 : null
  const qtdNum = parseFloat(String(form.quantidade).replace(',', '.')) || 0
  const saldoApos = saldoAtual !== null && qtdNum > 0
    ? TIPOS_QUE_SAEM.has(form.tipo)
      ? saldoAtual - qtdNum
      : saldoAtual + qtdNum
    : null

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.filial_id) return setError('Selecione a base.')
    if (!form.item_id) return setError('Selecione o item.')
    if (!form.tipo) return setError('Selecione o tipo de movimento.')
    const qty = parseFloat(String(form.quantidade).replace(',', '.'))
    if (!qty || qty <= 0) return setError('Informe uma quantidade válida maior que zero.')
    if (TIPOS_COM_COLABORADOR.has(form.tipo) && !form.colaborador_id)
      return setError('Informe o colaborador para este tipo de movimento.')
    setSaving(true)
    setError('')
    try {
      const payload = {
        filial_id: Number(form.filial_id),
        item_id: Number(form.item_id),
        tipo: form.tipo,
        quantidade: qty,
        data_movimento: form.data_movimento || todayIso(),
        colaborador_id: form.colaborador_id ? Number(form.colaborador_id) : null,
        fornecedor: form.fornecedor.trim() || null,
        numero_nota: form.numero_nota.trim() || null,
        motivo: form.motivo.trim() || null,
        observacoes: form.observacoes.trim() || null,
        registrado_por: profile?.colaborador_id || null,
      }
      await api.criarMovimentoEstoque(payload)
      onSave()
    } catch (err) {
      setError(err.message || 'Erro ao lançar movimento.')
    } finally {
      setSaving(false)
    }
  }

  const tipoInfo = TIPO_OPTS.find((o) => o.value === form.tipo)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">Estoque</span>
            <h2>Lançar movimento</h2>
          </div>
          <button className="button-secondary" onClick={onClose} type="button">Fechar</button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="inline-error">{error}</div>}

          <div className="form-row">
            <label className="form-label">Base *
              <select
                className="form-input"
                value={form.filial_id}
                onChange={(e) => { set('filial_id', e.target.value); set('item_id', ''); set('colaborador_id', '') }}
                required
              >
                <option value="">Selecione...</option>
                {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
              </select>
            </label>
            <label className="form-label">Data *
              <input className="form-input" type="date" value={form.data_movimento} onChange={(e) => set('data_movimento', e.target.value)} required />
            </label>
          </div>

          <label className="form-label">Item *
            <select className="form-input" value={form.item_id} onChange={(e) => set('item_id', e.target.value)} required>
              <option value="">{form.filial_id ? 'Selecione o item...' : 'Selecione uma base primeiro...'}</option>
              {itensDaFilial.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}{i.codigo ? ` [${i.codigo}]` : ''} — saldo: {formatQtd(i.estoque_atual, i.unidade)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-label">Tipo de movimento *
            <select className="form-input" value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
              {TIPO_OPTS.map((o) => <option key={o.value} value={o.value}>{o.icon} {o.label}</option>)}
            </select>
          </label>

          {tipoInfo && (
            <div style={{ background: 'var(--surface-alt, #f8f8f8)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text-muted)', borderLeft: `3px solid ${tipoInfo.cor}` }}>
              {tipoInfo.desc}
            </div>
          )}

          <div className="form-row">
            <label className="form-label">Quantidade *
              <input
                className="form-input"
                type="number"
                min="0.001"
                step="0.001"
                value={form.quantidade}
                onChange={(e) => set('quantidade', e.target.value)}
                required
                placeholder="0"
              />
            </label>
            {saldoAtual !== null && (
              <div className="form-label" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ padding: '8px 0', fontSize: 13 }}>
                  <div style={{ color: 'var(--text-muted)' }}>Saldo atual</div>
                  <strong>{formatQtd(saldoAtual, itemSelecionado?.unidade)}</strong>
                </div>
                {saldoApos !== null && (
                  <div style={{ fontSize: 13 }}>
                    <div style={{ color: 'var(--text-muted)' }}>Saldo após</div>
                    <strong style={{ color: saldoApos < 0 ? '#c62828' : undefined }}>
                      {formatQtd(saldoApos, itemSelecionado?.unidade)}
                      {saldoApos < 0 && ' ⚠'}
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {TIPOS_COM_COLABORADOR.has(form.tipo) && (
            <label className="form-label">Colaborador *
              <select className="form-input" value={form.colaborador_id} onChange={(e) => set('colaborador_id', e.target.value)}>
                <option value="">Selecione o colaborador...</option>
                {colaboradoresDaFilial.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome_completo} — {c.cargo || 'Sem cargo'}</option>
                ))}
              </select>
            </label>
          )}

          {TIPOS_COM_FORNECEDOR.has(form.tipo) && (
            <label className="form-label">Fornecedor
              <input className="form-input" value={form.fornecedor} onChange={(e) => set('fornecedor', e.target.value)} placeholder="Nome do fornecedor..." />
            </label>
          )}

          <div className="form-row">
            <label className="form-label">Nº da nota / pedido
              <input className="form-input" value={form.numero_nota} onChange={(e) => set('numero_nota', e.target.value)} placeholder="NF-001..." />
            </label>
            <label className="form-label">Motivo
              <input className="form-input" value={form.motivo} onChange={(e) => set('motivo', e.target.value)} placeholder="Motivo resumido..." />
            </label>
          </div>

          <label className="form-label">Observações
            <textarea className="form-input" rows={2} value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} />
          </label>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="button-secondary" type="button" onClick={onClose}>Cancelar</button>
            <button className="button-primary" type="submit" disabled={saving}>
              {saving ? 'Lançando...' : 'Confirmar lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Linha de histórico ───────────────────────────────────────────────────────

function TipoBadge({ tipo }) {
  const info = TIPO_OPTS.find((o) => o.value === tipo) || { label: tipo, icon: '?', cor: '#999' }
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 10px',
      borderRadius: 10,
      fontSize: 11,
      fontWeight: 600,
      background: info.cor + '18',
      color: info.cor,
      border: `1px solid ${info.cor}33`,
    }}>
      {info.icon} {info.label}
    </span>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EstoqueMovimentosPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const preItem = location.state || {}

  const canCreate = canCreateResource(profile, 'estoque_movimentos', 'create.estoque_movimentos')

  const [historico, setHistorico] = useState([])
  const [itens, setItens] = useState([])
  const [filiais, setFiliais] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterFilial, setFilterFilial] = useState('')
  const [filterItem, setFilterItem] = useState(preItem.itemId ? String(preItem.itemId) : '')
  const [filterTipo, setFilterTipo] = useState('')
  const [showModal, setShowModal] = useState(false)

  async function loadBase() {
    setLoading(true)
    setError('')
    try {
      const [itensRes, filiaisRes, colabsRes] = await Promise.all([
        api.getEstoqueResumo(),
        api.list('filiais', { ativo: true }),
        api.list('colaboradores', { ativo: true }),
      ])
      setItens(itensRes)
      setFiliais(filiaisRes)
      setColaboradores(colabsRes)
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }

  async function loadHistorico() {
    try {
      const params = {}
      if (filterItem) params.item_id = filterItem
      if (filterFilial) params.filial_id = filterFilial
      const rows = await api.getEstoqueHistorico(params)
      setHistorico(rows)
    } catch (err) {
      setError(err.message || 'Erro ao carregar histórico.')
    }
  }

  useEffect(() => { loadBase() }, [])
  useEffect(() => { if (!loading) loadHistorico() }, [loading, filterItem, filterFilial])

  const filtered = useMemo(() => {
    if (!filterTipo) return historico
    return historico.filter((r) => r.tipo === filterTipo)
  }, [historico, filterTipo])

  function filialLabel(filial_id) {
    const f = filiais.find((x) => x.id === filial_id)
    return f ? `${f.cidade}/${f.uf}` : '-'
  }

  function handleSaved() {
    setShowModal(false)
    loadBase()
    loadHistorico()
  }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Almoxarifado</span>
          <h1>Movimentos de estoque</h1>
          <p>Entradas, saídas, trocas, devoluções e ajustes de inventário.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="button-secondary" type="button" onClick={() => navigate('/estoque')}>
            ← Itens
          </button>
          {canCreate && (
            <button className="button-primary" type="button" onClick={() => setShowModal(true)}>
              + Lançar movimento
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          className="form-input"
          style={{ flex: '1 1 160px' }}
          value={filterFilial}
          onChange={(e) => { setFilterFilial(e.target.value); setFilterItem('') }}
        >
          <option value="">Todas as bases</option>
          {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
        </select>
        <select
          className="form-input"
          style={{ flex: '2 1 200px' }}
          value={filterItem}
          onChange={(e) => setFilterItem(e.target.value)}
        >
          <option value="">Todos os itens</option>
          {itens
            .filter((i) => !filterFilial || String(i.filial_id) === filterFilial)
            .map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
        </select>
        <select
          className="form-input"
          style={{ flex: '1 1 160px' }}
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          {TIPO_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {preItem.itemNome && (
        <div style={{ marginBottom: 12, padding: '8px 14px', background: 'var(--surface-alt, #f5f5f5)', borderRadius: 8, fontSize: 13 }}>
          Mostrando histórico de: <strong>{preItem.itemNome}</strong>
          <button
            type="button"
            style={{ marginLeft: 12, fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            onClick={() => { navigate('/estoque/movimentos', { replace: true }); setFilterItem('') }}
          >
            ✕ Limpar
          </button>
        </div>
      )}

      {error && <div className="inline-error">{error}</div>}

      {loading ? (
        <div className="surface-card empty-state"><p>Carregando...</p></div>
      ) : filtered.length === 0 ? (
        <div className="surface-card empty-state">
          <strong>Nenhum movimento registrado</strong>
          <p>{canCreate ? 'Clique em "+ Lançar movimento" para registrar a primeira entrada ou saída.' : 'Sem movimentos para exibir com os filtros selecionados.'}</p>
        </div>
      ) : (
        <div className="surface-card" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Item</th>
                <th>Base</th>
                <th>Tipo</th>
                <th style={{ textAlign: 'right' }}>Qtd</th>
                <th style={{ textAlign: 'right' }}>Saldo após</th>
                <th>Colaborador / Fornecedor</th>
                <th>Nota / Motivo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(row.data_movimento)}</td>
                  <td>
                    <strong>{row.item_nome || '-'}</strong>
                    {row.item_unidade && <small style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({row.item_unidade})</small>}
                  </td>
                  <td>{filialLabel(row.filial_id)}</td>
                  <td><TipoBadge tipo={row.tipo} /></td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: TIPOS_QUE_SAEM.has(row.tipo) ? '#c62828' : '#2e7d32' }}>
                    {TIPOS_QUE_SAEM.has(row.tipo) ? '−' : '+'}{formatQtd(row.quantidade, row.item_unidade)}
                  </td>
                  <td style={{ textAlign: 'right', color: parseFloat(row.saldo_apos) < 0 ? '#c62828' : undefined }}>
                    {row.saldo_apos !== null && row.saldo_apos !== undefined
                      ? formatQtd(row.saldo_apos, row.item_unidade)
                      : '-'}
                  </td>
                  <td>
                    {row.colaborador_nome
                      ? <span><strong>{row.colaborador_nome}</strong></span>
                      : row.fornecedor
                        ? <span style={{ color: 'var(--text-muted)' }}>{row.fornecedor}</span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td>
                    {row.numero_nota && <div style={{ fontSize: 12 }}>NF: {row.numero_nota}</div>}
                    {row.motivo && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.motivo}</div>}
                    {!row.numero_nota && !row.motivo && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <LancarModal
          filiais={filiais}
          colaboradores={colaboradores}
          itens={itens}
          filialId={filterFilial}
          preItemId={filterItem}
          preItemNome={preItem.itemNome}
          onSave={handleSaved}
          onClose={() => setShowModal(false)}
        />
      )}
    </section>
  )
}

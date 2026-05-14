import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { canCreateResource } from '../lib/permissions'

// ─── Opções ───────────────────────────────────────────────────────────────────

const CATEGORIA_OPTS = [
  { value: 'epi', label: 'EPI' },
  { value: 'uniforme', label: 'Uniforme' },
  { value: 'limpeza', label: 'Limpeza' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'escritorio', label: 'Escritório' },
  { value: 'informatica', label: 'Informática' },
  { value: 'ferramentas', label: 'Ferramentas' },
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'combustivel', label: 'Combustível' },
  { value: 'outro', label: 'Outro' },
]

const UNIDADE_OPTS = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'l', label: 'Litro (l)' },
  { value: 'cx', label: 'Caixa (cx)' },
  { value: 'pct', label: 'Pacote (pct)' },
  { value: 'm', label: 'Metro (m)' },
  { value: 'par', label: 'Par' },
  { value: 'rolo', label: 'Rolo' },
]

const CAT_LABELS = Object.fromEntries(CATEGORIA_OPTS.map((o) => [o.value, o.label]))
const UND_LABELS = Object.fromEntries(UNIDADE_OPTS.map((o) => [o.value, o.label]))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatQtd(value, unidade) {
  const n = parseFloat(value) || 0
  const label = UND_LABELS[unidade] || unidade || ''
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)} ${label}`
}

function emptyForm(filialId) {
  return {
    filial_id: filialId || '',
    codigo: '',
    nome: '',
    descricao: '',
    categoria: 'outro',
    unidade: 'un',
    estoque_atual: '',
    estoque_minimo: '',
    localizacao: '',
    observacoes: '',
    ativo: true,
  }
}

// ─── Modal de cadastro/edição de item ────────────────────────────────────────

function ItemModal({ item, filiais, filialId, onSave, onClose }) {
  const isEdit = Boolean(item?.id)
  const [form, setForm] = useState(() =>
    isEdit
      ? {
          filial_id: item.filial_id ?? filialId ?? '',
          codigo: item.codigo ?? '',
          nome: item.nome ?? '',
          descricao: item.descricao ?? '',
          categoria: item.categoria ?? 'outro',
          unidade: item.unidade ?? 'un',
          estoque_atual: item.estoque_atual ?? '',
          estoque_minimo: item.estoque_minimo ?? '',
          localizacao: item.localizacao ?? '',
          observacoes: item.observacoes ?? '',
          ativo: item.ativo ?? true,
        }
      : emptyForm(filialId),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nome.trim()) return setError('Nome é obrigatório.')
    if (!form.filial_id) return setError('Selecione a base.')
    setSaving(true)
    setError('')
    try {
      const payload = {
        filial_id: Number(form.filial_id),
        codigo: form.codigo.trim() || null,
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        categoria: form.categoria,
        unidade: form.unidade,
        estoque_atual: parseFloat(String(form.estoque_atual).replace(',', '.')) || 0,
        estoque_minimo: parseFloat(String(form.estoque_minimo).replace(',', '.')) || 0,
        localizacao: form.localizacao.trim() || null,
        observacoes: form.observacoes.trim() || null,
        ativo: form.ativo,
      }
      if (isEdit) {
        await api.update('estoque_itens', item.id, payload)
      } else {
        await api.create('estoque_itens', payload)
      }
      onSave()
    } catch (err) {
      setError(err.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">Estoque</span>
            <h2>{isEdit ? 'Editar item' : 'Novo item de estoque'}</h2>
          </div>
          <button className="button-secondary" onClick={onClose} type="button">Fechar</button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="inline-error">{error}</div>}

          <div className="form-row">
            <label className="form-label">Base *
              <select className="form-input" value={form.filial_id} onChange={(e) => set('filial_id', e.target.value)} required>
                <option value="">Selecione...</option>
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>{f.cidade} / {f.uf}</option>
                ))}
              </select>
            </label>
            <label className="form-label">Código
              <input className="form-input" value={form.codigo} onChange={(e) => set('codigo', e.target.value)} placeholder="Ex: EPI-001" />
            </label>
          </div>

          <label className="form-label">Nome do item *
            <input className="form-input" value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Ex: Capacete de segurança" required />
          </label>

          <label className="form-label">Descrição
            <input className="form-input" value={form.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Detalhes adicionais..." />
          </label>

          <div className="form-row">
            <label className="form-label">Categoria *
              <select className="form-input" value={form.categoria} onChange={(e) => set('categoria', e.target.value)}>
                {CATEGORIA_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="form-label">Unidade *
              <select className="form-input" value={form.unidade} onChange={(e) => set('unidade', e.target.value)}>
                {UNIDADE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>

          <div className="form-row">
            <label className="form-label">Estoque atual
              <input className="form-input" type="number" min="0" step="0.001" value={form.estoque_atual} onChange={(e) => set('estoque_atual', e.target.value)} placeholder="0" />
            </label>
            <label className="form-label">Estoque mínimo
              <input className="form-input" type="number" min="0" step="0.001" value={form.estoque_minimo} onChange={(e) => set('estoque_minimo', e.target.value)} placeholder="0" />
            </label>
          </div>

          <label className="form-label">Localização (prateleira / área)
            <input className="form-input" value={form.localizacao} onChange={(e) => set('localizacao', e.target.value)} placeholder="Ex: Almoxarifado A - Prateleira 3" />
          </label>

          <label className="form-label">Observações
            <textarea className="form-input" rows={2} value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} />
          </label>

          {isEdit && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.ativo} onChange={(e) => set('ativo', e.target.checked)} />
              Item ativo
            </label>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="button-secondary" type="button" onClick={onClose}>Cancelar</button>
            <button className="button-primary" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EstoquePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const canCreate = canCreateResource(profile, 'estoque_itens', 'create.estoque')

  const [items, setItems] = useState([])
  const [filiais, setFiliais] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterText, setFilterText] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterFilial, setFilterFilial] = useState('')
  const [filterAlerta, setFilterAlerta] = useState(false)
  const [modalItem, setModalItem] = useState(null) // null = fechado, {} = novo, item = editar
  const [deletingId, setDeletingId] = useState(null)
  const searchRef = useRef(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [itensRes, filiaisRes] = await Promise.all([
        api.getEstoqueResumo(),
        api.list('filiais', { ativo: true }),
      ])
      setItems(itensRes)
      setFiliais(filiaisRes)
    } catch (err) {
      setError(err.message || 'Erro ao carregar estoque.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    let list = items
    if (filterText) {
      const q = filterText.toLowerCase()
      list = list.filter((i) =>
        (i.nome || '').toLowerCase().includes(q) ||
        (i.codigo || '').toLowerCase().includes(q) ||
        (i.localizacao || '').toLowerCase().includes(q),
      )
    }
    if (filterCat) list = list.filter((i) => i.categoria === filterCat)
    if (filterFilial) list = list.filter((i) => String(i.filial_id) === filterFilial)
    if (filterAlerta) list = list.filter((i) => i.alerta_estoque_baixo)
    return list
  }, [items, filterText, filterCat, filterFilial, filterAlerta])

  const totalAlerta = items.filter((i) => i.alerta_estoque_baixo).length

  async function handleDelete(item) {
    if (!window.confirm(`Deseja inativar o item "${item.nome}"?`)) return
    setDeletingId(item.id)
    try {
      await api.update('estoque_itens', item.id, { ativo: false })
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch (err) {
      alert(err.message || 'Erro ao inativar.')
    } finally {
      setDeletingId(null)
    }
  }

  function filialLabel(filial_id) {
    const f = filiais.find((x) => x.id === filial_id)
    return f ? `${f.cidade}/${f.uf}` : '-'
  }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Almoxarifado</span>
          <h1>Estoque</h1>
          <p>Cadastro de itens, quantidades e alertas de reposição.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="button-secondary"
            type="button"
            onClick={() => navigate('/estoque/movimentos')}
          >
            Lançar movimento
          </button>
          {canCreate && (
            <button className="button-primary" type="button" onClick={() => setModalItem({})}>
              + Novo item
            </button>
          )}
        </div>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="surface-card" style={{ flex: '1 1 140px', padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total de itens</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{items.length}</div>
        </div>
        <div
          className="surface-card"
          style={{ flex: '1 1 140px', padding: '14px 18px', cursor: totalAlerta > 0 ? 'pointer' : 'default', border: totalAlerta > 0 ? '1.5px solid #e57373' : undefined }}
          onClick={() => totalAlerta > 0 && setFilterAlerta((v) => !v)}
          title={totalAlerta > 0 ? 'Clique para filtrar apenas alertas' : undefined}
        >
          <div style={{ fontSize: 11, color: totalAlerta > 0 ? '#c62828' : 'var(--text-muted)', textTransform: 'uppercase' }}>
            ⚠ Estoque baixo
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: totalAlerta > 0 ? '#c62828' : undefined, marginTop: 4 }}>
            {totalAlerta}
          </div>
        </div>
        <div className="surface-card" style={{ flex: '1 1 140px', padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Exibindo</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{filtered.length}</div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          ref={searchRef}
          className="form-input"
          style={{ flex: '2 1 200px' }}
          placeholder="Buscar por nome, código ou localização..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <select className="form-input" style={{ flex: '1 1 140px' }} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="">Todas as categorias</option>
          {CATEGORIA_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="form-input" style={{ flex: '1 1 160px' }} value={filterFilial} onChange={(e) => setFilterFilial(e.target.value)}>
          <option value="">Todas as bases</option>
          {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
        </select>
        {filterAlerta && (
          <button className="button-secondary" type="button" onClick={() => setFilterAlerta(false)}>
            ✕ Apenas alertas
          </button>
        )}
      </div>

      {error && <div className="inline-error">{error}</div>}

      {loading ? (
        <div className="surface-card empty-state"><p>Carregando...</p></div>
      ) : filtered.length === 0 ? (
        <div className="surface-card empty-state">
          <strong>Nenhum item encontrado</strong>
          <p>{canCreate ? 'Clique em "+ Novo item" para cadastrar o primeiro produto.' : 'Nenhum item de estoque cadastrado ainda.'}</p>
        </div>
      ) : (
        <div className="surface-card" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Categoria</th>
                <th>Base</th>
                <th>Localização</th>
                <th style={{ textAlign: 'right' }}>Estoque atual</th>
                <th style={{ textAlign: 'right' }}>Mínimo</th>
                <th>Status</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} style={{ opacity: item.ativo === false ? 0.5 : 1 }}>
                  <td>
                    <strong style={{ display: 'block' }}>{item.nome}</strong>
                    {item.codigo && <small style={{ color: 'var(--text-muted)' }}>{item.codigo}</small>}
                    {item.descricao && <small style={{ color: 'var(--text-muted)', display: 'block' }}>{item.descricao}</small>}
                  </td>
                  <td>{CAT_LABELS[item.categoria] || item.categoria}</td>
                  <td>{filialLabel(item.filial_id)}</td>
                  <td>{item.localizacao || '-'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: item.alerta_estoque_baixo ? '#c62828' : undefined }}>
                    {formatQtd(item.estoque_atual, item.unidade)}
                    {item.alerta_estoque_baixo && <span style={{ marginLeft: 4 }}>⚠</span>}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                    {parseFloat(item.estoque_minimo) > 0 ? formatQtd(item.estoque_minimo, item.unidade) : '-'}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 600,
                      background: item.alerta_estoque_baixo ? '#ffebee' : '#e8f5e9',
                      color: item.alerta_estoque_baixo ? '#c62828' : '#2e7d32',
                    }}>
                      {item.alerta_estoque_baixo ? 'Baixo' : 'Normal'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="button-secondary"
                      style={{ fontSize: 12, padding: '4px 10px', marginRight: 6 }}
                      type="button"
                      onClick={() => navigate('/estoque/movimentos', { state: { itemId: item.id, itemNome: item.nome } })}
                    >
                      Movimentos
                    </button>
                    {canCreate && (
                      <button
                        className="button-secondary"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        type="button"
                        onClick={() => setModalItem(item)}
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalItem !== null && (
        <ItemModal
          item={modalItem?.id ? modalItem : null}
          filiais={filiais}
          filialId={filterFilial || ''}
          onSave={() => { setModalItem(null); load() }}
          onClose={() => setModalItem(null)}
        />
      )}
    </section>
  )
}

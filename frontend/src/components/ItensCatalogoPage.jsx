import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

const CATEGORIA_OPTS = [
  { value: 'limpeza', label: 'Limpeza' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'epi', label: 'EPI' },
  { value: 'escritorio', label: 'Escritório' },
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'combustivel', label: 'Combustível' },
  { value: 'informatica', label: 'Informática' },
  { value: 'uniforme', label: 'Uniforme' },
  { value: 'ferramentas', label: 'Ferramentas' },
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

const CATEGORIA_LABELS = Object.fromEntries(CATEGORIA_OPTS.map((o) => [o.value, o.label]))
const UNIDADE_LABELS = Object.fromEntries(UNIDADE_OPTS.map((o) => [o.value, o.label]))

function formatCurrency(value) {
  if (value == null || value === '') return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
}

function emptyForm(filialId = '') {
  return {
    nome: '',
    categoria: 'outro',
    unidade: 'un',
    valor_referencia: '',
    fornecedor_habitual: '',
    observacoes: '',
    filial_id: filialId,
    ativo: true,
  }
}

function FormModal({ item, filiais, onSaved, onClose }) {
  const isEditing = Boolean(item?.id)
  const [form, setForm] = useState(() => item ? {
    ...item,
    filial_id: item.filial_id != null ? String(item.filial_id) : '',
    valor_referencia: item.valor_referencia != null ? String(item.valor_referencia) : '',
  } : emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setField(f, v) { setForm((prev) => ({ ...prev, [f]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.nome.trim()) { setError('Nome obrigatório.'); return }

    setSaving(true)
    try {
      const payload = {
        nome: form.nome.trim(),
        categoria: form.categoria || 'outro',
        unidade: form.unidade || 'un',
        valor_referencia: form.valor_referencia !== '' ? parseFloat(String(form.valor_referencia).replace(',', '.')) || null : null,
        fornecedor_habitual: form.fornecedor_habitual || null,
        observacoes: form.observacoes || null,
        filial_id: form.filial_id ? Number(form.filial_id) : null,
        ativo: Boolean(form.ativo),
      }

      if (isEditing) {
        await api.update('itens_catalogo', item.id, payload)
      } else {
        await api.create('itens_catalogo', payload)
      }
      onSaved()
    } catch (err) {
      setError(err.message || 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">Catálogo</span>
            <h2>{isEditing ? 'Editar item' : 'Novo item'}</h2>
          </div>
          <button className="button-secondary" onClick={onClose} type="button">Fechar</button>
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          {error && <div className="alert-error" style={{ marginBottom: 12 }}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 12 }}>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Nome *</span>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setField('nome', e.target.value)}
                  placeholder="Ex.: Papel higiênico industrial"
                  required
                  autoFocus
                />
              </label>

              <label className="field">
                <span>Categoria</span>
                <select value={form.categoria} onChange={(e) => setField('categoria', e.target.value)}>
                  {CATEGORIA_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>

              <label className="field">
                <span>Unidade</span>
                <select value={form.unidade} onChange={(e) => setField('unidade', e.target.value)}>
                  {UNIDADE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>

              <label className="field">
                <span>Valor de referência (R$)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={form.valor_referencia}
                  onChange={(e) => setField('valor_referencia', e.target.value)}
                />
              </label>

              <label className="field">
                <span>Fornecedor habitual</span>
                <input
                  type="text"
                  placeholder="Ex.: Atacadão, Leroy Merlin"
                  value={form.fornecedor_habitual}
                  onChange={(e) => setField('fornecedor_habitual', e.target.value)}
                />
              </label>

              <label className="field">
                <span>Filial (deixe vazio para todas)</span>
                <select value={form.filial_id} onChange={(e) => setField('filial_id', e.target.value)}>
                  <option value="">Todas as filiais</option>
                  {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
                </select>
              </label>

              <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={Boolean(form.ativo)}
                  onChange={(e) => setField('ativo', e.target.checked)}
                  style={{ width: 'auto' }}
                />
                <span>Item ativo</span>
              </label>

              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Observações</span>
                <textarea
                  rows={2}
                  placeholder="Especificações, marca preferida, etc."
                  value={form.observacoes}
                  onChange={(e) => setField('observacoes', e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" className="button-primary" disabled={saving}>
                {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar item'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function ItensCatalogoPage() {
  const navigate = useNavigate()
  const [itens, setItens] = useState([])
  const [filiais, setFiliais] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [modal, setModal] = useState(null)    // null | {} | { item }
  const [fBusca, setFBusca] = useState('')
  const [fCategoria, setFCategoria] = useState('')
  const [fAtivo, setFAtivo] = useState('true')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    api.list('filiais', { ativo: true }).then(setFiliais).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setErro('')
    const params = {}
    if (fAtivo !== '') params.ativo = fAtivo
    api.list('itens_catalogo', { ...params, limit: 1000 })
      .then((r) => setItens(Array.isArray(r) ? r : (r.items || [])))
      .catch((err) => setErro(err.message || 'Falha ao carregar catálogo.'))
      .finally(() => setLoading(false))
  }, [fAtivo, refreshKey])

  const filtrados = useMemo(() => {
    let result = itens
    if (fCategoria) result = result.filter((it) => it.categoria === fCategoria)
    const q = fBusca.trim().toLowerCase()
    if (q) result = result.filter((it) =>
      [it.nome, it.fornecedor_habitual, it.observacoes].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    )
    return result
  }, [itens, fCategoria, fBusca])

  async function handleDesativar(item) {
    try {
      await api.update('itens_catalogo', item.id, { ativo: !item.ativo })
      setRefreshKey((k) => k + 1)
    } catch (err) {
      alert(err.message || 'Falha ao alterar.')
    }
  }

  function handleSaved() {
    setModal(null)
    setRefreshKey((k) => k + 1)
  }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Compras</span>
          <h1>Catálogo de itens</h1>
          <p>Gerencie itens padrão para agilizar o preenchimento dos pedidos de compra.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="button-secondary" onClick={() => navigate('/pedidos-compra')} type="button">
            ← Pedidos
          </button>
          <button className="button-primary" onClick={() => setModal({})} type="button">
            + Novo item
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="surface-card" style={{ padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <label className="field filter-field">
            <span>Categoria</span>
            <select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)}>
              <option value="">Todas</option>
              {CATEGORIA_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="field filter-field">
            <span>Situação</span>
            <select value={fAtivo} onChange={(e) => setFAtivo(e.target.value)}>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
              <option value="">Todos</option>
            </select>
          </label>
          <label className="field filter-field" style={{ gridColumn: 'span 2' }}>
            <span>Buscar</span>
            <input
              type="text"
              placeholder="Nome, fornecedor..."
              value={fBusca}
              onChange={(e) => setFBusca(e.target.value)}
            />
          </label>
        </div>
      </div>

      {erro && <div className="alert-error" style={{ marginBottom: 12 }}>{erro}</div>}

      <div className="surface-card">
        {loading ? (
          <div className="empty-state">Carregando catálogo...</div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">
            <strong>Nenhum item encontrado.</strong>
            <p>Clique em "+ Novo item" para começar a montar o catálogo.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Categoria</th>
                  <th>Unidade</th>
                  <th>Valor ref.</th>
                  <th>Fornecedor habitual</th>
                  <th>Filial</th>
                  <th>Situação</th>
                  <th style={{ width: 100 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((item) => (
                  <tr key={item.id} style={!item.ativo ? { opacity: 0.55 } : {}}>
                    <td>
                      <strong>{item.nome}</strong>
                      {item.observacoes && (
                        <small style={{ display: 'block', color: '#888', fontSize: 11 }}>{item.observacoes}</small>
                      )}
                    </td>
                    <td>{CATEGORIA_LABELS[item.categoria] || item.categoria}</td>
                    <td>{UNIDADE_LABELS[item.unidade] || item.unidade}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(item.valor_referencia)}</td>
                    <td>{item.fornecedor_habitual || <span style={{ color: '#bbb' }}>—</span>}</td>
                    <td>
                      {item.filial_id
                        ? (filiais.find((f) => f.id === item.filial_id)?.cidade || `#${item.filial_id}`)
                        : <span style={{ color: '#bbb', fontSize: 11 }}>Todas</span>}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: item.ativo ? '#e6f4ea' : '#fce8e8',
                        color: item.ativo ? '#1a7340' : '#c00',
                      }}>
                        {item.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="button-secondary"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => setModal({ item })}
                          type="button"
                        >
                          Editar
                        </button>
                        <button
                          className="button-secondary"
                          style={{ fontSize: 11, padding: '2px 8px', color: item.ativo ? 'var(--danger, #c00)' : '#888' }}
                          onClick={() => handleDesativar(item)}
                          type="button"
                        >
                          {item.ativo ? 'Desativar' : 'Reativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal !== null && (
        <FormModal
          item={modal.item || null}
          filiais={filiais}
          onSaved={handleSaved}
          onClose={() => setModal(null)}
        />
      )}
    </section>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

const CATEGORIAS = ['FORNECEDOR', 'PRESTADOR', 'PARCEIRO', 'OUTRO']

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

function Badge({ ativo }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
      background: ativo ? '#f0fdf4' : '#f8fafc',
      color: ativo ? '#059669' : '#94a3b8',
      border: `1px solid ${ativo ? '#6ee7b7' : '#e2e8f0'}`
    }}>{ativo ? 'ATIVO' : 'INATIVO'}</span>
  )
}

function FormModal({ title, form, setForm, filiais, onSave, onClose, saving }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1e293b' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="field-label">Nome *</label>
            <input className="input" value={form.nome || ''} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Nome do fornecedor" />
          </div>
          <div>
            <label className="field-label">CNPJ / CPF</label>
            <input className="input" value={form.cnpj || ''} onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" />
          </div>
          <div>
            <label className="field-label">Categoria</label>
            <select className="input" value={form.categoria || ''} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}>
              <option value="">— selecione —</option>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Telefone</label>
            <input className="input" value={form.telefone || ''} onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <label className="field-label">E-mail</label>
            <input type="email" className="input" value={form.email || ''} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="contato@empresa.com" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="field-label">Nome do contato</label>
            <input className="input" value={form.contato_nome || ''} onChange={(e) => setForm((p) => ({ ...p, contato_nome: e.target.value }))} placeholder="Pessoa de referência" />
          </div>
          <div>
            <label className="field-label">Filial</label>
            <select className="input" value={form.filial_id || ''} onChange={(e) => setForm((p) => ({ ...p, filial_id: e.target.value ? Number(e.target.value) : null }))}>
              <option value="">— todas —</option>
              {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}</option>)}
            </select>
          </div>
          {form.id && (
            <div>
              <label className="field-label">Status</label>
              <select className="input" value={form.ativo ? 'true' : 'false'} onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.value === 'true' }))}>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </div>
          )}
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="field-label">Endereço</label>
            <input className="input" value={form.endereco || ''} onChange={(e) => setForm((p) => ({ ...p, endereco: e.target.value }))} placeholder="Rua, número, cidade, estado" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="field-label">Observações</label>
            <textarea className="input" rows={3} value={form.observacoes || ''} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} placeholder="Informações adicionais" style={{ resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving || !form.nome?.trim()}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FornecedoresPage() {
  const [rows, setRows] = useState([])
  const [filiais, setFiliais] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterBusca, setFilterBusca] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterAtivo, setFilterAtivo] = useState('true')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const carregar = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.list('fornecedores', { limit: 1000 }),
      api.list('filiais', { limit: 500 }),
    ])
      .then(([f, fil]) => {
        setRows(f.items || f || [])
        setFiliais(fil.items || fil || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const filtrados = rows.filter((r) => {
    if (filterAtivo !== '' && String(r.ativo) !== filterAtivo) return false
    if (filterCategoria && r.categoria !== filterCategoria) return false
    if (filterBusca) {
      const q = filterBusca.toLowerCase()
      if (!(r.nome?.toLowerCase().includes(q) || r.cnpj?.toLowerCase().includes(q) || r.contato_nome?.toLowerCase().includes(q))) return false
    }
    return true
  })

  function openNew() {
    setForm({ ativo: true })
    setShowModal(true)
  }

  function openEdit(r) {
    setForm({ ...r })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.nome?.trim()) return
    setSaving(true)
    try {
      if (form.id) {
        await api.update('fornecedores', form.id, form)
      } else {
        await api.create('fornecedores', form)
      }
      setShowModal(false)
      carregar()
    } catch (e) {
      alert('Erro ao salvar: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  const filiaisMap = Object.fromEntries(filiais.map((f) => [f.id, f.cidade]))

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Cadastro</span>
          <h1>Fornecedores</h1>
          <p>Gerencie os fornecedores e prestadores de serviço</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Novo fornecedor</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder="Buscar por nome, CNPJ ou contato…"
          value={filterBusca}
          onChange={(e) => setFilterBusca(e.target.value)}
        />
        <select className="input" style={{ maxWidth: 160 }} value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)}>
          <option value="">Todas categorias</option>
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 130 }} value={filterAtivo} onChange={(e) => setFilterAtivo(e.target.value)}>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
          <option value="">Todos</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="surface-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando…</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Nenhum fornecedor encontrado.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11 }}>NOME</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11 }}>CNPJ / CPF</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11 }}>CATEGORIA</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11 }}>CONTATO</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11 }}>FILIAL</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11 }}>STATUS</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11 }}>DESDE</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={{ padding: '9px 14px', fontWeight: 600, color: '#1e293b' }}>
                      {r.nome}
                      {r.email && <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{r.email}</div>}
                    </td>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: '#334155' }}>{r.cnpj || '—'}</td>
                    <td style={{ padding: '9px 14px' }}>
                      {r.categoria ? (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>{r.categoria}</span>
                      ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 14px', color: '#475569', fontSize: 12 }}>
                      {r.contato_nome || '—'}
                      {r.telefone && <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.telefone}</div>}
                    </td>
                    <td style={{ padding: '9px 14px', color: '#475569', fontSize: 12 }}>{filiaisMap[r.filial_id] || '—'}</td>
                    <td style={{ padding: '9px 14px' }}><Badge ativo={r.ativo} /></td>
                    <td style={{ padding: '9px 14px', color: '#94a3b8', fontSize: 11 }}>{fmtDate(r.criado_em)}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => openEdit(r)}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
        {filtrados.length} fornecedor{filtrados.length !== 1 ? 'es' : ''} exibido{filtrados.length !== 1 ? 's' : ''}
      </div>

      {showModal && (
        <FormModal
          title={form.id ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          form={form}
          setForm={setForm}
          filiais={filiais}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          saving={saving}
        />
      )}
    </section>
  )
}

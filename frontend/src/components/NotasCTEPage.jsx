import { useEffect, useMemo, useState, useRef } from 'react'
import { api } from '../services/api'

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPO_OPTS = [
  { value: 'nota_fiscal', label: 'Nota Fiscal' },
  { value: 'cte', label: 'CT-e' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'fatura', label: 'Fatura' },
  { value: 'outro', label: 'Outro' },
]

const STATUS_OPTS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'pago', label: 'Pago' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'cancelado', label: 'Cancelado' },
]

const CATEGORIA_OPTS = [
  { value: 'servico', label: 'Serviço' },
  { value: 'produto', label: 'Produto' },
  { value: 'frete', label: 'Frete' },
  { value: 'pedido_compra', label: 'Pedido de compra' },
  { value: 'outro', label: 'Outro' },
]

const TIPO_LABELS    = Object.fromEntries(TIPO_OPTS.map((o) => [o.value, o.label]))
const STATUS_LABELS  = Object.fromEntries(STATUS_OPTS.map((o) => [o.value, o.label]))
const CATEG_LABELS   = Object.fromEntries(CATEGORIA_OPTS.map((o) => [o.value, o.label]))

function statusTone(status) {
  if (status === 'pago') return 'success'
  if (status === 'vencido') return 'danger'
  if (status === 'cancelado') return 'neutral'
  return 'warning'  // pendente
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayIso() { return new Date().toISOString().slice(0, 10) }

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = String(dateStr).split('-')
  return `${d}/${m}/${y}`
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

function isVencida(nota) {
  if (nota.status !== 'pendente') return false
  if (!nota.data_vencimento) return false
  return nota.data_vencimento < todayIso()
}

function resolvedStatus(nota) {
  if (nota.status === 'pendente' && isVencida(nota)) return 'vencido'
  return nota.status
}

function emptyForm() {
  return {
    filial_id: '',
    tipo: 'nota_fiscal',
    numero_documento: '',
    chave_acesso: '',
    emitente: '',
    destinatario: '',
    data_emissao: todayIso(),
    data_vencimento: '',
    data_pagamento: '',
    valor_total: '',
    descricao: '',
    status: 'pendente',
    categoria: 'outro',
    observacoes: '',
    ativo: true,
  }
}

// ─── Card de resumo ───────────────────────────────────────────────────────────

function ResumoCard({ label, valor, contagem, tone, icon }) {
  return (
    <div className={`notas-resumo-card tone-${tone}`}>
      <div className="notas-resumo-icon">{icon}</div>
      <div>
        <div className="notas-resumo-label">{label}</div>
        <div className="notas-resumo-valor">{formatCurrency(valor)}</div>
        {contagem != null && (
          <div className="notas-resumo-contagem">{contagem} {contagem === 1 ? 'nota' : 'notas'}</div>
        )}
      </div>
    </div>
  )
}

// ─── Modal de cadastro / edição ───────────────────────────────────────────────

function NotaModal({ nota, filiais, onSave, onClose }) {
  const [form, setForm] = useState(() =>
    nota
      ? { ...nota, filial_id: nota.filial_id != null ? String(nota.filial_id) : '' }
      : emptyForm()
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setField(f, v) { setForm((p) => ({ ...p, [f]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.filial_id) { setError('Selecione a filial.'); return }
    if (!form.valor_total) { setError('Informe o valor total.'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        filial_id: Number(form.filial_id),
        tipo: form.tipo || 'nota_fiscal',
        numero_documento: form.numero_documento.trim() || null,
        chave_acesso: form.chave_acesso.trim() || null,
        emitente: form.emitente.trim() || null,
        destinatario: form.destinatario.trim() || null,
        data_emissao: form.data_emissao || null,
        data_vencimento: form.data_vencimento || null,
        data_pagamento: form.data_pagamento || null,
        valor_total: parseFloat(String(form.valor_total).replace(',', '.')) || 0,
        descricao: form.descricao.trim() || null,
        status: form.status || 'pendente',
        categoria: form.categoria || 'outro',
        observacoes: form.observacoes.trim() || null,
        ativo: true,
      }
      if (nota?.id) {
        await api.update('notas_cte', nota.id, payload)
      } else {
        await api.create('notas_cte', payload)
      }
      onSave()
    } catch (err) {
      setError(err.message || 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{nota?.id ? 'Editar nota / CT-e' : 'Nova nota / CT-e'}</h2>
          <button className="button-secondary" onClick={onClose} type="button">✕</button>
        </div>

        {error && <div className="alert-error" style={{ marginBottom: 12 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* Linha 1 */}
            <label className="field">
              <span>Filial *</span>
              <select value={form.filial_id} onChange={(e) => setField('filial_id', e.target.value)} required>
                <option value="">Selecione...</option>
                {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Tipo de documento *</span>
              <select value={form.tipo} onChange={(e) => setField('tipo', e.target.value)}>
                {TIPO_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>

            {/* Linha 2 */}
            <label className="field">
              <span>Número do documento</span>
              <input type="text" placeholder="Ex.: NF-12345" value={form.numero_documento} onChange={(e) => setField('numero_documento', e.target.value)} />
            </label>

            <label className="field">
              <span>Categoria</span>
              <select value={form.categoria} onChange={(e) => setField('categoria', e.target.value)}>
                {CATEGORIA_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>

            {/* Linha 3 */}
            <label className="field">
              <span>Emitente (fornecedor)</span>
              <input type="text" placeholder="Quem emitiu a nota" value={form.emitente} onChange={(e) => setField('emitente', e.target.value)} />
            </label>

            <label className="field">
              <span>Destinatário / tomador</span>
              <input type="text" placeholder="Quem recebe / paga" value={form.destinatario} onChange={(e) => setField('destinatario', e.target.value)} />
            </label>

            {/* Linha 4 */}
            <label className="field">
              <span>Data de emissão</span>
              <input type="date" value={form.data_emissao} onChange={(e) => setField('data_emissao', e.target.value)} />
            </label>

            <label className="field">
              <span>Data de vencimento</span>
              <input type="date" value={form.data_vencimento} onChange={(e) => setField('data_vencimento', e.target.value)} />
            </label>

            {/* Linha 5 */}
            <label className="field">
              <span>Valor total (R$) *</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.valor_total}
                onChange={(e) => setField('valor_total', e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Status</span>
              <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
                {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>

            {form.status === 'pago' && (
              <label className="field">
                <span>Data do pagamento</span>
                <input type="date" value={form.data_pagamento} onChange={(e) => setField('data_pagamento', e.target.value)} />
              </label>
            )}

            {/* Chave / descrição */}
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Chave de acesso NF-e / CT-e</span>
              <input type="text" placeholder="44 dígitos (opcional)" maxLength={44} value={form.chave_acesso} onChange={(e) => setField('chave_acesso', e.target.value)} />
            </label>

            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Descrição / histórico</span>
              <input type="text" placeholder="Do que se trata esta nota..." value={form.descricao} onChange={(e) => setField('descricao', e.target.value)} />
            </label>

            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Observações</span>
              <textarea rows={2} value={form.observacoes} onChange={(e) => setField('observacoes', e.target.value)} style={{ resize: 'vertical' }} />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="button-primary" disabled={saving}>
              {saving ? 'Salvando...' : nota?.id ? 'Salvar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Linha de ação rápida (marcar como pago / cancelar) ──────────────────────

function AcoesRapidas({ nota, onRefresh }) {
  const [busy, setBusy] = useState(false)

  async function marcar(status, dataPagamento) {
    setBusy(true)
    try {
      await api.updateNotaStatus(nota.id, status, dataPagamento)
      onRefresh()
    } finally {
      setBusy(false)
    }
  }

  const status = resolvedStatus(nota)
  if (status === 'cancelado') return null

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {status !== 'pago' && (
        <button
          type="button"
          className="button-primary"
          style={{ fontSize: 11, padding: '2px 8px' }}
          disabled={busy}
          onClick={() => marcar('pago', todayIso())}
        >
          ✓ Quitar
        </button>
      )}
      {status !== 'cancelado' && (
        <button
          type="button"
          className="button-secondary"
          style={{ fontSize: 11, padding: '2px 8px', color: 'var(--danger,#c00)' }}
          disabled={busy}
          onClick={() => marcar('cancelado', null)}
        >
          Cancelar
        </button>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function NotasCTEPage() {
  const [filiais, setFiliais] = useState([])
  const [notas, setNotas] = useState([])
  const [resumo, setResumo] = useState(null)
  const [loading, setLoading] = useState(false)
  const _loaded = useRef(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [modalNota, setModalNota] = useState(null) // null | {} | {...nota}
  const [fFilial, setFFilial] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fBusca, setFBusca] = useState('')
  const [fVencMes, setFVencMes] = useState('')   // 'YYYY-MM'

  useEffect(() => {
    api.list('filiais', { ativo: true }).then(setFiliais).catch(() => {})
  }, [])

  useEffect(() => {
    if (filiais?.length === 1 && !fFilial) {
      setFFilial(String(filiais[0].id))
    }
  }, [filiais])

  useEffect(() => {
    let active = true
    if (!_loaded.current) setLoading(true)
    const params = { ativo: true }
    if (fFilial) params.filial_id = fFilial
    if (fStatus) params.status = fStatus
    if (fTipo) params.tipo = fTipo

    Promise.all([
      api.list('notas_cte', params),
      api.getNotasCteResumo({ filial_id: fFilial || undefined }),
    ])
      .then(([rows, res]) => {
        if (!active) return
        setNotas(rows || [])
        setResumo(res)
      })
      .catch(() => { if (active) setNotas([]) })
      .finally(() => { if (active) { _loaded.current = true; setLoading(false) } })

    return () => { active = false }
  }, [fFilial, fStatus, fTipo, refreshKey])

  const filtradas = useMemo(() => {
    let list = notas
    if (fVencMes) {
      list = list.filter((n) => n.data_vencimento?.startsWith(fVencMes))
    }
    const q = fBusca.trim().toLowerCase()
    if (!q) return list
    return list.filter((n) =>
      [n.numero_documento, n.emitente, n.destinatario, n.descricao, n.chave_acesso]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [notas, fBusca, fVencMes])

  function handleSaved() {
    setModalNota(null)
    setRefreshKey((k) => k + 1)
  }

  const mesAtual = todayIso().slice(0, 7)

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Financeiro</span>
          <h1>Notas Fiscais &amp; CT-e</h1>
          <p>Lance documentos fiscais, faturas e boletos pendentes de pagamento. Acompanhe vencimentos e quite direto pela lista.</p>
        </div>
        <button className="button-primary" type="button" onClick={() => setModalNota({})}>+ Nova nota / CT-e</button>
      </div>

      {/* Cards de resumo */}
      {resumo && (
        <div className="notas-resumo-grid">
          <ResumoCard
            label="Pendentes"
            valor={resumo.totais?.pendente || 0}
            contagem={resumo.contagem?.pendente}
            tone="warning"
            icon="⏳"
          />
          <ResumoCard
            label="Vencidas (em atraso)"
            valor={resumo.totais?.vencido || 0}
            contagem={resumo.contagem?.vencido}
            tone="danger"
            icon="🔴"
          />
          <ResumoCard
            label="Total em aberto"
            valor={resumo.totais?.total_pendente_vencido || 0}
            contagem={(resumo.contagem?.pendente || 0) + (resumo.contagem?.vencido || 0)}
            tone="info"
            icon="💰"
          />
          <ResumoCard
            label="Pagas"
            valor={resumo.totais?.pago || 0}
            contagem={resumo.contagem?.pago}
            tone="success"
            icon="✓"
          />
        </div>
      )}

      {/* Filtros */}
      <div className="surface-card" style={{ padding: '12px 16px', marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <label className="field filter-field">
            <span>Filial</span>
            <select value={fFilial} onChange={(e) => setFFilial(e.target.value)}>
              {filiais.length !== 1 && <option value="">Todas</option>}
              {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
            </select>
          </label>
          <label className="field filter-field">
            <span>Status</span>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="field filter-field">
            <span>Tipo</span>
            <select value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
              <option value="">Todos</option>
              {TIPO_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="field filter-field">
            <span>Vencimento (mês)</span>
            <input type="month" value={fVencMes} onChange={(e) => setFVencMes(e.target.value)} />
          </label>
          <label className="field filter-field" style={{ gridColumn: 'span 2' }}>
            <span>Buscar</span>
            <input
              type="text"
              placeholder="Número, emitente, destinatário, chave..."
              value={fBusca}
              onChange={(e) => setFBusca(e.target.value)}
            />
          </label>
        </div>
      </div>

      {/* Tabela */}
      <div className="surface-card">
        {loading ? (
          <div className="empty-state">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="empty-state">
            <strong>Nenhuma nota encontrada.</strong>
            <p>Clique em "+ Nova nota / CT-e" para começar.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="notas-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Número</th>
                  <th>Emitente</th>
                  <th>Descrição</th>
                  <th>Emissão</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Ações</th>
                  <th style={{ width: 60 }}>Editar</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((nota) => {
                  const statusResolvido = resolvedStatus(nota)
                  const vencAtrasada = statusResolvido === 'vencido'
                  return (
                    <tr key={nota.id} className={`notas-row${vencAtrasada ? ' notas-row-vencida' : ''}`}>
                      <td>
                        <span className="notas-tipo-chip">{TIPO_LABELS[nota.tipo] || nota.tipo}</span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{nota.numero_documento || <span style={{ color: '#bbb' }}>—</span>}</td>
                      <td>{nota.emitente || <span style={{ color: '#bbb' }}>—</span>}</td>
                      <td>
                        <span title={nota.descricao}>{nota.descricao ? (nota.descricao.length > 40 ? nota.descricao.slice(0, 40) + '…' : nota.descricao) : <span style={{ color: '#bbb' }}>—</span>}</span>
                        {nota.categoria && nota.categoria !== 'outro' && (
                          <small style={{ display: 'block', color: '#888', fontSize: 11 }}>{CATEG_LABELS[nota.categoria]}</small>
                        )}
                      </td>
                      <td>{formatDate(nota.data_emissao)}</td>
                      <td>
                        <span style={vencAtrasada ? { color: 'var(--danger,#c00)', fontWeight: 700 } : {}}>
                          {formatDate(nota.data_vencimento)}
                        </span>
                        {nota.data_pagamento && (
                          <small style={{ display: 'block', color: '#0d9488', fontSize: 11 }}>Pago: {formatDate(nota.data_pagamento)}</small>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(nota.valor_total)}</td>
                      <td>
                        <span className={`status-chip tone-${statusTone(statusResolvido)}`}>
                          {STATUS_LABELS[statusResolvido] || statusResolvido}
                        </span>
                      </td>
                      <td>
                        <AcoesRapidas nota={nota} onRefresh={() => setRefreshKey((k) => k + 1)} />
                      </td>
                      <td>
                        <button
                          className="button-secondary"
                          style={{ fontSize: 12, padding: '3px 10px' }}
                          type="button"
                          onClick={() => setModalNota(nota)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, padding: '8px 10px', borderTop: '2px solid #e5e7eb' }}>
                    Total exibido:
                  </td>
                  <td style={{ fontWeight: 700, padding: '8px 10px', borderTop: '2px solid #e5e7eb' }}>
                    {formatCurrency(filtradas.reduce((acc, n) => acc + Number(n.valor_total || 0), 0))}
                  </td>
                  <td colSpan={3} style={{ borderTop: '2px solid #e5e7eb' }} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {modalNota !== null && (
        <NotaModal
          nota={modalNota?.id ? modalNota : null}
          filiais={filiais}
          onSave={handleSaved}
          onClose={() => setModalNota(null)}
        />
      )}
    </section>
  )
}

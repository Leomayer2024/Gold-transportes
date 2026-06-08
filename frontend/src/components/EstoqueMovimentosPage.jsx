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
    valor_unitario: '',
    colaborador_id: '',
    fornecedor: '',
    numero_nota: '',
    motivo: '',
    data_movimento: todayIso(),
    observacoes: '',
  }
}

function formatBRL(v) {
  const n = Number(v) || 0
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

// Config por tipo: define quais campos aparecem no modal
const TIPO_CFG = {
  entrada:             { multi: true,  nota: true,  fornec: true,  valor: true,  colab: false, motivoReq: false },
  saida_fornecedor:    { multi: true,  nota: true,  fornec: true,  valor: true,  colab: false, motivoReq: false },
  saida_geral:         { multi: true,  nota: false, fornec: false, valor: false, colab: false, motivoReq: true  },
  saida_colaborador:   { multi: false, nota: false, fornec: false, valor: false, colab: true,  motivoReq: false },
  troca:               { multi: false, nota: false, fornec: false, valor: false, colab: true,  motivoReq: true  },
  ajuste_positivo:     { multi: false, nota: false, fornec: false, valor: false, colab: false, motivoReq: true  },
  ajuste_negativo:     { multi: false, nota: false, fornec: false, valor: false, colab: false, motivoReq: true  },
}

// ─── Modal de lançamento — modo NOTA (multi-itens) ────────────────────────────

function emptyLinha() {
  return { item_id: '', quantidade: '', valor_unitario: '', colaborador_id: '' }
}

function LancarNotaModal({ filiais, colaboradores, itens, filialId, preItemId, onSave, onClose }) {
  const { profile } = useAuth()
  const [tipo, setTipo] = useState('entrada')
  const [cab, setCab] = useState({
    filial_id: filialId || '',
    data_movimento: todayIso(),
    fornecedor: '',
    numero_nota: '',
    motivo: '',
    observacoes: '',
  })
  const [linhas, setLinhas] = useState(() => [{ ...emptyLinha(), item_id: preItemId || '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Indica se há algo preenchido pelo usuário (além dos defaults)
  function isDirty() {
    if (cab.fornecedor.trim() || cab.numero_nota.trim() || cab.motivo.trim() || cab.observacoes.trim()) return true
    if (linhas.some(l => l.item_id || l.quantidade || l.valor_unitario || l.colaborador_id)) return true
    return false
  }

  function tryClose() {
    if (isDirty()) {
      if (!window.confirm('Você tem dados preenchidos. Deseja realmente sair sem salvar?')) return
    }
    onClose()
  }

  const cfg = TIPO_CFG[tipo] || TIPO_CFG.entrada
  const isMulti = cfg.multi
  const tipoInfo = TIPO_OPTS.find(o => o.value === tipo)

  // Quando muda tipo de multi pra single, mantém só 1 linha
  useEffect(() => {
    if (!isMulti && linhas.length > 1) setLinhas([linhas[0]])
  }, [tipo])

  const itensFilial = useMemo(
    () => itens.filter(i => !cab.filial_id || String(i.filial_id) === String(cab.filial_id)),
    [itens, cab.filial_id],
  )
  const colabsFilial = useMemo(
    () => colaboradores.filter(c => !cab.filial_id || String(c.filial_id) === String(cab.filial_id)),
    [colaboradores, cab.filial_id],
  )

  function setC(k, v) { setCab(prev => ({ ...prev, [k]: v })) }
  function setL(idx, k, v) {
    setLinhas(prev => prev.map((l, i) => i === idx ? { ...l, [k]: v } : l))
  }
  function addLinha() { setLinhas(prev => [...prev, emptyLinha()]) }
  function remLinha(idx) { setLinhas(prev => prev.filter((_, i) => i !== idx)) }

  const totalGeral = useMemo(() => {
    return linhas.reduce((sum, l) => {
      const q = parseFloat(String(l.quantidade).replace(',', '.')) || 0
      const v = parseFloat(String(l.valor_unitario).replace(',', '.')) || 0
      return sum + (q * v)
    }, 0)
  }, [linhas])

  async function salvar(e) {
    e.preventDefault()
    setError('')
    if (!cab.filial_id) return setError('Selecione a base.')

    const linhasValid = linhas.filter(l => l.item_id && parseFloat(String(l.quantidade).replace(',', '.')) > 0)
    if (linhasValid.length === 0) return setError('Adicione pelo menos 1 item com quantidade.')

    if (cfg.colab) {
      const semColab = linhasValid.find(l => !l.colaborador_id)
      if (semColab) return setError('Selecione o colaborador.')
    }
    if (cfg.motivoReq && !cab.motivo.trim()) {
      return setError('Informe o motivo para este tipo de movimento.')
    }

    setSaving(true)
    try {
      const payload = {
        cabecalho: {
          filial_id: Number(cab.filial_id),
          tipo,
          data_movimento: cab.data_movimento || todayIso(),
          fornecedor: cab.fornecedor.trim() || null,
          numero_nota: cab.numero_nota.trim() || null,
          motivo: cab.motivo.trim() || null,
          observacoes: cab.observacoes.trim() || null,
          registrado_por: profile?.colaborador_id || profile?.id || null,
        },
        itens: linhasValid.map(l => ({
          item_id: Number(l.item_id),
          quantidade: parseFloat(String(l.quantidade).replace(',', '.')),
          valor_unitario: l.valor_unitario ? parseFloat(String(l.valor_unitario).replace(',', '.')) : null,
          colaborador_id: l.colaborador_id ? Number(l.colaborador_id) : null,
        })),
      }
      const resp = await api.criarMovimentoEstoqueBatch(payload)
      if (resp?.erros && resp.erros.length > 0) {
        setError(`Lançadas ${resp.criados?.length || 0} linhas. ${resp.erros.length} falharam: ${resp.erros.map(e => `L${e.linha}: ${e.erro}`).join('; ')}`)
        if (resp.criados?.length > 0) onSave()
      } else {
        onSave()
      }
    } catch (err) {
      setError(err.message || 'Erro ao lançar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={tryClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px', overflowY: 'auto',
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: 880, width: '100%',
          background: '#fff', borderRadius: 12,
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
          padding: 24,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">Estoque</span>
            <h2>{isMulti ? 'Lançar nota / movimento' : 'Lançar movimento'}</h2>
          </div>
          <button className="button-secondary" onClick={tryClose} type="button">Fechar</button>
        </div>

        <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="inline-error">{error}</div>}

          {/* Tipo */}
          <label className="form-label">Tipo de movimento *
            <select className="form-input" value={tipo} onChange={e => setTipo(e.target.value)}>
              {TIPO_OPTS.map(o => <option key={o.value} value={o.value}>{o.icon} {o.label}</option>)}
            </select>
          </label>

          {tipoInfo && (
            <div style={{ background: 'var(--surface-alt, #f6f8fa)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text-muted)', borderLeft: `3px solid ${tipoInfo.cor}` }}>
              {tipoInfo.desc}
              {isMulti && <span style={{ marginLeft: 8, fontWeight: 600, color: tipoInfo.cor }}>· Modo nota (vários itens)</span>}
            </div>
          )}

          {/* Cabeçalho */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <label className="form-label">Base *
              <select className="form-input" value={cab.filial_id} onChange={e => setC('filial_id', e.target.value)} required>
                <option value="">Selecione...</option>
                {filiais.map(f => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
              </select>
            </label>
            <label className="form-label">Data *
              <input className="form-input" type="date" value={cab.data_movimento} onChange={e => setC('data_movimento', e.target.value)} required />
            </label>
            {cfg.nota && (
              <label className="form-label">Nº nota / pedido
                <input className="form-input" value={cab.numero_nota} onChange={e => setC('numero_nota', e.target.value)} placeholder="NF-001..." />
              </label>
            )}
            {cfg.fornec && (
              <label className="form-label">Fornecedor
                <input className="form-input" value={cab.fornecedor} onChange={e => setC('fornecedor', e.target.value)} placeholder="Nome..." />
              </label>
            )}
            <label className="form-label">Motivo {cfg.motivoReq && '*'}
              <input className="form-input" value={cab.motivo} onChange={e => setC('motivo', e.target.value)} placeholder="Motivo resumido..." required={cfg.motivoReq} />
            </label>
          </div>

          {/* Linhas de itens */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ fontSize: 13 }}>Itens {isMulti && `(${linhas.length})`}</strong>
              {isMulti && (
                <button className="button-secondary" type="button" onClick={addLinha} style={{ fontSize: 12 }}>
                  + Adicionar item
                </button>
              )}
            </div>

            {(() => {
              // Define colunas dinamicamente
              const cols = []
              cols.push({ key: 'item', label: 'Item', size: 'minmax(180px, 2.5fr)' })
              cols.push({ key: 'qtd', label: 'Qtd', size: '100px', align: 'right' })
              if (cfg.valor) cols.push({ key: 'val', label: 'Val. un.', size: '110px', align: 'right' })
              if (cfg.colab) cols.push({ key: 'colab', label: 'Colaborador', size: 'minmax(140px, 1.6fr)' })
              if (cfg.valor) cols.push({ key: 'total', label: 'Total', size: '110px', align: 'right' })
              cols.push({ key: 'del', label: '', size: '36px' })
              const gridCols = cols.map(c => c.size).join(' ')

              return (
                <div style={{ border: '1px solid var(--border, #e2e7ed)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: gridCols, gap: 0,
                    background: 'var(--surface-alt, #f6f8fa)', padding: '6px 8px',
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    color: 'var(--text-muted)', letterSpacing: 0.3,
                  }}>
                    {cols.map(c => (
                      <div key={c.key} style={{ textAlign: c.align || 'left' }}>{c.label}</div>
                    ))}
                  </div>

                  {linhas.map((l, idx) => {
                    const item = itens.find(i => String(i.id) === String(l.item_id))
                    const qtd = parseFloat(String(l.quantidade).replace(',', '.')) || 0
                    const valUni = parseFloat(String(l.valor_unitario).replace(',', '.')) || 0
                    const total = qtd * valUni
                    const saldoAtual = item ? parseFloat(item.estoque_atual) || 0 : null
                    const saldoApos = saldoAtual !== null && qtd > 0
                      ? (TIPOS_QUE_SAEM.has(tipo) ? saldoAtual - qtd : saldoAtual + qtd)
                      : null

                    return (
                      <div key={idx} style={{
                        display: 'grid', gridTemplateColumns: gridCols, gap: 6,
                        padding: '8px',
                        borderTop: idx > 0 ? '1px solid var(--border, #eef0f3)' : 'none',
                        alignItems: 'center',
                      }}>
                        <div>
                          <select
                            className="form-input" value={l.item_id}
                            onChange={e => setL(idx, 'item_id', e.target.value)}
                            style={{ width: '100%' }}
                          >
                            <option value="">Selecione...</option>
                            {itensFilial.map(i => (
                              <option key={i.id} value={i.id}>
                                {i.nome}{i.codigo ? ` [${i.codigo}]` : ''} (saldo: {formatQtd(i.estoque_atual, i.unidade)})
                              </option>
                            ))}
                          </select>
                          {saldoApos !== null && saldoApos < 0 && (
                            <div style={{ fontSize: 10, color: '#c62828', marginTop: 2 }}>⚠ saldo após: {formatQtd(saldoApos, item?.unidade)}</div>
                          )}
                        </div>
                        <input
                          className="form-input" type="number" min="0.001" step="0.001"
                          value={l.quantidade} onChange={e => setL(idx, 'quantidade', e.target.value)}
                          placeholder="0" style={{ textAlign: 'right' }}
                        />
                        {cfg.valor && (
                          <input
                            className="form-input" type="number" min="0" step="0.01"
                            value={l.valor_unitario} onChange={e => setL(idx, 'valor_unitario', e.target.value)}
                            placeholder="0,00" style={{ textAlign: 'right' }}
                          />
                        )}
                        {cfg.colab && (
                          <select
                            className="form-input" value={l.colaborador_id}
                            onChange={e => setL(idx, 'colaborador_id', e.target.value)}
                          >
                            <option value="">Selecione...</option>
                            {colabsFilial.map(c => <option key={c.id} value={c.id}>{c.nome_completo}</option>)}
                          </select>
                        )}
                        {cfg.valor && (
                          <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>
                            {total > 0 ? formatBRL(total) : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}
                          </div>
                        )}
                        <button
                          type="button" onClick={() => remLinha(idx)}
                          disabled={linhas.length === 1} title="Remover linha"
                          style={{
                            background: 'none', border: 'none',
                            color: linhas.length === 1 ? '#ccc' : '#c62828',
                            cursor: linhas.length === 1 ? 'not-allowed' : 'pointer',
                            fontSize: 18, padding: 4,
                          }}
                        >×</button>
                      </div>
                    )
                  })}

                  {cfg.valor && totalGeral > 0 && (
                    <div style={{
                      display: 'flex', justifyContent: 'flex-end', gap: 12,
                      padding: '8px 12px', background: 'var(--surface-alt, #f6f8fa)',
                      borderTop: '1px solid var(--border, #e2e7ed)', fontSize: 13,
                    }}>
                      <span style={{ color: 'var(--text-muted)' }}>Total geral:</span>
                      <strong style={{ color: '#1a7f37' }}>{formatBRL(totalGeral)}</strong>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Observações */}
          <label className="form-label">Observações
            <textarea className="form-input" rows={2} value={cab.observacoes} onChange={e => setC('observacoes', e.target.value)} />
          </label>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="button-secondary" type="button" onClick={tryClose}>Cancelar</button>
            <button className="button-primary" type="submit" disabled={saving}>
              {saving ? 'Lançando...' : `Confirmar ${linhas.length > 1 ? `(${linhas.length} itens)` : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal antigo (mantido pra referência) ────────────────────────────────────

function LancarModal_OLD({ filiais, colaboradores, itens, filialId, preItemId, preItemNome, onSave, onClose }) {
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
      const valUni = parseFloat(String(form.valor_unitario).replace(',', '.'))
      const payload = {
        filial_id: Number(form.filial_id),
        item_id: Number(form.item_id),
        tipo: form.tipo,
        quantidade: qty,
        valor_unitario: !isNaN(valUni) && valUni >= 0 ? valUni : null,
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
            <label className="form-label">Valor unitário (R$)
              <input
                className="form-input"
                type="number"
                min="0"
                step="0.01"
                value={form.valor_unitario}
                onChange={(e) => set('valor_unitario', e.target.value)}
                placeholder="0,00"
              />
            </label>
          </div>

          {(saldoAtual !== null || (parseFloat(String(form.valor_unitario).replace(',', '.')) > 0 && qtdNum > 0)) && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 10, padding: 12, background: 'var(--surface-alt, #f6f8fa)',
              borderRadius: 8, fontSize: 13,
            }}>
              {saldoAtual !== null && (
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Saldo atual</div>
                  <strong>{formatQtd(saldoAtual, itemSelecionado?.unidade)}</strong>
                </div>
              )}
              {saldoApos !== null && (
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Saldo após</div>
                  <strong style={{ color: saldoApos < 0 ? '#c62828' : undefined }}>
                    {formatQtd(saldoApos, itemSelecionado?.unidade)}
                    {saldoApos < 0 && ' ⚠'}
                  </strong>
                </div>
              )}
              {parseFloat(String(form.valor_unitario).replace(',', '.')) > 0 && qtdNum > 0 && (
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Valor total</div>
                  <strong style={{ color: '#1a7f37' }}>
                    {formatBRL(parseFloat(String(form.valor_unitario).replace(',', '.')) * qtdNum)}
                  </strong>
                </div>
              )}
            </div>
          )}

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
  const _loaded = useRef(false)

  useEffect(() => {
    if (filiais?.length === 1 && !filterFilial) {
      setFilterFilial(String(filiais[0].id))
    }
  }, [filiais])
  const [error, setError] = useState('')
  const [filterFilial, setFilterFilial] = useState('')
  const [filterItem, setFilterItem] = useState(preItem.itemId ? String(preItem.itemId) : '')
  const [filterTipo, setFilterTipo] = useState('')
  const [showModal, setShowModal] = useState(Boolean(preItem.abrirLancar))

  async function loadBase() {
    if (!_loaded.current) setLoading(true)
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
      _loaded.current = true
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
          {filiais.length !== 1 && <option value="">Todas as bases</option>}
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
                <th style={{ textAlign: 'right' }}>Valor un.</th>
                <th style={{ textAlign: 'right' }}>Valor total</th>
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
                  <td style={{ textAlign: 'right' }}>
                    {row.valor_unitario != null ? formatBRL(row.valor_unitario) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {row.valor_total != null ? formatBRL(row.valor_total) : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}
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
        <LancarNotaModal
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

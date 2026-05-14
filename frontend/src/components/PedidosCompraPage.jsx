import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../services/api'

// ─── Constantes ───────────────────────────────────────────────────────────────

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

const PAGAMENTO_OPTS = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_debito', label: 'Cartão débito' },
  { value: 'cartao_credito', label: 'Cartão crédito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'credito_fornecedor', label: 'Crédito fornecedor' },
]

const STATUS_OPTS = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'pendente_aprovacao', label: 'Pendente aprovação' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'em_compra', label: 'Em compra' },
  { value: 'recebido', label: 'Recebido' },
  { value: 'cancelado', label: 'Cancelado' },
]

const STATUS_FLOW = ['rascunho', 'pendente_aprovacao', 'aprovado', 'em_compra', 'recebido']
const STATUS_LABELS = Object.fromEntries(STATUS_OPTS.map((o) => [o.value, o.label]))
const CATEGORIA_LABELS = Object.fromEntries(CATEGORIA_OPTS.map((o) => [o.value, o.label]))
const PAGAMENTO_LABELS = Object.fromEntries(PAGAMENTO_OPTS.map((o) => [o.value, o.label]))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function emptyItem() {
  return {
    _key: `k-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    id: null,
    categoria: 'outro',
    descricao: '',
    quantidade: 1,
    unidade: 'un',
    valor_unitario: '',
    observacoes: '',
  }
}

function emptyForm() {
  return {
    filial_id: '',
    data_pedido: todayIso(),
    data_necessidade: '',
    fornecedor: '',
    forma_pagamento: '',
    prazo_pagamento: '',
    centro_custo: '',
    criado_por: '',
    status: 'rascunho',
    observacoes: '',
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const parts = String(dateStr).split('-')
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function statusTone(status) {
  if (status === 'aprovado' || status === 'recebido') return 'success'
  if (status === 'cancelado') return 'danger'
  if (status === 'em_compra') return 'warning'
  return 'neutral'
}

function itemTotal(item) {
  const qty = parseFloat(String(item.quantidade).replace(',', '.')) || 0
  const price = parseFloat(String(item.valor_unitario).replace(',', '.')) || 0
  return qty * price
}

// ─── PDF via impressão do browser ────────────────────────────────────────────

function PrintablePedido({ data, onClose }) {
  const { pedido, filial, criado_por_nome, criado_por_cargo, itens, valor_total } = data
  const printRef = useRef(null)

  function handlePrint() {
    const html = printRef.current?.innerHTML
    if (!html) return
    const w = window.open('', '_blank', 'width=900,height=700')
    w.document.write(
      '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>' +
      '<title>Pedido ' + (pedido.numero_pedido || '') + '</title>' +
      '<style>' +
      '*{box-sizing:border-box;margin:0;padding:0}' +
      'body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111;padding:24px}' +
      '.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}' +
      '.sec{font-size:9px;font-weight:700;text-transform:uppercase;color:#555;border-bottom:1px solid #ddd;padding-bottom:3px;margin:12px 0 8px}' +
      '.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 16px;margin-bottom:16px}' +
      '.gi label{display:block;font-size:9px;text-transform:uppercase;color:#777}' +
      '.gi span{font-size:11px;font-weight:600}' +
      'table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:16px}' +
      'th{background:#111;color:#fff;text-align:left;padding:5px 8px}' +
      'td{padding:5px 8px;border-bottom:1px solid #eee;vertical-align:top}' +
      'tr:nth-child(even) td{background:#f9f9f9}' +
      '.tf td{font-weight:700;font-size:12px;background:#f0f0f0!important;border-top:2px solid #111}' +
      '.r{text-align:right}' +
      '.assin{margin-top:40px;display:flex;justify-content:space-around;font-size:10px}' +
      '.al{text-align:center}.al-linha{border-top:1px solid #999;width:200px;margin:0 auto 4px}' +
      '.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;background:#eee}' +
      '.rod{margin-top:24px;font-size:9px;color:#aaa;text-align:center}' +
      '@media print{body{padding:12px}}' +
      '</style></head><body>' + html +
      '<script>window.onload=function(){window.print()}<\/script></body></html>'
    )
    w.document.close()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 820, maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">Pré-visualização</span>
            <h2>{pedido.numero_pedido || 'Pedido de compra'}</h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="button-primary" onClick={handlePrint} type="button">Imprimir / Salvar PDF</button>
            <button className="button-secondary" onClick={onClose} type="button">Fechar</button>
          </div>
        </div>

        <div ref={printRef}>
          <div className="hdr" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #111', paddingBottom: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>PEDIDO DE COMPRA</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                {(filial || {}).parceira || 'Gold Transportes'} — {(filial || {}).cidade || ''}/{(filial || {}).uf || ''}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong style={{ fontSize: 16 }}>{pedido.numero_pedido || '-'}</strong>
              <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>Data: {formatDate(pedido.data_pedido)}</div>
              {pedido.data_necessidade && (
                <div style={{ fontSize: 11, color: '#c00' }}>Necessário até: {formatDate(pedido.data_necessidade)}</div>
              )}
              <div style={{ marginTop: 4 }}>
                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 9, fontWeight: 700, background: '#eee' }}>
                  {STATUS_LABELS[pedido.status] || pedido.status}
                </span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#555', borderBottom: '1px solid #ddd', paddingBottom: 3, marginBottom: 8 }}>
            Informações do pedido
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px 16px', marginBottom: 16 }}>
            {[
              { l: 'Fornecedor', v: pedido.fornecedor || '-' },
              { l: 'Forma de pagamento', v: PAGAMENTO_LABELS[pedido.forma_pagamento] || pedido.forma_pagamento || '-' },
              { l: 'Prazo de pagamento', v: pedido.prazo_pagamento || '-' },
              { l: 'Centro de custo', v: pedido.centro_custo || '-' },
              { l: 'Solicitado por', v: criado_por_nome || '-' },
              { l: 'Cargo', v: criado_por_cargo || '-' },
            ].map(({ l, v }) => (
              <div key={l}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#777' }}>{l}</div>
                <div style={{ fontSize: 11, fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#555', borderBottom: '1px solid #ddd', paddingBottom: 3, marginBottom: 8 }}>
            Itens do pedido
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginBottom: 16 }}>
            <thead>
              <tr style={{ background: '#111', color: '#fff' }}>
                {['#', 'Categoria', 'Descrição', 'Qtd', 'Un.', 'Valor unit.', 'Total'].map((h) => (
                  <th key={h} style={{ padding: '5px 8px', textAlign: ['Total', 'Qtd', 'Valor unit.'].includes(h) ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(itens || []).map((item, idx) => (
                <tr key={item.id || idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid #eee' }}>{idx + 1}</td>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid #eee' }}>{CATEGORIA_LABELS[item.categoria] || item.categoria}</td>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid #eee' }}>
                    {item.descricao}
                    {item.observacoes && <div style={{ fontSize: 9, color: '#777' }}>{item.observacoes}</div>}
                  </td>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{Number(item.quantidade).toLocaleString('pt-BR')}</td>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid #eee' }}>{item.unidade}</td>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatCurrency(item.valor_unitario)}</td>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.valor_total != null ? item.valor_total : itemTotal(item))}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, background: '#f0f0f0' }}>
                <td colSpan={6} style={{ padding: '6px 8px', borderTop: '2px solid #111', fontSize: 11 }}>TOTAL GERAL</td>
                <td style={{ padding: '6px 8px', borderTop: '2px solid #111', textAlign: 'right', fontSize: 13 }}>{formatCurrency(valor_total)}</td>
              </tr>
            </tbody>
          </table>

          {pedido.observacoes && (
            <div style={{ marginBottom: 16, fontSize: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#777', marginBottom: 3 }}>Observações</div>
              {pedido.observacoes}
            </div>
          )}

          <div style={{ marginTop: 48, display: 'flex', justifyContent: 'space-around', fontSize: 10 }}>
            {[
              { label: 'Solicitante', name: criado_por_nome, cargo: criado_por_cargo },
              { label: 'Aprovação', name: '', cargo: '' },
              { label: 'Financeiro', name: '', cargo: '' },
            ].map(({ label, name, cargo }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #999', width: 180, margin: '0 auto 4px' }} />
                <div style={{ fontWeight: 700 }}>{label}</div>
                {name && <div style={{ color: '#555' }}>{name}</div>}
                {cargo && <div style={{ color: '#777', fontSize: 9 }}>{cargo}</div>}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, fontSize: 9, color: '#aaa', textAlign: 'center' }}>
            Documento gerado em {new Date().toLocaleDateString('pt-BR')} — Sistema SEG Gold Transportes
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Linha de item (tabela inline) ───────────────────────────────────────────

function ItemRow({ item, onChange, onRemove, isOnly }) {
  const total = itemTotal(item)
  return (
    <tr className="pedido-item-row">
      <td>
        <select className="pedido-item-sel" value={item.categoria} onChange={(e) => onChange('categoria', e.target.value)}>
          {CATEGORIA_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>
      <td>
        <input
          className="pedido-item-inp"
          type="text"
          placeholder="Descrição do item"
          value={item.descricao}
          onChange={(e) => onChange('descricao', e.target.value)}
        />
      </td>
      <td>
        <input
          className="pedido-item-inp pedido-num"
          type="number"
          min="0"
          step="0.001"
          placeholder="1"
          value={item.quantidade}
          onChange={(e) => onChange('quantidade', e.target.value)}
        />
      </td>
      <td>
        <select className="pedido-item-sel pedido-un" value={item.unidade} onChange={(e) => onChange('unidade', e.target.value)}>
          {UNIDADE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.value}</option>)}
        </select>
      </td>
      <td>
        <input
          className="pedido-item-inp pedido-num"
          type="number"
          min="0"
          step="0.01"
          placeholder="0,00"
          value={item.valor_unitario}
          onChange={(e) => onChange('valor_unitario', e.target.value)}
        />
      </td>
      <td className="pedido-item-tot">
        {total > 0 ? <strong>{formatCurrency(total)}</strong> : <span style={{ color: '#bbb' }}>—</span>}
      </td>
      <td>
        <input
          className="pedido-item-inp"
          type="text"
          placeholder="Obs."
          value={item.observacoes}
          onChange={(e) => onChange('observacoes', e.target.value)}
        />
      </td>
      <td>
        <button
          type="button"
          className="pedido-item-rm"
          onClick={onRemove}
          disabled={isOnly}
          title={isOnly ? 'Ao menos 1 item obrigatório' : 'Remover este item'}
        >
          ✕
        </button>
      </td>
    </tr>
  )
}

// ─── Formulário unificado: pedido + itens ─────────────────────────────────────

function FormularioPedido({ pedidoInicial, itensIniciais, onSaved, onCancel }) {
  const [form, setForm] = useState(() => ({
    ...emptyForm(),
    ...(pedidoInicial || {}),
    filial_id: pedidoInicial?.filial_id != null ? String(pedidoInicial.filial_id) : '',
    criado_por: pedidoInicial?.criado_por != null ? String(pedidoInicial.criado_por) : '',
  }))
  const [itens, setItens] = useState(() =>
    itensIniciais?.length
      ? itensIniciais.map((it) => ({ ...it, _key: 'e-' + it.id }))
      : [emptyItem()]
  )
  const [deletedIds, setDeletedIds] = useState([])
  const [filiais, setFiliais] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEditing = Boolean(pedidoInicial?.id)

  useEffect(() => {
    api.list('filiais', { ativo: true }).then(setFiliais).catch(() => {})
  }, [])

  useEffect(() => {
    if (!form.filial_id) { setColaboradores([]); return }
    api.list('colaboradores', { ativo: true, filial_id: form.filial_id }).then(setColaboradores).catch(() => {})
  }, [form.filial_id])

  const grandTotal = useMemo(() => itens.reduce((acc, it) => acc + itemTotal(it), 0), [itens])

  function setField(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'filial_id') next.criado_por = ''
      return next
    })
  }

  function addItem() { setItens((prev) => [...prev, emptyItem()]) }

  function removeItem(key, existingId) {
    if (existingId) setDeletedIds((prev) => [...prev, existingId])
    setItens((prev) => prev.filter((it) => it._key !== key))
  }

  function updateItem(key, field, value) {
    setItens((prev) => prev.map((it) => it._key === key ? { ...it, [field]: value } : it))
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    if (!form.filial_id) { setError('Selecione a filial.'); return }
    const itensValidos = itens.filter((it) => it.descricao.trim())
    if (!itensValidos.length) { setError('Adicione ao menos 1 item com descrição.'); return }

    setSaving(true)
    try {
      let orderId = pedidoInicial?.id
      const payload = {
        filial_id: Number(form.filial_id),
        data_pedido: form.data_pedido || todayIso(),
        data_necessidade: form.data_necessidade || null,
        fornecedor: form.fornecedor || null,
        forma_pagamento: form.forma_pagamento || null,
        prazo_pagamento: form.prazo_pagamento || null,
        centro_custo: form.centro_custo || null,
        criado_por: form.criado_por ? Number(form.criado_por) : null,
        status: form.status || 'rascunho',
        observacoes: form.observacoes || null,
        ativo: true,
      }

      if (isEditing) {
        await api.update('pedidos_compra', orderId, payload)
      } else {
        const created = await api.create('pedidos_compra', payload)
        orderId = created?.id
      }
      if (!orderId) throw new Error('Falha ao obter ID do pedido.')

      await Promise.all(deletedIds.map((id) => api.remove('pedidos_compra_itens', id)))

      await Promise.all(
        itensValidos.map((item) => {
          const ip = {
            filial_id: Number(form.filial_id),
            pedido_id: orderId,
            categoria: item.categoria || 'outro',
            descricao: item.descricao.trim(),
            quantidade: parseFloat(String(item.quantidade).replace(',', '.')) || 1,
            unidade: item.unidade || 'un',
            valor_unitario: parseFloat(String(item.valor_unitario).replace(',', '.')) || 0,
            observacoes: item.observacoes || null,
            ativo: true,
          }
          return item.id ? api.update('pedidos_compra_itens', item.id, ip) : api.create('pedidos_compra_itens', ip)
        })
      )

      onSaved(orderId)
    } catch (err) {
      setError(err.message || 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const filialAtual = filiais.find((f) => String(f.id) === String(form.filial_id))

  return (
    <div className="surface-card" style={{ padding: '24px 20px' }}>
      {/* Cabeçalho do formulário */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <span className="eyebrow">
            {isEditing ? `Editando — ${pedidoInicial.numero_pedido || '#' + pedidoInicial.id}` : 'Novo pedido de compra'}
          </span>
          <h2 style={{ margin: '4px 0 0' }}>
            {filialAtual ? `${filialAtual.cidade}/${filialAtual.uf}` : 'Selecione a filial para começar'}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="button-secondary" onClick={onCancel} disabled={saving}>← Voltar</button>
          <button type="submit" form="pedido-form" className="button-primary" disabled={saving}>
            {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : '✓ Criar pedido'}
          </button>
        </div>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <form id="pedido-form" onSubmit={handleSave}>
        {/* ── Campos do pedido ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px 16px', marginBottom: 16 }}>
          <label className="field">
            <span>Filial *</span>
            <select value={form.filial_id} onChange={(e) => setField('filial_id', e.target.value)} required>
              <option value="">Selecione...</option>
              {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
            </select>
          </label>

          <label className="field">
            <span>Fornecedor</span>
            <input
              type="text"
              list="dl-fornecedores"
              placeholder="Nome do fornecedor ou loja"
              value={form.fornecedor}
              onChange={(e) => setField('fornecedor', e.target.value)}
            />
            <datalist id="dl-fornecedores">
              {['Makro', 'Atacadão', 'Leroy Merlin', 'Localfrio', 'Sodexo', 'Posto Shell'].map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>

          <label className="field">
            <span>Data do pedido</span>
            <input type="date" value={form.data_pedido} onChange={(e) => setField('data_pedido', e.target.value)} />
          </label>

          <label className="field">
            <span>Precisa até</span>
            <input
              type="date"
              value={form.data_necessidade}
              min={form.data_pedido || todayIso()}
              onChange={(e) => setField('data_necessidade', e.target.value)}
            />
          </label>

          <label className="field">
            <span>Forma de pagamento</span>
            <select value={form.forma_pagamento} onChange={(e) => setField('forma_pagamento', e.target.value)}>
              <option value="">Selecione...</option>
              {PAGAMENTO_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          <label className="field">
            <span>Prazo de pagamento</span>
            <input
              type="text"
              list="dl-prazos"
              placeholder="Ex.: à vista, 30 dias"
              value={form.prazo_pagamento}
              onChange={(e) => setField('prazo_pagamento', e.target.value)}
            />
            <datalist id="dl-prazos">
              {['À vista', '15 dias', '30 dias', '45 dias', '30/60 dias', '15/30/45 dias'].map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>

          <label className="field">
            <span>Centro de custo</span>
            <input
              type="text"
              list="dl-centros"
              placeholder="Ex.: manutenção, limpeza"
              value={form.centro_custo}
              onChange={(e) => setField('centro_custo', e.target.value)}
            />
            <datalist id="dl-centros">
              {['Manutenção', 'Limpeza', 'Operação', 'Administrativo', 'EPI', 'Uniforme', 'Alimentação'].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label className="field">
            <span>Solicitado por</span>
            <select
              value={form.criado_por}
              onChange={(e) => setField('criado_por', e.target.value)}
              disabled={!form.filial_id}
            >
              <option value="">{form.filial_id ? 'Selecione...' : 'Selecione a filial primeiro'}</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>{c.nome_completo}{c.cargo ? ` — ${c.cargo}` : ''}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Status</span>
            <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
              {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <label className="field" style={{ marginBottom: 20, display: 'block' }}>
          <span>Observações gerais</span>
          <textarea
            rows={2}
            placeholder="Instruções, urgência, contexto do pedido..."
            value={form.observacoes}
            onChange={(e) => setField('observacoes', e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </label>

        {/* ── Tabela de itens ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <strong style={{ fontSize: 14 }}>Itens do pedido</strong>
          <span style={{ fontSize: 12, color: '#888' }}>{itens.length} {itens.length === 1 ? 'item' : 'itens'}</span>
          {grandTotal > 0 && (
            <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 15, color: 'var(--accent, #1a73e8)' }}>
              Total: {formatCurrency(grandTotal)}
            </span>
          )}
        </div>

        <div className="table-wrap" style={{ marginBottom: 10 }}>
          <table className="pedido-itens-table">
            <thead>
              <tr>
                <th style={{ minWidth: 130 }}>Categoria</th>
                <th>Descrição</th>
                <th style={{ width: 70 }}>Qtd</th>
                <th style={{ width: 60 }}>Un.</th>
                <th style={{ width: 110 }}>Valor unit.</th>
                <th style={{ width: 105 }}>Total</th>
                <th>Obs. do item</th>
                <th style={{ width: 32 }} />
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <ItemRow
                  key={item._key}
                  item={item}
                  isOnly={itens.length === 1}
                  onChange={(field, value) => updateItem(item._key, field, value)}
                  onRemove={() => removeItem(item._key, item.id)}
                />
              ))}
            </tbody>
            {grandTotal > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, paddingRight: 8, fontSize: 13 }}>
                    Total do pedido:
                  </td>
                  <td style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent, #1a73e8)', paddingLeft: 8 }}>
                    {formatCurrency(grandTotal)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <button type="button" className="button-secondary" onClick={addItem}>
          + Adicionar item
        </button>
      </form>
    </div>
  )
}

// ─── Painel de itens expandido na lista ──────────────────────────────────────

function PedidoExpandido({ pedidoId, onShowPdf }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setData(null)
    setLoading(true)
    api.getPedidoDetalhes(pedidoId)
      .then((d) => { if (active) setData(d) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [pedidoId])

  if (loading) {
    return (
      <div style={{ padding: '12px 20px', color: '#888', fontSize: 13 }}>Carregando itens...</div>
    )
  }
  if (!data) return null

  const byCategoria = {}
  for (const item of (data.itens || [])) {
    const cat = CATEGORIA_LABELS[item.categoria] || item.categoria
    byCategoria[cat] = (byCategoria[cat] || 0) + Number(item.valor_total || 0)
  }

  return (
    <div className="pedido-expand-body">
      {data.itens?.length > 0 ? (
        <div className="table-wrap" style={{ marginBottom: 8 }}>
          <table className="pedido-itens-preview">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Item</th>
                <th style={{ textAlign: 'right' }}>Qtd</th>
                <th>Un.</th>
                <th style={{ textAlign: 'right' }}>Valor unit.</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.itens.map((item, idx) => (
                <tr key={item.id || idx}>
                  <td>{CATEGORIA_LABELS[item.categoria] || item.categoria}</td>
                  <td>
                    {item.descricao}
                    {item.observacoes && <small style={{ display: 'block', color: '#888' }}>{item.observacoes}</small>}
                  </td>
                  <td style={{ textAlign: 'right' }}>{Number(item.quantidade).toLocaleString('pt-BR')}</td>
                  <td>{item.unidade}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(item.valor_unitario)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.valor_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>Total</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>{formatCurrency(data.valor_total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: '#888', padding: '8px 0' }}>Nenhum item lançado neste pedido.</div>
      )}

      {Object.keys(byCategoria).length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {Object.entries(byCategoria).map(([cat, val]) => (
            <span key={cat} style={{ fontSize: 11, padding: '2px 8px', background: 'var(--surface-2, #f4f4f4)', borderRadius: 4 }}>
              {cat}: {formatCurrency(val)}
            </span>
          ))}
        </div>
      )}

      <button className="button-secondary" style={{ fontSize: 12 }} onClick={() => onShowPdf(data)} type="button">
        Gerar PDF
      </button>
    </div>
  )
}

// ─── Chip de status com avanço rápido ────────────────────────────────────────

function StatusBadge({ pedido, onRefresh }) {
  const [busy, setBusy] = useState(false)
  const idx = STATUS_FLOW.indexOf(pedido.status)

  async function advance(s) {
    setBusy(true)
    try { await api.updatePedidoStatus(pedido.id, s); onRefresh() } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <span className={`status-chip tone-${statusTone(pedido.status)}`}>
        {STATUS_LABELS[pedido.status] || pedido.status}
      </span>
      {!busy && pedido.status !== 'cancelado' && pedido.status !== 'recebido' && (
        <>
          {STATUS_FLOW[idx + 1] && (
            <button
              className="button-secondary"
              style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={() => advance(STATUS_FLOW[idx + 1])}
              type="button"
            >
              → {STATUS_LABELS[STATUS_FLOW[idx + 1]]}
            </button>
          )}
          <button
            className="button-secondary"
            style={{ fontSize: 11, padding: '2px 8px', color: 'var(--danger, #c00)' }}
            onClick={() => advance('cancelado')}
            type="button"
          >
            Cancelar
          </button>
        </>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function PedidosCompraPage() {
  const [mode, setMode] = useState('list')          // 'list' | 'form'
  const [editTarget, setEditTarget] = useState(null) // { pedido, itens } | null
  const [pedidos, setPedidos] = useState([])
  const [filiais, setFiliais] = useState([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [expandedId, setExpandedId] = useState(null)
  const [pdfData, setPdfData] = useState(null)      // abre PrintablePedido

  // Filtros
  const [fFilial, setFFilial] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fBusca, setFBusca] = useState('')

  useEffect(() => {
    api.list('filiais', { ativo: true }).then(setFiliais).catch(() => {})
  }, [])

  useEffect(() => {
    if (mode !== 'list') return
    let active = true
    setLoading(true)
    setErro('')
    const params = {}
    if (fFilial) params.filial_id = fFilial
    if (fStatus) params.status = fStatus
    api.list('pedidos_compra', params)
      .then((rows) => { if (active) setPedidos(rows || []) })
      .catch((err) => { if (active) setErro(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [fFilial, fStatus, refreshKey, mode])

  const filtrados = useMemo(() => {
    const q = fBusca.trim().toLowerCase()
    if (!q) return pedidos
    return pedidos.filter((p) =>
      [p.numero_pedido, p.fornecedor, p.centro_custo, p.criado_por_nome]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [pedidos, fBusca])

  function openNew() { setEditTarget(null); setMode('form') }

  async function openEdit(pedido) {
    try {
      const data = await api.getPedidoDetalhes(pedido.id)
      setEditTarget({ pedido, itens: data.itens || [] })
    } catch {
      setEditTarget({ pedido, itens: [] })
    }
    setMode('form')
  }

  function handleSaved(orderId) {
    setMode('list')
    setEditTarget(null)
    setRefreshKey((k) => k + 1)
    setExpandedId(orderId)
  }

  function handleCancel() { setEditTarget(null); setMode('list') }

  function toggleExpand(id) { setExpandedId((prev) => (prev === id ? null : id)) }

  // ── Formulário ──
  if (mode === 'form') {
    return (
      <section className="page-shell">
        <FormularioPedido
          pedidoInicial={editTarget?.pedido ?? null}
          itensIniciais={editTarget?.itens ?? null}
          onSaved={handleSaved}
          onCancel={handleCancel}
        />
      </section>
    )
  }

  // ── Lista ──
  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Compras</span>
          <h1>Pedidos de compra</h1>
          <p>Lance pedidos item a item, acompanhe o status e gere PDF para aprovação.</p>
        </div>
        <div>
          <button className="button-primary" onClick={openNew} type="button">+ Novo pedido</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="surface-card" style={{ padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <label className="field filter-field">
            <span>Filial</span>
            <select value={fFilial} onChange={(e) => setFFilial(e.target.value)}>
              <option value="">Todas</option>
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
          <label className="field filter-field" style={{ gridColumn: 'span 2' }}>
            <span>Buscar</span>
            <input
              type="text"
              placeholder="Número, fornecedor, centro de custo..."
              value={fBusca}
              onChange={(e) => setFBusca(e.target.value)}
            />
          </label>
        </div>
      </div>

      {erro && <div className="alert-error">{erro}</div>}

      <div className="surface-card">
        {loading ? (
          <div className="empty-state">Carregando pedidos...</div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">
            <strong>Nenhum pedido encontrado.</strong>
            <p>Use o botão "+ Novo pedido" para criar o primeiro.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="pedidos-list-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }} />
                  <th>N° Solicitação</th>
                  <th>Número</th>
                  <th>Base</th>
                  <th>Fornecedor</th>
                  <th>Data</th>
                  <th>Precisa até</th>
                  <th>Pagamento</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th style={{ width: 70 }}>Editar</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((pedido) => (
                  <>
                    <tr key={pedido.id} className={`pedidos-list-row${expandedId === pedido.id ? ' row-expanded' : ''}`}>
                      <td>
                        <button
                          className="pedido-expand-btn"
                          type="button"
                          onClick={() => toggleExpand(pedido.id)}
                          title="Ver itens do pedido"
                        >
                          {expandedId === pedido.id ? '▲' : '▼'}
                        </button>
                      </td>
                      <td>
                        {pedido.numero_solicitacao
                          ? <span className="acomp-num-sol">{pedido.numero_solicitacao}</span>
                          : <span style={{ color: '#bbb' }}>—</span>}
                      </td>
                      <td><strong>{pedido.numero_pedido || '#' + pedido.id}</strong></td>
                      <td>{pedido.filial_nome || '-'}</td>
                      <td>{pedido.fornecedor || <span style={{ color: '#bbb' }}>—</span>}</td>
                      <td>{formatDate(pedido.data_pedido)}</td>
                      <td>
                        {pedido.data_necessidade
                          ? <span style={new Date(pedido.data_necessidade + 'T00:00:00') < new Date() && pedido.status !== 'recebido'
                              ? { color: 'var(--danger, #c00)', fontWeight: 600 } : {}}>
                              {formatDate(pedido.data_necessidade)}
                            </span>
                          : <span style={{ color: '#bbb' }}>—</span>}
                      </td>
                      <td>{PAGAMENTO_LABELS[pedido.forma_pagamento] || <span style={{ color: '#bbb' }}>—</span>}</td>
                      <td><strong>{formatCurrency(pedido.valor_total_calculado ?? 0)}</strong></td>
                      <td>
                        <StatusBadge pedido={pedido} onRefresh={() => setRefreshKey((k) => k + 1)} />
                      </td>
                      <td>
                        <button
                          className="button-secondary"
                          style={{ fontSize: 12, padding: '3px 10px' }}
                          onClick={() => openEdit(pedido)}
                          type="button"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                    {expandedId === pedido.id && (
                      <tr key={'exp-' + pedido.id} className="pedido-expand-row">
                        <td colSpan={11} style={{ padding: 0 }}>
                          <PedidoExpandido pedidoId={pedido.id} onShowPdf={setPdfData} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pdfData && (
        <PrintablePedido data={pdfData} onClose={() => setPdfData(null)} />
      )}
    </section>
  )
}

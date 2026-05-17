import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

const REEMBOLSO_OPTS = [
  { value: '', label: 'Não se aplica' },
  { value: 'pix', label: 'PIX' },
  { value: 'dinheiro', label: 'Dinheiro em espécie' },
  { value: 'transferencia', label: 'Transferência bancária' },
  { value: 'cartao', label: 'Cartão' },
]

const STATUS_OPTS = [
  { value: 'rascunho',           label: 'Rascunho' },
  { value: 'pendente',           label: 'Pendente' },
  { value: 'analise',            label: 'Em análise' },
  { value: 'aprovado',           label: 'Aprovado' },
  { value: 'reprovado',          label: 'Reprovado' },
  { value: 'em_compra',          label: 'Em compra' },
  { value: 'recebido',           label: 'Recebido' },
  { value: 'cancelado',          label: 'Cancelado' },
  // Legado — exibição de pedidos antigos
  { value: 'pendente_aprovacao', label: 'Pendente' },
  { value: 'em_analise',         label: 'Em análise' },
]

const STATUS_NEXT = {
  rascunho:  { status: 'pendente', label: 'Enviar p/ aprovação' },
  aprovado:  { status: 'em_compra', label: 'Iniciar compra' },
  em_compra: { status: 'recebido', label: 'Marcar recebido' },
}
const CAN_CANCEL = new Set(['rascunho', 'pendente', 'analise', 'aprovado', 'em_compra', 'pendente_aprovacao', 'em_analise'])

const STATUS_LABELS = Object.fromEntries(STATUS_OPTS.map((o) => [o.value, o.label]))
const CATEGORIA_LABELS = Object.fromEntries(CATEGORIA_OPTS.map((o) => [o.value, o.label]))
const PAGAMENTO_LABELS = Object.fromEntries(PAGAMENTO_OPTS.map((o) => [o.value, o.label]))
const REEMBOLSO_LABELS = Object.fromEntries(REEMBOLSO_OPTS.map((o) => [o.value, o.label]))

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
    _from_catalog: false,
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
    data_vencimento: '',
    fornecedor: '',
    forma_pagamento: '',
    prazo_pagamento: '',
    centro_custo: '',
    criado_por: '',
    status: 'pendente',
    observacoes: '',
    tipo_reembolso: '',
    chave_pix: '',
    dados_bancarios: '',
  }
}

function calcularVencimento(dataPedido, prazo) {
  if (!dataPedido || !prazo) return ''
  const p = prazo.trim().toLowerCase()
  if (p === 'à vista' || p === 'a vista') return dataPedido
  const match = p.match(/\d+/)
  if (!match) return ''
  const dias = parseInt(match[0], 10)
  if (!dias) return dataPedido
  const d = new Date(dataPedido + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const parts = String(dateStr).split('-')
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function formatDateTime(dt) {
  if (!dt) return '-'
  try {
    const d = new Date(dt)
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '-'
  }
}

function statusTone(status) {
  if (status === 'aprovado' || status === 'recebido') return 'success'
  if (status === 'cancelado' || status === 'reprovado') return 'danger'
  if (status === 'analise' || status === 'em_analise' || status === 'em_compra') return 'warning'
  if (status === 'pendente' || status === 'pendente_aprovacao') return 'neutral'
  return 'neutral'
}

function itemTotal(item) {
  const qty = parseFloat(String(item.quantidade).replace(',', '.')) || 0
  const price = parseFloat(String(item.valor_unitario).replace(',', '.')) || 0
  return qty * price
}

// ─── Autocomplete genérico ────────────────────────────────────────────────────

function AutocompleteInput({ value, onChange, items, placeholder, className, style }) {
  const [showSug, setShowSug] = useState(false)
  const wrapRef = useRef(null)

  const suggestions = useMemo(() => {
    const q = (value || '').trim().toLowerCase()
    if (q.length < 2) return []
    return items.filter((it) => it.toLowerCase().includes(q)).slice(0, 10)
  }, [value, items])

  useEffect(() => {
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSug(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...style }}>
      <input
        className={className || 'field'}
        type="text"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setShowSug(true) }}
        onFocus={() => { if (suggestions.length) setShowSug(true) }}
      />
      {showSug && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: '#fff', border: '1px solid #ddd', borderRadius: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 200, overflow: 'auto',
        }}>
          {suggestions.map((s) => (
            <div
              key={s}
              onMouseDown={(e) => { e.preventDefault(); onChange(s); setShowSug(false) }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f0f0f0' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#eff4ff' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Modal de catálogo de itens ───────────────────────────────────────────────

function CatalogoModal({ filialId, onAdd, onClose }) {
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    api.list('itens_catalogo', { ativo: true, limit: 1000 })
      .then((r) => setItens(Array.isArray(r) ? r : (r.items || [])))
      .catch(() => setItens([]))
      .finally(() => setLoading(false))
  }, [])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return itens
    return itens.filter((it) =>
      [it.nome, it.categoria, it.fornecedor_habitual].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    )
  }, [itens, busca])

  const porCategoria = useMemo(() => {
    const map = {}
    for (const it of filtrados) {
      const cat = CATEGORIA_LABELS[it.categoria] || it.categoria || 'Outro'
      if (!map[cat]) map[cat] = []
      map[cat].push(it)
    }
    return map
  }, [filtrados])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 680, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">Pedido de compra</span>
            <h2>Catálogo de itens</h2>
          </div>
          <button className="button-secondary" onClick={onClose} type="button">Fechar</button>
        </div>

        <div style={{ padding: '0 20px 12px' }}>
          <input
            className="field"
            type="text"
            placeholder="Buscar por nome, categoria ou fornecedor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ width: '100%' }}
            autoFocus
          />
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
          {loading ? (
            <div style={{ color: '#888', textAlign: 'center', padding: 24 }}>Carregando catálogo...</div>
          ) : filtrados.length === 0 ? (
            <div style={{ color: '#888', textAlign: 'center', padding: 24 }}>
              {itens.length === 0
                ? 'Nenhum item no catálogo. Cadastre itens em Catálogo de itens.'
                : 'Nenhum resultado para a busca.'}
            </div>
          ) : (
            Object.entries(porCategoria).map(([cat, cats]) => (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#666', marginBottom: 6, letterSpacing: '0.04em' }}>
                  {cat}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {cats.map((it) => (
                    <div
                      key={it.id}
                      onClick={() => { onAdd(it); onClose() }}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 12px', borderRadius: 6, background: 'var(--surface-2, #f7f7f7)',
                        cursor: 'pointer', border: '1px solid transparent',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent, #1a73e8)'; e.currentTarget.style.background = '#eff4ff' }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'var(--surface-2, #f7f7f7)' }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{it.nome}</div>
                        {it.fornecedor_habitual && (
                          <div style={{ fontSize: 11, color: '#888' }}>{it.fornecedor_habitual} · {it.unidade}</div>
                        )}
                        {it.observacoes && <div style={{ fontSize: 11, color: '#aaa' }}>{it.observacoes}</div>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                        {it.valor_referencia ? (
                          <div style={{ fontWeight: 700, color: 'var(--accent, #1a73e8)' }}>{formatCurrency(it.valor_referencia)}</div>
                        ) : (
                          <div style={{ color: '#bbb', fontSize: 11 }}>Sem ref.</div>
                        )}
                        <div style={{ fontSize: 10, color: '#aaa' }}>/{it.unidade}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border, #eee)', fontSize: 12, color: '#888' }}>
          Clique em um item para adicioná-lo ao pedido.
        </div>
      </div>
    </div>
  )
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
              {pedido.numero_solicitacao && (
                <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>Solicitação: {pedido.numero_solicitacao}</div>
              )}
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

          {pedido.tipo_reembolso && (
            <>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#555', borderBottom: '1px solid #ddd', paddingBottom: 3, marginBottom: 8 }}>
                Dados de reembolso
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px 16px', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#777' }}>Tipo de reembolso</div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{REEMBOLSO_LABELS[pedido.tipo_reembolso] || pedido.tipo_reembolso}</div>
                </div>
                {pedido.chave_pix && (
                  <div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#777' }}>Chave PIX</div>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{pedido.chave_pix}</div>
                  </div>
                )}
                {pedido.dados_bancarios && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#777' }}>Dados bancários</div>
                    <div style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'pre-wrap' }}>{pedido.dados_bancarios}</div>
                  </div>
                )}
              </div>
            </>
          )}

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

function ItemRow({ item, onChange, onRemove, isOnly, catalogoItens, onSelectCatalog }) {
  const [showSug, setShowSug] = useState(false)
  const wrapRef = useRef(null)

  const suggestions = useMemo(() => {
    const q = (item.descricao || '').trim().toLowerCase()
    if (q.length < 2) return []
    return (catalogoItens || [])
      .filter((it) =>
        it.nome.toLowerCase().includes(q) ||
        (CATEGORIA_LABELS[it.categoria] || '').toLowerCase().includes(q) ||
        (it.fornecedor_habitual || '').toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [item.descricao, catalogoItens])

  useEffect(() => {
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSug(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const total = itemTotal(item)
  return (
    <tr className="pedido-item-row">
      <td>
        <select className="pedido-item-sel" value={item.categoria} onChange={(e) => onChange('categoria', e.target.value)}>
          {CATEGORIA_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>
      <td ref={wrapRef} style={{ position: 'relative' }}>
        <input
          className="pedido-item-inp"
          type="text"
          placeholder="Digite para buscar no catálogo…"
          value={item.descricao}
          autoComplete="off"
          style={item.descricao && !item._from_catalog && !item.id ? { borderColor: '#dc2626', background: '#fff5f5' } : {}}
          onChange={(e) => {
            onChange('descricao', e.target.value)
            if (!item.id) onChange('_from_catalog', false)
            setShowSug(true)
          }}
          onFocus={() => { if (suggestions.length) setShowSug(true) }}
        />
        {item.descricao && !item._from_catalog && !item.id && (
          <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2, lineHeight: 1.2 }}>Selecione do catálogo</div>
        )}
        {showSug && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
            background: '#fff', border: '1px solid #ddd', borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 220, overflow: 'auto',
          }}>
            {suggestions.map((it) => (
              <div
                key={it.id}
                onMouseDown={(e) => { e.preventDefault(); onSelectCatalog(it); setShowSug(false) }}
                style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#eff4ff' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{it.nome}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>
                    {CATEGORIA_LABELS[it.categoria] || it.categoria} · {it.unidade}
                    {it.fornecedor_habitual ? ` · ${it.fornecedor_habitual}` : ''}
                  </div>
                </div>
                {it.valor_referencia && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent, #1a73e8)', marginLeft: 8, flexShrink: 0 }}>
                    {formatCurrency(it.valor_referencia)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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
  const navigate = useNavigate()
  const [form, setForm] = useState(() => ({
    ...emptyForm(),
    ...(pedidoInicial || {}),
    filial_id: pedidoInicial?.filial_id != null ? String(pedidoInicial.filial_id) : '',
    criado_por: pedidoInicial?.criado_por != null ? String(pedidoInicial.criado_por) : '',
    tipo_reembolso: pedidoInicial?.tipo_reembolso || '',
    chave_pix: pedidoInicial?.chave_pix || '',
    dados_bancarios: pedidoInicial?.dados_bancarios || '',
  }))
  const [itens, setItens] = useState(() =>
    itensIniciais?.length
      ? itensIniciais.map((it) => ({ ...it, _key: 'e-' + it.id, _from_catalog: true }))
      : [emptyItem()]
  )
  const [deletedIds, setDeletedIds] = useState([])
  const [filiais, setFiliais] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [catalogoItens, setCatalogoItens] = useState([])
  const [fornecedoresDB, setFornecedoresDB] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showCatalogo, setShowCatalogo] = useState(false)
  const [numeroSolicitacaoPre, setNumeroSolicitacaoPre] = useState(pedidoInicial?.numero_solicitacao || null)

  const isEditing = Boolean(pedidoInicial?.id)

  useEffect(() => {
    if (!isEditing) {
      api.preAlocarNumeroPedido()
        .then((r) => { if (r?.numero_solicitacao) setNumeroSolicitacaoPre(r.numero_solicitacao) })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    api.list('filiais', { ativo: true }).then(setFiliais).catch(() => {})
  }, [])

  useEffect(() => {
    if (!form.filial_id) { setColaboradores([]); return }
    api.list('colaboradores', { ativo: true, filial_id: form.filial_id }).then(setColaboradores).catch(() => {})
  }, [form.filial_id])

  useEffect(() => {
    api.list('itens_catalogo', { ativo: true, limit: 1000 })
      .then((r) => setCatalogoItens(Array.isArray(r) ? r : (r.items || [])))
      .catch(() => setCatalogoItens([]))
  }, [])

  useEffect(() => {
    const params = { ativo: true, limit: 1000 }
    if (form.filial_id) params.filial_id = form.filial_id
    api.list('fornecedores', params)
      .then((r) => setFornecedoresDB(Array.isArray(r) ? r : (r.items || [])))
      .catch(() => {})
  }, [form.filial_id])

  useEffect(() => {
    if (!['boleto', 'credito_fornecedor'].includes(form.forma_pagamento)) return
    const v = calcularVencimento(form.data_pedido, form.prazo_pagamento)
    if (v) setForm((prev) => ({ ...prev, data_vencimento: v }))
  }, [form.forma_pagamento, form.prazo_pagamento, form.data_pedido])

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

  function selectFromCatalogInline(key, catalogItem) {
    setItens((prev) => prev.map((it) => it._key !== key ? it : {
      ...it,
      descricao: catalogItem.nome,
      categoria: catalogItem.categoria || 'outro',
      unidade: catalogItem.unidade || 'un',
      _from_catalog: true,
    }))
  }

  function addFromCatalog(catalogItem) {
    const newItem = {
      ...emptyItem(),
      categoria: catalogItem.categoria || 'outro',
      descricao: catalogItem.nome,
      unidade: catalogItem.unidade || 'un',
      valor_unitario: catalogItem.valor_referencia ? String(catalogItem.valor_referencia) : '',
      observacoes: catalogItem.fornecedor_habitual ? `Fornecedor habitual: ${catalogItem.fornecedor_habitual}` : '',
      _from_catalog: true,
    }
    setItens((prev) => {
      const hasEmpty = prev.some((it) => !it.descricao.trim() && !it.id)
      return hasEmpty
        ? prev.map((it, idx) => idx === prev.findIndex((x) => !x.descricao.trim() && !x.id) ? newItem : it)
        : [...prev, newItem]
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    if (!form.filial_id) { setError('Selecione a filial.'); return }
    const itensValidos = itens.filter((it) => it.descricao.trim())
    if (!itensValidos.length) { setError('Adicione ao menos 1 item com descrição.'); return }
    const semCatalogo = itensValidos.filter((it) => !it.id && !it._from_catalog)
    if (semCatalogo.length) { setError('Selecione cada item novo a partir do catálogo: digite no campo de descrição e clique em uma sugestão.'); return }

    setSaving(true)
    try {
      let orderId = pedidoInicial?.id
      const payload = {
        filial_id: Number(form.filial_id),
        data_pedido: form.data_pedido || todayIso(),
        data_necessidade: form.data_necessidade || null,
        data_vencimento: form.data_vencimento || null,
        fornecedor: form.fornecedor || null,
        forma_pagamento: form.forma_pagamento || null,
        prazo_pagamento: form.prazo_pagamento || null,
        centro_custo: form.centro_custo || null,
        criado_por: form.criado_por ? Number(form.criado_por) : null,
        status: form.status || 'rascunho',
        observacoes: form.observacoes || null,
        tipo_reembolso: form.tipo_reembolso || null,
        chave_pix: form.tipo_reembolso === 'pix' ? (form.chave_pix || null) : null,
        dados_bancarios: form.tipo_reembolso === 'transferencia' ? (form.dados_bancarios || null) : null,
        ativo: true,
      }
      if (!isEditing && numeroSolicitacaoPre) {
        payload.numero_solicitacao = numeroSolicitacaoPre
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
          {numeroSolicitacaoPre && (
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Solicitação: <strong>{numeroSolicitacaoPre}</strong>
              {!isEditing && <span style={{ fontSize: 11, color: '#aaa', marginLeft: 6 }}>(reservado)</span>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="button-secondary" onClick={() => navigate('/itens-catalogo')}>
            Catálogo de itens
          </button>
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
            <AutocompleteInput
              value={form.fornecedor}
              onChange={(v) => setField('fornecedor', v)}
              items={fornecedoresDB.map((f) => f.nome)}
              placeholder="Nome do fornecedor ou loja"
            />
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
            <span>Vencimento{['boleto', 'credito_fornecedor'].includes(form.forma_pagamento) ? ' (calculado)' : ''}</span>
            <input
              type="date"
              value={form.data_vencimento}
              min={form.data_pedido || todayIso()}
              onChange={(e) => setField('data_vencimento', e.target.value)}
            />
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

        {/* ── Reembolso / PIX ── */}
        <div style={{ background: 'var(--surface-2, #f7f7f7)', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#444' }}>
            Dados de reembolso / pagamento ao solicitante
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px 16px' }}>
            <label className="field">
              <span>Tipo de reembolso</span>
              <select value={form.tipo_reembolso} onChange={(e) => setField('tipo_reembolso', e.target.value)}>
                {REEMBOLSO_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>

            {form.tipo_reembolso === 'pix' && (
              <label className="field">
                <span>Chave PIX</span>
                <input
                  type="text"
                  placeholder="CPF, telefone, e-mail ou chave aleatória"
                  value={form.chave_pix}
                  onChange={(e) => setField('chave_pix', e.target.value)}
                />
              </label>
            )}

            {form.tipo_reembolso === 'transferencia' && (
              <label className="field" style={{ gridColumn: 'span 2' }}>
                <span>Dados bancários</span>
                <textarea
                  rows={3}
                  placeholder="Banco, agência, conta, CPF/CNPJ do titular..."
                  value={form.dados_bancarios}
                  onChange={(e) => setField('dados_bancarios', e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </label>
            )}
          </div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 14 }}>Itens do pedido</strong>
          <span style={{ fontSize: 12, color: '#888' }}>{itens.length} {itens.length === 1 ? 'item' : 'itens'}</span>
          <button
            type="button"
            className="button-secondary"
            style={{ fontSize: 12, padding: '3px 10px' }}
            onClick={() => setShowCatalogo(true)}
          >
            + Do catálogo
          </button>
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
                  catalogoItens={catalogoItens}
                  onSelectCatalog={(catalogItem) => selectFromCatalogInline(item._key, catalogItem)}
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

      {showCatalogo && (
        <CatalogoModal
          filialId={form.filial_id || null}
          onAdd={addFromCatalog}
          onClose={() => setShowCatalogo(false)}
        />
      )}
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

  const { pedido = {}, itens = [], valor_total, aprovado_por_nome, em_analise_por_nome, reprovado_por_nome } = data

  const byCategoria = {}
  for (const item of itens) {
    const cat = CATEGORIA_LABELS[item.categoria] || item.categoria
    byCategoria[cat] = (byCategoria[cat] || 0) + Number(item.valor_total || 0)
  }

  const temAprovacao = pedido.aprovado_em || pedido.em_analise_em || pedido.reprovado_em

  return (
    <div className="pedido-expand-body">
      {itens.length > 0 ? (
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
              {itens.map((item, idx) => (
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
                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>{formatCurrency(valor_total)}</td>
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

      {/* Dados de reembolso */}
      {pedido.tipo_reembolso && (
        <div style={{ marginBottom: 8, padding: '8px 12px', background: 'var(--surface-2, #f7f7f7)', borderRadius: 6, fontSize: 12 }}>
          <strong style={{ fontSize: 11, textTransform: 'uppercase', color: '#666', letterSpacing: '0.04em' }}>Reembolso:</strong>{' '}
          {REEMBOLSO_LABELS[pedido.tipo_reembolso] || pedido.tipo_reembolso}
          {pedido.chave_pix && <span style={{ marginLeft: 8 }}>— PIX: <strong>{pedido.chave_pix}</strong></span>}
          {pedido.dados_bancarios && (
            <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', color: '#555' }}>{pedido.dados_bancarios}</div>
          )}
        </div>
      )}

      {/* Fluxo de aprovação */}
      {temAprovacao && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#666', marginBottom: 6, letterSpacing: '0.04em' }}>
            Fluxo de aprovação
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {pedido.em_analise_em && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ fontSize: 14 }}>🔍</span>
                <span style={{ color: '#555' }}>
                  Análise iniciada por <strong>{em_analise_por_nome || `#${pedido.em_analise_por}`}</strong>{' '}
                  em {formatDateTime(pedido.em_analise_em)}
                </span>
              </div>
            )}
            {pedido.aprovado_em && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ fontSize: 14 }}>✅</span>
                <span style={{ color: '#555' }}>
                  Aprovado por <strong>{aprovado_por_nome || `#${pedido.aprovado_por}`}</strong>{' '}
                  em {formatDateTime(pedido.aprovado_em)}
                </span>
              </div>
            )}
            {pedido.reprovado_em && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>❌</span>
                  <span style={{ color: '#c00' }}>
                    Reprovado por <strong>{reprovado_por_nome || `#${pedido.reprovado_por}`}</strong>{' '}
                    em {formatDateTime(pedido.reprovado_em)}
                  </span>
                </div>
                {pedido.motivo_reprovacao && (
                  <div style={{ marginLeft: 24, color: '#c00', background: '#fff5f5', borderRadius: 4, padding: '4px 8px', fontSize: 11 }}>
                    Motivo: {pedido.motivo_reprovacao}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {pedido.contas_pagar_id && (
        <div style={{ fontSize: 11, color: '#1a7340', background: '#edfaf3', borderRadius: 4, padding: '4px 8px', marginBottom: 8 }}>
          ✓ Conta a pagar criada (ID #{pedido.contas_pagar_id})
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
  const next = STATUS_NEXT[pedido.status]
  const canCancel = CAN_CANCEL.has(pedido.status)

  async function advance(s) {
    setBusy(true)
    try { await api.updatePedidoStatus(pedido.id, s); onRefresh() } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <span className={`status-chip tone-${statusTone(pedido.status)}`}>
        {STATUS_LABELS[pedido.status] || pedido.status}
      </span>
      {!busy && next && (
        <button
          className="button-secondary"
          style={{ fontSize: 11, padding: '2px 8px' }}
          onClick={() => advance(next.status)}
          type="button"
        >
          → {next.label}
        </button>
      )}
      {!busy && canCancel && (
        <button
          className="button-secondary"
          style={{ fontSize: 11, padding: '2px 8px', color: 'var(--danger, #c00)' }}
          onClick={() => advance('cancelado')}
          type="button"
        >
          Cancelar
        </button>
      )}
      {busy && <span style={{ fontSize: 11, color: '#888' }}>...</span>}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function PedidosCompraPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('list')          // 'list' | 'form'
  const [editTarget, setEditTarget] = useState(null) // { pedido, itens } | null
  const [pedidos, setPedidos] = useState([])
  const [filiais, setFiliais] = useState([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const _loaded = useRef(false)
  const [expandedId, setExpandedId] = useState(null)
  const [pdfData, setPdfData] = useState(null)

  // Filtros
  const [fFilial, setFFilial] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fBusca, setFBusca] = useState('')

  useEffect(() => {
    api.list('filiais', { ativo: true }).then(setFiliais).catch(() => {})
  }, [])

  useEffect(() => {
    if (filiais?.length === 1 && !fFilial) {
      setFFilial(String(filiais[0].id))
    }
  }, [filiais])

  useEffect(() => {
    if (mode !== 'list') return
    let active = true
    if (!_loaded.current) setLoading(true)
    setErro('')
    const params = {}
    if (fFilial) params.filial_id = fFilial
    if (fStatus) params.status = fStatus
    api.list('pedidos_compra', params)
      .then((rows) => { if (active) setPedidos(rows || []) })
      .catch((err) => { if (active) setErro(err.message) })
      .finally(() => { if (active) { _loaded.current = true; setLoading(false) } })
    return () => { active = false }
  }, [fFilial, fStatus, refreshKey, mode])

  const filtrados = useMemo(() => {
    const q = fBusca.trim().toLowerCase()
    if (!q) return pedidos
    return pedidos.filter((p) =>
      [p.numero_pedido, p.numero_solicitacao, p.fornecedor, p.centro_custo, p.criado_por_nome]
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="button-secondary" onClick={() => navigate('/itens-catalogo')} type="button">
            Catálogo
          </button>
          <button className="button-secondary" onClick={() => navigate('/pedidos-compra-graficos')} type="button">
            Gráficos
          </button>
          <button className="button-primary" onClick={openNew} type="button">+ Novo pedido</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="surface-card" style={{ padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
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
          <label className="field filter-field" style={{ gridColumn: 'span 2' }}>
            <span>Buscar</span>
            <input
              type="text"
              placeholder="Número, solicitação, fornecedor, centro de custo..."
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

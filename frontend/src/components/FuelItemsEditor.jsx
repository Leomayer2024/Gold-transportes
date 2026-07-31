import { useEffect, useRef } from 'react'

const EMPTY_ITEM = { tipo_combustivel: '', litros: '', valor_litro: '' }

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toNumber(value))
}

/**
 * Editor de itens do abastecimento: várias linhas (combustível + litros + preço)
 * com botão "+". O preço por litro é puxado do posto selecionado conforme o
 * tipo de combustível de cada linha (priceMap mapeia tipo -> coluna do posto).
 */
export default function FuelItemsEditor({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  postos = [],
  postoId = '',
  tipoOptions = [],
  priceMap = {},
}) {
  const items = Array.isArray(value) ? value : []
  const lastPostoRef = useRef(postoId)

  const posto = postos.find((p) => String(p.id) === String(postoId)) || null

  function priceForTipo(tipo) {
    if (!posto || !tipo) return ''
    const column = priceMap[tipo]
    if (!column) return ''
    const price = posto[column]
    return price === null || price === undefined || price === '' ? '' : price
  }

  // Ao trocar de posto, aplica os preços padrão do novo posto em cada linha que
  // tenha combustível escolhido (só quando o posto tem preço para aquele tipo).
  useEffect(() => {
    if (String(lastPostoRef.current) === String(postoId)) return
    lastPostoRef.current = postoId
    if (!postoId || readOnly || items.length === 0) return

    let changed = false
    const next = items.map((item) => {
      const price = priceForTipo(item.tipo_combustivel)
      if (price !== '' && String(price) !== String(item.valor_litro)) {
        changed = true
        return { ...item, valor_litro: price }
      }
      return item
    })
    if (changed) onChange(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postoId])

  function updateItem(index, patch) {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    onChange(next)
  }

  function handleTipoChange(index, tipo) {
    const patch = { tipo_combustivel: tipo }
    const price = priceForTipo(tipo)
    if (price !== '') patch.valor_litro = price
    updateItem(index, patch)
  }

  function addItem() {
    onChange([...items, { ...EMPTY_ITEM }])
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }

  const total = items.reduce((sum, item) => sum + toNumber(item.litros) * toNumber(item.valor_litro), 0)
  const litrosTotal = items.reduce((sum, item) => sum + toNumber(item.litros), 0)

  const tipoLabel = (tipo) => tipoOptions.find((o) => String(o.value) === String(tipo))?.label || tipo || '-'

  if (readOnly) {
    if (items.length === 0) return <div className="readonly-box">-</div>
    return (
      <div className="fuel-items-readonly" style={{ display: 'grid', gap: 4 }}>
        {items.map((item, i) => (
          <div key={i} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span>{tipoLabel(item.tipo_combustivel)}</span>
            <span style={{ color: 'var(--text-muted, #64748b)' }}>
              {toNumber(item.litros)} L × {formatBRL(item.valor_litro)} = <strong>{formatBRL(toNumber(item.litros) * toNumber(item.valor_litro))}</strong>
            </span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border-light, #e2e8f0)', paddingTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
          <span>Total ({litrosTotal} L)</span>
          <span>{formatBRL(total)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fuel-items-editor" style={{ display: 'grid', gap: 8 }}>
      {items.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted, #64748b)' }}>
          Nenhum combustível adicionado. Clique em "+ Adicionar combustível".
        </div>
      )}

      {items.map((item, index) => (
        <div
          key={index}
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 0.9fr 1fr auto',
            gap: 8,
            alignItems: 'end',
            padding: 8,
            border: '1px solid var(--border-light, #e2e8f0)',
            borderRadius: 8,
            background: 'var(--surface-muted, #f8fafc)',
          }}
        >
          <label className="field" style={{ margin: 0 }}>
            <span style={{ fontSize: 11 }}>Combustível</span>
            <select
              disabled={disabled}
              value={item.tipo_combustivel || ''}
              onChange={(e) => handleTipoChange(index, e.target.value)}
              required
            >
              <option value="">Selecione</option>
              {tipoOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="field" style={{ margin: 0 }}>
            <span style={{ fontSize: 11 }}>Litros</span>
            <input
              type="number"
              step="0.01"
              min="0"
              disabled={disabled}
              placeholder="Ex.: 120.5"
              value={item.litros ?? ''}
              onChange={(e) => updateItem(index, { litros: e.target.value })}
              required
            />
          </label>

          <label className="field" style={{ margin: 0 }}>
            <span style={{ fontSize: 11 }}>Preço/L (R$)</span>
            <input
              type="number"
              step="0.001"
              min="0"
              disabled={disabled}
              placeholder="Ex.: 6.299"
              value={item.valor_litro ?? ''}
              onChange={(e) => updateItem(index, { valor_litro: e.target.value })}
              required
            />
          </label>

          <button
            type="button"
            className="button-secondary"
            disabled={disabled}
            onClick={() => removeItem(index)}
            title="Remover item"
            style={{ padding: '8px 12px' }}
          >
            ✕
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="button-secondary" disabled={disabled} onClick={addItem}>
          + Adicionar combustível
        </button>
        {items.length > 0 && (
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            Total: {litrosTotal} L — {formatBRL(total)}
          </div>
        )}
      </div>
    </div>
  )
}

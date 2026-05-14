/**
 * Card resumido de um custo importante
 * Simples, visual e fácil de entender
 */
import { formatCurrency, formatPercent, marginTone, accuracyTone } from '../lib/formatters'

export default function CostSummaryCard({ label, value, tone = 'neutral', unit = 'currency', description }) {
  let formattedValue = value

  if (unit === 'currency') {
    formattedValue = formatCurrency(value)
  } else if (unit === 'percent') {
    formattedValue = formatPercent(value)
  } else if (unit === 'number') {
    formattedValue = Number(value || 0).toLocaleString('pt-BR')
  }

  return (
    <article className={`surface-card costs-summary-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{formattedValue}</strong>
      {description && <small>{description}</small>}
    </article>
  )
}

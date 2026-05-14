/**
 * Formatadores centralizados para valores monetários, percentuais e horas
 * Use em qualquer componente para manter consistência visual
 */

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0))
}

export function formatPercent(value) {
  if (value === null || value === undefined) {
    return '-'
  }
  return `${Number(value).toFixed(1)}%`
}

export function formatHourDecimalAsClock(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-'
  }

  const totalMinutes = Math.round(Number(value) * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h${String(minutes).padStart(2, '0')}`
}

export function formatMinutes(totalMinutes) {
  const safeMinutes = Number(totalMinutes || 0)
  const hours = Math.floor(safeMinutes / 60)
  const minutes = safeMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * Determina o tom (cor) de um valor de margem
 * @param {number} value - Valor da margem
 * @returns {string} 'danger' ou 'success'
 */
export function marginTone(value) {
  if (Number(value || 0) < 0) {
    return 'danger'
  }
  return 'success'
}

/**
 * Determina o tom (cor) de acuracidade
 * @param {number} value - Percentual (0-100)
 * @returns {string} 'success' (>=95), 'warning' (85-95), 'danger' (<85)
 */
export function accuracyTone(value) {
  if (value === null || value === undefined) {
    return 'neutral'
  }
  const normalized = Number(value)
  if (normalized >= 95) {
    return 'success'
  }
  if (normalized >= 85) {
    return 'warning'
  }
  return 'danger'
}

/**
 * Determina tom para contratos com margem negativa
 */
export function negativeContractsTone(value) {
  const normalized = Number(value || 0)
  if (normalized === 0) {
    return 'success'
  }
  if (normalized <= 2) {
    return 'warning'
  }
  return 'danger'
}

/**
 * Determina tom para custo fora de contrato
 */
export function custoForaContratoTone(value) {
  const normalized = Number(value || 0)
  if (normalized <= 0) {
    return 'success'
  }
  if (normalized <= 1000) {
    return 'warning'
  }
  return 'danger'
}

/**
 * Determina tom para saldo por fora
 */
export function saldoPorForaTone(value) {
  const normalized = Number(value || 0)
  if (normalized >= 0) {
    return 'success'
  }
  if (normalized >= -1000) {
    return 'warning'
  }
  return 'danger'
}

/**
 * Traduz severidade de alerta para português
 */
export function formatSeverityLabel(severity) {
  if (severity === 'critical') {
    return 'Crítico'
  }
  if (severity === 'warning') {
    return 'Atenção'
  }
  return 'Informativo'
}

/**
 * Traduz labels de tipo de feriado
 */
export const TIPO_FERIADO_LABELS = {
  nacional: 'Nacional',
  estadual: 'Estadual',
  municipal: 'Municipal',
  interno: 'Ponto facultativo',
}

export function formatTipoFeriado(tipo) {
  return TIPO_FERIADO_LABELS[tipo] || tipo
}

// Helpers compartilhados entre a tela Documentos RH e o badge da sidebar.
import { calcularStatus, diasParaVencer } from './catalogo'

export function enriquecerDocumento(doc, hoje = new Date()) {
  return {
    ...doc,
    status_calculado: calcularStatus(doc, hoje),
    dias_para_vencer: diasParaVencer(doc, hoje),
    arquivo_enviado: Boolean(doc.arquivo_url),
  }
}

export function contarAlertas(documentos) {
  let vencidos = 0
  let venceEmBreve = 0
  let pendentes = 0
  let semArquivo = 0
  for (const doc of documentos) {
    const status = doc.status_calculado
    if (status === 'vencido') vencidos++
    else if (status === 'vence_em_breve') venceEmBreve++
    else if (status === 'pendente') pendentes++
    if (!doc.arquivo_enviado) semArquivo++
  }
  return { vencidos, venceEmBreve, pendentes, semArquivo, total: documentos.length }
}

export function formatarDataBr(iso) {
  if (!iso) return ''
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

function dateToIso(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Aceita: string ISO (YYYY-MM-DD), string BR (DD/MM/AAAA), Date, ou número
// serial do Excel (dias desde 1900-01-01).
export function dataBrParaIso(br) {
  if (br === null || br === undefined || br === '') return ''

  // Date instance — usado quando o XLSX é lido com cellDates: true
  if (br instanceof Date) return dateToIso(br)

  // Número serial do Excel — dias desde 1900-01-01 (com bug do 1900 bissexto)
  if (typeof br === 'number' && Number.isFinite(br)) {
    // Epoch Excel: 1899-12-30 (compensa o bug do ano 1900 do Excel)
    const ms = Math.round((br - 25569) * 86400 * 1000)
    return dateToIso(new Date(ms))
  }

  const cleaned = String(br).trim()
  if (!cleaned) return ''

  // Numérico em string ("45292") — trata como serial do Excel
  if (/^\d+(\.\d+)?$/.test(cleaned)) {
    const n = Number(cleaned)
    if (n > 1000 && n < 100000) {
      const ms = Math.round((n - 25569) * 86400 * 1000)
      return dateToIso(new Date(ms))
    }
  }

  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  const brMatch = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`

  // Última tentativa: parser nativo do JS (aceita formatos amplos tipo
  // "Jan 15 2024", "2024/01/15", ISO completo com horas, etc.)
  const parsed = new Date(cleaned)
  if (!Number.isNaN(parsed.getTime())) return dateToIso(parsed)

  return ''
}

export function normalizarNome(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

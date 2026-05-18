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

export function dataBrParaIso(br) {
  if (!br) return ''
  const cleaned = String(br).trim()
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  const brMatch = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`
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

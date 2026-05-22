// Catálogo padrão de tipos de documentos da frota (veículos).
// Espelha a estrutura usada em rhDocumentos/catalogo.js, adaptado para veículos.
//
// validadeMeses: null = documento sem validade. Número = meses até vencer.
// diasAlerta = quantos dias antes do vencimento começa o alerta.

export const CATEGORIAS = [
  { value: 'documentacao', label: 'Documentação',  cor: '#3a4a5a' },
  { value: 'seguro',       label: 'Seguros',       cor: '#2a6e47' },
  { value: 'licenca',      label: 'Licenças',      cor: '#8a5c00' },
  { value: 'regulatorio',  label: 'Regulatório',   cor: '#1f4d8a' },
  { value: 'inspecao',     label: 'Inspeções',     cor: '#5a4a8a' },
]

export const CATEGORIA_LABELS = Object.fromEntries(CATEGORIAS.map((c) => [c.value, c.label]))

// Tipos canônicos. Campo `tipo` é o que vai gravado em `tipo_documento`.
// `valorBackend` (opcional) mapeia para um dos enums fixos do backend
// (crlv, seguro, tacografo, etc.). Quando ausente, salvamos como 'outro'.
export const TIPOS_DOCUMENTOS = [
  // ── Documentação ────────────────────────────────────────────────────────
  { tipo: 'CRLV',                           categoria: 'documentacao', validadeMeses: 12,   diasAlerta: 30, obrigatorio: true,  valorBackend: 'crlv' },
  { tipo: 'CRV',                            categoria: 'documentacao', validadeMeses: null, diasAlerta: 0,  obrigatorio: true,  valorBackend: 'outro' },
  { tipo: 'Comprovante de Propriedade',     categoria: 'documentacao', validadeMeses: null, diasAlerta: 0,  obrigatorio: false, valorBackend: 'outro' },
  { tipo: 'Nota Fiscal do Veículo',         categoria: 'documentacao', validadeMeses: null, diasAlerta: 0,  obrigatorio: false, valorBackend: 'outro' },

  // ── Seguros ─────────────────────────────────────────────────────────────
  { tipo: 'DPVAT',                          categoria: 'seguro',       validadeMeses: 12,   diasAlerta: 30, obrigatorio: true,  valorBackend: 'seguro' },
  { tipo: 'Seguro Veicular',                categoria: 'seguro',       validadeMeses: 12,   diasAlerta: 45, obrigatorio: false, valorBackend: 'seguro' },
  { tipo: 'Seguro de Carga',                categoria: 'seguro',       validadeMeses: 12,   diasAlerta: 30, obrigatorio: false, valorBackend: 'seguro' },
  { tipo: 'RCTR-C (Resp. Civil Transportador)', categoria: 'seguro',   validadeMeses: 12,   diasAlerta: 30, obrigatorio: false, valorBackend: 'seguro' },
  { tipo: 'RCF-DC (Desaparecimento de Carga)', categoria: 'seguro',    validadeMeses: 12,   diasAlerta: 30, obrigatorio: false, valorBackend: 'seguro' },

  // ── Licenças ────────────────────────────────────────────────────────────
  { tipo: 'Alvará de Transporte',           categoria: 'licenca',      validadeMeses: 12,   diasAlerta: 30, obrigatorio: false, valorBackend: 'alvara_transporte' },
  { tipo: 'Licença Municipal',              categoria: 'licenca',      validadeMeses: 12,   diasAlerta: 30, obrigatorio: false, valorBackend: 'alvara_transporte' },
  { tipo: 'Licença para Carga Indivisível', categoria: 'licenca',      validadeMeses: 12,   diasAlerta: 30, obrigatorio: false, valorBackend: 'alvara_transporte' },
  { tipo: 'AET — Autorização Especial de Trânsito', categoria: 'licenca', validadeMeses: 12, diasAlerta: 30, obrigatorio: false, valorBackend: 'alvara_transporte' },

  // ── Regulatório (ANTT/INMETRO) ──────────────────────────────────────────
  { tipo: 'RNTRC (ANTT)',                   categoria: 'regulatorio',  validadeMeses: 60,   diasAlerta: 60, obrigatorio: false, valorBackend: 'habilitacao_especial' },
  { tipo: 'CIV — Certificado Inspeção Veicular', categoria: 'regulatorio', validadeMeses: 12, diasAlerta: 30, obrigatorio: false, valorBackend: 'certificado_produto_perigoso' },
  { tipo: 'CIPP — Certificado Produto Perigoso', categoria: 'regulatorio', validadeMeses: 12, diasAlerta: 30, obrigatorio: false, valorBackend: 'certificado_produto_perigoso' },
  { tipo: 'Certificado MOPP do Veículo',    categoria: 'regulatorio',  validadeMeses: 12,   diasAlerta: 30, obrigatorio: false, valorBackend: 'certificado_produto_perigoso' },
  { tipo: 'Cronotacógrafo (INMETRO)',       categoria: 'regulatorio',  validadeMeses: 24,   diasAlerta: 60, obrigatorio: false, valorBackend: 'tacografo' },

  // ── Inspeções ───────────────────────────────────────────────────────────
  { tipo: 'Inspeção Veicular Anual',        categoria: 'inspecao',     validadeMeses: 12,   diasAlerta: 30, obrigatorio: false, valorBackend: 'inspecao_veicular' },
  { tipo: 'Inspeção de Tacógrafo',          categoria: 'inspecao',     validadeMeses: 24,   diasAlerta: 60, obrigatorio: false, valorBackend: 'tacografo' },
  { tipo: 'Inspeção de Itens de Segurança', categoria: 'inspecao',     validadeMeses: 12,   diasAlerta: 30, obrigatorio: false, valorBackend: 'inspecao_veicular' },
  { tipo: 'Vistoria Técnica',               categoria: 'inspecao',     validadeMeses: 12,   diasAlerta: 30, obrigatorio: false, valorBackend: 'inspecao_veicular' },
]

const NORMALIZE = (v) =>
  String(v || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

const TIPO_INDEX = new Map(TIPOS_DOCUMENTOS.map((item) => [NORMALIZE(item.tipo), item]))

export function findTipoCatalogo(tipo) {
  if (!tipo) return null
  return TIPO_INDEX.get(NORMALIZE(tipo)) || null
}

export function diasAlertaSugerido(tipo, fallback = 30) {
  const entry = findTipoCatalogo(tipo)
  if (!entry) return fallback
  return entry.diasAlerta ?? fallback
}

export function categoriaSugerida(tipo) {
  return findTipoCatalogo(tipo)?.categoria || ''
}

// Backend usa enum fixo no campo `tipo_documento` (crlv, seguro, tacografo,
// inspecao_veicular, habilitacao_especial, alvara_transporte,
// certificado_produto_perigoso, outro). Mapeia o nome canônico do catálogo
// para o enum aceito pelo schema.
export function tipoBackend(tipo) {
  return findTipoCatalogo(tipo)?.valorBackend || 'outro'
}

export function calcularValidadeSugerida(tipo, dataEmissaoISO) {
  const entry = findTipoCatalogo(tipo)
  if (!entry || !entry.validadeMeses) return null
  const base = dataEmissaoISO ? new Date(`${dataEmissaoISO}T00:00:00`) : new Date()
  if (Number.isNaN(base.getTime())) return null
  base.setMonth(base.getMonth() + entry.validadeMeses)
  const y = base.getFullYear()
  const m = String(base.getMonth() + 1).padStart(2, '0')
  const d = String(base.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Status visual a partir de data_validade e prazo_renovacao_dias.
export function calcularStatus(doc, hoje = new Date()) {
  if (doc.status === 'nao_se_aplica') return 'nao_se_aplica'
  if (!doc.data_validade) {
    const catalogo = findTipoCatalogo(doc.tipo_documento)
    if (catalogo && catalogo.validadeMeses === null) return 'vigente_sem_validade'
    return doc.status || 'pendente'
  }
  const validade = new Date(`${doc.data_validade}T00:00:00`)
  if (Number.isNaN(validade.getTime())) return doc.status || 'pendente'
  const diff = Math.floor((validade - hoje) / 86400000)
  const alertaRaw = doc.prazo_renovacao_dias ?? doc.dias_alerta
  const alerta = Number.isFinite(Number(alertaRaw)) ? Number(alertaRaw) : 30
  if (diff < 0) return 'vencido'
  if (diff <= alerta) return 'vence_em_breve'
  return 'vigente'
}

export function diasParaVencer(doc, hoje = new Date()) {
  if (!doc.data_validade) return null
  const validade = new Date(`${doc.data_validade}T00:00:00`)
  if (Number.isNaN(validade.getTime())) return null
  return Math.floor((validade - hoje) / 86400000)
}

export function calcularPrazoValidadeDias(doc) {
  if (!doc.data_emissao || !doc.data_validade) return null
  const emi = new Date(`${doc.data_emissao}T00:00:00`)
  const val = new Date(`${doc.data_validade}T00:00:00`)
  if (Number.isNaN(emi.getTime()) || Number.isNaN(val.getTime())) return null
  return Math.round((val - emi) / 86400000)
}

export function somarDiasIso(baseIso, dias) {
  const base = baseIso ? new Date(`${baseIso}T00:00:00`) : new Date()
  if (Number.isNaN(base.getTime())) return null
  const result = new Date(base.getTime())
  result.setDate(result.getDate() + Number(dias || 0))
  const y = result.getFullYear()
  const m = String(result.getMonth() + 1).padStart(2, '0')
  const d = String(result.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const STATUS_LABELS = {
  vigente: 'Vigente',
  vigente_sem_validade: 'Vigente (sem validade)',
  vence_em_breve: 'Vence em breve',
  vencido: 'Vencido',
  pendente: 'Pendente',
  nao_se_aplica: 'Não se aplica',
}

// Tipos obrigatórios mínimos para a matriz veículo × tipo.
export const TIPOS_OBRIGATORIOS_PADRAO = TIPOS_DOCUMENTOS
  .filter((t) => t.obrigatorio)
  .map((t) => t.tipo)

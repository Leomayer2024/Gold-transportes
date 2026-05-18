// Catálogo padrão de tipos de documentos RH (Brasil).
// Auto-preenche categoria, validade típica (meses) e dias_alerta sugerido.
// validadeMeses: null = documento sem validade (RG, CPF). 0 = vitalício.

export const CATEGORIAS = [
  { value: 'pessoal',      label: 'Pessoal',      cor: '#3a4a5a' },
  { value: 'saude',        label: 'Saúde',        cor: '#2a6e47' },
  { value: 'habilitacao',  label: 'Habilitação',  cor: '#8a5c00' },
  { value: 'treinamento',  label: 'Treinamento',  cor: '#1f4d8a' },
  { value: 'contratual',   label: 'Contratual',   cor: '#5a4a8a' },
]

export const CATEGORIA_LABELS = Object.fromEntries(CATEGORIAS.map((c) => [c.value, c.label]))

export const TIPOS_DOCUMENTOS = [
  // ── Pessoal ──────────────────────────────────────────────────────────────
  { tipo: 'RG',                       categoria: 'pessoal',     validadeMeses: null, diasAlerta: 0,  obrigatorio: true  },
  { tipo: 'CPF',                      categoria: 'pessoal',     validadeMeses: null, diasAlerta: 0,  obrigatorio: true  },
  { tipo: 'CTPS',                     categoria: 'pessoal',     validadeMeses: null, diasAlerta: 0,  obrigatorio: true  },
  { tipo: 'Título de Eleitor',        categoria: 'pessoal',     validadeMeses: null, diasAlerta: 0,  obrigatorio: false },
  { tipo: 'Certificado Reservista',   categoria: 'pessoal',     validadeMeses: null, diasAlerta: 0,  obrigatorio: false },
  { tipo: 'Comprovante de Residência',categoria: 'pessoal',     validadeMeses: 6,    diasAlerta: 30, obrigatorio: true  },
  { tipo: 'PIS/PASEP',                categoria: 'pessoal',     validadeMeses: null, diasAlerta: 0,  obrigatorio: true  },
  { tipo: 'Foto 3x4',                 categoria: 'pessoal',     validadeMeses: null, diasAlerta: 0,  obrigatorio: false },

  // ── Saúde (ASO) ──────────────────────────────────────────────────────────
  { tipo: 'ASO Admissional',          categoria: 'saude',       validadeMeses: 12,   diasAlerta: 30, obrigatorio: true  },
  { tipo: 'ASO Periódico',            categoria: 'saude',       validadeMeses: 12,   diasAlerta: 30, obrigatorio: true  },
  { tipo: 'ASO Mudança de Função',    categoria: 'saude',       validadeMeses: 12,   diasAlerta: 30, obrigatorio: false },
  { tipo: 'ASO Retorno ao Trabalho',  categoria: 'saude',       validadeMeses: 12,   diasAlerta: 30, obrigatorio: false },
  { tipo: 'ASO Demissional',          categoria: 'saude',       validadeMeses: null, diasAlerta: 0,  obrigatorio: false },
  { tipo: 'Atestado Médico',          categoria: 'saude',       validadeMeses: null, diasAlerta: 0,  obrigatorio: false },
  { tipo: 'Exame Audiométrico',       categoria: 'saude',       validadeMeses: 12,   diasAlerta: 30, obrigatorio: false },

  // ── Habilitação ──────────────────────────────────────────────────────────
  { tipo: 'CNH',                      categoria: 'habilitacao', validadeMeses: 60,   diasAlerta: 60, obrigatorio: false },
  { tipo: 'CNH categoria A',          categoria: 'habilitacao', validadeMeses: 60,   diasAlerta: 60, obrigatorio: false },
  { tipo: 'CNH categoria B',          categoria: 'habilitacao', validadeMeses: 60,   diasAlerta: 60, obrigatorio: false },
  { tipo: 'CNH categoria C',          categoria: 'habilitacao', validadeMeses: 36,   diasAlerta: 60, obrigatorio: false },
  { tipo: 'CNH categoria D',          categoria: 'habilitacao', validadeMeses: 36,   diasAlerta: 60, obrigatorio: false },
  { tipo: 'CNH categoria E',          categoria: 'habilitacao', validadeMeses: 36,   diasAlerta: 60, obrigatorio: false },
  { tipo: 'EAR (Exerce Atividade Remunerada)', categoria: 'habilitacao', validadeMeses: 36, diasAlerta: 60, obrigatorio: false },
  { tipo: 'Curso MOPP',               categoria: 'habilitacao', validadeMeses: 60,   diasAlerta: 90, obrigatorio: false },
  { tipo: 'Curso Transporte de Passageiros', categoria: 'habilitacao', validadeMeses: 60, diasAlerta: 90, obrigatorio: false },
  { tipo: 'Curso Transporte de Cargas', categoria: 'habilitacao', validadeMeses: 60, diasAlerta: 90, obrigatorio: false },
  { tipo: 'Curso Direção Defensiva',  categoria: 'habilitacao', validadeMeses: 60,   diasAlerta: 90, obrigatorio: false },
  { tipo: 'Certidão Antecedentes',    categoria: 'habilitacao', validadeMeses: 6,    diasAlerta: 30, obrigatorio: false },

  // ── Treinamento (NRs) ────────────────────────────────────────────────────
  { tipo: 'NR-06 - EPI',              categoria: 'treinamento', validadeMeses: 24,   diasAlerta: 90, obrigatorio: false },
  { tipo: 'NR-10 - Elétrica básico',  categoria: 'treinamento', validadeMeses: 24,   diasAlerta: 90, obrigatorio: false },
  { tipo: 'NR-10 SEP',                categoria: 'treinamento', validadeMeses: 24,   diasAlerta: 90, obrigatorio: false },
  { tipo: 'NR-11 - Empilhadeira',     categoria: 'treinamento', validadeMeses: 36,   diasAlerta: 90, obrigatorio: false },
  { tipo: 'NR-12 - Máquinas',         categoria: 'treinamento', validadeMeses: 24,   diasAlerta: 90, obrigatorio: false },
  { tipo: 'NR-17 - Ergonomia',        categoria: 'treinamento', validadeMeses: 24,   diasAlerta: 90, obrigatorio: false },
  { tipo: 'NR-20 - Inflamáveis',      categoria: 'treinamento', validadeMeses: 36,   diasAlerta: 90, obrigatorio: false },
  { tipo: 'NR-23 - Combate a incêndio', categoria: 'treinamento', validadeMeses: 24, diasAlerta: 90, obrigatorio: false },
  { tipo: 'NR-33 - Espaço confinado', categoria: 'treinamento', validadeMeses: 12,   diasAlerta: 60, obrigatorio: false },
  { tipo: 'NR-35 - Trabalho em altura',categoria: 'treinamento',validadeMeses: 24,   diasAlerta: 60, obrigatorio: false },
  { tipo: 'Brigada de Incêndio',      categoria: 'treinamento', validadeMeses: 12,   diasAlerta: 60, obrigatorio: false },
  { tipo: 'Integração / Onboarding',  categoria: 'treinamento', validadeMeses: null, diasAlerta: 0,  obrigatorio: true  },
  { tipo: 'CIPA',                     categoria: 'treinamento', validadeMeses: 12,   diasAlerta: 60, obrigatorio: false },
  { tipo: 'Primeiros Socorros',       categoria: 'treinamento', validadeMeses: 24,   diasAlerta: 90, obrigatorio: false },

  // ── Contratual ───────────────────────────────────────────────────────────
  { tipo: 'Contrato de Trabalho',     categoria: 'contratual',  validadeMeses: null, diasAlerta: 0,  obrigatorio: true  },
  { tipo: 'Contrato de Experiência',  categoria: 'contratual',  validadeMeses: 3,    diasAlerta: 15, obrigatorio: false },
  { tipo: 'Aditivo Contratual',       categoria: 'contratual',  validadeMeses: null, diasAlerta: 0,  obrigatorio: false },
  { tipo: 'Acordo de Horas Extras',   categoria: 'contratual',  validadeMeses: 12,   diasAlerta: 30, obrigatorio: false },
  { tipo: 'Acordo de Compensação',    categoria: 'contratual',  validadeMeses: 12,   diasAlerta: 30, obrigatorio: false },
  { tipo: 'Acordo de Banco de Horas', categoria: 'contratual',  validadeMeses: 24,   diasAlerta: 60, obrigatorio: false },
  { tipo: 'Termo de Confidencialidade',categoria: 'contratual', validadeMeses: null, diasAlerta: 0,  obrigatorio: false },
  { tipo: 'Termo de Responsabilidade EPI', categoria: 'contratual', validadeMeses: null, diasAlerta: 0, obrigatorio: false },
  { tipo: 'Termo de Vale Transporte', categoria: 'contratual',  validadeMeses: null, diasAlerta: 0,  obrigatorio: false },
  { tipo: 'Procuração',               categoria: 'contratual',  validadeMeses: 12,   diasAlerta: 30, obrigatorio: false },
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

// Dado uma data de emissão (ou hoje), devolve a data de validade típica.
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

// Status visual a partir de data_validade e dias_alerta (espelha o backend).
export function calcularStatus(doc, hoje = new Date()) {
  if (doc.status === 'nao_se_aplica') return 'nao_se_aplica'
  if (!doc.data_validade) {
    // Sem data de validade — se o tipo for "sem validade" no catálogo (RG, CPF,
    // CTPS, contrato, termos), trata como vigente em vez de pendente.
    const catalogo = findTipoCatalogo(doc.tipo_documento)
    if (catalogo && catalogo.validadeMeses === null) return 'vigente_sem_validade'
    return doc.status || 'pendente'
  }
  const validade = new Date(`${doc.data_validade}T00:00:00`)
  if (Number.isNaN(validade.getTime())) return doc.status || 'pendente'
  const diff = Math.floor((validade - hoje) / 86400000)
  const alerta = Number.isFinite(Number(doc.dias_alerta)) ? Number(doc.dias_alerta) : 30
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

// Quantos dias o documento foi emitido valendo (data_emissao -> data_validade).
export function calcularPrazoValidadeDias(doc) {
  if (!doc.data_emissao || !doc.data_validade) return null
  const emi = new Date(`${doc.data_emissao}T00:00:00`)
  const val = new Date(`${doc.data_validade}T00:00:00`)
  if (Number.isNaN(emi.getTime()) || Number.isNaN(val.getTime())) return null
  return Math.round((val - emi) / 86400000)
}

// Soma N dias a uma data ISO (ou hoje, se vazio). Retorna 'YYYY-MM-DD'.
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

export const STATUS_COLORS = {
  vigente:              { bg: '#edf8f2', border: '#98cdb0', text: '#1f5234' },
  vigente_sem_validade: { bg: '#edf8f2', border: '#98cdb0', text: '#1f5234' },
  vence_em_breve:       { bg: '#fef8e6', border: '#e0c76a', text: '#7a4f00' },
  vencido:              { bg: '#fdf0ef', border: '#e8b4af', text: '#8a2419' },
  pendente:             { bg: '#eef2f7', border: '#c0cad5', text: '#3a4a5a' },
  nao_se_aplica:        { bg: '#f4f4f4', border: '#d0d0d0', text: '#6a6a6a' },
}

// Tipos obrigatórios mínimos para a "matriz colaborador × documento".
export const TIPOS_OBRIGATORIOS_PADRAO = TIPOS_DOCUMENTOS
  .filter((t) => t.obrigatorio)
  .map((t) => t.tipo)

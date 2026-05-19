// Catálogo de tipos de vínculo contratual e fases (apenas CLT tem fases).

export const TIPOS_VINCULO = [
  { value: 'clt',         label: 'CLT',                cor: '#1f4d8a', descricao: 'Carteira assinada — experiência 45+45 dias e depois prazo indeterminado.' },
  { value: 'estagio',     label: 'Estágio',            cor: '#2a6e47', descricao: 'Lei 11.788. Termo de compromisso entre estagiário, instituição de ensino e empresa.' },
  { value: 'pj',          label: 'PJ / Autônomo',      cor: '#5a4a8a', descricao: 'Contrato de prestação de serviço com pessoa jurídica ou autônomo.' },
  { value: 'temporario',  label: 'Temporário (Lei 6019)', cor: '#8a5c00', descricao: 'Contrato por prazo determinado, máximo 180 dias (prorrogável por mais 90).' },
  { value: 'aprendiz',    label: 'Aprendiz',           cor: '#7a4f00', descricao: 'Contrato de aprendizagem, duração máxima de 2 anos.' },
]

export const TIPO_VINCULO_LABELS = Object.fromEntries(TIPOS_VINCULO.map((t) => [t.value, t.label]))
export const TIPO_VINCULO_CORES = Object.fromEntries(TIPOS_VINCULO.map((t) => [t.value, t.cor]))

// Fases — válidas só para CLT. Outros tipos usam 'termo_unico' ou 'renovacao'.
export const FASES_CLT = [
  { value: 'experiencia',   label: '1ª fase: Experiência (45 dias)',           duracaoDias: 45,   proximaFase: 'prorrogacao' },
  { value: 'prorrogacao',   label: '2ª fase: Prorrogação (+45 dias)',          duracaoDias: 45,   proximaFase: 'indeterminado' },
  { value: 'indeterminado', label: '3ª fase: Prazo indeterminado',             duracaoDias: null, proximaFase: null },
]

export const FASE_LABELS = {
  experiencia:   '1ª fase — Experiência (45d)',
  prorrogacao:   '2ª fase — Prorrogação (+45d)',
  indeterminado: 'Indeterminado',
  termo_unico:   'Termo único',
  renovacao:     'Renovação',
}

export function findFaseClt(fase) {
  return FASES_CLT.find((f) => f.value === fase) || null
}

// Status calculado de um contrato (frontend) — usa hoje como referência.
// Possíveis: 'vigente', 'vence_em_breve', 'vencido', 'encerrado', 'sem_inicio'.
export function calcularStatusContrato(contrato, hoje = new Date(), diasAlerta = 15) {
  if (!contrato) return 'sem_inicio'
  if (contrato.data_desligamento) return 'encerrado'
  if (!contrato.data_inicio) return 'sem_inicio'

  // Sem data fim (ex.: indeterminado em curso) → vigente
  if (!contrato.data_fim) return 'vigente'

  const fim = new Date(`${contrato.data_fim}T00:00:00`)
  if (Number.isNaN(fim.getTime())) return 'vigente'
  const diff = Math.floor((fim - hoje) / 86400000)
  if (diff < 0) return 'vencido'
  if (diff <= diasAlerta) return 'vence_em_breve'
  return 'vigente'
}

export const STATUS_CONTRATO_LABELS = {
  vigente:        'Vigente',
  vence_em_breve: 'Vence em breve',
  vencido:        'Vencido — definir próximo passo',
  encerrado:      'Encerrado (desligado)',
  sem_inicio:     'Sem data de início',
}

// Soma N dias a uma data ISO. Retorna 'YYYY-MM-DD'.
export function somarDiasIso(baseIso, dias) {
  if (!baseIso || dias == null) return null
  const base = new Date(`${baseIso}T00:00:00`)
  if (Number.isNaN(base.getTime())) return null
  base.setDate(base.getDate() + Number(dias))
  const y = base.getFullYear()
  const m = String(base.getMonth() + 1).padStart(2, '0')
  const d = String(base.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Dado um contrato CLT em experiencia/prorrogacao, calcula a próxima fase.
// Retorna { fase, data_inicio, data_fim } ou null se não pode avançar.
export function calcularProximaFaseClt(contratoAtual) {
  if (!contratoAtual || contratoAtual.tipo_vinculo !== 'clt') return null
  const atual = findFaseClt(contratoAtual.fase)
  if (!atual || !atual.proximaFase) return null
  const proxima = findFaseClt(atual.proximaFase)
  // Próxima fase começa no dia seguinte ao fim da atual (ou hoje se não há fim)
  const inicio = contratoAtual.data_fim
    ? somarDiasIso(contratoAtual.data_fim, 1)
    : new Date().toISOString().slice(0, 10)
  const fim = proxima?.duracaoDias ? somarDiasIso(inicio, proxima.duracaoDias - 1) : null
  return {
    fase: proxima ? proxima.value : 'indeterminado',
    data_inicio: inicio,
    data_fim: fim,
  }
}

export function podeProrrogarClt(contrato) {
  if (!contrato || contrato.tipo_vinculo !== 'clt') return false
  if (contrato.data_desligamento) return false
  return contrato.fase === 'experiencia' || contrato.fase === 'prorrogacao'
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import '../styles/acompanhamento.css'

// ─── Constantes ──────────────────────────────────────────────────────────────

const TIPOS = {
  manutencoes:    'Manutenção',
  pedidos_compra: 'Pedido de Compra',
  horas_extras:   'Hora Extra',
  abastecimentos: 'Abastecimento',
  pneus:          'Pneu',
}

const REEMBOLSO_LABEL = {
  pix:          'PIX',
  dinheiro:     'Dinheiro em espécie',
  transferencia:'Transferência bancária',
  cartao:       'Cartão',
}

const FORMA_PAG_LABEL = {
  dinheiro:          'Dinheiro',
  pix:               'PIX',
  cartao_debito:     'Cartão débito',
  cartao_credito:    'Cartão crédito',
  boleto:            'Boleto',
  credito_fornecedor:'Crédito fornecedor',
}

const STATUS_PENDENTE  = ['pendente', 'pendente_aprovacao', 'aguardando_aprovacao', 'solicitado', 'analise', 'em_analise']
const STATUS_EM_ANALISE = ['analise', 'em_analise']
const STATUS_APROVADO  = ['aprovado', 'aprovada']
const STATUS_REJEITADO = ['reprovado', 'reprovada', 'cancelado']

const STATUS_LABEL = {
  pendente:             'Pendente',
  pendente_aprovacao:   'Pendente',
  aguardando_aprovacao: 'Aguard. Aprovação',
  solicitado:           'Solicitado',
  analise:              'Em Análise',
  em_analise:           'Em Análise',
  aprovado:             'Aprovado',
  aprovada:             'Aprovada',
  reprovado:            'Reprovado',
  reprovada:            'Reprovada',
  cancelado:            'Cancelado',
  aberta:               'Aberta',
  em_execucao:          'Em Execução',
  concluida:            'Concluída',
}

// Campos a exibir no modal por tipo, em ordem
const CAMPOS_MODAL = {
  manutencoes: [
    { k: 'numero_solicitacao', l: 'N° Solicitação' },
    { k: 'titulo',           l: 'Título' },
    { k: 'tipo_manutencao',  l: 'Tipo de manutenção' },
    { k: 'descricao',        l: 'Descrição', full: true },
    { k: 'prioridade',       l: 'Prioridade' },
    { k: 'data_abertura',    l: 'Data de abertura', date: true },
    { k: 'veiculo_id',       l: 'ID Veículo' },
    { k: 'km_atual',         l: 'KM atual' },
    { k: 'valor_estimado',   l: 'Valor estimado', moeda: true },
    { k: 'fornecedor',       l: 'Fornecedor' },
    { k: 'observacoes',      l: 'Observações', full: true },
  ],
  abastecimentos: [
    { k: 'numero_solicitacao', l: 'N° Solicitação' },
    { k: 'veiculo_id',         l: 'ID Veículo' },
    { k: 'tipo_combustivel',   l: 'Combustível' },
    { k: 'litros',             l: 'Litros' },
    { k: 'valor_litro',        l: 'Valor/litro', moeda: true },
    { k: 'valor_total',        l: 'Total', moeda: true },
    { k: 'data_abastecimento', l: 'Data', date: true },
    { k: 'km_atual',           l: 'KM atual' },
    { k: 'posto',              l: 'Posto' },
    { k: 'observacoes',        l: 'Observações', full: true },
  ],
  pedidos_compra: [
    { k: 'numero_solicitacao', l: 'N° Solicitação' },
    { k: 'numero_pedido',    l: 'N° Pedido' },
    { k: 'fornecedor',       l: 'Fornecedor' },
    { k: 'data_pedido',      l: 'Data do pedido', date: true },
    { k: 'data_necessidade', l: 'Necessário até', date: true },
    { k: 'forma_pagamento',  l: 'Forma de pagamento', formaPag: true },
    { k: 'prazo_pagamento',  l: 'Prazo de pagamento' },
    { k: 'centro_custo',     l: 'Centro de custo' },
    { k: 'valor_total_calculado', l: 'Valor total', moeda: true },
    { k: 'tipo_reembolso',   l: 'Tipo de reembolso', reembolso: true },
    { k: 'chave_pix',        l: 'Chave PIX' },
    { k: 'dados_bancarios',  l: 'Dados bancários', full: true },
    { k: 'observacoes',      l: 'Observações', full: true },
  ],
  horas_extras: [
    { k: 'numero_solicitacao', l: 'N° Solicitação' },
    { k: 'colaborador_nome',   l: 'Colaborador' },
    { k: 'data_hora_inicio',   l: 'Início', datetime: true },
    { k: 'data_hora_fim',      l: 'Fim', datetime: true },
    { k: 'total_horas',        l: 'Total horas' },
    { k: 'data_solicitacao',   l: 'Data solicitação', date: true },
    { k: 'justificativa',      l: 'Justificativa', full: true },
    { k: 'justificativa_gestor', l: 'Parecer do gestor', full: true },
  ],
  pneus: [
    { k: 'numero_solicitacao', l: 'N° Solicitação' },
    { k: 'veiculo_id',     l: 'ID Veículo' },
    { k: 'posicao',        l: 'Posição' },
    { k: 'marca',          l: 'Marca' },
    { k: 'modelo',         l: 'Modelo' },
    { k: 'medida',         l: 'Medida' },
    { k: 'sulco_atual',    l: 'Sulco atual (mm)' },
    { k: 'data_instalacao',l: 'Data instalação', date: true },
    { k: 'km_instalacao',  l: 'KM instalação' },
    { k: 'observacoes',    l: 'Observações', full: true },
  ],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusTone(status) {
  if (STATUS_APROVADO.includes(status))   return 'success'
  if (STATUS_REJEITADO.includes(status))  return 'danger'
  if (STATUS_EM_ANALISE.includes(status)) return 'warning'
  if (STATUS_PENDENTE.includes(status))   return 'neutral'
  return 'neutral'
}

function fmtDate(d) {
  if (!d) return null
  const p = String(d).slice(0, 10).split('-')
  return `${p[2]}/${p[1]}/${p[0]}`
}

function fmtDatetime(d) {
  if (!d) return null
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtMoeda(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function buildDetalhesResumido(s) {
  const fi = s.full_item || {}
  const out = []
  if (fi.valor_estimado != null) out.push(`Valor: ${fmtMoeda(fi.valor_estimado)}`)
  if (fi.fornecedor)             out.push(`Fornecedor: ${fi.fornecedor}`)
  if (fi.colaborador_nome)       out.push(fi.colaborador_nome)
  if (fi.litros != null)         out.push(`${fi.litros} L ${fi.tipo_combustivel || ''}`)
  if (s.resource_type === 'abastecimentos' && fi.valor_litro != null && fi.litros != null)
    out.push(`Total: ${fmtMoeda(fi.valor_litro * fi.litros)}`)
  if (fi.posicao)                out.push(`Pos: ${fi.posicao}`)
  if (fi.marca || fi.modelo)     out.push([fi.marca, fi.modelo].filter(Boolean).join(' '))
  return out.slice(0, 3)
}

const TABS = [
  { id: 'pendentes',  label: 'Pendentes' },
  { id: 'aprovadas',  label: 'Aprovadas' },
  { id: 'rejeitadas', label: 'Rejeitadas' },
  { id: 'todas',      label: 'Todas' },
  { id: 'historico',  label: 'Histórico' },
]

// ─── Modal de atendimento ─────────────────────────────────────────────────────

function ModalAtender({ solicitacao, onClose, onRefresh, podeAprovar, podeAnalisar, isSuperAdmin }) {
  const [acao, setAcao]         = useState(null) // 'analisar' | 'aprovar' | 'rejeitar'
  const [motivo, setMotivo]     = useState('')
  const [processando, setProc]  = useState(false)
  const [erroAcao, setErroAcao] = useState('')

  // Garante que o erro da ação anterior nunca aparece em outro modo
  useEffect(() => { setErroAcao('') }, [acao])

  const fi    = solicitacao.full_item || {}
  const tipo  = solicitacao.resource_type
  const campos = CAMPOS_MODAL[tipo] || []

  const isPedido    = tipo === 'pedidos_compra'
  const statusAtual = solicitacao.status
  const estaEmAnalise = STATUS_EM_ANALISE.includes(statusAtual)
  const estaPendente  = STATUS_PENDENTE.includes(statusAtual) && !estaEmAnalise

  function renderValor(campo) {
    const v = fi[campo.k]
    if (v == null || v === '') return null
    if (campo.moeda)    return fmtMoeda(v)
    if (campo.date)     return fmtDate(v)
    if (campo.datetime) return fmtDatetime(v)
    if (campo.reembolso) return REEMBOLSO_LABEL[v] || v
    if (campo.formaPag)  return FORMA_PAG_LABEL[v] || v
    return String(v)
  }

  async function confirmar(acaoOverride) {
    const _acao = acaoOverride || acao
    if (_acao === 'rejeitar' && !motivo.trim()) {
      setErroAcao('Informe o motivo da rejeição.')
      return
    }
    setErroAcao('')
    setProc(true)
    try {
      if (_acao === 'analisar') {
        await api.emAnalise(solicitacao.id)
      } else if (_acao === 'aprovar') {
        await api.approveRequest(solicitacao.id, tipo, motivo)
      } else {
        await api.rejectRequest(solicitacao.id, tipo, motivo)
      }
      onRefresh()
      onClose()
    } catch (err) {
      setErroAcao(err.message || 'Falha ao processar.')
      setProc(false)
    }
  }

  return (
    <div className="acomp-overlay" onClick={!processando ? onClose : undefined}>
      <div className="acomp-modal acomp-modal-lg" onClick={e => e.stopPropagation()}>

        {/* Cabeçalho */}
        <div className="acomp-modal-hdr">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`acomp-tipo tipo-${tipo}`}>{TIPOS[tipo] || tipo}</span>
            <span className={`status-chip tone-${statusTone(solicitacao.status)}`}>
              {STATUS_LABEL[solicitacao.status] || solicitacao.status}
            </span>
            {fi.numero_solicitacao && (
              <span className="acomp-num-sol">{fi.numero_solicitacao}</span>
            )}
          </div>
          <button type="button" className="button-secondary" onClick={onClose} disabled={processando}>✕</button>
        </div>

        <div style={{ padding: '0 16px 16px' }}>
          {/* Título */}
          <h2 style={{ margin: '12px 0 10px', fontSize: 15 }}>
            {solicitacao.titulo || `#${solicitacao.id}`}
          </h2>

          {/* Grade de campos */}
          <div className="acomp-campos-grid">
            {campos.map(campo => {
              const val = renderValor(campo)
              if (val == null) return null
              return (
                <div
                  key={campo.k}
                  className={`acomp-campo-item${campo.full ? ' acomp-campo-full' : ''}`}
                >
                  <span className="acomp-campo-label">{campo.l}</span>
                  <span className="acomp-campo-valor">{val}</span>
                </div>
              )
            })}
          </div>

          {/* Itens do pedido (apenas pedidos_compra) */}
          {isPedido && Array.isArray(fi.itens) && fi.itens.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 8 }}>
                Itens do pedido ({fi.itens.length})
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border, #e5e5e5)' }}>
                      <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Descrição</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Categoria</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Qtd</th>
                      <th style={{ textAlign: 'left', padding: '4px 4px', color: 'var(--text-muted)', fontWeight: 600 }}>Un</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Valor unit.</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fi.itens.map((it, i) => (
                      <tr key={it.id || i} style={{ borderBottom: '1px solid var(--border, #f0f0f0)' }}>
                        <td style={{ padding: '5px 8px' }}>{it.descricao}</td>
                        <td style={{ padding: '5px 8px', color: 'var(--text-muted)' }}>{it.categoria}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>{it.quantidade}</td>
                        <td style={{ padding: '5px 4px', color: 'var(--text-muted)' }}>{it.unidade}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>{fmtMoeda(it.valor_unitario)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>{fmtMoeda(it.total_item)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>Total:</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--success, #1a7340)' }}>
                        {fmtMoeda(fi.valor_total_calculado || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Histórico de aprovação */}
          {isSuperAdmin && (fi.em_analise_por || fi.aprovado_por || fi.reprovado_por) && (
            <div className="acomp-hist-bloco">
              {fi.em_analise_por && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 4 }}>
                  <span>🔍</span>
                  <span>
                    Em análise por <strong>{fi.em_analise_por_nome || `#${fi.em_analise_por}`}</strong>
                    {fi.em_analise_em && ` — ${fmtDatetime(fi.em_analise_em)}`}
                  </span>
                </div>
              )}
              {fi.aprovado_por && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--success, #1a7340)', marginBottom: 4 }}>
                  <span>✅</span>
                  <span>
                    Aprovado por <strong>{fi.aprovado_por_nome || `#${fi.aprovado_por}`}</strong>
                    {fi.aprovado_em && ` — ${fmtDatetime(fi.aprovado_em)}`}
                  </span>
                </div>
              )}
              {fi.reprovado_por && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, color: 'var(--danger, #c00)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>❌</span>
                    <span>
                      Reprovado por <strong>{fi.reprovado_por_nome || `#${fi.reprovado_por}`}</strong>
                      {fi.reprovado_em && ` — ${fmtDatetime(fi.reprovado_em)}`}
                    </span>
                  </div>
                  {fi.motivo_reprovacao && (
                    <div style={{ marginLeft: 22, fontStyle: 'italic', fontSize: 11 }}>
                      "{fi.motivo_reprovacao}"
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Ações */}
          {STATUS_PENDENTE.includes(solicitacao.status) && (() => {
            let podeFazerAlgo = false
            let acaoPrimaria  = null
            let labelPrimaria = ''
            let labelBtnPrimario = ''

            if (isPedido) {
              if (estaPendente && podeAnalisar) {
                podeFazerAlgo   = true
                acaoPrimaria    = 'analisar'
                labelPrimaria   = 'Aprovar'
                labelBtnPrimario = processando ? 'Aprovando...' : 'Aprovar'
              } else if (estaEmAnalise && podeAprovar) {
                podeFazerAlgo   = true
                acaoPrimaria    = 'aprovar'
                labelPrimaria   = 'Aprovar pedido'
                labelBtnPrimario = processando ? 'Aprovando...' : 'Aprovar pedido'
              }
            } else if (podeAprovar) {
              podeFazerAlgo   = true
              acaoPrimaria    = 'aprovar'
              labelPrimaria   = 'Aprovar solicitação'
              labelBtnPrimario = processando ? 'Aprovando...' : 'Aprovar solicitação'
            }

            if (!podeFazerAlgo) {
              return (
                <div className="alert-warn" style={{ marginTop: 12 }}>
                  {isPedido && estaPendente
                    ? 'Aguardando analista iniciar análise. Você não tem permissão para esta etapa.'
                    : isPedido && estaEmAnalise
                    ? 'Aguardando aprovação. Você não tem permissão para aprovar.'
                    : 'Você não tem permissão para aprovar este tipo de solicitação.'}
                </div>
              )
            }

            function cancelarAcao() { setAcao(null); setMotivo(''); setErroAcao('') }

            return (
              <div className="acomp-modal-acoes">
                {/* ── Botões iniciais ── */}
                {acao === null && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="button-secondary acomp-btn-no"
                      style={{ flex: 1 }}
                      onClick={() => { setAcao('rejeitar'); setMotivo(''); setErroAcao('') }}
                      disabled={processando}
                    >
                      Rejeitar
                    </button>
                    <button
                      type="button"
                      className="button-primary"
                      style={{ flex: 1 }}
                      onClick={() => {
                        if (acaoPrimaria === 'analisar') {
                          confirmar('analisar')
                        } else {
                          setMotivo('')
                          setAcao('aprovar')
                        }
                      }}
                      disabled={processando}
                    >
                      {processando ? 'Processando...' : labelPrimaria}
                    </button>
                  </div>
                )}

                {/* ── Painel de aprovação ── */}
                {acao === 'aprovar' && (
                  <div style={{
                    border: '1px solid #c3e6cb', borderRadius: 8,
                    background: 'rgba(40,167,69,0.06)', padding: '14px 16px',
                    display: 'grid', gap: 10,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success, #1a7340)' }}>
                      Confirmar aprovação de: <em style={{ fontWeight: 400 }}>{solicitacao.titulo || `#${solicitacao.id}`}</em>
                    </div>
                    <label className="field" style={{ margin: 0 }}>
                      <span>Comentário (opcional)</span>
                      <textarea
                        rows={2}
                        placeholder="Deixe um comentário sobre esta aprovação..."
                        value={motivo}
                        onChange={e => setMotivo(e.target.value)}
                        disabled={processando}
                        style={{ resize: 'vertical' }}
                      />
                    </label>
                    {erroAcao && <div className="alert-error">{erroAcao}</div>}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button type="button" className="button-secondary" onClick={cancelarAcao} disabled={processando}>
                        Cancelar
                      </button>
                      <button type="button" className="button-primary" onClick={() => confirmar()} disabled={processando}>
                        {processando ? 'Aprovando...' : 'Confirmar aprovação'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Painel de rejeição ── */}
                {acao === 'rejeitar' && (
                  <div style={{
                    border: '1px solid #f5c6cb', borderRadius: 8,
                    background: 'rgba(220,53,69,0.05)', padding: '14px 16px',
                    display: 'grid', gap: 10,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger, #c00)' }}>
                      Rejeitar: <em style={{ fontWeight: 400 }}>{solicitacao.titulo || `#${solicitacao.id}`}</em>
                    </div>
                    <label className="field" style={{ margin: 0 }}>
                      <span>Motivo da rejeição <strong style={{ color: 'var(--danger,#c00)' }}>*</strong></span>
                      <textarea
                        rows={2}
                        placeholder="Explique o motivo da rejeição..."
                        value={motivo}
                        onChange={e => setMotivo(e.target.value)}
                        disabled={processando}
                        style={{ resize: 'vertical' }}
                      />
                    </label>
                    {erroAcao && <div className="alert-error">{erroAcao}</div>}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button type="button" className="button-secondary" onClick={cancelarAcao} disabled={processando}>
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="button-secondary acomp-btn-no"
                        onClick={() => confirmar()}
                        disabled={processando || !motivo.trim()}
                        style={{ padding: '5px 14px' }}
                      >
                        {processando ? 'Rejeitando...' : 'Confirmar rejeição'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AcompanhamentoPage() {
  const { profile } = useAuth()
  const permissoes = profile?.permission_scopes || []

  const [solicitacoes, setSolicitacoes] = useState([])
  const [historico, setHistorico]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [erro, setErro]                 = useState('')
  const [aba, setAba]                   = useState('pendentes')
  const [fTipo, setFTipo]               = useState('')
  const [fBusca, setFBusca]             = useState('')
  const [atendendo, setAtendendo]       = useState(null)
  const _loaded = useRef(false)

  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 30000)
    return () => clearInterval(t)
  }, [])

  async function carregar() {
    try {
      if (!_loaded.current) setLoading(true)
      setErro('')
      const [apRes, histRes] = await Promise.all([
        api.getApprovals({ limit: 500, status: 'all' }),
        api.getApprovalsHistory({ days: 30, limit: 100 }),
      ])
      setSolicitacoes(apRes.items || [])
      setHistorico(histRes.items || [])
    } catch (err) {
      setErro('Falha ao carregar solicitações.')
    } finally {
      _loaded.current = true
      setLoading(false)
    }
  }

  function podeAprovar(resourceType) {
    return (
      permissoes.includes('admin') ||
      permissoes.includes(`aprovar.${resourceType}`)
    )
  }

  function podeAnalisar(resourceType) {
    return (
      permissoes.includes('admin') ||
      permissoes.includes(`analisar.${resourceType}`)
    )
  }

  const stats = useMemo(() => ({
    pendentes:  solicitacoes.filter(s => STATUS_PENDENTE.includes(s.status)).length,
    aprovadas:  solicitacoes.filter(s => STATUS_APROVADO.includes(s.status)).length,
    rejeitadas: solicitacoes.filter(s => STATUS_REJEITADO.includes(s.status)).length,
    total:      solicitacoes.length,
  }), [solicitacoes])

  const filtrada = useMemo(() => {
    let lista = solicitacoes
    if (aba === 'pendentes')  lista = lista.filter(s => STATUS_PENDENTE.includes(s.status))
    if (aba === 'aprovadas')  lista = lista.filter(s => STATUS_APROVADO.includes(s.status))
    if (aba === 'rejeitadas') lista = lista.filter(s => STATUS_REJEITADO.includes(s.status))
    if (fTipo) lista = lista.filter(s => s.resource_type === fTipo)
    const q = fBusca.trim().toLowerCase()
    if (q) lista = lista.filter(s =>
      [s.titulo, s.resource_type].filter(Boolean).some(v => String(v).toLowerCase().includes(q))
    )
    return lista
  }, [solicitacoes, aba, fTipo, fBusca])

  const histFiltrado = useMemo(() => {
    const q = fBusca.trim().toLowerCase()
    if (!q) return historico
    return historico.filter(h =>
      [h.recurso, h.nome_colaborador].filter(Boolean).some(v => String(v).toLowerCase().includes(q))
    )
  }, [historico, fBusca])

  return (
    <section className="page-shell">
      {/* Cabeçalho */}
      <div className="page-header">
        <div>
          <span className="eyebrow">Gestão</span>
          <h1>Acompanhamento de Aprovações</h1>
          <p>Visualize e gerencie aprovações de manutenções, horas extras, compras e outros recursos.</p>
        </div>
        <button className="button-secondary" onClick={carregar} type="button" disabled={loading}>
          {loading ? 'Carregando...' : '↻ Atualizar'}
        </button>
      </div>

      {/* KPIs clicáveis */}
      <div className="stats-grid">
        {[
          { label: 'Pendentes',  value: stats.pendentes,  tone: 'warning', tab: 'pendentes' },
          { label: 'Aprovadas',  value: stats.aprovadas,  tone: 'success', tab: 'aprovadas' },
          { label: 'Rejeitadas', value: stats.rejeitadas, tone: 'danger',  tab: 'rejeitadas' },
          { label: 'Total',      value: stats.total,      tone: 'neutral', tab: 'todas' },
        ].map(({ label, value, tone, tab }) => (
          <button
            key={tab}
            type="button"
            className={`surface-card stat-card acomp-kpi tone-${tone}${aba === tab ? ' is-active' : ''}`}
            onClick={() => setAba(tab)}
          >
            <span>{label}</span>
            <strong>{value}</strong>
          </button>
        ))}
      </div>

      {/* Tabs + filtros */}
      <div className="surface-card" style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              className={`button-secondary${aba === t.id ? ' active' : ''}`}
              onClick={() => setAba(t.id)}
            >
              {t.label}
              {t.id === 'pendentes' && stats.pendentes > 0 && (
                <span className="acomp-count-badge">{stats.pendentes}</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          <label className="field filter-field">
            <span>Tipo</span>
            <select value={fTipo} onChange={e => setFTipo(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(TIPOS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="field filter-field" style={{ gridColumn: 'span 3' }}>
            <span>Buscar</span>
            <input
              type="text"
              placeholder="Título, tipo, colaborador..."
              value={fBusca}
              onChange={e => setFBusca(e.target.value)}
            />
          </label>
        </div>
      </div>

      {erro && <div className="alert-error">{erro}</div>}

      {/* Tabela principal */}
      {aba !== 'historico' ? (
        <div className="surface-card">
          {loading ? (
            <div className="empty-state">Carregando solicitações...</div>
          ) : filtrada.length === 0 ? (
            <div className="empty-state">
              <strong>Nenhuma solicitação encontrada.</strong>
              <p>Tente ajustar os filtros ou aguarde novos registros.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="acomp-table">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>Tipo</th>
                    <th style={{ width: 100 }}>N° Solicitação</th>
                    <th>Título / Descrição</th>
                    <th style={{ width: 150 }}>Detalhes</th>
                    <th style={{ width: 90 }}>Data</th>
                    <th style={{ width: 120 }}>Status</th>
                    <th style={{ width: 100 }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrada.map(s => {
                    const detalhes = buildDetalhesResumido(s)
                    const numOs    = s.full_item?.numero_solicitacao
                    return (
                      <tr key={`${s.resource_type}-${s.id}`} className="acomp-row">
                        <td>
                          <span className={`acomp-tipo tipo-${s.resource_type}`}>
                            {TIPOS[s.resource_type] || s.resource_type}
                          </span>
                        </td>
                        <td>
                          {numOs
                            ? <span className="acomp-num-sol">{numOs}</span>
                            : <span style={{ color: 'var(--muted)' }}>—</span>
                          }
                        </td>
                        <td>
                          <strong style={{ fontSize: 11 }}>{s.titulo || `#${s.id}`}</strong>
                          {(s.detalhes?.aprovado_por || s.detalhes?.reprovado_por) && (
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                              {s.detalhes.aprovado_por && `Aprovado por: ${s.detalhes.aprovado_por}`}
                              {s.detalhes.reprovado_por && `Rejeitado: ${s.detalhes.motivo_reprovacao || ''}`}
                            </div>
                          )}
                        </td>
                        <td>
                          {detalhes.length > 0 ? (
                            <div className="acomp-detalhes">
                              {detalhes.map((d, i) => (
                                <span key={i} className="acomp-detalhe-item">{d}</span>
                              ))}
                            </div>
                          ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: 11 }}>
                          {fmtDate(s.data_criacao)}
                        </td>
                        <td>
                          <span className={`status-chip tone-${statusTone(s.status)}`}>
                            {STATUS_LABEL[s.status] || s.status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`button-secondary${STATUS_PENDENTE.includes(s.status) ? ' acomp-btn-atender-pendente' : ''}`}
                            onClick={() => setAtendendo(s)}
                          >
                            {STATUS_PENDENTE.includes(s.status) ? 'Atender' : 'Ver detalhes'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Tab Histórico */
        <div className="surface-card">
          {loading ? (
            <div className="empty-state">Carregando histórico...</div>
          ) : histFiltrado.length === 0 ? (
            <div className="empty-state">Nenhum registro nos últimos 30 dias.</div>
          ) : (
            <div className="table-wrap">
              <table className="acomp-table">
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>Tipo</th>
                    <th>Recurso</th>
                    <th style={{ width: 90 }}>Decisão</th>
                    <th style={{ width: 150 }}>Responsável</th>
                    <th style={{ width: 120 }}>Data/Hora</th>
                    <th>Comentário</th>
                  </tr>
                </thead>
                <tbody>
                  {histFiltrado.map((h, idx) => {
                    const tipo     = h.recurso?.split(':')[0] || ''
                    const aprovado = h.acao === 'approve'
                    return (
                      <tr key={h.id || idx} className="acomp-row">
                        <td>
                          <span className={`acomp-tipo tipo-${tipo}`}>
                            {TIPOS[tipo] || tipo || '—'}
                          </span>
                        </td>
                        <td style={{ fontSize: 11 }}>{h.recurso || '—'}</td>
                        <td>
                          <span className={`status-chip tone-${aprovado ? 'success' : 'danger'}`}>
                            {aprovado ? 'Aprovado' : 'Rejeitado'}
                          </span>
                        </td>
                        <td style={{ fontSize: 11 }}>{h.nome_colaborador || '—'}</td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 11, color: 'var(--muted)' }}>
                          {fmtDatetime(h.criado_em)}
                        </td>
                        <td style={{ fontSize: 10, color: 'var(--muted)' }}>
                          {h.detalhes?.comentario || h.detalhes?.motivo || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de atendimento */}
      {atendendo && (
        <ModalAtender
          solicitacao={atendendo}
          onClose={() => setAtendendo(null)}
          onRefresh={carregar}
          podeAprovar={podeAprovar(atendendo.resource_type)}
          podeAnalisar={podeAnalisar(atendendo.resource_type)}
          isSuperAdmin={profile?.is_super_admin}
        />
      )}
    </section>
  )
}

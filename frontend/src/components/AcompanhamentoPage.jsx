import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import '../styles/acompanhamento.css'

// ─── Constantes ──────────────────────────────────────────────────────────────

const TIPOS = {
  manutencoes:          'Manutenção',
  pedidos_compra:       'Pedido de Compra',
  horas_extras:         'Hora Extra',
  abastecimentos:       'Abastecimento',
  pneus:                'Pneu',
  diarias_solicitacoes: 'Diárias / Hotelaria',
}

const REEMBOLSO_LABEL = {
  pix: 'PIX', dinheiro: 'Dinheiro em espécie',
  transferencia: 'Transferência bancária', cartao: 'Cartão',
}

const FORMA_PAG_LABEL = {
  dinheiro: 'Dinheiro', pix: 'PIX',
  cartao_debito: 'Cartão débito', cartao_credito: 'Cartão crédito',
  boleto: 'Boleto', credito_fornecedor: 'Crédito fornecedor',
}

const STATUS_PENDENTE   = ['pendente', 'pendente_aprovacao', 'aguardando_aprovacao', 'solicitado', 'analise', 'em_analise', 'aprovado_lider']
const STATUS_EM_ANALISE = ['analise', 'em_analise']
const STATUS_APROVADO   = ['aprovado', 'aprovada']
const STATUS_REJEITADO  = ['reprovado', 'reprovada', 'cancelado']

const STATUS_LABEL = {
  pendente: 'Pendente', pendente_aprovacao: 'Pendente',
  aguardando_aprovacao: 'Aguard. Aprovação', solicitado: 'Solicitado',
  analise: 'Em Análise', em_analise: 'Em Análise',
  aprovado_lider: 'Aprovado p/ líder — aguardando etapa final',
  aprovado: 'Aprovado', aprovada: 'Aprovada',
  reprovado: 'Reprovado', reprovada: 'Reprovada',
  cancelado: 'Cancelado', aberta: 'Aberta',
  em_execucao: 'Em Execução', concluida: 'Concluída',
}

const CAMPOS_MODAL = {
  manutencoes: [
    { k: 'numero_solicitacao', l: 'N° Solicitação' },
    { k: 'titulo',            l: 'Título' },
    { k: 'tipo_manutencao',   l: 'Tipo de manutenção' },
    { k: 'descricao',         l: 'Descrição', full: true },
    { k: 'prioridade',        l: 'Prioridade' },
    { k: 'data_abertura',     l: 'Data de abertura', date: true },
    { k: 'veiculo_id',        l: 'ID Veículo' },
    { k: 'km_atual',          l: 'KM atual' },
    { k: 'valor_estimado',    l: 'Valor estimado', moeda: true },
    { k: 'fornecedor',        l: 'Fornecedor' },
    { k: 'observacoes',       l: 'Observações', full: true },
  ],
  abastecimentos: [
    { k: 'numero_solicitacao', l: 'N° Solicitação' },
    { k: 'os_motorista_id',    l: 'Vinc. à OS (ID)' },
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
    { k: 'numero_solicitacao',    l: 'N° Solicitação' },
    { k: 'numero_pedido',         l: 'N° Pedido' },
    { k: 'fornecedor',            l: 'Fornecedor' },
    { k: 'data_pedido',           l: 'Data do pedido', date: true },
    { k: 'data_necessidade',      l: 'Necessário até',  date: true },
    { k: 'forma_pagamento',       l: 'Forma de pagamento', formaPag: true },
    { k: 'prazo_pagamento',       l: 'Prazo de pagamento' },
    { k: 'centro_custo',          l: 'Centro de custo' },
    { k: 'valor_total_calculado', l: 'Valor total', moeda: true },
    { k: 'tipo_reembolso',        l: 'Tipo de reembolso', reembolso: true },
    { k: 'chave_pix',             l: 'Chave PIX' },
    { k: 'dados_bancarios',       l: 'Dados bancários', full: true },
    { k: 'observacoes',           l: 'Observações', full: true },
  ],
  horas_extras: [
    { k: 'numero_solicitacao',   l: 'N° Solicitação' },
    { k: 'os_motorista_id',      l: 'Vinc. à OS (ID)' },
    { k: 'colaborador_nome',     l: 'Colaborador' },
    { k: 'data_hora_inicio',     l: 'Início', datetime: true },
    { k: 'data_hora_fim',        l: 'Fim',    datetime: true },
    { k: 'total_horas',          l: 'Total horas' },
    { k: 'data_solicitacao',     l: 'Data solicitação', date: true },
    { k: 'justificativa',        l: 'Justificativa', full: true },
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
  diarias_solicitacoes: [
    { k: 'numero_solicitacao', l: 'N° Solicitação' },
    { k: 'os_motorista_id',    l: 'Vinc. à OS (ID)' },
    { k: 'cidade_destino',     l: 'Cidade destino' },
    { k: 'uf_destino',         l: 'UF' },
    { k: 'data_inicio',        l: 'Início', date: true },
    { k: 'data_fim',           l: 'Fim',    date: true },
    { k: 'rota',               l: 'Rota' },
    { k: 'banco',              l: 'Banco' },
    { k: 'valor_total',        l: 'Valor total', moeda: true },
    { k: 'observacoes',        l: 'Observações', full: true },
  ],
}

const TABS = [
  { id: 'pendentes',  label: 'Pendentes' },
  { id: 'aprovadas',  label: 'Aprovadas' },
  { id: 'rejeitadas', label: 'Rejeitadas' },
  { id: 'todas',      label: 'Todas' },
  { id: 'historico',  label: 'Histórico' },
]

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

const fmtMoeda = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

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
  if (s.resource_type === 'diarias_solicitacoes') {
    if (fi.cidade_destino) out.push(`${fi.cidade_destino}${fi.uf_destino ? '/' + fi.uf_destino : ''}`)
    if (fi.valor_total)    out.push(`Total: ${fmtMoeda(fi.valor_total)}`)
  }
  return out.slice(0, 3)
}

// ─── Editor de valores de diária (usado dentro do modal atender) ──────────────

function ValorInput({ valor, onChange, disabled, width = 90 }) {
  const [texto, setTexto] = useState(() => Number(valor || 0).toFixed(2).replace('.', ','))
  useEffect(() => { setTexto(Number(valor || 0).toFixed(2).replace('.', ',')) }, [valor])

  function aoSair() {
    const s = String(texto || '').replace(/\./g, '').replace(',', '.')
    const n = Number(s)
    if (Number.isFinite(n)) {
      onChange?.(n)
      setTexto(n.toFixed(2).replace('.', ','))
    } else {
      setTexto(Number(valor || 0).toFixed(2).replace('.', ','))
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ position: 'absolute', left: 6, fontSize: 11, color: 'var(--text-muted, #888)', pointerEvents: 'none' }}>R$</span>
      <input
        type="text"
        value={texto}
        disabled={disabled}
        onChange={(e) => setTexto(e.target.value.replace(/[^\d,.-]/g, ''))}
        onBlur={aoSair}
        style={{
          width, fontSize: 12, textAlign: 'right', padding: '4px 6px 4px 24px',
          border: '1px solid var(--border, #d1d5db)', borderRadius: 4, background: '#fff',
        }}
        placeholder="0,00"
      />
    </div>
  )
}

function recalcTotalItem(it) {
  const qtdD = Number(it.qtd_diarias || 0)
  const qtdP = Number(it.qtd_pernoites || 0)
  const valorDia =
    (it.inclui_cafe   ? Number(it.valor_cafe   || 0) : 0) +
    (it.inclui_almoco ? Number(it.valor_almoco || 0) : 0) +
    (it.inclui_jantar ? Number(it.valor_jantar || 0) : 0)
  return Number((valorDia * qtdD + Number(it.valor_pernoite || 0) * qtdP).toFixed(2))
}

function EditorDiaria({ itens, setItens, processando, carregando }) {
  function updItem(idx, patch) {
    setItens((arr) => arr.map((it, i) => {
      if (i !== idx) return it
      const next = { ...it, ...patch }
      next.valor_total = recalcTotalItem(next)
      return next
    }))
  }

  function aplicarParaTodos(patch) {
    setItens((arr) => arr.map((it) => {
      const next = { ...it, ...patch }
      next.valor_total = recalcTotalItem(next)
      return next
    }))
  }

  const total = useMemo(
    () => itens.reduce((acc, it) => acc + Number(it.valor_total || 0), 0),
    [itens],
  )

  if (carregando) {
    return (
      <div style={{
        border: '1px dashed var(--border, #d1d5db)', borderRadius: 8,
        padding: '20px', marginTop: 12, textAlign: 'center',
        color: 'var(--text-muted, #6b7280)', fontSize: 13,
      }}>
        ⏳ Carregando motoristas da solicitação…
      </div>
    )
  }

  if (itens.length === 0) {
    return <div className="alert-warn" style={{ marginTop: 12 }}>Nenhum motorista cadastrado nesta solicitação.</div>
  }

  const refeicoes = [
    { flag: 'inclui_cafe',   val: 'valor_cafe',   label: 'Café' },
    { flag: 'inclui_almoco', val: 'valor_almoco', label: 'Almoço' },
    { flag: 'inclui_jantar', val: 'valor_jantar', label: 'Jantar' },
  ]

  return (
    <div style={{
      border: '1px solid #c3e6cb', borderRadius: 10,
      background: 'linear-gradient(180deg, rgba(40,167,69,0.06), rgba(40,167,69,0.02))',
      padding: 16, marginTop: 12, display: 'grid', gap: 14,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success, #1a7340)', marginBottom: 2 }}>
          💰 Preencha os valores e aprove
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)' }}>
          Marque quais refeições estão inclusas, ajuste o valor de cada uma e a quantidade de diárias/pernoites. O total recalcula sozinho.
        </div>
      </div>

      {/* Atalho: copiar valores do primeiro pra todos */}
      {itens.length > 1 && (
        <div style={{
          background: '#fff', border: '1px dashed var(--border, #d1d5db)', borderRadius: 6,
          padding: '6px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: 'var(--text-muted)' }}>Atalho:</span>
          <button
            type="button"
            className="button-link"
            disabled={processando}
            onClick={() => {
              const ref = itens[0]
              aplicarParaTodos({
                inclui_cafe: ref.inclui_cafe, inclui_almoco: ref.inclui_almoco, inclui_jantar: ref.inclui_jantar,
                valor_cafe: ref.valor_cafe, valor_almoco: ref.valor_almoco,
                valor_jantar: ref.valor_jantar, valor_pernoite: ref.valor_pernoite,
              })
            }}
          >
            ↡ Aplicar valores do primeiro motorista a todos
          </button>
        </div>
      )}

      {/* Cards por motorista */}
      <div style={{ display: 'grid', gap: 10 }}>
        {itens.map((it, idx) => (
          <div
            key={it.id || idx}
            style={{
              background: '#fff', border: '1px solid var(--border, #e5e7eb)',
              borderRadius: 8, padding: 12, display: 'grid', gap: 10,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            {/* Cabeçalho do card */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>👤 {it.motorista_nome}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)' }}>
                  Placa: <strong>{it.placa || '—'}</strong>
                </div>
              </div>
              <div style={{
                background: '#1a7340', color: '#fff', padding: '6px 12px',
                borderRadius: 20, fontSize: 13, fontWeight: 700,
              }}>
                {fmtMoeda(it.valor_total)}
              </div>
            </div>

            {/* Refeições — toggle pill com valor */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                Refeições inclusas
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {refeicoes.map(({ flag, val, label }) => (
                  <label
                    key={flag}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', borderRadius: 6,
                      border: `1px solid ${it[flag] ? '#1a7340' : 'var(--border, #d1d5db)'}`,
                      background: it[flag] ? 'rgba(40,167,69,0.08)' : '#fafafa',
                      cursor: processando ? 'not-allowed' : 'pointer',
                      fontSize: 12,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!it[flag]}
                      disabled={processando}
                      onChange={(e) => updItem(idx, { [flag]: e.target.checked })}
                      style={{ margin: 0 }}
                    />
                    <span style={{ fontWeight: 600, minWidth: 50 }}>{label}</span>
                    <ValorInput
                      valor={it[val]}
                      disabled={processando || !it[flag]}
                      onChange={(v) => updItem(idx, { [val]: v })}
                      width={80}
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Pernoite + Qtds */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10,
            }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Pernoite (R$)</span>
                <ValorInput
                  valor={it.valor_pernoite}
                  disabled={processando}
                  onChange={(v) => updItem(idx, { valor_pernoite: v })}
                  width={100}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Qtd diárias</span>
                <input
                  type="number" min={0}
                  value={it.qtd_diarias}
                  disabled={processando}
                  onChange={(e) => updItem(idx, { qtd_diarias: Number(e.target.value) })}
                  style={{ width: 80, padding: '4px 6px', fontSize: 12, border: '1px solid var(--border, #d1d5db)', borderRadius: 4 }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Qtd pernoites</span>
                <input
                  type="number" min={0}
                  value={it.qtd_pernoites}
                  disabled={processando}
                  onChange={(e) => updItem(idx, { qtd_pernoites: Number(e.target.value) })}
                  style={{ width: 80, padding: '4px 6px', fontSize: 12, border: '1px solid var(--border, #d1d5db)', borderRadius: 4 }}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* Total geral */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: '#1a7340', color: '#fff', padding: '10px 14px', borderRadius: 8,
        fontSize: 14, fontWeight: 700,
      }}>
        <span>Total da solicitação</span>
        <span style={{ fontSize: 16 }}>{fmtMoeda(total)}</span>
      </div>
    </div>
  )
}

// ─── Modal de atendimento ─────────────────────────────────────────────────────

function ModalAtender({ solicitacao, onClose, onRefresh, podeAprovar, podeAnalisar, podeAprovarLider, isSuperAdmin }) {
  const [acao, setAcao]         = useState(null) // 'analisar' | 'aprovar' | 'rejeitar'
  const [motivo, setMotivo]     = useState('')
  const [processando, setProc]  = useState(false)
  const [erroAcao, setErroAcao] = useState('')
  const [itensDiaria, setItensDiaria] = useState([])
  const [loadingItens, setLoadingItens] = useState(false)

  useEffect(() => { setErroAcao('') }, [acao])

  const fi    = solicitacao.full_item || {}
  const tipo  = solicitacao.resource_type
  const campos = CAMPOS_MODAL[tipo] || []

  const isPedido      = tipo === 'pedidos_compra'
  const isDiaria      = tipo === 'diarias_solicitacoes'
  const statusAtual   = solicitacao.status
  const estaEmAnalise = STATUS_EM_ANALISE.includes(statusAtual)
  const estaPendente  = STATUS_PENDENTE.includes(statusAtual) && !estaEmAnalise

  // Carrega itens da diária ao abrir (retry simples em caso de falha transitória)
  useEffect(() => {
    if (!isDiaria) return
    let cancel = false
    setLoadingItens(true)
    setErroAcao('')
    ;(async () => {
      let lastErr = null
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await api.list('diarias_itens', { solicitacao_id: solicitacao.id })
          const rows = res?.data || res || []
          if (cancel) return
          setItensDiaria(rows.map((r) => ({ ...r, valor_total: recalcTotalItem(r) })))
          setLoadingItens(false)
          return
        } catch (e) {
          lastErr = e
          await new Promise((r) => setTimeout(r, 250 * attempt))
        }
      }
      if (!cancel) {
        setErroAcao(lastErr?.message || 'Falha ao carregar itens da diária.')
        setLoadingItens(false)
      }
    })()
    return () => { cancel = true }
  }, [isDiaria, solicitacao.id])

  function renderValor(campo) {
    const v = fi[campo.k]
    if (v == null || v === '') return null
    if (campo.moeda)     return fmtMoeda(v)
    if (campo.date)      return fmtDate(v)
    if (campo.datetime)  return fmtDatetime(v)
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
    setErroAcao(''); setProc(true)
    try {
      if (_acao === 'analisar') {
        await api.emAnalise(solicitacao.id)
      } else if (_acao === 'aprovar_lider') {
        await api.aprovarLider(solicitacao.id, tipo, motivo)
      } else if (_acao === 'aprovar') {
        // Para diárias: salva itens com valores + valor_total na solicitação antes de aprovar
        if (isDiaria) {
          const total = itensDiaria.reduce((acc, it) => acc + Number(it.valor_total || 0), 0)
          for (const it of itensDiaria) {
            await api.update('diarias_itens', it.id, {
              qtd_diarias:   Number(it.qtd_diarias   || 0),
              qtd_pernoites: Number(it.qtd_pernoites || 0),
              inclui_cafe:   !!it.inclui_cafe,
              inclui_almoco: !!it.inclui_almoco,
              inclui_jantar: !!it.inclui_jantar,
              valor_cafe:    Number(it.valor_cafe     || 0),
              valor_almoco:  Number(it.valor_almoco   || 0),
              valor_jantar:  Number(it.valor_jantar   || 0),
              valor_pernoite:Number(it.valor_pernoite || 0),
              valor_total:   Number(it.valor_total    || 0),
            })
          }
          await api.update('diarias_solicitacoes', solicitacao.id, { valor_total: Number(total.toFixed(2)) })
        }
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

  const cancelarAcao = () => { setAcao(null); setMotivo(''); setErroAcao('') }

  return (
    <div className="acomp-overlay" onClick={!processando ? onClose : undefined}>
      <div className="acomp-modal acomp-modal-lg" onClick={(e) => e.stopPropagation()}>

        {/* Cabeçalho */}
        <div className="acomp-modal-hdr">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`acomp-tipo tipo-${tipo}`}>{TIPOS[tipo] || tipo}</span>
            <span className={`status-chip tone-${statusTone(statusAtual)}`}>
              {STATUS_LABEL[statusAtual] || statusAtual}
            </span>
            {fi.numero_solicitacao && <span className="acomp-num-sol">{fi.numero_solicitacao}</span>}
          </div>
          <button type="button" className="button-secondary" onClick={onClose} disabled={processando}>✕</button>
        </div>

        <div style={{ padding: '0 16px 16px' }}>
          <h2 style={{ margin: '12px 0 10px', fontSize: 15 }}>
            {solicitacao.titulo || `#${solicitacao.id}`}
          </h2>

          {/* Grade de campos */}
          <div className="acomp-campos-grid">
            {campos.map((campo) => {
              const val = renderValor(campo)
              if (val == null) return null
              return (
                <div key={campo.k} className={`acomp-campo-item${campo.full ? ' acomp-campo-full' : ''}`}>
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
                      <th style={{ textAlign: 'left',  padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Descrição</th>
                      <th style={{ textAlign: 'left',  padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Categoria</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Qtd</th>
                      <th style={{ textAlign: 'left',  padding: '4px 4px', color: 'var(--text-muted)', fontWeight: 600 }}>Un</th>
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

          {/* Loading indicator pros itens da diária */}
          {isDiaria && loadingItens && acao !== 'aprovar' && (
            <div style={{
              padding: '10px 12px', border: '1px dashed var(--border, #d1d5db)',
              borderRadius: 6, fontSize: 12, color: 'var(--text-muted, #6b7280)',
              marginBottom: 12, textAlign: 'center',
            }}>⏳ Carregando motoristas da solicitação…</div>
          )}

          {/* Itens da diária — sempre visível (read-only fora do modo aprovar) */}
          {isDiaria && !loadingItens && itensDiaria.length > 0 && acao !== 'aprovar' && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 6 }}>
                Motoristas ({itensDiaria.length})
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="rh-doc-table" style={{ fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th>Motorista</th><th>Placa</th>
                      <th>Diárias</th><th>Pernoites</th><th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensDiaria.map((it) => (
                      <tr key={it.id}>
                        <td>{it.motorista_nome}</td>
                        <td>{it.placa || '—'}</td>
                        <td>{it.qtd_diarias}</td>
                        <td>{it.qtd_pernoites}</td>
                        <td>{fmtMoeda(it.valor_total)}</td>
                      </tr>
                    ))}
                  </tbody>
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
          {STATUS_PENDENTE.includes(statusAtual) && (() => {
            // Resolve permissão / rótulo / ação primária
            let podeFazerAlgo = false, acaoPrimaria = null, labelPrimaria = ''
            const twoStage = solicitacao.two_stage
            const stage = solicitacao.current_stage  // 1 = aguardando líder, 2 = aguardando responsável/cliente
            const stage2External = (tipo === 'horas_extras') && statusAtual === 'aprovado_lider'

            if (isPedido) {
              if (estaPendente && podeAnalisar) {
                podeFazerAlgo = true; acaoPrimaria = 'analisar'; labelPrimaria = 'Aprovar'
              } else if (estaEmAnalise && podeAprovar) {
                podeFazerAlgo = true; acaoPrimaria = 'aprovar';  labelPrimaria = 'Aprovar pedido'
              }
            } else if (twoStage && stage === 1 && podeAprovarLider) {
              podeFazerAlgo = true; acaoPrimaria = 'aprovar_lider'
              labelPrimaria = 'Aprovar (etapa líder)'
            } else if (twoStage && stage === 2 && !stage2External && podeAprovar) {
              podeFazerAlgo = true; acaoPrimaria = 'aprovar'
              labelPrimaria = isDiaria ? 'Aprovar final (preencher valores)' : 'Aprovar (etapa final)'
            } else if (!twoStage && podeAprovar) {
              podeFazerAlgo = true; acaoPrimaria = 'aprovar'
              labelPrimaria = isDiaria ? 'Aprovar (preencher valores)' : 'Aprovar solicitação'
            }

            if (!podeFazerAlgo) {
              return (
                <div className="alert-warn" style={{ marginTop: 12 }}>
                  {stage2External
                    ? 'HE aprovada pelo líder. Aguardando aprovação do cliente no portal externo.'
                    : isPedido && estaPendente
                    ? 'Aguardando analista iniciar análise. Você não tem permissão para esta etapa.'
                    : isPedido && estaEmAnalise
                    ? 'Aguardando aprovação. Você não tem permissão para aprovar.'
                    : twoStage && stage === 2
                    ? 'Aguardando aprovação do responsável de frota. Você não tem permissão para esta etapa.'
                    : twoStage && stage === 1
                    ? 'Aguardando aprovação do líder da base. Você não tem permissão para esta etapa.'
                    : 'Você não tem permissão para aprovar este tipo de solicitação.'}
                </div>
              )
            }

            return (
              <div className="acomp-modal-acoes">
                {/* Botões iniciais */}
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
                        } else if (acaoPrimaria === 'aprovar_lider') {
                          setMotivo(''); setAcao('aprovar_lider')
                        } else {
                          setMotivo(''); setAcao('aprovar')
                        }
                      }}
                      disabled={processando}
                    >
                      {processando ? 'Processando...' : labelPrimaria}
                    </button>
                  </div>
                )}

                {/* Painel de aprovação ETAPA LÍDER */}
                {acao === 'aprovar_lider' && (
                  <div style={{
                    border: '1px solid var(--primary-light, #f5e8a8)', borderRadius: 8,
                    background: 'rgba(196,149,18,0.08)', padding: '14px 16px',
                    display: 'grid', gap: 10, marginTop: 8,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary, #c49512)' }}>
                      👑 Aprovar como Líder da base: <em style={{ fontWeight: 400 }}>{solicitacao.titulo || `#${solicitacao.id}`}</em>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted, #5a6a7a)' }}>
                      Após sua aprovação, a solicitação segue para a etapa final ({tipo === 'horas_extras' ? 'cliente — portal externo' : 'responsável de frota'}).
                    </div>
                    <label className="field" style={{ margin: 0 }}>
                      <span>Comentário (opcional)</span>
                      <textarea
                        rows={2}
                        placeholder="Comentário ao aprovar como líder..."
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
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
                        className="button-primary"
                        onClick={() => confirmar('aprovar_lider')}
                        disabled={processando}
                      >
                        {processando ? 'Aprovando...' : 'Confirmar etapa líder'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Painel de aprovação */}
                {acao === 'aprovar' && (
                  <div style={{
                    border: '1px solid #c3e6cb', borderRadius: 8,
                    background: 'rgba(40,167,69,0.06)', padding: '14px 16px',
                    display: 'grid', gap: 10, marginTop: 8,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success, #1a7340)' }}>
                      Confirmar aprovação de: <em style={{ fontWeight: 400 }}>{solicitacao.titulo || `#${solicitacao.id}`}</em>
                    </div>

                    {isDiaria && (
                      <EditorDiaria
                        itens={itensDiaria}
                        setItens={setItensDiaria}
                        processando={processando}
                        carregando={loadingItens}
                      />
                    )}

                    <label className="field" style={{ margin: 0 }}>
                      <span>Comentário (opcional)</span>
                      <textarea
                        rows={2}
                        placeholder="Deixe um comentário sobre esta aprovação..."
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
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
                        className="button-primary"
                        onClick={() => confirmar()}
                        disabled={processando || (isDiaria && (loadingItens || itensDiaria.length === 0))}
                      >
                        {processando
                          ? 'Aprovando...'
                          : (isDiaria
                            ? (loadingItens ? 'Carregando…' : 'Salvar valores e aprovar')
                            : 'Confirmar aprovação')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Painel de rejeição */}
                {acao === 'rejeitar' && (
                  <div style={{
                    border: '1px solid #f5c6cb', borderRadius: 8,
                    background: 'rgba(220,53,69,0.05)', padding: '14px 16px',
                    display: 'grid', gap: 10, marginTop: 8,
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
                        onChange={(e) => setMotivo(e.target.value)}
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
  const [historico,    setHistorico]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [erro,         setErro]         = useState('')
  const [aba,          setAba]          = useState('pendentes')
  const [fTipo,        setFTipo]        = useState('')
  const [fBusca,       setFBusca]       = useState('')
  const [atendendo,    setAtendendo]    = useState(null)
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
    } catch {
      setErro('Falha ao carregar solicitações.')
    } finally {
      _loaded.current = true
      setLoading(false)
    }
  }

  // Alguns recursos usam um sufixo enxuto no escopo (ex.: diarias_solicitacoes -> aprovar.diarias)
  const scopeSuffix = (rt) => rt === 'diarias_solicitacoes' ? 'diarias' : rt
  const podeAprovar  = (rt) => permissoes.includes('admin') || permissoes.includes(`aprovar.${scopeSuffix(rt)}`) || permissoes.includes(`aprovar.${scopeSuffix(rt)}.responsavel`)
  const podeAnalisar = (rt) => permissoes.includes('admin') || permissoes.includes(`analisar.${scopeSuffix(rt)}`)
  // Líder de etapa 1: aprova de pending para aprovado_lider
  const podeAprovarLider = (rt) => permissoes.includes('admin') || permissoes.includes(`aprovar.${scopeSuffix(rt)}.lider`)

  const stats = useMemo(() => ({
    pendentes:  solicitacoes.filter((s) => STATUS_PENDENTE.includes(s.status)).length,
    aprovadas:  solicitacoes.filter((s) => STATUS_APROVADO.includes(s.status)).length,
    rejeitadas: solicitacoes.filter((s) => STATUS_REJEITADO.includes(s.status)).length,
    total:      solicitacoes.length,
  }), [solicitacoes])

  const filtrada = useMemo(() => {
    let lista = solicitacoes
    if (aba === 'pendentes')  lista = lista.filter((s) => STATUS_PENDENTE.includes(s.status))
    if (aba === 'aprovadas')  lista = lista.filter((s) => STATUS_APROVADO.includes(s.status))
    if (aba === 'rejeitadas') lista = lista.filter((s) => STATUS_REJEITADO.includes(s.status))
    if (fTipo) lista = lista.filter((s) => s.resource_type === fTipo)
    const q = fBusca.trim().toLowerCase()
    if (q) lista = lista.filter((s) =>
      [s.titulo, s.resource_type].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    )
    return lista
  }, [solicitacoes, aba, fTipo, fBusca])

  const histFiltrado = useMemo(() => {
    const q = fBusca.trim().toLowerCase()
    if (!q) return historico
    return historico.filter((h) =>
      [h.recurso, h.nome_colaborador].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    )
  }, [historico, fBusca])

  return (
    <section className="page-shell">
      {/* Cabeçalho */}
      <div className="page-header">
        <div>
          <span className="eyebrow">Gestão</span>
          <h1>Acompanhamento de Aprovações</h1>
          <p>Aprove, ajuste valores e gerencie todas as solicitações em um só lugar.</p>
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
          {TABS.map((t) => (
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
            <select value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="field filter-field" style={{ gridColumn: 'span 3' }}>
            <span>Buscar</span>
            <input
              type="text"
              placeholder="Título, tipo, colaborador..."
              value={fBusca}
              onChange={(e) => setFBusca(e.target.value)}
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
                  {filtrada.map((s) => {
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
                            : <span style={{ color: 'var(--muted)' }}>—</span>}
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
                              {detalhes.map((d, i) => <span key={i} className="acomp-detalhe-item">{d}</span>)}
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
                          <span className={`acomp-tipo tipo-${tipo}`}>{TIPOS[tipo] || tipo || '—'}</span>
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
          podeAprovarLider={podeAprovarLider(atendendo.resource_type)}
          isSuperAdmin={profile?.is_super_admin}
        />
      )}
    </section>
  )
}

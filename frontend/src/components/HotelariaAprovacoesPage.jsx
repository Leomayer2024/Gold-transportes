import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

// ─── Hotelaria — Aprovações ───────────────────────────────────────────────────
// Tela dedicada que mostra cada solicitação de hotelaria/diária como uma
// "Solicitação de Depósito Bancário" e permite aprovar em 2 etapas:
//   etapa 1 (aprovar.diarias.lider):       pendente     → em análise (aprovado_lider)
//   etapa 2 (aprovar.diarias.responsavel): em análise   → aprovado
// O backend (/approvals) já filtra o que cada usuário pode agir (current_stage).

const RT = 'diarias_solicitacoes'

const STATUS_LABEL = {
  pendente: 'Pendente',
  em_analise: 'Em análise',
  aprovado_lider: 'Em análise',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  cancelado: 'Cancelado',
}
function statusTone(s) {
  if (s === 'aprovado') return 'success'
  if (s === 'reprovado' || s === 'cancelado') return 'danger'
  if (s === 'aprovado_lider' || s === 'em_analise') return 'warning'
  return 'neutral'
}
function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(d) {
  if (!d) return '—'
  const s = String(d).slice(0, 10)
  const [y, m, dd] = s.split('-')
  return y && m && dd ? `${dd}/${m}/${y}` : s
}

export default function HotelariaAprovacoesPage() {
  const { profile } = useAuth()
  const [aba, setAba] = useState('pendencias') // pendencias | aprovadas | reprovadas
  const [itens, setItens] = useState([])
  const [filiais, setFiliais] = useState({})
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [processando, setProcessando] = useState(null) // id em processamento
  const [obs, setObs] = useState({}) // id -> observação

  useEffect(() => {
    api.list('filiais', { limit: 500 })
      .then((r) => {
        const map = {}
        for (const f of (r.items || r || [])) {
          map[f.id] = f.parceira || f.cidade ? `${f.parceira ? f.parceira + ' · ' : ''}${f.cidade || ''}${f.uf ? '/' + f.uf : ''}` : `Filial ${f.id}`
        }
        setFiliais(map)
      })
      .catch(() => {})
  }, [])

  function carregar() {
    setLoading(true); setErro('')
    const status = aba === 'aprovadas' ? 'aprovado' : aba === 'reprovadas' ? 'reprovado' : undefined
    api.getApprovals({ resource_type: RT, ...(status ? { status } : {}) })
      .then((r) => setItens((r.items || r.results || r.data || []).filter((x) => x.resource_type === RT)))
      .catch((e) => setErro(e.message || 'Erro ao carregar.'))
      .finally(() => setLoading(false))
  }
  useEffect(carregar, [aba])

  async function agir(item, tipo) {
    const id = item.id
    const comentario = (obs[id] || '').trim()
    if (tipo === 'reprovar' && !comentario) {
      setErro('Informe o motivo da reprovação nas observações.')
      return
    }
    setProcessando(id); setErro('')
    try {
      if (tipo === 'aprovar') {
        // Etapa 1 (líder) usa aprovar-lider; etapa 2 (responsável) usa approve.
        if (item.current_stage === 1) await api.aprovarLider(id, RT, comentario)
        else await api.approveRequest(id, RT, comentario)
      } else {
        await api.rejectRequest(id, RT, comentario)
      }
      setObs((o) => ({ ...o, [id]: '' }))
      carregar()
    } catch (e) {
      setErro(e.message || 'Falha na ação.')
    } finally {
      setProcessando(null)
    }
  }

  const vazio = !loading && itens.length === 0

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Hotelaria — Aprovações</h1>
          <p className="page-sub">Solicitações de depósito bancário de pernoite/hotelaria. Aprovação em duas etapas.</p>
        </div>
      </div>

      <div className="tabs" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          ['pendencias', 'Minhas pendências'],
          ['aprovadas', 'Aprovadas'],
          ['reprovadas', 'Reprovadas'],
        ].map(([k, l]) => (
          <button key={k} type="button" className={`button-secondary${aba === k ? ' is-active' : ''}`}
            style={aba === k ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : {}}
            onClick={() => setAba(k)}>{l}</button>
        ))}
      </div>

      {erro && <div className="alert-error">{erro}</div>}
      {loading && <div className="dsh-live"><span className="dsh-live-dot" /> carregando…</div>}
      {vazio && (
        <div className="dsh-empty">
          <strong>Nada por aqui</strong>
          {aba === 'pendencias' ? 'Nenhuma solicitação aguardando sua aprovação.' : 'Nenhum registro neste filtro.'}
        </div>
      )}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))' }}>
        {itens.map((item) => (
          <DepositoCard
            key={`${item.resource_type}-${item.id}`}
            item={item}
            filialNome={filiais[item.full_item?.filial_id] || `Filial ${item.full_item?.filial_id ?? '—'}`}
            obs={obs[item.id] || ''}
            onObs={(v) => setObs((o) => ({ ...o, [item.id]: v }))}
            processando={processando === item.id}
            somenteLeitura={aba !== 'pendencias'}
            onAprovar={() => agir(item, 'aprovar')}
            onReprovar={() => agir(item, 'reprovar')}
          />
        ))}
      </div>
    </div>
  )
}

function DepositoCard({ item, filialNome, obs, onObs, processando, somenteLeitura, onAprovar, onReprovar }) {
  const fi = item.full_item || {}
  const motorista = fi.motorista_nome || '—'
  const aprovadoPor = fi.aprovado_lider_por_nome || fi.aprovado_por_nome || '—'
  const solicitante = `MOT. ${motorista}${aprovadoPor !== '—' ? `, APROVADO POR ${aprovadoPor}` : ''}`
  const placaMot = `${fi.placa || '—'} - MOTORISTA: ${motorista};`
  const hotel = fi.hotel_nome || '—'
  const cidade = fi.cidade_destino || '—'
  const referente = `Pernoite em ${cidade}, Hotel ${hotel}, UNIDADE: ${filialNome}.`
  const stageLabel = item.current_stage === 1 ? 'Aprovar → Em análise' : 'Aprovar → Aprovado'

  const row = (label, valor, cor) => (
    <tr>
      <td style={{ background: '#e9edf2', fontWeight: 600, whiteSpace: 'nowrap', padding: '4px 8px', width: 130 }}>{label}</td>
      <td style={{ padding: '4px 8px', color: cor }}>{valor || ' '}</td>
    </tr>
  )

  return (
    <article className="dsh-base-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ background: '#d9d9d9', textAlign: 'center', fontWeight: 800, fontSize: 15, padding: '6px 8px', letterSpacing: 0.3 }}>
        SOLICITAÇÃO DE DEPÓSITO BANCÁRIO
      </div>
      <table className="dsh-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          {row('Solicitante', solicitante, 'var(--danger)')}
          {row('Chave Pix', fi.chave_pix)}
          {row('Favorecido', fi.favorecido)}
          {row('Placa/Motorista', placaMot)}
          <tr>
            <td style={{ background: '#e9edf2', fontWeight: 600, padding: '4px 8px' }}>Valor</td>
            <td style={{ padding: '4px 8px', fontWeight: 700 }}>{fmtBRL(fi.valor_total)}</td>
          </tr>
          <tr>
            <td style={{ background: '#e9edf2', fontWeight: 600, padding: '4px 8px' }}>Referente</td>
            <td style={{ padding: '4px 8px' }}>{referente} <strong style={{ marginLeft: 6 }}>{fmtData(fi.data_inicio || fi.data_solicitacao)}</strong></td>
          </tr>
          {fi.dados_bancarios ? row('Dados bancários', fi.dados_bancarios) : null}
        </tbody>
      </table>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`status-chip tone-${statusTone(item.status)}`}>{STATUS_LABEL[item.status] || item.status}</span>
          {fi.numero_solicitacao && <span style={{ color: 'var(--muted)', fontSize: 12 }}>{fi.numero_solicitacao}</span>}
        </div>

        {!somenteLeitura && (
          <>
            <textarea
              className="input"
              placeholder="Observações (obrigatório ao reprovar)"
              value={obs}
              onChange={(e) => onObs(e.target.value)}
              rows={2}
              style={{ resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="button-primary" disabled={processando} onClick={onAprovar} style={{ flex: 1 }}>
                {processando ? '…' : stageLabel}
              </button>
              <button type="button" className="button-secondary" disabled={processando} onClick={onReprovar}
                style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                Reprovar
              </button>
            </div>
            {item.current_stage === 1 && (
              <small style={{ color: 'var(--muted)' }}>Etapa 1 — ao aprovar vai para “Em análise” do responsável.</small>
            )}
            {item.current_stage === 2 && (
              <small style={{ color: 'var(--muted)' }}>Etapa 2 — ao aprovar o depósito fica liberado.</small>
            )}
          </>
        )}
        {somenteLeitura && fi.observacoes && (
          <small style={{ color: 'var(--muted)' }}>Obs: {fi.observacoes}</small>
        )}
      </div>
    </article>
  )
}

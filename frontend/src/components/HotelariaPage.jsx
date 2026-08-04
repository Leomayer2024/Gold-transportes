import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { hasScopePermission } from '../lib/permissions'
import DocumentoDeposito, { StatusChip, Timeline, brl, dataBR, noitesDe } from './hotelaria/DocumentoDeposito'

// ─── Hotelaria ────────────────────────────────────────────────────────────────
// Módulo próprio (tabela hotelaria_solicitacoes). Duas abas:
//   • Nova solicitação — formulário do depósito, com prévia ao vivo do documento
//   • Minhas solicitações — o que eu abri, com status e trilha de aprovação
// Sem `create.hotelaria` a tela fica só de consulta.

const UP = { textTransform: 'uppercase' }
const hoje = () => new Date().toISOString().slice(0, 10)

const VAZIO = {
  filial_id: '', motorista_nome: '', placa: '', chave_pix: '',
  favorecido: '', valor: '', data_deposito: hoje(), cidade: '', hotel: '',
  data_entrada: '', data_saida: '',
}

export default function HotelariaPage() {
  const { profile } = useAuth()
  const podeCriar = hasScopePermission(profile, 'create.hotelaria')
  const [aba, setAba] = useState(podeCriar ? 'nova' : 'minhas')

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Hotelaria</h1>
          <p className="page-sub">
            Solicitação de depósito bancário para pernoite. Passa por duas etapas de aprovação.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, borderBottom: '1px solid #d0d7de' }}>
        {(podeCriar ? [['nova', 'Nova solicitação'], ['minhas', 'Minhas solicitações']] : [['minhas', 'Minhas solicitações']])
          .map(([k, l]) => (
            <button key={k} type="button" onClick={() => setAba(k)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '9px 4px',
                marginBottom: -1, fontSize: 14,
                fontWeight: aba === k ? 700 : 500,
                color: aba === k ? 'var(--accent, #0969DA)' : '#57606A',
                borderBottom: `2px solid ${aba === k ? 'var(--accent, #0969DA)' : 'transparent'}`,
              }}>{l}</button>
          ))}
      </div>

      {aba === 'nova' && podeCriar ? <AbaNova onEnviado={() => setAba('minhas')} /> : <AbaMinhas />}
    </div>
  )
}

// ── Aba: nova solicitação ─────────────────────────────────────────────────────
function AbaNova({ onEnviado }) {
  const { profile } = useAuth()
  const [filiais, setFiliais] = useState([])
  const [f, setF] = useState({ ...VAZIO, filial_id: profile?.filial_id || '' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    api.list('filiais', { limit: 500 })
      .then((r) => {
        const items = r.items || r || []
        setFiliais(items)
        setF((s) => ({ ...s, filial_id: s.filial_id || items[0]?.id || '' }))
      })
      .catch(() => {})
  }, [])

  // Texto sempre em MAIÚSCULO (padrão do documento).
  const up = (c) => (e) => setF((s) => ({ ...s, [c]: (e.target.value || '').toUpperCase() }))
  const set = (c) => (e) => setF((s) => ({ ...s, [c]: e.target.value }))

  const filialNome = useMemo(() => {
    const fi = filiais.find((x) => String(x.id) === String(f.filial_id))
    if (!fi) return ''
    return `${fi.parceira ? fi.parceira + ' · ' : ''}${fi.cidade || ''}${fi.uf ? '/' + fi.uf : ''}`
  }, [filiais, f.filial_id])

  const noites = noitesDe(f)

  async function enviar(e) {
    e.preventDefault()
    setErro('')
    if (!f.filial_id) return setErro('Selecione a unidade.')
    if (!f.motorista_nome.trim()) return setErro('Informe o motorista.')
    if (!Number(f.valor)) return setErro('Informe o valor.')
    if (f.data_entrada && f.data_saida && f.data_saida < f.data_entrada) {
      return setErro('A saída não pode ser antes da entrada.')
    }
    setSalvando(true)
    try {
      await api.hotelariaCriar({ ...f, filial_id: Number(f.filial_id), valor: Number(f.valor) })
      setF({ ...VAZIO, filial_id: f.filial_id })
      onEnviado()
    } catch (err) {
      setErro(err.message || 'Erro ao enviar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'minmax(320px, 460px) minmax(320px, 1fr)', alignItems: 'start' }}>
      <form onSubmit={enviar} className="rh-doc-form">
        {erro && <div className="alert-error">{erro}</div>}
        <div className="rh-doc-grid">
          <label><span>Unidade *</span>
            <select value={f.filial_id} onChange={set('filial_id')}>
              <option value="">— selecione —</option>
              {filiais.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.parceira ? `${x.parceira} · ` : ''}{x.cidade}{x.uf ? '/' + x.uf : ''}
                </option>
              ))}
            </select>
          </label>
          <label><span>Motorista *</span>
            <input type="text" value={f.motorista_nome} onChange={up('motorista_nome')} style={UP} placeholder="NOME DO MOTORISTA" />
          </label>
          <label><span>Placa</span>
            <input type="text" value={f.placa} onChange={up('placa')} style={UP} placeholder="XXX-0000" />
          </label>
          <label><span>Chave Pix</span>
            <input type="text" value={f.chave_pix} onChange={up('chave_pix')} style={UP} placeholder="CPF, E-MAIL, TELEFONE OU ALEATÓRIA" />
          </label>
          <label><span>Favorecido</span>
            <input type="text" value={f.favorecido} onChange={up('favorecido')} style={UP} placeholder="QUEM RECEBE" />
          </label>
          <label><span>Valor (R$) *</span>
            <input type="number" step="0.01" min="0" value={f.valor} onChange={set('valor')} placeholder="0,00" />
          </label>
          <label><span>Data</span>
            <input type="date" value={f.data_deposito} onChange={set('data_deposito')} />
          </label>
          <label><span>Cidade (pernoite)</span>
            <input type="text" value={f.cidade} onChange={up('cidade')} style={UP} placeholder="CIDADE" />
          </label>
          <label><span>Hotel</span>
            <input type="text" value={f.hotel} onChange={up('hotel')} style={UP} placeholder="NOME DO HOTEL" />
          </label>
          <label><span>Entrada (check-in)</span>
            <input type="date" value={f.data_entrada} onChange={set('data_entrada')} max={f.data_saida || undefined} />
          </label>
          <label><span>Saída (check-out)</span>
            <input type="date" value={f.data_saida} onChange={set('data_saida')} min={f.data_entrada || undefined} />
          </label>
        </div>

        {noites != null && (
          <p style={{ margin: '10px 0 0', fontSize: 13, color: '#57606A' }}>
            Hospedagem de <strong>{noites}</strong> {noites === 1 ? 'noite' : 'noites'}
            {noites > 0 && Number(f.valor) > 0 && (
              <> · <strong>{brl(Number(f.valor) / noites)}</strong> por noite</>
            )}
          </p>
        )}
        <button type="submit" className="button-primary" disabled={salvando} style={{ marginTop: 14 }}>
          {salvando ? 'Enviando…' : 'Enviar para aprovação'}
        </button>
      </form>

      <div style={{ position: 'sticky', top: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#57606A', marginBottom: 8, letterSpacing: 0.4 }}>
          PRÉVIA DO DOCUMENTO
        </div>
        <DocumentoDeposito placeholder sol={{ ...f, valor: Number(f.valor || 0), filial_nome: filialNome }} />
      </div>
    </div>
  )
}

// ── Aba: minhas solicitações ──────────────────────────────────────────────────
function AbaMinhas() {
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState(null)

  useEffect(() => {
    api.hotelariaListar({ escopo: 'minhas' })
      .then((r) => setItens(r.items || []))
      .catch((e) => setErro(e.message || 'Erro ao carregar.'))
      .finally(() => setCarregando(false))
  }, [])

  if (carregando) return <p>Carregando…</p>
  if (erro) return <div className="alert-error">{erro}</div>
  if (!itens.length) {
    return <div className="dsh-empty"><strong>Nenhuma solicitação</strong>Você ainda não abriu nenhuma solicitação de hotelaria.</div>
  }

  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))' }}>
      {itens.map((s) => (
        <CardSolicitacao key={s.id} sol={s} aberto={aberto === s.id} onToggle={() => setAberto(aberto === s.id ? null : s.id)} />
      ))}
    </div>
  )
}

export function CardSolicitacao({ sol, aberto, onToggle, children }) {
  const [hist, setHist] = useState([])
  const [carregandoHist, setCarregandoHist] = useState(false)

  useEffect(() => {
    if (!aberto || hist.length) return
    setCarregandoHist(true)
    api.hotelariaHistorico(sol.id)
      .then((r) => setHist(r.items || []))
      .catch(() => {})
      .finally(() => setCarregandoHist(false))
  }, [aberto, sol.id])

  return (
    <article style={{ border: '1px solid #d0d7de', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid #eaeef2' }}>
        <strong style={{ fontSize: 13 }}>{sol.numero_solicitacao || `#${sol.id}`}</strong>
        <StatusChip status={sol.status} small />
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700 }}>{brl(sol.valor)}</span>
      </header>

      <div style={{ padding: 12 }}>
        <DocumentoDeposito sol={sol} />

        {sol.status === 'reprovado' && sol.motivo_reprovacao && (
          <div className="alert-error" style={{ marginTop: 10, fontSize: 12 }}>
            <strong>Motivo:</strong> {sol.motivo_reprovacao}
          </div>
        )}

        {children}

        <button type="button" onClick={onToggle}
          style={{ background: 'none', border: 'none', color: 'var(--accent, #0969DA)', cursor: 'pointer', padding: '8px 0 0', fontSize: 13, fontWeight: 600 }}>
          {aberto ? '▾ Ocultar histórico' : '▸ Ver histórico de aprovação'}
        </button>
        {aberto && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #d0d7de' }}>
            <Timeline eventos={hist} carregando={carregandoHist} />
          </div>
        )}

        <div style={{ marginTop: 8, fontSize: 11, color: '#8c959f' }}>
          Criada em {dataBR(sol.criado_em)} por {sol.criado_por_nome || '—'} · {sol.filial_nome}
        </div>
      </div>
    </article>
  )
}

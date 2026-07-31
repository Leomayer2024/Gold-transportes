import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import DocumentoDeposito, { StatusChip, Timeline, brl, dataBR } from './hotelaria/DocumentoDeposito'

// ─── Hotelaria — Aprovações ───────────────────────────────────────────────────
// Fila do que ESTE usuário pode aprovar (o backend já devolve só os status da
// etapa dele e só as filiais liberadas) + aba de histórico com a trilha completa
// de quem aprovou/reprovou.
//   etapa 1 (aprovar.hotelaria.lider):       pendente   → em análise
//   etapa 2 (aprovar.hotelaria.responsavel): em análise → aprovado

export default function HotelariaAprovacoesPage() {
  const [aba, setAba] = useState('fila')
  const [itens, setItens] = useState([])
  const [meta, setMeta] = useState({ pode_etapa1: false, pode_etapa2: false })
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [filtroFilial, setFiltroFilial] = useState('')

  function carregar() {
    setCarregando(true); setErro('')
    api.hotelariaFila({ status: aba === 'historico' ? 'historico' : 'fila' })
      .then((r) => {
        setItens(r.items || [])
        setMeta({ pode_etapa1: !!r.pode_etapa1, pode_etapa2: !!r.pode_etapa2 })
      })
      .catch((e) => setErro(e.message || 'Erro ao carregar.'))
      .finally(() => setCarregando(false))
  }
  useEffect(carregar, [aba])

  // Só as filiais que vieram — o backend já restringe às liberadas.
  const filiais = useMemo(() => {
    const m = new Map()
    for (const i of itens) if (i.filial_id) m.set(i.filial_id, i.filial_nome)
    return [...m.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])))
  }, [itens])

  const visiveis = filtroFilial ? itens.filter((i) => String(i.filial_id) === String(filtroFilial)) : itens
  const totalFila = itens.filter((i) => i.pode_agir).length

  const etapaTxt = meta.pode_etapa1 && meta.pode_etapa2
    ? 'Você aprova as duas etapas.'
    : meta.pode_etapa1 ? 'Você aprova a etapa 1 (pendente → em análise).'
    : meta.pode_etapa2 ? 'Você aprova a etapa 2 (em análise → aprovado).'
    : 'Você tem acesso somente de consulta.'

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Hotelaria — Aprovações</h1>
          <p className="page-sub">{etapaTxt} Apenas as filiais liberadas para você aparecem aqui.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #d0d7de', flexWrap: 'wrap' }}>
        {[['fila', `Aguardando aprovação${totalFila ? ` (${totalFila})` : ''}`], ['historico', 'Histórico']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setAba(k)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '9px 4px', marginBottom: -1, fontSize: 14,
              fontWeight: aba === k ? 700 : 500,
              color: aba === k ? 'var(--accent, #0969DA)' : '#57606A',
              borderBottom: `2px solid ${aba === k ? 'var(--accent, #0969DA)' : 'transparent'}`,
            }}>{l}</button>
        ))}
        {filiais.length > 1 && (
          <select value={filtroFilial} onChange={(e) => setFiltroFilial(e.target.value)}
            style={{ marginLeft: 'auto', marginBottom: 6 }}>
            <option value="">Todas as filiais liberadas</option>
            {filiais.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        )}
      </div>

      {erro && <div className="alert-error">{erro}</div>}
      {carregando && <p>Carregando…</p>}
      {!carregando && !visiveis.length && (
        <div className="dsh-empty">
          <strong>Nada por aqui</strong>
          {aba === 'fila' ? 'Nenhuma solicitação aguardando sua aprovação.' : 'Nenhuma solicitação finalizada ainda.'}
        </div>
      )}

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(430px, 1fr))' }}>
        {visiveis.map((s) => (
          <CardAprovacao key={s.id} sol={s} onFeito={carregar} somenteLeitura={aba === 'historico'} />
        ))}
      </div>
    </div>
  )
}

function CardAprovacao({ sol, onFeito, somenteLeitura }) {
  const [obs, setObs] = useState('')
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState(false)
  const [hist, setHist] = useState([])
  const [carregandoHist, setCarregandoHist] = useState(false)

  useEffect(() => {
    if (!aberto || hist.length) return
    setCarregandoHist(true)
    api.hotelariaHistorico(sol.id).then((r) => setHist(r.items || [])).catch(() => {}).finally(() => setCarregandoHist(false))
  }, [aberto, sol.id])

  async function agir(tipo) {
    if (tipo === 'reprovar' && !obs.trim()) return setErro('Informe o motivo da reprovação.')
    setProcessando(true); setErro('')
    try {
      if (tipo === 'aprovar') await api.hotelariaAprovar(sol.id, obs.trim())
      else await api.hotelariaReprovar(sol.id, obs.trim())
      onFeito()
    } catch (e) {
      setErro(e.message || 'Falha na ação.')
      setProcessando(false)
    }
  }

  const rotuloAprovar = sol.etapa === 1 ? 'Aprovar → Em análise' : 'Aprovar → Liberar depósito'

  return (
    <article style={{ border: '1px solid #d0d7de', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid #eaeef2' }}>
        <strong style={{ fontSize: 13 }}>{sol.numero_solicitacao || `#${sol.id}`}</strong>
        <StatusChip status={sol.status} small />
        <span style={{ fontSize: 11, color: '#57606A' }}>{sol.filial_nome}</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700 }}>{brl(sol.valor)}</span>
      </header>

      <div style={{ padding: 12 }}>
        <DocumentoDeposito sol={sol} />

        {sol.status === 'reprovado' && sol.motivo_reprovacao && (
          <div className="alert-error" style={{ marginTop: 10, fontSize: 12 }}>
            <strong>Motivo:</strong> {sol.motivo_reprovacao}
          </div>
        )}
        {erro && <div className="alert-error" style={{ marginTop: 10, fontSize: 12 }}>{erro}</div>}

        {!somenteLeitura && sol.pode_agir && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea className="input" rows={2} value={obs} onChange={(e) => setObs(e.target.value)}
              placeholder="Observação (obrigatória ao reprovar)" style={{ resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="button-primary" disabled={processando} onClick={() => agir('aprovar')} style={{ flex: 1 }}>
                {processando ? '…' : rotuloAprovar}
              </button>
              <button type="button" className="button-secondary" disabled={processando} onClick={() => agir('reprovar')}
                style={{ color: '#CF222E', borderColor: '#CF222E' }}>Reprovar</button>
            </div>
          </div>
        )}
        {!somenteLeitura && !sol.pode_agir && (
          <p style={{ marginTop: 10, fontSize: 12, color: '#57606A' }}>
            Aguardando a outra etapa — você não age nesta fase.
          </p>
        )}

        <button type="button" onClick={() => setAberto(!aberto)}
          style={{ background: 'none', border: 'none', color: 'var(--accent, #0969DA)', cursor: 'pointer', padding: '10px 0 0', fontSize: 13, fontWeight: 600 }}>
          {aberto ? '▾ Ocultar histórico' : '▸ Ver histórico de aprovação'}
        </button>
        {aberto && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #d0d7de' }}>
            <Timeline eventos={hist} carregando={carregandoHist} />
          </div>
        )}

        <div style={{ marginTop: 8, fontSize: 11, color: '#8c959f' }}>
          Criada em {dataBR(sol.criado_em)} por {sol.criado_por_nome || '—'}
        </div>
      </div>
    </article>
  )
}

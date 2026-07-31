import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

// ─── Hotelaria (Solicitação de Depósito Bancário) ─────────────────────────────
// Tela dedicada de HOTELARIA (separada de Diária). Cada envio é uma
// "Solicitação de Depósito Bancário" (pernoite/hotel) que entra no fluxo de
// aprovação em 2 etapas. Grava em diarias_solicitacoes (tipo='hotelaria') + um
// diarias_itens (motorista/placa/hotel). Campos de texto sempre em MAIÚSCULO.

function brl(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
const UP = { textTransform: 'uppercase' }

export default function HotelariaPage() {
  const { profile } = useAuth()
  const [filiais, setFiliais] = useState([])
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')

  const hoje = new Date().toISOString().slice(0, 10)
  const [f, setF] = useState({
    filial_id: profile?.filial_id || '',
    motorista: '',
    placa: '',
    hotel: '',
    cidade: '',
    valor: '',
    data: hoje,
    chave_pix: '',
    favorecido: '',
  })

  // Uppercase automático nos campos de texto (chave_pix incluída, padrão pedido).
  const up = (campo) => (e) => setF((s) => ({ ...s, [campo]: (e.target.value || '').toUpperCase() }))
  const set = (campo) => (e) => setF((s) => ({ ...s, [campo]: e.target.value }))

  const filialNome = useMemo(() => {
    const fi = filiais.find((x) => String(x.id) === String(f.filial_id))
    return fi ? `${fi.parceira ? fi.parceira + ' · ' : ''}${fi.cidade || ''}${fi.uf ? '/' + fi.uf : ''}` : ''
  }, [filiais, f.filial_id])

  function carregar() {
    setCarregando(true)
    Promise.all([
      api.list('filiais', { limit: 500 }).then((r) => r.items || r || []).catch(() => []),
      api.list('diarias_solicitacoes', { tipo: 'hotelaria', limit: 50, order: 'id.desc' }).then((r) => r.items || r || []).catch(() => []),
    ]).then(([fs, ls]) => {
      setFiliais(fs)
      setLista(ls)
      setF((s) => ({ ...s, filial_id: s.filial_id || profile?.filial_id || fs[0]?.id || '' }))
    }).finally(() => setCarregando(false))
  }
  useEffect(carregar, [])

  async function salvar(e) {
    e.preventDefault()
    setErro(''); setOk('')
    if (!f.filial_id) return setErro('Selecione a unidade/filial.')
    if (!f.motorista.trim()) return setErro('Informe o motorista.')
    if (!f.cidade.trim()) return setErro('Informe a cidade do pernoite.')
    if (!Number(f.valor)) return setErro('Informe o valor.')
    setSalvando(true)
    try {
      const sol = await api.create('diarias_solicitacoes', {
        filial_id: Number(f.filial_id),
        tipo: 'hotelaria',
        cidade_destino: f.cidade.trim().toUpperCase(),
        data_solicitacao: hoje,
        data_inicio: f.data,
        data_fim: f.data,
        status: 'pendente',
        valor_total: Number(f.valor),
        chave_pix: f.chave_pix.trim() || null,
        favorecido: f.favorecido.trim() || null,
        criado_por: profile?.id || null,
      })
      const solId = sol?.id || sol?.data?.id
      if (solId) {
        await api.create('diarias_itens', {
          solicitacao_id: solId,
          filial_id: Number(f.filial_id),
          motorista_nome: f.motorista.trim().toUpperCase(),
          placa: f.placa.trim().toUpperCase() || null,
          hotel_nome: f.hotel.trim().toUpperCase() || null,
          qtd_pernoites: 1,
          qtd_diarias: 0,
          valor_total: Number(f.valor),
        })
      }
      setOk('Solicitação de depósito enviada para aprovação!')
      setF((s) => ({ ...s, motorista: '', placa: '', hotel: '', cidade: '', valor: '', chave_pix: '', favorecido: '', data: hoje }))
      carregar()
    } catch (err) {
      setErro(err.message || 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  const solicitante = `MOT. ${f.motorista || 'XXXXXXX'}, APROVADO POR XXXXX`
  const referente = `Pernoite em ${f.cidade || 'XXXX'}, Hotel ${f.hotel || 'XXXX'}, UNIDADE: ${filialNome || 'XXXXX'}.`

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Hotelaria</h1>
          <p className="page-sub">Solicitação de depósito bancário para pernoite/hotel. Vai para aprovação em duas etapas.</p>
        </div>
      </div>

      {erro && <div className="alert-error">{erro}</div>}
      {ok && <div className="alert-success">{ok}</div>}

      <form onSubmit={salvar} className="rh-doc-form" style={{ maxWidth: 720 }}>
        <div className="rh-doc-grid">
          <label><span>Unidade / Filial *</span>
            <select value={f.filial_id} onChange={set('filial_id')}>
              <option value="">— selecione —</option>
              {filiais.map((x) => <option key={x.id} value={x.id}>{x.parceira ? `${x.parceira} · ` : ''}{x.cidade}{x.uf ? '/' + x.uf : ''}</option>)}
            </select>
          </label>
          <label><span>Motorista *</span>
            <input type="text" value={f.motorista} onChange={up('motorista')} style={UP} placeholder="NOME DO MOTORISTA" />
          </label>
          <label><span>Placa</span>
            <input type="text" value={f.placa} onChange={up('placa')} style={UP} placeholder="XXX-0000" />
          </label>
          <label><span>Hotel</span>
            <input type="text" value={f.hotel} onChange={up('hotel')} style={UP} placeholder="NOME DO HOTEL" />
          </label>
          <label><span>Cidade (pernoite) *</span>
            <input type="text" value={f.cidade} onChange={up('cidade')} style={UP} placeholder="CIDADE" />
          </label>
          <label><span>Valor (R$) *</span>
            <input type="number" step="0.01" min="0" value={f.valor} onChange={set('valor')} placeholder="0,00" />
          </label>
          <label><span>Data</span>
            <input type="date" value={f.data} onChange={set('data')} />
          </label>
          <label><span>Favorecido</span>
            <input type="text" value={f.favorecido} onChange={up('favorecido')} style={UP} placeholder="QUEM RECEBE" />
          </label>
          <label><span>Chave Pix</span>
            <input type="text" value={f.chave_pix} onChange={up('chave_pix')} style={UP} placeholder="CPF, E-MAIL, TELEFONE OU ALEATÓRIA" />
          </label>
        </div>

        {/* Prévia do documento */}
        <div style={{ margin: '16px 0', border: '1px solid #d0d7de', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: '#d9d9d9', textAlign: 'center', fontWeight: 800, padding: '6px' }}>SOLICITAÇÃO DE DEPÓSITO BANCÁRIO</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              <tr><td style={tdL}>Solicitante</td><td style={{ ...tdV, color: 'var(--danger)', fontWeight: 700 }}>{solicitante}</td></tr>
              <tr><td style={tdL}>Chave Pix</td><td style={tdV}>{f.chave_pix || ' '}</td></tr>
              <tr><td style={tdL}>Favorecido</td><td style={tdV}>{f.favorecido || ' '}</td></tr>
              <tr><td style={tdL}>Placa/Motorista</td><td style={tdV}>{(f.placa || 'XXX-XXXX')} - MOTORISTA: {(f.motorista || 'XXXXXXX')};</td></tr>
              <tr><td style={tdL}>Valor</td><td style={{ ...tdV, fontWeight: 700 }}>{brl(f.valor)}</td></tr>
              <tr><td style={tdL}>Referente</td><td style={tdV}>{referente} <strong>{f.data ? f.data.split('-').reverse().join('/') : 'XX/XX/XXXX'}</strong></td></tr>
            </tbody>
          </table>
        </div>

        <button type="submit" className="button-primary" disabled={salvando}>
          {salvando ? 'Enviando…' : 'Enviar para aprovação'}
        </button>
      </form>

      <h2 style={{ marginTop: 28 }}>Minhas solicitações de hotelaria</h2>
      {carregando ? <p>Carregando…</p> : lista.length === 0 ? (
        <div className="dsh-empty"><strong>Nenhuma</strong>Ainda não há solicitações de hotelaria.</div>
      ) : (
        <table className="rh-table">
          <thead><tr><th>Nº</th><th>Cidade</th><th>Valor</th><th>Favorecido</th><th>Data</th><th>Status</th></tr></thead>
          <tbody>
            {lista.map((s) => (
              <tr key={s.id}>
                <td>{s.numero_solicitacao || s.id}</td>
                <td>{s.cidade_destino}</td>
                <td>{brl(s.valor_total)}</td>
                <td>{s.favorecido || '—'}</td>
                <td>{(s.data_inicio || s.data_solicitacao || '').split('-').reverse().join('/')}</td>
                <td>{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const tdL = { background: '#e9edf2', fontWeight: 600, padding: '4px 8px', width: 130, whiteSpace: 'nowrap', border: '1px solid #d0d7de' }
const tdV = { padding: '4px 8px', border: '1px solid #d0d7de' }

// ─── Documento "SOLICITAÇÃO DE DEPÓSITO BANCÁRIO" ────────────────────────────
// Renderiza a folha oficial. Fonte única usada na prévia do formulário, na
// listagem "Minhas solicitações" e na tela de aprovações — os três nunca
// divergem.

export const STATUS_META = {
  pendente:   { label: 'Pendente',   cor: '#BF8700', bg: '#FFF8C5' },
  em_analise: { label: 'Em análise', cor: '#1462C4', bg: '#DDEBFF' },
  aprovado:   { label: 'Aprovado',   cor: '#1A7F37', bg: '#DDF4E4' },
  reprovado:  { label: 'Reprovado',  cor: '#CF222E', bg: '#FFEBED' },
  cancelado:  { label: 'Cancelado',  cor: '#57606A', bg: '#EAEEF2' },
}

export function StatusChip({ status, small }) {
  const m = STATUS_META[status] || { label: status || '—', cor: '#57606A', bg: '#EAEEF2' }
  return (
    <span style={{
      background: m.bg, color: m.cor, fontWeight: 700,
      fontSize: small ? 11 : 12, padding: small ? '2px 8px' : '3px 10px',
      borderRadius: 20, whiteSpace: 'nowrap',
    }}>{m.label}</span>
  )
}

export function brl(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
export function dataBR(d) {
  if (!d) return '—'
  const s = String(d).slice(0, 10).split('-')
  return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : String(d)
}

const cellLabel = {
  background: '#e9edf2', fontWeight: 600, padding: '5px 9px',
  width: 132, whiteSpace: 'nowrap', border: '1px solid #c8d1da', fontSize: 12.5,
}
const cellValue = { padding: '5px 9px', border: '1px solid #c8d1da', fontSize: 13 }

/**
 * @param sol  linha de hotelaria_solicitacoes (com filial_nome / aprovador_atual_nome)
 * @param placeholder  true = mostra XXXX no lugar de vazio (modo prévia)
 */
export default function DocumentoDeposito({ sol = {}, placeholder = false }) {
  const ph = (v, alt) => (v ? String(v) : (placeholder ? alt : ''))
  const motorista = ph(sol.motorista_nome, 'XXXXXXX')
  const aprovador = sol.aprovador_atual_nome || (placeholder ? 'XXXXX' : '')
  const solicitante = aprovador ? `MOT. ${motorista}, APROVADO POR ${aprovador}` : `MOT. ${motorista}`

  return (
    <div style={{ border: '1px solid #c8d1da', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
      <div style={{
        background: '#d9d9d9', textAlign: 'center', fontWeight: 800,
        fontSize: 16, padding: '7px 8px', letterSpacing: 0.2,
        borderBottom: '1px solid #c8d1da',
      }}>
        SOLICITAÇÃO DE DEPÓSITO BANCÁRIO
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td style={cellLabel}>Solicitante</td>
            <td style={{ ...cellValue, color: '#CF222E', fontWeight: 700 }} colSpan={2}>{solicitante}</td>
          </tr>
          <tr>
            <td style={cellLabel}>Chave Pix</td>
            <td style={cellValue} colSpan={2}>{ph(sol.chave_pix, '')}</td>
          </tr>
          <tr>
            <td style={cellLabel}>Favorecido</td>
            <td style={cellValue} colSpan={2}>{ph(sol.favorecido, '')}</td>
          </tr>
          <tr>
            <td style={cellLabel}>Placa/Motorista</td>
            <td style={cellValue} colSpan={2}>
              {ph(sol.placa, 'XXX-XXXX')} - MOTORISTA: {motorista};
            </td>
          </tr>
          <tr>
            <td style={cellLabel}>Valor</td>
            <td style={{ ...cellValue, fontWeight: 700 }}>{brl(sol.valor)}</td>
            <td style={{ ...cellLabel, width: 96, textAlign: 'center' }}>DATA</td>
          </tr>
          <tr>
            <td style={cellLabel}>Referente</td>
            <td style={cellValue}>
              Pernoite em {ph(sol.cidade, 'XXXX')}, Hotel {ph(sol.hotel, 'XXXX')},{' '}
              <strong>UNIDADE: {ph(sol.filial_nome, 'XXXXX')}.</strong>
            </td>
            <td style={{ ...cellValue, textAlign: 'center', fontWeight: 700 }}>
              {sol.data_deposito ? dataBR(sol.data_deposito) : (placeholder ? 'XX/XX/XXXX' : '')}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/** Trilha de aprovação — quem criou, analisou, aprovou/reprovou. */
export function Timeline({ eventos = [], carregando }) {
  if (carregando) return <p style={{ fontSize: 12, color: '#57606A' }}>Carregando histórico…</p>
  if (!eventos.length) return <p style={{ fontSize: 12, color: '#57606A' }}>Sem eventos registrados.</p>

  const rotulo = {
    criado: 'Solicitação criada',
    em_analise: 'Aprovado na etapa 1 → Em análise',
    aprovado: 'Aprovado na etapa 2 → Depósito liberado',
    reprovado: 'Reprovado',
    cancelado: 'Cancelado',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 4 }}>
      {eventos.map((e, i) => {
        const m = STATUS_META[e.para_status] || STATUS_META.pendente
        const ultimo = i === eventos.length - 1
        return (
          <div key={e.id || i} style={{ display: 'flex', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.cor, marginTop: 4 }} />
              {!ultimo && <span style={{ flex: 1, width: 2, background: '#d0d7de', marginTop: 2 }} />}
            </div>
            <div style={{ paddingBottom: ultimo ? 0 : 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{rotulo[e.acao] || e.acao}</div>
              <div style={{ fontSize: 12, color: '#57606A' }}>
                {e.ator_nome || 'Sistema'} · {new Date(e.criado_em).toLocaleString('pt-BR')}
              </div>
              {e.observacao && (
                <div style={{ fontSize: 12, marginTop: 2, fontStyle: 'italic', color: '#444' }}>
                  “{e.observacao}”
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

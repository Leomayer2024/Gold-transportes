import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

function formatBRL(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

function formatHHMM(dec) {
  const totalMin = Math.round((dec || 0) * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatMes(mes) {
  if (!mes) return ''
  const [ano, m] = mes.split('-')
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${meses[parseInt(m, 10) - 1]}/${ano}`
}

export default function HorasExtrasHistoricoPage() {
  const navigate = useNavigate()
  const [meses, setMeses] = useState([])
  const [loading, setLoading] = useState(true)
  const [mesSelecionado, setMesSelecionado] = useState(null)
  const [detalhe, setDetalhe] = useState([])
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [filterNome, setFilterNome] = useState('')
  const [filterFilial, setFilterFilial] = useState('')

  useEffect(() => { carregar() }, [])

  function carregar() {
    setLoading(true)
    api.rtmMeses()
      .then((r) => setMeses(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  function abrirMes(mes) {
    setMesSelecionado(mes)
    setFilterNome('')
    setFilterFilial('')
    setLoadingDetalhe(true)
    api.rtmDetalhe(mes)
      .then((r) => setDetalhe(r.data || []))
      .catch(() => {})
      .finally(() => setLoadingDetalhe(false))
  }

  async function deletarMes(mes) {
    setDeleting(true)
    try {
      await api.rtmDeletar(mes)
      if (mesSelecionado === mes) { setMesSelecionado(null); setDetalhe([]) }
      setConfirmDelete(null)
      carregar()
    } catch (e) {
      alert(e.message || 'Erro ao deletar.')
    } finally {
      setDeleting(false)
    }
  }

  const filialOptions = [...new Set(detalhe.map((r) => r.filial_nome).filter(Boolean))].sort()

  const detalheFiltered = detalhe.filter((r) => {
    if (filterNome && !r.funcionario_nome?.toLowerCase().includes(filterNome.toLowerCase())) return false
    if (filterFilial && r.filial_nome !== filterFilial) return false
    return true
  })

  const totalH50 = detalheFiltered.reduce((s, r) => s + (r.horas_normais || 0), 0)
  const totalH100 = detalheFiltered.reduce((s, r) => s + (r.horas_extra_100 || 0), 0)
  const totalGeral = detalheFiltered.reduce((s, r) => s + (r.total_geral || 0), 0)

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Operação RTM</span>
          <h1>Histórico de Fechamentos</h1>
          <p>Consulte e gerencie os fechamentos mensais de horas extras salvos</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="button-secondary" onClick={() => navigate('/horas-extras-rtm')} type="button">
            ← Calculadora
          </button>
          <button className="button-secondary" onClick={() => navigate('/horas-extras-metricas')} type="button">
            Métricas
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: mesSelecionado ? '280px 1fr' : '1fr', gap: 16 }}>
        {/* Lista de meses */}
        <div>
          {loading ? (
            <div className="surface-card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Carregando…</div>
          ) : meses.length === 0 ? (
            <div className="surface-card empty-state">
              <strong>Nenhum fechamento salvo</strong>
              <p>Use a calculadora RTM para calcular e salvar o fechamento mensal.</p>
              <button className="button-primary" onClick={() => navigate('/horas-extras-rtm')} type="button">
                Ir para Calculadora
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {meses.map((m) => {
                const ativo = mesSelecionado === m.mes_referencia
                return (
                  <div
                    key={m.mes_referencia}
                    className="surface-card"
                    style={{
                      cursor: 'pointer',
                      border: ativo ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                      padding: '12px 14px',
                      transition: 'border 0.15s',
                    }}
                    onClick={() => abrirMes(m.mes_referencia)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: ativo ? 'var(--primary)' : undefined }}>
                          {formatMes(m.mes_referencia)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                          {m.funcionarios} funcionários
                        </div>
                      </div>
                      <button
                        className="button-secondary"
                        style={{ fontSize: 10, padding: '2px 8px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(m.mes_referencia) }}
                        type="button"
                      >
                        Excluir
                      </button>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>H. Normais</div>
                        <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>{formatHHMM(m.total_horas_normais)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>H. Extra 100%</div>
                        <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: m.total_horas_100 > 0 ? 'var(--warning)' : undefined }}>{formatHHMM(m.total_horas_100)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--success)' }}>{formatBRL(m.total_geral)}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Detalhe do mês selecionado */}
        {mesSelecionado && (
          <div>
            <div className="surface-card" style={{ marginBottom: 10, padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <strong style={{ fontSize: 15 }}>Detalhes — {formatMes(mesSelecionado)}</strong>
                <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                  <span>Total H. Normais: <strong style={{ fontFamily: 'monospace' }}>{formatHHMM(totalH50)}</strong></span>
                  <span>H. Extra 100%: <strong style={{ fontFamily: 'monospace', color: totalH100 > 0 ? 'var(--warning)' : undefined }}>{formatHHMM(totalH100)}</strong></span>
                  <span>Total: <strong style={{ color: 'var(--success)' }}>{formatBRL(totalGeral)}</strong></span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  className="input"
                  placeholder="Buscar funcionário…"
                  value={filterNome}
                  onChange={(e) => setFilterNome(e.target.value)}
                  style={{ width: 220 }}
                />
                <select className="input" value={filterFilial} onChange={(e) => setFilterFilial(e.target.value)} style={{ minWidth: 160 }}>
                  <option value="">Todas as filiais</option>
                  {filialOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                {(filterNome || filterFilial) && (
                  <button className="button-secondary" style={{ fontSize: 11 }} onClick={() => { setFilterNome(''); setFilterFilial('') }} type="button">
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {loadingDetalhe ? (
              <div className="surface-card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Carregando…</div>
            ) : (
              <div className="surface-card" style={{ padding: 0 }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ minWidth: 900 }}>
                    <thead>
                      <tr>
                        <th>Funcionário</th>
                        <th>Filial</th>
                        <th>Est.</th>
                        <th style={{ textAlign: 'right' }}>H. Normais</th>
                        <th style={{ textAlign: 'right' }}>H. Extra 100%</th>
                        <th style={{ textAlign: 'right' }}>V.H. 50%</th>
                        <th style={{ textAlign: 'right' }}>V.H. 100%</th>
                        <th style={{ textAlign: 'right' }}>Total 50%</th>
                        <th style={{ textAlign: 'right' }}>Total 100%</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalheFiltered.length === 0 && (
                        <tr>
                          <td colSpan={10} style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0' }}>
                            Nenhum resultado
                          </td>
                        </tr>
                      )}
                      {detalheFiltered.map((r) => (
                        <tr key={r.id}>
                          <td><strong style={{ fontSize: 12 }}>{r.funcionario_nome}</strong></td>
                          <td style={{ fontSize: 11 }}>{r.filial_nome || '—'}</td>
                          <td style={{ fontSize: 11 }}>{r.estado || '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{formatHHMM(r.horas_normais)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: r.horas_extra_100 > 0 ? 'var(--warning)' : '#ccc', fontWeight: r.horas_extra_100 > 0 ? 700 : undefined }}>
                            {formatHHMM(r.horas_extra_100)}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 12 }}>{formatBRL(r.valor_hora_50)}</td>
                          <td style={{ textAlign: 'right', fontSize: 12 }}>{formatBRL(r.valor_hora_100)}</td>
                          <td style={{ textAlign: 'right', fontSize: 12 }}>{formatBRL(r.total_50)}</td>
                          <td style={{ textAlign: 'right', fontSize: 12 }}>{formatBRL(r.total_100)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{formatBRL(r.total_geral)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f0f4f8', fontWeight: 700 }}>
                        <td colSpan={3} style={{ fontSize: 12 }}>TOTAL ({detalheFiltered.length} func.)</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{formatHHMM(totalH50)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: totalH100 > 0 ? 'var(--warning)' : undefined }}>{formatHHMM(totalH100)}</td>
                        <td colSpan={3} />
                        <td />
                        <td style={{ textAlign: 'right', color: 'var(--success)', fontSize: 13 }}>{formatBRL(totalGeral)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal confirmação exclusão */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="surface-card" style={{ maxWidth: 380, width: '100%', margin: 16 }}>
            <h3 style={{ marginTop: 0 }}>Excluir fechamento</h3>
            <p>Tem certeza que deseja excluir o fechamento de <strong>{formatMes(confirmDelete)}</strong>? Esta ação não pode ser desfeita.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="button-secondary" onClick={() => setConfirmDelete(null)} disabled={deleting} type="button">
                Cancelar
              </button>
              <button
                className="button-primary"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={() => deletarMes(confirmDelete)}
                disabled={deleting}
                type="button"
              >
                {deleting ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

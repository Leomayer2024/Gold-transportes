import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { hasScopePermission } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import StatCard from './StatCard'

const COR = { azul: '#1e40af', verde: '#15803d', vermelho: '#b91c1c', cinza: '#64748b' }

function pad2(n) { return String(n).padStart(2, '0') }
function isoDate(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function isoDateTimeLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
function fmtData(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
function fmtSegs(segs) {
  const s = Math.max(0, Math.floor(segs || 0))
  return s > 0 ? `${Math.floor(s / 3600)}h${pad2(Math.floor((s % 3600) / 60))}` : '—'
}

function TipoChip({ tipo }) {
  const entrada = tipo === 'entrada'
  const cor = entrada ? COR.verde : COR.vermelho
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${cor}14`, color: cor, border: `1px solid ${cor}33` }}>
      {entrada ? 'Entrada' : 'Saída'}
    </span>
  )
}

const inputStyle = { padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, background: '#fff' }
const labelStyle = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: COR.cinza, marginBottom: 4, display: 'block' }
const btn = (bg, fg = '#fff') => ({ padding: '8px 14px', borderRadius: 8, border: 'none', background: bg, color: fg, fontWeight: 700, fontSize: 13, cursor: 'pointer' })
const th = { textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: COR.cinza, borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }
const td = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid #eef2f6', whiteSpace: 'nowrap' }

export default function PontoPage() {
  const { profile } = useAuth()
  const canManage = hasScopePermission(profile, 'manage.ponto')

  const [aba, setAba] = useState('resumo')
  const [filtros, setFiltros] = useState({ inicio: isoDate(-7), fim: isoDate(0), filial_id: '', colaborador_id: '', tipo: '' })
  const [filiais, setFiliais] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [resumo, setResumo] = useState([])
  const [batidas, setBatidas] = useState([])
  const [pag, setPag] = useState({ page: 1, page_size: 50, total: 0, has_more: false })
  const [loading, setLoading] = useState(false)
  const [dbReady, setDbReady] = useState(true)
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [expandido, setExpandido] = useState({})

  const [modal, setModal] = useState(null)
  const [modalErro, setModalErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.filiaisDisponiveis().then((r) => setFiliais(Array.isArray(r) ? r : [])).catch(() => {})
    api.list('colaboradores', { per_page: 2000 })
      .then((r) => {
        const rows = Array.isArray(r) ? r : (r.data || r.items || [])
        rows.sort((a, b) => (a.nome_completo || '').localeCompare(b.nome_completo || ''))
        setColaboradores(rows)
      })
      .catch(() => {})
  }, [])

  const carregar = useCallback(async (page = 1) => {
    setLoading(true)
    setErro('')
    try {
      if (aba === 'resumo') {
        const r = await api.pontoResumo(filtros)
        setResumo(r.items || [])
        setDbReady(r.database_ready !== false)
      } else {
        const r = await api.pontoBatidas({ ...filtros, page, page_size: pag.page_size })
        setBatidas(r.items || [])
        setDbReady(r.database_ready !== false)
        setPag((p) => ({ ...p, page: r.page || 1, total: r.total || 0, has_more: !!r.has_more }))
      }
    } catch (e) {
      setErro(e.message || 'Falha ao carregar ponto.')
    } finally {
      setLoading(false)
    }
  }, [aba, filtros, pag.page_size])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(1) }, [aba])

  const totals = useMemo(() => {
    const segs = resumo.reduce((a, x) => a + (x.horas_segundos || 0), 0)
    const colabs = new Set(resumo.map((x) => x.colaborador_id)).size
    const ajustes = resumo.filter((x) => x.tem_ajuste).length
    return { dias: resumo.length, colabs, horas: fmtSegs(segs), ajustes }
  }, [resumo])

  function aplicarFiltros() {
    setExpandido({})
    carregar(1)
  }
  function limparFiltros() {
    setFiltros({ inicio: isoDate(-7), fim: isoDate(0), filial_id: '', colaborador_id: '', tipo: '' })
  }

  async function exportar() {
    setErro('')
    setMsg('Gerando Excel…')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const resp = await fetch(api.pontoExportUrl(filtros), { headers: { Authorization: `Bearer ${token}` } })
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}))
        throw new Error(j.error || `Erro ${resp.status}`)
      }
      const blob = await resp.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ponto_${filtros.inicio}_a_${filtros.fim}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setMsg('Excel exportado.')
    } catch (e) {
      setErro(e.message || 'Falha ao exportar.')
      setMsg('')
    }
  }

  function abrirCriar() {
    setModalErro('')
    setModal({ mode: 'create', colaborador_id: filtros.colaborador_id || '', filial_id: filtros.filial_id || '', tipo: 'entrada', registrado_em: isoDateTimeLocal(), motivo: '', notificar: true })
  }
  function abrirEditar(b) {
    setModalErro('')
    setModal({ mode: 'edit', id: b.id, colaborador_id: b.colaborador_id, colaborador_nome: b.colaborador_nome, filial_id: b.filial_id || '', tipo: b.tipo || 'entrada', registrado_em: b.data && b.hora ? `${b.data}T${b.hora}` : isoDateTimeLocal(), motivo: '', notificar: true })
  }

  async function salvarModal() {
    const m = modal
    if (m.mode === 'create' && !m.colaborador_id) return setModalErro('Selecione o colaborador.')
    if (!['entrada', 'saida'].includes(m.tipo)) return setModalErro('Selecione o tipo.')
    if (!m.registrado_em) return setModalErro('Informe data e hora.')
    if (!m.motivo.trim()) return setModalErro('Informe o motivo do ajuste (auditoria).')
    setSalvando(true)
    setModalErro('')
    try {
      if (m.mode === 'create') {
        await api.pontoCriarBatida({
          colaborador_id: Number(m.colaborador_id),
          filial_id: m.filial_id ? Number(m.filial_id) : null,
          tipo: m.tipo,
          registrado_em: m.registrado_em,
          motivo: m.motivo.trim(),
          notificar: m.notificar,
        })
      } else {
        await api.pontoEditarBatida(m.id, {
          tipo: m.tipo,
          registrado_em: m.registrado_em,
          motivo: m.motivo.trim(),
          notificar: m.notificar,
        })
      }
      setModal(null)
      setMsg('Batida salva.')
      carregar(aba === 'batidas' ? pag.page : 1)
    } catch (e) {
      setModalErro(e.message || 'Falha ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(b) {
    if (!window.confirm(`Excluir a batida de ${b.colaborador_nome} (${fmtData(b.data)} ${b.hora})? Esta ação é registrada na auditoria.`)) return
    setErro('')
    try {
      await api.pontoExcluirBatida(b.id)
      setMsg('Batida excluída.')
      carregar(pag.page)
    } catch (e) {
      setErro(e.message || 'Falha ao excluir.')
    }
  }

  function toggleExpand(key) {
    setExpandido((e) => ({ ...e, [key]: !e[key] }))
  }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Operação RTM</span>
          <h1>Ponto — Batidas faciais</h1>
          <p>Histórico de batidas do app facial, horas trabalhadas por dia, ajuste manual e exportação.</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="surface-card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Início</label>
            <input type="date" value={filtros.inicio} onChange={(e) => setFiltros({ ...filtros, inicio: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Fim</label>
            <input type="date" value={filtros.fim} onChange={(e) => setFiltros({ ...filtros, fim: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Base / Filial</label>
            <select value={filtros.filial_id} onChange={(e) => setFiltros({ ...filtros, filial_id: e.target.value })} style={{ ...inputStyle, minWidth: 160 }}>
              <option value="">Todas</option>
              {filiais.map((f) => (
                <option key={f.id} value={f.id}>{f.cidade}{f.uf ? `/${f.uf}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Colaborador</label>
            <select value={filtros.colaborador_id} onChange={(e) => setFiltros({ ...filtros, colaborador_id: e.target.value })} style={{ ...inputStyle, minWidth: 200 }}>
              <option value="">Todos</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>{c.nome_completo}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Tipo</label>
            <select value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })} style={inputStyle}>
              <option value="">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </div>
          <button onClick={aplicarFiltros} style={btn(COR.azul)} disabled={loading}>{loading ? 'Carregando…' : 'Filtrar'}</button>
          <button onClick={limparFiltros} style={btn('#e2e8f0', '#334155')}>Limpar</button>
          <div style={{ flex: 1 }} />
          {canManage && <button onClick={abrirCriar} style={btn(COR.verde)}>+ Lançar batida</button>}
          <button onClick={exportar} style={btn('#0f766e')}>Exportar Excel</button>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['resumo', 'Horas por dia'], ['batidas', 'Batidas (lista)']].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setAba(k)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              border: aba === k ? `1px solid ${COR.azul}` : '1px solid #e2e8f0',
              background: aba === k ? COR.azul : '#fff', color: aba === k ? '#fff' : '#334155',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {erro && <div className="surface-card" style={{ padding: 12, marginBottom: 12, background: '#fef2f2', color: COR.vermelho, fontWeight: 600 }}>{erro}</div>}
      {msg && !erro && <div className="surface-card" style={{ padding: 12, marginBottom: 12, background: '#f0fdf4', color: COR.verde, fontWeight: 600 }}>{msg}</div>}
      {!dbReady && (
        <div className="surface-card" style={{ padding: 12, marginBottom: 12, background: '#fffbeb', color: '#92400e', fontWeight: 600 }}>
          A tabela de ponto ainda não existe no banco. Rode <code>SQL_PONTO_FACIAL.sql</code> e a migration <code>019</code>.
        </div>
      )}

      {aba === 'resumo' ? (
        <Fragment>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
            <StatCard label="Dias com batida" value={totals.dias} />
            <StatCard label="Colaboradores" value={totals.colabs} />
            <StatCard label="Horas totais" value={totals.horas} tone="success" />
            <StatCard label="Dias com ajuste manual" value={totals.ajustes} hint="batidas editadas/lançadas" />
          </div>

          <div className="surface-card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}></th>
                  <th style={th}>Data</th>
                  <th style={th}>Colaborador</th>
                  <th style={th}>Base</th>
                  <th style={th}>Entrada</th>
                  <th style={th}>Saída</th>
                  <th style={th}>Batidas</th>
                  <th style={th}>Horas</th>
                  <th style={th}>Ajuste</th>
                </tr>
              </thead>
              <tbody>
                {resumo.length === 0 && !loading && (
                  <tr><td style={{ ...td, textAlign: 'center', color: COR.cinza }} colSpan={9}>Nenhuma batida no período.</td></tr>
                )}
                {resumo.map((g) => {
                  const key = `${g.colaborador_id}-${g.data}`
                  const aberto = !!expandido[key]
                  return (
                    <Fragment key={key}>
                      <tr style={{ cursor: 'pointer' }} onClick={() => toggleExpand(key)}>
                        <td style={{ ...td, color: COR.cinza, width: 28 }}>{aberto ? '▾' : '▸'}</td>
                        <td style={td}>{fmtData(g.data)}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{g.colaborador_nome}</td>
                        <td style={td}>{g.filial_label || '—'}</td>
                        <td style={{ ...td, color: COR.verde, fontFamily: 'monospace' }}>{g.primeira_entrada}</td>
                        <td style={{ ...td, color: COR.vermelho, fontFamily: 'monospace' }}>{g.ultima_saida}</td>
                        <td style={td}>{g.qtd_batidas}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{g.horas_texto}</td>
                        <td style={td}>{g.tem_ajuste ? <span style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', padding: '1px 6px', borderRadius: 4 }}>manual</span> : ''}</td>
                      </tr>
                      {aberto && (
                        <tr>
                          <td style={{ ...td, background: '#f8fafc' }} colSpan={9}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {(g.batidas || []).map((b) => (
                                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{b.hora}</span>
                                  <TipoChip tipo={b.tipo} />
                                  {b.ajustado_por && <span style={{ fontSize: 10, color: '#92400e' }}>✎ {b.ajustado_por}</span>}
                                  {canManage && (
                                    <Fragment>
                                      <button onClick={() => abrirEditar({ ...b, colaborador_id: g.colaborador_id, colaborador_nome: g.colaborador_nome, filial_id: g.filial_id })} style={{ ...btn('#e0e7ff', COR.azul), padding: '3px 8px', fontSize: 11 }}>Editar</button>
                                      <button onClick={() => excluir({ ...b, colaborador_nome: g.colaborador_nome })} style={{ ...btn('#fee2e2', COR.vermelho), padding: '3px 8px', fontSize: 11 }}>Excluir</button>
                                    </Fragment>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Fragment>
      ) : (
        <Fragment>
          <div className="surface-card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Data</th>
                  <th style={th}>Hora</th>
                  <th style={th}>Colaborador</th>
                  <th style={th}>Base</th>
                  <th style={th}>Tipo</th>
                  <th style={th}>Origem</th>
                  <th style={th}>Ajustado por</th>
                  {canManage && <th style={th}>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {batidas.length === 0 && !loading && (
                  <tr><td style={{ ...td, textAlign: 'center', color: COR.cinza }} colSpan={canManage ? 8 : 7}>Nenhuma batida no período.</td></tr>
                )}
                {batidas.map((b) => (
                  <tr key={b.id}>
                    <td style={td}>{fmtData(b.data)}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>{b.hora}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{b.colaborador_nome}</td>
                    <td style={td}>{b.filial_label || '—'}</td>
                    <td style={td}><TipoChip tipo={b.tipo} /></td>
                    <td style={{ ...td, color: COR.cinza, fontSize: 12 }}>{b.origem === 'manual_admin' ? 'Manual' : (b.origem || '—')}</td>
                    <td style={{ ...td, fontSize: 12 }}>{b.ajustado_por ? <span style={{ color: '#92400e' }}>✎ {b.ajustado_por}</span> : '—'}</td>
                    {canManage && (
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => abrirEditar(b)} style={{ ...btn('#e0e7ff', COR.azul), padding: '4px 10px', fontSize: 12 }}>Editar</button>
                          <button onClick={() => excluir(b)} style={{ ...btn('#fee2e2', COR.vermelho), padding: '4px 10px', fontSize: 12 }}>Excluir</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: COR.cinza }}>
            <span>{pag.total} batida(s) · página {pag.page}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => carregar(pag.page - 1)} disabled={pag.page <= 1 || loading} style={btn('#e2e8f0', '#334155')}>◀ Anterior</button>
              <button onClick={() => carregar(pag.page + 1)} disabled={!pag.has_more || loading} style={btn('#e2e8f0', '#334155')}>Próxima ▶</button>
            </div>
          </div>
        </Fragment>
      )}

      {/* Modal criar/editar */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => !salvando && setModal(null)}>
          <div className="surface-card" style={{ width: 460, maxWidth: '100%', padding: 22 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>{modal.mode === 'create' ? 'Lançar batida manual' : 'Ajustar batida'}</h2>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: COR.cinza }}>
              {modal.mode === 'edit' ? modal.colaborador_nome : 'Registro manual com auditoria.'} · horário local (São Paulo).
            </p>

            {modal.mode === 'create' && (
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Colaborador</label>
                <select value={modal.colaborador_id} onChange={(e) => setModal({ ...modal, colaborador_id: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
                  <option value="">Selecione…</option>
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome_completo}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Tipo</label>
                <select value={modal.tipo} onChange={(e) => setModal({ ...modal, tipo: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </div>
              <div style={{ flex: 1.4 }}>
                <label style={labelStyle}>Data e hora</label>
                <input type="datetime-local" value={modal.registrado_em} onChange={(e) => setModal({ ...modal, registrado_em: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Motivo do ajuste (obrigatório)</label>
              <textarea value={modal.motivo} onChange={(e) => setModal({ ...modal, motivo: e.target.value })} rows={2} placeholder="Ex.: esqueceu de bater a saída" style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={modal.notificar} onChange={(e) => setModal({ ...modal, notificar: e.target.checked })} />
              Notificar o colaborador por e-mail (se houver e-mail cadastrado)
            </label>

            {modalErro && <div style={{ background: '#fef2f2', color: COR.vermelho, padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12, fontWeight: 600 }}>{modalErro}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setModal(null)} disabled={salvando} style={btn('#e2e8f0', '#334155')}>Cancelar</button>
              <button onClick={salvarModal} disabled={salvando} style={btn(COR.verde)}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

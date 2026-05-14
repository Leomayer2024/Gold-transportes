import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'

// ─── Utilitários ──────────────────────────────────────────────────────────────
function parseHoras(str) {
  if (!str || !str.trim()) return 0
  const parts = str.trim().split(':')
  if (parts.length < 2) return parseFloat(str.replace(',', '.')) || 0
  return (parseInt(parts[0], 10) || 0) + (parseInt(parts[1], 10) || 0) / 60 + (parseInt(parts[2], 10) || 0) / 3600
}
function formatHHMM(dec) {
  const totalMin = Math.round((dec || 0) * 60)
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
}
function formatBRL(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}
function parseBRL(str) {
  return parseFloat((str || '').replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0
}
function numericStr(val) {
  return val && val !== 0 ? val.toFixed(2).replace('.', ',') : ''
}
function calcValorHora(col) {
  const salary = parseFloat(col?.salario_base_mensal) || 0
  const weeklyH = parseFloat(col?.carga_horaria_semanal) || 44
  const monthlyH = weeklyH * (52 / 12)
  return salary === 0 || monthlyH === 0 ? 0 : salary / monthlyH
}
function normName(s) {
  return (s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}
function matchColaborador(nomePasta, lista) {
  const n = normName(nomePasta)
  if (!n) return null
  let found = lista.find((c) => normName(c.nome_completo) === n)
  if (found) return found
  found = lista.find((c) => { const cn = normName(c.nome_completo); return cn && (n.includes(cn) || cn.includes(n)) })
  if (found) return found
  const words = n.split(/\s+/).filter((w) => w.length > 3)
  return words.length > 0 ? lista.find((c) => { const cn = normName(c.nome_completo); return words.every((w) => cn.includes(w)) }) || null : null
}
function parsePaste(text) {
  if (!text.trim()) return []
  const seen = new Set()
  return text.trim().split('\n').map((row) => {
    const cols = row.split('\t').map((c) => c.trim())
    if (!cols[0] || /^funcionario/i.test(cols[0]) || /^nome/i.test(cols[0])) return null
    const hn = cols[3] || '00:00:00'
    const he = cols[4] || '00:00:00'
    return { funcionario: cols[0], filial_pasta: cols[1] || '', estado: cols[2] || '', horas_normais_str: hn, horas_extra_100_str: he, horas_normais: parseHoras(hn), horas_extra_100: parseHoras(he) }
  }).filter((r) => { if (!r) return false; const key = normName(r.funcionario); if (seen.has(key)) return false; seen.add(key); return true })
}
function formatMes(mes) {
  if (!mes) return ''
  const [ano, m] = (mes || '').split('-')
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${nomes[parseInt(m, 10) - 1]}/${ano}`
}
function formatMesLabel(mes) {
  if (!mes) return ''
  const [ano, m] = mes.split('-')
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${nomes[parseInt(m, 10) - 1]}/${ano.slice(2)}`
}
function downloadTemplate() {
  const cols = ['FUNCIONARIO', 'Filial', 'ESTADO', 'HORAS NORMAIS', 'H.EXTRA 100%']
  const cells = cols.map((c) => `<Cell><Data ss:Type="String">${c}</Data></Cell>`).join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="H"><Font ss:Bold="1"/></Style></Styles><Worksheet ss:Name="Horas Extras"><Table><Row ss:StyleID="H">${cells}</Row></Table></Worksheet></Workbook>`
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' })), download: 'modelo_horas_extras.xls' })
  a.click()
}

// ─── Componentes de gráfico (CSS/SVG puro) ────────────────────────────────────
function BarChart({ data, valueKey, labelKey, color = 'var(--primary)', formatValue, title }) {
  const max = Math.max(...data.map((d) => d[valueKey] || 0), 0.001)
  return (
    <div>
      {title && <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10, letterSpacing: '0.05em' }}>{title}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((d, i) => {
          const pct = Math.max((d[valueKey] / max) * 100, 1)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 150, fontSize: 11, textAlign: 'right', color: '#444', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }} title={d[labelKey]}>{d[labelKey]}</div>
              <div style={{ flex: 1, background: '#f0f4f8', borderRadius: 4, height: 22, position: 'relative', minWidth: 80 }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: color, borderRadius: 4 }} />
                <span style={{ position: 'absolute', left: 8, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: pct > 35 ? '#fff' : '#333', zIndex: 1 }}>
                  {formatValue ? formatValue(d[valueKey]) : d[valueKey]}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
function LineChart({ data, valueKey, labelKey, color = 'var(--primary)', formatValue, title }) {
  const values = data.map((d) => d[valueKey] || 0)
  const max = Math.max(...values, 0.001)
  const [W, H, pad] = [600, 130, { top: 14, right: 20, bottom: 28, left: 10 }]
  const iW = W - pad.left - pad.right, iH = H - pad.top - pad.bottom
  const pts = data.map((d, i) => ({ x: pad.left + (i / Math.max(data.length - 1, 1)) * iW, y: pad.top + (1 - d[valueKey] / max) * iH, d }))
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = pts.length > 0 ? `${pathD} L ${pts[pts.length - 1].x} ${pad.top + iH} L ${pts[0].x} ${pad.top + iH} Z` : ''
  return (
    <div>
      {title && <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8, letterSpacing: '0.05em' }}>{title}</div>}
      {data.length < 2 ? <div style={{ color: 'var(--muted)', fontSize: 12 }}>Mínimo 2 meses para exibir o gráfico.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 300, height: H }}>
            <defs><linearGradient id={`g-${valueKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25" /><stop offset="100%" stopColor={color} stopOpacity="0.02" /></linearGradient></defs>
            <path d={areaD} fill={`url(#g-${valueKey})`} />
            <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="4" fill={color} stroke="#fff" strokeWidth="2" />
                <text x={p.x} y={H - 4} textAnchor="middle" fontSize="9" fill="#888">{p.d[labelKey]}</text>
                <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill={color} fontWeight="700">{formatValue ? formatValue(p.d[valueKey]) : p.d[valueKey]}</text>
              </g>
            ))}
            <line x1={pad.left} y1={pad.top + iH} x2={pad.left + iW} y2={pad.top + iH} stroke="#e0e4ea" strokeWidth="1" />
          </svg>
        </div>
      )}
    </div>
  )
}

// ─── Aba Histórico ─────────────────────────────────────────────────────────────
function AbaHistorico() {
  const [meses, setMeses] = useState([])
  const [loading, setLoading] = useState(true)
  const [mesSel, setMesSel] = useState(null)
  const [detalhe, setDetalhe] = useState([])
  const [loadingDet, setLoadingDet] = useState(false)
  const [filterNome, setFilterNome] = useState('')
  const [filterFilial, setFilterFilial] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [editando, setEditando] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { carregar() }, [])

  function carregar() {
    setLoading(true)
    api.rtmMeses().then((r) => setMeses(r.data || [])).catch(() => {}).finally(() => setLoading(false))
  }

  function abrirMes(mes) {
    setMesSel(mes); setFilterNome(''); setFilterFilial(''); setLoadingDet(true)
    api.rtmDetalhe(mes).then((r) => setDetalhe(r.data || [])).catch(() => {}).finally(() => setLoadingDet(false))
  }

  async function deletarMes(mes) {
    setDeleting(true)
    try {
      await api.rtmDeletar(mes)
      if (mesSel === mes) { setMesSel(null); setDetalhe([]) }
      setConfirmDelete(null); carregar()
    } catch (e) { alert(e.message || 'Erro ao excluir.') }
    finally { setDeleting(false) }
  }

  function abrirEdicao(r) {
    setEditando(r.id)
    setEditForm({
      horas_normais: r.horas_normais?.toFixed(4) || '0',
      horas_extra_100: r.horas_extra_100?.toFixed(4) || '0',
      valor_hora_50: r.valor_hora_50?.toFixed(2) || '0',
      valor_hora_100: r.valor_hora_100?.toFixed(2) || '0',
    })
  }

  async function salvarEdicao() {
    setSaving(true)
    try {
      await api.rtmEditarRegistro(editando, {
        horas_normais: parseFloat(editForm.horas_normais) || 0,
        horas_extra_100: parseFloat(editForm.horas_extra_100) || 0,
        valor_hora_50: parseFloat(editForm.valor_hora_50) || 0,
        valor_hora_100: parseFloat(editForm.valor_hora_100) || 0,
      })
      setEditando(null)
      api.rtmDetalhe(mesSel).then((r) => setDetalhe(r.data || []))
      carregar()
    } catch (e) { alert(e.message || 'Erro ao salvar.') }
    finally { setSaving(false) }
  }

  const filialOpts = [...new Set(detalhe.map((r) => r.filial_nome).filter(Boolean))].sort()
  const detFiltrado = detalhe.filter((r) => {
    if (filterNome && !r.funcionario_nome?.toLowerCase().includes(filterNome.toLowerCase())) return false
    if (filterFilial && r.filial_nome !== filterFilial) return false
    return true
  })
  const totH50 = detFiltrado.reduce((s, r) => s + (r.horas_normais || 0), 0)
  const totH100 = detFiltrado.reduce((s, r) => s + (r.horas_extra_100 || 0), 0)
  const totGeral = detFiltrado.reduce((s, r) => s + (r.total_geral || 0), 0)

  // preview dos totais ao editar
  const prevT50 = (parseFloat(editForm.horas_normais) || 0) * (parseFloat(editForm.valor_hora_50) || 0)
  const prevT100 = (parseFloat(editForm.horas_extra_100) || 0) * (parseFloat(editForm.valor_hora_100) || 0)

  return (
    <div>
      {loading ? (
        <div className="surface-card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Carregando…</div>
      ) : meses.length === 0 ? (
        <div className="surface-card empty-state">
          <strong>Nenhum fechamento salvo</strong>
          <p>Use a aba Calculadora para calcular e salvar um fechamento mensal.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: mesSel ? '260px 1fr' : '1fr', gap: 14 }}>
          {/* Cards de meses */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {meses.map((m) => {
              const ativo = mesSel === m.mes_referencia
              return (
                <div key={m.mes_referencia} className="surface-card"
                  style={{ cursor: 'pointer', padding: '10px 14px', border: ativo ? '2px solid var(--primary)' : '1px solid var(--border-light)' }}
                  onClick={() => abrirMes(m.mes_referencia)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: ativo ? 'var(--primary)' : undefined }}>{formatMes(m.mes_referencia)}</span>
                    <button className="button-secondary" type="button"
                      style={{ fontSize: 10, padding: '2px 8px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(m.mes_referencia) }}>
                      Excluir
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{m.funcionarios} funcionários</div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>H. Normais</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{formatHHMM(m.total_horas_normais)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>H. Extra 100%</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: m.total_horas_100 > 0 ? 'var(--warning)' : undefined }}>{formatHHMM(m.total_horas_100)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total</div>
                      <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--success)' }}>{formatBRL(m.total_geral)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Detalhe */}
          {mesSel && (
            <div>
              <div className="surface-card" style={{ marginBottom: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>Detalhes — {formatMes(mesSel)}</strong>
                  <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
                    <span>H. Normais: <strong style={{ fontFamily: 'monospace' }}>{formatHHMM(totH50)}</strong></span>
                    <span>H. Extra 100%: <strong style={{ fontFamily: 'monospace', color: totH100 > 0 ? 'var(--warning)' : undefined }}>{formatHHMM(totH100)}</strong></span>
                    <span>Total: <strong style={{ color: 'var(--success)' }}>{formatBRL(totGeral)}</strong></span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input className="input" placeholder="Buscar funcionário…" value={filterNome} onChange={(e) => setFilterNome(e.target.value)} style={{ width: 200 }} />
                  <select className="input" value={filterFilial} onChange={(e) => setFilterFilial(e.target.value)} style={{ minWidth: 150 }}>
                    <option value="">Todas as filiais</option>
                    {filialOpts.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  {(filterNome || filterFilial) && <button className="button-secondary" style={{ fontSize: 11 }} onClick={() => { setFilterNome(''); setFilterFilial('') }} type="button">Limpar</button>}
                </div>
              </div>

              {loadingDet ? (
                <div className="surface-card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Carregando…</div>
              ) : (
                <div className="surface-card" style={{ padding: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ minWidth: 860 }}>
                      <thead>
                        <tr>
                          <th>Funcionário</th><th>Filial</th><th>Est.</th>
                          <th style={{ textAlign: 'right' }}>H. Normais</th>
                          <th style={{ textAlign: 'right' }}>H. Extra 100%</th>
                          <th style={{ textAlign: 'right' }}>V.H. 50%</th>
                          <th style={{ textAlign: 'right' }}>V.H. 100%</th>
                          <th style={{ textAlign: 'right' }}>Total 50%</th>
                          <th style={{ textAlign: 'right' }}>Total 100%</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th style={{ width: 70 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {detFiltrado.length === 0 && (
                          <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0' }}>Nenhum resultado</td></tr>
                        )}
                        {detFiltrado.map((r) => {
                          const emEdicao = editando === r.id
                          if (emEdicao) {
                            return (
                              <tr key={r.id} style={{ background: '#fffbec' }}>
                                <td colSpan={3}><strong style={{ fontSize: 12 }}>{r.funcionario_nome}</strong></td>
                                <td>
                                  <input className="input" value={editForm.horas_normais} onChange={(e) => setEditForm((f) => ({ ...f, horas_normais: e.target.value }))}
                                    style={{ width: 80, textAlign: 'right', fontSize: 12 }} title="Ex: 8.5 (horas decimais)" />
                                </td>
                                <td>
                                  <input className="input" value={editForm.horas_extra_100} onChange={(e) => setEditForm((f) => ({ ...f, horas_extra_100: e.target.value }))}
                                    style={{ width: 80, textAlign: 'right', fontSize: 12 }} />
                                </td>
                                <td>
                                  <input className="input" value={editForm.valor_hora_50} onChange={(e) => setEditForm((f) => ({ ...f, valor_hora_50: e.target.value }))}
                                    style={{ width: 80, textAlign: 'right', fontSize: 12 }} />
                                </td>
                                <td>
                                  <input className="input" value={editForm.valor_hora_100} onChange={(e) => setEditForm((f) => ({ ...f, valor_hora_100: e.target.value }))}
                                    style={{ width: 80, textAlign: 'right', fontSize: 12 }} />
                                </td>
                                <td style={{ textAlign: 'right', fontSize: 11, color: 'var(--muted)' }}>{formatBRL(prevT50)}</td>
                                <td style={{ textAlign: 'right', fontSize: 11, color: 'var(--muted)' }}>{formatBRL(prevT100)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)', fontSize: 12 }}>{formatBRL(prevT50 + prevT100)}</td>
                                <td style={{ display: 'flex', gap: 4, padding: '6px 8px' }}>
                                  <button className="button-primary" style={{ fontSize: 10, padding: '3px 8px' }} onClick={salvarEdicao} disabled={saving} type="button">{saving ? '…' : 'OK'}</button>
                                  <button className="button-secondary" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => setEditando(null)} type="button">✕</button>
                                </td>
                              </tr>
                            )
                          }
                          return (
                            <tr key={r.id}>
                              <td><strong style={{ fontSize: 12 }}>{r.funcionario_nome}</strong></td>
                              <td style={{ fontSize: 11 }}>{r.filial_nome || '—'}</td>
                              <td style={{ fontSize: 11 }}>{r.estado || '—'}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{formatHHMM(r.horas_normais)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: r.horas_extra_100 > 0 ? 'var(--warning)' : '#ccc', fontWeight: r.horas_extra_100 > 0 ? 700 : undefined }}>{formatHHMM(r.horas_extra_100)}</td>
                              <td style={{ textAlign: 'right', fontSize: 12 }}>{formatBRL(r.valor_hora_50)}</td>
                              <td style={{ textAlign: 'right', fontSize: 12 }}>{formatBRL(r.valor_hora_100)}</td>
                              <td style={{ textAlign: 'right', fontSize: 12 }}>{formatBRL(r.total_50)}</td>
                              <td style={{ textAlign: 'right', fontSize: 12 }}>{formatBRL(r.total_100)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{formatBRL(r.total_geral)}</td>
                              <td><button className="button-secondary" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => abrirEdicao(r)} type="button">Editar</button></td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#f0f4f8', fontWeight: 700 }}>
                          <td colSpan={3} style={{ fontSize: 12 }}>TOTAL ({detFiltrado.length} func.)</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{formatHHMM(totH50)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: totH100 > 0 ? 'var(--warning)' : undefined }}>{formatHHMM(totH100)}</td>
                          <td colSpan={4} />
                          <td style={{ textAlign: 'right', color: 'var(--success)', fontSize: 13 }}>{formatBRL(totGeral)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal exclusão */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="surface-card" style={{ maxWidth: 360, width: '100%', margin: 16 }}>
            <h3 style={{ marginTop: 0 }}>Excluir fechamento</h3>
            <p>Excluir o fechamento de <strong>{formatMes(confirmDelete)}</strong>? Esta ação não pode ser desfeita.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="button-secondary" onClick={() => setConfirmDelete(null)} disabled={deleting} type="button">Cancelar</button>
              <button className="button-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => deletarMes(confirmDelete)} disabled={deleting} type="button">{deleting ? 'Excluindo…' : 'Excluir'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Aba Gráficos ──────────────────────────────────────────────────────────────
function RankingBar({ items, valueKey, labelKey, colorBar, formatValue, limit = 10 }) {
  const top = items.slice(0, limit)
  const max = Math.max(...top.map((d) => d[valueKey] || 0), 0.001)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {top.map((d, i) => {
        const pct = Math.max((d[valueKey] / max) * 100, 1)
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 20, fontSize: 10, fontWeight: 700, color: i < 3 ? colorBar : 'var(--muted)', textAlign: 'right', flexShrink: 0 }}>{i + 1}º</div>
            <div style={{ flex: 1, background: '#f0f4f8', borderRadius: 4, height: 24, position: 'relative', minWidth: 60 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: i === 0 ? colorBar : i < 3 ? colorBar + 'cc' : colorBar + '66', borderRadius: 4 }} />
              <span style={{ position: 'absolute', right: 8, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: '#333', zIndex: 1 }}>
                {formatValue ? formatValue(d[valueKey]) : d[valueKey]}
              </span>
            </div>
            <div style={{ width: 160, fontSize: 11, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }} title={d[labelKey]}>{d[labelKey]}</div>
          </div>
        )
      })}
    </div>
  )
}

function KpiCard({ label, value, sub, color, mono, icon, accent }) {
  return (
    <div style={{ flex: '1 1 160px', minWidth: 160, padding: '16px 20px', background: accent || '#fff', border: `1.5px solid ${color ? color + '33' : 'var(--border-light)'}`, borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: color || 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon && <span style={{ fontSize: 14 }}>{icon}</span>}{label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, fontFamily: mono ? 'monospace' : undefined, color: color || '#111', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function AbaGraficos() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rankTab, setRankTab] = useState('h100')

  useEffect(() => { api.rtmMetricas().then(setData).catch(() => {}).finally(() => setLoading(false)) }, [])

  if (loading) return <div className="surface-card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 48 }}>Carregando gráficos…</div>

  const evolucao = data?.evolucao_mensal || []
  const mesesN = evolucao.length
  if (!data || mesesN === 0) return (
    <div className="surface-card empty-state">
      <strong>Nenhum dado</strong>
      <p>Salve ao menos um fechamento na aba Calculadora para ver os gráficos.</p>
    </div>
  )

  const totGeral = evolucao.reduce((s, m) => s + (m.total || 0), 0)
  const totH50 = evolucao.reduce((s, m) => s + (m.horas_normais || 0), 0)
  const totH100 = evolucao.reduce((s, m) => s + (m.horas_extra_100 || 0), 0)
  const totT50 = evolucao.reduce((s, m) => s + (m.total_50 || 0), 0)
  const totT100 = evolucao.reduce((s, m) => s + (m.total_100 || 0), 0)
  const mediaM = mesesN > 0 ? totGeral / mesesN : 0
  const pct100 = totGeral > 0 ? (totT100 / totGeral) * 100 : 0
  const pct50 = totGeral > 0 ? (totT50 / totGeral) * 100 : 0
  const anoAtual = String(new Date().getFullYear())
  const resumoAnoAtual = (data.resumo_por_ano || []).find((r) => r.ano === anoAtual)
  const evoluacaoChartData = evolucao.map((m) => ({ ...m, label: formatMesLabel(m.mes) }))

  const rankTabs = [
    { key: 'h100', label: 'Top H. Extra 100%' },
    { key: 'h50', label: 'Top H. Normais 50%' },
    { key: 'custo', label: 'Top Custo Total' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── KPIs Linha 1 ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <KpiCard label="Custo Acumulado" value={formatBRL(totGeral)} sub={`${mesesN} mes${mesesN !== 1 ? 'es' : ''} fechados`} color="var(--success)" accent="var(--success-bg)" icon="💰" />
        <KpiCard label="Média Mensal" value={formatBRL(mediaM)} sub="custo médio por mês" color="var(--primary)" />
        <KpiCard label="H. Extra 100%" value={formatHHMM(totH100)} sub={`${pct100.toFixed(1)}% do custo total`} color="#d97706" mono />
        <KpiCard label="H. Normais 50%" value={formatHHMM(totH50)} sub={`${pct50.toFixed(1)}% do custo total`} color="#059669" mono />
        {resumoAnoAtual && (
          <KpiCard label={`Total ${anoAtual}`} value={formatBRL(resumoAnoAtual.total)} sub={`${resumoAnoAtual.meses} meses no ano`} color="#7c3aed" accent="#f5f3ff" />
        )}
      </div>

      {/* ── Distribuição % 50 x 100 ── */}
      <div className="surface-card" style={{ padding: '14px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.06em', marginBottom: 10 }}>Distribuição do custo — 50% vs 100%</div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', background: '#f0f4f8' }}>
              {totT50 > 0 && <div style={{ width: `${pct50}%`, background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{pct50.toFixed(0)}%</span>
              </div>}
              {totT100 > 0 && <div style={{ width: `${pct100}%`, background: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{pct100.toFixed(0)}%</span>
              </div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#059669', borderRadius: 2, marginRight: 5 }} /><strong>{formatBRL(totT50)}</strong> — H. Normais 50%</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#d97706', borderRadius: 2, marginRight: 5 }} /><strong>{formatBRL(totT100)}</strong> — H. Extra 100%</span>
          </div>
        </div>
      </div>

      {/* ── Evolução mensal ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="surface-card">
          <LineChart title="Evolução mensal — Custo total (R$)" data={evoluacaoChartData} valueKey="total" labelKey="label" color="var(--primary)" formatValue={(v) => `R$${(v / 1000).toFixed(1)}k`} />
        </div>
        <div className="surface-card">
          <LineChart title="Evolução mensal — Horas extras 100%" data={evoluacaoChartData} valueKey="horas_extra_100" labelKey="label" color="#d97706" formatValue={formatHHMM} />
        </div>
      </div>

      {/* ── Rankings colaboradores ── */}
      <div className="surface-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Top 10 Colaboradores</div>
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border-light)' }}>
            {rankTabs.map((t) => (
              <button key={t.key} onClick={() => setRankTab(t.key)} type="button"
                style={{ padding: '5px 12px', fontSize: 11, fontWeight: rankTab === t.key ? 700 : 400, background: 'none', border: 'none', borderBottom: rankTab === t.key ? '2px solid var(--primary)' : '2px solid transparent', color: rankTab === t.key ? 'var(--primary)' : 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: -2 }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {rankTab === 'h100' && <RankingBar items={data.top_funcionarios_100 || []} valueKey="horas_extra_100" labelKey="funcionario" colorBar="#d97706" formatValue={formatHHMM} />}
        {rankTab === 'h50' && <RankingBar items={data.top_funcionarios_50 || []} valueKey="horas_normais" labelKey="funcionario" colorBar="#059669" formatValue={formatHHMM} />}
        {rankTab === 'custo' && <RankingBar items={[...(data.top_funcionarios_100 || [])].sort((a, b) => b.total - a.total)} valueKey="total" labelKey="funcionario" colorBar="var(--primary)" formatValue={formatBRL} />}
      </div>

      {/* ── Top Filiais ── */}
      <div className="surface-card">
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Top Filiais — Custo total acumulado</div>
        <RankingBar items={data.top_filiais || []} valueKey="total" labelKey="filial" colorBar="var(--primary)" formatValue={formatBRL} limit={12} />
      </div>

      {/* ── Resumo por ano ── */}
      {(data.resumo_por_ano || []).length > 0 && (
        <div className="surface-card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-light)', fontSize: 13, fontWeight: 700 }}>Resumo por Ano</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th>Ano</th>
                  <th style={{ textAlign: 'center' }}>Meses</th>
                  <th style={{ textAlign: 'right' }}>H. Normais 50%</th>
                  <th style={{ textAlign: 'right' }}>H. Extra 100%</th>
                  <th style={{ textAlign: 'right' }}>Total 50%</th>
                  <th style={{ textAlign: 'right' }}>Total 100%</th>
                  <th style={{ textAlign: 'right' }}>Total Geral</th>
                  <th style={{ textAlign: 'right' }}>% 100%</th>
                </tr>
              </thead>
              <tbody>
                {(data.resumo_por_ano || []).map((r) => {
                  const pct = r.total > 0 ? (r.total_100 / r.total) * 100 : 0
                  return (
                    <tr key={r.ano}>
                      <td><strong style={{ fontSize: 14 }}>{r.ano}</strong></td>
                      <td style={{ textAlign: 'center' }}>{r.meses}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{formatHHMM(r.horas_normais)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: r.horas_extra_100 > 0 ? '#d97706' : '#ccc', fontWeight: r.horas_extra_100 > 0 ? 700 : undefined }}>{formatHHMM(r.horas_extra_100)}</td>
                      <td style={{ textAlign: 'right', fontSize: 12 }}>{formatBRL(r.total_50)}</td>
                      <td style={{ textAlign: 'right', fontSize: 12 }}>{formatBRL(r.total_100)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--success)', fontSize: 14 }}>{formatBRL(r.total)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: pct > 20 ? '#fef3c7' : '#f0fdf4', color: pct > 20 ? '#92400e' : '#059669' }}>{pct.toFixed(1)}%</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Página principal com abas ─────────────────────────────────────────────────
export default function HorasExtrasRTMPage() {
  const [abaAtiva, setAbaAtiva] = useState('calc')

  const abas = [
    { key: 'calc', label: 'Calculadora' },
    { key: 'historico', label: 'Histórico' },
    { key: 'graficos', label: 'Gráficos' },
  ]

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Operação RTM</span>
          <h1>Horas Extras</h1>
          <p>Calculadora, fechamentos mensais e análise gráfica</p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border-light)', marginBottom: 16 }}>
        {abas.map((a) => (
          <button key={a.key} onClick={() => setAbaAtiva(a.key)} type="button"
            style={{ padding: '9px 20px', fontSize: 13, fontWeight: abaAtiva === a.key ? 700 : 400, background: 'none', border: 'none', borderBottom: abaAtiva === a.key ? '2px solid var(--primary)' : '2px solid transparent', color: abaAtiva === a.key ? 'var(--primary)' : 'var(--muted)', cursor: 'pointer', marginBottom: -2 }}>
            {a.label}
          </button>
        ))}
      </div>

      {abaAtiva === 'calc' && <AbaCalculadora />}
      {abaAtiva === 'historico' && <AbaHistorico />}
      {abaAtiva === 'graficos' && <AbaGraficos />}
    </section>
  )
}

// ─── Aba Calculadora ───────────────────────────────────────────────────────────
function AbaCalculadora() {
  const [todosColaboradores, setTodosColaboradores] = useState([])
  const [loadingColab, setLoadingColab] = useState(false)
  const [fallback50, setFallback50] = useState('')
  const [fallback100, setFallback100] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [rows, setRows] = useState([])
  const [parsed, setParsed] = useState(false)
  const hoje = new Date()
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const [mesReferencia, setMesReferencia] = useState(mesAtual)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [filterNome, setFilterNome] = useState('')
  const [filterFilial, setFilterFilial] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterStatus, setFilterStatus] = useState('todos')

  useEffect(() => {
    setLoadingColab(true)
    api.list('colaboradores', { limit: 2000 }).then((res) => setTodosColaboradores(res.items || res || [])).catch(() => {}).finally(() => setLoadingColab(false))
  }, [])

  function doCalculate() {
    const data = parsePaste(pasteText)
    const fb50 = parseBRL(fallback50), fb100 = parseBRL(fallback100)
    setRows(data.map((r) => {
      const col = matchColaborador(r.funcionario, todosColaboradores)
      const inativo = col && col.ativo === false
      const vh = col ? calcValorHora(col) : 0
      return { ...r, col, matched: Boolean(col), inativo, salario: col ? parseFloat(col.salario_base_mensal) || 0 : 0, vh50: numericStr(vh > 0 ? vh * 1.5 : fb50), vh100: numericStr(vh > 0 ? vh * 2 : fb100), selected: true }
    }))
    setParsed(true)
  }

  function updateRow(i, field, val) { setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r)) }
  function toggleAll(val) { setRows((prev) => prev.map((r) => ({ ...r, selected: val }))) }
  function applyFallbackToAll() { setRows((prev) => prev.map((r) => ({ ...r, vh50: fallback50, vh100: fallback100 }))) }

  const enrichedRows = useMemo(() => rows.map((r) => {
    const vh50 = parseBRL(r.vh50), vh100 = parseBRL(r.vh100)
    return { ...r, vh50_num: vh50, vh100_num: vh100, total50: r.horas_normais * vh50, total100: r.horas_extra_100 * vh100 }
  }), [rows])

  const filialOptions = useMemo(() => [...new Set(enrichedRows.map((r) => r.filial_pasta).filter(Boolean))].sort(), [enrichedRows])
  const estadoOptions = useMemo(() => [...new Set(enrichedRows.map((r) => r.estado).filter(Boolean))].sort(), [enrichedRows])

  const filteredIndexes = useMemo(() => enrichedRows.map((r, i) => ({ r, i })).filter(({ r }) => {
    if (filterNome && !normName(r.funcionario).includes(normName(filterNome))) return false
    if (filterFilial && r.filial_pasta !== filterFilial) return false
    if (filterEstado && r.estado !== filterEstado) return false
    if (filterStatus === 'selecionados' && !r.selected) return false
    if (filterStatus === 'desmarcados' && r.selected) return false
    if (filterStatus === 'inativos' && !r.inativo) return false
    if (filterStatus === 'sem_contrato' && r.matched) return false
    return true
  }), [enrichedRows, filterNome, filterFilial, filterEstado, filterStatus])

  // Somente os visíveis no filtro E selecionados
  const filteredSelectedRows = useMemo(() => filteredIndexes.map(({ i }) => enrichedRows[i]).filter((r) => r.selected), [filteredIndexes, enrichedRows])

  const totalH50 = filteredSelectedRows.reduce((s, r) => s + r.horas_normais, 0)
  const totalH100 = filteredSelectedRows.reduce((s, r) => s + r.horas_extra_100, 0)
  const totalMon50 = filteredSelectedRows.reduce((s, r) => s + r.total50, 0)
  const totalMon100 = filteredSelectedRows.reduce((s, r) => s + r.total100, 0)
  const grandTotal = totalMon50 + totalMon100
  const temValores = filteredSelectedRows.some((r) => r.vh50_num > 0 || r.vh100_num > 0)
  const matchedCount = enrichedRows.filter((r) => r.matched).length
  const inativoCount = enrichedRows.filter((r) => r.inativo).length
  const allSelected = rows.length > 0 && rows.every((r) => r.selected)
  const noneSelected = rows.every((r) => !r.selected)
  const selectedCount = rows.filter((r) => r.selected).length
  const hasFilter = filterNome || filterFilial || filterEstado || filterStatus !== 'todos'

  async function salvarFechamento() {
    if (!filteredSelectedRows.length) { setSaveMsg({ type: 'error', text: 'Nenhum funcionário visível + selecionado para salvar.' }); return }
    if (!mesReferencia) { setSaveMsg({ type: 'error', text: 'Informe o mês de referência.' }); return }
    setSaving(true); setSaveMsg(null)
    try {
      const registros = filteredSelectedRows.map((r) => ({
        funcionario_nome: r.funcionario,
        colaborador_id: r.col?.id || null,
        filial_nome: r.filial_pasta || '',
        estado: r.estado || '',
        horas_normais: r.horas_normais,
        horas_extra_100: r.horas_extra_100,
        valor_hora_50: r.vh50_num,
        valor_hora_100: r.vh100_num,
        total_50: r.total50,
        total_100: r.total100,
        total_geral: r.total50 + r.total100,
      }))
      await api.rtmSalvar(mesReferencia + '-01', registros)
      setSaveMsg({ type: 'success', text: `${registros.length} funcionários salvos para ${mesReferencia}.` })
    } catch (e) {
      setSaveMsg({ type: 'error', text: e.message || 'Erro ao salvar.' })
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="surface-card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
          <button className="button-secondary" type="button" onClick={downloadTemplate} title="Baixa modelo Excel">↓ Baixar modelo</button>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 12px', background: '#f5f7fa', border: '1px solid #dce1e8', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', width: '100%', marginBottom: 2 }}>
              Taxa manual (sem contrato){loadingColab && <span style={{ fontWeight: 400, marginLeft: 6 }}>carregando…</span>}
            </div>
            <div>
              <label className="field-label">Valor Hora 50%</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 11, color: 'var(--muted)' }}>R$</span><input className="input" value={fallback50} onChange={(e) => setFallback50(e.target.value)} placeholder="59,92" style={{ width: 100 }} /></div>
            </div>
            <div>
              <label className="field-label">Valor Hora 100%</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 11, color: 'var(--muted)' }}>R$</span><input className="input" value={fallback100} onChange={(e) => setFallback100(e.target.value)} placeholder="79,89" style={{ width: 100 }} /></div>
            </div>
            {rows.length > 0 && <div style={{ display: 'flex', alignItems: 'flex-end' }}><button className="button-secondary" type="button" onClick={applyFallbackToAll} style={{ fontSize: 11 }}>Aplicar a todos</button></div>}
          </div>
        </div>
        <div>
          <strong style={{ fontSize: 13 }}>Dados da planilha</strong>
          <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 8px' }}>Colunas: <strong>FUNCIONARIO · Filial · ESTADO · HORAS NORMAIS · H.EXTRA 100%</strong></p>
          <textarea className="input" rows={8} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={"FUNCIONARIO\tFilial\tESTADO\tHORAS NORMAIS\tH.EXTRA 100%\nANA SILVA\tWHITE MARTINS\tSS/RS\t08:00:00\t00:00:00"} style={{ fontFamily: 'Courier New, monospace', fontSize: 12, resize: 'vertical', width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="button-primary" onClick={doCalculate} type="button">Calcular</button>
          {parsed && <button className="button-secondary" onClick={() => { setPasteText(''); setRows([]); setParsed(false) }} type="button">Limpar</button>}
        </div>
      </div>

      {parsed && rows.length === 0 && <div className="surface-card empty-state"><strong>Nenhum dado encontrado</strong><p>Verifique se os dados estão separados por tabulação.</p></div>}

      {rows.length > 0 && (
        <>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10, padding: '10px 14px', background: '#f5f7fa', border: '1px solid #dce1e8', borderRadius: 'var(--radius)' }}>
            <div><label className="field-label">Funcionário</label><input className="input" value={filterNome} onChange={(e) => setFilterNome(e.target.value)} placeholder="Buscar…" style={{ width: 190 }} /></div>
            <div><label className="field-label">Filial</label><select className="input" value={filterFilial} onChange={(e) => setFilterFilial(e.target.value)} style={{ minWidth: 140 }}><option value="">Todas</option>{filialOptions.map((f) => <option key={f} value={f}>{f}</option>)}</select></div>
            <div><label className="field-label">Estado</label><select className="input" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} style={{ minWidth: 110 }}><option value="">Todos</option>{estadoOptions.map((e) => <option key={e} value={e}>{e}</option>)}</select></div>
            <div><label className="field-label">Status</label><select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ minWidth: 140 }}><option value="todos">Todos</option><option value="selecionados">Selecionados</option><option value="desmarcados">Desmarcados</option><option value="inativos">Inativos</option><option value="sem_contrato">Sem contrato</option></select></div>
            {hasFilter && <div style={{ display: 'flex', alignItems: 'flex-end' }}><button className="button-secondary" type="button" onClick={() => { setFilterNome(''); setFilterFilial(''); setFilterEstado(''); setFilterStatus('todos') }} style={{ fontSize: 11 }}>Limpar filtros</button></div>}
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, padding: '3px 10px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 99, color: 'var(--success)', fontWeight: 700 }}>✓ {matchedCount} com contrato</span>
            {inativoCount > 0 && <span style={{ fontSize: 12, padding: '3px 10px', background: '#f0e8ff', border: '1px solid #c4a0e8', borderRadius: 99, color: '#6b21a8', fontWeight: 700 }}>⚠ {inativoCount} inativo{inativoCount !== 1 ? 's' : ''}</span>}
            {enrichedRows.filter((r) => !r.matched).length > 0 && <span style={{ fontSize: 12, padding: '3px 10px', background: '#fffbec', border: '1px solid #f1d877', borderRadius: 99, color: '#7a5c00', fontWeight: 700 }}>⚠ {enrichedRows.filter((r) => !r.matched).length} sem cadastro</span>}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{selectedCount}/{rows.length} selecionados{hasFilter ? ` · ${filteredSelectedRows.length} no filtro` : ''}</span>
              {!allSelected && <button className="button-secondary" type="button" onClick={() => toggleAll(true)} style={{ fontSize: 11, padding: '3px 10px' }}>Selecionar todos</button>}
              {!noneSelected && <button className="button-secondary" type="button" onClick={() => toggleAll(false)} style={{ fontSize: 11, padding: '3px 10px' }}>Desmarcar todos</button>}
            </div>
          </div>

          {/* Tabela */}
          <div className="surface-card" style={{ padding: 0, marginBottom: 12 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: 1060 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center' }}><input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} /></th>
                    <th>Funcionário</th><th>Filial</th><th>Est.</th>
                    <th style={{ textAlign: 'right' }}>H. Normais</th>
                    <th style={{ textAlign: 'right' }}>H. Extra 100%</th>
                    <th style={{ textAlign: 'right' }}>Salário</th>
                    <th style={{ textAlign: 'right', width: 120 }}>V. Hora 50%</th>
                    <th style={{ textAlign: 'right', width: 120 }}>V. Hora 100%</th>
                    <th style={{ textAlign: 'right' }}>Total 50%</th>
                    <th style={{ textAlign: 'right' }}>Total 100%</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIndexes.length === 0 && <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0', fontSize: 12 }}>Nenhum resultado para os filtros aplicados</td></tr>}
                  {filteredIndexes.map(({ i }) => {
                    const r = enrichedRows[i]
                    return (
                      <tr key={i} style={{ opacity: r.selected ? 1 : 0.4, background: r.inativo && r.selected ? '#fdf4ff' : undefined }}>
                        <td style={{ textAlign: 'center' }}><input type="checkbox" checked={r.selected} onChange={(e) => updateRow(i, 'selected', e.target.checked)} /></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: r.inativo ? '#a855f7' : r.matched ? 'var(--success)' : '#f0b429' }} />
                            <strong style={{ fontSize: 12 }}>{r.funcionario}</strong>
                            {r.inativo && <span style={{ fontSize: 9, fontWeight: 700, color: '#6b21a8', background: '#f0e8ff', border: '1px solid #c4a0e8', borderRadius: 99, padding: '1px 5px' }}>INATIVO</span>}
                          </div>
                          {r.matched && r.col?.nome_completo && normName(r.col.nome_completo) !== normName(r.funcionario) && <div style={{ fontSize: 10, color: 'var(--muted)', paddingLeft: 12 }}>{r.col.nome_completo}</div>}
                        </td>
                        <td style={{ fontSize: 11 }}>{r.filial_pasta}</td>
                        <td style={{ fontSize: 11 }}>{r.estado}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{r.horas_normais_str}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{r.horas_extra_100 > 0 ? <span style={{ color: 'var(--warning)', fontWeight: 700 }}>{r.horas_extra_100_str}</span> : <span style={{ color: '#ccc' }}>—</span>}</td>
                        <td style={{ textAlign: 'right', fontSize: 11 }}>{r.matched ? formatBRL(r.salario) : <span style={{ color: '#bbb', fontSize: 10 }}>manual</span>}</td>
                        <td style={{ textAlign: 'right' }}><input className="input" value={r.vh50} onChange={(e) => updateRow(i, 'vh50', e.target.value)} disabled={!r.selected} style={{ width: 90, textAlign: 'right', fontSize: 12 }} /></td>
                        <td style={{ textAlign: 'right' }}><input className="input" value={r.vh100} onChange={(e) => updateRow(i, 'vh100', e.target.value)} disabled={!r.selected} style={{ width: 90, textAlign: 'right', fontSize: 12 }} /></td>
                        <td style={{ textAlign: 'right', fontSize: 12 }}>{r.selected && r.vh50_num > 0 ? formatBRL(r.total50) : '—'}</td>
                        <td style={{ textAlign: 'right', fontSize: 12 }}>{r.selected && r.vh100_num > 0 && r.horas_extra_100 > 0 ? formatBRL(r.total100) : <span style={{ color: '#ccc' }}>—</span>}</td>
                        <td style={{ textAlign: 'right' }}><strong>{r.selected && temValores ? formatBRL(r.total50 + r.total100) : '—'}</strong></td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f0f4f8', fontWeight: 700 }}>
                    <td /><td colSpan={3} style={{ fontSize: 12 }}>TOTAL{hasFilter ? ' (filtrado)' : ''} — {filteredSelectedRows.length} func.</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{formatHHMM(totalH50)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: totalH100 > 0 ? 'var(--warning)' : undefined }}>{totalH100 > 0 ? formatHHMM(totalH100) : '—'}</td>
                    <td /><td /><td />
                    <td style={{ textAlign: 'right', color: 'var(--success)', fontSize: 13 }}>{temValores ? formatBRL(totalMon50) : '—'}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)', fontSize: 13 }}>{temValores ? formatBRL(totalMon100) : '—'}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)', fontSize: 14 }}>{temValores ? formatBRL(grandTotal) : '—'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Salvar fechamento */}
          <div className="surface-card" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label className="field-label">Mês de referência</label>
              <input type="month" className="input" value={mesReferencia} onChange={(e) => setMesReferencia(e.target.value)} style={{ width: 160 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <button className="button-primary" onClick={salvarFechamento} disabled={saving} type="button">
                {saving ? 'Salvando…' : `Salvar${hasFilter ? ` (${filteredSelectedRows.length} visíveis)` : ''}`}
              </button>
            </div>
            {saveMsg && (
              <span style={{ fontSize: 12, fontWeight: 600, color: saveMsg.type === 'success' ? 'var(--success)' : 'var(--danger)', padding: '4px 10px', borderRadius: 'var(--radius)', background: saveMsg.type === 'success' ? 'var(--success-bg)' : '#fff0f0' }}>
                {saveMsg.text}
              </span>
            )}
          </div>

          {/* Totais cards */}
          {temValores && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
              <div style={{ padding: '12px 20px', background: '#f0f4f8', border: '1px solid #c8d2dc', borderRadius: 'var(--radius)', minWidth: 150 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{hasFilter ? 'H. 50% (filtrado)' : 'Total Horas 50%'}</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace' }}>{formatHHMM(totalH50)}</div>
              </div>
              <div style={{ padding: '12px 20px', background: '#fff8ec', border: '1px solid #f1b878', borderRadius: 'var(--radius)', minWidth: 150 }}>
                <div style={{ fontSize: 10, color: '#a04000', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{hasFilter ? 'H. 100% (filtrado)' : 'Total Horas 100%'}</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: totalH100 > 0 ? 'var(--warning)' : '#bbb' }}>{formatHHMM(totalH100)}</div>
              </div>
              <div style={{ padding: '12px 20px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius)', minWidth: 150 }}>
                <div style={{ fontSize: 10, color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Total 50%</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)' }}>{formatBRL(totalMon50)}</div>
              </div>
              <div style={{ padding: '12px 20px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius)', minWidth: 150 }}>
                <div style={{ fontSize: 10, color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Total 100%</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)' }}>{formatBRL(totalMon100)}</div>
              </div>
              <div style={{ padding: '12px 24px', background: 'var(--success-bg)', border: '2px solid var(--success-border)', borderRadius: 'var(--radius)', minWidth: 200 }}>
                <div style={{ fontSize: 10, color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{hasFilter ? 'TOTAL (filtrado)' : 'TOTAL GERAL'}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--success)' }}>{formatBRL(grandTotal)}</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

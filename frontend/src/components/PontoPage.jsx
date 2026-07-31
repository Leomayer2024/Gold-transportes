import { Fragment, useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'
import { supabase } from '../lib/supabase'
import StatCard from './StatCard'

const COR = { azul: '#1e40af', verde: '#15803d', vermelho: '#b91c1c', cinza: '#64748b' }

function pad2(n) { return String(n).padStart(2, '0') }
function isoDate(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function fmtData(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
function diaSemana(iso) {
  if (!iso) return { label: '—', fds: false, dom: false }
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return { label: DOW[dow], fds: dow === 0 || dow === 6, dom: dow === 0 }
}

const inputStyle = { padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, background: '#fff' }
const labelStyle = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: COR.cinza, marginBottom: 4, display: 'block' }
const btn = (bg, fg = '#fff') => ({ padding: '8px 14px', borderRadius: 8, border: 'none', background: bg, color: fg, fontWeight: 700, fontSize: 13, cursor: 'pointer' })
const th = { textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: COR.cinza, borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }
const td = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid #eef2f6', whiteSpace: 'nowrap' }
const espTh = { textAlign: 'left', padding: '7px 10px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: COR.cinza, borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', background: '#f8fafc' }
const espTd = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', whiteSpace: 'nowrap' }

function fmtHorasDec(h) {
  const v = Number(h) || 0
  const neg = v < 0
  const abs = Math.abs(v)
  const hh = Math.floor(abs)
  const mm = Math.round((abs - hh) * 60)
  if (!hh && !mm) return '0h'
  return `${neg ? '−' : ''}${hh}h${pad2(mm)}`
}

function SevChip({ sev }) {
  const cor = { danger: COR.vermelho, warning: '#b45309', info: COR.cinza }[sev] || COR.cinza
  const label = { danger: 'Crítico', warning: 'Atenção', info: 'Info' }[sev] || sev
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${cor}14`, color: cor, border: `1px solid ${cor}33` }}>{label}</span>
}

function HeStatusChip({ status }) {
  const cor = { bate: COR.verde, diverge: COR.vermelho, so_seg: '#b45309', so_iopoint: '#7c3aed' }[status] || COR.cinza
  const label = { bate: 'Bate', diverge: 'Diverge', so_seg: 'Só SEG', so_iopoint: 'Só iopoint' }[status] || status
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${cor}14`, color: cor, border: `1px solid ${cor}33` }}>{label}</span>
}

const emptyRow = (n, text, cinza = true) => (
  <tr><td style={{ ...td, textAlign: 'center', color: cinza ? COR.cinza : undefined }} colSpan={n}>{text}</td></tr>
)

function MatchBadge({ por, vinculado }) {
  const base = { marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }
  if (!vinculado) return <span style={{ ...base, color: '#b45309', background: '#fef3c7' }}>não vinculado</span>
  if (por === 'nome') return <span title="casado por nome — SEG sem CPF para confirmar" style={{ ...base, color: '#7c3aed', background: '#f3e8ff' }}>por nome</span>
  if (por === 'cpf') return <span title="confirmado por CPF" style={{ ...base, color: '#15803d', background: '#dcfce7' }}>CPF</span>
  return null
}

function HBar({ label, value, max, texto, cor = COR.azul }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 2) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 190, fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }} title={label}>{label}</div>
      <div style={{ flex: 1, background: '#f0f4f8', borderRadius: 4, height: 22, position: 'relative', minWidth: 80 }}>
        <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${pct}%`, background: cor, borderRadius: 4 }} />
        <span style={{ position: 'absolute', left: 8, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: pct > 30 ? '#fff' : '#333' }}>{texto}</span>
      </div>
    </div>
  )
}

function IopMetricas({ resp, he, loading, erro }) {
  const items = (resp?.items || []).filter((x) => (x.total_worked_horas || 0) > 0)
  const totalHoras = items.reduce((a, x) => a + (x.total_worked_horas || 0), 0)
  const totalDias = items.reduce((a, x) => a + ((x.dias || []).length), 0)
  const media = items.length ? totalHoras / items.length : 0
  const ranking = [...items].sort((a, b) => (b.total_worked_horas || 0) - (a.total_worked_horas || 0))
  const maxH = ranking.length ? (ranking[0].total_worked_horas || 0) : 0

  // Horas extras apuradas do iopoint (50% dia útil + 100% DSR/feriado)
  const heItems = (he?.itens || []).map((x) => ({ ...x, he_total: (x.horas_normais || 0) + (x.horas_extra_100 || 0) }))
    .filter((x) => x.he_total > 0)
  const totH50 = heItems.reduce((a, x) => a + (x.horas_normais || 0), 0)
  const totH100 = heItems.reduce((a, x) => a + (x.horas_extra_100 || 0), 0)
  const heRanking = [...heItems].sort((a, b) => b.he_total - a.he_total)
  const maxHE = heRanking.length ? heRanking[0].he_total : 0

  return (
    <Fragment>
      {erro && <div className="surface-card" style={{ padding: 12, marginBottom: 12, background: '#fef2f2', color: COR.vermelho, fontWeight: 600 }}>{erro}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard label="Colaboradores com batida" value={items.length} />
        <StatCard label="Horas trabalhadas" value={fmtHorasDec(totalHoras)} tone="success" />
        <StatCard label="Média por colaborador" value={fmtHorasDec(media)} />
        <StatCard label="Dias com batida" value={totalDias} />
        <StatCard label="HE 50% (dia útil)" value={fmtHorasDec(totH50)} />
        <StatCard label="HE 100% (DSR/feriado)" value={fmtHorasDec(totH100)} hint="domingo e feriado" />
        <StatCard label="HE total apurada" value={fmtHorasDec(totH50 + totH100)} tone="success" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <div className="surface-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Horas trabalhadas por colaborador</div>
          {loading && <div style={{ color: COR.cinza, fontSize: 13 }}>Carregando…</div>}
          {!loading && ranking.length === 0 && <div style={{ color: COR.cinza, fontSize: 13 }}>Sem horas no período.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ranking.map((it) => (
              <HBar key={it.cpf || it.nome} label={it.nome} value={it.total_worked_horas || 0} max={maxH}
                texto={`${fmtHorasDec(it.total_worked_horas)} · ${(it.dias || []).length}d`} cor={it.vinculado ? COR.azul : '#b45309'} />
            ))}
          </div>
        </div>

        <div className="surface-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Horas extras por colaborador</div>
          {loading && <div style={{ color: COR.cinza, fontSize: 13 }}>Carregando…</div>}
          {!loading && heRanking.length === 0 && <div style={{ color: COR.cinza, fontSize: 13 }}>Nenhuma hora extra apurada no período.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {heRanking.map((it) => (
              <HBar key={it.cpf || it.colaborador} label={it.colaborador} value={it.he_total} max={maxHE}
                texto={`${fmtHorasDec(it.he_total)}${it.horas_extra_100 > 0 ? ` · 100%: ${fmtHorasDec(it.horas_extra_100)}` : ''}`}
                cor={it.horas_extra_100 > 0 ? '#b45309' : COR.verde} />
            ))}
          </div>
        </div>
      </div>
    </Fragment>
  )
}

function BatidaChip({ b, small, onMap }) {
  const chip = { display: 'inline-flex', alignItems: 'center', gap: small ? 3 : 4, padding: small ? '1px 6px' : '2px 8px', background: small ? '#f8fafc' : '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontFamily: 'monospace', fontWeight: 700, fontSize: small ? 12 : 13, color: 'inherit', margin: 0 }
  const title = [b.method, b.origin, b.address, b.accuracy ? `±${Math.round(b.accuracy)}m` : null].filter(Boolean).join(' · ')
  const fs = small ? 9 : 10
  const inner = (<>{b.hora}{b.is_adjusted && <span style={{ fontSize: fs, color: '#92400e' }}>✎</span>}{b.has_audit_photo && <span style={{ fontSize: fs }}>📷</span>}{b.geoloc && <span style={{ fontSize: fs }}>📍</span>}</>)
  if (b.geoloc && onMap) {
    return <button type="button" onClick={() => onMap(b)} title={`${title} · clique p/ ver no mapa`} style={{ ...chip, cursor: 'pointer' }}>{inner}</button>
  }
  return <span title={title} style={chip}>{inner}</span>
}

// Mini-mapa com tiles do OpenStreetMap (CDN https, permitido pela CSP img-src).
// iframe/serviços de static map são bloqueados (CSP) ou estão fora do ar.
function TileMap({ lat, lng, w = 480, h = 280, z = 16 }) {
  const n = 2 ** z
  const cx = (lng + 180) / 360 * n
  const latRad = (lat * Math.PI) / 180
  const cy = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
  const px = cx * 256, py = cy * 256
  const left0 = px - w / 2, top0 = py - h / 2
  const x0 = Math.floor(left0 / 256), x1 = Math.floor((left0 + w) / 256)
  const y0 = Math.floor(top0 / 256), y1 = Math.floor((top0 + h) / 256)
  const tiles = []
  for (let tx = x0; tx <= x1; tx += 1) {
    for (let ty = y0; ty <= y1; ty += 1) {
      if (ty < 0 || ty >= n) continue
      const wx = ((tx % n) + n) % n
      tiles.push({ key: `${tx}_${ty}`, src: `https://tile.openstreetmap.org/${z}/${wx}/${ty}.png`, left: tx * 256 - left0, top: ty * 256 - top0 })
    }
  }
  return (
    <div style={{ position: 'relative', width: w, maxWidth: '100%', height: h, overflow: 'hidden', background: '#e8eef3' }}>
      {tiles.map((t) => <img key={t.key} src={t.src} alt="" width={256} height={256} loading="lazy" style={{ position: 'absolute', left: t.left, top: t.top }} />)}
      <div style={{ position: 'absolute', left: w / 2, top: h / 2, transform: 'translate(-50%,-100%)', fontSize: 28, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.5))', pointerEvents: 'none' }}>📍</div>
    </div>
  )
}

function BatidaMapModal({ b, onClose }) {
  if (!b) return null
  const [lat, lng] = String(b.geoloc || '').split(',').map((x) => parseFloat(x))
  const ok = Number.isFinite(lat) && Number.isFinite(lng)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div className="surface-card" onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '100%', padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #eef2f6' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>📍 Batida às {b.hora}{b.data ? ` · ${fmtData(b.data)}` : ''}</div>
            <div style={{ fontSize: 12, color: COR.cinza, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.address || 'Sem endereço'}{b.accuracy ? ` · ±${Math.round(b.accuracy)}m` : ''}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: COR.cinza }}>✕</button>
        </div>
        {ok
          ? <a href={`https://www.google.com/maps?q=${encodeURIComponent(b.geoloc)}`} target="_blank" rel="noreferrer" title="Abrir no mapa" style={{ display: 'block' }}><TileMap lat={lat} lng={lng} /></a>
          : <div style={{ padding: 24, textAlign: 'center', color: COR.cinza }}>Sem coordenada.</div>}
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          {ok && <a href={`https://www.google.com/maps?q=${encodeURIComponent(b.geoloc)}`} target="_blank" rel="noreferrer" style={{ color: COR.azul, fontWeight: 700 }}>Abrir no Google Maps ↗</a>}
          <span style={{ color: COR.cinza, marginLeft: 'auto', fontFamily: 'monospace' }}>{b.geoloc}</span>
        </div>
      </div>
    </div>
  )
}

function IopEspelho({ resp, loading, erro }) {
  const [open, setOpen] = useState({})
  const [mapa, setMapa] = useState(null)
  const items = resp?.items || []
  const totalHoras = items.reduce((a, x) => a + (x.total_worked_horas || 0), 0)
  return (
    <Fragment>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard label="Colaboradores" value={items.length} />
        <StatCard label="Horas trabalhadas" value={fmtHorasDec(totalHoras)} tone="success" />
        <StatCard label="Não vinculados ao SEG" value={resp?.meta?.nao_vinculados || 0} hint="CPF sem colaborador" />
      </div>
      {erro && <div className="surface-card" style={{ padding: 12, marginBottom: 12, background: '#fef2f2', color: COR.vermelho, fontWeight: 600 }}>{erro}</div>}
      {loading && <div className="surface-card" style={{ padding: 16, color: COR.cinza }}>Carregando…</div>}
      {!loading && items.length === 0 && <div className="surface-card" style={{ padding: 24, textAlign: 'center', color: COR.cinza }}>Nenhum ponto no período.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it) => {
          const key = it.cpf || it.nome
          const dias = it.dias || []
          const aberto = !!open[key]
          const totExtra = dias.reduce((a, d) => a + (d.extra_horas || 0), 0)
          return (
            <div key={key} className="surface-card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Linha do colaborador — clica p/ abrir/fechar o espelho */}
              <button type="button" onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: 'none', background: aberto ? '#f8fafc' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 12, color: COR.cinza, transform: aberto ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}>▶</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{it.nome}<MatchBadge por={it.match_por} vinculado={it.vinculado} /></div>
                  <div style={{ fontSize: 12, color: COR.cinza }}>{it.filial_label || '—'}</div>
                </div>
                {totExtra > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e', background: '#fde68a', padding: '2px 8px', borderRadius: 99 }} title="Horas além da jornada esperada">+{fmtHorasDec(totExtra)}</span>}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 17, color: COR.azul }}>{fmtHorasDec(it.total_worked_horas)}</div>
                  <div style={{ fontSize: 11, color: COR.cinza }}>{dias.length} dia(s)</div>
                </div>
              </button>
              {/* Espelho de ponto — só quando aberto */}
              {aberto && (
              <div style={{ overflowX: 'auto', borderTop: '1px solid #eef2f6' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...espTh, width: 40 }}>Dia</th>
                      <th style={{ ...espTh, width: 60 }}>Data</th>
                      <th style={{ ...espTh, textAlign: 'center', width: 62 }}>Entrada</th>
                      <th style={{ ...espTh, textAlign: 'center', width: 62 }}>Saída</th>
                      <th style={espTh}>Registros</th>
                      <th style={{ ...espTh, textAlign: 'right', width: 84 }}>Trabalhado</th>
                      <th style={{ ...espTh, textAlign: 'right', width: 64 }}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dias.length === 0 && emptyRow(7, 'Sem batidas no período.')}
                    {dias.map((d) => {
                      const ds = diaSemana(d.data)
                      const bts = d.batidas || []
                      const ent = d.entrada || (bts[0] && bts[0].hora) || '—'
                      const sai = d.saida || (bts.length > 1 ? bts[bts.length - 1].hora : '') || '—'
                      const trab = d.trabalhado_horas != null ? d.trabalhado_horas : d.worked_horas
                      return (
                        <tr key={d.data} style={{ background: ds.fds ? '#fbfcfd' : undefined }}>
                          <td style={{ ...espTd, fontWeight: 800, fontSize: 11, color: ds.dom ? COR.vermelho : (ds.fds ? '#b45309' : COR.cinza) }}>{ds.label}</td>
                          <td style={{ ...espTd, fontWeight: 700 }}>{fmtData(d.data).slice(0, 5)}</td>
                          <td style={{ ...espTd, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: COR.verde }}>{ent}</td>
                          <td style={{ ...espTd, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: COR.vermelho }}>{sai}</td>
                          <td style={{ ...espTd, whiteSpace: 'normal' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {bts.length ? bts.map((b, i) => <BatidaChip key={i} b={b} small onMap={(bx) => setMapa({ ...bx, data: d.data })} />) : <span style={{ color: COR.cinza }}>—</span>}
                            </div>
                          </td>
                          <td style={{ ...espTd, textAlign: 'right' }} title="Trabalhado (almoço mínimo de 60 min já descontado)">
                            <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{fmtHorasDec(trab)}</div>
                            {d.esperado_horas != null && <div style={{ fontSize: 10, color: COR.cinza }}>esp. {fmtHorasDec(d.esperado_horas)}</div>}
                          </td>
                          <td style={{ ...espTd, textAlign: 'right' }}>
                            {d.extra_horas > 0
                              ? <span style={{ fontWeight: 700, color: '#92400e', background: '#fde68a', padding: '2px 7px', borderRadius: 99, fontSize: 11 }}>+{fmtHorasDec(d.extra_horas)}</span>
                              : d.esperado_horas != null
                                ? <span style={{ fontWeight: 700, color: COR.verde, fontSize: 12 }}>ok</span>
                                : <span style={{ color: COR.cinza }}>—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )
        })}
      </div>
      <BatidaMapModal b={mapa} onClose={() => setMapa(null)} />
    </Fragment>
  )
}

const SEV_INFO = {
  danger: { cor: '#dc2626', bg: '#fef2f2', label: 'Crítico' },
  warning: { cor: '#d97706', bg: '#fffbeb', label: 'Atenção' },
  info: { cor: '#64748b', bg: '#f8fafc', label: 'Info' },
}
const FONTE_ICON = { atraso: '⏰', inconsistencia: '⚠️', justificativa: '⚠️', ajuste: '✏️', fora_da_cerca: '📍' }

function IopAlertas({ resp, loading, erro }) {
  const [filtro, setFiltro] = useState('todos')
  const r = resp?.resumo || {}
  const all = resp?.itens || []
  const itens = filtro === 'todos' ? all : all.filter((a) => a.severidade === filtro)
  const chips = [
    ['todos', 'Todos', all.length],
    ['danger', 'Críticos', r.danger || 0],
    ['warning', 'Atenção', r.warning || 0],
    ['info', 'Info', r.info || 0],
  ]
  return (
    <Fragment>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {chips.map(([k, lb, n]) => {
          const ativo = filtro === k
          return (
            <button key={k} onClick={() => setFiltro(k)} style={{
              border: '1px solid ' + (ativo ? COR.azul : '#e2e8f0'), background: ativo ? COR.azul : '#fff',
              color: ativo ? '#fff' : '#334155', borderRadius: 99, padding: '6px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>{lb} <span style={{ opacity: 0.75 }}>{n}</span></button>
          )
        })}
        {(r.fora_cerca || 0) > 0 && <span style={{ marginLeft: 'auto', fontSize: 13, color: '#dc2626', fontWeight: 700 }}>📍 {r.fora_cerca} fora da cerca</span>}
      </div>
      {erro && <div className="surface-card" style={{ padding: 12, marginBottom: 12, background: '#fef2f2', color: COR.vermelho, fontWeight: 600 }}>{erro}</div>}
      {loading && <div className="surface-card" style={{ padding: 16, color: COR.cinza }}>Carregando…</div>}
      {!loading && itens.length === 0 && <div className="surface-card" style={{ padding: 24, textAlign: 'center', color: COR.cinza }}>Nenhum alerta no período. 🎉</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {itens.map((a, i) => {
          const s = SEV_INFO[a.severidade] || SEV_INFO.info
          return (
            <div key={i} className="surface-card" style={{ padding: '10px 14px', borderLeft: `4px solid ${s.cor}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18 }}>{FONTE_ICON[a.fonte] || '•'}</span>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{a.colaborador}<MatchBadge por={a.match_por} vinculado={a.vinculado} /></div>
                <div style={{ fontSize: 12, color: COR.cinza }}>{a.tipo}{a.detalhe ? ` · ${a.detalhe}` : ''}{a.status ? ` · ${a.status}` : ''}</div>
              </div>
              {a.valor && <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{a.valor}</span>}
              <span style={{ fontSize: 12, color: COR.cinza, minWidth: 72, textAlign: 'right' }}>{fmtData(a.data)}</span>
              <span style={{ fontSize: 11, color: COR.cinza, minWidth: 64 }}>{a.filial_label || '—'}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: s.cor, background: s.bg, padding: '2px 8px', borderRadius: 99 }}>{s.label}</span>
            </div>
          )
        })}
      </div>
    </Fragment>
  )
}

function IopConcHE({ resp, loading, erro }) {
  if (resp && resp.database_ready === false) {
    return <div className="surface-card" style={{ padding: 12, background: '#fffbeb', color: '#92400e', fontWeight: 600 }}>A tabela de horas extras (<code>horas_extras</code>) ainda não existe no banco.</div>
  }
  const r = resp?.resumo || {}
  const itens = resp?.itens || []
  return (
    <Fragment>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard label="Colaboradores" value={r.colaboradores || 0} />
        <StatCard label="Batem" value={r.bate || 0} tone="success" />
        <StatCard label="Divergem" value={r.diverge || 0} />
        <StatCard label="Só SEG (aprovada)" value={r.so_seg || 0} />
        <StatCard label="Só iopoint" value={r.so_iopoint || 0} />
        <StatCard label="Δ total (iopoint − SEG)" value={fmtHorasDec(r.delta_total_horas || 0)} />
      </div>
      {resp?.tolerancia != null && <p style={{ fontSize: 12, color: COR.cinza, margin: '0 0 10px' }}>Tolerância de {fmtHorasDec(resp.tolerancia)} para considerar &quot;bate&quot;. HE do SEG = solicitações com status <strong>aprovado</strong>. HE do iopoint = horas além da jornada, mesmo cálculo da aba <strong>Batidas &amp; horas</strong>.</p>}
      {erro && <div className="surface-card" style={{ padding: 12, marginBottom: 12, background: '#fef2f2', color: COR.vermelho, fontWeight: 600 }}>{erro}</div>}
      <div className="surface-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={th}>Colaborador</th><th style={th}>Base</th>
            <th style={th}>HE aprovada (SEG)</th><th style={th}>HE apurada (iopoint)</th>
            <th style={th}>Diferença</th><th style={th}>Status</th>
          </tr></thead>
          <tbody>
            {loading && emptyRow(6, 'Carregando…')}
            {!loading && itens.length === 0 && emptyRow(6, 'Sem horas extras no período.')}
            {itens.map((h, i) => (
              <tr key={i} style={{ background: h.status === 'diverge' ? '#fef2f2' : undefined }}>
                <td style={{ ...td, fontWeight: 600 }}>{h.colaborador}<MatchBadge por={h.match_por} vinculado={h.vinculado} /></td>
                <td style={td}>{h.filial_label || '—'}</td>
                <td style={{ ...td, fontFamily: 'monospace' }}>{fmtHorasDec(h.he_seg)}</td>
                <td style={{ ...td, fontFamily: 'monospace' }}>{fmtHorasDec(h.he_iopoint)}</td>
                <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: Math.abs(h.diferenca) > (resp?.tolerancia || 0) ? COR.vermelho : COR.cinza }}>{fmtHorasDec(h.diferenca)}</td>
                <td style={td}><HeStatusChip status={h.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Fragment>
  )
}

export default function PontoPage() {
  const [aba, setAba] = useState('io_metricas')
  const [filtros, setFiltros] = useState({ inicio: isoDate(-7), fim: isoDate(0), filial_id: '', colaborador_id: '' })
  const [filiais, setFiliais] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')

  // iopoint (ponto eletrônico externo — fonte única das batidas)
  const [iop, setIop] = useState({ enabled: null })
  const [espelho, setEspelho] = useState(null)
  const [heApur, setHeApur] = useState(null)
  const [alertas, setAlertas] = useState(null)
  const [concHE, setConcHE] = useState(null)
  const [ioLoading, setIoLoading] = useState(false)
  const [ioErro, setIoErro] = useState('')

  useEffect(() => {
    api.filiaisDisponiveis().then((r) => setFiliais(Array.isArray(r) ? r : [])).catch(() => {})
    api.list('colaboradores', { per_page: 2000 })
      .then((r) => {
        const rows = Array.isArray(r) ? r : (r.data || r.items || [])
        rows.sort((a, b) => (a.nome_completo || '').localeCompare(b.nome_completo || ''))
        setColaboradores(rows)
      })
      .catch(() => {})
    api.iopointStatus().then(setIop).catch(() => setIop({ enabled: false }))
  }, [])

  const iopBase = useCallback(() => {
    const base = { inicio: filtros.inicio, fim: filtros.fim, filial_id: filtros.filial_id || undefined }
    if (filtros.colaborador_id) {
      const c = colaboradores.find((x) => String(x.id) === String(filtros.colaborador_id))
      if (c?.cpf) base.colaborador_cpf = c.cpf
    }
    return base
  }, [filtros.inicio, filtros.fim, filtros.filial_id, filtros.colaborador_id, colaboradores])

  const carregarIopoint = useCallback(async () => {
    if (!iop?.enabled) return
    setIoLoading(true)
    setIoErro('')
    const base = iopBase()
    try {
      if (aba === 'io_metricas') {
        const [esp, he] = await Promise.all([api.iopointEspelho(base), api.iopointHorasExtrasApuradas(base)])
        setEspelho(esp)
        setHeApur(he)
      } else if (aba === 'io_espelho') {
        setEspelho(await api.iopointEspelho(base))
      } else if (aba === 'io_alertas') {
        const [al, fc] = await Promise.all([
          api.iopointAlertas(base),
          api.iopointForaCerca(base).catch(() => ({ itens: [] })),
        ])
        const extra = (fc.itens || []).map((v) => ({
          data: v.data, colaborador: v.colaborador, vinculado: v.vinculado, match_por: v.match_por,
          filial_label: v.filial_label, tipo: 'Fora da cerca', valor: `${v.distancia_m}m (raio ${v.raio_m}m)`,
          severidade: 'danger', status: null, fonte: 'fora_da_cerca', detalhe: v.address,
        }))
        const al2 = al || {}
        setAlertas({
          ...al2,
          itens: [...extra, ...(al2.itens || [])],
          resumo: { ...(al2.resumo || {}), fora_cerca: (fc.itens || []).length, danger: ((al2.resumo && al2.resumo.danger) || 0) + extra.length },
        })
      } else if (aba === 'io_he') {
        setConcHE(await api.iopointConciliacaoHE(base))
      }
    } catch (e) {
      setIoErro(e.message || 'Falha ao carregar dados do iopoint.')
    } finally {
      setIoLoading(false)
    }
  }, [aba, iop, iopBase])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  // Carrega ao trocar de aba e assim que o status do iopoint resolve (evita ter
  // que clicar em "Filtrar" na primeira abertura).
  useEffect(() => { carregarIopoint() }, [aba, iop.enabled])

  function aplicarFiltros() { carregarIopoint() }
  function limparFiltros() {
    setFiltros({ inicio: isoDate(-7), fim: isoDate(0), filial_id: '', colaborador_id: '' })
  }
  function periodoRapido(dias) {
    setFiltros((f) => ({ ...f, inicio: isoDate(-dias), fim: isoDate(0) }))
  }
  function periodoMes() {
    const d = new Date()
    const ini = new Date(d.getFullYear(), d.getMonth(), 1)
    const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const iso = (x) => `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`
    setFiltros((f) => ({ ...f, inicio: iso(ini), fim: iso(fim) }))
  }

  async function exportar() {
    setErro('')
    setMsg('Gerando Excel…')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const resp = await fetch(api.iopointEspelhoExportUrl(iopBase()), { headers: { Authorization: `Bearer ${token}` } })
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

  const tabs = [
    { k: 'io_metricas', label: 'Métricas', icon: '📊', desc: 'Visão geral: quem fez mais horas, HE, faltas e atrasos.' },
    { k: 'io_espelho', label: 'Batidas & horas', icon: '🕒', desc: 'Espelho por colaborador e dia, com o local de cada batida no mapa.' },
    { k: 'io_alertas', label: 'Alertas', icon: '⚠️', desc: 'Atrasos, faltas, inconsistências, ajustes e batidas fora da cerca.' },
    { k: 'io_he', label: 'Conciliação HE', icon: '⚖️', desc: 'HE aprovada no SEG × HE apurada no iopoint.' },
  ]
  const abaAtual = tabs.find((t) => t.k === aba) || tabs[0]

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Operação RTM</span>
          <h1>Ponto — Batidas faciais</h1>
          <p>Batidas, horas por dia, alertas e conciliações — direto do iopoint.</p>
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
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
            <button type="button" onClick={() => periodoRapido(7)} style={{ ...btn('#e2e8f0', '#334155'), padding: '7px 10px', fontSize: 12 }}>7d</button>
            <button type="button" onClick={() => periodoRapido(30)} style={{ ...btn('#e2e8f0', '#334155'), padding: '7px 10px', fontSize: 12 }}>30d</button>
            <button type="button" onClick={periodoMes} style={{ ...btn('#e2e8f0', '#334155'), padding: '7px 10px', fontSize: 12 }}>Mês</button>
          </div>
          <button onClick={aplicarFiltros} style={btn(COR.azul)} disabled={ioLoading}>{ioLoading ? 'Carregando…' : 'Filtrar'}</button>
          <button onClick={limparFiltros} style={btn('#e2e8f0', '#334155')}>Limpar</button>
          <div style={{ flex: 1 }} />
          <button onClick={exportar} style={btn('#0f766e')}>Exportar Excel</button>
        </div>
      </div>

      {/* Abas — segmented control */}
      <div style={{ display: 'inline-flex', gap: 4, marginBottom: 10, padding: 4, background: '#f1f5f9', borderRadius: 12, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setAba(t.k)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none',
              padding: '8px 16px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background: aba === t.k ? '#fff' : 'transparent',
              color: aba === t.k ? COR.azul : '#64748b',
              boxShadow: aba === t.k ? '0 1px 3px rgba(15,23,42,.12)' : 'none',
            }}
          >
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      {/* Barra-guia: o que a aba mostra + período ativo */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16, fontSize: 13, color: COR.cinza }}>
        <span style={{ fontWeight: 700, color: '#334155' }}>{abaAtual.icon} {abaAtual.label}</span>
        <span>· {abaAtual.desc}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, background: '#eff6ff', color: '#1e40af', padding: '2px 10px', borderRadius: 99, fontWeight: 700 }}>
          {fmtData(filtros.inicio)} – {fmtData(filtros.fim)}
        </span>
      </div>

      {erro && <div className="surface-card" style={{ padding: 12, marginBottom: 12, background: '#fef2f2', color: COR.vermelho, fontWeight: 600 }}>{erro}</div>}
      {msg && !erro && <div className="surface-card" style={{ padding: 12, marginBottom: 12, background: '#f0fdf4', color: COR.verde, fontWeight: 600 }}>{msg}</div>}
      {iop.enabled === false && (
        <div className="surface-card" style={{ padding: 12, marginBottom: 12, background: '#eff6ff', color: '#1e40af', fontWeight: 500, fontSize: 13 }}>
          <strong>Integração iopoint não configurada.</strong> Para ver o espelho de ponto, os alertas e as conciliações, defina <code>IOPOINT_API_TOKEN</code> no servidor (token em iopoint → Configurações → Empresa → Token API).
        </div>
      )}
      {iop.enabled && iop.ok === false && (
        <div className="surface-card" style={{ padding: 12, marginBottom: 12, background: '#fffbeb', color: '#92400e', fontWeight: 600, fontSize: 13 }}>
          iopoint configurado, mas houve um problema: {iop.error || 'verifique o token no servidor.'}
        </div>
      )}
      {iop.enabled && iop.ok && iop.company?.name && (
        <div style={{ fontSize: 12, color: COR.cinza, marginBottom: 12 }}>
          iopoint conectado · <strong>{iop.company.name}</strong>
        </div>
      )}

      {aba === 'io_metricas' && <IopMetricas resp={espelho} he={heApur} loading={ioLoading} erro={ioErro} />}
      {aba === 'io_espelho' && <IopEspelho resp={espelho} loading={ioLoading} erro={ioErro} />}
      {aba === 'io_alertas' && <IopAlertas resp={alertas} loading={ioLoading} erro={ioErro} />}
      {aba === 'io_he' && <IopConcHE resp={concHE} loading={ioLoading} erro={ioErro} />}
    </section>
  )
}

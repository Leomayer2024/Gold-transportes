import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS = {
  matriculado: { label: 'Matriculado', bg: '#eef2f7', color: '#4a5a6a' },
  andamento: { label: 'Em andamento', bg: '#e7f0fa', color: '#2f6fb0' },
  concluido: { label: 'Concluído', bg: '#edf8f2', color: '#2a8a5a' },
}

function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = String(iso).split('-')
  return `${d}/${m}/${y}`
}

// Vencimento do certificado: data_conclusao + validade_meses do curso.
function calcVencimento(m) {
  const vm = m.curso?.validade_meses
  if (m.status !== 'concluido') return { label: '—', color: 'inherit' }
  if (!vm) return { label: 'Não expira', color: '#2a8a5a' }
  if (!m.data_conclusao) return { label: '—', color: 'inherit' }
  const d = new Date(m.data_conclusao + 'T00:00:00')
  d.setMonth(d.getMonth() + vm)
  const dias = Math.ceil((d - new Date()) / 86400000)
  const fmt = d.toLocaleDateString('pt-BR')
  if (dias < 0) return { label: `Vencido (${fmt})`, color: '#c0392b' }
  if (dias <= 60) return { label: `Vence ${fmt}`, color: '#b45309' }
  return { label: fmt, color: '#2a8a5a' }
}

function Badge({ status }) {
  const s = STATUS[status] || STATUS.matriculado
  return (
    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
      {s.label}
    </span>
  )
}

function Progress({ value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 90, height: 7, background: '#e4e8ee', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: 'linear-gradient(135deg,#e6c14e,#c49512)' }} />
      </div>
      <small style={{ color: '#888' }}>{value}%</small>
    </div>
  )
}

// ─── Modal: nova matrícula (designar curso) ─────────────────────────────────

function NovaMatriculaModal({ cursos, onClose, onSaved }) {
  const [colaboradores, setColaboradores] = useState([])
  const [colaboradorId, setColaboradorId] = useState('')
  const [cursoId, setCursoId] = useState('')
  const [obrigatorio, setObrigatorio] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.rpc('trein_listar_colaboradores')
      .then(({ data, error }) => {
        if (error) setError('Erro ao listar colaboradores: ' + error.message)
        else setColaboradores(data || [])
      })
  }, [])

  async function handleSave() {
    setError('')
    if (!colaboradorId || !cursoId) { setError('Escolha o colaborador e o curso.'); return }
    const c = colaboradores.find((x) => String(x.id) === colaboradorId)
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('trein_matriculas')
        .insert({
          colaborador_id: c.id,
          colaborador_nome: c.nome_completo,
          filial_id: c.filial_id,
          filial_label: c.filial_label,
          curso_id: Number(cursoId),
          status: 'matriculado',
          progresso: 0,
          obrigatorio,
        })
        .select('*, curso:trein_cursos(nome,slug,carga_horaria,validade_meses)')
        .single()
      if (error) throw error
      onSaved(data)
    } catch (err) {
      setError(/duplicate|unique/i.test(err.message || '')
        ? 'Esse colaborador já está matriculado neste curso.'
        : 'Erro ao matricular: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Designar curso</h2>
          <button className="button-secondary" onClick={onClose} type="button">✕</button>
        </div>
        <div style={{ padding: 14, overflowY: 'auto' }}>
        {error && <div className="alert-error" style={{ margin: '0 0 12px' }}>{error}</div>}
        <label className="field">
          <span>Colaborador *</span>
          <select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}>
            <option value="">Selecione o colaborador</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>{c.nome_completo} — {c.filial_label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Curso *</span>
          <select value={cursoId} onChange={(e) => setCursoId(e.target.value)}>
            <option value="">Selecione o curso</option>
            {cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0', cursor: 'pointer', fontSize: 14 }}>
          <input type="checkbox" checked={obrigatorio} onChange={(e) => setObrigatorio(e.target.checked)} />
          <span>Curso obrigatório</span>
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="button-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Designar'}
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: editar matrícula ────────────────────────────────────────────────

function EditModal({ matricula, onClose, onSaved, onRemoved }) {
  const [status, setStatus] = useState(matricula.status)
  const [progresso, setProgresso] = useState(matricula.progresso)
  const [dataConclusao, setDataConclusao] = useState(matricula.data_conclusao || '')
  const [cert, setCert] = useState(matricula.certificado_url || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function onStatusChange(v) {
    setStatus(v)
    if (v === 'concluido') {
      if (!dataConclusao) setDataConclusao(new Date().toISOString().slice(0, 10))
      if (Number(progresso) < 100) setProgresso(100)
    }
  }

  async function handleSave() {
    setError('')
    setSaving(true)
    const patch = {
      status,
      progresso: Math.max(0, Math.min(100, Number(progresso) || 0)),
      data_conclusao: dataConclusao || null,
      certificado_url: cert.trim() || null,
      atualizado_em: new Date().toISOString(),
    }
    if (patch.status === 'concluido' && !patch.data_conclusao) {
      patch.data_conclusao = new Date().toISOString().slice(0, 10)
    }
    try {
      const { data, error } = await supabase
        .from('trein_matriculas')
        .update(patch)
        .eq('id', matricula.id)
        .select('*, curso:trein_cursos(nome,slug,carga_horaria,validade_meses)')
        .single()
      if (error) throw error
      onSaved(data)
    } catch (err) {
      setError('Erro ao salvar: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!window.confirm('Remover esta matrícula? Esta ação não pode ser desfeita.')) return
    setSaving(true)
    try {
      const { error } = await supabase.from('trein_matriculas').delete().eq('id', matricula.id)
      if (error) throw error
      onRemoved(matricula.id)
    } catch (err) {
      setError('Erro ao remover: ' + (err.message || err))
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Atualizar matrícula</h2>
          <button className="button-secondary" onClick={onClose} type="button">✕</button>
        </div>
        <div style={{ padding: 14, overflowY: 'auto' }}>
        {error && <div className="alert-error" style={{ margin: '0 0 12px' }}>{error}</div>}
        <div className="surface-card" style={{ padding: '10px 14px', marginBottom: 14, fontSize: 14 }}>
          <strong>{matricula.colaborador_nome}</strong> · {matricula.curso?.nome}
        </div>
        <label className="field">
          <span>Status</span>
          <select value={status} onChange={(e) => onStatusChange(e.target.value)}>
            <option value="matriculado">Matriculado</option>
            <option value="andamento">Em andamento</option>
            <option value="concluido">Concluído</option>
          </select>
        </label>
        <label className="field">
          <span>Progresso (%)</span>
          <input type="number" min="0" max="100" step="5" value={progresso} onChange={(e) => setProgresso(e.target.value)} />
        </label>
        <label className="field">
          <span>Data de conclusão</span>
          <input type="date" value={dataConclusao} onChange={(e) => setDataConclusao(e.target.value)} />
        </label>
        <label className="field">
          <span>Link do certificado (opcional)</span>
          <input type="url" placeholder="https://..." value={cert} onChange={(e) => setCert(e.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
          <button type="button" className="button-secondary" style={{ color: 'var(--danger,#c00)' }} onClick={handleRemove} disabled={saving}>
            Remover
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="button-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ───────────────────────────────────────────────────────

export default function TreinamentosPage() {
  const [matriculas, setMatriculas] = useState([])
  const [cursos, setCursos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busca, setBusca] = useState('')
  const [fCurso, setFCurso] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [modalNova, setModalNova] = useState(false)
  const [editM, setEditM] = useState(null)

  async function carregar() {
    setLoading(true)
    setError('')
    try {
      const [mRes, cRes] = await Promise.all([
        supabase.from('trein_matriculas')
          .select('*, curso:trein_cursos(nome,slug,carga_horaria,validade_meses)')
          .order('colaborador_nome'),
        supabase.from('trein_cursos').select('*').eq('ativo', true).order('nome'),
      ])
      if (mRes.error) throw mRes.error
      if (cRes.error) throw cRes.error
      setMatriculas(mRes.data || [])
      setCursos(cRes.data || [])
    } catch (err) {
      setError((err.message || String(err)) +
        ' — verifique se o SQL de integração (trein_cursos / trein_matriculas) já foi aplicado no Supabase.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return matriculas.filter((m) => {
      if (q && !m.colaborador_nome.toLowerCase().includes(q)) return false
      if (fCurso && String(m.curso_id) !== fCurso) return false
      if (fStatus && m.status !== fStatus) return false
      return true
    })
  }, [matriculas, busca, fCurso, fStatus])

  const kpis = useMemo(() => {
    let concl = 0, and = 0, venc = 0, vencendo = 0
    matriculas.forEach((m) => {
      if (m.status === 'concluido') concl++
      if (m.status === 'andamento') and++
      const v = calcVencimento(m)
      if (v.color === '#c0392b') venc++
      if (v.color === '#b45309') vencendo++
    })
    return { total: matriculas.length, concl, and, venc, vencendo }
  }, [matriculas])

  function upsertLocal(row) {
    setMatriculas((prev) => {
      const i = prev.findIndex((x) => x.id === row.id)
      const next = i >= 0 ? prev.map((x) => (x.id === row.id ? row : x)) : [...prev, row]
      return next.sort((a, b) => a.colaborador_nome.localeCompare(b.colaborador_nome))
    })
  }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">RH</span>
          <h1>Treinamentos</h1>
          <p>Acompanhe os cursos da equipe: designe treinamentos, veja progresso, conclusão e validade dos certificados.</p>
        </div>
        <button className="button-primary" type="button" onClick={() => setModalNova(true)}>+ Designar curso</button>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
        {[
          ['Matrículas', kpis.total, '#c49512'],
          ['Em andamento', kpis.and, '#2f6fb0'],
          ['Concluídos', kpis.concl, '#2a8a5a'],
          ['Vencendo / vencidos', `${kpis.vencendo} / ${kpis.venc}`, '#c0392b'],
        ].map(([t, v, cor]) => (
          <div key={t} className="surface-card" style={{ padding: '16px 18px', borderLeft: `4px solid ${cor}` }}>
            <b style={{ fontSize: 26, display: 'block', lineHeight: 1 }}>{v}</b>
            <span style={{ color: '#888', fontSize: 13 }}>{t}</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="surface-card" style={{ padding: '12px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <label className="field filter-field" style={{ minWidth: 200 }}>
            <span>Buscar colaborador</span>
            <input type="text" placeholder="Nome..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
          <label className="field filter-field" style={{ minWidth: 180 }}>
            <span>Curso</span>
            <select value={fCurso} onChange={(e) => setFCurso(e.target.value)}>
              <option value="">Todos</option>
              {cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label className="field filter-field" style={{ minWidth: 160 }}>
            <span>Status</span>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="matriculado">Matriculado</option>
              <option value="andamento">Em andamento</option>
              <option value="concluido">Concluído</option>
            </select>
          </label>
        </div>
      </div>

      {/* Tabela */}
      <div className="surface-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state" style={{ minHeight: 200 }}>Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="empty-state" style={{ minHeight: 160 }}>
            <p>{matriculas.length === 0 ? 'Nenhuma matrícula ainda.' : 'Nenhum resultado para os filtros.'}</p>
            {matriculas.length === 0 && (
              <button className="button-secondary" type="button" style={{ marginTop: 8 }} onClick={() => setModalNova(true)}>
                Designar o primeiro curso
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f0f4f8', textAlign: 'left' }}>
                  {['Colaborador', 'Filial', 'Curso', 'Status', 'Progresso', 'Conclusão', 'Vence', ''].map((h) => (
                    <th key={h} style={{ padding: '12px 14px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em', color: '#4a5a6a', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((m) => {
                  const v = calcVencimento(m)
                  return (
                    <tr key={m.id} style={{ borderTop: '1px solid #e4e8ee' }}>
                      <td style={{ padding: '11px 14px', fontWeight: 600 }}>
                        {m.colaborador_nome}
                        {m.obrigatorio && <span style={{ marginLeft: 8, fontSize: 11, color: '#c0392b', fontWeight: 700 }}>obrigatório</span>}
                      </td>
                      <td style={{ padding: '11px 14px', color: '#5a6a7a' }}>{m.filial_label || '—'}</td>
                      <td style={{ padding: '11px 14px' }}>{m.curso?.nome || '—'}</td>
                      <td style={{ padding: '11px 14px' }}><Badge status={m.status} /></td>
                      <td style={{ padding: '11px 14px' }}><Progress value={m.progresso} /></td>
                      <td style={{ padding: '11px 14px' }}>{fmtDate(m.data_conclusao)}</td>
                      <td style={{ padding: '11px 14px', color: v.color, fontWeight: 600 }}>{v.label}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <button className="button-secondary" style={{ fontSize: 12, padding: '4px 12px' }} type="button" onClick={() => setEditM(m)}>Editar</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalNova && (
        <NovaMatriculaModal
          cursos={cursos}
          onClose={() => setModalNova(false)}
          onSaved={(row) => { upsertLocal(row); setModalNova(false) }}
        />
      )}
      {editM && (
        <EditModal
          matricula={editM}
          onClose={() => setEditM(null)}
          onSaved={(row) => { upsertLocal(row); setEditM(null) }}
          onRemoved={(id) => { setMatriculas((prev) => prev.filter((x) => x.id !== id)); setEditM(null) }}
        />
      )}
    </section>
  )
}

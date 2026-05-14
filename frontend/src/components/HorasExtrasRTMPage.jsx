import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

function parseHoras(str) {
  if (!str || !str.trim()) return 0
  const parts = str.trim().split(':')
  if (parts.length < 2) return parseFloat(str.replace(',', '.')) || 0
  return (parseInt(parts[0], 10) || 0) + (parseInt(parts[1], 10) || 0) / 60 + (parseInt(parts[2], 10) || 0) / 3600
}

function formatHHMM(dec) {
  const totalMin = Math.round(dec * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatBRL(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

function parseBRL(str) {
  return parseFloat((str || '').replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0
}

function numericStr(val) {
  if (!val || val === 0) return ''
  return val.toFixed(2).replace('.', ',')
}

function calcValorHora(col) {
  const salary = parseFloat(col?.salario_base_mensal) || 0
  const weeklyH = parseFloat(col?.carga_horaria_semanal) || 44
  const monthlyH = weeklyH * (52 / 12)
  if (salary === 0 || monthlyH === 0) return 0
  return salary / monthlyH
}

function normName(s) {
  return (s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function matchColaborador(nomePasta, lista) {
  const n = normName(nomePasta)
  if (!n) return null
  let found = lista.find((c) => normName(c.nome_completo) === n)
  if (found) return found
  found = lista.find((c) => {
    const cn = normName(c.nome_completo)
    return cn && (n.includes(cn) || cn.includes(n))
  })
  if (found) return found
  const words = n.split(/\s+/).filter((w) => w.length > 3)
  if (words.length > 0) {
    found = lista.find((c) => {
      const cn = normName(c.nome_completo)
      return words.every((w) => cn.includes(w))
    })
  }
  return found || null
}

// Colunas: FUNCIONARIO | Filial | ESTADO | HORAS NORMAIS | H.EXTRA 100%
function parsePaste(text) {
  if (!text.trim()) return []
  const seen = new Set()
  return text
    .trim()
    .split('\n')
    .map((row) => {
      const cols = row.split('\t').map((c) => c.trim())
      if (!cols[0] || /^funcionario/i.test(cols[0]) || /^nome/i.test(cols[0])) return null
      const hn = cols[3] || '00:00:00'
      const he = cols[4] || '00:00:00'
      return {
        funcionario: cols[0],
        filial_pasta: cols[1] || '',
        estado: cols[2] || '',
        horas_normais_str: hn,
        horas_extra_100_str: he,
        horas_normais: parseHoras(hn),
        horas_extra_100: parseHoras(he),
      }
    })
    .filter((r) => {
      if (!r) return false
      const key = normName(r.funcionario)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function downloadTemplate(filialLabel) {
  const cols = ['FUNCIONARIO', 'Filial', 'ESTADO', 'HORAS NORMAIS', 'H.EXTRA 100%']
  const cells = cols.map((c) => `<Cell><Data ss:Type="String">${c}</Data></Cell>`).join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles><Style ss:ID="H"><Font ss:Bold="1"/></Style></Styles>
 <Worksheet ss:Name="Horas Extras">
  <Table><Row ss:StyleID="H">${cells}</Row></Table>
 </Worksheet>
</Workbook>`
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `modelo_horas_extras${filialLabel ? '_' + filialLabel : ''}.xls`
  a.click()
  URL.revokeObjectURL(url)
}

export default function HorasExtrasRTMPage() {
  const navigate = useNavigate()
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
    api.list('colaboradores', { limit: 2000 })
      .then((res) => setTodosColaboradores(res.items || res || []))
      .catch(() => {})
      .finally(() => setLoadingColab(false))
  }, [])

  function doCalculate() {
    const data = parsePaste(pasteText)
    const fb50 = parseBRL(fallback50)
    const fb100 = parseBRL(fallback100)
    setRows(
      data.map((r) => {
        const col = matchColaborador(r.funcionario, todosColaboradores)
        const inativo = col && col.ativo === false
        const vh = col ? calcValorHora(col) : 0
        const vh50 = vh > 0 ? vh * 1.5 : fb50
        const vh100 = vh > 0 ? vh * 2.0 : fb100
        return {
          ...r,
          col,
          matched: Boolean(col),
          inativo,
          salario: col ? parseFloat(col.salario_base_mensal) || 0 : 0,
          vh50: numericStr(vh50),
          vh100: numericStr(vh100),
          selected: true,
        }
      })
    )
    setParsed(true)
  }

  function updateRow(i, field, val) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)))
  }

  function toggleAll(val) {
    setRows((prev) => prev.map((r) => ({ ...r, selected: val })))
  }

  function applyFallbackToAll() {
    setRows((prev) => prev.map((r) => ({ ...r, vh50: fallback50, vh100: fallback100 })))
  }

  const enrichedRows = useMemo(
    () =>
      rows.map((r) => {
        const vh50 = parseBRL(r.vh50)
        const vh100 = parseBRL(r.vh100)
        return {
          ...r,
          vh50_num: vh50,
          vh100_num: vh100,
          total50: r.horas_normais * vh50,
          total100: r.horas_extra_100 * vh100,
        }
      }),
    [rows]
  )

  const filialOptions = useMemo(
    () => [...new Set(enrichedRows.map((r) => r.filial_pasta).filter(Boolean))].sort(),
    [enrichedRows]
  )
  const estadoOptions = useMemo(
    () => [...new Set(enrichedRows.map((r) => r.estado).filter(Boolean))].sort(),
    [enrichedRows]
  )

  const filteredIndexes = useMemo(
    () =>
      enrichedRows
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => {
          if (filterNome && !normName(r.funcionario).includes(normName(filterNome))) return false
          if (filterFilial && r.filial_pasta !== filterFilial) return false
          if (filterEstado && r.estado !== filterEstado) return false
          if (filterStatus === 'selecionados' && !r.selected) return false
          if (filterStatus === 'desmarcados' && r.selected) return false
          if (filterStatus === 'inativos' && !r.inativo) return false
          if (filterStatus === 'sem_contrato' && r.matched) return false
          return true
        }),
    [enrichedRows, filterNome, filterFilial, filterEstado, filterStatus]
  )

  // Totais consideram apenas linhas visíveis no filtro E selecionadas
  const filteredSelectedRows = useMemo(
    () => filteredIndexes.map(({ i }) => enrichedRows[i]).filter((r) => r.selected),
    [filteredIndexes, enrichedRows]
  )

  const totalH50 = filteredSelectedRows.reduce((s, r) => s + r.horas_normais, 0)
  const totalH100 = filteredSelectedRows.reduce((s, r) => s + r.horas_extra_100, 0)
  const totalMon50 = filteredSelectedRows.reduce((s, r) => s + r.total50, 0)
  const totalMon100 = filteredSelectedRows.reduce((s, r) => s + r.total100, 0)
  const grandTotal = totalMon50 + totalMon100
  const temValores = filteredSelectedRows.some((r) => r.vh50_num > 0 || r.vh100_num > 0)

  async function salvarFechamento() {
    const selecionados = enrichedRows.filter((r) => r.selected)
    if (!selecionados.length) { setSaveMsg({ type: 'error', text: 'Selecione ao menos um funcionário.' }); return }
    if (!mesReferencia) { setSaveMsg({ type: 'error', text: 'Informe o mês de referência.' }); return }
    setSaving(true)
    setSaveMsg(null)
    try {
      const registros = selecionados.map((r) => ({
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
      const mes = mesReferencia + '-01'
      await api.rtmSalvar(mes, registros)
      setSaveMsg({ type: 'success', text: `Fechamento de ${mesReferencia} salvo com ${registros.length} funcionários.` })
    } catch (e) {
      setSaveMsg({ type: 'error', text: e.message || 'Erro ao salvar.' })
    } finally {
      setSaving(false)
    }
  }

  const matchedCount = enrichedRows.filter((r) => r.matched).length
  const inativoCount = enrichedRows.filter((r) => r.inativo).length
  const allSelected = rows.length > 0 && rows.every((r) => r.selected)
  const noneSelected = rows.every((r) => !r.selected)
  const selectedCount = rows.filter((r) => r.selected).length
  const hasFilter = filterNome || filterFilial || filterEstado || filterStatus !== 'todos'

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Operação RTM</span>
          <h1>Calculadora de Horas Extras</h1>
          <p>Valores hora lidos do contrato — ajuste individualmente quando necessário</p>
        </div>
      </div>

      <div className="surface-card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
          {/* Baixar modelo */}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="button-secondary"
              type="button"
              onClick={() => downloadTemplate('')}
              title="Baixa modelo Excel com o cabeçalho das 5 colunas"
            >
              ↓ Baixar modelo Excel
            </button>
          </div>

          {/* Taxas de fallback */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 12px', background: '#f5f7fa', border: '1px solid #dce1e8', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', width: '100%', marginBottom: 2 }}>
              Taxa manual (para colaboradores sem contrato){loadingColab && <span style={{ fontWeight: 400, marginLeft: 6 }}>carregando contratos…</span>}
            </div>
            <div>
              <label className="field-label">Valor Hora 50%</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>R$</span>
                <input className="input" value={fallback50} onChange={(e) => setFallback50(e.target.value)} placeholder="59,92" style={{ width: 100 }} />
              </div>
            </div>
            <div>
              <label className="field-label">Valor Hora 100%</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>R$</span>
                <input className="input" value={fallback100} onChange={(e) => setFallback100(e.target.value)} placeholder="79,89" style={{ width: 100 }} />
              </div>
            </div>
            {rows.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="button-secondary" type="button" onClick={applyFallbackToAll} style={{ fontSize: 11 }}>
                  Aplicar a todos
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Área de cola */}
        <div>
          <strong style={{ fontSize: 13 }}>Dados da planilha</strong>
          <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 8px' }}>
            Copie e cole direto da planilha. Colunas:{' '}
            <strong>FUNCIONARIO · Filial · ESTADO · HORAS NORMAIS · H.EXTRA 100%</strong>
          </p>
          <textarea
            className="input"
            rows={9}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"FUNCIONARIO\tFilial\tESTADO\tHORAS NORMAIS\tH.EXTRA 100%\nANA SILVA\tWHITE MARTINS\tSS/RS\t08:00:00\t00:00:00"}
            style={{ fontFamily: 'Courier New, monospace', fontSize: 12, resize: 'vertical', width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="button-primary" onClick={doCalculate} type="button">
            Calcular
          </button>
          {parsed && (
            <button className="button-secondary" onClick={() => { setPasteText(''); setRows([]); setParsed(false) }} type="button">
              Limpar
            </button>
          )}
        </div>
      </div>

      {parsed && rows.length === 0 && (
        <div className="surface-card empty-state">
          <strong>Nenhum dado encontrado</strong>
          <p>Verifique se os dados estão separados por tabulação (copie direto da planilha)</p>
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Filtros da tabela */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10, padding: '10px 14px', background: '#f5f7fa', border: '1px solid #dce1e8', borderRadius: 'var(--radius)' }}>
            <div>
              <label className="field-label">Funcionário</label>
              <input
                className="input"
                value={filterNome}
                onChange={(e) => setFilterNome(e.target.value)}
                placeholder="Buscar nome…"
                style={{ width: 200 }}
              />
            </div>
            <div>
              <label className="field-label">Filial</label>
              <select className="input" value={filterFilial} onChange={(e) => setFilterFilial(e.target.value)} style={{ minWidth: 150 }}>
                <option value="">Todas</option>
                {filialOptions.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Estado</label>
              <select className="input" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} style={{ minWidth: 120 }}>
                <option value="">Todos</option>
                {estadoOptions.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Status</label>
              <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ minWidth: 150 }}>
                <option value="todos">Todos</option>
                <option value="selecionados">Selecionados</option>
                <option value="desmarcados">Desmarcados</option>
                <option value="inativos">Inativos</option>
                <option value="sem_contrato">Sem contrato</option>
              </select>
            </div>
            {hasFilter && (
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => { setFilterNome(''); setFilterFilial(''); setFilterEstado(''); setFilterStatus('todos') }}
                  style={{ fontSize: 11 }}
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </div>

          {/* Badges + controles de seleção */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, padding: '3px 10px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 99, color: 'var(--success)', fontWeight: 700 }}>
              ✓ {matchedCount} com contrato
            </span>
            {inativoCount > 0 && (
              <span style={{ fontSize: 12, padding: '3px 10px', background: '#f0e8ff', border: '1px solid #c4a0e8', borderRadius: 99, color: '#6b21a8', fontWeight: 700 }}>
                ⚠ {inativoCount} inativo{inativoCount !== 1 ? 's' : ''}
              </span>
            )}
            {enrichedRows.filter((r) => !r.matched).length > 0 && (
              <span style={{ fontSize: 12, padding: '3px 10px', background: '#fffbec', border: '1px solid #f1d877', borderRadius: 99, color: '#7a5c00', fontWeight: 700 }}>
                ⚠ {enrichedRows.filter((r) => !r.matched).length} sem cadastro
              </span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{selectedCount}/{rows.length} selecionados</span>
              {!allSelected && (
                <button className="button-secondary" type="button" onClick={() => toggleAll(true)} style={{ fontSize: 11, padding: '3px 10px' }}>
                  Selecionar todos
                </button>
              )}
              {!noneSelected && (
                <button className="button-secondary" type="button" onClick={() => toggleAll(false)} style={{ fontSize: 11, padding: '3px 10px' }}>
                  Desmarcar todos
                </button>
              )}
            </div>
          </div>

          <div className="surface-card" style={{ padding: 0, marginBottom: 12 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: 1060 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center' }}>
                      <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} title="Selecionar / desmarcar todos" />
                    </th>
                    <th>Funcionário</th>
                    <th>Filial</th>
                    <th>Est.</th>
                    <th style={{ textAlign: 'right' }}>H. Normais</th>
                    <th style={{ textAlign: 'right' }}>H. Extra 100%</th>
                    <th style={{ textAlign: 'right' }}>Salário base</th>
                    <th style={{ textAlign: 'right', width: 120 }}>V. Hora 50%</th>
                    <th style={{ textAlign: 'right', width: 120 }}>V. Hora 100%</th>
                    <th style={{ textAlign: 'right' }}>Total H. 50</th>
                    <th style={{ textAlign: 'right' }}>Total H. 100</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIndexes.length === 0 && (
                    <tr>
                      <td colSpan={12} style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0', fontSize: 12 }}>
                        Nenhum resultado para os filtros aplicados
                      </td>
                    </tr>
                  )}
                  {filteredIndexes.map(({ i }) => {
                    const r = enrichedRows[i]
                    return (
                      <tr
                        key={i}
                        style={{
                          opacity: r.selected ? 1 : 0.4,
                          background: r.inativo && r.selected ? '#fdf4ff' : undefined,
                        }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={r.selected} onChange={(e) => updateRow(i, 'selected', e.target.checked)} />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span
                              title={r.inativo ? `Inativo: ${r.col?.nome_completo}` : r.matched ? `Contrato: ${r.col?.nome_completo}` : 'Sem cadastro — taxa manual'}
                              style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: r.inativo ? '#a855f7' : r.matched ? 'var(--success)' : '#f0b429' }}
                            />
                            <strong style={{ fontSize: 12 }}>{r.funcionario}</strong>
                            {r.inativo && (
                              <span style={{ fontSize: 9, fontWeight: 700, color: '#6b21a8', background: '#f0e8ff', border: '1px solid #c4a0e8', borderRadius: 99, padding: '1px 5px' }}>
                                INATIVO
                              </span>
                            )}
                          </div>
                          {r.matched && r.col?.nome_completo && normName(r.col.nome_completo) !== normName(r.funcionario) && (
                            <div style={{ fontSize: 10, color: 'var(--muted)', paddingLeft: 12 }}>{r.col.nome_completo}</div>
                          )}
                        </td>
                        <td style={{ fontSize: 11 }}>{r.filial_pasta}</td>
                        <td style={{ fontSize: 11 }}>{r.estado}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{r.horas_normais_str}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                          {r.horas_extra_100 > 0
                            ? <span style={{ color: 'var(--warning)', fontWeight: 700 }}>{r.horas_extra_100_str}</span>
                            : <span style={{ color: '#ccc' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 11 }}>
                          {r.matched ? formatBRL(r.salario) : <span style={{ color: '#bbb', fontSize: 10 }}>manual</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            className="input"
                            value={r.vh50}
                            onChange={(e) => updateRow(i, 'vh50', e.target.value)}
                            disabled={!r.selected}
                            style={{ width: 90, textAlign: 'right', fontSize: 12 }}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            className="input"
                            value={r.vh100}
                            onChange={(e) => updateRow(i, 'vh100', e.target.value)}
                            disabled={!r.selected}
                            style={{ width: 90, textAlign: 'right', fontSize: 12 }}
                          />
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 12 }}>
                          {r.selected && r.vh50_num > 0 ? formatBRL(r.total50) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 12 }}>
                          {r.selected && r.vh100_num > 0 && r.horas_extra_100 > 0
                            ? formatBRL(r.total100)
                            : <span style={{ color: '#ccc' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <strong>{r.selected && temValores ? formatBRL(r.total50 + r.total100) : '—'}</strong>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f0f4f8', fontWeight: 700 }}>
                    <td />
                    <td colSpan={3} style={{ fontSize: 12 }}>
                      TOTAL{hasFilter ? ' (filtrado)' : ''} — {filteredSelectedRows.length} func.
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{formatHHMM(totalH50)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: totalH100 > 0 ? 'var(--warning)' : undefined }}>
                      {totalH100 > 0 ? formatHHMM(totalH100) : '—'}
                    </td>
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
          <div className="surface-card" style={{ marginBottom: 12, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label className="field-label">Mês de referência</label>
              <input
                type="month"
                className="input"
                value={mesReferencia}
                onChange={(e) => setMesReferencia(e.target.value)}
                style={{ width: 160 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <button className="button-primary" onClick={salvarFechamento} disabled={saving} type="button">
                {saving ? 'Salvando…' : 'Salvar fechamento'}
              </button>
              <button className="button-secondary" onClick={() => navigate('/horas-extras-historico')} type="button">
                Ver histórico
              </button>
              <button className="button-secondary" onClick={() => navigate('/horas-extras-metricas')} type="button">
                Métricas
              </button>
            </div>
            {saveMsg && (
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: saveMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
                padding: '4px 10px', borderRadius: 'var(--radius)',
                background: saveMsg.type === 'success' ? 'var(--success-bg)' : '#fff0f0',
              }}>
                {saveMsg.text}
              </span>
            )}
          </div>

          {temValores && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ padding: '12px 20px', background: '#f0f4f8', border: '1px solid #c8d2dc', borderRadius: 'var(--radius)', minWidth: 150 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                  {hasFilter ? 'H. 50% (filtrado)' : 'Total Horas 50%'}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace' }}>{formatHHMM(totalH50)}</div>
              </div>
              <div style={{ padding: '12px 20px', background: '#fff8ec', border: '1px solid #f1b878', borderRadius: 'var(--radius)', minWidth: 150 }}>
                <div style={{ fontSize: 10, color: '#a04000', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                  {hasFilter ? 'H. 100% (filtrado)' : 'Total Horas 100%'}
                </div>
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
                <div style={{ fontSize: 10, color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                  {hasFilter ? 'TOTAL (filtrado)' : 'TOTAL GERAL'}
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--success)' }}>{formatBRL(grandTotal)}</div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

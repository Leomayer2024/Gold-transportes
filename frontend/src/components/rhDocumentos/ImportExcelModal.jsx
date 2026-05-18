import { useRef, useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { api } from '../../services/api'
import {
  findTipoCatalogo,
  categoriaSugerida,
  diasAlertaSugerido,
  calcularValidadeSugerida,
  CATEGORIA_LABELS,
} from './catalogo'
import { dataBrParaIso, normalizarNome } from './helpers'

// Cabeçalhos esperados na planilha (ordem livre, nomes case-insensitive).
const HEADERS = [
  'Colaborador',
  'Filial',
  'Categoria',
  'Tipo do documento',
  'Número',
  'Órgão emissor',
  'Data emissão',
  'Data validade',
  'Dias alerta',
  'Status',
  'Obrigatório',
  'Observações',
]

function getCell(row, header) {
  const target = normalizarNome(header)
  for (const key of Object.keys(row)) {
    if (normalizarNome(key) === target) return row[key]
  }
  return ''
}

function asBool(v) {
  const s = normalizarNome(v)
  return ['sim', 's', 'true', '1', 'x', 'yes'].includes(s)
}

export default function ImportExcelModal({ colaboradores, filiais, onClose, onImported }) {
  const fileRef = useRef(null)
  const [parsing, setParsing] = useState(false)
  const [rows, setRows] = useState([])    // linhas analisadas com colaborador_id, filial_id, ...
  const [erros, setErros] = useState([])  // mensagens por linha rejeitada
  const [importing, setImporting] = useState(false)
  const [resultado, setResultado] = useState(null)

  const colabIndex = useMemo(() => {
    const map = new Map()
    for (const c of colaboradores) {
      map.set(normalizarNome(c.nome_completo), c)
      map.set(String(c.id), c)
    }
    return map
  }, [colaboradores])

  const filialIndex = useMemo(() => {
    const map = new Map()
    for (const f of filiais) {
      map.set(normalizarNome(f.cidade || f.nome || `filial ${f.id}`), f)
      map.set(String(f.id), f)
    }
    return map
  }, [filiais])

  function baixarTemplate() {
    const exemplo = [
      {
        Colaborador: 'Nome do colaborador (igual ao cadastro)',
        Filial: 'Cidade da filial ou ID',
        Categoria: 'saude',
        'Tipo do documento': 'ASO Periódico',
        Número: 'Nº interno (opcional)',
        'Órgão emissor': 'Clínica X',
        'Data emissão': '2026-01-15',
        'Data validade': '2027-01-15',
        'Dias alerta': 30,
        Status: '',
        Obrigatório: 'Sim',
        Observações: '',
      },
    ]
    const ws = XLSX.utils.json_to_sheet(exemplo, { header: HEADERS })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Documentos RH')
    XLSX.writeFile(wb, 'modelo_documentos_rh.xlsx')
  }

  async function aoEscolherArquivo(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setParsing(true)
    setErros([])
    setRows([])
    setResultado(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' })
      const parsed = []
      const errosLocais = []
      raw.forEach((row, idx) => {
        const linha = idx + 2 // +1 cabeçalho, +1 base 1
        const nomeColab = getCell(row, 'Colaborador')
        const nomeFilial = getCell(row, 'Filial')
        const tipo = String(getCell(row, 'Tipo do documento') || '').trim()

        if (!nomeColab && !tipo) return // linha vazia

        const colab = colabIndex.get(normalizarNome(nomeColab)) || colabIndex.get(String(nomeColab).trim())
        const filial = filialIndex.get(normalizarNome(nomeFilial)) || filialIndex.get(String(nomeFilial).trim())

        if (!colab) {
          errosLocais.push({ linha, motivo: `Colaborador não encontrado: "${nomeColab}"` })
          return
        }
        if (!tipo) {
          errosLocais.push({ linha, motivo: 'Tipo do documento vazio' })
          return
        }

        const filialId = filial?.id || colab.filial_id
        const dataEmissao = dataBrParaIso(getCell(row, 'Data emissão'))
        let dataValidade = dataBrParaIso(getCell(row, 'Data validade'))
        if (!dataValidade && dataEmissao) {
          dataValidade = calcularValidadeSugerida(tipo, dataEmissao) || ''
        }
        const categoriaCelula = String(getCell(row, 'Categoria') || '').toLowerCase().trim()
        const categoria = categoriaCelula || categoriaSugerida(tipo) || ''
        const diasAlertaCel = getCell(row, 'Dias alerta')
        const diasAlerta = diasAlertaCel === '' ? diasAlertaSugerido(tipo, 30) : Number(diasAlertaCel) || 30
        const obrigatorioRaw = getCell(row, 'Obrigatório')
        const obrigatorio = obrigatorioRaw === ''
          ? Boolean(findTipoCatalogo(tipo)?.obrigatorio)
          : asBool(obrigatorioRaw)

        parsed.push({
          _linha: linha,
          colaborador_id: colab.id,
          colaborador_nome: colab.nome_completo,
          filial_id: filialId,
          categoria: categoria || null,
          tipo_documento: tipo,
          numero_documento: String(getCell(row, 'Número') || '').trim() || null,
          orgao_emissor: String(getCell(row, 'Órgão emissor') || '').trim() || null,
          data_emissao: dataEmissao || null,
          data_validade: dataValidade || null,
          dias_alerta: diasAlerta,
          status: String(getCell(row, 'Status') || '').trim() || null,
          obrigatorio,
          observacoes: String(getCell(row, 'Observações') || '').trim() || null,
          ativo: true,
        })
      })
      setRows(parsed)
      setErros(errosLocais)
    } catch (e) {
      setErros([{ linha: 0, motivo: e.message || 'Falha ao ler o arquivo Excel.' }])
    } finally {
      setParsing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function importar() {
    setImporting(true)
    let sucessos = 0
    const falhas = []
    for (const row of rows) {
      const { _linha, colaborador_nome, ...payload } = row
      try {
        await api.create('colaborador_documentos', payload)
        sucessos++
      } catch (e) {
        falhas.push({ linha: _linha, motivo: e.message || 'Erro desconhecido' })
      }
    }
    setResultado({ sucessos, falhas })
    setImporting(false)
    if (sucessos > 0) onImported?.()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-card rh-doc-modal-lg">
        <header className="modal-header">
          <h3>Importar documentos via Excel</h3>
          <button className="button-link" onClick={onClose} type="button">✕</button>
        </header>

        <div className="rh-doc-import-body">
          <div className="rh-doc-import-actions">
            <button type="button" className="button-secondary" onClick={baixarTemplate}>
              📥 Baixar modelo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={aoEscolherArquivo}
              disabled={parsing || importing}
            />
            {parsing && <small>Lendo planilha…</small>}
          </div>

          <p className="muted" style={{ fontSize: 11 }}>
            Os nomes de colaborador e filial devem bater com o cadastro (acentos e maiúsculas/minúsculas não importam).
            Datas em <code>AAAA-MM-DD</code> ou <code>DD/MM/AAAA</code>. Se a validade ficar em branco e o tipo for conhecido,
            ela é calculada pela data de emissão.
          </p>

          {erros.length > 0 && (
            <div className="alert-danger" style={{ marginTop: 8 }}>
              <strong>{erros.length} linha(s) com problema:</strong>
              <ul style={{ margin: '6px 0 0 16px' }}>
                {erros.slice(0, 30).map((e, i) => (
                  <li key={i}>Linha {e.linha}: {e.motivo}</li>
                ))}
              </ul>
            </div>
          )}

          {rows.length > 0 && !resultado && (
            <>
              <div style={{ margin: '10px 0 6px', fontWeight: 700 }}>
                Pré-visualização ({rows.length} linha{rows.length === 1 ? '' : 's'} prontas para importar)
              </div>
              <div className="rh-doc-import-preview">
                <table>
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>Colaborador</th>
                      <th>Categoria</th>
                      <th>Tipo</th>
                      <th>Emissão</th>
                      <th>Validade</th>
                      <th>Alerta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r) => (
                      <tr key={r._linha}>
                        <td>{r._linha}</td>
                        <td>{r.colaborador_nome}</td>
                        <td>{CATEGORIA_LABELS[r.categoria] || r.categoria || '—'}</td>
                        <td>{r.tipo_documento}</td>
                        <td>{r.data_emissao || '—'}</td>
                        <td>{r.data_validade || '—'}</td>
                        <td>{r.dias_alerta}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 && (
                  <small className="muted">…e mais {rows.length - 50} linhas.</small>
                )}
              </div>
            </>
          )}

          {resultado && (
            <div className={resultado.falhas.length ? 'alert-warning' : 'alert-success'} style={{ marginTop: 10 }}>
              <strong>Importação concluída.</strong>
              <div>{resultado.sucessos} documento(s) inserido(s).</div>
              {resultado.falhas.length > 0 && (
                <>
                  <div>{resultado.falhas.length} falharam:</div>
                  <ul style={{ margin: '4px 0 0 16px' }}>
                    {resultado.falhas.slice(0, 30).map((f, i) => (
                      <li key={i}>Linha {f.linha}: {f.motivo}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <footer className="modal-footer">
          <button type="button" className="button-secondary" onClick={onClose}>
            {resultado ? 'Fechar' : 'Cancelar'}
          </button>
          {rows.length > 0 && !resultado && (
            <button
              type="button"
              className="button-primary"
              onClick={importar}
              disabled={importing}
            >
              {importing ? 'Importando…' : `Importar ${rows.length} documento(s)`}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

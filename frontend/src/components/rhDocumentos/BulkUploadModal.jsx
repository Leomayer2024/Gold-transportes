import { useMemo, useState } from 'react'
import { api } from '../../services/api'
import { uploadRhDocumentFile } from '../../lib/supabase'
import {
  TIPOS_DOCUMENTOS,
  findTipoCatalogo,
  calcularValidadeSugerida,
  diasAlertaSugerido,
  categoriaSugerida,
} from './catalogo'
import { normalizarNome } from './helpers'

// Tenta extrair "colaborador" e "tipo" do nome do arquivo.
// Convenção sugerida: "Nome Colaborador - Tipo do documento.pdf"
//   ou:               "Nome Colaborador_Tipo.pdf"
function adivinhar(nomeArquivo, colaboradoresIndex) {
  const baseRaw = nomeArquivo.replace(/\.[a-z0-9]+$/i, '')
  const base = normalizarNome(baseRaw)

  // 1) procura tipo conhecido dentro do nome
  let tipoAchado = ''
  let tipoLen = 0
  for (const t of TIPOS_DOCUMENTOS) {
    const n = normalizarNome(t.tipo)
    if (base.includes(n) && n.length > tipoLen) {
      tipoAchado = t.tipo
      tipoLen = n.length
    }
  }

  // 2) procura colaborador cujo nome aparece no arquivo (maior match vence)
  let colabAchado = null
  let colabLen = 0
  for (const [nomeNorm, c] of colaboradoresIndex.entries()) {
    if (nomeNorm.length < 4) continue
    if (base.includes(nomeNorm) && nomeNorm.length > colabLen) {
      colabAchado = c
      colabLen = nomeNorm.length
    }
  }

  return { tipo: tipoAchado, colaborador: colabAchado }
}

export default function BulkUploadModal({ colaboradores, filiais, onClose, onImported }) {
  const colabIndex = useMemo(() => {
    const map = new Map()
    for (const c of colaboradores) {
      map.set(normalizarNome(c.nome_completo), c)
    }
    return map
  }, [colaboradores])

  const [items, setItems] = useState([]) // { file, colaborador_id, filial_id, tipo, data_emissao, data_validade, dias_alerta, status:'pending'|'ok'|'fail', erro? }
  const [importing, setImporting] = useState(false)
  const [hoverDrag, setHoverDrag] = useState(false)

  function adicionarArquivos(fileList) {
    const arquivos = Array.from(fileList || [])
    const novos = arquivos.map((file) => {
      const { tipo, colaborador } = adivinhar(file.name, colabIndex)
      const filialId = colaborador?.filial_id || filiais[0]?.id || ''
      const dataEmissao = ''
      const validade = tipo ? calcularValidadeSugerida(tipo, '') || '' : ''
      return {
        file,
        nome: file.name,
        colaborador_id: colaborador?.id || '',
        filial_id: filialId,
        tipo: tipo || '',
        categoria: tipo ? categoriaSugerida(tipo) : '',
        data_emissao: dataEmissao,
        data_validade: validade,
        dias_alerta: tipo ? diasAlertaSugerido(tipo, 30) : 30,
        status: 'pending',
        erro: '',
      }
    })
    setItems((prev) => [...prev, ...novos])
  }

  function aoDropar(e) {
    e.preventDefault()
    setHoverDrag(false)
    adicionarArquivos(e.dataTransfer.files)
  }

  function atualizar(idx, patch) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function removerLinha(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function aoMudarTipo(idx, tipo) {
    const patch = { tipo }
    const cat = findTipoCatalogo(tipo)
    if (cat) {
      patch.categoria = cat.categoria
      patch.dias_alerta = cat.diasAlerta || items[idx].dias_alerta
      if (!items[idx].data_validade && items[idx].data_emissao) {
        const sugerida = calcularValidadeSugerida(tipo, items[idx].data_emissao)
        if (sugerida) patch.data_validade = sugerida
      }
    }
    atualizar(idx, patch)
  }

  async function importar() {
    setImporting(true)
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.status === 'ok') continue
      if (!item.colaborador_id || !item.filial_id || !item.tipo) {
        atualizar(i, { status: 'fail', erro: 'Colaborador, filial e tipo são obrigatórios.' })
        continue
      }
      try {
        const up = await uploadRhDocumentFile(item.file, {
          folder: 'documentos-rh',
          entityId: item.colaborador_id,
        })
        await api.create('colaborador_documentos', {
          colaborador_id: Number(item.colaborador_id),
          filial_id: Number(item.filial_id),
          categoria: item.categoria || null,
          tipo_documento: item.tipo,
          data_emissao: item.data_emissao || null,
          data_validade: item.data_validade || null,
          dias_alerta: Number(item.dias_alerta) || 30,
          arquivo_url: up.url,
          obrigatorio: Boolean(findTipoCatalogo(item.tipo)?.obrigatorio),
          ativo: true,
        })
        atualizar(i, { status: 'ok' })
      } catch (e) {
        atualizar(i, { status: 'fail', erro: e.message || 'Falha ao importar.' })
      }
    }
    setImporting(false)
    onImported?.()
  }

  const prontos = items.filter((it) => it.status === 'ok').length

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-card rh-doc-modal-lg">
        <header className="modal-header">
          <h3>Upload em lote de PDFs</h3>
          <button className="button-link" onClick={onClose} type="button">✕</button>
        </header>

        <div className="rh-doc-import-body">
          <div
            className={`rh-doc-dropzone${hoverDrag ? ' active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setHoverDrag(true) }}
            onDragLeave={() => setHoverDrag(false)}
            onDrop={aoDropar}
          >
            <strong>Arraste vários PDFs aqui</strong>
            <small>
              Dica para auto-preenchimento: nomeie os arquivos como
              <code> "Nome Colaborador - Tipo do Documento.pdf"</code> — o sistema tenta casar pelo nome.
            </small>
            <label className="button-secondary" style={{ marginTop: 8 }}>
              Selecionar arquivos
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                style={{ display: 'none' }}
                onChange={(e) => adicionarArquivos(e.target.files)}
              />
            </label>
          </div>

          {items.length > 0 && (
            <div className="rh-doc-import-preview">
              <table>
                <thead>
                  <tr>
                    <th>Arquivo</th>
                    <th>Colaborador</th>
                    <th>Filial</th>
                    <th>Tipo</th>
                    <th>Emissão</th>
                    <th>Validade</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className={it.status === 'ok' ? 'rh-status-vigente' : it.status === 'fail' ? 'rh-status-vencido' : ''}>
                      <td title={it.nome} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.nome}
                      </td>
                      <td>
                        <select
                          value={it.colaborador_id}
                          onChange={(e) => atualizar(idx, { colaborador_id: e.target.value, filial_id: colaboradores.find((c) => Number(c.id) === Number(e.target.value))?.filial_id || it.filial_id })}
                          disabled={importing || it.status === 'ok'}
                        >
                          <option value="">—</option>
                          {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome_completo}</option>)}
                        </select>
                      </td>
                      <td>
                        <select
                          value={it.filial_id}
                          onChange={(e) => atualizar(idx, { filial_id: e.target.value })}
                          disabled={importing || it.status === 'ok'}
                        >
                          <option value="">—</option>
                          {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade || f.nome || f.id}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          list="rh-doc-tipos-bulk"
                          value={it.tipo}
                          onChange={(e) => aoMudarTipo(idx, e.target.value)}
                          disabled={importing || it.status === 'ok'}
                          style={{ width: 160 }}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={it.data_emissao}
                          onChange={(e) => atualizar(idx, { data_emissao: e.target.value })}
                          disabled={importing || it.status === 'ok'}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={it.data_validade}
                          onChange={(e) => atualizar(idx, { data_validade: e.target.value })}
                          disabled={importing || it.status === 'ok'}
                        />
                      </td>
                      <td>
                        {it.status === 'ok' && <span className="rh-status-badge vigente">enviado</span>}
                        {it.status === 'fail' && <span className="rh-status-badge vencido" title={it.erro}>falhou</span>}
                        {it.status === 'pending' && <span className="rh-status-badge pendente">aguardando</span>}
                      </td>
                      <td>
                        {it.status !== 'ok' && (
                          <button type="button" className="button-link danger" onClick={() => removerLinha(idx)}>✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="rh-doc-tipos-bulk">
                {TIPOS_DOCUMENTOS.map((t) => <option key={t.tipo} value={t.tipo}>{t.tipo}</option>)}
              </datalist>
            </div>
          )}
        </div>

        <footer className="modal-footer">
          <button type="button" className="button-secondary" onClick={onClose}>
            {prontos > 0 ? 'Fechar' : 'Cancelar'}
          </button>
          {items.length > 0 && prontos < items.length && (
            <button
              type="button"
              className="button-primary"
              onClick={importar}
              disabled={importing}
            >
              {importing ? 'Enviando…' : `Enviar ${items.length - prontos} arquivo(s)`}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

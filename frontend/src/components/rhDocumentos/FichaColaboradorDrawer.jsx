import { useMemo, useEffect, useState, useCallback } from 'react'
import { api } from '../../services/api'
import {
  CATEGORIAS,
  CATEGORIA_LABELS,
  STATUS_LABELS,
  isTipoSensivel,
} from './catalogo'
import { formatarDataBr } from './helpers'
import SensitiveField from './SensitiveField'
import VinculoColaboradorSection from '../rhContratos/VinculoColaboradorSection'

// Drawer lateral que mostra TODOS os documentos de um colaborador agrupados
// por categoria, com chips de status e acesso rápido aos arquivos.
//
// Props:
//   colaboradorId         — id do colaborador a exibir
//   colaboradores         — lista carregada (para resolver nome/filial)
//   filiais               — lista de filiais
//   documentos            — lista enriquecida (com status_calculado/dias_para_vencer)
//   onClose               — fecha o drawer
//   onEditarDoc(d)        — clique em um doc abre o modal de edição
//   onNovoDoc(id)         — botão "+ Adicionar documento"
//   onDocumentoCriado(d)        — repassado ao section: novo doc gerado por prorrogação
//   onDocumentoAtualizado(id,p) — repassado ao section: patch incremental em doc
//   onSyncCompleto              — fallback de refetch (desligamento, etc.)
export default function FichaColaboradorDrawer({
  colaboradorId,
  colaboradores,
  filiais,
  documentos,
  onClose,
  onEditarDoc,
  onNovoDoc,
  onDocumentoCriado,
  onDocumentoAtualizado,
  onSyncCompleto,
}) {
  const colab = useMemo(
    () => colaboradores.find((c) => Number(c.id) === Number(colaboradorId)),
    [colaboradores, colaboradorId],
  )
  const filial = useMemo(
    () => filiais.find((f) => Number(f.id) === Number(colab?.filial_id)),
    [filiais, colab],
  )

  const docsDoColab = useMemo(
    () => documentos
      .filter((d) => Number(d.colaborador_id) === Number(colaboradorId))
      .filter((d) => d.ativo !== false),
    [documentos, colaboradorId],
  )

  // Carrega contratos do colaborador (lista pode ser pequena)
  const [contratos, setContratos] = useState([])
  const carregarContratos = useCallback(async () => {
    try {
      const res = await api.list('colaborador_contratos', { colaborador_id: colaboradorId, limit: 200 })
      const rows = res?.data || res || []
      setContratos(rows)
    } catch {
      setContratos([])
    }
  }, [colaboradorId])
  useEffect(() => { carregarContratos() }, [carregarContratos])

  // Agrupa por categoria, preservando a ordem do catálogo.
  const porCategoria = useMemo(() => {
    const grupos = new Map()
    for (const c of CATEGORIAS) grupos.set(c.value, [])
    grupos.set('__sem_categoria__', [])
    for (const d of docsDoColab) {
      const key = d.categoria || '__sem_categoria__'
      if (!grupos.has(key)) grupos.set(key, [])
      grupos.get(key).push(d)
    }
    // Dentro de cada categoria, ordena por validade (mais próximos do vencimento primeiro)
    for (const lista of grupos.values()) {
      lista.sort((a, b) => {
        const da = a.dias_para_vencer ?? Number.POSITIVE_INFINITY
        const db = b.dias_para_vencer ?? Number.POSITIVE_INFINITY
        return da - db
      })
    }
    return grupos
  }, [docsDoColab])

  const resumo = useMemo(() => {
    let vencidos = 0, alerta = 0, pendentes = 0, vigentes = 0
    for (const d of docsDoColab) {
      const s = d.status_calculado
      if (s === 'vencido') vencidos++
      else if (s === 'vence_em_breve') alerta++
      else if (s === 'pendente') pendentes++
      else if (s === 'vigente' || s === 'vigente_sem_validade') vigentes++
    }
    return { vencidos, alerta, pendentes, vigentes, total: docsDoColab.length }
  }, [docsDoColab])

  // Todos os arquivos (principal + extras) achatados para a seção Downloads.
  const arquivos = useMemo(() => {
    const out = []
    for (const d of docsDoColab) {
      if (d.arquivo_url) {
        out.push({ url: d.arquivo_url, nome: d.tipo_documento, doc: d, tipo: d.tipo_documento })
      }
      const extras = Array.isArray(d.arquivos_extras) ? d.arquivos_extras : []
      extras.forEach((a, i) => {
        if (a?.url) out.push({ url: a.url, nome: a.nome || `${d.tipo_documento} (anexo ${i + 1})`, doc: d, tipo: d.tipo_documento })
      })
    }
    return out
  }, [docsDoColab])

  function baixarTodos() {
    if (arquivos.length === 0) return
    if (!window.confirm(`Abrir ${arquivos.length} arquivo(s) em novas abas para visualizar/baixar?`)) return
    arquivos.forEach((a, i) => {
      setTimeout(() => window.open(a.url, '_blank', 'noopener,noreferrer'), i * 150)
    })
  }

  // Fecha com ESC
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!colab) return null

  return (
    <div
      className="rh-ficha-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <aside className="rh-ficha-drawer">
        <header className="rh-ficha-header">
          <div>
            <h3>{colab.nome_completo}</h3>
            <small>
              {colab.cargo || 'Sem cargo'} • {filial?.cidade || filial?.nome || `Filial ${colab.filial_id || '—'}`}
            </small>
          </div>
          <button className="button-link" onClick={onClose} type="button">✕</button>
        </header>

        <div className="rh-ficha-summary">
          <span className="rh-ficha-summary-chip vigentes">✓ {resumo.vigentes} vigentes</span>
          {resumo.alerta > 0 && (
            <span className="rh-ficha-summary-chip alerta">⏰ {resumo.alerta} vence em breve</span>
          )}
          {resumo.vencidos > 0 && (
            <span className="rh-ficha-summary-chip vencidos">🚨 {resumo.vencidos} vencidos</span>
          )}
          {resumo.pendentes > 0 && (
            <span className="rh-ficha-summary-chip pendentes">⏳ {resumo.pendentes} pendentes</span>
          )}
          <span style={{ marginLeft: 'auto' }}>
            <button
              type="button"
              className="button-primary"
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => onNovoDoc?.(colaboradorId)}
            >
              + Adicionar documento
            </button>
          </span>
        </div>

        <div className="rh-ficha-body">
          <VinculoColaboradorSection
            colaboradorId={colaboradorId}
            contratos={contratos}
            documentosColaborador={docsDoColab}
            colaboradores={colaboradores}
            filiais={filiais}
            onContratoCriado={(c) => setContratos((prev) => [...prev, c])}
            onContratosAtualizados={(patches) => {
              setContratos((prev) => prev.map((c) => {
                const found = patches.find((p) => p.id === c.id)
                return found ? { ...c, ...found.patch } : c
              }))
            }}
            onDocumentoCriado={onDocumentoCriado}
            onDocumentoAtualizado={onDocumentoAtualizado}
            onAtualizar={() => { carregarContratos(); onSyncCompleto?.() }}
          />

          {resumo.total === 0 && (
            <div className="rh-ficha-empty">
              Nenhum documento cadastrado.
              <br />
              <button
                type="button"
                className="button-link"
                onClick={() => onNovoDoc?.(colaboradorId)}
                style={{ marginTop: 8 }}
              >
                Cadastrar o primeiro
              </button>
            </div>
          )}

          {resumo.total > 0 && (
            <section className="rh-ficha-group">
              <h4 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>📥 Arquivos do colaborador ({arquivos.length})</span>
                {arquivos.length > 0 && (
                  <button
                    type="button"
                    className="button-link"
                    onClick={baixarTodos}
                    title="Abre todos os arquivos em novas abas para visualização/download"
                    style={{ fontSize: 11 }}
                  >
                    Abrir todos
                  </button>
                )}
              </h4>
              {arquivos.length === 0 ? (
                <div className="rh-ficha-arquivos-empty">
                  Nenhum PDF/foto anexado ainda. Clique em ✏ ao lado de um documento para subir o arquivo.
                </div>
              ) : (
                <ul className="rh-ficha-arquivos-list">
                  {arquivos.map((a, i) => (
                    <li key={`${a.url}-${i}`}>
                      <span className="rh-ficha-arquivo-tipo">{a.tipo}</span>
                      <span className="rh-ficha-arquivo-nome">{a.nome}</span>
                      <a href={a.url} target="_blank" rel="noreferrer" className="button-link" title="Visualizar em nova aba">👁</a>
                      <a href={a.url} download className="button-link" title="Baixar arquivo">⬇</a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {CATEGORIAS.map((cat) => {
            const lista = porCategoria.get(cat.value) || []
            if (lista.length === 0) return null
            return (
              <section key={cat.value} className="rh-ficha-group">
                <h4 style={{ color: cat.cor }}>
                  {CATEGORIA_LABELS[cat.value] || cat.value} ({lista.length})
                </h4>
                {lista.map((d) => (
                  <DocItem key={d.id} doc={d} onEditarDoc={onEditarDoc} />
                ))}
              </section>
            )
          })}

          {(porCategoria.get('__sem_categoria__') || []).length > 0 && (
            <section className="rh-ficha-group">
              <h4>Sem categoria</h4>
              {porCategoria.get('__sem_categoria__').map((d) => (
                <DocItem key={d.id} doc={d} onEditarDoc={onEditarDoc} />
              ))}
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}

function DocItem({ doc, onEditarDoc }) {
  const status = doc.status_calculado
  const extras = Array.isArray(doc.arquivos_extras) ? doc.arquivos_extras : []
  const sensivel = isTipoSensivel(doc.tipo_documento)
  return (
    <div className="rh-ficha-doc">
      <div className="rh-ficha-doc-info">
        <span className="rh-ficha-doc-tipo">
          {doc.tipo_documento}
          {sensivel && <span style={{ marginLeft: 4, fontSize: 10 }} title="Dado sensível (LGPD)">🔒</span>}
        </span>
        <span className="rh-ficha-doc-meta">
          {doc.numero_documento && (
            <>
              <SensitiveField
                value={doc.numero_documento}
                sensitive={sensivel}
                docId={doc.id}
                campo="numero_documento"
              />
              {' • '}
            </>
          )}
          {doc.data_emissao && <>Emissão: {formatarDataBr(doc.data_emissao)} </>}
          {doc.data_validade && <>• Validade: {formatarDataBr(doc.data_validade)}</>}
          {doc.dias_para_vencer != null && (
            <>
              {' • '}
              {doc.dias_para_vencer >= 0
                ? `${doc.dias_para_vencer}d para vencer`
                : `vencido há ${Math.abs(doc.dias_para_vencer)}d`}
            </>
          )}
        </span>
      </div>
      <span className={`rh-status-badge ${status}`}>{STATUS_LABELS[status] || status}</span>
      <div className="rh-ficha-doc-files">
        {doc.arquivo_url && (
          <a
            href={doc.arquivo_url}
            target="_blank"
            rel="noreferrer"
            className="button-link"
            title="Abrir arquivo principal"
            onClick={(e) => e.stopPropagation()}
          >
            📄
          </a>
        )}
        {extras.length > 0 && (
          <span title={extras.map((a) => a.nome || a.url).join('\n')} style={{ fontSize: 11 }}>
            +{extras.length}
          </span>
        )}
        <button
          type="button"
          className="button-link"
          onClick={() => onEditarDoc?.(doc)}
          title="Editar documento"
        >
          ✏
        </button>
      </div>
    </div>
  )
}

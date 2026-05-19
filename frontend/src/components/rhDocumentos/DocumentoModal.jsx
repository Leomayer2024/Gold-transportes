import { useEffect, useMemo, useState } from 'react'
import { api } from '../../services/api'
import { uploadRhDocumentFile } from '../../lib/supabase'
import {
  CATEGORIAS,
  TIPOS_DOCUMENTOS,
  findTipoCatalogo,
  calcularValidadeSugerida,
  calcularPrazoValidadeDias,
  diasAlertaSugerido,
  categoriaSugerida,
  isTipoSensivel,
  getCriaFaseContrato,
  somarDiasIso,
} from './catalogo'
import { FASE_LABELS, TIPO_VINCULO_LABELS } from '../rhContratos/catalogo'

const STATUS_OPTIONS = [
  { value: '',              label: '(automático pela validade)' },
  { value: 'vigente',       label: 'Vigente' },
  { value: 'pendente',      label: 'Pendente' },
  { value: 'vencido',       label: 'Vencido' },
  { value: 'nao_se_aplica', label: 'Não se aplica' },
]

const EMPTY = {
  colaborador_id: '',
  filial_id: '',
  categoria: '',
  tipo_documento: '',
  numero_documento: '',
  orgao_emissor: '',
  data_emissao: '',
  data_validade: '',
  dias_alerta: 30,
  arquivo_url: '',
  arquivos_extras: [],
  status: '',
  obrigatorio: false,
  observacoes: '',
  ativo: true,
}

function normalizeArquivosExtras(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
  }
  return []
}

export default function DocumentoModal({
  documento,
  defaultColaboradorId,
  colaboradores,
  filiais,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    ...(documento || {}),
    arquivos_extras: normalizeArquivosExtras(documento?.arquivos_extras),
  }))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingExtra, setUploadingExtra] = useState(false)
  const [error, setError] = useState('')
  // Quando o tipo é contratual, oferece criar/atualizar a fase do vínculo.
  // Marca por padrão apenas em criação (não em edição de doc existente).
  const [criarVinculo, setCriarVinculo] = useState(true)

  useEffect(() => {
    if (documento) {
      setForm({
        ...EMPTY,
        ...documento,
        arquivos_extras: normalizeArquivosExtras(documento?.arquivos_extras),
      })
    } else {
      setForm({
        ...EMPTY,
        colaborador_id: defaultColaboradorId || '',
        filial_id: defaultColaboradorId
          ? colaboradores.find((c) => Number(c.id) === Number(defaultColaboradorId))?.filial_id || ''
          : '',
      })
    }
  }, [documento, defaultColaboradorId, colaboradores])

  const prazoValidadeDias = useMemo(
    () => calcularPrazoValidadeDias({ data_emissao: form.data_emissao, data_validade: form.data_validade }),
    [form.data_emissao, form.data_validade],
  )

  const tiposPorCategoria = useMemo(() => {
    if (!form.categoria) return TIPOS_DOCUMENTOS
    return TIPOS_DOCUMENTOS.filter((t) => t.categoria === form.categoria)
  }, [form.categoria])

  function update(patch) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function aoMudarColaborador(value) {
    const id = Number(value)
    const colab = colaboradores.find((c) => Number(c.id) === id)
    update({ colaborador_id: value, filial_id: colab?.filial_id || form.filial_id })
  }

  function aoMudarTipo(tipo) {
    const cat = findTipoCatalogo(tipo)
    const patch = { tipo_documento: tipo }
    if (cat) {
      patch.categoria = cat.categoria
      patch.dias_alerta = cat.diasAlerta || form.dias_alerta || 30
      if (!form.obrigatorio) patch.obrigatorio = cat.obrigatorio
      // Se já tem emissão, recalcula validade típica
      if (form.data_emissao || !form.data_validade) {
        const sugerida = calcularValidadeSugerida(tipo, form.data_emissao)
        if (sugerida) patch.data_validade = sugerida
      }
    } else {
      const cs = categoriaSugerida(tipo)
      if (cs && !form.categoria) patch.categoria = cs
      const ds = diasAlertaSugerido(tipo, form.dias_alerta || 30)
      if (ds && !form.dias_alerta) patch.dias_alerta = ds
    }
    update(patch)
  }

  function aoMudarEmissao(value) {
    const patch = { data_emissao: value }
    if (form.tipo_documento && (!form.data_validade || documento == null)) {
      const sugerida = calcularValidadeSugerida(form.tipo_documento, value)
      if (sugerida) patch.data_validade = sugerida
    }
    update(patch)
  }

  function aoMudarPrazoDias(dias) {
    const num = Number(dias)
    if (!Number.isFinite(num) || num < 0) return
    const base = form.data_emissao || new Date().toISOString().slice(0, 10)
    const validade = somarDiasIso(base, num)
    const patch = { data_validade: validade }
    if (!form.data_emissao) patch.data_emissao = base
    update(patch)
  }

  async function aoEscolherArquivo(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const result = await uploadRhDocumentFile(file, {
        folder: 'documentos-rh',
        entityId: form.colaborador_id || 'geral',
      })
      update({ arquivo_url: result.url })
    } catch (e) {
      setError(e.message || 'Falha ao enviar arquivo.')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  async function aoEscolherArquivoExtra(event) {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return
    setUploadingExtra(true)
    setError('')
    try {
      const novosExtras = []
      for (const file of files) {
        const result = await uploadRhDocumentFile(file, {
          folder: 'documentos-rh',
          entityId: form.colaborador_id || 'geral',
        })
        novosExtras.push({
          url: result.url,
          nome: file.name,
          enviado_em: new Date().toISOString().slice(0, 10),
        })
      }
      update({ arquivos_extras: [...(form.arquivos_extras || []), ...novosExtras] })
    } catch (e) {
      setError(e.message || 'Falha ao enviar arquivos adicionais.')
    } finally {
      setUploadingExtra(false)
      event.target.value = ''
    }
  }

  function removerArquivoExtra(index) {
    const next = [...(form.arquivos_extras || [])]
    next.splice(index, 1)
    update({ arquivos_extras: next })
  }

  async function salvar(event) {
    event.preventDefault()
    if (!form.colaborador_id || !form.filial_id || !form.tipo_documento) {
      setError('Colaborador, filial e tipo do documento são obrigatórios.')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      colaborador_id: Number(form.colaborador_id),
      filial_id: Number(form.filial_id),
      categoria: form.categoria || null,
      tipo_documento: form.tipo_documento,
      numero_documento: form.numero_documento || null,
      orgao_emissor: form.orgao_emissor || null,
      data_emissao: form.data_emissao || null,
      data_validade: form.data_validade || null,
      dias_alerta: form.dias_alerta === '' ? null : Number(form.dias_alerta),
      arquivo_url: form.arquivo_url || null,
      arquivos_extras: form.arquivos_extras || [],
      status: form.status || null,
      obrigatorio: Boolean(form.obrigatorio),
      observacoes: form.observacoes || null,
      ativo: form.ativo !== false,
    }

    try {
      if (documento?.id) {
        await api.update('colaborador_documentos', documento.id, payload)
      } else {
        await api.create('colaborador_documentos', payload)
      }

      // Se for um tipo contratual e o usuário deixou marcado, cria a fase
      // correspondente em colaborador_contratos.
      const recipe = getCriaFaseContrato(form.tipo_documento)
      if (recipe && criarVinculo && !documento?.id) {
        try {
          await criarFaseContratoVinculo(payload, recipe)
        } catch (e) {
          // Falha ao criar contrato não derruba o doc — só avisa.
          setError(`Documento salvo, mas falha ao criar fase do vínculo contratual: ${e.message || e}`)
          setSaving(false)
          return
        }
      }

      onSaved?.()
      onClose?.()
    } catch (e) {
      setError(e.message || 'Falha ao salvar documento.')
    } finally {
      setSaving(false)
    }
  }

  async function criarFaseContratoVinculo(docPayload, recipe) {
    // Resolve vinculo_id: se reusaUltimoVinculo=true, busca o vínculo CLT
    // ativo mais recente do colaborador para encadear a fase.
    let vinculo_id = null
    if (recipe.reusaUltimoVinculo) {
      try {
        const res = await api.list('colaborador_contratos', {
          colaborador_id: docPayload.colaborador_id,
          tipo_vinculo: recipe.tipo_vinculo,
          limit: 50,
        })
        const rows = res?.data || res || []
        const ativos = rows.filter((c) => !c.data_desligamento)
        if (ativos.length > 0) {
          // pega o mais recente por data_inicio
          ativos.sort((a, b) => String(b.data_inicio || '').localeCompare(String(a.data_inicio || '')))
          vinculo_id = ativos[0].vinculo_id
        }
      } catch {
        // se falhar a busca, cria como novo vínculo
      }
    }

    // Datas: usa emissão→validade do doc se houver; senão calcula
    // baseado no duracaoDias da receita.
    const inicio = docPayload.data_emissao || new Date().toISOString().slice(0, 10)
    let fim = docPayload.data_validade || null
    if (!fim && recipe.duracaoDias) {
      // somarDiasIso(inicio, duracaoDias - 1) totaliza N dias contando o início
      fim = somarDiasIso(inicio, recipe.duracaoDias - 1)
    }
    if (recipe.fase === 'indeterminado') fim = null

    const payload = {
      colaborador_id: docPayload.colaborador_id,
      filial_id: docPayload.filial_id,
      tipo_vinculo: recipe.tipo_vinculo,
      fase: recipe.fase,
      data_inicio: inicio,
      data_fim: fim,
      ativo: true,
      observacoes: `Criado automaticamente a partir do documento "${docPayload.tipo_documento}".`,
    }
    if (vinculo_id) payload.vinculo_id = vinculo_id

    await api.create('colaborador_contratos', payload)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-card rh-doc-modal">
        <header className="modal-header">
          <h3>{documento?.id ? 'Editar documento' : 'Novo documento'}</h3>
          <button className="button-link" onClick={onClose} type="button">✕</button>
        </header>

        <form onSubmit={salvar} className="rh-doc-form">
          <div className="rh-doc-form-grid">
            <label>
              <span>Colaborador *</span>
              <select
                value={form.colaborador_id}
                onChange={(e) => aoMudarColaborador(e.target.value)}
                required
              >
                <option value="">Selecione</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome_completo}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Filial *</span>
              <select
                value={form.filial_id}
                onChange={(e) => update({ filial_id: e.target.value })}
                required
              >
                <option value="">Selecione</option>
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>{f.cidade || f.nome || `Filial ${f.id}`}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Categoria</span>
              <select value={form.categoria} onChange={(e) => update({ categoria: e.target.value })}>
                <option value="">—</option>
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Tipo do documento *</span>
              <input
                type="text"
                list="rh-doc-tipos"
                value={form.tipo_documento}
                onChange={(e) => aoMudarTipo(e.target.value)}
                placeholder="Ex.: CNH, ASO Periódico, NR-35"
                required
              />
              <datalist id="rh-doc-tipos">
                {tiposPorCategoria.map((t) => (
                  <option key={t.tipo} value={t.tipo}>{t.tipo}</option>
                ))}
              </datalist>
            </label>

            <label>
              <span>
                Número / identificação
                {isTipoSensivel(form.tipo_documento) && (
                  <small style={{ marginLeft: 6, color: 'var(--muted)' }}>🔒 sensível (LGPD)</small>
                )}
              </span>
              <input
                type={isTipoSensivel(form.tipo_documento) ? 'password' : 'text'}
                value={form.numero_documento || ''}
                onChange={(e) => update({ numero_documento: e.target.value })}
                autoComplete="off"
              />
              {findTipoCatalogo(form.tipo_documento)?.dica && (
                <small style={{ marginTop: 4, color: 'var(--muted)', fontSize: 10 }}>
                  💡 {findTipoCatalogo(form.tipo_documento).dica}
                </small>
              )}
            </label>

            <label>
              <span>Órgão emissor</span>
              <input
                type="text"
                value={form.orgao_emissor || ''}
                onChange={(e) => update({ orgao_emissor: e.target.value })}
              />
            </label>

            <label>
              <span>Data de emissão</span>
              <input
                type="date"
                value={form.data_emissao || ''}
                onChange={(e) => aoMudarEmissao(e.target.value)}
              />
            </label>

            <label>
              <span>Data de validade</span>
              <input
                type="date"
                value={form.data_validade || ''}
                onChange={(e) => update({ data_validade: e.target.value })}
              />
            </label>

            <label>
              <span>
                Prazo de validade (dias)
                {prazoValidadeDias != null && <small style={{ marginLeft: 6, color: 'var(--muted)' }}>= {prazoValidadeDias}d</small>}
              </span>
              <input
                type="number"
                min={0}
                placeholder="ex.: 365 (preenche a data sozinho)"
                value={prazoValidadeDias ?? ''}
                onChange={(e) => aoMudarPrazoDias(e.target.value)}
              />
            </label>

            <label>
              <span>Alertar antes (dias)</span>
              <input
                type="number"
                min={0}
                value={form.dias_alerta ?? ''}
                onChange={(e) => update({ dias_alerta: e.target.value })}
              />
            </label>

            <label>
              <span>Status</span>
              <select value={form.status || ''} onChange={(e) => update({ status: e.target.value })}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            <label className="rh-doc-form-checkbox">
              <input
                type="checkbox"
                checked={Boolean(form.obrigatorio)}
                onChange={(e) => update({ obrigatorio: e.target.checked })}
              />
              <span>Documento obrigatório</span>
            </label>

            <label className="rh-doc-form-checkbox">
              <input
                type="checkbox"
                checked={form.ativo !== false}
                onChange={(e) => update({ ativo: e.target.checked })}
              />
              <span>Ativo</span>
            </label>
          </div>

          <label className="rh-doc-form-full">
            <span>Arquivo principal (PDF, foto)</span>
            <div className="rh-doc-file-row">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={aoEscolherArquivo}
                disabled={uploading}
              />
              {uploading && <small>Enviando…</small>}
              {form.arquivo_url && (
                <a href={form.arquivo_url} target="_blank" rel="noreferrer" className="button-link">
                  Ver arquivo atual
                </a>
              )}
            </div>
          </label>

          <label className="rh-doc-form-full">
            <span>Arquivos adicionais (frente+verso, aditivos, anexos)</span>
            <div className="rh-doc-file-row">
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={aoEscolherArquivoExtra}
                disabled={uploadingExtra}
              />
              {uploadingExtra && <small>Enviando…</small>}
            </div>
            {form.arquivos_extras?.length > 0 && (
              <ul className="rh-doc-extras-list">
                {form.arquivos_extras.map((arq, idx) => (
                  <li key={idx}>
                    <a href={arq.url} target="_blank" rel="noreferrer">📎 {arq.nome || `arquivo ${idx + 1}`}</a>
                    <small>{arq.enviado_em}</small>
                    <button type="button" className="button-link danger" onClick={() => removerArquivoExtra(idx)}>✕</button>
                  </li>
                ))}
              </ul>
            )}
          </label>

          {!documento?.id && getCriaFaseContrato(form.tipo_documento) && (
            <div className="rh-doc-form-full rh-vincular-contrato">
              <label className="rh-doc-form-checkbox">
                <input
                  type="checkbox"
                  checked={criarVinculo}
                  onChange={(e) => setCriarVinculo(e.target.checked)}
                />
                <span>
                  🔗 Também criar fase do vínculo contratual: <strong>
                    {TIPO_VINCULO_LABELS[getCriaFaseContrato(form.tipo_documento).tipo_vinculo]}
                    {' — '}
                    {FASE_LABELS[getCriaFaseContrato(form.tipo_documento).fase]}
                  </strong>
                </span>
              </label>
              <small style={{ marginLeft: 22, color: 'var(--muted)', fontSize: 10 }}>
                {getCriaFaseContrato(form.tipo_documento).reusaUltimoVinculo
                  ? 'Encadeia ao vínculo CLT já existente do colaborador (mesmo vinculo_id).'
                  : 'Cria um novo vínculo contratual (novo vinculo_id).'}
                {' Datas usam emissão e validade do documento.'}
              </small>
            </div>
          )}

          <label className="rh-doc-form-full">
            <span>Observações</span>
            <textarea
              rows={3}
              value={form.observacoes || ''}
              onChange={(e) => update({ observacoes: e.target.value })}
              placeholder="Renovação, restrições, pendências ou contexto do documento"
            />
          </label>

          {error && <div className="alert-danger" style={{ marginTop: 8 }}>{error}</div>}

          <footer className="modal-footer">
            <button type="button" className="button-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="button-primary" disabled={saving || uploading}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

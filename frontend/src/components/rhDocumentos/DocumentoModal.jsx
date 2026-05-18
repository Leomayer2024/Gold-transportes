import { useEffect, useMemo, useState } from 'react'
import { api } from '../../services/api'
import { uploadRhDocumentFile } from '../../lib/supabase'
import {
  CATEGORIAS,
  TIPOS_DOCUMENTOS,
  findTipoCatalogo,
  calcularValidadeSugerida,
  diasAlertaSugerido,
  categoriaSugerida,
} from './catalogo'

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
  status: '',
  obrigatorio: false,
  observacoes: '',
  ativo: true,
}

export default function DocumentoModal({
  documento,
  defaultColaboradorId,
  colaboradores,
  filiais,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(documento || {}) }))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (documento) {
      setForm({ ...EMPTY, ...documento })
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
      onSaved?.()
      onClose?.()
    } catch (e) {
      setError(e.message || 'Falha ao salvar documento.')
    } finally {
      setSaving(false)
    }
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
              <span>Número / identificação</span>
              <input
                type="text"
                value={form.numero_documento || ''}
                onChange={(e) => update({ numero_documento: e.target.value })}
              />
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
            <span>Arquivo (PDF, foto)</span>
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

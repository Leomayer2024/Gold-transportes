import { useEffect, useMemo, useState } from 'react'
import { api } from '../../services/api'
import { uploadRhDocumentFile, abrirDocumentoStorage } from '../../lib/supabase'
import {
  CATEGORIAS,
  TIPOS_DOCUMENTOS,
  findTipoCatalogo,
  calcularValidadeSugerida,
  calcularPrazoValidadeDias,
  diasAlertaSugerido,
  categoriaSugerida,
  somarDiasIso,
  tipoBackend,
} from './catalogo'
import { rotuloVeiculo } from './helpers'

const STATUS_OPTIONS = [
  { value: '',                    label: '(automático pela validade)' },
  { value: 'valido',              label: 'Válido' },
  { value: 'proximo_vencimento',  label: 'Próximo do vencimento' },
  { value: 'vencido',             label: 'Vencido' },
  { value: 'em_renovacao',        label: 'Em renovação' },
]

const EMPTY = {
  veiculo_id: '',
  // categoria é virtual (não persiste — derivada do catálogo)
  categoria: '',
  tipo_documento: '',
  // tipo_documento_label é o nome canônico exibido — guarda em observações se
  // não bater com o enum do backend.
  tipo_documento_label: '',
  numero_documento: '',
  orgao_emissor: '',
  data_emissao: '',
  data_validade: '',
  prazo_renovacao_dias: 30,
  arquivo_url: '',
  status: '',
  observacoes: '',
}

export default function DocumentoModal({
  documento,
  defaultVeiculoId,
  veiculos,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    ...(documento || {}),
    tipo_documento_label: documento?.tipo_documento_label || rotuloTipoExibicao(documento),
  }))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (documento) {
      setForm({
        ...EMPTY,
        ...documento,
        tipo_documento_label: documento.tipo_documento_label || rotuloTipoExibicao(documento),
      })
    } else {
      setForm({
        ...EMPTY,
        veiculo_id: defaultVeiculoId || '',
      })
    }
  }, [documento, defaultVeiculoId])

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

  function aoMudarTipo(label) {
    const cat = findTipoCatalogo(label)
    const patch = { tipo_documento_label: label }
    if (cat) {
      patch.categoria = cat.categoria
      patch.prazo_renovacao_dias = cat.diasAlerta || form.prazo_renovacao_dias || 30
      if (form.data_emissao || !form.data_validade) {
        const sugerida = calcularValidadeSugerida(label, form.data_emissao)
        if (sugerida) patch.data_validade = sugerida
      }
    } else {
      const cs = categoriaSugerida(label)
      if (cs && !form.categoria) patch.categoria = cs
      const ds = diasAlertaSugerido(label, form.prazo_renovacao_dias || 30)
      if (ds && !form.prazo_renovacao_dias) patch.prazo_renovacao_dias = ds
    }
    update(patch)
  }

  function aoMudarEmissao(value) {
    const patch = { data_emissao: value }
    if (form.tipo_documento_label && (!form.data_validade || documento == null)) {
      const sugerida = calcularValidadeSugerida(form.tipo_documento_label, value)
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
        folder: 'documentos-veiculos',
        entityId: form.veiculo_id || 'geral',
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
    if (!form.veiculo_id || !form.tipo_documento_label) {
      setError('Veículo e tipo do documento são obrigatórios.')
      return
    }
    if (!form.data_validade) {
      setError('Informe a data de validade do documento.')
      return
    }
    setSaving(true)
    setError('')

    // Backend exige um enum específico em tipo_documento. Salvamos o enum
    // mapeado e mantemos o nome canônico nas observações para exibição.
    const enumBackend = tipoBackend(form.tipo_documento_label)
    const observacoesFinal = combinarObservacoes(form.observacoes, form.tipo_documento_label)

    const payload = {
      veiculo_id: Number(form.veiculo_id),
      tipo_documento: enumBackend,
      numero_documento: form.numero_documento || null,
      orgao_emissor: form.orgao_emissor || null,
      data_emissao: form.data_emissao || null,
      data_validade: form.data_validade,
      prazo_renovacao_dias: form.prazo_renovacao_dias === '' ? null : Number(form.prazo_renovacao_dias),
      arquivo_url: form.arquivo_url || null,
      status: form.status || null,
      observacoes: observacoesFinal,
    }

    try {
      if (documento?.id) {
        await api.update('veiculos_documentos', documento.id, payload)
      } else {
        await api.create('veiculos_documentos', payload)
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
          <h3>{documento?.id ? 'Editar documento do veículo' : 'Novo documento do veículo'}</h3>
          <button className="button-link" onClick={onClose} type="button">✕</button>
        </header>

        <form onSubmit={salvar} className="rh-doc-form">
          <div className="rh-doc-form-grid">
            <label>
              <span>Veículo *</span>
              <select
                value={form.veiculo_id}
                onChange={(e) => update({ veiculo_id: e.target.value })}
                required
              >
                <option value="">Selecione</option>
                {veiculos.map((v) => (
                  <option key={v.id} value={v.id}>{rotuloVeiculo(v)}</option>
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

            <label className="rh-doc-form-full">
              <span>Tipo do documento *</span>
              <input
                type="text"
                list="veic-doc-tipos"
                value={form.tipo_documento_label}
                onChange={(e) => aoMudarTipo(e.target.value)}
                placeholder="Ex.: CRLV, DPVAT, Tacógrafo, AET…"
                required
              />
              <datalist id="veic-doc-tipos">
                {tiposPorCategoria.map((t) => (
                  <option key={t.tipo} value={t.tipo}>{t.tipo}</option>
                ))}
              </datalist>
              <small style={{ marginTop: 4, color: 'var(--muted)', fontSize: 11 }}>
                Mapeamos automaticamente para o enum do banco: <strong>{tipoBackend(form.tipo_documento_label)}</strong>
              </small>
            </label>

            <label>
              <span>Número / identificação</span>
              <input
                type="text"
                value={form.numero_documento || ''}
                onChange={(e) => update({ numero_documento: e.target.value })}
                autoComplete="off"
              />
            </label>

            <label>
              <span>Órgão emissor</span>
              <input
                type="text"
                placeholder="Ex.: DETRAN, ANTT, INMETRO"
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
              <span>Data de validade *</span>
              <input
                type="date"
                value={form.data_validade || ''}
                onChange={(e) => update({ data_validade: e.target.value })}
                required
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
                value={form.prazo_renovacao_dias ?? ''}
                onChange={(e) => update({ prazo_renovacao_dias: e.target.value })}
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
          </div>

          <label className="rh-doc-form-full">
            <span>Arquivo digitalizado (PDF, foto)</span>
            <div className="rh-doc-file-row">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={aoEscolherArquivo}
                disabled={uploading}
              />
              {uploading && <small>Enviando…</small>}
              {form.arquivo_url && (
                <button
                  type="button"
                  className="button-link"
                  onClick={() => abrirDocumentoStorage(form.arquivo_url)}
                >
                  Ver arquivo atual
                </button>
              )}
            </div>
          </label>

          <label className="rh-doc-form-full">
            <span>Observações</span>
            <textarea
              rows={3}
              value={form.observacoes || ''}
              onChange={(e) => update({ observacoes: e.target.value })}
              placeholder="Detalhes, restrições, número de processo"
            />
          </label>

          {error && <div className="alert-danger" style={{ marginTop: 10 }}>{error}</div>}

          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="button-primary" disabled={saving || uploading}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Quando o registro vier do backend, `tipo_documento` é só o enum (ex.: 'crlv').
// Tenta inferir o nome canônico do catálogo a partir das observações (onde
// guardamos `[tipo:NomeCanônico]`) ou usa o próprio enum como fallback.
function rotuloTipoExibicao(documento) {
  if (!documento) return ''
  const marker = String(documento.observacoes || '').match(/\[tipo:([^\]]+)\]/)
  if (marker) return marker[1].trim()
  return documento.tipo_documento || ''
}

function combinarObservacoes(observacoes, tipoLabel) {
  const limpa = String(observacoes || '').replace(/\s*\[tipo:[^\]]+\]\s*/g, '').trim()
  if (!tipoLabel) return limpa || null
  const tag = `[tipo:${tipoLabel}]`
  return limpa ? `${limpa}\n${tag}` : tag
}

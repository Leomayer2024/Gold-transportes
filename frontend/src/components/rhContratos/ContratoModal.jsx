import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import {
  TIPOS_VINCULO,
  FASES_CLT,
  FASE_LABELS,
  somarDiasIso,
} from './catalogo'

const EMPTY = {
  colaborador_id: '',
  filial_id: '',
  vinculo_id: '',
  tipo_vinculo: 'clt',
  fase: 'experiencia',
  data_inicio: '',
  data_fim: '',
  data_desligamento: '',
  motivo_desligamento: '',
  cargo: '',
  salario: '',
  observacoes: '',
  ativo: true,
}

// Modal de criação/edição de contrato.
//
// Props:
//   contrato          — registro existente (edição) ou null (novo)
//   colaboradores     — lista para o select
//   filiais           — lista para o select
//   defaultColabId    — pré-seleciona o colaborador (quando aberto da ficha)
//   onClose, onSaved  — callbacks
export default function ContratoModal({
  contrato,
  colaboradores,
  filiais,
  defaultColabId,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    colaborador_id: contrato?.colaborador_id || defaultColabId || '',
    filial_id: contrato?.filial_id
      || colaboradores.find((c) => Number(c.id) === Number(defaultColabId))?.filial_id
      || '',
    ...(contrato || {}),
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (contrato) {
      setForm({ ...EMPTY, ...contrato })
    }
  }, [contrato])

  function update(patch) {
    setForm((p) => ({ ...p, ...patch }))
  }

  function aoMudarColaborador(value) {
    const colab = colaboradores.find((c) => Number(c.id) === Number(value))
    update({ colaborador_id: value, filial_id: colab?.filial_id || form.filial_id })
  }

  function aoMudarTipoVinculo(value) {
    const patch = { tipo_vinculo: value }
    if (value === 'clt') {
      patch.fase = form.fase || 'experiencia'
    } else {
      patch.fase = 'termo_unico'
    }
    update(patch)
  }

  function aoMudarInicioCLT(value) {
    const patch = { data_inicio: value }
    // Sugere data_fim automaticamente para experiencia/prorrogacao (45 dias)
    if (form.tipo_vinculo === 'clt' && (form.fase === 'experiencia' || form.fase === 'prorrogacao')) {
      const fim = somarDiasIso(value, 45 - 1) // 45 dias contando o dia inicial
      if (fim) patch.data_fim = fim
    }
    update(patch)
  }

  function aoMudarFaseClt(value) {
    const patch = { fase: value }
    if (value === 'indeterminado') {
      patch.data_fim = ''
    } else if ((value === 'experiencia' || value === 'prorrogacao') && form.data_inicio) {
      patch.data_fim = somarDiasIso(form.data_inicio, 45 - 1)
    }
    update(patch)
  }

  async function salvar(event) {
    event.preventDefault()
    if (!form.colaborador_id || !form.tipo_vinculo || !form.data_inicio) {
      setError('Colaborador, tipo de vínculo e data de início são obrigatórios.')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      colaborador_id: Number(form.colaborador_id),
      filial_id: form.filial_id ? Number(form.filial_id) : null,
      tipo_vinculo: form.tipo_vinculo,
      fase: form.fase || null,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim || null,
      data_desligamento: form.data_desligamento || null,
      motivo_desligamento: form.motivo_desligamento || null,
      cargo: form.cargo || null,
      salario: form.salario === '' || form.salario == null ? null : Number(form.salario),
      observacoes: form.observacoes || null,
      ativo: form.ativo !== false,
    }
    // vinculo_id só é enviado se existir (na criação o banco gera por DEFAULT).
    if (form.vinculo_id) payload.vinculo_id = form.vinculo_id

    try {
      if (contrato?.id) {
        await api.update('colaborador_contratos', contrato.id, payload)
      } else {
        await api.create('colaborador_contratos', payload)
      }
      onSaved?.()
      onClose?.()
    } catch (e) {
      setError(e.message || 'Falha ao salvar contrato.')
    } finally {
      setSaving(false)
    }
  }

  const isCLT = form.tipo_vinculo === 'clt'

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-card rh-doc-modal">
        <header className="modal-header">
          <h3>{contrato?.id ? 'Editar vínculo contratual' : 'Novo vínculo contratual'}</h3>
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
                disabled={Boolean(contrato?.id)}
              >
                <option value="">Selecione</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome_completo}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Filial</span>
              <select value={form.filial_id || ''} onChange={(e) => update({ filial_id: e.target.value })}>
                <option value="">—</option>
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>{f.cidade || f.nome || `Filial ${f.id}`}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Tipo de vínculo *</span>
              <select value={form.tipo_vinculo} onChange={(e) => aoMudarTipoVinculo(e.target.value)} required>
                {TIPOS_VINCULO.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>

            {isCLT ? (
              <label>
                <span>Fase</span>
                <select value={form.fase || 'experiencia'} onChange={(e) => aoMudarFaseClt(e.target.value)}>
                  {FASES_CLT.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                <span>Termo</span>
                <select value={form.fase || 'termo_unico'} onChange={(e) => update({ fase: e.target.value })}>
                  <option value="termo_unico">Termo único</option>
                  <option value="renovacao">Renovação</option>
                </select>
              </label>
            )}

            <label>
              <span>Data de início *</span>
              <input
                type="date"
                value={form.data_inicio || ''}
                onChange={(e) => isCLT ? aoMudarInicioCLT(e.target.value) : update({ data_inicio: e.target.value })}
                required
              />
            </label>

            <label>
              <span>
                Data de fim
                {isCLT && form.fase === 'indeterminado' && (
                  <small style={{ marginLeft: 6, color: 'var(--muted)' }}>(sem data fim no indeterminado)</small>
                )}
              </span>
              <input
                type="date"
                value={form.data_fim || ''}
                onChange={(e) => update({ data_fim: e.target.value })}
                disabled={isCLT && form.fase === 'indeterminado'}
              />
            </label>

            <label>
              <span>Cargo</span>
              <input
                type="text"
                value={form.cargo || ''}
                onChange={(e) => update({ cargo: e.target.value })}
              />
            </label>

            <label>
              <span>Salário (R$)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.salario ?? ''}
                onChange={(e) => update({ salario: e.target.value })}
              />
            </label>
          </div>

          {contrato?.id && (
            <fieldset style={{ border: '1px solid var(--border, #e0e4ea)', borderRadius: 6, padding: 10, marginTop: 8 }}>
              <legend style={{ fontSize: 11, color: 'var(--muted)' }}>Desligamento (opcional)</legend>
              <div className="rh-doc-form-grid">
                <label>
                  <span>Data do desligamento</span>
                  <input
                    type="date"
                    value={form.data_desligamento || ''}
                    onChange={(e) => update({ data_desligamento: e.target.value })}
                  />
                </label>
                <label>
                  <span>Motivo</span>
                  <input
                    type="text"
                    placeholder="Ex.: pedido de demissão, justa causa, fim de contrato"
                    value={form.motivo_desligamento || ''}
                    onChange={(e) => update({ motivo_desligamento: e.target.value })}
                  />
                </label>
              </div>
            </fieldset>
          )}

          <label className="rh-doc-form-full">
            <span>Observações</span>
            <textarea
              rows={3}
              value={form.observacoes || ''}
              onChange={(e) => update({ observacoes: e.target.value })}
            />
          </label>

          {error && <div className="alert-danger" style={{ marginTop: 8 }}>{error}</div>}

          <footer className="modal-footer">
            <button type="button" className="button-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="button-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

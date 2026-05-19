import { useMemo, useState } from 'react'
import { api } from '../../services/api'
import {
  TIPO_VINCULO_LABELS,
  FASE_LABELS,
  calcularStatusContrato,
  STATUS_CONTRATO_LABELS,
  podeProrrogarClt,
  calcularProximaFaseClt,
} from './catalogo'
import ContratoModal from './ContratoModal'

// Seção exibida no Drawer "Ficha do colaborador". Mostra o vínculo atual + o
// histórico de fases (CLT) ou termos (estágio/PJ/etc), com ações:
//   - Prorrogar +45 dias (CLT em experiência ou prorrogação)
//   - Tornar indeterminado (CLT após 2ª fase)
//   - Registrar desligamento
//   - Editar / criar contrato
//
// Props:
//   colaboradorId   — id do colaborador
//   contratos       — lista pré-carregada de colaborador_contratos do colab
//   colaboradores   — para passar ao modal
//   filiais         — para passar ao modal
//   onAtualizar     — callback após alterações (para recarregar)
export default function VinculoColaboradorSection({
  colaboradorId,
  contratos,
  colaboradores,
  filiais,
  onAtualizar,
}) {
  const [modalContrato, setModalContrato] = useState(null) // null | 'novo' | {...}
  const [acaoEmAndamento, setAcaoEmAndamento] = useState(false)
  const [erro, setErro] = useState('')

  // Agrupa por vinculo_id. Pega o vínculo mais recente para mostrar como "atual".
  const grupos = useMemo(() => {
    const m = new Map()
    for (const c of contratos) {
      const k = c.vinculo_id || `solo-${c.id}`
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(c)
    }
    // ordena cada grupo por data_inicio asc
    for (const lista of m.values()) {
      lista.sort((a, b) => String(a.data_inicio || '').localeCompare(String(b.data_inicio || '')))
    }
    // grupos ordenados pelo último início desc (vínculo mais recente em cima)
    return Array.from(m.values()).sort((a, b) => {
      const ax = a[a.length - 1].data_inicio || ''
      const bx = b[b.length - 1].data_inicio || ''
      return String(bx).localeCompare(String(ax))
    })
  }, [contratos])

  const vinculoAtual = grupos[0]
  const contratoAtivo = vinculoAtual?.find((c) => !c.data_desligamento && c.ativo !== false)
    || vinculoAtual?.[vinculoAtual.length - 1]
    || null

  async function prorrogarClt() {
    if (!contratoAtivo) return
    const proxima = calcularProximaFaseClt(contratoAtivo)
    if (!proxima) return
    const label = proxima.fase === 'indeterminado'
      ? 'Tornar prazo indeterminado'
      : 'Prorrogar por mais 45 dias'
    if (!window.confirm(`${label}? Será criado um novo registro de contrato.`)) return
    setAcaoEmAndamento(true)
    setErro('')
    try {
      await api.create('colaborador_contratos', {
        colaborador_id: contratoAtivo.colaborador_id,
        filial_id: contratoAtivo.filial_id,
        vinculo_id: contratoAtivo.vinculo_id, // mesma sequência
        tipo_vinculo: 'clt',
        fase: proxima.fase,
        data_inicio: proxima.data_inicio,
        data_fim: proxima.data_fim,
        cargo: contratoAtivo.cargo,
        salario: contratoAtivo.salario,
        observacoes: `Prorrogação de #${contratoAtivo.id}`,
        ativo: true,
      })
      onAtualizar?.()
    } catch (e) {
      setErro(e.message || 'Falha ao prorrogar.')
    } finally {
      setAcaoEmAndamento(false)
    }
  }

  async function registrarDesligamento() {
    if (!contratoAtivo) return
    const hoje = new Date().toISOString().slice(0, 10)
    const data = window.prompt(`Data de desligamento (AAAA-MM-DD)?`, hoje)
    if (!data) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      setErro('Data inválida. Use o formato AAAA-MM-DD.')
      return
    }
    const motivo = window.prompt('Motivo (ex.: pedido de demissão, justa causa, fim de contrato)?') || ''
    setAcaoEmAndamento(true)
    setErro('')
    try {
      // Marca TODAS as fases do mesmo vinculo_id como desligadas
      const fases = vinculoAtual.filter((c) => !c.data_desligamento)
      await Promise.all(fases.map((c) => api.update('colaborador_contratos', c.id, {
        data_desligamento: data,
        motivo_desligamento: motivo || null,
        ativo: false,
      })))
      onAtualizar?.()
    } catch (e) {
      setErro(e.message || 'Falha ao registrar desligamento.')
    } finally {
      setAcaoEmAndamento(false)
    }
  }

  return (
    <div className="rh-vinculo-section">
      <div className="rh-vinculo-header">
        <strong>Vínculo contratual</strong>
        <button
          type="button"
          className="button-secondary"
          style={{ fontSize: 11, padding: '3px 8px' }}
          onClick={() => setModalContrato('novo')}
        >
          + Novo vínculo
        </button>
      </div>

      {erro && <div className="alert-danger" style={{ marginTop: 4, fontSize: 11 }}>{erro}</div>}

      {grupos.length === 0 && (
        <div className="rh-vinculo-empty">
          Nenhum vínculo contratual registrado.
          <br />
          <button
            type="button"
            className="button-link"
            onClick={() => setModalContrato('novo')}
          >
            Cadastrar o primeiro
          </button>
        </div>
      )}

      {grupos.map((grupo, idx) => {
        const ultimo = grupo[grupo.length - 1]
        const tipo = ultimo.tipo_vinculo
        const desligado = Boolean(ultimo.data_desligamento)
        const status = calcularStatusContrato(ultimo)
        const isAtual = idx === 0
        return (
          <details
            key={grupo[0].vinculo_id || grupo[0].id}
            className={`rh-vinculo-card ${status}`}
            open={isAtual}
          >
            <summary>
              <span className="rh-vinculo-tipo">{TIPO_VINCULO_LABELS[tipo] || tipo}</span>
              {tipo === 'clt' && (
                <span className="rh-vinculo-fase">{FASE_LABELS[ultimo.fase] || ultimo.fase}</span>
              )}
              <span className={`rh-vinculo-status ${status}`}>
                {STATUS_CONTRATO_LABELS[status] || status}
              </span>
              {desligado && (
                <span style={{ color: 'var(--muted)', fontSize: 10 }}>
                  Desligado em {ultimo.data_desligamento}
                </span>
              )}
            </summary>

            <div className="rh-vinculo-detalhes">
              <table className="rh-vinculo-table">
                <thead>
                  <tr>
                    <th>Fase</th>
                    <th>Início</th>
                    <th>Fim</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.map((c) => (
                    <tr key={c.id}>
                      <td>{FASE_LABELS[c.fase] || c.fase || '—'}</td>
                      <td>{c.data_inicio || '—'}</td>
                      <td>{c.data_fim || (c.fase === 'indeterminado' ? 'sem fim' : '—')}</td>
                      <td>
                        <button
                          type="button"
                          className="button-link"
                          onClick={() => setModalContrato(c)}
                          title="Editar"
                        >
                          ✏
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {isAtual && !desligado && (
                <div className="rh-vinculo-acoes">
                  {podeProrrogarClt(contratoAtivo) && (
                    <button
                      type="button"
                      className="button-primary"
                      onClick={prorrogarClt}
                      disabled={acaoEmAndamento}
                      title={
                        contratoAtivo.fase === 'experiencia'
                          ? 'Avança para a 2ª fase (prorrogação de 45 dias)'
                          : 'Avança para prazo indeterminado'
                      }
                    >
                      {contratoAtivo.fase === 'experiencia' ? '♻ Prorrogar +45 dias' : '∞ Tornar indeterminado'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={registrarDesligamento}
                    disabled={acaoEmAndamento}
                  >
                    🚪 Registrar desligamento
                  </button>
                </div>
              )}
            </div>
          </details>
        )
      })}

      {modalContrato && (
        <ContratoModal
          contrato={modalContrato === 'novo' ? null : modalContrato}
          colaboradores={colaboradores}
          filiais={filiais}
          defaultColabId={colaboradorId}
          onClose={() => setModalContrato(null)}
          onSaved={() => { setModalContrato(null); onAtualizar?.() }}
        />
      )}
    </div>
  )
}

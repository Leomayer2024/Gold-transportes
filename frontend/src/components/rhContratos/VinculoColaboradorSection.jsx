import { useMemo, useState, useRef } from 'react'
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
//   colaboradorId          — id do colaborador
//   contratos              — lista pré-carregada de colaborador_contratos do colab
//   documentosColaborador  — docs do colab (para inativar contratual antigo)
//   colaboradores          — para passar ao modal
//   filiais                — para passar ao modal
//   onContratoCriado(c)         — notifica criação local (sem refetch)
//   onContratosAtualizados(ps)  — patches em massa de contratos
//   onDocumentoCriado(d)        — notifica novo doc na planilha
//   onDocumentoAtualizado(id,p) — patch incremental de um doc
//   onAtualizar            — fallback legacy (refetch). Só usado se nenhum
//                            callback granular for fornecido.
export default function VinculoColaboradorSection({
  colaboradorId,
  contratos,
  documentosColaborador = [],
  colaboradores,
  filiais,
  onContratoCriado,
  onContratosAtualizados,
  onDocumentoCriado,
  onDocumentoAtualizado,
  onAtualizar,
}) {
  // Estratégia de notificação:
  //  - Quando a mudança é 100% conhecida localmente (prorrogação), só os
  //    callbacks granulares são disparados — o pai aplica patches no estado.
  //  - Quando o backend cascateia (desligamento → docs viram 'nao_se_aplica'),
  //    `onAtualizar` ainda é chamado como fallback para sincronizar a UI.
  const [modalContrato, setModalContrato] = useState(null) // null | 'novo' | {...}
  const [acaoEmAndamento, setAcaoEmAndamento] = useState(false)
  const [erro, setErro] = useState('')
  // Guard síncrono: `acaoEmAndamento` é state (assíncrono) — entre dois
  // cliques rápidos no botão, o setState ainda não propagou e o `disabled`
  // não está aplicado. O ref bloqueia reentrada na hora.
  const inFlightRef = useRef(false)

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
  // Pega a ÚLTIMA fase ativa (maior data_inicio). Grupo está ordenado asc,
  // percorremos de trás para frente para achar a fase atual real
  // (ex.: contrato em "prorrogacao", não "experiencia" antiga).
  const contratoAtivo = (() => {
    if (!vinculoAtual) return null
    for (let i = vinculoAtual.length - 1; i >= 0; i--) {
      const c = vinculoAtual[i]
      if (!c.data_desligamento && c.ativo !== false) return c
    }
    return vinculoAtual[vinculoAtual.length - 1]
  })()

  async function prorrogarClt() {
    if (inFlightRef.current || acaoEmAndamento) return
    if (!contratoAtivo) return
    const proxima = calcularProximaFaseClt(contratoAtivo)
    if (!proxima) return

    // Dedup: se já existe uma fase com mesmo vinculo_id + fase + data_inicio,
    // não cria duplicata. Protege contra dois cliques que escapem do guard
    // (ex.: enter + click) e contra re-render que reabra a tela com props
    // antigas.
    const jaExiste = contratos.some((c) => (
      c.vinculo_id === contratoAtivo.vinculo_id &&
      c.fase === proxima.fase &&
      (c.data_inicio || '') === (proxima.data_inicio || '')
    ))
    if (jaExiste) {
      setErro(`Já existe uma fase ${proxima.fase} iniciando em ${proxima.data_inicio} para este vínculo. Recarregue a página se ainda não aparece.`)
      return
    }

    const label = proxima.fase === 'indeterminado'
      ? 'Efetivar (Contrato de Trabalho)'
      : 'Prorrogar por mais 45 dias'
    const tipoDoc = proxima.fase === 'indeterminado' ? 'Contrato de Trabalho' : 'Aditivo Contratual'
    if (!window.confirm(`${label}?\n\nSerá criada uma nova fase do contrato e também o registro "${tipoDoc}" na planilha de Documentos RH (sem PDF — você sobe depois).\n\nOs registros contratuais anteriores do colaborador ficarão arquivados (status "não se aplica") para não contar como vencidos na planilha.`)) return
    inFlightRef.current = true
    setAcaoEmAndamento(true)
    setErro('')
    try {
      // 1) Cria nova fase no histórico de contratos.
      const novoContratoRaw = await api.create('colaborador_contratos', {
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
      const novoContrato = novoContratoRaw?.data || novoContratoRaw
      if (novoContrato && onContratoCriado) onContratoCriado(novoContrato)

      // 2) Cria o documento espelho na planilha de Documentos RH.
      let novoDocId = null
      try {
        const novoDocRaw = await api.create('colaborador_documentos', {
          colaborador_id: contratoAtivo.colaborador_id,
          filial_id: contratoAtivo.filial_id,
          categoria: 'contratual',
          tipo_documento: tipoDoc,
          data_emissao: proxima.data_inicio,
          data_validade: proxima.data_fim || null,
          dias_alerta: proxima.fase === 'indeterminado' ? 0 : 15,
          obrigatorio: proxima.fase === 'indeterminado',
          observacoes: `Gerado automaticamente pela ${label.toLowerCase()}. Sobe o PDF assinado depois.`,
          ativo: true,
        })
        const novoDoc = novoDocRaw?.data || novoDocRaw
        if (novoDoc?.id) novoDocId = novoDoc.id
        if (novoDoc && onDocumentoCriado) onDocumentoCriado(novoDoc)
      } catch (docErr) {
        // Mostra aviso, mas não trava — a fase foi criada com sucesso.
        setErro(`Fase do contrato criada, mas falhou ao gerar o doc na planilha: ${docErr.message || docErr}. Cadastre manualmente se necessário.`)
      }

      // 3) Inativa docs contratuais anteriores DO MESMO COLABORADOR que
      //    ficaram vencidos pela prorrogação. Critério conservador:
      //      categoria === 'contratual'
      //      ativo !== false
      //      id !== novoDocId (não pisa no recém-criado)
      //      data_validade < proxima.data_inicio  (era do termo anterior)
      //
      //    Mantemos os indeterminados (sem data_validade) como estavam — não
      //    se aplica inativar um contrato vigente quando se cria outro do
      //    mesmo tipo (caso de re-emissão por correção, por exemplo).
      // Ao Efetivar (indeterminado), inativa TODOS docs contratuais com validade
      // do colaborador — o Contrato de Trabalho substitui Aditivos/Experiência.
      // Ao Prorrogar (45+45), inativa só os que já venceram antes da nova fase.
      const efetivando = proxima.fase === 'indeterminado'
      const docsParaInativar = documentosColaborador.filter((d) => (
        d.categoria === 'contratual' &&
        d.ativo !== false &&
        d.id !== novoDocId &&
        d.data_validade && (
          efetivando
            ? true
            : d.data_validade < proxima.data_inicio
        )
      ))
      if (docsParaInativar.length > 0) {
        const patches = []
        for (const d of docsParaInativar) {
          try {
            await api.update('colaborador_documentos', d.id, { ativo: false })
            patches.push({ id: d.id, patch: { ativo: false } })
          } catch (e) {
            console.error('Falha ao inativar doc contratual anterior', d.id, e)
          }
        }
        if (onDocumentoAtualizado) {
          for (const { id, patch } of patches) onDocumentoAtualizado(id, patch)
        }
      }

      // Prorrogação: nada cascateia no backend. Só chamamos refetch se o
      // caller não forneceu callbacks granulares (modo legacy).
      const usouGranular = onContratoCriado || onDocumentoCriado || onDocumentoAtualizado
      if (!usouGranular && onAtualizar) onAtualizar()
    } catch (e) {
      setErro(e.message || 'Falha ao prorrogar.')
    } finally {
      inFlightRef.current = false
      setAcaoEmAndamento(false)
    }
  }

  async function registrarDesligamento() {
    if (inFlightRef.current || acaoEmAndamento) return
    if (!contratoAtivo) return
    const hoje = new Date().toISOString().slice(0, 10)
    const data = window.prompt(`Data de desligamento (AAAA-MM-DD)?\n\nIsso também vai preencher a data de desligamento no cadastro do colaborador e arquivar os documentos RH dele.`, hoje)
    if (!data) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      setErro('Data inválida. Use o formato AAAA-MM-DD.')
      return
    }
    const motivo = window.prompt('Motivo (ex.: pedido de demissão, justa causa, fim de contrato)?') || ''
    inFlightRef.current = true
    setAcaoEmAndamento(true)
    setErro('')
    try {
      // Marca TODAS as fases do mesmo vinculo_id como desligadas
      const fases = vinculoAtual.filter((c) => !c.data_desligamento)
      const patchContrato = {
        data_desligamento: data,
        motivo_desligamento: motivo || null,
        ativo: false,
      }
      await Promise.all(fases.map((c) => api.update('colaborador_contratos', c.id, patchContrato)))
      if (onContratosAtualizados) {
        onContratosAtualizados(fases.map((c) => ({ id: c.id, patch: patchContrato })))
      }

      // Reflete no cadastro do colaborador. O backend cascateia automaticamente
      // os documentos para status 'nao_se_aplica' (não precisamos repetir aqui).
      try {
        await api.update('colaboradores', contratoAtivo.colaborador_id, {
          data_desligamento: data,
          ativo: false,
        })
      } catch (colErr) {
        // Não derruba — apenas avisa. As fases já foram encerradas.
        setErro(`Contrato encerrado, mas falhou ao atualizar o cadastro do colaborador: ${colErr.message || colErr}. Verifique manualmente.`)
      }

      // Desligamento cascateia documentos server-side. Mantemos o refetch
      // como fonte da verdade — granulares são apenas otimização paralela.
      onAtualizar?.()
    } catch (e) {
      setErro(e.message || 'Falha ao registrar desligamento.')
    } finally {
      inFlightRef.current = false
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
                          : 'Efetiva o colaborador (gera Contrato de Trabalho por prazo indeterminado)'
                      }
                    >
                      {contratoAtivo.fase === 'experiencia' ? '♻ Prorrogar +45 dias' : '✅ Efetivar'}
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

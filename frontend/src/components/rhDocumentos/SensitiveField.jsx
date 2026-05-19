import { useState } from 'react'
import { api } from '../../services/api'

// Campo com blur por padrão (LGPD). O usuário precisa clicar em "Revelar" para
// ver o conteúdo, e essa ação fica registrada na auditoria.
//
// Props:
//   value         — string a exibir
//   sensitive     — bool: ativa o blur. Se false, renderiza valor cru.
//   docId         — id do colaborador_documentos (para auditoria)
//   campo         — nome do campo revelado (para auditoria)
//   placeholder   — texto quando value está vazio (default: "—")
//   inline        — true = botão pequeno ao lado; false = bloco com botão abaixo
export default function SensitiveField({
  value,
  sensitive = true,
  docId,
  campo = 'numero_documento',
  placeholder = '—',
  inline = true,
}) {
  const [revelado, setRevelado] = useState(false)

  if (!value) return <span className="muted">{placeholder}</span>
  if (!sensitive) return <span>{value}</span>

  async function revelar(e) {
    e?.stopPropagation()
    setRevelado(true)
    if (!docId) return
    try {
      await api.create('auditoria_movimentacoes', {
        recurso: 'colaborador_documentos',
        entidade_id: String(docId),
        acao: 'revelar_dado_sensivel',
        status: 'ok',
        detalhes: { campo },
      })
    } catch {
      // Auditoria é best-effort. Falha silenciosa não bloqueia a UI.
    }
  }

  function ocultar(e) {
    e?.stopPropagation()
    setRevelado(false)
  }

  if (revelado) {
    return (
      <span className="rh-sensitive-wrapper">
        <span className="rh-sensitive-value">{value}</span>
        <button
          type="button"
          className="rh-sensitive-toggle"
          onClick={ocultar}
          title="Ocultar de novo"
        >
          🙈
        </button>
      </span>
    )
  }

  return (
    <span className="rh-sensitive-wrapper">
      <span className="rh-sensitive-blur" aria-label="Conteúdo sensível oculto">
        {'•'.repeat(Math.min(String(value).length, 12))}
      </span>
      <button
        type="button"
        className="rh-sensitive-toggle"
        onClick={revelar}
        title="Revelar (a ação fica registrada na auditoria)"
      >
        👁
      </button>
    </span>
  )
}

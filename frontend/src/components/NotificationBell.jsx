import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { enriquecerDocumento } from './rhDocumentos/helpers'
import { calcularStatusContrato, TIPO_VINCULO_LABELS } from './rhContratos/catalogo'

// Cache simples — reusa a mesma estratégia do badge da Sidebar (TTL 60s,
// invalidado por foco da janela e pelo evento global "rh-docs-changed").
const TTL_MS = 60_000
const cache = { ts: 0, items: [], colaboradores: [] }

async function fetchPendencias() {
  try {
    const [docsRes, colabsRes, contratosRes] = await Promise.all([
      api.list('colaborador_documentos', { limit: 5000 }),
      // Sem filtro 'ativo' — pra resolver o nome de colaboradores desligados também
      api.list('colaboradores', { limit: 1000 }),
      api.list('colaborador_contratos', { limit: 2000 }).catch(() => ({ data: [] })),
    ])
    const docs = (docsRes?.data || docsRes || []).filter((d) => d.ativo !== false)
    const colaboradores = colabsRes?.data || colabsRes || []
    const contratos = (contratosRes?.data || contratosRes || []).filter((c) => !c.data_desligamento)
    const enriched = docs.map((d) => enriquecerDocumento(d))

    // Pendências de documentos
    const itensDocs = enriched
      .filter((d) =>
        d.status_calculado === 'vencido' ||
        d.status_calculado === 'vence_em_breve' ||
        d.status_calculado === 'pendente',
      )
      .map((d) => ({
        kind: 'documento',
        id: `doc-${d.id}`,
        colaborador_id: d.colaborador_id,
        status: d.status_calculado,
        dias: d.dias_para_vencer,
        titulo: d.tipo_documento,
      }))

    // Pendências de contratos (último termo de cada vinculo)
    const ultimoPorVinculo = new Map()
    for (const c of contratos) {
      const k = c.vinculo_id || `solo-${c.id}`
      const ex = ultimoPorVinculo.get(k)
      if (!ex || (c.data_inicio || '') > (ex.data_inicio || '')) ultimoPorVinculo.set(k, c)
    }
    const itensContratos = Array.from(ultimoPorVinculo.values())
      .map((c) => ({ ...c, _status: calcularStatusContrato(c) }))
      .filter((c) => c._status === 'vencido' || c._status === 'vence_em_breve')
      .map((c) => {
        const hoje = new Date()
        let dias = null
        if (c.data_fim) {
          dias = Math.floor((new Date(`${c.data_fim}T00:00:00`) - hoje) / 86400000)
        }
        return {
          kind: 'contrato',
          id: `cont-${c.id}`,
          colaborador_id: c.colaborador_id,
          status: c._status,
          dias,
          titulo: `Contrato ${TIPO_VINCULO_LABELS[c.tipo_vinculo] || c.tipo_vinculo}`,
        }
      })

    const itens = [...itensDocs, ...itensContratos]
    itens.sort((a, b) => {
      const rank = { vencido: 0, vence_em_breve: 1, pendente: 2 }
      const ra = rank[a.status] ?? 9
      const rb = rank[b.status] ?? 9
      if (ra !== rb) return ra - rb
      const da = a.dias ?? Number.POSITIVE_INFINITY
      const db = b.dias ?? Number.POSITIVE_INFINITY
      return da - db
    })
    return { itens, colaboradores }
  } catch {
    return { itens: [], colaboradores: [] }
  }
}

export default function NotificationBell() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [itens, setItens] = useState(cache.items)
  const [colaboradores, setColaboradores] = useState(cache.colaboradores)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    async function refresh(force = false) {
      const now = Date.now()
      if (!force && now - cache.ts < TTL_MS && cache.items.length > 0) {
        if (!cancelled) {
          setItens(cache.items)
          setColaboradores(cache.colaboradores)
        }
        return
      }
      const { itens: itensNovos, colaboradores: colabs } = await fetchPendencias()
      cache.ts = Date.now()
      cache.items = itensNovos
      cache.colaboradores = colabs
      if (!cancelled) {
        setItens(itensNovos)
        setColaboradores(colabs)
      }
    }
    refresh()
    const onFocus = () => refresh(true)
    const onChange = () => refresh(true)
    window.addEventListener('focus', onFocus)
    window.addEventListener('rh-docs-changed', onChange)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('rh-docs-changed', onChange)
    }
  }, [profile])

  // Click fora fecha o painel
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        const isBell = e.target.closest?.('.notif-bell-fab')
        if (!isBell) setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!profile) return null

  const total = itens.length
  const colabPorId = (id) => colaboradores.find((c) => Number(c.id) === Number(id))

  function irParaTela(_item) {
    setOpen(false)
    navigate('/rh-documentos')
    // O drawer/edição direto exigiria comunicação com a página — por enquanto
    // só navega pra tela. Pode evoluir depois.
  }

  return (
    <>
      <button
        type="button"
        className="notif-bell-fab"
        onClick={() => setOpen((o) => !o)}
        title={total === 0 ? 'Sem pendências' : `${total} pendência(s)`}
        aria-label="Notificações"
      >
        🔔
        {total > 0 && (
          <span className="notif-bell-badge">{total > 99 ? '99+' : total}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel" ref={panelRef}>
          <div className="notif-panel-header">
            <h4>Pendências de documentos</h4>
            <button className="button-link" onClick={() => setOpen(false)} type="button">✕</button>
          </div>
          <div className="notif-panel-body">
            {total === 0 ? (
              <div className="notif-empty">✓ Tudo em dia. Nada a regularizar.</div>
            ) : (
              itens.slice(0, 50).map((item) => {
                const colab = colabPorId(item.colaborador_id)
                const dias = item.dias
                let descricao = ''
                if (item.status === 'vencido') {
                  descricao = `Vencido há ${Math.abs(dias ?? 0)} dia${Math.abs(dias ?? 0) === 1 ? '' : 's'}`
                } else if (item.status === 'vence_em_breve') {
                  descricao = `Vence em ${dias} dia${dias === 1 ? '' : 's'}`
                } else {
                  descricao = 'Pendente (sem validade definida)'
                }
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`notif-item ${item.status}`}
                    onClick={() => irParaTela(item)}
                  >
                    <div className="notif-item-title">
                      {item.kind === 'contrato' ? '📑 ' : ''}
                      {colab?.nome_completo || `#${item.colaborador_id}`} — {item.titulo}
                    </div>
                    <div className="notif-item-meta">{descricao}</div>
                  </button>
                )
              })
            )}
            {total > 50 && (
              <div className="notif-empty" style={{ fontSize: 10 }}>
                …e mais {total - 50} pendência(s). Abra a tela de Documentos RH para ver tudo.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

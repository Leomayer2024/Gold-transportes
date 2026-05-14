import { NavLink } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getVisibleNavigation } from '../lib/permissions'
import logoGold from '../../assets/logo_gold.png'
import packageInfo from '../../package.json'

// ─── Persistência da ordem do menu ───────────────────────────────────────────

function loadNavOrder(userId) {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(`seg-sidebar-order:${userId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveNavOrder(userId, order) {
  if (!userId) return
  try {
    localStorage.setItem(`seg-sidebar-order:${userId}`, JSON.stringify(order))
  } catch {}
}

// Aplica ordem salva sobre a navegação visível, respeitando permissões atuais
function applyOrder(visibleGroups, savedOrder) {
  if (!savedOrder) return visibleGroups
  const { groupOrder = [], groupItems = {} } = savedOrder

  const visibleByTo = {}
  for (const g of visibleGroups) {
    for (const item of g.items) visibleByTo[item.to] = item
  }

  const placed = new Set()
  const result = []

  for (const title of groupOrder) {
    const keys = groupItems[title] || []
    const items = keys
      .filter((to) => visibleByTo[to])
      .map((to) => { placed.add(to); return visibleByTo[to] })
    if (items.length > 0) result.push({ title, items })
  }

  // Itens com nova permissão não presentes no save salvo
  for (const g of visibleGroups) {
    const unplaced = g.items.filter((item) => !placed.has(item.to))
    if (!unplaced.length) continue
    const ex = result.find((r) => r.title === g.title)
    if (ex) ex.items.push(...unplaced)
    else result.push({ title: g.title, items: unplaced })
  }

  return result
}

function extractOrder(groups) {
  return {
    groupOrder: groups.map((g) => g.title),
    groupItems: Object.fromEntries(groups.map((g) => [g.title, g.items.map((i) => i.to)])),
  }
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { profile, user, signOut } = useAuth()
  const userId = user?.id
  const appVersion = `v${packageInfo.version}`
  const databaseOnline = Boolean(profile?.database_online)

  const [openGroups, setOpenGroups] = useState(() => {
    const defaults = {}
    for (const t of ['Visão geral', 'RH', 'Frota', 'Cadastros', 'Administração', 'Operação RTM', 'Compras', 'Financeiro', 'Configurações']) {
      defaults[t] = true
    }
    return defaults
  })

  const [groups, setGroups] = useState(() =>
    applyOrder(getVisibleNavigation(profile), loadNavOrder(userId)),
  )

  const [organizing, setOrganizing] = useState(false)
  const [drag, setDrag] = useState(null)      // { type:'group'|'item', title?:string, to?:string, fromGroup?:string }
  const [dropOver, setDropOver] = useState(null) // { type:'group'|'item'|'group-end', key:string }
  const dragRef = useRef(null)

  useEffect(() => {
    setGroups(applyOrder(getVisibleNavigation(profile), loadNavOrder(userId)))
  }, [profile, userId])

  const initials = (profile?.nome_completo || 'Operador')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  function persist(newGroups) {
    saveNavOrder(userId, extractOrder(newGroups))
  }

  function toggleGroup(title) {
    if (organizing) return
    setOpenGroups((c) => ({ ...c, [title]: !c[title] }))
  }

  function confirmNav(event) {
    if (!window.__SEG_HAS_PENDING_FORM_CHANGES__) return
    if (!window.confirm('Você tem informações não salvas. Deseja sair e perder os dados preenchidos?')) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  function cleanup() {
    setDrag(null)
    setDropOver(null)
    dragRef.current = null
  }

  // ─── Drag: grupos ─────────────────────────────────────────────────────────

  function startGroupDrag(e, title) {
    dragRef.current = { type: 'group', title }
    setDrag({ type: 'group', title })
    e.dataTransfer.effectAllowed = 'move'
  }

  function onGroupDragOver(e, title) {
    e.preventDefault()
    if (drag?.type !== 'group' || drag.title === title) return
    setDropOver({ type: 'group', key: title })
  }

  function onGroupDrop(e, targetTitle) {
    e.preventDefault()
    if (drag?.type !== 'group' || drag.title === targetTitle) return cleanup()
    const next = [...groups]
    const fi = next.findIndex((g) => g.title === drag.title)
    const ti = next.findIndex((g) => g.title === targetTitle)
    const [moved] = next.splice(fi, 1)
    next.splice(ti, 0, moved)
    setGroups(next)
    persist(next)
    cleanup()
  }

  // ─── Drag: itens ──────────────────────────────────────────────────────────

  function startItemDrag(e, to, fromGroup) {
    dragRef.current = { type: 'item', to, fromGroup }
    setDrag({ type: 'item', to, fromGroup })
    e.dataTransfer.effectAllowed = 'move'
    e.stopPropagation()
  }

  function onItemDragOver(e, to, groupTitle) {
    e.preventDefault()
    e.stopPropagation()
    if (drag?.type !== 'item' || drag.to === to) return
    setDropOver({ type: 'item', key: to, groupTitle })
  }

  function onGroupBodyDragOver(e, groupTitle) {
    e.preventDefault()
    if (drag?.type !== 'item') return
    setDropOver({ type: 'group-end', key: groupTitle })
  }

  function dropItemOnto(targetTo, targetGroup, insertBefore) {
    let movedItem = null
    for (const g of groups) {
      const f = g.items.find((i) => i.to === drag.to)
      if (f) { movedItem = f; break }
    }
    if (!movedItem) return cleanup()

    const next = groups.map((g) => ({ ...g, items: [...g.items] }))
    for (const g of next) g.items = g.items.filter((i) => i.to !== drag.to)

    const tg = next.find((g) => g.title === targetGroup)
    if (tg) {
      if (targetTo && insertBefore) {
        const idx = tg.items.findIndex((i) => i.to === targetTo)
        tg.items.splice(idx >= 0 ? idx : tg.items.length, 0, movedItem)
      } else {
        tg.items.push(movedItem)
      }
    }

    // Remove grupos que ficaram vazios
    const cleaned = next.filter((g) => g.items.length > 0)
    setGroups(cleaned)
    persist(cleaned)
    cleanup()
  }

  function onItemDrop(e, targetTo, targetGroup) {
    e.preventDefault()
    e.stopPropagation()
    if (drag?.type !== 'item') return cleanup()
    dropItemOnto(targetTo, targetGroup, true)
  }

  function onGroupEndDrop(e, targetGroup) {
    e.preventDefault()
    if (drag?.type !== 'item') return cleanup()
    dropItemOnto(null, targetGroup, false)
  }

  function resetOrder() {
    if (!window.confirm('Restaurar a ordem padrão do menu?')) return
    saveNavOrder(userId, null)
    setGroups(getVisibleNavigation(profile))
  }

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <img alt="Gold Transportes" className="brand-logo" src={logoGold} />
      </div>

      <nav className="nav-tree">
        <div style={{ display: 'flex', gap: 4, padding: '0 8px 4px', justifyContent: 'flex-end' }}>
          <button
            className={`button-secondary${organizing ? ' active' : ''}`}
            onClick={() => setOrganizing((o) => !o)}
            style={{ fontSize: 11, padding: '2px 8px' }}
            title={organizing ? 'Concluir reorganização' : 'Reorganizar itens do menu'}
            type="button"
          >
            {organizing ? '✓ Concluir' : '⠿ Organizar'}
          </button>
          {organizing && (
            <button
              className="button-secondary"
              onClick={resetOrder}
              style={{ fontSize: 11, padding: '2px 8px' }}
              title="Restaurar ordem padrão"
              type="button"
            >
              ↺
            </button>
          )}
        </div>

        {groups.map((group) => {
          const isDraggingGroup = drag?.type === 'group' && drag.title === group.title
          const isGroupDrop = dropOver?.type === 'group' && dropOver.key === group.title
          const isGroupEndDrop = dropOver?.type === 'group-end' && dropOver.key === group.title

          return (
            <section
              className="nav-group"
              draggable={organizing}
              key={group.title}
              onDragEnd={cleanup}
              onDragOver={organizing ? (e) => onGroupDragOver(e, group.title) : undefined}
              onDragStart={organizing ? (e) => startGroupDrag(e, group.title) : undefined}
              onDrop={organizing ? (e) => onGroupDrop(e, group.title) : undefined}
              style={{
                borderRadius: 6,
                opacity: isDraggingGroup ? 0.4 : 1,
                outline: isGroupDrop ? '2px solid var(--primary, #1a73e8)' : 'none',
                transition: 'opacity .15s',
              }}
            >
              <button
                className="nav-group-toggle"
                onClick={() => toggleGroup(group.title)}
                style={{ cursor: organizing ? 'grab' : 'pointer' }}
                type="button"
              >
                <span>
                  {organizing && <span style={{ marginRight: 5, opacity: 0.45, fontSize: 13 }}>⠿</span>}
                  {group.title}
                </span>
                <small>{openGroups[group.title] ? '−' : '+'}</small>
              </button>

              {openGroups[group.title] && (
                <div
                  className="nav-links"
                  onDragOver={organizing && drag?.type === 'item' ? (e) => onGroupBodyDragOver(e, group.title) : undefined}
                  onDrop={organizing && drag?.type === 'item' ? (e) => onGroupEndDrop(e, group.title) : undefined}
                  style={{
                    borderRadius: 4,
                    minHeight: organizing ? 20 : undefined,
                    outline: isGroupEndDrop ? '1px dashed var(--primary, #1a73e8)' : 'none',
                  }}
                >
                  {group.items.map((item) => {
                    const isDraggingItem = drag?.type === 'item' && drag.to === item.to
                    const isItemDrop = dropOver?.type === 'item' && dropOver.key === item.to

                    return (
                      <div
                        draggable={organizing}
                        key={item.to}
                        onDragEnd={cleanup}
                        onDragOver={organizing ? (e) => onItemDragOver(e, item.to, group.title) : undefined}
                        onDragStart={organizing ? (e) => startItemDrag(e, item.to, group.title) : undefined}
                        onDrop={organizing ? (e) => onItemDrop(e, item.to, group.title) : undefined}
                        style={{
                          borderTop: isItemDrop ? '2px solid var(--primary, #1a73e8)' : '2px solid transparent',
                          opacity: isDraggingItem ? 0.35 : 1,
                          transition: 'opacity .15s',
                        }}
                      >
                        <NavLink
                          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                          onClick={organizing ? (e) => e.preventDefault() : confirmNav}
                          style={{ cursor: organizing ? 'grab' : undefined }}
                          to={item.to}
                        >
                          {organizing && (
                            <span style={{ marginRight: 6, opacity: 0.4, fontSize: 12 }}>⠿</span>
                          )}
                          {item.label}
                        </NavLink>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </nav>

      <div className="sidebar-user-card">
        <div className="sidebar-user-main">
          {profile?.foto_url ? (
            <img alt={profile?.nome_completo || 'Colaborador'} className="sidebar-avatar" src={profile.foto_url} />
          ) : (
            <div className="sidebar-avatar sidebar-avatar-fallback">{initials}</div>
          )}
          <div className="sidebar-user-text">
            <strong>{profile?.nome_completo || 'Operador'}</strong>
            <span>{profile?.cargo || 'Sem cargo'}</span>
            <div className="sidebar-status-row">
              <span className={`sidebar-status-dot${databaseOnline ? ' online' : ''}`} />
              <small>{databaseOnline ? 'Online' : 'Offline'}</small>
            </div>
          </div>
        </div>

        <button
          className="sidebar-logout-button"
          onClick={(event) => {
            confirmNav(event)
            if (event.defaultPrevented) return
            signOut()
          }}
          type="button"
        >
          Sair
        </button>

        <div className="sidebar-version-watermark" title={`Versão ${appVersion}`}>
          SEG {appVersion}
        </div>
      </div>
    </aside>
  )
}


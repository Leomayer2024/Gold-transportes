import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { canCreateResource } from '../lib/permissions'
import { api } from '../services/api'

const PLATFORM_FILTER_OPTS = [
  { value: 'all',  label: 'Todos',         desc: 'Exibe todos os escopos do sistema.' },
  { value: 'app',  label: 'SEG App',       desc: 'Escopos disponíveis no aplicativo mobile (projeto SEG_APP).' },
  { value: 'web',  label: 'Apenas SEG Web',desc: 'Escopos exclusivos do sistema web (não existem no app).' },
]

const INITIAL_FLAGS = {
  permissao_app: false,
  permissao_desktop: false,
  permissao_editar: false,
  permissao_excluir: false,
  permissao_aprovar_he: false,
  ativo: true,
}

const FLAGS_LABELS = [
  ['permissao_app', 'Acesso web'],
  ['permissao_desktop', 'Acesso desktop'],
  ['permissao_editar', 'Pode editar'],
  ['permissao_excluir', 'Pode excluir'],
  ['permissao_aprovar_he', 'Pode aprovar HE'],
  ['ativo', 'Colaborador ativo'],
]


// ─── Componente reutilizável: grade de escopos ────────────────────────────────

function PlatformFilterBar({ platformFilter, onChange }) {
  const active = PLATFORM_FILTER_OPTS.find((o) => o.value === platformFilter) || PLATFORM_FILTER_OPTS[0]
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Plataforma
        </span>
        {PLATFORM_FILTER_OPTS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`button-secondary${platformFilter === opt.value ? ' active' : ''}`}
            style={{ fontSize: 12, padding: '3px 12px', borderRadius: 20 }}
            onClick={() => onChange(opt.value)}
          >
            {opt.value === 'app' && <span style={{ marginRight: 4 }}>📱</span>}
            {opt.value === 'web' && <span style={{ marginRight: 4 }}>💻</span>}
            {opt.label}
          </button>
        ))}
      </div>
      {platformFilter !== 'all' && (
        <div style={{
          padding: '7px 12px', borderRadius: 6, fontSize: 12,
          background: platformFilter === 'app' ? '#e8f5e9' : '#f0f4ff',
          color: platformFilter === 'app' ? '#2e7d32' : '#1a237e',
          border: `1px solid ${platformFilter === 'app' ? '#c8e6c9' : '#c5cae9'}`,
        }}>
          {active.desc}
          {platformFilter === 'app' && (
            <strong style={{ marginLeft: 6 }}>
              Ative o filtro &quot;SEG App&quot; para ver só o que existe no aplicativo mobile.
            </strong>
          )}
        </div>
      )}
    </div>
  )
}

// Constrói mapa: scopeName → lista de scopes que ele ativa automaticamente
function buildAutoEnableMap(scopeGroups) {
  const map = {}
  for (const group of scopeGroups) {
    for (const item of group.items || []) {
      if (item.auto_enable?.length) map[item.name] = item.auto_enable
    }
  }
  return map
}

// Constrói mapa: scopeName → label legível
function buildLabelMap(scopeGroups) {
  const map = {}
  for (const group of scopeGroups) {
    for (const item of group.items || []) map[item.name] = item.label
  }
  return map
}

// Handler de toggle com auto_enable: ao ativar um escopo, ativa também seus deps
function makeToggleHandler(setScopes, autoEnableMap) {
  return (name, checked) => {
    setScopes((prev) => {
      if (!checked) return prev.filter((x) => x !== name)
      const deps = autoEnableMap[name] || []
      return [...new Set([...prev, name, ...deps])]
    })
  }
}

// Item visual de um escopo (linha com checkbox + descrição). Usado tanto na
// coluna do App quanto na do Web.
function ScopeItem({ item, isChecked, isShared, plataforma, onToggle, labelMap }) {
  const autoLabels = (item.auto_enable || []).map((s) => labelMap[s] || s)
  return (
    <label
      className={`permissions-scope-item permissions-scope-${plataforma}${isShared ? ' shared' : ''}${isChecked ? ' active' : ''}`}
    >
      <input
        checked={isChecked}
        onChange={(e) => onToggle(item.name, e.target.checked)}
        type="checkbox"
      />
      <div>
        <div className="permissions-scope-head">
          <strong>{item.label}</strong>
          {isShared && <span className="permissions-shared-pill">↔ comum</span>}
        </div>
        <span>{item.description}</span>
        {autoLabels.length > 0 && (
          <span className="permissions-auto-enable">
            ↳ Ativa também: {autoLabels.join(', ')}
          </span>
        )}
        <small className="permissions-scope-code">{item.name}</small>
      </div>
    </label>
  )
}

// Layout em duas colunas: 📱 App (esquerda) | 💻 Web (direita).
// Escopos que valem para os dois aparecem nos dois lados (com badge "comum").
// O parâmetro platformFilter ('all'|'app'|'web') ainda é aceito para zoom em
// uma plataforma só, mas o default mostra ambas lado a lado.
function ScopeGrid({ scopeGroups, activeScopes, onToggle, platformFilter = 'all', scopeSearch = '' }) {
  const labelMap = useMemo(() => buildLabelMap(scopeGroups), [scopeGroups])

  const q = scopeSearch.trim().toLowerCase()
  const matchSearch = (item) => {
    if (!q) return true
    return [item.name, item.label, item.description].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
  }

  return (
    <>
      {scopeGroups.map((group) => {
        const appItems = []
        const webItems = []
        for (const item of group.items) {
          if (!matchSearch(item)) continue
          const platforms = item.platforms || ['web']
          if (platforms.includes('app')) appItems.push(item)
          if (platforms.includes('web')) webItems.push(item)
        }

        const showApp = platformFilter !== 'web' && appItems.length > 0
        const showWeb = platformFilter !== 'app' && webItems.length > 0
        if (!showApp && !showWeb) return null

        return (
          <div className="permissions-block" key={group.key}>
            <div className="section-title">
              <span className="eyebrow">{group.title}</span>
              <h2>{group.title}</h2>
            </div>

            <div className={`permissions-two-col${showApp && showWeb ? '' : ' single'}`}>
              {showApp && (
                <div className="permissions-col permissions-col-app">
                  <header className="permissions-col-head">
                    📱 SEG App
                    <small>{appItems.length} escopo(s)</small>
                  </header>
                  {appItems.length === 0 ? (
                    <div className="permissions-col-empty">Nenhum escopo do app neste grupo.</div>
                  ) : (
                    appItems.map((item) => {
                      const isShared = (item.platforms || ['web']).includes('web')
                      return (
                        <ScopeItem
                          key={`app-${item.name}`}
                          item={item}
                          plataforma="app"
                          isShared={isShared}
                          isChecked={activeScopes.includes(item.name)}
                          onToggle={onToggle}
                          labelMap={labelMap}
                        />
                      )
                    })
                  )}
                </div>
              )}
              {showWeb && (
                <div className="permissions-col permissions-col-web">
                  <header className="permissions-col-head">
                    💻 SEG Web (Desktop)
                    <small>{webItems.length} escopo(s)</small>
                  </header>
                  {webItems.length === 0 ? (
                    <div className="permissions-col-empty">Nenhum escopo do web neste grupo.</div>
                  ) : (
                    webItems.map((item) => {
                      const isShared = (item.platforms || ['web']).includes('app')
                      return (
                        <ScopeItem
                          key={`web-${item.name}`}
                          item={item}
                          plataforma="web"
                          isShared={isShared}
                          isChecked={activeScopes.includes(item.name)}
                          onToggle={onToggle}
                          labelMap={labelMap}
                        />
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}

// ─── Painel de preview: "o que esse usuário vê" ──────────────────────────────
// Agrupa os escopos ativos por categoria (menus, ações granulares, aprovações,
// gestão) e renderiza um resumo amigável. Ajuda a confirmar antes de salvar.

function PreviewPanel({ show, onToggle, activeScopes, activeFilialIds, filiais, scopeGroups }) {
  const allItems = useMemo(
    () => scopeGroups.flatMap((g) => (g.items || []).map((i) => ({ ...i, _group: g.title }))),
    [scopeGroups],
  )
  const labelMap = useMemo(() => Object.fromEntries(allItems.map((i) => [i.name, i])), [allItems])

  const buckets = useMemo(() => {
    const out = { menus: [], acoes: [], aprovacoes: [], outros: [] }
    for (const name of activeScopes) {
      const item = labelMap[name]
      if (!item) {
        out.outros.push({ name, label: name })
        continue
      }
      if (name.startsWith('menu.')) out.menus.push(item)
      else if (name.startsWith('action.')) out.acoes.push(item)
      else if (name.startsWith('aprovar.') || name.startsWith('analisar.')) out.aprovacoes.push(item)
      else out.outros.push(item)
    }
    return out
  }, [activeScopes, labelMap])

  const filiaisAtivas = filiais.filter((f) => activeFilialIds.includes(f.id))

  return (
    <div className="permissions-block permissions-preview">
      <button
        type="button"
        className="permissions-preview-toggle"
        onClick={onToggle}
        aria-expanded={show}
      >
        <span>👁️ Pré-visualização do que este usuário vê</span>
        <small>{show ? '▲ ocultar' : '▼ expandir'}</small>
      </button>

      {show && (
        <div className="permissions-preview-body">
          <div className="permissions-preview-summary">
            <span><strong>{buckets.menus.length}</strong> menus</span>
            <span><strong>{buckets.acoes.length}</strong> ações granulares</span>
            <span><strong>{buckets.aprovacoes.length}</strong> aprovações</span>
            <span><strong>{filiaisAtivas.length || (filiais.length === 0 ? 0 : 'todas')}</strong> filiais</span>
          </div>

          {buckets.menus.length > 0 && (
            <PreviewBucket title="🧭 Menus visíveis" items={buckets.menus} />
          )}
          {buckets.acoes.length > 0 && (
            <PreviewBucket title="🔘 Ações granulares (botões)" items={buckets.acoes} />
          )}
          {buckets.aprovacoes.length > 0 && (
            <PreviewBucket title="✅ Pode aprovar / analisar" items={buckets.aprovacoes} />
          )}
          {buckets.outros.length > 0 && (
            <PreviewBucket title="📦 Outros escopos" items={buckets.outros} />
          )}

          {filiaisAtivas.length > 0 && (
            <div className="permissions-preview-bucket">
              <div className="permissions-preview-bucket-title">🏢 Filiais</div>
              <div className="permissions-preview-chips">
                {filiaisAtivas.map((f) => (
                  <span key={f.id} className="permissions-preview-chip">{f.cidade}/{f.uf}</span>
                ))}
              </div>
            </div>
          )}

          {activeScopes.length === 0 && (
            <div className="permissions-preview-empty">
              Nenhum escopo marcado. Esse usuário não vai ver nada além da tela de login.
              <br />
              <small>(Exceção: administradores sem escopos têm acesso livre por compatibilidade.)</small>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PreviewBucket({ title, items }) {
  return (
    <div className="permissions-preview-bucket">
      <div className="permissions-preview-bucket-title">{title}</div>
      <div className="permissions-preview-chips">
        {items.map((it) => (
          <span key={it.name} className="permissions-preview-chip" title={it.description || it.name}>
            {it.label || it.name}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Aba 1: por colaborador ───────────────────────────────────────────────────

function AbaColaborador({ config, scopeGroups }) {
  const { profile, refreshProfile } = useAuth()

  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [search, setSearch] = useState('')
  const [flags, setFlags] = useState(INITIAL_FLAGS)
  const [activeScopes, setActiveScopes] = useState([])
  const [activeFilialIds, setActiveFilialIds] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [cargos, setCargos] = useState([])
  const [platformFilter, setPlatformFilter] = useState('all')
  const [scopeSearch, setScopeSearch] = useState('')
  const [showPreview, setShowPreview] = useState(true)
  // Copiar permissões de outro colaborador
  const [copying, setCopying] = useState(false)
  const [copyFromId, setCopyFromId] = useState('')

  const autoEnableMap = useMemo(() => buildAutoEnableMap(scopeGroups), [scopeGroups])
  const handleToggleScope = useMemo(() => makeToggleHandler(setActiveScopes, autoEnableMap), [autoEnableMap])

  useEffect(() => {
    api.getCargosModelos().then(setCargos).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      setFlags(INITIAL_FLAGS)
      setActiveScopes([])
      setActiveFilialIds([])
      return
    }
    let active = true
    setDetailLoading(true)
    setFeedback('')
    setError('')
    api
      .getPermissionsDetail(selectedId)
      .then((res) => {
        if (!active) return
        setDetail(res)
        setFlags({ ...INITIAL_FLAGS, ...(res.permission_flags || {}) })
        setActiveScopes(res.active_scopes || [])
        setActiveFilialIds(res.active_filial_ids || [])
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setDetailLoading(false)
      })
    return () => {
      active = false
    }
  }, [selectedId])

  const filteredCollaborators = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return config.collaborators || []
    return (config.collaborators || []).filter((c) =>
      [c.nome_completo, c.cargo].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    )
  }, [config.collaborators, search])

  function getFilialLabel(filialId) {
    const f = (config.filiais || []).find((x) => x.id === filialId)
    return f ? `${f.cidade}/${f.uf}` : '-'
  }

  async function handleCopyFrom() {
    if (!copyFromId) return
    const colab = (config.collaborators || []).find((c) => Number(c.id) === Number(copyFromId))
    if (!colab) {
      setError('Colaborador de origem não encontrado.')
      return
    }
    if (!window.confirm(
      `Copiar permissões de "${colab.nome_completo}"?\n\nIsso vai substituir os flags, escopos e bases atuais. Clique em Salvar permissões para confirmar.`,
    )) return
    try {
      const res = await api.getPermissionsDetail(copyFromId)
      setFlags({ ...INITIAL_FLAGS, ...(res.permission_flags || {}) })
      setActiveScopes(res.active_scopes || [])
      setActiveFilialIds(res.active_filial_ids || [])
      setCopying(false)
      setCopyFromId('')
      setFeedback(`Permissões de "${colab.nome_completo}" carregadas (${(res.active_scopes || []).length} escopos). Revise e clique em Salvar.`)
      setError('')
    } catch (e) {
      setError(`Falha ao carregar permissões de "${colab.nome_completo}": ${e.message}`)
    }
  }

  function handleApplyCargoModel() {
    const cargo = detail?.collaborator?.cargo
    if (!cargo) {
      setError('Este colaborador não tem cargo definido.')
      return
    }
    const modelo = cargos.find((c) => c.nome?.toLowerCase() === cargo.toLowerCase())
    if (!modelo) {
      setError(`Cargo "${cargo}" não tem modelo de permissão cadastrado. Configure na aba Cargos / Funções.`)
      return
    }
    const escopos = modelo.permissoes_padrao || []
    if (escopos.length === 0) {
      setError('O modelo deste cargo está vazio. Defina os escopos na aba Cargos / Funções.')
      return
    }
    if (
      !window.confirm(
        `Aplicar modelo do cargo "${modelo.nome}"?\n${escopos.length} escopo(s) serão carregados, substituindo os escopos atuais de telas/funções.\nClique em Salvar permissões para confirmar.`,
      )
    )
      return
    setActiveScopes(escopos)
    setFeedback(`Modelo do cargo "${modelo.nome}" aplicado (${escopos.length} escopos). Revise e clique em Salvar.`)
    setError('')
  }

  async function handleSave() {
    if (!selectedId) return
    setSaving(true)
    setFeedback('')
    setError('')
    try {
      await api.updatePermissions(selectedId, {
        permission_flags: flags,
        active_scopes: activeScopes,
        active_filial_ids: activeFilialIds,
      })
      setFeedback('Permissões atualizadas com sucesso.')
      const refreshed = await api.getPermissionsDetail(selectedId)
      setDetail(refreshed)
      setFlags({ ...INITIAL_FLAGS, ...(refreshed.permission_flags || {}) })
      setActiveScopes(refreshed.active_scopes || [])
      setActiveFilialIds(refreshed.active_filial_ids || [])
      if (selectedId === profile?.id) await refreshProfile()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-grid permissions-layout">
      {/* Lista de colaboradores */}
      <div className="surface-card form-card permissions-collaborator-card">
        <div className="section-title">
          <span className="eyebrow">Colaboradores</span>
          <h2>Selecionar usuário</h2>
        </div>
        <label className="field">
          <span>Buscar</span>
          <input onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou cargo" value={search} />
        </label>
        {filteredCollaborators.length === 0 ? (
          <div className="empty-state">Nenhum colaborador encontrado.</div>
        ) : (
          <div className="permissions-list">
            {filteredCollaborators.map((c) => (
              <button
                className={`permissions-list-item${selectedId === c.id ? ' active' : ''}`}
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                type="button"
              >
                <strong>{c.nome_completo}</strong>
                <span>{c.cargo || 'Sem cargo'}</span>
                <small>{getFilialLabel(c.filial_id)}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Editor de permissões */}
      <div className="surface-card table-card permissions-editor-card">
        <div className="section-title">
          <span className="eyebrow">Escopos</span>
          <h2>{detail?.collaborator?.nome_completo || 'Selecione um colaborador'}</h2>
        </div>

        {detailLoading ? (
          <div className="empty-state">Carregando permissões...</div>
        ) : !detail?.collaborator ? (
          <div className="empty-state">Selecione um colaborador para editar permissões.</div>
        ) : (
          <>
            <div className="detail-grid permissions-meta-grid">
              <div className="detail-field">
                <span>Cargo</span>
                <div className="readonly-box">{detail.collaborator.cargo || '-'}</div>
              </div>
              <div className="detail-field">
                <span>Filial</span>
                <div className="readonly-box">{getFilialLabel(detail.collaborator.filial_id)}</div>
              </div>
            </div>

            {/* Botões de aplicar modelo do cargo / copiar de outro colaborador */}
            <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {detail.collaborator.cargo && (
                <button className="button-secondary" onClick={handleApplyCargoModel} type="button">
                  ↓ Aplicar modelo do cargo &ldquo;{detail.collaborator.cargo}&rdquo;
                </button>
              )}
              <button
                className={`button-secondary${copying ? ' active' : ''}`}
                onClick={() => { setCopying((c) => !c); setCopyFromId('') }}
                type="button"
              >
                📋 {copying ? 'Cancelar cópia' : 'Copiar permissões de outro colaborador'}
              </button>
            </div>

            {copying && (
              <div style={{
                marginBottom: 16, padding: 10, borderRadius: 6,
                background: '#f0f4ff', border: '1px solid #c5cae9',
                display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
              }}>
                <strong style={{ fontSize: 12, color: '#1a237e' }}>Copiar de:</strong>
                <select
                  value={copyFromId}
                  onChange={(e) => setCopyFromId(e.target.value)}
                  style={{ flex: 1, minWidth: 200 }}
                >
                  <option value="">Selecione um colaborador...</option>
                  {(config.collaborators || [])
                    .filter((c) => c.id !== selectedId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome_completo}{c.cargo ? ` — ${c.cargo}` : ''}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="button-primary"
                  disabled={!copyFromId}
                  onClick={handleCopyFrom}
                  style={{ fontSize: 12, padding: '4px 12px' }}
                >
                  ↘ Copiar agora
                </button>
              </div>
            )}

            <small style={{ display: 'block', marginBottom: 12, color: 'var(--text-muted)' }}>
              Modelo do cargo substitui só os escopos. Copiar de outro colaborador substitui também flags e bases. Em ambos os casos, salve para confirmar.
            </small>


            {/* Poderes globais */}
            <div className="permissions-block">
              <div className="section-title">
                <span className="eyebrow">Poderes globais</span>
                <h2>Regras operacionais</h2>
              </div>
              <div className="permissions-checkbox-grid">
                {FLAGS_LABELS.map(([key, label]) => (
                  <label className="field checkbox-field permissions-checkbox" key={key}>
                    <input
                      checked={Boolean(flags[key])}
                      onChange={(e) => setFlags((f) => ({ ...f, [key]: e.target.checked }))}
                      type="checkbox"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Bases permitidas */}
            <div className="permissions-block">
              <div className="section-title">
                <span className="eyebrow">Bases permitidas</span>
                <h2>Escopo por filial</h2>
              </div>
              <div className="readonly-box permissions-inline-note">
                Marque as filiais que esse usuário pode consultar. Se nenhuma filial for marcada, o acesso fica sem
                recorte de base.
              </div>
              <div className="permissions-scope-grid">
                {(config.filiais || []).map((filial) => (
                  <label className="permissions-scope-item" key={`filial-${filial.id}`}>
                    <input
                      checked={activeFilialIds.includes(filial.id)}
                      onChange={(e) =>
                        setActiveFilialIds((ids) =>
                          e.target.checked ? [...new Set([...ids, filial.id])] : ids.filter((x) => x !== filial.id),
                        )
                      }
                      type="checkbox"
                    />
                    <div>
                      <strong>
                        {filial.cidade}/{filial.uf}
                      </strong>
                      <span>Libera dados e quadros desta base para o colaborador.</span>
                      <small className="permissions-scope-code">filial.{filial.id}</small>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Pré-visualização: o que este usuário vê com os escopos atuais */}
            <PreviewPanel
              show={showPreview}
              onToggle={() => setShowPreview((v) => !v)}
              activeScopes={activeScopes}
              activeFilialIds={activeFilialIds}
              filiais={config.filiais || []}
              scopeGroups={scopeGroups}
            />

            {/* Escopos de menu e funcionalidade */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '6px 0' }}>
              <input
                type="search"
                placeholder="🔍 Buscar escopo por nome, label ou descrição..."
                value={scopeSearch}
                onChange={(e) => setScopeSearch(e.target.value)}
                style={{ flex: 1, minWidth: 220, height: 28, fontSize: 12 }}
              />
              {scopeSearch && (
                <button type="button" className="button-link" onClick={() => setScopeSearch('')}>
                  ✕ limpar
                </button>
              )}
            </div>
            <PlatformFilterBar platformFilter={platformFilter} onChange={setPlatformFilter} />

            <ScopeGrid
              activeScopes={activeScopes}
              onToggle={handleToggleScope}
              scopeGroups={scopeGroups}
              platformFilter={platformFilter}
              scopeSearch={scopeSearch}
            />

            {feedback && <div className="alert-success">{feedback}</div>}
            {error && <div className="alert-error">{error}</div>}

            <div className="button-row">
              <button className="button-primary" disabled={saving} onClick={handleSave} type="button">
                {saving ? 'Salvando...' : 'Salvar permissões'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Aba 2: cargos / modelos de permissão ────────────────────────────────────

function AbaCargos({ scopeGroups }) {
  const { profile } = useAuth()
  const canCreate = canCreateResource(profile, 'cargos', 'create.cargos')

  const [cargos, setCargos] = useState([])
  const [selectedCargo, setSelectedCargo] = useState(null)
  const [cargoScopes, setCargoScopes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [platformFilter, setPlatformFilter] = useState('all')

  const autoEnableMap = useMemo(() => buildAutoEnableMap(scopeGroups), [scopeGroups])
  const handleToggleCargoScope = useMemo(() => makeToggleHandler(setCargoScopes, autoEnableMap), [autoEnableMap])

  // Formulário novo cargo
  const [showAddForm, setShowAddForm] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novaDescricao, setNovaDescricao] = useState('')
  const [adicionando, setAdicionando] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const rows = await api.getCargosModelos()
      setCargos(rows)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function handleSelectCargo(cargo) {
    setSelectedCargo(cargo)
    setCargoScopes(cargo.permissoes_padrao || [])
    setFeedback('')
    setError('')
  }

  async function handleSaveTemplate() {
    if (!selectedCargo) return
    setSaving(true)
    setFeedback('')
    setError('')
    try {
      await api.update('cargos', selectedCargo.id, { permissoes_padrao: cargoScopes })
      setFeedback(
        `Modelo de "${selectedCargo.nome}" salvo com ${cargoScopes.length} escopo(s). Use "Aplicar modelo" na aba Por colaborador.`,
      )
      setCargos((prev) =>
        prev.map((c) => (c.id === selectedCargo.id ? { ...c, permissoes_padrao: cargoScopes } : c)),
      )
      setSelectedCargo((c) => ({ ...c, permissoes_padrao: cargoScopes }))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddCargo(e) {
    e.preventDefault()
    if (!novoNome.trim()) return
    setAdicionando(true)
    setError('')
    try {
      const criado = await api.create('cargos', {
        nome: novoNome.trim(),
        descricao: novaDescricao.trim() || null,
        permissoes_padrao: [],
        ativo: true,
      })
      await load()
      setNovoNome('')
      setNovaDescricao('')
      setShowAddForm(false)
      if (criado?.id) {
        setSelectedCargo({ ...criado, permissoes_padrao: [] })
        setCargoScopes([])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setAdicionando(false)
    }
  }

  async function handleToggleAtivo(cargo) {
    setError('')
    try {
      await api.update('cargos', cargo.id, { ativo: !cargo.ativo })
      await load()
      if (selectedCargo?.id === cargo.id) setSelectedCargo(null)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page-grid permissions-layout">
      {/* Lista de cargos */}
      <div className="surface-card form-card permissions-collaborator-card">
        <div
          className="section-title"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <div>
            <span className="eyebrow">Funções</span>
            <h2>Cargos cadastrados</h2>
          </div>
          {canCreate && (
            <button
              className="button-primary"
              onClick={() => setShowAddForm((v) => !v)}
              style={{ fontSize: 13, padding: '5px 12px', whiteSpace: 'nowrap' }}
              type="button"
            >
              {showAddForm ? '✕ Cancelar' : '+ Novo'}
            </button>
          )}
        </div>

        {showAddForm && canCreate && (
          <form onSubmit={handleAddCargo} style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label className="field">
              <span>Nome do cargo *</span>
              <input
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex.: Motorista"
                required
                value={novoNome}
              />
            </label>
            <label className="field">
              <span>Descrição</span>
              <input
                onChange={(e) => setNovaDescricao(e.target.value)}
                placeholder="Opcional"
                value={novaDescricao}
              />
            </label>
            <button
              className="button-primary"
              disabled={adicionando}
              style={{ alignSelf: 'flex-start' }}
              type="submit"
            >
              {adicionando ? 'Criando...' : 'Criar cargo'}
            </button>
          </form>
        )}

        {error && !selectedCargo && <div className="alert-error" style={{ marginBottom: 8 }}>{error}</div>}

        {loading ? (
          <div className="empty-state">Carregando...</div>
        ) : cargos.length === 0 ? (
          <div className="empty-state">Nenhum cargo cadastrado. Clique em &quot;+ Novo&quot; para começar.</div>
        ) : (
          <div className="permissions-list">
            {cargos.map((c) => (
              <button
                className={`permissions-list-item${selectedCargo?.id === c.id ? ' active' : ''}`}
                key={c.id}
                onClick={() => handleSelectCargo(c)}
                style={{ opacity: c.ativo ? 1 : 0.5 }}
                type="button"
              >
                <strong>{c.nome}</strong>
                {c.descricao && <span style={{ fontSize: 12 }}>{c.descricao}</span>}
                <small>
                  {(c.permissoes_padrao?.length ?? 0)} escopo(s) no modelo{!c.ativo && ' · Inativo'}
                </small>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Editor do modelo */}
      <div className="surface-card table-card permissions-editor-card">
        {!selectedCargo ? (
          <>
            <div className="section-title">
              <span className="eyebrow">Modelo de permissões</span>
              <h2>Selecione um cargo</h2>
            </div>
            <div className="empty-state">
              Selecione um cargo à esquerda para definir as permissões padrão. Ao cadastrar um colaborador neste cargo,
              você poderá aplicar o modelo com um clique na aba &quot;Por colaborador&quot;.
            </div>
          </>
        ) : (
          <>
            <div
              className="section-title"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}
            >
              <div>
                <span className="eyebrow">Modelo padrão</span>
                <h2>{selectedCargo.nome}</h2>
                {selectedCargo.descricao && (
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>{selectedCargo.descricao}</p>
                )}
              </div>
              {canCreate && (
                <button
                  className="button-secondary"
                  onClick={() => handleToggleAtivo(selectedCargo)}
                  style={{
                    fontSize: 12,
                    padding: '4px 10px',
                    color: selectedCargo.ativo ? '#c62828' : '#2e7d32',
                  }}
                  type="button"
                >
                  {selectedCargo.ativo ? 'Inativar cargo' : 'Reativar cargo'}
                </button>
              )}
            </div>

            <div className="readonly-box permissions-inline-note" style={{ marginBottom: 12 }}>
              Defina quais telas e funções este cargo terá por padrão. Cada colaborador pode ter permissões
              personalizadas além do modelo — o modelo é apenas um ponto de partida reutilizável.
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className="button-secondary"
                onClick={() => setCargoScopes(scopeGroups.flatMap((g) => g.items.map((i) => i.name)))}
                style={{ fontSize: 12 }}
                type="button"
              >
                Selecionar tudo
              </button>
              <button
                className="button-secondary"
                onClick={() => setCargoScopes([])}
                style={{ fontSize: 12 }}
                type="button"
              >
                Limpar tudo
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {cargoScopes.length} escopo(s) selecionado(s)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Plataforma:</span>
              {PLATFORM_FILTER_OPTS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`button-secondary${platformFilter === opt.value ? ' active' : ''}`}
                  style={{ fontSize: 12, padding: '3px 10px' }}
                  onClick={() => setPlatformFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <ScopeGrid
              activeScopes={cargoScopes}
              onToggle={handleToggleCargoScope}
              scopeGroups={scopeGroups}
              platformFilter={platformFilter}
            />

            {feedback && <div className="alert-success">{feedback}</div>}
            {error && <div className="alert-error">{error}</div>}

            <div className="button-row">
              <button
                className="button-primary"
                disabled={saving || !canCreate}
                onClick={handleSaveTemplate}
                type="button"
              >
                {saving ? 'Salvando modelo...' : 'Salvar modelo do cargo'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Aba 3: configuração de workflows de aprovação ───────────────────────────

const TIPO_ICONS = {
  manutencoes:    '🔧',
  pedidos_compra: '📦',
  horas_extras:   '⏰',
}

function AprovadoresSelector({ scopeName, label, allCollaborators, onToggle }) {
  const [colabIds, setColabIds] = useState(null) // null = loading
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [localChanges, setLocalChanges] = useState({}) // colabId → true/false

  useEffect(() => {
    if (!scopeName) return
    setColabIds(null)
    setLocalChanges({})
    api.permissoesPorEscopo(scopeName)
      .then((r) => setColabIds(new Set(r.collab_ids || [])))
      .catch(() => setColabIds(new Set()))
  }, [scopeName])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (allCollaborators || []).filter(
      (c) => !q || c.nome_completo?.toLowerCase().includes(q) || c.cargo?.toLowerCase().includes(q)
    )
  }, [allCollaborators, search])

  function hasScope(colabId) {
    if (localChanges[colabId] !== undefined) return localChanges[colabId]
    return colabIds?.has(colabId) ?? false
  }

  function toggle(colabId, checked) {
    setLocalChanges((prev) => ({ ...prev, [colabId]: checked }))
  }

  async function saveChanges() {
    setSaving(true)
    try {
      const entries = Object.entries(localChanges)
      await Promise.all(
        entries.map(([id, ativo]) => api.toggleEscopo(Number(id), scopeName, ativo))
      )
      const refreshed = await api.permissoesPorEscopo(scopeName)
      setColabIds(new Set(refreshed.collab_ids || []))
      setLocalChanges({})
      if (onToggle) onToggle()
    } catch (err) {
      alert('Erro ao salvar: ' + (err.message || 'Falha'))
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = Object.keys(localChanges).length > 0

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <strong style={{ fontSize: 13 }}>{label}</strong>
          <small style={{ marginLeft: 8, fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: 11 }}>{scopeName}</small>
        </div>
        {hasChanges && (
          <button className="button-primary" style={{ fontSize: 12, padding: '3px 12px' }} onClick={saveChanges} disabled={saving} type="button">
            {saving ? 'Salvando...' : `Salvar (${Object.keys(localChanges).length} alterações)`}
          </button>
        )}
      </div>
      <input
        className="field"
        type="text"
        placeholder="Buscar por nome ou cargo..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 8, fontSize: 12 }}
      />
      {colabIds === null ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>Carregando...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflow: 'auto', borderRadius: 6, border: '1px solid var(--border, #e5e5e5)', padding: '4px 0' }}>
          {filtered.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 12px' }}>Nenhum colaborador encontrado.</div>
          )}
          {filtered.map((c) => {
            const checked = hasScope(c.id)
            const changed = localChanges[c.id] !== undefined
            return (
              <label
                key={c.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', cursor: 'pointer',
                  background: checked ? 'rgba(74,144,226,0.06)' : 'transparent',
                  borderLeft: changed ? '3px solid #f59e0b' : '3px solid transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggle(c.id, e.target.checked)}
                  style={{ flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: checked ? 600 : 400, fontSize: 13 }}>{c.nome_completo}</span>
                  {c.cargo && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{c.cargo}</span>}
                </div>
                {checked && !changed && <span style={{ fontSize: 10, color: '#2e7d32', fontWeight: 700 }}>✓ Aprovador</span>}
                {changed && <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>pendente</span>}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AbaAprovacoes({ scopeGroups, config }) {
  const [configs, setConfigs]       = useState([])
  const [selectedRt, setSelectedRt] = useState(null)
  const [form, setForm]             = useState({})
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [feedback, setFeedback]     = useState('')
  const [error, setError]           = useState('')

  const allCollaborators = useMemo(() => config?.collaborators || [], [config])

  const menuScopes = useMemo(
    () => scopeGroups.flatMap((g) => g.items.filter((i) => i.name.startsWith('menu.'))),
    [scopeGroups],
  )
  const approvalScopes = useMemo(
    () => scopeGroups.flatMap((g) => g.items.filter((i) => i.name.startsWith('aprovar.') || i.name.startsWith('analisar.'))),
    [scopeGroups],
  )

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await api.getApprovalConfigs()
      setConfigs(res.items || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(cfg) {
    setSelectedRt(cfg.resource_type)
    setForm({ ...cfg, pending_statuses_str: (cfg.pending_statuses || []).join(', ') })
    setFeedback('')
    setError('')
  }

  async function handleSave() {
    setSaving(true)
    setFeedback('')
    setError('')
    try {
      const payload = {
        view_scope:                 form.view_scope,
        approval_scope:             form.approval_scope,
        pending_statuses:           form.pending_statuses_str.split(',').map((s) => s.trim()).filter(Boolean),
        approved_status:            form.approved_status,
        rejected_status:            form.rejected_status,
        require_comment_on_approve: Boolean(form.require_comment_on_approve),
        require_comment_on_reject:  Boolean(form.require_comment_on_reject),
        ativo:                      Boolean(form.ativo),
      }
      await api.updateApprovalConfig(selectedRt, payload)
      setFeedback('Configuração salva com sucesso.')
      const fresh = await api.getApprovalConfigs()
      setConfigs(fresh.items || [])
      const updated = (fresh.items || []).find((c) => c.resource_type === selectedRt)
      if (updated) handleSelect(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function field(label, hint, children) {
    return (
      <label className="field">
        <span>{label}</span>
        {hint && <small style={{ color: 'var(--text-muted)' }}>{hint}</small>}
        {children}
      </label>
    )
  }

  return (
    <div className="page-grid permissions-layout">
      {/* Lista de processos */}
      <div className="surface-card form-card permissions-collaborator-card">
        <div className="section-title">
          <span className="eyebrow">Processos</span>
          <h2>Tipos de aprovação</h2>
        </div>
        <div className="readonly-box permissions-inline-note">
          Selecione um processo para configurar quem aprova e gerenciar aprovadores designados.
        </div>
        {loading ? (
          <div className="empty-state">Carregando...</div>
        ) : error && configs.length === 0 ? (
          <div className="alert-error">{error}</div>
        ) : (
          <div className="permissions-list">
            {configs.map((cfg) => (
              <button
                key={cfg.resource_type}
                className={`permissions-list-item${selectedRt === cfg.resource_type ? ' active' : ''}`}
                onClick={() => handleSelect(cfg)}
                style={{ opacity: cfg.ativo ? 1 : 0.5 }}
                type="button"
              >
                <strong>{TIPO_ICONS[cfg.resource_type] || '📋'} {cfg.label}</strong>
                <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{cfg.approval_scope}</span>
                <small>{cfg.ativo ? '● Ativo' : '○ Inativo'}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="surface-card table-card permissions-editor-card">
        {!selectedRt ? (
          <>
            <div className="section-title">
              <span className="eyebrow">Configuração</span>
              <h2>Selecione um processo</h2>
            </div>
            <div className="empty-state">Clique em um processo à esquerda para editar.</div>
          </>
        ) : (
          <>
            <div className="section-title">
              <span className="eyebrow">Workflow</span>
              <h2>{TIPO_ICONS[selectedRt] || '📋'} {form.label}</h2>
              <small style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{selectedRt}</small>
            </div>

            {/* ── Aprovadores designados ── */}
            <div className="permissions-block">
              <div className="section-title">
                <span className="eyebrow">Pessoas</span>
                <h2>Aprovadores designados</h2>
              </div>
              <div className="readonly-box permissions-inline-note" style={{ marginBottom: 12 }}>
                Marque os colaboradores que podem atuar como aprovadores neste processo. Isso concede o escopo de permissão correspondente diretamente.
              </div>

              {selectedRt === 'pedidos_compra' && (
                <AprovadoresSelector
                  scopeName="analisar.pedidos_compra"
                  label="Analistas (pendente → análise)"
                  allCollaborators={allCollaborators}
                />
              )}

              <AprovadoresSelector
                scopeName={form.approval_scope}
                label={selectedRt === 'pedidos_compra' ? 'Aprovadores (análise → aprovado)' : 'Aprovadores'}
                allCollaborators={allCollaborators}
              />
            </div>

            {/* ── Escopos ── */}
            <div className="permissions-block">
              <div className="section-title">
                <span className="eyebrow">Acesso</span>
                <h2>Escopos de permissão</h2>
              </div>
              <div className="detail-grid permissions-meta-grid">
                {field(
                  'Escopo de visualização',
                  'Quem pode VER as solicitações na tela de Acompanhamento',
                  <select value={form.view_scope || ''} onChange={(e) => setForm((f) => ({ ...f, view_scope: e.target.value }))}>
                    {menuScopes.map((s) => <option key={s.name} value={s.name}>{s.name} — {s.label}</option>)}
                    {!menuScopes.find((s) => s.name === form.view_scope) && form.view_scope && (
                      <option value={form.view_scope}>{form.view_scope}</option>
                    )}
                  </select>,
                )}
                {field(
                  'Escopo de aprovação',
                  'Quem pode APROVAR ou REJEITAR',
                  <select value={form.approval_scope || ''} onChange={(e) => setForm((f) => ({ ...f, approval_scope: e.target.value }))}>
                    {approvalScopes.map((s) => <option key={s.name} value={s.name}>{s.name} — {s.label}</option>)}
                    {!approvalScopes.find((s) => s.name === form.approval_scope) && form.approval_scope && (
                      <option value={form.approval_scope}>{form.approval_scope}</option>
                    )}
                  </select>,
                )}
              </div>
            </div>

            {/* ── Status ── */}
            <div className="permissions-block">
              <div className="section-title">
                <span className="eyebrow">Status</span>
                <h2>Fluxo de aprovação</h2>
              </div>
              <div className="readonly-box permissions-inline-note">
                Define quais status uma solicitação tem enquanto aguarda aprovação.
              </div>
              <div className="detail-grid permissions-meta-grid">
                {field('Status que aguardam aprovação', 'Separar por vírgula',
                  <input value={form.pending_statuses_str || ''} onChange={(e) => setForm((f) => ({ ...f, pending_statuses_str: e.target.value }))} placeholder="pendente_aprovacao" />)}
                {field('Status ao APROVAR', '',
                  <input value={form.approved_status || ''} onChange={(e) => setForm((f) => ({ ...f, approved_status: e.target.value }))} placeholder="aprovado" />)}
                {field('Status ao REJEITAR', '',
                  <input value={form.rejected_status || ''} onChange={(e) => setForm((f) => ({ ...f, rejected_status: e.target.value }))} placeholder="reprovado" />)}
              </div>
            </div>

            {/* ── Regras ── */}
            <div className="permissions-block">
              <div className="section-title">
                <span className="eyebrow">Regras</span>
                <h2>Obrigatoriedade e visibilidade</h2>
              </div>
              <div className="permissions-checkbox-grid">
                {[
                  ['require_comment_on_approve', 'Exigir comentário ao aprovar'],
                  ['require_comment_on_reject', 'Exigir motivo ao rejeitar'],
                  ['ativo', 'Processo ativo na tela de Acompanhamento'],
                ].map(([key, label]) => (
                  <label key={key} className="field checkbox-field permissions-checkbox">
                    <input type="checkbox" checked={Boolean(form[key])} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {feedback && <div className="alert-success">{feedback}</div>}
            {error && <div className="alert-error">{error}</div>}

            <div className="button-row">
              <button className="button-primary" disabled={saving} onClick={handleSave} type="button">
                {saving ? 'Salvando...' : 'Salvar configuração do workflow'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('colaborador')
  const [config, setConfig] = useState({ collaborators: [], filiais: [], scope_groups: [] })
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    api
      .getPermissionsConfig()
      .then((res) => {
        if (active) {
          setConfig(res)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setErrorMessage(err.message)
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  const scopeGroups = useMemo(() => config.scope_groups || [], [config.scope_groups])

  if (loading) {
    return (
      <section className="page-shell">
        <div className="surface-card empty-state">
          <p>Carregando...</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Administração</span>
          <h1>Permissões</h1>
          <p>Controle de telas, menus e poderes operacionais por colaborador e por cargo.</p>
        </div>
      </div>

      {errorMessage && <div className="alert-error">{errorMessage}</div>}

      {/* Abas de navegação */}
      <div className="surface-card colaboradores-shell-tabs" style={{ marginBottom: 18 }}>
        <button
          className={`button-secondary${activeTab === 'colaborador' ? ' active' : ''}`}
          onClick={() => setActiveTab('colaborador')}
          type="button"
        >
          Por colaborador
        </button>
        <button
          className={`button-secondary${activeTab === 'cargos' ? ' active' : ''}`}
          onClick={() => setActiveTab('cargos')}
          type="button"
        >
          Cargos / Funções
        </button>
        {profile?.is_super_admin && (
          <button
            className={`button-secondary${activeTab === 'aprovacoes' ? ' active' : ''}`}
            onClick={() => setActiveTab('aprovacoes')}
            type="button"
          >
            Aprovações
          </button>
        )}
      </div>

      {activeTab === 'colaborador' && <AbaColaborador config={config} scopeGroups={scopeGroups} />}
      {activeTab === 'cargos' && <AbaCargos scopeGroups={scopeGroups} />}
      {activeTab === 'aprovacoes' && profile?.is_super_admin && <AbaAprovacoes scopeGroups={scopeGroups} config={config} />}
    </section>
  )
}

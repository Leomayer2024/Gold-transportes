import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { canCreateResource } from '../lib/permissions'
import { api } from '../services/api'

const PLATFORM_FILTER_OPTS = [
  { value: 'all', label: 'Todos' },
  { value: 'app', label: 'App' },
  { value: 'web', label: 'Somente Web' },
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

// Escopos que podem não vir do backend (retro-compatibilidade)
const EXTRA_SCOPE_GROUPS = [
  {
    key: 'operacao_rtm',
    title: 'Operação RTM',
    items: [
      {
        name: 'menu.presenca',
        label: 'Menu Presença',
        platforms: ['web', 'app'],
        description: 'Libera a tela de presença no grupo Operação RTM do menu lateral.',
      },
      {
        name: 'manage.presenca',
        label: 'Modificar presença',
        platforms: ['web', 'app'],
        description: 'Permite alterar e salvar o quadro diário de presença dos colaboradores.',
      },
    ],
  },
  {
    key: 'rh',
    title: 'RH',
    items: [
      {
        name: 'menu.quadro_funcionarios',
        label: 'Quadro de funcionários',
        platforms: ['web', 'app'],
        description: 'Libera a visão consolidada da equipe por base, com totais e status diários.',
      },
    ],
  },
]

// ─── Componente reutilizável: grade de escopos ────────────────────────────────

function ScopeGrid({ scopeGroups, activeScopes, onToggle, platformFilter = 'all' }) {
  const visibleGroups = useMemo(() => {
    if (platformFilter === 'all') return scopeGroups
    return scopeGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const platforms = item.platforms || ['web']
          if (platformFilter === 'app') return platforms.includes('app')
          if (platformFilter === 'web') return !platforms.includes('app')
          return true
        }),
      }))
      .filter((group) => group.items.length > 0)
  }, [scopeGroups, platformFilter])

  return (
    <>
      {visibleGroups.map((group) => (
        <div className="permissions-block" key={group.key}>
          <div className="section-title">
            <span className="eyebrow">{group.title}</span>
            <h2>{group.title}</h2>
          </div>
          {group.key === 'operacao_rtm' && (
            <div className="readonly-box permissions-inline-note">
              Para liberar a operação diária, marque pelo menos Menu Presença. Para permitir edição e salvamento do
              quadro, marque também Modificar presença.
            </div>
          )}
          <div className="permissions-scope-grid">
            {group.items.map((item) => {
              const isApp = (item.platforms || ['web']).includes('app')
              return (
                <label className="permissions-scope-item" key={item.name}>
                  <input
                    checked={activeScopes.includes(item.name)}
                    onChange={(e) => onToggle(item.name, e.target.checked)}
                    type="checkbox"
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong>{item.label}</strong>
                      {isApp && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                          background: '#e8f5e9', color: '#2e7d32', letterSpacing: '0.02em',
                        }}>App</span>
                      )}
                    </div>
                    <span>{item.description}</span>
                    <small className="permissions-scope-code">{item.name}</small>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      ))}
    </>
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

            {/* Botão de aplicar modelo do cargo */}
            {detail.collaborator.cargo && (
              <div style={{ marginBottom: 16 }}>
                <button className="button-secondary" onClick={handleApplyCargoModel} type="button">
                  ↓ Aplicar modelo do cargo &ldquo;{detail.collaborator.cargo}&rdquo;
                </button>
                <small style={{ display: 'block', marginTop: 4, color: 'var(--text-muted)' }}>
                  Substitui os escopos de telas/funções pelo modelo padrão configurado para este cargo. Salve para
                  confirmar.
                </small>
              </div>
            )}

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

            {/* Escopos de menu e funcionalidade */}
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
              activeScopes={activeScopes}
              onToggle={(name, checked) =>
                setActiveScopes((s) => (checked ? [...new Set([...s, name])] : s.filter((x) => x !== name)))
              }
              scopeGroups={scopeGroups}
              platformFilter={platformFilter}
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
              onToggle={(name, checked) =>
                setCargoScopes((s) => (checked ? [...new Set([...s, name])] : s.filter((x) => x !== name)))
              }
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
  manutencoes:   '🔧',
  pedidos_compra: '📦',
  horas_extras:  '⏰',
}

function AbaAprovacoes({ scopeGroups }) {
  const [configs, setConfigs]     = useState([])
  const [selectedRt, setSelectedRt] = useState(null)
  const [form, setForm]           = useState({})
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [feedback, setFeedback]   = useState('')
  const [error, setError]         = useState('')

  const menuScopes = useMemo(
    () => scopeGroups.flatMap((g) => g.items.filter((i) => i.name.startsWith('menu.'))),
    [scopeGroups],
  )
  const approvalScopes = useMemo(
    () => scopeGroups.flatMap((g) => g.items.filter((i) => i.name.startsWith('aprovar.'))),
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
    setForm({
      ...cfg,
      pending_statuses_str: (cfg.pending_statuses || []).join(', '),
    })
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
          Selecione um processo para configurar quem aprova, quais status são usados e se ele aparece na tela de
          Acompanhamento.
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
                <strong>
                  {TIPO_ICONS[cfg.resource_type] || '📋'} {cfg.label}
                </strong>
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
            <div className="empty-state">
              Clique em um processo à esquerda para editar suas regras de aprovação.
            </div>
          </>
        ) : (
          <>
            <div className="section-title">
              <span className="eyebrow">Workflow</span>
              <h2>
                {TIPO_ICONS[selectedRt] || '📋'} {form.label}
              </h2>
              <small style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{selectedRt}</small>
            </div>

            {/* Escopos */}
            <div className="permissions-block">
              <div className="section-title">
                <span className="eyebrow">Acesso</span>
                <h2>Escopos de permissão</h2>
              </div>
              <div className="detail-grid permissions-meta-grid">
                {field(
                  'Escopo de visualização',
                  'Quem pode VER as solicitações na tela de Acompanhamento',
                  <select
                    value={form.view_scope || ''}
                    onChange={(e) => setForm((f) => ({ ...f, view_scope: e.target.value }))}
                  >
                    {menuScopes.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name} — {s.label}
                      </option>
                    ))}
                    {!menuScopes.find((s) => s.name === form.view_scope) && form.view_scope && (
                      <option value={form.view_scope}>{form.view_scope}</option>
                    )}
                  </select>,
                )}
                {field(
                  'Escopo de aprovação',
                  'Quem pode APROVAR ou REJEITAR',
                  <select
                    value={form.approval_scope || ''}
                    onChange={(e) => setForm((f) => ({ ...f, approval_scope: e.target.value }))}
                  >
                    {approvalScopes.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name} — {s.label}
                      </option>
                    ))}
                    {!approvalScopes.find((s) => s.name === form.approval_scope) && form.approval_scope && (
                      <option value={form.approval_scope}>{form.approval_scope}</option>
                    )}
                  </select>,
                )}
              </div>
            </div>

            {/* Status */}
            <div className="permissions-block">
              <div className="section-title">
                <span className="eyebrow">Status</span>
                <h2>Fluxo de aprovação</h2>
              </div>
              <div className="readonly-box permissions-inline-note">
                Define quais status uma solicitação tem enquanto aguarda aprovação e para qual status ela vai após ser
                aprovada ou rejeitada.
              </div>
              <div className="detail-grid permissions-meta-grid">
                {field(
                  'Status que aguardam aprovação',
                  'Separar por vírgula — ex.: pendente, pendente_aprovacao',
                  <input
                    value={form.pending_statuses_str || ''}
                    onChange={(e) => setForm((f) => ({ ...f, pending_statuses_str: e.target.value }))}
                    placeholder="pendente_aprovacao"
                  />,
                )}
                {field(
                  'Status ao APROVAR',
                  '',
                  <input
                    value={form.approved_status || ''}
                    onChange={(e) => setForm((f) => ({ ...f, approved_status: e.target.value }))}
                    placeholder="aprovado"
                  />,
                )}
                {field(
                  'Status ao REJEITAR',
                  '',
                  <input
                    value={form.rejected_status || ''}
                    onChange={(e) => setForm((f) => ({ ...f, rejected_status: e.target.value }))}
                    placeholder="reprovado"
                  />,
                )}
              </div>
            </div>

            {/* Regras */}
            <div className="permissions-block">
              <div className="section-title">
                <span className="eyebrow">Regras</span>
                <h2>Obrigatoriedade e visibilidade</h2>
              </div>
              <div className="permissions-checkbox-grid">
                <label className="field checkbox-field permissions-checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(form.require_comment_on_approve)}
                    onChange={(e) => setForm((f) => ({ ...f, require_comment_on_approve: e.target.checked }))}
                  />
                  <span>Exigir comentário ao aprovar</span>
                </label>
                <label className="field checkbox-field permissions-checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(form.require_comment_on_reject)}
                    onChange={(e) => setForm((f) => ({ ...f, require_comment_on_reject: e.target.checked }))}
                  />
                  <span>Exigir motivo ao rejeitar</span>
                </label>
                <label className="field checkbox-field permissions-checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(form.ativo)}
                    onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                  />
                  <span>Processo ativo na tela de Acompanhamento</span>
                </label>
              </div>
            </div>

            {feedback && <div className="alert-success">{feedback}</div>}
            {error && <div className="alert-error">{error}</div>}

            <div className="button-row">
              <button className="button-primary" disabled={saving} onClick={handleSave} type="button">
                {saving ? 'Salvando...' : 'Salvar configuração'}
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

  // Mescla escopos do backend com extras legados
  const scopeGroups = useMemo(() => {
    const groups = config.scope_groups || []
    const knownScopes = new Set(groups.flatMap((g) => g.items.map((i) => i.name)))
    const extras = EXTRA_SCOPE_GROUPS.filter((eg) => eg.items.some((i) => !knownScopes.has(i.name)))
    return [...groups, ...extras]
  }, [config.scope_groups])

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
        <button
          className={`button-secondary${activeTab === 'aprovacoes' ? ' active' : ''}`}
          onClick={() => setActiveTab('aprovacoes')}
          type="button"
        >
          Aprovações
        </button>
      </div>

      {activeTab === 'colaborador' && <AbaColaborador config={config} scopeGroups={scopeGroups} />}
      {activeTab === 'cargos' && <AbaCargos scopeGroups={scopeGroups} />}
      {activeTab === 'aprovacoes' && <AbaAprovacoes scopeGroups={scopeGroups} />}
    </section>
  )
}

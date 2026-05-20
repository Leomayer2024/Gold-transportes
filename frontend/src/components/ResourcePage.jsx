import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useAuth } from '../context/AuthContext'
import { canCreateResource } from '../lib/permissions'
import { uploadRhDocumentFile } from '../lib/supabase'
import { api } from '../services/api'

const EMPTY_RELATIONS = {}
const EMPTY_FORCED_MAP = {}
const BONIFICACAO_LOCKED_FIELDS = new Set([
  'codigo_rubrica',
  'modo_calculo',
  'base_dias',
  'valor_mensal',
  'valor_unitario',
  'teto_mensal',
  'desconta_faltas',
  'desconta_eventos',
  'ordem',
  'observacoes',
])
const PROJECTED_DAILY_LOCKED_FIELDS = new Set([
  'codigo_rubrica',
  'modo_calculo',
  'base_dias',
  'valor_mensal',
])

function currentMonthInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function normalizeBenefitToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function isBonificacaoBenefit(formState) {
  const tipo = normalizeBenefitToken(formState?.tipo_beneficio)
  const rubrica = normalizeBenefitToken(formState?.codigo_rubrica).toUpperCase()
  return tipo === 'bonificacao' || rubrica === 'BONUS'
}

function isProjectedDailyBenefit(formState) {
  const tipo = normalizeBenefitToken(formState?.tipo_beneficio)
  return ['vale_transporte', 'ajuda_custo', 'vale_alimentacao', 'vale_refeicao'].includes(tipo)
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0))
}

function formatMonthLabel(value) {
  const raw = String(value || '').trim()
  if (!raw) {
    return '-'
  }

  const match = raw.match(/^(\d{4})-(\d{2})/)
  if (!match) {
    return raw
  }
  return `${match[2]}/${match[1]}`
}

function areMapsEqual(left = {}, right = {}) {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  return leftKeys.every((key) => left[key] === right[key])
}

function normalizeInitialState(fields) {
  return fields.reduce((accumulator, field) => {
    if (field.type === 'checkbox') {
      accumulator[field.name] = Boolean(field.defaultValue)
      return accumulator
    }
    accumulator[field.name] = field.defaultValue ?? ''
    return accumulator
  }, {})
}

function normalizeFilterState(filters = []) {
  return filters.reduce((accumulator, filter) => {
    accumulator[filter.name] = filter.defaultValue ?? ''
    return accumulator
  }, {})
}

function normalizeAutoFillOverrides(fields, locked = false) {
  return fields.reduce((accumulator, field) => {
    if (field.autoFill) {
      accumulator[field.name] = locked
    }
    return accumulator
  }, {})
}

function normalizeComparableValue(field, value) {
  if (field.type === 'checkbox') {
    return Boolean(value)
  }
  return value ?? ''
}

function buildFormStateFromItem(fields, item) {
  return fields.reduce((accumulator, field) => {
    accumulator[field.name] = normalizeComparableValue(field, item[field.name])
    return accumulator
  }, {})
}

function isFormDirty(fields, currentState, baselineState) {
  return fields.some((field) => {
    const currentValue = normalizeComparableValue(field, currentState[field.name])
    const baselineValue = normalizeComparableValue(field, baselineState[field.name])
    return currentValue !== baselineValue
  })
}

function resolveAutoFillValue(field, formState, relations) {
  if (!field.autoFill) {
    return formState[field.name]
  }

  const relationRows = relations[field.autoFill.relation] || []
  const triggerValue = formState[field.autoFill.triggerField]
  const relationItem = relationRows.find((entry) => String(entry.id) === String(triggerValue))
  if (!relationItem) {
    return formState[field.name]
  }

  const nextValue = relationItem[field.autoFill.sourceField]
  return nextValue ?? formState[field.name]
}

function applyAutoFill(fields, formState, changedFieldName, relations, manualOverrides) {
  let nextFormState = formState

  for (const field of fields) {
    if (!field.autoFill || field.autoFill.triggerField !== changedFieldName || manualOverrides[field.name]) {
      continue
    }

    const nextValue = resolveAutoFillValue(field, nextFormState, relations)
    if (nextValue !== nextFormState[field.name]) {
      nextFormState = {
        ...nextFormState,
        [field.name]: nextValue,
      }
    }
  }

  return nextFormState
}

function relationOptionLabel(field, item) {
  if (!item) {
    return ''
  }
  if (field.optionLabel) {
    return item[field.optionLabel] || ''
  }
  return item.nome_completo || item.nome || item.descricao || String(item.id)
}

function filterRelationRowsByDependency(rows, field, currentState) {
  if (!field.dependsOn) {
    return rows
  }

  const parentValue = currentState[field.dependsOn]
  if (parentValue === '' || parentValue === null || parentValue === undefined) {
    return field.requireDependsOn ? [] : rows
  }

  const relationFieldName = field.dependsOnRelationField || field.dependsOn
  return rows.filter((item) => String(item[relationFieldName]) === String(parentValue))
}

function fieldMatchesCondition(field, currentState, condition) {
  if (!condition || !condition.field) {
    return true
  }

  const currentValue = currentState?.[condition.field]
  if (Object.prototype.hasOwnProperty.call(condition, 'equals')) {
    return String(currentValue ?? '') === String(condition.equals)
  }
  if (Array.isArray(condition.in)) {
    return condition.in.map((item) => String(item)).includes(String(currentValue ?? ''))
  }
  if (condition.notEmpty === true) {
    return currentValue !== '' && currentValue !== null && currentValue !== undefined
  }
  if (condition.isEmpty === true) {
    return currentValue === '' || currentValue === null || currentValue === undefined
  }
  return true
}

function isFieldVisible(field, currentState) {
  if (!field.visibleWhen) {
    return true
  }
  return fieldMatchesCondition(field, currentState, field.visibleWhen)
}

function isFieldRequired(field, currentState) {
  if (field.requiredWhen) {
    return fieldMatchesCondition(field, currentState, field.requiredWhen)
  }
  return Boolean(field.required)
}

function resolveStatusTone(value) {
  const normalized = String(value || '').toLowerCase()
  if (['sim', 'ativo', 'ok', 'presente', 'concluido', 'concluído', 'vigente', 'aprovado', 'efetivado'].includes(normalized)) {
    return 'success'
  }
  if (['nao', 'não', 'inativo', 'error', 'erro', 'falta', 'cancelado'].includes(normalized)) {
    return 'danger'
  }
  if (['pendente', 'planejado', 'em_andamento', 'em andamento', 'manutencao', 'manutenção', 'folga', 'atestado', 'afastado', 'vence_em_breve', 'alerta'].includes(normalized)) {
    return 'warning'
  }
  return 'neutral'
}

function formatValue(item, column, relations) {
  if (column.type === 'currency') {
    return formatCurrency(item[column.key])
  }

  if (column.type === 'month') {
    return formatMonthLabel(item[column.key])
  }

  if (column.type === 'boolean') {
    const label = item[column.key] ? 'Sim' : 'Não'
    return <span className={`status-chip tone-${resolveStatusTone(label)}`}>{label}</span>
  }

  if (column.relation) {
    const relationRows = relations[column.relation] || []
    const relationItem = relationRows.find((entry) => String(entry.id) === String(item[column.key]))
    if (!relationItem) {
      return item[column.key] ?? '-'
    }

    if (column.optionLabel) {
      return relationItem[column.optionLabel] || '-'
    }

    return relationItem.nome_completo || relationItem.nome || relationItem.descricao || relationItem.id
  }

  if (column.key === 'filial_id') {
    const filial = relations.filiais?.find((relation) => String(relation.id) === String(item.filial_id))
    return filial ? `${filial.cidade}/${filial.uf}` : item.filial_id || '-'
  }

  const rawValue = item[column.key] ?? '-'
  if (typeof rawValue === 'string' && rawValue !== '-') {
    const tone = resolveStatusTone(rawValue)
    if (tone !== 'neutral') {
      return <span className={`status-chip tone-${tone}`}>{rawValue}</span>
    }
  }

  return rawValue
}

function normalizeForcedMap(source = {}) {
  return Object.entries(source).reduce((accumulator, [key, value]) => {
    if (value !== '' && value !== null && value !== undefined) {
      accumulator[key] = value
    }
    return accumulator
  }, {})
}

export default function ResourcePage({
  config,
  embedded = false,
  forcedFilters = EMPTY_FORCED_MAP,
  forcedFormValues = EMPTY_FORCED_MAP,
  onSelectedItemChange,
  onSaved,
}) {
  const { profile } = useAuth()
  const initialState = useMemo(() => normalizeInitialState(config.fields), [config.fields])
  const normalizedForcedFormValues = useMemo(() => normalizeForcedMap(forcedFormValues), [forcedFormValues])
  const initialStateWithForced = useMemo(
    () => ({ ...initialState, ...normalizedForcedFormValues }),
    [initialState, normalizedForcedFormValues],
  )
  const initialFilterState = useMemo(() => normalizeFilterState(config.filters || []), [config.filters])
  const normalizedForcedFilters = useMemo(() => normalizeForcedMap(forcedFilters), [forcedFilters])
  const initialFilterStateWithForced = useMemo(
    () => ({ ...initialFilterState, ...normalizedForcedFilters }),
    [initialFilterState, normalizedForcedFilters],
  )
  const initialAutoFillOverrides = useMemo(() => normalizeAutoFillOverrides(config.fields), [config.fields])
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)
  const [relations, setRelations] = useState(EMPTY_RELATIONS)
  const [formState, setFormState] = useState(initialStateWithForced)
  const [draftFormState, setDraftFormState] = useState(initialStateWithForced)
  const [filterState, setFilterState] = useState(initialFilterStateWithForced)
  const [manualAutoFillOverrides, setManualAutoFillOverrides] = useState(initialAutoFillOverrides)
  const [selectSearchState, setSelectSearchState] = useState({})
  const [filterSelectSearchState, setFilterSelectSearchState] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [editingBaselineState, setEditingBaselineState] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [activePanel, setActivePanel] = useState('form')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const _loaded = useRef(false)
  const [uploadingFields, setUploadingFields] = useState({})
  const [importing, setImporting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [debugOverlayMessage, setDebugOverlayMessage] = useState('')
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [bonusPreviewValue, setBonusPreviewValue] = useState(0)
  const [bonusPreviewMonth] = useState(() => currentMonthInputValue())
  const [bonusPreviewLoading, setBonusPreviewLoading] = useState(false)
  const isBonificacaoMode = config.resource === 'colaborador_beneficios' && isBonificacaoBenefit(formState)
  const isProjectedDailyMode = config.resource === 'colaborador_beneficios' && isProjectedDailyBenefit(formState)
  const isConsultPanel = activePanel === 'consult'
  const isViewingDetails = Boolean(isConsultPanel && selectedItem && !editingId)
  const canCreate = canCreateResource(profile, config.resource, config.createScope)
  const canEdit = Boolean(profile?.permissions?.edit || profile?.permissions?.approve_he)
  const canDelete = Boolean(profile?.permissions?.delete) || canCreate
  const showActions = canEdit || canDelete
  const hasUploadingField = Object.values(uploadingFields).some(Boolean)
  const hasImporter = Boolean(config.importer && ['colaboradores', 'veiculos'].includes(config.resource))
  const importerApi = config.resource === 'veiculos' ? api.importVeiculos : api.importCollaborators
  const importerAcceptExcel = Boolean(config.importer?.acceptsExcel)
  const importerAcceptAttr = importerAcceptExcel
    ? '.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
    : '.csv,text/csv'
  const importerEntityLabel = config.resource === 'veiculos' ? 'veículos' : 'colaboradores'
  const isEditingDirty = useMemo(
    () =>
      Boolean(
        editingId && editingBaselineState && isFormDirty(config.fields, formState, editingBaselineState),
      ),
    [config.fields, editingBaselineState, editingId, formState],
  )
  const isDraftDirty = useMemo(
    () => (!editingId ? isFormDirty(config.fields, formState, initialStateWithForced) : isFormDirty(config.fields, draftFormState, initialStateWithForced)),
    [config.fields, draftFormState, editingId, formState, initialStateWithForced],
  )
  const shouldWarnAboutPendingChanges = !saving && (isEditingDirty || isDraftDirty || hasUploadingField)

  const formFields = useMemo(
    () => config.fields.filter((field) => !(editingId && field.createOnly) && isFieldVisible(field, formState)),
    [config.fields, editingId, formState],
  )

  useEffect(() => {
    if (!isBonificacaoMode) {
      return
    }

    setFormState((current) => {
      const nextState = {
        ...current,
        codigo_rubrica: 'BONUS',
        modo_calculo: 'fixo_mensal',
        base_dias: 'presenca',
        valor_mensal: 0,
        valor_unitario: 0,
        teto_mensal: '',
        desconta_faltas: false,
        desconta_eventos: false,
        ordem: 0,
      }

      if (!nextState.observacoes) {
        nextState.observacoes = 'Valor calculado automaticamente na tela de bonificação mensal.'
      }

      return areMapsEqual(current, nextState) ? current : nextState
    })
  }, [isBonificacaoMode])

  useEffect(() => {
    if (!isProjectedDailyMode) {
      return
    }

    setFormState((current) => {
      const tipo = normalizeBenefitToken(current?.tipo_beneficio)
      const rubricaByType = {
        vale_transporte: 'VT',
        ajuda_custo: 'AJUDA',
        vale_alimentacao: 'VA',
        vale_refeicao: 'VA',
      }

      const nextState = {
        ...current,
        codigo_rubrica: rubricaByType[tipo] || current.codigo_rubrica,
        modo_calculo: 'por_dia',
        base_dias: 'escala',
        valor_mensal: 0,
      }

      return areMapsEqual(current, nextState) ? current : nextState
    })
  }, [isProjectedDailyMode])

  useEffect(() => {
    if (editingId || !isBonificacaoMode) {
      return
    }

    setDraftFormState((current) => {
      const nextState = {
        ...current,
        codigo_rubrica: 'BONUS',
        modo_calculo: 'fixo_mensal',
        base_dias: 'presenca',
        valor_mensal: 0,
        valor_unitario: 0,
        teto_mensal: '',
        desconta_faltas: false,
        desconta_eventos: false,
        ordem: 0,
      }

      if (!nextState.observacoes) {
        nextState.observacoes = 'Valor calculado automaticamente na tela de bonificação mensal.'
      }

      return areMapsEqual(current, nextState) ? current : nextState
    })
  }, [editingId, isBonificacaoMode])

  useEffect(() => {
    let active = true

    async function loadBonificacaoPreview() {
      if (!isBonificacaoMode || !formState.colaborador_id) {
        setBonusPreviewValue(0)
        return
      }

      setBonusPreviewLoading(true)
      try {
        const response = await api.getBonificacaoBoard({
          mes: bonusPreviewMonth,
          ...(formState.filial_id ? { filial_id: formState.filial_id } : {}),
        })

        if (!active) {
          return
        }

        const collaboratorId = Number(formState.colaborador_id)
        const collaboratorTotal = (response?.summary?.collaborator_totals || []).find(
          (item) => Number(item.colaborador_id) === collaboratorId,
        )

        setBonusPreviewValue(Number(collaboratorTotal?.total || 0))
      } catch {
        if (active) {
          setBonusPreviewValue(0)
        }
      } finally {
        if (active) {
          setBonusPreviewLoading(false)
        }
      }
    }

    void loadBonificacaoPreview()

    return () => {
      active = false
    }
  }, [bonusPreviewMonth, formState.colaborador_id, formState.filial_id, isBonificacaoMode])

  const detailFields = useMemo(
    () => config.fields.filter((field) => field.showInDetails !== false),
    [config.fields],
  )

  const filterFields = useMemo(() => config.filters || [], [config.filters])

  useEffect(() => {
    setFormState((current) => (areMapsEqual(current, initialStateWithForced) ? current : initialStateWithForced))
    setDraftFormState((current) => (areMapsEqual(current, initialStateWithForced) ? current : initialStateWithForced))
    setManualAutoFillOverrides(initialAutoFillOverrides)
    setEditingBaselineState(null)
    setActivePanel('form')
  }, [initialAutoFillOverrides, initialStateWithForced])

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!shouldWarnAboutPendingChanges) {
        return
      }
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [shouldWarnAboutPendingChanges])

  useEffect(() => {
    window.__SEG_HAS_PENDING_FORM_CHANGES__ = shouldWarnAboutPendingChanges

    return () => {
      window.__SEG_HAS_PENDING_FORM_CHANGES__ = false
    }
  }, [shouldWarnAboutPendingChanges])

  useEffect(() => {
    setFilterState((current) => (areMapsEqual(current, initialFilterStateWithForced) ? current : initialFilterStateWithForced))
    setPage(1)
  }, [initialFilterStateWithForced])

  useEffect(() => {
    setFormState((current) => {
      let nextFormState = current

      for (const field of config.fields) {
        if (!field.autoFill || manualAutoFillOverrides[field.name]) {
          continue
        }

        const triggerValue = nextFormState[field.autoFill.triggerField]
        if (triggerValue === '' || triggerValue === null || triggerValue === undefined) {
          continue
        }

        const nextValue = resolveAutoFillValue(field, nextFormState, relations)
        if (nextValue !== nextFormState[field.name]) {
          nextFormState = {
            ...nextFormState,
            [field.name]: nextValue,
          }
        }
      }

      return nextFormState
    })
  }, [config.fields, manualAutoFillOverrides, relations])

  useEffect(() => {
    let active = true

    async function load() {
      if (!_loaded.current) setLoading(true)
      setErrorMessage('')

      try {
        const relationFields = [...config.fields, ...(config.filters || []), ...(config.columns || [])]
          .filter((field) => field.relation)
        const relationNames = [...new Set(relationFields.map((field) => field.relation))]
        const activeFilters = Object.entries(filterState).reduce((accumulator, [key, value]) => {
          if (value !== '' && value !== null && value !== undefined) {
            accumulator[key] = value
          }
          return accumulator
        }, {})
        Object.assign(activeFilters, normalizedForcedFilters)

        const [mainResponse, ...relationResponses] = await Promise.all([
          api.list(config.resource, { ...activeFilters, page }),
          ...relationNames.map((relationName) => api.list(relationName)),
        ])

        if (!active) {
          return
        }

        const loadedItems = Array.isArray(mainResponse) ? mainResponse : (mainResponse?.data || [])
        const paginationMeta = Array.isArray(mainResponse) ? null : (mainResponse?.pagination || null)

        const nextRelations = relationNames.reduce((accumulator, relationName, index) => {
          const rel = relationResponses[index]
          accumulator[relationName] = Array.isArray(rel) ? rel : (rel?.data || [])
          return accumulator
        }, {})

        setItems(loadedItems)
        setPagination(paginationMeta)
        setRelations(nextRelations)
      } catch (error) {
        if (active) {
          setErrorMessage(error.message)
        }
      } finally {
        if (active) {
          _loaded.current = true
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [config, filterState, normalizedForcedFilters, page])

  useEffect(() => {
    if (!onSelectedItemChange) {
      return
    }
    onSelectedItemChange(selectedItem)
  }, [onSelectedItemChange, selectedItem])

  function resetForm() {
    setEditingId(null)
    setEditingBaselineState(null)
    setSelectedItem(null)
    setFormState(initialStateWithForced)
    setDraftFormState(initialStateWithForced)
    setManualAutoFillOverrides(initialAutoFillOverrides)
    setSelectSearchState({})
    setActivePanel('form')
  }

  function confirmDiscardChanges(message) {
    if (!shouldWarnAboutPendingChanges) {
      return true
    }
    return window.confirm(message)
  }

  function openFormPanel() {
    if (editingId && isEditingDirty) {
      const confirmed = confirmDiscardChanges('Você tem alterações não salvas na edição atual. Deseja descartá-las e voltar para Novo registro?')
      if (!confirmed) {
        return
      }
    }

    setActivePanel('form')
    setEditingId(null)
    setEditingBaselineState(null)
    setManualAutoFillOverrides(initialAutoFillOverrides)
    setFormState(draftFormState)
    setFeedback('')
    setErrorMessage('')
  }

  function openConsultPanel() {
    if (editingId && isEditingDirty) {
      const confirmed = confirmDiscardChanges('Você tem alterações não salvas na edição atual. Deseja descartá-las e voltar para Consultar/Editar?')
      if (!confirmed) {
        return
      }
      setEditingId(null)
      setEditingBaselineState(null)
      setFormState(draftFormState)
      setManualAutoFillOverrides(initialAutoFillOverrides)
    }

    setActivePanel('consult')
    setFeedback('')
    setErrorMessage('')
  }

  function formatFieldValue(field, value) {
    if (field.type === 'checkbox') {
      return value ? 'Sim' : 'Não'
    }

    if (field.type === 'select') {
      if (field.relation) {
        const options = relations[field.relation] || []
        const found = options.find((item) => String(item.id) === String(value))
        if (!found) {
          return value || '-'
        }
        return field.optionLabel ? found[field.optionLabel] : found.nome_completo
      }

      const option = (field.options || []).find((item) => String(item.value) === String(value))
      return option?.label || value || '-'
    }

    if (field.type === 'file') {
      return value || '-'
    }

    return value || '-'
  }

  function setFieldUploading(fieldName, isUploading) {
    setUploadingFields((current) => ({
      ...current,
      [fieldName]: isUploading,
    }))
  }

  async function handleFileUpload(field, file) {
    if (!file) {
      return
    }

    setFieldUploading(field.name, true)
    setFeedback('')
    setErrorMessage('')

    try {
      const entityIdField = field.upload?.entityIdField
      const entityId = entityIdField ? formState[entityIdField] : undefined
      const uploaded = await uploadRhDocumentFile(file, {
        folder: field.upload?.folder || config.resource,
        entityId,
      })

      setFormState((current) => ({
        ...current,
        [field.name]: uploaded.url,
      }))
      setFeedback('Arquivo enviado com sucesso.')
    } catch (error) {
      setErrorMessage(error.message || 'Falha ao enviar arquivo.')
    } finally {
      setFieldUploading(field.name, false)
    }
  }

  function handleChange(field, value) {
    const transformedValue = field.transform === 'uppercase' && typeof value === 'string' ? value.toUpperCase() : value
    const normalizedValue = field.type === 'checkbox' ? Boolean(transformedValue) : transformedValue
    const nextManualOverrides = field.autoFill
      ? {
          ...manualAutoFillOverrides,
          [field.name]: true,
        }
      : manualAutoFillOverrides

    if (field.autoFill) {
      setManualAutoFillOverrides(nextManualOverrides)
    }

    setFormState((current) => {
      const nextState = applyAutoFill(
        config.fields,
        {
          ...current,
          [field.name]: normalizedValue,
        },
        field.name,
        relations,
        nextManualOverrides,
      )

      const dependentFields = config.fields.filter((candidate) => candidate.dependsOn === field.name)
      let nextStateWithDependencies = nextState
      for (const dependentField of dependentFields) {
        const currentDependentValue = nextStateWithDependencies[dependentField.name]
        if (currentDependentValue === '' || currentDependentValue === null || currentDependentValue === undefined) {
          continue
        }

        const relationRows = relations[dependentField.relation] || []
        const filteredRows = filterRelationRowsByDependency(relationRows, dependentField, nextStateWithDependencies)
        const valueStillAvailable = filteredRows.some((item) => String(item.id) === String(currentDependentValue))
        if (!valueStillAvailable) {
          nextStateWithDependencies = {
            ...nextStateWithDependencies,
            [dependentField.name]: '',
          }
          setSelectSearchState((currentSearch) => ({
            ...currentSearch,
            [dependentField.name]: '',
          }))
        }
      }

      if (!editingId) {
        setDraftFormState(nextStateWithDependencies)
      }

      return nextStateWithDependencies
    })
  }

  function handleFilterChange(filter, value) {
    if (Object.prototype.hasOwnProperty.call(normalizedForcedFilters, filter.name)) {
      return
    }

    setFilterState((current) => {
      let nextState = {
        ...current,
        [filter.name]: value,
      }

      const dependentFilters = filterFields.filter((candidate) => candidate.dependsOn === filter.name)
      for (const dependentFilter of dependentFilters) {
        const currentDependentValue = nextState[dependentFilter.name]
        if (currentDependentValue === '' || currentDependentValue === null || currentDependentValue === undefined) {
          continue
        }

        const relationRows = relations[dependentFilter.relation] || []
        const filteredRows = filterRelationRowsByDependency(relationRows, dependentFilter, nextState)
        const valueStillAvailable = filteredRows.some((item) => String(item.id) === String(currentDependentValue))
        if (!valueStillAvailable) {
          nextState = {
            ...nextState,
            [dependentFilter.name]: '',
          }
          setFilterSelectSearchState((currentSearch) => ({
            ...currentSearch,
            [dependentFilter.name]: '',
          }))
        }
      }

      return nextState
    })
  }

  async function refreshList() {
    const activeFilters = Object.entries(filterState).reduce((accumulator, [key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        accumulator[key] = value
      }
      return accumulator
    }, {})
    Object.assign(activeFilters, normalizedForcedFilters)
    const response = await api.list(config.resource, { ...activeFilters, page })
    const loadedItems = Array.isArray(response) ? response : (response?.data || [])
    const paginationMeta = Array.isArray(response) ? null : (response?.pagination || null)
    setItems(loadedItems)
    setPagination(paginationMeta)
  }

  function clearFilters() {
    setFilterState(initialFilterStateWithForced)
    setFilterSelectSearchState({})
  }

  function parseImportText(text) {
    const normalizedText = String(text || '').replace(/\r/g, '\n')
    const lines = normalizedText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length < 2) {
      return []
    }

    const headerLine = lines[0]
    const delimiter = headerLine.includes('\t') ? '\t' : headerLine.includes(';') ? ';' : ','
    const headers = headerLine.split(delimiter).map((column) => column.trim().toLowerCase())

    return lines.slice(1).map((line) => {
      const values = line.split(delimiter).map((item) => item.trim())
      return headers.reduce((accumulator, header, index) => {
        accumulator[header] = values[index] ?? ''
        return accumulator
      }, {})
    })
  }

  function normalizeImportCellValue(value) {
    const rawValue = String(value ?? '').trim()
    const lowered = rawValue.toLowerCase()
    if (['true', 'verdadeiro'].includes(lowered)) {
      return true
    }
    if (['false', 'falso'].includes(lowered)) {
      return false
    }
    return rawValue
  }

  async function parseImportFile(file) {
    const name = (file.name || '').toLowerCase()
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls')
    if (!isExcel) {
      const text = await file.text()
      return parseImportText(text)
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) return []
    const sheet = workbook.Sheets[firstSheetName]
    const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
    return json.map((row) => {
      return Object.entries(row).reduce((acc, [key, value]) => {
        acc[String(key).trim().toLowerCase()] = value
        return acc
      }, {})
    })
  }

  async function handleImportFile(file) {
    if (!file) {
      return
    }

    setImporting(true)
    setFeedback('')
    setErrorMessage('')
    setDebugOverlayMessage('')

    try {
      const parsedRows = await parseImportFile(file)
      if (parsedRows.length === 0) {
        throw new Error('Arquivo sem linhas válidas para importação.')
      }

      const normalizedRows = parsedRows.map((row) => {
        return Object.entries(row).reduce((accumulator, [key, value]) => {
          accumulator[key] = normalizeImportCellValue(value)
          return accumulator
        }, {})
      })

      const result = await importerApi({ rows: normalizedRows })
      await refreshList()

      const importedCount = Number(result.imported || 0)
      const updatedCount = Number(result.updated || 0)

      if (result.errors?.length) {
        setFeedback(`Importação concluída com ${importedCount} inseridas, ${updatedCount} atualizadas e ${result.errors.length} com erro.`)
        setErrorMessage(result.errors.slice(0, 5).map((item) => `Linha ${item.line}: ${item.error}`).join(' | '))

        const detailedDebug = result.errors
          .slice(0, 5)
          .map((item) => `Linha ${item.line}: ${item.debug || item.error}`)
          .join(' || ')
        setDebugOverlayMessage(detailedDebug)
      } else {
        setFeedback(`Importação concluída com ${importedCount} inseridas e ${updatedCount} atualizadas.`)
      }

      if (result.schema_warnings?.length) {
        const warningText = result.schema_warnings
          .slice(0, 5)
          .map((item) => `Linha ${item.line}: colunas ignoradas (${(item.columns || []).join(', ')}) por schema antigo.`)
          .join(' | ')

        setErrorMessage((current) => (current ? `${current} | ${warningText}` : warningText))
        setDebugOverlayMessage((current) => (current ? `${current} || ${warningText}` : warningText))
      }
    } catch (error) {
      setErrorMessage(error.message || `Falha ao importar ${importerEntityLabel}.`)
      setDebugOverlayMessage(error.stack || error.message || `Falha ao importar ${importerEntityLabel}.`)
    } finally {
      setImporting(false)
    }
  }

  const [pasteErrors, setPasteErrors] = useState([])
  const [pasteFiliais, setPasteFiliais] = useState([])

  async function handleImportPaste() {
    if (!pasteText.trim()) return
    setImporting(true)
    setFeedback('')
    setErrorMessage('')
    setDebugOverlayMessage('')
    setPasteErrors([])
    setPasteFiliais([])
    try {
      const parsedRows = parseImportText(pasteText)
      if (parsedRows.length === 0) throw new Error('Nenhuma linha válida encontrada. Verifique se o cabeçalho está presente.')
      const normalizedRows = parsedRows.map((row) =>
        Object.entries(row).reduce((acc, [k, v]) => { acc[k] = normalizeImportCellValue(v); return acc }, {})
      )
      const result = await importerApi({ rows: normalizedRows })
      const importedCount = Number(result.imported || 0)
      const updatedCount = Number(result.updated || 0)
      if (result.filiais_disponiveis?.length) setPasteFiliais(result.filiais_disponiveis)
      const skipped = Number(result.skipped_duplicates || 0)
      const skipMsg = skipped > 0 ? `, ${skipped} duplicata${skipped !== 1 ? 's' : ''} ignorada${skipped !== 1 ? 's' : ''}` : ''
      if (result.errors?.length) {
        setPasteErrors(result.errors)
        setFeedback(`Importação: ${importedCount} inseridos, ${updatedCount} atualizados${skipMsg}, ${result.errors.length} com erro.`)
        if (importedCount > 0 || updatedCount > 0) await refreshList()
      } else {
        await refreshList()
        setFeedback(`Importação concluída: ${importedCount} inseridos, ${updatedCount} atualizados${skipMsg}.`)
        setShowPasteModal(false)
        setPasteText('')
      }
    } catch (error) {
      setErrorMessage(error.message || 'Falha ao importar.')
      setDebugOverlayMessage(error.stack || error.message || '')
    } finally {
      setImporting(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setFeedback('')
    setErrorMessage('')

    try {
      if (hasUploadingField) {
        throw new Error('Aguarde o término do upload do arquivo antes de salvar.')
      }

      if (!editingId && !canCreate) {
        throw new Error('Sem permissão para cadastrar neste módulo.')
      }

      if (editingId && !canEdit) {
        throw new Error('Sem permissão para editar registros.')
      }

      const payload = config.fields.reduce((accumulator, field) => {
        const currentValue = formState[field.name]
        accumulator[field.name] = field.type === 'checkbox' ? Boolean(currentValue) : currentValue
        return accumulator
      }, {})

      if (config.resource === 'colaborador_beneficios' && isBonificacaoBenefit(formState)) {
        Object.assign(payload, {
          codigo_rubrica: 'BONUS',
          modo_calculo: 'fixo_mensal',
          base_dias: 'presenca',
          valor_mensal: 0,
          valor_unitario: 0,
          teto_mensal: '',
          desconta_faltas: false,
          desconta_eventos: false,
          ordem: 0,
          observacoes: payload.observacoes || 'Valor calculado automaticamente na tela de bonificação mensal.',
        })
      }

      if (config.resource === 'colaborador_beneficios' && isProjectedDailyBenefit(formState)) {
        const tipo = normalizeBenefitToken(formState?.tipo_beneficio)
        const rubricaByType = {
          vale_transporte: 'VT',
          ajuda_custo: 'AJUDA',
          vale_alimentacao: 'VA',
          vale_refeicao: 'VA',
        }
        Object.assign(payload, {
          codigo_rubrica: rubricaByType[tipo] || payload.codigo_rubrica,
          modo_calculo: 'por_dia',
          base_dias: 'escala',
          valor_mensal: 0,
        })
      }

      Object.assign(payload, normalizedForcedFormValues)

      if (editingId) {
        await api.update(config.resource, editingId, payload)
        setFeedback('Registro atualizado com sucesso.')
      } else {
        await api.create(config.resource, payload)
        setFeedback('Registro criado com sucesso.')
      }

      await refreshList()
      resetForm()
      if (typeof onSaved === 'function') {
        try { onSaved() } catch (e) { /* ignore callback errors */ }
      }
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(item) {
    if (!canEdit) {
      setErrorMessage('Sem permissão para editar registros.')
      return
    }

    if (editingId && editingId !== item.id && isEditingDirty) {
      const confirmed = confirmDiscardChanges('Você tem alterações não salvas na edição atual. Deseja descartá-las para editar outro registro?')
      if (!confirmed) {
        return
      }
    }

    const nextEditState = buildFormStateFromItem(config.fields, item)

    setEditingId(item.id)
    setSelectedItem(item)
    setActivePanel('consult')
    setManualAutoFillOverrides(normalizeAutoFillOverrides(config.fields, true))
    setEditingBaselineState(nextEditState)
    setFormState(nextEditState)
    setFeedback('')
    setErrorMessage('')
  }

  function handleSelectItem(item) {
    if (editingId && editingId !== item.id && isEditingDirty) {
      const confirmed = confirmDiscardChanges('Você tem alterações não salvas na edição atual. Deseja descartá-las para consultar outro registro?')
      if (!confirmed) {
        return
      }
      setEditingId(null)
      setEditingBaselineState(null)
      setManualAutoFillOverrides(initialAutoFillOverrides)
      setFormState(draftFormState)
    }

    setSelectedItem(item)
    setActivePanel('consult')
    setFeedback('')
    setErrorMessage('')
  }

  function handleFormSecondaryAction() {
    if (editingId) {
      const confirmed = confirmDiscardChanges('Deseja cancelar esta edição? As alterações não salvas serão perdidas.')
      if (!confirmed) {
        return
      }

      setEditingId(null)
      setEditingBaselineState(null)
      setFormState(draftFormState)
      setManualAutoFillOverrides(initialAutoFillOverrides)
      setActivePanel(selectedItem ? 'consult' : 'form')
      setFeedback('')
      setErrorMessage('')
      return
    }

    const confirmed = confirmDiscardChanges('Deseja limpar o formulário de novo registro? As informações preenchidas serão perdidas.')
    if (!confirmed) {
      return
    }

    setFormState(initialStateWithForced)
    setDraftFormState(initialStateWithForced)
    setManualAutoFillOverrides(initialAutoFillOverrides)
    setSelectSearchState({})
    setFeedback('')
    setErrorMessage('')
  }

  async function handleDelete(itemId) {
    if (!canDelete) {
      setErrorMessage('Sem permissão para excluir registros.')
      return
    }

    const confirmed = window.confirm('Confirma a exclusão deste registro?')
    if (!confirmed) {
      return
    }

    try {
      await api.remove(config.resource, itemId)
      await refreshList()
      if (editingId === itemId) {
        resetForm()
      }
      setFeedback('Registro excluído com sucesso.')
      setErrorMessage('')
      if (typeof onSaved === 'function') {
        try { onSaved() } catch (e) { /* ignore callback errors */ }
      }
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const pastePreviewRows = showPasteModal ? parseImportText(pasteText) : []

  const content = (
    <>
      {showPasteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 28, maxWidth: 780, width: '100%', margin: 16, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,.22)', borderTop: '4px solid #1e40af' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: 3 }}>Importação por colagem</div>
                <h3 style={{ margin: 0 }}>Colar dados de planilha / Excel</h3>
              </div>
              <button type="button" onClick={() => { setShowPasteModal(false); setPasteText(''); setPasteErrors([]); setPasteFiliais([]) }} style={{ fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
              Copie as linhas diretamente do Excel ou Google Sheets (incluindo o cabeçalho) e cole abaixo. Colunas separadas por <strong>Tab</strong>, <strong>ponto-e-vírgula</strong> ou <strong>vírgula</strong> são aceitas.
            </p>
            <div style={{ marginBottom: 8, padding: '6px 10px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 5, fontSize: 11, color: '#0369a1' }}>
              Colunas esperadas: <strong>filial · nome_completo · email · cpf · telefone · cargo · turno · escala_servico · horario_padrao_inicio · horario_padrao_fim · tipo_acesso · data_admissao · ativo</strong>
            </div>
            {(relations.filiais || []).length > 0 && (
              <div style={{ marginBottom: 8, padding: '6px 10px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 5, fontSize: 11, color: '#78350f' }}>
                <strong>Coluna "filial" aceita:</strong> nome da cidade, cidade/UF ou cidade - UF.
                <br />
                <span style={{ fontFamily: 'monospace', fontSize: 10.5 }}>
                  {(relations.filiais || []).map((f) => `${f.cidade}/${f.uf}`).join(' · ')}
                </span>
              </div>
            )}
            <textarea
              autoFocus
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'filial\tnome_completo\temail\tcpf\t...\nBELEM/PA\tJOAO DA SILVA\tjoao@gold.com\t000.000.000-00\t...'}
              rows={10}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 11, border: '1px solid #c7d2e0', borderRadius: 6, padding: '8px 10px', boxSizing: 'border-box', resize: 'vertical', background: '#f8fafc' }}
              value={pasteText}
            />
            {pastePreviewRows.length > 0 && (
              <div style={{ marginTop: 8, padding: '6px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 5, fontSize: 11, color: '#059669', fontWeight: 600 }}>
                ✔ {pastePreviewRows.length} linha{pastePreviewRows.length !== 1 ? 's' : ''} detectada{pastePreviewRows.length !== 1 ? 's' : ''} para importação
                {pastePreviewRows[0] && (
                  <span style={{ fontWeight: 400, color: '#047857', marginLeft: 6 }}>
                    — primeira: {pastePreviewRows[0].nome_completo || pastePreviewRows[0].nome || '(sem nome)'}
                    {pastePreviewRows[0].filial ? ` · ${pastePreviewRows[0].filial}` : ''}
                  </span>
                )}
              </div>
            )}
            {pasteText.trim() && pastePreviewRows.length === 0 && (
              <div style={{ marginTop: 8, padding: '6px 10px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 5, fontSize: 11, color: '#dc2626' }}>
                Nenhuma linha detectada. Verifique se o texto inclui a linha de cabeçalho.
              </div>
            )}
            {pasteErrors.length > 0 && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 11 }}>
                <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Erros na importação ({pasteErrors.length}):</div>
                <ul style={{ margin: 0, paddingLeft: 16, color: '#7f1d1d', lineHeight: 1.7 }}>
                  {pasteErrors.slice(0, 10).map((e) => (
                    <li key={e.line}><strong>Linha {e.line}:</strong> {e.error}</li>
                  ))}
                  {pasteErrors.length > 10 && <li style={{ color: '#9ca3af' }}>… e mais {pasteErrors.length - 10} erros</li>}
                </ul>
                {pasteFiliais.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #fca5a5' }}>
                    <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 4 }}>Filiais disponíveis no sistema:</div>
                    <div style={{ color: '#78350f', fontFamily: 'monospace', fontSize: 10.5, lineHeight: 1.6 }}>
                      {pasteFiliais.join(' · ')}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="button-secondary" onClick={() => { setShowPasteModal(false); setPasteText(''); setPasteErrors([]); setPasteFiliais([]) }}>Cancelar</button>
              <button
                type="button"
                className="button-primary"
                disabled={importing || pastePreviewRows.length === 0}
                onClick={handleImportPaste}
              >
                {importing ? 'Importando…' : `Importar ${pastePreviewRows.length > 0 ? pastePreviewRows.length + ' registros' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {debugOverlayMessage && (
        <div className="debug-overlay-message" role="alert">
          <button
            aria-label="Fechar debug"
            className="debug-overlay-close"
            onClick={() => setDebugOverlayMessage('')}
            type="button"
          >
            x
          </button>
          <strong>Debug da importação</strong>
          <p>{debugOverlayMessage}</p>
        </div>
      )}

      <div className="page-header">
        <div>
          <span className="eyebrow">Cadastro</span>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
      </div>

      <div className="page-grid">
        <div className="surface-card form-card">
          {hasImporter && !editingId && (
            <div className="import-panel">
              <div className="import-panel-head">
                <span className="eyebrow">Importação em lote</span>
                <strong>{`Modelo Excel/CSV para ${importerEntityLabel}`}</strong>
              </div>
              <p>
                {importerAcceptExcel
                  ? 'Use o modelo pronto e importe em Excel (.xlsx) ou CSV (separador ; ou ,).'
                  : 'Use o modelo pronto e importe em CSV (separador ; ou ,).'}
                {config.importer.cpfMask && (
                  <>
                    {' '}CPF aceito no formato <strong>{config.importer.cpfMask}</strong>.
                  </>
                )}
                {config.importer.tipoOptions && (
                  <>
                    {' '}Coluna <strong>tipo</strong> aceita: {config.importer.tipoOptions.join(', ')}.
                  </>
                )}
              </p>
              <div className="import-columns-list">
                {(config.importer.columns || []).map((columnName) => (
                  <span className="permission-badge" key={columnName}>{columnName}</span>
                ))}
              </div>
              <div className="button-row">
                <a className="button-secondary import-template-link" download href={config.importer.templateUrl}>
                  Baixar modelo de colunas
                </a>
                <label className="button-secondary import-upload-label">
                  {importing
                    ? 'Importando...'
                    : importerAcceptExcel ? 'Importar arquivo (.xlsx / .csv)' : 'Importar arquivo (.csv)'}
                  <input
                    accept={importerAcceptAttr}
                    disabled={importing}
                    onChange={(event) => {
                      void handleImportFile(event.target.files?.[0])
                      event.target.value = ''
                    }}
                    type="file"
                  />
                </label>
                <button
                  className="button-secondary"
                  disabled={importing}
                  onClick={() => setShowPasteModal(true)}
                  type="button"
                >
                  📋 Colar dados (Excel / planilha)
                </button>
              </div>
            </div>
          )}

          <div className="resource-mini-tabs">
            <button
              className={`button-secondary resource-mini-tab${!isConsultPanel ? ' active' : ''}`}
              onClick={openFormPanel}
              type="button"
            >
              Novo registro
            </button>
            <button
              className={`button-secondary resource-mini-tab${isConsultPanel ? ' active' : ''}`}
              onClick={openConsultPanel}
              type="button"
            >
              Consultar/Editar
            </button>
          </div>

          <div className="section-title">
            <span className="eyebrow">
              {editingId ? 'Edição' : isViewingDetails ? 'Detalhes' : isConsultPanel ? 'Consulta' : 'Novo registro'}
            </span>
            <h2>
              {editingId
                ? 'Atualizar dados'
                : isViewingDetails
                  ? 'Visualização do registro'
                  : isConsultPanel
                    ? 'Selecione um registro na lista'
                    : 'Preencher formulário'}
            </h2>
          </div>

          {isViewingDetails ? (
            <>
              <div className="detail-grid">
                {detailFields.map((field) => (
                  <div className={`detail-field${field.type === 'textarea' ? ' span-2' : ''}`} key={`detail-left-${field.name}`}>
                    <span>{field.label}</span>
                    <div className="readonly-box">
                      {field.type === 'file' && selectedItem[field.name] ? (
                        <a href={selectedItem[field.name]} rel="noreferrer" target="_blank">
                          Abrir arquivo
                        </a>
                      ) : (
                        formatFieldValue(field, selectedItem[field.name])
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="button-row">
                {canEdit && (
                  <button className="button-primary" onClick={() => handleEdit(selectedItem)} type="button">
                    Editar
                  </button>
                )}
                <button className="button-secondary" onClick={openFormPanel} type="button">
                  {canCreate ? 'Voltar para novo registro' : 'Fechar detalhes'}
                </button>
              </div>
            </>
          ) : isConsultPanel && !editingId ? (
            <div className="empty-state">Selecione um registro na lista para consultar os detalhes ou iniciar a edição.</div>
          ) : (
            <>
              {!editingId && !canCreate ? (
                <div className="empty-state">Sem permissão para cadastrar novos registros neste módulo.</div>
              ) : (
                <form onSubmit={handleSubmit}>
                  {isBonificacaoMode && (
                    <div className="alert-success">
                      Bonificação com cálculo automático: os campos de regra e valores ficam bloqueados neste cadastro.
                      {' '}
                      Valor do mês atual ({bonusPreviewMonth}):
                      {' '}
                      <strong>{bonusPreviewLoading ? 'Carregando...' : formatCurrency(bonusPreviewValue)}</strong>
                      . Esse valor vem da tela de Bonificação e atualiza conforme os lançamentos mensais.
                    </div>
                  )}
                  {isProjectedDailyMode && (
                    <div className="alert-success">
                      Benefício prospectivo: para este tipo a regra fica fixa em Variável por dia e Apurar por Escala.
                      O sistema projeta os dias do mês atual e aplica descontos de faltas/eventos do mês anterior.
                    </div>
                  )}

                  <div className="form-grid">
                    {formFields.map((field) => {
                      const value = formState[field.name]
                      const isForcedField = Object.prototype.hasOwnProperty.call(normalizedForcedFormValues, field.name)
                      const isLockedBonificacaoField = isBonificacaoMode && BONIFICACAO_LOCKED_FIELDS.has(field.name)
                      const isLockedProjectedField = isProjectedDailyMode && PROJECTED_DAILY_LOCKED_FIELDS.has(field.name)
                      const isDisabled = Boolean(field.disabled || isForcedField || isLockedBonificacaoField || isLockedProjectedField)
                      const isCheckbox = field.type === 'checkbox'

                      if (isCheckbox) {
                        return (
                          <label className="field checkbox-field" key={field.name}>
                            <input
                              checked={Boolean(value)}
                              disabled={isDisabled}
                              onChange={(event) => handleChange(field, event.target.checked)}
                              type="checkbox"
                            />
                            <span>{field.label}</span>
                          </label>
                        )
                      }

                      if (field.type === 'textarea') {
                        return (
                          <label className="field span-2" key={field.name}>
                            <span>{field.label}</span>
                            <textarea
                              disabled={isDisabled}
                              onChange={(event) => handleChange(field, event.target.value)}
                              placeholder={field.placeholder}
                              required={isFieldRequired(field, formState)}
                              rows="3"
                              value={value}
                            />
                          </label>
                        )
                      }

                      if (field.type === 'file') {
                        const isUploading = Boolean(uploadingFields[field.name])

                        return (
                          <label className="field span-2" key={field.name}>
                            <span>{field.label}</span>
                            <div className="file-upload-row">
                              <input
                                accept={field.accept}
                                disabled={isUploading}
                                onChange={(event) => void handleFileUpload(field, event.target.files?.[0])}
                                type="file"
                              />
                              {value ? (
                                <a className="button-secondary file-upload-link" href={value} rel="noreferrer" target="_blank">
                                  Ver arquivo
                                </a>
                              ) : null}
                            </div>
                            <small className="field-help-text">
                              {isUploading ? 'Enviando arquivo...' : field.placeholder || 'Envie um arquivo do documento.'}
                            </small>
                          </label>
                        )
                      }

                      if (field.type === 'select') {
                        const baseOptions = field.relation
                          ? filterRelationRowsByDependency(
                              (relations[field.relation] || []).filter((item) => item.ativo !== false),
                              field,
                              formState
                            ).map((item) => ({
                              value: item.id,
                              label: relationOptionLabel(field, item),
                            }))
                          : field.options || []
                        const selectSearch = (selectSearchState[field.name] || '').trim().toLowerCase()
                        const options = selectSearch
                          ? baseOptions.filter((option) => String(option.label || '').toLowerCase().includes(selectSearch))
                          : baseOptions

                        return (
                          <label className="field" key={field.name}>
                            <span>{field.label}</span>
                            {field.searchable && (
                              <input
                                disabled={isDisabled}
                                onChange={(event) =>
                                  setSelectSearchState((current) => ({
                                    ...current,
                                    [field.name]: event.target.value,
                                  }))
                                }
                                placeholder={`Buscar ${field.label.toLowerCase()}`}
                                type="text"
                                value={selectSearchState[field.name] || ''}
                              />
                            )}
                            <select
                              disabled={isDisabled}
                              onChange={(event) => handleChange(field, event.target.value)}
                              required={isFieldRequired(field, formState)}
                              value={value}
                            >
                              <option value="">Selecione</option>
                              {options.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        )
                      }

                      if (field.type === 'select-text') {
                        // Como select convencional mas salva o TEXT (optionLabel), não o ID
                        const optRows = (relations[field.relation] || []).filter((item) => item.ativo !== false)
                        const labelKey = field.optionLabel || 'nome'
                        const datalistId = `datalist-${field.name}`
                        return (
                          <label className="field" key={field.name}>
                            <span>{field.label}</span>
                            <input
                              disabled={isDisabled}
                              list={datalistId}
                              onChange={(event) => handleChange(field, event.target.value)}
                              placeholder={field.placeholder || 'Digite ou selecione...'}
                              required={isFieldRequired(field, formState)}
                              type="text"
                              value={value}
                            />
                            <datalist id={datalistId}>
                              {optRows.map((opt) => (
                                <option key={opt.id} value={opt[labelKey]}>{opt[labelKey]}</option>
                              ))}
                            </datalist>
                          </label>
                        )
                      }

                      return (
                        <label className="field" key={field.name}>
                          <span>{field.label}</span>
                          <input
                            disabled={isDisabled}
                            onChange={(event) => handleChange(field, event.target.value)}
                            placeholder={field.placeholder}
                            required={isFieldRequired(field, formState)}
                            style={field.transform === 'uppercase' ? { textTransform: 'uppercase' } : undefined}
                            type={field.type}
                            value={value}
                          />
                        </label>
                      )
                    })}
                  </div>

                  {feedback && <div className="alert-success">{feedback}</div>}
                  {errorMessage && <div className="alert-error">{errorMessage}</div>}

                  <div className="button-row">
                    <button className="button-primary" disabled={saving || hasUploadingField} type="submit">
                      {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar'}
                    </button>
                    <button className="button-secondary" onClick={handleFormSecondaryAction} type="button">
                      {editingId ? 'Cancelar edição' : 'Limpar'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

        </div>

        <div className="surface-card table-card">
          <div className="section-title">
            <span className="eyebrow">Registros</span>
            <h2>Lista atual</h2>
          </div>

          {filterFields.length > 0 && (
            <div className="filter-panel">
              <div className="filter-grid">
                {filterFields.filter((filter) => !Object.prototype.hasOwnProperty.call(normalizedForcedFilters, filter.name)).map((filter) => {
                  const value = filterState[filter.name] ?? ''

                  if (filter.type === 'select') {
                    const baseOptions = filter.relation
                      ? filterRelationRowsByDependency(relations[filter.relation] || [], filter, filterState).map((item) => ({
                          value: item.id,
                          label: relationOptionLabel(filter, item),
                        }))
                      : filter.options || []
                    const filterSearch = (filterSelectSearchState[filter.name] || '').trim().toLowerCase()
                    const options = filterSearch
                      ? baseOptions.filter((option) => String(option.label || '').toLowerCase().includes(filterSearch))
                      : baseOptions

                    return (
                      <label className="field filter-field" key={`filter-${filter.name}`}>
                        <span>{filter.label}</span>
                        {filter.searchable && (
                          <input
                            onChange={(event) =>
                              setFilterSelectSearchState((current) => ({
                                ...current,
                                [filter.name]: event.target.value,
                              }))
                            }
                            placeholder={`Buscar ${filter.label.toLowerCase()}`}
                            type="text"
                            value={filterSelectSearchState[filter.name] || ''}
                          />
                        )}
                        <select onChange={(event) => handleFilterChange(filter, event.target.value)} value={value}>
                          <option value="">Todos</option>
                          {options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )
                  }

                  return (
                    <label className="field filter-field" key={`filter-${filter.name}`}>
                      <span>{filter.label}</span>
                      <input
                        onChange={(event) => handleFilterChange(filter, event.target.value)}
                        placeholder={`Filtrar ${filter.label.toLowerCase()}`}
                        type={filter.type || 'text'}
                        value={value}
                      />
                    </label>
                  )
                })}
              </div>

              <div className="button-row filter-actions">
                <button className="button-secondary" onClick={clearFilters} type="button">
                  Limpar filtros
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="empty-state">Carregando registros...</div>
          ) : items.length === 0 ? (
            <div className="empty-state">Nenhum registro encontrado.</div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {config.columns.map((column) => (
                        <th key={column.key}>{column.label}</th>
                      ))}
                      {showActions && <th>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        className={`data-row${selectedItem?.id === item.id ? ' selected' : ''}`}
                        key={item.id}
                        onClick={() => handleSelectItem(item)}
                      >
                        {config.columns.map((column) => (
                          <td key={`${item.id}-${column.key}`}>{formatValue(item, column, relations)}</td>
                        ))}
                        {showActions && (
                          <td>
                            <div className="table-actions">
                              {canEdit && (
                                <button
                                  className="button-link"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleEdit(item)
                                  }}
                                  type="button"
                                >
                                  Editar
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  className="button-link danger"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleDelete(item.id)
                                  }}
                                  type="button"
                                >
                                  Excluir
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination && pagination.total_pages > 1 && (
                <div className="pagination-controls">
                  <span className="pagination-info">
                    {(pagination.page - 1) * pagination.per_page + 1}–{Math.min(pagination.page * pagination.per_page, pagination.total)} de {pagination.total}
                  </span>
                  <div className="pagination-buttons">
                    <button
                      className="button-secondary"
                      disabled={pagination.page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      type="button"
                    >
                      Anterior
                    </button>
                    <span className="pagination-page">{pagination.page} / {pagination.total_pages}</span>
                    <button
                      className="button-secondary"
                      disabled={pagination.page >= pagination.total_pages}
                      onClick={() => setPage((p) => p + 1)}
                      type="button"
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </>
  )

  if (embedded) {
    return content
  }

  return (
    <section className="page-shell">
      {content}
    </section>
  )
}

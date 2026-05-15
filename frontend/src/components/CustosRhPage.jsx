import { useEffect, useState, useRef } from 'react'
import { api } from '../services/api'
import {
  formatCurrency,
  formatPercent,
  marginTone,
  accuracyTone,
  negativeContractsTone,
  custoForaContratoTone,
} from '../lib/formatters'
import CostSummaryCard from './CostSummaryCard'
import ContractsTable from './ContractsTable'
import CollaboratorsTable from './CollaboratorsTable'

function monthInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export default function CustosRhPage({ embedded = false }) {
  const [selectedMonth, setSelectedMonth] = useState(() => monthInputValue())
  const [selectedFilial, setSelectedFilial] = useState('')
  const [searchColaborador, setSearchColaborador] = useState('')
  const [activeTab, setActiveTab] = useState('resumo')
  const [dashboard, setDashboard] = useState({
    filiais: [],
    summary: {},
    collaborators: [],
    contracts: [],
    month_label: '',
    database_ready: { contracts: true },
  })
  const [loading, setLoading] = useState(true)
  const _loaded = useRef(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (dashboard.filiais?.length === 1 && !selectedFilial) {
      setSelectedFilial(String(dashboard.filiais[0].id))
    }
  }, [dashboard.filiais])

  useEffect(() => {
    let active = true

    async function load() {
      if (!_loaded.current) setLoading(true)
      setErrorMessage('')

      try {
        const response = await api.getCostsRhDashboard({
          mes: selectedMonth,
          ...(selectedFilial ? { filial_id: selectedFilial } : {}),
        })

        if (!active) return
        setDashboard(response)
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
  }, [selectedFilial, selectedMonth])

  const summary = dashboard.summary || {}
  const custoForaContratos = Number(summary.custo_sem_vinculo_total || 0)

  const content = (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Financeiro RH</span>
          <h1>Custos e acuracidade de contratos</h1>
          <p>Visão consolidada de salário, benefícios e aderência financeira dos contratos.</p>
        </div>
      </div>

      <div className="surface-card table-card costs-shell">
        {/* ─── FILTROS ──────────────────────────────────────────────────── */}
        <div className="filter-panel costs-filter-panel">
          <div className="filter-grid costs-top-grid">
            <label className="field filter-field">
              <span>Mês de referência</span>
              <input onChange={(event) => setSelectedMonth(event.target.value)} type="month" value={selectedMonth} />
            </label>

            <label className="field filter-field">
              <span>Filial</span>
              <select onChange={(event) => setSelectedFilial(event.target.value)} value={selectedFilial}>
                {(dashboard.filiais || []).length !== 1 && <option value="">Todas</option>}
                {(dashboard.filiais || []).map((filial) => (
                  <option key={filial.id} value={filial.id}>
                    {filial.cidade}/{filial.uf}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* ─── ABAS ─────────────────────────────────────────────────── */}
          <div className="costs-tabs">
            <button
              className={`tab-button${activeTab === 'resumo' ? ' active' : ''}`}
              onClick={() => setActiveTab('resumo')}
            >
              📊 Resumo
            </button>
            <button
              className={`tab-button${activeTab === 'contratos' ? ' active' : ''}`}
              onClick={() => setActiveTab('contratos')}
            >
              📋 Contratos
            </button>
            <button
              className={`tab-button${activeTab === 'colaboradores' ? ' active' : ''}`}
              onClick={() => setActiveTab('colaboradores')}
            >
              👥 Colaboradores
            </button>
          </div>
        </div>

        {errorMessage && <div className="alert-error">{errorMessage}</div>}

        {loading ? (
          <div className="empty-state">Carregando painel de custos...</div>
        ) : (
          <>
            {/* ─── ABA RESUMO ────────────────────────────────────────── */}
            {activeTab === 'resumo' && (
              <div className="tab-content">
                <div className="costs-summary-grid">
                  <CostSummaryCard
                    label="Efetivo ativo"
                    value={summary.headcount_total}
                    unit="number"
                    tone="neutral"
                    description={`Referência: ${dashboard.month_label || selectedMonth}`}
                  />

                  <CostSummaryCard
                    label="Despesa total da operação"
                    value={summary.despesa_total_operacao || summary.monthly_total_cost}
                    unit="currency"
                    tone="warning"
                    description="Salário, benefícios, bonificação"
                  />

                  <CostSummaryCard
                    label="Valor total contratos"
                    value={summary.valor_contrato_itens_total}
                    unit="currency"
                    tone="info"
                    description="Soma de valor cobrado"
                  />

                  <CostSummaryCard
                    label="Lucro da operação"
                    value={summary.lucro_total_operacao || summary.margem_total_contratos}
                    unit="currency"
                    tone={marginTone(summary.lucro_total_operacao || summary.margem_total_contratos)}
                    description="Valor contratos - despesas"
                  />

                  <CostSummaryCard
                    label="Acuracidade de valor"
                    value={summary.total_contracts_value_accuracy}
                    unit="percent"
                    tone={accuracyTone(summary.total_contracts_value_accuracy)}
                    description="Aderência financeira"
                  />

                  <CostSummaryCard
                    label="Acuracidade de efetivo"
                    value={summary.total_contracts_headcount_accuracy}
                    unit="percent"
                    tone={accuracyTone(summary.total_contracts_headcount_accuracy)}
                    description="Real vs contratado"
                  />

                  <CostSummaryCard
                    label="Contratos em alerta"
                    value={summary.contracts_with_negative_margin}
                    unit="number"
                    tone={negativeContractsTone(summary.contracts_with_negative_margin)}
                    description="Margem negativa"
                  />

                  <CostSummaryCard
                    label="Custo sem vínculo"
                    value={custoForaContratos}
                    unit="currency"
                    tone={custoForaContratoTone(custoForaContratos)}
                    description="Sem contrato vinculado"
                  />
                </div>
              </div>
            )}

            {/* ─── ABA CONTRATOS ────────────────────────────────────── */}
            {activeTab === 'contratos' && (
              <div className="tab-content">
                {!dashboard.database_ready?.contracts && (
                  <div className="alert-error">Tabela de contratos ainda não existe. Execute a migration.</div>
                )}
                <ContractsTable contracts={dashboard.contracts || []} />
              </div>
            )}

            {/* ─── ABA COLABORADORES ───────────────────────────────── */}
            {activeTab === 'colaboradores' && (
              <div className="tab-content">
                <CollaboratorsTable
                  collaborators={dashboard.collaborators || []}
                  search={searchColaborador}
                  onSearchChange={setSearchColaborador}
                />
              </div>
            )}
          </>
        )}
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

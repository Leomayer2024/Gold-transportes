import { useEffect, useMemo, useState } from 'react'
import ResourcePage from './ResourcePage'
import { resourceConfigs } from './resourceConfigs'
import { api } from '../services/api'

function monthInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0))
}

function formatPercent(value) {
  if (value === null || value === undefined) return '-'
  return `${Number(value).toFixed(1)}%`
}

function marginTone(value) {
  return Number(value || 0) < 0 ? 'danger' : 'success'
}

function accuracyTone(value) {
  if (value === null || value === undefined) return 'neutral'
  const v = Number(value)
  if (v >= 95) return 'success'
  if (v >= 85) return 'warning'
  return 'danger'
}

function headcountTone(real, contratado) {
  if (!contratado) return 'neutral'
  const ratio = real / contratado
  if (ratio >= 0.95 && ratio <= 1.05) return 'success'
  if (ratio >= 0.85) return 'warning'
  return 'danger'
}

export default function ContratosOperacionaisPage() {
  const [activeTab, setActiveTab] = useState('contratos')
  const [selectedContract, setSelectedContract] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(() => monthInputValue())
  const [contractMetrics, setContractMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState('')
  const [showGastosDetail, setShowGastosDetail] = useState(true)
  const [resultadoTab, setResultadoTab] = useState('fixo')

  const contractForcedValues = useMemo(() => {
    if (!selectedContract) return null
    return {
      filial_id: selectedContract.filial_id,
      contrato_operacional_id: selectedContract.id,
    }
  }, [selectedContract])

  async function handleContractItemsChanged() {
    if (!selectedContract?.id) return
    try {
      const dashboard = await api.getCostsRhDashboard({
        mes: selectedMonth,
        ...(selectedContract?.filial_id ? { filial_id: selectedContract.filial_id } : {}),
      })
      const found = (dashboard.contracts || []).find((c) => Number(c.id) === Number(selectedContract.id))
      const newValor = found?.valor_mensal_contrato_itens ?? 0
      const currentValor = parseFloat(selectedContract.valor_mensal_contrato || 0)
      if (Number(newValor) !== Number(currentValor)) {
        try {
          await api.update('contratos_operacionais', selectedContract.id, { valor_mensal_contrato: newValor })
          setSelectedContract((s) => ({ ...(s || {}), valor_mensal_contrato: newValor }))
        } catch (err) {
          // não bloquear a UI se atualização falhar
          console.error('Falha ao atualizar valor do contrato automaticamente', err)
        }
      }
    } catch (err) {
      console.error('Falha ao recarregar métricas para atualizar valor do contrato', err)
    }
  }

  useEffect(() => {
    let active = true

    async function loadMetrics() {
      if (!selectedContract?.id) {
        setContractMetrics(null)
        setMetricsError('')
        return
      }

      setMetricsLoading(true)
      setMetricsError('')

      try {
        const dashboard = await api.getCostsRhDashboard({
          mes: selectedMonth,
          ...(selectedContract?.filial_id ? { filial_id: selectedContract.filial_id } : {}),
        })

        if (!active) return

        const found = (dashboard.contracts || []).find(
          (c) => Number(c.id) === Number(selectedContract.id),
        )
        setContractMetrics(found || null)
      } catch (error) {
        if (active) {
          setMetricsError(error.message || 'Falha ao carregar métricas.')
          setContractMetrics(null)
        }
      } finally {
        if (active) setMetricsLoading(false)
      }
    }

    void loadMetrics()
    return () => { active = false }
  }, [selectedContract, selectedMonth])

  const metricsPanel = selectedContract ? (
    <div className="surface-card contract-metrics-panel">
      {/* Cabeçalho com seletor de mês */}
      <div className="contract-metrics-head">
        <div>
          <span className="eyebrow">Resultado do mês</span>
          <p className="contract-metrics-subtitle">
            {selectedContract.cliente_nome
              ? `Cliente: ${selectedContract.cliente_nome} · `
              : ''}
            {selectedContract.cargos_contrato
              ? `Cargos: ${selectedContract.cargos_contrato}`
              : ''}
          </p>
        </div>
        <label className="field">
          <span>Mês de referência</span>
          <input
            onChange={(e) => setSelectedMonth(e.target.value)}
            type="month"
            value={selectedMonth}
          />
        </label>
      </div>

      {metricsError && <div className="alert-error">{metricsError}</div>}

      {metricsLoading ? (
        <div className="empty-state">Carregando métricas...</div>
      ) : !contractMetrics ? (
        <div className="empty-state">
          Sem dados consolidados para este contrato no mês selecionado.<br />
          <small>Vincule colaboradores na aba "Equipe e valores" e registre gastos na aba "Gastos extras".</small>
        </div>
      ) : (
        <>
          {/* Sub-abas: Fixo vs Variável */}
          <div className="contract-resultado-tabs">
            <button
              className={`button-secondary button-sm${resultadoTab === 'fixo' ? ' active' : ''}`}
              onClick={() => setResultadoTab('fixo')}
              type="button"
            >
              Fixo
            </button>
            <button
              className={`button-secondary button-sm${resultadoTab === 'variavel' ? ' active' : ''}`}
              onClick={() => setResultadoTab('variavel')}
              type="button"
            >
              Variável
            </button>
            <span className="contract-resultado-tabs-hint">
              {resultadoTab === 'fixo'
                ? 'Itens fixos do contrato e custo da equipe.'
                : 'Horas extras (Calc. RTM) e gastos extras operacionais — variam mês a mês.'}
            </span>
          </div>

          {resultadoTab === 'fixo' && (
            <>
              {/* Linha 1: Headcount + Valor do contrato */}
              <div className="contract-metrics-grid">
                <article className={`tone-${headcountTone(contractMetrics.headcount_real, contractMetrics.qtd_colaboradores_contratados)}`}>
                  <span>Efetivo real</span>
                  <strong>{contractMetrics.headcount_real || 0}</strong>
                  <small>Contratado: {contractMetrics.qtd_colaboradores_contratados || 0}</small>
                </article>

                <article>
                  <span>Valor cobrado (fixo)</span>
                  <strong>{formatCurrency(contractMetrics.valor_mensal_contrato_itens)}</strong>
                  <small>Ref. cadastro: {formatCurrency(contractMetrics.valor_mensal_contrato_cadastro)}</small>
                </article>

                <article className={`tone-${accuracyTone(contractMetrics.acuracidade_headcount)}`}>
                  <span>Acurácia efetivo</span>
                  <strong>{formatPercent(contractMetrics.acuracidade_headcount)}</strong>
                  <small>{contractMetrics.itens_vinculados_total || 0} item(s) vinculado(s)</small>
                </article>

                {contractMetrics.colaboradores_inativos_count > 0 && (
                  <article className="tone-warning">
                    <span>Colab. inativos vinculados</span>
                    <strong>{contractMetrics.colaboradores_inativos_count}</strong>
                    <small>Conferir tela "Colaboradores"</small>
                  </article>
                )}
              </div>

              {/* Composição do custo */}
              <div className="contract-metrics-section-title">Composição do custo (fixo)</div>
              <div className="contract-metrics-grid">
                <article>
                  <span>Salários (CLT + adicionais)</span>
                  <strong>{formatCurrency(contractMetrics.gasto_salario_mensal)}</strong>
                </article>

                <article>
                  <span>Benefícios</span>
                  <strong>{formatCurrency(contractMetrics.gasto_beneficios_sem_bonificacao_mensal)}</strong>
                  {contractMetrics.gasto_bonificacao_mensal > 0 && (
                    <small>+ Bônus: {formatCurrency(contractMetrics.gasto_bonificacao_mensal)}</small>
                  )}
                </article>

                <article>
                  <span>Custo equipe (contrato)</span>
                  <strong>{formatCurrency(contractMetrics.custo_mensal_vinculos_contrato)}</strong>
                  <small>Colaboradores alocados no contrato</small>
                </article>

                {contractMetrics.custos_extras_gold_fixo_mensais > 0 && (
                  <article>
                    <span>Custos fixos Gold</span>
                    <strong>{formatCurrency(contractMetrics.custos_extras_gold_fixo_mensais)}</strong>
                    <small>Campo "Custos extras Gold" do contrato</small>
                  </article>
                )}
              </div>

              {/* Card Extra (renomeado de "por fora") — informativo */}
              {(contractMetrics.headcount_fora_contrato > 0
                || contractMetrics.valor_cobrado_colaboradores_fora_total > 0
                || contractMetrics.custo_mensal_fora_contrato > 0) && (
                <>
                  <div className="contract-metrics-section-title">Extra (fora do contrato — informativo)</div>
                  <div className="contract-metrics-grid">
                    <article>
                      <span>Pessoas extras</span>
                      <strong>{contractMetrics.headcount_fora_contrato || 0}</strong>
                      <small>Itens marcados como "fora do headcount"</small>
                    </article>
                    <article>
                      <span>Valor cobrado extra</span>
                      <strong>{formatCurrency(contractMetrics.valor_cobrado_colaboradores_fora_total)}</strong>
                      <small>Receita adicional fora do contrato</small>
                    </article>
                    <article>
                      <span>Custo extra</span>
                      <strong>{formatCurrency(contractMetrics.custo_mensal_fora_contrato)}</strong>
                      <small>Custo dos colaboradores extras</small>
                    </article>
                  </div>
                </>
              )}

              {/* Lista de colaboradores vinculados ATIVOS (custos do mês) */}
              {contractMetrics.colaboradores_detalhe?.some((c) => c.vinculo_ativo !== false) && (
                <>
                  <div className="contract-metrics-section-title">Colaboradores vinculados (ativos)</div>
                  <div className="contract-gastos-extras-card">
                    <table className="contract-gastos-table">
                      <thead>
                        <tr>
                          <th>Colaborador</th>
                          <th>Cargo</th>
                          <th>Tipo</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Aloc.</th>
                          <th style={{ textAlign: 'right' }}>Custo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contractMetrics.colaboradores_detalhe
                          .filter((c) => c.vinculo_ativo !== false)
                          .map((c) => (
                            <tr key={c.colaborador_id}>
                              <td>{c.nome || '-'}</td>
                              <td>{c.cargo || '-'}</td>
                              <td>{c.is_fora_contrato ? 'Extra' : 'Fixo'}</td>
                              <td>
                                <span className={`badge ${c.ativo ? 'badge-success' : 'badge-danger'}`}>
                                  {c.ativo ? 'Ativo' : 'Inativo'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>{formatPercent(c.percentual_alocacao)}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(c.custo_alocado)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {resultadoTab === 'variavel' && (
            <>
              {/* Horas extras RTM — fonte: Calc. Horas Extras */}
              <div className="contract-metrics-section-title">Horas extras (Calc. RTM)</div>

              {/* Hint: meses com dados RTM disponíveis */}
              {(!contractMetrics.colaboradores_detalhe?.some((c) => c.rtm_total_geral > 0)
                && contractMetrics.rtm_meses_disponiveis?.length > 0) && (
                <p className="contract-gastos-empty" style={{ background: '#fef8e6', borderLeft: '3px solid #e0c76a', padding: '8px 12px', marginBottom: 8 }}>
                  Sem dados RTM para {selectedMonth}. Disponível em:{' '}
                  {contractMetrics.rtm_meses_disponiveis.map((m, idx) => (
                    <button
                      key={m}
                      type="button"
                      className="button-ghost button-sm"
                      onClick={() => setSelectedMonth(m)}
                      style={{ padding: '0 4px', fontWeight: 700 }}
                    >
                      {m}{idx < contractMetrics.rtm_meses_disponiveis.length - 1 ? ',' : ''}
                    </button>
                  ))}
                </p>
              )}

              {/* Detalhe RTM por colaborador — apenas Colaborador + Valor */}
              {contractMetrics.colaboradores_detalhe?.some((c) => c.rtm_total_geral > 0) ? (
                <div className="contract-gastos-extras-card" style={{ marginTop: 8 }}>
                  <table className="contract-gastos-table">
                    <thead>
                      <tr>
                        <th>Colaborador</th>
                        <th style={{ textAlign: 'right' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contractMetrics.colaboradores_detalhe
                        .filter((c) => !c.is_fora_contrato && c.rtm_total_geral > 0)
                        .map((c) => (
                          <tr key={c.colaborador_id}>
                            <td>
                              {c.nome || '-'}
                              {c.vinculo_ativo === false && (
                                <span className="badge badge-danger" style={{ marginLeft: 6 }} title="Vínculo desativado no contrato — RTM contabilizado porque ocorreu no mês">
                                  Vínculo off
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(c.rtm_total_geral)}</td>
                          </tr>
                        ))}
                      <tr className="contract-gastos-table-footer">
                        <td><strong>Total horas extras</strong></td>
                        <td style={{ textAlign: 'right' }}>
                          <strong>{formatCurrency(contractMetrics.rtm_valor_total_geral)}</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="contract-gastos-empty">
                  Nenhuma hora extra (RTM) registrada para colaboradores deste contrato no mês.
                </p>
              )}

              {/* Gastos extras operacionais (variáveis também) */}
              <div className="contract-metrics-section-title">
                Gastos extras operacionais
                <button
                  className="button-ghost button-sm"
                  onClick={() => setShowGastosDetail((v) => !v)}
                  type="button"
                >
                  {showGastosDetail ? 'Ocultar detalhes' : 'Ver detalhes'}
                </button>
              </div>
              <div className="contract-gastos-extras-card">
                <div className="contract-gastos-extras-total">
                  <span>Total gastos extras</span>
                  <strong>{formatCurrency(contractMetrics.custos_extras_gold_linhas_mensais)}</strong>
                  <small>Descontado do resultado do contrato</small>
                </div>

                {(() => {
                  // Mostra: (a) gastos ativos com valor > 0 OU (b) inativos (informativos, não somam)
                  const linhasVisiveis = (contractMetrics.gastos_extras_linhas || []).filter(
                    (g) => Number(g.valor_mensal || 0) > 0 || g.colaborador_ativo === false,
                  )
                  if (!showGastosDetail) return null
                  if (linhasVisiveis.length === 0) {
                    return <p className="contract-gastos-empty">Nenhum gasto extra registrado para este mês.</p>
                  }
                  return (
                    <table className="contract-gastos-table">
                      <thead>
                        <tr>
                          <th>Descrição</th>
                          <th style={{ textAlign: 'right' }}>Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhasVisiveis.map((g) => {
                          const inativo = g.colaborador_ativo === false
                          return (
                            <tr key={g.id} style={inativo ? { opacity: 0.65 } : undefined}>
                              <td>
                                {g.nome_gasto}
                                {inativo && (
                                  <span className="badge badge-danger" style={{ marginLeft: 6 }} title="Colaborador inativo — registro mantido mas não conta no total">
                                    Inativo — não conta
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {inativo ? (
                                  <span style={{ textDecoration: 'line-through', color: '#888' }}>
                                    {formatCurrency(g.valor_mensal_calculado || 0)}
                                  </span>
                                ) : (
                                  formatCurrency(g.valor_mensal)
                                )}
                              </td>
                            </tr>
                          )
                        })}
                        <tr className="contract-gastos-table-footer">
                          <td><strong>Total</strong></td>
                          <td style={{ textAlign: 'right' }}>
                            <strong>{formatCurrency(contractMetrics.custos_extras_gold_linhas_mensais)}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  )
                })()}
              </div>
            </>
          )}

          {/* Resultado final (sempre visível) */}
          <div className="contract-metrics-section-title">Resultado</div>
          <div className="contract-metrics-grid contract-metrics-result">
            <article>
              <span>Custo total Gold</span>
              <strong>{formatCurrency(contractMetrics.custo_total_gold_real)}</strong>
              <small>Equipe + gastos extras</small>
            </article>

            <article className={`tone-${marginTone(contractMetrics.margem_contrato)}`}>
              <span>Margem do contrato</span>
              <strong>{formatCurrency(contractMetrics.margem_contrato)}</strong>
              <small>{formatPercent(contractMetrics.margem_percentual)} sobre o valor cobrado</small>
            </article>

            <article className={`tone-${accuracyTone(contractMetrics.acuracidade_valor)}`}>
              <span>Acurácia valor</span>
              <strong>{formatPercent(contractMetrics.acuracidade_valor)}</strong>
              <small>Custo real vs valor cobrado</small>
            </article>

            <article>
              <span>Valor por colaborador</span>
              <strong>{formatCurrency(contractMetrics.valor_por_colaborador_real)}</strong>
              <small>Ref. cadastro: {formatCurrency(contractMetrics.valor_por_colaborador)}</small>
            </article>
          </div>

          {/* Equação resumida */}
          <div className="contract-metrics-equation">
            <span className="eq-item">
              <small>Valor cobrado</small>
              <strong>{formatCurrency(contractMetrics.valor_mensal_contrato_itens)}</strong>
            </span>
            <span className="eq-op">−</span>
            <span className="eq-item">
              <small>Custo equipe</small>
              <strong>{formatCurrency(contractMetrics.custo_mensal_vinculos_contrato)}</strong>
            </span>
            <span className="eq-op">−</span>
            <span className="eq-item">
              <small>Gastos extras</small>
              <strong>{formatCurrency(contractMetrics.custos_extras_gold_mensais)}</strong>
            </span>
            <span className="eq-op">=</span>
            <span className={`eq-item eq-result tone-${marginTone(contractMetrics.margem_contrato)}`}>
              <small>Margem</small>
              <strong>{formatCurrency(contractMetrics.margem_contrato)}</strong>
            </span>
          </div>
        </>
      )}
    </div>
  ) : null

  return (
    <section className="page-shell">
      <div className="surface-card contratos-shell-tabbar">
        <div className="contratos-tab-group">
          <button
            className={`button-secondary${activeTab === 'contratos' ? ' active' : ''}`}
            onClick={() => setActiveTab('contratos')}
            type="button"
          >
            Contratos
          </button>
          <button
            className={`button-secondary${activeTab === 'equipe' ? ' active' : ''}`}
            disabled={!selectedContract}
            onClick={() => setActiveTab('equipe')}
            title={!selectedContract ? 'Selecione um contrato primeiro' : undefined}
            type="button"
          >
            Equipe e valores
          </button>
          <button
            className={`button-secondary${activeTab === 'gastos' ? ' active' : ''}`}
            disabled={!selectedContract}
            onClick={() => setActiveTab('gastos')}
            title={!selectedContract ? 'Selecione um contrato primeiro' : undefined}
            type="button"
          >
            Gastos extras
          </button>
        </div>

        {selectedContract && (
          <div className="contratos-selected-badge">
            <span className="eyebrow">Contrato selecionado</span>
            <strong>
              {selectedContract.codigo_contrato
                ? `${selectedContract.codigo_contrato} – `
                : ''}
              {selectedContract.nome_contrato}
            </strong>
          </div>
        )}
      </div>

      {activeTab === 'contratos' && (
        <>
          <ResourcePage
            config={resourceConfigs.contratos_operacionais}
            onSelectedItemChange={setSelectedContract}
          />
          {metricsPanel}
        </>
      )}

      {activeTab === 'equipe' && (
        <>
          <ResourcePage
            config={resourceConfigs.contratos_colaboradores}
            forcedFilters={contractForcedValues}
            forcedFormValues={contractForcedValues}
            onSaved={handleContractItemsChanged}
          />
          {metricsPanel}
        </>
      )}

      {activeTab === 'gastos' && (
        <>
          <ResourcePage
            config={resourceConfigs.contratos_gastos_extras}
            forcedFilters={contractForcedValues}
            forcedFormValues={contractForcedValues}
            onSaved={handleContractItemsChanged}
          />
          {metricsPanel}
        </>
      )}
    </section>
  )
}
/**
 * Tabela simplificada de contratos
 * Mostra apenas as informações ESSENCIAIS para facilitar leitura
 */
import { formatCurrency, formatPercent, marginTone, accuracyTone } from '../lib/formatters'

export default function ContractsTable({ contracts = [], showDetailed = false }) {
  if (contracts.length === 0) {
    return <div className="empty-state">Nenhum contrato ativo encontrado.</div>
  }

  return (
    <div className="table-wrap">
      <table className="costs-contract-table">
        <thead>
          <tr>
            <th>Contrato</th>
            <th>Base</th>
            <th>Valor</th>
            <th>Efetivo Real</th>
            <th>Custo Total</th>
            <th>Margem</th>
            <th>Acuracidade</th>
            {showDetailed && <th>Detalhes</th>}
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract) => (
            <tr key={contract.id}>
              <td>
                <strong>{contract.nome_contrato}</strong>
                <br />
                <small>{contract.codigo_contrato || '-'}</small>
              </td>
              <td>{contract.filial_nome}</td>
              <td>{formatCurrency(contract.valor_mensal_contrato_itens ?? contract.valor_mensal_contrato)}</td>
              <td>{contract.headcount_real || 0} pessoas</td>
              <td>{formatCurrency(contract.custo_total_gold_real)}</td>
              <td>
                <span className={`status-chip tone-${marginTone(contract.margem_contrato)}`}>
                  {formatCurrency(contract.margem_contrato)}
                </span>
              </td>
              <td>
                <span className={`status-chip tone-${accuracyTone(contract.acuracidade_valor)}`}>
                  {formatPercent(contract.acuracidade_valor)}
                </span>
              </td>
              {showDetailed && (
                <td>
                  <small>
                    Salário: {formatCurrency(contract.gasto_salario_mensal || 0)}
                    <br />
                    Benefícios: {formatCurrency(contract.gasto_beneficios_mensal || 0)}
                  </small>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Tabela simplificada de colaboradores
 * Mostra os dados essenciais de custo por colaborador
 */
import { formatCurrency, formatMinutes } from '../lib/formatters'

export default function CollaboratorsTable({ collaborators = [], search = '', onSearchChange = () => {} }) {
  const filteredColaborators = collaborators.filter((item) => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) return true

    return [item.nome_completo, item.cargo, item.filial_nome, item.turno]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch))
  })

  if (collaborators.length === 0) {
    return <div className="empty-state">Nenhum colaborador encontrado.</div>
  }

  return (
    <div className="collaborators-container">
      <div className="search-field-wrapper">
        <label className="field">
          <span>Buscar colaborador</span>
          <input
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Nome, cargo, base ou turno"
            value={search}
          />
        </label>
      </div>

      {filteredColaborators.length === 0 ? (
        <div className="empty-state">Nenhum resultado para sua busca.</div>
      ) : (
        <div className="table-wrap">
          <table className="costs-collaborator-table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Base</th>
                <th>Cargo</th>
                <th>Salário CLT</th>
                <th>Benefícios</th>
                <th>Custo Total</th>
                <th>Dias Presentes</th>
                <th>Custo/Dia</th>
              </tr>
            </thead>
            <tbody>
              {filteredColaborators.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.nome_completo}</strong>
                  </td>
                  <td>{item.filial_nome}</td>
                  <td>{item.cargo || '-'}</td>
                  <td>{formatCurrency(item.salario_clt_mensal)}</td>
                  <td>{formatCurrency(item.beneficios_mensais)}</td>
                  <td>
                    <strong>{formatCurrency(item.custo_mensal_total)}</strong>
                  </td>
                  <td>{item.dias_presente_mes || 0} dias</td>
                  <td>{formatCurrency(item.custo_dia_estimado || item.custo_mensal_total / 22)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

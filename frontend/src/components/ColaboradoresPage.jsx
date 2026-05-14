import { useMemo, useState } from 'react'
import CustosRhPage from './CustosRhPage'
import ResourcePage from './ResourcePage'
import { resourceConfigs } from './resourceConfigs'

export default function ColaboradoresPage() {
  const [activeTab, setActiveTab] = useState('cadastro')
  const [selectedCollaborator, setSelectedCollaborator] = useState(null)
  const collaboratorForcedValues = useMemo(() => {
    if (!selectedCollaborator) {
      return null
    }

    return {
      filial_id: selectedCollaborator.filial_id,
      colaborador_id: selectedCollaborator.id,
    }
  }, [selectedCollaborator])

  return (
    <section className="page-shell">
      <div className="surface-card colaboradores-shell-tabs">
        <button
          className={`button-secondary${activeTab === 'cadastro' ? ' active' : ''}`}
          onClick={() => setActiveTab('cadastro')}
          type="button"
        >
          Cadastro
        </button>
        <button
          className={`button-secondary${activeTab === 'custos' ? ' active' : ''}`}
          onClick={() => setActiveTab('custos')}
          type="button"
        >
          Custos e acuracidade
        </button>
      </div>

      {activeTab === 'cadastro' && (
        <>
          <ResourcePage
            config={resourceConfigs.colaboradores}
            embedded
            onSelectedItemChange={setSelectedCollaborator}
          />

          {selectedCollaborator ? (
            <ResourcePage
              config={resourceConfigs.colaborador_beneficios}
              embedded
              forcedFilters={collaboratorForcedValues}
              forcedFormValues={collaboratorForcedValues}
            />
          ) : (
            <div className="surface-card empty-state">
              Selecione um colaborador para ver e editar os benefícios.
            </div>
          )}
        </>
      )}
      {activeTab === 'custos' && <CustosRhPage embedded />}
    </section>
  )
}

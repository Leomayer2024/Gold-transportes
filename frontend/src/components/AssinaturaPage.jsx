import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

const STATUS_LABELS = {
  trial: 'Avaliação gratuita',
  ativa: 'Ativa',
  inadimplente: 'Inadimplente',
  cancelada: 'Cancelada',
  gratuita: 'Gratuita',
}

const STATUS_TONE = {
  trial: 'warning',
  ativa: 'success',
  inadimplente: 'danger',
  cancelada: 'danger',
  gratuita: 'success',
}

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

export default function AssinaturaPage() {
  const { profile, assinaturaStatus, assinaturaDiasTrial, refreshProfile } = useAuth()
  const [assinatura, setAssinatura] = useState(null)
  const [planos, setPlanos] = useState([])
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isSuperAdmin = Boolean(profile?.is_super_admin)

  useEffect(() => {
    const checkout = searchParams.get('checkout')
    if (checkout === 'success') {
      setSuccessMsg('Assinatura confirmada! Bem-vindo ao plano pago.')
      void refreshProfile()
      navigate('/assinatura', { replace: true })
    } else if (checkout === 'cancel') {
      setError('Checkout cancelado. Nenhuma cobrança foi realizada.')
      navigate('/assinatura', { replace: true })
    }
  }, [searchParams, navigate, refreshProfile])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const [ass, pls] = await Promise.all([api.getAssinatura(), api.getPlanos()])
        if (!active) return
        setAssinatura(ass)
        setPlanos(pls)
      } catch (err) {
        if (active) setError(err.message || 'Erro ao carregar dados de assinatura.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  async function handleCheckout(planoId) {
    setCheckoutLoading(planoId)
    setError('')
    try {
      const { checkout_url } = await api.criarCheckout(planoId)
      window.location.href = checkout_url
    } catch (err) {
      setError(err.message || 'Erro ao iniciar checkout.')
      setCheckoutLoading(null)
    }
  }

  async function handlePortal() {
    setPortalLoading(true)
    setError('')
    try {
      const { portal_url } = await api.abrirPortal()
      window.location.href = portal_url
    } catch (err) {
      setError(err.message || 'Erro ao abrir portal de assinatura.')
      setPortalLoading(false)
    }
  }

  const statusTone = STATUS_TONE[assinaturaStatus] || 'neutral'
  const statusLabel = STATUS_LABELS[assinaturaStatus] || assinaturaStatus || '—'

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">SaaS</span>
          <h1>Assinatura</h1>
          <p>Gerencie o plano e a cobrança do sistema.</p>
        </div>
      </div>

      {successMsg && <div className="alert-success">{successMsg}</div>}
      {error && <div className="alert-error">{error}</div>}

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : (
        <div className="page-grid">

          {/* Status atual */}
          <div className="surface-card">
            <div className="section-title">
              <span className="eyebrow">Plano atual</span>
              <h2>{assinatura?.plano_nome || '—'}</h2>
            </div>

            <div className="detail-grid">
              <div className="detail-field">
                <span>Status</span>
                <div className="readonly-box">
                  <span className={`status-chip tone-${statusTone}`}>{statusLabel}</span>
                </div>
              </div>

              {assinaturaStatus === 'trial' && assinaturaDiasTrial !== null && (
                <div className="detail-field">
                  <span>Dias restantes</span>
                  <div className="readonly-box">
                    <strong>{assinaturaDiasTrial <= 0 ? 'Encerrado' : `${assinaturaDiasTrial} dias`}</strong>
                  </div>
                </div>
              )}

              {assinatura?.current_period_end && (
                <div className="detail-field">
                  <span>Próxima renovação</span>
                  <div className="readonly-box">{assinatura.current_period_end}</div>
                </div>
              )}

              {assinatura?.max_colaboradores && (
                <div className="detail-field">
                  <span>Limite colaboradores</span>
                  <div className="readonly-box">{assinatura.max_colaboradores}</div>
                </div>
              )}

              {assinatura?.max_filiais && (
                <div className="detail-field">
                  <span>Limite filiais</span>
                  <div className="readonly-box">{assinatura.max_filiais}</div>
                </div>
              )}
            </div>

            {isSuperAdmin && assinatura?.stripe_customer_id && (
              <div className="button-row" style={{ marginTop: '1rem' }}>
                <button
                  className="button-secondary"
                  disabled={portalLoading}
                  onClick={handlePortal}
                  type="button"
                >
                  {portalLoading ? 'Abrindo...' : 'Gerenciar assinatura (Stripe)'}
                </button>
              </div>
            )}
          </div>

          {/* Planos disponíveis */}
          {isSuperAdmin && planos.length > 0 && (
            <div className="surface-card">
              <div className="section-title">
                <span className="eyebrow">Upgrade</span>
                <h2>Planos disponíveis</h2>
              </div>

              <div className="planos-grid">
                {planos.map((plano) => (
                  <div className="plano-card" key={plano.id}>
                    <strong className="plano-nome">{plano.nome}</strong>
                    {plano.descricao && <p className="plano-descricao">{plano.descricao}</p>}
                    <div className="plano-preco">
                      {plano.preco_mensal_brl > 0 ? (
                        <>{formatBRL(plano.preco_mensal_brl)}<span>/mês</span></>
                      ) : (
                        <span>Gratuito</span>
                      )}
                    </div>
                    <ul className="plano-features">
                      <li>Até {plano.max_colaboradores} colaboradores</li>
                      <li>Até {plano.max_filiais} filiais</li>
                    </ul>
                    {plano.stripe_price_id ? (
                      <button
                        className="button-primary"
                        disabled={checkoutLoading === plano.id}
                        onClick={() => handleCheckout(plano.id)}
                        type="button"
                      >
                        {checkoutLoading === plano.id ? 'Aguarde...' : 'Assinar'}
                      </button>
                    ) : (
                      <span className="field-help-text">Stripe não configurado</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isSuperAdmin && (
            <div className="surface-card">
              <div className="empty-state">Apenas o administrador pode gerenciar planos e cobrança.</div>
            </div>
          )}

        </div>
      )}
    </section>
  )
}

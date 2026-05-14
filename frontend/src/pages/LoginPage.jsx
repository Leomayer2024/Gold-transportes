import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { session, login, authError } = useAuth()
  const location = useLocation()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (session) {
    return <Navigate to={location.state?.from ?? '/dashboard'} replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      await login(formData.email, formData.password)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-showcase">
        <span className="eyebrow">SEG</span>
        <h1>Painel web para operação, pessoas e frota</h1>
        <p>
          Login Supabase, controle de permissões e navegação lateral intuitiva para equipe,
          veículos, documentos, horas extras e ocorrências.
        </p>

        <div className="showcase-grid">
          <div className="showcase-card">
            <strong>Fluxo único</strong>
            <span>Autenticação centralizada e API Flask desacoplada.</span>
          </div>
          <div className="showcase-card">
            <strong>Visual claro</strong>
            <span>Paleta pastel com dourado, branco, preto e superfícies suaves.</span>
          </div>
          <div className="showcase-card">
            <strong>Estrutura pronta</strong>
            <span>Menu expansível e CRUD para os módulos principais do schema.</span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="panel-header">
          <span className="brand-chip">Acesso</span>
          <h2>Entrar no sistema</h2>
          <p>Use o e-mail e senha do usuário criado no Supabase Auth.</p>
        </div>

        <form className="panel-form" onSubmit={handleSubmit}>
          {authError ? <div className="alert error">{authError}</div> : null}

          <label>
            <span>E-mail</span>
            <input
              type="email"
              placeholder="voce@empresa.com"
              value={formData.email}
              onChange={(event) =>
                setFormData((current) => ({ ...current, email: event.target.value }))
              }
              required
            />
          </label>

          <label>
            <span>Senha</span>
            <input
              type="password"
              placeholder="Sua senha"
              value={formData.password}
              onChange={(event) =>
                setFormData((current) => ({ ...current, password: event.target.value }))
              }
              required
            />
          </label>

          {error ? <div className="alert error">{error}</div> : null}

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Acessar painel'}
          </button>
        </form>
      </section>
    </div>
  )
}
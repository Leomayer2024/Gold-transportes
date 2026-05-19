import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import fotoLogin from '../../assets/foto_login.png'
import gLogo from '../../assets/g_logo.png'
import logoGold from '../../assets/logo_gold.png'

export default function LoginPage() {
  const { signIn, isAuthenticated, authError, initializing } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const redirectTo = location.state?.from?.pathname || '/dashboard'

  useEffect(() => {
    setErrorMessage(authError)
  }, [authError])

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage('')

    try {
      await signIn(email, password)
    } catch (error) {
      setErrorMessage(error.message || 'Falha no login.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!initializing && isAuthenticated) {
    return <Navigate to={redirectTo} replace />
  }

  return (
    <div className="login-page">
      <section className="login-showcase" style={{ backgroundImage: `linear-gradient(135deg, rgba(12, 16, 21, 0.8), rgba(64, 44, 6, 0.52)), url(${fotoLogin})` }}>
        <div className="login-showcase-logo-wrap">
          <img alt="Gold Transportes" className="login-showcase-logo" src={logoGold} />
        </div>

        <div className="login-showcase-copy">
          <span className="eyebrow login-showcase-eyebrow">SEG</span>
          <h1>Painel operacional da Gold Transportes</h1>
          <p>Base, pessoas, frota e carregamento concentrados em uma entrada única e visualmente alinhada com a marca.</p>
        </div>

        <div className="showcase-grid">
          <div className="showcase-card">
            <strong>Operação</strong>
            <span>Controle das bases e do turno em um só ambiente.</span>
          </div>
          <div className="showcase-card">
            <strong>Frota</strong>
            <span>Visual conectado ao dia a dia dos caminhões da empresa.</span>
          </div>
          <div className="showcase-card">
            <strong>Acesso</strong>
            <span>Entrada rápida para a equipe com identidade visual própria.</span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card surface-card login-card-brand" onSubmit={handleSubmit}>
          <div className="section-title login-section-title">
            <img alt="Símbolo Gold" className="login-g-logo" src={gLogo} />
            <span className="eyebrow">Autenticação</span>
            <h2>Acessar sistema</h2>
            <p className="login-panel-text">Entre com o usuário autorizado para acessar o painel interno da operação.</p>
          </div>

          <label className="field">
            <span>E-mail</span>
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="usuario@empresa.com"
              type="email"
              value={email}
            />
          </label>

          <label className="field">
            <span>Senha</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sua senha"
              type="password"
              value={password}
            />
          </label>

          {errorMessage && <div className="alert-error">{errorMessage}</div>}

          <button className="button-primary" disabled={submitting} type="submit">
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>

          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <Link to="/recuperar-senha" style={{ fontSize: 12 }}>
              Esqueci minha senha
            </Link>
          </div>
        </form>
      </section>
    </div>
  )
}

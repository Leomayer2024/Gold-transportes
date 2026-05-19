import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import fotoLogin from '../../assets/foto_login.png'
import gLogo from '../../assets/g_logo.png'
import logoGold from '../../assets/logo_gold.png'

// Recuperação de senha em 3 etapas usando código OTP enviado por SMTP
// do nosso backend (não usa Supabase Auth recovery, porque o e-mail do
// auth.users é fictício e a pessoa não tem acesso a ele).
//
//   Etapa 1 — usuário informa o e-mail do login + Gmail pra receber
//   Etapa 2 — usuário digita o código de 6 dígitos
//   Etapa 3 — usuário define a nova senha
export default function RecuperarSenhaPage() {
  const { isAuthenticated, initializing } = useAuth()
  const navigate = useNavigate()

  const [etapa, setEtapa] = useState(1)
  const [emailLogin, setEmailLogin] = useState('')
  const [emailDestino, setEmailDestino] = useState('')
  const [codigo, setCodigo] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')

  const [aguardando, setAguardando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  if (!initializing && isAuthenticated && etapa !== 'sucesso') {
    return <Navigate to="/dashboard" replace />
  }

  async function enviarCodigo(event) {
    event.preventDefault()
    if (!emailLogin.trim() || !emailLogin.includes('@')) {
      setErro('Informe seu e-mail de login válido.')
      return
    }
    if (!emailDestino.trim() || !emailDestino.includes('@')) {
      setErro('Informe um Gmail válido para receber o código.')
      return
    }
    setAguardando(true)
    setErro('')
    setAviso('')
    try {
      await api.post('/recuperar-senha/enviar-codigo', {
        email_login: emailLogin.trim().toLowerCase(),
        email_destino: emailDestino.trim(),
      })
      setAviso(`Código enviado para ${emailDestino}. Cheque sua caixa (e o spam).`)
      setEtapa(2)
    } catch (e) {
      setErro(e.message || 'Falha ao enviar código.')
    } finally {
      setAguardando(false)
    }
  }

  async function validarCodigo(event) {
    event.preventDefault()
    if (!/^\d{6}$/.test(codigo.trim())) {
      setErro('O código tem 6 dígitos numéricos.')
      return
    }
    setAguardando(true)
    setErro('')
    try {
      const res = await api.post('/recuperar-senha/validar-codigo', {
        email_login: emailLogin.trim().toLowerCase(),
        codigo: codigo.trim(),
      })
      if (!res?.reset_token) throw new Error('Resposta inválida do servidor.')
      setResetToken(res.reset_token)
      setEtapa(3)
    } catch (e) {
      setErro(e.message || 'Código inválido.')
    } finally {
      setAguardando(false)
    }
  }

  async function redefinirSenha(event) {
    event.preventDefault()
    if (!novaSenha || novaSenha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (novaSenha !== confirmacao) {
      setErro('A confirmação não bate com a nova senha.')
      return
    }
    setAguardando(true)
    setErro('')
    try {
      await api.post('/recuperar-senha/redefinir', {
        reset_token: resetToken,
        nova_senha: novaSenha,
      })
      setEtapa('sucesso')
    } catch (e) {
      setErro(e.message || 'Falha ao redefinir.')
    } finally {
      setAguardando(false)
    }
  }

  async function reenviarCodigo() {
    setCodigo('')
    setErro('')
    setAviso('')
    setAguardando(true)
    try {
      await api.post('/recuperar-senha/enviar-codigo', {
        email_login: emailLogin.trim().toLowerCase(),
        email_destino: emailDestino.trim(),
      })
      setAviso(`Novo código enviado para ${emailDestino}.`)
    } catch (e) {
      setErro(e.message || 'Falha ao reenviar.')
    } finally {
      setAguardando(false)
    }
  }

  return (
    <div className="login-page">
      <section
        className="login-showcase"
        style={{ backgroundImage: `linear-gradient(135deg, rgba(12, 16, 21, 0.8), rgba(64, 44, 6, 0.52)), url(${fotoLogin})` }}
      >
        <div className="login-showcase-logo-wrap">
          <img alt="Gold Transportes" className="login-showcase-logo" src={logoGold} />
        </div>
        <div className="login-showcase-copy">
          <span className="eyebrow login-showcase-eyebrow">SEG</span>
          <h1>Recuperar acesso</h1>
          <p>Esqueceu sua senha? A gente envia um código pro seu Gmail pra você redefinir em segundos.</p>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card surface-card login-card-brand">
          <div className="section-title login-section-title">
            <img alt="Símbolo Gold" className="login-g-logo" src={gLogo} />
            <span className="eyebrow">Recuperação</span>
            <h2>
              {etapa === 1 && 'Esqueci minha senha'}
              {etapa === 2 && 'Confirme o código'}
              {etapa === 3 && 'Defina a nova senha'}
              {etapa === 'sucesso' && 'Pronto!'}
            </h2>
            <PassoIndicador etapa={etapa} />
          </div>

          {etapa === 1 && (
            <form onSubmit={enviarCodigo}>
              <label className="field">
                <span>E-mail de login (o que você usa pra entrar)</span>
                <input
                  autoComplete="username"
                  autoFocus
                  onChange={(e) => setEmailLogin(e.target.value)}
                  placeholder="usuario@empresa.com"
                  type="email"
                  value={emailLogin}
                />
              </label>
              <label className="field">
                <span>Gmail pessoal (onde quer receber o código)</span>
                <input
                  autoComplete="email"
                  onChange={(e) => setEmailDestino(e.target.value)}
                  placeholder="seunome@gmail.com"
                  type="email"
                  value={emailDestino}
                />
              </label>
              {erro && <div className="alert-error">{erro}</div>}
              {aviso && <div className="alert-success">{aviso}</div>}
              <button
                className="button-primary"
                disabled={aguardando}
                type="submit"
                style={{ width: '100%', marginTop: 8 }}
              >
                {aguardando ? 'Enviando código…' : 'Enviar código'}
              </button>
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <Link to="/login" style={{ fontSize: 12 }}>← Voltar pro login</Link>
              </div>
            </form>
          )}

          {etapa === 2 && (
            <form onSubmit={validarCodigo}>
              <p style={{ fontSize: 12, color: 'var(--text-muted, #666)', marginBottom: 10 }}>
                Enviamos um código de 6 dígitos para <strong>{emailDestino}</strong>.
                Cheque a caixa de entrada e a pasta de spam.
              </p>
              <label className="field">
                <span>Código (6 dígitos)</span>
                <input
                  autoComplete="one-time-code"
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  type="text"
                  value={codigo}
                  style={{ fontSize: 20, letterSpacing: 4, textAlign: 'center', fontFamily: 'monospace' }}
                />
              </label>
              {erro && <div className="alert-error">{erro}</div>}
              {aviso && <div className="alert-success">{aviso}</div>}
              <button
                className="button-primary"
                disabled={aguardando || codigo.length !== 6}
                type="submit"
                style={{ width: '100%', marginTop: 8 }}
              >
                {aguardando ? 'Validando…' : 'Validar código'}
              </button>
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <button
                  type="button"
                  className="button-link"
                  onClick={() => { setEtapa(1); setCodigo(''); setErro(''); setAviso('') }}
                >
                  ← Trocar dados
                </button>
                <button
                  type="button"
                  className="button-link"
                  onClick={reenviarCodigo}
                  disabled={aguardando}
                >
                  Reenviar código
                </button>
              </div>
            </form>
          )}

          {etapa === 3 && (
            <form onSubmit={redefinirSenha}>
              <p style={{ fontSize: 12, color: 'var(--text-muted, #666)', marginBottom: 10 }}>
                Código validado. Defina uma nova senha — pelo menos 6 caracteres.
              </p>
              <label className="field">
                <span>Nova senha</span>
                <input
                  autoComplete="new-password"
                  autoFocus
                  minLength={6}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  value={novaSenha}
                />
              </label>
              <label className="field">
                <span>Confirmar nova senha</span>
                <input
                  autoComplete="new-password"
                  minLength={6}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  value={confirmacao}
                />
              </label>
              {erro && <div className="alert-error">{erro}</div>}
              <button
                className="button-primary"
                disabled={aguardando}
                type="submit"
                style={{ width: '100%', marginTop: 8 }}
              >
                {aguardando ? 'Salvando…' : 'Redefinir senha'}
              </button>
            </form>
          )}

          {etapa === 'sucesso' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <p style={{ fontSize: 14, marginBottom: 16 }}>
                Senha redefinida com sucesso!<br />Faça login com a nova senha.
              </p>
              <button
                type="button"
                className="button-primary"
                onClick={() => navigate('/login', { replace: true })}
                style={{ width: '100%' }}
              >
                Ir para o login
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function PassoIndicador({ etapa }) {
  const n = etapa === 'sucesso' ? 3 : etapa
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
      {[1, 2, 3].map((p) => (
        <div
          key={p}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: n >= p ? 'var(--primary, #c49512)' : 'var(--border, #ddd)',
            transition: 'background 0.2s',
          }}
        />
      ))}
    </div>
  )
}

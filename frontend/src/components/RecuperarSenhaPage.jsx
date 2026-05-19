import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import fotoLogin from '../../assets/foto_login.png'
import gLogo from '../../assets/g_logo.png'
import logoGold from '../../assets/logo_gold.png'

// Recuperação de senha em 3 etapas usando OTP nativo do Supabase:
//   1) Usuário informa o e-mail   → Supabase envia código de 6 dígitos
//   2) Usuário digita o código    → Supabase valida e abre sessão de recovery
//   3) Usuário define nova senha  → updateUser({ password })
export default function RecuperarSenhaPage() {
  const { isAuthenticated, initializing } = useAuth()
  const navigate = useNavigate()

  const [etapa, setEtapa] = useState(1) // 1 | 2 | 3 | 'sucesso'
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')

  const [aguardando, setAguardando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  // Se já está logado, manda pra dashboard
  if (!initializing && isAuthenticated && etapa !== 'sucesso') {
    return <Navigate to="/dashboard" replace />
  }

  async function enviarCodigo(event) {
    event.preventDefault()
    if (!email.trim()) {
      setErro('Informe seu e-mail.')
      return
    }
    setAguardando(true)
    setErro('')
    setAviso('')
    try {
      // resetPasswordForEmail envia um e-mail com OTP de 6 dígitos
      // (o Supabase usa o template de "recovery" por padrão).
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        // redirectTo é opcional — não usamos link, só o código
      })
      if (error) throw error
      setAviso(`Código enviado para ${email}. Cheque sua caixa de entrada (e o spam).`)
      setEtapa(2)
    } catch (e) {
      setErro(traduzirErro(e))
    } finally {
      setAguardando(false)
    }
  }

  async function validarCodigo(event) {
    event.preventDefault()
    if (!codigo.trim()) {
      setErro('Informe o código recebido por e-mail.')
      return
    }
    if (!/^\d{6}$/.test(codigo.trim())) {
      setErro('O código tem 6 dígitos numéricos.')
      return
    }
    setAguardando(true)
    setErro('')
    try {
      // verifyOtp com type='recovery' abre uma sessão temporária que permite
      // chamar updateUser({ password }) em seguida.
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: codigo.trim(),
        type: 'recovery',
      })
      if (error) throw error
      setEtapa(3)
    } catch (e) {
      setErro(traduzirErro(e))
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
      const { error } = await supabase.auth.updateUser({ password: novaSenha })
      if (error) throw error
      // Encerra a sessão de recovery — usuário precisa logar com a nova senha
      try { await supabase.auth.signOut() } catch {}
      setEtapa('sucesso')
    } catch (e) {
      setErro(traduzirErro(e))
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
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
      if (error) throw error
      setAviso(`Novo código enviado para ${email}.`)
    } catch (e) {
      setErro(traduzirErro(e))
    } finally {
      setAguardando(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-showcase" style={{ backgroundImage: `linear-gradient(135deg, rgba(12, 16, 21, 0.8), rgba(64, 44, 6, 0.52)), url(${fotoLogin})` }}>
        <div className="login-showcase-logo-wrap">
          <img alt="Gold Transportes" className="login-showcase-logo" src={logoGold} />
        </div>
        <div className="login-showcase-copy">
          <span className="eyebrow login-showcase-eyebrow">SEG</span>
          <h1>Recuperar acesso</h1>
          <p>Esqueceu sua senha? A gente envia um código pro seu e-mail e você redefine em segundos.</p>
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

          {/* ── Etapa 1: e-mail ── */}
          {etapa === 1 && (
            <form onSubmit={enviarCodigo}>
              <label className="field">
                <span>E-mail cadastrado</span>
                <input
                  autoComplete="email"
                  autoFocus
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  type="email"
                  value={email}
                />
              </label>
              {erro && <div className="alert-error">{erro}</div>}
              {aviso && <div className="alert-success">{aviso}</div>}
              <button className="button-primary" disabled={aguardando} type="submit" style={{ width: '100%', marginTop: 8 }}>
                {aguardando ? 'Enviando código…' : 'Enviar código por e-mail'}
              </button>
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <Link to="/login" style={{ fontSize: 12 }}>← Voltar pro login</Link>
              </div>
            </form>
          )}

          {/* ── Etapa 2: código ── */}
          {etapa === 2 && (
            <form onSubmit={validarCodigo}>
              <p style={{ fontSize: 12, color: 'var(--text-muted, #666)', marginBottom: 10 }}>
                Enviamos um código de 6 dígitos para <strong>{email}</strong>.
                Cheque sua caixa de entrada e a pasta de spam.
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
              <button className="button-primary" disabled={aguardando || codigo.length !== 6} type="submit" style={{ width: '100%', marginTop: 8 }}>
                {aguardando ? 'Validando…' : 'Validar código'}
              </button>
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <button type="button" className="button-link" onClick={() => { setEtapa(1); setCodigo(''); setErro(''); setAviso('') }}>
                  ← Trocar e-mail
                </button>
                <button type="button" className="button-link" onClick={reenviarCodigo} disabled={aguardando}>
                  Reenviar código
                </button>
              </div>
            </form>
          )}

          {/* ── Etapa 3: nova senha ── */}
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
              <button className="button-primary" disabled={aguardando} type="submit" style={{ width: '100%', marginTop: 8 }}>
                {aguardando ? 'Salvando…' : 'Redefinir senha'}
              </button>
            </form>
          )}

          {/* ── Sucesso ── */}
          {etapa === 'sucesso' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <p style={{ fontSize: 14, marginBottom: 16 }}>
                Senha redefinida com sucesso!<br />
                Faça login com a sua nova senha.
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

// Mensagens do Supabase em inglês → português amigável
function traduzirErro(e) {
  const msg = String(e?.message || e || '').toLowerCase()
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Muitas tentativas. Aguarde alguns minutos antes de tentar de novo.'
  }
  if (msg.includes('invalid otp') || msg.includes('token is invalid') || msg.includes('expired')) {
    return 'Código inválido ou expirado. Solicite um novo e tente novamente.'
  }
  if (msg.includes('user not found') || msg.includes('no user')) {
    return 'Não encontramos um usuário com esse e-mail.'
  }
  if (msg.includes('password should be') || msg.includes('password is too short')) {
    return 'A senha precisa ter pelo menos 6 caracteres.'
  }
  if (msg.includes('email rate limit') || msg.includes('email send')) {
    return 'Limite de envio de e-mail atingido. Tente novamente em alguns minutos.'
  }
  return e?.message || 'Falha inesperada. Tente novamente.'
}

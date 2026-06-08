import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

const TOKEN_KEY = 'seg-cliente-token'
const CLIENTE_KEY = 'seg-cliente-info'

// Cores espelhando a paleta principal (gold + tons neutros)
const C = {
  primary: '#c49512',
  primaryDark: '#a07c0c',
  primaryLight: '#f5e8a8',
  primaryText: '#3a2800',
  ink: '#1a2533',
  muted: '#5a6a7a',
  border: '#c0cad5',
  bg: '#e4eaf2',
  surface: '#ffffff',
  success: '#2a6e47',
  successBg: '#edf8f2',
  warning: '#8a5c00',
  warningBg: '#fef8e6',
  danger: '#b83c30',
  dangerBg: '#fdf0ef',
}

// ─── Login ────────────────────────────────────────────────────────────────
function LoginScreen({ onLogged }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setErr(''); setLoading(true)
    try {
      const r = await api.clienteLogin(email.trim(), senha)
      sessionStorage.setItem(TOKEN_KEY, r.token)
      sessionStorage.setItem(CLIENTE_KEY, JSON.stringify(r.cliente))
      onLogged(r.token, r.cliente)
    } catch (e) {
      setErr(e.message || 'Falha no login.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(135deg, ${C.bg} 0%, #d0d8e3 100%)`,
      padding: 20,
    }}>
      <div style={{
        background: C.surface,
        borderRadius: 16,
        padding: '36px 32px',
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        borderTop: `5px solid ${C.primary}`,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: C.primary,
            letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6,
          }}>Portal do Cliente</div>
          <h1 style={{ margin: 0, fontSize: 22, color: C.ink, fontWeight: 800 }}>
            SEG — Gold Transportes
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted }}>
            Aprovação de horas extras vinculadas à sua operação.
          </p>
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              E-mail
            </span>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              style={{
                padding: '10px 12px', fontSize: 14,
                border: `1px solid ${C.border}`, borderRadius: 8,
                background: '#fff',
              }}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Senha
            </span>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••"
              style={{
                padding: '10px 12px', fontSize: 14,
                border: `1px solid ${C.border}`, borderRadius: 8,
                background: '#fff',
              }}
            />
          </label>

          {err && (
            <div style={{
              padding: '10px 12px', fontSize: 13, borderRadius: 8,
              background: C.dangerBg, color: C.danger, border: `1px solid ${C.danger}33`,
            }}>{err}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 18px', fontSize: 14, fontWeight: 700,
              background: C.primary, color: C.primaryText,
              border: 'none', borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background .15s',
            }}
            onMouseEnter={(e) => !loading && (e.target.style.background = C.primaryDark)}
            onMouseLeave={(e) => !loading && (e.target.style.background = C.primary)}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p style={{ marginTop: 18, fontSize: 11, color: C.muted, textAlign: 'center' }}>
          Não tem acesso? Contate o gestor responsável pelo seu contrato.
        </p>
      </div>
    </div>
  )
}

// ─── Dashboard (HE pendentes do cliente) ───────────────────────────────────
function Dashboard({ token, cliente, onLogout }) {
  const [aba, setAba] = useState('pendentes')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [processando, setProcessando] = useState(false)
  const [modal, setModal] = useState(null)  // {he, acao}
  const [motivo, setMotivo] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const status = aba === 'pendentes' ? 'pendente' : aba === 'aprovadas' ? 'aprovado' : 'reprovado'
      const r = await api.clienteRequest(`/cliente/horas-extras?status=${status}`, token)
      setItems(r.items || [])
    } catch (e) {
      if (String(e.message).includes('401') || String(e.message).toLowerCase().includes('sessão')) {
        onLogout()
      } else {
        setErr(e.message || 'Erro ao carregar.')
      }
    } finally {
      setLoading(false)
    }
  }, [aba, token, onLogout])

  useEffect(() => { carregar() }, [carregar])

  async function confirmar() {
    if (!modal) return
    if (modal.acao === 'reprovar' && !motivo.trim()) {
      setErr('Informe o motivo da reprovação.')
      return
    }
    setProcessando(true); setErr('')
    try {
      if (modal.acao === 'aprovar') {
        await api.clienteRequest(`/cliente/horas-extras/${modal.he.id}/aprovar`, token, { method: 'POST' })
      } else {
        await api.clienteRequest(`/cliente/horas-extras/${modal.he.id}/reprovar`, token, {
          method: 'POST', body: JSON.stringify({ motivo: motivo.trim() }),
        })
      }
      setModal(null); setMotivo('')
      carregar()
    } catch (e) {
      setErr(e.message || 'Erro ao processar.')
    } finally {
      setProcessando(false)
    }
  }

  function logout() {
    api.clienteRequest('/cliente/logout', token, { method: 'POST' }).catch(() => {})
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(CLIENTE_KEY)
    onLogout()
  }

  const pendCount = aba === 'pendentes' ? items.length : '·'

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.ink }}>
      {/* Header */}
      <header style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.primary, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Portal do Cliente
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.ink, marginTop: 2 }}>
            {cliente?.nome || 'Cliente'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: C.muted }}>
            {cliente?.email_login}
          </span>
          <button
            onClick={logout}
            style={{
              padding: '7px 14px', fontSize: 12, fontWeight: 700,
              background: '#fff', color: C.danger, border: `1px solid ${C.danger}`,
              borderRadius: 8, cursor: 'pointer',
            }}
          >Sair</button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '22px 24px' }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.ink }}>
            Aprovação de Horas Extras
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>
            HE solicitadas pela Gold em atividades da sua operação. Etapa final — aprove ou reprove.
          </p>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { key: 'pendentes', label: 'Pendentes', color: C.warning, bg: C.warningBg },
            { key: 'aprovadas', label: 'Aprovadas', color: C.success, bg: C.successBg },
            { key: 'reprovadas', label: 'Reprovadas', color: C.danger, bg: C.dangerBg },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setAba(t.key)}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 700,
                border: aba === t.key ? `2px solid ${t.color}` : `1px solid ${C.border}`,
                background: aba === t.key ? t.bg : '#fff',
                color: aba === t.key ? t.color : C.muted,
                borderRadius: 8, cursor: 'pointer',
              }}
            >
              {t.label} {aba === t.key && `(${pendCount})`}
            </button>
          ))}
        </div>

        {err && (
          <div style={{
            padding: '10px 14px', marginBottom: 14, fontSize: 13,
            background: C.dangerBg, color: C.danger, borderRadius: 8,
            border: `1px solid ${C.danger}33`,
          }}>{err}</div>
        )}

        {/* Lista */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>⏳ Carregando...</div>
        ) : items.length === 0 ? (
          <div style={{
            padding: 60, textAlign: 'center', color: C.muted,
            background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
          }}>
            {aba === 'pendentes' ? '✓ Nenhuma HE pendente de aprovação no momento.' : 'Sem registros.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((he) => (
              <div key={he.id} style={{
                background: C.surface, borderRadius: 12,
                border: `1px solid ${C.border}`, padding: 16,
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    {he.numero_solicitacao && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, fontFamily: 'monospace' }}>
                        #{he.numero_solicitacao}
                      </span>
                    )}
                    <span style={{
                      fontSize: 18, fontWeight: 800, color: C.primary,
                    }}>{Number(he.qtd_horas || 0).toFixed(1)}h</span>
                    <span style={{ fontSize: 13, color: C.muted }}>
                      {he.data_solicitacao && new Date(he.data_solicitacao).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
                    {he.colaboradores?.nome_completo || `Colaborador #${he.colaborador_id}`}
                    {he.colaboradores?.cargo && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: C.muted, marginLeft: 8 }}>
                        ({he.colaboradores.cargo})
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.45 }}>
                    {he.motivo}
                  </div>
                  {he.aprovado_lider_em && (
                    <div style={{ fontSize: 11, color: C.success, marginTop: 6 }}>
                      ✓ Líder Gold aprovou em {new Date(he.aprovado_lider_em).toLocaleString('pt-BR')}
                    </div>
                  )}
                  {he.status === 'reprovado' && he.justificativa_gestor && (
                    <div style={{ fontSize: 11, color: C.danger, marginTop: 6, fontStyle: 'italic' }}>
                      Motivo: {he.justificativa_gestor}
                    </div>
                  )}
                </div>
                {aba === 'pendentes' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140 }}>
                    <button
                      onClick={() => { setModal({ he, acao: 'aprovar' }); setMotivo('') }}
                      style={{
                        padding: '9px 14px', fontSize: 13, fontWeight: 700,
                        background: C.success, color: '#fff',
                        border: 'none', borderRadius: 8, cursor: 'pointer',
                      }}
                    >✓ Aprovar</button>
                    <button
                      onClick={() => { setModal({ he, acao: 'reprovar' }); setMotivo('') }}
                      style={{
                        padding: '9px 14px', fontSize: 13, fontWeight: 700,
                        background: '#fff', color: C.danger,
                        border: `1px solid ${C.danger}`, borderRadius: 8, cursor: 'pointer',
                      }}
                    >✕ Reprovar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal confirmação */}
      {modal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, zIndex: 1000,
          }}
          onClick={!processando ? () => { setModal(null); setMotivo('') } : undefined}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 14, padding: 24,
              maxWidth: 520, width: '100%',
              borderTop: `5px solid ${modal.acao === 'aprovar' ? C.success : C.danger}`,
              boxShadow: '0 20px 60px rgba(0,0,0,.25)',
            }}
          >
            <h2 style={{
              margin: '0 0 12px', fontSize: 18, fontWeight: 800,
              color: modal.acao === 'aprovar' ? C.success : C.danger,
            }}>
              {modal.acao === 'aprovar' ? '✓ Confirmar aprovação' : '✕ Confirmar reprovação'}
            </h2>
            <div style={{ fontSize: 13, color: C.ink, marginBottom: 12 }}>
              <strong>{Number(modal.he.qtd_horas).toFixed(1)}h</strong> — {modal.he.colaboradores?.nome_completo}
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{modal.he.motivo}</div>
            </div>
            {modal.acao === 'reprovar' && (
              <label style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.danger, textTransform: 'uppercase' }}>
                  Motivo *
                </span>
                <textarea
                  rows={3}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Explique por que está reprovando..."
                  style={{
                    padding: 10, fontSize: 13,
                    border: `1px solid ${C.border}`, borderRadius: 8,
                    resize: 'vertical',
                  }}
                />
              </label>
            )}
            {err && (
              <div style={{
                padding: 10, marginBottom: 10, fontSize: 12,
                background: C.dangerBg, color: C.danger, borderRadius: 6,
              }}>{err}</div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setModal(null); setMotivo('') }}
                disabled={processando}
                style={{
                  padding: '9px 16px', fontSize: 13, fontWeight: 600,
                  background: '#fff', color: C.muted,
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  cursor: 'pointer',
                }}
              >Cancelar</button>
              <button
                onClick={confirmar}
                disabled={processando}
                style={{
                  padding: '9px 16px', fontSize: 13, fontWeight: 700,
                  background: modal.acao === 'aprovar' ? C.success : C.danger,
                  color: '#fff', border: 'none', borderRadius: 8,
                  cursor: processando ? 'not-allowed' : 'pointer',
                }}
              >
                {processando ? 'Processando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componente raiz: gerencia sessão ──────────────────────────────────────
export default function PortalClientePage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY))
  const [cliente, setCliente] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(CLIENTE_KEY) || 'null') } catch { return null }
  })

  function handleLogged(t, c) { setToken(t); setCliente(c) }
  function handleLogout() { setToken(null); setCliente(null) }

  if (!token) {
    return <LoginScreen onLogged={handleLogged} />
  }
  return <Dashboard token={token} cliente={cliente} onLogout={handleLogout} />
}

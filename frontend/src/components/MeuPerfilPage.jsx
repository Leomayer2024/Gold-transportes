import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function MeuPerfilPage() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const initials = (profile?.nome_completo || 'OP')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Conta</span>
          <h1>Meu Perfil</h1>
          <p>Informações da sua conta e acesso ao sistema.</p>
        </div>
      </div>

      <div className="surface-card" style={{ maxWidth: 560 }}>
        {/* Avatar + nome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          {profile?.foto_url ? (
            <img
              src={profile.foto_url}
              alt={profile.nome_completo}
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
            />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: '#7a6030', color: '#fff',
              display: 'grid', placeItems: 'center',
              fontSize: 22, fontWeight: 700, flexShrink: 0,
            }}>
              {initials}
            </div>
          )}
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              {profile?.nome_completo || '—'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {profile?.cargo || '—'}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <InfoRow label="E-mail" value={profile?.email} />
          <InfoRow label="Telefone" value={profile?.telefone} />
          <InfoRow label="CPF" value={profile?.cpf} />
          <InfoRow
            label="Tipo de acesso"
            value={
              profile?.tipo_acesso === 'ambos' ? 'App + Desktop' :
              profile?.tipo_acesso === 'desktop' ? 'Desktop' : 'App'
            }
          />
          <InfoRow
            label="Status"
            value={
              <span style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 700,
                background: profile?.ativo ? 'var(--success-bg, #d4edda)' : 'var(--danger-bg, #f8d7da)',
                color: profile?.ativo ? 'var(--success, #155724)' : 'var(--danger, #721c24)',
              }}>
                {profile?.ativo ? 'Ativo' : 'Inativo'}
              </span>
            }
          />
        </div>

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button className="button-secondary" onClick={() => navigate(-1)} type="button">
            Voltar
          </button>
          <button
            className="button-link danger"
            onClick={handleSignOut}
            type="button"
            style={{ marginLeft: 'auto' }}
          >
            Sair da conta
          </button>
        </div>
      </div>
    </section>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 32 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
        {value || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Não informado</span>}
      </span>
    </div>
  )
}

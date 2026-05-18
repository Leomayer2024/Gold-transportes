import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(isoStr) {
  if (!isoStr) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(isoStr))
  } catch { return '—' }
}

/** Gera uma senha segura aleatória: letras + números + símbolo */
function gerarSenha(tamanho = 12) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const symbols = '@#$!%?'
  const todos = upper + lower + digits + symbols
  const arr = new Uint32Array(tamanho)
  window.crypto.getRandomValues(arr)
  let senha = ''
  // Garante ao menos 1 de cada categoria
  senha += upper[arr[0] % upper.length]
  senha += lower[arr[1] % lower.length]
  senha += digits[arr[2] % digits.length]
  senha += symbols[arr[3] % symbols.length]
  for (let i = 4; i < tamanho; i++) {
    senha += todos[arr[i] % todos.length]
  }
  // Embaralha
  const chars = senha.split('')
  for (let i = chars.length - 1; i > 0; i--) {
    const j = arr[i % arr.length] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

function copiar(texto, setCopied) {
  navigator.clipboard.writeText(texto).then(() => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }).catch(() => {})
}

function exportarCSV(rows) {
  const header = ['Nome', 'Cargo', 'Base', 'E-mail', 'Tipo acesso', 'Status', 'Último acesso']
  const data = rows.map((a) => [
    a.nome_completo || '',
    a.cargo || '',
    a.filial_label || '',
    a.email || '',
    [a.permissao_app && 'App', a.permissao_desktop && 'Desktop'].filter(Boolean).join(' + ') || '',
    a.ativo ? 'Ativo' : 'Inativo',
    a.ultimo_login ? formatDateTime(a.ultimo_login) : 'Nunca acessou',
  ])
  const csv = [header, ...data]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `acessos_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Modal de edição de e-mail ──────────────────────────────────────────────

function ModalEditarEmail({ colab, onClose, onSaved }) {
  const [novoEmail, setNovoEmail] = useState(colab.email || '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  async function handleSalvar() {
    const trimmed = novoEmail.trim().toLowerCase()
    if (!trimmed) { setErro('Informe o e-mail.'); return }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) { setErro('E-mail inválido.'); return }
    setSalvando(true)
    setErro('')
    setSucesso('')
    try {
      await api.adminAtualizarEmail(colab.id, trimmed)
      setSucesso('E-mail atualizado com sucesso!')
      onSaved()
    } catch (err) {
      setErro(err.message || 'Falha ao atualizar e-mail.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">Gestão de acessos</span>
            <h2>Alterar e-mail de login</h2>
          </div>
          <button className="button-secondary" onClick={onClose} type="button">✕</button>
        </div>

        <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{colab.nome_completo}</div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>
            {colab.cargo}{colab.filial_label ? ` · ${colab.filial_label}` : ''}
          </div>
          {colab.email && (
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              E-mail atual: <strong style={{ fontFamily: 'monospace' }}>{colab.email}</strong>
            </div>
          )}
        </div>

        {erro && <div className="alert-error" style={{ marginBottom: 12 }}>{erro}</div>}
        {sucesso && <div className="alert-success" style={{ marginBottom: 12 }}>{sucesso}</div>}

        {!sucesso && (
          <label className="field" style={{ marginBottom: 16 }}>
            <span>Novo e-mail</span>
            <input
              type="email"
              value={novoEmail}
              onChange={(e) => setNovoEmail(e.target.value)}
              placeholder="novo@email.com"
              autoComplete="email"
              style={{ fontSize: 14 }}
            />
          </label>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="button-secondary" onClick={onClose}>
            {sucesso ? 'Fechar' : 'Cancelar'}
          </button>
          {!sucesso && (
            <button type="button" className="button-primary" onClick={handleSalvar} disabled={salvando}>
              {salvando ? 'Salvando...' : '✉ Salvar e-mail'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Modal de redefinição de senha ───────────────────────────────────────────

function ModalResetSenha({ colab, onClose, onSaved }) {
  const [senha, setSenha] = useState(() => gerarSenha())
  const [mostrar, setMostrar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [copied, setCopied] = useState(false)

  function novaAutomatica() { setSenha(gerarSenha()); setSucesso(''); setErro('') }

  async function handleSalvar() {
    if (!senha || senha.length < 6) { setErro('A senha deve ter ao menos 6 caracteres.'); return }
    setSalvando(true)
    setErro('')
    setSucesso('')
    try {
      await api.adminResetarSenha(colab.id, senha)
      setSucesso('Senha redefinida com sucesso! Anote a senha antes de fechar.')
      onSaved()
    } catch (err) {
      setErro(err.message || 'Falha ao redefinir senha.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">Gestão de acessos</span>
            <h2>Redefinir senha</h2>
          </div>
          <button className="button-secondary" onClick={onClose} type="button">✕</button>
        </div>

        {/* Dados do colaborador */}
        <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{colab.nome_completo}</div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>
            {colab.cargo}{colab.filial_label ? ` · ${colab.filial_label}` : ''}
          </div>
          {colab.email && (
            <div style={{ fontSize: 12, color: '#1a73e8', marginTop: 2 }}>
              Login: <strong>{colab.email}</strong>
            </div>
          )}
        </div>

        {erro && <div className="alert-error" style={{ marginBottom: 12 }}>{erro}</div>}
        {sucesso && <div className="alert-success" style={{ marginBottom: 12 }}>{sucesso}</div>}

        <label className="field" style={{ marginBottom: 8 }}>
          <span>Nova senha</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type={mostrar ? 'text' : 'password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={{ flex: 1, fontFamily: mostrar ? 'monospace' : 'inherit', letterSpacing: mostrar ? '0.08em' : 'normal', fontSize: 15 }}
              autoComplete="new-password"
              minLength={6}
            />
            <button
              type="button"
              className="button-secondary"
              style={{ padding: '0 10px', fontSize: 16 }}
              onClick={() => setMostrar((v) => !v)}
              title={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {mostrar ? '🙈' : '👁'}
            </button>
            <button
              type="button"
              className="button-secondary"
              style={{ padding: '0 10px', fontSize: 16 }}
              onClick={() => copiar(senha, setCopied)}
              title="Copiar senha"
            >
              {copied ? '✓' : '📋'}
            </button>
          </div>
        </label>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button type="button" className="button-secondary" style={{ fontSize: 12 }} onClick={novaAutomatica}>
            ↻ Gerar senha automática
          </button>
          <span style={{ fontSize: 11, color: '#888', alignSelf: 'center' }}>
            Mínimo 6 caracteres
          </span>
        </div>

        {!sucesso && (
          <div className="alert-warn" style={{ marginBottom: 14 }}>
            ⚠️ Anote a senha antes de salvar. Ela não será exibida novamente.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="button-secondary" onClick={onClose}>
            {sucesso ? 'Fechar' : 'Cancelar'}
          </button>
          {!sucesso && (
            <button type="button" className="button-primary" onClick={handleSalvar} disabled={salvando}>
              {salvando ? 'Salvando...' : '🔑 Redefinir senha'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function GestaoAcessosPage() {
  const { profile } = useAuth()
  const [acessos, setAcessos] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos') // todos | ativos | inativos
  const [modalColab, setModalColab] = useState(null)
  const [modalEmailColab, setModalEmailColab] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const _loaded = useRef(false)

  // Bloqueia acesso para não-super-admin no frontend também
  const isSuperAdmin = Boolean(profile?.is_super_admin)

  useEffect(() => {
    if (!isSuperAdmin) return
    let active = true
    if (!_loaded.current) setLoading(true)
    setErro('')
    api.adminListarAcessos()
      .then((rows) => { if (active) setAcessos(rows || []) })
      .catch((err) => { if (active) setErro(err.message || 'Falha ao carregar.') })
      .finally(() => { if (active) { _loaded.current = true; setLoading(false) } })
    return () => { active = false }
  }, [isSuperAdmin, refreshKey])

  const filtrados = useMemo(() => {
    let list = acessos
    if (filtroStatus === 'ativos') list = list.filter((a) => a.ativo)
    if (filtroStatus === 'inativos') list = list.filter((a) => !a.ativo)
    const q = busca.trim().toLowerCase()
    if (!q) return list
    return list.filter((a) =>
      [a.nome_completo, a.cargo, a.email, a.filial_label]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
    )
  }, [acessos, busca, filtroStatus])

  // Estatísticas rápidas
  const stats = useMemo(() => ({
    total: acessos.length,
    ativos: acessos.filter((a) => a.ativo).length,
    sem_login: acessos.filter((a) => !a.ultimo_login).length,
  }), [acessos])

  if (!isSuperAdmin) {
    return (
      <section className="page-shell">
        <div className="surface-card empty-state" style={{ marginTop: 40 }}>
          <strong>Acesso restrito</strong>
          <p>Esta área é exclusiva do administrador master do sistema.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Administração master</span>
          <h1>Gestão de acessos</h1>
          <p>Visualize quem tem acesso ao sistema e redefina senhas. Esta tela é visível apenas para o administrador master.</p>
        </div>
        <button
          type="button"
          className="button-secondary"
          onClick={() => exportarCSV(acessos)}
          disabled={acessos.length === 0}
          title="Exportar lista completa de e-mails e acessos"
        >
          ↓ Exportar e-mails (CSV)
        </button>
      </div>

      {/* Cards de estatísticas */}
      <div className="acessos-stats">
        <div className="acessos-stat-card">
          <span className="acessos-stat-num">{stats.total}</span>
          <span className="acessos-stat-label">Usuários com acesso</span>
        </div>
        <div className="acessos-stat-card tone-success">
          <span className="acessos-stat-num">{stats.ativos}</span>
          <span className="acessos-stat-label">Contas ativas</span>
        </div>
        <div className="acessos-stat-card tone-warning">
          <span className="acessos-stat-num">{stats.sem_login}</span>
          <span className="acessos-stat-label">Nunca acessaram</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="surface-card" style={{ padding: '12px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <label className="field filter-field" style={{ minWidth: 300, flex: 1 }}>
            <span>Buscar</span>
            <input
              type="text"
              placeholder="Nome, cargo, filial, e-mail..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <label className="field filter-field" style={{ minWidth: 160 }}>
            <span>Status da conta</span>
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="ativos">Apenas ativos</option>
              <option value="inativos">Apenas inativos</option>
            </select>
          </label>
        </div>
      </div>

      {/* Aviso de segurança */}
      <div className="alert-warn" style={{ marginBottom: 12 }}>
        🔒 As senhas dos colaboradores são criptografadas e <strong>nunca podem ser consultadas</strong>. Você pode apenas <strong>redefinir</strong> para uma nova senha.
      </div>

      {erro && <div className="alert-error">{erro}</div>}

      <div className="surface-card">
        {loading ? (
          <div className="empty-state">Carregando acessos...</div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">
            <strong>Nenhum resultado encontrado.</strong>
            <p>Colaboradores precisam ter um e-mail vinculado no cadastro para aparecer aqui.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="acessos-table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Cargo</th>
                  <th>Base</th>
                  <th>Login (e-mail)</th>
                  <th>Tipo de acesso</th>
                  <th>Último acesso</th>
                  <th>Status</th>
                  <th style={{ width: 180 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((a) => (
                  <tr key={a.id} className={`acessos-row${!a.ativo ? ' acessos-row-inativo' : ''}`}>
                    <td>
                      <strong>{a.nome_completo}</strong>
                    </td>
                    <td>{a.cargo || '—'}</td>
                    <td>{a.filial_label || '—'}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
                        {a.email || <span style={{ color: '#bbb' }}>sem e-mail</span>}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {a.permissao_app && (
                          <span className="acesso-badge-app">App</span>
                        )}
                        {a.permissao_desktop && (
                          <span className="acesso-badge-desk">Desktop</span>
                        )}
                        {!a.permissao_app && !a.permissao_desktop && (
                          <span style={{ color: '#bbb', fontSize: 12 }}>—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {a.ultimo_login
                        ? <span style={{ fontSize: 12 }}>{formatDateTime(a.ultimo_login)}</span>
                        : <span style={{ color: '#bbb', fontSize: 12 }}>Nunca acessou</span>}
                    </td>
                    <td>
                      <span className={`status-chip tone-${a.ativo ? 'success' : 'neutral'}`}>
                        {a.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          className="button-secondary"
                          style={{ fontSize: 11, padding: '4px 8px', flex: 1 }}
                          onClick={() => setModalEmailColab(a)}
                          title="Alterar e-mail de login"
                        >
                          ✉ E-mail
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          style={{ fontSize: 11, padding: '4px 8px', flex: 1 }}
                          onClick={() => setModalColab(a)}
                          title="Redefinir senha"
                        >
                          🔑 Senha
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalColab && (
        <ModalResetSenha
          colab={modalColab}
          onClose={() => setModalColab(null)}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {modalEmailColab && (
        <ModalEditarEmail
          colab={modalEmailColab}
          onClose={() => setModalEmailColab(null)}
          onSaved={() => { setRefreshKey((k) => k + 1); setModalEmailColab(null) }}
        />
      )}
    </section>
  )
}

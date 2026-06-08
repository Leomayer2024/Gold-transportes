import { useEffect, useMemo, useState } from 'react'
import ResourcePage from './ResourcePage'
import { resourceConfigs } from './resourceConfigs'
import { api } from '../services/api'

// ─────────────────────────────────────────────────────────────────────────────
// Página de Veículos com abas internas:
//   - "Cadastro" — lista padrão de veículos (ResourcePage)
//   - "Motoristas ↔ Veículos" — vincula múltiplos veículos a cada motorista,
//     marca um como principal (pré-selecionado no app).
// Persistência: tabela motorista_veiculo (motorista_id, veiculo_id, principal).
// ─────────────────────────────────────────────────────────────────────────────

export default function VeiculosPage() {
  const [tab, setTab] = useState('cadastro')
  return (
    <div className="page-shell">
      <div style={{ display: 'flex', gap: 8, padding: '12px 0', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
        <TabBtn ativo={tab === 'cadastro'} onClick={() => setTab('cadastro')}>Cadastro</TabBtn>
        <TabBtn ativo={tab === 'vinculos'} onClick={() => setTab('vinculos')}>Motoristas ↔ Veículos</TabBtn>
      </div>
      <div style={{ paddingTop: 16 }}>
        {tab === 'cadastro'
          ? <ResourcePage config={resourceConfigs.veiculos} />
          : <VinculosMotoristasTab />}
      </div>
    </div>
  )
}

function TabBtn({ ativo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '8px 14px',
        fontSize: 13,
        fontWeight: 600,
        color: ativo ? 'var(--primary, #0969da)' : 'var(--text-muted, #57606a)',
        borderBottom: ativo ? '2px solid var(--primary, #0969da)' : '2px solid transparent',
        marginBottom: -1,
      }}
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Aba "Motoristas ↔ Veículos" — 1:N
// ─────────────────────────────────────────────────────────────────────────────

function VinculosMotoristasTab() {
  const [motoristas, setMotoristas] = useState([])
  const [veiculos, setVeiculos] = useState([])
  const [filiais, setFiliais] = useState([])
  const [vinculos, setVinculos] = useState([]) // motorista_veiculo rows
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [filtroFilial, setFiltroFilial] = useState('')
  const [busca, setBusca] = useState('')
  const [processando, setProcessando] = useState(null)
  const [mensagem, setMensagem] = useState(null)

  useEffect(() => { carregarTudo() }, [])

  async function carregarTudo() {
    setCarregando(true)
    setErro(null)
    try {
      const [cs, vs, fs, mvs] = await Promise.all([
        api.list('colaboradores', { ativo: 'true', per_page: 500 }),
        api.list('veiculos', { per_page: 500 }),
        api.list('filiais'),
        api.list('motorista_veiculo', { ativo: 'true', per_page: 1000 }),
      ])
      const arr = (x) => (Array.isArray(x) ? x : (x?.data || []))
      const lista = arr(cs).filter((c) =>
        String(c.cargo || '').toLowerCase().includes('motorista'),
      )
      setMotoristas(lista)
      setVeiculos(arr(vs))
      setFiliais(arr(fs))
      setVinculos(arr(mvs))
    } catch (e) {
      setErro(e.message || 'Erro ao carregar')
    } finally {
      setCarregando(false)
    }
  }

  const filiaisPorId = useMemo(() => {
    const m = new Map()
    for (const f of filiais) m.set(f.id, f)
    return m
  }, [filiais])

  const veiculosPorId = useMemo(() => {
    const m = new Map()
    for (const v of veiculos) m.set(v.id, v)
    return m
  }, [veiculos])

  const veiculosPorFilial = useMemo(() => {
    const m = new Map()
    for (const v of veiculos) {
      const arr = m.get(v.filial_id) || []
      arr.push(v)
      m.set(v.filial_id, arr)
    }
    return m
  }, [veiculos])

  const vinculosPorMotorista = useMemo(() => {
    const m = new Map()
    for (const v of vinculos) {
      const arr = m.get(v.motorista_id) || []
      arr.push(v)
      m.set(v.motorista_id, arr)
    }
    return m
  }, [vinculos])

  const motoristasFiltrados = useMemo(() => {
    let lista = motoristas
    if (filtroFilial) lista = lista.filter((m) => String(m.filial_id) === String(filtroFilial))
    if (busca.trim()) {
      const q = busca.trim().toLowerCase()
      lista = lista.filter((m) =>
        String(m.nome_completo || '').toLowerCase().includes(q) ||
        String(m.cpf || '').includes(q),
      )
    }
    return lista
  }, [motoristas, filtroFilial, busca])

  function show(msgTipo, texto) {
    setMensagem({ tipo: msgTipo, texto })
    setTimeout(() => setMensagem(null), 2500)
  }

  async function vincular(motorista, veiculoId) {
    if (!veiculoId) return
    const id = motorista.id
    setProcessando(id)
    try {
      const principal = !(vinculosPorMotorista.get(id) || []).some((x) => x.ativo)
      const novo = await api.create('motorista_veiculo', {
        filial_id: motorista.filial_id,
        motorista_id: id,
        veiculo_id: Number(veiculoId),
        principal,
        ativo: true,
      })
      setVinculos((arr) => [...arr, novo])
      show('ok', 'Veículo vinculado.')
    } catch (e) {
      show('erro', `Erro: ${e.message || e}`)
    } finally {
      setProcessando(null)
    }
  }

  async function remover(vinculo) {
    setProcessando(vinculo.motorista_id)
    try {
      await api.remove('motorista_veiculo', vinculo.id)
      setVinculos((arr) => arr.filter((x) => x.id !== vinculo.id))
      show('ok', 'Vínculo removido.')
    } catch (e) {
      show('erro', `Erro: ${e.message || e}`)
    } finally {
      setProcessando(null)
    }
  }

  async function tornarPrincipal(vinculo) {
    const motoristaId = vinculo.motorista_id
    setProcessando(motoristaId)
    try {
      // Desmarca outros principais
      const outros = (vinculosPorMotorista.get(motoristaId) || []).filter((x) => x.principal && x.id !== vinculo.id)
      await Promise.all(outros.map((o) => api.update('motorista_veiculo', o.id, { principal: false })))
      const atualizado = await api.update('motorista_veiculo', vinculo.id, { principal: true })
      setVinculos((arr) => arr.map((x) => {
        if (x.id === vinculo.id) return { ...x, principal: true }
        if (x.motorista_id === motoristaId) return { ...x, principal: false }
        return x
      }))
      show('ok', 'Veículo principal atualizado.')
    } catch (e) {
      show('erro', `Erro: ${e.message || e}`)
    } finally {
      setProcessando(null)
    }
  }

  if (carregando) return <div style={{ padding: 20 }}>Carregando motoristas…</div>
  if (erro) return <div style={{ padding: 20, color: 'var(--danger, #cf222e)' }}>{erro}</div>

  return (
    <section>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Motoristas ↔ Veículos</h2>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted, #57606a)' }}>
          Vincule um ou mais veículos a cada motorista. O veículo marcado como ★ é o padrão pré-selecionado no app.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={filtroFilial} onChange={(e) => setFiltroFilial(e.target.value)} style={selectStyle}>
          <option value="">Todas as filiais</option>
          {filiais.map((f) => (
            <option key={f.id} value={f.id}>{f.cidade}/{f.uf} — {f.parceira}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Buscar motorista por nome ou CPF"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ ...selectStyle, minWidth: 260, flex: 1 }}
        />
      </div>

      {mensagem && (
        <div
          style={{
            padding: '8px 12px', borderRadius: 8, marginBottom: 10,
            background: mensagem.tipo === 'ok' ? '#ddf4e4' : '#ffebed',
            color: mensagem.tipo === 'ok' ? '#1a7f37' : '#cf222e',
            fontSize: 13,
          }}
        >
          {mensagem.texto}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={headRow}>
          <div style={{ flex: 2 }}>Motorista</div>
          <div style={{ flex: 1 }}>Filial</div>
          <div style={{ flex: 3 }}>Veículos vinculados</div>
        </div>
        {motoristasFiltrados.length === 0
          ? <div style={{ padding: 18, textAlign: 'center', color: 'var(--text-muted, #57606a)', fontSize: 13 }}>Nenhum motorista encontrado.</div>
          : motoristasFiltrados.map((m) => {
              const filial = filiaisPorId.get(m.filial_id)
              const vinc = (vinculosPorMotorista.get(m.id) || []).filter((x) => x.ativo)
              const vincIds = new Set(vinc.map((x) => x.veiculo_id))
              const disponiveis = (veiculosPorFilial.get(m.filial_id) || []).filter((v) => !vincIds.has(v.id))
              const busy = processando === m.id
              return (
                <div key={m.id} style={dataRow}>
                  <div style={{ flex: 2 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{m.nome_completo}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.cargo}</div>
                  </div>
                  <div style={{ flex: 1, fontSize: 12 }}>
                    {filial ? `${filial.cidade}/${filial.uf}` : '—'}
                  </div>
                  <div style={{ flex: 3, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    {vinc.length === 0 && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sem veículos.</span>
                    )}
                    {vinc.map((vin) => {
                      const veic = veiculosPorId.get(vin.veiculo_id)
                      if (!veic) return null
                      return (
                        <span
                          key={vin.id}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: vin.principal ? '#fff4d6' : '#f6f8fa',
                            border: `1px solid ${vin.principal ? '#d4a72c' : '#d0d7de'}`,
                            borderRadius: 16, padding: '3px 8px 3px 10px',
                            fontSize: 12, fontWeight: 600,
                          }}
                        >
                          <button
                            type="button"
                            disabled={busy || vin.principal}
                            onClick={() => tornarPrincipal(vin)}
                            title={vin.principal ? 'Veículo principal' : 'Tornar principal'}
                            style={{
                              background: 'none', border: 'none', cursor: vin.principal ? 'default' : 'pointer',
                              padding: 0, fontSize: 13, color: vin.principal ? '#bf8700' : '#bfbfbf',
                            }}
                          >★</button>
                          <span style={{ letterSpacing: 0.4 }}>{veic.placa}</span>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                            {veic.marca} {veic.modelo}
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => remover(vin)}
                            title="Remover vínculo"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#cf222e', fontSize: 14, padding: 0, marginLeft: 2,
                            }}
                          >×</button>
                        </span>
                      )
                    })}
                    {disponiveis.length > 0 && (
                      <select
                        value=""
                        disabled={busy}
                        onChange={(e) => vincular(m, e.target.value)}
                        style={{ ...selectStyle, fontSize: 12, padding: '4px 8px' }}
                      >
                        <option value="">+ Adicionar veículo</option>
                        {disponiveis.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.placa} · {v.marca || ''} {v.modelo || ''}
                          </option>
                        ))}
                      </select>
                    )}
                    {busy && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Salvando…</span>}
                  </div>
                </div>
              )
            })}
      </div>
    </section>
  )
}

const selectStyle = {
  padding: '6px 10px',
  fontSize: 13,
  border: '1px solid var(--border, #d1d5db)',
  borderRadius: 6,
  background: '#fff',
}

const headRow = {
  display: 'flex',
  gap: 12,
  padding: '10px 14px',
  background: 'var(--surface-2, #f6f8fa)',
  borderBottom: '1px solid var(--border, #e5e7eb)',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  color: 'var(--text-muted, #57606a)',
  letterSpacing: 0.4,
}

const dataRow = {
  display: 'flex',
  gap: 12,
  padding: '10px 14px',
  borderBottom: '1px solid var(--border, #f0f2f5)',
  alignItems: 'flex-start',
}

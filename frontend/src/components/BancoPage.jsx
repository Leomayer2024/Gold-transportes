import { useEffect, useMemo, useState, useCallback } from 'react'
import { api } from '../services/api'

const TIPOS_CONTA = ['corrente', 'poupanca', 'investimento', 'caixa']
const CATEGORIAS = ['RECEBIMENTO_WM', 'PAGAMENTO_HE', 'PAGAMENTO_FORNECEDOR', 'PAGAMENTO_COLABORADOR', 'TRANSFERENCIA', 'OUTRO']

function fmtBRL(v, signed) {
  const n = parseFloat(v || 0)
  const f = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(n))
  if (!signed) return f
  return n >= 0 ? `+ ${f}` : `- ${f}`
}
function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function totBRL(v) {
  const n = parseFloat(v || 0)
  if (n >= 0) return { text: fmtBRL(n), color: '#059669' }
  return { text: fmtBRL(n), color: '#dc2626' }
}

function ContaCard({ conta, selected, onClick, onEdit, onDelete }) {
  const sal = totBRL(conta.saldo_atual)
  return (
    <div
      onClick={onClick}
      style={{ cursor: 'pointer', padding: '14px 18px', background: selected ? '#eff6ff' : '#fff', border: selected ? '2px solid var(--primary)' : '1.5px solid #e2e8f0', borderRadius: 10, marginBottom: 8 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: selected ? 'var(--primary)' : '#111' }}>{conta.banco_nome}</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{conta.tipo?.toUpperCase()} {conta.agencia && `· Ag ${conta.agencia}`} {conta.conta && `· Cc ${conta.conta}`}</div>
          {conta.filial_nome && <div style={{ fontSize: 10, color: '#999', marginTop: 1 }}>{conta.filial_nome}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: sal.color, lineHeight: 1.1 }}>{sal.text}</div>
          <div style={{ fontSize: 9, color: '#aaa', marginTop: 2 }}>SALDO ATUAL</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button className="button-secondary" type="button" style={{ fontSize: 10, padding: '2px 8px' }} onClick={(e) => { e.stopPropagation(); onEdit(conta) }}>Editar</button>
        <button className="button-secondary" type="button" style={{ fontSize: 10, padding: '2px 8px', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); onDelete(conta) }}>Excluir</button>
      </div>
    </div>
  )
}

export default function BancoPage() {
  const [contas, setContas] = useState([])
  const [saldos, setSaldos] = useState(null)
  const [lancamentos, setLancamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingLan, setLoadingLan] = useState(false)
  const [filiais, setFiliais] = useState([])
  const [contasSel, setContasSel] = useState(null)  // conta selecionada

  const [filterMes, setFilterMes] = useState(new Date().toISOString().slice(0, 7))
  const [filterConc, setFilterConc] = useState('')

  // Modal nova conta
  const [showNovaConta, setShowNovaConta] = useState(false)
  const [editConta, setEditConta] = useState(null)
  const [contaForm, setContaForm] = useState({ tipo: 'corrente', saldo_inicial: 0, ativo: true })
  const [savingConta, setSavingConta] = useState(false)

  // Modal novo lançamento
  const [showNovoLan, setShowNovoLan] = useState(false)
  const [lanForm, setLanForm] = useState({ tipo: 'SAIDA', categoria: 'PAGAMENTO_HE' })
  const [savingLan, setSavingLan] = useState(false)

  const carregar = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.bancoContas(),
      api.bancoSaldos(),
      api.list('filiais', { limit: 500 }),
    ])
      .then(([c, s, f]) => {
        setContas(c.data || [])
        setSaldos(s)
        setFiliais(f.items || f || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const carregarLancamentos = useCallback((contaId) => {
    if (!contaId) return
    setLoadingLan(true)
    api.bancoLancamentos({ conta_id: contaId, mes: filterMes, conciliado: filterConc })
      .then((r) => setLancamentos(r.data || []))
      .catch(() => {})
      .finally(() => setLoadingLan(false))
  }, [filterMes, filterConc])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { if (contasSel) carregarLancamentos(contasSel.id) }, [contasSel, carregarLancamentos])

  const totLan = useMemo(() => {
    const entradas = lancamentos.filter((l) => l.tipo === 'ENTRADA').reduce((s, l) => s + (l.valor || 0), 0)
    const saidas = lancamentos.filter((l) => l.tipo === 'SAIDA').reduce((s, l) => s + (l.valor || 0), 0)
    return { entradas, saidas, saldo: entradas - saidas }
  }, [lancamentos])

  async function salvarConta() {
    if (!contaForm.banco_nome) { alert('Nome do banco obrigatório.'); return }
    setSavingConta(true)
    try {
      if (editConta) {
        await api.editarBancoConta(editConta.id, contaForm)
      } else {
        await api.criarBancoConta(contaForm)
      }
      setShowNovaConta(false)
      setEditConta(null)
      setContaForm({ tipo: 'corrente', saldo_inicial: 0, ativo: true })
      carregar()
    } catch (e) { alert(e.message || 'Erro.') }
    finally { setSavingConta(false) }
  }

  async function deletarConta(conta) {
    if (!confirm(`Excluir conta ${conta.banco_nome}? Os lançamentos serão excluídos em cascata.`)) return
    try {
      await api.deletarBancoConta(conta.id)
      if (contasSel?.id === conta.id) { setContasSel(null); setLancamentos([]) }
      carregar()
    } catch (e) { alert(e.message || 'Erro.') }
  }

  function abrirEditarConta(conta) {
    setEditConta(conta)
    setContaForm({ ...conta })
    setShowNovaConta(true)
  }

  async function salvarLancamento() {
    if (!lanForm.data_lancamento || !lanForm.descricao || !lanForm.valor) { alert('Data, descrição e valor são obrigatórios.'); return }
    setSavingLan(true)
    try {
      await api.criarBancoLancamento({ ...lanForm, conta_id: contasSel.id, filial_id: contasSel.filial_id, filial_nome: contasSel.filial_nome })
      setShowNovoLan(false)
      setLanForm({ tipo: 'SAIDA', categoria: 'PAGAMENTO_HE' })
      carregarLancamentos(contasSel.id)
      carregar()
    } catch (e) { alert(e.message || 'Erro.') }
    finally { setSavingLan(false) }
  }

  async function conciliar(l) {
    try {
      await api.conciliarLancamento(l.id, { conciliado: !l.conciliado })
      carregarLancamentos(contasSel.id)
    } catch (e) { alert(e.message || 'Erro.') }
  }

  async function deletarLan(id) {
    if (!confirm('Excluir lançamento?')) return
    try {
      await api.deletarBancoLancamento(id)
      carregarLancamentos(contasSel.id)
      carregar()
    } catch (e) { alert(e.message || 'Erro.') }
  }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Financeiro</span>
          <h1>Banco / Conciliação</h1>
          <p>Contas bancárias, lançamentos e conciliação com contas a receber/pagar</p>
        </div>
      </div>

      {/* Alertas de saldo */}
      {saldos && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ flex: '1 1 160px', minWidth: 160, padding: '14px 18px', background: saldos.saldo_total >= 0 ? '#f0fdf4' : '#fef2f2', border: `1.5px solid ${saldos.saldo_total >= 0 ? '#059669' : '#dc2626'}33`, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: saldos.saldo_total >= 0 ? '#059669' : '#dc2626', marginBottom: 4 }}>Saldo Total</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: saldos.saldo_total >= 0 ? '#059669' : '#dc2626', lineHeight: 1.1 }}>{fmtBRL(saldos.saldo_total)}</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{(saldos.contas || []).length} conta{saldos.contas?.length !== 1 ? 's' : ''} ativa{saldos.contas?.length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ flex: '1 1 160px', minWidth: 160, padding: '14px 18px', background: saldos.nao_conciliados > 0 ? '#fffbeb' : '#f0fdf4', border: `1.5px solid ${saldos.nao_conciliados > 0 ? '#d97706' : '#059669'}33`, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: saldos.nao_conciliados > 0 ? '#d97706' : '#059669', marginBottom: 4 }}>Não Conciliados</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: saldos.nao_conciliados > 0 ? '#d97706' : '#059669', lineHeight: 1.1 }}>{saldos.nao_conciliados}</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>lançamentos pendentes</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Coluna esquerda: contas */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <strong style={{ fontSize: 13 }}>Contas</strong>
            <button className="button-primary" type="button" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => { setEditConta(null); setContaForm({ tipo: 'corrente', saldo_inicial: 0, ativo: true }); setShowNovaConta(true) }}>+ Conta</button>
          </div>
          {loading ? (
            <div style={{ color: 'var(--muted)', fontSize: 12, padding: 16 }}>Carregando…</div>
          ) : contas.length === 0 ? (
            <div className="surface-card empty-state" style={{ padding: 24 }}>
              <strong style={{ fontSize: 13 }}>Nenhuma conta</strong>
              <p style={{ fontSize: 11 }}>Cadastre uma conta bancária para começar.</p>
            </div>
          ) : contas.map((c) => (
            <ContaCard key={c.id} conta={c} selected={contasSel?.id === c.id} onClick={() => setContasSel(c)} onEdit={abrirEditarConta} onDelete={deletarConta} />
          ))}
        </div>

        {/* Coluna direita: lançamentos */}
        <div>
          {!contasSel ? (
            <div className="surface-card empty-state">
              <strong>Selecione uma conta</strong>
              <p>Clique em uma conta à esquerda para ver os lançamentos e fazer conciliações.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 13 }}>Lançamentos — {contasSel.banco_nome}</strong>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <label className="field-label" style={{ marginRight: 4 }}>Mês</label>
                    <input type="month" className="input" value={filterMes} onChange={(e) => setFilterMes(e.target.value)} style={{ width: 130 }} />
                  </div>
                  <div>
                    <label className="field-label" style={{ marginRight: 4 }}>Conciliado</label>
                    <select className="input" value={filterConc} onChange={(e) => setFilterConc(e.target.value)} style={{ width: 120 }}>
                      <option value="">Todos</option>
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </select>
                  </div>
                  <button className="button-primary" type="button" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => setShowNovoLan(true)}>+ Lançamento</button>
                </div>
              </div>

              {/* KPI mini */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '.05em' }}>Entradas</div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: '#059669' }}>{fmtBRL(totLan.entradas)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '.05em' }}>Saídas</div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: '#dc2626' }}>{fmtBRL(totLan.saidas)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: totLan.saldo >= 0 ? '#eff6ff' : '#fef2f2', border: `1px solid ${totLan.saldo >= 0 ? '#bfdbfe' : '#fca5a5'}`, borderRadius: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: totLan.saldo >= 0 ? 'var(--primary)' : '#dc2626', textTransform: 'uppercase', letterSpacing: '.05em' }}>Saldo Período</div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: totLan.saldo >= 0 ? 'var(--primary)' : '#dc2626' }}>{fmtBRL(totLan.saldo)}</div>
                </div>
              </div>

              {loadingLan ? (
                <div className="surface-card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Carregando…</div>
              ) : lancamentos.length === 0 ? (
                <div className="surface-card empty-state">
                  <strong>Nenhum lançamento</strong>
                  <p>Adicione um lançamento ou ajuste o filtro de mês.</p>
                </div>
              ) : (
                <div className="surface-card" style={{ padding: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ minWidth: 700, fontSize: 11 }}>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Tipo</th>
                          <th>Categoria</th>
                          <th>Descrição</th>
                          <th style={{ textAlign: 'right' }}>Valor</th>
                          <th style={{ textAlign: 'center' }}>Concil.</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lancamentos.map((l) => {
                          const isEntrada = l.tipo === 'ENTRADA'
                          return (
                            <tr key={l.id} style={{ background: l.conciliado ? '#f9fafb' : undefined }}>
                              <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(l.data_lancamento)}</td>
                              <td>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: isEntrada ? '#f0fdf4' : '#fef2f2', color: isEntrada ? '#059669' : '#dc2626', border: `1px solid ${isEntrada ? '#bbf7d0' : '#fca5a5'}` }}>
                                  {isEntrada ? '↑ ENTRADA' : '↓ SAÍDA'}
                                </span>
                              </td>
                              <td style={{ fontSize: 10, color: '#666' }}>{l.categoria?.replace(/_/g, ' ') || '—'}</td>
                              <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.descricao}>{l.descricao}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: isEntrada ? '#059669' : '#dc2626' }}>
                                {isEntrada ? '+' : '-'} {fmtBRL(l.valor)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  title={l.conciliado ? 'Desconciliar' : 'Marcar como conciliado'}
                                  onClick={() => conciliar(l)}
                                  style={{ fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', color: l.conciliado ? '#059669' : '#cbd5e1' }}
                                >
                                  {l.conciliado ? '✓' : '○'}
                                </button>
                              </td>
                              <td>
                                <button className="button-secondary" type="button" style={{ fontSize: 10, padding: '2px 8px', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => deletarLan(l.id)}>✕</button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal conta */}
      {showNovaConta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="surface-card" style={{ maxWidth: 420, width: '100%', margin: 16 }}>
            <h3 style={{ marginTop: 0 }}>{editConta ? 'Editar Conta' : 'Nova Conta Bancária'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field-label">Banco *</label>
                <input className="input" value={contaForm.banco_nome || ''} onChange={(e) => setContaForm((p) => ({ ...p, banco_nome: e.target.value }))} placeholder="Bradesco, Itaú, Caixa…" />
              </div>
              <div>
                <label className="field-label">Filial</label>
                <select className="input" value={contaForm.filial_id || ''} onChange={(e) => setContaForm((p) => ({ ...p, filial_id: parseInt(e.target.value), filial_nome: filiais.find((f) => f.id === parseInt(e.target.value))?.cidade || '' }))}>
                  <option value="">Todas / Matriz</option>
                  {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Tipo</label>
                <select className="input" value={contaForm.tipo || 'corrente'} onChange={(e) => setContaForm((p) => ({ ...p, tipo: e.target.value }))}>
                  {TIPOS_CONTA.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Agência</label>
                <input className="input" value={contaForm.agencia || ''} onChange={(e) => setContaForm((p) => ({ ...p, agencia: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Nº Conta</label>
                <input className="input" value={contaForm.conta || ''} onChange={(e) => setContaForm((p) => ({ ...p, conta: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field-label">Saldo Inicial (R$)</label>
                <input type="number" step="0.01" className="input" value={contaForm.saldo_inicial ?? 0} onChange={(e) => setContaForm((p) => ({ ...p, saldo_inicial: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="button-secondary" type="button" onClick={() => { setShowNovaConta(false); setEditConta(null) }}>Cancelar</button>
              <button className="button-primary" type="button" onClick={salvarConta} disabled={savingConta}>{savingConta ? 'Salvando…' : editConta ? 'Salvar' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal lançamento */}
      {showNovoLan && contasSel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="surface-card" style={{ maxWidth: 440, width: '100%', margin: 16 }}>
            <h3 style={{ marginTop: 0 }}>Novo Lançamento — {contasSel.banco_nome}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="field-label">Data *</label>
                <input type="date" className="input" value={lanForm.data_lancamento || ''} onChange={(e) => setLanForm((p) => ({ ...p, data_lancamento: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Tipo *</label>
                <select className="input" value={lanForm.tipo || 'SAIDA'} onChange={(e) => setLanForm((p) => ({ ...p, tipo: e.target.value }))}>
                  <option value="ENTRADA">ENTRADA</option>
                  <option value="SAIDA">SAÍDA</option>
                </select>
              </div>
              <div>
                <label className="field-label">Categoria</label>
                <select className="input" value={lanForm.categoria || ''} onChange={(e) => setLanForm((p) => ({ ...p, categoria: e.target.value }))}>
                  <option value="">—</option>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Valor *</label>
                <input type="number" step="0.01" className="input" value={lanForm.valor || ''} onChange={(e) => setLanForm((p) => ({ ...p, valor: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field-label">Descrição *</label>
                <input className="input" value={lanForm.descricao || ''} onChange={(e) => setLanForm((p) => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Recebimento HE Belém Abril/2026 — WM" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field-label">Observações</label>
                <input className="input" value={lanForm.observacoes || ''} onChange={(e) => setLanForm((p) => ({ ...p, observacoes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="button-secondary" type="button" onClick={() => setShowNovoLan(false)}>Cancelar</button>
              <button className="button-primary" type="button" onClick={salvarLancamento} disabled={savingLan}>{savingLan ? 'Salvando…' : 'Lançar'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

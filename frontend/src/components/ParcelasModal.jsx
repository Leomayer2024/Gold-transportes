import { useEffect, useState } from 'react'
import { api } from '../services/api'
import '../styles/financeiro.css'

function fmtBRL(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0)) }
function fmtDate(d) {
  if (!d) return '—'
  const [y, m, dd] = String(d).slice(0, 10).split('-')
  return `${dd}/${m}/${y}`
}
function todayIso() { return new Date().toISOString().slice(0, 10) }

const STATUS_TONE = { PAGO: '#059669', PENDENTE: '#d97706', VENCIDO: '#dc2626', CANCELADO: '#64748b' }

/**
 * Modal de parcelamento reutilizável.
 * props: conta (row), contaTipo ('pagar'|'receber'), onClose(), onChanged()
 */
export default function ParcelasModal({ conta, contaTipo, onClose, onChanged }) {
  const valorConta = contaTipo === 'pagar'
    ? Number(conta.valor || 0)
    : Number(conta.cobrado_wm || conta.valor_gold || 0)
  const vencBase = conta.data_vencimento || conta.data_limite || todayIso()

  const [parcelas, setParcelas] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [gerar, setGerar] = useState({ parcelas: 3, primeiro_vencimento: vencBase, intervalo_dias: 30, valor_total: valorConta })

  function carregar() {
    setLoading(true)
    api.listarParcelas({ conta_tipo: contaTipo, conta_id: conta.id })
      .then((r) => setParcelas(r?.data || []))
      .catch(() => setParcelas([]))
      .finally(() => setLoading(false))
  }
  useEffect(carregar, [conta.id, contaTipo])

  async function handleGerar() {
    if (!Number(gerar.parcelas) || Number(gerar.parcelas) < 1) { setErr('Informe a quantidade de parcelas.'); return }
    if (parcelas.length > 0 && !confirm('Isto substitui as parcelas atuais. Continuar?')) return
    setBusy(true); setErr('')
    try {
      await api.gerarParcelas({
        conta_tipo: contaTipo,
        conta_id: conta.id,
        parcelas: Number(gerar.parcelas),
        primeiro_vencimento: gerar.primeiro_vencimento,
        intervalo_dias: Number(gerar.intervalo_dias) || 30,
        valor_total: Number(gerar.valor_total) || valorConta,
      })
      carregar()
      onChanged?.()
    } catch (e) {
      setErr(e.message || 'Falha ao gerar parcelas.')
    } finally { setBusy(false) }
  }

  async function marcar(p, status) {
    setBusy(true)
    try {
      await api.editarParcela(p.id, { status, ...(status === 'PAGO' ? { data_pagamento: todayIso() } : { data_pagamento: null, valor_pago: 0 }) })
      carregar()
      onChanged?.()
    } finally { setBusy(false) }
  }

  async function excluir(p) {
    if (!confirm(`Excluir parcela ${p.numero}/${p.total}?`)) return
    setBusy(true)
    try { await api.deletarParcela(p.id); carregar(); onChanged?.() } finally { setBusy(false) }
  }

  const totalParcelas = parcelas.reduce((a, p) => a + Number(p.valor || 0), 0)
  const totalPago = parcelas.filter((p) => p.status === 'PAGO').reduce((a, p) => a + Number(p.valor_pago || p.valor || 0), 0)

  return (
    <div className="modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
      <div className="surface-card" style={{ maxWidth: 720, width: '100%', margin: 16, maxHeight: '92vh', overflowY: 'auto', borderTop: `4px solid ${contaTipo === 'pagar' ? '#dc2626' : '#059669'}` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8' }}>Parcelamento · {contaTipo === 'pagar' ? 'Conta a pagar' : 'Conta a receber'}</div>
            <h3 style={{ margin: '4px 0 0' }}>{conta.descricao || conta.fornecedor_nome || conta.cliente_nome || 'Lançamento'}</h3>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Valor da conta: <strong>{fmtBRL(valorConta)}</strong></div>
          </div>
          <button className="button-secondary" type="button" onClick={onClose} style={{ fontSize: 11 }}>✕ Fechar</button>
        </div>

        {err && <div className="alert-error" style={{ marginBottom: 10 }}>{err}</div>}

        {/* Gerar parcelas */}
        <div className="parc-gerar">
          <label className="field"><span>Nº de parcelas</span>
            <input type="number" min="1" max="360" value={gerar.parcelas} onChange={(e) => setGerar((p) => ({ ...p, parcelas: e.target.value }))} />
          </label>
          <label className="field"><span>1º vencimento</span>
            <input type="date" value={gerar.primeiro_vencimento} onChange={(e) => setGerar((p) => ({ ...p, primeiro_vencimento: e.target.value }))} />
          </label>
          <label className="field"><span>Intervalo (dias)</span>
            <input type="number" min="1" value={gerar.intervalo_dias} onChange={(e) => setGerar((p) => ({ ...p, intervalo_dias: e.target.value }))} />
          </label>
          <label className="field"><span>Valor total</span>
            <input type="number" min="0" step="0.01" value={gerar.valor_total} onChange={(e) => setGerar((p) => ({ ...p, valor_total: e.target.value }))} />
          </label>
          <button className="button-primary" type="button" onClick={handleGerar} disabled={busy}>{busy ? '...' : 'Gerar'}</button>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="empty-state">Carregando parcelas...</div>
        ) : parcelas.length === 0 ? (
          <div className="empty-state" style={{ padding: 20 }}>Nenhuma parcela. Gere acima para dividir esta conta em vencimentos.</div>
        ) : (
          <table className="parc-table">
            <thead>
              <tr><th>#</th><th>Vencimento</th><th>Valor</th><th>Status</th><th style={{ textAlign: 'right' }}>Ações</th></tr>
            </thead>
            <tbody>
              {parcelas.map((p) => {
                const vencida = p.status === 'PENDENTE' && p.data_vencimento && p.data_vencimento < todayIso()
                const st = vencida ? 'VENCIDO' : p.status
                return (
                  <tr key={p.id} className={vencida ? 'parc-vencida' : ''}>
                    <td>{p.numero}/{p.total}</td>
                    <td>{fmtDate(p.data_vencimento)}{p.data_pagamento && <small style={{ display: 'block', color: '#059669' }}>pago {fmtDate(p.data_pagamento)}</small>}</td>
                    <td className={p.status === 'PAGO' ? 'parc-paga' : ''}>{fmtBRL(p.valor)}</td>
                    <td><span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, color: STATUS_TONE[st] || '#64748b', background: `${STATUS_TONE[st] || '#64748b'}18` }}>{st}</span></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {p.status !== 'PAGO'
                        ? <button className="button-primary" type="button" style={{ fontSize: 10, padding: '2px 8px' }} disabled={busy} onClick={() => marcar(p, 'PAGO')}>✓ Pagar</button>
                        : <button className="button-secondary" type="button" style={{ fontSize: 10, padding: '2px 8px' }} disabled={busy} onClick={() => marcar(p, 'PENDENTE')}>↺ Reabrir</button>}
                      <button className="button-secondary" type="button" style={{ fontSize: 10, padding: '2px 6px', marginLeft: 4, color: '#dc2626' }} disabled={busy} onClick={() => excluir(p)}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700 }}>Total</td>
                <td style={{ fontWeight: 800 }}>{fmtBRL(totalParcelas)}</td>
                <td colSpan={2} style={{ fontSize: 11, color: '#059669' }}>Pago: {fmtBRL(totalPago)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}

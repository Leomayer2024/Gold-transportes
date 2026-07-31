import { useEffect, useMemo, useState, useRef } from 'react'
import { api } from '../services/api'

// ─── Dados fixos do prestador (GOLD) — pré-preenchidos, mas editáveis ──────────

const PRESTADOR_PADRAO = {
  prestador_cnpj: '29.882.605/0001-35',
  prestador_nome: 'GOLD PB TRANSPORTES E LOGISTICA LTDA',
  prestador_endereco: 'RUA HORTENCIO RIBEIRO DE LUNA 1961 GALPAO B2 INDUSTRIAL',
  prestador_inscricao_municipal: '0001416877',
  prestador_email: 'financeiro@transportesgold.com.br',
  prestador_municipio: 'JOAO PESSOA / PB',
  prestador_telefone: '(41) 99787-2000',
  prestador_cep: '58081-400',
}

const STATUS_OPTS = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'emitida', label: 'Emitida' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'substituida', label: 'Substituída' },
]

const EXIGIBILIDADE_OPTS = [
  'Exigível', 'Não Incidente', 'Isenção', 'Imune', 'Exigibilidade Suspensa',
]

const RESPONSAVEL_OPTS = [
  { value: 'PRESTADOR', label: 'Prestador do serviço' },
  { value: 'TOMADOR', label: 'Tomador do serviço' },
]

const STATUS_LABELS = Object.fromEntries(STATUS_OPTS.map((o) => [o.value, o.label]))

function statusTone(status) {
  if (status === 'emitida') return 'success'
  if (status === 'cancelada') return 'danger'
  if (status === 'substituida') return 'neutral'
  return 'warning' // rascunho
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function todayIso() { return new Date().toISOString().slice(0, 10) }
function currentMonth() { return new Date().toISOString().slice(0, 7) }

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = String(dateStr).slice(0, 10).split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${y}`
}

function formatCompetencia(dateStr) {
  if (!dateStr) return '—'
  const [y, m] = String(dateStr).slice(0, 7).split('-')
  if (!y || !m) return '—'
  return `${m}/${y}`
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

function num(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100 }

// ─── Importação de XML da NFSe (padrão ABRASF, tolerante a namespaces) ──────────
// Lê o XML oficial da nota (baixado no portal da prefeitura) e devolve um objeto
// com os campos do formulário. Só inclui o que achou — o resto fica no default.
function parseNfseXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Arquivo não é um XML válido.')

  const low = (s) => String(s || '').toLowerCase()
  const kids = (node) => Array.from(node?.children || [])
  // Busca em largura por localName (ignora prefixo/namespace), 1º match.
  function find(root, ...names) {
    if (!root) return null
    const targets = names.map(low)
    const stack = [...kids(root)]
    while (stack.length) {
      const n = stack.shift()
      if (targets.includes(low(n.localName || n.tagName))) return n
      stack.push(...kids(n))
    }
    return null
  }
  const txt = (root, ...names) => {
    const el = find(root, ...names)
    return el ? (el.textContent || '').trim() : ''
  }
  const toNum = (t) => {
    if (t == null || t === '') return ''
    let s = String(t).trim()
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.') // 1.234,56 → 1234.56
    const n = Number(s)
    return Number.isFinite(n) ? n : ''
  }
  const enderecoStr = (blk) => {
    const e = find(blk, 'Endereco')
    if (!e) return ''
    const linha = [txt(e, 'Endereco', 'Logradouro'), txt(e, 'Numero'), txt(e, 'Complemento')].filter(Boolean).join(', ')
    const bairro = txt(e, 'Bairro')
    return (bairro ? `${linha} - ${bairro}` : linha).trim()
  }

  const root = doc.documentElement
  const prest = find(root, 'PrestadorServico', 'Prestador', 'DadosPrestador')
  const tom = find(root, 'TomadorServico', 'Tomador', 'DadosTomador')
  const serv = find(root, 'Servico', 'DadosServico') || root
  const valores = find(serv, 'Valores') || find(root, 'Valores') || serv
  const valNfse = find(root, 'ValoresNfse') || root

  const comp = txt(root, 'Competencia')
  const emis = txt(root, 'DataEmissao', 'DataEmissaoRps')

  let aliq = toNum(txt(valores, 'Aliquota'))
  if (aliq !== '' && aliq > 0 && aliq <= 1) aliq = round2(aliq * 100) // 0.05 → 5

  const issRet = low(txt(valores, 'IssRetido', 'IssqnRetido'))
  const simples = low(txt(root, 'OptanteSimplesNacional', 'OptanteSimples'))

  const discr = txt(serv, 'Discriminacao')
  // Pedido SAP: tag própria, ou "Pedido: NNNN" dentro da discriminação.
  const pedido_sap = txt(root, 'Pedido', 'NumeroPedido') ||
    (discr.match(/pedido[:\s#ºn.º-]*([0-9]{3,})/i)?.[1] || '')

  const data = {
    numero: txt(valNfse, 'Numero') || txt(root, 'Numero'),
    codigo_verificacao: txt(root, 'CodigoVerificacao'),
    chave_acesso: txt(root, 'ChaveAcesso', 'ChaveAcessoNFSe', 'chNFSe'),
    competencia: comp ? comp.slice(0, 7) : '',
    data_emissao: emis ? emis.slice(0, 10) : '',

    prestador_cnpj: txt(prest, 'Cnpj', 'CpfCnpj'),
    prestador_nome: txt(prest, 'RazaoSocial', 'NomeRazaoSocial', 'Nome'),
    prestador_inscricao_municipal: txt(prest, 'InscricaoMunicipal'),
    prestador_endereco: enderecoStr(prest),
    prestador_cep: txt(prest, 'Cep'),
    prestador_email: txt(prest, 'Email'),
    prestador_telefone: txt(prest, 'Telefone', 'Fone'),

    tomador_cnpj: txt(tom, 'Cnpj', 'Cpf', 'CpfCnpj'),
    tomador_nome: txt(tom, 'RazaoSocial', 'NomeRazaoSocial', 'Nome'),
    tomador_inscricao_municipal: txt(tom, 'InscricaoMunicipal'),
    tomador_endereco: enderecoStr(tom),
    tomador_cep: txt(tom, 'Cep'),
    tomador_email: txt(tom, 'Email'),
    tomador_telefone: txt(tom, 'Telefone', 'Fone'),

    cnae: txt(serv, 'CodigoCnae', 'Cnae'),
    item_lista_servico: txt(serv, 'ItemListaServico'),
    discriminacao: discr,
    pedido_sap,
    municipio_incidencia: txt(serv, 'MunicipioIncidencia', 'CodigoMunicipio'),

    valor_servicos: toNum(txt(valores, 'ValorServicos')),
    total_deducoes: toNum(txt(valores, 'ValorDeducoes')),
    desconto_incondicionado: toNum(txt(valores, 'DescontoIncondicionado')),
    desconto_condicionado: toNum(txt(valores, 'DescontoCondicionado')),
    aliquota_issqn: aliq,

    valor_irrf: toNum(txt(valores, 'ValorIr', 'ValorIrrf')),
    valor_pis: toNum(txt(valores, 'ValorPis')),
    valor_cofins: toNum(txt(valores, 'ValorCofins')),
    valor_inss: toNum(txt(valores, 'ValorInss')),
    valor_csll: toNum(txt(valores, 'ValorCsll')),
    outras_retencoes: toNum(txt(valores, 'OutrasRetencoes')),

    issqn_retido: issRet === '1' || issRet === 'true' || issRet.includes('sim'),
    optante_simples: simples === '1' || simples === 'true' || simples.includes('sim'),
  }

  // Remove vazios pra não sobrescrever os defaults (ex.: prestador Gold).
  const out = {}
  for (const [k, v] of Object.entries(data)) {
    if (v !== '' && v != null) out[k] = v
  }
  return out
}

// Cálculos derivados da NFSe (base, ISSQN, retenções, líquido).
function computeValores(form) {
  const vServ = num(form.valor_servicos)
  const ded = num(form.total_deducoes)
  const descInc = num(form.desconto_incondicionado)
  const descCond = num(form.desconto_condicionado)
  const aliq = num(form.aliquota_issqn)

  const base = round2(Math.max(0, vServ - ded - descInc))
  const issqn = round2(base * (aliq / 100))

  const federais =
    num(form.valor_irrf) + num(form.valor_pis) + num(form.valor_cofins) +
    num(form.valor_inss) + num(form.valor_csll) + num(form.outras_retencoes)

  const totalRet = round2(federais + (form.issqn_retido ? issqn : 0))
  const liquido = round2(vServ - descCond - totalRet)

  return { base, issqn, totalRet, liquido }
}

function emptyForm() {
  return {
    ...PRESTADOR_PADRAO,
    filial_id: '',
    cliente_id: '',
    numero: '',
    codigo_verificacao: '',
    chave_acesso: '',
    contrato_operacional_id: '',
    tipo_servico: 'SERVIÇO',
    pedido_sap: '',
    competencia: currentMonth(),
    data_emissao: todayIso(),
    status: 'rascunho',

    tomador_cnpj: '',
    tomador_nome: '',
    tomador_endereco: '',
    tomador_inscricao_municipal: '',
    tomador_email: '',
    tomador_municipio: '',
    tomador_telefone: '',
    tomador_cep: '',

    cnae: '',
    item_lista_servico: '',
    discriminacao: '',
    local_prestacao: '',
    municipio_incidencia: '',
    pais_prestacao: 'BRASIL',

    optante_simples: false,
    regime_especial: '',
    exigibilidade_issqn: 'Exigível',
    issqn_retido: false,
    responsavel_recolhimento: 'PRESTADOR',

    valor_servicos: '',
    total_deducoes: '',
    desconto_incondicionado: '',
    desconto_condicionado: '',
    aliquota_issqn: '5',

    valor_irrf: '',
    valor_pis: '',
    valor_cofins: '',
    valor_inss: '',
    valor_csll: '',
    outras_retencoes: '',

    informacoes_complementares: '',
    observacoes: '',
  }
}

function fromRecord(nfse) {
  return {
    ...emptyForm(),
    ...nfse,
    filial_id: nfse.filial_id != null ? String(nfse.filial_id) : '',
    cliente_id: nfse.cliente_id != null ? String(nfse.cliente_id) : '',
    contrato_operacional_id: nfse.contrato_operacional_id != null ? String(nfse.contrato_operacional_id) : '',
    tipo_servico: nfse.tipo_servico || 'SERVIÇO',
    competencia: nfse.competencia ? String(nfse.competencia).slice(0, 7) : '',
    data_emissao: nfse.data_emissao ? String(nfse.data_emissao).slice(0, 10) : '',
    optante_simples: !!nfse.optante_simples,
    issqn_retido: !!nfse.issqn_retido,
  }
}

// ─── Bloco de seção do formulário ───────────────────────────────────────────────

function Secao({ titulo, children }) {
  return (
    <div style={{ gridColumn: '1 / -1', marginTop: 6 }}>
      <div style={{
        fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
        color: 'var(--primary, #1e2d3d)', borderBottom: '2px solid #e5e7eb',
        paddingBottom: 4, marginBottom: 10,
      }}>
        {titulo}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {children}
      </div>
    </div>
  )
}

// ─── Modal de cadastro / edição ──────────────────────────────────────────────────

const TIPOS_SERVICO = ['HORA EXTRA', 'SERVIÇO', 'CONTRATO', 'KM RODADO', 'OUTRO']

function NfseModal({ nfse, initial, filiais, clientes, contratos = [], onSave, onClose }) {
  const [form, setForm] = useState(() => (
    nfse ? fromRecord(nfse) : (initial ? { ...emptyForm(), ...initial } : emptyForm())
  ))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setField(f, v) { setForm((p) => ({ ...p, [f]: v })) }

  const calc = useMemo(() => computeValores(form), [form])

  function aplicarCliente(id) {
    setField('cliente_id', id)
    const c = clientes.find((x) => String(x.id) === String(id))
    if (!c) return
    setForm((p) => ({
      ...p,
      cliente_id: id,
      tomador_nome: c.nome || p.tomador_nome,
      tomador_cnpj: c.cnpj || p.tomador_cnpj,
      tomador_email: c.email || p.tomador_email,
      tomador_telefone: c.telefone || p.tomador_telefone,
      tomador_endereco: c.endereco || p.tomador_endereco,
    }))
  }

  // Contrato selecionado → auto-preenche filial, tomador (cliente do contrato)
  // e sugere valor quando tipo=CONTRATO. Tudo continua editável.
  const contratoSel = contratos.find((c) => String(c.id) === String(form.contrato_operacional_id))

  function aplicarContrato(id) {
    const c = contratos.find((x) => String(x.id) === String(id))
    if (!c) { setField('contrato_operacional_id', id); return }
    const cli = clientes.find((x) => x.nome && c.cliente_nome && x.nome.trim().toUpperCase() === c.cliente_nome.trim().toUpperCase())
    setForm((p) => ({
      ...p,
      contrato_operacional_id: id,
      filial_id: c.filial_id != null ? String(c.filial_id) : p.filial_id,
      cliente_id: cli ? String(cli.id) : p.cliente_id,
      tomador_nome: p.tomador_nome || c.cliente_nome || '',
      tomador_cnpj: p.tomador_cnpj || cli?.cnpj || '',
      tomador_email: p.tomador_email || cli?.email || '',
      tomador_endereco: p.tomador_endereco || cli?.endereco || '',
      valor_servicos: p.valor_servicos || (p.tipo_servico === 'CONTRATO' ? String(c.valor_mensal_contrato || '') : p.valor_servicos),
      discriminacao: p.discriminacao || `Prestação de serviço referente a ${(p.tipo_servico || 'serviço').toLowerCase()} — contrato ${c.nome_contrato || id}`,
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.tomador_nome.trim()) { setError('Informe o tomador do serviço.'); return }
    setSaving(true)
    setError('')
    try {
      const text = (v) => (v != null && String(v).trim() !== '' ? String(v).trim() : null)
      const payload = {
        filial_id: form.filial_id ? Number(form.filial_id) : null,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        numero: text(form.numero),
        codigo_verificacao: text(form.codigo_verificacao),
        chave_acesso: text(form.chave_acesso),
        contrato_operacional_id: form.contrato_operacional_id ? Number(form.contrato_operacional_id) : null,
        tipo_servico: form.tipo_servico || 'SERVIÇO',
        pedido_sap: text(form.pedido_sap),
        competencia: form.competencia ? `${form.competencia}-01` : null,
        data_emissao: form.data_emissao || null,
        status: form.status || 'rascunho',

        prestador_cnpj: text(form.prestador_cnpj),
        prestador_nome: text(form.prestador_nome),
        prestador_endereco: text(form.prestador_endereco),
        prestador_inscricao_municipal: text(form.prestador_inscricao_municipal),
        prestador_email: text(form.prestador_email),
        prestador_municipio: text(form.prestador_municipio),
        prestador_telefone: text(form.prestador_telefone),
        prestador_cep: text(form.prestador_cep),

        tomador_cnpj: text(form.tomador_cnpj),
        tomador_nome: form.tomador_nome.trim(),
        tomador_endereco: text(form.tomador_endereco),
        tomador_inscricao_municipal: text(form.tomador_inscricao_municipal),
        tomador_email: text(form.tomador_email),
        tomador_municipio: text(form.tomador_municipio),
        tomador_telefone: text(form.tomador_telefone),
        tomador_cep: text(form.tomador_cep),

        cnae: text(form.cnae),
        item_lista_servico: text(form.item_lista_servico),
        discriminacao: text(form.discriminacao),
        local_prestacao: text(form.local_prestacao),
        municipio_incidencia: text(form.municipio_incidencia),
        pais_prestacao: text(form.pais_prestacao),

        optante_simples: !!form.optante_simples,
        regime_especial: text(form.regime_especial),
        exigibilidade_issqn: text(form.exigibilidade_issqn),
        issqn_retido: !!form.issqn_retido,
        responsavel_recolhimento: form.responsavel_recolhimento || 'PRESTADOR',

        valor_servicos: num(form.valor_servicos),
        total_deducoes: num(form.total_deducoes),
        desconto_incondicionado: num(form.desconto_incondicionado),
        desconto_condicionado: num(form.desconto_condicionado),
        base_calculo: calc.base,
        aliquota_issqn: num(form.aliquota_issqn),
        valor_issqn: calc.issqn,

        valor_irrf: num(form.valor_irrf),
        valor_pis: num(form.valor_pis),
        valor_cofins: num(form.valor_cofins),
        valor_inss: num(form.valor_inss),
        valor_csll: num(form.valor_csll),
        outras_retencoes: num(form.outras_retencoes),
        total_retencoes: calc.totalRet,
        valor_liquido: calc.liquido,

        informacoes_complementares: text(form.informacoes_complementares),
        observacoes: text(form.observacoes),
        ativo: true,
      }
      if (nfse?.id) {
        await api.update('notas_fiscais_servico', nfse.id, payload)
      } else {
        await api.create('notas_fiscais_servico', payload)
      }
      onSave()
    } catch (err) {
      setError(err.message || 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const money = { type: 'number', min: '0', step: '0.01', placeholder: '0,00' }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{nfse?.id ? 'Editar NFSe' : 'Nova NFSe'}</h2>
          <button className="button-secondary" onClick={onClose} type="button">✕</button>
        </div>

        <div style={{ padding: 18, overflowY: 'auto' }}>
        {error && <div className="alert-error" style={{ marginBottom: 12 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

            <Secao titulo="Contrato e tipo de cobrança">
              <label className="field">
                <span>Contrato (auto-preenche)</span>
                <select value={form.contrato_operacional_id} onChange={(e) => aplicarContrato(e.target.value)}>
                  <option value="">— sem vínculo —</option>
                  {contratos.map((c) => <option key={c.id} value={c.id}>{c.nome_contrato || `Contrato ${c.id}`}{c.cliente_nome ? ` · ${c.cliente_nome}` : ''}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Tipo de serviço cobrado</span>
                <select value={form.tipo_servico} onChange={(e) => setField('tipo_servico', e.target.value)}>
                  {TIPOS_SERVICO.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              {contratoSel && (
                <div style={{ gridColumn: '1 / -1', fontSize: 12, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: '8px 12px', color: '#0c4a6e' }}>
                  <strong>{contratoSel.nome_contrato}</strong>
                  {contratoSel.cliente_nome ? <> · Cliente: <strong>{contratoSel.cliente_nome}</strong></> : null}
                  {Number(contratoSel.valor_mensal_contrato) > 0 ? <> · Valor mensal: <strong>{Number(contratoSel.valor_mensal_contrato).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></> : null}
                  <span style={{ color: '#64748b' }}> — valores sugeridos, edite como precisar. Tipo "{form.tipo_servico}" vira a obrigação na Conta a Receber.</span>
                </div>
              )}
            </Secao>

            <Secao titulo="Identificação da NFSe">
              <label className="field">
                <span>Número</span>
                <input type="text" placeholder="Ex.: 1000367" value={form.numero} onChange={(e) => setField('numero', e.target.value)} />
              </label>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Chave de acesso da NFSe Nacional</span>
                <input type="text" placeholder="50 dígitos — ex.: 2507507122988260..." value={form.chave_acesso} onChange={(e) => setField('chave_acesso', e.target.value)} style={{ fontFamily: 'monospace' }} />
              </label>
              <label className="field">
                <span>Código de verificação</span>
                <input type="text" value={form.codigo_verificacao} onChange={(e) => setField('codigo_verificacao', e.target.value)} />
              </label>
              <label className="field">
                <span>Pedido SAP (opcional)</span>
                <input type="text" placeholder="Ex.: 4500123456" value={form.pedido_sap} onChange={(e) => setField('pedido_sap', e.target.value)} />
              </label>
              <label className="field">
                <span>Competência</span>
                <input type="month" value={form.competencia} onChange={(e) => setField('competencia', e.target.value)} />
              </label>
              <label className="field">
                <span>Data de emissão</span>
                <input type="date" value={form.data_emissao} onChange={(e) => setField('data_emissao', e.target.value)} />
              </label>
              <label className="field">
                <span>Status</span>
                <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
                  {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Filial (opcional)</span>
                <select value={form.filial_id} onChange={(e) => setField('filial_id', e.target.value)}>
                  <option value="">—</option>
                  {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
                </select>
              </label>
            </Secao>

            <Secao titulo="Prestador do serviço (Gold)">
              <label className="field">
                <span>CNPJ</span>
                <input type="text" value={form.prestador_cnpj} onChange={(e) => setField('prestador_cnpj', e.target.value)} />
              </label>
              <label className="field">
                <span>Inscrição municipal</span>
                <input type="text" value={form.prestador_inscricao_municipal} onChange={(e) => setField('prestador_inscricao_municipal', e.target.value)} />
              </label>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Nome / razão social</span>
                <input type="text" value={form.prestador_nome} onChange={(e) => setField('prestador_nome', e.target.value)} />
              </label>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Endereço</span>
                <input type="text" value={form.prestador_endereco} onChange={(e) => setField('prestador_endereco', e.target.value)} />
              </label>
              <label className="field">
                <span>Município</span>
                <input type="text" value={form.prestador_municipio} onChange={(e) => setField('prestador_municipio', e.target.value)} />
              </label>
              <label className="field">
                <span>CEP</span>
                <input type="text" value={form.prestador_cep} onChange={(e) => setField('prestador_cep', e.target.value)} />
              </label>
              <label className="field">
                <span>E-mail</span>
                <input type="text" value={form.prestador_email} onChange={(e) => setField('prestador_email', e.target.value)} />
              </label>
              <label className="field">
                <span>Telefone</span>
                <input type="text" value={form.prestador_telefone} onChange={(e) => setField('prestador_telefone', e.target.value)} />
              </label>
            </Secao>

            <Secao titulo="Tomador do serviço">
              {clientes.length > 0 && (
                <label className="field" style={{ gridColumn: '1 / -1' }}>
                  <span>Cliente cadastrado (preenche automaticamente)</span>
                  <select value={form.cliente_id} onChange={(e) => aplicarCliente(e.target.value)}>
                    <option value="">— preencher manualmente —</option>
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.cnpj ? ` · ${c.cnpj}` : ''}</option>)}
                  </select>
                </label>
              )}
              <label className="field">
                <span>CPF / CNPJ</span>
                <input type="text" value={form.tomador_cnpj} onChange={(e) => setField('tomador_cnpj', e.target.value)} />
              </label>
              <label className="field">
                <span>Inscrição municipal</span>
                <input type="text" value={form.tomador_inscricao_municipal} onChange={(e) => setField('tomador_inscricao_municipal', e.target.value)} />
              </label>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Nome / razão social *</span>
                <input type="text" required value={form.tomador_nome} onChange={(e) => setField('tomador_nome', e.target.value)} />
              </label>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Endereço</span>
                <input type="text" value={form.tomador_endereco} onChange={(e) => setField('tomador_endereco', e.target.value)} />
              </label>
              <label className="field">
                <span>Município</span>
                <input type="text" value={form.tomador_municipio} onChange={(e) => setField('tomador_municipio', e.target.value)} />
              </label>
              <label className="field">
                <span>CEP</span>
                <input type="text" value={form.tomador_cep} onChange={(e) => setField('tomador_cep', e.target.value)} />
              </label>
              <label className="field">
                <span>E-mail</span>
                <input type="text" value={form.tomador_email} onChange={(e) => setField('tomador_email', e.target.value)} />
              </label>
              <label className="field">
                <span>Telefone</span>
                <input type="text" value={form.tomador_telefone} onChange={(e) => setField('tomador_telefone', e.target.value)} />
              </label>
            </Secao>

            <Secao titulo="Serviço prestado">
              <label className="field">
                <span>CNAE</span>
                <input type="text" placeholder="Ex.: 5212-5/00-00" value={form.cnae} onChange={(e) => setField('cnae', e.target.value)} />
              </label>
              <label className="field">
                <span>Item lista de serviço (LC 116)</span>
                <input type="text" placeholder="Ex.: 11.04" value={form.item_lista_servico} onChange={(e) => setField('item_lista_servico', e.target.value)} />
              </label>
              <label className="field">
                <span>Local da prestação</span>
                <input type="text" value={form.local_prestacao} onChange={(e) => setField('local_prestacao', e.target.value)} />
              </label>
              <label className="field">
                <span>Município de incidência do ISSQN</span>
                <input type="text" value={form.municipio_incidencia} onChange={(e) => setField('municipio_incidencia', e.target.value)} />
              </label>
              <label className="field">
                <span>País da prestação</span>
                <input type="text" value={form.pais_prestacao} onChange={(e) => setField('pais_prestacao', e.target.value)} />
              </label>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Discriminação do serviço</span>
                <textarea rows={3} value={form.discriminacao} onChange={(e) => setField('discriminacao', e.target.value)} style={{ resize: 'vertical' }} placeholder="Ex.: Faturamento de serviço referente ao período 01/05/2026 a 31/08/2026, Pedido: ..." />
              </label>
            </Secao>

            <Secao titulo="Tributação do ISSQN">
              <label className="field">
                <span>Exigibilidade do ISSQN</span>
                <select value={form.exigibilidade_issqn} onChange={(e) => setField('exigibilidade_issqn', e.target.value)}>
                  {EXIGIBILIDADE_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Responsável pelo recolhimento</span>
                <select value={form.responsavel_recolhimento} onChange={(e) => setField('responsavel_recolhimento', e.target.value)}>
                  {RESPONSAVEL_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Regime especial de tributação</span>
                <input type="text" value={form.regime_especial} onChange={(e) => setField('regime_especial', e.target.value)} />
              </label>
              <div className="field" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={form.optante_simples} onChange={(e) => setField('optante_simples', e.target.checked)} />
                  Optante pelo Simples Nacional
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={form.issqn_retido} onChange={(e) => setField('issqn_retido', e.target.checked)} />
                  ISSQN retido pelo tomador
                </label>
              </div>
            </Secao>

            <Secao titulo="Valores e cálculo do ISSQN">
              <label className="field">
                <span>Valor dos serviços (R$)</span>
                <input {...money} value={form.valor_servicos} onChange={(e) => setField('valor_servicos', e.target.value)} />
              </label>
              <label className="field">
                <span>Alíquota ISSQN (%)</span>
                <input type="number" min="0" step="0.000001" placeholder="5,00" value={form.aliquota_issqn} onChange={(e) => setField('aliquota_issqn', e.target.value)} />
              </label>
              <label className="field">
                <span>Total de deduções (R$)</span>
                <input {...money} value={form.total_deducoes} onChange={(e) => setField('total_deducoes', e.target.value)} />
              </label>
              <label className="field">
                <span>Desconto incondicionado (R$)</span>
                <input {...money} value={form.desconto_incondicionado} onChange={(e) => setField('desconto_incondicionado', e.target.value)} />
              </label>
              <label className="field">
                <span>Desconto condicionado (R$)</span>
                <input {...money} value={form.desconto_condicionado} onChange={(e) => setField('desconto_condicionado', e.target.value)} />
              </label>
              <div className="field">
                <span>Base de cálculo (R$)</span>
                <input type="text" readOnly value={formatCurrency(calc.base)} style={{ background: '#f3f4f6', fontWeight: 600 }} />
              </div>
              <div className="field">
                <span>Valor do ISSQN (R$)</span>
                <input type="text" readOnly value={formatCurrency(calc.issqn)} style={{ background: '#f3f4f6', fontWeight: 600 }} />
              </div>
            </Secao>

            <Secao titulo="Retenções federais">
              <label className="field">
                <span>IRRF (R$)</span>
                <input {...money} value={form.valor_irrf} onChange={(e) => setField('valor_irrf', e.target.value)} />
              </label>
              <label className="field">
                <span>PIS (R$)</span>
                <input {...money} value={form.valor_pis} onChange={(e) => setField('valor_pis', e.target.value)} />
              </label>
              <label className="field">
                <span>COFINS (R$)</span>
                <input {...money} value={form.valor_cofins} onChange={(e) => setField('valor_cofins', e.target.value)} />
              </label>
              <label className="field">
                <span>INSS (R$)</span>
                <input {...money} value={form.valor_inss} onChange={(e) => setField('valor_inss', e.target.value)} />
              </label>
              <label className="field">
                <span>CSLL (R$)</span>
                <input {...money} value={form.valor_csll} onChange={(e) => setField('valor_csll', e.target.value)} />
              </label>
              <label className="field">
                <span>Outras retenções (R$)</span>
                <input {...money} value={form.outras_retencoes} onChange={(e) => setField('outras_retencoes', e.target.value)} />
              </label>
              <div className="field">
                <span>Total de retenções (R$)</span>
                <input type="text" readOnly value={formatCurrency(calc.totalRet)} style={{ background: '#f3f4f6', fontWeight: 600 }} />
              </div>
              <div className="field">
                <span>Valor líquido da NFSe (R$)</span>
                <input type="text" readOnly value={formatCurrency(calc.liquido)} style={{ background: '#ecfdf5', fontWeight: 700, color: '#0d9488' }} />
              </div>
            </Secao>

            <Secao titulo="Informações complementares">
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Informações complementares</span>
                <textarea rows={2} value={form.informacoes_complementares} onChange={(e) => setField('informacoes_complementares', e.target.value)} style={{ resize: 'vertical' }} />
              </label>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Observações internas</span>
                <textarea rows={2} value={form.observacoes} onChange={(e) => setField('observacoes', e.target.value)} style={{ resize: 'vertical' }} />
              </label>
            </Secao>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="button-primary" disabled={saving}>
              {saving ? 'Salvando...' : nfse?.id ? 'Salvar' : 'Cadastrar'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}

// ─── Importação em massa (listaNotaFiscalList do portal) ─────────────────────────

function parseNfseBatch(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Arquivo não é um XML válido.')

  const items = Array.from(doc.querySelectorAll('notaFiscalList'))
  if (!items.length) throw new Error('Nenhuma nota encontrada no arquivo.')

  const toNum = (t) => {
    if (t == null || t === '') return ''
    let s = String(t).trim()
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.') // 1.234,56 → 1234.56
    const n = Number(s)
    return Number.isFinite(n) ? n : ''
  }

  const parseDataHora = (dhStr) => {
    if (!dhStr) return ''
    // Ex: "30/06/2026 16:42:20" → "2026-06-30"
    const m = dhStr.match(/(\d{2})\/(\d{2})\/(\d{4})/)
    return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
  }

  const parseCompetencia = (compStr) => {
    if (!compStr) return ''
    // Ex: "06/2026" → "2026-06"
    const m = compStr.match(/(\d{2})\/(\d{4})/)
    return m ? `${m[2]}-${m[1]}` : ''
  }

  return items.map((item) => {
    const getText = (selector) => (item.querySelector(selector)?.textContent || '').trim()

    return {
      numero: getText('numeroNota'),
      competencia: parseCompetencia(getText('competencia')),
      data_emissao: parseDataHora(getText('dataHoraEmissao')),
      tomador_nome: getText('nomeEmpresarial'),
      cnae: getText('codigoAtividade'),
      valor_servicos: toNum(getText('valorServico')),
      base_calculo: toNum(getText('valorBaseCalculoCalculado')),
      aliquota_issqn: '5', // padrão
      valor_issqn: toNum(getText('valorIssqnCalculado')),
      status: 'emitida',
    }
  })
}

// ─── Modal de importação em massa ────────────────────────────────────────────────

function ImportarEmMassaModal({ filiais, clientes, onImportados, onClose }) {
  const [arquivos, setArquivos] = useState([])
  const [selectedFilial, setSelectedFilial] = useState('')
  const [selectedCliente, setSelectedCliente] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  async function handleXmlFile(file) {
    try {
      const text = await file.text()
      const notas = parseNfseBatch(text)
      setArquivos(notas)
      setWarning('')
      setError('')
    } catch (err) {
      setError(err.message || 'Erro ao ler XML')
    }
  }

  function handleFileInput(e) {
    const file = e.target.files?.[0]
    if (file) handleXmlFile(file)
    e.target.value = ''
  }

  async function handleImportar() {
    if (!selectedFilial && !selectedCliente) {
      setError('Selecione pelo menos uma filial ou cliente')
      return
    }
    if (!arquivos.length) {
      setError('Nenhuma nota foi carregada')
      return
    }

    setSaving(true)
    setError('')
    let sucesso = 0
    let falhas = 0

    for (const nota of arquivos) {
      try {
        const payload = {
          filial_id: selectedFilial ? Number(selectedFilial) : null,
          cliente_id: selectedCliente ? Number(selectedCliente) : null,
          numero: nota.numero || null,
          competencia: nota.competencia ? `${nota.competencia}-01` : null,
          data_emissao: nota.data_emissao || null,
          status: nota.status || 'rascunho',
          tomador_nome: nota.tomador_nome || 'SEM NOME',
          cnae: nota.cnae || null,
          aliquota_issqn: num(nota.aliquota_issqn) || 5,
          valor_servicos: num(nota.valor_servicos) || 0,
          base_calculo: num(nota.base_calculo) || num(nota.valor_servicos) || 0,
          valor_issqn: num(nota.valor_issqn) || 0,
          total_retencoes: 0,
          valor_liquido: num(nota.valor_servicos) || 0,
          ...PRESTADOR_PADRAO,
          ativo: true,
        }
        await api.create('notas_fiscais_servico', payload)
        sucesso++
      } catch (err) {
        falhas++
        console.error(`Falha na nota ${nota.numero}:`, err)
      }
    }

    setSaving(false)
    if (sucesso > 0) {
      alert(`✅ ${sucesso} nota(s) importada(s) com sucesso!${falhas ? `\n⚠️ ${falhas} falha(s)` : ''}`)
      onImportados()
    } else {
      setError(`Nenhuma nota foi importada. Erros: ${falhas}`)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⬆️ Importar NFSe em massa</h2>
          <button className="button-secondary" onClick={onClose} type="button">✕</button>
        </div>

        <div style={{ padding: 18 }}>
          {error && <div className="alert-error" style={{ marginBottom: 12 }}>{error}</div>}
          {warning && <div className="alert-warning" style={{ marginBottom: 12 }}>{warning}</div>}

          <div style={{ marginBottom: 16 }}>
            <label className="field" style={{ marginBottom: 12 }}>
              <span>📂 Selecione o arquivo XML (listaNotaFiscalList)</span>
              <input
                type="file"
                accept=".xml,text/xml,application/xml"
                onChange={handleFileInput}
                disabled={saving}
              />
            </label>

            {arquivos.length > 0 && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', padding: 12, borderRadius: 4, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#166534', marginBottom: 6 }}>
                  ✅ {arquivos.length} nota(s) carregada(s)
                </div>
                <div style={{ fontSize: 12, color: '#166534', maxHeight: 120, overflowY: 'auto' }}>
                  {arquivos.map((n, i) => (
                    <div key={i}>• Nº {n.numero} | {n.tomador_nome} | {formatCurrency(n.valor_servicos)}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <label className="field">
              <span>Filial (opcional)</span>
              <select value={selectedFilial} onChange={(e) => setSelectedFilial(e.target.value)} disabled={saving}>
                <option value="">— Todas —</option>
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Cliente (opcional)</span>
              <select value={selectedCliente} onChange={(e) => setSelectedCliente(e.target.value)} disabled={saving}>
                <option value="">— Nenhum —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="button" className="button-primary" onClick={handleImportar} disabled={saving || !arquivos.length}>
              {saving ? 'Importando...' : '✅ Importar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────────

export default function NfseEmitidasPage() {
  const [filiais, setFiliais] = useState([])
  const [clientes, setClientes] = useState([])
  const [contratos, setContratos] = useState([])
  const [notas, setNotas] = useState([])
  const [loading, setLoading] = useState(false)
  const _loaded = useRef(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [modal, setModal] = useState(null) // null | {} | {...nfse} | { __initial }
  const [importarEmMassa, setImportarEmMassa] = useState(false) // novo state
  const xmlInputRef = useRef(null)
  const [fFilial, setFFilial] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fComp, setFComp] = useState('')   // 'YYYY-MM'
  const [fBusca, setFBusca] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  useEffect(() => {
    api.list('filiais', { ativo: true }).then(setFiliais).catch(() => {})
    api.list('clientes', { ativo: true }).then(setClientes).catch(() => setClientes([]))
    api.list('contratos_operacionais', { ativo: true, limit: 500 }).then((r) => setContratos(r.items || r || [])).catch(() => setContratos([]))
  }, [])

  useEffect(() => {
    let active = true
    if (!_loaded.current) setLoading(true)
    const params = { ativo: true }
    if (fFilial) params.filial_id = fFilial
    if (fStatus) params.status = fStatus

    api.list('notas_fiscais_servico', params)
      .then((rows) => { if (active) setNotas(Array.isArray(rows) ? rows : (rows?.data || [])) })
      .catch(() => { if (active) setNotas([]) })
      .finally(() => { if (active) { _loaded.current = true; setLoading(false) } })

    return () => { active = false }
  }, [fFilial, fStatus, refreshKey])

  const filtradas = useMemo(() => {
    let list = notas
    if (fComp) list = list.filter((n) => String(n.competencia || '').startsWith(fComp))
    const q = fBusca.trim().toLowerCase()
    if (!q) return list
    return list.filter((n) =>
      [n.numero, n.tomador_nome, n.tomador_cnpj, n.discriminacao, n.codigo_verificacao, n.pedido_sap]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [notas, fComp, fBusca])

  const totais = useMemo(() => filtradas.reduce((acc, n) => {
    acc.servicos += Number(n.valor_servicos || 0)
    acc.issqn += Number(n.valor_issqn || 0)
    acc.liquido += Number(n.valor_liquido || 0)
    return acc
  }, { servicos: 0, issqn: 0, liquido: 0 }), [filtradas])

  async function excluir(nota) {
    if (!window.confirm(`Excluir a NFSe ${nota.numero || ''} do tomador ${nota.tomador_nome || ''}?`)) return
    try {
      await api.update('notas_fiscais_servico', nota.id, { ativo: false })
      setRefreshKey((k) => k + 1)
    } catch (err) {
      alert(err.message || 'Falha ao excluir.')
    }
  }

  function handleSaved() {
    setModal(null)
    setRefreshKey((k) => k + 1)
  }

  async function handleSincronizar() {
    setSyncing(true)
    setSyncMsg('')
    try {
      const r = await api.sincronizarNfseFinanceiro()
      setSyncMsg(r?.geradas > 0
        ? `✓ ${r.geradas} conta(s) a receber sincronizada(s) a partir das NFSe.`
        : '✓ Tudo em dia — nenhuma conta nova a gerar.')
      setRefreshKey((k) => k + 1)
    } catch {
      setSyncMsg('Falha ao sincronizar o financeiro.')
    } finally {
      setSyncing(false)
    }
  }

  function onPickXml(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reimportar o mesmo arquivo
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const draft = parseNfseXml(String(reader.result || ''))
        if (!Object.keys(draft).length) {
          alert('Não consegui ler campos nesse XML. Confirme que é o XML da NFSe (não o PDF). Se persistir, me mande o arquivo pra eu ajustar o leitor.')
          return
        }
        setModal({ __initial: draft }) // abre o modal pré-preenchido pra revisar
      } catch (err) {
        alert('Erro ao ler o XML: ' + (err.message || err))
      }
    }
    reader.onerror = () => alert('Falha ao abrir o arquivo.')
    reader.readAsText(file, 'utf-8')
  }

  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Financeiro</span>
          <h1>NFS-e emitidas</h1>
          <p>Cadastre e consulte os dados das Notas Fiscais de Serviço emitidas pela Gold como prestadora. O prestador e o cálculo do ISSQN já vêm pré-preenchidos.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input ref={xmlInputRef} type="file" accept=".xml,text/xml,application/xml" style={{ display: 'none' }} onChange={onPickXml} />
          <button className="button-secondary" type="button" onClick={() => setImportarEmMassa(true)} title="⏱️ TEMPORÁRIO: Importar múltiplas NFSe de um arquivo XML em lote">📦 Importar em massa (XML)</button>
          <button className="button-secondary" type="button" onClick={() => xmlInputRef.current?.click()} title="Importar o XML oficial da NFSe (baixado no portal da prefeitura)">⬆️ Importar XML</button>
          <button className="button-secondary" type="button" onClick={handleSincronizar} disabled={syncing} title="Gera/atualiza as contas a receber a partir das NFSe">
            {syncing ? 'Sincronizando...' : '⟳ Sincronizar financeiro'}
          </button>
          <button className="button-primary" type="button" onClick={() => setModal({})}>+ Nova NFSe</button>
        </div>
      </div>

      {syncMsg && <div className="alert-success" style={{ marginBottom: 12 }}>{syncMsg}</div>}

      {/* Resumo */}
      <div className="notas-resumo-grid">
        <div className="notas-resumo-card tone-info">
          <div className="notas-resumo-icon">🧾</div>
          <div>
            <div className="notas-resumo-label">Serviços</div>
            <div className="notas-resumo-valor">{formatCurrency(totais.servicos)}</div>
            <div className="notas-resumo-contagem">{filtradas.length} {filtradas.length === 1 ? 'nota' : 'notas'}</div>
          </div>
        </div>
        <div className="notas-resumo-card tone-warning">
          <div className="notas-resumo-icon">🏛️</div>
          <div>
            <div className="notas-resumo-label">ISSQN</div>
            <div className="notas-resumo-valor">{formatCurrency(totais.issqn)}</div>
          </div>
        </div>
        <div className="notas-resumo-card tone-success">
          <div className="notas-resumo-icon">💰</div>
          <div>
            <div className="notas-resumo-label">Líquido</div>
            <div className="notas-resumo-valor">{formatCurrency(totais.liquido)}</div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="surface-card" style={{ padding: '12px 16px', marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <label className="field filter-field">
            <span>Filial</span>
            <select value={fFilial} onChange={(e) => setFFilial(e.target.value)}>
              <option value="">Todas</option>
              {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade}/{f.uf}</option>)}
            </select>
          </label>
          <label className="field filter-field">
            <span>Status</span>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="field filter-field">
            <span>Competência</span>
            <input type="month" value={fComp} onChange={(e) => setFComp(e.target.value)} />
          </label>
          <label className="field filter-field" style={{ gridColumn: 'span 2' }}>
            <span>Buscar</span>
            <input type="text" placeholder="Número, tomador, CNPJ, código, pedido SAP..." value={fBusca} onChange={(e) => setFBusca(e.target.value)} />
          </label>
        </div>
      </div>

      {/* Tabela */}
      <div className="surface-card">
        {loading ? (
          <div className="empty-state">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="empty-state">
            <strong>Nenhuma NFSe encontrada.</strong>
            <p>Clique em "+ Nova NFSe" para cadastrar.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="notas-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Tomador</th>
                  <th>Competência</th>
                  <th>Emissão</th>
                  <th>Serviços</th>
                  <th>ISSQN</th>
                  <th>Líquido</th>
                  <th>Status</th>
                  <th style={{ width: 140 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((nota) => (
                  <tr key={nota.id} className="notas-row">
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{nota.numero || <span style={{ color: '#bbb' }}>—</span>}</td>
                    <td>
                      <span>{nota.tomador_nome || <span style={{ color: '#bbb' }}>—</span>}</span>
                      {nota.tomador_cnpj && <small style={{ display: 'block', color: '#888', fontSize: 11 }}>{nota.tomador_cnpj}</small>}
                    </td>
                    <td>{formatCompetencia(nota.competencia)}</td>
                    <td>{formatDate(nota.data_emissao)}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(nota.valor_servicos)}</td>
                    <td>{formatCurrency(nota.valor_issqn)}</td>
                    <td style={{ fontWeight: 600, color: '#0d9488' }}>{formatCurrency(nota.valor_liquido)}</td>
                    <td>
                      <span className={`status-chip tone-${statusTone(nota.status)}`}>{STATUS_LABELS[nota.status] || nota.status}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="button-secondary" style={{ fontSize: 12, padding: '3px 10px' }} type="button" onClick={() => setModal(nota)}>Editar</button>
                        <button className="button-secondary" style={{ fontSize: 12, padding: '3px 8px', color: 'var(--danger,#c00)' }} type="button" onClick={() => excluir(nota)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600, padding: '8px 10px', borderTop: '2px solid #e5e7eb' }}>Totais exibidos:</td>
                  <td style={{ fontWeight: 700, padding: '8px 10px', borderTop: '2px solid #e5e7eb' }}>{formatCurrency(totais.servicos)}</td>
                  <td style={{ fontWeight: 700, padding: '8px 10px', borderTop: '2px solid #e5e7eb' }}>{formatCurrency(totais.issqn)}</td>
                  <td style={{ fontWeight: 700, padding: '8px 10px', borderTop: '2px solid #e5e7eb', color: '#0d9488' }}>{formatCurrency(totais.liquido)}</td>
                  <td colSpan={2} style={{ borderTop: '2px solid #e5e7eb' }} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {modal !== null && (
        <NfseModal
          nfse={modal?.id ? modal : null}
          initial={modal?.__initial || null}
          filiais={filiais}
          clientes={clientes}
          contratos={contratos}
          onSave={handleSaved}
          onClose={() => setModal(null)}
        />
      )}

      {importarEmMassa && (
        <ImportarEmMassaModal
          filiais={filiais}
          clientes={clientes}
          onImportados={() => {
            setImportarEmMassa(false)
            setRefreshKey((k) => k + 1)
          }}
          onClose={() => setImportarEmMassa(false)}
        />
      )}
    </section>
  )
}

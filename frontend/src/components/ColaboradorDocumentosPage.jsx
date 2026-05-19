import { useCallback, useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { canCreateResource, hasActionPermission } from '../lib/permissions'
import {
  CATEGORIAS,
  CATEGORIA_LABELS,
  STATUS_LABELS,
  TIPOS_OBRIGATORIOS_PADRAO,
  TIPOS_DOCUMENTOS,
  calcularValidadeSugerida,
  calcularPrazoValidadeDias,
  somarDiasIso,
  findTipoCatalogo,
  isTipoSensivel,
} from './rhDocumentos/catalogo'
import { enriquecerDocumento, contarAlertas, formatarDataBr } from './rhDocumentos/helpers'
import DocumentoModal from './rhDocumentos/DocumentoModal'
import ImportExcelModal from './rhDocumentos/ImportExcelModal'
import BulkUploadModal from './rhDocumentos/BulkUploadModal'
import SensitiveField from './rhDocumentos/SensitiveField'
import FichaColaboradorDrawer from './rhDocumentos/FichaColaboradorDrawer'
import {
  TIPOS_VINCULO,
  TIPO_VINCULO_LABELS,
  FASE_LABELS,
  calcularStatusContrato,
  STATUS_CONTRATO_LABELS,
} from './rhContratos/catalogo'
import ContratoModal from './rhContratos/ContratoModal'

const STATUS_FILTROS = [
  { value: '',                     label: 'Todos os status' },
  { value: 'vencido',              label: 'Vencidos' },
  { value: 'vence_em_breve',       label: 'Vence em breve' },
  { value: 'vigente',              label: 'Vigentes' },
  { value: 'vigente_sem_validade', label: 'Vigente sem validade' },
  { value: 'pendente',             label: 'Pendentes' },
  { value: 'nao_se_aplica',        label: 'Não se aplica' },
  { value: 'sem_arquivo',          label: 'Sem arquivo' },
]

function classeLinha(status) {
  if (status === 'vencido') return 'rh-status-vencido'
  if (status === 'vence_em_breve') return 'rh-status-alerta'
  if (status === 'vigente' || status === 'vigente_sem_validade') return 'rh-status-vigente'
  if (status === 'nao_se_aplica') return 'rh-status-na'
  return 'rh-status-pendente'
}

// Chips de filtro rápido — atalhos pré-configurados.
function fimDoMesAtual() {
  const hoje = new Date()
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
  return Math.ceil((fim - hoje) / 86400000)
}

const QUICK_CHIPS = [
  { id: 'vence-mes',         label: '📅 Vence este mês',     apply: { status: 'vence_em_breve', diasMax: fimDoMesAtual } },
  { id: 'vence-7',           label: '⏰ Vence em 7 dias',     apply: { status: '',               diasMax: () => 7 } },
  { id: 'vencidos-30',       label: '🚨 Vencidos +30 dias',   apply: { status: 'vencido',        diasMax: () => -30 } },
  { id: 'sem-validade',      label: '∞ Sem validade',        apply: { status: 'vigente_sem_validade', diasMax: '' } },
  { id: 'sem-arquivo',       label: '📂 Sem arquivo',         apply: { status: 'sem_arquivo',    diasMax: '' } },
]

export default function ColaboradorDocumentosPage() {
  const { profile } = useAuth()
  const podeCriar = canCreateResource(profile, 'colaborador_documentos')
  // Ações granulares (botões dentro da tela). Compat retroativa em
  // hasActionPermission: usuário sem nenhum action.* configurado vê tudo.
  const podeImportar = hasActionPermission(profile, 'action.documentos_rh.importar')
  const podeExportar = hasActionPermission(profile, 'action.documentos_rh.exportar')
  const podeRenovar  = hasActionPermission(profile, 'action.documentos_rh.renovar')
  const podeInativar = hasActionPermission(profile, 'action.documentos_rh.inativar')
  const podeExcluir  = hasActionPermission(profile, 'action.documentos_rh.excluir')

  const [colaboradores, setColaboradores] = useState([])
  const [filiais, setFiliais] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [contratos, setContratos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  // Filtros
  const [filtroBusca, setFiltroBusca] = useState('')
  const [filtroFilial, setFiltroFilial] = useState('')
  const [filtroColab, setFiltroColab] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroDiasMax, setFiltroDiasMax] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)

  // Visões e modais
  const [visao, setVisao] = useState('planilha') // 'planilha' | 'matriz' | 'contratos'
  const [edicao, setEdicao] = useState(null)
  const [novo, setNovo] = useState(false)
  const [novoColab, setNovoColab] = useState('')
  const [importExcelOpen, setImportExcelOpen] = useState(false)
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false)
  const [fichaColabId, setFichaColabId] = useState(null) // drawer da ficha
  const [contratoModal, setContratoModal] = useState(null) // null | 'novo' | {...}

  const [selecionados, setSelecionados] = useState(new Set())
  const [ordem, setOrdem] = useState({ campo: 'data_validade', dir: 'asc' })

  // Edição inline
  const [edicaoCelula, setEdicaoCelula] = useState(null) // { id, campo, valor }

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const [colab, fil, docs, conts] = await Promise.all([
        api.list('colaboradores', { ativo: true, limit: 1000 }),
        api.list('filiais', { limit: 200 }),
        api.list('colaborador_documentos', { limit: 5000 }),
        api.list('colaborador_contratos', { limit: 2000 }).catch(() => ({ data: [] })),
      ])
      const colabRows = colab?.data || colab || []
      const filialRows = fil?.data || fil || []
      const docRows = (docs?.data || docs || []).map((d) => enriquecerDocumento(d))
      const contRows = conts?.data || conts || []
      setColaboradores(colabRows)
      setFiliais(filialRows)
      setDocumentos(docRows)
      setContratos(contRows)
      try { window.dispatchEvent(new Event('rh-docs-changed')) } catch {}
    } catch (e) {
      setErro(e.message || 'Falha ao carregar documentos.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // ─── Filtro + ordenação ───────────────────────────────────────────────────
  const documentosFiltrados = useMemo(() => {
    let lista = documentos
    if (!mostrarInativos) lista = lista.filter((d) => d.ativo !== false)
    if (filtroFilial) lista = lista.filter((d) => String(d.filial_id) === String(filtroFilial))
    if (filtroColab) lista = lista.filter((d) => String(d.colaborador_id) === String(filtroColab))
    if (filtroCategoria) lista = lista.filter((d) => d.categoria === filtroCategoria)
    if (filtroStatus === 'sem_arquivo') {
      lista = lista.filter((d) => !d.arquivo_enviado)
    } else if (filtroStatus) {
      lista = lista.filter((d) => d.status_calculado === filtroStatus)
    }
    if (filtroDiasMax !== '') {
      const max = Number(filtroDiasMax)
      lista = lista.filter((d) => d.dias_para_vencer != null && d.dias_para_vencer <= max)
    }
    if (filtroBusca.trim()) {
      const q = filtroBusca.trim().toLowerCase()
      lista = lista.filter((d) => {
        const colab = colaboradores.find((c) => Number(c.id) === Number(d.colaborador_id))
        const blob = [
          colab?.nome_completo,
          d.tipo_documento,
          d.numero_documento,
          d.orgao_emissor,
          d.categoria,
          d.observacoes,
        ].filter(Boolean).join(' ').toLowerCase()
        return blob.includes(q)
      })
    }

    const dir = ordem.dir === 'desc' ? -1 : 1
    return [...lista].sort((a, b) => {
      const va = a[ordem.campo]
      const vb = b[ordem.campo]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return dir * (va - vb)
      return dir * String(va).localeCompare(String(vb), 'pt-BR')
    })
  }, [documentos, colaboradores, filtroBusca, filtroFilial, filtroColab, filtroCategoria, filtroStatus, filtroDiasMax, mostrarInativos, ordem])

  const alertas = useMemo(() => contarAlertas(documentosFiltrados), [documentosFiltrados])

  // ─── Lógica para visão "Contratos" ────────────────────────────────────────
  // Agrupa por vinculo_id e mostra apenas o termo mais recente.
  const contratosUltimaFase = useMemo(() => {
    const m = new Map()
    for (const c of contratos) {
      const key = c.vinculo_id || `solo-${c.id}`
      const existing = m.get(key)
      if (!existing || (c.data_inicio || '') > (existing.data_inicio || '')) {
        m.set(key, c)
      }
    }
    return Array.from(m.values())
  }, [contratos])

  const contratosFiltrados = useMemo(() => {
    let lista = contratosUltimaFase
    if (!mostrarInativos) lista = lista.filter((c) => !c.data_desligamento)
    if (filtroFilial) lista = lista.filter((c) => String(c.filial_id) === String(filtroFilial))
    if (filtroColab) lista = lista.filter((c) => String(c.colaborador_id) === String(filtroColab))
    if (filtroStatus) {
      lista = lista.filter((c) => calcularStatusContrato(c) === filtroStatus)
    }
    if (filtroBusca.trim()) {
      const q = filtroBusca.trim().toLowerCase()
      lista = lista.filter((c) => {
        const colab = colaboradores.find((x) => Number(x.id) === Number(c.colaborador_id))
        const blob = [colab?.nome_completo, c.cargo, c.tipo_vinculo, c.observacoes, c.motivo_desligamento]
          .filter(Boolean).join(' ').toLowerCase()
        return blob.includes(q)
      })
    }
    const rank = { vencido: 0, vence_em_breve: 1, vigente: 2, sem_inicio: 3, encerrado: 4 }
    return [...lista].sort((a, b) => {
      const ra = rank[calcularStatusContrato(a)] ?? 9
      const rb = rank[calcularStatusContrato(b)] ?? 9
      if (ra !== rb) return ra - rb
      return String(a.data_fim || '').localeCompare(String(b.data_fim || ''))
    })
  }, [contratosUltimaFase, mostrarInativos, filtroFilial, filtroColab, filtroStatus, filtroBusca, colaboradores])

  const alertasContratos = useMemo(() => {
    let vigentes = 0, alerta = 0, vencidos = 0, encerrados = 0
    for (const c of contratosUltimaFase) {
      const s = calcularStatusContrato(c)
      if (s === 'vigente') vigentes++
      else if (s === 'vence_em_breve') alerta++
      else if (s === 'vencido') vencidos++
      else if (s === 'encerrado') encerrados++
    }
    return { vigentes, alerta, vencidos, encerrados, total: contratosUltimaFase.length }
  }, [contratosUltimaFase])

  function aoClicarCard(filtro) {
    setFiltroStatus(filtro)
    setFiltroDiasMax('')
  }

  const [chipAtivo, setChipAtivo] = useState('')
  function aplicarChip(chip) {
    if (chipAtivo === chip.id) {
      // toggle off
      setChipAtivo('')
      setFiltroStatus('')
      setFiltroDiasMax('')
      return
    }
    setChipAtivo(chip.id)
    setFiltroStatus(chip.apply.status)
    const dias = typeof chip.apply.diasMax === 'function' ? chip.apply.diasMax() : chip.apply.diasMax
    setFiltroDiasMax(dias === '' ? '' : String(dias))
  }

  function alternarSelecionado(id) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function alternarTodos() {
    if (selecionados.size === documentosFiltrados.length) setSelecionados(new Set())
    else setSelecionados(new Set(documentosFiltrados.map((d) => d.id)))
  }

  function colaboradorPorId(id) {
    return colaboradores.find((c) => Number(c.id) === Number(id))
  }

  function filialPorId(id) {
    return filiais.find((f) => Number(f.id) === Number(id))
  }

  // ─── Edição inline ────────────────────────────────────────────────────────
  function iniciarEdicaoCelula(doc, campo) {
    let valor = doc[campo] ?? ''
    // Campo virtual "prazo_dias" — calcula a partir de emissao→validade.
    if (campo === 'prazo_dias') {
      valor = calcularPrazoValidadeDias(doc) ?? ''
    }
    setEdicaoCelula({ id: doc.id, campo, valor })
  }

  function aplicarEdicaoLocal(id, patch) {
    setDocumentos((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d
        return enriquecerDocumento({ ...d, ...patch })
      }),
    )
  }

  function commitEdicaoCelula() {
    if (!edicaoCelula) return
    const { id, campo, valor } = edicaoCelula
    const original = documentos.find((d) => d.id === id)
    setEdicaoCelula(null)
    if (!original) return

    // Caso especial: edição do prazo em dias.
    if (campo === 'prazo_dias') {
      const dias = Number(valor)
      if (!Number.isFinite(dias) || dias < 0) return
      const base = original.data_emissao || new Date().toISOString().slice(0, 10)
      const novaValidade = somarDiasIso(base, dias)
      const patch = { data_validade: novaValidade }
      if (!original.data_emissao) patch.data_emissao = base
      aplicarEdicaoLocal(id, patch)
      api.update('colaborador_documentos', id, patch).catch((e) => {
        setErro(`Falha ao salvar: ${e.message}`)
        carregar()
      })
      return
    }

    if (String(original[campo] ?? '') === String(valor ?? '')) return
    aplicarEdicaoLocal(id, { [campo]: valor })
    salvarCampoRemoto(id, campo, valor)
  }

  async function salvarCampoRemoto(id, campo, valor) {
    try {
      let normalizado = valor === '' ? null : valor
      if (campo === 'dias_alerta') normalizado = normalizado == null ? null : Number(normalizado)
      await api.update('colaborador_documentos', id, { [campo]: normalizado })
    } catch (e) {
      setErro(`Falha ao salvar: ${e.message}`)
      carregar()
    }
  }

  // ─── Ações em lote ────────────────────────────────────────────────────────
  async function acaoLote(acao) {
    if (selecionados.size === 0) return
    const ids = Array.from(selecionados)
    let confirmacao = ''
    if (acao === 'inativar') confirmacao = `Inativar ${ids.length} documento(s)?`
    if (acao === 'excluir') confirmacao = `Excluir definitivamente ${ids.length} documento(s)? Esta ação não pode ser desfeita.`
    if (acao === 'na') confirmacao = `Marcar ${ids.length} documento(s) como "não se aplica"?`
    if (confirmacao && !window.confirm(confirmacao)) return

    for (const id of ids) {
      try {
        if (acao === 'inativar') await api.update('colaborador_documentos', id, { ativo: false })
        if (acao === 'na') await api.update('colaborador_documentos', id, { status: 'nao_se_aplica' })
        if (acao === 'excluir') await api.remove('colaborador_documentos', id)
      } catch (e) {
        console.error('Falha em lote', id, e)
      }
    }
    setSelecionados(new Set())
    carregar()
  }

  async function renovarSelecionados() {
    if (selecionados.size === 0) return
    if (!window.confirm(`Renovar ${selecionados.size} documento(s)? Será criado um novo registro com emissão = hoje e validade calculada pelo tipo.`)) return
    const hoje = new Date().toISOString().slice(0, 10)
    const ids = Array.from(selecionados)
    for (const id of ids) {
      const orig = documentos.find((d) => d.id === id)
      if (!orig) continue
      const validade = calcularValidadeSugerida(orig.tipo_documento, hoje) || ''
      try {
        await api.create('colaborador_documentos', {
          colaborador_id: orig.colaborador_id,
          filial_id: orig.filial_id,
          categoria: orig.categoria,
          tipo_documento: orig.tipo_documento,
          numero_documento: orig.numero_documento,
          orgao_emissor: orig.orgao_emissor,
          data_emissao: hoje,
          data_validade: validade || null,
          dias_alerta: orig.dias_alerta || 30,
          obrigatorio: orig.obrigatorio,
          observacoes: `Renovação de #${orig.id}`,
          ativo: true,
        })
        // Inativa o antigo
        await api.update('colaborador_documentos', orig.id, { ativo: false })
      } catch (e) {
        console.error('Falha ao renovar', id, e)
      }
    }
    setSelecionados(new Set())
    carregar()
  }

  function exportarSelecionados() {
    const lista = selecionados.size > 0
      ? documentosFiltrados.filter((d) => selecionados.has(d.id))
      : documentosFiltrados
    const linhas = lista.map((d) => ({
      Colaborador: colaboradorPorId(d.colaborador_id)?.nome_completo || d.colaborador_id,
      Filial: filialPorId(d.filial_id)?.cidade || d.filial_id,
      Categoria: CATEGORIA_LABELS[d.categoria] || d.categoria || '',
      'Tipo do documento': d.tipo_documento || '',
      'Número': d.numero_documento || '',
      'Órgão emissor': d.orgao_emissor || '',
      'Data emissão': d.data_emissao || '',
      'Data validade': d.data_validade || '',
      'Dias alerta': d.dias_alerta ?? 30,
      'Dias p/ vencer': d.dias_para_vencer ?? '',
      'Status': STATUS_LABELS[d.status_calculado] || d.status_calculado,
      'Obrigatório': d.obrigatorio ? 'Sim' : 'Não',
      'Arquivo': d.arquivo_url || '',
      'Observações': d.observacoes || '',
      'Ativo': d.ativo === false ? 'Não' : 'Sim',
    }))
    const ws = XLSX.utils.json_to_sheet(linhas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Documentos RH')
    XLSX.writeFile(wb, `documentos_rh_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  function aoClicarCabecalho(campo) {
    setOrdem((prev) => ({
      campo,
      dir: prev.campo === campo && prev.dir === 'asc' ? 'desc' : 'asc',
    }))
  }

  function abrirNovo(colaboradorId = '') {
    setNovoColab(colaboradorId)
    setNovo(true)
  }

  return (
    <div className="rh-documentos-page">
      <header className="page-header">
        <div>
          <h2>Documentos RH</h2>
          <p className="muted">
            Controle documental dos colaboradores: validades, anexos, alertas e renovação programada.
          </p>
        </div>
        <div className="rh-doc-header-actions">
          <div className="rh-doc-view-toggle">
            <button
              type="button"
              className={`button-secondary${visao === 'planilha' ? ' active' : ''}`}
              onClick={() => setVisao('planilha')}
              title="Lista de documentos com validade"
            >📊 Planilha</button>
            <button
              type="button"
              className={`button-secondary${visao === 'matriz' ? ' active' : ''}`}
              onClick={() => setVisao('matriz')}
              title="Matriz colaborador × tipo de documento"
            >📋 Matriz</button>
            <button
              type="button"
              className={`button-secondary${visao === 'contratos' ? ' active' : ''}`}
              onClick={() => { setVisao('contratos'); setFiltroStatus('') }}
              title="Vínculos contratuais (CLT, estágio, PJ, temporário, aprendiz)"
            >📑 Contratos</button>
          </div>
          {visao !== 'contratos' && podeExportar && (
            <button type="button" className="button-secondary" onClick={exportarSelecionados}>
              ⬇ Exportar Excel
            </button>
          )}
          {podeCriar && visao !== 'contratos' && (
            <>
              {podeImportar && (
                <>
                  <button type="button" className="button-secondary" onClick={() => setImportExcelOpen(true)}>
                    ⬆ Importar Excel
                  </button>
                  <button type="button" className="button-secondary" onClick={() => setBulkUploadOpen(true)}>
                    📎 Upload em lote
                  </button>
                </>
              )}
              <button type="button" className="button-primary" onClick={() => abrirNovo()}>
                + Novo documento
              </button>
            </>
          )}
          {visao === 'contratos' && podeCriar && (
            <button type="button" className="button-primary" onClick={() => setContratoModal('novo')}>
              + Novo vínculo
            </button>
          )}
        </div>
      </header>

      {erro && <div className="alert-danger">{erro}</div>}

      {/* Cards de alerta */}
      {visao === 'contratos' ? (
        <section className="rh-doc-alert-cards">
          <button type="button" className={`rh-doc-card vencidos${filtroStatus === 'vencido' ? ' active' : ''}`} onClick={() => aoClicarCard('vencido')}>
            <span>Vencidos</span>
            <strong>{alertasContratos.vencidos}</strong>
            <small>Definir prorrogação ou desligamento</small>
          </button>
          <button type="button" className={`rh-doc-card alerta${filtroStatus === 'vence_em_breve' ? ' active' : ''}`} onClick={() => aoClicarCard('vence_em_breve')}>
            <span>Vencem em breve</span>
            <strong>{alertasContratos.alerta}</strong>
            <small>Próximos 15 dias</small>
          </button>
          <button type="button" className={`rh-doc-card vigentes${filtroStatus === 'vigente' ? ' active' : ''}`} onClick={() => aoClicarCard('vigente')}>
            <span>Vigentes</span>
            <strong>{alertasContratos.vigentes}</strong>
            <small>Contratos ativos</small>
          </button>
          <button type="button" className={`rh-doc-card pendentes${filtroStatus === 'encerrado' ? ' active' : ''}`} onClick={() => { setFiltroStatus(filtroStatus === 'encerrado' ? '' : 'encerrado'); setMostrarInativos(true) }}>
            <span>Encerrados</span>
            <strong>{alertasContratos.encerrados}</strong>
            <small>Histórico de desligamentos</small>
          </button>
        </section>
      ) : (
        <section className="rh-doc-alert-cards">
          <button type="button" className={`rh-doc-card vencidos${filtroStatus === 'vencido' ? ' active' : ''}`} onClick={() => aoClicarCard('vencido')}>
            <span>Vencidos</span>
            <strong>{alertas.vencidos}</strong>
            <small>Regularize com urgência</small>
          </button>
          <button type="button" className={`rh-doc-card alerta${filtroStatus === 'vence_em_breve' ? ' active' : ''}`} onClick={() => aoClicarCard('vence_em_breve')}>
            <span>Vencem em breve</span>
            <strong>{alertas.venceEmBreve}</strong>
            <small>Dentro da régua de alerta</small>
          </button>
          <button type="button" className={`rh-doc-card pendentes${filtroStatus === 'pendente' ? ' active' : ''}`} onClick={() => aoClicarCard('pendente')}>
            <span>Pendentes</span>
            <strong>{alertas.pendentes}</strong>
            <small>Sem validade ou status final</small>
          </button>
          <button type="button" className={`rh-doc-card sem-arquivo${filtroStatus === 'sem_arquivo' ? ' active' : ''}`} onClick={() => aoClicarCard('sem_arquivo')}>
            <span>Sem arquivo</span>
            <strong>{alertas.semArquivo}</strong>
            <small>Cadastro sem PDF ou foto</small>
          </button>
          <button type="button" className={`rh-doc-card vigentes${filtroStatus === 'vigente' ? ' active' : ''}`} onClick={() => aoClicarCard('vigente')}>
            <span>Vigentes</span>
            <strong>{alertas.total - alertas.vencidos - alertas.venceEmBreve - alertas.pendentes}</strong>
            <small>Documentos em dia</small>
          </button>
        </section>
      )}

      {/* Chips de filtro rápido (só faz sentido nas visões de documentos) */}
      {visao !== 'contratos' && (
        <section className="rh-doc-chips">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`rh-doc-chip${chipAtivo === chip.id ? ' active' : ''}`}
              onClick={() => aplicarChip(chip)}
            >
              {chip.label}
            </button>
          ))}
        </section>
      )}

      {/* Filtros */}
      <section className="rh-doc-filtros">
        <input
          type="search"
          placeholder="Buscar por colaborador, tipo, número, órgão…"
          value={filtroBusca}
          onChange={(e) => setFiltroBusca(e.target.value)}
        />
        <select value={filtroFilial} onChange={(e) => setFiltroFilial(e.target.value)}>
          <option value="">Todas as filiais</option>
          {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade || f.nome || `Filial ${f.id}`}</option>)}
        </select>
        <select value={filtroColab} onChange={(e) => setFiltroColab(e.target.value)}>
          <option value="">Todos os colaboradores</option>
          {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome_completo}</option>)}
        </select>
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          {STATUS_FILTROS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input
          type="number"
          placeholder="Vence em até X dias"
          value={filtroDiasMax}
          onChange={(e) => setFiltroDiasMax(e.target.value)}
          min={0}
          style={{ width: 160 }}
        />
        <label className="rh-doc-filter-check">
          <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
          Mostrar inativos
        </label>
        {(filtroBusca || filtroFilial || filtroColab || filtroCategoria || filtroStatus || filtroDiasMax || mostrarInativos) && (
          <button
            type="button"
            className="button-link"
            onClick={() => {
              setFiltroBusca('')
              setFiltroFilial('')
              setFiltroColab('')
              setFiltroCategoria('')
              setFiltroStatus('')
              setFiltroDiasMax('')
              setMostrarInativos(false)
            }}
          >
            ✕ Limpar
          </button>
        )}
      </section>

      {/* Barra de ações em lote */}
      {selecionados.size > 0 && (
        <div className="rh-doc-bulk-bar">
          <strong>{selecionados.size} selecionado(s)</strong>
          {podeRenovar && (
            <button type="button" className="button-secondary" onClick={renovarSelecionados}>♻ Renovar</button>
          )}
          {podeInativar && (
            <>
              <button type="button" className="button-secondary" onClick={() => acaoLote('na')}>Marcar n/a</button>
              <button type="button" className="button-secondary" onClick={() => acaoLote('inativar')}>Inativar</button>
            </>
          )}
          {podeExportar && (
            <button type="button" className="button-secondary" onClick={exportarSelecionados}>⬇ Exportar</button>
          )}
          {podeExcluir && (
            <button type="button" className="button-link danger" onClick={() => acaoLote('excluir')}>Excluir</button>
          )}
          <button type="button" className="button-link" onClick={() => setSelecionados(new Set())}>Limpar seleção</button>
        </div>
      )}

      {/* Conteúdo */}
      {carregando ? (
        <div className="muted" style={{ padding: 16 }}>Carregando documentos…</div>
      ) : visao === 'planilha' ? (
        <VisaoPlanilha
          documentos={documentosFiltrados}
          colaboradores={colaboradores}
          filiais={filiais}
          selecionados={selecionados}
          alternarSelecionado={alternarSelecionado}
          alternarTodos={alternarTodos}
          ordem={ordem}
          aoClicarCabecalho={aoClicarCabecalho}
          aoEditar={(d) => setEdicao(d)}
          aoAbrirFicha={(colabId) => setFichaColabId(colabId)}
          edicaoCelula={edicaoCelula}
          iniciarEdicaoCelula={iniciarEdicaoCelula}
          setEdicaoCelula={setEdicaoCelula}
          commitEdicaoCelula={commitEdicaoCelula}
        />
      ) : visao === 'matriz' ? (
        <VisaoMatriz
          documentos={documentosFiltrados}
          colaboradores={colaboradores.filter((c) => !filtroFilial || String(c.filial_id) === String(filtroFilial))}
          aoCriar={(colaboradorId) => abrirNovo(colaboradorId)}
          aoEditar={(d) => setEdicao(d)}
          aoAbrirFicha={(colabId) => setFichaColabId(colabId)}
        />
      ) : (
        <VisaoContratos
          contratos={contratosFiltrados}
          colaboradores={colaboradores}
          filiais={filiais}
          aoEditar={(c) => setContratoModal(c)}
          aoAbrirFicha={(colabId) => setFichaColabId(colabId)}
        />
      )}

      {/* Modais */}
      {(novo || edicao) && (
        <DocumentoModal
          documento={edicao}
          defaultColaboradorId={novoColab}
          colaboradores={colaboradores}
          filiais={filiais}
          onClose={() => { setNovo(false); setEdicao(null); setNovoColab('') }}
          onSaved={carregar}
        />
      )}

      {importExcelOpen && (
        <ImportExcelModal
          colaboradores={colaboradores}
          filiais={filiais}
          onClose={() => setImportExcelOpen(false)}
          onImported={carregar}
        />
      )}

      {bulkUploadOpen && (
        <BulkUploadModal
          colaboradores={colaboradores}
          filiais={filiais}
          onClose={() => setBulkUploadOpen(false)}
          onImported={carregar}
        />
      )}

      {fichaColabId && (
        <FichaColaboradorDrawer
          colaboradorId={fichaColabId}
          colaboradores={colaboradores}
          filiais={filiais}
          documentos={documentos}
          onClose={() => setFichaColabId(null)}
          onEditarDoc={(d) => { setFichaColabId(null); setEdicao(d) }}
          onNovoDoc={(colabId) => { setFichaColabId(null); abrirNovo(colabId) }}
        />
      )}

      {contratoModal && (
        <ContratoModal
          contrato={contratoModal === 'novo' ? null : contratoModal}
          colaboradores={colaboradores}
          filiais={filiais}
          onClose={() => setContratoModal(null)}
          onSaved={() => { setContratoModal(null); carregar() }}
        />
      )}
    </div>
  )
}

// ── Visão Planilha ──────────────────────────────────────────────────────────
function VisaoPlanilha({
  documentos, colaboradores, filiais, selecionados, alternarSelecionado, alternarTodos,
  ordem, aoClicarCabecalho, aoEditar, aoAbrirFicha,
  edicaoCelula, iniciarEdicaoCelula, setEdicaoCelula, commitEdicaoCelula,
}) {
  const colaboradorPorId = (id) => colaboradores.find((c) => Number(c.id) === Number(id))
  const filialPorId = (id) => filiais.find((f) => Number(f.id) === Number(id))

  function indicadorOrdem(campo) {
    if (ordem.campo !== campo) return null
    return <span style={{ marginLeft: 4, opacity: 0.6 }}>{ordem.dir === 'asc' ? '▲' : '▼'}</span>
  }

  function renderCelulaEditavel(doc, campo, tipo = 'text') {
    const editando = edicaoCelula?.id === doc.id && edicaoCelula?.campo === campo
    if (editando) {
      return (
        <input
          type={tipo}
          autoFocus
          value={edicaoCelula.valor ?? ''}
          onChange={(e) => setEdicaoCelula({ ...edicaoCelula, valor: e.target.value })}
          onBlur={commitEdicaoCelula}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitEdicaoCelula() }
            if (e.key === 'Escape') setEdicaoCelula(null)
          }}
          className="rh-doc-inline-input"
        />
      )
    }
    let visual
    if (campo === 'prazo_dias') {
      const v = calcularPrazoValidadeDias(doc)
      visual = v == null ? '—' : `${v}d`
    } else {
      const valor = doc[campo]
      visual = tipo === 'date' ? formatarDataBr(valor) : (valor || '—')
    }
    return (
      <span
        className="rh-doc-inline-display"
        onDoubleClick={() => iniciarEdicaoCelula(doc, campo)}
        title={campo === 'prazo_dias' ? 'Duplo clique para definir o prazo em dias' : 'Duplo clique para editar'}
      >
        {visual}
      </span>
    )
  }

  function renderArquivos(doc) {
    const extras = Array.isArray(doc.arquivos_extras) ? doc.arquivos_extras : []
    const total = (doc.arquivo_url ? 1 : 0) + extras.length
    if (total === 0) return <span className="muted">—</span>
    return (
      <span className="rh-doc-files-cell">
        {doc.arquivo_url && (
          <a href={doc.arquivo_url} target="_blank" rel="noreferrer" className="button-link" title="Arquivo principal">📄</a>
        )}
        {extras.length > 0 && (
          <span className="rh-doc-extras-badge" title={extras.map((a) => a.nome || a.url).join('\n')}>
            +{extras.length}
          </span>
        )}
      </span>
    )
  }

  if (documentos.length === 0) {
    return <div className="muted" style={{ padding: 16 }}>Nenhum documento encontrado para os filtros atuais.</div>
  }

  return (
    <div className="rh-doc-table-wrapper">
      <table className="rh-doc-table">
        <thead>
          <tr>
            <th style={{ width: 28 }}>
              <input
                type="checkbox"
                checked={selecionados.size === documentos.length && documentos.length > 0}
                onChange={alternarTodos}
              />
            </th>
            <th onClick={() => aoClicarCabecalho('colaborador_id')} className="rh-doc-th-clickable">Colaborador{indicadorOrdem('colaborador_id')}</th>
            <th onClick={() => aoClicarCabecalho('filial_id')} className="rh-doc-th-clickable">Filial{indicadorOrdem('filial_id')}</th>
            <th onClick={() => aoClicarCabecalho('categoria')} className="rh-doc-th-clickable">Categoria{indicadorOrdem('categoria')}</th>
            <th onClick={() => aoClicarCabecalho('tipo_documento')} className="rh-doc-th-clickable">Tipo{indicadorOrdem('tipo_documento')}</th>
            <th>Número</th>
            <th onClick={() => aoClicarCabecalho('data_emissao')} className="rh-doc-th-clickable">Emissão{indicadorOrdem('data_emissao')}</th>
            <th onClick={() => aoClicarCabecalho('data_validade')} className="rh-doc-th-clickable">Validade{indicadorOrdem('data_validade')}</th>
            <th title="Quantos dias o documento vale a partir da emissão">Validade (dias)</th>
            <th onClick={() => aoClicarCabecalho('dias_para_vencer')} className="rh-doc-th-clickable">Dias p/ vencer{indicadorOrdem('dias_para_vencer')}</th>
            <th>Alerta</th>
            <th>Status</th>
            <th>Arquivo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {documentos.map((doc) => {
            const colab = colaboradorPorId(doc.colaborador_id)
            const filial = filialPorId(doc.filial_id)
            const status = doc.status_calculado
            return (
              <tr key={doc.id} className={`${classeLinha(status)}${doc.ativo === false ? ' rh-row-inactive' : ''}`}>
                <td>
                  <input
                    type="checkbox"
                    checked={selecionados.has(doc.id)}
                    onChange={() => alternarSelecionado(doc.id)}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="button-link"
                    title="Ver ficha completa do colaborador"
                    onClick={() => aoAbrirFicha?.(doc.colaborador_id)}
                  >
                    {colab?.nome_completo || `#${doc.colaborador_id}`}
                  </button>
                </td>
                <td>{filial?.cidade || filial?.nome || `Filial ${doc.filial_id}`}</td>
                <td>{CATEGORIA_LABELS[doc.categoria] || doc.categoria || '—'}</td>
                <td>{doc.tipo_documento}</td>
                <td>
                  {isTipoSensivel(doc.tipo_documento) ? (
                    <SensitiveField
                      value={doc.numero_documento}
                      docId={doc.id}
                      campo="numero_documento"
                    />
                  ) : (
                    renderCelulaEditavel(doc, 'numero_documento')
                  )}
                </td>
                <td>{renderCelulaEditavel(doc, 'data_emissao', 'date')}</td>
                <td>{renderCelulaEditavel(doc, 'data_validade', 'date')}</td>
                <td>{renderCelulaEditavel(doc, 'prazo_dias', 'number')}</td>
                <td className="rh-doc-dias">
                  {doc.dias_para_vencer == null ? '—' : (
                    <span className={`rh-dias-badge ${status}`}>
                      {doc.dias_para_vencer >= 0 ? `${doc.dias_para_vencer}d` : `${Math.abs(doc.dias_para_vencer)}d atrás`}
                    </span>
                  )}
                </td>
                <td>{renderCelulaEditavel(doc, 'dias_alerta', 'number')}</td>
                <td><span className={`rh-status-badge ${status}`}>{STATUS_LABELS[status] || status}</span></td>
                <td>{renderArquivos(doc)}</td>
                <td>
                  <button type="button" className="button-link" onClick={() => aoEditar(doc)}>editar</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Visão Contratos (vínculos contratuais) ──────────────────────────────────
function VisaoContratos({ contratos, colaboradores, filiais, aoEditar, aoAbrirFicha }) {
  const colabPorId = (id) => colaboradores.find((c) => Number(c.id) === Number(id))
  const filialPorId = (id) => filiais.find((f) => Number(f.id) === Number(id))

  if (contratos.length === 0) {
    return (
      <div className="muted" style={{ padding: 16 }}>
        Nenhum vínculo contratual encontrado para os filtros atuais.
      </div>
    )
  }

  return (
    <div className="rh-doc-table-wrapper">
      <table className="rh-doc-table">
        <thead>
          <tr>
            <th>Colaborador</th>
            <th>Filial</th>
            <th>Tipo</th>
            <th>Fase / Termo</th>
            <th>Início</th>
            <th>Fim</th>
            <th>Status</th>
            <th>Cargo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {contratos.map((c) => {
            const colab = colabPorId(c.colaborador_id)
            const filial = filialPorId(c.filial_id)
            const status = calcularStatusContrato(c)
            return (
              <tr key={c.id}>
                <td>
                  <button
                    type="button"
                    className="button-link"
                    title="Ver ficha completa do colaborador"
                    onClick={() => aoAbrirFicha?.(c.colaborador_id)}
                  >
                    {colab?.nome_completo || `#${c.colaborador_id}`}
                  </button>
                </td>
                <td>{filial?.cidade || filial?.nome || (c.filial_id ? `Filial ${c.filial_id}` : '—')}</td>
                <td>{TIPO_VINCULO_LABELS[c.tipo_vinculo] || c.tipo_vinculo}</td>
                <td>{FASE_LABELS[c.fase] || c.fase || '—'}</td>
                <td>{formatarDataBr(c.data_inicio) || '—'}</td>
                <td>{formatarDataBr(c.data_fim) || (c.fase === 'indeterminado' ? '∞' : '—')}</td>
                <td><span className={`rh-vinculo-status ${status}`}>{STATUS_CONTRATO_LABELS[status]}</span></td>
                <td>{c.cargo || '—'}</td>
                <td>
                  <button type="button" className="button-link" onClick={() => aoEditar?.(c)}>editar</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Visão Matriz colaborador × tipo ─────────────────────────────────────────
function VisaoMatriz({ documentos, colaboradores, aoCriar, aoEditar, aoAbrirFicha }) {
  // Tipos a mostrar = obrigatórios padrão ∪ tipos que aparecem nos documentos filtrados
  const tiposParaMostrar = useMemo(() => {
    const set = new Set(TIPOS_OBRIGATORIOS_PADRAO)
    for (const d of documentos) {
      if (d.tipo_documento) set.add(d.tipo_documento)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [documentos])

  // index[colaborador_id][tipo] = doc mais recente
  const indexCD = useMemo(() => {
    const out = {}
    for (const d of documentos) {
      const k = `${d.colaborador_id}::${d.tipo_documento}`
      const existing = out[k]
      if (!existing) { out[k] = d; continue }
      // pega o de validade mais nova
      const va = d.data_validade || ''
      const vb = existing.data_validade || ''
      if (va > vb) out[k] = d
    }
    return out
  }, [documentos])

  if (colaboradores.length === 0) {
    return <div className="muted" style={{ padding: 16 }}>Nenhum colaborador ativo para a filial selecionada.</div>
  }

  return (
    <div className="rh-doc-matrix-wrapper">
      <table className="rh-doc-matrix">
        <thead>
          <tr>
            <th className="rh-doc-matrix-name">Colaborador</th>
            {tiposParaMostrar.map((t) => (
              <th key={t} className="rh-doc-matrix-type" title={t}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {colaboradores.map((colab) => (
            <tr key={colab.id}>
              <td className="rh-doc-matrix-name">
                <button
                  type="button"
                  className="button-link"
                  title="Ver ficha completa do colaborador"
                  onClick={() => aoAbrirFicha?.(colab.id)}
                >
                  {colab.nome_completo}
                </button>
              </td>
              {tiposParaMostrar.map((tipo) => {
                const doc = indexCD[`${colab.id}::${tipo}`]
                if (!doc) {
                  const obrigatorio = findTipoCatalogo(tipo)?.obrigatorio
                  return (
                    <td key={tipo} className={`rh-doc-matrix-cell vazia${obrigatorio ? ' obrig' : ''}`}>
                      <button
                        type="button"
                        className="rh-doc-matrix-add"
                        title={obrigatorio ? `Falta cadastrar: ${tipo}` : `Cadastrar ${tipo}`}
                        onClick={() => aoCriar(colab.id)}
                      >
                        {obrigatorio ? '!' : '+'}
                      </button>
                    </td>
                  )
                }
                const status = doc.status_calculado
                return (
                  <td key={tipo} className={`rh-doc-matrix-cell ${status}`}>
                    <button
                      type="button"
                      className="rh-doc-matrix-info"
                      title={`${tipo}\nValidade: ${doc.data_validade || '—'}\nStatus: ${STATUS_LABELS[status] || status}`}
                      onClick={() => aoEditar(doc)}
                    >
                      {doc.data_validade ? formatarDataBr(doc.data_validade) : '✓'}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

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
  calcularValidadeSugerida,
  calcularPrazoValidadeDias,
  somarDiasIso,
  findTipoCatalogo,
  tipoBackend,
} from './veiculosDocumentos/catalogo'
import { enriquecerDocumento, contarAlertas, formatarDataBr, rotuloVeiculo } from './veiculosDocumentos/helpers'
import DocumentoModal from './veiculosDocumentos/DocumentoModal'
import { abrirDocumentoStorage } from '../lib/supabase'

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

function fimDoMesAtual() {
  const hoje = new Date()
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
  return Math.ceil((fim - hoje) / 86400000)
}

const QUICK_CHIPS = [
  { id: 'vence-mes',         label: '📅 Vence este mês',     apply: { status: 'vence_em_breve', diasMax: fimDoMesAtual } },
  { id: 'vence-7',           label: '⏰ Vence em 7 dias',     apply: { status: '',               diasMax: () => 7 } },
  { id: 'vence-30',          label: '⏰ Vence em 30 dias',    apply: { status: '',               diasMax: () => 30 } },
  { id: 'vencidos-30',       label: '🚨 Vencidos +30 dias',   apply: { status: 'vencido',        diasMax: () => -30 } },
  { id: 'sem-arquivo',       label: '📂 Sem arquivo',         apply: { status: 'sem_arquivo',    diasMax: '' } },
]

// Quando o registro vem do backend, tipo_documento é o enum (ex.: 'crlv').
// Restaura o nome canônico salvo em observações `[tipo:Nome]` para exibição.
function rotuloTipoExibicao(doc) {
  if (!doc) return ''
  const marker = String(doc.observacoes || '').match(/\[tipo:([^\]]+)\]/)
  if (marker) return marker[1].trim()
  return doc.tipo_documento || ''
}

function observacoesLimpas(doc) {
  return String(doc?.observacoes || '').replace(/\s*\[tipo:[^\]]+\]\s*/g, '').trim()
}

export default function VeiculosDocumentosPage() {
  const { profile } = useAuth()
  const podeCriar = canCreateResource(profile, 'veiculos_documentos')
  const podeImportar = hasActionPermission(profile, 'action.documentos_veiculos.importar')
  const podeExportar = hasActionPermission(profile, 'action.documentos_veiculos.exportar')
  const podeRenovar  = hasActionPermission(profile, 'action.documentos_veiculos.renovar')
  const podeExcluir  = hasActionPermission(profile, 'action.documentos_veiculos.excluir')

  const [veiculos, setVeiculos] = useState([])
  const [filiais, setFiliais] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  // Filtros
  const [filtroBusca, setFiltroBusca] = useState('')
  const [filtroFilial, setFiltroFilial] = useState('')
  const [filtroVeiculo, setFiltroVeiculo] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroDiasMax, setFiltroDiasMax] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)

  // Visões e modais
  const [visao, setVisao] = useState('planilha') // 'planilha' | 'matriz'
  const [edicao, setEdicao] = useState(null)
  const [novo, setNovo] = useState(false)
  const [novoVeiculoId, setNovoVeiculoId] = useState('')

  const [selecionados, setSelecionados] = useState(new Set())
  const [ordem, setOrdem] = useState({ campo: 'data_validade', dir: 'asc' })
  const [chipAtivo, setChipAtivo] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const [veic, fil, docs] = await Promise.all([
        api.list('veiculos', { limit: 2000 }),
        api.list('filiais', { limit: 200 }),
        api.list('veiculos_documentos', { limit: 5000 }),
      ])
      const veicRows = veic?.data || veic || []
      const filialRows = fil?.data || fil || []
      const docRows = (docs?.data || docs || []).map((d) =>
        enriquecerDocumento({
          ...d,
          tipo_documento_label: rotuloTipoExibicao(d),
          observacoes_visiveis: observacoesLimpas(d),
        }),
      )
      setVeiculos(veicRows)
      setFiliais(filialRows)
      setDocumentos(docRows)
      try { window.dispatchEvent(new Event('veiculo-docs-changed')) } catch {
        // ignore
      }
    } catch (e) {
      setErro(e.message || 'Falha ao carregar documentos de frota.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const veiculoPorId = useCallback(
    (id) => veiculos.find((v) => Number(v.id) === Number(id)),
    [veiculos],
  )
  const filialPorId = useCallback(
    (id) => filiais.find((f) => Number(f.id) === Number(id)),
    [filiais],
  )

  // ─── Filtro + ordenação ───────────────────────────────────────────────────
  const documentosFiltrados = useMemo(() => {
    let lista = documentos
    if (!mostrarInativos) {
      lista = lista.filter((d) => {
        const v = veiculoPorId(d.veiculo_id)
        return !v || v.status !== 'inativo'
      })
    }
    if (filtroFilial) {
      lista = lista.filter((d) => {
        const v = veiculoPorId(d.veiculo_id)
        return String(v?.filial_id || '') === String(filtroFilial)
      })
    }
    if (filtroVeiculo) lista = lista.filter((d) => String(d.veiculo_id) === String(filtroVeiculo))
    if (filtroCategoria) {
      lista = lista.filter((d) => {
        const cat = findTipoCatalogo(d.tipo_documento_label)?.categoria
        return cat === filtroCategoria
      })
    }
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
        const v = veiculoPorId(d.veiculo_id)
        const blob = [
          v?.placa,
          v?.marca,
          v?.modelo,
          d.tipo_documento_label,
          d.tipo_documento,
          d.numero_documento,
          d.orgao_emissor,
          d.observacoes_visiveis,
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
  }, [documentos, veiculoPorId, filtroBusca, filtroFilial, filtroVeiculo, filtroCategoria, filtroStatus, filtroDiasMax, mostrarInativos, ordem])

  const alertas = useMemo(() => contarAlertas(documentosFiltrados), [documentosFiltrados])

  function aoClicarCard(filtro) {
    setFiltroStatus((curr) => (curr === filtro ? '' : filtro))
    setFiltroDiasMax('')
  }

  function aplicarChip(chip) {
    if (chipAtivo === chip.id) {
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

  function aoClicarCabecalho(campo) {
    setOrdem((prev) => ({
      campo,
      dir: prev.campo === campo && prev.dir === 'asc' ? 'desc' : 'asc',
    }))
  }

  function abrirNovo(veiculoId = '') {
    setNovoVeiculoId(veiculoId)
    setNovo(true)
  }

  async function acaoLote(acao) {
    if (selecionados.size === 0) return
    const ids = Array.from(selecionados)
    let confirmacao = ''
    if (acao === 'excluir') confirmacao = `Excluir definitivamente ${ids.length} documento(s)? Esta ação não pode ser desfeita.`
    if (acao === 'na') confirmacao = `Marcar ${ids.length} documento(s) como "não se aplica"?`
    if (confirmacao && !window.confirm(confirmacao)) return

    for (const id of ids) {
      try {
        if (acao === 'na') await api.update('veiculos_documentos', id, { status: 'nao_se_aplica' })
        if (acao === 'excluir') await api.remove('veiculos_documentos', id)
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
      const validade = calcularValidadeSugerida(orig.tipo_documento_label, hoje) || ''
      const tipoLabel = orig.tipo_documento_label || orig.tipo_documento
      const enumBackend = tipoBackend(tipoLabel)
      const observacoesFinal = `Renovação de #${orig.id}\n[tipo:${tipoLabel}]`
      try {
        await api.create('veiculos_documentos', {
          veiculo_id: orig.veiculo_id,
          tipo_documento: enumBackend,
          numero_documento: orig.numero_documento,
          orgao_emissor: orig.orgao_emissor,
          data_emissao: hoje,
          data_validade: validade || null,
          prazo_renovacao_dias: orig.prazo_renovacao_dias || 30,
          observacoes: observacoesFinal,
          status: 'em_renovacao',
        })
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
    const linhas = lista.map((d) => {
      const v = veiculoPorId(d.veiculo_id)
      const f = filialPorId(v?.filial_id)
      const cat = findTipoCatalogo(d.tipo_documento_label)?.categoria
      return {
        Placa: v?.placa || `#${d.veiculo_id}`,
        Veículo: rotuloVeiculo(v),
        Filial: f?.cidade || (v?.filial_id ? `Filial ${v.filial_id}` : ''),
        Categoria: CATEGORIA_LABELS[cat] || cat || '',
        'Tipo do documento': d.tipo_documento_label || d.tipo_documento || '',
        'Enum backend': d.tipo_documento || '',
        'Número': d.numero_documento || '',
        'Órgão emissor': d.orgao_emissor || '',
        'Data emissão': d.data_emissao || '',
        'Data validade': d.data_validade || '',
        'Prazo alerta (dias)': d.prazo_renovacao_dias ?? 30,
        'Dias p/ vencer': d.dias_para_vencer ?? '',
        'Status': STATUS_LABELS[d.status_calculado] || d.status_calculado,
        'Arquivo': d.arquivo_url || '',
        'Observações': d.observacoes_visiveis || '',
      }
    })
    const ws = XLSX.utils.json_to_sheet(linhas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Documentos Frota')
    XLSX.writeFile(wb, `documentos_frota_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="rh-documentos-page">
      <header className="page-header">
        <div>
          <h2>Documentos da Frota</h2>
          <p className="muted">
            Controle documental dos veículos: CRLV, seguros, licenças, ANTT/INMETRO e inspeções. Vencimentos com alerta automático e arquivos anexados a cada veículo próprio.
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
              title="Matriz veículo × tipo de documento"
            >📋 Matriz</button>
          </div>
          {podeExportar && (
            <button type="button" className="button-secondary" onClick={exportarSelecionados}>
              ⬇ Exportar Excel
            </button>
          )}
          {podeCriar && (
            <button type="button" className="button-primary" onClick={() => abrirNovo()}>
              + Novo documento
            </button>
          )}
        </div>
      </header>

      {erro && <div className="alert-danger">{erro}</div>}

      {/* Cards de alerta */}
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
          <strong>{Math.max(0, alertas.total - alertas.vencidos - alertas.venceEmBreve - alertas.pendentes)}</strong>
          <small>Documentos em dia</small>
        </button>
      </section>

      {/* Chips de filtro rápido */}
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

      {/* Filtros */}
      <section className="rh-doc-filtros">
        <input
          type="search"
          placeholder="Buscar por placa, veículo, tipo, número, órgão…"
          value={filtroBusca}
          onChange={(e) => setFiltroBusca(e.target.value)}
        />
        <select value={filtroFilial} onChange={(e) => setFiltroFilial(e.target.value)}>
          <option value="">Todas as filiais</option>
          {filiais.map((f) => <option key={f.id} value={f.id}>{f.cidade || f.nome || `Filial ${f.id}`}</option>)}
        </select>
        <select value={filtroVeiculo} onChange={(e) => setFiltroVeiculo(e.target.value)}>
          <option value="">Todos os veículos</option>
          {veiculos
            .filter((v) => !filtroFilial || String(v.filial_id) === String(filtroFilial))
            .map((v) => <option key={v.id} value={v.id}>{rotuloVeiculo(v)}</option>)}
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
          Mostrar veículos inativos
        </label>
        {(filtroBusca || filtroFilial || filtroVeiculo || filtroCategoria || filtroStatus || filtroDiasMax || mostrarInativos) && (
          <button
            type="button"
            className="button-link"
            onClick={() => {
              setFiltroBusca('')
              setFiltroFilial('')
              setFiltroVeiculo('')
              setFiltroCategoria('')
              setFiltroStatus('')
              setFiltroDiasMax('')
              setMostrarInativos(false)
              setChipAtivo('')
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
          <button type="button" className="button-secondary" onClick={() => acaoLote('na')}>Marcar n/a</button>
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
        <div className="muted" style={{ padding: 16 }}>Carregando documentos da frota…</div>
      ) : visao === 'planilha' ? (
        <VisaoPlanilha
          documentos={documentosFiltrados}
          veiculos={veiculos}
          filiais={filiais}
          selecionados={selecionados}
          alternarSelecionado={alternarSelecionado}
          alternarTodos={alternarTodos}
          ordem={ordem}
          aoClicarCabecalho={aoClicarCabecalho}
          aoEditar={(d) => setEdicao(d)}
        />
      ) : (
        <VisaoMatriz
          documentos={documentosFiltrados}
          veiculos={veiculos.filter((v) => !filtroFilial || String(v.filial_id) === String(filtroFilial))}
          aoCriar={(veicId) => abrirNovo(veicId)}
          aoEditar={(d) => setEdicao(d)}
          aoFiltrarTipo={(tipo) => { setVisao('planilha'); setFiltroBusca(tipo) }}
        />
      )}

      {/* Modal */}
      {(novo || edicao) && (
        <DocumentoModal
          documento={edicao}
          defaultVeiculoId={novoVeiculoId}
          veiculos={veiculos}
          onClose={() => { setNovo(false); setEdicao(null); setNovoVeiculoId('') }}
          onSaved={carregar}
        />
      )}

      {/* podeImportar reservado pra futura importação por Excel */}
      {/* eslint-disable-next-line no-unused-expressions */}
      {podeImportar && null}
    </div>
  )
}

// ── Visão Planilha ──────────────────────────────────────────────────────────
function VisaoPlanilha({
  documentos, veiculos, filiais, selecionados, alternarSelecionado, alternarTodos,
  ordem, aoClicarCabecalho, aoEditar,
}) {
  const veiculoPorId = (id) => veiculos.find((v) => Number(v.id) === Number(id))
  const filialPorId = (id) => filiais.find((f) => Number(f.id) === Number(id))

  function indicadorOrdem(campo) {
    if (ordem.campo !== campo) return null
    return <span style={{ marginLeft: 4, opacity: 0.6 }}>{ordem.dir === 'asc' ? '▲' : '▼'}</span>
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
            <th onClick={() => aoClicarCabecalho('veiculo_id')} className="rh-doc-th-clickable">Veículo{indicadorOrdem('veiculo_id')}</th>
            <th>Filial</th>
            <th>Categoria</th>
            <th onClick={() => aoClicarCabecalho('tipo_documento_label')} className="rh-doc-th-clickable">Tipo{indicadorOrdem('tipo_documento_label')}</th>
            <th>Número</th>
            <th onClick={() => aoClicarCabecalho('data_emissao')} className="rh-doc-th-clickable">Emissão{indicadorOrdem('data_emissao')}</th>
            <th onClick={() => aoClicarCabecalho('data_validade')} className="rh-doc-th-clickable">Validade{indicadorOrdem('data_validade')}</th>
            <th onClick={() => aoClicarCabecalho('dias_para_vencer')} className="rh-doc-th-clickable">Dias p/ vencer{indicadorOrdem('dias_para_vencer')}</th>
            <th>Alerta</th>
            <th>Status</th>
            <th>Arquivo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {documentos.map((doc) => {
            const veic = veiculoPorId(doc.veiculo_id)
            const filial = filialPorId(veic?.filial_id)
            const status = doc.status_calculado
            const cat = findTipoCatalogo(doc.tipo_documento_label)?.categoria
            return (
              <tr key={doc.id} className={`${classeLinha(status)}${veic?.status === 'inativo' ? ' rh-row-inactive' : ''}`}>
                <td>
                  <input
                    type="checkbox"
                    checked={selecionados.has(doc.id)}
                    onChange={() => alternarSelecionado(doc.id)}
                  />
                </td>
                <td>
                  <strong>{veic?.placa || `#${doc.veiculo_id}`}</strong>
                  {veic && (veic.marca || veic.modelo) && (
                    <div style={{ fontSize: 11, opacity: 0.7 }}>{[veic.marca, veic.modelo].filter(Boolean).join(' ')}</div>
                  )}
                </td>
                <td>{filial?.cidade || filial?.nome || (veic?.filial_id ? `Filial ${veic.filial_id}` : '—')}</td>
                <td>{CATEGORIA_LABELS[cat] || '—'}</td>
                <td>{doc.tipo_documento_label || doc.tipo_documento}</td>
                <td>{doc.numero_documento || '—'}</td>
                <td>{formatarDataBr(doc.data_emissao) || '—'}</td>
                <td>{formatarDataBr(doc.data_validade) || '—'}</td>
                <td className="rh-doc-dias">
                  {doc.dias_para_vencer == null ? '—' : (
                    <span className={`rh-dias-badge ${status}`}>
                      {doc.dias_para_vencer >= 0 ? `${doc.dias_para_vencer}d` : `${Math.abs(doc.dias_para_vencer)}d atrás`}
                    </span>
                  )}
                </td>
                <td>{doc.prazo_renovacao_dias ?? 30}d</td>
                <td><span className={`rh-status-badge ${status}`}>{STATUS_LABELS[status] || status}</span></td>
                <td>
                  {doc.arquivo_url ? (
                    <button
                      type="button"
                      className="button-link"
                      title="Abrir arquivo (assina URL se bucket for privado)"
                      onClick={() => abrirDocumentoStorage(doc.arquivo_url)}
                    >📄</button>
                  ) : <span className="muted">—</span>}
                </td>
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

// ── Visão Matriz veículo × tipo ─────────────────────────────────────────────
function VisaoMatriz({ documentos, veiculos, aoCriar, aoEditar, aoFiltrarTipo }) {
  const tiposParaMostrar = useMemo(() => {
    const set = new Set(TIPOS_OBRIGATORIOS_PADRAO)
    for (const d of documentos) {
      const label = d.tipo_documento_label || d.tipo_documento
      if (label) set.add(label)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [documentos])

  const indexCD = useMemo(() => {
    const out = {}
    for (const d of documentos) {
      const label = d.tipo_documento_label || d.tipo_documento
      const k = `${d.veiculo_id}::${label}`
      const existing = out[k]
      if (!existing) { out[k] = d; continue }
      const va = d.data_validade || ''
      const vb = existing.data_validade || ''
      if (va > vb) out[k] = d
    }
    return out
  }, [documentos])

  if (veiculos.length === 0) {
    return <div className="muted" style={{ padding: 16 }}>Nenhum veículo ativo para a filial selecionada.</div>
  }

  return (
    <div className="rh-doc-matrix-wrapper">
      <table className="rh-doc-matrix">
        <thead>
          <tr>
            <th className="rh-doc-matrix-name">Veículo</th>
            {tiposParaMostrar.map((t) => (
              <th
                key={t}
                className="rh-doc-matrix-type rh-doc-th-clickable"
                title={`${t} — clique para filtrar a Planilha por este tipo`}
                onClick={() => aoFiltrarTipo?.(t)}
              >
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {veiculos.map((veic) => (
            <tr key={veic.id}>
              <td className="rh-doc-matrix-name">
                <strong>{veic.placa}</strong>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  {[veic.marca, veic.modelo].filter(Boolean).join(' ')}
                </div>
              </td>
              {tiposParaMostrar.map((tipo) => {
                const doc = indexCD[`${veic.id}::${tipo}`]
                if (!doc) {
                  const obrigatorio = findTipoCatalogo(tipo)?.obrigatorio
                  return (
                    <td key={tipo} className={`rh-doc-matrix-cell vazia${obrigatorio ? ' obrig' : ''}`}>
                      <button
                        type="button"
                        className="rh-doc-matrix-add"
                        title={obrigatorio ? `Falta cadastrar: ${tipo}` : `Cadastrar ${tipo}`}
                        onClick={() => aoCriar(veic.id)}
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

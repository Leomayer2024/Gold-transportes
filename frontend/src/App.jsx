import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardPage from './components/DashboardPage'
import FiliaisPage from './components/FiliaisPage'
import ColaboradoresPage from './components/ColaboradoresPage'
import ColaboradorDocumentosPage from './components/ColaboradorDocumentosPage'
import DiariasPage from './components/DiariasPage'
import ContratosOperacionaisPage from './components/ContratosOperacionaisPage'
import CustosRhPage from './components/CustosRhPage'
import AuditoriaPage from './components/AuditoriaPage'
import BonificacaoPage from './components/BonificacaoPage'
import BonificacaoMetricasPage from './components/BonificacaoMetricasPage'
import LoadingPage from './components/LoadingPage'
import AccessRoute from './components/AccessRoute'
import EventosRhPage from './components/EventosRhPage'
import Layout from './components/Layout'
import LoginPage from './components/LoginPage'
import RecuperarSenhaPage from './components/RecuperarSenhaPage'
import MotivosParadaPage from './components/MotivosParadaPage'
import PermissionsPage from './components/PermissionsPage'
import PresencePage from './components/PresencePage'
import ProtectedRoute from './components/ProtectedRoute'
import RotasCarregamentoPage from './components/RotasCarregamentoPage'
import VeiculosPage from './components/VeiculosPage'
import VeiculosCarregamentoPage from './components/VeiculosCarregamentoPage'
import WorkforceBoardPage from './components/WorkforceBoardPage'
import PedidosCompraPage from './components/PedidosCompraPage'
import PedidosCompraGraficosPage from './components/PedidosCompraGraficosPage'
import ItensCatalogoPage from './components/ItensCatalogoPage'
import AprovacoesPage from './components/AprovacoesPage'
import FeriadosPage from './components/FeriadosPage'
import NotasCTEPage from './components/NotasCTEPage'
import GestaoAcessosPage from './components/GestaoAcessosPage'
import EstoquePage from './components/EstoquePage'
import EstoqueMovimentosPage from './components/EstoqueMovimentosPage'
import AssinaturaPage from './components/AssinaturaPage'
import FrotaDashboardPage from './components/FrotaDashboardPage'
import AbastecimentosPage from './components/AbastecimentosPage'
import PneusPage from './components/PneusPage'
import ManutencoesPage from './components/ManutencoesPage'
import VeiculosDocumentosPage from './components/VeiculosDocumentosPage'
import HorasExtrasPage from './components/HorasExtrasPage'
import AcompanhamentoPage from './components/AcompanhamentoPage'
import HorasExtrasRTMPage from './components/HorasExtrasRTMPage'
import HorasExtrasHistoricoPage from './components/HorasExtrasHistoricoPage'
import HorasExtrasMetricasPage from './components/HorasExtrasMetricasPage'
import ContasReceberPage from './components/ContasReceberPage'
import ContasPagarPage from './components/ContasPagarPage'
import BancoPage from './components/BancoPage'
import FornecedoresPage from './components/FornecedoresPage'
import ClientesPage from './components/ClientesPage'
import MeuPerfilPage from './components/MeuPerfilPage'

function PlaceholderPage({ title, text }) {
  return (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Módulo</span>
          <h1>{title}</h1>
          <p>{text}</p>
        </div>
      </div>
      <div className="surface-card empty-state">
        <strong>Em preparação</strong>
        <p>Este módulo já está roteado no sistema e pronto para receber a próxima etapa de CRUD.</p>
      </div>
    </section>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/recuperar-senha" element={<RecuperarSenhaPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route element={<AccessRoute requiredScope="menu.dashboard" />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.filiais" />}>
            <Route path="/filiais" element={<FiliaisPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.colaboradores" />}>
            <Route path="/colaboradores" element={<ColaboradoresPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.custos_rh" />}>
            <Route path="/custos-rh" element={<CustosRhPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.contratos_operacionais" />}>
            <Route path="/contratos-operacionais" element={<ContratosOperacionaisPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.colaborador_documentos" />}>
            <Route path="/rh-documentos" element={<ColaboradorDocumentosPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.diarias" />}>
            <Route path="/diarias" element={<DiariasPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.eventos_rh" />}>
            <Route path="/rh-planejamento" element={<EventosRhPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.quadro_funcionarios" />}>
            <Route path="/quadro-funcionarios" element={<WorkforceBoardPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.bonificacao" />}>
            <Route path="/bonificacao" element={<BonificacaoPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.bonificacao_metricas" />}>
            <Route path="/bonificacao-metricas" element={<BonificacaoMetricasPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.frota_dashboard" />}>
            <Route path="/frota-dashboard" element={<FrotaDashboardPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.veiculos" />}>
            <Route path="/veiculos" element={<VeiculosPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.abastecimentos" />}>
            <Route path="/abastecimentos" element={<AbastecimentosPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.pneus" />}>
            <Route path="/pneus" element={<PneusPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.manutencoes" />}>
            <Route path="/manutencoes" element={<ManutencoesPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.veiculos_documentos" />}>
            <Route path="/veiculos-documentos" element={<VeiculosDocumentosPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.horas_extras" />}>
            <Route path="/horas-extras" element={<HorasExtrasPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.acompanhamento" />}>
            <Route path="/acompanhamento" element={<AcompanhamentoPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.rotas_carregamento" />}>
            <Route path="/rotas-carregamento" element={<RotasCarregamentoPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.veiculos_carregamento" />}>
            <Route path="/veiculos-carregamento" element={<VeiculosCarregamentoPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.motivos_parada_carregamento" />}>
            <Route path="/motivos-parada" element={<MotivosParadaPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.pedidos_compra" />}>
            <Route path="/pedidos-compra" element={<PedidosCompraPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="aprovar.pedidos_compra" />}>
            <Route path="/aprovacoes" element={<AprovacoesPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.pedidos_compra" />}>
            <Route path="/pedidos-compra-graficos" element={<PedidosCompraGraficosPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.pedidos_compra" />}>
            <Route path="/itens-catalogo" element={<ItensCatalogoPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.feriados" />}>
            <Route path="/feriados" element={<FeriadosPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.notas_cte" />}>
            <Route path="/notas-cte" element={<NotasCTEPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.gestao_acessos" />}>
            <Route path="/gestao-acessos" element={<GestaoAcessosPage />} />
          </Route>
          <Route path="/assinatura" element={<AssinaturaPage />} />
          <Route path="/meu-perfil" element={<MeuPerfilPage />} />
          <Route element={<AccessRoute requiredScope="menu.estoque" />}>
            <Route path="/estoque" element={<EstoquePage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.estoque" />}>
            <Route path="/estoque/movimentos" element={<EstoqueMovimentosPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.permissoes" />}>
            <Route path="/permissoes" element={<PermissionsPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.auditoria" />}>
            <Route path="/auditoria" element={<AuditoriaPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.presenca" />}>
            <Route path="/presenca" element={<PresencePage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.carregamento" />}>
            <Route path="/carregamento" element={<LoadingPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.horas_extras_rtm" />}>
            <Route path="/horas-extras-rtm" element={<HorasExtrasRTMPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.horas_extras_rtm" />}>
            <Route path="/horas-extras-historico" element={<HorasExtrasHistoricoPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.horas_extras_rtm" />}>
            <Route path="/horas-extras-metricas" element={<HorasExtrasMetricasPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.contas_receber" />}>
            <Route path="/contas-receber" element={<ContasReceberPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.contas_pagar" />}>
            <Route path="/contas-pagar" element={<ContasPagarPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.banco" />}>
            <Route path="/banco" element={<BancoPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.fornecedores" />}>
            <Route path="/fornecedores" element={<FornecedoresPage />} />
          </Route>
          <Route element={<AccessRoute requiredScope="menu.clientes" />}>
            <Route path="/clientes" element={<ClientesPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

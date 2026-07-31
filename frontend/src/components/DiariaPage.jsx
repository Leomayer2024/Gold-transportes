// ─── Diária ───────────────────────────────────────────────────────────────────
// Módulo separado da Hotelaria. Ainda sem regras definidas — a tela fica em
// branco de propósito até o fluxo de diária ser especificado.
// (O cadastro antigo continua em DiariasPage.jsx, sem rota, caso precise voltar.)

export default function DiariaPage() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Diária</h1>
          <p className="page-sub">Solicitação de diárias de viagem.</p>
        </div>
      </div>

      <div className="dsh-empty" style={{ marginTop: 8 }}>
        <strong>Em definição</strong>
        O fluxo de diária ainda será desenhado. Hotelaria (pernoite/hotel) já está
        disponível no menu ao lado, com aprovação em duas etapas.
      </div>
    </div>
  )
}

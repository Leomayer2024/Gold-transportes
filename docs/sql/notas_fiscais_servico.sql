-- ============================================================
-- MÓDULO FISCAL: NFSe emitidas (GOLD como PRESTADOR do serviço)
-- Cadastro/armazenamento dos dados da NFSe — sem emissão fiscal.
-- Executar no Supabase Dashboard > SQL Editor. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS notas_fiscais_servico (
    id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    filial_id     bigint REFERENCES filiais(id)  ON DELETE SET NULL,
    cliente_id    bigint REFERENCES clientes(id) ON DELETE SET NULL,

    -- ── Identificação da NFSe ──────────────────────────────────
    numero               text,
    codigo_verificacao   text,
    pedido_sap           text,                      -- referência do pedido SAP (opcional)
    competencia          date,                      -- YYYY-MM-01
    data_emissao         timestamptz DEFAULT now(),
    status               text DEFAULT 'rascunho',   -- rascunho | emitida | cancelada | substituida

    -- ── Prestador (GOLD — pré-preenchido no formulário) ────────
    prestador_cnpj                text,
    prestador_nome                text,
    prestador_endereco            text,
    prestador_inscricao_municipal text,
    prestador_email               text,
    prestador_municipio           text,
    prestador_telefone            text,
    prestador_cep                 text,

    -- ── Tomador (cliente) ──────────────────────────────────────
    tomador_cnpj                text,
    tomador_nome                text,
    tomador_endereco            text,
    tomador_inscricao_municipal text,
    tomador_email               text,
    tomador_municipio           text,
    tomador_telefone            text,
    tomador_cep                 text,

    -- ── Serviço prestado ───────────────────────────────────────
    cnae                  text,
    item_lista_servico    text,        -- ex.: 11.04
    discriminacao         text,        -- descrição do serviço prestado
    local_prestacao       text,
    municipio_incidencia  text,
    pais_prestacao        text DEFAULT 'BRASIL',

    -- ── Tributação do ISSQN ────────────────────────────────────
    optante_simples         boolean DEFAULT false,
    regime_especial         text,
    exigibilidade_issqn     text DEFAULT 'Exigível',   -- ex.: Não Incidente
    issqn_retido            boolean DEFAULT false,
    responsavel_recolhimento text DEFAULT 'PRESTADOR', -- PRESTADOR | TOMADOR

    -- ── Valores e base de cálculo ──────────────────────────────
    valor_servicos          numeric(14,2) DEFAULT 0,   -- valor total dos serviços / NFSe
    total_deducoes          numeric(14,2) DEFAULT 0,
    desconto_incondicionado numeric(14,2) DEFAULT 0,
    desconto_condicionado   numeric(14,2) DEFAULT 0,
    base_calculo            numeric(14,2) DEFAULT 0,
    aliquota_issqn          numeric(9,6)  DEFAULT 0,    -- ex.: 5.000000 (%)
    valor_issqn             numeric(14,2) DEFAULT 0,

    -- ── Retenções federais ─────────────────────────────────────
    valor_irrf      numeric(14,2) DEFAULT 0,
    valor_pis       numeric(14,2) DEFAULT 0,
    valor_cofins    numeric(14,2) DEFAULT 0,
    valor_inss      numeric(14,2) DEFAULT 0,
    valor_csll      numeric(14,2) DEFAULT 0,
    outras_retencoes numeric(14,2) DEFAULT 0,
    total_retencoes numeric(14,2) DEFAULT 0,
    valor_liquido   numeric(14,2) DEFAULT 0,

    -- ── Outros ─────────────────────────────────────────────────
    informacoes_complementares text,
    observacoes                text,
    ativo       boolean DEFAULT true,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfse_filial      ON notas_fiscais_servico(filial_id);
CREATE INDEX IF NOT EXISTS idx_nfse_cliente     ON notas_fiscais_servico(cliente_id);
CREATE INDEX IF NOT EXISTS idx_nfse_competencia ON notas_fiscais_servico(competencia);
CREATE INDEX IF NOT EXISTS idx_nfse_status      ON notas_fiscais_servico(status);
CREATE INDEX IF NOT EXISTS idx_nfse_ativo       ON notas_fiscais_servico(ativo);

SELECT 'notas_fiscais_servico: ' || COUNT(*)::TEXT AS resultado FROM notas_fiscais_servico;

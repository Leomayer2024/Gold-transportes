-- ============================================================
-- Ordens de Serviço de Motorista (OS de viagem)
-- NÃO confundir com `manutencoes` (OS de manutenção de veículo).
-- Status: rascunho → aberta → em_andamento → finalizada / cancelada
-- SEM fluxo de aprovação — finalização é registro, não aprovação.
-- ============================================================

CREATE TABLE IF NOT EXISTS ordens_servico_motorista (
    id                    BIGSERIAL    PRIMARY KEY,
    filial_id             BIGINT       NOT NULL REFERENCES filiais(id),
    numero_solicitacao    VARCHAR(20)  UNIQUE,
    motorista_id          BIGINT       NOT NULL REFERENCES colaboradores(id),
    veiculo_id            BIGINT       REFERENCES veiculos(id),
    origem                TEXT         NOT NULL,
    destino               TEXT         NOT NULL,
    motivo                TEXT,
    data_prevista_inicio  TIMESTAMPTZ,
    data_prevista_fim     TIMESTAMPTZ,
    data_inicio_real      TIMESTAMPTZ,
    data_finalizacao      TIMESTAMPTZ,
    km_inicial            INTEGER,
    km_final              INTEGER,
    status                VARCHAR(30)  NOT NULL DEFAULT 'rascunho'
                            CHECK (status IN ('rascunho','aberta','em_andamento','finalizada','cancelada')),
    observacoes           TEXT,
    criado_por            BIGINT       REFERENCES colaboradores(id),
    finalizada_por        BIGINT       REFERENCES colaboradores(id),
    cancelada_por         BIGINT       REFERENCES colaboradores(id),
    motivo_cancelamento   TEXT,
    created_at            TIMESTAMPTZ  DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  DEFAULT NOW(),
    ativo                 BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_osm_motorista ON ordens_servico_motorista(motorista_id, status);
CREATE INDEX IF NOT EXISTS idx_osm_filial    ON ordens_servico_motorista(filial_id, status);
CREATE INDEX IF NOT EXISTS idx_osm_veiculo   ON ordens_servico_motorista(veiculo_id);

-- Numeração: prefixo O (Ordem)
INSERT INTO solicitacao_counters (tipo, prefixo) VALUES
    ('ordens_servico_motorista', 'O')
ON CONFLICT (tipo) DO NOTHING;

-- Vínculo das solicitações filhas (todas nullable — modo avulso continua válido)
ALTER TABLE horas_extras            ADD COLUMN IF NOT EXISTS os_motorista_id BIGINT REFERENCES ordens_servico_motorista(id);
ALTER TABLE veiculos_abastecimentos ADD COLUMN IF NOT EXISTS os_motorista_id BIGINT REFERENCES ordens_servico_motorista(id);
ALTER TABLE diarias_solicitacoes    ADD COLUMN IF NOT EXISTS os_motorista_id BIGINT REFERENCES ordens_servico_motorista(id);

CREATE INDEX IF NOT EXISTS idx_he_os_motorista       ON horas_extras(os_motorista_id);
CREATE INDEX IF NOT EXISTS idx_abast_os_motorista    ON veiculos_abastecimentos(os_motorista_id);
CREATE INDEX IF NOT EXISTS idx_diarias_os_motorista  ON diarias_solicitacoes(os_motorista_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_osm_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS osm_updated_at ON ordens_servico_motorista;
CREATE TRIGGER osm_updated_at
    BEFORE UPDATE ON ordens_servico_motorista
    FOR EACH ROW EXECUTE FUNCTION set_osm_updated_at();

-- RLS — padrão simples (authenticated). API valida escopo via backend.
ALTER TABLE ordens_servico_motorista ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "osm_auth_select" ON ordens_servico_motorista FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "osm_auth_insert" ON ordens_servico_motorista FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "osm_auth_update" ON ordens_servico_motorista FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "osm_auth_delete" ON ordens_servico_motorista FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RPC: veículo padrão do motorista logado (busca em pacote_motorista_veiculo)
CREATE OR REPLACE FUNCTION get_veiculo_padrao_motorista(p_colaborador_id BIGINT)
RETURNS TABLE (
    veiculo_id       BIGINT,
    placa            TEXT,
    marca            TEXT,
    modelo           TEXT,
    filial_id        BIGINT
)
LANGUAGE sql STABLE AS $$
    SELECT
        v.id,
        v.placa::TEXT,
        v.marca::TEXT,
        v.modelo::TEXT,
        v.filial_id
    FROM contratos_colaboradores cc
    JOIN veiculos v ON v.id = cc.veiculo_proprio_id
    WHERE cc.tipo_item = 'pacote_motorista_veiculo'
      AND cc.colaborador_id = p_colaborador_id
      AND COALESCE(cc.ativo, true) = true
    ORDER BY cc.id DESC
    LIMIT 1
$$;

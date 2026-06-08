-- ============================================================
-- Vínculo motorista ↔ veículos (1:N — vários veículos por motorista)
-- Idempotente — segura mesmo se a 013 nunca foi aplicada.
-- ============================================================

CREATE TABLE IF NOT EXISTS motorista_veiculo (
    id           BIGSERIAL    PRIMARY KEY,
    filial_id    BIGINT       NOT NULL REFERENCES filiais(id),
    motorista_id BIGINT       NOT NULL REFERENCES colaboradores(id),
    veiculo_id   BIGINT       NOT NULL REFERENCES veiculos(id),
    principal    BOOLEAN      NOT NULL DEFAULT FALSE,
    ativo        BOOLEAN      NOT NULL DEFAULT TRUE,
    observacoes  TEXT,
    created_at   TIMESTAMPTZ  DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE (motorista_id, veiculo_id)
);

CREATE INDEX IF NOT EXISTS idx_mv_motorista ON motorista_veiculo(motorista_id, ativo);
CREATE INDEX IF NOT EXISTS idx_mv_veiculo   ON motorista_veiculo(veiculo_id, ativo);
CREATE INDEX IF NOT EXISTS idx_mv_filial    ON motorista_veiculo(filial_id, ativo);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_principal
    ON motorista_veiculo(motorista_id)
    WHERE principal = TRUE AND ativo = TRUE;

CREATE OR REPLACE FUNCTION set_mv_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS mv_updated_at ON motorista_veiculo;
CREATE TRIGGER mv_updated_at
    BEFORE UPDATE ON motorista_veiculo
    FOR EACH ROW EXECUTE FUNCTION set_mv_updated_at();

ALTER TABLE motorista_veiculo ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "mv_auth_select" ON motorista_veiculo FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "mv_auth_insert" ON motorista_veiculo FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "mv_auth_update" ON motorista_veiculo FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "mv_auth_delete" ON motorista_veiculo FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Migra dados legados — só roda se a coluna existir (caso 013 tenha sido aplicada antes)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'colaboradores'
          AND column_name = 'veiculo_padrao_id'
    ) THEN
        EXECUTE $migrate$
            INSERT INTO motorista_veiculo (filial_id, motorista_id, veiculo_id, principal, ativo)
            SELECT c.filial_id, c.id, c.veiculo_padrao_id, TRUE, TRUE
              FROM colaboradores c
             WHERE c.veiculo_padrao_id IS NOT NULL
            ON CONFLICT (motorista_id, veiculo_id) DO NOTHING
        $migrate$;

        EXECUTE 'ALTER TABLE colaboradores DROP COLUMN IF EXISTS veiculo_padrao_id';
    END IF;
END $$;

-- RPC: lê do principal ativo (fallback: primeiro ativo)
CREATE OR REPLACE FUNCTION get_veiculo_padrao_motorista(p_colaborador_id BIGINT)
RETURNS TABLE (
    veiculo_id  BIGINT,
    placa       TEXT,
    marca       TEXT,
    modelo      TEXT,
    filial_id   BIGINT
)
LANGUAGE sql STABLE AS $$
    SELECT v.id, v.placa::TEXT, v.marca::TEXT, v.modelo::TEXT, v.filial_id
      FROM motorista_veiculo mv
      JOIN veiculos v ON v.id = mv.veiculo_id
     WHERE mv.motorista_id = p_colaborador_id
       AND mv.ativo = TRUE
     ORDER BY mv.principal DESC, mv.id ASC
     LIMIT 1
$$;

-- Recarrega schema cache do PostgREST (Supabase)
NOTIFY pgrst, 'reload schema';

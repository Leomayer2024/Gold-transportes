-- ============================================================
-- 018: Garantir coluna updated_at em veiculos_documentos
-- ============================================================
-- Sintoma: PATCH /api/veiculos_documentos/<id> retornava 400 com
--   42703 record "new" has no field "updated_at"
-- Causa: trigger BEFORE UPDATE seta NEW.updated_at, mas a tabela
--   não possui essa coluna (trigger criado fora do versionamento).
-- Solução: criar a coluna se não existir e (re)criar trigger via
--   CREATE OR REPLACE — sem DROP, sem alerta de operação destrutiva.
-- Idempotente: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE TRIGGER.
-- Requer Postgres >= 14 (Supabase já roda 15+).
-- ============================================================

-- veiculos_documentos -----------------------------------------
ALTER TABLE veiculos_documentos
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION set_veiculos_documentos_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER veiculos_documentos_updated_at
    BEFORE UPDATE ON veiculos_documentos
    FOR EACH ROW EXECUTE FUNCTION set_veiculos_documentos_updated_at();

-- colaborador_documentos --------------------------------------
ALTER TABLE colaborador_documentos
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION set_colaborador_documentos_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER colaborador_documentos_updated_at
    BEFORE UPDATE ON colaborador_documentos
    FOR EACH ROW EXECUTE FUNCTION set_colaborador_documentos_updated_at();

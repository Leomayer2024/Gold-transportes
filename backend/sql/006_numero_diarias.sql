-- ============================================================
-- Numeração automática para Diárias / Hotelaria
-- Sigla: D (D00001, D00002, ...)
-- Idempotente.
-- ============================================================

-- Counter
INSERT INTO solicitacao_counters (tipo, prefixo) VALUES
    ('diarias_solicitacoes', 'D')
ON CONFLICT (tipo) DO NOTHING;

-- Coluna numero_solicitacao em diarias_solicitacoes
ALTER TABLE diarias_solicitacoes
    ADD COLUMN IF NOT EXISTS numero_solicitacao VARCHAR(20) UNIQUE;

-- Backfill: gera números pros registros antigos que ainda não tem
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT id FROM diarias_solicitacoes
         WHERE numero_solicitacao IS NULL
         ORDER BY id
    LOOP
        UPDATE diarias_solicitacoes
           SET numero_solicitacao = gerar_numero_solicitacao('diarias_solicitacoes')
         WHERE id = r.id;
    END LOOP;
END $$;

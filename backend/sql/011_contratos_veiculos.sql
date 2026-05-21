-- ============================================================
-- Complementa contratos: adiciona `tipo_contrato` em
-- contratos_operacionais e libera tipo_item =
-- 'pacote_motorista_veiculo' em contratos_colaboradores.
--
-- A coluna veiculo_proprio_id já foi criada em
-- 008_contratos_colaboradores_veiculo_proprio.sql.
--
-- Idempotente.
-- ============================================================

ALTER TABLE contratos_operacionais
    ADD COLUMN IF NOT EXISTS tipo_contrato TEXT DEFAULT 'rtm';

ALTER TABLE contratos_operacionais
    DROP CONSTRAINT IF EXISTS contratos_operacionais_tipo_contrato_check;

ALTER TABLE contratos_operacionais
    ADD CONSTRAINT contratos_operacionais_tipo_contrato_check
    CHECK (tipo_contrato IN ('rtm', 'veiculos', 'misto'));

UPDATE contratos_operacionais
    SET tipo_contrato = 'rtm'
    WHERE tipo_contrato IS NULL;

ALTER TABLE contratos_operacionais
    ALTER COLUMN tipo_contrato SET NOT NULL;

-- Recria constraint de tipo_item incluindo veiculo_proprio +
-- pacote_motorista_veiculo, preservando valores históricos.
DO $$
DECLARE
    cname TEXT;
BEGIN
    SELECT conname INTO cname
    FROM pg_constraint
    WHERE conrelid = 'contratos_colaboradores'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo_item%'
    LIMIT 1;

    IF cname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE contratos_colaboradores DROP CONSTRAINT %I', cname);
    END IF;

    ALTER TABLE contratos_colaboradores
        ADD CONSTRAINT contratos_colaboradores_tipo_item_check
        CHECK (tipo_item IN (
            'colaborador',
            'colaborador_fora_contrato',
            'caminhao',
            'outro',
            'veiculo_proprio',
            'pacote_motorista_veiculo'
        ));
END $$;

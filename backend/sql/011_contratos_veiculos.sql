-- ============================================================
-- Adiciona suporte a contratos de veículos (frota Gold) ao lado
-- dos contratos RTM existentes.
--
-- 1. Campo `tipo_contrato` em contratos_operacionais
--    (rtm | veiculos | misto). Default 'rtm' preserva dados atuais.
--
-- 2. Campo `veiculo_id` em contratos_colaboradores referenciando
--    veiculos(id). Permite vincular veículo da frota Gold ao
--    contrato; quando há motorista, mesma linha leva colaborador_id
--    (motorista) + veiculo_id (carro) + valor_cobrado_colaborador
--    (valor pacote motorista+veículo).
--
-- 3. Relaxa CHECK de tipo_item para aceitar 'veiculo_proprio'.
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

-- Liga vínculo a veiculos.id (frota Gold). Coexiste com veiculo_carregamento_id.
ALTER TABLE contratos_colaboradores
    ADD COLUMN IF NOT EXISTS veiculo_id BIGINT REFERENCES veiculos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contratos_colaboradores_veiculo_id
    ON contratos_colaboradores(veiculo_id);

-- Libera tipo_item = 'veiculo_proprio' (descobre constraint atual e recria).
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

    -- Mantém valores históricos (colaborador, colaborador_fora_contrato,
    -- caminhao, outro) e adiciona veiculo_proprio + pacote_motorista_veiculo.
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

-- ============================================================
-- Relaxa constraint veiculos_placa_formato_check para aceitar
-- placa combo cavalo/carreta: "ABC1D23/XYZ4W56".
-- Aceita placa antiga (LLL9999), Mercosul (LLL9L99) e combo das duas.
-- Idempotente.
-- ============================================================
ALTER TABLE veiculos
    DROP CONSTRAINT IF EXISTS veiculos_placa_formato_check;

ALTER TABLE veiculos
    ADD CONSTRAINT veiculos_placa_formato_check
    CHECK (
        placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}(/[A-Z]{3}[0-9][A-Z0-9][0-9]{2})?$'
    );

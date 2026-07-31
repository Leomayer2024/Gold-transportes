-- ============================================================
-- 033: Geocerca por filial (localização + raio) para alerta de
--      batida de ponto fora do local esperado (iopoint).
-- Idempotente: ADD COLUMN IF NOT EXISTS. Seguro para re-run.
-- ============================================================
ALTER TABLE public.filiais
    ADD COLUMN IF NOT EXISTS latitude     double precision,
    ADD COLUMN IF NOT EXISTS longitude    double precision,
    ADD COLUMN IF NOT EXISTS raio_metros  integer;

COMMENT ON COLUMN public.filiais.latitude    IS 'Latitude do ponto central da base (cerca do ponto).';
COMMENT ON COLUMN public.filiais.longitude   IS 'Longitude do ponto central da base (cerca do ponto).';
COMMENT ON COLUMN public.filiais.raio_metros IS 'Raio permitido em metros para a batida ser considerada dentro da base. Padrão sugerido: 150.';

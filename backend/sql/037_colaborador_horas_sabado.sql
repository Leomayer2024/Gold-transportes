-- ============================================================
-- 037: Horas de sábado do colaborador (escala seg-sáb).
-- Para escala segunda-sábado a jornada não é igual todo dia:
-- sábado tem carga menor (ex.: 4h) e seg-sex = (semanal - sábado)/5.
-- Idempotente. Default 4h quando nulo (aplicado no cálculo, não aqui).
-- ============================================================
ALTER TABLE public.colaboradores
    ADD COLUMN IF NOT EXISTS carga_horaria_sabado numeric;

COMMENT ON COLUMN public.colaboradores.carga_horaria_sabado IS
    'Horas trabalhadas no sábado (só p/ escala seg-sáb). Ex.: 4. Seg-sex = (carga_semanal - este valor) / 5.';

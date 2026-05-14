-- Tabela para fechamentos mensais da calculadora RTM de horas extras
CREATE TABLE IF NOT EXISTS horas_extras_rtm_registros (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    mes_referencia date NOT NULL,
    funcionario_nome text NOT NULL,
    colaborador_id uuid REFERENCES colaboradores(id) ON DELETE SET NULL,
    filial_nome text,
    estado text,
    horas_normais numeric(10,4) DEFAULT 0,
    horas_extra_100 numeric(10,4) DEFAULT 0,
    valor_hora_50 numeric(10,2) DEFAULT 0,
    valor_hora_100 numeric(10,2) DEFAULT 0,
    total_50 numeric(10,2) DEFAULT 0,
    total_100 numeric(10,2) DEFAULT 0,
    total_geral numeric(10,2) DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_horas_extras_rtm_mes ON horas_extras_rtm_registros(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_horas_extras_rtm_filial ON horas_extras_rtm_registros(filial_nome);
CREATE INDEX IF NOT EXISTS idx_horas_extras_rtm_colaborador ON horas_extras_rtm_registros(colaborador_id);

-- RLS: apenas usuários autenticados podem ler/escrever
ALTER TABLE horas_extras_rtm_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "auth_select" ON horas_extras_rtm_registros
    FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "auth_insert" ON horas_extras_rtm_registros
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "auth_delete" ON horas_extras_rtm_registros
    FOR DELETE TO authenticated USING (true);

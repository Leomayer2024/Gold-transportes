-- ============================================================
-- Numeração automática de Solicitações por tipo de recurso
-- Concorrência segura via UPDATE row-level lock automático
-- Prefixos: M=Manutenção, C=Combustível, P=Pedido, H=Hora Extra, N=Pneu
-- ============================================================

-- Tabela de contadores por tipo
CREATE TABLE IF NOT EXISTS solicitacao_counters (
    tipo          VARCHAR(50)  PRIMARY KEY,
    prefixo       VARCHAR(5)   NOT NULL,
    ultimo_num    INTEGER      NOT NULL DEFAULT 0,
    atualizado_em TIMESTAMPTZ  DEFAULT NOW()
);

-- Valores iniciais — ON CONFLICT para idempotência
INSERT INTO solicitacao_counters (tipo, prefixo) VALUES
    ('manutencoes',    'M'),
    ('abastecimentos', 'C'),
    ('pedidos_compra', 'P'),
    ('horas_extras',   'H'),
    ('pneus',          'N')
ON CONFLICT (tipo) DO NOTHING;

-- Função atômica: UPDATE garante row-lock, seguro para N usuários simultâneos
-- Nunca repete número; se dois processos chamam ao mesmo tempo, cada um recebe
-- um número diferente pois o UPDATE serializa no nível da linha.
CREATE OR REPLACE FUNCTION gerar_numero_solicitacao(p_tipo TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_prefixo TEXT;
    v_num     INTEGER;
BEGIN
    UPDATE solicitacao_counters
       SET ultimo_num    = ultimo_num + 1,
           atualizado_em = NOW()
     WHERE tipo = p_tipo
    RETURNING prefixo, ultimo_num INTO v_prefixo, v_num;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tipo de solicitação desconhecido: %', p_tipo;
    END IF;

    -- Formato: M00001, C00002, P00003, etc.
    RETURN v_prefixo || LPAD(v_num::TEXT, 5, '0');
END;
$$;

-- Adicionar coluna numero_solicitacao em cada tabela (idempotente)
ALTER TABLE manutencoes             ADD COLUMN IF NOT EXISTS numero_solicitacao VARCHAR(20) UNIQUE;
ALTER TABLE veiculos_abastecimentos ADD COLUMN IF NOT EXISTS numero_solicitacao VARCHAR(20) UNIQUE;
ALTER TABLE pedidos_compra          ADD COLUMN IF NOT EXISTS numero_solicitacao VARCHAR(20) UNIQUE;
ALTER TABLE horas_extras            ADD COLUMN IF NOT EXISTS numero_solicitacao VARCHAR(20) UNIQUE;
ALTER TABLE veiculos_pneus          ADD COLUMN IF NOT EXISTS numero_solicitacao VARCHAR(20) UNIQUE;

-- Fechamento de turno de carregamento: marca o horário em que a operação
-- do dia/noite terminou (nível turno = data + filial + turno).
-- Não finaliza jornadas individuais; só registra o fim da operação.
CREATE TABLE IF NOT EXISTS jornada_turno_fechamentos (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    data_operacao  DATE        NOT NULL,
    filial_id      BIGINT      NOT NULL REFERENCES filiais (id) ON DELETE CASCADE,
    turno          TEXT        NOT NULL,
    encerrado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    encerrado_por  UUID,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT jornada_turno_fechamentos_uniq UNIQUE (data_operacao, filial_id, turno)
);

CREATE INDEX IF NOT EXISTS idx_turno_fechamento_lookup
    ON jornada_turno_fechamentos (data_operacao, filial_id, turno);

NOTIFY pgrst, 'reload schema';

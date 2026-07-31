-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APLICAR TUDO — Abastecimento (postos + itens + fotos + app)  021 → 025    ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║  Rode este arquivo INTEIRO no Supabase → SQL Editor, de uma vez.           ║
-- ║  Tudo é idempotente (IF NOT EXISTS / DROP+CREATE / NOT EXISTS) — pode      ║
-- ║  rodar de novo sem problema. Ordem importa: 021 cria as tabelas que 024    ║
-- ║  usa, então mantenha a ordem abaixo.                                        ║
-- ║                                                                            ║
-- ║  O que faz:                                                                ║
-- ║   021  Cadastro de postos (preço por combustível) + posto_id no abastec.   ║
-- ║   022  Coluna JSONB "itens" (vários combustíveis no mesmo lançamento).     ║
-- ║   023  Corrige função duplicada gerar_numero_solicitacao (PGRST203).       ║
-- ║   024  Colunas de foto + bucket 'abastecimentos' + RLS leitura de postos.  ║
-- ║   025  Libera 'menu.abastecimentos' no app p/ quem já tem OS (backfill).   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝


-- ════════════════════════════════════════════════════════════════════════════
-- 021 — Cadastro de postos + vínculo posto_id no abastecimento
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.postos_combustivel (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    filial_id         BIGINT      NOT NULL REFERENCES filiais (id) ON DELETE CASCADE,
    nome              TEXT        NOT NULL,
    cnpj              TEXT,
    endereco          TEXT,
    preco_diesel      NUMERIC(10, 3),
    preco_diesel_s10  NUMERIC(10, 3),
    preco_gasolina    NUMERIC(10, 3),
    preco_flex        NUMERIC(10, 3),
    preco_gnv         NUMERIC(10, 3),
    preco_arla        NUMERIC(10, 3),
    observacoes       TEXT,
    ativo             BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_postos_combustivel_filial
    ON public.postos_combustivel (filial_id, ativo);

COMMENT ON TABLE public.postos_combustivel IS
    'Cadastro de postos/fornecedores de combustível com preço por tipo de combustível.';

-- garante a coluna de ARLA mesmo se a tabela já existia antes
ALTER TABLE public.postos_combustivel
    ADD COLUMN IF NOT EXISTS preco_arla NUMERIC(10, 3);

ALTER TABLE public.veiculos_abastecimentos
    ADD COLUMN IF NOT EXISTS posto_id BIGINT REFERENCES postos_combustivel (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_abastecimentos_posto
    ON public.veiculos_abastecimentos (posto_id);

COMMENT ON COLUMN public.veiculos_abastecimentos.posto_id IS
    'Posto escolhido no cadastro. Preenche automaticamente preço/nome no lançamento.';


-- ════════════════════════════════════════════════════════════════════════════
-- 022 — Coluna "itens" (vários combustíveis no mesmo abastecimento)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.veiculos_abastecimentos
    ADD COLUMN IF NOT EXISTS itens JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.veiculos_abastecimentos.itens IS
    'Itens do abastecimento: [{tipo_combustivel, litros, valor_litro}]. litros/valor_litro/tipo_combustivel guardam o consolidado.';

-- backfill: registros antigos viram 1 item, preservando o histórico
UPDATE public.veiculos_abastecimentos
SET itens = jsonb_build_array(
        jsonb_build_object(
            'tipo_combustivel', COALESCE(tipo_combustivel, 'diesel'),
            'litros',           litros,
            'valor_litro',      valor_litro
        )
    )
WHERE (itens IS NULL OR itens = '[]'::jsonb)
  AND litros IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- 023 — Corrige overload duplicado de gerar_numero_solicitacao (PGRST203)
-- ════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.gerar_numero_solicitacao(character varying);

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

    RETURN v_prefixo || LPAD(v_num::TEXT, 5, '0');
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- 024 — Fotos do abastecimento + bucket + RLS de leitura dos postos (p/ app)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.veiculos_abastecimentos
    ADD COLUMN IF NOT EXISTS foto_painel_url TEXT,
    ADD COLUMN IF NOT EXISTS foto_bomba_url  TEXT,
    ADD COLUMN IF NOT EXISTS foto_cupom_url  TEXT,
    ADD COLUMN IF NOT EXISTS foto_nota_url   TEXT;

-- bucket de Storage 'abastecimentos' (público p/ leitura)
INSERT INTO storage.buckets (id, name, public)
VALUES ('abastecimentos', 'abastecimentos', true)
ON CONFLICT (id) DO NOTHING;

-- INSERT/UPDATE: authenticated (app) E anon (web usa anon key)
DROP POLICY IF EXISTS "abastecimentos_insert_auth" ON storage.objects;
CREATE POLICY "abastecimentos_insert_auth" ON storage.objects
    FOR INSERT TO authenticated, anon
    WITH CHECK (bucket_id = 'abastecimentos');

DROP POLICY IF EXISTS "abastecimentos_update_auth" ON storage.objects;
CREATE POLICY "abastecimentos_update_auth" ON storage.objects
    FOR UPDATE TO authenticated, anon
    USING (bucket_id = 'abastecimentos')
    WITH CHECK (bucket_id = 'abastecimentos');

DROP POLICY IF EXISTS "abastecimentos_select_all" ON storage.objects;
CREATE POLICY "abastecimentos_select_all" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'abastecimentos');

-- leitura direta dos postos pelo app (senão volta vazio, sem erro)
ALTER TABLE public.postos_combustivel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "postos_combustivel_select_app" ON public.postos_combustivel;
CREATE POLICY "postos_combustivel_select_app" ON public.postos_combustivel
    FOR SELECT TO authenticated, anon
    USING (true);

GRANT SELECT ON public.postos_combustivel TO authenticated, anon;


-- ════════════════════════════════════════════════════════════════════════════
-- 025 — Backfill do escopo de abastecimento no app
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.permissoes (colaborador_id, permissao_nome, ativo, descricao)
SELECT DISTINCT p.colaborador_id, 'menu.abastecimentos', true,
       'Ver / lançar abastecimentos'
FROM public.permissoes p
WHERE p.permissao_nome = 'menu.ordens_servico'
  AND p.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.permissoes p2
    WHERE p2.colaborador_id = p.colaborador_id
      AND p2.permissao_nome = 'menu.abastecimentos'
  );


-- ════════════════════════════════════════════════════════════════════════════
-- Recarrega o cache de schema do PostgREST (uma vez, no fim).
-- ════════════════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';

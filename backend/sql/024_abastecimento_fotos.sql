-- ============================================================
-- 024: Fotos do abastecimento (painel, bomba, cupom, nota) + bucket
-- ============================================================
-- Contexto:
--   * No app (Ordens de Serviço → Combustível), o motorista tira 4 fotos:
--     painel, bomba, cupom e nota fiscal. As fotos sobem pro Supabase Storage
--     e as URLs ficam no registro do abastecimento.
--   * Também habilita o app a ler os postos (postos_combustivel) direto.
-- Idempotente. Requer que 021 (posto_id / postos_combustivel) já tenha rodado.
-- ============================================================

-- 1. Colunas de URL das fotos ---------------------------------
ALTER TABLE public.veiculos_abastecimentos
    ADD COLUMN IF NOT EXISTS foto_painel_url TEXT,
    ADD COLUMN IF NOT EXISTS foto_bomba_url  TEXT,
    ADD COLUMN IF NOT EXISTS foto_cupom_url  TEXT,
    ADD COLUMN IF NOT EXISTS foto_nota_url   TEXT;

-- 2. Bucket de Storage 'abastecimentos' (público p/ leitura) --
INSERT INTO storage.buckets (id, name, public)
VALUES ('abastecimentos', 'abastecimentos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket (idempotente: dropa e recria) ------------
-- INSERT/UPDATE: authenticated (app, com sessão) E anon (web, usa anon key).
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

-- 3. Garante leitura dos postos pelo app (leitura direta via authenticated) ----
--    O app lê postos_combustivel direto (sem passar pelo backend). Sem policy de
--    SELECT, com RLS ligado, a leitura volta VAZIA (sem erro) — foi o que causou
--    "Nenhum posto nesta filial" no app. As escritas continuam pelo backend
--    (service_role, que ignora RLS), então habilitar RLS aqui é seguro.
ALTER TABLE public.postos_combustivel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "postos_combustivel_select_app" ON public.postos_combustivel;
CREATE POLICY "postos_combustivel_select_app" ON public.postos_combustivel
    FOR SELECT TO authenticated, anon
    USING (true);

GRANT SELECT ON public.postos_combustivel TO authenticated, anon;

-- Recarrega o cache de schema do PostgREST.
NOTIFY pgrst, 'reload schema';

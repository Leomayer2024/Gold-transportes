-- ============================================================
-- DIAGNÓSTICO — o que já está aplicado no banco?
-- ============================================================
-- Rode SÓ ESTE no SQL editor do Supabase. Ele não altera nada:
-- apenas verifica se os objetos de cada migração existem e diz
-- quais scripts ainda precisam ser rodados.
--
-- Leia a coluna SITUACAO: "APLICADA" = pular. "FALTA" = rodar o arquivo.
-- ============================================================

WITH checagem(ordem, script, o_que_cria, existe) AS (
VALUES
  -- Frota / abastecimento
  (21, '021_postos_combustivel.sql',      'tabela postos_combustivel',
       to_regclass('public.postos_combustivel') IS NOT NULL),
  (22, '022_abastecimento_itens.sql',     'coluna veiculos_abastecimentos.itens',
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='veiculos_abastecimentos' AND column_name='itens')),
  (24, '024_abastecimento_fotos.sql',     'coluna veiculos_abastecimentos.foto_painel_url',
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='veiculos_abastecimentos' AND column_name='foto_painel_url')),
  (25, '025_perm_abastecimento_app.sql',  'permissao menu.abastecimentos',
       EXISTS (SELECT 1 FROM public.permissoes WHERE permissao_nome='menu.abastecimentos')),
  (26, '026_indices_fk_faltando.sql',     'indices de FK',
       EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx_%fk%')),
  (28, '028_seguranca_rls_tabelas_expostas.sql', 'RLS em diarias_solicitacoes',
       EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='diarias_solicitacoes')),
  (29, '029_percentual_desconto_vt.sql',  'coluna colaboradores.percentual_desconto_vt',
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='colaboradores' AND column_name='percentual_desconto_vt')),
  (30, '030_treinamentos_rls.sql',        'RLS em trein_matriculas',
       EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trein_matriculas')),
  (33, '033_filiais_geocerca.sql',        'coluna filiais.geocerca_raio_m',
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='filiais' AND column_name='geocerca_raio_m')),
  (34, '034_notas_fiscais_servico.sql',   'tabela notas_fiscais_servico',
       to_regclass('public.notas_fiscais_servico') IS NOT NULL),
  (35, '035_financeiro_motor.sql',        'motor financeiro (parcelas)',
       to_regclass('public.contas_parcelas') IS NOT NULL),
  (37, '037_colaborador_horas_sabado.sql','coluna colaboradores.horas_sabado',
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='colaboradores' AND column_name='horas_sabado')),
  (38, '038_abastecimento_historico_select.sql', 'policy de historico do abastecimento',
       EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='veiculos_abastecimentos')),
  (41, '041_get_abastecimentos_app.sql',  'funcao get_abastecimentos_app',
       EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
               WHERE n.nspname='public' AND p.proname='get_abastecimentos_app')),

  -- ▼▼ As 4 das últimas sessões ▼▼
  (42, '042_fix_gerar_numero_reconcile.sql', 'gerar_numero_solicitacao com auto-cura (fim do duplicate P00012)',
       EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
               WHERE n.nspname='public' AND p.proname='gerar_numero_solicitacao'
                 AND pg_get_functiondef(p.oid) ILIKE '%GREATEST%')),
  (43, '043_app_checklists.sql',          'tabela checklists (Checklist White Martins)',
       to_regclass('public.checklists') IS NOT NULL),
  (44, '044_diarias_deposito.sql',        'colunas de deposito em diarias_solicitacoes',
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='diarias_solicitacoes' AND column_name='chave_pix')),
  (45, '045_hotelaria_modulo.sql',        'modulo Hotelaria (tabela + historico + trigger)',
       to_regclass('public.hotelaria_solicitacoes') IS NOT NULL)
)
SELECT
    ordem                                             AS "ordem",
    CASE WHEN existe THEN '✅ APLICADA' ELSE '❌ FALTA' END AS "situacao",
    script                                            AS "rodar este arquivo",
    o_que_cria                                        AS "o que cria"
FROM checagem
ORDER BY existe, ordem;

-- ============================================================
-- Depois de rodar: pegue as linhas "❌ FALTA" e rode os arquivos
-- correspondentes EM ORDEM CRESCENTE de número.
-- Todos são idempotentes — rodar de novo por engano não quebra nada.
-- ============================================================

-- ============================================================
-- MIGRATION: Fornecedores e Clientes
-- Executar no Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. TABELA fornecedores ───────────────────────────────────

CREATE TABLE IF NOT EXISTS fornecedores (
  id                  SERIAL PRIMARY KEY,
  filial_id           INTEGER      REFERENCES filiais(id) ON DELETE SET NULL,
  nome                VARCHAR(200) NOT NULL,
  cnpj                VARCHAR(20)  DEFAULT NULL,
  telefone            VARCHAR(30)  DEFAULT NULL,
  email               VARCHAR(150) DEFAULT NULL,
  contato_nome        VARCHAR(200) DEFAULT NULL,
  categoria           VARCHAR(50)  DEFAULT NULL,
  endereco            TEXT         DEFAULT NULL,
  observacoes         TEXT         DEFAULT NULL,
  ativo               BOOLEAN      NOT NULL DEFAULT TRUE,
  criado_em           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_filial ON fornecedores(filial_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_nome   ON fornecedores(nome);
CREATE INDEX IF NOT EXISTS idx_fornecedores_ativo  ON fornecedores(ativo);

-- ── 2. TABELA clientes ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS clientes (
  id                  SERIAL PRIMARY KEY,
  filial_id           INTEGER      REFERENCES filiais(id) ON DELETE SET NULL,
  nome                VARCHAR(200) NOT NULL,
  cnpj                VARCHAR(20)  DEFAULT NULL,
  telefone            VARCHAR(30)  DEFAULT NULL,
  email               VARCHAR(150) DEFAULT NULL,
  contato_nome        VARCHAR(200) DEFAULT NULL,
  endereco            TEXT         DEFAULT NULL,
  observacoes         TEXT         DEFAULT NULL,
  ativo               BOOLEAN      NOT NULL DEFAULT TRUE,
  criado_em           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_filial ON clientes(filial_id);
CREATE INDEX IF NOT EXISTS idx_clientes_nome   ON clientes(nome);
CREATE INDEX IF NOT EXISTS idx_clientes_ativo  ON clientes(ativo);

-- ── 3. VERIFICAÇÃO FINAL ────────────────────────────────────

SELECT 'fornecedores: ' || COUNT(*)::TEXT FROM fornecedores;
SELECT 'clientes: ' || COUNT(*)::TEXT FROM clientes;
SELECT 'Migration fornecedores/clientes concluída!' AS resultado;

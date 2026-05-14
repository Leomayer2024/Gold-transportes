#!/usr/bin/env python
"""
Script para aplicar o SQL de períodos em contratos_colaboradores
Executa via Supabase SQL
"""
import os
import sys
from pathlib import Path

# Adicionar backend ao path
backend_dir = Path(__file__).parent.parent / 'backend'
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
from supabase import create_client

# Carregar variáveis
env_file = backend_dir / '.env'
if env_file.exists():
    load_dotenv(env_file)

supabase_url = os.getenv('SUPABASE_URL')
service_role_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not supabase_url or not service_role_key:
    print('❌ Variáveis de ambiente não configuradas')
    sys.exit(1)

# Conectar
client = create_client(supabase_url, service_role_key)

# Ler SQL
sql_file = Path(__file__).parent.parent / 'docs' / 'sql' / 'alter_contratos_colaboradores_periodos.sql'
with open(sql_file, 'r', encoding='utf-8') as f:
    sql_content = f.read()

# Dividir comandos
commands = [cmd.strip() for cmd in sql_content.split(';') if cmd.strip()]

print(f'🔧 Executando {len(commands)} comandos SQL...\n')

success = 0
errors = 0

for i, cmd in enumerate(commands, 1):
    try:
        # Executar diretamente via RPC
        result = client.rpc('exec_sql', {'query': cmd}).execute()
        print(f'✅ [{i}/{len(commands)}] Executado com sucesso')
        success += 1
    except Exception as e:
        # Tenta ignorar certos erros conhecidos
        error_str = str(e)
        if 'already exists' in error_str or 'column already exists' in error_str:
            print(f'⚠️  [{i}/{len(commands)}] Já existe (ignorado)')
            success += 1
        else:
            print(f'❌ [{i}/{len(commands)}] ERRO: {error_str[:100]}')
            errors += 1

print(f'\n📊 Resultado: {success}/{len(commands)} executados com sucesso')
if errors > 0:
    print(f'⚠️  {errors} erros encontrados')
else:
    print('✅ Tudo pronto!')

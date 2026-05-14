#!/usr/bin/env python3
"""Generate frontend/.env from environment variables for deployment"""
import os

frontend_env_content = f"""VITE_API_URL={os.getenv('VITE_API_URL', 'http://127.0.0.1:5000/api')}
VITE_SUPABASE_URL={os.getenv('SUPABASE_URL', '')}
VITE_SUPABASE_ANON_KEY={os.getenv('SUPABASE_KEY', '')}
"""

with open('frontend/.env', 'w') as f:
    f.write(frontend_env_content)

print("✓ frontend/.env gerado com sucesso")

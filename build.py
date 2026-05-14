#!/usr/bin/env python3
"""Generate frontend/.env from environment variables for deployment"""
import os
import pathlib

SCRIPT_DIR = pathlib.Path(__file__).parent
ENV_FILE = SCRIPT_DIR / 'frontend' / '.env'

SUPABASE_URL = 'https://vwqldtjjtkdzvkdirmam.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3cWxkdGpqdGtkenZrZGlybWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Nzc4MjQsImV4cCI6MjA5MDQ1MzgyNH0.bAJZYfU9oVnt4ibgHRYBGgpb4NwPL9nl0vXYR9rtlY8'

anon_key = os.getenv('SUPABASE_ANON_KEY') or os.getenv('SUPABASE_KEY') or SUPABASE_ANON_KEY
supabase_url = os.getenv('SUPABASE_URL') or SUPABASE_URL

content = f"""VITE_API_URL={os.getenv('VITE_API_URL', '/api')}
VITE_SUPABASE_URL={supabase_url}
VITE_SUPABASE_ANON_KEY={anon_key}
"""

ENV_FILE.write_text(content)
print(f"✓ {ENV_FILE} gerado")
print(f"  VITE_SUPABASE_URL={supabase_url}")
print(f"  VITE_SUPABASE_ANON_KEY={anon_key[:30]}...")

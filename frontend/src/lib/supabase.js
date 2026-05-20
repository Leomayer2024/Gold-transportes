import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vwqldtjjtkdzvkdirmam.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3cWxkdGpqdGtkenZrZGlybWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Nzc4MjQsImV4cCI6MjA5MDQ1MzgyNH0.bAJZYfU9oVnt4ibgHRYBGgpb4NwPL9nl0vXYR9rtlY8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const documentsBucket = import.meta.env.VITE_SUPABASE_DOCUMENTS_BUCKET || 'rh-documentos'

function sanitizeFileName(fileName) {
  return String(fileName || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

export async function uploadRhDocumentFile(file, options = {}) {
  if (!file) {
    throw new Error('Selecione um arquivo para enviar.')
  }

  const folder = options.folder || 'documentos-rh'
  const entityId = options.entityId || 'geral'
  const fileName = sanitizeFileName(file.name)
  const objectPath = `${folder}/${entityId}/${Date.now()}-${crypto.randomUUID()}-${fileName}`

  const { error: uploadError } = await supabase.storage.from(documentsBucket).upload(objectPath, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (uploadError) {
    const msg = uploadError.message || ''
    if (/bucket not found/i.test(msg)) {
      throw new Error(
        `Storage não configurado: o bucket "${documentsBucket}" não existe no Supabase. ` +
        `Crie em Supabase → Storage → New bucket (nome: ${documentsBucket}, Public). ` +
        `Ou defina VITE_SUPABASE_DOCUMENTS_BUCKET com o nome do bucket já existente.`
      )
    }
    if (/row-level security|RLS|policy/i.test(msg)) {
      throw new Error(
        `Bucket "${documentsBucket}" sem permissão de upload. ` +
        `No Supabase → Storage → Policies, adicione policy de INSERT/SELECT no bucket para a role anon (ou authenticated).`
      )
    }
    throw new Error(msg || 'Falha ao enviar arquivo para o armazenamento.')
  }

  const { data } = supabase.storage.from(documentsBucket).getPublicUrl(objectPath)

  return {
    bucket: documentsBucket,
    path: objectPath,
    url: data.publicUrl,
  }
}

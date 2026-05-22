import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios. ' +
    'Defina em frontend/.env antes do build — não hardcode no fonte.'
  )
}

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

// Extrai bucket + path de uma URL do Supabase Storage.
// Suporta tanto URLs públicas (/object/public/<bucket>/<path>) quanto
// URLs já assinadas (/object/sign/<bucket>/<path>?token=...).
export function parseStorageUrl(url) {
  if (!url || typeof url !== 'string') return null
  try {
    const u = new URL(url)
    const match = u.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/)
    if (!match) return null
    return { bucket: decodeURIComponent(match[1]), path: decodeURIComponent(match[2]) }
  } catch {
    return null
  }
}

// Abre o arquivo em uma nova aba. Estratégia em cascata:
//   1) Signed URL (funciona em bucket privado se anon tem policy SELECT).
//   2) Proxy backend /api/storage/file (usa service_role, sempre funciona).
//   3) URL pública direta (último recurso — só funciona em bucket Public).
export async function abrirDocumentoStorage(url, options = {}) {
  if (!url) return
  const parsed = parseStorageUrl(url)
  const download = Boolean(options.download)

  // 1) Tenta signed URL
  if (parsed) {
    try {
      const { data, error } = await supabase.storage
        .from(parsed.bucket)
        .createSignedUrl(parsed.path, 3600, download ? { download: true } : undefined)
      if (!error && data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
        return
      }
    } catch {
      // ignora, cai pro próximo
    }
  }

  // 2) Proxy backend (precisa de token)
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (token) {
      const qs = new URLSearchParams()
      qs.set('url', url)
      if (download) qs.set('download', '1')
      const resp = await fetch(`/api/storage/file?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (resp.ok) {
        const blob = await resp.blob()
        const objectUrl = URL.createObjectURL(blob)
        window.open(objectUrl, '_blank', 'noopener,noreferrer')
        // Libera depois de 60s — tempo suficiente do browser carregar.
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
        return
      }
    }
  } catch {
    // ignora, último fallback
  }

  // 3) Último fallback — URL pública direta.
  window.open(url, '_blank', 'noopener,noreferrer')
}

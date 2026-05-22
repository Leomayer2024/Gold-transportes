// Service Worker do SEG.
// Estratégia: network-first para HTML (sempre busca a versão mais nova do
// servidor). Cache só para assets versionados (Vite gera hashes em
// /assets/*). Quando uma nova versão do app é publicada, o SW detecta na
// próxima visita e pede pra recarregar.

const CACHE_NAME = 'seg-cache-v1'
const APP_SHELL = ['/', '/icon.png', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  // Ativa o novo SW assim que o install terminar (sem esperar fechar abas).
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Limpa caches antigos.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Nunca cachear chamadas de API ou auth — sempre online.
  if (url.pathname.startsWith('/api/') || url.hostname.endsWith('supabase.co')) {
    return
  }

  // Assets versionados (Vite) → cache-first (são imutáveis).
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((resp) => {
        if (resp.ok) {
          const clone = resp.clone()
          caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {})
        }
        return resp
      }))
    )
    return
  }

  // HTML e demais → network-first, fallback no cache.
  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp.ok) {
          const clone = resp.clone()
          caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {})
        }
        return resp
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
  )
})

// Permite que a página force atualização imediata.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

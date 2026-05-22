// Registra o Service Worker e oferece reload quando há atualização.
// Toda vez que o usuário abre o app, o navegador checa /sw.js. Se vier um
// hash diferente, o novo SW entra em "waiting" e a função onUpdate dispara —
// mostramos um banner pedindo pra recarregar.

export function registerServiceWorker(onUpdateAvailable) {
  if (!('serviceWorker' in navigator)) return
  if (location.hostname === 'localhost' && import.meta.env.DEV) {
    // Em dev (vite dev server) o SW pode atrapalhar HMR. Pula registro.
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Detecta atualização disponível.
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              // Nova versão pronta — controller != null significa que já existe um SW.
              if (typeof onUpdateAvailable === 'function') {
                onUpdateAvailable(() => {
                  installing.postMessage('SKIP_WAITING')
                })
              }
            }
          })
        })

        // A cada hora força checagem por update (caso o usuário fique a sessão toda aberta).
        setInterval(() => {
          registration.update().catch(() => {})
        }, 60 * 60 * 1000)
      })
      .catch((err) => {
        console.warn('[SW] registro falhou:', err)
      })

    // Quando o novo SW assume o controle, recarrega para aplicar.
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  })
}

import { useEffect, useState } from 'react'
import { registerServiceWorker } from '../registerSW'

// Banner no canto inferior. Aparece quando o SW detecta versão nova publicada.
export default function UpdatePrompt() {
  const [applyUpdate, setApplyUpdate] = useState(null)

  useEffect(() => {
    registerServiceWorker((apply) => setApplyUpdate(() => apply))
  }, [])

  if (!applyUpdate) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 9999,
        background: '#1e2d3d',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: 8,
        boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
        maxWidth: 320,
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Nova versão disponível</div>
      <div style={{ opacity: 0.85, marginBottom: 10 }}>
        Há uma atualização do SEG. Atualize para garantir que esteja na última versão.
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => setApplyUpdate(null)}
          style={{ background: 'transparent', color: '#fff', border: '1px solid #fff5', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}
        >
          Depois
        </button>
        <button
          type="button"
          onClick={applyUpdate}
          style={{ background: '#c49512', color: '#1e2d3d', border: 'none', borderRadius: 4, padding: '4px 12px', fontWeight: 600, cursor: 'pointer' }}
        >
          Atualizar agora
        </button>
      </div>
    </div>
  )
}

// Aceita ambos os formatos:
//   <StatCard item={{ label, value, hint, tone }} />
//   <StatCard label="..." value={...} hint="..." tone="..." />
export default function StatCard({ item, label, value, hint, tone }) {
  const data = item || { label, value, hint, tone }
  const cls = data.tone ? `stat-card tone-${data.tone}` : 'stat-card'
  return (
    <article className={cls}>
      <span>{data.label}</span>
      <strong>{data.value}</strong>
      {data.hint && <small>{data.hint}</small>}
    </article>
  )
}

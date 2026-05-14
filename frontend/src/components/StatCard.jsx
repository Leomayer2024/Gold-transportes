export default function StatCard({ item }) {
  return (
    <article className="stat-card">
      <span>{item.label}</span>
      <strong>{item.value}</strong>
      <small>{item.hint}</small>
    </article>
  )
}

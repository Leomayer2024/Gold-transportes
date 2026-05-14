import React from 'react'

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

export default function PieChart({ data = [], title = '', width = 300, height = 300 }) {
  if (!data || data.length === 0) {
    return <div className="empty-chart">Sem dados</div>
  }

  const total = data.reduce((sum, item) => sum + (item.value || 0), 0)
  if (total === 0) {
    return <div className="empty-chart">Sem dados</div>
  }

  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) / 2 - 20

  let currentAngle = -90

  const slices = data.map((item, index) => {
    const sliceAngle = (item.value / total) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + sliceAngle

    const startAngleRad = (startAngle * Math.PI) / 180
    const endAngleRad = (endAngle * Math.PI) / 180

    const x1 = cx + radius * Math.cos(startAngleRad)
    const y1 = cy + radius * Math.sin(startAngleRad)
    const x2 = cx + radius * Math.cos(endAngleRad)
    const y2 = cy + radius * Math.sin(endAngleRad)

    const largeArc = sliceAngle > 180 ? 1 : 0
    const pathData = [
      `M ${cx} ${cy}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ')

    // Label
    const labelAngle = startAngle + sliceAngle / 2
    const labelAngleRad = (labelAngle * Math.PI) / 180
    const labelRadius = radius * 0.7
    const labelX = cx + labelRadius * Math.cos(labelAngleRad)
    const labelY = cy + labelRadius * Math.sin(labelAngleRad)
    const percentage = ((item.value / total) * 100).toFixed(0)

    currentAngle = endAngle

    return (
      <g key={`slice-${index}`}>
        <path d={pathData} fill={COLORS[index % COLORS.length]} opacity="0.8" />
        {sliceAngle > 15 && (
          <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="12" fontWeight="bold">
            {percentage}%
          </text>
        )}
      </g>
    )
  })

  return (
    <div className="chart-container">
      {title && <h3 className="chart-title">{title}</h3>}
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="pie-chart">
        {slices}
      </svg>
      <div className="chart-legend">
        {data.map((item, index) => (
          <div key={`legend-${index}`} className="legend-item">
            <div className="legend-color" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
            <span className="legend-label">{item.label}</span>
            <span className="legend-value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

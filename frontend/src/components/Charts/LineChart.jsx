import React from 'react'

export default function LineChart({ data = [], title = '', width = 400, height = 250, yLabel = '' }) {
  if (!data || data.length === 0) {
    return <div className="empty-chart">Sem dados</div>
  }

  const values = data.map((item) => item.value || 0)
  const maxValue = Math.max(...values)
  const minValue = Math.min(...values, 0)
  const range = maxValue - minValue || 1

  const padding = { top: 20, right: 20, bottom: 40, left: 60 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const pointSpacing = chartWidth / (data.length - 1 || 1)

  const points = data.map((item, index) => {
    const x = padding.left + index * pointSpacing
    const y = padding.top + chartHeight - ((item.value - minValue) / range) * chartHeight
    return { x, y, ...item }
  })

  // Path for line
  const pathData = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  // Area under line
  const areaPath = `
    ${pathData}
    L ${points[points.length - 1].x} ${padding.top + chartHeight}
    L ${points[0].x} ${padding.top + chartHeight}
    Z
  `

  // Y axis labels
  const yAxisLabels = Array.from({ length: 5 }, (_, i) => {
    const value = Math.round(minValue + (range / 4) * i)
    const y = padding.top + chartHeight - ((value - minValue) / range) * chartHeight
    return (
      <g key={`y-label-${i}`}>
        <line x1={padding.left - 5} y1={y} x2={padding.left} y2={y} stroke="#a8b3be" />
        <text x={padding.left - 10} y={y + 3} textAnchor="end" fontSize="9" fill="#556371">
          {value}
        </text>
      </g>
    )
  })

  return (
    <div className="chart-container">
      {title && <h3 className="chart-title">{title}</h3>}
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="line-chart">
        {/* Grid lines */}
        {Array.from({ length: 5 }, (_, i) => {
          const y = padding.top + (chartHeight / 4) * i
          return <line key={`grid-${i}`} x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e5e7eb" strokeDasharray="3" />
        })}

        {/* Area under line */}
        <path d={areaPath} fill="#10b981" opacity="0.1" />

        {/* Axes */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} stroke="#a8b3be" strokeWidth="1" />
        <line x1={padding.left} y1={padding.top + chartHeight} x2={width - padding.right} y2={padding.top + chartHeight} stroke="#a8b3be" strokeWidth="1" />

        {/* Y axis labels */}
        {yAxisLabels}

        {/* X axis labels */}
        {points.map((p, i) => (
          <text key={`x-label-${i}`} x={p.x} y={padding.top + chartHeight + 15} textAnchor="middle" fontSize="10" fill="#556371">
            {p.label}
          </text>
        ))}

        {/* Line */}
        <path d={pathData} stroke="#10b981" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Points */}
        {points.map((p, i) => (
          <circle key={`point-${i}`} cx={p.x} cy={p.y} r="4" fill="#10b981" stroke="white" strokeWidth="2" />
        ))}
      </svg>
    </div>
  )
}

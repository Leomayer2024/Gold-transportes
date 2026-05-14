import React from 'react'

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

export default function BarChart({ data = [], title = '', width = 400, height = 250, horizontal = false }) {
  if (!data || data.length === 0) {
    return <div className="empty-chart">Sem dados</div>
  }

  const maxValue = Math.max(...data.map((item) => item.value || 0))
  if (maxValue === 0) {
    return <div className="empty-chart">Sem dados</div>
  }

  const padding = { top: 20, right: 20, bottom: 40, left: 60 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const barWidth = chartWidth / data.length * 0.7
  const barGap = chartWidth / data.length * 0.3

  const bars = data.map((item, index) => {
    const barHeight = (item.value / maxValue) * chartHeight
    const x = padding.left + index * (barWidth + barGap) + barGap / 2
    const y = padding.top + chartHeight - barHeight

    return (
      <g key={`bar-${index}`}>
        <rect
          x={x}
          y={y}
          width={barWidth}
          height={barHeight}
          fill={COLORS[index % COLORS.length]}
          opacity="0.8"
          rx="2"
        />
        <text
          x={x + barWidth / 2}
          y={y - 5}
          textAnchor="middle"
          fontSize="11"
          fontWeight="bold"
          fill="#1d2730"
        >
          {item.value}
        </text>
        <text
          x={x + barWidth / 2}
          y={padding.top + chartHeight + 15}
          textAnchor="middle"
          fontSize="10"
          fill="#556371"
        >
          {item.label}
        </text>
      </g>
    )
  })

  const yAxisLabels = Array.from({ length: 5 }, (_, i) => {
    const value = Math.round((maxValue / 4) * i)
    const y = padding.top + chartHeight - (value / maxValue) * chartHeight
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
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="bar-chart">
        {/* Grid lines */}
        {Array.from({ length: 5 }, (_, i) => {
          const y = padding.top + (chartHeight / 4) * i
          return <line key={`grid-${i}`} x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e5e7eb" strokeDasharray="3" />
        })}

        {/* Axes */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} stroke="#a8b3be" strokeWidth="1" />
        <line x1={padding.left} y1={padding.top + chartHeight} x2={width - padding.right} y2={padding.top + chartHeight} stroke="#a8b3be" strokeWidth="1" />

        {/* Y axis labels */}
        {yAxisLabels}

        {/* Bars */}
        {bars}
      </svg>
    </div>
  )
}

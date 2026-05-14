import React from 'react'

export default function GaugeChart({ value = 0, max = 100, title = '', unit = '%', color = '#10b981', width = 200, height = 200 }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  const radius = Math.min(width, height) / 2 - 20
  const cx = width / 2
  const cy = height / 2

  // Determina a cor baseada no valor
  let gaugeColor = color
  if (percentage < 50) {
    gaugeColor = '#ef4444'
  } else if (percentage < 75) {
    gaugeColor = '#f59e0b'
  }

  // Arco de fundo
  const backgroundArc = describeArc(cx, cy, radius, 0, 180)

  // Arco preenchido
  const filledAngle = (percentage / 100) * 180
  const filledArc = describeArc(cx, cy, radius, 0, filledAngle)

  return (
    <div className="chart-container">
      {title && <h3 className="chart-title">{title}</h3>}
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="gauge-chart">
        {/* Background arc */}
        <path d={backgroundArc} stroke="#e5e7eb" strokeWidth="20" fill="none" strokeLinecap="round" />

        {/* Filled arc */}
        <path d={filledArc} stroke={gaugeColor} strokeWidth="20" fill="none" strokeLinecap="round" />

        {/* Center circle */}
        <circle cx={cx} cy={cy} r="30" fill="white" stroke="#a8b3be" strokeWidth="2" />

        {/* Value text */}
        <text x={cx} y={cy - 5} textAnchor="middle" dominantBaseline="middle" fontSize="20" fontWeight="bold" fill="#1d2730">
          {value}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="#556371">
          {unit}
        </text>

        {/* Labels */}
        <text x={cx - radius - 10} y={cy + 10} textAnchor="end" fontSize="10" fill="#556371">
          0%
        </text>
        <text x={cx + radius + 10} y={cy + 10} textAnchor="start" fontSize="10" fill="#556371">
          100%
        </text>
      </svg>
    </div>
  )
}

function describeArc(x, y, radius, startAngle, endAngle) {
  const start = polarToCartesian(x, y, radius, endAngle)
  const end = polarToCartesian(x, y, radius, startAngle)
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  }
}

import React from 'react'

type Props = {
  size?: number
  color?: string
  strokeWidth?: number
  style?: React.CSSProperties
  title?: string
}

export default function MonopolyMoney({
  size = 16,
  color = '#fff',
  strokeWidth = 1.6,
  style,
  title = 'Monopoly money',
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      style={style}
    >
      {/* Outer note */}
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="3"
        ry="3"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
      />


      {/* Two horizontal lines across the M */}
      <line
        x1="5.2"
        y1="10.4"
        x2="18.8"
        y2="10.4"
        stroke={color}
        strokeWidth={strokeWidth * 2 / 3}
        strokeLinecap="round"
      />
      <line
        x1="15.4"
        y1="10.4"
        x2="18.8"
        y2="10.4"
        stroke={color}
        strokeWidth={strokeWidth * 2 / 3}
        strokeLinecap="round"
      />
      <line
        x1="5.2"
        y1="12.6"
        x2="8"
        y2="12.6"
        stroke={color}
        strokeWidth={strokeWidth * 2 / 3}
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="12.6"
        x2="18.8"
        y2="12.6"
        stroke={color}
        strokeWidth={strokeWidth * 2 / 3}
        strokeLinecap="round"
      />
      {/* Central "M" */}
      <path
        d="M8 16V8l4 5 4-5v8"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

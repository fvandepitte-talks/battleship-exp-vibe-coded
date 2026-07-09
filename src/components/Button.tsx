import React from 'react'

interface Props {
  label: string
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  onClick?: () => void
  disabled?: boolean
  className?: string
  title?: string
}

const Button: React.FC<Props> = ({
  label,
  variant = 'primary',
  onClick,
  disabled,
  className = '',
  title,
}) => {
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {label}
    </button>
  )
}

export default Button

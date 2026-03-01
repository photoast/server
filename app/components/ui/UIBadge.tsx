import { ReactNode } from 'react'

type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'blue'

interface UIBadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-600',
  success: 'bg-green-50 text-green-700',
  error:   'bg-red-50 text-red-600',
  warning: 'bg-yellow-50 text-yellow-700',
  info:    'bg-blue-50 text-blue-600',
  blue:    'bg-blue-500 text-white',
}

export default function UIBadge({ children, variant = 'default', className = '' }: UIBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  )
}

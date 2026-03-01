import { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'download' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface UIButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400',
  secondary:
    'bg-gray-100 text-gray-700 hover:bg-gray-150 active:bg-gray-200 disabled:opacity-40',
  download:
    'bg-gray-800 text-white hover:bg-gray-900 active:bg-black disabled:opacity-40',
  danger:
    'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 disabled:opacity-40',
  ghost:
    'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40',
}

const sizeClasses: Record<Size, string> = {
  sm: 'py-2 px-4 text-sm',
  md: 'py-2.5 px-5 text-sm',
  lg: 'py-3.5 px-6 text-base',
}

export default function UIButton({
  variant = 'primary',
  size = 'lg',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className = '',
  ...props
}: UIButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'rounded-2xl font-semibold transition-colors flex items-center justify-center gap-2',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading ? (
        <>
          <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
          처리 중
        </>
      ) : (
        children
      )}
    </button>
  )
}

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
    'bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white hover:shadow-2xl shadow-lg disabled:opacity-50',
  secondary:
    'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50',
  download:
    'bg-gradient-to-r from-blue-400 to-purple-400 text-white hover:shadow-2xl shadow-lg disabled:opacity-50',
  danger:
    'bg-gradient-to-r from-red-500 to-rose-500 text-white hover:shadow-lg shadow-md disabled:opacity-50',
  ghost:
    'bg-white border-2 border-gray-200 text-gray-700 hover:border-pink-300 hover:shadow-lg disabled:opacity-50',
}

const sizeClasses: Record<Size, string> = {
  sm: 'py-2 px-4 text-sm',
  md: 'py-3 px-5 text-base',
  lg: 'py-4 px-6 text-lg',
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
        'rounded-full font-bold transition-all flex items-center justify-center gap-2',
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
          <span className="animate-spin rounded-full h-5 w-5 border-t-2 border-current" />
          처리 중...
        </>
      ) : (
        children
      )}
    </button>
  )
}

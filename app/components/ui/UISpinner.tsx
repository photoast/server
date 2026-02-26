type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl'

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-5 w-5 border-t-2',
  md: 'h-8 w-8 border-t-2',
  lg: 'h-12 w-12 border-t-4',
  xl: 'h-16 w-16 border-t-4',
}

/** Inline spinner — just the spinning circle */
export function UISpinnerIcon({ size = 'md', className = '' }: { size?: SpinnerSize; className?: string }) {
  return (
    <span
      className={`animate-spin rounded-full border-purple-600 ${sizeClasses[size]} ${className}`}
    />
  )
}

/** Full-page centered loading state */
export function UIPageSpinner({ label = '로딩 중...' }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="text-center">
        <UISpinnerIcon size="xl" className="mx-auto mb-4" />
        <p className="text-gray-600">{label}</p>
      </div>
    </div>
  )
}

/** Card-style loading state */
export function UICardSpinner({ label, sublabel }: { label?: string; sublabel?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      <div className="text-center bg-white rounded-3xl shadow-2xl p-8 mx-4">
        <UISpinnerIcon size="xl" className="mx-auto mb-6" />
        {label && <h2 className="text-xl font-bold text-gray-800 mb-2">{label}</h2>}
        {sublabel && <p className="text-gray-500">{sublabel}</p>}
      </div>
    </div>
  )
}

export default UISpinnerIcon

type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl'

const sizeMap: Record<SpinnerSize, { circle: string; stroke: number }> = {
  sm: { circle: 'h-4 w-4', stroke: 2 },
  md: { circle: 'h-6 w-6', stroke: 2.5 },
  lg: { circle: 'h-8 w-8', stroke: 3 },
  xl: { circle: 'h-10 w-10', stroke: 3 },
}

/** Inline spinner icon — clean rotating circle */
export function UISpinnerIcon({ size = 'md', className = '' }: { size?: SpinnerSize; className?: string }) {
  const { circle, stroke } = sizeMap[size]
  return (
    <svg className={`animate-spin ${circle} ${className}`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={stroke} className="opacity-10" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        className="opacity-80"
      />
    </svg>
  )
}

/** Full-page centered loading — clean Toss style */
export function UIPageSpinner({ label }: { label?: string }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gray-50">
      <UISpinnerIcon size="xl" className="text-gray-400 mb-4" />
      {label && <p className="text-sm text-gray-400">{label}</p>}
    </div>
  )
}

/** Card-style loading overlay */
export function UICardSpinner({ label, sublabel }: { label?: string; sublabel?: string }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center bg-white rounded-2xl shadow-sm border border-gray-100 py-10 px-8 w-full max-w-xs">
        <UISpinnerIcon size="xl" className="text-blue-500 mx-auto mb-5" />
        {label && <p className="text-base font-semibold text-gray-900 mb-1">{label}</p>}
        {sublabel && <p className="text-sm text-gray-400">{sublabel}</p>}
      </div>
    </div>
  )
}

export default UISpinnerIcon

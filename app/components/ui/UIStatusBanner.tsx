type BannerType = 'error' | 'success' | 'info' | 'processing'

interface UIStatusBannerProps {
  type: BannerType
  message: string
  className?: string
}

const config: Record<BannerType, { bg: string; text: string; iconColor: string }> = {
  error:      { bg: 'bg-red-50',   text: 'text-red-600',   iconColor: 'text-red-400' },
  success:    { bg: 'bg-green-50', text: 'text-green-700', iconColor: 'text-green-500' },
  info:       { bg: 'bg-blue-50',  text: 'text-blue-600',  iconColor: 'text-blue-400' },
  processing: { bg: 'bg-gray-50',  text: 'text-gray-600',  iconColor: 'text-gray-400' },
}

const icons: Record<Exclude<BannerType, 'processing'>, JSX.Element> = {
  error: (
    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  ),
  success: (
    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  ),
}

export default function UIStatusBanner({ type, message, className = '' }: UIStatusBannerProps) {
  const c = config[type]

  return (
    <div className={`${c.bg} rounded-xl px-4 py-3 flex items-center gap-2.5 ${className}`}>
      {type === 'processing' ? (
        <span className={`animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent shrink-0 ${c.iconColor}`} />
      ) : (
        <span className={c.iconColor}>{icons[type]}</span>
      )}
      <span className={`text-sm font-medium ${c.text}`}>{message}</span>
    </div>
  )
}

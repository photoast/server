type BannerType = 'error' | 'success' | 'info' | 'processing'

interface UIStatusBannerProps {
  type: BannerType
  message: string
  className?: string
}

const config: Record<BannerType, { bg: string; border: string; text: string; icon: string }> = {
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-600',
    icon: '⚠️',
  },
  success: {
    bg: 'bg-gradient-to-r from-green-50 to-emerald-50',
    border: 'border-green-300',
    text: 'text-green-600',
    icon: '🎉',
  },
  info: {
    bg: 'bg-gradient-to-r from-blue-50 to-purple-50',
    border: 'border-blue-200',
    text: 'text-blue-600',
    icon: '📸',
  },
  processing: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    icon: '',
  },
}

export default function UIStatusBanner({ type, message, className = '' }: UIStatusBannerProps) {
  const c = config[type]

  if (type === 'processing') {
    return (
      <div className={`${c.bg} border-2 ${c.border} rounded-2xl p-4 ${className}`}>
        <div className={`flex items-center justify-center gap-2 ${c.text}`}>
          <span className="animate-spin rounded-full h-5 w-5 border-t-2 border-purple-600" />
          <span className="font-medium">{message}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`${c.bg} border-2 ${c.border} rounded-2xl p-4 ${className}`}>
      <p className={`${c.text} text-center font-medium flex items-center justify-center gap-2`}>
        {c.icon && <span className="text-xl">{c.icon}</span>}
        {message}
      </p>
    </div>
  )
}

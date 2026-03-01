import { ReactNode } from 'react'

interface UIFormFieldProps {
  label?: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}

export default function UIFormField({ label, hint, error, children, className = '' }: UIFormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}
      {children}
      {hint && !error && (
        <p className="text-xs text-gray-400">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}

import { InputHTMLAttributes } from 'react'

interface UITextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export default function UITextInput({ error = false, className = '', ...props }: UITextInputProps) {
  return (
    <input
      className={[
        'w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-900 bg-gray-50',
        'placeholder:text-gray-400 transition-colors',
        'focus:bg-white focus:outline-none focus:ring-2',
        error
          ? 'border-red-300 focus:ring-red-100 focus:border-red-400'
          : 'border-gray-200 focus:ring-blue-50 focus:border-blue-400',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}

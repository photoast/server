import { ReactNode, ButtonHTMLAttributes } from 'react'

interface UISelectItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  children: ReactNode
}

export default function UISelectItem({ selected = false, children, className = '', ...props }: UISelectItemProps) {
  return (
    <button
      type="button"
      className={[
        'p-3 rounded-xl border text-left transition-colors w-full',
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-100 hover:border-gray-200 bg-white active:bg-gray-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}

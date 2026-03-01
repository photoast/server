import { ReactNode } from 'react'

interface UICardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  as?: 'div' | 'section' | 'article'
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

export default function UICard({
  children,
  className = '',
  padding = 'md',
  as: Tag = 'div',
}: UICardProps) {
  return (
    <Tag
      className={`bg-white rounded-2xl border border-gray-100 ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </Tag>
  )
}

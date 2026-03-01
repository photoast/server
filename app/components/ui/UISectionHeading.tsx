interface UISectionHeadingProps {
  title: string
  subtitle?: string
  className?: string
}

export default function UISectionHeading({ title, subtitle, className = '' }: UISectionHeadingProps) {
  return (
    <div className={className}>
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )
}

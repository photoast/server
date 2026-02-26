interface UISectionHeadingProps {
  title: string
  subtitle?: string
  className?: string
}

export default function UISectionHeading({ title, subtitle, className = '' }: UISectionHeadingProps) {
  return (
    <div className={`text-center ${className}`}>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
    </div>
  )
}

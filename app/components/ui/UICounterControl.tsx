'use client'

interface UICounterControlProps {
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
  disabled?: boolean
  label?: string
  hint?: string
}

export default function UICounterControl({
  value,
  min = 1,
  max = 10,
  onChange,
  disabled = false,
  label,
  hint,
}: UICounterControlProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between">
        {label && (
          <span className="text-sm font-semibold text-gray-700">{label}</span>
        )}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onChange(Math.max(min, value - 1))}
            disabled={disabled || value <= min}
            className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 font-bold text-lg hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
          >
            −
          </button>
          <span className="text-xl font-bold text-gray-900 min-w-[2rem] text-center tabular-nums">
            {value}
          </span>
          <button
            type="button"
            onClick={() => onChange(Math.min(max, value + 1))}
            disabled={disabled || value >= max}
            className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 font-bold text-lg hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
          >
            +
          </button>
        </div>
      </div>
      {hint && (
        <p className="text-xs text-gray-400 mt-2">{hint}</p>
      )}
    </div>
  )
}

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
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        {label && (
          <span className="text-gray-700 font-semibold">{label}</span>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange(Math.max(min, value - 1))}
            disabled={disabled || value <= min}
            className="w-10 h-10 rounded-full bg-white border-2 border-purple-300 text-purple-600 font-bold text-xl hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            −
          </button>
          <span className="text-2xl font-bold text-purple-600 min-w-[3rem] text-center">
            {value}
          </span>
          <button
            type="button"
            onClick={() => onChange(Math.min(max, value + 1))}
            disabled={disabled || value >= max}
            className="w-10 h-10 rounded-full bg-white border-2 border-purple-300 text-purple-600 font-bold text-xl hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>
      </div>
      {hint && (
        <p className="text-xs text-gray-500 text-center mt-2">{hint}</p>
      )}
    </div>
  )
}

interface Step {
  id: string
  label: string
}

interface UIStepBarProps {
  steps: Step[]
  currentStep: string
}

export default function UIStepBar({ steps, currentStep }: UIStepBarProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep)

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={[
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  isCompleted ? 'bg-blue-500 text-white' : isCurrent ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400',
                ].join(' ')}
              >
                {isCompleted ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${isCurrent ? 'text-blue-600' : isCompleted ? 'text-gray-500' : 'text-gray-300'}`}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mb-4 mx-1 transition-colors ${index < currentIndex ? 'bg-blue-500' : 'bg-gray-100'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

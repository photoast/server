'use client'

import { useI18n } from '../[slug]/i18n'

/** Explain the native picker before it covers the page; never replace its UI. */
export default function PhotoPickerGuide({ inline = false }: { inline?: boolean }) {
  const { t } = useI18n()
  return (
    <aside aria-label={t('picker.guideTitle')} className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-gray-900">
      <h3 className="text-base font-bold leading-6">{t('picker.guideTitle')}</h3>
      <ol className="mt-3 space-y-3 text-base leading-6 break-keep">
        {(!inline ? ['picker.guideOpen', 'picker.guideAndroid', 'picker.guidePhoto'] as const : ['picker.guideAndroid', 'picker.guidePhoto'] as const).map((key, i) => (
          <li key={key} className="flex gap-2.5">
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-800 text-sm font-bold text-white">{i + 1}</span>
            <span>{t(key)}</span>
          </li>
        ))}
      </ol>
      <details className="mt-3 border-t border-blue-200 pt-2">
        <summary className="cursor-pointer py-2 text-base font-semibold">{t('picker.guideHelp')}</summary>
        <p className="pb-1 text-base leading-6 text-gray-700">{t('picker.guideMissing')}</p>
      </details>
    </aside>
  )
}

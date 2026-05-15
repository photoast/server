'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export type Locale = 'ko' | 'en'

const translations = {
  // Header
  'header.subtitle': { ko: '사진을 선택해 인쇄해보세요', en: 'Pick a photo and print it' },

  // Step bar
  'step.layout': { ko: '레이아웃', en: 'Layout' },
  'step.color': { ko: '색상', en: 'Color' },
  'step.photo': { ko: '사진', en: 'Photo' },
  'step.done': { ko: '완료', en: 'Done' },
  'step.bgColor': { ko: '배경색', en: 'BG Color' },

  // Layout selection
  'layout.title': { ko: '레이아웃 선택', en: 'Choose Layout' },
  'layout.subtitle': { ko: '원하는 스타일을 골라보세요', en: 'Pick your style' },
  'layout.changeHint': { ko: '사진 선택 후에도 레이아웃을 변경할 수 있어요', en: 'You can change the layout later too' },
  'layout.slots': { ko: '칸', en: 'slots' },
  'layout.change': { ko: '변경', en: 'Change' },
  'layout.changeLayout': { ko: '레이아웃 변경', en: 'Change Layout' },

  // Color selection
  'color.title': { ko: '배경 색상', en: 'Background Color' },
  'color.subtitle': { ko: '배경색을 선택해주세요', en: 'Choose a background color' },
  'color.black': { ko: '블랙', en: 'Black' },
  'color.white': { ko: '화이트', en: 'White' },
  'color.pink': { ko: '핑크', en: 'Pink' },
  'color.blue': { ko: '블루', en: 'Blue' },
  'color.green': { ko: '그린', en: 'Green' },
  'color.purple': { ko: '퍼플', en: 'Purple' },
  'color.selectTitle': { ko: '배경색 선택', en: 'Select Background' },
  'color.selectSubtitle': { ko: '원하는 배경색을 골라주세요', en: 'Choose your preferred background' },
  'color.confirm': { ko: '이 배경색으로 완성하기', en: 'Apply this color' },
  'color.reEdit': { ko: '사진 다시 편집', en: 'Re-edit photos' },

  // Photo fill
  'photo.done': { ko: '사진 완료', en: 'Done' },
  'photo.ready': { ko: '준비됐어요. 아래 버튼으로 프린트할 수 있어요.', en: 'Ready! Tap the button below to print.' },
  'photo.tapToAdd': { ko: '사진 영역을 탭해서 추가해주세요.', en: 'Tap a photo slot to add your image.' },
  'photo.preview': { ko: '미리보기', en: 'Preview' },
  'photo.readyBadge': { ko: '준비 완료', en: 'Ready' },
  'photo.tapHint': { ko: '사진을 탭해 추가하거나 변경할 수 있어요', en: 'Tap to add or change a photo' },
  'photo.fourCutHint': { ko: '중앙을 세로로 자르면 동일한 스트립 2개가 나와요', en: 'Cut vertically in the center for 2 identical strips' },
  'photo.processing': { ko: '미리보기 생성 중...', en: 'Generating preview...' },
  'photo.printCount': { ko: '인쇄 매수', en: 'Print copies' },
  'photo.maxHint': { ko: '최대 10매까지 선택 가능합니다', en: 'Up to 10 copies' },
  'photo.allReady': { ko: '모든 슬롯이 준비됐어요. 완료 버튼을 눌러 합성하세요.', en: 'All slots filled. Tap Complete to merge.' },
  'photo.tapSlot': { ko: '슬롯을 탭해서 사진을 추가해주세요.', en: 'Tap a slot to add a photo.' },
  'photo.merging': { ko: '이미지 합성 중...', en: 'Merging images...' },

  // Buttons
  'btn.next': { ko: '다음으로', en: 'Next' },
  'btn.prev': { ko: '이전', en: 'Back' },
  'btn.prevStep': { ko: '이전으로', en: 'Go Back' },
  'btn.freePrint': { ko: '무료 프린트', en: 'Free Print' },
  'btn.pay': { ko: '결제하기', en: 'Pay' },
  'btn.newPhoto': { ko: '새로운 사진 만들기', en: 'Create New Photo' },
  'btn.download': { ko: '사진 저장', en: 'Save Photo' },
  'btn.cancelPrint': { ko: '인쇄 취소', en: 'Cancel Print' },
  'btn.complete': { ko: '완성하기', en: 'Complete' },
  'btn.close': { ko: '닫기', en: 'Close' },

  // Payment
  'pay.title': { ko: '결제', en: 'Payment' },
  'pay.subtitle': { ko: '결제 방법을 선택해주세요', en: 'Choose a payment method' },
  'pay.subtitleCount': { ko: '매 프린트 비용을 결제해주세요', en: 'prints' },
  'pay.emailLabel': { ko: '이메일 (결제 확인용)', en: 'Email (for receipt)' },
  'pay.unitPrice': { ko: '단가', en: 'Unit price' },
  'pay.quantity': { ko: '수량', en: 'Quantity' },
  'pay.total': { ko: '총 결제 금액', en: 'Total' },
  'pay.card': { ko: '카드/간편결제', en: 'Card / Easy Pay' },
  'pay.failed.title': { ko: '결제 실패', en: 'Payment Failed' },
  'pay.failed.subtitle': { ko: '결제 처리 중 문제가 발생했습니다', en: 'An error occurred during payment' },
  'pay.failed.retry': { ko: '다시 결제하기', en: 'Retry Payment' },
  'pay.failed.back': { ko: '처음으로', en: 'Start Over' },
  'pay.emailError': { ko: '올바른 이메일을 입력해주세요', en: 'Please enter a valid email' },
  'pay.moduleLoading': { ko: '결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.', en: 'Loading payment module. Please try again.' },

  // Auth code
  'auth.label': { ko: '인증코드', en: 'Auth Code' },
  'auth.placeholder': { ko: '인증코드 6자리 입력', en: 'Enter 6-digit code' },
  'auth.verified': { ko: '인증코드 확인됨', en: 'Code verified' },
  'auth.required': { ko: '인증코드를 입력해주세요', en: 'Please enter the auth code' },
  'auth.invalid': { ko: '유효하지 않은 인증코드입니다', en: 'Invalid auth code' },
  'auth.error': { ko: '인증코드 확인 중 오류가 발생했습니다', en: 'Error verifying auth code' },

  // Success
  'success.title': { ko: '완료', en: 'Done' },
  'success.subtitle': { ko: '사진이 준비되었습니다', en: 'Your photo is ready' },
  'success.freeMsg': { ko: '자유롭게 여러 장 뽑아도 괜찮아요! 마음껏 즐겨주세요', en: 'Feel free to print more! Enjoy!' },
  'success.paidMsg': { ko: '사진이 마음에 드셨다면 한 장 더 뽑아보세요!', en: 'Loved it? Print another one!' },
  'success.printing': { ko: '인쇄 중...', en: 'Printing...' },
  'success.pending': { ko: '인쇄 대기 중 · 곧 인쇄가 시작됩니다', en: 'In queue · printing soon' },
  'success.pendingQueue': { ko: '인쇄 대기 중 · 대기', en: 'In queue · position' },
  'success.queueSuffix': { ko: '번째', en: '' },
  'success.done': { ko: '인쇄가 완료되었습니다', en: 'Printing complete' },
  'success.allFailed': { ko: '인쇄에 실패했습니다. 관리자에게 문의해 주세요.', en: 'Printing failed. Please contact the organizer.' },
  'success.someFailed': { ko: '일부 인쇄가 실패했습니다. 관리자에게 문의해 주세요.', en: 'Some prints failed. Please contact the organizer.' },
  'success.sent': { ko: '프린트 전송 완료 · 잠시 후 출력됩니다', en: 'Sent to printer · printing shortly' },
  'success.cantCancel': { ko: '현재 인쇄 중이므로 취소할 수 없습니다', en: 'Cannot cancel while printing' },
  'success.confirmCancel': { ko: '인쇄를 취소하시겠습니까? 환불 처리됩니다.', en: 'Cancel print? You will be refunded.' },
  'success.cancelled': { ko: '취소 및 환불이 완료되었습니다.', en: 'Cancelled and refunded.' },
  'success.cancelError': { ko: '취소 처리 중 오류가 발생했습니다', en: 'Error cancelling print' },

  // Donation
  'donate.defaultMsg': { ko: '즐거우셨다면 자유롭게 응원해주세요!', en: 'Enjoyed it? Support us!' },
  'donate.hint': { ko: '부담 없이, 마음만으로도 충분해요', en: 'No pressure, your support means a lot' },
  'donate.btn': { ko: '후원하기', en: 'Donate' },
  'donate.copy': { ko: '복사', en: 'Copy' },
  'donate.copied': { ko: '복사됨', en: 'Copied' },

  // Crop editor
  'crop.title': { ko: '사진 편집', en: 'Edit Photo' },
  'crop.slot': { ko: '슬롯', en: 'Slot' },
  'crop.confirm': { ko: '확인', en: 'Confirm' },
  'crop.cancel': { ko: '취소', en: 'Cancel' },
  'crop.hint': { ko: '두 손가락으로 확대/축소 · 드래그로 위치 조정', en: 'Pinch to zoom · drag to move' },
  'crop.edit': { ko: '크롭 편집', en: 'Edit Crop' },
  'crop.swap': { ko: '위치 변경', en: 'Swap Position' },
  'crop.change': { ko: '다른 사진으로 변경', en: 'Change Photo' },
  'crop.delete': { ko: '삭제', en: 'Delete' },
  'crop.swapHint': { ko: '이동할 위치를 선택하세요', en: 'Select target position' },
  'crop.edit2': { ko: '편집', en: 'Edit' },
  'crop.swapHere': { ko: '여기로 이동', en: 'Move here' },

  // Photo picker
  'picker.title': { ko: '사진 선택', en: 'Select Photo' },
  'picker.new': { ko: '새 사진 추가', en: 'Add new photo' },

  // Puzzle
  'puzzle.label': { ko: '퍼즐 모드', en: 'Puzzle Mode' },
  'puzzle.sets': { ko: '퍼즐 세트 수', en: 'Puzzle sets' },
  'puzzle.printCount': { ko: '인쇄 수량', en: 'Print copies' },
  'puzzle.pieces': { ko: '조각', en: 'pieces' },
  'puzzle.split': { ko: '조각이 각각 인쇄됩니다', en: 'Each piece prints separately' },
  'puzzle.combined': { ko: '조립하면 하나의 큰 사진이 돼요', en: 'Assemble into one big photo' },

  // Preview
  'preview.title': { ko: '미리보기', en: 'Preview' },
  'preview.subtitle': { ko: '확인 후 프린트하세요', en: 'Review before printing' },
  'preview.privacy': { ko: '업로드된 사진은 인쇄 후 최대 24시간 임시 보관 후 영구 파기됩니다.', en: 'Uploaded photos are temporarily stored for up to 24 hours after printing, then permanently deleted.' },

  // Errors
  'error.download': { ko: '다운로드에 실패했습니다', en: 'Download failed' },
  'error.process': { ko: '미리보기 생성에 실패했습니다', en: 'Failed to generate preview' },
  'error.print': { ko: '프린트에 실패했습니다', en: 'Print failed' },
  'error.payment': { ko: '결제에 실패했습니다', en: 'Payment failed' },
  'error.paymentConfirm': { ko: '결제 처리 중 오류가 발생했습니다', en: 'Error processing payment' },
  'error.event': { ko: '이벤트를 찾을 수 없습니다', en: 'Event not found' },
  'error.layout': { ko: '레이아웃을 찾을 수 없습니다', en: 'Layout not found' },
  'error.pageLoad': { ko: '페이지를 불러올 수 없습니다', en: 'Failed to load page' },
  'error.allPhotos': { ko: '모든 사진을 선택하고 편집해주세요', en: 'Please select and edit all photos' },
  'error.allSlots': { ko: '모든 슬롯에 사진을 추가해주세요', en: 'Please add photos to all slots' },
  'error.imageProcess': { ko: '이미지 처리에 실패했습니다', en: 'Image processing failed' },

  // Misc
  'misc.printPreview': { ko: '프린트 미리보기', en: 'Print preview' },
  'misc.printPhoto': { ko: '인쇄 사진', en: 'Print photo' },
  'misc.payProcessing': { ko: '결제 처리 중...', en: 'Processing payment...' },
  'misc.payWait': { ko: '잠시만 기다려주세요', en: 'Please wait...' },
  'misc.copies': { ko: '매', en: '' },
  'misc.won': { ko: '원', en: '₩' },
  'misc.set': { ko: '세트', en: 'set(s)' },
  'misc.total': { ko: '총', en: 'Total' },
  'misc.sheets': { ko: '장 인쇄', en: 'sheets' },
} as const

type TranslationKey = keyof typeof translations

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextType>({
  locale: 'ko',
  setLocale: () => {},
  t: (key) => translations[key]?.ko ?? key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ko')

  useEffect(() => {
    const saved = localStorage.getItem('locale') as Locale | null
    if (saved && (saved === 'ko' || saved === 'en')) {
      setLocaleState(saved)
    }
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    localStorage.setItem('locale', l)
  }, [])

  const t = useCallback((key: TranslationKey): string => {
    return translations[key]?.[locale] ?? key
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

export function LanguageToggle() {
  const { locale, setLocale } = useI18n()
  return (
    <button
      onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')}
      className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
    >
      {locale === 'ko' ? 'EN' : '한국어'}
    </button>
  )
}

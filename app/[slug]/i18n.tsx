'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { trackLocaleChange } from '@/lib/gtag'

export type Locale = 'ko' | 'en' | 'zh'

const LOCALES: Locale[] = ['ko', 'en', 'zh']
const LOCALE_LABELS: Record<Locale, string> = { ko: '한국어', en: 'EN', zh: '中文' }

const translations = {
  // Header
  'header.subtitle': { ko: '사진을 선택해 인쇄해보세요', en: 'Pick a photo and print it', zh: '选择照片并打印' },

  // Step bar
  'step.layout': { ko: '레이아웃', en: 'Layout', zh: '布局' },
  'step.color': { ko: '색상', en: 'Color', zh: '颜色' },
  'step.photo': { ko: '사진', en: 'Photo', zh: '照片' },
  'step.done': { ko: '완료', en: 'Done', zh: '完成' },
  'step.bgColor': { ko: '배경색', en: 'BG Color', zh: '背景色' },

  // Layout selection
  'layout.title': { ko: '레이아웃 선택', en: 'Choose Layout', zh: '选择布局' },
  'layout.subtitle': { ko: '원하는 스타일을 골라보세요', en: 'Pick your style', zh: '选择你喜欢的风格' },
  'layout.changeHint': { ko: '사진 선택 후에도 레이아웃을 변경할 수 있어요', en: 'You can change the layout later too', zh: '选择照片后也可以更改布局' },
  'layout.slots': { ko: '칸', en: 'slots', zh: '格' },
  'layout.change': { ko: '변경', en: 'Change', zh: '更改' },
  'layout.changeLayout': { ko: '레이아웃 변경', en: 'Change Layout', zh: '更改布局' },

  // Color selection
  'color.title': { ko: '배경 색상', en: 'Background Color', zh: '背景颜色' },
  'color.subtitle': { ko: '배경색을 선택해주세요', en: 'Choose a background color', zh: '请选择背景颜色' },
  'color.black': { ko: '블랙', en: 'Black', zh: '黑色' },
  'color.white': { ko: '화이트', en: 'White', zh: '白色' },
  'color.pink': { ko: '핑크', en: 'Pink', zh: '粉色' },
  'color.blue': { ko: '블루', en: 'Blue', zh: '蓝色' },
  'color.green': { ko: '그린', en: 'Green', zh: '绿色' },
  'color.purple': { ko: '퍼플', en: 'Purple', zh: '紫色' },
  'color.selectTitle': { ko: '배경색 선택', en: 'Select Background', zh: '选择背景色' },
  'color.selectSubtitle': { ko: '원하는 배경색을 골라주세요', en: 'Choose your preferred background', zh: '请选择你喜欢的背景色' },
  'color.confirm': { ko: '이 배경색으로 완성하기', en: 'Apply this color', zh: '使用此背景色' },
  'color.reEdit': { ko: '사진 다시 편집', en: 'Re-edit photos', zh: '重新编辑照片' },

  // Photo fill
  'photo.done': { ko: '사진 완료', en: 'Done', zh: '完成' },
  'photo.ready': { ko: '준비됐어요. 아래 버튼으로 프린트할 수 있어요.', en: 'Ready! Tap the button below to print.', zh: '准备好了！点击下方按钮打印。' },
  'photo.tapToAdd': { ko: '사진 영역을 탭해서 추가해주세요.', en: 'Tap a photo slot to add your image.', zh: '点击照片区域添加图片。' },
  'photo.tapHere': { ko: '눌러서 사진 넣기', en: 'Tap to add a photo', zh: '点击添加照片' },
  'photo.preview': { ko: '미리보기', en: 'Preview', zh: '预览' },
  'photo.readyBadge': { ko: '준비 완료', en: 'Ready', zh: '就绪' },
  'photo.tapHint': { ko: '사진을 탭해 추가하거나 변경할 수 있어요', en: 'Tap to add or change a photo', zh: '点击添加或更换照片' },
  'photo.fourCutHint': { ko: '중앙을 세로로 자르면 동일한 스트립 2개가 나와요', en: 'Cut vertically in the center for 2 identical strips', zh: '从中间纵向裁剪可得到2条相同的照片条' },
  'photo.processing': { ko: '미리보기 생성 중...', en: 'Generating preview...', zh: '正在生成预览...' },
  'photo.printCount': { ko: '인쇄 매수', en: 'Print copies', zh: '打印份数' },
  'photo.maxHint': { ko: '최대 10매까지 선택 가능합니다', en: 'Up to 10 copies', zh: '最多可选10份' },
  'photo.allReady': { ko: '모든 슬롯이 준비됐어요. 완료 버튼을 눌러 합성하세요.', en: 'All slots filled. Tap Complete to merge.', zh: '所有位置已填满。点击完成合成。' },
  'photo.tapSlot': { ko: '슬롯을 탭해서 사진을 추가해주세요.', en: 'Tap a slot to add a photo.', zh: '点击位置添加照片。' },
  'photo.merging': { ko: '이미지 합성 중...', en: 'Merging images...', zh: '正在合成图片...' },

  // Buttons
  'btn.next': { ko: '다음으로', en: 'Next', zh: '下一步' },
  'btn.prev': { ko: '이전', en: 'Back', zh: '返回' },
  'btn.prevStep': { ko: '이전으로', en: 'Go Back', zh: '返回上一步' },
  'btn.freePrint': { ko: '무료 프린트', en: 'Free Print', zh: '免费打印' },
  'btn.pay': { ko: '결제하기', en: 'Pay', zh: '支付' },
  'btn.newPhoto': { ko: '새로운 사진 만들기', en: 'Create New Photo', zh: '制作新照片' },
  'btn.download': { ko: '사진 저장', en: 'Save Photo', zh: '保存照片' },
  'btn.cancelPrint': { ko: '인쇄 취소', en: 'Cancel Print', zh: '取消打印' },
  'btn.complete': { ko: '완성하기', en: 'Complete', zh: '完成' },
  'btn.close': { ko: '닫기', en: 'Close', zh: '关闭' },

  // Payment
  'pay.title': { ko: '결제', en: 'Payment', zh: '支付' },
  'pay.subtitle': { ko: '결제 방법을 선택해주세요', en: 'Choose a payment method', zh: '请选择支付方式' },
  'pay.subtitleCount': { ko: '매 프린트 비용을 결제해주세요', en: 'prints', zh: '份打印费用' },
  'pay.emailLabel': { ko: '이메일 (결제 확인용)', en: 'Email (for receipt)', zh: '邮箱（用于收据）' },
  'pay.unitPrice': { ko: '단가', en: 'Unit price', zh: '单价' },
  'pay.quantity': { ko: '수량', en: 'Quantity', zh: '数量' },
  'pay.total': { ko: '총 결제 금액', en: 'Total', zh: '总金额' },
  'pay.card': { ko: '카드/간편결제', en: 'Card / Easy Pay', zh: '银行卡/快捷支付' },
  'pay.failed.title': { ko: '결제 실패', en: 'Payment Failed', zh: '支付失败' },
  'pay.failed.subtitle': { ko: '결제 처리 중 문제가 발생했습니다', en: 'An error occurred during payment', zh: '支付过程中出现问题' },
  'pay.failed.retry': { ko: '다시 결제하기', en: 'Retry Payment', zh: '重新支付' },
  'pay.failed.back': { ko: '처음으로', en: 'Start Over', zh: '返回首页' },
  'pay.emailError': { ko: '올바른 이메일을 입력해주세요', en: 'Please enter a valid email', zh: '请输入有效的邮箱地址' },
  'pay.moduleLoading': { ko: '결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.', en: 'Loading payment module. Please try again.', zh: '正在加载支付模块，请稍后重试。' },

  // Auth code
  'auth.label': { ko: '인증코드', en: 'Auth Code', zh: '验证码' },
  'auth.placeholder': { ko: '인증코드 6자리 입력', en: 'Enter 6-digit code', zh: '请输入6位验证码' },
  'auth.verified': { ko: '인증코드 확인됨', en: 'Code verified', zh: '验证码已确认' },
  'auth.required': { ko: '인증코드를 입력해주세요', en: 'Please enter the auth code', zh: '请输入验证码' },
  'auth.invalid': { ko: '유효하지 않은 인증코드입니다', en: 'Invalid auth code', zh: '验证码无效' },
  'auth.error': { ko: '인증코드 확인 중 오류가 발생했습니다', en: 'Error verifying auth code', zh: '验证码校验出错' },

  // Success
  'success.title': { ko: '완료', en: 'Done', zh: '完成' },
  'success.subtitle': { ko: '사진이 준비되었습니다', en: 'Your photo is ready', zh: '照片已准备好' },
  'success.freeMsg': { ko: '자유롭게 여러 장 뽑아도 괜찮아요! 마음껏 즐겨주세요', en: 'Feel free to print more! Enjoy!', zh: '可以多打印几张哦！尽情享受吧' },
  'success.paidMsg': { ko: '사진이 마음에 드셨다면 한 장 더 뽑아보세요!', en: 'Loved it? Print another one!', zh: '喜欢的话再打印一张吧！' },
  'success.printing': { ko: '인쇄 중...', en: 'Printing...', zh: '正在打印...' },
  'success.pending': { ko: '인쇄 대기 중 · 곧 인쇄가 시작됩니다', en: 'In queue · printing soon', zh: '排队中 · 即将开始打印' },
  'success.pendingQueue': { ko: '인쇄 대기 중 · 대기', en: 'In queue · position', zh: '排队中 · 第' },
  'success.queueSuffix': { ko: '번째', en: '', zh: '位' },
  'success.done': { ko: '인쇄가 완료되었습니다', en: 'Printing complete', zh: '打印完成' },
  'success.allFailed': { ko: '인쇄에 실패했습니다. 관리자에게 문의해 주세요.', en: 'Printing failed. Please contact the organizer.', zh: '打印失败，请联系工作人员。' },
  'success.someFailed': { ko: '일부 인쇄가 실패했습니다. 관리자에게 문의해 주세요.', en: 'Some prints failed. Please contact the organizer.', zh: '部分打印失败，请联系工作人员。' },
  'success.sent': { ko: '프린트 전송 완료 · 잠시 후 출력됩니다', en: 'Sent to printer · printing shortly', zh: '已发送至打印机 · 即将打印' },
  'success.cantCancel': { ko: '현재 인쇄 중이므로 취소할 수 없습니다', en: 'Cannot cancel while printing', zh: '正在打印中，无法取消' },
  'success.confirmCancel': { ko: '인쇄를 취소하시겠습니까? 환불 처리됩니다.', en: 'Cancel print? You will be refunded.', zh: '确定取消打印吗？将会退款。' },
  'success.cancelled': { ko: '취소 및 환불이 완료되었습니다.', en: 'Cancelled and refunded.', zh: '已取消并退款。' },
  'success.cancelError': { ko: '취소 처리 중 오류가 발생했습니다', en: 'Error cancelling print', zh: '取消打印时出错' },

  // Donation
  'donate.defaultMsg': { ko: '즐거우셨다면 자유롭게 응원해주세요!', en: 'Enjoyed it? Support us!', zh: '觉得不错的话，欢迎支持我们！' },
  'donate.hint': { ko: '부담 없이, 마음만으로도 충분해요', en: 'No pressure, your support means a lot', zh: '心意最重要，不必有压力' },
  'donate.btn': { ko: '후원하기', en: 'Donate', zh: '打赏' },
  'donate.copy': { ko: '복사', en: 'Copy', zh: '复制' },
  'donate.copied': { ko: '복사됨', en: 'Copied', zh: '已复制' },

  // Crop editor
  'crop.title': { ko: '사진 편집', en: 'Edit Photo', zh: '编辑照片' },
  'crop.slot': { ko: '슬롯', en: 'Slot', zh: '位置' },
  'crop.confirm': { ko: '확인', en: 'Confirm', zh: '确认' },
  'crop.cancel': { ko: '취소', en: 'Cancel', zh: '取消' },
  'crop.hint': { ko: '두 손가락으로 확대/축소 · 드래그로 위치 조정', en: 'Pinch to zoom · drag to move', zh: '双指缩放 · 拖动调整位置' },
  'crop.edit': { ko: '크롭 편집', en: 'Edit Crop', zh: '编辑裁剪' },
  'crop.swap': { ko: '위치 변경', en: 'Swap Position', zh: '交换位置' },
  'crop.change': { ko: '다른 사진으로 변경', en: 'Change Photo', zh: '更换照片' },
  'crop.delete': { ko: '삭제', en: 'Delete', zh: '删除' },
  'crop.swapHint': { ko: '이동할 위치를 선택하세요', en: 'Select target position', zh: '请选择目标位置' },
  'crop.edit2': { ko: '편집', en: 'Edit', zh: '编辑' },
  'crop.swapHere': { ko: '여기로 이동', en: 'Move here', zh: '移到这里' },

  // Photo picker
  'picker.title': { ko: '사진 선택', en: 'Select Photo', zh: '选择照片' },
  'picker.new': { ko: '새 사진 추가', en: 'Add new photo', zh: '添加新照片' },
  'picker.camera': { ko: '카메라로 촬영', en: 'Take a photo', zh: '拍照' },
  'picker.album': { ko: '앨범에서 선택', en: 'Choose from album', zh: '从相册选择' },

  // Camera
  'camera.noAccess': { ko: '카메라에 접근할 수 없습니다', en: 'Cannot access camera', zh: '无法访问相机' },
  'camera.close': { ko: '닫기', en: 'Close', zh: '关闭' },

  // Puzzle
  'puzzle.label': { ko: '퍼즐 모드', en: 'Puzzle Mode', zh: '拼图模式' },
  'puzzle.sets': { ko: '퍼즐 세트 수', en: 'Puzzle sets', zh: '拼图套数' },
  'puzzle.printCount': { ko: '인쇄 수량', en: 'Print copies', zh: '打印份数' },
  'puzzle.pieces': { ko: '조각', en: 'pieces', zh: '块' },
  'puzzle.split': { ko: '조각이 각각 인쇄됩니다', en: 'Each piece prints separately', zh: '每块分别打印' },
  'puzzle.combined': { ko: '조립하면 하나의 큰 사진이 돼요', en: 'Assemble into one big photo', zh: '拼起来就是一张大照片' },

  // Preview
  'preview.title': { ko: '미리보기', en: 'Preview', zh: '预览' },
  'preview.subtitle': { ko: '확인 후 프린트하세요', en: 'Review before printing', zh: '确认后打印' },
  'preview.privacy': { ko: '업로드된 사진은 인쇄 후 최대 24시간 임시 보관 후 영구 파기됩니다.', en: 'Uploaded photos are temporarily stored for up to 24 hours after printing, then permanently deleted.', zh: '上传的照片在打印后最多保存24小时，之后将永久删除。' },

  // Errors
  'error.download': { ko: '다운로드에 실패했습니다', en: 'Download failed', zh: '下载失败' },
  'error.process': { ko: '미리보기 생성에 실패했습니다', en: 'Failed to generate preview', zh: '预览生成失败' },
  'error.print': { ko: '프린트에 실패했습니다', en: 'Print failed', zh: '打印失败' },
  'error.payment': { ko: '결제에 실패했습니다', en: 'Payment failed', zh: '支付失败' },
  'error.paymentConfirm': { ko: '결제 처리 중 오류가 발생했습니다', en: 'Error processing payment', zh: '支付处理出错' },
  'error.event': { ko: '이벤트를 찾을 수 없습니다', en: 'Event not found', zh: '未找到活动' },
  'error.layout': { ko: '레이아웃을 찾을 수 없습니다', en: 'Layout not found', zh: '未找到布局' },
  'error.pageLoad': { ko: '페이지를 불러올 수 없습니다', en: 'Failed to load page', zh: '页面加载失败' },
  'error.allPhotos': { ko: '모든 사진을 선택하고 편집해주세요', en: 'Please select and edit all photos', zh: '请选择并编辑所有照片' },
  'error.allSlots': { ko: '모든 슬롯에 사진을 추가해주세요', en: 'Please add photos to all slots', zh: '请在所有位置添加照片' },
  'error.imageProcess': { ko: '이미지 처리에 실패했습니다', en: 'Image processing failed', zh: '图片处理失败' },

  // Misc
  'misc.contact': { ko: '문의', en: 'Contact', zh: '联系方式' },
  'misc.printPreview': { ko: '프린트 미리보기', en: 'Print preview', zh: '打印预览' },
  'misc.printPhoto': { ko: '인쇄 사진', en: 'Print photo', zh: '打印照片' },
  'misc.payProcessing': { ko: '결제 처리 중...', en: 'Processing payment...', zh: '正在处理支付...' },
  'misc.payWait': { ko: '잠시만 기다려주세요', en: 'Please wait...', zh: '请稍候...' },
  'misc.copies': { ko: '매', en: '', zh: '份' },
  'misc.won': { ko: '원', en: '₩', zh: '₩' },
  'misc.set': { ko: '세트', en: 'set(s)', zh: '套' },
  'misc.total': { ko: '총', en: 'Total', zh: '共' },
  'misc.sheets': { ko: '장 인쇄', en: 'sheets', zh: '张' },
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
    if (saved && LOCALES.includes(saved)) {
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
  const nextLocale = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length]
  return (
    <button
      onClick={() => {
        const slug = window.location.pathname.split('/')[1] || ''
        trackLocaleChange(nextLocale, slug)
        setLocale(nextLocale)
      }}
      className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
    >
      {LOCALE_LABELS[nextLocale]}
    </button>
  )
}

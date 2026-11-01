export const QR_PROMO_DEFAULTS = {"title": "", "subtitle": "특별한 순간을 사진으로 남기세요", "badge": "즉석 포토 프린트", "tagline": "한정판 프레임으로 특별하게", "scan": "QR 코드를 스캔하세요", "url": "", "step1": "QR 스캔 후 프레임 선택", "step2": "사진을 올리고 편집", "step3": "결제 후 인쇄", "donation": "", "contact": "", "footer": "Photo Toast"}
export type QrPromoText = Partial<Record<keyof typeof QR_PROMO_DEFAULTS, string>>

import type { Metadata } from 'next'
import Image from 'next/image'
import QRCode from 'qrcode'
import LeadForm from './LeadForm'

// 사장님이 직접 체험해 볼 수 있는 데모 이벤트 slug. (예: /hbd)
const DEMO_SLUG = 'hbd'

const OWNER_TITLE = '생카 대관 필수 특전, 스마트 포토 인화 입점 제안 | PhotoToast'
const OWNER_DESC =
  '생카 대관에 필수라는 포토프레임. 공간 잡아먹는 부스 대신 한 켠에 쏙 들어가는 소형 스마트 인화기로, 180만 원짜리 상용 프린터를 무상 테스트해 보세요.'
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: OWNER_TITLE,
  description: OWNER_DESC,
  openGraph: {
    type: 'website',
    siteName: 'PhotoToast',
    title: OWNER_TITLE,
    description: OWNER_DESC,
    url: '/owner',
    locale: 'ko_KR',
    images: [{ url: '/logo.png', width: 1200, height: 630, alt: 'PhotoToast' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@phototoast_kr',
    creator: '@phototoast_kr',
    title: OWNER_TITLE,
    description: OWNER_DESC,
    images: ['/logo.png'],
  },
}

const reviews = [
  {
    store: '합정 A카페 사장님',
    text: '저희가 2층이라 철제 포토부스는 설치 엄두도 못 냈거든요. 이건 크기가 작아서 한 켠에 쏙 놓으면 끝이라 동선 방해도 없고 인테리어도 안 해쳐서 너무 깔끔합니다. 주최자분들도 엄청 좋아하세요.',
    tag: '2층 매장도 설치 가능',
  },
  {
    store: '홍대 B카페 사장님',
    text: '요즘 대관 문의 들어올 때 "여기 폰 사진 바로 인화하는 기계 있죠?" 하고 먼저들 물어보십니다. 이거 하나 뒀다고 다른 카페들이랑 확실히 차별화가 되네요.',
    tag: '대관 경쟁력 상승',
  },
  {
    store: '연남 C카페 사장님',
    text: '주말에 바빠 죽겠는데 기계까지 속 썩이면 답 없잖아요. 용지 떨어지거나 에러 나면 알아서 원격으로 다 처리해 주시니까 진짜로 제가 신경 쓸 게 하나도 없습니다.',
    tag: '관리 스트레스 0',
  },
]

// ── Hero 콜라주용 실제 인화물 썸네일 ──────────────────────────────
// /public/owner/ 에 넣은 결과물 이미지들. 추가/교체 시 이 배열만 수정하면 됩니다.
const OWNER_IMAGES = [
  '/owner/1.jpeg', '/owner/2.jpeg', '/owner/3.jpeg', '/owner/4.jpeg', '/owner/5.jpg',
  '/owner/6.jpg', '/owner/7.jpg', '/owner/8.jpg', '/owner/9.jpg', '/owner/10.jpg',
  '/owner/11.jpg', '/owner/12.webp', '/owner/13.jpg', '/owner/14.jpg', '/owner/15.jpg',
  '/owner/16.jpg', '/owner/17.jpg', '/owner/18.webp', '/owner/19.webp', '/owner/20.png',
]

// 카드마다 살짝 다른 회전값으로 '둥둥 떠다니는' 느낌
const ROTATIONS = [-4, 3, -2, 4, 2, -3, 3, -2, -3, 2]

function PrintThumb({ src, rot }: { src: string; rot: number }) {
  return (
    <div
      className="shrink-0 rounded-md bg-white p-1.5 shadow-2xl ring-1 ring-black/5"
      style={{ transform: `rotate(${rot}deg)` }}
    >
      <div className="relative h-36 w-24 overflow-hidden rounded-sm bg-gray-100 sm:h-44 sm:w-32">
        <Image src={src} alt="" fill sizes="128px" className="object-cover" />
      </div>
    </div>
  )
}

// 한 줄(row): 이미지 10장 세트를 두 번 이어 붙여 끊김 없이 흐르게 한다.
function CollageRow({ dir, dur, offset }: { dir: 'l' | 'r'; dur: string; offset: number }) {
  const set = Array.from({ length: 10 }, (_, i) => OWNER_IMAGES[(offset + i) % OWNER_IMAGES.length])
  return (
    <div className={`owner-row ${dir === 'l' ? 'owner-row-l' : 'owner-row-r'} gap-3 sm:gap-4`} style={{ ['--dur' as string]: dur }}>
      {[0, 1].map((copy) => (
        <div key={copy} className="flex gap-3 pr-3 sm:gap-4 sm:pr-4" aria-hidden={copy === 1}>
          {set.map((src, i) => (
            <PrintThumb key={`${copy}-${i}`} src={src} rot={ROTATIONS[i % ROTATIONS.length]} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default async function OwnerLanding() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const demoUrl = `${baseUrl}/${DEMO_SLUG}`
  const demoQr = await QRCode.toDataURL(demoUrl, { width: 480, margin: 1, errorCorrectionLevel: 'H' })

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* ───────── Section 1 · Hero (넷플릭스풍 흐르는 인화물 콜라주) ───────── */}
      <section className="relative overflow-hidden bg-[#0b1220]">
        {/* 배경: 기울인 콜라주 줄들이 좌우로 흐른다 */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 w-[160%] -translate-x-1/2 -translate-y-1/2 -rotate-6 space-y-3 opacity-70 sm:space-y-4">
            <CollageRow dir="l" dur="70s" offset={0} />
            <CollageRow dir="r" dur="90s" offset={4} />
            <CollageRow dir="l" dur="80s" offset={8} />
            <CollageRow dir="r" dur="100s" offset={12} />
            <CollageRow dir="l" dur="85s" offset={16} />
          </div>
        </div>
        {/* 가독성용 네이비 오버레이 */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(11,18,32,0.55),rgba(11,18,32,0.9))]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b1220]/80 via-[#0b1220]/55 to-[#0b1220]" />

        <div className="relative mx-auto max-w-3xl px-6 py-20 text-center sm:py-28">
          <span className="inline-block rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/90 ring-1 ring-white/15 backdrop-blur sm:text-sm">
            홍대·합정 생카 대관 카페 사장님 전용
          </span>
          <h1 className="mx-auto mt-5 max-w-[20ch] text-balance break-keep text-[26px] font-extrabold leading-tight tracking-tight text-white sm:max-w-none sm:text-4xl">
            생카 대관에 필수라는 <span className="text-indigo-300">포토프레임</span>,
            <br className="hidden sm:block" />{' '}
            비싸고 무거운 부스는 부담스러우셨죠?
          </h1>
          <p className="mx-auto mt-4 max-w-md text-balance break-keep text-sm font-medium leading-relaxed text-white/80 sm:text-base">
            대관 문의마다 “포토부스 되나요?” 묻는 주최자들.{' '}
            <span className="font-bold text-white">공간 잡아먹는 대형 부스 대신, 한 켠에 쏙 들어가는 소형 스마트 인화기로 해결하세요.</span>
          </p>
          <div className="mt-7 flex flex-col items-center gap-2.5">
            <a
              href="#apply"
              className="w-full max-w-xs rounded-xl bg-white py-3.5 text-base font-bold text-indigo-700 shadow-xl transition hover:scale-[1.02] active:scale-[0.99] sm:text-lg"
            >
              무상 테스트 / 가볍게 문의하기 →
            </a>
            <span className="text-xs text-white/70 sm:text-sm">렌탈비 0원 · 무료 베타에도 수익 20% 정산 · 부담 없이 시작</span>
          </div>
        </div>
        <div className="h-6 w-full bg-gray-50" style={{ clipPath: 'ellipse(75% 100% at 50% 100%)' }} />
      </section>

      {/* ───────── Section 2 · Problem & Need ───────── */}
      <section className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-20">
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-indigo-500 sm:text-sm">PROBLEM</p>
        <h2 className="mx-auto mt-3 max-w-[22ch] text-balance break-keep text-center text-xl font-extrabold leading-snug sm:max-w-none sm:text-3xl">
          주최자들이 1순위로 찾는 포토 특전,{' '}
          <span className="whitespace-nowrap text-indigo-600">막상 들이자니 골치 아프셨죠.</span>
        </h2>
        <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-4">
          {[
            { icon: '📦', title: '공간 부족 · 2층 매장', desc: '기계 넣으려면 테이블을 빼야 하고, 2~3층은 무거운 부스 반입부터 막막합니다.' },
            { icon: '💸', title: '부담스러운 도입 비용', desc: '유행 탈지도 모르는데 수백만 원짜리 장비를 덜컥 사기엔 위험 부담이 큽니다.' },
            { icon: '🔧', title: '귀찮은 유지보수', desc: '바쁜 와중에 용지 갈고 에러까지 직접 잡으면 본업이 방해받습니다.' },
          ].map((p) => (
            <div
              key={p.title}
              className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ring-1 ring-black/[0.02] sm:flex-col sm:items-center sm:gap-3 sm:p-6 sm:text-center"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-2xl">
                {p.icon}
              </div>
              <div className="min-w-0">
                <h3 className="break-keep text-[15px] font-bold text-gray-900">{p.title}</h3>
                <p className="mt-1.5 text-balance break-keep text-sm leading-relaxed text-gray-500">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-[26ch] text-balance break-keep text-center text-base font-semibold text-gray-700 sm:mt-10 sm:max-w-none sm:text-lg">
          그래서 포토토스트는 거대한 부스 껍데기를 버리고,{' '}
          <span className="whitespace-nowrap text-indigo-600">핵심 장비만 깔끔하게 담았어요.</span>
        </p>
      </section>

      {/* ───────── Section 3 · Tech Spec ───────── */}
      <section className="bg-gray-900 text-white">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <p className="text-center text-sm font-bold uppercase tracking-widest text-orange-400">TECH SPEC</p>
          <h2 className="mx-auto mt-3 max-w-[22ch] text-balance break-keep text-center text-xl font-extrabold leading-snug sm:max-w-none sm:text-3xl">
            대형 포토부스에 들어가는 그 장비,{' '}
            <br className="hidden sm:block" />
            상용 모델 <span className="text-yellow-300">DNP DS620</span> 그대로 씁니다.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-balance break-keep text-center text-gray-300">
            대형 브랜드 포토부스 매장에서 쓰는 180만 원대 상용 모델과 동일한 장비예요. 검색해 보시면 바로 확인되실 거예요.
          </p>

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/5 p-7 ring-1 ring-white/10">
              <div className="text-4xl font-extrabold text-yellow-300">스튜디오급</div>
              <h3 className="mt-2 text-lg font-bold">선명한 인화 품질</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                팬들이 오래 간직하는 ‘특전 굿즈’인 만큼 품질이 중요하죠. 특수 코팅으로 물과 지문에 강하고, 색감이 선명하게 인화됩니다.
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 p-7 ring-1 ring-white/10">
              <div className="text-4xl font-extrabold text-yellow-300">약 10초</div>
              <h3 className="mt-2 text-lg font-bold">빠른 인쇄 속도</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                사진을 고르고 누르면 한 장에 약 10초, 기다림 없이 나옵니다. 손님이 몰려도 줄이 길게 늘어지지 않아요.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-gradient-to-r from-indigo-600/25 to-violet-500/25 p-7 ring-1 ring-white/10">
            <h3 className="text-lg font-bold">🎨 커스텀 프레임을 쉽고 자유롭게</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              주최자가 최애 사진, 생일 날짜, 슬로건을 넣어 <b className="text-white">프레임을 직접 쉽고 자유롭게 설정</b>할 수 있어요.
              행사마다 콘셉트가 다른 생카에 맞게, 원하는 디자인으로 만들 수 있습니다.
            </p>
          </div>

          <div className="mt-5 rounded-2xl bg-gradient-to-r from-indigo-600/20 to-sky-500/20 p-7 ring-1 ring-white/10">
            <h3 className="text-lg font-bold">🛰️ 관리는 원격으로, 사장님은 편하게</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              용지 잔량 확인과 오류 대응을 원격으로 처리해 드려요. 사장님이 기계를 직접 만질 일이 거의 없습니다.
            </p>
          </div>

          <div className="mt-5 rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 p-7 ring-1 ring-white/10">
            <h3 className="text-lg font-bold">📸 생카가 없는 날에도 꾸준히</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              생일 이벤트 기간이 아니어도, 카페에 온 손님이 스마트폰 사진을 고화질로 바로 인화할 수 있어요.
              평상시에도 자연스럽게 쓰이는 작은 수익원이 됩니다.
            </p>
          </div>
        </div>
      </section>

      {/* ───────── Section 3.5 · How it works (쉽고 빠름) ───────── */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <p className="text-center text-sm font-bold uppercase tracking-widest text-indigo-500">SO EASY</p>
          <h2 className="mx-auto mt-3 max-w-[20ch] text-balance break-keep text-center text-xl font-extrabold leading-snug sm:max-w-none sm:text-3xl">
            손님은 <span className="text-indigo-600">QR 한 번</span>이면 끝.{' '}
            <br className="hidden sm:block" />
            앱 설치도, 직원 도움도 필요 없어요.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-balance break-keep text-center text-gray-500">
            폰 갤러리 사진을 그대로 인화. 누구나 30초면 손에 쥐는, 막히지 않는 흐름.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { step: '1', icon: '📱', title: 'QR 스캔', desc: '테이블 위 QR을 폰으로 찍으면 바로 접속. 앱 설치 필요 없어요.' },
              { step: '2', icon: '🖼️', title: '사진 선택', desc: '갤러리에서 원하는 사진을 고르고 프레임만 터치. 조작이 직관적이에요.' },
              { step: '3', icon: '⚡', title: '즉시 출력', desc: '버튼 한 번이면 10초 내 인화 완료. 줄 서서 기다릴 일이 없습니다.' },
            ].map((s) => (
              <div key={s.step} className="relative rounded-2xl border border-gray-100 bg-gray-50 p-6 text-center">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-3 py-0.5 text-xs font-bold text-white">
                  STEP {s.step}
                </div>
                <span className="text-4xl">{s.icon}</span>
                <h3 className="mt-3 text-base font-bold text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-9 max-w-md text-balance break-keep text-center text-lg font-semibold text-gray-700">
            쉬우니까 손님이 알아서 쓰고, 빠르니까 <span className="whitespace-nowrap text-indigo-600">회전율이 안 막힙니다.</span>
          </p>

          {/* QR 직접 체험 */}
          <div className="mt-12 flex flex-col items-center gap-6 rounded-3xl border-2 border-dashed border-indigo-200 bg-indigo-50/60 p-8 sm:flex-row sm:gap-8 sm:p-9">
            <div className="shrink-0 rounded-2xl bg-white p-3 shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={demoQr} alt="체험용 QR 코드" width={150} height={150} className="h-[150px] w-[150px]" />
            </div>
            <div className="text-center sm:text-left">
              <span className="inline-block rounded-full bg-indigo-500 px-3 py-1 text-xs font-bold text-white">
                백문이 불여일견
              </span>
              <h3 className="mt-3 text-xl font-extrabold text-gray-900">지금 폰으로 QR을 찍어보세요.</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                얼마나 쉽고 간단한지, 사장님이 직접 1분만 경험해 보세요. 손님이 겪는 화면 그대로입니다.
              </p>
              <p className="mt-3 text-[15px] font-bold leading-relaxed text-gray-900">
                <span className="text-indigo-600">QR 찍고</span> → <span className="text-indigo-600">사진 고르고</span> →{' '}
                <span className="text-indigo-600">출력 누르면 끝!</span>
              </p>
              <p className="mt-1.5 text-sm font-medium text-gray-500">
                ⏱️ 본인 스마트폰으로 직접 하니까 줄 서서 기다릴 필요 X — 30초면 인쇄 요청까지 끝납니다.
              </p>
              <a
                href={demoUrl}
                className="mt-4 inline-block rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
              >
                여기를 눌러서도 접속 가능합니다 →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Section 4 · Offer ───────── */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-center text-sm font-bold uppercase tracking-widest text-indigo-500">OFFER</p>
        <h2 className="mx-auto mt-3 max-w-[20ch] text-balance break-keep text-center text-xl font-extrabold leading-snug sm:max-w-none sm:text-3xl">
          도입이 망설여지신다면,{' '}
          <br className="hidden sm:block" />
          <span className="text-indigo-600">단기 무상 테스트</span>로 먼저 확인해 보세요.
        </h2>

        <div className="mt-10 rounded-3xl border-2 border-indigo-200 bg-white p-7 shadow-lg sm:p-9">
          <span className="inline-block rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-bold text-indigo-600">
            STEP 1 · 무료 베타테스트
          </span>
          <h3 className="mt-4 text-xl font-extrabold">딱 1회 행사, 혹은 1개월만 써보세요.</h3>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-gray-600">
            <li className="flex gap-2.5">
              <span className="mt-0.5 shrink-0 text-indigo-500">✓</span>
              <span className="break-keep">
                <b className="text-gray-900">렌탈비 0원</b> — 설치비, 렌탈비 전혀 없습니다. 실제 팬들의 반응만 편하게 확인해 보세요.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 shrink-0 text-indigo-500">✓</span>
              <span className="break-keep">
                <b className="text-gray-900">베타 기간에도 수익 20% 정산</b> — 무료로 써보는 동안에도 인쇄 매출의 20%를 그대로 정산해 드립니다. 테스트만 해도 매장에 수익이 남아요.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 shrink-0 text-indigo-500">✓</span>
              <span className="break-keep">
                <b className="text-gray-900">공간 부담 최소</b> — 부스가 아니라 작은 인화기라, 매장 한 켠이면 충분합니다. 테이블을 통째로 비울 필요가 없어요.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 shrink-0 text-indigo-500">✓</span>
              <span className="break-keep">
                <b className="text-gray-900">즉시 회수 보장</b> — 매장 운영에 조금이라도 방해가 된다면 조건 없이 바로 기기를 빼드립니다.
              </span>
            </li>
          </ul>

          <div className="mt-5 rounded-2xl bg-indigo-50 px-5 py-4 text-center">
            <p className="text-balance break-keep text-[15px] font-extrabold text-indigo-700">
              베타테스터 대상 한정<br/>렌탈비 0원 + 수익 20% 정산
            </p>
          </div>

          <div className="my-7 h-px bg-gray-100" />

          <span className="inline-block rounded-full bg-gray-900 px-4 py-1.5 text-sm font-bold text-white">
            STEP 2 · 정식 도입
          </span>
          <h3 className="mt-4 text-xl font-extrabold">월 10만 원 + 인쇄수익 20% 정산</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-baseline gap-2">
                <span className="text-base font-semibold text-gray-400 line-through">월 10만 원</span>
                <span className="text-2xl font-extrabold text-indigo-600">월 8만 원</span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                베타 참여 매장은 정식 전환 시 <b className="text-indigo-600">렌탈비 20% 할인</b>을 적용해 드려요.
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-2xl font-extrabold text-gray-900">수익의 20%</div>
              <p className="mt-1 text-sm text-gray-500">인쇄 수익의 20%를 매달 조건 없이 정산받아요.</p>
            </div>
          </div>
          <p className="mt-3 rounded-xl bg-indigo-50 px-4 py-3 text-center text-sm font-bold text-indigo-700">
            🎁 먼저 베타로 써본 사장님 혜택 — 월 10만 원이 <span className="whitespace-nowrap">8만 원으로 할인</span>
          </p>
          <p className="mt-4 text-center text-sm font-semibold text-gray-700">
            🎯 ‘스마트폰 사진 인화 되는 매장’으로 소개하면, 대관 문의에도 도움이 됩니다.
          </p>
        </div>
      </section>

      {/* ───────── Section 5 · Social Proof ───────── */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <p className="text-center text-sm font-bold uppercase tracking-widest text-indigo-500">REVIEWS</p>
          <h2 className="mt-3 text-center text-2xl font-extrabold sm:text-3xl">먼저 시작한 사장님들의 후기</h2>
          <div className="mt-10 space-y-4">
            {reviews.map((r) => (
              <figure key={r.store} className="rounded-2xl border border-gray-100 bg-gray-50 p-5 sm:p-6">
                <div className="mb-2 text-sm text-amber-400">★★★★★</div>
                <blockquote className="text-balance break-keep text-[15px] leading-relaxed text-gray-700">“{r.text}”</blockquote>
                <figcaption className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="text-sm font-bold text-gray-900">{r.store}</span>
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-600">{r.tag}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Section 6 · CTA Form ───────── */}
      <section id="apply" className="relative overflow-hidden bg-gradient-to-br from-[#0b1220] via-indigo-900 to-[#0b1220]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(129,140,248,0.18),transparent_55%)]" />
        <div className="relative mx-auto max-w-xl px-6 py-20">
          <h2 className="mx-auto max-w-[18ch] text-balance break-keep text-center text-xl font-extrabold leading-snug text-white sm:max-w-none sm:text-3xl">
            매장에 잘 맞을지 궁금하신가요?{' '}
            <br className="hidden sm:block" />
            <span className="text-indigo-300">편하게 문의 남겨주세요.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-balance break-keep text-center text-sm text-white/90 sm:text-base">
            간단한 궁금증 문의도 대환영입니다. 홍대·합정·연남 지역이시라면 제가 직접 인화된 사진 샘플을 들고 찾아뵙겠습니다.
          </p>
          <div className="mt-8">
            <LeadForm />
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 py-10 text-center">
        <p className="text-base font-bold text-gray-200">PhotoToast</p>
        <p className="mt-1 text-sm text-gray-400">&copy; {new Date().getFullYear()} 스마트 포토 인화 시스템</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          <a
            href="https://twitter.com/phototoast_kr"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-gray-300 transition hover:text-white"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            @phototoast_kr
          </a>
          <a
            href="mailto:phototoast.official@gmail.com"
            className="font-medium text-gray-300 transition hover:text-white"
          >
            phototoast.official@gmail.com
          </a>
        </div>
      </footer>
    </div>
  )
}
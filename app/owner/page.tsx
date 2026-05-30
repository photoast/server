import type { Metadata } from 'next'
import LeadForm from './LeadForm'

export const metadata: Metadata = {
  title: '생카 대관 매출 올리는 스마트 포토 인화 | PhotoToast',
  description:
    '180만 원짜리 DNP DS620 상용 프린터를 우리 매장에. 손님이 QR로 직접 출력하는 스마트 포토 인화 시스템. 무료 베타테스트(웨건 세팅 지원)로 부담 없이 시작하세요.',
}

const reviews = [
  {
    store: '합정 A카페 사장님',
    text: '쇳덩어리 포토부스는 테이블 두 개를 잡아먹어서 포기했는데, 웨건으로 먼저 써보고 바로 정식 계약했습니다. 동선 손실 0이라 너무 만족해요.',
    tag: '웨건 테스트 → 정식 계약',
  },
  {
    store: '홍대 B카페 사장님',
    text: '주최자분들이 "여기 스마트폰 사진 인화 되나요?"를 먼저 물어봐요. 이거 세팅했다고 홍보하니까 대관 문의가 확 늘었습니다.',
    tag: '대관 문의 증가',
  },
  {
    store: '연남 C카페 사장님',
    text: '용지 떨어지면 어쩌나 걱정했는데 원격으로 다 봐주시더라고요. 저는 손 하나 안 대고 인쇄 수익만 매달 정산받습니다.',
    tag: '관리 리소스 ZERO',
  },
]

export default function OwnerLanding() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* ───────── Section 1 · Hero ───────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-700 via-pink-600 to-orange-500" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,rgba(255,255,255,0.18),transparent_55%)]" />
        <div className="relative mx-auto max-w-3xl px-6 py-24 text-center sm:py-28">
          <span className="inline-block rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur">
            홍대·합정 생카 대관 카페 사장님 전용
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
            대형 포토부스에 들어가는
            <br />
            <span className="text-yellow-300">180만 원짜리 그 프린터</span>를,
            <br />
            우리 매장 테이블 위에.
          </h1>
          <p className="mt-6 text-lg font-medium leading-relaxed text-white/90">
            손님이 스마트폰 사진을 QR로 스캔해 직접 출력하는
            <br className="hidden sm:block" /> 스마트 포토 인화 시스템.
            <br />
            <span className="font-bold text-white">대관율은 올리고, 관리 부담은 0으로.</span>
          </p>
          <div className="mt-9 flex flex-col items-center gap-3">
            <a
              href="#apply"
              className="w-full max-w-xs rounded-xl bg-white py-4 text-lg font-bold text-pink-600 shadow-xl transition hover:scale-[1.02] active:scale-[0.99]"
            >
              무료 테스트 신청하기 →
            </a>
            <span className="text-sm text-white/80">설치비 0원 · 1개월 무료 베타 · 테이블 손실 없는 웨건 세팅</span>
          </div>
        </div>
        <div className="h-6 w-full bg-gray-50" style={{ clipPath: 'ellipse(75% 100% at 50% 100%)' }} />
      </section>

      {/* ───────── Section 2 · Problem & Need ───────── */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-center text-sm font-bold uppercase tracking-widest text-pink-500">PROBLEM</p>
        <h2 className="mt-3 text-center text-2xl font-extrabold leading-snug sm:text-3xl">
          포토부스 한 대 들이려다,
          <br />
          매출 나는 <span className="text-pink-600">테이블 두 개</span>를 잃고 계셨죠.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { icon: '🪨', title: '쇳덩어리 부스', desc: '거대한 부스가 테이블·동선을 통째로 잡아먹어 회전율이 떨어집니다.' },
            { icon: '😮‍💨', title: '느려터진 출력', desc: '손님이 줄 서서 기다리다 지치면, 그게 곧 매장 회전율 손실이에요.' },
            { icon: '🔧', title: '관리는 내 몫', desc: '용지 갈고, 에러 나면 달려가고… 사장님 손이 계속 묶입니다.' },
          ].map((p) => (
            <div key={p.title} className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
              <span className="text-4xl">{p.icon}</span>
              <h3 className="mt-3 text-base font-bold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{p.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-lg font-semibold text-gray-700">
          공간은 그대로, 화질은 스튜디오급. <span className="text-pink-600">둘 다 가질 수 있다면요?</span>
        </p>
      </section>

      {/* ───────── Section 3 · Tech Spec ───────── */}
      <section className="bg-gray-900 text-white">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <p className="text-center text-sm font-bold uppercase tracking-widest text-orange-400">TECH SPEC</p>
          <h2 className="mt-3 text-center text-2xl font-extrabold leading-snug sm:text-3xl">
            대형 포토부스 브랜드가 쓰는
            <br />
            바로 그 <span className="text-yellow-300">DNP DS620</span>.
          </h2>
          <p className="mt-4 text-center text-gray-300">
            인터넷에서 검색해 보세요. 대당 약 180만 원, 상용 포토부스 표준 모델입니다.
          </p>

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/5 p-7 ring-1 ring-white/10">
              <div className="text-4xl font-extrabold text-yellow-300">스튜디오급</div>
              <h3 className="mt-2 text-lg font-bold">압도적 화질</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                염료승화 방식의 초고화질 인화. 코팅까지 입혀져 물·지문에 강하고, 손님이 받자마자 인증샷을 찍게 만드는 결과물.
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 p-7 ring-1 ring-white/10">
              <div className="text-4xl font-extrabold text-yellow-300">8초대</div>
              <h3 className="mt-2 text-lg font-bold">미친 인쇄 속도</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                한 장 뽑는 데 답답함이 없습니다. 손님이 몰려도 줄이 빠지니, 매장 회전율을 갉아먹지 않아요.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-gradient-to-r from-pink-600/20 to-orange-500/20 p-7 ring-1 ring-white/10">
            <h3 className="text-lg font-bold">🛰️ 리소스 ZERO · 원격 자동 관리</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              용지 잔량 모니터링, 에러 대처, 펌웨어 관리까지 전부 원격으로 처리합니다. 사장님은 손 하나 댈 필요 없이,
              매장에 ‘되는 장비’만 놓여 있으면 됩니다.
            </p>
          </div>
        </div>
      </section>

      {/* ───────── Section 4 · Offer & Business Model ───────── */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-center text-sm font-bold uppercase tracking-widest text-pink-500">OFFER</p>
        <h2 className="mt-3 text-center text-2xl font-extrabold leading-snug sm:text-3xl">
          초기 비용 0원.
          <br />
          <span className="text-pink-600">먼저 써보고</span> 결정하세요.
        </h2>

        <div className="mt-10 rounded-3xl border-2 border-pink-200 bg-white p-7 shadow-lg sm:p-9">
          <span className="inline-block rounded-full bg-pink-100 px-4 py-1.5 text-sm font-bold text-pink-600">
            STEP 1 · 무료 베타테스트
          </span>
          <h3 className="mt-4 text-xl font-extrabold">1회 또는 1개월, 완전 무료</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-gray-600">
            <li className="flex gap-2">
              <span className="text-pink-500">✓</span> 테스트 기간 동안 <b>테이블 손실 0</b>: 전용 <b>이동식 웨건</b>으로 세팅해 드려요.
            </li>
            <li className="flex gap-2">
              <span className="text-pink-500">✓</span> 설치비·세팅비 없음. 실제 손님 반응과 인쇄 매출을 직접 확인하세요.
            </li>
            <li className="flex gap-2">
              <span className="text-pink-500">✓</span> 효과 없으면 그냥 빼면 끝. 부담이 0이니 안 할 이유가 없어요.
            </li>
          </ul>

          <div className="my-7 h-px bg-gray-100" />

          <span className="inline-block rounded-full bg-gray-900 px-4 py-1.5 text-sm font-bold text-white">
            STEP 2 · 정식 도입
          </span>
          <h3 className="mt-4 text-xl font-extrabold">월 10만 원 + 인쇄수익 20% 정산</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-2xl font-extrabold text-gray-900">월 10만 원</div>
              <p className="mt-1 text-sm text-gray-500">렌탈비. 180만 원 장비를 부담 없이.</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-2xl font-extrabold text-gray-900">수익의 20%</div>
              <p className="mt-1 text-sm text-gray-500">인쇄 매출의 20%를 매달 정산받아요.</p>
            </div>
          </div>
          <p className="mt-4 text-center text-sm font-semibold text-gray-700">
            🎯 대관 특전으로 ‘스마트폰 사진 인화 되는 매장’이라 홍보하면, 대관율 상승은 덤입니다.
          </p>
        </div>
      </section>

      {/* ───────── Section 5 · Social Proof ───────── */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <p className="text-center text-sm font-bold uppercase tracking-widest text-pink-500">REVIEWS</p>
          <h2 className="mt-3 text-center text-2xl font-extrabold sm:text-3xl">이미 시작한 사장님들</h2>
          <div className="mt-10 space-y-4">
            {reviews.map((r) => (
              <figure key={r.store} className="rounded-2xl border border-gray-100 bg-gray-50 p-6">
                <div className="mb-2 text-sm text-orange-400">★★★★★</div>
                <blockquote className="text-[15px] leading-relaxed text-gray-700">“{r.text}”</blockquote>
                <figcaption className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">{r.store}</span>
                  <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-semibold text-pink-600">{r.tag}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Section 6 · CTA Form ───────── */}
      <section id="apply" className="relative overflow-hidden bg-gradient-to-br from-purple-700 via-pink-600 to-orange-500">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.15),transparent_55%)]" />
        <div className="relative mx-auto max-w-xl px-6 py-20">
          <h2 className="text-center text-2xl font-extrabold leading-snug text-white sm:text-3xl">
            지금 신청하면,
            <br />
            <span className="text-yellow-300">무료 웨건 세팅</span>으로 시작합니다.
          </h2>
          <p className="mt-3 text-center text-white/90">
            희망 일정만 남겨주세요. 사장님 매장으로 직접 찾아가 1:1로 보여드릴게요.
          </p>
          <div className="mt-8">
            <LeadForm />
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 py-10 text-center">
        <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} PhotoToast · 스마트 포토 인화 시스템</p>
      </footer>
    </div>
  )
}

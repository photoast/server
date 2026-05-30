import type { Metadata } from 'next'
import QRCode from 'qrcode'
import LeadForm from './LeadForm'

// 사장님이 직접 체험해 볼 수 있는 데모 이벤트 slug. (예: /test)
const DEMO_SLUG = 'test'

export const metadata: Metadata = {
  title: '생카 대관 필수 특전, 스마트 포토 인화 입점 제안 | PhotoToast',
  description:
    '생카 대관에 필수라는 포토프레임. 테이블 차지 없는 전용 이동식 스탠드 세팅으로 180만 원짜리 상용 프린터를 무상 테스트해 보세요.',
}

const reviews = [
  {
    store: '합정 A카페 사장님',
    text: '저희가 2층이라 철제 포토부스는 설치 엄두도 못 냈거든요. 이건 전용 스탠드 채로 쓱 밀고 들어오니까 동선 방해도 없고 인테리어도 안 해쳐서 너무 깔끔합니다. 주최자분들도 엄청 좋아하세요.',
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

export default async function OwnerLanding() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const demoUrl = `${baseUrl}/${DEMO_SLUG}`
  const demoQr = await QRCode.toDataURL(demoUrl, { width: 480, margin: 1, errorCorrectionLevel: 'H' })

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
            생카 대관에 필수라는 <span className="text-yellow-300">포토프레임</span>,
            <br />
            비싸고 무거운 부스 들이기
            <br />
            부담스러우셨죠?
          </h1>
          <p className="mt-6 text-lg font-medium leading-relaxed text-white/90">
            대관 문의마다 "포토부스 설치 되나요?" 묻는 주최자들.
            <br className="hidden sm:block" /> 공간 차지하는 쇳덩어리 기계 대신,
            <br />
            <span className="font-bold text-white">매장 테이블 뺄 필요 없는 깔끔한 '전용 스탠드'로 해결하세요.</span>
          </p>
          <div className="mt-9 flex flex-col items-center gap-3">
            <a
              href="#apply"
              className="w-full max-w-xs rounded-xl bg-white py-4 text-lg font-bold text-pink-600 shadow-xl transition hover:scale-[1.02] active:scale-[0.99]"
            >
              무상 테스트 / 가볍게 문의하기 →
            </a>
            <span className="text-sm text-white/80">설치비 0원 · 1개월 무료 베타 · 기기 전용 스탠드 무상 대여</span>
          </div>
        </div>
        <div className="h-6 w-full bg-gray-50" style={{ clipPath: 'ellipse(75% 100% at 50% 100%)' }} />
      </section>

      {/* ───────── Section 2 · Problem & Need ───────── */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-center text-sm font-bold uppercase tracking-widest text-pink-500">PROBLEM</p>
        <h2 className="mt-3 text-center text-2xl font-extrabold leading-snug sm:text-3xl">
          주최자들이 1순위로 찾는 포토 특전,
          <br />
          막상 내 매장에 들이자니 <span className="text-pink-600">골치 아프셨을 겁니다.</span>
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { icon: '📦', title: '공간 부족 & 2층 매장', desc: '기계 넣으려면 4인 테이블을 빼야 하고, 2~3층은 무거운 부스 반입 자체가 지옥입니다.' },
            { icon: '💸', title: '부담스러운 도입 비용', desc: '유행 탈지도 모르는데 수백만 원짜리 장비나 비싼 월 렌탈비를 덜컥 감당하긴 어렵죠.' },
            { icon: '🔧', title: '귀찮은 유지보수', desc: '바빠 죽겠는데 사장님이 직접 기계 열고 용지 갈아끼우며 본업을 방해받습니다.' },
          ].map((p) => (
            <div key={p.title} className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
              <span className="text-4xl">{p.icon}</span>
              <h3 className="mt-3 text-base font-bold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{p.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-lg font-semibold text-gray-700">
          그래서 포토토스트는 거대한 부스 껍데기를 버리고, <span className="text-pink-600">핵심 인화 장비만 깔끔하게 가져왔습니다.</span>
        </p>
      </section>

      {/* ───────── Section 3 · Tech Spec ───────── */}
      <section className="bg-gray-900 text-white">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <p className="text-center text-sm font-bold uppercase tracking-widest text-orange-400">TECH SPEC</p>
          <h2 className="mt-3 text-center text-2xl font-extrabold leading-snug sm:text-3xl">
            장난감 같은 미니 프린터가 아닙니다.
            <br />
            상용 포토부스 표준 장비, <span className="text-yellow-300">DNP DS620</span>.
          </h2>
          <p className="mt-4 text-center text-gray-300">
            인터넷에서 검색해 보세요. 대형 브랜드 매장에 들어가는 180만 원대 상용 모델과 동일합니다.
          </p>

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/5 p-7 ring-1 ring-white/10">
              <div className="text-4xl font-extrabold text-yellow-300">스튜디오급</div>
              <h3 className="mt-2 text-lg font-bold">압도적 화질 보장</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                팬들이 소장하는 '특전 굿즈'인 만큼 퀄리티가 핵심입니다. 특수 코팅이 입혀져 물과 지문에 강하고, 쨍한 색감으로 인화됩니다.
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 p-7 ring-1 ring-white/10">
              <div className="text-4xl font-extrabold text-yellow-300">10초 이내</div>
              <h3 className="mt-2 text-lg font-bold">초고속 인쇄 속도</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                사진을 고르고 인쇄 버튼을 누르면 답답함 없이 바로 나옵니다. 손님이 몰리는 피크 타임에도 매장 회전율을 갉아먹지 않습니다.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-gradient-to-r from-purple-600/25 to-pink-500/25 p-7 ring-1 ring-white/10">
            <h3 className="text-lg font-bold">🎨 커스텀 프레임 무제한 · 주최자 맞춤 디자인</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              생카마다 다른 최애 사진, 생일 날짜, 슬로건까지. 프레임을 <b className="text-white">매우 쉽고 자유롭게, 행사별로 무제한 설정</b>할 수
              있습니다. 주최자가 원하는 디자인을 그대로 구현해 주니, 다른 매장은 못 따라오는 강력한 대관 특전이 됩니다.
            </p>
          </div>

          <div className="mt-5 rounded-2xl bg-gradient-to-r from-pink-600/20 to-orange-500/20 p-7 ring-1 ring-white/10">
            <h3 className="text-lg font-bold">🛰️ 리소스 ZERO · 100% 원격 무인 관리</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              시스템 에러 대처부터 용지 잔량 모니터링까지 전담 개발자가 실시간으로 원격 관리합니다. 사장님은 전원 선만 꽂아두시면 됩니다.
            </p>
          </div>
        </div>
      </section>

      {/* ───────── Section 3.5 · How it works (쉽고 빠름) ───────── */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <p className="text-center text-sm font-bold uppercase tracking-widest text-pink-500">SO EASY</p>
          <h2 className="mt-3 text-center text-2xl font-extrabold leading-snug sm:text-3xl">
            손님은 <span className="text-pink-600">QR 한 번</span>이면 끝.
            <br />
            앱 설치도, 직원 도움도 필요 없어요.
          </h2>
          <p className="mt-4 text-center text-gray-500">
            폰 갤러리 사진을 그대로 인화. 누구나 30초면 손에 쥐는, 막히지 않는 흐름.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { step: '1', icon: '📱', title: 'QR 스캔', desc: '테이블 위 QR을 폰으로 찍으면 바로 접속. 앱 설치 필요 없어요.' },
              { step: '2', icon: '🖼️', title: '사진 선택', desc: '갤러리에서 원하는 사진을 고르고 프레임만 터치. 조작이 직관적이에요.' },
              { step: '3', icon: '⚡', title: '즉시 출력', desc: '버튼 한 번이면 10초 내 인화 완료. 줄 서서 기다릴 일이 없습니다.' },
            ].map((s) => (
              <div key={s.step} className="relative rounded-2xl border border-gray-100 bg-gray-50 p-6 text-center">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-pink-500 px-3 py-0.5 text-xs font-bold text-white">
                  STEP {s.step}
                </div>
                <span className="text-4xl">{s.icon}</span>
                <h3 className="mt-3 text-base font-bold text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>

          <p className="mt-9 text-center text-lg font-semibold text-gray-700">
            쉬우니까 손님이 알아서 쓰고, 빠르니까 <span className="text-pink-600">회전율이 안 막힙니다.</span>
          </p>

          {/* QR 직접 체험 */}
          <div className="mt-12 flex flex-col items-center gap-6 rounded-3xl border-2 border-dashed border-pink-200 bg-pink-50/60 p-8 sm:flex-row sm:gap-8 sm:p-9">
            <div className="shrink-0 rounded-2xl bg-white p-3 shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={demoQr} alt="체험용 QR 코드" width={150} height={150} className="h-[150px] w-[150px]" />
            </div>
            <div className="text-center sm:text-left">
              <span className="inline-block rounded-full bg-pink-500 px-3 py-1 text-xs font-bold text-white">
                백문이 불여일견
              </span>
              <h3 className="mt-3 text-xl font-extrabold text-gray-900">지금 폰으로 QR을 찍어보세요.</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                얼마나 쉽고 간단한지, 사장님이 직접 1분만 경험해 보세요. 손님이 겪는 화면 그대로입니다.
              </p>
              <p className="mt-3 text-[15px] font-bold leading-relaxed text-gray-900">
                <span className="text-pink-600">QR 찍고</span> → <span className="text-pink-600">사진 고르고</span> →{' '}
                <span className="text-pink-600">출력 누르면 끝!</span>
              </p>
              <p className="mt-1.5 text-sm font-medium text-gray-500">
                ⏱️ 본인 스마트폰으로 직접 하니까 줄 서서 기다릴 필요 X — 30초면 인쇄 요청까지 끝납니다.
              </p>
              <a
                href={demoUrl}
                className="mt-4 inline-block rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
              >
                PC에서는 여기를 눌러 체험 →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Section 4 · Offer ───────── */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-center text-sm font-bold uppercase tracking-widest text-pink-500">OFFER</p>
        <h2 className="mt-3 text-center text-2xl font-extrabold leading-snug sm:text-3xl">
          도입이 망설여지신다면,
          <br />
          <span className="text-pink-600">단기 무상 테스트</span>로 먼저 확인해 보세요.
        </h2>

        <div className="mt-10 rounded-3xl border-2 border-pink-200 bg-white p-7 shadow-lg sm:p-9">
          <span className="inline-block rounded-full bg-pink-100 px-4 py-1.5 text-sm font-bold text-pink-600">
            STEP 1 · 무료 베타테스트
          </span>
          <h3 className="mt-4 text-xl font-extrabold">딱 1회 행사, 혹은 1개월만 써보세요.</h3>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-gray-600">
            <li className="flex gap-2.5">
              <span className="mt-0.5 shrink-0 text-pink-500">✓</span>
              <span>
                <b className="text-gray-900">테이블 손실 0</b> — 사장님 매장 가구를 건드리지 않도록, 기기를 올려둘{' '}
                <b className="text-gray-900">‘이동식 전용 스탠드(카트)’를 무상으로 빌려드립니다.</b>
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 shrink-0 text-pink-500">✓</span>
              <span>
                <b className="text-gray-900">비용 0원</b> — 설치비, 렌탈비 전혀 없습니다. 실제 팬들의 반응만 편하게 확인해 보세요.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 shrink-0 text-pink-500">✓</span>
              <span>
                <b className="text-gray-900">즉시 회수 보장</b> — 매장 운영에 조금이라도 방해가 된다면 조건 없이 바로 기기를 빼드립니다.
              </span>
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
              <p className="mt-1 text-sm text-gray-500">180만 원 고가 장비의 합리적인 렌탈비.</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-2xl font-extrabold text-gray-900">수익의 20%</div>
              <p className="mt-1 text-sm text-gray-500">인쇄 수익의 20%를 매달 조건 없이 정산받아요.</p>
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
          <h2 className="mt-3 text-center text-2xl font-extrabold sm:text-3xl">이미 검증된 대관 마케팅 무기</h2>
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
            매장에 잘 맞을지 궁금하신가요?
            <br />
            <span className="text-yellow-300">편하게 문의 남겨주세요.</span>
          </h2>
          <p className="mt-4 text-center text-white/90">
            간단한 궁금증 문의도 대환영입니다.<br />
            홍대/합정/연남 지역이시라면 제가 직접 인화된 사진 샘플을 들고 찾아뵙겠습니다.
          </p>
          <div className="mt-8">
            <LeadForm />
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 py-10 text-center">
        <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} PhotoToast · 스마트 포토 인화 시스템</p>
        <a
          href="mailto:phototoast.official@gmail.com"
          className="mt-2 inline-block text-sm font-medium text-gray-300 transition hover:text-white"
        >
          phototoast.official@gmail.com
        </a>
      </footer>
    </div>
  )
}
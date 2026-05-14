import Image from 'next/image'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="relative max-w-3xl mx-auto px-6 py-24 text-center">
          <div className="flex justify-center mb-6">
            <Image src="/logo-without-bg.png" alt="Photo Toast" width={72} height={72} className="drop-shadow-lg" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
            Photo Toast
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-white/90 font-medium leading-relaxed">
            이벤트 사진을 바로 인쇄해 보세요.<br className="sm:hidden" />
            QR 하나로 누구나 쉽게.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">이런 게 가능해요</h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {[
            {
              icon: '📸',
              title: 'QR로 간편 접속',
              desc: '게스트가 QR을 스캔하면 바로 사진을 업로드하고 인쇄할 수 있어요.',
            },
            {
              icon: '🖼️',
              title: '다양한 프레임',
              desc: '네컷, 2x2, 가로, 세로 등 원하는 레이아웃과 프레임을 자유롭게.',
            },
            {
              icon: '🖨️',
              title: '즉석 인쇄',
              desc: '사진 선택부터 크롭, 인쇄까지 한 번에. 결과물을 바로 손에 쥐세요.',
            },
          ].map((f) => (
            <div key={f.title} className="text-center space-y-3">
              <span className="text-4xl">{f.icon}</span>
              <h3 className="text-lg font-bold text-gray-900">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white border-y border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">사용 방법</h2>
          <div className="grid sm:grid-cols-4 gap-6">
            {[
              { step: '1', label: '이벤트 생성', desc: '관리자가 이벤트와 프린터를 설정합니다.' },
              { step: '2', label: 'QR 공유', desc: '게스트에게 QR 코드를 공유합니다.' },
              { step: '3', label: '사진 선택', desc: '게스트가 사진을 올리고 편집합니다.' },
              { step: '4', label: '즉석 인쇄', desc: '편집 완료 후 바로 인쇄됩니다.' },
            ].map((s) => (
              <div key={s.step} className="text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 font-bold text-lg flex items-center justify-center mx-auto">
                  {s.step}
                </div>
                <h3 className="text-sm font-bold text-gray-900">{s.label}</h3>
                <p className="text-xs text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-6 py-12 text-center">
        <p className="text-sm text-gray-400">
          &copy; {new Date().getFullYear()} Photo Toast
        </p>
      </footer>
    </div>
  )
}

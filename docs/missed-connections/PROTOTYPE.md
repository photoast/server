# 모바일 한 사이클 체험판

로컬 Next/후속 상시 배포 경로: `/missed-connections` → `/missed-connections/index.html`. 현재 모바일 확인은 아래 임시 링크를 사용한다.

기존 Next 앱의 public 정적 자산으로 제공한다. 독립 HTML 문서이므로 PhotoToast root layout/AuthProvider/GA를 실행하지 않는다. 기존 화면·API·DB·프린터 설정은 변경하지 않았다. 최초 POC는 서비스 가입/배포 분리를 위한 본 개발 구조의 대체가 아니다.

## 체험 범위

1. Landing → 성인 자가확인·로컬 처리 안내.
2. PRD의 실제 한국어12문항, 이전 질문/응답 수정·2시간 탭 draft.
3. 전면 카메라4컷(컷마다3초), 한 컷/전체 재촬영. 사진 선택 대안(한 장 반복 또는 최대4장).
4. 각 슬롯의 확대·좌우·상하 crop, 드래그·슬라이더 조작.
5. 답변 기반 본인 성향 설명. 실제 상대·확률·가짜 매칭 없음.
6. 흑백600×1800 PNG 합성·파일 저장·지원 기기 Web Share·전체/확대 보기.
7. 희망 지역/가격 선택 → 로컬 체험 티켓. **실제 예약/연락처 수집/서버 접수 아님**.

첫 화면의 ‘샘플로 빠르게 둘러보기’는 성인/안내 확인 후 고정 샘플 응답과 직접 만든 인물 그래픽을 사용한다. 직접 진행한 응답과 사진을 바꾸지 않은 경우 샘플이라는 표시를 유지한다. 홍보물·실제 참가자로 오해할 인물 데이터는 사용하지 않는다.

## 데이터·기술 경계

사진은 메모리 Blob만 사용하고 서버로 전송하지 않는다. 답변·성인 확인·질문 위치만 sessionStorage에 최대2시간 보관한다. 사진은 새로고침하면 사라지고 다시 준비하도록 안내한다. footer의 초기화는 사진·답변을 함께 지운다. 연락처·계정·분석SDK·결제·인화·외부 API·새 패키지는 없다.

재사용 출처는 `assets/app.js` 상단에 기록했다. 기존 CameraCapture/booth의 stream lifecycle과 촬영 순서, boothSamples의 Canvas cover/clip 계산을 정적 환경에 맞게 이식했다. 기존 페이지를 embed하거나 upload/merge API를 호출하지 않는다. Nanum Myeongjo는 Google Fonts의 화면 글자 서브셋으로 자체 제공하며 OFL을 동봉한다.

## 검증과 한계

검증 기록은 `public/missed-connections/poc-manifest.json`과 screenshots를 참고한다. 브라우저 모바일 viewport는 실제 iPhone Safari 검증을 대체하지 않는다. 실카메라 권한·iOS HEIC·Safari 공유 sheet·저메모리 기기는 사용자의 실제 휴대폰에서 추가 확인이 필요하다. 파일 공유 미지원은 저장으로 대체한다. 사진 선택 후 한 장만 변경해도 나머지 슬롯 URL이 유효하도록 슬롯마다 object URL을 소유한다.

로컬 확인: 기존 dev 서버에서 위 경로를 열거나 `python3 -m http.server 3019 --bind 127.0.0.1 --directory public` 후 `http://127.0.0.1:3019/missed-connections/index.html`을 연다. 카메라는 HTTPS 또는 localhost에서만 가능하다. LAN의 일반 HTTP 주소로는 카메라 권한이 안 될 수 있으므로 휴대폰은 배포된 HTTPS 링크를 사용한다.

## 공유·푸시 방식

2026-10-30 임시 체험 URL: https://f8e0c5a56e5829.lhr.life

기존 Vercel 인증이 유효하지 않아 현재 요금제를 확인하지 못했다. 무료 비용 정책에 따라 자동 배포를 유발하는 branch push/운영 배포는 수행하지 않고 `mc-prototype-20261030` 태그로 코드를 푸시한다. 기존 main·운영 설정은 그대로다. 현재 저장소에는 태그 배포용 Actions workflow가 없으며 Vercel 태그 배포는 별도 설정이 필요하다.

모바일 확인에는 localhost.run의 가입 없는 무료 HTTPS 터널을 사용한다. 포트3021은 오직 `public/missed-connections`만 제공하므로 기존 admin/API/고객 uploads를 노출하지 않는다. 선택한 사진·응답은 터널 서버로 전송하지 않는다. 계정·카드·유료 플랜·새 패키지를 추가하지 않았다. 무료 도메인은 수명/속도 제한이 있고 로컬 서버 또는 SSH가 종료되면 링크도 종료된다. 상시 배포 주소가 아니다.

상시 배포 시 Vercel 로그인/요금제·무료 한도 확인 후 feature branch를 push하고 분리된 preview에서 검증한다. 로컬 branch는 `feat/missed-connections-prototype`이다. 직접 촬영 사진은 최대2048px로 정규화하고, Nanum Myeongjo는 화면 글자만 포함한 약42KB WOFF2를 자체 제공한다. OFL을 동봉하며 런타임 외부 폰트 호출은 없다.

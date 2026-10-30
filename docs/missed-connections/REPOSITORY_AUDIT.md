# Missed Connections — 저장소 실사

- 조사일: 2026-10-30, Asia/Seoul.
- 저장소: https://github.com/photoast/server (공개 저장소), 기본 브랜치 `main`.
- 기준 커밋: `b6f26693c65a04fcf0c11e6f46fa4002e870fccc`. 조사 시작 시 로컬 HEAD와 `git ls-remote origin HEAD` 일치, 작업 트리 깨끗함.
- 실제 조사 경로: `/Users/jjj/Desktop/project/server`. 대화 작업 폴더는 Git 저장소가 아니므로 이 저장소를 조사했다.
- 이 문서의 **확인**은 코드·lockfile·GitHub API로 읽어 확인했다는 뜻이다. 실운영 DB·고객 사진·비밀값·프린터 장비는 조회하거나 실행하지 않았다. **제안**은 신규 설계, **미확인**은 증거가 없는 부분이다.
- 조사 방법: `rg --files`, `rg -n`, 소스 직접 읽기, `git` 읽기, `gh api`의 저장소/배포 이력 읽기. 서비스 실행, 패키지 설치, 인화, 마이그레이션 없이 수행했다. 신규 문서 외의 파일은 변경하지 않는다.

## 1. 구조

```text
app/
  [slug]/                 기존 행사 진입·레이아웃 선택·부스
    booth/page.tsx        자동 촬영 → 합성 → 인화
    layout/[layoutId]/    사용자가 사진을 채우는 흐름
  admin/                  행사·프린터·프레임·고객·저장소 관리
  api/                    Next Route Handlers
    layouts/merge/        Sharp 합성 + 이미지 저장
    print/                프린터 방식 선택, 작업 생성
    printer-client/       외부 프린터 클라이언트용 폴링/상태
    events/, auth/, payment/, leads/, user-events/
    keepsakes/            공유 앨범·OG
  components/             카메라, 크롭, 프레임 편집기, UI primitives
  frame-studio/, frame-proposals/, keepsake/, owner/
lib/                      Mongo 모델, 이미지 처리, 인화 어댑터, 분석
public/                   로고·폰트·샘플, uploads는 gitignore
scripts/                  수동 이미지 테스트·mock 기반 회귀 스크립트
server.js                 로컬/상주 Node용 custom Next 서버
package*.json, yarn.lock   이중 lockfile
next.config.js            Next 설정
docker-compose.yml        로컬 MongoDB 서비스
```

실제 경로: [app](../../app), [lib](../../lib), [scripts](../../scripts), [설정](../../next.config.js), [서버](../../server.js). 별도의 모노레포 workspace·공통 패키지 배포 체계·프로덕션 프린터 에이전트 소스는 이 트리에서 확인하지 못했다. 상위 `AGENTS.md`는 여행 지도 작업 지침이며 이 문서 작업과 관련된 추가 요구사항은 없다.

## 2. 스택과 의존성

근거: [package.json](../../package.json), [package-lock.json](../../package-lock.json), [tsconfig.json](../../tsconfig.json), [tailwind.config.ts](../../tailwind.config.ts).

| 영역 | 선언 범위 / lockfile 고정 버전 | 판단 |
|---|---|---|
| Next.js App Router | `^14.2.0` / 14.2.33 | `app` 페이지·layout·Route Handler, API는 대부분 Node 서버 |
| React / React DOM | `^18.3.1` / 18.3.1 | 클라이언트 카메라·Canvas UI |
| TypeScript | `^5.0.0` / 5.9.3 | `strict: true`, `@/*` 루트 alias; 일부 경계는 `any` |
| MongoDB driver | `^6.0.0` / 6.21.0 | ODM 없이 직접 컬렉션 접근 |
| Sharp | `^0.33.0` / 0.33.5 | 서버 크롭·합성·보정·이미지 인코딩 |
| NextAuth | `^4.24.14` / 4.24.14 | Google/Kakao + JWT; 기존 관리자 쿠키는 별개 |
| 편집 | `react-easy-crop`, `konva`, `react-konva`, `html2canvas` | 크롭·관리자 편집·캡처, Canvas 순수 함수 우선 재사용 |
| 포맷 | `heic2any`, `heic-convert`, `gifenc` 1.0.3 | 브라우저 HEIC/서버 HEIC/GIF Worker 존재 |
| 출력·알림 | `nodemailer`, `ipp`, `qrcode` | 실제 기본 출력 경로는 아래 참조; 설치되어 있다고 IPP 활성 경로는 아님 |
| 스타일 | Tailwind 3, CSS/CSS Module | 루트 dark-mode 상속과 브랜드 결합 주의 |

`npm run dev/start`는 `node server.js`, `build`는 `next build`, `lint`는 `next lint`. test/CI 전용 package script는 없으며 일부 UI `.stories.tsx`는 있지만 Storybook 의존성·완전한 테스트 러너 구성은 확인되지 않았다. 이번 작업에서 버전 갱신/설치/빌드를 하지 않았다.

## 3. 촬영과 4컷

| 확인한 구현 | 근거 파일·위치 | 재사용과 제약 |
|---|---|---|
| 단일 사진 카메라 | [CameraCapture.tsx](../../app/components/CameraCapture.tsx), `startCamera`, imperative `capture/toggleCamera/stop` | `getUserMedia`, ideal 1920×1080, audio false, `playsInline/muted`, 전면 촬영 mirror, JPEG .92. 기본 후면, `useI18n`에 묶임. 자동 mount 권한 요청을 신규 서비스에서는 명시적 버튼 뒤로 옮길 것 |
| 연속 촬영 | [booth/page.tsx](../../app/[slug]/booth/page.tsx), `openCamera:201`, `captureNextPhoto:266`, `captureSequence:322` | 컷 수는 슬롯/쌍둥이 슬롯 계산으로 결정, 3~15초 타이머, 슬롯 종횡비 중앙 크롭, 셔터음·정지 화면 1.2초. **항상 4컷인 범용 훅이 아니며** 신규 4슬롯 descriptor가 필요 |
| 합성과 복구 | 같은 파일 `composePhotos:227`, `finishCapture:246` | 촬영 결과를 data URL로 메모리에 보관, `/api/layouts/merge`로 업로드. 실패 시 `compose-error`에서 같은 사진 재시도. 새로고침 후 사진 복원은 아님 |
| 세션 종료 | 같은 파일 `startAgain`, `RETURN_TIMEOUT_SECONDS`, done/preview effect | 60초 자동 초기화는 행사 키오스크용. 광고 체험에 그대로 쓰면 결과 유실 발생 |
| 카메라 피드백 | [boothCaptureSound.ts](../../lib/boothCaptureSound.ts) | 사용자 gesture 기반 Web Audio 해제, 소리 실패는 화면 피드백으로 대체 가능 |
| 슬롯별 크롭 | [FrameUserEditor.tsx](../../app/components/FrameUserEditor.tsx), [FourCutCropEditor.tsx](../../app/components/FourCutCropEditor.tsx), [useSlotPhotoCrop.tsx](../../app/components/useSlotPhotoCrop.tsx), [PoolPhotoCropDialog.tsx](../../app/components/PoolPhotoCropDialog.tsx) | crop/zoom/rotation, object URL 해제, 기존 크롭 복원 일부 존재. `FrameUserEditor`는 기존 GA·i18n·merge API에 결합. UI 전체 복사 대신 계산/동작을 분리 |
| HEIC 업로드 대안 | [[slug]/page.tsx](../../app/[slug]/page.tsx), `compressImage:701`; [process-image API](../../app/api/process-image/route.ts) | 브라우저 `heic2any` 동적 import 및 2048px 축소, 서버 `heic-convert`. P1은 로컬 경로만 후보; 변환 실패 시 JPG 안내 |

미확인: Safari 기종별 카메라 화각/실해상도, 인스타그램 인앱 브라우저, 백그라운드 복귀 안정성, 저메모리 iPhone에서 연속 4컷·HEIC 대용량. 코드의 ideal 설정은 하드웨어 보장값이 아니다. IndexedDB 사진 draft 복원 구현은 검색에서 확인되지 않았다.

## 4. 프레임·Canvas·이미지 생성

- [types.ts:5](../../lib/types.ts): 2×6=`600×1800`, 4×6=`1200×1800`, 6×4=`1800×1200`; `PhotoSlot`은 좌표·크기·회전·zIndex, `FrameLayer`는 이미지·불투명도·위치·표시 여부.
- [boothSamples.ts:46](../../lib/boothSamples.ts)의 `renderLayoutPreviewCanvas`: 클라이언트 Canvas, 레이어 z 정렬, cover 크롭, clip, rotation/opacity. 반환이 Canvas이므로 **PNG 로컬 `toBlob`에 적합**. 같은 파일의 `uploadSampleCanvas/composeTestPreview`는 업로드 부작용과 1600px preview 제한이 있어 P1에서 호출하지 않는다.
- [layouts/merge API](../../app/api/layouts/merge/route.ts): FormData 사진+crop 좌표, Sharp 합성, `jpeg({quality:95})`, `uploadToBlob`. PNG가 기본이 아니며 P1 local-first와 맞지 않는다. 프레임 로드 실패를 skip하는 분기가 있어 새 서비스는 누락 프레임을 조용히 출력하지 않는 정책이 필요하다.
- [image.ts](../../lib/image.ts)의 `processImage` 등: 레거시 single/four-cut/two-by-two 합성. 신규 슬롯 기반 캔버스와 두 가지 시스템이 공존한다. 4컷 처리 자산은 존재하지만 모든 기능이 하나의 재사용 SDK로 묶인 상태는 아니다.
- [imageProcessing.ts](../../lib/imageProcessing.ts): 색상/투명 영역 탐지 등 프레임 제작 보조. [weddingFrames.ts](../../lib/weddingFrames.ts), [textOverlay.ts](../../lib/textOverlay.ts), [setupFonts.ts](../../lib/setupFonts.ts): SVG/문자·로컬 폰트 출력 참고. 웨딩 디자인·카피 자체는 신규 브랜드에 재사용하지 않는다.
- 흑백: [instagramFrame.ts](../../lib/instagramFrame.ts)에 `.grayscale()`는 있으나 프레임 추출 처리의 일부다. 신규 촬영 전 과정에서 검증된 공통 흑백 필터라고 간주하지 않는다. Canvas pixel grayscale 파이프라인은 신규 정의한다.
- [preparePoolPhoto.ts](../../lib/preparePoolPhoto.ts), [boothRandomPreviews.ts](../../lib/boothRandomPreviews.ts), [renderRandomBoothPreviews.ts](../../lib/renderRandomBoothPreviews.ts): 등록 사진/슬롯으로 랜덤 합성 가능. **실제 매칭 엔진이 아니다**. 가짜 상대 생성에 사용 금지.
- [keepsake 페이지](../../app/keepsake/[token]/page.tsx), `save:55`: 파일 Web Share 지원 탐지, 다운로드 fallback 참고. gesture 뒤 비동기 fetch가 있어 iOS transient activation 소실 위험; 신규 흐름은 파일을 미리 만들고 공유 버튼에서 즉시 호출한다.
- [keepsakeGif.ts](../../lib/keepsakeGif.ts), [Worker](../../lib/keepsakeGif.worker.ts): 로컬 이미지 가공·취소·자원 해제 구조 참고. Phase 1 최초 광고 출시 필수 범위 밖이며, P1 개선 이슈로만 제안한다.

## 5. 출력과 DNP DS620

**확인된 것은 범용 서버 작업 큐와 Epson 경로이며, DS620 전용 드라이버가 아니다.**

| 경로 | 실제 구현 | 신규 서비스 판단 |
|---|---|---|
| `POST /api/print` | [route.ts:31](../../app/api/print/route.ts): 행사→현재 printer, 수량 1~10, 인증코드, `test/polling/epson_api/email` 분기 | 서버 orchestration 자산 재사용 가능. 참가자 동의/매칭 권한·idempotency가 추가된 별도 어댑터 필요 |
| test | 같은 파일 151 이후: 물리 출력 없이 DONE 기록 | 기능 테스트용. 실제 인화 성공 지표에서 반드시 제외 |
| polling | 같은 파일 168 이후: 이미지 준비·보정·업로드→PENDING | DS620의 유력 연결 지점. 브라우저 직접 USB가 아님 |
| 2×6 변환 | 같은 파일 178 이후: 한 스트립을 두 장 나란히 배치; [jobs API:30](../../app/api/printer-client/jobs/route.ts) 2×6→4×6 paperSize | 한 용지의 **동일 사진 2매**가 현재 동작. 서로 다른 사람의 프레임 두 장을 인쇄하는 로직은 별도 설계 필요 |
| 작업 조회/완료 | [jobs GET](../../app/api/printer-client/jobs/route.ts), [job PATCH](../../app/api/printer-client/jobs/[jobId]/route.ts), [status POST](../../app/api/printer-client/status/route.ts) | Bearer 키로 프린터 조회, printerId 소유 검증, PRINTING/DONE/FAILED, heartbeat. GET은 작업을 원자적으로 claim하지 않아 이중 수신 위험 |
| 키 인증 | [printer-auth.ts](../../lib/printer-auth.ts), [models.ts](../../lib/models.ts) | printer document의 API key 조회. phase2는 해시/회전/최소권한 검토 |
| Epson 경로 | [printer.ts](../../lib/printer.ts)→[email-printer.ts](../../lib/email-printer.ts), [epson-api.ts](../../lib/epson-api.ts) | `ipp` 설치나 [printer-utils.ts](../../lib/printer-utils.ts) 존재만으로 IPP 활성 연동으로 판단 불가 |
| 보정 | [image-correction.ts:30](../../lib/image-correction.ts) | shrink·vertical offset 재사용, 장비별 실제 테스트 필요 |

`app/owner/page.tsx:187`에 **DNP DS620** 마케팅 문구가 있다. 그러나 이 저장소에는 DS620 SDK·USB spooler·Windows/CUPS 에이전트 구현이 없다. 사용자가 DS620을 사용했다는 대화 이력과 서버 코드 확인은 별개의 증거다. OS 드라이버 버전, 2×6 절단, USB 연결, 실제 출력 완료 검출 및 macOS Apple Silicon 호환성은 미확인이다. 행사 전 외부 인화 클라이언트 저장소/설치 문서와 실장비 검증이 필요하다.

`SEND_PRINTER=false`는 [email-printer.ts:18](../../lib/email-printer.ts)에서 SMTP 전송을 건너뛰는 스위치다. **polling/epson_api 전체를 막는 전역 안전장치가 아니다**. 이번 조사에서는 어떤 인화 API도 호출하지 않았다.

## 6. DB·스토리지·서버

- [mongodb.ts:46](../../lib/mongodb.ts): `MONGODB_URI`로 연결하되 `client.db('photoast')`가 고정. 신규 DB명을 URI만 바꿔도 자동 분리된다고 가정하면 안 된다. 컬렉션·모델과 DB provider 분리가 필요하다.
- [models.ts](../../lib/models.ts): 행사·레이아웃·출력·사용자·인증코드·오류·방문 등 직접 CRUD. [memorydb.ts](../../lib/memorydb.ts)는 별도 파일이지 현재 `models.ts`의 Mongo 장애 자동 fallback 증거가 아니다.
- [mongodb.ts:56](../../lib/mongodb.ts): 인덱스 초기화 함수에 `userEvents` 30일 TTL 존재. **사진/연락처 전체의 자동 삭제 구현은 아니다**. 이번에는 함수를 실행하지 않았다.
- [blob.ts:5](../../lib/blob.ts): 실제 토큰 변수는 `phototoast_READ_WRITE_TOKEN`; `.env.example`의 `BLOB_READ_WRITE_TOKEN`과 다르다. `put(access:'public')` 또는 `public/uploads`를 사용. 새 서비스의 비공개 사진 저장소로 그대로 사용 불가.
- [image.ts:926](../../lib/image.ts): 업로드 저장은 `uploadToBlob`에 위임. README의 “Vercel이면 항상 /tmp” 설명과 현재 코드가 다르다. **소스를 우선**한다. 토큰 없는 Vercel 읽기 전용 파일시스템에서 public 쓰기는 위험하다.
- [docker-compose.yml](../../docker-compose.yml)은 MongoDB 7 서비스만 정의; Node 웹앱·프린터·프로덕션 배포 전체를 정의하지 않는다.
- [server.js](../../server.js)는 PORT/HOSTNAME custom HTTP 서버. Vercel이 이 custom server를 그대로 실행한다는 뜻은 아니다.

## 7. 인증·데이터 안전성

| 확인 | 근거 | 신규 제품에 미치는 영향 |
|---|---|---|
| OAuth + JWT 사용자 세션 | [authOptions.ts](../../lib/authOptions.ts), [NextAuth route](../../app/api/auth/[...nextauth]/route.ts), [AuthProvider](../../app/components/AuthProvider.tsx) | provider·브랜드·DB가 기존 서비스에 결합. MC 전용 세션/식별자로 분리 |
| 정적 관리자 쿠키 | [auth/login:27](../../app/api/auth/login/route.ts), [middleware.ts:3](../../lib/middleware.ts) | cookie 값 `authenticated`만 비교. HttpOnly/Secure가 있어도 서버 검증 서명/세션 저장이 없어 위조된 Cookie 헤더를 신뢰할 위험. MC 관리자에 복사 금지 |
| 사진 업로드 공개 경계 | [upload route](../../app/api/upload/route.ts) | 파일 MIME 문자열 검사 외 인증·엄격한 byte/픽셀 상한이 route에서 확인되지 않음. 비공개 참가자 업로드 API와 별개로 다룰 것 |
| 범용 URL 읽기 | [blob.ts:41](../../lib/blob.ts), [merge fetchBuffer](../../app/api/layouts/merge/route.ts) | URL/로컬 경로 허용. 신규 API는 사용자 입력 URL을 받지 말고 소유한 assetId만 사용; SSRF·경로 검증 필수 |
| 출력 요청 권한 | [print route:78](../../app/api/print/route.ts) | 일반 요청은 slug/imageUrl과 선택적 authCode 중심. 해당 match·participant·layout 소유·결제 상태를 모두 보장하는 계약이 아님 |
| 공개 결과 조회 | [job GET:5](../../app/api/print-jobs/job/[jobId]/route.ts) | ID만으로 24시간 이내 이미지·paymentTid를 반환. 만료는 저장소 파일 삭제가 아님. 타인의 매칭 결과 조회에 재사용 금지 |
| 분석/삭제 API | [user-events route](../../app/api/user-events/route.ts) | 조사한 POST/GET/DELETE에 관리자·소유자 인증 검사가 없다. arbitrary params 저장/클라이언트 ID 기반 삭제를 새 서비스로 전용 금지 |
| 리드 접수 | [leads.ts:57](../../lib/leads.ts), [leads route:29](../../app/api/leads/route.ts) | DB 저장 실패를 catch 후 반환하는 구조. 신규 waitlist는 durable insert 성공 전 success 표시 금지 |

이는 정적 조사 발견사항이며 실제 악용을 시험한 결과는 아니다. 기존 서비스를 이번 작업에서 수정하지 않는다. 신규 서비스 출시 게이트로 분리한다.

## 8. 배포 환경 — 확인 수준

GitHub API 읽기 증거(2026-10-30):

- 저장소 `homepage`: `https://server-eight-tau-94.vercel.app` — 메타정보이지 현재 production alias 보장은 아님.
- 최근 Production deployment ID `7297771208`, ref=기준 커밋, created_at=`2026-10-24T11:07:42Z`.
- 최신 status=`success`, `environment_url=https://server-8vyycb6sp-unify-fe0ab4c6.vercel.app`, description=`Deployment has completed`.
- 읽은 엔드포인트: `repos/photoast/server`, `repos/photoast/server/deployments?per_page=3`, `repos/photoast/server/deployments/7297771208/statuses?per_page=1`.

따라서 **Vercel Production 성공 배포 이력은 확인**했다. 현재 DNS/커스텀 도메인 라우팅, 프로덕션 환경변수, Mongo Atlas 실제 플랜·리전, Blob ACL/보관 정책, 프린터 PC가 현재 접속 중인지, 전체 기능 정상 가동은 미확인이다. 대화에 등장한 도메인만으로 현 배포를 단정하지 않는다. `.github` 배포 workflow·Vercel 프로젝트 설정 파일은 조사 트리에서 확인하지 못했다.

## 9. 재사용 결론

| 판정 | 대상 |
|---|---|
| 우선 분리·재사용 | 슬롯 타입/규격, Canvas 합성, crop 좌표/회전, 카메라 stream lifecycle·셔터음, 프린터 보정 계산 |
| 어댑터 필요 | 연속 촬영 페이지, `FrameUserEditor`, HEIC 변환, UI primitives, print orchestration, Mongo 연결, 파일 저장, NextAuth |
| 구조 참고만 | owner 영업 폼, gtag/user-events, 웨딩 앨범의 저장/공유·OG 구조 |
| 복사 금지 | 정적 admin cookie, 공개 사진 URL·ID-only 결과 접근, raw 행동 로그/PII 알림, 브랜드 로고·기존 GA ID·결제 키 기본값 |
| 신규 | 12문항/점수, 안전한 익명 세션·waitlist, 동의 원장, 참가자/매칭/1:1 원자성, 비공개 asset과 삭제, 광고 퍼널 |

## 10. 후속 검증 목록

1. 외부 프린터 agent 위치·코드·OS·DS620 드라이버/절단 설정 확보와 테스트 프린트.
2. 안전한 별도 MC host/runtime/DB 연결 확정; 기존 production와 인증/분석/스토리지 격리.
3. iPhone 실기기 Safari/Instagram 인앱, 업로드 HEIC, 저메모리·저장·공유 QA.
4. 코드 공급망·Next.js 보안 업데이트는 **별도 작업**으로 검토; 이 실사에서 현재 버전이 최신/취약점 없음이라고 보장하지 않는다.
5. 기존 유닛/mock 스크립트가 실제 장비 E2E를 대체하지 않음. 이번 문서 작업에서는 코드 테스트나 장비 테스트를 새로 실행하지 않았다.

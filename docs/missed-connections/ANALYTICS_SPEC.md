# Missed Connections — 분석·광고 검증 명세

버전 1.0 · 2026-10-30 · 신규 계약 제안. 아래 KPI는 시장 실적이 아닌 **검증 가설**이다. 기존 [gtag.ts](../../lib/gtag.ts)·[user-events API](../../app/api/user-events/route.ts)를 그대로 호출하지 않는다. 기존 GA 속성/PhotoToast 식별자와 섞지 않고 독립 endpoint·저장소·동의 체계를 사용한다.

## 1. 측정 원칙과 모집단

1. P1 결과는 `mode=demo`이며 실제 매칭 수를 보고하지 않는다. fake person/임의일치율/허위희소성 이벤트 없음.
2. 사진·파일명·raw 퀴즈 답·벡터·성별 선호·연락처·서명 URL·IP 원문·입력 텍스트를 이벤트에 넣지 않는다. 값은 enum/범위 숫자 중심 allowlist.
3. 선택적 분석 동의 전에는 분석 쿠키/지속 식별자 생성·분석 API/GA/Meta Pixel 요청을 하지 않는다. 진입 시각/UTM은 동의 선택 전 메모리에서만 잠깐 보존하고, 거부하면 폐기한다. 필요한 서버 신청/동의 기록은 별도 서비스 처리 근거로 저장하고 분석 이벤트로 위장하지 않는다.
4. **퍼널은 분석 동의 코호트**다. 사후에 동의한 세션은 메모리의 landing/start 기록을 `consentGrantedAt`과 함께 flush 할 수 있으나 거부 후 과거 기록을 복원하지 않는다. 단계별로 중간 동의가 발생하면 `entryStage`로 구분하고 full-funnel에서는 landing 부터 기록된 세션만 비교한다. 동의 선택률과 단계별 측정 가능 표본을 함께 보고한다.
5. 신청 성공 건수는 서버 unique insert를 기준으로 한다. 선택 분석 미동의 신청도 운영상 신규 신청 집계에는 포함되지만, 개인 퍼널·UTM과 조인하지 않는다. “전체 신청/동의 세션 landing”을 전환율로 계산하지 않는다.
6. 캠페인 귀속 CPL은 동의한 attribution으로 확인된 신규 유효 신청만 분모. 광고 전체 CPL의 정확값이라고 부르지 않는다. 별도 광고 전용 모집 campaignId를 쓰면 총 신청 기반 운영 지표도 보고할 수 있으나 organic/공유 유입 혼입을 밝혀야 한다.
7. 광고 노출·클릭·지출은 광고 플랫폼 집계, landing/event는 자체 집계. 광고 클릭과 웹 세션은 동일 단위가 아니며 누락/중복·동의 편향을 명시한다. 세션 미관측을 이탈로 채우지 않는다.

## 2. 식별·중복·시간 규칙

- `eventId`: 브라우저/서버에서 UUID, 네트워크 재시도에도 유지. unique index 로 dedupe, raw TTL30일. 적어도 한 번 전송을 가정하며 exactly-once 전송이라 주장하지 않는다.
- `anonymousSessionId`: 동의 후 난수, 30분 비활동 후 새 분석 세션. 기기 fingerprint/장기 광고 ID 없음. `flowId`는 체험 한 회차, 2시간 TTL; 로컬 기능용 ID는 동의 전 서버 전송 금지.
- `quizAttemptId`, `captureAttemptId`, `stripRevision`: 같은 flow의 편집·재촬영 구분용 난수/증분. ID는 권한 토큰이 아니며 다른 사용자의 결과 접근에 쓰지 않는다.
- 서버 `receivedAt` 기준 보고, `occurredAt`은 진단용(서버와 ±24시간 이상이면 거부/보정 표기). timestamp UTC, 운영 일자 Asia/Seoul, 보고창/시간대를 export에 명시.
- semantic dedupe: `landing_view` 세션+entry1회, `start_click` 첫 클릭, quiz/capture complete는 flow의 최초유효완료1회, strip revision 여러번이어도 flow KPI는1회. raw 반복 이벤트는 재편집 분석용으로 보존.
- 접수 conversion은 `campaignId+emailLookupHmac` 신규 canonical 신청1회. 중복 receipt·reload·retry·success 화면 방문·재신청 편집은 신규 전환0건. 철회 후 재신청은 운영 재신청 수로 분리하고 개인정보 보관 정책 범위 안에서만 중복 판별한다.
- internal QA는 `environment=development|preview|production`와 서버발행 `isInternal=true`로 구분, KPI는 production·noninternal만. 사용자가 query 로 internal=false 조작해 QA 세션을 운영 전환으로 바꾸지 않음. test print는 physical counts 제외.

## 3. 이벤트 envelope와 수집 API

```json
{
  "events": [{
    "eventId": "uuid",
    "name": "mc_capture_completed",
    "occurredAt": "2026-10-30T03:00:00.000Z",
    "anonymousSessionId": "random",
    "flowId": "random",
    "screen": "photo_capture",
    "mode": "demo",
    "release": "mc-web-0.1.0",
    "consentVersion": "analytics-v1",
    "properties": {"source":"mixed","shotCount":4,"durationBucket":"30_59s"}
  }]
}
```

`POST /api/mc/v1/analytics/batch`는 동의한 세션에 묶어 검증한다. 최대20개/64KB, enum 외 name/property 거부, 문자열 일반최대64자(UTM 별도100자), 숫자 finite·정해진범위. sessionId/flowId 소유권은 서버 세션과 binding, 타인 ID 제출 불가. 202 accepted/duplicate ID 목록; schema422,미동의403,429 Retry-After. 일부 잘못된 배치는 전체거부해 잘못된 필드를 조용히 수집하지 않는다.

전송은 5개 또는5초마다 batch, pagehide에서는 지원되는 beacon/keepalive best-effort. 메모리 queue 최대100개/15분, 재시도1·2·4초+최대3회,429는 Retry-After 준수. 서비스 UI를 차단하지 않으며 실패 유실률을 서버 수신 로그/내부 QA 로 확인한다. **사진이나 신청 본문을 offline analytics queue 로 저장하지 않는다.** 동의 철회 시 queue 폐기·신규전송중단, session cookie/식별자와 기존 raw 삭제 방법 안내. 철회 사실을 기록하는 서비스 동의 endpoint는 분석 endpoint와 분리한다.

공통 server-enriched 속성: `receivedAt,environment,isInternal,campaignId,deviceClass=mobile|tablet|desktop|unknown,browserFamily=safari|chrome|in_app|other|unknown,entryStage`. 전체 UA 원문 장기저장 안 함. 클라이언트 `mode`는 config와 비교하며 P1은 항상 demo. 유입 캠페인은 client가 임의매칭 eventId/권한을 바꾸는 수단이 아니다.

## 4. Phase 1 이벤트 사전

화면 `landing/onboarding/personality_quiz/photo_capture/match_reveal/photo_strip/waitlist/waitlist_success`. 표의 emit 기준이 실제 전환 정의이며 button 노출/비동기 시작을 완료로 간주하지 않는다. 아래 선택 분석 이벤트는 동의한 경우에만 전송한다.

| 이벤트 | 발생 시점 / 발행자 | 추가 속성 allowlist | 중복/판정 |
|---|---|---|---|
| `mc_landing_view` | 랜딩 visible1초 또는 먼저 CTA 클릭 / client | entryType=ad/direct/shared, consentDeferred:boolean | 세션 entry1회, 동의 후 flush는 deferred=true |
| `mc_start_click` | primary 체험 시작 클릭 / client | from=landing/resume | flow 최초; double click1회 |
| `mc_onboarding_view` | 필수 안내 렌더 / client | policyVersion | flow1회 |
| `mc_onboarding_complete` | 필수성인/서비스체크 통과 / client | analyticsAllowed:boolean | flow1회; 분석거부는이벤트자체전송안함 |
| `mc_age_gate_exit` | 대상아님 선택 / client | 없음 | 동의 없으면 수집안함. 거부자나미성년수추정근거로쓰지않음 |
| `mc_analytics_consent_update` | 선택 동의 허용 완료 / client | allowed=true, policyVersion | 철회는필수 동의원장만,철회후이벤트전송하지않음 |
| `mc_quiz_started` | Q01최초 표시 / client | questionVersion,quizAttemptId | flow 당최초 |
| `mc_question_view` | 현재문항 표시 / client | questionId,order1..12,questionVersion | attempt+question+navigationIndex 로반복구분 |
| `mc_question_answered` | 선택값 유효로 저장 / client | questionId,changed:boolean,questionVersion | **value 제외**; 수정은 changed=true |
| `mc_quiz_completed` | 정확12개검증·profile 계산성공 / client | questionVersion,durationBucket,quizAttemptId | flow 최초 KPI,revision은 추가진단 |
| `mc_capture_view` | capture/대체입력 화면 표시 / client | captureAttemptId | flow 최초 KPI |
| `mc_camera_permission_result` | getUserMedia 성공/실패/취소 / client | outcome=granted/denied/unavailable/busy/unsupported/timeout/cancelled, facing=front/back | 요청당1회; 브라우저 error 원문없음 |
| `mc_capture_shot` | 한컷 Blob decode 검증 완료 / client | slotIndex0..3,source=camera/upload,captureAttemptId | slotrevision 별; 원본파일명/URI 없음 |
| `mc_capture_completed` | 4장 검토확정 / client | shotCount=4,source=camera/upload/mixed,durationBucket | flow 최초 KPI; 단순4번째셔터아님 |
| `mc_retake` | 특정컷/전체 재촬영 선택 / client | scope=single/all,slotIndex(optional) | 빈 thumbnail 클릭제외 |
| `mc_capture_error` | 회복안내 표시 / client | code=permission/decode/too_large/memory/stream/canvas/unknown,stage | rawexception 없음,동일오류5초 dedupe |
| `mc_result_view` | 본인설명/DEMO 표시 / client | resultKind=self_profile,questionVersion | flow 최초,mode=demo |
| `mc_strip_ready` | font+4장+Canvas→PNG 완료·미리보기 표시 / client | frameVersion,filterVersion,width=600,height=1800,stripRevision | export 실패 시 발행하지 않음 |
| `mc_download_requested` | 준비된파일 저장 명령 / client | format=png,stripRevision | 저장시도이며기기저장확정아님 |
| `mc_share_attempt` | canShare 통과 후 share 호출 / client | method=web_share_file,stripRevision | attemptID 별 |
| `mc_share_api_resolved` | share promise resolve / client | method=web_share_file | recipient 수신/게시 성공증거아님 |
| `mc_share_cancelled` | share AbortError / client | method=web_share_file | 오류율제외 |
| `mc_share_fallback` | share 미지원/실패 후 download/linkcopy 제공 / client | reason=unsupported/blocked/error,method=download/link_copy | 링크복사와파일공유구분 |
| `mc_waitlist_open` | 신청화면 렌더 / client | from=landing/reveal/strip | flow/entry 별,직행도별도코호트 |
| `mc_waitlist_submit` | valid form POST 시작 / client | from,submissionAttemptId | **email/region/price 제외**; 실제선택분포는신청 DB 집계 |
| `mc_waitlist_submit_error` | 신청 실패 안내 / client | code=validation/rate_limited/unavailable/network/unknown, retryable:boolean | rawresponse/body 없음 |
| `mc_waitlist_success_view` | owner receipt 확인후 성공 UI / client | receiptKind=request_received | UI 이벤트만,신규 리드아님 |
| `mc_restart` | 명시초기화 실행 / client | from | 이전 flowID 폐기,사진/답변삭제 |
| `mc_flow_error` | capture 외 회복 오류 / client | stage,code=asset/font/render/api/storage/unknown | 원문로그/입력금지 |

`mc_quiz_abandoned`는 클라이언트 전송 이벤트가 아니라 **분석 쿼리의 파생 상태**: 마지막 quiz 이벤트 이후30분간 quiz_complete/다른활동 없음. 브라우저 종료 감지 성공을 가정하지 않는다. 마찬가지로 capture abandonment는 해당 세션의 관측 종료 후 계산한다.

서버 fact/outbox (비선택 서비스 작업과 분석용 projection을 구분):

| 사실 | 진실의 원천 | 분석 사용 |
|---|---|---|
| `mc_waitlist_created` | canonical WaitlistApplication unique insert commit | 전체 신규 신청 운영집계는 DB에서 가능. 선택 analytics 로발행/flow 조인은해당동의가있는경우만. eventId는 내부신청 ID 기반 dedupe,외부에 PII/HMAC 전달안함 |
| `mc_waitlist_duplicate_received` | 신규 insert 아닌접수 | 운영악용/재시도집계만, 신규 conversion0. public 응답엔구분없음 |
| `mc_waitlist_deleted` | 실제삭제완료 | 개인정보 식별자 없는 일별 삭제 건수, 과거 raw flow를 조인해 되살리지 않음 |

## 5. Phase 2 이벤트 사전 (P2 출시 시 도입)

민감한 이용 행위의 상세 추적은 동의·법무 검토가 선행이다. 운영에 필수인 상태 DB와 선택 분석을 구분하며, 일반 분석에는 participantId/matchId/contact 대신 비식별 집계를 사용한다.

| 이벤트 | 서버 사실 | 주요 집계 |
|---|---|---|
| `mc_participant_checked_in` | 운영자 성인 확인+체크인 commit | 등록→체크인, 행사 일별 |
| `mc_match_waiting` | round commit 후 대기 | 사유=conditions/capacity/odd_count/no_candidate/timeout; 소수 cell은 내부 한정 |
| `mc_match_offered` | pair 예약 성공 | 매칭 제안 수와 고유 참가자 수 분리 |
| `mc_photo_consent_saved` | 목적별 동의 원장 갱신 | allow/revoke 집계, 타인의 동의 여부 공개 없음 |
| `mc_like_saved` | 본인 reaction commit | like/pass 운영 집계만, 개인별 성향 광고 분석 금지 |
| `mc_mutual_match` | 양측 like 최초 충족 | pair당 1회, 연애 성공/실제 만남 확정 아님 |
| `mc_contact_exchange_enabled` | mutual+양측 교환 동의 | 연락처 값 없음 |
| `mc_print_requested` | idempotent print job 생성 | sheets/strips/test/production/evidence 구분 |
| `mc_print_status_changed` | 유효 lease의 상태 변경 | previous/status/errorCode/latency bucket, URL 없음 |
| `mc_print_reprint_requested` | 운영자 실물 확인 후 attempt 추가 | 원 촬영 수는 증가하지 않음, 재출력 사유 집계 |
| `mc_data_deletion_completed` | object+DB+spool 정리 완료 | 처리 시간·SLA 준수, 삭제 대상 식별자 없음 |

재생성한 strip/재출력은 새 Participant/PhotoSession 촬영으로 집계하지 않는다. `DONE`이 agent_ack 수준이면 “전송 완료”로 표시하고 물리 수령률은 계산하지 않는다. 실제 만남 수는 당사자의 선택적 확인 또는 staff 관측 정의를 정하기 전에는 미관측이다.

## 6. UTM·귀속 계약

- 입력: `utm_source,utm_medium,utm_campaign,utm_content,utm_term`. 필드당 최대100자, 문자 allowlist, decode 1회. `utm_term`은 개인정보 유입 위험 때문에 기본 미수집이며 승인된 광고 키워드 enum만 예외다. 캠페인 allowlist 밖 값은 `other`로 처리한다. referrer는 host만 저장하고 전체 URL/query/fragment·fbclid/gclid는 저장하지 않는다.
- 링크 예: `https://<독립도메인>/?utm_source=instagram&utm_medium=paid_social&utm_campaign=seoul_pilot_v1&utm_content=strip_b`. 실도메인은 미확정이다. 광고 계정의 소재 ID와 대응표를 캠페인 설정에 관리한다.
- 동의 전 메모리만 사용한다. 동의 후 firstTouch/lastNonDirectTouch를 최대7일 보관하며 raw 보관30일을 넘지 않는다. direct 재방문은 기존 lastNonDirect를 덮어쓰지 않는다. 기기 간 식별 연결은 없다. 공유는 `source=shared`를 명시한 일반 랜딩 링크이며 기존 광고 UTM을 무조건 복제하지 않는다.
- waitlist POST의 attribution은 분석 동의가 있을 때 서버 세션에 묶인 검증값만 사용한다. 거부하면 null/unknown이다. 클라이언트 임의 source로 광고 실적을 부풀리지 않는다.
- 귀속 기준은 **7일 last-non-direct click** 가설이며 first touch는 보조다. 노출만으로 귀속하지 않는다. 쿠키 차단·광고 차단·앱내 브라우저·동의 거부는 unknown으로 유지하고 paid로 추정하지 않는다.
- metadata는 일반 브랜드 OG 이미지·제목·설명·canonical만 포함한다. UTM을 포함한 개인화 OG/사진 공개 URL은 없다. 제목은 `Missed Connections — 어쩌면, 우리가 만났어야 할 이유.`. P2 공개 행사 페이지는 승인된 행사명만 추가한다.

## 7. KPI 계산과 대시보드

보고 기간은 캠페인 시작부터 종료 후7일 귀속창까지다. 분모 세션을 기준으로 후속 완료를 묶는다. 분모가0이면 N/A이며0%로 표시하지 않는다. 표본 수·동의 코호트·내부 세션 제외 여부·집계 시점을 함께 표시한다.

| 지표 | 분자 / 분모 | 검증 가설·주의 |
|---|---|---|
| Landing→Start | start 고유 flow / landing 고유 full-funnel 세션 | ≥30%; resume는 신규와 분리 |
| 설문 완료율 | quiz_completed 고유 flow / start 고유 flow | ≥60%; quiz 시작 대비 완료도 보조 표시 |
| 촬영 완료율 | capture_completed 고유 flow / capture_view 고유 flow | ≥55%; camera/upload/mixed별, 권한 거부 후 대체 입력 성공 포함 |
| 결과 확인율 | result_view 고유 flow / capture_completed 고유 flow | ≥90%; 저장 전 reveal이며 실제 매칭 아님 |
| 공유 시도율 | share_attempt 고유 flow / strip_ready 고유 flow | ≥15%; 다운로드/복사는 별도, 실제 게시율 미관측 |
| 사전예약 전환율 | canonical 신규 신청 중 landing과 소유 동의가 조인되는 고유 flow / 동일 landing 코호트 | ≥8%; direct waitlist와 전체 체험을 분리. 전체 서버 신청 수와 혼합 금지 |
| CPL(귀속 확인) | 실제 광고 지출 / 동의한7일 귀속 신규 유효 신청 | ≤10,000원; 미귀속 때문에 비싸 보일 수 있음. 전체 실제 paid CPL은 불명 |
| 운영상 모집 비용 | 지출 / 전용 캠페인 전체 신규 신청 | 보조치. organic·공유 유입 혼입·미귀속 불확실성 표시 |
| 참가비 의향 | priceBand별 신규 유효 신청 / 전체 신규 유효 신청 | undecided 포함, 무료만/유료 구간 구분. 구매 전환 아님 |
| 지역별 수요 | region별 신규 유효 신청 / 전체 신규 유효 신청 | 주거 주소가 아닌 참가 희망 권역, n<10 외부 공개 억제 |
| 오류율 | 회복/치명 오류를 겪은 고유 flow / 관측 고유 flow | >5%일 때 집행 중단·원인 검토, share cancel 제외 |

상단 대시보드: 광고 지출·클릭(플랫폼), 관측 landing·분석 동의 표본, 전체 신규 유효 신청, 귀속 확인 신청, 중복 접수, 에러. 중단: 동일 코호트 퍼널과 기기·유입·소재별 분포. 하단: 희망 권역·가격 분포·삭제 요청·신청 실패 사유. 신청 DB에서는 contact를 제외한 권한 있는 집계만 조회하며 CSV에 이메일을 붙이지 않는다.

유효 신청은 필수 동의·성인 확인·형식 검증을 충족한 신규 canonical 신청이며 internal/확인된 자동 스팸은 제외한다. 이메일 도달과 실제 참가 의향까지 검증된 사람이라고 부르지 않는다. P1 기본 이메일 소유 확인이 없음을 보고서에 표시한다. 스팸 제외 규칙은 실험 전에 고정하며 사후 임의 삭제로 수치를 개선하지 않는다. 제외 사유·전후 건수를 남긴다.

## 8. 10만원 최소 광고 실험

| 단계 | 작업 / 상한 | 통과 조건 |
|---|---|---|
| 사전 | 내부10세션: Safari 촬영/업로드/저장/신청·동의 거부·삭제·중복 | P0 AC 통과, 결제/사진 upload/기존 GA 호출0건. 광고 정책·운영 채널·비용 gate 확인 |
| 기술 smoke | 총예산 안의10,000원, 두 소재 균등 | 랜딩 장애·잘못된 DEMO·누락 동의 없음. 실제 insert와 conversion 1:1 |
| 나머지 | 최대90,000원,4일 총액100,000원 내 두 소재 균등 | 같은 audience/landing/CTA, 자동 증액 없음. 문제 시 즉시 pause |
| 판독 | 종료 후7일 귀속창, 구간 추정은 표본 설명용 | landed≥100·신규≥10이면6~10명 인터뷰, 아니면 표본 부족. 두 소재의 통계적 승자 단정 금지 |

CPC500/1,000/2,000원→클릭200/100/50, landing90%·신청8% 가설→신청 약14/7/4건, CPL 약7,143/14,286/25,000원. 반올림한 산술이며 시장 벤치마크/매출 예측이 아니다. 동의 관측률과 organic 혼입은 이 단순 예시에 포함되지 않아 실제 보고에서 따로 표시한다.

Meta 만남/데이팅 관련 광고의 분류·승인·성인 타기팅 정책 최신판은 **미확인**이다. [공식 정책 확인 경로](https://transparency.meta.com/policies/ad-standards/restricted-goods-services/dating/)와 실제 광고 계정에서 적격성을 확인한 뒤 집행한다. 정책을 우회하거나 촬영 도구로 허위 분류하지 않는다. 광고비를 이번 작업에서 집행하지 않는다.

## 9. 검증 시나리오와 Acceptance Criteria

- A01 분석 거부로 landing→quiz→upload→PNG→waitlist 완료: 선택 분석 요청0건, 전체 운영 신청1건, 개인 퍼널/UTM 조인0건.
- A02 동의 후 happy path: 기대 이벤트 순서·allowlist 검증, shot4개·flow 완료1개, mode는 모두 demo.
- A03 네트워크 실패로 동일 batch 3회 전송: raw unique1건. 신청 POST의 동일 key 재시도/더블탭/성공 화면 새로고침도 canonical1건·전환1건.
- A04 기존 이메일을 타 세션에서 제출: 동일 public201 응답, 기존 PII/선택 정보 노출0건·기존 동의 변경0건·신규 전환0건.
- A05 quiz 수정/한 컷 재촬영: raw revision 증가, funnel 분자 중복0건. value/사진/성향 vector 전송0건.
- A06 Share 취소: cancelled1, api_resolved0, 서비스 오류0. 미지원은 fallback이며 다운로드를 게시 성공으로 세지 않음.
- A07 외부 ID/원문 이메일/상한 초과 batch/임의 event name 주입: 404/422/413, 이벤트 DB의 금지 필드 저장0건.
- A08 attribution: adA→direct는 A 유지, adB 재유입은 lastB/firstA,7일 초과 unknown. 거부 후 메모리 폐기, 전체 URL 수집0건.
- A09 P2 mock/test DONE/재출력: 물리 출력0·촬영 수 중복0, UNKNOWN 자동 재출력0건.
- A10 소수 cell·0분모·서버 미접수·중간 동의: n/억제/N/A/unknown 처리 정확, 실패를 success로 집계0건.

raw 자동 삭제30일과 신청 삭제90일은 clock injection으로 만료·접근 차단·실제 삭제를 확인한다. 문서 작성 단계에서 DB TTL·분석 계정·Pixel을 생성하지 않는다.

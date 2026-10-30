# MISSED 모바일 한 사이클 체험판

공개 주소: https://phototoast.kro.kr/missed-connections/index.html

기존 저장소 main push → 기존 Vercel 자동 배포로 제공한다. public의 독립 HTML이므로 PhotoToast root layout/AuthProvider/GA를 실행하지 않는다. 기존 부스·API·DB·프린터는 변경하지 않았다.

## 체험 흐름

Landing → 성인 확인 → 12문항(또는 표시된 샘플 응답) → 촬영/파일 선택 → 네 컷 구도 편집 → 연결 조건 → 봉투 열기·본인 연결노트 → 600×1800 PNG 저장/공유 → 지역·가격 체험 티켓.

디자이너 의견에 따른 최신 기준은 [DESIGN_REVIEW.md](DESIGN_REVIEW.md). 바랜 종이/붉은 우편 소인의 Correspondence Booth, MISSED·미스드 표기, ‘누가 나올까?’를 사용한다. 공개 범위는 이름만/번호도, 기간은 1주일/한 달/1년, 사진 무드는 직접 선택, 알림은 직접 확인/알림톡 희망이다. 앱은 미출시로 비활성이다. 번호 공개는 실제 서비스에서 쌍방 호감과 별도 교환 동의가 필요하다.

## 데이터 경계

실제 상대·얼굴 분석·외모 점수·연락처 수집·신청·알림 발송은 없다. 기간은 희망 설정이며 사진 보관 기간이 아니다. 1년은 장기 컨셉이다. 사진은 메모리에서만 처리하고 새로고침 시 사라진다. 답변·성인 확인·설정은 탭 sessionStorage 최대2시간. 초기화로 모두 지울 수 있다. 이름/전화번호를 입력받지 않으며 서버 전송이나 외부 SDK를 추가하지 않았다.

기존 카메라 stream lifecycle·촬영 순서, Canvas cover/clip 계산을 정적 환경에 맞게 재사용했다. Nanum Myeongjo는 OFL 동봉, 자체 WOFF2 subset이므로 외부 폰트 요청이 없다. 신규 패키지·DB 변경 없음.

## 검증

`node --check public/missed-connections/assets/app.js`, `node scripts/test-missed-connections.cjs` 통과. 테스트는 36가지 설정 조합, 잘못된 enum/앱 선택 거부, 추가 연락처 필드 미보관, 기존 성향·역문항·흑백·crop·늦게 도착한 카메라 stream 정리를 포함한다.

브라우저390×844에서 샘플 사진→설정→봉투→결과→PNG→티켓, 설정 재선택·복원·사진 유실 안내를 확인했다. 320×740 가로 넘침 없음, 1440×900 데스크톱 렌더 확인. 기록은 `public/missed-connections/screenshots/correspondence/`와 manifest를 참고한다. 실제 iOS Safari 카메라 권한·HEIC·공유 sheet는 실기기 추가 검증이 필요하다.

로컬 확인은 기존 dev 경로 `/missed-connections/index.html`, 또는 public/missed-connections를 로컬 정적 서버로 제공한다. 카메라는 HTTPS/localhost에서만 사용한다.

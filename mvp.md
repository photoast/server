# photoast — MVP 기능 및 기술 명세서

## 1. 서비스 개요
photoast는 이벤트 운영자를 위한 웹 기반 즉석 인화 플랫폼이다.  
운영자는 관리자 페이지에서 프린터와 로고를 설정하고,  
사용자는 QR/URL로 접속해 사진 업로드 → 프리뷰 → 인쇄를 진행한다.

- 플랫폼: **Web (Next.js + TypeScript)**
- 출력 방식: **IPP(Internet Printing Protocol)**
- 출력 사이즈: **5×7 inch 고정**
- 사진 1장 업로드·인쇄 기준
- 과금 없음
- 오프라인 모드 없음

---

## 2. 사용자 역할

### 운영자(Admin)
- 이벤트 생성
- 프린터(IPP URL) 설정
- 로고 이미지 등록
- 게스트 접근용 URL/QR 제공

### 게스트(User)
- 사진 업로드
- 프리뷰 확인
- 인쇄 요청

---

## 3. 주요 플로우

### 게스트 인쇄 플로우
1. QR/URL로 이벤트 페이지 접속  
2. 사진 1장 업로드  
3. 서버에서 이미지 리사이즈(5×7) + 로고 합성  
4. 클라이언트에서 프리뷰 표시  
5. 인쇄하기 → IPP 명령 전송  
6. 성공/실패 메시지 출력  

### 운영자 설정 플로우
1. 관리자 페이지 접속  
2. 이벤트 생성  
3. 프린터 IPP URL 설정  
4. 로고 업로드  
5. QR/URL 배포  

---

## 4. 기능 목록 (MVP)

### 게스트 페이지
| ID | 기능명 | 설명 |
|----|--------|------|
| G01 | 이벤트 정보 로딩 | slug 기반 이벤트 정보 조회 |
| G02 | 사진 업로드 | 기기에서 1장 업로드 |
| G03 | 프리뷰 렌더링 | 서버가 리사이즈+로고 합성 이미지 생성 |
| G04 | 인쇄 요청 | IPP로 인쇄 명령 전송 |
| G05 | 결과 표시 | 성공/실패 여부 표시 |

### 관리자 페이지
| ID | 기능명 | 설명 |
|----|--------|------|
| A01 | 로그인 | 단일 관리자 인증 |
| A02 | 이벤트 생성 | 이벤트 등록 및 slug 발급 |
| A03 | 프린터 설정 | IPP URL 등록 |
| A04 | 로고 업로드 | PNG/JPG 저장 |
| A05 | QR/URL 제공 | 게스트 접속 링크 출력 |

---

## 5. 데이터 모델

```ts
interface Event {
  _id: string;
  name: string;
  slug: string;
  printerUrl: string;
  logoUrl?: string;
  createdAt: Date;
}

interface PrintJob {
  _id: string;
  eventId: string;
  imageUrl: string;
  createdAt: Date;
  status: 'DONE' | 'FAILED';
}

interface Admin {
  username: string;
  passwordHash: string;
}

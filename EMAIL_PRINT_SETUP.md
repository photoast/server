# 이메일 프린트 설정 가이드

이 프로젝트는 **Epson Email Print** 서비스를 사용하여 사진을 출력합니다.

## 🖨️ Epson Email Print란?

Epson 프린터에 이메일로 문서/사진을 첨부하여 보내면 자동으로 출력되는 서비스입니다.
- 프린터 이메일 주소: `eyx3988j7dyi07@print.epsonconnect.com`

## 📧 SMTP 설정 방법

이메일을 보내기 위해 SMTP 서버 설정이 필요합니다.

### Option 1: Gmail 사용 (권장)

1. **Google 계정 설정**
   - [Google App Passwords](https://myaccount.google.com/apppasswords) 페이지로 이동
   - 2단계 인증이 활성화되어 있어야 합니다

2. **앱 비밀번호 생성**
   - "앱 선택" → "기타(맞춤 이름)" 선택
   - 이름 입력 (예: "Photoast Printer")
   - "생성" 클릭
   - 16자리 비밀번호가 생성됩니다 (예: `xxxx xxxx xxxx xxxx`)

3. **.env 파일 설정**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=xxxx xxxx xxxx xxxx  # 위에서 생성한 16자리 비밀번호
   SMTP_FROM=your-email@gmail.com
   ```

### Option 2: Outlook/Hotmail 사용

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
SMTP_FROM=your-email@outlook.com
```

### Option 3: 기타 SMTP 서버

```env
SMTP_HOST=smtp.your-domain.com
SMTP_PORT=587  # 또는 465 (SSL)
SMTP_USER=your-email@your-domain.com
SMTP_PASS=your-password
SMTP_FROM=your-email@your-domain.com
```

## 🚀 빠른 시작

1. **.env 파일 생성**
   ```bash
   cp .env.example .env
   ```

2. **SMTP 설정 입력**
   - `.env` 파일을 열어 위의 설정 중 하나를 입력

3. **서버 재시작**
   ```bash
   npm run dev
   ```

## ✅ 테스트 방법

1. 사진 업로드
2. 프리뷰 확인
3. "Print Photo" 버튼 클릭
4. 이메일이 전송되고 프린터가 자동으로 출력

## 🔧 문제 해결

### "SMTP configuration missing" 오류
- `.env` 파일에 SMTP 설정이 있는지 확인
- 서버를 재시작했는지 확인

### "Authentication failed" 오류
- Gmail: 앱 비밀번호를 올바르게 입력했는지 확인
- Gmail: 2단계 인증이 활성화되어 있는지 확인
- 이메일/비밀번호가 정확한지 확인

### 이메일은 전송되는데 프린터가 출력하지 않음
- 프린터가 켜져 있는지 확인
- 프린터가 인터넷에 연결되어 있는지 확인
- Epson Connect 서비스가 활성화되어 있는지 확인

## 📝 참고사항

- 이메일 전송은 보통 몇 초 내에 완료됩니다
- 프린터 출력은 이메일 수신 후 자동으로 시작됩니다
- 한 번에 하나의 사진만 첨부하여 전송합니다
- 지원 이미지 형식: JPG, PNG
- 권장 이미지 크기: 4×6 inch (1000×1500px @ 300 DPI)

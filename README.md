# X Capture Mobile

트윗 URL을 붙여 넣으면 본문/작성자 정보를 가져와 모바일 카드로 렌더링하고 PNG로 저장하는 정적 웹 앱입니다.

## 기능

- `x.com` 또는 `twitter.com` 트윗 URL 불러오기 (`oEmbed`)
- `oEmbed` 실패 시 `vxtwitter` 보조 경로로 자동 재시도
- `threads.com` / `threads.net` 게시물 URL 불러오기 (로컬 프록시 경유, 본문/작성자/카운트/이미지)
- 작성자 프로필 이미지 자동 반영(실패 시 이니셜 폴백)
- 트윗 첨부 이미지 다중 표시(최대 4장)
- 다중 이미지 배치 옵션(메인/리트윗 원문: 나란히/세로)
- 작성자/핸들/날짜/본문 수동 편집
- 이미지 추가 업로드(선택, 최대 4장)
- 답글별 표시/숨김 선택
- 스타일 프리셋(클래식/번역 강조/이미지 중심/콤팩트)
- PNG/JPG/WebP 내보내기 및 해상도 옵션
- 미리보기 확대 모드
- 필요 시 `불러온 뒤 자동 저장` 옵션으로 즉시 저장
- 브라우저 화면 복귀 후 저장 재개 및 다운로드 재시도 링크 제공
- 모바일에서 고해상도 이미지 저장

## 실행

정적 파일만으로 동작합니다. 로컬 서버로 열어 주세요.

```powershell
cd D:\X_capture
python -m http.server 5173
```

브라우저에서 `http://localhost:5173` 접속

### Threads(메타) 게시물 불러오기

Threads는 크롤러(`facebookexternalhit`)에만 게시물 데이터를 서빙하고 브라우저에서는
`User-Agent` 변경과 CORS가 막힙니다. 그래서 게시물 데이터를 받아오는 **로컬 프록시**를
정적 서버와 함께 실행해야 합니다.

```powershell
node scripts/threads-proxy.mjs
```

- 기본 포트는 `5174`이며 `THREADS_PROXY_PORT` 환경 변수로 변경할 수 있습니다.
- 포트를 바꾼 경우 페이지에서 `window.__THREADS_PROXY_URL__`로 프록시 주소를 지정하면 됩니다.
- 프록시가 떠 있으면 X와 동일하게 Threads 게시물 URL을 붙여 넣고 `불러오기`를 누르면 됩니다.

## 개발

```powershell
npm install
npm run check
npm run format:check
```

- `npm run check`: 앱 JavaScript 파일 문법 검사
- `npm run unit`: 핵심 유틸/모델 단위 테스트
- `npm run format`: Prettier로 코드 포맷 정리
- `npm test`: 문법 검사, 단위 테스트, 포맷 검사를 함께 실행

## 주의사항

- X/Twitter 정책 또는 API 응답 변경 시 URL 자동 파싱이 실패할 수 있습니다.
- 비공개 계정 트윗은 불러오지 못할 수 있습니다.
- 일부 트윗은 공식 `oEmbed`에서 404가 날 수 있어 보조 API를 사용합니다.
- PNG 저장은 로컬에 포함된 `vendor/html2canvas.min.js`에 의존합니다.
- 원격 이미지 CORS 정책에 따라 자동 썸네일 반영이 실패할 수 있으며, 이 경우 이미지 파일을 직접 업로드하면 됩니다.
- Threads 불러오기는 `node scripts/threads-proxy.mjs` 프록시가 실행 중이어야 하며, 공개 게시물만 지원합니다. Threads 페이지 구조가 바뀌면 파싱이 실패할 수 있습니다(이 경우 본문/이미지를 직접 입력·업로드).

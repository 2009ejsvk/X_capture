# Smoke Checklist

Quick manual checks before deploy:

1. `npm start` and open `http://localhost:3000`.
2. Paste a valid tweet URL and confirm preview auto-updates.
3. Toggle `이미지 포함` off/on and confirm media area hides/shows.
4. Toggle `리트윗/인용 트윗 별도 카드` and confirm shared tweet layout changes.
5. Enable `이미지 2장 이상 세로 배치` and toggle `세로 배치 이미지 간격` on/off.
6. In `개별 미디어 선택`, uncheck one photo and one video and confirm they disappear from preview/capture.
7. Toggle `답글 스레드 전체 표시` on a reply tweet and confirm parent replies render.
8. For a tweet with video/GIF, switch `영상 채우기` between `cover` and `contain` and confirm output difference.
9. Click download for an image tweet and verify file extension is `.png`.
10. Click download for a video/GIF tweet (with video selected) and verify file extension is `.mp4`.

// 긴 캡처를 여러 장으로 나눌 위치를 정한다.
//
// 한 장이 너무 길면 파일이 커지고, 휴대폰에서는 캔버스 크기 한도에 걸려
// 저장이 실패하기도 한다. 그래서 정해진 높이 안에서 이미지 · 글 줄 ·
// 머리말 같은 덩어리를 가로지르지 않는 위치를 골라 자른다.

// 한 장의 최대 높이 = 너비 × 이 값. 휴대폰 화면 비율(약 9:20)에 맞췄다.
export const PAGE_HEIGHT_RATIO = 2.2;

// 이보다 짧은 마지막 장은 만들지 않고 앞 장에 붙인다(최대 높이의 비율).
const MIN_LAST_PAGE_RATIO = 0.18;

function isInsideBlocker(y, blockers) {
  return blockers.some(([top, bottom]) => y > top + 0.5 && y < bottom - 0.5);
}

/**
 * @param {object} input
 * @param {number} input.totalHeight 전체 높이(px)
 * @param {number} input.maxHeight 한 장의 최대 높이(px)
 * @param {Array<[number, number]>} input.blockers 가로질러 자르면 안 되는 구간
 * @param {number[]} input.preferred 되도록 자르고 싶은 위치(글 · 이미지 줄 경계)
 * @returns {Array<{ y: number, height: number }>}
 */
export function planPageCuts({
  totalHeight,
  maxHeight,
  blockers = [],
  preferred = [],
}) {
  const total = Math.max(0, Math.ceil(Number(totalHeight) || 0));
  const limit = Math.max(1, Math.floor(Number(maxHeight) || 0));
  if (!total) {
    return [];
  }
  if (total <= limit) {
    return [{ y: 0, height: total }];
  }

  const safePreferred = [
    ...new Set(preferred.map((value) => Math.round(value))),
  ]
    .filter((y) => y > 0 && y < total && !isInsideBlocker(y, blockers))
    .sort((a, b) => a - b);
  const safeAny = [
    ...new Set(
      blockers
        .flat()
        .map((value) => Math.round(value))
        .concat(safePreferred),
    ),
  ]
    .filter((y) => y > 0 && y < total && !isInsideBlocker(y, blockers))
    .sort((a, b) => a - b);

  const pages = [];
  let start = 0;
  while (start < total) {
    const remaining = total - start;
    if (remaining <= limit) {
      pages.push({ y: start, height: remaining });
      break;
    }

    const end = start + limit;
    // 마지막 장이 너무 짧아지지 않게, 남은 길이가 애매하면 조금 일찍 자른다.
    const latestUsefulCut = Math.min(end, total - limit * MIN_LAST_PAGE_RATIO);
    const pick = (candidates, earliest) => {
      const fitting = candidates.filter(
        (y) => y > earliest && y <= latestUsefulCut,
      );
      return fitting.length ? fitting[fitting.length - 1] : null;
    };

    const cut =
      pick(safePreferred, start + limit * 0.5) ??
      pick(safeAny, start + limit * 0.25) ??
      pick(safeAny, start) ??
      end;

    pages.push({ y: start, height: cut - start });
    start = cut;
  }

  return pages;
}

const BLOCKER_SELECTOR = [
  "img",
  ".tweet-head",
  ".quote-head",
  ".tweet-actions",
  ".tweet-foot",
  ".tweet-original-url",
].join(",");

const TEXT_SELECTOR = [
  ".tweet-text",
  ".tweet-translation-text",
  ".quote-text",
].join(",");

const PREFERRED_SELECTOR = [
  ".tweet-card",
  ".tweet-text",
  ".tweet-translation",
  ".tweet-media",
  ".quote-card",
  "img",
].join(",");

function isRendered(element) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * target 안에서 자르면 안 되는 구간과 자르기 좋은 위치를 잰다.
 * 위치는 target 위쪽 끝을 0 으로 한 값이다.
 */
export function measurePageBreaks(target) {
  const origin = target.getBoundingClientRect().top;
  const blockers = [];
  const preferred = [];

  target.querySelectorAll(BLOCKER_SELECTOR).forEach((element) => {
    if (!isRendered(element)) {
      return;
    }
    const rect = element.getBoundingClientRect();
    blockers.push([rect.top - origin, rect.bottom - origin]);
  });

  // 긴 글은 줄과 줄 사이에서 자를 수 있게, 글 상자 대신 줄 단위로 막는다.
  target.querySelectorAll(TEXT_SELECTOR).forEach((element) => {
    if (!isRendered(element)) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(element);
    Array.from(range.getClientRects()).forEach((lineRect) => {
      if (lineRect.height > 0) {
        blockers.push([lineRect.top - origin, lineRect.bottom - origin]);
      }
    });
    range.detach();
  });

  target.querySelectorAll(PREFERRED_SELECTOR).forEach((element) => {
    if (!isRendered(element)) {
      return;
    }
    const rect = element.getBoundingClientRect();
    preferred.push(rect.top - origin, rect.bottom - origin);
  });

  return {
    totalHeight: target.getBoundingClientRect().height,
    blockers,
    preferred,
  };
}

export function planTargetPages(target, ratio = PAGE_HEIGHT_RATIO) {
  const width = target.getBoundingClientRect().width || 360;
  return planPageCuts({
    ...measurePageBreaks(target),
    maxHeight: width * ratio,
  });
}

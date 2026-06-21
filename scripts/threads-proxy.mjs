import http from "node:http";

import { parseThreadsHtml } from "../src/services/threads-parse.js";
import { parseThreadsUrl } from "../src/utils.js";

// Threads only serves Open Graph tags and the inline post JSON to crawler user
// agents. Browsers cannot set the User-Agent header (and CORS blocks the
// request anyway), so this tiny local proxy fetches the page as a crawler,
// parses it, and returns normalized JSON with permissive CORS headers. Run it
// alongside the static file server:
//
//   node scripts/threads-proxy.mjs
//
const PORT = Number(process.env.THREADS_PROXY_PORT) || 5174;
const CRAWLER_UA =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    });
    res.end();
    return;
  }

  const requestUrl = new URL(req.url, `http://localhost:${PORT}`);
  if (requestUrl.pathname !== "/threads") {
    sendJson(res, 404, {
      error: "Not found. Use /threads?url=<threads post>.",
    });
    return;
  }

  const target = requestUrl.searchParams.get("url") || "";

  let canonicalUrl;
  try {
    ({ canonicalUrl } = parseThreadsUrl(target));
  } catch (error) {
    sendJson(res, 400, { error: error.message });
    return;
  }

  try {
    const upstream = await fetch(canonicalUrl, {
      headers: {
        "User-Agent": CRAWLER_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!upstream.ok) {
      sendJson(res, 502, {
        error: `Threads에서 게시물을 가져오지 못했습니다 (${upstream.status}).`,
      });
      return;
    }

    const html = await upstream.text();
    const meta = parseThreadsHtml(html, { sourceUrl: canonicalUrl });

    if (!meta.text && !meta.imageUrls.length && meta.authorHandle === "@") {
      sendJson(res, 422, {
        error: "공개 Threads 게시물만 불러올 수 있습니다.",
      });
      return;
    }

    sendJson(res, 200, meta);
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "프록시 처리 실패",
    });
  }
});

server.listen(PORT, () => {
  process.stdout.write(
    `Threads proxy listening on http://localhost:${PORT}/threads?url=...\n`,
  );
});

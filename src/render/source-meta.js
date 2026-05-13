export function resolveSourceMeta(sourceUrl) {
  const normalizedSourceUrl = String(sourceUrl || "").trim();
  let sourceHost = "x.com";

  if (normalizedSourceUrl) {
    try {
      const parsedUrl = new URL(normalizedSourceUrl);
      sourceHost = parsedUrl.host.replace(/^www\./i, "") || "x.com";
    } catch (error) {
      sourceHost = "x.com";
    }
  }

  return { sourceHost };
}

const SEARCH =
  "https://api.github.com/search/issues?q=author:gyanu2507+is:pr+is:merged&per_page=12&sort=updated";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "portfolio-gyanu",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const upstream = await fetch(SEARCH, { headers });
    const body = await upstream.text();
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      res.status(502).json({ error: "github_invalid" });
      return;
    }
    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: "github",
        status: upstream.status,
        message: data && data.message,
      });
      return;
    }
    res.status(200).json({
      items: Array.isArray(data.items) ? data.items : [],
      total_count: typeof data.total_count === "number" ? data.total_count : 0,
    });
  } catch (err) {
    res.status(502).json({ error: "github_unavailable" });
  }
};

// Builds assets/neetcode-chart.svg from the commit history of the
// neetcode-submissions repo (each synced submission is one commit).
import { mkdir, writeFile } from "node:fs/promises";

const OWNER = "shreykumar12";
const REPO = "neetcode-submissions";
const WEEKS = 26;
const API = `https://api.github.com/repos/${OWNER}/${REPO}/commits`;

const headers = {
  accept: "application/vnd.github+json",
  "user-agent": "neetcode-chart",
  ...(process.env.GITHUB_TOKEN
    ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

async function fetchJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}`);
  return { data: await res.json(), link: res.headers.get("link") ?? "" };
}

async function totalCommits() {
  const { data, link } = await fetchJson(`${API}?per_page=1`);
  const last = link.match(/[?&]page=(\d+)>; rel="last"/);
  return last ? Number(last[1]) : data.length;
}

async function weeklyCounts() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (WEEKS * 7 - 1));
  const counts = new Array(WEEKS).fill(0);
  for (let page = 1; ; page++) {
    const { data } = await fetchJson(
      `${API}?since=${start.toISOString()}&per_page=100&page=${page}`
    );
    for (const c of data) {
      const when = new Date(c.commit.author.date);
      const idx = Math.floor((when - start) / (7 * 24 * 3600 * 1000));
      if (idx >= 0 && idx < WEEKS) counts[idx]++;
    }
    if (data.length < 100) break;
  }
  return counts;
}

function renderSvg(total, counts) {
  const width = 420;
  const height = 88;
  const chartTop = 28;
  const chartBottom = height - 14;
  const chartHeight = chartBottom - chartTop;
  const barGap = 3;
  const barWidth = (width - (WEEKS - 1) * barGap) / WEEKS;
  const max = Math.max(...counts, 1);

  const bars = counts
    .map((count, i) => {
      const h = count === 0 ? 0 : Math.max(3, (count / max) * chartHeight);
      const x = i * (barWidth + barGap);
      const y = chartBottom - h;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="#2ea043"><title>${count} submission${count === 1 ? "" : "s"}</title></rect>`;
    })
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="NeetCode submissions: ${total} total">
  <style>text { font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #8b949e; }</style>
  <text x="0" y="14">NeetCode submissions · last ${WEEKS} weeks</text>
  <text x="${width}" y="14" text-anchor="end" font-weight="600" fill="#2ea043">${total} total</text>
  ${bars}
  <line x1="0" y1="${chartBottom + 0.5}" x2="${width}" y2="${chartBottom + 0.5}" stroke="#8b949e" stroke-opacity="0.35"/>
</svg>
`;
}

const [total, counts] = await Promise.all([totalCommits(), weeklyCounts()]);
await mkdir("assets", { recursive: true });
await writeFile("assets/neetcode-chart.svg", renderSvg(total, counts));
console.log(`Wrote assets/neetcode-chart.svg (${total} total submissions)`);

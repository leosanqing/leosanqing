import fs from 'node:fs/promises';

const USERNAME = 'leosanqing';
const API = 'https://api.github.com';
const token = process.env.GITHUB_TOKEN;

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': `${USERNAME}-profile-cards`,
};

if (token) {
  headers.Authorization = `Bearer ${token}`;
}

async function github(path) {
  const response = await fetch(`${API}${path}`, { headers });
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function compactNumber(value) {
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(value);
}

function card(title, body, width = 760, height = 220) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="surface" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#101820"/>
      <stop offset="100%" stop-color="#1f2a37"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="8" fill="url(#surface)"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="7.5" fill="none" stroke="#314155"/>
  <text x="26" y="38" fill="#f7fafc" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="20" font-weight="700">${escapeXml(title)}</text>
  ${body}
</svg>`;
}

function statBlock(x, y, label, value) {
  return `<text x="${x}" y="${y}" fill="#94a3b8" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="13">${escapeXml(label)}</text>
  <text x="${x}" y="${y + 30}" fill="#f8fafc" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="28" font-weight="700">${escapeXml(value)}</text>`;
}

function bar(x, y, width, label, value, color) {
  const safeWidth = Math.max(2, Math.round(width * value));
  return `<text x="${x}" y="${y}" fill="#cbd5e1" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="13">${escapeXml(label)}</text>
  <rect x="${x}" y="${y + 10}" width="${width}" height="10" rx="5" fill="#263241"/>
  <rect x="${x}" y="${y + 10}" width="${safeWidth}" height="10" rx="5" fill="${color}"/>`;
}

function timelineItem(x, y, title, subtitle, color) {
  return `<circle cx="${x}" cy="${y - 5}" r="5" fill="${color}"/>
  <text x="${x + 18}" y="${y}" fill="#f8fafc" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="14" font-weight="600">${escapeXml(title)}</text>
  <text x="${x + 18}" y="${y + 22}" fill="#94a3b8" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="12">${escapeXml(subtitle)}</text>`;
}

function topLanguages(repos) {
  const languageCounts = new Map();
  for (const repo of repos) {
    if (!repo.language || repo.fork) continue;
    languageCounts.set(repo.language, (languageCounts.get(repo.language) || 0) + 1);
  }
  return [...languageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
}

function recentRepos(repos) {
  return [...repos]
    .filter((repo) => !repo.fork)
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
    .slice(0, 4);
}

const [user, repos] = await Promise.all([
  github(`/users/${USERNAME}`),
  github(`/users/${USERNAME}/repos?per_page=100&sort=updated`),
]);

const ownRepos = repos.filter((repo) => !repo.fork);
const stars = repos.reduce((total, repo) => total + repo.stargazers_count, 0);
const forks = repos.reduce((total, repo) => total + repo.forks_count, 0);
const languages = topLanguages(repos);
const languageTotal = languages.reduce((total, [, count]) => total + count, 0) || 1;
const palette = ['#38bdf8', '#22c55e', '#f59e0b', '#f43f5e', '#a78bfa'];

const overview = card('GitHub Snapshot',
  `${statBlock(34, 86, 'Public repos', compactNumber(user.public_repos))}
  ${statBlock(210, 86, 'Original repos', compactNumber(ownRepos.length))}
  ${statBlock(386, 86, 'Stars', compactNumber(stars))}
  ${statBlock(562, 86, 'Forks', compactNumber(forks))}
  <text x="34" y="176" fill="#94a3b8" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="13">Profile</text>
  <text x="34" y="200" fill="#e2e8f0" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="15">github.com/${USERNAME}</text>`);

const languageBody = languages.map(([language, count], index) =>
  bar(34, 76 + index * 28, 690, `${language} (${count})`, count / languageTotal, palette[index]),
).join('\n');

const languageCard = card('Repository Languages', languageBody || statBlock(34, 98, 'Languages', 'No public language data'));

const activityBody = recentRepos(repos).map((repo, index) => {
  const updated = new Date(repo.pushed_at).toISOString().slice(0, 10);
  return timelineItem(38, 76 + index * 36, repo.name, `Updated ${updated}`, palette[index % palette.length]);
}).join('\n');

const activityCard = card('Recently Updated Repositories', activityBody || statBlock(34, 98, 'Recent repos', 'No public repo data'));

await fs.mkdir('dist', { recursive: true });
await fs.writeFile('dist/profile-overview.svg', overview);
await fs.writeFile('dist/profile-languages.svg', languageCard);
await fs.writeFile('dist/profile-activity.svg', activityCard);

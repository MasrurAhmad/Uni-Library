// Link checking logic. The network call is passed in, so the tests never touch the internet.

const LOGIN_HOSTS = new Set(['accounts.google.com', 'login.microsoftonline.com', 'login.live.com', 'login.microsoft.com']);
const LOGIN_PATH = /\/(login|signin|sign-in|sso|servicelogin)(\/|$)/i;
export const USER_AGENT = 'Mozilla/5.0 (compatible; UniLibraryLinkCheck/1.0)';

/** Did the link end up on a login page? Then it does not open without logging in. */
export function isLoginPage(finalUrl) {
  try {
    const url = new URL(finalUrl);
    return LOGIN_HOSTS.has(url.hostname) || LOGIN_PATH.test(url.pathname);
  } catch {
    return false;
  }
}

/** Work out why a request failed, from the error that Node's fetch throws. */
export function errorKind(error) {
  const code = String(error?.cause?.code ?? error?.code ?? '');
  if (code === 'ENOTFOUND') return 'dns';
  if (/CERT|TLS|SSL|UNABLE_TO_VERIFY|SELF_SIGNED/i.test(code)) return 'tls';
  return 'silent'; // timeouts, resets, refused connections: the site may only be down for now
}

/** Turn what came back into a verdict: ok, broken, login, silent (no answer) or unsure. */
export function classify({ status, finalUrl, error }) {
  if (error === 'dns') return { state: 'broken', reason: 'the web address does not exist' };
  if (error === 'tls') return { state: 'broken', reason: 'the site’s security certificate is invalid' };
  if (error) return { state: 'silent', reason: 'the site did not respond' };
  if (isLoginPage(finalUrl)) return { state: 'login', reason: 'the link asks for a login' };
  if (status === 404 || status === 410) return { state: 'broken', reason: `the file was not found (${status})` };
  if (status >= 200 && status < 400) return { state: 'ok' };
  return { state: 'unsure', reason: `the site answered ${status}` }; // 403, 429, 5xx: could be a bot block, so do not accuse
}

export async function checkUrl(url, { fetchFn = fetch, timeoutMs = 15000 } = {}) {
  const attempt = async (method) => {
    const response = await fetchFn(url, {
      method,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': USER_AGENT, accept: '*/*' },
    });
    try {
      await response.body?.cancel(); // the headers are enough, so stop any download
    } catch {
      /* nothing to clean up */
    }
    return { status: response.status, finalUrl: response.url || url };
  };
  try {
    let result = await attempt('HEAD');
    if ([400, 403, 405, 501].includes(result.status)) result = await attempt('GET'); // some sites refuse HEAD
    return classify(result);
  } catch (error) {
    return classify({ error: errorKind(error) });
  }
}

/** Run worker over items with at most `limit` running at once. Results keep the order of the items. */
export async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(lanes);
  return results;
}

const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
};

/** Sample entries point at placeholder addresses, so they are never checked. */
export const entriesToCheck = (materials) => materials.filter((entry) => !entry.sample);

/**
 * Check every entry. At most `hostLimit` requests go to the same website at once (good manners), and
 * `parallelHosts` websites are checked side by side. Anything not fine gets one more try after a pause,
 * because failures are often temporary. Returns a Map from entry id to { state, reason }.
 */
export async function checkAll(
  entries,
  { check = checkUrl, hostLimit = 2, parallelHosts = 6, retryDelayMs = 5000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {},
) {
  const results = new Map();
  const pass = async (subset) => {
    const byHost = new Map();
    for (const entry of subset) {
      const host = hostOf(entry.url);
      if (!byHost.has(host)) byHost.set(host, []);
      byHost.get(host).push(entry);
    }
    await pool([...byHost.values()], parallelHosts, (list) =>
      pool(list, hostLimit, async (entry) => results.set(entry.id, await check(entry.url))),
    );
  };
  await pass(entries);
  const again = entries.filter((entry) => results.get(entry.id).state !== 'ok');
  if (again.length > 0) {
    await sleep(retryDelayMs);
    await pass(again);
  }
  return results;
}

const SECTIONS = [
  ['broken', 'Broken links'],
  ['login', 'Links that ask for a login'],
  ['silent', 'Sites that did not respond (twice)'],
];
const MAX_LISTED = 100; // keeps the issue under GitHub's size limit

export function summarize(entries, results) {
  const summary = { total: entries.length, ok: 0, unsure: 0, broken: [], login: [], silent: [] };
  for (const entry of entries) {
    const { state, reason } = results.get(entry.id);
    if (state === 'ok') summary.ok += 1;
    else if (state === 'unsure') summary.unsure += 1;
    else summary[state].push({ entry, reason });
  }
  summary.flagged = summary.broken.length + summary.login.length + summary.silent.length;
  return summary;
}

/**
 * The text of the report issue. Titles never appear (they came from submissions), only ids that link to the
 * site's own pages. The outside link is in a code span, so it is not clickable and cannot ping anyone.
 */
export function buildReport(summary, { siteUrl = '', date }) {
  const lines = [`Link check on ${date}: ${summary.ok} of ${summary.total} links are fine, ${summary.flagged} need attention.`];
  for (const [key, heading] of SECTIONS) {
    const items = summary[key];
    if (items.length === 0) continue;
    lines.push('', `### ${heading} (${items.length})`, '');
    for (const { entry, reason } of items.slice(0, MAX_LISTED)) {
      const name = siteUrl ? `[\`${entry.id}\`](${siteUrl}/materials/${entry.id}/)` : `\`${entry.id}\``;
      lines.push(`- ${name}: ${reason}. Link: \`${entry.url.replace(/`/g, '')}\``);
    }
    if (items.length > MAX_LISTED) lines.push(`- …and ${items.length - MAX_LISTED} more`);
  }
  if (summary.unsure > 0) {
    lines.push('', `${summary.unsure} more links gave an unclear answer (for example “too many requests”) and were not flagged.`);
  }
  lines.push(
    '',
    'What to do: open the entry page and press **Open material** in a private window. If the link is really broken, ask the contributor for a new one, or remove the entry (see `MODERATION.md`). This issue updates every week and closes by itself when all links are fine.',
  );
  return `${lines.join('\n')}\n`;
}

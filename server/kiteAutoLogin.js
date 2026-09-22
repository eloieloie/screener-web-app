import { generateSync as generateTotp } from 'otplib';

// Zerodha does not offer a documented headless-login API for Kite Connect —
// the "Login" button on kite.zerodha.com is the only sanctioned entry point.
// This replicates the same three HTTP calls the browser makes (password grant,
// TOTP verification, then the Connect OAuth redirect) so a scheduled job can
// obtain a fresh request_token without a human opening a browser.
//
// NOTE: this talks to undocumented internal endpoints (kite.zerodha.com/api/*),
// not the published Kite Connect API. Zerodha can change or block this at any
// time without notice, and their API terms discourage scripting the login page.
// Only use this against your own account for your own automation.

const BASE = 'https://kite.zerodha.com';

function mergeCookies(jar, response) {
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(';');
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

/**
 * Performs the password + TOTP login against kite.zerodha.com and exchanges
 * the resulting session for a Kite Connect request_token, scoped to apiKey.
 * Returns the request_token — caller still has to call kiteService.generateSession()
 * with it (identical to the manual-login flow) to get a real access_token.
 */
export async function getAutoLoginRequestToken({ apiKey, userId, password, totpSecret }) {
  if (!apiKey || !userId || !password || !totpSecret) {
    throw new Error('Auto-login requires KITE_API_KEY, KITE_USER_ID, KITE_PASSWORD and KITE_TOTP_SECRET to be set.');
  }

  const jar = new Map();

  // Step 1: password grant
  const loginRes = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ user_id: userId, password }),
  });
  mergeCookies(jar, loginRes);
  const loginBody = await loginRes.json();
  if (loginBody.status !== 'success' || !loginBody.data?.request_id) {
    throw new Error(`Kite login step failed: ${loginBody.message || JSON.stringify(loginBody)}`);
  }
  const { request_id, twofa_type = 'totp' } = loginBody.data;

  // Step 2: TOTP verification
  const totpValue = generateTotp({ secret: totpSecret });
  const twofaRes = await fetch(`${BASE}/api/twofa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(jar),
    },
    body: new URLSearchParams({
      user_id: userId,
      request_id,
      twofa_value: totpValue,
      twofa_type,
    }),
  });
  mergeCookies(jar, twofaRes);
  const twofaBody = await twofaRes.json();
  if (twofaBody.status !== 'success') {
    throw new Error(`Kite 2FA step failed: ${twofaBody.message || JSON.stringify(twofaBody)}`);
  }

  // Step 3: Connect OAuth handshake — follow redirects manually until the
  // Location header carries request_token (destined for our redirect_url,
  // which we never need to actually hit).
  let url = `${BASE}/connect/login?api_key=${encodeURIComponent(apiKey)}&v=3`;
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { Cookie: cookieHeader(jar) },
    });
    mergeCookies(jar, res);
    const location = res.headers.get('location');
    if (!location) {
      throw new Error(`Kite Connect handshake did not redirect (status ${res.status}). Response may indicate stale session or changed login flow.`);
    }
    const parsed = new URL(location, BASE);
    const requestToken = parsed.searchParams.get('request_token');
    if (requestToken) return requestToken;
    if (parsed.searchParams.get('status') === 'error') {
      throw new Error(`Kite Connect handshake returned an error redirect: ${location}`);
    }
    url = parsed.toString();
  }
  throw new Error('Kite Connect handshake exceeded max redirects without producing a request_token.');
}

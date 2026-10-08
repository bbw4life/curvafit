// Build an absolute site URL for payment-provider redirects and callbacks.
// Cloudflare variables are sometimes entered as `curvafit.com` without a
// scheme; payment providers require a fully qualified URL.
function getSiteBaseUrl(request, env) {
  const requestOrigin = new URL(request.url).origin;
  const configured = String(env.BASE_URL || '').trim();
  if (!configured) return requestOrigin;

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(configured)
    ? configured
    : `https://${configured}`;

  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname || (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost')) {
      throw new Error('Unsupported site URL');
    }
    return parsed.origin;
  } catch (error) {
    console.warn('[SITE URL] Invalid BASE_URL; using request origin');
    return requestOrigin;
  }
}

module.exports = { getSiteBaseUrl };

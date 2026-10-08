// cron-worker/index.js
// Déclencheur seul — voir wrangler.toml pour le contexte complet.
// Chaque cron trigger appelle un ou plusieurs endpoints HTTP déjà migrés
// dans functions/ (Cloudflare Pages). Toute la logique métier vit là-bas ;
// ce Worker ne fait que "sonner" au bon moment.

// Mappe chaque expression cron (event.cron) vers les endpoints à appeler.
// Plusieurs endpoints peuvent partager la même fréquence (ex: */5 * * * *) —
// ils sont alors appelés en parallèle, comme Netlify le faisait pour ses
// scheduled functions indépendantes.
const CRON_MAP = {
  "*/5 * * * *": [
    "/retry-pending-order",
    "/reply-contact-message",
    "/send-cart-push-reminder",
  ],
  "*/10 * * * *": [
    "/detect-abandoned-cart",
    "/check-approved-stories",
  ],
  "* * * * *": [
    "/process-email-queue",
  ],
  "0 12 */3 * *": [
    "/send-telegram-new-arrivals",
  ],
  "0 12 */6 * *": [
    "/send-telegram-promo",
  ],
};

export default {
  async scheduled(event, env, ctx) {
    const endpoints = CRON_MAP[event.cron] || [];
    if (!endpoints.length) {
      console.warn(`[cron-worker] No endpoints mapped for cron "${event.cron}"`);
      return;
    }

    const baseUrls = [
      env.BASE_URL || "https://bbw4life.com",
      env.CURVAFIT_BASE_URL || "https://curvafit.com",
    ].map((url) => url.replace(/\/+$/, ""));

    const calls = baseUrls.flatMap((baseUrl) => endpoints.map(async (path) => {
      const url = `${baseUrl}${path}`;
      try {
        const res = await fetch(url, { method: "GET" });
        const text = await res.text().catch(() => "");
        console.log(`[cron-worker] ${url} -> ${res.status}: ${text.slice(0, 300)}`);
      } catch (err) {
        console.error(`[cron-worker] ${url} FAILED:`, err.message);
      }
    }));
    // waitUntil garantit que le Worker reste actif jusqu'à la fin des
    // appels fetch, même après la fin logique de scheduled().
    ctx.waitUntil(Promise.all(calls));
  },

  // Pas de trafic HTTP normal attendu sur ce Worker — répond simplement
  // pour confirmer qu'il est déployé et vivant si quelqu'un visite son URL.
  async fetch() {
    return new Response("Shared BBW4LIFE and Curvafit cron worker is running.", { status: 200 });
  },
};

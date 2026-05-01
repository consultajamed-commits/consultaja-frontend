/* ────────────────────────────────────────────────────────────────────
   ConsultaJá! — Service Worker (PWA cache estratégia mínima)

   Princípios:
   - Cache APENAS assets estáticos da landing (HTML/CSS/JS/imagens públicas)
   - NUNCA cachear chamadas pra API (Railway, n8n, MP, Supabase) — privacidade
   - Network-first pra HTML (pega updates rápido)
   - Cache-first pra CSS/JS/imagens (offline funcional)
   ──────────────────────────────────────────────────────────────────── */

const CACHE = 'consultaja-static-v1';

// Assets pré-cacheados no install — só os essenciais da landing
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/css/theme.css',
  '/css/components.css',
  '/img/icon.svg',
  '/img/dr-matheus-castro.jpg',
  '/img/dr-lecidio-alencar.jpg'
];

// Hosts cujo fetch NUNCA passa pelo cache (privacidade médica)
const API_HOSTS = [
  'railway.app',
  'mercadopago.com',
  'duckdns.org',
  'supabase.co',
  'n8nconsultaja',
  'agora.io',
  'web-rtc.agora.io'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET (POST de chat, mídia, etc) — sempre network direto
  if (event.request.method !== 'GET') return;

  // Skip API hosts — privacidade > offline
  if (API_HOSTS.some((host) => url.hostname.includes(host))) return;

  // Network-first pra navegação (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // Atualiza cache do HTML em background (next visit é mais rápido)
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  // Cache-first pra assets estáticos
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, clone));
        }
        return res;
      });
    })
  );
});

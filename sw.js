// ══════════════════════════════════════════════════════════════════
//  SISTEMA ELIEL — Service Worker v1.0
//  • Cachea todos los assets al instalar
//  • Sirve desde cache cuando no hay red (modo offline = solo lectura)
//  • Al detectar nueva versión en GitHub → fuerza actualización
// ══════════════════════════════════════════════════════════════════

const CACHE_NAME = "eliel-v1";

// Archivos locales que siempre se cachean
const LOCAL_ASSETS = [
  "./",
  "./index.html",
  "./login.html",
  "./status.html",
  "./manifest.json",
];

// CDNs externos críticos para que la app funcione offline
const EXTERNAL_ASSETS = [
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js",
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone@7.23.10/babel.min.js",
];

// ── INSTALL: cachear todo ─────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cachear locales (siempre disponibles)
      await cache.addAll(LOCAL_ASSETS);

      // Cachear externos: intentar uno por uno, ignorar fallos
      for (const url of EXTERNAL_ASSETS) {
        try {
          await cache.add(url);
        } catch (e) {
          console.warn("[SW] No se pudo cachear:", url);
        }
      }
    })
  );
  // Activar inmediatamente sin esperar a que se cierren tabs viejas
  self.skipWaiting();
});

// ── ACTIVATE: limpiar caches viejos ──────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: estrategia Network-first con fallback a cache ──────────
//
//  ONLINE:
//    → Intenta red primero
//    → Si responde OK: actualiza cache y devuelve respuesta fresca
//    → Si falla red: sirve desde cache
//
//  OFFLINE (red no disponible):
//    → Sirve desde cache directamente
//    → El flag window.ELIEL_OFFLINE lo detecta la app para bloquear edición
//
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Solo interceptar GET (no POST/PUT de Firebase directamente)
  if (req.method !== "GET") return;

  // No interceptar requests de Chrome DevTools / extensiones
  if (!req.url.startsWith("http")) return;

  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        // Red disponible → actualizar cache y devolver respuesta
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        // Sin red → servir desde cache
        return caches.match(req).then(
          (cached) =>
            cached ||
            new Response(
              "<h2>Sin conexión</h2><p>Reconectá para continuar.</p>",
              { headers: { "Content-Type": "text/html" } }
            )
        );
      })
  );
});

// ── MENSAJE desde la app: forzar actualización ────────────────────
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

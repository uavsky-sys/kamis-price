// 서비스워커 — 오프라인에서도 화면 껍데기는 뜨게 한다.
//
// ★ 설계 원칙 (시세 사이트라 캐시 사고가 치명적) ★
//  1. 시세 API(mafra-proxy)는 아예 건드리지 않는다. 다른 오리진이므로 통과시킨다.
//     → 캐시된 옛날 가격이 오늘 가격인 척하는 사고를 원천 차단.
//  2. 같은 오리진 파일도 '네트워크 우선'. 성공하면 그 응답을 쓰고 캐시는 갱신만 한다.
//     → 사이트를 고쳐 배포하면 다음 접속에서 바로 반영된다 (캐시 우선이면 옛 화면이 남는다).
//  3. 네트워크가 죽었을 때만 캐시를 꺼내 쓴다. 이게 이 워커의 유일한 존재 이유다.

const CACHE = 'nongsan-sise-v1';

const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (e) => {
  // 새 워커를 즉시 대기 해제 — 옛 워커가 남아 옛 화면을 물고 있는 것을 막는다
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  // 이전 버전 캐시 삭제 후 즉시 제어권 인수
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // 시세 API 등 외부 오리진은 손대지 않는다 (원칙 1)
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match('/index.html'))
      )
  );
});

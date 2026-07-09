const cacheName = 'musicplayer-cache';
const filestoCache = [
    './',
    './index.html',
    './icon.svg',
    './icon.png',
    './manifest.json',
    './assets/index.css',
    './assets/AbstractID3Parser.js',
    './assets/DsfParser.js',
    './assets/WavPackParser.js',
    './assets/AiffParser.js',
    './assets/DsdiffParser.js',
    './assets/MusepackParser.js',
    './assets/WaveParser.js',
    './assets/FlacParser.js',
    './assets/OggParser.js',
    './assets/ID3v2Parser.js',
    './assets/MatroskaParser.js',
    './assets/AsfParser.js',
    './assets/MpegParser.js',
    './assets/MP4Parser.js',
    './assets/core.js',
    './assets/chart.js',
    './assets/index.js',
    './assets/index2.js',
];
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(cacheName)
            .then(cache => cache.addAll(filestoCache))
    );
});
self.addEventListener('activate', e => self.clients.claim());
self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.url.indexOf("updatecode") !== -1 || req.url.startsWith("blob")) event.respondWith(fetch(req)); else event.respondWith(networkFirst(req));
});
async function networkFirst(req) {
    try {
        const networkResponse = await fetch(req);
        const cache = await caches.open(cacheName);
        await cache.delete(req);
        await cache.put(req, networkResponse.clone());
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(req);
        return cachedResponse;
    }
}
importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

const PREFIX = "/scramjet/";

// Scramjet n'envoie pas de Referer lors d'une navigation (clic sur un lien) :
// certains sites renvoient alors vers leur accueil au lieu de suivre le lien.
// On mémorise la page d'origine de chaque navigation pour reconstituer le Referer.
const navReferrers = new Map();

function decodeProxied(url) {
	try {
		const u = new URL(url);
		if (u.origin !== location.origin || !u.pathname.startsWith(PREFIX)) return null;
		return new URL(decodeURIComponent(u.pathname.slice(PREFIX.length)) + u.search);
	} catch {
		return null;
	}
}

// Équivalent de la politique par défaut des navigateurs (strict-origin-when-cross-origin)
function refererFor(target, from) {
	if (from.protocol === "https:" && target.protocol === "http:") return null;
	return from.origin === target.origin ? from.href : from.origin + "/";
}

scramjet.addEventListener("request", (e) => {
	const key = new URL(String(e.url)).href;
	const from = navReferrers.get(key);
	if (!from) return;
	navReferrers.delete(key);
	if (e.requestHeaders.referer) return;
	const referer = refererFor(new URL(key), from);
	if (referer) e.requestHeaders.referer = referer;
});

async function handleRequest(event) {
	await scramjet.loadConfig();
	if (scramjet.route(event)) {
		const req = event.request;
		if (req.mode === "navigate" && req.referrer) {
			const target = decodeProxied(req.url);
			const from = decodeProxied(req.referrer);
			if (target && from) navReferrers.set(target.href, from);
		}
		return scramjet.fetch(event);
	}
	return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});

// Active immédiatement une nouvelle version du service worker
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

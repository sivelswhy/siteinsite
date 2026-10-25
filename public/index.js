"use strict";

const $ = (id) => document.getElementById(id);

const home = $("home");
const browser = $("browser");
const searchForm = $("search-form");
const searchInput = $("search-input");
const engine = $("engine");
const error = $("error");
const addressForm = $("address-form");
const address = $("address");
const historyList = $("history-list");
const historyEmpty = $("history-empty");
const suggestions = $("suggestions");
const shortcutList = $("shortcut-list");
const pin = $("nav-pin");
const progress = $("progress");
const frameStatus = $("frame-status");

const HISTORY_KEY = "sis-history";
const ENGINE_KEY = "sis-engine";
const HISTORY_MAX = 100;
const SHORTCUTS_KEY = "sis-shortcuts";
const SHORTCUTS_MAX = 12;
// au-delà, on propose de réessayer ou d'ouvrir le site hors du navigateur intégré
const SLOW_MS = 20000;

// --- Stockage local (sur l'appareil uniquement) ---

function load(key, fallback) {
	try {
		const raw = localStorage.getItem(key);
		return raw === null ? fallback : JSON.parse(raw);
	} catch {
		return fallback;
	}
}

function save(key, value) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// stockage indisponible (navigation privée...) : on ignore
	}
}

const savedEngine = load(ENGINE_KEY, null);
if (savedEngine && [...engine.options].some((o) => o.value === savedEngine))
	engine.value = savedEngine;
engine.addEventListener("change", () => save(ENGINE_KEY, engine.value));

// --- Historique ---

let history = load(HISTORY_KEY, []);

function addToHistory(query) {
	history = history.filter((h) => h.q !== query);
	history.unshift({ q: query, t: Date.now() });
	history = history.slice(0, HISTORY_MAX);
	save(HISTORY_KEY, history);
	renderHistory();
}

function removeFromHistory(t) {
	history = history.filter((h) => h.t !== t);
	save(HISTORY_KEY, history);
	renderHistory();
}

function formatDate(t) {
	return new Date(t).toLocaleString("fr-FR", {
		day: "2-digit",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function renderHistory() {
	historyList.replaceChildren(
		...history.map((h) => {
			const li = document.createElement("li");

			const entry = document.createElement("button");
			entry.className = "entry";
			entry.type = "button";
			entry.textContent = h.q;
			const date = document.createElement("small");
			date.textContent = formatDate(h.t);
			entry.append(date);
			entry.addEventListener("click", () => submit(h.q));

			const remove = document.createElement("button");
			remove.className = "remove";
			remove.type = "button";
			remove.title = "Supprimer";
			remove.setAttribute("aria-label", `Supprimer « ${h.q} »`);
			remove.textContent = "✕";
			remove.addEventListener("click", () => removeFromHistory(h.t));

			li.append(entry, remove);
			return li;
		})
	);
	historyEmpty.hidden = history.length > 0;
	$("history-clear").hidden = history.length === 0;
	renderSuggestions();
}

// Suggestions des champs de saisie : historique puis raccourcis
function renderSuggestions() {
	const values = new Set([...history.map((h) => h.q), ...shortcuts.map((s) => s.url)]);
	suggestions.replaceChildren(
		...[...values].map((v) => {
			const option = document.createElement("option");
			option.value = v;
			return option;
		})
	);
}

$("history-clear").addEventListener("click", () => {
	if (!confirm("Effacer tout l'historique ?")) return;
	history = [];
	save(HISTORY_KEY, history);
	renderHistory();
});

// --- Raccourcis ---

let shortcuts = load(SHORTCUTS_KEY, []);

function shortcutName(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

// Les sites redirigent souvent (wikipedia.org → www.wikipedia.org/) :
// on compare les adresses sans le « www. » ni la barre oblique finale
function urlKey(url) {
	try {
		const u = new URL(url);
		return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "") + u.search;
	} catch {
		return url;
	}
}

function isPinned(url) {
	return shortcuts.some((s) => urlKey(s.url) === urlKey(url));
}

function addShortcut(url) {
	if (isPinned(url)) return;
	if (shortcuts.length >= SHORTCUTS_MAX) {
		alert(`${SHORTCUTS_MAX} raccourcis maximum : supprimez-en un d'abord.`);
		return;
	}
	shortcuts.push({ url, name: shortcutName(url) });
	save(SHORTCUTS_KEY, shortcuts);
	renderShortcuts();
}

function removeShortcut(url) {
	shortcuts = shortcuts.filter((s) => urlKey(s.url) !== urlKey(url));
	save(SHORTCUTS_KEY, shortcuts);
	renderShortcuts();
}

function renderShortcuts() {
	const tiles = shortcuts.map((s) => {
		const li = document.createElement("li");

		const open = document.createElement("button");
		open.className = "tile";
		open.type = "button";
		open.title = s.url;
		const icon = document.createElement("span");
		icon.className = "icon";
		icon.textContent = s.name.charAt(0).toUpperCase();
		const name = document.createElement("span");
		name.className = "name";
		name.textContent = s.name;
		open.append(icon, name);
		open.addEventListener("click", () => submit(s.url));

		const remove = document.createElement("button");
		remove.className = "remove";
		remove.type = "button";
		remove.title = "Supprimer";
		remove.setAttribute("aria-label", `Supprimer le raccourci ${s.name}`);
		remove.textContent = "✕";
		remove.addEventListener("click", () => removeShortcut(s.url));

		li.append(open, remove);
		return li;
	});

	if (shortcuts.length < SHORTCUTS_MAX) {
		const li = document.createElement("li");
		const add = document.createElement("button");
		add.className = "tile add";
		add.type = "button";
		add.innerHTML = '<span class="icon">+</span><span class="name">Ajouter</span>';
		add.addEventListener("click", () => {
			const input = prompt("Adresse du site à ajouter :")?.trim();
			if (!input) return;
			const url = toUrl(input);
			if (url.startsWith(engine.value.split("%s")[0])) {
				alert("Adresse invalide.");
				return;
			}
			addShortcut(url);
		});
		li.append(add);
		tiles.push(li);
	}

	shortcutList.replaceChildren(...tiles);
	updatePin();
	renderSuggestions();
}

function updatePin() {
	const pinned = frame !== null && isPinned(currentUrl());
	pin.textContent = pinned ? "★" : "☆";
	pin.setAttribute("aria-pressed", String(pinned));
	pin.title = pinned ? "Retirer des raccourcis" : "Ajouter aux raccourcis";
	pin.setAttribute("aria-label", pin.title);
}

pin.addEventListener("click", () => {
	if (!frame) return;
	const url = currentUrl();
	if (isPinned(url)) removeShortcut(url);
	else addShortcut(url);
});

// --- Résolution saisie → URL ---

function toUrl(input) {
	try {
		return new URL(input).toString();
	} catch {}
	try {
		const url = new URL(`https://${input}`);
		if (url.hostname.includes(".") && !input.includes(" ")) return url.toString();
	} catch {}
	return engine.value.replace("%s", encodeURIComponent(input));
}

// --- Scramjet ---

const { ScramjetController } = $scramjetLoadController();
// Chemins relatifs à la page : le site peut être servi à la racine (Vercel)
// ou dans un sous-dossier (GitHub Pages : /siteinsite/)
const base = new URL(".", location.href).pathname;

const scramjet = new ScramjetController({
	prefix: base + "scramjet/",
	files: {
		wasm: base + "scram/scramjet.wasm.wasm",
		all: base + "scram/scramjet.all.js",
		sync: base + "scram/scramjet.sync.js",
	},
});
scramjet.init();

const connection = new BareMux.BareMuxConnection(base + "baremux/worker.js");
const transport = base + "libcurl/index.mjs";

// GitHub Pages ne peut pas héberger le relais : on utilise celui de Vercel
const wispUrl = location.hostname.endsWith("github.io")
	? "wss://siteinsite.vercel.app/wisp/"
	: (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";

let frame = null;

function currentUrl() {
	try {
		return frame.url.href;
	} catch {
		// page pas encore chargée
		return address.value;
	}
}

// --- Chargement et erreurs ---

let slowTimer = 0;

function startLoading() {
	clearTimeout(slowTimer);
	hideStatus();
	progress.hidden = false;
	slowTimer = setTimeout(
		() => showStatus("Le site met du temps à répondre."),
		SLOW_MS
	);
}

function stopLoading() {
	clearTimeout(slowTimer);
	progress.hidden = true;
}

function showStatus(text, trace) {
	$("status-text").textContent = text;
	$("status-trace").textContent = trace ?? "";
	$("status-details").hidden = !trace;
	frameStatus.hidden = false;
}

function hideStatus() {
	frameStatus.hidden = true;
}

// Scramjet sert sa propre page d'erreur dans le cadre quand un site ne répond pas
function scramjetError() {
	try {
		const doc = frame.frame.contentDocument;
		if (doc?.getElementById("errorTitle") && doc.getElementById("errorTrace"))
			return doc.getElementById("errorTrace").value || "Erreur inconnue";
	} catch {}
	return null;
}

function onFrameLoad() {
	stopLoading();
	const trace = scramjetError();
	if (trace) showStatus("Ce site ne s'affiche pas correctement ici.", trace);
	updatePin();
}

$("status-retry").addEventListener("click", () => {
	startLoading();
	frame.go(currentUrl());
});
$("status-open").addEventListener("click", () =>
	window.open(currentUrl(), "_blank", "noopener")
);
$("status-dismiss").addEventListener("click", hideStatus);

async function ensureReady() {
	await registerSW();
	if ((await connection.getTransport()) !== transport) {
		await connection.setTransport(transport, [{ websocket: wispUrl }]);
	}
	if (!frame) {
		frame = scramjet.createFrame();
		$("frame-host").append(frame.frame);
		frame.frame.addEventListener("load", onFrameLoad);
		frame.addEventListener("navigate", startLoading);
		frame.addEventListener("urlchange", (e) => {
			if (document.activeElement !== address) address.value = e.url;
			updatePin();
		});
	}
}

// L'URL de la page principale ne change jamais : aucun pushState, aucun paramètre.
async function navigate(url) {
	error.hidden = true;
	try {
		await ensureReady();
	} catch (err) {
		error.textContent = "Impossible de démarrer le navigateur intégré : " + err;
		error.hidden = false;
		return;
	}
	home.hidden = true;
	browser.hidden = false;
	address.value = url;
	startLoading();
	frame.go(url);
	updatePin();
}

function submit(query) {
	query = query.trim();
	if (!query) return;
	addToHistory(query);
	navigate(toUrl(query));
}

searchForm.addEventListener("submit", (e) => {
	e.preventDefault();
	submit(searchInput.value);
	searchInput.value = "";
});

addressForm.addEventListener("submit", (e) => {
	e.preventDefault();
	submit(address.value);
	address.blur();
});

$("nav-back").addEventListener("click", () => frame?.back());
$("nav-forward").addEventListener("click", () => frame?.forward());
$("nav-reload").addEventListener("click", () => {
	if (!frame) return;
	startLoading();
	frame.reload();
});
$("nav-home").addEventListener("click", () => {
	stopLoading();
	hideStatus();
	browser.hidden = true;
	home.hidden = false;
	searchInput.focus();
});

renderHistory();
renderShortcuts();

// Prépare le service worker dès le chargement pour un premier affichage plus rapide
registerSW().catch(() => {});

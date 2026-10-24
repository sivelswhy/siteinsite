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

const HISTORY_KEY = "sis-history";
const ENGINE_KEY = "sis-engine";
const HISTORY_MAX = 100;

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
}

$("history-clear").addEventListener("click", () => {
	if (!confirm("Effacer tout l'historique ?")) return;
	history = [];
	save(HISTORY_KEY, history);
	renderHistory();
});

renderHistory();

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
const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
});
scramjet.init();

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
const wispUrl =
	(location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";

let frame = null;

async function ensureReady() {
	await registerSW();
	if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
		await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
	}
	if (!frame) {
		frame = scramjet.createFrame();
		$("frame-host").append(frame.frame);
		frame.addEventListener("urlchange", (e) => {
			if (document.activeElement !== address) address.value = e.url;
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
	frame.go(url);
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
$("nav-reload").addEventListener("click", () => frame?.reload());
$("nav-home").addEventListener("click", () => {
	browser.hidden = true;
	home.hidden = false;
	searchInput.focus();
});

// Prépare le service worker dès le chargement pour un premier affichage plus rapide
registerSW().catch(() => {});

// Copie les builds Scramjet / libcurl / bare-mux dans public/ pour le service statique
import { cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const pub = fileURLToPath(new URL("../public/", import.meta.url));
for (const [dir, src] of [
	["scram", scramjetPath],
	["libcurl", libcurlPath],
	["baremux", baremuxPath],
]) {
	rmSync(pub + dir, { recursive: true, force: true });
	cpSync(src, pub + dir, { recursive: true });
}
console.log("Assets copiés dans public/");

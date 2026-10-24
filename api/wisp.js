// Relais Wisp : le navigateur ne peut pas ouvrir de connexion TCP brute,
// cette fonction transporte les octets ; tout le reste tourne sur l'appareil.
import http from "node:http";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";

logging.set_level(logging.NONE);
Object.assign(wisp.options, {
	allow_udp_streams: false,
	hostname_blacklist: [/example\.com/],
	dns_servers: ["1.1.1.3", "1.0.0.3"],
});

const server = http.createServer((req, res) => {
	res.writeHead(426, { "Content-Type": "text/plain" });
	res.end("WebSocket requis");
});

server.on("upgrade", (req, socket, head) => {
	// wisp v1 exige un chemin terminé par "/"
	req.url = "/wisp/";
	wisp.routeRequest(req, socket, head);
});

export default server;

# Site in Site

Mini navigateur dans le navigateur : recherche (DuckDuckGo, Google, Bing, Qwant, Ecosia, Startpage) et affichage des sites directement dans la page, avec historique local.

Basé sur [Scramjet-App](https://github.com/MercuryWorkshop/Scramjet-App) (AGPL-3.0).

- La réécriture des pages, le TLS (libcurl en WebAssembly) et le rendu tournent dans le navigateur.
- `api/wisp.js` est une fonction Vercel WebSocket qui relaie uniquement les octets (chiffrés) vers les sites.

## Local

```
npm install
node scripts/copy-assets.js
npm start   # http://localhost:8080
```

## Vercel

Importer le repo : `vercel.json` définit le build et les en-têtes.

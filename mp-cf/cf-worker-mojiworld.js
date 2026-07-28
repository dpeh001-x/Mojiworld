// Cloudflare Worker — serve the Mojiworld game at  moji-studios.com/mojiworld
// by transparently proxying to the GitHub Pages origin and stripping the
// /mojiworld path prefix. Your apex studio site (Cloudflare Pages) is untouched:
// this Worker only runs on the /mojiworld* route you bind it to.
//
// Why a proxy and not a redirect: a redirect would change the address bar to
// play.moji-studios.com. This keeps the URL at moji-studios.com/mojiworld while
// the GitHub Pages site does the actual serving.
//
// Why this works with no HTML rewriting: every local asset in the game is a
// RELATIVE path (anim_calib.js, Sprites/..., backgrounds/...) and the heavy art
// is already absolute jsDelivr URLs. Served under the trailing-slash subpath
// /mojiworld/, the browser requests /mojiworld/<file>, this Worker strips the
// prefix, and the origin returns /<file>. The multiplayer wss:// endpoint is
// absolute too, so it is unaffected.
//
// Deploy: Cloudflare dashboard -> Workers & Pages -> Create Worker -> paste this
// -> Deploy. Then add a Route (see DEPLOY.md step "Path form").

const ORIGIN = 'https://play.moji-studios.com'; // GitHub Pages host that serves the game
const PREFIX = '/mojiworld';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path = url.pathname;

    // Bare /mojiworld -> redirect to /mojiworld/ so the browser resolves the
    // game's relative asset URLs under the subpath, not the apex root.
    if (path === PREFIX) {
      return Response.redirect(url.origin + PREFIX + '/' + url.search, 301);
    }

    // Strip the prefix; everything after it maps onto the origin root.
    if (path.startsWith(PREFIX + '/')) {
      path = path.slice(PREFIX.length); // '/mojiworld/foo.js' -> '/foo.js'
    }

    const originUrl = ORIGIN + path + url.search;
    // Tag our own origin fetch so the play->canonical redirect rule skips it
    // (otherwise that rule would redirect this subrequest too -> infinite loop).
    const headers = new Headers(request.headers);
    headers.set('x-mojiworld-origin', '1');
    const upstream = await fetch(originUrl, {
      method: request.method,
      headers,
      body: (request.method === 'GET' || request.method === 'HEAD') ? undefined : request.body,
      redirect: 'manual',
    });

    // Pass the response through unchanged (no body rewriting needed).
    return new Response(upstream.body, upstream);
  },
};

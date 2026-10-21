// Cloudflare Worker: private media storage for the moodboard, backed by the R2 bucket bound as BUCKET.
// Every request must carry a Supabase access token belonging to OWNER_EMAIL.
const ORIGINS = ['https://www.meissasy.com', 'https://meissasy.com'];
const MAX_BYTES = 100 * 1024 * 1024;
const NAME = /^[A-Za-z0-9._-]{1,200}$/;

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization,Content-Type',
      'Vary': 'Origin',
    };
    const reply = (body, status = 200, extra = {}) => new Response(body, {status, headers: {...cors, ...extra}});
    if (req.method === 'OPTIONS') return reply(null, 204);

    try {
      if (!env.OWNER_EMAIL) return reply('OWNER_EMAIL is not set on the Worker.', 500);
      const who = await fetch(env.SUPABASE_URL + '/auth/v1/user', {
        headers: {apikey: env.SUPABASE_ANON_KEY, Authorization: req.headers.get('Authorization') || ''},
      });
      if (!who.ok) return reply('Not signed in.', 401);
      const user = await who.json();
      if ((user.email || '').toLowerCase() !== env.OWNER_EMAIL.toLowerCase()) return reply('Not allowed.', 403);

      const url = new URL(req.url);

      if (req.method === 'POST' && url.pathname === '/delete') {
        const {paths} = await req.json();
        const keys = (Array.isArray(paths) ? paths : []).filter(p => typeof p === 'string' && p.startsWith(user.id + '/') && NAME.test(p.slice(user.id.length + 1)));
        if (keys.length) await env.BUCKET.delete(keys);
        return reply(JSON.stringify({deleted: keys.length}), 200, {'Content-Type': 'application/json'});
      }

      const m = url.pathname.match(/^\/media\/([0-9a-f-]{36})\/([^/]+)$/);
      if (!m) return reply('Not found.', 404);
      const [, owner, name] = m;
      if (owner !== user.id || !NAME.test(name)) return reply('Not allowed.', 403);
      const key = owner + '/' + name;

      if (req.method === 'PUT') {
        const type = req.headers.get('Content-Type') || '';
        if (!/^(image|video)\//.test(type)) return reply('Only images and videos.', 415);
        if (Number(req.headers.get('Content-Length') || 0) > MAX_BYTES) return reply('File too large (100 MB max).', 413);
        await env.BUCKET.put(key, req.body, {httpMetadata: {contentType: type}});
        return reply('OK');
      }
      if (req.method === 'GET') {
        const obj = await env.BUCKET.get(key);
        if (!obj) return reply('Not found.', 404);
        return reply(obj.body, 200, {'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream', 'Cache-Control': 'private, max-age=3600'});
      }
      return reply('Method not allowed.', 405);
    } catch (e) {
      return reply('Server error: ' + e.message, 500);
    }
  },
};

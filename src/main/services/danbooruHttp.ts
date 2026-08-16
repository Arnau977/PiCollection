/**
 * Danbooru's Cloudflare bot-protection challenges requests carrying a
 * browser-like (or missing) User-Agent with a 403, but passes a plain,
 * honest one straight through - the opposite tradeoff from SauceNAO's own
 * bot protection (see sauceNao.service.ts's own USER_AGENT comment).
 * Shared by every Danbooru request in the app: fetchDanbooruTags,
 * autocompleteDanbooruTags, lookupTagWiki.
 */
export const DANBOORU_USER_AGENT = 'PiCollection (+https://github.com/Arnau977/PiCollection)'

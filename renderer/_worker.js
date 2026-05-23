/**
 * Cloudflare Worker for SPA routing
 * Serves index.html for routes without file extensions
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Skip processing for API calls and files with extensions
    if (
      pathname.startsWith('/api/') ||
      pathname.includes('.') ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/clients') ||
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/execute') ||
      pathname.startsWith('/landing') ||
      pathname.startsWith('/settings') ||
      pathname.startsWith('/billing') ||
      pathname.startsWith('/auth')
    ) {
      // Let the default asset serving handle it
      return env.ASSETS.fetch(request);
    }

    // For routes without extensions, serve index.html for SPA routing
    if (!pathname.includes('.')) {
      const indexRequest = new Request(new URL('/index.html', url), request);
      return env.ASSETS.fetch(indexRequest);
    }

    return env.ASSETS.fetch(request);
  },
};

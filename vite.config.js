import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// connect-src notes:
// - Only loopback Ollama hosts are allowed, matching src/utils/ollamaUrl.js.
//   CSP host-sources cannot express IP ranges (e.g. 192.168.*), so LAN Ollama
//   would require a different mechanism, not more entries here.
// - frame-ancestors is omitted: browsers ignore it in a meta tag. Clickjacking
//   protection must come from an HTTP header at the hosting layer (see README).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.anthropic.com https://api.openai.com" +
    ' http://localhost:* http://127.0.0.1:*',
  "base-uri 'self'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

// Build-only: the dev server relies on inline scripts (react-refresh preamble)
// and injected <style> elements that this policy would block.
function injectCsp() {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  plugins: [react(), injectCsp()],
  test: {
    environment: 'jsdom',
  },
});

// Exact previous comparison function, captured solely to reproduce the false rejection. No remote script is executed.
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const CF_JSD_TEMPLATE = `<script>(function(){function c(){var b=a.contentDocument||(a.contentWindow&&a.contentWindow.document);if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'CF_RAY_VALUE',t:'CF_TIME_VALUE'};var a=document.createElement('script');a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();</script>`;
const CF_JSD = new RegExp(CF_JSD_TEMPLATE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  .replace('CF_RAY_VALUE', '([a-f0-9]{16})').replace('CF_TIME_VALUE', '([A-Za-z0-9+/]{12,24}={0,2})'));
export function normalizeCloudflareIndex(bytes, metadata) {
  if (metadata.repoPath !== 'index.html' || metadata.urlPath !== 'index.html'
      || metadata.statusCode !== 200 || String(metadata.server).toLowerCase() !== 'cloudflare'
      || !/^text\/html(?:\s*;|$)/i.test(metadata.contentType ?? '')
      || metadata.mitigated === 'challenge') return null;
  const source = Buffer.from(bytes).toString('latin1');
  const marker = 'window.__CF$cv$params';
  if (source.indexOf(marker) < 0 || source.indexOf(marker) !== source.lastIndexOf(marker)) return null;
  const match = source.match(CF_JSD);
  if (!match || source.slice(match.index + match[0].length, match.index + match[0].length + 7) !== '</body>') return null;
  const timestamp = Buffer.from(match[2], 'base64');
  if (!/^[0-9]{10}$/.test(timestamp.toString('ascii')) || timestamp.toString('base64') !== match[2]) return null;
  const normalized = Buffer.concat([Buffer.from(bytes).subarray(0, match.index), Buffer.from(bytes).subarray(match.index + match[0].length)]);
  return { normalization: 'cloudflare-jsd-v1', normalizedSha256: hash(normalized), normalizedBytes: normalized.length,
    removedProviderBytes: match[0].length, removedSha256: hash(Buffer.from(match[0], 'latin1')) };
}


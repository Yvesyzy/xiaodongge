import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const policy = JSON.parse(readFileSync(new URL('../mobile/src/codex_privacy_policy.json', import.meta.url), 'utf8'));
const output = new URL('../mobile/public/codex_privacy_policy.html', import.meta.url);
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const sections = policy.sections.map((section, index) => `<section id="section-${index + 1}"><h2>${escape(section.title)}</h2><p>${escape(section.text)}</p>${section.links?.length ? `<ul>${section.links.map(link => `<li><a href="${escape(link.url)}" rel="noopener noreferrer">${escape(link.label)}</a></li>`).join('')}</ul>` : ''}</section>`).join('\n');
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(policy.title)}</title>
<style>body{max-width:48rem;margin:auto;padding:24px;font:17px/1.9 system-ui,sans-serif;color:#203c30;background:#f6f4ec}h1{font-size:1.7rem}h2{font-size:1.2rem;margin-top:2rem}a{color:#245448}p{overflow-wrap:anywhere}@media(prefers-color-scheme:dark){body{color:#e9e7de;background:#0b0f0d}a{color:#bcd2c0}}</style></head>
<body><main><h1>${escape(policy.title)}</h1><p>生效及更新日期：${escape(policy.version)}<br>运营主体：${escape(policy.publisherType)}<br>隐私咨询：<a href="mailto:${escape(policy.contactEmail)}">${escape(policy.contactEmail)}</a></p>
${sections}
</main></body></html>
`;
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== html) throw new Error('Privacy HTML differs from the in-app policy; run node scripts/codex_build_privacy_policy.mjs');
  console.log('PASS privacy HTML matches the in-app policy');
} else {
  writeFileSync(output, html, 'utf8');
  console.log(fileURLToPath(output));
}

const { check } = require('@shopify/theme-check-node');
const path = require('path');
(async () => {
  const root = path.resolve(process.argv[2]);
  const offenses = await check(root);
  const sev = ['ERROR', 'WARN', 'INFO'];
  const counts = {};
  for (const o of offenses) {
    const s = sev[o.severity] || o.severity;
    counts[s] = (counts[s] || 0) + 1;
    console.log(`${s}\t${o.check}\t${o.uri.replace('file://' + root + '/', '')}:${o.start ? o.start.line + 1 : ''}\t${o.message}`);
  }
  console.log('TOTAL', offenses.length, JSON.stringify(counts));
})().catch((e) => { console.error(e); process.exit(2); });

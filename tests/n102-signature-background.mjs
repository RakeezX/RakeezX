import { spawn } from 'node:child_process';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { withIsolatedLocalBrowser } from '../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { seed } from './n24-fixture.mjs';

const taskId = 'continuous-n102-report-signature-paper-background-20261015';
const runId = '311a411f-94b9-41b7-91f9-7509395afa21';
const taskFile = `C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/${taskId}.json`;

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

const port = await freePort();
const url = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Vite exited before readiness: ${server.exitCode}`);
    try { ready = (await fetch(url)).ok; } catch {}
    if (ready) break;
    await delay(250);
  }
  if (!ready) throw new Error('Owned Vite server did not become ready');

  const result = await withIsolatedLocalBrowser({ taskFile, runId, url, timeoutMs: 90000 }, async ({ createContext }) => {
    const context = await createContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto(`${url}/#/classes`);
    await page.waitForFunction(() => window.store);
    const observed = [];
    for (const count of [5, 6]) {
      await seed(page, { count, sessions: 2 });
      await page.evaluate(async () => {
        const store = await import('/src/store.js');
        await store.patchProfile({ teacherName: 'معلمة تجريبية', teacherForm: 'feminine', schoolName: 'مدرسة تجريبية', reportPrincipalName: 'مديرة تجريبية', principalName: 'مديرة تجريبية' });
        window.store.repaint();
      });
      await page.goto(`${url}/#/teaching/print-teaching/reports`);
      await page.reload();
      await page.waitForSelector('.report-workspace');
      await page.locator('[data-act="tab"][data-tab="grades"]').click();
      await page.locator('[data-act="toggle-a4"]').click();
      const sheet = page.locator('.a4-sheet');
      await sheet.waitFor();
      const screen = await sheet.evaluate(root => {
        const closing = root.querySelector('.report-ending-row > td');
        const signatures = [...root.querySelectorAll('.print-signatures > div')];
        const lastRow = root.querySelector('.report-table-ending > tr:first-child');
        return {
          closingBackground: getComputedStyle(closing).backgroundColor,
          signatureCount: signatures.length,
          signatureText: signatures.map(node => node.innerText.trim()),
          signatureLines: signatures.map(node => [getComputedStyle(node).borderTopStyle, getComputedStyle(node).borderTopWidth]),
          zebra: [...root.querySelectorAll('.report-table-ending > tr:first-child td')].map(node => getComputedStyle(node).backgroundColor),
          lastRowBackground: getComputedStyle(lastRow.querySelector('td')).backgroundColor,
          pageSetup: document.querySelector('[data-report-page-size]').textContent.match(/@page\s*\{\s*size:\s*([^;]+)/)?.[1],
        };
      });
      if (screen.closingBackground && screen.closingBackground !== 'rgba(0, 0, 0, 0)') throw new Error(`Signature panel is shaded in screen preview: ${screen.closingBackground}`);
      if (screen.signatureCount !== 2 || screen.signatureText.some(text => !text) || screen.signatureLines.some(([style, width]) => style !== 'solid' || width !== '1px')) throw new Error(`Signature names or dividing lines are missing: ${JSON.stringify(screen)}`);

      await page.emulateMedia({ media: 'print' });
      const print = await sheet.locator('.report-ending-row > td').evaluate(node => ({
        background: getComputedStyle(node).backgroundColor,
        signatures: [...node.querySelectorAll('.print-signatures > div')].map(block => ({
          text: block.innerText.trim(), border: getComputedStyle(block).borderTopStyle,
        })),
          zebra: [...node.closest('table').tBodies[0].rows].map(row => getComputedStyle(row.cells[0]).backgroundColor),
          endingRowBackground: getComputedStyle(node.closest('table').querySelector('.report-table-ending > tr:first-child td')).backgroundColor,
      }));
      if (print.background !== 'rgba(0, 0, 0, 0)') throw new Error(`Signature panel is shaded in print: ${print.background}`);
      if (print.signatures.length !== 2 || print.signatures.some(block => !block.text || block.border !== 'solid')) throw new Error('Printed signature blocks or lines are missing');
      if (print.zebra.length < 2 || print.zebra.some((color, index) => color !== (index % 2 === 0 ? 'rgb(255, 255, 255)' : 'rgb(248, 250, 249)'))) throw new Error(`Print table zebra changed: ${print.zebra.join(',')}`);
      const expectedEnding = count % 2 === 0 ? 'rgb(248, 250, 249)' : 'rgb(255, 255, 255)';
      if (print.endingRowBackground !== expectedEnding) throw new Error(`Last data row zebra changed for ${count} rows: ${print.endingRowBackground}`);
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
      if (pdf.length < 1000) throw new Error('Print PDF output is unexpectedly empty');
      const pdfPages = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;
      if (pdfPages !== 1) throw new Error(`Unexpected blank or extra print page for ${count} rows: ${pdfPages}`);
      observed.push({ count, screen, print: { ...print, pdfBytes: pdf.length, pdfPages } });
      await page.emulateMedia({ media: 'screen' });
    }
    return observed;
  });
  const evidencePath = 'docs/automation-evidence/20261015/N102_SIGNATURE_PAPER_BACKGROUND.md';
  const { writeFile } = await import('node:fs/promises');
  await writeFile(evidencePath, `# N102 signature paper background\n\nRun ${runId}; synthetic actual-app browser evidence on ${url}.\n\n\`n102-signature-background.mjs\` passed for odd/even class sizes (5 and 6): screen A4 preview and print both show a transparent closing cell; both signature labels/names and divider lines remain; the final real data row keeps its zebra fill and each PDF contains exactly one page. Existing reportPageSetup CSS was inspected and unchanged.\n\nObserved: \`${JSON.stringify(result)}\`\n`, 'utf8');
  await writeFile('tests/n102-signature-background.json', `${JSON.stringify({ runId, actualApplication: true, synthetic: true, checks: result }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ pass: true, evidencePath, result }));
} finally {
  if (server.exitCode === null) {
    server.kill();
    await Promise.race([new Promise(resolve => server.once('exit', resolve)), delay(5000)]);
  }
}

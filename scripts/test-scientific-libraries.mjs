import { chromium } from '@playwright/test';
import { readdir, readFile, mkdir } from 'node:fs/promises';

const runtimeUrl = process.env.ARHIMED_SCIENCE_RUNTIME_URL ?? 'http://127.0.0.1:4185/cross-origin-runtime.html';
const sources = await Promise.all((await readdir('examples/science')).filter(name => name.endsWith('.py')).sort().map(async name => ({ name, source: await readFile(`examples/science/${name}`, 'utf8') })));
const browser = await chromium.launch({ channel: process.env.ARHIMED_SCIENCE_BROWSER ?? 'chrome', args: ['--disable-features=LocalNetworkAccessChecks'] });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  page.on('console', message => { if (message.type() === 'error') console.error(message.text().slice(0, 400)); });
  page.on('pageerror', error => console.error(error.message));
  const failedRequests = [];
  page.on('requestfailed', request => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));
  const network = [];
  page.on('request', request => network.push(request.url()));
  await page.route('http://127.0.0.1:4184/science-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body>Scientific libraries acceptance</body>' }));
  await page.goto('http://127.0.0.1:4184/science-test.html');
  await page.evaluate(async runtimeUrl => {
    const protocol = 'arhimed-runtime-v1', sessionId = crypto.randomUUID();
    const frame = document.createElement('iframe');
    frame.id = 'science-runtime';
    frame.style = 'width:900px;height:650px';
    const channel = new MessageChannel();
    const state = { port: channel.port1, protocol, sessionId, revision: 0, events: [] };
    window.scienceTest = state;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Channel timeout')), 30000);
      channel.port1.onmessage = ({ data }) => { state.events.push(data); if (data.kind === 'ready') { clearTimeout(timer); resolve(); } };
      frame.onload = () => frame.contentWindow.postMessage({ protocol, sessionId, kind: 'connect' }, new URL(runtimeUrl).origin, [channel.port2]);
      frame.src = runtimeUrl;
      document.body.append(frame);
    });
  }, runtimeUrl);
  await mkdir('test-results/science', { recursive: true });
  for (const { name, source } of sources) {
    const started = Date.now();
    const event = await page.evaluate(async source => {
      const state = window.scienceTest;
      const revision = ++state.revision;
      state.port.postMessage({ protocol: state.protocol, sessionId: state.sessionId, revision, requestId: `science-${revision}`, kind: 'run', source });
      return await new Promise((resolve, reject) => {
        const started = performance.now();
        const timer = setInterval(() => {
          const event = state.events.find(event => event.revision === revision && ['rendered', 'failed', 'rejected'].includes(event.kind));
          if (event) { clearInterval(timer); event.kind === 'rendered' ? resolve(event) : reject(new Error(JSON.stringify(event))); }
          else if (performance.now() - started > 150000) { clearInterval(timer); reject(new Error('Scene timeout: ' + JSON.stringify(state.events))); }
        }, 50);
      });
    }, source);
    const frame = page.frames().find(frame => frame.url().startsWith(runtimeUrl));
    if (!frame) throw new Error('Runtime frame missing');
    await frame.waitForFunction(() => document.querySelector('manimgx-player')?.duration >= 7, { timeout: 30000 });
    await frame.evaluate(async () => {
      const player = document.querySelector('manimgx-player');
      player.pause(); player.currentTime = Math.min(7.5, player.duration);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await frame.locator('manimgx-player').screenshot({ path: `test-results/science/${name}.png` });
    console.log(`${name}: real Python/WebGPU rendered in ${Date.now() - started}ms; ${JSON.stringify(event.data)}`);
  }
  // Fixed packages must never make the runtime contact CDNs or package registries.
  const unexpected = network.filter(url => !url.startsWith('http://127.0.0.1:4184/') && !url.startsWith(new URL(runtimeUrl).origin + '/') && !url.startsWith('blob:') && !url.startsWith('data:'));
  if (unexpected.length || failedRequests.length) throw new Error(JSON.stringify({ unexpected, failedRequests }));
  console.log(`${sources.length} scientific lessons passed without external package requests.`);
} finally { await browser.close(); }

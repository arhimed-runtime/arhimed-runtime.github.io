import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
// Requires a parent preview at :4184 and a runtime preview at :4185 (or the URL below).
const runtimeUrl = process.env.ARHIMED_MP4_RUNTIME_URL ?? 'http://127.0.0.1:4185/cross-origin-runtime.html';
// Chrome's localhost network checks otherwise block the routed test parent.
// This flag affects only this test browser; production CSP and origins stay intact.
const browser = await chromium.launch({ channel: process.env.ARHIMED_MP4_BROWSER ?? 'chrome', args: ['--disable-features=LocalNetworkAccessChecks'] });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  page.on('pageerror', error => console.error('PAGE ERROR', error.message));
  page.on('console', message => console.log('BROWSER', message.type(), message.text().slice(0, 500)));
  page.on('requestfailed', request => console.log('REQUEST FAILED', request.url(), request.failure()));
  page.on('framenavigated', frame => console.log('FRAME', frame.url()));
  await page.route('http://127.0.0.1:4184/mp4-smoke.html', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><body>MP4 smoke test</body>',
  }));
  await page.goto('http://127.0.0.1:4184/mp4-smoke.html');
  const result = await page.evaluate(async (runtimeUrl) => {
    const frame = document.createElement('iframe');
    frame.style = 'width:800px;height:600px';
    const channel = new MessageChannel();
    const sessionId = crypto.randomUUID();
    const protocol = 'arhimed-runtime-v1';
    const events = [];
    const send = (kind, extra = {}) => channel.port1.postMessage({ protocol, sessionId, revision: 1, requestId: kind, kind, ...extra });
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Runtime/export timeout: ' + JSON.stringify(events))), 120000);
      channel.port1.onmessage = async ({ data: event }) => {
        try {
        events.push({ kind: event.kind, detail: event.detail, capabilities: event.capabilities });
        console.log('MP4 EVENT', event.kind, event.detail);
        if (event.kind === 'failed' || event.kind === 'rejected') { clearTimeout(timer); reject(new Error(JSON.stringify(events))); }
        if (event.kind === 'ready') {
          if (!event.capabilities?.mp4Export) { clearTimeout(timer); reject(new Error('MP4 not advertised')); return; }
          send('run', { source: 'import manimgx as m\nclass Mp4Scene(m.Scene):\n    def construct(self):\n        square = m.Square(color=m.YELLOW, fill_opacity=1).scale(0.4).shift(m.LEFT * 2)\n        self.add(square)\n        self.play(square.animate.shift(m.RIGHT * 4), run_time=1)\n        self.wait(0.1)\n' });
        }
        if (event.kind === 'rendered') send('export-mp4', { fps: 30 });
        if (event.kind === 'exported') {
          const video = document.createElement('video');
          video.preload = 'auto';
          document.body.append(video);
          video.muted = true;
          video.src = URL.createObjectURL(new Blob([event.data], { type: 'video/mp4' }));
          await new Promise((ok, fail) => { video.onloadeddata = ok; video.onerror = fail; setTimeout(() => fail(new Error('Video decode timeout')), 15000); });
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          const samples = [];
          for (const time of [0.1, 0.8]) {
            // seeked can precede presentation of the newly decoded frame.
            await new Promise(ok => { video.requestVideoFrameCallback(() => ok()); video.currentTime = time; });
            context.drawImage(video, 0, 0);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            let count = 0, sumX = 0;
            for (let i = 0; i < pixels.length; i += 4) {
              if (pixels[i] > 150 && pixels[i + 1] > 130 && pixels[i + 2] < 140) { count++; sumX += (i / 4) % canvas.width; }
            }
            samples.push({ time, count, x: sumX / count });
          }
          clearTimeout(timer);
          URL.revokeObjectURL(video.src);
          resolve({ events, width: video.videoWidth, height: video.videoHeight, duration: video.duration, samples, bytes: Array.from(new Uint8Array(event.data)) });
        }
        } catch (error) { clearTimeout(timer); reject(error); }
      };
      frame.onload = () => frame.contentWindow.postMessage({ protocol, kind: 'connect', sessionId }, new URL(runtimeUrl).origin, [channel.port2]);
      frame.src = runtimeUrl;
      document.body.append(frame);
    });
  }, runtimeUrl);
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/manimgx-real-export.mp4', Buffer.from(result.bytes));
  delete result.bytes;
  console.log(JSON.stringify(result, null, 2));
  if (result.samples.some(sample => sample.count < 100) || result.samples[1].x - result.samples[0].x < 50) throw new Error('Export pixels did not contain the moving square');
  if (result.width !== 800 || result.height !== 600 || Math.abs(result.duration - 1.1) > 1 / 30 + 0.001) throw new Error('Unexpected MP4 dimensions or duration');
} finally { await browser.close(); }

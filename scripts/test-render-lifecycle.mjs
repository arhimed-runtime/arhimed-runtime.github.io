import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const runtimeUrl = process.env.ARHIMED_LIFECYCLE_RUNTIME_URL ?? 'http://127.0.0.1:4185/cross-origin-runtime.html';
const browser = await chromium.launch({ channel: process.env.ARHIMED_LIFECYCLE_BROWSER ?? 'chrome', args: ['--disable-features=LocalNetworkAccessChecks'] });
const scene = 'import manimgx as m\nclass Lesson(m.Scene):\n    def construct(self):\n        print("lesson stdout")\n        self.play(m.Create(m.Circle()), run_time=1)\n        self.wait(0.5)\n';
try {
  const page = await browser.newPage();
  await page.route('http://127.0.0.1:4184/lifecycle.html', route => route.fulfill({ contentType:'text/html', body:'<!doctype html><body>Lifecycle test</body>' }));
  await page.goto('http://127.0.0.1:4184/lifecycle.html');
  async function connect() {
    await page.evaluate(async runtimeUrl => {
      document.querySelector('iframe')?.remove();
      const frame=document.createElement('iframe'); frame.style='width:800px;height:600px';
      const channel=new MessageChannel(), sessionId=crypto.randomUUID();
      window.lifecycle={ port:channel.port1, sessionId, revision:0, events:[] };
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('Connection timeout')),30000);
        channel.port1.onmessage=({data})=>{window.lifecycle.events.push(data); if(data.kind==='ready'){clearTimeout(timer);resolve();}};
        frame.onload=()=>frame.contentWindow.postMessage({protocol:'arhimed-runtime-v1',kind:'connect',sessionId},new URL(runtimeUrl).origin,[channel.port2]);
        frame.src=runtimeUrl;document.body.append(frame);
      });
    }, runtimeUrl);
  }
  async function run(source) {
    return page.evaluate(async source => {
      const state=window.lifecycle, revision=++state.revision;
      state.port.postMessage({protocol:'arhimed-runtime-v1',sessionId:state.sessionId,revision,requestId:`run-${revision}`,kind:'run',source});
      return await new Promise((resolve,reject)=>{
        const started=performance.now();
        const timer=setInterval(()=>{
          const events=state.events.filter(event=>event.revision===revision);
          if(events.some(event=>['failed','rendered','rejected'].includes(event.kind))){clearInterval(timer);resolve(events);}
          else if(performance.now()-started>120000){clearInterval(timer);reject(new Error('Render timeout'));}
        },25);
      });
    },source);
  }
  await connect();
  let events=await run(scene);
  assert(events.some(event=>event.kind==='status'&&event.detail.includes('Загрузка Python')));
  assert(events.some(event=>event.kind==='status'&&event.detail.includes('WebGPU')));
  console.log('Cold-start phases are reported to the Studio parent.');
  assert(events.some(event=>event.kind==='render-log'&&event.stream==='stdout'&&event.detail.includes('lesson stdout')));
  assert(events.find(event=>event.kind==='rendered').data.duration>=1.5);
  console.log('Complete scene construction and Python stdout verified.');
  events=await run(scene.replace('        self.wait(0.5)', '        raise ValueError("after first frame")'));
  assert(events.some(event=>event.kind==='failed'&&event.detail.includes('after first frame')));
  assert(!events.some(event=>event.kind==='rendered'));
  console.log('Exception after an initial animation is failed, never completed.');
  events=await run(scene.replace('        self.wait(0.5)', '        raise MemoryError("controlled memory failure")'));
  assert(events.some(event=>event.kind==='failed'&&event.detail.includes('MemoryError')));
  console.log('Critical Python failure delivered with traceback.');
  await connect();
  await run(scene);
  const runtime=page.frames().find(frame=>frame.url().startsWith(runtimeUrl));
  await runtime.evaluate(()=>{const player=document.querySelector('manimgx-player');player.pause();player.currentTime=0.25;});
  const cancellation=await page.evaluate(async()=>{
    const state=window.lifecycle, requestId='export-cancel-test';
    state.port.postMessage({protocol:'arhimed-runtime-v1',sessionId:state.sessionId,revision:state.revision,requestId,kind:'export-mp4',fps:30});
    let cancelled=false;
    return await new Promise((resolve,reject)=>{
      const started=performance.now();
      const timer=setInterval(()=>{
        const events=state.events.filter(event=>event.requestId===requestId);
        if(!cancelled&&events.some(event=>event.kind==='export-progress')){
          cancelled=true;state.port.postMessage({protocol:'arhimed-runtime-v1',sessionId:state.sessionId,revision:state.revision,requestId,kind:'cancel-export'});
        }
        if(events.some(event=>event.kind==='export-cancelled')){clearInterval(timer);resolve(events);}
        else if(performance.now()-started>30000){clearInterval(timer);reject(new Error('Cancellation timeout'));}
      },10);
    });
  });
  assert(!cancellation.some(event=>event.kind==='exported'));
  assert.equal(await runtime.evaluate(()=>document.querySelector('manimgx-player').currentTime),0.25);
  console.log('Export cancellation acknowledged; preview time restored.');
  await page.evaluate(source=>{
    const state=window.lifecycle;
    state.port.postMessage({protocol:'arhimed-runtime-v1',sessionId:state.sessionId,revision:++state.revision,requestId:'infinite',kind:'run',source});
  }, scene.replace('        self.wait(0.5)', '        print("entering loop")\n        while True:\n            pass'));
  await page.waitForFunction(()=>window.lifecycle.events.some(event=>event.requestId==='infinite'&&event.kind==='render-log'&&event.detail.includes('entering loop')));
  await connect(); // Destroys the iframe owning the busy Python Worker.
  events=await run(scene);
  assert(events.some(event=>event.kind==='rendered'));
  console.log('Busy Python context destroyed; a fresh runtime renders successfully.');
} finally { await browser.close(); }

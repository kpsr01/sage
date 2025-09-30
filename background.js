// Background service worker to proxy transcript fetches, avoiding page-origin CORS
const onMessage = (message, sender, sendResponse) => {
  if (message?.type === 'FETCH_TRANSCRIPT') {
    const { videoId, config } = message.payload || {};
    console.log('[BG] Proxying transcript fetch for videoId:', videoId);
    fetch('https://sage-server.vercel.app/api/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, config })
    })
      .then(async (resp) => {
        const text = await resp.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
        console.log('[BG] Transcript response status:', resp.status);
        sendResponse({ ok: resp.ok, status: resp.status, data });
      })
      .catch((err) => {
        console.error('[BG] Transcript fetch error:', err);
        sendResponse({ ok: false, error: err?.message || String(err) });
      });
    return true; // keep message channel open for async response
  }
};

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener(onMessage);
}
if (typeof browser !== 'undefined' && browser.runtime?.onMessage) {
  browser.runtime.onMessage.addListener((msg, sender) => new Promise((resolve) => onMessage(msg, sender, resolve)));
}

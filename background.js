// Background service worker to proxy transcript fetches, avoiding page-origin CORS
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'FETCH_TRANSCRIPT') {
    const { videoId, config } = message.payload || {};
    fetch('https://sage-server.vercel.app/api/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, config })
    })
      .then(async (resp) => {
        const text = await resp.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
        sendResponse({ ok: resp.ok, status: resp.status, data });
      })
      .catch((err) => {
        sendResponse({ ok: false, error: err?.message || String(err) });
      });
    return true; // keep message channel open for async response
  }
});

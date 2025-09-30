const TRANSCRIPT_BASE_URL = 'https://sage-serv.vercel.app/api/transcript';

const extensionAPI = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : null);

async function fetchTranscriptFromServer(videoId, lang = 'en') {
  if (!videoId) {
    return { error: 'Missing video identifier' };
  }

  const transcriptUrl = new URL(TRANSCRIPT_BASE_URL);
  transcriptUrl.searchParams.set('videoId', videoId);
  if (lang) {
    transcriptUrl.searchParams.set('lang', lang);
  }

  let response;
  let errorDetails = null;

  try {
    response = await fetch(transcriptUrl.toString(), {
      method: 'GET',
      credentials: 'omit'
    });
  } catch (getError) {
    errorDetails = getError;
  }

  if ((!response || !response.ok) && !errorDetails) {
    try {
      response = await fetch(TRANSCRIPT_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videoId,
          config: {
            lang,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
          }
        }),
        credentials: 'omit'
      });
    } catch (postError) {
      errorDetails = postError;
    }
  }

  if (errorDetails) {
    return {
      fallback: true,
      error: errorDetails.message || 'Failed to contact transcript service'
    };
  }

  if (!response) {
    return {
      fallback: true,
      error: 'Transcript service is unavailable'
    };
  }

  if (response.ok) {
    try {
      const data = await response.json();
      return {
        data: data.plainText,
        structured: data.transcript,
        language: data.metadata?.language,
        isGenerated: data.metadata?.isGenerated,
        totalEntries: data.metadata?.segmentCount
      };
    } catch (parseError) {
      return {
        fallback: true,
        error: parseError.message || 'Unable to parse transcript response'
      };
    }
  }

  let errorResponse = null;
  try {
    errorResponse = await response.json();
  } catch (parseError) {
    // Ignore parse errors here; we may still want to fall back.
  }

  if (errorResponse?.error) {
    return {
      error: errorResponse.error
    };
  }

  return {
    fallback: true,
    error: `Transcript service responded with status ${response.status}`
  };
}

if (extensionAPI?.runtime?.onMessage) {
  extensionAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'FETCH_TRANSCRIPT') {
      return undefined;
    }

    fetchTranscriptFromServer(message.videoId, message.lang)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({ fallback: true, error: error.message || 'Transcript request failed' });
      });

    return true;
  });
} else {
  console.warn('Transcript background worker could not access the extension runtime APIs.');
}

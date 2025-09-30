module.exports = async function handler(req, res) {
  // Dynamic import for ES module
  const { fetchTranscript } = await import('youtube-transcript-plus');
  // CORS: reflect origin and handle preflight robustly
  const origin = req.headers.origin || '*';
  res.setHeader('Vary', 'Origin');
  if (origin && origin !== 'null') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  const acrh = req.headers['access-control-request-headers'];
  res.setHeader('Access-Control-Allow-Headers', acrh || 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { videoId, config = {} } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ error: 'Missing videoId parameter' });
    }



    // Default configuration - prefer English, use a browser-like user agent
    const defaultConfig = {
      lang: 'en',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ...config
    };

    try {
      // Use youtube-transcript-plus to fetch transcript
      const transcriptArray = await fetchTranscript(videoId, defaultConfig);

      if (!transcriptArray || transcriptArray.length === 0) {
        return res.status(404).json({ 
          error: 'No transcript data found for this video',
          videoId: videoId 
        });
      }

      // Format the response similar to the original API structure
      const formattedTranscript = transcriptArray.map(item => ({
        text: item.text,
        start: item.offset,
        duration: item.duration
      }));

      // Create plain text version
      const plainText = transcriptArray.map(item => item.text).join(' ');

      const responseData = {
        success: true,
        videoId: videoId,
        transcript: formattedTranscript,
        plainText: plainText,
        metadata: {
          language: transcriptArray[0]?.lang || defaultConfig.lang,
          isGenerated: true, // youtube-transcript-plus typically gets auto-generated transcripts
          segmentCount: transcriptArray.length,
          totalLength: plainText.length,
          duration: transcriptArray.reduce((total, item) => total + (item.duration || 0), 0)
        }
      };



      return res.status(200).json(responseData);

    } catch (transcriptError) {
      console.error('youtube-transcript-plus error:', transcriptError);
      
      // Handle specific error types from youtube-transcript-plus
      let errorMessage = 'Failed to fetch transcript';
      let statusCode = 500;

      if (transcriptError.name === 'YoutubeTranscriptVideoUnavailableError') {
        errorMessage = 'Video is unavailable or has been removed';
        statusCode = 404;
      } else if (transcriptError.name === 'YoutubeTranscriptDisabledError') {
        errorMessage = 'Transcripts are disabled for this video';
        statusCode = 403;
      } else if (transcriptError.name === 'YoutubeTranscriptNotAvailableError') {
        errorMessage = 'No transcript is available for this video';
        statusCode = 404;
      } else if (transcriptError.name === 'YoutubeTranscriptNotAvailableLanguageError') {
        errorMessage = `Transcript is not available in the requested language: ${defaultConfig.lang}`;
        statusCode = 404;
      } else if (transcriptError.name === 'YoutubeTranscriptTooManyRequestError') {
        errorMessage = 'Too many requests. Please try again later';
        statusCode = 429;
      } else if (transcriptError.name === 'YoutubeTranscriptInvalidVideoIdError') {
        errorMessage = 'Invalid video ID or URL provided';
        statusCode = 400;
      }

      return res.status(statusCode).json({ 
        error: errorMessage,
        videoId: videoId,
        errorType: transcriptError.name || 'UnknownError',
        details: transcriptError.message
      });
    }
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
}

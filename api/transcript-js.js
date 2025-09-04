const { YoutubeTranscript } = require('youtube-transcript');

module.exports = async (req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { videoId } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ error: 'Missing videoId parameter' });
    }

    console.log('Fetching transcript for video ID:', videoId);

    // Fetch transcript using youtube-transcript
    try {
      const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'en', // Try English first
        country: 'US'
      });

      // Format transcript as plain text
      const transcript = transcriptArray.map(item => item.text).join(' ');

      // Also provide structured data with timestamps
      const structured_transcript = transcriptArray.map(item => ({
        text: item.text,
        start: item.offset / 1000, // Convert to seconds
        duration: item.duration / 1000 // Convert to seconds
      }));

      const response_data = {
        transcript: transcript,
        structured_transcript: structured_transcript,
        language_code: 'en',
        is_generated: true, // youtube-transcript typically gets auto-generated ones
        total_entries: transcriptArray.length
      };

      console.log('Transcript fetched successfully:', {
        videoId,
        transcriptLength: transcript.length,
        totalEntries: transcriptArray.length
      });

      return res.status(200).json(response_data);

    } catch (transcriptError) {
      console.error('Transcript fetch error:', transcriptError);
      
      let error_message = 'No transcript available for this video';
      
      if (transcriptError.message) {
        const errorMsg = transcriptError.message.toLowerCase();
        if (errorMsg.includes('transcript') && errorMsg.includes('disabled')) {
          error_message = 'Transcripts are disabled for this video';
        } else if (errorMsg.includes('not available') || errorMsg.includes('no transcript')) {
          error_message = 'No transcript available for this video';
        } else if (errorMsg.includes('private') || errorMsg.includes('unavailable')) {
          error_message = 'Video is unavailable or private';
        } else if (errorMsg.includes('not found')) {
          error_message = 'Video not found';
        }
      }

      return res.status(404).json({ error: error_message });
    }
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
};

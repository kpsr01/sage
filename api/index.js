import { LLMService } from './llmService.js';

export default async (req, res) => {
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
    const { query, videoData } = req.body;
    
    console.log('🔍 DEBUG API: Received request:', {
      hasQuery: !!query,
      hasVideoData: !!videoData,
      transcriptLength: videoData?.transcript?.length || 0,
      hasTranscriptError: !!videoData?.transcriptError,
      transcriptError: videoData?.transcriptError,
      transcriptPreview: videoData?.transcript?.substring(0, 100) + '...'
    });
    
    if (!query || !videoData) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const llmService = new LLMService();
    const answer = await llmService.answerQuery(query, videoData);

    if (answer.startsWith('Error:')) {
      return res.status(500).json({ error: 'Internal server error', details: answer });
    }
    
    return res.status(200).json({ answer });
  } catch (error) {
    console.error('API Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    });
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}; 
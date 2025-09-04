from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter
import json
from urllib.parse import urlparse, parse_qs

def handler(request):
    # Set CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    }
    
    # Handle preflight requests
    if request.method == 'OPTIONS':
        return ('', 200, headers)
    
    if request.method != 'POST':
        return (json.dumps({'error': 'Method not allowed'}), 405, headers)
    
    try:
        # Parse request body
        if hasattr(request, 'get_json'):
            data = request.get_json()
        else:
            import json
            data = json.loads(request.data.decode('utf-8'))
        
        video_id = data.get('videoId')
        if not video_id:
            return (json.dumps({'error': 'Missing videoId parameter'}), 400, headers)
        
        # Fetch transcript using youtube-transcript-api
        try:
            # Try to get transcript in English first
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            
            # Look for English transcript
            transcript = None
            language_code = 'en'
            is_generated = False
            
            try:
                # Try manually created English transcript first
                transcript = transcript_list.find_transcript(['en'])
                language_code = 'en'
                is_generated = False
            except:
                try:
                    # Try generated English transcript
                    transcript = transcript_list.find_generated_transcript(['en'])
                    language_code = 'en'
                    is_generated = True
                except:
                    # Fall back to any available transcript
                    available_transcripts = list(transcript_list)
                    if available_transcripts:
                        transcript = available_transcripts[0]
                        language_code = transcript.language_code
                        is_generated = transcript.is_generated
                    else:
                        return (json.dumps({
                            'error': 'No transcript available for this video'
                        }), 404, headers)
            
            # Fetch the actual transcript data
            transcript_data = transcript.fetch()
            
            # Format transcript as plain text
            formatter = TextFormatter()
            text_transcript = formatter.format_transcript(transcript_data)
            
            # Also provide structured data with timestamps
            structured_transcript = []
            for entry in transcript_data:
                structured_transcript.append({
                    'text': entry['text'],
                    'start': entry['start'],
                    'duration': entry['duration']
                })
            
            response_data = {
                'transcript': text_transcript,
                'structured_transcript': structured_transcript,
                'language_code': language_code,
                'is_generated': is_generated,
                'total_entries': len(transcript_data)
            }
            
            return (json.dumps(response_data), 200, headers)
            
        except Exception as transcript_error:
            error_message = str(transcript_error)
            if 'TranscriptsDisabled' in error_message:
                error_message = 'Transcripts are disabled for this video'
            elif 'NoTranscriptFound' in error_message:
                error_message = 'No transcript available for this video'
            elif 'VideoUnavailable' in error_message:
                error_message = 'Video is unavailable or private'
            
            return (json.dumps({
                'error': error_message
            }), 404, headers)
            
    except Exception as e:
        return (json.dumps({
            'error': 'Internal server error',
            'details': str(e)
        }), 500, headers)

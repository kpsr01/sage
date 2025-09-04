from http.server import BaseHTTPRequestHandler
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter
import json

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
    def do_POST(self):
        try:
            # Set CORS headers
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            # Read request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            video_id = data.get('videoId')
            if not video_id:
                response = json.dumps({'error': 'Missing videoId parameter'})
                self.wfile.write(response.encode('utf-8'))
                return
            
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
                            response = json.dumps({
                                'error': 'No transcript available for this video'
                            })
                            self.wfile.write(response.encode('utf-8'))
                            return
                
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
                
                response = json.dumps(response_data)
                self.wfile.write(response.encode('utf-8'))
                
            except Exception as transcript_error:
                error_message = str(transcript_error)
                if 'TranscriptsDisabled' in error_message:
                    error_message = 'Transcripts are disabled for this video'
                elif 'NoTranscriptFound' in error_message:
                    error_message = 'No transcript available for this video'
                elif 'VideoUnavailable' in error_message:
                    error_message = 'Video is unavailable or private'
                
                response = json.dumps({'error': error_message})
                self.wfile.write(response.encode('utf-8'))
                
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = json.dumps({
                'error': 'Internal server error',
                'details': str(e)
            })
            self.wfile.write(response.encode('utf-8'))
            
    def do_GET(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        response = json.dumps({'message': 'Transcript API is running'})
        self.wfile.write(response.encode('utf-8'))

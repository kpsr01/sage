class LLMService {
  constructor() {
      this.apiKey = process.env.OPENROUTER_API_KEY;
      this.siteUrl = process.env.SITE_URL;
      this.siteName = process.env.SITE_NAME;
      
      if (!this.apiKey) {
          console.error('Environment variables check:', {
              hasApiKey: !!this.apiKey,
              hasSiteUrl: !!this.siteUrl,
              hasSiteName: !!this.siteName
          });
          throw new Error('OpenRouter API key not found in environment variables');
      }
  }

  async processVideoData(videoData) {
      try {
          // Extract transcript using the existing YouTube data extraction
          const transcript = await this.getVideoTranscript();
          const metadata = await this.getVideoMetadata();

          return {
              transcript: transcript,
              metadata: metadata
          };
      } catch (error) {
          console.error('Error processing video data:', error);
          throw error;
      }
  }

  async getVideoTranscript() {
      try {
          const response = await fetch(window.location.href);
          const html = await response.text();
          
          const captionsMatch = html.match(/"captionTracks":\[(.*?)\]/);
          if (!captionsMatch) {
              throw new Error('No transcript available');
          }

          const captions = JSON.parse(`[${captionsMatch[1]}]`);
          let selectedCaptions = captions.find(caption => caption.languageCode === 'en') || captions[0];

          if (!selectedCaptions?.baseUrl) {
              throw new Error('No transcript URL found');
          }

          const transcriptResponse = await fetch(selectedCaptions.baseUrl);
          const transcriptText = await transcriptResponse.text();
          
          const parser = new DOMParser();
          const doc = parser.parseFromString(transcriptText, 'text/xml');
          const textElements = doc.getElementsByTagName('text');
          
          return Array.from(textElements)
              .map(text => text.textContent.trim())
              .filter(text => text)
              .join(' ');
      } catch (error) {
          console.error('Error fetching transcript:', error);
          return '';
      }
  }

  async getVideoMetadata() {
      try {
          const response = await fetch(window.location.href);
          const html = await response.text();
          
          const titleMatch = html.match(/"title":\s*"([^"]*?)"/);
          const channelMatch = html.match(/"ownerChannelName":\s*"([^"]*?)"/);
          const uploadDateMatch = html.match(/"uploadDate":\s*"([^"]*?)"/);
          const tagsMatch = html.match(/"keywords":\[([^\]]*)\]/);
          const descriptionMatch = html.match(/"description":{"simpleText":"(.*?)"}}/);
          const altDescriptionMatch = html.match(/"shortDescription":"(.*?)"/);
          
          return {
              title: titleMatch?.[1] || 'Title not found',
              channel: channelMatch?.[1] || 'Channel not found',
              uploadDate: uploadDateMatch ? new Date(uploadDateMatch[1]).toLocaleDateString() : 'Date not found',
              description: (descriptionMatch?.[1] || altDescriptionMatch?.[1] || 'Description not found')
                  .replace(/\\n/g, '\n')
                  .replace(/\\"/g, '"'),
              tags: tagsMatch ? JSON.parse(`[${tagsMatch[1]}]`) : ['No tags found']
          };
      } catch (error) {
          console.error('Error fetching metadata:', error);
          return {
              title: 'Error fetching title',
              channel: 'Error fetching channel',
              uploadDate: 'Error fetching date',
              description: 'Error fetching description',
              tags: ['Error fetching tags']
          };
      }
  }

  async answerQuery(query, videoData) {
      try {
          console.log('Processing query with video data:', {
              queryLength: query.length,
              hasTranscript: !!videoData.transcript,
              hasMetadata: !!videoData.metadata
          });

          const formattedContext = `
              Video Title: ${videoData.metadata.title}
              Channel Name: ${videoData.metadata.channel}
              Upload Date: ${videoData.metadata.uploadDate}
              Description: ${videoData.metadata.description}
              Tags: ${videoData.metadata.tags.join(', ')}
              
              Complete Transcript:
              ${videoData.transcript}
          `;

          const systemPrompt = `context: You are a sophisticated AI assistant integrated into a YouTube browser extension. Your role is to be an expert companion for the user, capable of understanding and discussing the video they are watching. You must create a seamless and intuitive experience, making the user feel like they are conversing with an intelligent entity that has full visual and auditory access to the video.
task: Your primary function is to answer user questions. Follow this strict operational hierarchy:
Prioritize Video Content: First, always attempt to answer the question using only the provided video data (title, description, transcript). Synthesize information to provide direct, concise, and relevant answers.
Use General Knowledge with Attribution: If the answer is not present in the video data, use your broader knowledge base to provide a helpful answer. You MUST preface this type of answer with a clear, friendly disclaimer. Examples: "The video doesn't mention that, but generally...", "While the speaker doesn't cover it in this video, the concept of...", or "That's outside the scope of this video, but I can tell you that...".
Maintain the Persona: You are "watching" the video. NEVER mention the words "transcript," "metadata," "data," or "text." Refer to the source of your information as "the video," "the speaker," "what they show," or "at this point in the video."
Handle Specific Query Types:
Summaries: If asked for a summary (e.g., "what's this about?", "tldr"), provide a brief, neutral overview of the video's main topics and conclusion.
Opinions: Do not state personal opinions. If asked for one, either summarize the different viewpoints presented in the video or state that the video presents a specific viewpoint without endorsing it.
Vague Questions: If a question is too ambiguous, ask for clarification or provide a high-level summary as a default response.
Uphold Quality and Safety: All responses must be clear, user-friendly, and free of jargon (unless explained in the video). Refuse to engage with harmful, unethical, or inappropriate prompts.
input:
user's query, video details
output: A helpful and context-aware response that directly addresses the user's question, strictly adhering to the rules defined in the task.`;

          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                  "Authorization": `Bearer ${this.apiKey}`,
                  "HTTP-Referer": this.siteUrl,
                  "X-Title": this.siteName,
                  "Content-Type": "application/json"
              },
              body: JSON.stringify({
                  "model": "meta-llama/llama-3.3-70b-instruct:free",
                  "messages": [
                      {
                          "role": "system",
                          "content": systemPrompt
                      },
                      {
                          "role": "user",
                          "content": `${formattedContext}\n\nUser Question: ${query}`
                      }
                  ],
                  "temperature": 0.7,
                  "max_tokens": 500
              })
          });

          if (!response.ok) {
              const errorText = await response.text();
              console.error('OpenRouter API error:', {
                  status: response.status,
                  statusText: response.statusText,
                  errorText
              });
              return `Error: API request failed: ${response.statusText} - ${errorText}`;
          }

          const data = await response.json();
          console.log('Successfully received response from OpenRouter API');
          return data.choices[0].message.content;
          
      } catch (error) {
          console.error('Error in answerQuery:', {
              message: error.message,
              stack: error.stack,
              name: error.name
          });
          return `Error: ${error.message}`;
      }
  }
}

export { LLMService };
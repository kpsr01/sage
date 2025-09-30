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

  async answerQuery(query, videoData) {
      try {
          console.log('🔍 DEBUG LLMService: Processing query with video data:', {
              hasTranscript: !!videoData.transcript,
              transcriptLength: videoData.transcript?.length || 0,
              hasTranscriptError: !!videoData.transcriptError,
              transcriptError: videoData.transcriptError,
              hasMetadata: !!videoData.metadata
          });

          let formattedContext = `
              Video Title: ${videoData.metadata.title}
              Channel Name: ${videoData.metadata.channel}
              Upload Date: ${videoData.metadata.uploadDate}
              Description: ${videoData.metadata.description}
              Tags: ${videoData.metadata.tags.join(', ')}
          `;

          if (videoData.transcriptError) {
              console.log('⚠️ DEBUG LLMService: Using transcript error path');
              formattedContext += `
              
              Note: Transcript is not available for this video (${videoData.transcriptError}).
              Please answer based on the video metadata provided above.
              `;
          } else if (videoData.transcript) {
              console.log('✅ DEBUG LLMService: Using transcript data, length:', videoData.transcript.length);
              formattedContext += `
              
              Complete Transcript:
              ${videoData.transcript}
              `;
              
              if (videoData.transcriptInfo) {
                  formattedContext += `
              
              Transcript Information:
              - Language: ${videoData.transcriptInfo.language}
              - Type: ${videoData.transcriptInfo.isGenerated ? 'Auto-generated' : 'Manual'}
              - Total segments: ${videoData.transcriptInfo.totalEntries}
              `;
              }
          } else {
              console.log('❌ DEBUG LLMService: No transcript data available');
          }

          const systemPrompt = `context: You are a sophisticated AI assistant integrated into a YouTube browser extension. Your role is to be an expert companion for the user, capable of understanding and discussing the video they are watching. You must create a seamless and intuitive experience, making the user feel like they are conversing with an intelligent entity that has full visual and auditory access to the video.

task: Your primary function is to answer user questions. Follow this strict operational hierarchy:

1. Prioritize Video Content: First, always attempt to answer the question using only the provided video data (title, description, transcript). Synthesize information to provide direct, concise, and relevant answers.

2. Handle Missing Transcripts: If transcript is not available, clearly inform the user and try to answer based on the video metadata (title, description, tags, channel). Be honest about limitations: "I can see the video details but don't have access to the spoken content, so I can help based on the title and description."

3. Use General Knowledge with Attribution: If the answer is not present in the available video data, use your broader knowledge base to provide a helpful answer. You MUST preface this type of answer with a clear, friendly disclaimer. Examples: "The video doesn't mention that, but generally...", "While the speaker doesn't cover it in this video, the concept of...", or "That's outside the scope of this video, but I can tell you that...".

4. Maintain the Persona: You are "watching" the video. NEVER mention the words "transcript," "metadata," "data," or "text." Refer to the source of your information as "the video," "the speaker," "what they show," or "at this point in the video."

5. Handle Specific Query Types:
   - Summaries: If asked for a summary, provide a brief overview based on available information
   - Opinions: Do not state personal opinions. Either summarize viewpoints presented or state limitations
   - Vague Questions: Ask for clarification or provide a high-level summary as default

6. Uphold Quality and Safety: All responses must be clear, user-friendly, and free of jargon (unless explained in the video). Refuse to engage with harmful, unethical, or inappropriate prompts.

input: user's query, video details
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


const site = window.location.hostname


const Add_Custom_Style = css => document.head.appendChild(document.createElement("style")).innerHTML = css

function Create_Custom_Element(tag, attr_tag, attr_name, value) {
    const custom_element = document.createElement(tag)
    custom_element.setAttribute(attr_tag, attr_name)
    custom_element.innerHTML = value
    document.body.append(custom_element)
}

if (site.includes("youtube.com")) {

    Add_Custom_Style(`
        .yt-extension-sidebar {
            background-color: #ffffff;
            padding: 16px;
            margin: 12px 0;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12);
            font-family: "Roboto", sans-serif;
            color: #030303;
            height: 400px;
            display: flex;
            flex-direction: column;
        }

        .chat-messages {
            flex-grow: 1;
            overflow-y: auto;
            margin-bottom: 12px;
            padding: 8px;
            background: #f8f8f8;
            border-radius: 8px;
        }

        .chat-input-container {
            display: flex;
            gap: 8px;
        }

        .chat-input {
            flex-grow: 1;
            padding: 8px 12px;
            border: 1px solid #e0e0e0;
            border-radius: 20px;
            font-size: 14px;
            outline: none;
        }

        .chat-input:focus {
            border-color: #065fd4;
        }

        .send-button {
            background: #065fd4;
            color: white;
            border: none;
            border-radius: 20px;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
        }

        .send-button:hover {
            background: #0356c7;
        }
    `)
}

class YouTubeChatAssistant {
    constructor() {
        this.site = window.location.hostname;
        this.lastVideoId = null;
        this.isDarkMode = document.documentElement.hasAttribute('dark') || 
                         document.querySelector('ytd-app[dark]') !== null || 
                         document.querySelector('html[dark]') !== null;
        this.transcript = null;
        this.metadata = null;
        this.lastUpdate = Date.now();
        this.throttleDelay = 500;
        this.isLoading = false;
        this.init();
        this.setupUrlChangeListener();
        this.setupThemeObserver();
    }

    init() {
        if (this.site.includes('youtube.com')) {
            this.isLoading = true;
            this.setupObserver();
            const sidebar = document.querySelector('#secondary.style-scope.ytd-watch-flexy');
            if (sidebar) {
                this.insertInSidebar();
                this.updateTranscript();
            }
        }
    }

    setupUrlChangeListener() {
        let lastUrl = location.href;
        const config = { attributes: false, childList: true, subtree: true };

        const observer = new MutationObserver(() => {
            if (location.href !== lastUrl) {
                console.log('🔄 DEBUG: URL changed from', lastUrl.substring(0, 100), 'to', location.href.substring(0, 100));
                lastUrl = location.href;
                setTimeout(() => {
                    console.log('⏰ DEBUG: Triggering transcript update after URL change...');
                    this.updateTranscript();
                }, 1000);
            }
        });

        observer.observe(document.body, config);
    }

    async updateTranscript() {
        console.log('🚀 DEBUG: updateTranscript called for video:', this.getVideoId());
        this.isLoading = true;
        this.updateUIForLoadingState();
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        const [transcriptResult, metadata] = await Promise.all([
            this.fetchTranscript(),
            this.getVideoMetadata()
        ]);
        
        if (transcriptResult && !transcriptResult.error) {
            this.transcript = transcriptResult;
        } else if (transcriptResult?.error) {
            console.warn('Transcript error occurred:', transcriptResult.error);
            this.transcript = { error: transcriptResult.error };
        } else {
            console.error('No transcript result returned');
            this.transcript = { error: 'Unknown transcript error' };
        }
        
        if (metadata) {
            this.metadata = metadata;
        }
        
        this.isLoading = false;
        this.updateUIForReadyState();
    }

    updateUIForLoadingState() {
        const messagesDiv = document.querySelector('#chatMessages');
        const chatInput = document.querySelector('#chatInput');
        const sendButton = document.querySelector('.send-button');
        
        if (messagesDiv) {
            messagesDiv.innerHTML = '';
            const loadingMsg = document.createElement('div');
            loadingMsg.className = 'ai-bubble welcome-bubble';
            loadingMsg.textContent = 'Fetching video details...';
            messagesDiv.appendChild(loadingMsg);
        }
        
        if (chatInput) {
            chatInput.disabled = true;
            chatInput.placeholder = 'Loading video details...';
        }
        
        if (sendButton) {
            sendButton.disabled = true;
        }
    }

    updateUIForReadyState() {
        const messagesDiv = document.querySelector('#chatMessages');
        const chatInput = document.querySelector('#chatInput');
        const sendButton = document.querySelector('.send-button');
        
        if (messagesDiv) {
            messagesDiv.innerHTML = '';
            
            // Display transcript instead of welcome message
            if (this.transcript) {
                if (this.transcript.error) {
                    // Show error message if transcript failed
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'ai-bubble error-bubble';
                    errorMsg.textContent = `Transcript Error: ${this.transcript.error}`;
                    messagesDiv.appendChild(errorMsg);
                    
                    const fallbackMsg = document.createElement('div');
                    fallbackMsg.className = 'ai-bubble welcome-bubble';
                    fallbackMsg.textContent = 'Ask me anything about this video based on its title and description...';
                    messagesDiv.appendChild(fallbackMsg);
                } else if (this.transcript.data) {
                    // Show transcript data
                    const transcriptMsg = document.createElement('div');
                    transcriptMsg.className = 'ai-bubble transcript-bubble';
                    transcriptMsg.style.maxHeight = '200px';
                    transcriptMsg.style.overflowY = 'auto';
                    transcriptMsg.style.fontSize = '12px';
                    transcriptMsg.style.lineHeight = '1.3';
                    transcriptMsg.style.whiteSpace = 'pre-wrap';
                    transcriptMsg.style.wordBreak = 'break-word';
                    
                    // Show first 500 characters with option to expand
                    const shortTranscript = this.transcript.data.substring(0, 500);
                    const hasMore = this.transcript.data.length > 500;
                    
                    transcriptMsg.innerHTML = `
                        <strong>📄 Video Transcript:</strong><br/>
                        <div style="margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 4px;">
                            <span id="transcriptContent">${shortTranscript}${hasMore ? '...' : ''}</span>
                            ${hasMore ? '<br/><button id="expandTranscript" style="margin-top: 8px; padding: 4px 8px; border: none; background: #065fd4; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Show Full Transcript</button>' : ''}
                        </div>
                        <div style="margin-top: 8px; font-size: 11px; color: #666;">
                            Language: ${this.transcript.language || 'Unknown'} | 
                            Type: ${this.transcript.isGenerated ? 'Auto-generated' : 'Manual'} | 
                            Segments: ${this.transcript.totalEntries || 0}
                        </div>
                    `;
                    messagesDiv.appendChild(transcriptMsg);
                    
                    // Handle expand button
                    if (hasMore) {
                        const expandBtn = transcriptMsg.querySelector('#expandTranscript');
                        if (expandBtn) {
                            expandBtn.addEventListener('click', () => {
                                const contentSpan = transcriptMsg.querySelector('#transcriptContent');
                                if (contentSpan) {
                                    contentSpan.textContent = this.transcript.data;
                                    expandBtn.style.display = 'none';
                                }
                            });
                        }
                    }
                } else {
                    // Fallback if no transcript data
                    const welcomeMsg = document.createElement('div');
                    welcomeMsg.className = 'ai-bubble welcome-bubble';
                    welcomeMsg.textContent = 'Welcome! Ask me anything about this video...';
                    messagesDiv.appendChild(welcomeMsg);
                }
            } else {
                // Default welcome message if transcript is not loaded yet
                const welcomeMsg = document.createElement('div');
                welcomeMsg.className = 'ai-bubble welcome-bubble';
                welcomeMsg.textContent = 'Welcome! Ask me anything about this video...';
                messagesDiv.appendChild(welcomeMsg);
            }
            
            const summarizeBtn = document.createElement('button');
            summarizeBtn.className = 'summarize-float-button';
            summarizeBtn.id = 'summarizeFloatButton';
            summarizeBtn.textContent = 'Summarize';
            messagesDiv.appendChild(summarizeBtn);
            summarizeBtn.addEventListener('click', () => {
                if (!this.summarizeUsed) {
                    this.summarizeUsed = true;
                    summarizeBtn.disabled = true;
                    summarizeBtn.classList.add('disabled');
                    summarizeBtn.style.opacity = '0.5';
                    summarizeBtn.style.display = 'none';
                    this.sendMessageFromButton('summarize this video');
                }
            });
        }
        
        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = 'Type your message...';
        }
        
        if (sendButton) {
            sendButton.disabled = false;
        }
    }

    getVideoId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('v');
    }

    async fetchTranscript() {
        const videoId = this.getVideoId();
        console.log('📥 DEBUG: fetchTranscript called for videoId:', videoId);
        if (!videoId) return null;

        try {
            // Call our dedicated transcript server
            console.log('🌐 DEBUG: Making request to transcript server...');
            const response = await fetch('https://sage-server.vercel.app/api/transcript', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    videoId: videoId,
                    config: {
                        lang: 'en', // Prefer English
                        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ DEBUG: Transcript fetched successfully, length:', data.plainText?.length);
                
                return { 
                    data: data.plainText,
                    structured: data.transcript,
                    language: data.metadata.language,
                    isGenerated: data.metadata.isGenerated,
                    totalEntries: data.metadata.segmentCount
                };
            } else {
                const errorData = await response.json();
                console.warn('❌ DEBUG: Transcript API failed:', response.status, errorData);
                
                // Handle specific error types
                if (response.status === 404) {
                    return { error: errorData.error || 'No transcript available for this video' };
                } else if (response.status === 403) {
                    return { error: errorData.error || 'Transcripts are disabled for this video' };
                } else if (response.status === 429) {
                    return { error: errorData.error || 'Too many requests. Please try again later' };
                } else if (response.status === 400) {
                    return { error: errorData.error || 'Invalid video ID' };
                }
                
                // Fall back to legacy method for other errors
                return await this.fetchTranscriptFallback();
            }

        } catch (error) {
            console.error('❌ DEBUG: Transcript API connection failed:', error);
            return await this.fetchTranscriptFallback();
        }
    }



    // FALLBACK METHOD: Legacy HTML scraping method (kept as backup)
    async fetchTranscriptFallback() {
        const videoId = this.getVideoId();
        if (!videoId) return null;

        try {
            const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
            const html = await response.text();
            
            const captionsMatch = html.match(/"captionTracks":\[(.*?)\]/);
            if (!captionsMatch) {
                return { error: 'No transcript available for this video. Please try another video.' };
            }

            const captions = JSON.parse(`[${captionsMatch[1]}]`);
            
            let selectedCaptions = captions.find(caption => caption.languageCode === 'en');
            
            if (!selectedCaptions && captions.length > 0) {
                selectedCaptions = captions[0];
            }

            if (!selectedCaptions?.baseUrl) {
                return { error: 'No transcript available for this video.' };
            }
            const transcriptResponse = await fetch(selectedCaptions.baseUrl);
            const transcriptText = await transcriptResponse.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(transcriptText, 'text/xml');
            const textElements = doc.getElementsByTagName('text');
            
            const transcript = Array.from(textElements)
                .map(text => text.textContent.trim())
                .filter(text => text)
                .join('\n');
            
            return { 
                data: transcript,
                language: selectedCaptions.languageCode,
                isGenerated: selectedCaptions.kind === 'asr'
            };
        } catch (error) {
            console.error('Fallback transcript method failed:', error);
            return { error: 'Failed to fetch transcript. Please try again.' };
        }
    }

    createChatInterface() {
        const template = `
            <div class="extension-header premium-header">
                <svg class="sage-logo" width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="28" height="28" rx="8" fill="#FF0000"/><text x="14" y="19" text-anchor="middle" font-size="16" fill="#fff" font-family="Arial, sans-serif">S</text></svg>
                <span class="extension-title">Sage</span>
                <button class="collapse-button" title="Collapse/Expand">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
                    </svg>
                </button>
            </div>
            <div class="chat-messages" id="chatMessages">
                <div class="ai-bubble welcome-bubble">Fetching video details...</div>
            </div>
            <div class="chat-input-container premium-input-container">
                <input type="text" class="chat-input premium-input" placeholder="Loading video details..." id="chatInput" disabled>
                <button class="send-button premium-send-button" aria-label="Send" disabled>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/></svg>
                </button>
            </div>
        `;
        const extensionDiv = document.createElement('div');
        extensionDiv.className = 'yt-extension-sidebar';
        if (this.isDarkMode) {
            extensionDiv.classList.add('dark-mode');
        }
        extensionDiv.innerHTML = template;
        return extensionDiv;
    }

    setupEventListeners(container) {
        const input = container.querySelector('#chatInput');
        const sendButton = container.querySelector('.send-button');
        const messagesDiv = container.querySelector('#chatMessages');
        this.summarizeUsed = false;
        const sendMessage = async (customMessage) => {
            const message = customMessage || input.value.trim();
            if (message) {
                const userMessageElement = document.createElement('div');
                userMessageElement.className = 'user-bubble chat-bubble';
                userMessageElement.textContent = message;
                messagesDiv.appendChild(userMessageElement);
                if (!customMessage) input.value = '';
                const loadingElement = document.createElement('div');
                loadingElement.className = 'ai-bubble chat-bubble thinking-bubble';
                loadingElement.innerHTML = '<span class="thinking-glow"></span><span class="thinking-text">Thinking...</span>';
                messagesDiv.appendChild(loadingElement);
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
                try {
                    const videoData = {
                        transcript: this.transcript?.data || '',
                        metadata: await this.getVideoMetadata(),
                        transcriptInfo: {
                            language: this.transcript?.language,
                            isGenerated: this.transcript?.isGenerated,
                            totalEntries: this.transcript?.totalEntries
                        }
                    };
                    
                    // Check if we have transcript error
                    if (this.transcript?.error) {
                        videoData.transcriptError = this.transcript.error;
                    }
                    
                    const response = await fetch('https://sage-of93.vercel.app/api', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            query: message,
                            videoData: videoData
                        })
                    });
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.details || response.statusText);
                    }
                    const data = await response.json();
                    messagesDiv.removeChild(loadingElement);
                    const aiMessageElement = document.createElement('div');
                    aiMessageElement.className = 'ai-bubble chat-bubble';
                    aiMessageElement.textContent = data.answer;
                    messagesDiv.appendChild(aiMessageElement);
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                } catch (error) {
                    console.error('Error:', error);
                    messagesDiv.removeChild(loadingElement);
                    const errorElement = document.createElement('div');
                    errorElement.className = 'ai-bubble chat-bubble error-bubble';
                    errorElement.textContent = 'Server error, please try again later';
                    messagesDiv.appendChild(errorElement);
                }
            }
        };
        sendButton.addEventListener('click', () => sendMessage());
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        const collapseButton = container.querySelector('.collapse-button');
        collapseButton.addEventListener('click', () => {
            container.classList.toggle('collapsed');
            collapseButton.classList.toggle('collapsed');
            const isCollapsed = container.classList.contains('collapsed');
            localStorage.setItem('ytChatCollapsed', isCollapsed);
        });
        const wasCollapsed = localStorage.getItem('ytChatCollapsed') === 'true';
        if (wasCollapsed) {
            container.classList.add('collapsed');
            collapseButton.classList.add('collapsed');
        }
    }

    insertInSidebar() {
        const sidebar = document.querySelector('#secondary.style-scope.ytd-watch-flexy');
        if (sidebar) {
            const existing = sidebar.querySelector('.yt-extension-sidebar');
            if (existing) existing.remove();
            const chatInterface = this.createChatInterface();
            sidebar.insertBefore(chatInterface, sidebar.firstChild);
            this.setupEventListeners(chatInterface);
            
            if (this.isLoading) {
                this.updateUIForLoadingState();
            }
        }
    }

    setupObserver() {
        const observer = new MutationObserver((mutations, obs) => {
            const sidebar = document.querySelector('#secondary.style-scope.ytd-watch-flexy');
            if (sidebar) {
                this.insertInSidebar();
                this.updateTranscript();
                obs.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
        }, 10000);
    }

    setupThemeObserver() {
        const getYouTubeTheme = () => {
            return document.documentElement.hasAttribute('dark') || 
                   document.querySelector('ytd-app[dark]') !== null || 
                   document.querySelector('html[dark]') !== null;
        };

        const observer = new MutationObserver(() => {
            const now = Date.now();
            if (now - this.lastUpdate >= this.throttleDelay) {
                this.lastUpdate = now;
                this.isDarkMode = getYouTubeTheme();
                const sidebar = document.querySelector('.yt-extension-sidebar');
                if (sidebar) {
                    if (this.isDarkMode) {
                        sidebar.classList.add('dark-mode');
                    } else {
                        sidebar.classList.remove('dark-mode');
                    }
                }
            }
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['dark'],
            subtree: true
        });
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
            
            let tags = [];
            if (tagsMatch?.[1]) {
                tags = tagsMatch[1]
                    .split(',')
                    .map(tag => JSON.parse(tag.trim()))
                    .filter(tag => tag);
            }
            
            let description = '';
            if (descriptionMatch?.[1] || altDescriptionMatch?.[1]) {
                description = (descriptionMatch?.[1] || altDescriptionMatch?.[1])
                    .replace(/\\n/g, '\n')
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\');

                const familySafeIndex = description.indexOf('isFamilySafe');
                if (familySafeIndex !== -1) {
                    description = description.substring(0, familySafeIndex).trim();
                }
            }
            
            return {
                title: titleMatch?.[1] || 'Title not found',
                channel: channelMatch?.[1] || 'Channel not found',
                uploadDate: uploadDateMatch ? new Date(uploadDateMatch[1]).toLocaleDateString() : 'Date not found',
                description: description || 'Description not found',
                tags: tags.length > 0 ? tags : ['No tags found']
            };
        } catch (error) {
            console.error('Error fetching video metadata:', error);
            return {
                title: 'Error fetching title',
                channel: 'Error fetching channel',
                uploadDate: 'Error fetching date',
                description: 'Error fetching description',
                tags: ['Error fetching tags']
            };
        }
    }

    sendMessageFromButton(message) {
        const input = document.querySelector('#chatInput');
        const messagesDiv = document.querySelector('#chatMessages');
        if (!messagesDiv) return;
        const userMessageElement = document.createElement('div');
        userMessageElement.className = 'user-bubble chat-bubble';
        userMessageElement.textContent = message;
        messagesDiv.appendChild(userMessageElement);
        const loadingElement = document.createElement('div');
        loadingElement.className = 'ai-bubble chat-bubble thinking-bubble';
        loadingElement.innerHTML = '<span class="thinking-glow"></span><span class="thinking-text">Thinking...</span>';
        messagesDiv.appendChild(loadingElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        (async () => {
            try {
                const videoData = {
                    transcript: this.transcript?.data || '',
                    metadata: await this.getVideoMetadata(),
                    transcriptInfo: {
                        language: this.transcript?.language,
                        isGenerated: this.transcript?.isGenerated,
                        totalEntries: this.transcript?.totalEntries
                    }
                };
                
                // Check if we have transcript error
                if (this.transcript?.error) {
                    videoData.transcriptError = this.transcript.error;
                }
                
                const response = await fetch('https://sage-of93.vercel.app/api', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query: message,
                        videoData: videoData
                    })
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.details || response.statusText);
                }
                const data = await response.json();
                messagesDiv.removeChild(loadingElement);
                const aiMessageElement = document.createElement('div');
                aiMessageElement.className = 'ai-bubble chat-bubble';
                aiMessageElement.textContent = data.answer;
                messagesDiv.appendChild(aiMessageElement);
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            } catch (error) {
                console.error('Error:', error);
                messagesDiv.removeChild(loadingElement);
                const errorElement = document.createElement('div');
                errorElement.className = 'ai-bubble chat-bubble error-bubble';
                errorElement.textContent = 'Server error, please try again later';
                messagesDiv.appendChild(errorElement);
            }
        })();
    }
}



new YouTubeChatAssistant();
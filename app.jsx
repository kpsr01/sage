const site = window.location.hostname;

const Add_Custom_Style = css => document.head.appendChild(document.createElement('style')).innerHTML = css;

function Create_Custom_Element(tag, attr_tag, attr_name, value) {
    const custom_element = document.createElement(tag);
    custom_element.setAttribute(attr_tag, attr_name);
    custom_element.innerHTML = value;
    document.body.append(custom_element);
}

if (site.includes('youtube.com')) {
    Add_Custom_Style(`
        .yt-extension-sidebar { background-color:#ffffff; padding:16px; margin:12px 0; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.12); font-family:"Roboto",sans-serif; color:#030303; height:400px; display:flex; flex-direction:column; }
        .chat-messages { flex-grow:1; overflow-y:auto; margin-bottom:12px; padding:8px; background:#f8f8f8; border-radius:8px; }
        .chat-input-container { display:flex; gap:8px; }
        .chat-input { flex-grow:1; padding:8px 12px; border:1px solid #e0e0e0; border-radius:20px; font-size:14px; outline:none; }
    `);
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
        // API base for serverless functions (LLM + transcript)
        this.apiBase = 'https://sage-of93.vercel.app/api';
        // Whether we are currently retrying transcript fetch
        this._transcriptRetryInProgress = false;
        this.init();
    }

    // Extract the current YouTube video ID from URL forms:
    // https://www.youtube.com/watch?v=VIDEOID
    // https://youtu.be/VIDEOID
    // Shorts / embed fallback attempts
    getVideoId() {
        try {
            const url = new URL(window.location.href);
            let v = url.searchParams.get('v');
            if (v) return v.substring(0, 50); // basic safety truncate
            // youtu.be short links
            if (url.hostname.includes('youtu.be')) {
                const pathPart = url.pathname.split('/').filter(Boolean)[0];
                if (pathPart) return pathPart.substring(0, 50);
            }
            // shorts pattern: /shorts/<id>
            if (url.pathname.includes('/shorts/')) {
                const parts = url.pathname.split('/');
                const idx = parts.indexOf('shorts');
                if (idx !== -1 && parts[idx + 1]) return parts[idx + 1].substring(0, 50);
            }
            // embed pattern
            if (url.pathname.includes('/embed/')) {
                const parts = url.pathname.split('/');
                const idx = parts.indexOf('embed');
                if (idx !== -1 && parts[idx + 1]) return parts[idx + 1].substring(0, 50);
            }
        } catch (e) {
            console.warn('getVideoId parse error', e);
        }
        return null;
    }

    init() {
        try {
            this.insertInSidebar();
            this.setupObserver();
            this.setupThemeObserver();
            this.setupUrlChangeListener();
            // Kick off first load
            this.updateTranscript();
        } catch (e) {
            console.error('Init error:', e);
        }
    }
    
    setupUrlChangeListener() {
        const handleUrlChange = () => {
            const videoId = this.getVideoId();
            if (videoId && videoId !== this.lastVideoId) {
                console.log('🔄 Detected video change. New ID:', videoId);
                this.lastVideoId = videoId;
                this.transcript = null;
                this.metadata = null;
                this.updateTranscript();
            }
        };
        const originalPushState = history.pushState;
        history.pushState = function () {
            originalPushState.apply(this, arguments);
            setTimeout(handleUrlChange, 300);
        };
        window.addEventListener('popstate', () => setTimeout(handleUrlChange, 300));
        handleUrlChange();
    }

    async updateTranscript() {
        if (this.isLoading) return;
        this.isLoading = true;
        this.updateUIForLoadingState();
    console.log('🚀 Starting updateTranscript (API mode)');
        // Ensure sidebar/chat DOM exists before heavy work
        let uiWaitStart = Date.now();
        while (!document.querySelector('#chatMessages') && Date.now() - uiWaitStart < 3000) {
            await new Promise(r => setTimeout(r, 100));
        }
        // Safety timeout fallback (force finalize if something hangs)
        const loadingToken = Symbol('load');
        this._currentLoadToken = loadingToken;
        setTimeout(async () => {
            if (this._currentLoadToken === loadingToken && this.isLoading) {
                console.warn('⏰ Loading timeout reached, forcing finalize.');
                let tr = this.transcript;
                if (!tr || (!tr.data && !tr.error)) {
                    // One last quick DOM attempt
                    try { tr = await this.extractTranscriptFromDOM(); } catch(_) {}
                    if (tr) this.transcript = tr; else if (!this.transcript) this.transcript = { error: 'Transcript not found (timeout)' };
                }
                this.isLoading = false;
                this.updateUIForReadyState();
            }
        }, 8000);
    let transcriptResult = null;
        let metadata = null;
        try {
            transcriptResult = await this.fetchTranscript();
            metadata = await this.getVideoMetadata();
        } catch (e) {
            console.error('updateTranscript error:', e);
        }

        if (transcriptResult && !transcriptResult.error) {
            this.transcript = transcriptResult;
            console.log('✅ Transcript loaded:', {
                language: transcriptResult.language,
                isGenerated: transcriptResult.isGenerated,
                entries: transcriptResult.totalEntries,
                length: transcriptResult.data?.length || 0
            });
        } else if (transcriptResult?.error) {
            this.transcript = { error: transcriptResult.error };
            console.warn('⚠️ Transcript error:', transcriptResult.error);
        } else {
            this.transcript = { error: 'Transcript not found in DOM' };
            console.warn('⚠️ Transcript not found.');
        }

        if (metadata) this.metadata = metadata;
        this.isLoading = false;
        this.updateUIForReadyState();
    // If transcript not found, schedule background retries (API re-fetch)
        if (!this.transcript || this.transcript.error) {
            this.scheduleTranscriptRetry();
        }
        // If metadata incomplete, schedule background retries
        if (!this.metadata || /not found|error/i.test(this.metadata.title || '') || /not found|error/i.test(this.metadata.channel || '')) {
            this.scheduleMetadataRetry && this.scheduleMetadataRetry();
        }
        console.log('🏁 updateTranscript finished');
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
            const welcomeMsg = document.createElement('div');
            welcomeMsg.className = 'ai-bubble welcome-bubble';
            welcomeMsg.textContent = 'Welcome! Ask me anything about this video...';
            messagesDiv.appendChild(welcomeMsg);
            // Debug info (transcript + metadata previews)
            this.displayDebugInfo(messagesDiv);
            // Full transcript + metadata sections (collapsible)
            const sectionsWrapper = document.createElement('div');
            sectionsWrapper.id = 'videoDataSections';
            messagesDiv.appendChild(sectionsWrapper);
            const buildSection = (id, title) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'video-data-section';
                wrapper.innerHTML = `
                    <div class="vds-header" data-target="${id}">
                        <span class="vds-title">${title}</span>
                        <button class="vds-toggle" aria-label="Toggle ${title}">▼</button>
                        <button class="vds-copy" data-copy="${id}" aria-label="Copy ${title}" style="display:none;">Copy</button>
                    </div>
                    <div class="vds-content" id="${id}" style="display:none; max-height:140px; overflow:auto; white-space:pre-wrap; font-size:12px; line-height:1.4; border:1px solid #ddd; padding:6px; border-radius:6px; background:#fafafa;"></div>
                `;
                sectionsWrapper.appendChild(wrapper);
            };
            buildSection('transcriptDisplay','Transcript');
            buildSection('metadataDisplay','Metadata');
            // Event delegation for toggles / copy
            sectionsWrapper.addEventListener('click', (e) => {
                const header = e.target.closest('.vds-header');
                if (header) {
                    if (e.target.classList.contains('vds-copy')) return; // copy handled separately
                    const targetId = header.getAttribute('data-target');
                    const content = document.getElementById(targetId);
                    const toggleBtn = header.querySelector('.vds-toggle');
                    if (content.style.display === 'none') {
                        content.style.display = 'block';
                        toggleBtn.textContent = '▲';
                        header.querySelector('.vds-copy').style.display = 'inline-block';
                    } else {
                        content.style.display = 'none';
                        toggleBtn.textContent = '▼';
                        header.querySelector('.vds-copy').style.display = 'none';
                    }
                }
                if (e.target.classList.contains('vds-copy')) {
                    const targetId = e.target.getAttribute('data-copy');
                    const content = document.getElementById(targetId);
                    if (content) {
                        navigator.clipboard.writeText(content.textContent).then(()=>{
                            e.target.textContent = 'Copied';
                            setTimeout(()=> e.target.textContent = 'Copy', 1500);
                        });
                    }
                }
            });
            this.updateTranscriptAndMetadataDisplays();
            // Summarize button
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

    async fetchTranscript() {
        const videoId = this.getVideoId();
        if (!videoId) return { error: 'No video id detected' };
        console.log('🎥 (API) Fetching transcript for video:', videoId);
        try {
            const response = await fetch(`${this.apiBase}/transcript-js`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId })
            });
            if (!response.ok) {
                let errTxt = 'Unknown error';
                try { const j = await response.json(); errTxt = j.error || j.details || errTxt; } catch(_) {}
                return { error: errTxt };
            }
            const data = await response.json();
            const mapped = {
                data: data.transcript,
                structured: data.structured_transcript,
                language: data.language_code || 'en',
                isGenerated: !!data.is_generated,
                totalEntries: data.total_entries || (data.structured_transcript ? data.structured_transcript.length : 0)
            };
            return mapped;
        } catch (e) {
            console.error('Transcript API fetch failed:', e);
            return { error: e.message || 'Transcript API error' };
        }
    }

    async ensureTranscriptPanel(maxWait = 10000) {
        const start = Date.now();
        while (Date.now() - start < maxWait) {
            const openPanel = document.querySelector('#panels ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"] ytd-transcript-segment-list-renderer');
            if (openPanel) return true;
                if (this.autoOpenTranscript) await this.openTranscriptPanel(); else await this.openTranscriptPanelStealth();
            await new Promise(r=>setTimeout(r,400));
        }
        return false;
    }

    displayDebugInfo(messagesDiv) {
        const transcriptDebug = document.createElement('div');
        transcriptDebug.className = 'ai-bubble debug-bubble';
        transcriptDebug.style.backgroundColor = '#e8f4fd';
        transcriptDebug.style.border = '1px solid #bee5eb';
        transcriptDebug.style.fontSize = '12px';
        transcriptDebug.style.marginBottom = '8px';
        if (this.transcript && this.transcript.data) {
            const transcriptPreview = this.transcript.data.substring(0, 200) + (this.transcript.data.length > 200 ? '...' : '');
            transcriptDebug.innerHTML = `
                <strong>📄 TRANSCRIPT EXTRACTED:</strong><br>
                <strong>Language:</strong> ${this.transcript.language || 'unknown'}<br>
                <strong>Generated:</strong> ${this.transcript.isGenerated ? 'Yes' : 'No'}<br>
                <strong>Segments:</strong> ${this.transcript.totalEntries || 0}<br>
                <strong>Length:</strong> ${this.transcript.data.length} chars<br>
                <strong>Preview:</strong> "${transcriptPreview}"
            `;
        } else if (this.transcript && this.transcript.error) {
            transcriptDebug.innerHTML = `
                <strong>❌ TRANSCRIPT ERROR:</strong><br>
                ${this.transcript.error}
            `;
        } else {
            transcriptDebug.innerHTML = `
                <strong>⏳ TRANSCRIPT:</strong> Not yet loaded
            `;
        }
        messagesDiv.appendChild(transcriptDebug);
        const metadataDebug = document.createElement('div');
        metadataDebug.className = 'ai-bubble debug-bubble';
        metadataDebug.style.backgroundColor = '#fff3cd';
        metadataDebug.style.border = '1px solid #ffeaa7';
        metadataDebug.style.fontSize = '12px';
        metadataDebug.style.marginBottom = '8px';
        if (this.metadata) {
            const descPreview = this.metadata.description && this.metadata.description !== 'Description not found'
                ? this.metadata.description.substring(0, 150) + (this.metadata.description.length > 150 ? '...' : '')
                : 'No description';
            metadataDebug.innerHTML = `
                <strong>📊 METADATA EXTRACTED:</strong><br>
                <strong>Title:</strong> ${this.metadata.title || 'Not found'}<br>
                <strong>Channel:</strong> ${this.metadata.channel || 'Not found'}<br>
                <strong>Upload Date:</strong> ${this.metadata.uploadDate || 'Not found'}<br>
                <strong>Tags:</strong> ${Array.isArray(this.metadata.tags) ? this.metadata.tags.length : 0} tags<br>
                <strong>Description Preview:</strong> "${descPreview}"
            `;
        } else {
            metadataDebug.innerHTML = `
                <strong>⏳ METADATA:</strong> Not yet loaded
            `;
        }
        messagesDiv.appendChild(metadataDebug);
    }

    refreshDebugInfo() {
        const messagesDiv = document.querySelector('#chatMessages');
        if (!messagesDiv) return;
        // Remove old debug bubbles only
        Array.from(messagesDiv.querySelectorAll('.debug-bubble')).forEach(el => el.remove());
        this.displayDebugInfo(messagesDiv);
    this.updateTranscriptAndMetadataDisplays();
    }

    scheduleTranscriptRetry() {
        if (this._transcriptRetryInProgress) return;
        this._transcriptRetryInProgress = true;
        let attempts = 0;
        const maxAttempts = 10; // ~20s at 2s interval
        const attempt = async () => {
            if (this.transcript && this.transcript.data) {
                console.log('✅ Transcript present, stopping retries.');
                this._transcriptRetryInProgress = false;
                return;
            }
            attempts++;
            console.log(`🔁 Transcript API retry ${attempts}/${maxAttempts}`);
            const tr = await this.fetchTranscript();
            if (tr && tr.data) {
                this.transcript = tr;
                this.refreshDebugInfo();
                this._transcriptRetryInProgress = false;
                return;
            }
            if (attempts < maxAttempts) {
                this._transcriptRetryTimer = setTimeout(attempt, 2000);
            } else {
                console.log('🛑 Giving up on transcript retries (API)');
                this._transcriptRetryInProgress = false;
            }
        };
        this._transcriptRetryTimer = setTimeout(attempt, 2000);
    }

    updateTranscriptAndMetadataDisplays() {
        const transcriptEl = document.getElementById('transcriptDisplay');
        const metadataEl = document.getElementById('metadataDisplay');
        if (transcriptEl) {
            if (this.transcript && this.transcript.data) {
                transcriptEl.textContent = this.transcript.data;
            } else if (this.transcript && this.transcript.error) {
                transcriptEl.textContent = this.transcript.error;
            } else {
                transcriptEl.textContent = 'Transcript not loaded yet.';
            }
        }
        if (metadataEl) {
            if (this.metadata) {
                const metaLines = [];
                metaLines.push(`Title: ${this.metadata.title}`);
                metaLines.push(`Channel: ${this.metadata.channel}`);
                metaLines.push(`Upload Date: ${this.metadata.uploadDate}`);
                if (Array.isArray(this.metadata.tags)) metaLines.push(`Tags (${this.metadata.tags.length}): ${this.metadata.tags.join(', ')}`);
                metaLines.push('');
                metaLines.push('Description:');
                metaLines.push(this.metadata.description || 'No description');
                metadataEl.textContent = metaLines.join('\n');
            } else {
                metadataEl.textContent = 'Metadata not loaded yet.';
            }
        }
    }

    // (Removed DOM transcript extraction; now handled via API.)


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
                    console.log('💬 Preparing to send message to AI...');
                    console.log('📊 Current transcript state:', {
                        hasTranscript: !!this.transcript,
                        hasData: !!this.transcript?.data,
                        hasError: !!this.transcript?.error,
                        dataLength: this.transcript?.data?.length || 0
                    });
                    
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
                        console.log('⚠️ Transcript error will be sent to AI:', this.transcript.error);
                    }
                    
                    console.log('📤 Sending video data to AI:', {
                        transcriptLength: videoData.transcript.length,
                        hasMetadata: !!videoData.metadata,
                        hasTranscriptError: !!videoData.transcriptError,
                        transcriptInfo: videoData.transcriptInfo
                    });
                    
                    if (videoData.transcript.length > 0) {
                        console.log('📄 TRANSCRIPT BEING SENT TO AI:');
                        console.log('='.repeat(40));
                        console.log(videoData.transcript.substring(0, 500) + (videoData.transcript.length > 500 ? '...' : ''));
                        console.log('='.repeat(40));
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
        console.log('👀 Setting up sidebar observer...');
        const observer = new MutationObserver((mutations, obs) => {
            const sidebar = document.querySelector('#secondary.style-scope.ytd-watch-flexy');
            if (sidebar) {
                console.log('✅ Sidebar found by observer, inserting and updating transcript');
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
            console.log('⏰ Observer timeout reached, disconnecting');
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
            // Return cached if good
            if (this.metadata && this.metadata.title && !/not found|error/i.test(this.metadata.title)) return this.metadata;
            console.log('📊 Extracting video metadata (multi-source DOM)');

            const selectText = (selArr) => {
                for (const sel of selArr) {
                    const el = document.querySelector(sel);
                    if (el && el.textContent.trim()) return el.textContent.trim();
                }
                return '';
            };

            let title = selectText([
                'h1.ytd-watch-metadata yt-formatted-string',
                'h1.title',
                'h1'
            ]);
            let channel = selectText([
                '#owner-container ytd-channel-name a',
                'ytd-channel-name a'
            ]);
            let uploadDate = selectText([
                '#info-strings yt-formatted-string',
                '#info span.date'
            ]);
            if (!uploadDate) {
                const dateMeta = document.querySelector('meta[itemprop="datePublished"]');
                if (dateMeta) uploadDate = new Date(dateMeta.getAttribute('content')).toLocaleDateString();
            }
            let description = selectText([
                '#description-inline-expander yt-attributed-string',
                '#description.ytd-watch-metadata',
                '#description'
            ]);

            // Parse global player response if missing fields
            const tryPlayerResponse = () => {
                let pr = window.ytInitialPlayerResponse || window.ytInitialData;
                if (!pr) {
                    // Attempt from script tags
                    const script = Array.from(document.querySelectorAll('script')).find(s => s.textContent.includes('ytInitialPlayerResponse'));
                    if (script) {
                        const m = script.textContent.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*var/);
                        if (m) {
                            try { pr = JSON.parse(m[1]); } catch(_) {}
                        }
                    }
                }
                return pr;
            };
            const pr = tryPlayerResponse();
            if (pr?.videoDetails) {
                if (!title && pr.videoDetails.title) title = pr.videoDetails.title;
                if (!channel && pr.videoDetails.author) channel = pr.videoDetails.author;
                if (!description && pr.videoDetails.shortDescription) description = pr.videoDetails.shortDescription.replace(/\n/g,'\n');
                if (!uploadDate && pr.microformat?.playerMicroformatRenderer?.uploadDate) {
                    uploadDate = new Date(pr.microformat.playerMicroformatRenderer.uploadDate).toLocaleDateString();
                }
            }

            // Keywords / tags
            let tags = [];
            if (pr?.videoDetails?.keywords) tags = pr.videoDetails.keywords.slice(0,50);
            if (!tags.length) {
                const keywordsMeta = document.querySelector('meta[name="keywords"]');
                if (keywordsMeta) tags = keywordsMeta.getAttribute('content').split(',').map(t=>t.trim()).filter(Boolean);
            }

            // Cleanup description (avoid extremely long JSON leakage)
            if (description && description.length > 20000) description = description.slice(0,20000);

            const metadata = {
                title: title || 'Title not found',
                channel: channel || 'Channel not found',
                uploadDate: uploadDate || 'Date not found',
                description: description || 'Description not found',
                tags: tags.length ? tags : ['No tags found']
            };
            this.metadata = metadata;
            console.log('✅ Metadata extracted:', { title: metadata.title.slice(0,40)+'...', channel: metadata.channel, tags: metadata.tags.length, desc: metadata.description.length });
            return metadata;
        } catch (err) {
            console.error('❌ Metadata extraction failed:', err);
            return { title: 'Title not found', channel: 'Channel not found', uploadDate: 'Date not found', description: 'Description not found', tags: ['No tags found'] };
        }
    }

    scheduleMetadataRetry() {
        if (this._metadataRetryInProgress) return;
        this._metadataRetryInProgress = true;
        let attempts = 0;
        const maxAttempts = 8; // ~16s
        const attempt = async () => {
            attempts++;
            if (this.metadata && !/not found|error/i.test(this.metadata.title) && !/not found|error/i.test(this.metadata.channel)) {
                console.log('✅ Metadata retry success');
                this.refreshDebugInfo();
                this._metadataRetryInProgress = false;
                return;
            }
            console.log(`🔁 Metadata retry attempt ${attempts}/${maxAttempts}`);
            await this.getVideoMetadata();
            if (attempts < maxAttempts) {
                this._metadataRetryTimer = setTimeout(attempt, 2000);
            } else {
                console.log('🛑 Stopping metadata retries');
                this._metadataRetryInProgress = false;
            }
        };
        this._metadataRetryTimer = setTimeout(attempt, 1500);
    }

    // (Removed transcript panel opening helpers – no longer needed with API-based transcript.)

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
# Sage - YouTube AI Assistant


## Overview

Sage is a powerful Firefox extension that enhances your YouTube experience by providing an AI-powered assistant that can answer questions about video content in real-time. Using advanced language models, Sage analyzes video transcripts and metadata to provide contextual, intelligent responses to your queries.

## Features

- 🎥 Real-time video content analysis
- 💬 Interactive Q&A about video content
- 🤖 Powered by advanced AI (OpenRouter API)
- 🎯 Context-aware responses
- 🌗 Automatic dark/light theme support
- 🎨 Clean, minimal interface

## Installation

### Option 1: Firefox Add-ons Store (Recommended)

The easiest way to install Sage is through the Firefox Add-ons store:
[Install Sage](https://addons.mozilla.org/en-US/firefox/addon/sage-ai/)

### Option 2: Manual Installation (Development)

1. Clone the repository:
```bash
git clone https://github.com/kpsr01/sage.git
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
OPENROUTER_API_KEY=your_api_key_here
SITE_URL=your_site_url
SITE_NAME=your_site_name
```

4. Build the extension:
```bash
npm run build
```

5. Load in Firefox:
   - Open Firefox
   - Navigate to `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select the `manifest.json` file

## Usage

1. Visit any YouTube video
2. Look for the Sage sidebar on the right
3. Ask questions about the video content
4. Get AI-powered responses based on video context

## Development

- `npm run dev` - Watch mode for development
- `npm run build` - Production build

## Requirements

- Firefox 109.0 or later
- Node.js 14+
- npm 
- OpenRouter API key (for development)

## Technical Stack

- JavaScript/JSX
- Webpack
- Babel
- OpenRouter API
- YouTube Data API

## Privacy & Security

- No user data storage
- Local content processing
- Secure API communications
- Privacy-focused design

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.

## Support

For issues and feature requests, please use the GitHub issues page.

---

Made with ❤️ by kpsr01

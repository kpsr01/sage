# Deployment Instructions

## 1. Deploy Transcript Server

Navigate to the transcript-server directory and deploy:

```bash
cd ../transcript-server
npm install
vercel --prod
```

After deployment, you'll get a URL like: `https://transcript-server-abc123.vercel.app`

## 2. Update Main App

Update the transcript server URL in `app.jsx`:

```javascript
// Replace this line:
const response = await fetch('https://transcript-server-your-domain.vercel.app/api/transcript', {

// With your actual transcript server URL:
const response = await fetch('https://transcript-server-abc123.vercel.app/api/transcript', {
```

## 3. Deploy Main App

```bash
# Build and deploy main app
npm run build
git add .
git commit -m "🚀 Separate transcript server deployment"
git push origin main
```

## Architecture

- **Main App**: `sage-of93.vercel.app` - Browser extension + AI chat API
- **Transcript Server**: `transcript-server-xyz.vercel.app` - Dedicated transcript fetching

This separation provides:
- Better scaling for transcript requests
- Independent deployment cycles
- Cleaner code organization
- Reduced main app bundle size
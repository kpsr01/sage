# Sage Extension Deployment Instructions

## Overview
The Sage extension now uses a **two-server architecture**:
1. **Main Sage Server** (this repository) - AI chat functionality
2. **Transcript Server** - Dedicated YouTube transcript fetching

## Step 1: Deploy Transcript Server

### Repository: [sage-server](https://github.com/kpsr01/sage-server)

1. **Option A: One-Click Deploy**
   - Go to https://github.com/kpsr01/sage-server
   - Click the "Deploy with Vercel" button in the README
   - Connect your GitHub account and deploy

2. **Option B: Manual Deploy**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import `https://github.com/kpsr01/sage-server`
   - Deploy with default settings

3. **Your Vercel URL**: `https://sage-server.vercel.app` ✅

## Step 2: Update Main Sage Extension

1. **Transcript server URL updated** in `app.jsx`:
   ```javascript
   // Line ~286 in app.jsx
   const response = await fetch('https://sage-server.vercel.app/api/transcript', {
   ```
   ✅ **Already configured with the correct URL**

2. **Build the extension**:
   ```bash
   npm run build
   ```

3. **Deploy main sage server** (this repository) to your existing Vercel project

## Step 3: Test the Setup

1. **Test transcript server directly**:
   ```bash
   curl -X POST https://sage-server.vercel.app/api/transcript \
     -H "Content-Type: application/json" \
     -d '{"videoId": "dQw4w9WgXcQ", "config": {"lang": "en"}}'
   ```

2. **Load extension in browser** and test on a YouTube video

## Architecture Benefits

- ✅ **Scalability**: Transcript server can handle high loads independently
- ✅ **Reliability**: If one server has issues, the other still works
- ✅ **Maintenance**: Can update transcript logic without touching main extension
- ✅ **Cost Optimization**: Dedicated resources for CPU-intensive transcript processing

## Troubleshooting

- **404 on transcript endpoint**: Check that sage-server is deployed correctly
- **CORS errors**: Transcript server has CORS enabled for browser extensions
- **Empty transcripts**: Check browser console for network errors to transcript server
# TNMN — Listen Together

A premium, synchronized music platform designed for intimate groups. Built with a "brutalist editorial" aesthetic and powered by a backend-less Firebase architecture.

## Features

- **Real-time Synchronization**: Listen to YouTube and SoundCloud tracks in perfect sync with your circle (<200ms latency).
- **Server-based Rooms**: Create private rooms, invite friends via unique tokens, and manage shared queues.
- **Dynamic Art Direction**: The interface dynamically adapts its accent colors based on the current track's album art.
- **Social Presence**: Track who's online and what they're listening to.
- **Integrated Chat**: Per-server real-time messaging with a minimalist, broadcast-style UI.
- **Zero-Cost Infrastructure**: Optimized for the Firebase Free Tier (Spark Plan) and Cloudflare Pages.

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS 3.
- **Backend**: Firebase Auth, Firestore (Real-time Metadata), Realtime Database (Sync Engine).
- **Styling**: Brutalist editorial theme with custom Google Fonts (Playfair Display, DM Sans, DM Mono).
- **APIs**: YouTube Data API v3, SoundCloud oEmbed, ColorThief.

## Getting Started

### Prerequisites

1.  A Firebase project with **Authentication** (Google), **Firestore**, and **Realtime Database** enabled.
2.  A YouTube Data API v3 Key.

### Environment Setup

Create a `.env.local` file in the root directory:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
VITE_YT_API_KEY=your_youtube_api_key
```

### Installation

```bash
npm install
npm run dev
```

## Architecture Notes

### The Sync Engine
The app uses a "DJ-Listener" model. The DJ (server owner) broadcasts their current timestamp and play state to Firebase RTDB. Listeners monitor this state and perform drift-correction (snapping to the correct time if they fall >2s out of sync).

### Cost Strategy
- **No Firebase Storage**: To bypass billing requirements, server cover art is handled via external URLs.
- **Message Pruning**: Chat lists are limited to the most recent 50 messages to keep read/write costs low.
- **Batch Writes**: Playlist imports use Firestore batch writes for efficiency.

## License
MIT

# Chord Training

A web-based chord training application built with React and HeroUI for learning and practicing musical chords.

[Demo](https://shironeko1337.github.io/lets_play_some_chords/)

## Tech Stack

- **React** - UI framework
- **TypeScript** - Type-safe JavaScript
- **HeroUI** - Component library for UI elements
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Web Audio API** - Audio playback

## Features

- Interactive scale degree selection (Tonic, Supertonic, Mediant, etc.)
- Chord type selection (Thirds, Sevenths)
- Adjustable root note (E2 to E4)
- Instrument selection (Piano, Guitar)
- Visual note buttons for chromatic scale
- Real-time audio playback

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Deployment to GitHub Pages

### Prerequisites

1. Move the `samples` folder to the `public` folder:
   ```bash
   mv samples public/samples
   ```
   (This ensures the audio files are included in the build)

### Option 1: Automatic Deployment (Recommended)

1. Create a GitHub repository
2. Push your code to the `main` branch
3. Go to repository Settings → Pages
4. Under "Build and deployment", select "GitHub Actions" as the source
5. The site will automatically deploy on every push to `main`

### Option 2: Manual Deployment

```bash
# Install dependencies
npm install

# Build and deploy
npm run deploy
```

This will build the project and push it to the `gh-pages` branch.

## Usage

1. Click "Start" to initialize the audio context
2. Select an instrument from the dropdown (20 instruments available)
3. Choose a chord type (Triad or Seventh)
4. Adjust the root note using the slider (E2 to E5)
5. Click on scale degree chips to play chords
6. Click on note buttons to play individual notes
7. Use the volume slider to adjust playback volume

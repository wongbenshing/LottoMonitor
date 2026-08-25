# LottoMonitor (大乐透智析) - AI Coding Agent Guide

## Project Overview

**LottoMonitor** is a professional Super Lotto (China Sports Lottery 超级大乐透) data analysis tool built with React + TypeScript + Vite. It provides historical winning number queries, backtesting, trend analysis, and AI-powered number recommendations.

The application is designed primarily for iOS mobile devices with a responsive interface, but works on desktop browsers as well.

## Technology Stack

- **Frontend Framework**: React 19.2.3 + TypeScript 5.8.2
- **Build Tool**: Vite 6.2.0
- **Styling**: Tailwind CSS (loaded via CDN)
- **Charts**: Recharts 3.6.0
- **AI Services**: DeepSeek API (primary), Google Gemini API (legacy/backup)
- **Image Export**: html-to-image
- **Backend Data Crawler**: Python 3 with BeautifulSoup, pandas, APScheduler

## Project Structure

```
├── App.tsx              # Main application component
├── index.tsx            # React entry point
├── index.html           # HTML template with Tailwind CSS CDN
├── types.ts             # TypeScript type definitions
├── utils.ts             # Utility functions (prize checking, prediction)
├── constants.tsx        # Prize tiers and mock data
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript configuration
├── package.json         # Node.js dependencies
├── history.csv          # Lottery historical data (local database)
├── lotto_update.py      # Python crawler script
├── .env.local           # Environment variables (API keys)
├── components/
│   ├── HistoryView.tsx  # Historical data display and sync
│   ├── AnalyzerView.tsx # Number combination backtesting
│   ├── StatsView.tsx    # Trend charts and statistics
│   ├── AIView.tsx       # AI-powered number recommendations
│   └── BottomNav.tsx    # Bottom navigation bar
└── services/
    ├── lottoService.ts      # CSV data fetching and parsing
    ├── deepseekService.ts   # DeepSeek AI API integration
    └── geminiService.ts     # Google Gemini API integration
```

## Build Commands

```bash
# Install dependencies
npm install

# Start development server (runs on port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Development Environment Setup

1. **Prerequisites**: Node.js installed

2. **Environment Variables** (`.env.local`):
   ```
   GEMINI_API_KEY=your_gemini_api_key
   VITE_API_KEY=your_deepseek_api_key
   API_KEY=your_deepseek_api_key
   ```

3. **Run the app**:
   ```bash
   npm install
   npm run dev
   ```

The dev server runs on `http://localhost:3000` with HMR enabled.

## Application Architecture

### Data Flow
1. **Initial Load**: App reads from `localStorage` cache first, then fetches fresh data from `history.csv` on the server
2. **Data Persistence**: All data is stored in `localStorage` under key `dlt_history`
3. **Fallback Strategy**: If both server and cache fail, uses mock `INITIAL_DATA` from constants
4. **Sync**: Users can manually trigger sync via "同步云端" button to fetch latest data

### Tab Structure (Bottom Navigation)
- **历史 (History)**: View all historical winning numbers, export CSV, manual import via AI parsing
- **回测 (Analyzer)**: Input a number combination and check historical prize results
- **走势 (Stats)**: Visual charts including sum trends, range trends, hot numbers, and rear zone heatmap
- **AI选号 (AI)**: Generate number recommendations using DeepSeek AI with customizable constraints

### Key Data Types (`types.ts`)
```typescript
interface LottoDraw {
  id: string;      // Draw number (期号)
  date: string;    // Draw date (YYYY-MM-DD)
  front: number[]; // Front zone: 5 numbers (1-35)
  back: number[];  // Back zone: 2 numbers (1-12)
}
```

## Code Style Guidelines

- **Language**: All UI text is in Chinese; code comments are in Chinese
- **Component Style**: Functional components with React hooks
- **CSS Classes**: Tailwind utility classes with mobile-first responsive design
- **File Naming**: PascalCase for components, camelCase for utilities
- **State Management**: React `useState` and `useContext` (no external state library)
- **Path Alias**: `@/*` maps to project root (configured in `tsconfig.json` and `vite.config.ts`)

### Tailwind Patterns Used
- Background: `bg-slate-50` for app background, `bg-white` for cards
- Primary color: `blue-600` / `indigo-600`
- Front numbers: `red-50` background with `red-600` text
- Back numbers: `blue-50` background with `blue-600` text
- Card styling: `rounded-2xl`, `shadow-sm`, `border border-slate-100`
- Glass morphism effect: `glass-morphism` class defined in `index.html`

## Testing Strategy

**No formal test suite is currently configured.** The project relies on:
- TypeScript for type checking
- Manual testing during development
- Production build verification via `npm run preview`

## Data Crawler (Python Backend)

The `lotto_update.py` script is a standalone data synchronization tool:

### Features
- Scrapes latest lottery data from `https://datachart.500.com/dlt/`
- Runs scheduled tasks at 22:30, 23:00, 23:30, 00:00 (daily lottery draw times)
- Saves data to `history.csv` with deduplication
- Can run as a one-time update or continuous scheduler

### Dependencies
```bash
pip install requests beautifulsoup4 pandas apscheduler
```

### Usage
```bash
# One-time update
python lotto_update.py

# Start scheduler (continuous mode)
# Edit the main block to call start_scheduler()
```

## API Integration Notes

### DeepSeek API (Primary)
- **Endpoint**: `https://api.deepseek.com/chat/completions`
- **Model**: `deepseek-reasoner`
- **Features**:
  - Parse raw text into structured lottery data
  - Generate number recommendations based on historical patterns
  - Supports configurable constraints (sum, range, count)

### Google Gemini API (Legacy)
- **Model**: `gemini-3-flash-preview` / `gemini-3-pro-preview`
- Kept for backward compatibility but DeepSeek is the primary AI service

## Security Considerations

- **API Keys**: Stored in `.env.local` (not in version control)
- **No Authentication**: The app is client-side only; no user login system
- **Data Privacy**: All historical data is public lottery results; no personal data collected

## Deployment

### Static Hosting (Recommended)
1. Run `npm run build` to generate `dist/` folder
2. Deploy `dist/` contents to any static hosting (Nginx, Vercel, Netlify, etc.)
3. Ensure `history.csv` is also deployed and accessible at root path

### Nginx Configuration Notes
The `vite.config.ts` includes HMR WebSocket configuration for port 80 proxy:
```javascript
hmr: {
  clientPort: 80  // For Nginx proxy
}
```

## CSV Data Format

The `history.csv` file uses this schema:
```csv
id,date,f1,f2,f3,f4,f5,b1,b2
26014,2026-02-02,16,18,23,34,35,1,6
```

- `id`: Draw number (期号)
- `date`: Draw date (YYYY-MM-DD)
- `f1-f5`: Front zone numbers (1-35)
- `b1-b2`: Back zone numbers (1-12)

## Common Development Tasks

### Adding a New Tab
1. Add entry to `TabType` enum in `types.ts`
2. Create new component in `components/`
3. Add tab button to `BottomNav.tsx`
4. Add case in `renderLottoContent()` in `App.tsx`

### Modifying AI Prompts
Edit `services/deepseekService.ts`:
- `parseHistoryData()`: For raw text parsing
- `getSmartAnalysis()`: For number recommendations

### Updating the Data Crawler
Edit `lotto_update.py`:
- `TARGET_URL`: If the source website changes
- `fetch_latest_draws()`: CSS selectors for scraping
- `start_scheduler()`: Cron timing for scheduled tasks

## Troubleshooting

### HMR Not Working
Check `vite.config.ts` HMR configuration matches your proxy setup.

### API Errors
Verify `.env.local` contains valid API keys. DeepSeek API key format: `Bearer sk-...`

### CSV Loading Issues
Ensure `history.csv` is at the project root and the server serves it with correct MIME type.

### Type Errors
Run `npx tsc --noEmit` to check for TypeScript errors without emitting files.

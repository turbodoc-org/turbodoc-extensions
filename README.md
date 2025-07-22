# Turbodoc Browser Extension

One-click bookmarking for the modern web. Save and organize web content across all your devices.

## Overview

The Turbodoc Browser Extension provides seamless bookmarking functionality that integrates with the Turbodoc ecosystem. Users can save web pages, add notes, organize with tags, and access their bookmarks across all platforms.

## Features

### Core Features
- **One-click bookmarking** - Save any webpage instantly
- **Cross-browser compatibility** - Works on Chrome, Firefox, and Edge
- **Seamless authentication** - Sign in once, stay signed in
- **Rich metadata extraction** - Automatically captures page titles, descriptions, and more
- **Offline support** - Save bookmarks even when offline, sync when connection is restored

### User Interface
- **Popup interface** - Clean, intuitive bookmark creation form
- **Context menu integration** - Right-click to save pages and links
- **Visual feedback** - Success notifications and loading states
- **Tag suggestions** - Autocomplete based on existing tags

### Technical Features
- **Unified codebase** - Single codebase for multiple browsers
- **Background sync** - Automatic syncing of offline bookmarks
- **Secure storage** - Authentication tokens stored securely
- **Content script** - Enhanced page metadata extraction

## Architecture

```
turbodoc-extension/
├── shared/                     # Common code for all browsers
│   ├── popup/                  # Popup interface (HTML, CSS, JS)
│   ├── content/                # Content script for page interaction
│   ├── background/             # Background service worker/script
│   ├── lib/                    # Shared libraries and utilities
│   └── icons/                  # Extension icons
├── manifests/                  # Browser-specific manifest files
│   ├── chrome-manifest.json    # Chrome/Edge Manifest V3
│   └── firefox-manifest.json   # Firefox Manifest V2
├── build/                      # Build system
├── dist/                       # Generated extension packages
└── package.json               # Node.js dependencies and scripts
```

## Development

### Prerequisites

- Node.js 14+ 
- npm or yarn
- Chrome/Firefox browsers for testing

### Setup

1. Clone the repository
2. Navigate to the extension directory:
   ```bash
   cd turbodoc-extension
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Building

Build all platforms:
```bash
npm run build
```

Build specific platform:
```bash
npm run build:chrome
npm run build:firefox
```

Development mode with file watching:
```bash
npm run dev
```

Create distribution packages:
```bash
npm run package
```

### Testing

Load the extension for testing:

**Chrome:**
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `dist/chrome` directory

**Firefox:**
1. Open `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `manifest.json` from `dist/firefox` directory

### Available Scripts

- `npm run build` - Build extension for all platforms
- `npm run build:chrome` - Build Chrome version only
- `npm run build:firefox` - Build Firefox version only
- `npm run package` - Create zip packages for store submission
- `npm run dev` - Development mode with file watching
- `npm run clean` - Clean build directory
- `npm run lint` - Run ESLint
- `npm run test` - Run tests

## Browser Compatibility

### Chrome/Edge (Manifest V3)
- Uses service worker for background functionality
- Promise-based APIs
- Separate host permissions
- `chrome.*` API namespace

### Firefox (Manifest V2)
- Persistent background script
- Native promise support
- Combined permissions array
- `browser.*` API namespace

The browser compatibility layer (`lib/browser-compat.js`) abstracts these differences.

## Authentication & API Integration

The extension uses **Supabase** for authentication and can integrate with either:

1. **Supabase directly** - For simple setups using Supabase database
2. **Custom API backend** - For advanced features with custom business logic

### Supabase Authentication Features:
- **User signup/login** - Email/password authentication
- **Password reset** - Email-based password recovery  
- **Session management** - Automatic token refresh and persistence
- **Secure storage** - Sessions stored securely in browser extension storage

### API Integration:
- **Bookmarks** - CRUD operations on bookmark data
- **User data** - Tags, statistics, and preferences  
- **Sync** - Cross-device bookmark synchronization

See `SUPABASE_SETUP.md` for detailed setup instructions.

## Security & Privacy

- Authentication tokens stored in secure browser extension storage
- HTTPS-only API communication
- Minimal permissions requested
- No tracking or analytics
- Clear data on logout

## Store Submission

### Chrome Web Store
1. Build and package: `npm run build && npm run package`
2. Upload `dist/turbodoc-extension-chrome.zip`
3. Complete store listing with screenshots and description
4. Submit for review

### Firefox Add-ons (AMO)
1. Build and package: `npm run build && npm run package`
2. Upload `dist/turbodoc-extension-firefox.zip`
3. Choose distribution method (public or unlisted)
4. Submit for review

### Microsoft Edge Add-ons
- Uses same package as Chrome
- Separate store submission process
- Similar requirements to Chrome Web Store

## Contributing

1. Follow existing code style and conventions
2. Test changes in both Chrome and Firefox
3. Update documentation for new features
4. Ensure all builds pass before submitting

## License

MIT License - see LICENSE file for details

## Support

For support and feedback:
- GitHub Issues: [Repository Issues](https://github.com/turbodoc/turbodoc-extension/issues)
- Email: support@turbodoc.com
- Documentation: [Turbodoc Docs](https://docs.turbodoc.com)

---

**Note:** This extension uses Supabase for authentication. Follow the setup guide in `SUPABASE_SETUP.md` to configure your Supabase project.

## 🚀 Getting Started

To use the extension:

1. **Install dependencies**: `cd turbodoc-extension && npm install`
2. **Configure Supabase**: Follow the `SUPABASE_SETUP.md` guide to set up authentication
3. **Update configuration**: Edit `shared/lib/supabase-config.js` with your Supabase credentials
4. **Build extension**: `npm run build`
5. **Load in browser**: Load `dist/chrome` or `dist/firefox` as unpacked extension
6. **Add proper icons**: Replace placeholder icons with branded Turbodoc icons
7. **Test functionality**: Test signup, login, bookmarking, and offline features
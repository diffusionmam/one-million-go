# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the "One Million Go" project - a massively multiplayer web-based Go/Baduk game that scales from a single Tenuki Go board to a 1,000,000 board grid system. The project successfully restored legacy Tenuki code and built a sophisticated multi-layer rendering system on top of it.

## Key Commands

### Development Workflow
```bash
# Change to the project directory
cd /home/atharva/projects/one-million-go/one-million-go/root

# Install dependencies
npm install

# Build the library (JavaScript and CSS)
npm run build

# Build JavaScript only
npm run build:js

# Build CSS from SCSS only  
npm run build:css

# Run tests
npm test

# Start demo server (builds automatically and serves on port 8080)
./start-server.sh
# OR manually:
npm run build && python3 -m http.server 8080
```

### Demo Pages
- **Single Board Demo**: http://localhost:8080/index.html
- **Million Board Demo**: http://localhost:8080/million-go.html  
- **Test Page**: http://localhost:8080/test.html

## Architecture Overview

### Core System Architecture
The project uses a hybrid architecture combining the legacy Tenuki Go library with a modern multi-layer rendering system:

```
MillionGo (Main Controller)
├── ViewportManager - Camera position, zoom, coordinate transformations
├── BoardPool - Tenuki instance management with LRU caching  
├── HybridRenderer - 4-layer LOD rendering system
├── StateCache - Board state persistence and activity simulation
└── NetworkManager - WebSocket integration foundation
```

### Multi-Layer Rendering System
The rendering system uses 4 distinct layers based on zoom level and distance:

1. **Layer 1: Active Boards** (Zoom ≥ 0.5x, 0-2 boards from center)
   - Full Tenuki DOM instances with complete interactivity
   - Maximum detail with shadows, animations

2. **Layer 2: Near Boards** (Zoom ≥ 0.5x, 3-8 boards from center)  
   - Canvas sprites with simplified stone representations
   - Click to promote to Layer 1

3. **Layer 3: Regional View** (Zoom ≥ 0.1x, up to 50 boards)
   - Colored pixels showing board activity states
   - Heat map visualization

4. **Layer 4: Global View** (Zoom < 0.1x, all boards)
   - Aggregated activity patterns
   - Regional cluster visualization

### Memory Management
- **Board Pool**: Maintains 20-70 Tenuki instances maximum
- **Active Boards**: 5×5 matrix (25 boards) around camera center
- **Buffer Boards**: Additional 40 boards for smooth transitions
- **State Caching**: LRU cache for inactive board states
- **Total Memory**: ~3.5MB for entire 1M board system

### Coordinate Systems
- **Board Grid**: (0,0) to (999,999) - 1M board coordinate space
- **Screen Space**: Pixel coordinates for rendering
- **Camera Space**: Floating point board positions for smooth movement
- **Minimap Space**: Normalized 0-1 coordinates

## Build System

### Webpack Configuration
- **Entry**: `index.js` (Tenuki library export)
- **Output**: `build/tenuki.js` (UMD format for universal compatibility)
- **Transpilation**: Babel with @babel/preset-env
- **Mode**: Development with source maps

### Sass Compilation  
- **Source**: `scss/` directory
- **Output**: `build/` directory
- **Style**: Compressed for production

## Testing
- **Framework**: Mocha with Chai assertions
- **Source Maps**: Enabled for debugging
- **Helpers**: Located in `test/helpers.js`
- **Run Command**: `npm test`

## File Structure Patterns

### Core Tenuki Library (`src/`)
- `game.js` - Main game logic and rules engine
- `client.js` - Player interaction and move handling  
- `*-renderer.js` - DOM/SVG rendering implementations
- `board-state.js`, `intersection.js`, `region.js` - Game state management
- `ruleset.js`, `scorer.js` - Go rules and scoring logic

### Million Go Extensions (`js/`)
- `hybrid-renderer.js` - Multi-layer rendering controller
- `board-pool.js` - Tenuki instance pool management
- `viewport-manager.js` - Camera and coordinate system
- `state-cache.js` - Board state persistence with LRU
- `network-manager.js` - WebSocket integration foundation

### Styling (`scss/`)
- Component-specific SCSS files for different renderers
- Compiled to `build/` directory via Sass

## Development Notes

Project successfully works in one instantiation, but fails while scaling with
> broken UI while rendering
> being hyper memory extensive*

Ideal goal is to create a system as described below.
1. Hybrid Rendering Strategy
Visible Boards: Use full Tenuki instances (6-10 boards max)
Near-Visible: Simplified canvas sprites (50-100 boards)
Far Away: Just metadata dots on minimap (999,900+ boards)
Key Insight: Nobody needs to see all 1M boards at once in detail

2. Lazy board instantiation
Current: Each Tenuki board = ~100KB memory
1M boards × 100KB = 100GB ❌ Impossible

Solution: Only instantiate boards when:
- Player navigates near them
- Board has active stones
- Board is in viewport buffer zone

3. Server-Side State Management
Backend holds truth: All 1M board states in compressed format
Client holds cache: Only ~100 active board states
WebSocket sync: Stream board updates as needed
Delta updates: Only send changes, not full states

Server will eventually be hosted on AWS. But before hosting, we need to manually check how much memoryis being consumed. Our ideal goal is to run all this in a single process.

### Technical Implementation Strategy
## Frontend Architecture
1. Virtual Grid System
Canvas-based viewport (2000×1200px)
Virtual coordinate system (0,0) to (999,999)
Quadtree spatial indexing for efficient lookups

2. Board Pooling*
Reuse Tenuki instances like object pooling, but just the boards with no changes made in the board state
Max 9 Tenuki instances in memory (use them in 3 by 3 matrix format with themiddle one attached to the screen)
Swap board states in/out as user navigates

3. Progressive Loading
Load boards in concentric rings from viewport center
Priority queue based on:
Distance from viewport
Board activity level
Player interaction history

## Scaling Plan
For detailed information on how to scale this project to handle millions of concurrent users, see the [SCALING-PLAN.md](SCALING-PLAN.md) document. This document outlines the complete architecture for both frontend and backend scaling, including zone-based distribution, memory optimization, and protocol improvements.



### Performance Considerations
- Maintains 60 FPS during navigation across the full grid
- Viewport culling ensures only visible elements are rendered
- Predictive loading based on camera movement direction
- Automatic memory cleanup for distant boards

### Coordinate Transformations
The ViewportManager handles complex coordinate transformations between different spaces. Always use the provided methods rather than manual calculations.

### Board State Management
Board states are automatically cached when boards become inactive and restored when they become active again. The system handles this transparently.

### Network Integration
The NetworkManager provides stubs for WebSocket integration. When implementing multiplayer features, replace the stub methods with actual WebSocket communication.
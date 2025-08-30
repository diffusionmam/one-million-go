/**
 * HybridRenderer - Handles multi-layer rendering of the massive board grid
 * Core responsibility: Render different detail levels based on distance from viewport
 */
class HybridRenderer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.minimap = null;
        this.minimapCtx = null;
        
        // Rendering settings
        this.showDebugInfo = true;
        this.lastRenderTime = 0;
        this.frameCount = 0;
        
        console.log('🎨 HybridRenderer created');
    }
    
    async initialize() {
        console.log('🎨 HybridRenderer initializing...');
        
        // Get canvas elements
        this.canvas = document.getElementById('viewport-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.minimap = document.getElementById('minimap');
        this.minimapCtx = this.minimap.getContext('2d');
        
        // Set up canvas properties
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        this.minimap.width = 200;
        this.minimap.height = 200;
        
        console.log('✅ HybridRenderer initialized');
    }
    
    render(viewport, boardPool, stateCache) {
        const startTime = performance.now();
        
        // Clear main canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // FIXED: Always render active 5x5 matrix + optional background based on zoom
        this.renderLayer1_ActiveBoards(viewport, boardPool);
        
        if (viewport.zoom <= 0.5) {
            // At low zoom, show background context
            this.renderLayer3_RegionalView(viewport, stateCache);
        }
        
        // Always render minimap
        this.renderMinimap(viewport, stateCache);
        
        // Render debug info
        if (this.showDebugInfo) {
            this.renderDebugInfo(viewport, boardPool, startTime);
        }
        
        this.frameCount++;
    }
    
    renderLayer1_ActiveBoards(viewport, boardPool) {
        // Layer 1: Active boards are rendered by Tenuki DOM elements
        // We just need to position them (done in BoardPool.positionBoards)
        boardPool.positionBoards(viewport);
        
        // FIXED: Draw 5x5 matrix outline
        const matrixSize = 5;
        const baseBoardSize = 150;
        const scaledBoardSize = baseBoardSize * viewport.zoom;
        const totalMatrixWidth = matrixSize * (baseBoardSize + viewport.boardSpacing) - viewport.boardSpacing;
        const totalMatrixHeight = matrixSize * (baseBoardSize + viewport.boardSpacing) - viewport.boardSpacing;
        
        const startX = (viewport.viewportWidth - totalMatrixWidth) / 2;
        const startY = (viewport.viewportHeight - totalMatrixHeight) / 2;
        
        // Draw matrix outline
        this.ctx.strokeStyle = '#FFD700'; // Gold outline
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(startX - 5, startY - 5, totalMatrixWidth + 10, totalMatrixHeight + 10);
        
        // Draw grid lines for the 5x5 matrix
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 1;
        
        for (let i = 0; i <= matrixSize; i++) {
            const x = startX + i * (baseBoardSize + viewport.boardSpacing) - viewport.boardSpacing / 2;
            const y = startY + i * (baseBoardSize + viewport.boardSpacing) - viewport.boardSpacing / 2;
            
            // Vertical lines
            this.ctx.beginPath();
            this.ctx.moveTo(x, startY - viewport.boardSpacing / 2);
            this.ctx.lineTo(x, startY + totalMatrixHeight + viewport.boardSpacing / 2);
            this.ctx.stroke();
            
            // Horizontal lines
            this.ctx.beginPath();
            this.ctx.moveTo(startX - viewport.boardSpacing / 2, y);
            this.ctx.lineTo(startX + totalMatrixWidth + viewport.boardSpacing / 2, y);
            this.ctx.stroke();
        }
    }
    
    renderLayer2_NearBoards(viewport, stateCache) {
        // Layer 2: Simple sprites for nearby boards
        const visibleBoards = viewport.getVisibleBoards();
        
        this.ctx.fillStyle = '#8B4513'; // Brown board color
        this.ctx.strokeStyle = '#654321';
        this.ctx.lineWidth = 1;
        
        for (const boardInfo of visibleBoards) {
            if (boardInfo.distance > 2 && boardInfo.distance <= 8) {
                const rect = viewport.getBoardScreenRect(boardInfo.x, boardInfo.y);
                
                // Skip if too small to see
                if (rect.width < 10) continue;
                
                // Draw board background
                this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
                this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
                
                // Draw simple grid lines
                if (rect.width > 20) {
                    this.drawSimpleGrid(rect);
                }
                
                // Draw stones as simple dots
                this.drawSimpleStones(boardInfo.x, boardInfo.y, rect, stateCache);
                
                // Draw activity indicator
                this.drawActivityIndicator(boardInfo.x, boardInfo.y, rect, stateCache);
            }
        }
    }
    
    drawSimpleGrid(rect) {
        this.ctx.strokeStyle = '#654321';
        this.ctx.lineWidth = 0.5;
        
        const gridSize = 19;
        const cellWidth = rect.width / gridSize;
        const cellHeight = rect.height / gridSize;
        
        // Draw a few representative grid lines
        for (let i = 3; i < gridSize; i += 4) {
            // Vertical lines
            const x = rect.x + i * cellWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(x, rect.y);
            this.ctx.lineTo(x, rect.y + rect.height);
            this.ctx.stroke();
            
            // Horizontal lines
            const y = rect.y + i * cellHeight;
            this.ctx.beginPath();
            this.ctx.moveTo(rect.x, y);
            this.ctx.lineTo(rect.x + rect.width, y);
            this.ctx.stroke();
        }
    }
    
    drawSimpleStones(boardX, boardY, rect, stateCache) {
        // Get cached board state
        const state = stateCache.getBoardState(boardX, boardY);
        if (!state || !state.stones) return;
        
        const gridSize = 19;
        const cellWidth = rect.width / gridSize;
        const cellHeight = rect.height / gridSize;
        const stoneRadius = Math.min(cellWidth, cellHeight) * 0.3;
        
        // Only draw if stones are visible
        if (stoneRadius < 1) return;
        
        for (const stone of state.stones) {
            const x = rect.x + (stone.x + 0.5) * cellWidth;
            const y = rect.y + (stone.y + 0.5) * cellHeight;
            
            this.ctx.fillStyle = stone.color === 'black' ? '#000' : '#fff';
            this.ctx.beginPath();
            this.ctx.arc(x, y, stoneRadius, 0, Math.PI * 2);
            this.ctx.fill();
            
            if (stone.color === 'white') {
                this.ctx.strokeStyle = '#000';
                this.ctx.lineWidth = 0.5;
                this.ctx.stroke();
            }
        }
    }
    
    drawActivityIndicator(boardX, boardY, rect, stateCache) {
        const activity = stateCache.getBoardActivity(boardX, boardY);
        if (activity <= 0) return;
        
        // Draw activity as colored corner indicator
        const intensity = Math.min(activity / 10, 1); // Normalize to 0-1
        const size = Math.min(rect.width, rect.height) * 0.2;
        
        this.ctx.fillStyle = `rgba(255, ${255 - intensity * 200}, 0, ${intensity})`;
        this.ctx.fillRect(rect.x + rect.width - size, rect.y, size, size);
    }
    
    renderLayer3_RegionalView(viewport, stateCache) {
        // Layer 3: Regional overview - boards as colored pixels
        const visibleBoards = viewport.getVisibleBoards();
        
        for (const boardInfo of visibleBoards) {
            if (boardInfo.distance <= 50) {
                const rect = viewport.getBoardScreenRect(boardInfo.x, boardInfo.y);
                
                // Skip if too small
                if (rect.width < 2) continue;
                
                // Color based on board state
                const activity = stateCache.getBoardActivity(boardInfo.x, boardInfo.y);
                const stoneCount = stateCache.getBoardStoneCount(boardInfo.x, boardInfo.y);
                
                let color = '#333'; // Empty board
                if (stoneCount > 0) {
                    const intensity = Math.min(stoneCount / 50, 1);
                    color = `rgb(${100 + intensity * 155}, ${80 + intensity * 100}, 60)`;
                }
                
                if (activity > 0) {
                    const activityIntensity = Math.min(activity / 5, 1);
                    color = `rgb(255, ${255 - activityIntensity * 200}, 0)`;
                }
                
                this.ctx.fillStyle = color;
                this.ctx.fillRect(rect.x, rect.y, Math.max(2, rect.width), Math.max(2, rect.height));
            }
        }
    }
    
    renderLayer4_GlobalView(viewport, stateCache) {
        // Layer 4: Global overview - show general patterns
        const gridSize = 50; // Show every 20th board
        const effectiveBoardSize = (viewport.boardSize + viewport.boardSpacing) * viewport.zoom;
        
        for (let y = 0; y < 1000; y += gridSize) {
            for (let x = 0; x < 1000; x += gridSize) {
                const rect = viewport.getBoardScreenRect(x, y);
                
                if (rect.width >= 1 && rect.height >= 1) {
                    // Aggregate activity in this region
                    const regionActivity = this.getRegionActivity(x, y, gridSize, stateCache);
                    
                    let color = '#222';
                    if (regionActivity > 0) {
                        const intensity = Math.min(regionActivity / 100, 1);
                        color = `rgb(${50 + intensity * 205}, ${30 + intensity * 200}, 30)`;
                    }
                    
                    this.ctx.fillStyle = color;
                    this.ctx.fillRect(rect.x, rect.y, Math.max(1, rect.width), Math.max(1, rect.height));
                }
            }
        }
    }
    
    getRegionActivity(startX, startY, size, stateCache) {
        let totalActivity = 0;
        let count = 0;
        
        for (let y = startY; y < Math.min(startY + size, 1000); y += 5) {
            for (let x = startX; x < Math.min(startX + size, 1000); x += 5) {
                totalActivity += stateCache.getBoardActivity(x, y);
                count++;
            }
        }
        
        return count > 0 ? totalActivity / count : 0;
    }
    
    renderMinimap(viewport, stateCache) {
        // Clear minimap
        this.minimapCtx.fillStyle = '#111';
        this.minimapCtx.fillRect(0, 0, 200, 200);
        
        // Draw grid overlay
        this.minimapCtx.strokeStyle = '#333';
        this.minimapCtx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const pos = (i / 10) * 200;
            this.minimapCtx.beginPath();
            this.minimapCtx.moveTo(pos, 0);
            this.minimapCtx.lineTo(pos, 200);
            this.minimapCtx.moveTo(0, pos);
            this.minimapCtx.lineTo(200, pos);
            this.minimapCtx.stroke();
        }
        
        // Draw activity heat map (sample every 10th board)
        for (let y = 0; y < 1000; y += 10) {
            for (let x = 0; x < 1000; x += 10) {
                const activity = stateCache.getBoardActivity(x, y);
                if (activity > 0) {
                    const intensity = Math.min(activity / 10, 1);
                    const pixelX = (x / 1000) * 200;
                    const pixelY = (y / 1000) * 200;
                    
                    this.minimapCtx.fillStyle = `rgba(255, ${255 - intensity * 200}, 0, ${intensity})`;
                    this.minimapCtx.fillRect(pixelX, pixelY, 2, 2);
                }
            }
        }
        
        // Draw camera viewport indicator
        const cameraMinimapPos = viewport.boardToMinimap(viewport.cameraX, viewport.cameraY);
        const viewportSize = Math.min(20, 200 * viewport.zoom);
        
        this.minimapCtx.strokeStyle = '#00ff00';
        this.minimapCtx.lineWidth = 2;
        this.minimapCtx.strokeRect(
            cameraMinimapPos.x * 200 - viewportSize / 2,
            cameraMinimapPos.y * 200 - viewportSize / 2,
            viewportSize,
            viewportSize
        );
    }
    
    renderDebugInfo(viewport, boardPool, startTime) {
        const renderTime = performance.now() - startTime;
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, this.canvas.height - 100, 200, 80);
        
        this.ctx.fillStyle = '#0f0';
        this.ctx.font = '12px monospace';
        
        const lines = [
            `Render: ${renderTime.toFixed(1)}ms`,
            `Zoom: ${viewport.zoom.toFixed(2)}x`,
            `Active: ${boardPool.getActiveCount()}`,
            `Cached: ${boardPool.getCachedStatesCount()}`,
            `Frame: ${this.frameCount}`
        ];
        
        lines.forEach((line, i) => {
            this.ctx.fillText(line, 15, this.canvas.height - 85 + i * 15);
        });
    }
    
    toggleDebugInfo() {
        this.showDebugInfo = !this.showDebugInfo;
    }
} 
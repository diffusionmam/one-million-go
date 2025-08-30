/**
 * ViewportManager - Handles camera position, zoom, and coordinate transformations
 * Core responsibility: Convert between screen space and board space coordinates
 */
class ViewportManager {
    constructor() {
        // Camera position in board coordinates (0-999)
        this.cameraX = 500;
        this.cameraY = 500;
        
        // Zoom level (2.0 = zoomed in, 0.5 = zoomed out)
        this.zoom = 2.0;
        
        // Viewport size in pixels
        this.viewportWidth = 800;
        this.viewportHeight = 600;
        
        // Board display settings - FIXED for 5x5 matrix
        this.boardSize = 120; // Size of each board in pixels at base zoom
        this.boardSpacing = 10; // Gap between boards
        
        // FIXED: Static 5x5 matrix of active boards
        this.activeMatrixSize = 5; // 5x5 = 25 boards
        this.bufferRadius = 3; // Load 3 extra boards around the matrix
        
        console.log('📷 ViewportManager created');
    }
    
    async initialize() {
        console.log('📷 ViewportManager initializing...');
        
        // Set initial viewport size
        this.setViewportSize(window.innerWidth, window.innerHeight);
        
        console.log('✅ ViewportManager initialized');
    }
    
    setViewportSize(width, height) {
        this.viewportWidth = width;
        this.viewportHeight = height;
        
        // FIXED: Static matrix size - no longer dependent on viewport size
        console.log(`📷 Viewport: ${width}×${height}, Active matrix: ${this.activeMatrixSize}×${this.activeMatrixSize} (25 boards)`);
    }
    
    setCameraPosition(x, y) {
        // Clamp to valid board range
        this.cameraX = Math.max(0, Math.min(999, x));
        this.cameraY = Math.max(0, Math.min(999, y));
        
        console.log(`📷 Camera moved to (${this.cameraX.toFixed(1)}, ${this.cameraY.toFixed(1)})`);
    }
    
    moveCamera(deltaX, deltaY) {
        this.setCameraPosition(this.cameraX + deltaX, this.cameraY + deltaY);
    }
    
    /**
     * Get list of board coordinates for 5x5 active matrix + buffer boards
     * Returns array of {x, y, distance, isActive} objects
     */
    getVisibleBoards() {
        const boards = [];
        const centerX = Math.floor(this.cameraX);
        const centerY = Math.floor(this.cameraY);
        
        // FIXED: Create 5x5 active matrix centered on camera
        const matrixOffset = Math.floor(this.activeMatrixSize / 2); // 2 for 5x5
        
        // Calculate total range including buffer
        const totalRange = matrixOffset + this.bufferRadius;
        
        for (let dy = -totalRange; dy <= totalRange; dy++) {
            for (let dx = -totalRange; dx <= totalRange; dx++) {
                const boardX = centerX + dx;
                const boardY = centerY + dy;
                
                // Check bounds
                if (boardX >= 0 && boardX < 1000 && boardY >= 0 && boardY < 1000) {
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // Determine if this board is in the active 5x5 matrix
                    const isActive = Math.abs(dx) <= matrixOffset && Math.abs(dy) <= matrixOffset;
                    
                    boards.push({
                        x: boardX,
                        y: boardY,
                        distance: distance,
                        isActive: isActive,
                        matrixX: dx + matrixOffset, // Position in 5x5 matrix (0-4)
                        matrixY: dy + matrixOffset, // Position in 5x5 matrix (0-4)
                        priority: isActive ? distance : distance + 100 // Active boards get higher priority
                    });
                }
            }
        }
        
        // Sort by priority (active boards first, then by distance)
        return boards.sort((a, b) => a.priority - b.priority);
    }
    
    calculatePriority(dx, dy, distance) {
        // Base priority is distance
        let priority = distance;
        
        // Bonus for center of screen
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
            priority -= 10; // High priority for center boards
        }
        
        // Penalty for being exactly on edge of visible area
        if (Math.abs(dx) >= this.visibleBoardsX / 2 || Math.abs(dy) >= this.visibleBoardsY / 2) {
            priority += 5;
        }
        
        return priority;
    }
    
    /**
     * Convert screen coordinates to board space coordinates
     */
    screenToBoard(screenX, screenY) {
        const effectiveBoardSize = (this.boardSize + this.boardSpacing) * this.zoom;
        
        // Center of screen in board coordinates
        const centerScreenX = this.viewportWidth / 2;
        const centerScreenY = this.viewportHeight / 2;
        
        // Offset from center
        const offsetX = (screenX - centerScreenX) / effectiveBoardSize;
        const offsetY = (screenY - centerScreenY) / effectiveBoardSize;
        
        return {
            x: this.cameraX + offsetX,
            y: this.cameraY + offsetY
        };
    }
    
    /**
     * Convert board coordinates to screen coordinates
     */
    boardToScreen(boardX, boardY) {
        const effectiveBoardSize = (this.boardSize + this.boardSpacing) * this.zoom;
        
        // Offset from camera
        const offsetX = boardX - this.cameraX;
        const offsetY = boardY - this.cameraY;
        
        // Convert to screen space
        const screenX = (this.viewportWidth / 2) + (offsetX * effectiveBoardSize);
        const screenY = (this.viewportHeight / 2) + (offsetY * effectiveBoardSize);
        
        return { x: screenX, y: screenY };
    }
    
    /**
     * Get the screen rectangle for a board at given coordinates
     * FIXED: Static positioning for 5x5 matrix
     */
    getBoardScreenRect(boardX, boardY) {
        const centerX = Math.floor(this.cameraX);
        const centerY = Math.floor(this.cameraY);
        
        // Calculate relative position from camera center
        const dx = boardX - centerX;
        const dy = boardY - centerY;
        
        const matrixOffset = Math.floor(this.activeMatrixSize / 2); // 2 for 5x5
        
        // Check if this board is in the active matrix
        if (Math.abs(dx) <= matrixOffset && Math.abs(dy) <= matrixOffset) {
            // FIXED: Static grid positioning for active boards
            // Base board size for layout (150px as defined in CSS)
            const baseBoardSize = 150;
            const totalMatrixWidth = this.activeMatrixSize * (baseBoardSize + this.boardSpacing) - this.boardSpacing;
            const totalMatrixHeight = this.activeMatrixSize * (baseBoardSize + this.boardSpacing) - this.boardSpacing;
            
            // Position in matrix (0-4 for 5x5)
            const matrixX = dx + matrixOffset;
            const matrixY = dy + matrixOffset;
            
            // Screen position (centered)
            const startX = (this.viewportWidth - totalMatrixWidth) / 2;
            const startY = (this.viewportHeight - totalMatrixHeight) / 2;
            
            // Calculate actual size after scaling
            const scaledBoardSize = baseBoardSize * this.zoom;
            
            return {
                x: startX + matrixX * (baseBoardSize + this.boardSpacing),
                y: startY + matrixY * (baseBoardSize + this.boardSpacing),
                width: scaledBoardSize,
                height: scaledBoardSize,
                isInMatrix: true
            };
        } else {
            // Buffer boards - positioned off-screen or hidden
            return {
                x: -1000, // Off-screen
                y: -1000,
                width: 150 * this.zoom,
                height: 150 * this.zoom,
                isInMatrix: false
            };
        }
    }
    
    /**
     * Check if a board is currently visible on screen
     */
    isBoardVisible(boardX, boardY) {
        const rect = this.getBoardScreenRect(boardX, boardY);
        
        return rect.x + rect.width >= 0 && 
               rect.x <= this.viewportWidth &&
               rect.y + rect.height >= 0 && 
               rect.y <= this.viewportHeight;
    }
    
    /**
     * Get minimap coordinates (0-1) for given board coordinates
     */
    boardToMinimap(boardX, boardY) {
        return {
            x: boardX / 1000,
            y: boardY / 1000
        };
    }
    
    /**
     * Convert minimap coordinates (0-1) to board coordinates
     */
    minimapToBoard(minimapX, minimapY) {
        return {
            x: minimapX * 1000,
            y: minimapY * 1000
        };
    }
} 
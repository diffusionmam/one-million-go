/**
 * BoardPool - Manages a pool of Tenuki board instances for efficient reuse
 * Core responsibility: Provide active Tenuki boards and manage their lifecycle
 */
class BoardPool {
    constructor() {
        // Pool of Tenuki instances
        this.activeBoardsMap = new Map(); // Map<"x,y", BoardInstance>
        this.bufferBoardsMap = new Map(); // Map<"x,y", BoardInstance> for buffer boards
        this.availableBoards = []; // Array of unused BoardInstance objects
        this.maxActiveBoards = 25; // FIXED: 5x5 matrix = 25 active boards
        this.maxBufferBoards = 40; // Buffer boards around the matrix
        this.maxPoolSize = 70; // Maximum total boards in pool
        
        // Board state tracking
        this.boardStates = new Map(); // Map<"x,y", GameState>
        
        console.log('🎮 BoardPool created');
    }
    
    async initialize() {
        console.log('🎮 BoardPool initializing...');
        
        // Pre-create some board instances
        await this.preallocateBoards(30); // More instances for 5x5 + buffer
        
        console.log(`✅ BoardPool initialized with ${this.availableBoards.length} boards`);
    }
    
    async preallocateBoards(count) {
        const container = document.getElementById('boards-container');
        
        for (let i = 0; i < count; i++) {
            const boardInstance = await this.createBoardInstance();
            this.availableBoards.push(boardInstance);
        }
        
        console.log(`🎮 Pre-allocated ${count} board instances`);
    }
    
    async createBoardInstance() {
        // Create DOM element for the board
        const element = document.createElement('div');
        element.className = 'active-board'; // FIXED: Remove tenuki classes from container
        element.style.display = 'none'; // Hidden until activated
        
        // Create coordinate label
        const label = document.createElement('div');
        label.className = 'board-coordinates';
        element.appendChild(label);
        
        // Add to container
        document.getElementById('boards-container').appendChild(element);
        
        // Create inner container for Tenuki
        const tenukiContainer = document.createElement('div');
        tenukiContainer.className = 'tenuki-board tenuki-dom-renderer';
        element.appendChild(tenukiContainer);
        
        // Create Tenuki game instance
        let tenukiGame = null;
        try {
            tenukiGame = new tenuki.Game({
                element: tenukiContainer, // FIXED: Use inner container
                boardSize: 19,
                renderer: 'dom'
            });
        } catch (error) {
            console.error('Failed to create Tenuki game:', error);
        }
        
        const boardInstance = {
            id: `board_${Date.now()}_${Math.random()}`,
            element: element,
            label: label,
            tenukiGame: tenukiGame,
            boardX: null,
            boardY: null,
            isActive: false,
            lastUsed: Date.now(),
            state: 'available' // available, active, loading
        };
        
        console.log(`🎮 Created board instance: ${boardInstance.id}`);
        return boardInstance;
    }
    
    async getActiveBoard(boardX, boardY) {
        const key = `${boardX},${boardY}`;
        
        // Check if already active
        if (this.activeBoardsMap.has(key)) {
            const board = this.activeBoardsMap.get(key);
            board.lastUsed = Date.now();
            return board;
        }
        
        // Check if we have too many active boards
        if (this.activeBoardsMap.size >= this.maxActiveBoards) {
            await this.evictOldestActiveBoard();
        }
        
        // Check if it's in buffer and promote it
        if (this.bufferBoardsMap.has(key)) {
            const bufferBoard = this.bufferBoardsMap.get(key);
            this.bufferBoardsMap.delete(key);
            
            // Promote buffer board to active
            await this.promoteToActive(bufferBoard, boardX, boardY);
            this.activeBoardsMap.set(key, bufferBoard);
            
            console.log(`🎮 Promoted buffer board to active: (${boardX}, ${boardY})`);
            return bufferBoard;
        }
        
        // Get or create a board instance
        let boardInstance = this.availableBoards.pop();
        if (!boardInstance) {
            boardInstance = await this.createBoardInstance();
        }
        
        // Activate the board for this position
        await this.activateBoard(boardInstance, boardX, boardY, true); // true = isActive
        
        // Add to active map
        this.activeBoardsMap.set(key, boardInstance);
        
        console.log(`🎮 Activated new board for (${boardX}, ${boardY})`);
        return boardInstance;
    }
    
    async getBufferBoard(boardX, boardY) {
        const key = `${boardX},${boardY}`;
        
        // Check if already in buffer
        if (this.bufferBoardsMap.has(key)) {
            const board = this.bufferBoardsMap.get(key);
            board.lastUsed = Date.now();
            return board;
        }
        
        // Check if it's already active (don't duplicate)
        if (this.activeBoardsMap.has(key)) {
            return this.activeBoardsMap.get(key);
        }
        
        // Check if we have too many buffer boards
        if (this.bufferBoardsMap.size >= this.maxBufferBoards) {
            await this.evictOldestBufferBoard();
        }
        
        // Get or create a board instance
        let boardInstance = this.availableBoards.pop();
        if (!boardInstance) {
            boardInstance = await this.createBoardInstance();
        }
        
        // Activate as buffer board
        await this.activateBoard(boardInstance, boardX, boardY, false); // false = isBuffer
        
        // Add to buffer map
        this.bufferBoardsMap.set(key, boardInstance);
        
        console.log(`🎮 Created buffer board for (${boardX}, ${boardY})`);
        return boardInstance;
    }
    
    async activateBoard(boardInstance, boardX, boardY, isActive = true) {
        boardInstance.boardX = boardX;
        boardInstance.boardY = boardY;
        boardInstance.isActive = isActive;
        boardInstance.isBuffer = !isActive;
        boardInstance.lastUsed = Date.now();
        boardInstance.state = 'loading';
        
        // Update coordinate label
        boardInstance.label.textContent = `(${boardX},${boardY})`;
        
        // Show the board element only if it's active
        boardInstance.element.style.display = isActive ? 'block' : 'none';
        
        // CRITICAL FIX: Load unique board state for this specific coordinate
        const gameState = await this.loadBoardState(boardX, boardY);
        
        // CRITICAL FIX: Create a fresh Tenuki game for this coordinate
        if (boardInstance.tenukiGame) {
            // Find or create the Tenuki container
            let tenukiContainer = boardInstance.element.querySelector('.tenuki-board');
            if (!tenukiContainer) {
                tenukiContainer = document.createElement('div');
                tenukiContainer.className = 'tenuki-board tenuki-dom-renderer';
                boardInstance.element.appendChild(tenukiContainer);
            } else {
                // Clear existing content
                tenukiContainer.innerHTML = '';
            }
            
            // Create new Tenuki game instance for this specific coordinate
            boardInstance.tenukiGame = new tenuki.Game({
                element: tenukiContainer, // FIXED: Use proper container
                boardSize: 19, // FIXED: Always 19x19
                renderer: 'dom'
            });
        }
        
        // Apply the coordinate-specific state to the fresh game
        if (boardInstance.tenukiGame && gameState) {
            await this.applyGameState(boardInstance.tenukiGame, gameState);
        }
        
        boardInstance.state = 'active';
        console.log(`🎮 Board (${boardX}, ${boardY}) activated as ${isActive ? 'active' : 'buffer'} with unique state`);
    }
    
    async promoteToActive(boardInstance, boardX, boardY) {
        // Convert buffer board to active board
        boardInstance.isActive = true;
        boardInstance.isBuffer = false;
        boardInstance.lastUsed = Date.now();
        
        // Show the board element
        boardInstance.element.style.display = 'block';
        
        console.log(`🎮 Promoted (${boardX}, ${boardY}) from buffer to active`);
    }
    
    async loadBoardState(boardX, boardY) {
        const key = `${boardX},${boardY}`;
        
        // Check local cache first
        if (this.boardStates.has(key)) {
            return this.boardStates.get(key);
        }
        
        // CRITICAL FIX: Create coordinate-specific board state
        // Use coordinate-based seed for deterministic but unique states
        const coordinateSeed = boardX * 1000 + boardY;
        
        // Generate some moves based on coordinate to make each board unique
        const moves = [];
        const numMoves = coordinateSeed % 10; // 0-9 moves based on coordinates
        
        for (let i = 0; i < numMoves; i++) {
            const moveX = (coordinateSeed + i * 3) % 19;
            const moveY = (coordinateSeed + i * 7) % 19;
            moves.push({
                x: moveX,
                y: moveY,
                color: i % 2 === 0 ? 'black' : 'white',
                move: i + 1
            });
        }
        
        const gameState = {
            coordinate: { x: boardX, y: boardY }, // Store coordinate identity
            moves: moves,
            currentPlayer: numMoves % 2 === 0 ? 'black' : 'white',
            boardSize: 19,
            gamePhase: 'playing',
            uniqueId: `board_${boardX}_${boardY}` // Unique identifier
        };
        
        // Cache the state
        this.boardStates.set(key, gameState);
        
        console.log(`🎮 Created unique state for (${boardX}, ${boardY}) with ${numMoves} moves`);
        return gameState;
    }
    
    async applyGameState(tenukiGame, gameState) {
        try {
            // CRITICAL FIX: Actually apply the moves to make each board unique
            for (const move of gameState.moves) {
                try {
                    // Apply move to the Tenuki game
                    tenukiGame.playAt(move.x, move.y);
                } catch (moveError) {
                    // If move is invalid (position occupied, etc.), skip it
                    console.warn(`⚠️ Skipped invalid move at (${move.x}, ${move.y}):`, moveError.message);
                }
            }
            
            console.log(`🎮 Applied ${gameState.moves.length} moves to board (${gameState.coordinate.x}, ${gameState.coordinate.y})`);
        } catch (error) {
            console.error('Failed to apply game state:', error);
        }
    }
    
    async evictOldestActiveBoard() {
        let oldestBoard = null;
        let oldestTime = Date.now();
        
        for (const [key, board] of this.activeBoardsMap) {
            if (board.lastUsed < oldestTime) {
                oldestTime = board.lastUsed;
                oldestBoard = { key, board };
            }
        }
        
        if (oldestBoard) {
            await this.deactivateBoard(oldestBoard.key, oldestBoard.board, 'active');
            console.log(`🎮 Evicted oldest active board: ${oldestBoard.key}`);
        }
    }
    
    async evictOldestBufferBoard() {
        let oldestBoard = null;
        let oldestTime = Date.now();
        
        for (const [key, board] of this.bufferBoardsMap) {
            if (board.lastUsed < oldestTime) {
                oldestTime = board.lastUsed;
                oldestBoard = { key, board };
            }
        }
        
        if (oldestBoard) {
            await this.deactivateBoard(oldestBoard.key, oldestBoard.board, 'buffer');
            console.log(`🎮 Evicted oldest buffer board: ${oldestBoard.key}`);
        }
    }
    
    async deactivateBoard(key, boardInstance, boardType = 'active') {
        // Remove from appropriate map
        if (boardType === 'active') {
            this.activeBoardsMap.delete(key);
        } else {
            this.bufferBoardsMap.delete(key);
        }
        
        // Save current state
        if (boardInstance.tenukiGame) {
            const currentState = await this.extractGameState(boardInstance.tenukiGame);
            this.boardStates.set(key, currentState);
        }
        
        // Reset board instance
        boardInstance.boardX = null;
        boardInstance.boardY = null;
        boardInstance.isActive = false;
        boardInstance.isBuffer = false;
        boardInstance.state = 'available';
        boardInstance.element.style.display = 'none';
        
        // Return to available pool if not at capacity
        const totalActiveBoards = this.activeBoardsMap.size + this.bufferBoardsMap.size;
        if (this.availableBoards.length < this.maxPoolSize - totalActiveBoards) {
            this.availableBoards.push(boardInstance);
        } else {
            // Remove from DOM and cleanup
            boardInstance.element.remove();
            console.log(`🎮 Destroyed excess board instance: ${boardInstance.id}`);
        }
    }
    
    async extractGameState(tenukiGame) {
        // Extract current game state from Tenuki
        // For now, return basic state
        return {
            moves: [],
            currentPlayer: tenukiGame.isBlackPlaying() ? 'black' : 'white',
            boardSize: 19,
            gamePhase: tenukiGame.isOver() ? 'finished' : 'playing'
        };
    }
    
    positionBoards(viewport) {
        // Position all active boards in 5x5 matrix
        for (const [key, board] of this.activeBoardsMap) {
            if (board.isActive && board.boardX !== null && board.boardY !== null) {
                const rect = viewport.getBoardScreenRect(board.boardX, board.boardY);
                
                // Only position boards that are in the matrix
                if (rect.isInMatrix) {
                    // Position the board element accounting for scaling
                    // When scaling from center, we need to adjust position
                    const scale = viewport.zoom;
                    const scaledWidth = 150 * scale;
                    const scaledHeight = 150 * scale;
                    
                    // Adjust position to account for scaling from center
                    const adjustedX = rect.x - (scaledWidth - 150) / 2;
                    const adjustedY = rect.y - (scaledHeight - 150) / 2;
                    
                    board.element.style.left = `${adjustedX}px`;
                    board.element.style.top = `${adjustedY}px`;
                    
                    // Scale the entire board consistently 
                    board.element.style.transform = `scale(${scale})`;
                    board.element.style.transformOrigin = 'center center';
                    
                    // Active boards are always visible and interactive
                    board.element.style.opacity = '1';
                    board.element.style.pointerEvents = 'auto';
                    board.element.style.display = 'block';
                    
                    // Add visual highlight for active boards
                    board.element.style.border = '2px solid #007cba';
                    board.element.style.boxShadow = '0 0 10px rgba(0, 124, 186, 0.5)';
                } else {
                    // Hide boards not in matrix
                    board.element.style.display = 'none';
                }
            }
        }
        
        // Buffer boards are always hidden (they're just loaded in memory)
        for (const [key, board] of this.bufferBoardsMap) {
            board.element.style.display = 'none';
        }
    }
    
    getActiveCount() {
        return this.activeBoardsMap.size;
    }
    
    getBufferCount() {
        return this.bufferBoardsMap.size;
    }
    
    getAvailableCount() {
        return this.availableBoards.length;
    }
    
    getCachedStatesCount() {
        return this.boardStates.size;
    }
    
    // Update boards based on viewport changes
    async updateBoardsForViewport(viewport) {
        const visibleBoards = viewport.getVisibleBoards();
        
        // FIXED: Load active boards (5x5 matrix) and buffer boards
        for (const boardInfo of visibleBoards) {
            if (boardInfo.isActive) {
                // Load active boards (5x5 matrix)
                await this.getActiveBoard(boardInfo.x, boardInfo.y);
            } else {
                // Load buffer boards (surrounding the matrix)
                await this.getBufferBoard(boardInfo.x, boardInfo.y);
            }
        }
        
        // Position all active boards in the 5x5 matrix
        this.positionBoards(viewport);
    }
} 
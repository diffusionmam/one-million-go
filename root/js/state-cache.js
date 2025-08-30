/**
 * StateCache - Manages cached board states and activity data
 * Core responsibility: Efficient storage and retrieval of board information
 */
class StateCache {
    constructor() {
        // Main cache maps
        this.boardStates = new Map(); // Map<"x,y", BoardState>
        this.activityData = new Map(); // Map<"x,y", ActivityInfo>
        this.recentActivity = new Map(); // Map<"x,y", timestamp>
        
        // Cache management
        this.maxCachedStates = 1000;
        this.maxActivityEntries = 5000;
        
        // Activity simulation (for demo purposes)
        this.simulateActivity = true;
        this.activityTimer = null;
        
        console.log('💾 StateCache created');
    }
    
    async initialize() {
        console.log('💾 StateCache initializing...');
        
        // Generate some initial activity data for demo
        if (this.simulateActivity) {
            this.generateInitialActivity();
            this.startActivitySimulation();
        }
        
        console.log('✅ StateCache initialized');
    }
    
    generateInitialActivity() {
        // Create some clusters of activity for demo
        const activityCenters = [
            { x: 100, y: 100, intensity: 10 },
            { x: 500, y: 500, intensity: 15 },
            { x: 800, y: 200, intensity: 8 },
            { x: 300, y: 700, intensity: 12 },
            { x: 750, y: 850, intensity: 6 }
        ];
        
        for (const center of activityCenters) {
            const radius = 50;
            for (let dy = -radius; dy <= radius; dy += 5) {
                for (let dx = -radius; dx <= radius; dx += 5) {
                    const x = center.x + dx;
                    const y = center.y + dy;
                    
                    if (x >= 0 && x < 1000 && y >= 0 && y < 1000) {
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance <= radius) {
                            const intensity = center.intensity * (1 - distance / radius);
                            this.setBoardActivity(x, y, Math.floor(intensity));
                            
                            // Add some random stones
                            if (Math.random() < 0.3) {
                                this.addRandomStones(x, y, Math.floor(intensity / 3));
                            }
                        }
                    }
                }
            }
        }
        
        console.log(`💾 Generated activity for ${this.activityData.size} boards`);
    }
    
    addRandomStones(boardX, boardY, count) {
        // FIXED: Use coordinate-based deterministic stones instead of random
        const coordinateSeed = boardX * 1000 + boardY;
        const stones = [];
        
        for (let i = 0; i < count && i < 30; i++) {
            // Use coordinate-based positioning for deterministic but unique stones
            const stoneX = (coordinateSeed + i * 3) % 19;
            const stoneY = (coordinateSeed + i * 7) % 19;
            
            stones.push({
                x: stoneX,
                y: stoneY,
                color: i % 2 === 0 ? 'black' : 'white'
            });
        }
        
        const state = this.getBoardState(boardX, boardY) || {
            stones: [],
            moves: [],
            currentPlayer: 'black',
            coordinate: { x: boardX, y: boardY }
        };
        
        state.stones = stones;
        state.coordinate = { x: boardX, y: boardY }; // Ensure coordinate identity
        this.setBoardState(boardX, boardY, state);
        
        console.log(`💾 Added ${count} deterministic stones to board (${boardX}, ${boardY})`);
    }
    
    startActivitySimulation() {
        // Simulate ongoing activity for demo
        this.activityTimer = setInterval(() => {
            // Add random activity
            for (let i = 0; i < 5; i++) {
                const x = Math.floor(Math.random() * 1000);
                const y = Math.floor(Math.random() * 1000);
                
                const currentActivity = this.getBoardActivity(x, y);
                this.setBoardActivity(x, y, Math.min(currentActivity + 1, 20));
            }
            
            // Decay old activity
            const now = Date.now();
            for (const [key, timestamp] of this.recentActivity) {
                if (now - timestamp > 30000) { // 30 seconds
                    const [x, y] = key.split(',').map(Number);
                    const currentActivity = this.getBoardActivity(x, y);
                    if (currentActivity > 0) {
                        this.setBoardActivity(x, y, currentActivity - 1);
                    }
                    this.recentActivity.delete(key);
                }
            }
        }, 1000);
    }
    
    getBoardState(boardX, boardY) {
        const key = `${boardX},${boardY}`;
        return this.boardStates.get(key);
    }
    
    setBoardState(boardX, boardY, state) {
        const key = `${boardX},${boardY}`;
        
        // Implement LRU eviction if cache is full
        if (this.boardStates.size >= this.maxCachedStates && !this.boardStates.has(key)) {
            this.evictOldestState();
        }
        
        // Add timestamp for LRU tracking
        state._lastAccessed = Date.now();
        this.boardStates.set(key, state);
        
        console.log(`💾 Cached state for board (${boardX}, ${boardY})`);
    }
    
    getBoardActivity(boardX, boardY) {
        const key = `${boardX},${boardY}`;
        const activity = this.activityData.get(key);
        return activity ? activity.level : 0;
    }
    
    setBoardActivity(boardX, boardY, level) {
        const key = `${boardX},${boardY}`;
        
        this.activityData.set(key, {
            level: level,
            lastUpdated: Date.now()
        });
        
        if (level > 0) {
            this.recentActivity.set(key, Date.now());
        }
        
        // Cleanup if too many entries
        if (this.activityData.size > this.maxActivityEntries) {
            this.cleanupActivityData();
        }
    }
    
    getBoardStoneCount(boardX, boardY) {
        const state = this.getBoardState(boardX, boardY);
        return state && state.stones ? state.stones.length : 0;
    }
    
    evictOldestState() {
        let oldestKey = null;
        let oldestTime = Date.now();
        
        for (const [key, state] of this.boardStates) {
            if (state._lastAccessed < oldestTime) {
                oldestTime = state._lastAccessed;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            this.boardStates.delete(oldestKey);
            console.log(`💾 Evicted old state: ${oldestKey}`);
        }
    }
    
    cleanupActivityData() {
        // Remove activity data older than 5 minutes
        const cutoffTime = Date.now() - 5 * 60 * 1000;
        let removed = 0;
        
        for (const [key, activity] of this.activityData) {
            if (activity.lastUpdated < cutoffTime) {
                this.activityData.delete(key);
                removed++;
            }
        }
        
        console.log(`💾 Cleaned up ${removed} old activity entries`);
    }
    
    // Network integration methods (for future use)
    async fetchBoardState(boardX, boardY) {
        // This will connect to the backend in full implementation
        console.log(`💾 Would fetch state for (${boardX}, ${boardY}) from server`);
        
        // For now, return empty state
        return {
            stones: [],
            moves: [],
            currentPlayer: 'black',
            gamePhase: 'playing'
        };
    }
    
    async saveBoardState(boardX, boardY, state) {
        // This will send to backend in full implementation
        console.log(`💾 Would save state for (${boardX}, ${boardY}) to server`);
        
        // Cache locally
        this.setBoardState(boardX, boardY, state);
    }
    
    // Batch operations for efficiency
    getBoardStatesInRegion(startX, startY, width, height) {
        const states = new Map();
        
        for (let y = startY; y < startY + height && y < 1000; y++) {
            for (let x = startX; x < startX + width && x < 1000; x++) {
                const state = this.getBoardState(x, y);
                if (state) {
                    states.set(`${x},${y}`, state);
                }
            }
        }
        
        return states;
    }
    
    getActivityInRegion(startX, startY, width, height) {
        const activities = new Map();
        
        for (let y = startY; y < startY + height && y < 1000; y++) {
            for (let x = startX; x < startX + width && x < 1000; x++) {
                const activity = this.getBoardActivity(x, y);
                if (activity > 0) {
                    activities.set(`${x},${y}`, activity);
                }
            }
        }
        
        return activities;
    }
    
    getCachedCount() {
        return this.boardStates.size;
    }
    
    getActivityCount() {
        return this.activityData.size;
    }
    
    // Statistics for debugging
    getStats() {
        return {
            cachedStates: this.boardStates.size,
            activityEntries: this.activityData.size,
            recentActivity: this.recentActivity.size,
            memoryUsage: this.estimateMemoryUsage()
        };
    }
    
    estimateMemoryUsage() {
        // Rough estimation of memory usage
        const stateSize = this.boardStates.size * 1000; // ~1KB per state
        const activitySize = this.activityData.size * 50; // ~50 bytes per activity
        return Math.round((stateSize + activitySize) / 1024); // Return in KB
    }
    
    // Cleanup on shutdown
    cleanup() {
        if (this.activityTimer) {
            clearInterval(this.activityTimer);
            this.activityTimer = null;
        }
        
        console.log('💾 StateCache cleanup completed');
    }
} 
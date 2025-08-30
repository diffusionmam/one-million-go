/**
 * NetworkManager - Handles WebSocket communication with backend (stub for now)
 * Core responsibility: Network communication and state synchronization
 */
class NetworkManager {
    constructor() {
        this.websocket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // Message queues
        this.outgoingQueue = [];
        this.pendingRequests = new Map(); // Map<requestId, callback>
        
        // Network stats
        this.messagesSent = 0;
        this.messagesReceived = 0;
        this.lastPingTime = 0;
        
        console.log('🌐 NetworkManager created');
    }
    
    async initialize() {
        console.log('🌐 NetworkManager initializing...');
        
        // Connect to real backend server
        setTimeout(() => {
            this.connect('ws://localhost:8080/ws');
        }, 1000);
        
        console.log('✅ NetworkManager initialized (backend mode)');
    }
    
    simulateConnection() {
        this.isConnected = true;
        this.updateConnectionStatus();
        console.log('🌐 Simulated connection established');
        
        // Start periodic ping simulation
        this.startPingSimulation();
    }
    
    startPingSimulation() {
        setInterval(() => {
            this.lastPingTime = Date.now();
            // Simulate network latency
            setTimeout(() => {
                this.messagesReceived++;
            }, 20 + Math.random() * 50); // 20-70ms simulated latency
        }, 5000);
    }
    
    updateConnectionStatus() {
        const statusElement = document.getElementById('network-status');
        const indicatorElement = statusElement?.previousElementSibling;
        
        if (this.isConnected) {
            if (statusElement) statusElement.textContent = 'Connected';
            if (indicatorElement) {
                indicatorElement.className = 'status-indicator status-active';
            }
        } else {
            if (statusElement) statusElement.textContent = 'Disconnected';
            if (indicatorElement) {
                indicatorElement.className = 'status-indicator status-empty';
            }
        }
    }
    
    // Future implementation methods (stubs for now)
    
    async fetchBoardState(boardX, boardY) {
        console.log(`🌐 Fetching board state (${boardX}, ${boardY}) from server`);
        
        return new Promise((resolve, reject) => {
            const messageId = `fetch_${Date.now()}_${Math.random()}`;
            
            // Store callback for when response arrives
            this.pendingRequests.set(messageId, { resolve, reject, type: 'FETCH_BOARD' });
            
            // Send message to backend with specific ID
            this.sendMessage('FETCH_BOARD', {
                boardX: boardX,
                boardY: boardY
            }, messageId);
            
            // Timeout after 5 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(messageId)) {
                    this.pendingRequests.delete(messageId);
                    reject(new Error('Request timeout'));
                }
            }, 5000);
        });
    }
    
    async sendMove(boardX, boardY, moveData) {
        console.log(`🌐 Would send move to server: (${boardX}, ${boardY})`, moveData);
        
        this.messagesSent++;
        
        // Simulate sending to server
        await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 40));
        
        return {
            success: true,
            moveId: `move_${Date.now()}_${Math.random()}`,
            timestamp: Date.now()
        };
    }
    
    async requestBoardRegion(startX, startY, width, height) {
        console.log(`🌐 Would request board region: (${startX}, ${startY}) ${width}×${height}`);
        
        // Simulate fetching multiple boards
        const boards = new Map();
        
        for (let y = startY; y < startY + height && y < 1000; y++) {
            for (let x = startX; x < startX + width && x < 1000; x++) {
                boards.set(`${x},${y}`, {
                    x, y,
                    stones: [],
                    activity: Math.floor(Math.random() * 5),
                    lastUpdate: Date.now() - Math.random() * 60000
                });
            }
        }
        
        return boards;
    }
    
    subscribeToRegion(startX, startY, width, height) {
        console.log(`🌐 Would subscribe to region updates: (${startX}, ${startY}) ${width}×${height}`);
        
        // In full implementation, this would tell server to send updates for this region
        return {
            subscriptionId: `sub_${Date.now()}`,
            success: true
        };
    }
    
    unsubscribeFromRegion(subscriptionId) {
        console.log(`🌐 Would unsubscribe from region: ${subscriptionId}`);
        
        return { success: true };
    }
    
    // Connection management
    
    connect(serverUrl = 'ws://localhost:8080/ws') {
        console.log(`🌐 Connecting to: ${serverUrl}`);
        
        try {
            this.websocket = new WebSocket(serverUrl);
            
            this.websocket.onopen = () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus();
                this.processOutgoingQueue();
                console.log('🌐 WebSocket connected to backend');
            };
            
            this.websocket.onmessage = (event) => {
                this.handleMessage(event.data);
            };
            
            this.websocket.onclose = () => {
                this.isConnected = false;
                this.updateConnectionStatus();
                this.scheduleReconnect();
                console.log('🌐 WebSocket disconnected');
            };
            
            this.websocket.onerror = (error) => {
                console.error('🌐 WebSocket error:', error);
            };
            
        } catch (error) {
            console.error('🌐 Failed to connect:', error);
        }
    }
    
    disconnect() {
        console.log('🌐 Disconnecting...');
        
        this.isConnected = false;
        this.updateConnectionStatus();
        
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
    }
    
    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            this.reconnectAttempts++;
            
            console.log(`🌐 Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
            
            setTimeout(() => {
                this.connect();
            }, delay);
        }
    }
    
    // Message handling
    
    sendMessage(type, data, messageId = null) {
        const message = {
            id: messageId || `msg_${Date.now()}_${Math.random()}`,
            type: type,
            data: data,
            timestamp: Date.now()
        };
        
        if (this.isConnected && this.websocket) {
            this.websocket.send(JSON.stringify(message));
            this.messagesSent++;
        } else {
            this.outgoingQueue.push(message);
        }
        
        return message.id;
    }
    
    processOutgoingQueue() {
        while (this.outgoingQueue.length > 0 && this.isConnected) {
            const message = this.outgoingQueue.shift();
            this.websocket.send(JSON.stringify(message));
            this.messagesSent++;
        }
    }
    
    handleMessage(messageData) {
        try {
            const message = JSON.parse(messageData);
            this.messagesReceived++;
            
            // Check if this is a response to a pending request
            if (this.pendingRequests.has(message.id)) {
                const pendingRequest = this.pendingRequests.get(message.id);
                this.pendingRequests.delete(message.id);
                
                if (message.type === 'ERROR') {
                    pendingRequest.reject(new Error(message.data.message || 'Server error'));
                } else {
                    pendingRequest.resolve(message.data);
                }
                return;
            }
            
            // Handle other message types
            switch (message.type) {
                case 'BOARD_STATE':
                    this.handleBoardState(message.data);
                    break;
                case 'MOVE_RESULT':
                    this.handleMoveResult(message.data);
                    break;
                case 'BOARD_UPDATE':
                    this.handleBoardUpdate(message.data);
                    break;
                case 'REGION_DATA':
                    this.handleRegionData(message.data);
                    break;
                case 'PONG':
                    this.handlePong(message.data);
                    break;
                case 'WELCOME':
                    console.log('🌐 Welcome message:', message.data);
                    break;
                case 'ERROR':
                    console.error('🌐 Server error:', message.data);
                    break;
                default:
                    console.log('🌐 Unknown message type:', message.type);
            }
            
        } catch (error) {
            console.error('🌐 Failed to parse message:', error);
        }
    }
    
    handleBoardState(data) {
        console.log('🌐 Received board state:', data);
        // Board state received in response to FETCH_BOARD
    }
    
    handleBoardUpdate(data) {
        console.log('🌐 Received board update:', data);
        // Forward to StateCache or BoardPool
    }
    
    handleMoveResult(data) {
        console.log('🌐 Received move result:', data);
        // Handle move confirmation/rejection
    }
    
    handleRegionData(data) {
        console.log('🌐 Received region data:', data);
        // Forward to StateCache
    }
    
    handlePong(data) {
        const latency = Date.now() - this.lastPingTime;
        console.log(`🌐 Ping: ${latency}ms`);
    }
    
    // Statistics
    
    getStats() {
        return {
            connected: this.isConnected,
            messagesSent: this.messagesSent,
            messagesReceived: this.messagesReceived,
            queuedMessages: this.outgoingQueue.length,
            reconnectAttempts: this.reconnectAttempts
        };
    }
    
    // Cleanup
    
    cleanup() {
        this.disconnect();
        this.outgoingQueue = [];
        this.pendingRequests.clear();
        console.log('🌐 NetworkManager cleanup completed');
    }
} 
package hub

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/one-million-go/backend/pkg/types"
)

// GameHub coordinates all client connections and game state
type GameHub struct {
	// Connection management
	clients    map[string]*ClientConnection
	Register   chan *ClientConnection
	Unregister chan *ClientConnection
	clientsMux sync.RWMutex
	
	// Message routing
	inbound  chan *InboundMessage
	outbound chan *OutboundMessage
	
	// Game state storage (sparse - only active boards)
	boardStates map[types.BoardCoordinate]*types.BoardState
	stateMux    sync.RWMutex
	
	// Zone subscriptions: ZoneID → Set of ClientIDs
	zoneSubscriptions map[types.ZoneID]map[string]bool
	zoneMux          sync.RWMutex
	
	// Statistics
	stats *HubStats
}

// InboundMessage represents a message received from a client
type InboundMessage struct {
	ClientID string
	Message  *types.Message
}

// OutboundMessage represents a message to send to client(s)
type OutboundMessage struct {
	Recipients []string // If empty, broadcast to all clients
	Message    *types.Message
}

// HubStats tracks hub performance metrics
type HubStats struct {
	ConnectedClients    int
	ActiveBoards       int
	MessagesSent       uint64
	MessagesReceived   uint64
	ActiveSubscriptions int
	Uptime             time.Time
}

// NewGameHub creates a new game hub instance
func NewGameHub() *GameHub {
	return &GameHub{
		clients:           make(map[string]*ClientConnection),
		Register:         make(chan *ClientConnection, 100),
		Unregister:       make(chan *ClientConnection, 100),
		inbound:          make(chan *InboundMessage, 1000),
		outbound:         make(chan *OutboundMessage, 1000),
		boardStates:      make(map[types.BoardCoordinate]*types.BoardState),
		zoneSubscriptions: make(map[types.ZoneID]map[string]bool),
		stats: &HubStats{
			Uptime: time.Now(),
		},
	}
}

// Run starts the main hub event loop
func (h *GameHub) Run() {
	log.Println("🎮 GameHub starting...")
	
	// Start background goroutines
	go h.handleMessages()
	
	for {
		select {
		case client := <-h.Register:
			h.registerClient(client)
			
		case client := <-h.Unregister:
			h.unregisterClient(client)
			
		case inMsg := <-h.inbound:
			h.processInboundMessage(inMsg)
			
		case outMsg := <-h.outbound:
			h.sendOutboundMessage(outMsg)
		}
	}
}

func (h *GameHub) registerClient(client *ClientConnection) {
	h.clientsMux.Lock()
	h.clients[client.ID] = client
	h.clientsMux.Unlock()
	
	h.stats.ConnectedClients++
	log.Printf("✅ Client registered: %s (total: %d)", client.ID, h.stats.ConnectedClients)
	
	// Send welcome message
	welcomeMsg := &types.Message{
		ID:        uuid.New().String(),
		Type:      "WELCOME",
		Timestamp: time.Now().Unix(),
		Data: map[string]interface{}{
			"clientId": client.ID,
			"message":  "Connected to One Million Go server",
		},
	}
	
	h.outbound <- &OutboundMessage{
		Recipients: []string{client.ID},
		Message:    welcomeMsg,
	}
}

func (h *GameHub) unregisterClient(client *ClientConnection) {
	h.clientsMux.Lock()
	delete(h.clients, client.ID)
	h.clientsMux.Unlock()
	
	// Clean up zone subscriptions
	h.zoneMux.Lock()
	for zoneID, clientSet := range h.zoneSubscriptions {
		delete(clientSet, client.ID)
		if len(clientSet) == 0 {
			delete(h.zoneSubscriptions, zoneID)
		}
	}
	h.zoneMux.Unlock()
	
	h.stats.ConnectedClients--
	log.Printf("❌ Client unregistered: %s (total: %d)", client.ID, h.stats.ConnectedClients)
	
	// Close the connection
	client.conn.Close()
}

func (h *GameHub) handleMessages() {
	log.Println("📨 Message handler started")
	
	for {
		select {
		case inMsg := <-h.inbound:
			h.processInboundMessage(inMsg)
		}
	}
}

func (h *GameHub) processInboundMessage(inMsg *InboundMessage) {
	h.stats.MessagesReceived++
	
	switch inMsg.Message.Type {
	case types.MsgFetchBoard:
		h.handleFetchBoard(inMsg)
		
	case types.MsgFetchRegion:
		h.handleFetchRegion(inMsg)
		
	case types.MsgSendMove:
		h.handleSendMove(inMsg)
		
	case types.MsgSubscribeRegion:
		h.handleSubscribeRegion(inMsg)
		
	case types.MsgPing:
		h.handlePing(inMsg)
		
	default:
		log.Printf("⚠️ Unknown message type from %s: %s", inMsg.ClientID, inMsg.Message.Type)
		h.sendError(inMsg.ClientID, "UNKNOWN_MESSAGE_TYPE", "Unknown message type")
	}
}

func (h *GameHub) handleFetchBoard(inMsg *InboundMessage) {
	// Parse request data
	dataBytes, _ := json.Marshal(inMsg.Message.Data)
	var req types.FetchBoardData
	if err := json.Unmarshal(dataBytes, &req); err != nil {
		h.sendError(inMsg.ClientID, "INVALID_REQUEST", "Invalid fetch board request")
		return
	}
	
	// Get or create board state
	coord := types.NewBoardCoordinate(req.BoardX, req.BoardY)
	boardState := h.getOrCreateBoardState(coord)
	
	// Send response
	response := &types.Message{
		ID:        uuid.New().String(),
		Type:      types.MsgBoardState,
		Timestamp: time.Now().Unix(),
		Data:      boardState,
	}
	
	h.outbound <- &OutboundMessage{
		Recipients: []string{inMsg.ClientID},
		Message:    response,
	}
	
	log.Printf("📋 Board state sent to %s: (%d,%d)", inMsg.ClientID, req.BoardX, req.BoardY)
}

func (h *GameHub) handleFetchRegion(inMsg *InboundMessage) {
	// Parse request data
	dataBytes, _ := json.Marshal(inMsg.Message.Data)
	var req types.FetchRegionData
	if err := json.Unmarshal(dataBytes, &req); err != nil {
		h.sendError(inMsg.ClientID, "INVALID_REQUEST", "Invalid fetch region request")
		return
	}
	
	// Collect board states for the region
	boards := make(map[string]*types.BoardState)
	
	for y := req.StartY; y < req.StartY+req.Height && y < 1000; y++ {
		for x := req.StartX; x < req.StartX+req.Width && x < 1000; x++ {
			coord := types.NewBoardCoordinate(x, y)
			boardState := h.getOrCreateBoardState(coord)
			key := fmt.Sprintf("%d,%d", x, y)
			boards[key] = boardState
		}
	}
	
	// Send response
	regionData := &types.RegionDataResponse{
		StartX: req.StartX,
		StartY: req.StartY,
		Width:  req.Width,
		Height: req.Height,
		Boards: boards,
	}
	
	response := &types.Message{
		ID:        uuid.New().String(),
		Type:      types.MsgRegionData,
		Timestamp: time.Now().Unix(),
		Data:      regionData,
	}
	
	h.outbound <- &OutboundMessage{
		Recipients: []string{inMsg.ClientID},
		Message:    response,
	}
	
	log.Printf("🗺️ Region data sent to %s: (%d,%d) %dx%d", inMsg.ClientID, req.StartX, req.StartY, req.Width, req.Height)
}

func (h *GameHub) handleSendMove(inMsg *InboundMessage) {
	// Parse request data
	dataBytes, _ := json.Marshal(inMsg.Message.Data)
	var req types.MoveRequestData
	if err := json.Unmarshal(dataBytes, &req); err != nil {
		h.sendError(inMsg.ClientID, "INVALID_REQUEST", "Invalid move request")
		return
	}
	
	// For now, just simulate accepting the move (TODO: Add Go rules validation)
	coord := types.NewBoardCoordinate(req.BoardX, req.BoardY)
	boardState := h.getOrCreateBoardState(coord)
	
	// Add move to board (simplified)
	x := uint8(req.Position % 19)
	y := uint8(req.Position / 19)
	
	stone := types.Stone{
		X:     x,
		Y:     y,
		Color: req.Player,
	}
	boardState.Stones = append(boardState.Stones, stone)
	boardState.MoveCount++
	boardState.LastMove = uint32(time.Now().Unix())
	
	// Toggle current player
	if boardState.CurrentPlayer == 0 {
		boardState.CurrentPlayer = 1
	} else {
		boardState.CurrentPlayer = 0
	}
	
	// Send success response
	result := &types.MoveResultData{
		Success:    true,
		MoveID:     uuid.New().String(),
		BoardState: boardState,
	}
	
	response := &types.Message{
		ID:        inMsg.Message.ID, // Use same ID for response
		Type:      types.MsgMoveResult,
		Timestamp: time.Now().Unix(),
		Data:      result,
	}
	
	h.outbound <- &OutboundMessage{
		Recipients: []string{inMsg.ClientID},
		Message:    response,
	}
	
	log.Printf("♟️ Move processed for %s: (%d,%d) pos=%d", inMsg.ClientID, req.BoardX, req.BoardY, req.Position)
}

func (h *GameHub) handleSubscribeRegion(inMsg *InboundMessage) {
	// TODO: Implement zone-based subscriptions
	log.Printf("📡 Subscription request from %s (not implemented yet)", inMsg.ClientID)
}

func (h *GameHub) handlePing(inMsg *InboundMessage) {
	// Send pong response
	response := &types.Message{
		ID:        inMsg.Message.ID,
		Type:      types.MsgPong,
		Timestamp: time.Now().Unix(),
		Data:      map[string]interface{}{"timestamp": time.Now().Unix()},
	}
	
	h.outbound <- &OutboundMessage{
		Recipients: []string{inMsg.ClientID},
		Message:    response,
	}
}

func (h *GameHub) getOrCreateBoardState(coord types.BoardCoordinate) *types.BoardState {
	h.stateMux.RLock()
	if state, exists := h.boardStates[coord]; exists {
		h.stateMux.RUnlock()
		return state
	}
	h.stateMux.RUnlock()
	
	// Create new board state
	h.stateMux.Lock()
	defer h.stateMux.Unlock()
	
	// Double-check after acquiring write lock
	if state, exists := h.boardStates[coord]; exists {
		return state
	}
	
	// Create fresh board state
	state := &types.BoardState{
		MoveCount:     0,
		LastMove:      uint32(time.Now().Unix()),
		CurrentPlayer: 0, // Black goes first
		GamePhase:     0, // Playing
		Activity:      1,
		Stones:        make([]types.Stone, 0),
		Moves:         make([]types.Move, 0),
	}
	
	h.boardStates[coord] = state
	h.stats.ActiveBoards = len(h.boardStates)
	
	x, y := coord.Unpack()
	log.Printf("🆕 Created new board state: (%d,%d)", x, y)
	
	return state
}

func (h *GameHub) sendOutboundMessage(outMsg *OutboundMessage) {
	h.stats.MessagesSent++
	
	if len(outMsg.Recipients) == 0 {
		// Broadcast to all clients
		h.clientsMux.RLock()
		for _, client := range h.clients {
			select {
			case client.send <- outMsg.Message:
			default:
				// Client send buffer is full, disconnect them
				h.Unregister <- client
			}
		}
		h.clientsMux.RUnlock()
	} else {
		// Send to specific recipients
		h.clientsMux.RLock()
		for _, clientID := range outMsg.Recipients {
			if client, exists := h.clients[clientID]; exists {
				select {
				case client.send <- outMsg.Message:
				default:
					// Client send buffer is full, disconnect them
					h.Unregister <- client
				}
			}
		}
		h.clientsMux.RUnlock()
	}
}

func (h *GameHub) sendError(clientID, code, message string) {
	errorMsg := &types.Message{
		ID:        uuid.New().String(),
		Type:      types.MsgError,
		Timestamp: time.Now().Unix(),
		Data: &types.ErrorData{
			Code:    code,
			Message: message,
		},
	}
	
	h.outbound <- &OutboundMessage{
		Recipients: []string{clientID},
		Message:    errorMsg,
	}
}

// GetStats returns current hub statistics
func (h *GameHub) GetStats() *HubStats {
	h.clientsMux.RLock()
	h.stateMux.RLock()
	defer h.clientsMux.RUnlock()
	defer h.stateMux.RUnlock()
	
	return &HubStats{
		ConnectedClients: len(h.clients),
		ActiveBoards:    len(h.boardStates),
		MessagesSent:    h.stats.MessagesSent,
		MessagesReceived: h.stats.MessagesReceived,
		Uptime:          h.stats.Uptime,
	}
}
package types

import (
	"fmt"
	"time"
)

// BoardCoordinate - 32-bit packed coordinate (16 bits each for X,Y)
type BoardCoordinate uint32

// NewBoardCoordinate creates a packed coordinate from x,y values
func NewBoardCoordinate(x, y uint16) BoardCoordinate {
	return BoardCoordinate(uint32(y)<<16 | uint32(x))
}

// Unpack returns the x,y values from a packed coordinate
func (bc BoardCoordinate) Unpack() (uint16, uint16) {
	x := uint16(bc & 0xFFFF)
	y := uint16(bc >> 16)
	return x, y
}

// String returns coordinate as "(x,y)" format
func (bc BoardCoordinate) String() string {
	x, y := bc.Unpack()
	return fmt.Sprintf("(%d,%d)", x, y)
}

// Move represents a single move in a Go game
type Move struct {
	Position uint16 `json:"position"` // 0-360 for 19x19 board
	Player   byte   `json:"player"`   // 0=black, 1=white
	MoveNum  uint16 `json:"moveNum"`  // Move number in game
	X        uint8  `json:"x"`        // Board position X (0-18)
	Y        uint8  `json:"y"`        // Board position Y (0-18)
}

// Stone represents a stone placement on the board
type Stone struct {
	X     uint8  `json:"x"`     // 0-18 position
	Y     uint8  `json:"y"`     // 0-18 position
	Color string `json:"color"` // "black" or "white"
}

// BoardState represents the current state of a single Go board
type BoardState struct {
	// Stone positions as bitfields (361 positions = ~46 bytes)
	BlackStones [46]byte `json:"-"` // 361 bits for black stones
	WhiteStones [46]byte `json:"-"` // 361 bits for white stones

	// Game metadata
	MoveCount     uint16 `json:"moveCount"`
	LastMove      uint32 `json:"lastMove"`      // Unix timestamp
	CurrentPlayer byte   `json:"currentPlayer"` // 0=black, 1=white
	GamePhase     byte   `json:"gamePhase"`     // 0=playing, 1=finished, 2=scoring
	Activity      byte   `json:"activity"`      // Recent activity counter 0-255
	Reserved      byte   `json:"-"`             // Future use

	// Cached data for JSON responses
	Stones []Stone `json:"stones"`
	Moves  []Move  `json:"moves"`
}

// ActivityTracker tracks board usage statistics
type ActivityTracker struct {
	LastMoveTime time.Time
	PlayerCount  int
	MoveCount    uint32
	ViewerCount  int
}

// ZoneID represents a unique zone identifier
type ZoneID uint16

// ClientViewport represents a client's current viewport
type ClientViewport struct {
	CenterX        uint16  `json:"centerX"`
	CenterY        uint16  `json:"centerY"`
	ZoomLevel      float64 `json:"zoomLevel"`
	ViewportWidth  uint16  `json:"viewportWidth"`
	ViewportHeight uint16  `json:"viewportHeight"`
}

// Message types for WebSocket communication
type MessageType string

const (
	// Client → Server messages
	MsgSendMove        MessageType = "SEND_MOVE"
	MsgFetchBoard      MessageType = "FETCH_BOARD"
	MsgFetchRegion     MessageType = "FETCH_REGION"
	MsgSubscribeRegion MessageType = "SUBSCRIBE_REGION"
	MsgUnsubscribe     MessageType = "UNSUBSCRIBE_REGION"
	MsgPing            MessageType = "PING"

	// Server → Client messages
	MsgMoveResult  MessageType = "MOVE_RESULT"
	MsgBoardState  MessageType = "BOARD_STATE"
	MsgBoardUpdate MessageType = "BOARD_UPDATE"
	MsgRegionData  MessageType = "REGION_DATA"
	MsgError       MessageType = "ERROR"
	MsgPong        MessageType = "PONG"
)

// Message represents a WebSocket message envelope
type Message struct {
	ID        string      `json:"id"`
	Type      MessageType `json:"type"`
	Timestamp int64       `json:"timestamp"`
	Data      interface{} `json:"data"`
}

// Error response data
type ErrorData struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Move request data (Client → Server)
type MoveRequestData struct {
	BoardX   uint16 `json:"boardX"`
	BoardY   uint16 `json:"boardY"`
	Position uint16 `json:"position"`
	Player   string `json:"player"` // "black" or "white"
}

// Board fetch request data
type FetchBoardData struct {
	BoardX uint16 `json:"boardX"`
	BoardY uint16 `json:"boardY"`
}

// Region fetch request data
type FetchRegionData struct {
	StartX uint16 `json:"startX"`
	StartY uint16 `json:"startY"`
	Width  uint16 `json:"width"`
	Height uint16 `json:"height"`
}

// Region subscription data
type SubscribeRegionData struct {
	CenterX  uint16          `json:"centerX"`
	CenterY  uint16          `json:"centerY"`
	Viewport *ClientViewport `json:"viewport"`
}

// Move result data (Server → Client)
type MoveResultData struct {
	Success    bool        `json:"success"`
	MoveID     string      `json:"moveId"`
	BoardState *BoardState `json:"boardState,omitempty"`
	Error      *ErrorData  `json:"error,omitempty"`
}

// Board update notification (Server → Client)
type BoardUpdateData struct {
	BoardX   uint16      `json:"boardX"`
	BoardY   uint16      `json:"boardY"`
	Move     *Move       `json:"move"`
	NewState *BoardState `json:"newState"`
}

// Region data response (Server → Client)
type RegionDataResponse struct {
	StartX uint16                 `json:"startX"`
	StartY uint16                 `json:"startY"`
	Width  uint16                 `json:"width"`
	Height uint16                 `json:"height"`
	Boards map[string]*BoardState `json:"boards"` // Key: "x,y"
}

package hub

import (
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/one-million-go/backend/pkg/types"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 512 * 1024 // 512 KB
)

// ClientConnection represents a WebSocket client connection
type ClientConnection struct {
	ID   string
	conn *websocket.Conn
	hub  *GameHub
	send chan *types.Message

	// Client state
	lastActivity time.Time
	position     types.BoardCoordinate // Current viewport center
	subscribedZones map[types.ZoneID]bool
}

// NewClientConnection creates a new client connection
func NewClientConnection(conn *websocket.Conn, hub *GameHub) *ClientConnection {
	return &ClientConnection{
		ID:              uuid.New().String(),
		conn:            conn,
		hub:             hub,
		send:            make(chan *types.Message, 256),
		lastActivity:    time.Now(),
		subscribedZones: make(map[types.ZoneID]bool),
	}
}

// ReadPump pumps messages from the websocket connection to the hub
func (c *ClientConnection) ReadPump() {
	defer func() {
		c.hub.Unregister <- c
		c.conn.Close()
	}()

	// Set connection parameters
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	// Read messages from WebSocket
	for {
		var msg types.Message
		err := c.conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error for client %s: %v", c.ID, err)
			}
			break
		}

		c.lastActivity = time.Now()

		// Send message to hub for processing
		inboundMsg := &InboundMessage{
			ClientID: c.ID,
			Message:  &msg,
		}

		select {
		case c.hub.inbound <- inboundMsg:
		default:
			// Hub inbound channel is full, close the connection
			log.Printf("⚠️ Hub inbound channel full, disconnecting client %s", c.ID)
			return
		}
	}
}

// WritePump pumps messages from the hub to the websocket connection
func (c *ClientConnection) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			// Send the message
			if err := c.conn.WriteJSON(message); err != nil {
				log.Printf("WriteJSON error for client %s: %v", c.ID, err)
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// SendMessage sends a message to this client
func (c *ClientConnection) SendMessage(msg *types.Message) bool {
	select {
	case c.send <- msg:
		return true
	default:
		// Send buffer is full
		return false
	}
}

// IsAlive checks if the connection is still active
func (c *ClientConnection) IsAlive() bool {
	return time.Since(c.lastActivity) < pongWait*2
}

// GetLastActivity returns the last activity time
func (c *ClientConnection) GetLastActivity() time.Time {
	return c.lastActivity
}

// UpdatePosition updates the client's current viewport position
func (c *ClientConnection) UpdatePosition(x, y uint16) {
	c.position = types.NewBoardCoordinate(x, y)
}

// GetPosition returns the client's current position
func (c *ClientConnection) GetPosition() (uint16, uint16) {
	return c.position.Unpack()
}

// Subscribe adds the client to a zone subscription
func (c *ClientConnection) Subscribe(zoneID types.ZoneID) {
	c.subscribedZones[zoneID] = true
}

// Unsubscribe removes the client from a zone subscription
func (c *ClientConnection) Unsubscribe(zoneID types.ZoneID) {
	delete(c.subscribedZones, zoneID)
}

// IsSubscribedTo checks if client is subscribed to a zone
func (c *ClientConnection) IsSubscribedTo(zoneID types.ZoneID) bool {
	return c.subscribedZones[zoneID]
}

// GetSubscribedZones returns all zones this client is subscribed to
func (c *ClientConnection) GetSubscribedZones() []types.ZoneID {
	zones := make([]types.ZoneID, 0, len(c.subscribedZones))
	for zoneID := range c.subscribedZones {
		zones = append(zones, zoneID)
	}
	return zones
}
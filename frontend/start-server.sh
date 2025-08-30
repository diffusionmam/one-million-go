#!/bin/bash

# Tenuki Go Demo Server Starter
echo "🪨 Starting Tenuki Go Demo Server..."
echo ""
echo "Building library..."
npm run build

echo ""
echo "Starting HTTP server on port 8080..."
echo "📍 Single player demo: http://localhost:8080/index.html"
echo "📍 Multi player demo: http://localhost:8080/million-go.html"
echo "📍 Test Page: http://localhost:8080/test.html"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python3 -m http.server 8080 
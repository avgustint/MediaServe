# WebSocket Media Player Server

A Node.js WebSocket server that broadcasts messages to all connected clients every 10 seconds.

## Features

- Accepts WebSocket connections from clients
- Broadcasts messages every 10 seconds to all connected clients
- Messages are randomly selected from `playlist.json`
- Message types: `text`, `image`, or `url`
- Each message contains `type` and `content` fields

## Installation

```bash
npm install
```

## Usage

```bash
npm start
```

The server will start on port 8080 by default. You can change the port by setting the `PORT` environment variable:

```bash
PORT=3000 npm start
```

## Message Format

Messages sent to clients follow this structure:

```json
{
  "type": "text" | "image" | "url",
  "content": "string content"
}
```

## Playlist Configuration

Edit `playlist.json` to add, remove, or modify messages that will be broadcast to clients. The server randomly selects a message from this list every 10 seconds.

## Example Client Connection

You can test the server using a WebSocket client. Here's an example using Node.js:

```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});
```


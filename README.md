# WebSocket Playground - Backend

Socket.io server for real-time multiplayer games.

## Overview

Backend server built with **Bun** and **Socket.io** that handles real-time communication between players.

## Quick Start

```bash
# Install dependencies
bun install

# Run in development (with watch mode)
bun run dev
```

Server runs on `http://localhost:3000` (or PORT env variable).

## Project Structure

```
ws-playground-back/
├── src/
│   ├── server.ts          # Main server entry point
│   └── Games/
│       ├── Chess.ts       # Chess game logic
│       └── TicTacToe.ts   # TicTacToe game logic
├── package.json
├── .env                    # Environment variables
└── .env.example           # Example env file
```

## Game Handlers

### Chess (`src/Games/Chess.ts`)

Multiplayer chess with room-based gameplay. Features:

- Room creation and management
- Team assignment (white/black)
- Turn tracking on server
- Move validation and synchronization
- Pawn promotion
- Reconnection handling

### TicTacToe (`src/Games/TicTacToe.ts`)

Simple TicTacToe implementation:

- Room-based gameplay
- Player type assignment (X/O)
- Move broadcasting

## Adding a New Game

1. Create a new file in `src/Games/YourGame.ts`:

```typescript
import { Socket, Server } from "socket.io";

export function yourGameEvents(socket: Socket, io: Server) {
  socket.on("YourEvent", (data) => {
    // Handle event
  });
}
```

2. Register in `src/server.ts`:

```typescript
import { yourGameEvents } from "./Games/YourGame";

io.on("connection", (socket) => {
  yourGameEvents(socket, io);
  // ... other games
});
```

## Socket Events

### Chess Events

| Event                | Direction       | Description       |
| -------------------- | --------------- | ----------------- |
| `JoinRoom`           | Client → Server | Join game room    |
| `GameState`          | Server → Client | Full game state   |
| `MovePiece`          | Client → Server | Make a move       |
| `PieceMoved`         | Server → Client | Move notification |
| `TurnChanged`        | Server → Client | Turn update       |
| `GetGameState`       | Client → Server | Request state     |
| `Promote`            | Client → Server | Pawn promotion    |
| `GameOver`           | Both            | Game end          |
| `PlayerDisconnected` | Server → Client | Opponent left     |

### TicTacToe Events

| Event          | Direction       | Description         |
| -------------- | --------------- | ------------------- |
| `JoinRoom`     | Client → Server | Join room           |
| `MarkPlace`    | Client → Server | Mark cell           |
| `PlaceMarked`  | Server → Client | Cell marked         |
| `GameOver`     | Both            | Game end            |
| `RequestType`  | Client → Server | Request player type |
| `SendType`     | Client → Server | Send player type    |
| `ReceivedType` | Server → Client | Receive type        |

## Environment Variables

Create `.env` file:

```env
PORT=3000
```

## Dependencies

- `socket.io` - WebSocket server
- `@types/node` - TypeScript types
- `express` - (Available but not currently used)

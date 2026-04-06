import { Socket, Server } from "socket.io";

// Represents a chess piece with its type, team, and movement state.
// Used by: ChessRoom board (8x8 array of Square), move validation, and piece rendering.
interface Piece {
  type: "rook" | "knight" | "bishop" | "queen" | "king" | "pawn";
  team: "black" | "white";
  hasMoved: boolean;
}

// Represents a single square on the chess board.
// Can contain a Piece or be empty (null).
// Used by: ChessRoom.board to store the game state.
type Square = Piece | null;

// Stores the complete state of a chess game room.
// Used by: chessRooms Map to manage multiple game instances.
// Connects to: socket.io rooms for multiplayer synchronization.
interface ChessRoom {
  board: Square[][];
  currentTurn: "white" | "black";
  players: Map<string, "white" | "black">;
}

// In-memory storage for all active chess rooms.
// Used by: JoinRoom, MovePiece, GetGameState, disconnect to track game state.
// Key: roomId string, Value: ChessRoom object.
const chessRooms = new Map<string, ChessRoom>();

// Creates and returns the standard chess starting position.
// Used by: getRoomOrCreate when a new room is initialized.
// Connects to: setBoard in frontend to render initial pieces.
function createInitialBoard(): Square[][] {
  const backRank: Piece["type"][] = [
    "rook",
    "knight",
    "bishop",
    "queen",
    "king",
    "bishop",
    "knight",
    "rook",
  ];
  const board: Square[][] = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null));

  for (let col = 0; col < 8; col++) {
    board[0][col] = { type: backRank[col], team: "black", hasMoved: false };
    board[1][col] = { type: "pawn", team: "black", hasMoved: false };
    board[6][col] = { type: "pawn", team: "white", hasMoved: false };
    board[7][col] = { type: backRank[col], team: "white", hasMoved: false };
  }

  return board;
}

// Gets an existing room or creates a new one with initial board state.
// Used by: JoinRoom event handler to manage room lifecycle.
// Connects to: createInitialBoard for new rooms, chessRooms Map for existing.
function getRoomOrCreate(roomId: string, team: "white" | "black"): ChessRoom {
  let room = chessRooms.get(roomId);
  if (!room) {
    room = {
      board: createInitialBoard(),
      currentTurn: "white",
      players: new Map(),
    };
    chessRooms.set(roomId, room);
  }
  return room;
}

// Returns the opposite team color.
// Used by: JoinRoom to assign black to second player, MovePiece to switch turns.
// Connects to: MovePiece (turn switching), JoinRoom (team assignment).
function getOppositeTeam(team: "white" | "black"): "white" | "black" {
  return team === "white" ? "black" : "white";
}

// Main event handler for chess game logic.
// Used by: server.ts to register chess-specific socket events.
// Connects to: socket.io for client communication, chessRooms for state management.
export function chessEvents(socket: Socket, io: Server) {
  // Handles player joining a chess room.
  // Room logic: empty room = create new game, 1 player = join existing, 2+ = room full.
  // Used by: Frontend joinRoom() to connect players to a game.
  // Connects to: getRoomOrCreate (room creation), GameState emit (send board to client).
  socket.on("JoinRoom", (roomId: string, team?: "white" | "black") => {
    socket.join(roomId);
    const room = getRoomOrCreate(roomId, team || "white");
    const playersCount = room.players.size;

    const boardCopy = room.board.map((row) =>
      row.map((p) => (p ? { ...p } : null)),
    );

    if (playersCount === 0) {
      room.players.set(socket.id, team || "white");
      socket.emit("GameState", {
        board: boardCopy,
        currentTurn: room.currentTurn,
        myTeam: team || "white",
      });
    } else if (playersCount === 1) {
      const existingTeam = Array.from(room.players.values())[0];
      const newTeam = getOppositeTeam(existingTeam);
      room.players.set(socket.id, newTeam);

      socket.emit("GameState", {
        board: boardCopy,
        currentTurn: room.currentTurn,
        myTeam: newTeam,
      });

      socket.to(roomId).emit("GameState", {
        board: boardCopy,
        currentTurn: room.currentTurn,
        myTeam: existingTeam,
      });
    } else {
      socket.emit("RoomFull");
    }
  });

  // Handles piece movement validation and broadcast.
  // Validates: player turn, piece ownership, legal move.
  // Used by: Frontend emitMove() to synchronize moves between players.
  // Connects to: PieceMoved (notify other player), TurnChanged (update turn).
  socket.on(
    "MovePiece",
    (
      roomId: string,
      fromRow: number,
      fromCol: number,
      toRow: number,
      toCol: number,
    ) => {
      const room = chessRooms.get(roomId);
      if (!room) return;

      const playerTeam = room.players.get(socket.id);
      if (!playerTeam || playerTeam !== room.currentTurn) return;

      const piece = room.board[fromRow]?.[fromCol];
      if (!piece || piece.team !== playerTeam) return;

      room.board[fromRow][fromCol] = null;
      room.board[toRow][toCol] = piece;

      room.currentTurn = getOppositeTeam(room.currentTurn);

      io.to(roomId).emit("PieceMoved", fromRow, fromCol, toRow, toCol);
      io.to(roomId).emit("TurnChanged", room.currentTurn);
    },
  );

  // Handles pawn promotion to selected piece type.
  // Used by: Frontend emitPromotion() when pawn reaches end of board.
  // Connects to: PiecePromoted (notify other player).
  socket.on(
    "Promote",
    (roomId: string, row: number, col: number, type: string) => {
      const room = chessRooms.get(roomId);
      if (!room) return;

      const piece = room.board[row]?.[col];
      if (piece) {
        piece.type = type as Piece["type"];
      }

      io.to(roomId).emit("PiecePromoted", row, col, type);
    },
  );

  // Handles game over and resets board state.
  // Used by: Frontend emitGameOver() when checkmate or draw occurs.
  // Connects to: createInitialBoard (reset board), GameOver (notify players).
  socket.on("GameOver", (roomId: string, result: string) => {
    io.to(roomId).emit("GameOver", result);

    const room = chessRooms.get(roomId);
    if (room) {
      room.board = createInitialBoard();
      room.currentTurn = "white";
    }
  });

  // Handles client request for current game state.
  // Used by: Frontend requestGameState() on page refresh (F5).
  // Connects to: GameState emit (send board + turn + team to requester).
  socket.on("GetGameState", (roomId: string) => {
    const room = chessRooms.get(roomId);
    if (!room) return;

    const myTeam = room.players.get(socket.id);
    if (!myTeam) return;

    const boardCopy = room.board.map((row) =>
      row.map((p) => (p ? { ...p } : null)),
    );

    socket.emit("GameState", {
      board: boardCopy,
      currentTurn: room.currentTurn,
      myTeam,
    });
  });

  // Handles player disconnection and room cleanup.
  // Room logic: 0 players = delete room, 1 player = notify remaining.
  // Used by: socket.io automatic disconnect handling.
  // Connects to: PlayerDisconnected (notify remaining player).
  socket.on("disconnect", () => {
    for (const [roomId, room] of chessRooms.entries()) {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);

        if (room.players.size === 0) {
          chessRooms.delete(roomId);
        } else {
          const remainingPlayer = Array.from(room.players.entries())[0];
          const remainingTeam = remainingPlayer[1];

          io.to(roomId).emit("PlayerDisconnected", remainingTeam);
        }
        break;
      }
    }
  });
}

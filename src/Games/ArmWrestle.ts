import { Socket, Server } from "socket.io";

interface Player {
  socketId: string;
  score: number;
  sentScore: boolean;
}

interface ArmWrestleRoom {
  players: Map<string, Player>;
  gameActive: boolean;
}

const rooms = new Map<string, ArmWrestleRoom>();

export function ArmWrestleEvents(socket: Socket, io: Server) {
  socket.on("joinArmWrestle", (roomId: string) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        players: new Map(),
        gameActive: false,
      });
    }

    const room = rooms.get(roomId)!;
    room.players.set(socket.id, {
      socketId: socket.id,
      score: 0,
      sentScore: false,
    });

    if (room.players.size === 2) {
      io.to(roomId).emit("roomReadyToStart");
    }
  });

  socket.on("initializeNewGame", (roomId: string) => {
    const room = rooms.get(roomId);
    if (!room || room.players.size < 2) return;

    room.gameActive = true;
    room.players.forEach((p) => {
      p.score = 0;
      p.sentScore = false;
    });

    io.to(roomId).emit("gameInitialized");
  });

  socket.on("finishRound", (score: number, roomId: string) => {
    const room = rooms.get(roomId);
    if (!room || !room.gameActive) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    player.score += score;
    player.sentScore = true;

    socket.to(roomId).emit("opponentFinishedRound", score);

    const allFinished = Array.from(room.players.values()).every(
      (p) => p.sentScore,
    );

    if (allFinished) {
      const scores = Array.from(room.players.values()).map((p) => p.score);
      const difference = Math.abs(scores[0] - scores[1]);

      if (difference >= 3) {
        io.to(roomId).emit("gameFinished", {
          scores,
          winner: scores[0] > scores[1] ? 0 : 1,
        });
        room.gameActive = false;
      } else {
        room.players.forEach((p) => {
          p.sentScore = false;
        });
        io.to(roomId).emit("startNewRound");
      }
    }
  });

  socket.on("leaveArmWrestle", (roomId: string) => {
    const room = rooms.get(roomId);
    if (room) {
      room.players.delete(socket.id);
      if (room.players.size === 0) {
        rooms.delete(roomId);
      } else {
        room.gameActive = false;
        io.to(roomId).emit("opponentDisconnected");
      }
    }
    socket.leave(roomId);
  });

  socket.on("disconnect", () => {
    rooms.forEach((room, roomId) => {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        if (room.players.size === 0) {
          rooms.delete(roomId);
        } else {
          room.gameActive = false;
          io.to(roomId).emit("opponentDisconnected");
        }
      }
    });
  });
}

import { Socket, Server } from "socket.io";

export function chessEvents(socket: Socket, io: Server) {
  socket.on("JoinRoom", () => {
    socket.join("lobbyChess");
    const room = io.sockets.adapter.rooms.get("lobbyChess");
    if (room?.size === 2) {
      io.to("lobbyChess").emit("GameStart");
    }
  });

  socket.on("RequestTeam", (sId: string) => {
    const room = io.sockets.adapter.rooms.get("lobbyChess");
    if (room?.size === 2) {
      io.except(sId).emit("AskTeam");
    } else {
      io.emit("ReceivedTeam", "");
    }
  });

  socket.on("SendTeam", (team: string, sId: string) => {
    io.except(sId).emit("ReceivedTeam", team);
  });

  socket.on(
    "MovePiece",
    (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
      io.to("lobbyChess").emit("PieceMoved", fromRow, fromCol, toRow, toCol);
    },
  );

  socket.on("Promote", (row: number, col: number, type: string) => {
    io.to("lobbyChess").emit("PiecePromoted", row, col, type);
  });

  socket.on("GameOver", (result: string, sId: string) => {
    io.except(sId).emit("GameOver", result);
  });

  socket.on("disconnect", () => {
    io.to("lobbyChess").emit("PlayerLeft");
  });
}

import { Socket, Server } from "socket.io";

export function ArmWrestleEvents(socket: Socket, io: Server) {
  socket.on("joinArmWrestle", (roomId: string) => {
    socket.join(roomId);
  });
  socket.on("startGame", (rounds, roomId) => {
    io.to(roomId).emit("startGame", rounds);
  });
  socket.on("sendResult", (result, roomId) => {
    io.to(roomId).emit("emitResult", result);
  });
}

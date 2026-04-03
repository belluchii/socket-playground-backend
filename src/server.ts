import { Socket } from "socket.io";
import { gameEvents } from "./Games/TicTacToe";
const io = require("socket.io")(process.env.PORT);

io.on("connection", (socket: Socket) => {

  gameEvents(socket, io);

  socket.on("getLobbies", () => {
    const rooms = io.sockets.adapter.rooms;
    const lobbies: { id: string; users: number }[] = [];

    rooms.forEach((sockets: Set<Socket>, roomId: string) => {
      if (roomId.startsWith("lobby:")) {
        lobbies.push({
          id: roomId.replace("lobby:", ""),
          users: sockets.size
        });
      }
    });
    io.emit("lobbiesList", lobbies);
  });

  socket.on("pressed", (text) => {
    io.emit("client-clicked", text);
  });

  socket.on('joinLobby', (lobby) => {
    lobby = "lobby:" + lobby;
    socket.join(lobby);
    io.to(lobby).emit('joinedLobby', `Se unio un nuevo usuario al ${lobby}`);
  })

  socket.on('exitLobby', (lobby) => {
    lobby = "lobby:" + lobby;
    socket.leave(lobby);
  })

  socket.on('getCurrentLobbies', () => {
    console.log(socket.rooms);
  })

});
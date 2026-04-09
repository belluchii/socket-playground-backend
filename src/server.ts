import { createServer } from "http";
import { Socket, Server } from "socket.io";
import { gameEvents } from "./Games/TicTacToe";
import { chessEvents } from "./Games/Chess";
import { ArmWrestleEvents } from "./Games/ArmWrestle";

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

io.on("connection", (socket: Socket) => {
  gameEvents(socket, io);
  chessEvents(socket, io);
  ArmWrestleEvents(socket, io);

  socket.on("getLobbies", () => {
    const rooms = io.sockets.adapter.rooms;
    const lobbies: { id: string; users: number }[] = [];

    rooms.forEach((sockets: Set<Socket>, roomId: string) => {
      if (roomId.startsWith("lobby:")) {
        lobbies.push({
          id: roomId.replace("lobby:", ""),
          users: sockets.size,
        });
      }
    });
    io.emit("lobbiesList", lobbies);
  });

  socket.on("pressed", (text) => {
    io.emit("client-clicked", text);
  });

  socket.on("joinLobby", (lobby) => {
    lobby = "lobby:" + lobby;
    socket.join(lobby);
    io.to(lobby).emit("joinedLobby", `Se unio un nuevo usuario al ${lobby}`);
  });

  socket.on("exitLobby", (lobby) => {
    lobby = "lobby:" + lobby;
    socket.leave(lobby);
  });

  socket.on("getCurrentLobbies", () => {
    console.log(socket.rooms);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`Servidor en puerto ${process.env.PORT || 3000}`);
});

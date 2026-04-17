import { Socket } from "socket.io";
import { tictactoeEvents } from "./Games/TicTacToe";
import { chessEvents } from "./Games/Chess";
import { ArmWrestleEvents } from "./Games/ArmWrestle";
import { battleShipEvents } from "./Games/BattleShip";

const io = require("socket.io")(process.env.PORT, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket: Socket) => {
  tictactoeEvents(socket, io);
  chessEvents(socket, io);
  ArmWrestleEvents(socket, io);
  battleShipEvents(socket, io);

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

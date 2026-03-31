import { Socket } from "socket.io";

const io = require("socket.io")(process.env.PORT);

io.on("connection", (socket: Socket) => {
  socket.on("pressed", (text) => {
    io.emit("client-clicked", text);
  });
});

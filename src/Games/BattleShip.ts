import { Socket, Server } from "socket.io";

export function battleShipEvents(socket: Socket, io: Server){
    socket.on("JoinLobbyBS", (lobby :string) => {
        socket.join(lobby);
    });

    socket.on("PlayerReadyBS", (lobby: string) => {
        console.log(`Player in lobby ${lobby} is ready!`);
        const room = io.sockets.adapter.rooms.get(lobby);
        if (room && room.size === 2) {
            socket.broadcast.to(lobby).emit("StartGameBS");
        }
    });

    socket.on("RequestEnemyBoard", (lobby: string) => {
        socket.broadcast.to(lobby).emit("PackBoard");
    });

    socket.on("SendBoard", (data: { lobby: string, board: any, ships: any }) => {
        socket.broadcast.to(data.lobby).emit("ReceiveEnemyBoard", {
            board: data.board,
            ships: data.ships,
        });
    });

    socket.on("RequestTurnBS", (lobby: string) => {
        const room = io.sockets.adapter.rooms.get(lobby);
        if (room && room.size === 2) {
            const ids = Array.from(room);
            const randomIndex = Math.floor(Math.random() * 10) % 2;
            io.to(ids[randomIndex]).emit("GrantTurn");
        }
    });

}
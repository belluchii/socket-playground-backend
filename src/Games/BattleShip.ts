import { Socket, Server } from "socket.io";

export function battleShipEvents(socket: Socket, io: Server){
    socket.on("JoinLobbyBS", (lobby :string) => {
        socket.join(lobby);
    });

    socket.on("PlayerReadyBS", (lobby: string, count:number) => {
        socket.broadcast.to(lobby).emit("isReadyBS", count);
    });

    socket.on("BothReadyBS", async(lobby: string) => {
        const room = io.sockets.adapter.rooms.get(lobby);
        if (room && room.size === 2) {
            io.to(lobby).emit("StartGameBS");
            const ids = await io.in(lobby).allSockets();
            const idsArray = [...ids]; 
            io.to(idsArray[Math.floor(Math.random() * (2))]).emit("GrantTurnBS");
        }
    });

    socket.on("RequestEnemyBoard", (lobby: string) => {
        socket.broadcast.to(lobby).emit("PackBoard");
    });

    socket.on("SendBoard", (data: { roomId: string, board: any, ships: any }) => {
        socket.broadcast.to(data.roomId).emit("ReceiveEnemyBoard", {
            board: data.board,
            ships: data.ships,
        });
    });
    
    socket.on("SwitchTurnBS", (lobby: string) => {
        socket.broadcast.to(lobby).emit("GrantTurnBS");
    });

    socket.on("SendAttack", (lobby:string, row:number, col:number)=>{
        socket.broadcast.to(lobby).emit("ReceiveAttack", row, col);
    });

}
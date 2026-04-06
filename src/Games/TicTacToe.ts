import { Socket, Server } from "socket.io";

export function gameEvents(socket: Socket, io: Server) {

    socket.on("MarkPlace", (index: number, typeP: string) => {
    io.emit("PlaceMarked", index, typeP);
    });

    socket.on("JoinRoom", () => {
        socket.join("lobbyTTT");
    });

    socket.on("GameOver", (type: string, sId: string) => {
        io.except(sId).emit("GameOver", type);
    })

    socket.on("RequestType", (sId: string) => {
        const room = io.sockets.adapter.rooms.get("lobbyTTT");
        if (room && room.size === 2){
            io.except(sId).emit("AskType");
        }
        else {
            io.emit("ReceivedType", "");
        }
    });
    
    socket.on("SendType", (type: string, sId: string) => {
        io.except(sId).emit("ReceivedType", type);
    });

    socket.on("GrantTurn", (sId: string) => {
        io.except(sId).to("lobbyTTT").emit("YourTurn");
    });

    socket.on("WaitForPlayer", async () => {
        const room = io.sockets.adapter.rooms.get("lobbyTTT");
        if (room && room.size === 2){
            const ids = await io.in('lobbyTTT').allSockets();
            const idsA = [...ids];
            io.to(idsA[Math.floor(Math.random() * (2))]).emit("YourTurn");
            io.to("lobbyTTT").emit("StartGame");

        }
        else{
            io.emit("WaitMessage", "Waiting for another player to join...");
        }
    });
}
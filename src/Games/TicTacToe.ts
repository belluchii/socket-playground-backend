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
        if (io.sockets.adapter.rooms.get("lobbyTTT").size === 2){
            io.except(sId).emit("AskType");
        }
        else {
            io.emit("ReceivedType", "");
        }
    });
    
    socket.on("SendType", (type: string, sId: string) => {
        io.except(sId).emit("ReceivedType", type);
    });
}
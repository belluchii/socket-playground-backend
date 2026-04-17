import { Socket, Server } from "socket.io";

export function battleShipEvents(socket: Socket, io: Server){
    socket.on("JoinLobby", () => {
        socket.join("lobbyBS");
    });
    
}
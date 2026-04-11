import { Socket, Server } from "socket.io";

type Direction = [number, number];
type Position = [number, number];

interface Snake {
  positions: Position[];
  direction: Direction;
  nextDirection: Direction;
  inputProcessed: boolean;
  alive: boolean;
}

interface SnakeRoom {
  map: (string | null)[][];
  snakes: Map<string, Snake>;
  fruits: Position[];
  gameStarted: boolean;
  gameLoop: NodeJS.Timeout | null;
  readyPlayers: Set<string>;
  waitingPlayers: Set<string>;
  playerNames: Map<string, string>;
}

const MAP_SIZE = 50;
const FPS = 24;
const MAX_FRUITS = 5;

const snakeRooms = new Map<string, SnakeRoom>();

function createRoom(): SnakeRoom {
  return {
    map: Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(null)),
    snakes: new Map(),
    fruits: [],
    gameStarted: false,
    gameLoop: null,
    readyPlayers: new Set(),
    waitingPlayers: new Set(),
    playerNames: new Map(),
  };
}

function getRoom(roomId: string): SnakeRoom | undefined {
  return snakeRooms.get(roomId);
}

function getRoomOrCreate(roomId: string): SnakeRoom {
  let room = snakeRooms.get(roomId);
  if (!room) {
    room = createRoom();
    snakeRooms.set(roomId, room);
  }
  return room;
}

function getPlayerNames(room: SnakeRoom): Record<string, string> {
  return Object.fromEntries(room.playerNames);
}

function spawnFruit(room: SnakeRoom) {
  if (room.fruits.length >= MAX_FRUITS) return;

  const availables: Position[] = [];
  room.map.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell === null) availables.push([y, x]);
    }),
  );

  if (availables.length) {
    const pos = availables[Math.floor(Math.random() * availables.length)];
    room.fruits.push(pos);
  }
}

function moveSnake(room: SnakeRoom, playerId: string) {
  const snake = room.snakes.get(playerId);
  if (!snake || !snake.alive) return;

  snake.inputProcessed = false;
  snake.direction = [...snake.nextDirection] as Direction;

  const [dy, dx] = snake.direction;
  const head = snake.positions[snake.positions.length - 1];
  const newY = head[0] + dy;
  const newX = head[1] + dx;

  const fruitIndex = room.fruits.findIndex(
    ([fy, fx]) => fy === newY && fx === newX,
  );
  if (fruitIndex !== -1) {
    room.fruits.splice(fruitIndex, 1);
  } else {
    const tail = snake.positions.shift();
    if (tail && room.map[tail[0]]) room.map[tail[0]][tail[1]] = null;
  }

  if (newY < 0 || newY >= MAP_SIZE || newX < 0 || newX >= MAP_SIZE) {
    snake.alive = false;
    return;
  }

  for (const [, s] of room.snakes) {
    if (!s.alive) continue;
    for (const [py, px] of s.positions) {
      if (py === newY && px === newX) {
        snake.alive = false;
        return;
      }
    }
  }

  snake.positions.push([newY, newX]);
  if (room.map[newY]) room.map[newY][newX] = "snake";
}

function getAliveCount(room: SnakeRoom): number {
  let count = 0;
  room.snakes.forEach((snake) => {
    if (snake.alive) count++;
  });
  return count;
}

function emitReadyStatus(room: SnakeRoom, roomId: string, io: Server) {
  io.to(roomId).emit("ReadyStatus", {
    ready: Array.from(room.readyPlayers),
    total: room.snakes.size,
    allReady:
      room.readyPlayers.size >= room.snakes.size && room.snakes.size > 0,
    gameStarted: room.gameStarted,
    playerNames: getPlayerNames(room),
  });
}

function checkGameEnd(room: SnakeRoom, roomId: string, io: Server): boolean {
  const aliveCount = getAliveCount(room);

  if (aliveCount <= 1) {
    if (room.gameLoop) {
      clearInterval(room.gameLoop);
      room.gameLoop = null;
    }
    room.gameStarted = false;
    room.readyPlayers.clear();

    let winnerId: string | null = null;
    room.snakes.forEach((snake, id) => {
      if (snake.alive) winnerId = id;
    });

    const winnerName = winnerId
      ? room.playerNames.get(winnerId) || "Jugador"
      : null;

    io.to(roomId).emit("GameEnded", {
      winnerId,
      message: winnerName ? `¡${winnerName} gana!` : "¡Todos murieron!",
    });

    io.to(roomId).emit("GameState", {
      snakes: Array.from(room.snakes.entries()).map(([id, s]) => ({
        id,
        positions: s.positions,
        direction: s.direction,
        alive: s.alive,
      })),
      fruits: room.fruits,
      mapSize: MAP_SIZE,
      gameStarted: false,
      gameEnded: true,
      winnerId,
    });

    emitReadyStatus(room, roomId, io);
    return true;
  }
  return false;
}

function gameLoop(roomId: string, io: Server) {
  const room = snakeRooms.get(roomId);
  if (!room || !room.gameStarted) return;

  if (room.fruits.length < MAX_FRUITS) spawnFruit(room);

  room.snakes.forEach((_, playerId) => moveSnake(room, playerId));

  io.to(roomId).emit("GameState", {
    snakes: Array.from(room.snakes.entries()).map(([id, s]) => ({
      id,
      positions: s.positions,
      direction: s.direction,
      alive: s.alive,
    })),
    fruits: room.fruits,
    mapSize: MAP_SIZE,
    gameStarted: true,
  });

  checkGameEnd(room, roomId, io);
}

function startGame(room: SnakeRoom, roomId: string, io: Server) {
  if (room.gameLoop) clearInterval(room.gameLoop);

  room.map = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(null));

  const corners = [
    { y: 1, x: 1, dir: [0, 1] as Direction },
    { y: 1, x: MAP_SIZE - 3, dir: [0, -1] as Direction },
    { y: MAP_SIZE - 2, x: 1, dir: [0, 1] as Direction },
    { y: MAP_SIZE - 2, x: MAP_SIZE - 3, dir: [0, -1] as Direction },
  ];

  let cornerIdx = 0;
  room.snakes.forEach((snake) => {
    const corner = corners[cornerIdx % corners.length];
    snake.positions = [
      [corner.y, corner.x],
      [corner.y, corner.x + corner.dir[1]],
      [corner.y, corner.x + corner.dir[1] * 2],
    ];
    snake.direction = [...corner.dir];
    snake.nextDirection = [...corner.dir];
    snake.alive = true;

    snake.positions.forEach(([y, x]) => {
      if (room.map[y]) room.map[y][x] = "snake";
    });
    cornerIdx++;
  });

  room.fruits = [];
  room.gameStarted = true;
  room.readyPlayers.clear();

  room.gameLoop = setInterval(() => gameLoop(roomId, io), 1000 / FPS);
  io.to(roomId).emit("GameStarted");
}

function resetGame(room: SnakeRoom, roomId: string, io: Server) {
  room.map = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(null));

  const corners = [
    { y: 1, x: 1, dir: [0, 1] as Direction },
    { y: 1, x: MAP_SIZE - 3, dir: [0, -1] as Direction },
    { y: MAP_SIZE - 2, x: 1, dir: [0, 1] as Direction },
    { y: MAP_SIZE - 2, x: MAP_SIZE - 3, dir: [0, -1] as Direction },
  ];

  let cornerIdx = 0;
  room.snakes.forEach((snake) => {
    const corner = corners[cornerIdx % corners.length];
    snake.positions = [
      [corner.y, corner.x],
      [corner.y, corner.x + corner.dir[1]],
      [corner.y, corner.x + corner.dir[1] * 2],
    ];
    snake.direction = [...corner.dir];
    snake.nextDirection = [...corner.dir];
    snake.alive = true;

    snake.positions.forEach(([y, x]) => {
      if (room.map[y]) room.map[y][x] = "snake";
    });
    cornerIdx++;
  });

  room.fruits = [];
  room.gameStarted = false;
  room.readyPlayers.clear();

  io.to(roomId).emit("GameState", {
    snakes: Array.from(room.snakes.entries()).map(([id, s]) => ({
      id,
      positions: s.positions,
      direction: s.direction,
      alive: s.alive,
    })),
    fruits: room.fruits,
    mapSize: MAP_SIZE,
    gameStarted: false,
  });

  emitReadyStatus(room, roomId, io);
}

function getAvailableCorner(
  room: SnakeRoom,
): { y: number; x: number; dir: Direction } | null {
  const corners = [
    { y: 1, x: 1, dir: [0, 1] as Direction },
    { y: 1, x: MAP_SIZE - 3, dir: [0, -1] as Direction },
    { y: MAP_SIZE - 2, x: 1, dir: [0, 1] as Direction },
    { y: MAP_SIZE - 2, x: MAP_SIZE - 3, dir: [0, -1] as Direction },
  ];

  for (const corner of corners) {
    const pos1: Position = [corner.y, corner.x];
    const pos2: Position = [corner.y, corner.x + corner.dir[1]];
    const pos3: Position = [corner.y, corner.x + corner.dir[1] * 2];

    let occupied = false;
    for (const [, snake] of room.snakes) {
      for (const pos of snake.positions) {
        if (
          (pos[0] === pos1[0] && pos[1] === pos1[1]) ||
          (pos[0] === pos2[0] && pos[1] === pos2[1]) ||
          (pos[0] === pos3[0] && pos[1] === pos3[1])
        ) {
          occupied = true;
          break;
        }
      }
      if (occupied) break;
    }
    if (!occupied) return corner;
  }
  return null;
}

export function SnakeEvents(socket: Socket, io: Server) {
  socket.on("JoinRoom", (roomId: string, playerName?: string) => {
    socket.join(roomId);
    const room = getRoomOrCreate(roomId);

    if (room.gameStarted) {
      room.waitingPlayers.add(socket.id);
      socket.emit("WaitingForGameEnd", {
        message: "Partida en progreso. Observando...",
        currentPlayers: room.snakes.size,
      });
      socket.emit("GameState", {
        snakes: Array.from(room.snakes.entries()).map(([id, s]) => ({
          id,
          positions: s.positions,
          direction: s.direction,
          alive: s.alive,
        })),
        fruits: room.fruits,
        mapSize: MAP_SIZE,
        gameStarted: true,
      });
      socket.emit("ReadyStatus", {
        ready: Array.from(room.readyPlayers),
        total: room.snakes.size,
        allReady: false,
        gameStarted: true,
        playerNames: getPlayerNames(room),
      });
      socket.emit("PlayerId", socket.id);
      return;
    }

    const spawnCorner = getAvailableCorner(room);

    let spawn: { y: number; x: number; dir: Direction };

    if (spawnCorner) {
      spawn = spawnCorner;
    } else {
      const mid = Math.floor(MAP_SIZE / 2);
      const dirs: Direction[] = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ];
      spawn = {
        y: mid,
        x: mid,
        dir: dirs[Math.floor(Math.random() * dirs.length)],
      };
    }

    const name = playerName || `Jugador${room.snakes.size + 1}`;
    room.playerNames.set(socket.id, name);

    room.snakes.set(socket.id, {
      positions: [
        [spawn.y, spawn.x],
        [spawn.y, spawn.x + spawn.dir[1]],
        [spawn.y, spawn.x + spawn.dir[1] * 2],
      ],
      direction: spawn.dir,
      nextDirection: spawn.dir,
      inputProcessed: false,
      alive: true,
    });

    const snake = room.snakes.get(socket.id)!;
    snake.positions.forEach(([y, x]) => {
      if (room.map[y]) room.map[y][x] = "snake";
    });

    io.to(roomId).emit("GameState", {
      snakes: Array.from(room.snakes.entries()).map(([id, s]) => ({
        id,
        positions: s.positions,
        direction: s.direction,
        alive: s.alive,
      })),
      fruits: room.fruits,
      mapSize: MAP_SIZE,
      gameStarted: room.gameStarted,
    });

    emitReadyStatus(room, roomId, io);
    socket.emit("PlayerId", socket.id);
  });

  socket.on("Input", (roomId: string, direction: Direction) => {
    const room = getRoom(roomId);
    if (!room) return;

    const snake = room.snakes.get(socket.id);
    if (!snake || !snake.alive || snake.inputProcessed) return;

    const [dy, dx] = direction;
    const [ndy, ndx] = snake.nextDirection;
    if (!(dy + ndy === 0 && dx + ndx === 0)) {
      snake.nextDirection = direction;
      snake.inputProcessed = true;
    }
  });

  socket.on("Ready", (roomId: string) => {
    const room = getRoom(roomId);
    if (!room) return;
    if (room.gameStarted) return;

    room.readyPlayers.add(socket.id);

    const allReady =
      room.readyPlayers.size >= room.snakes.size && room.snakes.size > 0;

    emitReadyStatus(room, roomId, io);

    if (allReady) {
      setTimeout(() => {
        const currentRoom = getRoom(roomId);
        if (currentRoom && currentRoom.gameStarted === false) {
          startGame(currentRoom, roomId, io);
        }
      }, 1000);
    }
  });

  socket.on("Unready", (roomId: string) => {
    const room = getRoom(roomId);
    if (!room) return;
    if (room.gameStarted) return;

    room.readyPlayers.delete(socket.id);
    emitReadyStatus(room, roomId, io);
  });

  socket.on("StartGame", (roomId: string) => {
    const room = getRoom(roomId);
    if (!room) return;
    if (room.gameStarted) return;
    if (room.readyPlayers.size < room.snakes.size) return;

    startGame(room, roomId, io);
  });

  socket.on("ResetGame", (roomId: string) => {
    const room = getRoom(roomId);
    if (!room) return;
    if (room.gameStarted) return;
    if (room.snakes.size === 0) return;

    resetGame(room, roomId, io);
  });

  socket.on("GetState", (roomId: string) => {
    const room = getRoom(roomId);
    if (!room) return;

    socket.emit("GameState", {
      snakes: Array.from(room.snakes.entries()).map(([id, s]) => ({
        id,
        positions: s.positions,
        direction: s.direction,
        alive: s.alive,
      })),
      fruits: room.fruits,
      mapSize: MAP_SIZE,
      gameStarted: room.gameStarted,
    });

    emitReadyStatus(room, roomId, io);
  });

  socket.on("disconnect", () => {
    snakeRooms.forEach((room, roomId) => {
      if (room.snakes.has(socket.id)) {
        const snake = room.snakes.get(socket.id);
        if (snake) {
          snake.positions.forEach(([y, x]) => {
            if (room.map[y]) room.map[y][x] = null;
          });
        }

        room.snakes.delete(socket.id);
        room.readyPlayers.delete(socket.id);
        room.playerNames.delete(socket.id);
        room.waitingPlayers.delete(socket.id);

        if (room.gameStarted && room.snakes.size === 1) {
          if (room.gameLoop) clearInterval(room.gameLoop);
          const remainingId = Array.from(room.snakes.keys())[0];
          const remainingSnake = room.snakes.get(remainingId);
          if (remainingSnake) remainingSnake.alive = true;

          room.fruits = [];
          room.gameStarted = false;
          room.readyPlayers.clear();

          io.to(roomId).emit("GameState", {
            snakes: Array.from(room.snakes.entries()).map(([id, s]) => ({
              id,
              positions: s.positions,
              direction: s.direction,
              alive: s.alive,
            })),
            fruits: room.fruits,
            mapSize: MAP_SIZE,
            gameStarted: false,
          });

          const winnerName = room.playerNames.get(remainingId) || "Jugador";
          io.to(roomId).emit("GameEnded", {
            winnerId: remainingId,
            message: `¡${winnerName} gana!`,
          });

          emitReadyStatus(room, roomId, io);
        }

        if (room.snakes.size === 0) {
          if (room.gameLoop) clearInterval(room.gameLoop);
          snakeRooms.delete(roomId);
        } else {
          io.to(roomId).emit("GameState", {
            snakes: Array.from(room.snakes.entries()).map(([id, s]) => ({
              id,
              positions: s.positions,
              direction: s.direction,
              alive: s.alive,
            })),
            fruits: room.fruits,
            mapSize: MAP_SIZE,
            gameStarted: room.gameStarted,
          });
          emitReadyStatus(room, roomId, io);
        }
      }
    });
  });
}

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
}

const MAP_SIZE = 30;
const FPS = 20;
const MAX_FRUITS = 3;

const snakeRooms = new Map<string, SnakeRoom>();

function createRoom(): SnakeRoom {
  return {
    map: Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(null)),
    snakes: new Map(),
    fruits: [],
    gameStarted: false,
    gameLoop: null,
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

  // Resetear flag de input procesado
  snake.inputProcessed = false;

  // Actualizar direction desde nextDirection
  snake.direction = [...snake.nextDirection] as Direction;

  // Primero movemos la cola (si no come fruta)
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

  // Ahora verificamos colisiones
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
  });
}

function startGame(room: SnakeRoom, roomId: string, io: Server) {
  if (room.gameLoop) clearInterval(room.gameLoop);
  room.gameStarted = true;
  room.gameLoop = setInterval(() => gameLoop(roomId, io), 1000 / FPS);
}

export function SnakeEvents(socket: Socket, io: Server) {
  socket.on("JoinRoom", (roomId: string) => {
    socket.join(roomId);
    const room = getRoomOrCreate(roomId);

    const startY = Math.floor(Math.random() * (MAP_SIZE - 4)) + 2;
    const startX = Math.floor(Math.random() * (MAP_SIZE - 4)) + 2;
    room.snakes.set(socket.id, {
      positions: [
        [startY, startX],
        [startY, startX + 1],
        [startY, startX + 2],
      ],
      direction: [0, 1],
      nextDirection: [0, 1],
      inputProcessed: false,
      alive: true,
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
    });

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

  socket.on("StartGame", (roomId: string) => {
    const room = getRoom(roomId);
    if (!room) return;
    startGame(room, roomId, io);
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
    });
  });

  socket.on("disconnect", () => {
    snakeRooms.forEach((room, roomId) => {
      if (room.snakes.has(socket.id)) {
        room.snakes.delete(socket.id);
        if (room.snakes.size === 0) {
          if (room.gameLoop) clearInterval(room.gameLoop);
          snakeRooms.delete(roomId);
        }
      }
    });
  });
}

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import type {
    ServerToClientEvents,
    ClientToServerEvents,
    SocketData,
    User,
    Message,
    Room
} from '../shared/types';

const app = express();
const httpServer = createServer(app);

const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
>(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.json());

const users = new Map<string, User>();
const messages: Message[] = [];
const rooms = new Map<string, Room>();

const defaultRoom: Room = {
    id: 'general',
    name: 'General',
    users: [],
    createdAt: new Date()
};
rooms.set('general', defaultRoom);

io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    socket.on('user:join', (username, callback) => {
        try {
            if (!username || username.trim().length === 0) {
                callback(false, 'Username cannot be empty');
                return;
            }

            const existingUser = Array.from(users.values()).find(
                u => u.username.toLowerCase() === username.toLowerCase()
            );

            if (existingUser) {
                callback(false, 'Username already taken');
                return;
            }

            const user: User = {
                id: socket.id,
                username: username.trim(),
                joinedAt: new Date()
            };

            users.set(socket.id, user);
            socket.data.user = user;

            socket.join('general');
            const generalRoom = rooms.get('general')!;
            generalRoom.users.push(user);

            socket.broadcast.emit('user:joined', user);

            socket.emit('users:list', Array.from(users.values()));

            socket.emit('message:history', messages.slice(-50));

            const systemMessage: Message = {
                id: Date.now().toString(),
                userId: 'system',
                username: 'System',
                content: `${username} joined the chat`,
                timestamp: new Date(),
                type: 'system'
            };
            messages.push(systemMessage);
            io.emit('message:new', systemMessage);

            console.log(`User joined: ${username} (${socket.id})`);
            callback(true);
        } catch (error) {
            console.error('Error in user:join:', error);
            callback(false, 'Internal server error');
        }
    });

    socket.on('message:send', (content, callback) => {
        try {
            const user = socket.data.user;

            if (!user) {
                callback(false);
                socket.emit('error', 'You must join first');
                return;
            }

            if (!content || content.trim().length === 0) {
                callback(false);
                return;
            }

            const message: Message = {
                id: Date.now().toString(),
                userId: user.id,
                username: user.username,
                content: content.trim(),
                timestamp: new Date(),
                type: 'text'
            };

            messages.push(message);

            io.emit('message:new', message);

            console.log(`Message from ${user.username}: ${content}`);
            callback(true);
        } catch (error) {
            console.error('Error in message:send:', error);
            callback(false);
        }
    });

    socket.on('message:getHistory', (limit = 50) => {
        const history = messages.slice(-limit);
        socket.emit('message:history', history);
    });

    socket.on('room:create', (name, callback) => {
        try {
            const user = socket.data.user;
            if (!user) {
                callback(null);
                return;
            }

            const roomId = `room-${Date.now()}`;
            const room: Room = {
                id: roomId,
                name: name.trim(),
                users: [],
                createdAt: new Date()
            };

            rooms.set(roomId, room);
            io.emit('room:created', room);

            console.log(`Room created: ${name} (${roomId})`);
            callback(room);
        } catch (error) {
            console.error('Error in room:create:', error);
            callback(null);
        }
    });

    socket.on('room:list', () => {
        socket.emit('rooms:list', Array.from(rooms.values()));
    });

    socket.on('typing:start', () => {
        const user = socket.data.user;
        if (user) {
            socket.broadcast.emit('notification', `${user.username} is typing...`);
        }
    });

    socket.on('typing:stop', () => {
        // Handle typing stop
    });

    socket.on('disconnect', () => {
        const user = socket.data.user;

        if (user) {
            users.delete(socket.id);

            rooms.forEach(room => {
                room.users = room.users.filter(u => u.id !== socket.id);
            });

            socket.broadcast.emit('user:left', user);

            const systemMessage: Message = {
                id: Date.now().toString(),
                userId: 'system',
                username: 'System',
                content: `${user.username} left the chat`,
                timestamp: new Date(),
                type: 'system'
            };
            messages.push(systemMessage);
            io.emit('message:new', systemMessage);

            console.log(`User left: ${user.username} (${socket.id})`);
        } else {
            console.log(`Disconnected: ${socket.id}`);
        }
    });
});

app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date(),
        connections: io.engine.clientsCount,
        users: users.size,
        rooms: rooms.size
    });
});

app.get('/api/stats', (_req, res) => {
    res.json({
        totalUsers: users.size,
        totalMessages: messages.length,
        totalRooms: rooms.size,
        users: Array.from(users.values()),
        rooms: Array.from(rooms.values())
    });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {

});

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    httpServer.close(() => {
        console.log('HTTP server closed');
    });
});

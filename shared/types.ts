export interface User {
    id: string;
    username: string;
    joinedAt: Date;
}

export interface Message {
    id: string;
    userId: string;
    username: string;
    content: string;
    timestamp: Date;
    type: 'text' | 'system';
}

export interface Room {
    id: string;
    name: string;
    users: User[];
    createdAt: Date;
}

export interface ServerToClientEvents {
    'user:joined': (user: User) => void;
    'user:left': (user: User) => void;
    'users:list': (users: User[]) => void;

    'message:new': (message: Message) => void;
    'message:history': (messages: Message[]) => void;

    'room:created': (room: Room) => void;
    'room:joined': (room: Room) => void;
    'room:left': (roomId: string) => void;
    'rooms:list': (rooms: Room[]) => void;

    'error': (error: string) => void;
    'notification': (message: string) => void;
}

export interface ClientToServerEvents {
    'user:join': (username: string, callback: (success: boolean, error?: string) => void) => void;
    'user:disconnect': () => void;
    'message:send': (content: string, callback: (success: boolean) => void) => void;
    'message:getHistory': (limit?: number) => void;

    'room:create': (name: string, callback: (room: Room | null) => void) => void;
    'room:join': (roomId: string, callback: (success: boolean) => void) => void;
    'room:leave': (roomId: string) => void;
    'room:list': () => void;

    'typing:start': () => void;
    'typing:stop': () => void;
}

export interface SocketData {
    user?: User;
    currentRoom?: string;
}

export interface TypingIndicator {
    userId: string;
    username: string;
    isTyping: boolean;
}

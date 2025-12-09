import { io, Socket } from 'socket.io-client';
import type {
    ServerToClientEvents,
    ClientToServerEvents,
    User,
    Message
} from '../shared/types';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

class ChatApp {
    private socket: TypedSocket;
    private currentUser: User | null = null;
    private typingTimeout: number | null = null;

    private loginScreen!: HTMLElement;
    private chatScreen!: HTMLElement;
    private loginForm!: HTMLFormElement;
    private usernameInput!: HTMLInputElement;
    private messageForm!: HTMLFormElement;
    private messageInput!: HTMLInputElement;
    private messagesContainer!: HTMLElement;
    private messagesWrapper!: HTMLElement;
    private usersList!: HTMLElement;
    private userCount!: HTMLElement;
    private currentUsernameEl!: HTMLElement;
    private logoutBtn!: HTMLElement;
    private connectionIndicator!: HTMLElement;
    private connectionText!: HTMLElement;

    constructor() {
        this.socket = io('http://localhost:3000', {
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });

        this.initializeDOM();
        this.setupSocketListeners();
        this.setupEventListeners();
    }

    private initializeDOM(): void {
        this.loginScreen = document.getElementById('login-screen')!;
        this.chatScreen = document.getElementById('chat-screen')!;
        this.loginForm = document.getElementById('login-form') as HTMLFormElement;
        this.usernameInput = document.getElementById('username') as HTMLInputElement;
        this.messageForm = document.getElementById('message-form') as HTMLFormElement;
        this.messageInput = document.getElementById('message-input') as HTMLInputElement;
        this.messagesContainer = document.getElementById('messages-container')!;
        this.messagesWrapper = document.getElementById('messages')!;
        this.usersList = document.getElementById('users-list')!;
        this.userCount = document.getElementById('user-count')!;
        this.currentUsernameEl = document.getElementById('current-username')!;
        this.logoutBtn = document.getElementById('logout-btn')!;
        this.connectionIndicator = document.getElementById('connection-indicator')!;
        this.connectionText = document.getElementById('connection-text')!;
    }

    private setupEventListeners(): void {
        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        this.messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSendMessage();
        });

        this.messageInput.addEventListener('input', () => {
            this.handleTyping();
        });

        this.logoutBtn.addEventListener('click', () => {
            this.handleLogout();
        });

        document.getElementById('stats-btn')?.addEventListener('click', () => {
            this.showStats();
        });
    }

    private setupSocketListeners(): void {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus(false);
            this.showToast('Disconnected from server', 'error');
        });

        this.socket.on('user:joined', (user) => {
            console.log('User joined:', user);
            this.showToast(`${user.username} joined the chat`, 'info');
        });

        this.socket.on('user:left', (user) => {
            console.log('User left:', user);
            this.showToast(`${user.username} left the chat`, 'info');
        });

        this.socket.on('users:list', (users) => {
            this.updateUsersList(users);
        });

        this.socket.on('message:new', (message) => {
            this.addMessage(message);
        });

        this.socket.on('message:history', (messages) => {
            this.loadMessageHistory(messages);
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.showToast(error, 'error');
        });

        this.socket.on('notification', (message) => {
            this.showToast(message, 'info');
        });
    }

    private handleLogin(): void {
        const username = this.usernameInput.value.trim();

        if (!username) {
            this.showToast('Please enter a username', 'error');
            return;
        }

        this.socket.emit('user:join', username, (success, error) => {
            if (success) {
                this.currentUser = {
                    id: this.socket.id!,
                    username,
                    joinedAt: new Date()
                };
                this.showChatScreen();
                this.showToast('Welcome to the chat!', 'success');
            } else {
                this.showToast(error || 'Failed to join', 'error');
            }
        });
    }

    private handleSendMessage(): void {
        const content = this.messageInput.value.trim();

        if (!content) return;

        this.socket.emit('message:send', content, (success) => {
            if (success) {
                this.messageInput.value = '';
                this.scrollToBottom();
            } else {
                this.showToast('Failed to send message', 'error');
            }
        });
    }

    private handleTyping(): void {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        this.socket.emit('typing:start');

        this.typingTimeout = window.setTimeout(() => {
            this.socket.emit('typing:stop');
        }, 1000);
    }

    private handleLogout(): void {
        this.socket.disconnect();
        this.currentUser = null;
        this.showLoginScreen();
        this.messagesWrapper.innerHTML = '';
        this.usernameInput.value = '';

        // Reconnect for next login
        setTimeout(() => {
            this.socket.connect();
        }, 500);
    }

    private addMessage(message: Message): void {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.type}`;

        const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        if (message.type === 'system') {
            messageEl.innerHTML = `
        <div class="message-content">${this.escapeHtml(message.content)}</div>
      `;
        } else {
            messageEl.innerHTML = `
        <div class="message-header">
          <span class="message-author">${this.escapeHtml(message.username)}</span>
          <span class="message-time">${time}</span>
        </div>
        <div class="message-content">${this.escapeHtml(message.content)}</div>
      `;
        }

        this.messagesWrapper.appendChild(messageEl);
        this.scrollToBottom();
    }

    private loadMessageHistory(messages: Message[]): void {
        this.messagesWrapper.innerHTML = '';
        messages.forEach(message => this.addMessage(message));
    }

    private updateUsersList(users: User[]): void {
        this.userCount.textContent = users.length.toString();

        this.usersList.innerHTML = users.map(user => `
      <li class="user-item">
        <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
        <span class="user-name">${this.escapeHtml(user.username)}</span>
      </li>
    `).join('');
    }

    private updateConnectionStatus(connected: boolean): void {
        const dot = this.connectionIndicator.querySelector('.status-dot');

        if (connected) {
            dot?.classList.add('connected');
            this.connectionText.textContent = 'Connected';
        } else {
            dot?.classList.remove('connected');
            this.connectionText.textContent = 'Disconnected';
        }
    }

    private showLoginScreen(): void {
        this.loginScreen.classList.add('active');
        this.chatScreen.classList.remove('active');
    }

    private showChatScreen(): void {
        this.loginScreen.classList.remove('active');
        this.chatScreen.classList.add('active');

        if (this.currentUser) {
            this.currentUsernameEl.textContent = this.currentUser.username;
        }

        this.messageInput.focus();
    }

    private scrollToBottom(): void {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    private showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
        const container = document.getElementById('toast-container')!;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    private async showStats(): Promise<void> {
        try {
            const response = await fetch('http://localhost:3000/api/stats');
            const stats = await response.json();

            alert(`
Server Statistics

Total Users: ${stats.totalUsers}
Total Messages: ${stats.totalMessages}
Total Rooms: ${stats.totalRooms}

Users Online:
${stats.users.map((u: User) => `• ${u.username}`).join('\n')}
      `);
        } catch (error) {
            this.showToast('Failed to fetch stats', 'error');
        }
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
    console.log('Chat app initialized');
});

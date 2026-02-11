// lib/sse.ts
type SSEEventCallback = (data: any) => void;

class SSEManager {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Set<SSEEventCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeout = 3000;

  connect() {
    if (this.eventSource?.readyState === EventSource.OPEN) return;

    this.eventSource = new EventSource('/api/notifications/sse');

    this.eventSource.onopen = () => {
      console.log('✅ SSE Connected');
      this.reconnectAttempts = 0;
    };

    this.eventSource.onerror = (error) => {
      console.error('❌ SSE Error:', error);
      this.eventSource?.close();
      
      // محاولة إعادة الاتصال
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}`);
        setTimeout(() => this.connect(), this.reconnectTimeout);
      }
    };

    // استماع للإشعارات
    this.eventSource.addEventListener('notification', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 SSE Notification received:', data);
        this.emit('notification', data);
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    });

    this.eventSource.addEventListener('connected', (event: MessageEvent) => {
      console.log('🔌 SSE Connected:', event.data);
    });
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('🔌 SSE Disconnected');
    }
  }

  on(event: string, callback: SSEEventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  off(event: string, callback: SSEEventCallback) {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }
}

export const sseManager = new SSEManager();
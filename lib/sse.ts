'use client'

// SSE Manager مبسط جداً
class SimpleSSE {
  private eventSource: EventSource | null = null;
  private callbacks: ((data: any) => void)[] = [];

  connect() {
    if (this.eventSource?.readyState === EventSource.OPEN) return;

    console.log('🔄 Connecting to SSE...');
    this.eventSource = new EventSource('/api/notifications/sse');

    this.eventSource.onopen = () => {
      console.log('✅ SSE Connected successfully');
    };

    this.eventSource.onerror = (e) => {
      console.error('❌ SSE Error:', e);
      // حاول إعادة الاتصال بعد 3 ثواني
      setTimeout(() => {
        this.disconnect();
        this.connect();
      }, 3000);
    };

    // استماع للإشعارات
    this.eventSource.addEventListener('notification', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        console.log('📨 New notification:', data);
        this.callbacks.forEach(cb => cb(data));
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    });
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('🔌 SSE Disconnected');
    }
  }

  onNotification(callback: (data: any) => void) {
    this.callbacks.push(callback);
  }
}

export const sse = new SimpleSSE();
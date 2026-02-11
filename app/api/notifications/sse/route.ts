export const runtime = 'nodejs';

// تخزين العملاء المتصلين
let clients: Set<ReadableStreamDefaultController> = new Set();

export async function GET(req: Request) {
  const stream = new ReadableStream({
    start(controller) {
      clients.add(controller);
      console.log('🟢 Client connected. Total clients:', clients.size);

      // إرسال تأكيد الاتصال
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode('retry: 3000\n\n'));
      controller.enqueue(encoder.encode('event: connected\ndata: {"status":"connected"}\n\n'));

      req.signal.addEventListener('abort', () => {
        clients.delete(controller);
        console.log('🔴 Client disconnected. Total clients:', clients.size);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// دالة بسيطة لإرسال الإشعارات
export function sendNotification(data: any) {
  const encoder = new TextEncoder();
  const message = `event: notification\ndata: ${JSON.stringify(data)}\n\n`;
  
  console.log(`📨 Sending notification to ${clients.size} clients:`, data);
  
  clients.forEach((client) => {
    try {
      client.enqueue(encoder.encode(message));
    } catch (error) {
      console.error('Error sending to client');
      clients.delete(client);
    }
  });
}
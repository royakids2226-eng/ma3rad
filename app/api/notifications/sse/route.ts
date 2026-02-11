import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

let clients: Set<ReadableStreamDefaultController> = new Set();

export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      clients.add(controller);
      
      // إرسال رسالة ترحيب
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode('event: connected\ndata: {"message":"SSE connected"}\n\n'));

      req.signal.addEventListener('abort', () => {
        clients.delete(controller);
        console.log('Client disconnected, total clients:', clients.size);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// دالة لإرسال الإشعارات لجميع العملاء
export function sendNotificationToAll(data: any) {
  const encoder = new TextEncoder();
  const message = `event: notification\ndata: ${JSON.stringify(data)}\n\n`;
  
  clients.forEach((client) => {
    try {
      client.enqueue(encoder.encode(message));
    } catch (error) {
      console.error('Error sending to client:', error);
      clients.delete(client);
    }
  });
  
  console.log(`📢 Notification sent to ${clients.size} clients`);
}
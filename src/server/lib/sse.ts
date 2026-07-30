/**
 * Server-Sent Events (SSE) helper for live notification push.
 *
 * Clients connect to GET /api/notifications/stream (auth required).
 * When a notification is inserted for a user, call broadcastNotification(userId)
 * to push a "refresh" event to all that user's open connections.
 */
import { type Response } from 'express';
import { type AuthRequest } from '../middleware/auth.js';

// Map of userId → Set of SSE response objects
const clients = new Map<number, Set<Response>>();

/** Register a new SSE client connection */
export function sseHandler(req: AuthRequest, res: Response) {
  const userId = req.user!.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  // Send a heartbeat immediately so the client knows it's connected
  res.write('event: connected\ndata: ok\n\n');

  // Register client
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(res);

  // Heartbeat every 25s to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    const set = clients.get(userId);
    if (set) {
      set.delete(res);
      if (set.size === 0) clients.delete(userId);
    }
  });
}

/** Push a "new notification" event to all open connections for a user */
export function broadcastNotification(userId: number) {
  const set = clients.get(userId);
  if (!set || set.size === 0) return;
  const payload = `event: notification\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch { /* client disconnected */ }
  }
}

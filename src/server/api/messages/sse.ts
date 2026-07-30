/**
 * Server-Sent Events (SSE) endpoint for real-time messaging.
 * GET /api/messages/sse
 *
 * Authenticated users subscribe to a persistent connection.
 * The server pushes events when:
 *  - A new thread arrives for any of the user's profiles
 *  - A new message arrives on an open thread
 *  - A thread status changes
 *
 * Clients receive JSON-encoded events:
 *   { type: 'new_thread' | 'new_message' | 'thread_updated', data: {...} }
 *
 * The server keeps a registry of active connections keyed by userId.
 * When a message is saved, the relevant userId is notified immediately.
 */
import { type Response } from 'express';
import { type AuthRequest } from '../../middleware/auth.js';

// ─── Connection registry ──────────────────────────────────────────────────────

type SSEClient = {
  userId: number;
  res: Response;
  heartbeatTimer: ReturnType<typeof setInterval>;
};

const clients = new Map<number, Set<SSEClient>>();

function addClient(userId: number, client: SSEClient) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(client);
}

function removeClient(userId: number, client: SSEClient) {
  clearInterval(client.heartbeatTimer);
  const set = clients.get(userId);
  if (set) {
    set.delete(client);
    if (set.size === 0) clients.delete(userId);
  }
}

/**
 * Push an event to all SSE connections for a given userId.
 * Called by message handlers after writing to the DB.
 */
export function pushToUser(userId: number, type: string, data: unknown) {
  const set = clients.get(userId);
  if (!set || set.size === 0) return;
  const payload = `data: ${JSON.stringify({ type, data })}\n\n`;
  for (const client of set) {
    try {
      client.res.write(payload);
    } catch {
      // Connection dropped — will be cleaned up by close handler
    }
  }
}

// ─── SSE handler ─────────────────────────────────────────────────────────────

export async function sseHandler(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', data: { userId } })}\n\n`);

  // Heartbeat every 25s to keep the connection alive through proxies/load balancers
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeatTimer);
    }
  }, 25000);

  const client: SSEClient = { userId, res, heartbeatTimer };
  addClient(userId, client);

  // Clean up when the client disconnects
  req.on('close', () => {
    removeClient(userId, client);
  });
  req.on('error', () => {
    removeClient(userId, client);
  });
}

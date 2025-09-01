import { Request, Response } from 'express';

interface Client {
  id: string;
  res: Response;
}

const clients = new Map<string, Client>();

export function addClient(id: string, res: Response) {
  clients.set(id, { id, res });
}

export function removeClient(id: string) {
  const c = clients.get(id);
  if (c) {
    try { c.res.end(); } catch { /* ignore */ }
    clients.delete(id);
  }
}

export function sendEvent(id: string, event: string, data: any) {
  const client = clients.get(id);
  if (!client) return;
  try {
    client.res.write(`event: ${event}\n`);
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (e) {
    // remove on error
    removeClient(id);
  }
}

export function setupSSE(req: Request, res: Response, id: string) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('\n');
  addClient(id, res);

  req.on('close', () => {
    removeClient(id);
  });
}

export default {
  addClient,
  removeClient,
  sendEvent,
  setupSSE,
};

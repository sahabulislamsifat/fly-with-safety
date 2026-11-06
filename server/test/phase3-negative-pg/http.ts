import { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { Duplex } from 'node:stream';
import type { Express } from 'express';

/** Actual Express middleware and form parsing over an in-process HTTP stream. */
export function postForm(app: Express, path: string, payload: Record<string, string>) {
  const body = new URLSearchParams(payload).toString();
  return new Promise<{ status: number; location: string | undefined; text: string }>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = new Duplex({ read() {}, write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
    Object.defineProperty(stream, 'remoteAddress', { value: '127.0.0.1' });
    const socket = stream as Socket;
    const req = new IncomingMessage(socket);
    req.method = 'POST';
    req.url = path;
    req.headers = { 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(body)) };
    req.complete = true;
    const res = new ServerResponse(req);
    res.assignSocket(socket);
    stream.once('error', reject);
    res.once('error', reject);
    res.once('finish', () => {
      const message = Buffer.concat(chunks).toString('utf8');
      const location = res.getHeader('location');
      resolve({ status: res.statusCode, location: typeof location === 'string' ? location : undefined, text: message.slice(message.indexOf('\r\n\r\n') + 4) });
      stream.destroy();
    });
    app(req, res);
    req.push(body);
    req.push(null);
  });
}

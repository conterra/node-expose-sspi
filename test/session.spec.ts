import express, { Request, Response } from 'express';
import { Server } from 'http';
import { sso } from '../src';
import { strict as assert } from 'assert';

class MyServer {
  app = express();
  server!: Server;
  constructor() {
    this.app.use(sso.auth({ useSession: true }));
    this.app.use((req, res) => {
      res.json({
        sso: req.sso,
      });
    });

    // to avoid the default error handler do some console.error stuff.
    this.app.use(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (err: any, req: Request, res: Response) => {
        res.status(err.statusCode).end();
      }
    );
  }

  start(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.server = this.app.listen(3000, () => resolve());
    });
  }
  stop(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
  }
}

describe('Session', function () {
  it('should test session is used', async function () {
    this.timeout(15000);
    const server = new MyServer();
    try {
      await server.start();

      const client = new sso.Client();
      await client.fetch('http://localhost:3000');
      const response = await client.fetch('http://localhost:3000');
      const json = await response.json();
      assert.equal(json.cached, true);
    } catch (e) {
      assert.fail(e);
    } finally {
      await server.stop();
    }
  });
});

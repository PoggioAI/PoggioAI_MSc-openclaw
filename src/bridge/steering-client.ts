/**
 * Steering Client — HTTP client for the consortium's live steering API.
 *
 * The consortium runs an HTTP server at http://127.0.0.1:{callback_port + 1}
 * that accepts pause, instruction injection, status queries, and milestone responses.
 */
import http from 'http';
import { SteeringInstruction, SteeringStatus, MilestoneResponse } from '../types/steering.js';

/**
 * HTTP client for the consortium steering API.
 */
export class SteeringClient {
  private baseUrl: string;

  constructor(port: number, host: string = '127.0.0.1') {
    this.baseUrl = `http://${host}:${port}`;
  }

  /**
   * Pause the pipeline. Safe to call multiple times.
   */
  async pause(): Promise<void> {
    await this.post('/interrupt', {});
  }

  /**
   * Inject a steering instruction into the pipeline.
   *
   * @param text - The instruction text.
   * @param type - 'm' = modify (agent reads it), 'n' = note (logged only).
   */
  async inject(text: string, type: 'm' | 'n' = 'm'): Promise<void> {
    const body: SteeringInstruction = { text, type };
    await this.post('/instruction', body);
  }

  /**
   * Check the current steering status.
   */
  async status(): Promise<SteeringStatus> {
    return this.get<SteeringStatus>('/status');
  }

  /**
   * Respond to a human-in-the-loop milestone gate.
   */
  async respondToMilestone(
    action: 'approve' | 'modify' | 'abort',
    feedback?: string,
  ): Promise<void> {
    const body: MilestoneResponse = { action, feedback };
    await this.post('/milestone_response', body);
  }

  /**
   * Check if the steering server is reachable.
   */
  async isReady(): Promise<boolean> {
    try {
      await this.get('/status');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for the steering server to become available.
   * Polls every 2 seconds, up to maxWaitMs.
   */
  async waitForReady(maxWaitMs: number = 30000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      if (await this.isReady()) return true;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    return false;
  }

  // --- HTTP helpers ---

  private get<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}${path}`;
      http
        .get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data) as T);
            } catch {
              reject(new Error(`Failed to parse response from ${path}: ${data}`));
            }
          });
        })
        .on('error', (err) => {
          reject(new Error(`HTTP GET ${path} failed: ${err.message}`));
        });
    });
  }

  private post(path: string, body: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}${path}`);
      const payload = JSON.stringify(body);

      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(data);
            }
          });
        },
      );

      req.on('error', (err) => {
        reject(new Error(`HTTP POST ${path} failed: ${err.message}`));
      });

      req.write(payload);
      req.end();
    });
  }
}

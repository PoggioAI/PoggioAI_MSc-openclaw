/**
 * OpenClaw Plugin API — typed interface for the `api` object received
 * in `register(api)`.
 *
 * Since the OpenClaw plugin SDK documentation is sparse, this interface
 * declares every method the plugin uses with proper types. Methods that
 * may not exist on all OpenClaw versions are marked optional (?).
 *
 * Use `assertApi()` at the register() boundary to validate critical
 * methods exist at runtime.
 */

// ─── Registration Types ──────────────────────────────────────────────

export interface CommandRegistration {
  name: string;
  description: string;
  usage?: string;
  handler: (args: string) => void | Promise<void>;
}

export interface ToolRegistration {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (input: any) => any | Promise<any>;
}

export interface ServiceRegistration {
  name: string;
  interval: number;
  handler: () => void | Promise<void>;
}

// ─── Messaging Types ─────────────────────────────────────────────────

export interface FileAttachment {
  /** Original filename. */
  filename: string;
  /** MIME type (e.g., 'application/pdf', 'text/csv'). */
  mimeType: string;
  /** Local filesystem path (if the file was saved by the gateway). */
  path?: string;
  /** Remote URL (for Telegram/web-sourced files). */
  url?: string;
  /** Raw file contents (for small inline attachments). */
  data?: Buffer;
}

export interface IncomingMessage {
  /** Text content of the message. */
  text: string;
  /** File attachments, if any. */
  attachments?: FileAttachment[];
}

export interface UploadOptions {
  /** Prompt text shown to the user. */
  prompt?: string;
  /** Max wait time in ms. */
  timeoutMs?: number;
  /** Allowed MIME types. */
  accept?: string[];
}

export interface UploadResult {
  /** Uploaded files. */
  files: FileAttachment[];
  /** Whether the user cancelled / timed out. */
  cancelled: boolean;
}

export interface Disposable {
  dispose(): void;
}

// ─── Main API Interface ──────────────────────────────────────────────

export interface OpenClawApi {
  // ── Required Methods (must exist) ──

  /** Register a slash command. */
  registerCommand(opts: CommandRegistration): void;

  /** Register an agent-callable tool. */
  registerTool(opts: ToolRegistration): void;

  /** Send a text message to the user's channel. */
  sendMessage(text: string): void;

  // ── Optional Methods (may not exist on all versions) ──

  /** Register a background polling service. */
  registerService?(opts: ServiceRegistration): void;

  /** Register a lifecycle event handler (e.g., 'shutdown'). */
  on?(event: string, handler: (...args: any[]) => void): void;

  /** Plugin-level logging. */
  log?(level: 'debug' | 'info' | 'warn' | 'error', message: string): void;

  /** Retrieve merged plugin configuration. */
  getConfig?(): Record<string, any>;

  /** Send a file to the user's channel. */
  sendFile?(filePath: string, caption?: string): void;

  /** Request file upload from the user (native dialog). */
  requestUpload?(opts?: UploadOptions): Promise<UploadResult>;

  /** Wait for the next incoming message (blocking with timeout). */
  waitForMessage?(opts?: { timeoutMs?: number }): Promise<IncomingMessage>;

  /** Subscribe to incoming messages (non-blocking). */
  onMessage?(handler: (msg: IncomingMessage) => void): Disposable;
}

// ─── Runtime Validation ──────────────────────────────────────────────

/**
 * Validate that the api object has the critical methods the plugin needs.
 * Call this at the top of register() to fail fast with a clear message.
 *
 * @throws Error if required methods are missing.
 */
export function assertApi(api: any): asserts api is OpenClawApi {
  const required = ['registerCommand', 'registerTool', 'sendMessage'];
  const missing = required.filter(
    (m) => typeof api[m] !== 'function',
  );

  if (missing.length > 0) {
    throw new Error(
      `pAI/MSc-openclaw plugin: OpenClaw API is missing required methods: ${missing.join(', ')}. ` +
        'This plugin requires OpenClaw >= 2026.3.0.',
    );
  }
}

/**
 * Safely call an optional API method. Returns undefined if the method
 * doesn't exist, otherwise returns the method's return value.
 */
export function safeCall<T>(
  api: OpenClawApi,
  method: keyof OpenClawApi,
  ...args: any[]
): T | undefined {
  const fn = api[method];
  if (typeof fn === 'function') {
    return (fn as Function).apply(api, args) as T;
  }
  return undefined;
}

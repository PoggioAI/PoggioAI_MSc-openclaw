/**
 * Upload Handler — prompts users to attach reference files before a run.
 *
 * Supports three fallback strategies depending on what the OpenClaw API provides:
 *
 * 1. Strategy A: api.requestUpload() — native upload dialog (best UX)
 * 2. Strategy B: api.waitForMessage() — prompt + wait for reply with attachments
 * 3. Strategy C: Skip gracefully with log message (API doesn't support uploads)
 *
 * Users can bypass the prompt entirely with:
 *   --no-upload-prompt              skip the question
 *   --attach /path/to/file.pdf      attach local files directly (repeatable)
 */
import { copyFileSync, existsSync, writeFileSync } from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { OpenClawApi, FileAttachment } from '../types/openclaw-api.js';
import { RunWorkspace, copyFilesToUploads, saveUploadData } from './workspace-manager.js';

export interface UploadHandlerOptions {
  /** Max wait time in ms for user response. Default: 60000. */
  timeoutMs: number;
  /** Skip the upload prompt entirely. */
  skipPrompt: boolean;
  /** Local file paths to attach (--attach flag, repeatable). */
  localFiles: string[];
}

/**
 * Prompt the user for reference file uploads, with graceful fallback.
 *
 * @returns Array of saved file paths in workspace.uploadsDir.
 */
export async function promptForUploads(
  api: OpenClawApi,
  workspace: RunWorkspace,
  options: UploadHandlerOptions,
): Promise<string[]> {
  const savedPaths: string[] = [];

  // 1. Handle --attach local files first (always works, no API dependency)
  if (options.localFiles.length > 0) {
    const copied = copyFilesToUploads(workspace, options.localFiles);
    savedPaths.push(...copied);
  }

  // 2. If --no-upload-prompt or timeout is 0, skip the interactive prompt
  if (options.skipPrompt || options.timeoutMs <= 0) {
    return savedPaths;
  }

  // 3. Try interactive upload strategies
  const uploaded = await tryInteractiveUpload(api, workspace, options.timeoutMs);
  savedPaths.push(...uploaded);

  return savedPaths;
}

/**
 * Try interactive upload using available API methods.
 */
async function tryInteractiveUpload(
  api: OpenClawApi,
  workspace: RunWorkspace,
  timeoutMs: number,
): Promise<string[]> {
  // Strategy A: Native upload dialog
  if (typeof api.requestUpload === 'function') {
    try {
      const result = await api.requestUpload({
        prompt:
          'Attach reference files for this research run (papers, datasets, notes). ' +
          'Or skip to proceed without attachments.',
        timeoutMs,
      });

      if (result.cancelled || result.files.length === 0) {
        return [];
      }

      return saveAttachments(workspace, result.files);
    } catch {
      // requestUpload failed — fall through to Strategy B
    }
  }

  // Strategy B: Send message + wait for reply with attachments
  if (typeof api.waitForMessage === 'function') {
    try {
      api.sendMessage(
        '**Attach reference files** (papers, datasets, notes) or reply **"no"** to skip. ' +
        `Timeout: ${Math.round(timeoutMs / 1000)}s.`,
      );

      const reply = await api.waitForMessage({ timeoutMs });

      // User said no / skip
      const text = reply.text.trim().toLowerCase();
      if (text === 'no' || text === 'skip' || text === 'n' || text === 'none') {
        return [];
      }

      // Check for attachments
      if (reply.attachments && reply.attachments.length > 0) {
        return saveAttachments(workspace, reply.attachments);
      }

      // User replied with text but no attachments — might be a misunderstanding
      if (text) {
        api.sendMessage('No files detected. Proceeding without attachments.');
      }

      return [];
    } catch {
      // waitForMessage timed out or failed — proceed without uploads
      api.sendMessage('Upload timeout. Proceeding without reference files.');
      return [];
    }
  }

  // Strategy C: No upload API available — skip silently
  return [];
}

/**
 * Save file attachments to the workspace uploads directory.
 * Handles three attachment formats: local path, raw buffer, remote URL.
 */
async function saveAttachments(
  workspace: RunWorkspace,
  attachments: FileAttachment[],
): Promise<string[]> {
  const savedPaths: string[] = [];

  for (const attachment of attachments) {
    try {
      // Priority 1: Local filesystem path
      if (attachment.path && existsSync(attachment.path)) {
        const copied = copyFilesToUploads(workspace, [attachment.path]);
        savedPaths.push(...copied);
        continue;
      }

      // Priority 2: Raw buffer data
      if (attachment.data) {
        const saved = saveUploadData(
          workspace,
          attachment.filename || 'upload',
          attachment.data,
        );
        savedPaths.push(saved);
        continue;
      }

      // Priority 3: Remote URL — download
      if (attachment.url) {
        const data = await downloadFile(attachment.url);
        if (data) {
          const saved = saveUploadData(
            workspace,
            attachment.filename || urlToFilename(attachment.url),
            data,
          );
          savedPaths.push(saved);
        }
        continue;
      }
    } catch {
      // Skip individual attachment failures — don't block the run
    }
  }

  return savedPaths;
}

/**
 * Download a file from a URL. Returns null on failure.
 */
function downloadFile(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const request = client.get(url, { timeout: 30000 }, (res) => {
      // Follow redirects (one level)
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location).then(resolve);
        return;
      }

      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', () => resolve(null));
    });

    request.on('error', () => resolve(null));
    request.on('timeout', () => {
      request.destroy();
      resolve(null);
    });
  });
}

/**
 * Extract a reasonable filename from a URL.
 */
function urlToFilename(url: string): string {
  try {
    const parsed = new URL(url);
    const basename = path.basename(parsed.pathname);
    return basename || 'download';
  } catch {
    return 'download';
  }
}

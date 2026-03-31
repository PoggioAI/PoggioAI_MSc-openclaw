/**
 * Plugin configuration schema — mirrors openclaw.plugin.json config.schema.
 * Users configure these in ~/.openclaw/openclaw.json under plugins.poggioai-msc.
 */
export interface PluginConfig {
  /** Path to existing consortium installation. Empty = auto-install. */
  consortiumPath: string;
  /** Conda environment name for the Python backend. */
  condaEnvName: string;
  /** Default quality preset when no flags given. */
  defaultPreset: 'max-quality' | 'fast';
  /** Deployment mode. */
  defaultMode: 'local' | 'tinker' | 'hpc';
  /** Default LLM model. */
  defaultModel: string;
  /** Default budget cap in USD per run. */
  defaultBudgetUsd: number;
  /** How often to poll pipeline progress (ms). */
  progressPollIntervalMs: number;
  /** Base port for consortium callback server. Steering = port + 1. */
  steeringBasePort: number;
  /** Timeout in ms for the file upload prompt (0 = skip). */
  uploadTimeoutMs: number;
  /** Agent timeout in ms. Set high (2700000 = 45 min) for multi-pass phases. */
  agentTimeoutMs: number;
}

export const DEFAULT_CONFIG: PluginConfig = {
  consortiumPath: '',
  condaEnvName: 'poggioai-msc',
  defaultPreset: 'max-quality',
  defaultMode: 'local',
  defaultModel: 'claude-opus-4-6',
  defaultBudgetUsd: 300,
  progressPollIntervalMs: 15000,
  steeringBasePort: 5001,
  uploadTimeoutMs: 60000,
  agentTimeoutMs: 2700000,
};

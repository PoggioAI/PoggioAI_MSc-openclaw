/**
 * Types for the consortium HTTP steering API.
 *
 * API runs at http://127.0.0.1:{callback_port + 1}
 * Endpoints:
 *   POST /interrupt        — pause the pipeline
 *   POST /instruction      — inject a steering instruction
 *   GET  /status           — check pause/queue state
 *   GET  /milestone        — get current milestone state
 *   POST /milestone_response — respond to human-in-the-loop gate
 *   GET  /budget           — get campaign budget status
 */

/** POST /instruction request body. */
export interface SteeringInstruction {
  /** Instruction text. */
  text: string;
  /** Type: 'm' = modify, 'n' = note. */
  type: 'm' | 'n';
}

/** GET /status response. */
export interface SteeringStatus {
  paused: boolean;
  queue_depth: number;
}

/** POST /milestone_response request body. */
export interface MilestoneResponse {
  action: 'approve' | 'modify' | 'abort';
  feedback?: string;
}

/** Review verdict as written by reviewer_agent to review_verdict.json. */
export interface ReviewVerdict {
  score: number;
  hard_blockers: string[];
  ai_voice_risk: 'HIGH' | 'MEDIUM' | 'LOW';
  fix_type: 'editorial' | 'structural' | 'fundamental';
  summary: string;
  recommendations: string[];
}

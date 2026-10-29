// src/agents/types.ts

/**
 * The four possible next-step recommendations.
 * Ordered from least to most serious.
 */
export type NextStep = 'rest' | 'hydrate' | 'see_professional' | 'urgent';

/**
 * Represents one event in the agent execution trace.
 * This lets users (and testers) see exactly what happened inside.
 */
export interface TraceEvent {
  agent: string;        // Which agent created this event
  action: string;       // What it did (e.g., "matched_symptom", "checked_urgency")
  detail: string;       // Human-readable explanation
  timestamp: number;    // When it happened (Date.now())
}

/**
 * Information returned by the lookup_info tool for one symptom.
 */
export interface SymptomInfo {
  symptom: string;            // Canonical name (e.g., "fever")
  matchedTopics: string[];    // Knowledge base topics that matched
  information: string;        // General information text
  coverage: 'covered' | 'partial' | 'not_covered';  // How well we know this symptom
  references: string[];       // Source labels (e.g., "Demo Knowledge Base")
}

/**
 * Result from the suggest_next_step tool.
 */
export interface NextStepResult {
  recommendation: NextStep;
  reasons: string[];       // Why this recommendation was chosen
  symptom: string;         // Which symptom this is for
}

/**
 * An urgent warning sign that was detected.
 */
export interface UrgentSign {
  sign: string;          // Name of the warning sign
  rule: string;          // Which rule triggered it
  explanation: string;   // Why this is concerning
}

/**
 * The shared context that flows through all five agents.
 * Each agent reads what it needs and writes its output here.
 */
export interface Ctx {
  // --- Input ---
  currentMessage: string;           // What the user just typed
  previousMessages: string[];       // Previous messages in this session

  // --- ExtractorAgent output ---
  extractedSymptoms: string[];      // Canonical symptom names found
  duration: string | null;          // E.g., "2 days", "1 week", or null
  originalMessage: string;          // Preserved original text

  // --- TriageAgent output ---
  urgentFlag: boolean;              // Is this potentially urgent?
  urgentSigns: UrgentSign[];        // Which warning signs were found
  triageExplanation: string;        // Why the triage decision was made

  // --- ResearchAgent output ---
  retrievedInfo: SymptomInfo[];     // Information for each symptom

  // --- PlannerAgent output ---
  nextStep: NextStep;               // Final recommendation
  decisionReasons: string[];        // Why this step was chosen

  // --- SafetyAgent output ---
  disclaimer: string;               // The mandatory disclaimer text
  safetyApproved: boolean;          // Did the safety check pass?

  // --- Orchestrator metadata ---
  trace: TraceEvent[];              // Full execution log
}

/**
 * Creates a fresh, empty context for a new message.
 * This is a "factory function" — it creates a new object every time.
 *
 * WHY a function instead of a constant?
 * If we used `const emptyCtx = { ... }`, every call would share
 * the SAME arrays. Pushing to one would affect all. A function
 * creates fresh arrays each time.
 */
export function createEmptyCtx(
  currentMessage: string,
  previousMessages: string[] = []
): Ctx {
  return {
    currentMessage,
    previousMessages: [...previousMessages],  // Spread to copy the array
    extractedSymptoms: [],
    duration: null,
    originalMessage: currentMessage,
    urgentFlag: false,
    urgentSigns: [],
    triageExplanation: '',
    retrievedInfo: [],
    nextStep: 'see_professional',  // Default to conservative
    decisionReasons: [],
    disclaimer: '',
    safetyApproved: false,
    trace: [],
  };
}

/**
 * Interface that every agent must implement.
 * This is a TypeScript "contract" — any agent class MUST have a `run` method.
 *
 * WHY an interface?
 * It guarantees all agents look the same to the orchestrator.
 * The orchestrator doesn't care HOW each agent works internally,
 * just that it can call agent.run(ctx) and get back a modified ctx.
 */
export interface Agent {
  name: string;
  run(ctx: Ctx): Ctx;  // Takes context, returns modified context
}
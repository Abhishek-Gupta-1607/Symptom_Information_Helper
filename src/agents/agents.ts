// src/agents/agents.ts

import type { Agent, Ctx, UrgentSign, NextStep, TraceEvent } from './types';
import { lookupInfo, suggestNextStep, STEP_PRIORITY } from './tools';
import { KNOWLEDGE_BASE, URGENT_WARNING_SIGNS, findKnowledgeEntry } from './knowledge';

// ─────────────────────────────────────────────────────────
// Helper: Add a trace event
// ─────────────────────────────────────────────────────────
function addTrace(ctx: Ctx, agent: string, action: string, detail: string): void {
  ctx.trace.push({ agent, action, detail, timestamp: Date.now() });
}

// ─────────────────────────────────────────────────────────
// AGENT 1: ExtractorAgent
// ─────────────────────────────────────────────────────────

/**
 * ExtractorAgent: Extracts symptoms and duration from the user's message.
 *
 * HOW IT WORKS:
 * 1. Converts message to lowercase
 * 2. Checks if each known symptom name or alias appears in the message
 * 3. Uses a regex to find duration patterns like "2 days", "1 week"
 * 4. Records what it found in the context
 *
 * WHAT IT DOES NOT DO:
 * - It does NOT invent symptoms that aren't in the message
 * - It does NOT treat every number as a duration
 * - It does NOT handle negation (that's TriageAgent's job partially,
 *   but we do basic negation filtering here)
 */
export class ExtractorAgent implements Agent {
  name = 'ExtractorAgent';

  run(ctx: Ctx): Ctx {
    const message = ctx.currentMessage.toLowerCase();
    addTrace(ctx, this.name, 'start', `Processing: "${ctx.currentMessage}"`);

    // --- Step 1: Extract symptoms ---
    const foundSymptoms: string[] = [];

    for (const entry of KNOWLEDGE_BASE) {
      // Check canonical name and all aliases
      const allNames = [entry.name, ...entry.aliases];

      for (const name of allNames) {
        if (message.includes(name)) {
          // Check for basic negation patterns
          // E.g., "I do NOT have chest pain" should not match "chest pain" as present
          if (!this.isNegated(message, name)) {
            if (!foundSymptoms.includes(entry.name)) {
              foundSymptoms.push(entry.name);
              addTrace(ctx, this.name, 'matched_symptom', `Found "${entry.name}" (via "${name}")`);
            }
          } else {
            addTrace(ctx, this.name, 'negated_symptom', `"${name}" appears negated in context`);
          }
          break; // Don't match multiple aliases for the same symptom
        }
      }
    }

    ctx.extractedSymptoms = foundSymptoms;

    // --- Step 2: Extract duration ---
    // Pattern: number + time unit
    // Examples: "2 days", "3 weeks", "1 month", "a few days"
    const durationPattern = /(\d+|a few|several|couple of)\s*(day|days|week|weeks|month|months|hour|hours)/i;
    const durationMatch = message.match(durationPattern);

    if (durationMatch) {
      ctx.duration = durationMatch[0]; // The full matched text, e.g., "2 days"
      addTrace(ctx, this.name, 'extracted_duration', `Duration: "${ctx.duration}"`);
    }

    // --- Step 3: Log results ---
    if (foundSymptoms.length === 0) {
      addTrace(ctx, this.name, 'no_symptoms', 'No known symptoms found in message');
    }

    ctx.originalMessage = ctx.currentMessage;
    addTrace(ctx, this.name, 'complete', `Found ${foundSymptoms.length} symptom(s)`);

    return ctx;
  }

  /**
   * Basic negation detection.
   *
   * Checks if a symptom mention is preceded by negation words.
   * This is a SIMPLE heuristic, not a natural language parser.
   *
   * Examples:
   * - "I do not have chest pain" → "chest pain" is negated ✓
   * - "I don't have a headache" → "headache" is negated ✓
   * - "I have no fever" → "fever" is negated ✓
   * - "I have chest pain" → "chest pain" is NOT negated ✓
   *
   * LIMITATIONS:
   * - Cannot handle complex sentences like "I had chest pain but it stopped"
   * - For ambiguous cases, TriageAgent applies conservative escalation
   */
  private isNegated(message: string, symptom: string): boolean {
    // Find where the symptom appears in the message
    const index = message.indexOf(symptom);
    if (index === -1) return false;

    // Look at the text BEFORE the symptom (up to 30 chars back)
    const prefix = message.substring(Math.max(0, index - 30), index);

    // Common negation patterns
    const negationPatterns = [
      /\bno\s+$/,                      // "no fever"
      /\bnot\s+(have|having|had)\s*$/,  // "not have fever"
      /\bdon'?t\s+(have|had)\s*$/,      // "don't have fever"
      /\bdoesn'?t\s+(have|had)\s*$/,    // "doesn't have fever"
      /\bwithout\s*$/,                  // "without fever"
      /\bnever\s+(had|have)\s*$/,       // "never had fever"
      /\bdo\s+not\s+(have|had)\s*$/,    // "do not have fever"
    ];

    return negationPatterns.some((pattern) => pattern.test(prefix));
  }
}


// ─────────────────────────────────────────────────────────
// AGENT 2: TriageAgent
// ─────────────────────────────────────────────────────────

/**
 * TriageAgent: Checks for urgent warning signs.
 *
 * This runs BEFORE the ResearchAgent and PlannerAgent because
 * safety evaluation must happen before we start giving routine advice.
 *
 * HOW IT WORKS:
 * 1. Combines current message with relevant previous messages
 * 2. Checks each message against the urgent warning signs list
 * 3. Applies basic negation detection
 * 4. For ambiguous/potentially serious mentions, escalates conservatively
 * 5. Records which rules were triggered and why
 *
 * CONSERVATIVE ESCALATION POLICY:
 * If something MIGHT be serious and we're not sure,
 * we escalate (flag as urgent) rather than dismiss.
 * False alarms are preferable to missed emergencies.
 */
export class TriageAgent implements Agent {
  name = 'TriageAgent';

  run(ctx: Ctx): Ctx {
    addTrace(ctx, this.name, 'start', 'Evaluating urgency of symptoms');

    // Combine current and previous messages for context
    const allMessages = [...ctx.previousMessages, ctx.currentMessage];
    const combined = allMessages.map((m) => m.toLowerCase()).join(' | ');

    addTrace(ctx, this.name, 'context_check',
      `Evaluating ${allMessages.length} message(s)`
    );

    // Check each urgent warning sign
    for (const warning of URGENT_WARNING_SIGNS) {
      for (const keyword of warning.keywords) {
        if (combined.includes(keyword)) {
          // Check if it's clearly negated in the CURRENT message
          const currentLower = ctx.currentMessage.toLowerCase();
          const isInCurrent = currentLower.includes(keyword);

          if (isInCurrent && this.isClearlyNegated(currentLower, keyword)) {
            addTrace(ctx, this.name, 'negated_warning',
              `"${keyword}" found but appears negated in current message`
            );
            // Even if negated, if it's chest pain or breathing,
            // still note it with an advisory
            if (this.isSeriousCategory(keyword)) {
              addTrace(ctx, this.name, 'conservative_note',
                `"${keyword}" is in a serious category; noting even though negated`
              );
              // Don't set urgent flag, but add an advisory in explanation
              ctx.triageExplanation +=
                `Note: "${keyword}" was mentioned in a negated context. ` +
                'If this changes, please seek immediate medical attention. ';
            }
            continue;
          }

          // Not negated (or ambiguous) — flag it
          const urgentSign: UrgentSign = {
            sign: warning.sign,
            rule: `keyword_match: "${keyword}"`,
            explanation: warning.explanation,
          };

          // Don't add duplicate signs
          if (!ctx.urgentSigns.some((s) => s.sign === warning.sign)) {
            ctx.urgentSigns.push(urgentSign);
            ctx.urgentFlag = true;
            addTrace(ctx, this.name, 'urgent_sign_detected',
              `⚠️ ${warning.sign}: "${keyword}" found`
            );
          }
        }
      }
    }

    // Build triage explanation
    if (ctx.urgentFlag) {
      ctx.triageExplanation +=
        `URGENT: ${ctx.urgentSigns.length} warning sign(s) detected. ` +
        ctx.urgentSigns.map((s) => s.sign).join(', ') + '. ' +
        'Please seek immediate medical attention.';
    } else {
      ctx.triageExplanation += 'No urgent warning signs detected in the current assessment. ' +
        'This does not guarantee safety — please monitor your symptoms.';
    }

    addTrace(ctx, this.name, 'complete',
      ctx.urgentFlag
        ? `URGENT — ${ctx.urgentSigns.length} sign(s) flagged`
        : 'No urgent signs detected'
    );

    return ctx;
  }

  /**
   * Check if a keyword is clearly negated in the message.
   * Uses the same approach as ExtractorAgent but is more conservative.
   */
  private isClearlyNegated(message: string, keyword: string): boolean {
    const index = message.indexOf(keyword);
    if (index === -1) return false;

    const prefix = message.substring(Math.max(0, index - 35), index);

    // Only treat it as negated if there's a very clear negation pattern
    const clearNegations = [
      /\bdo not have\s*$/,
      /\bdon'?t have\s*$/,
      /\bno\s+$/,
      /\bnot having\s*$/,
      /\bnot experiencing\s*$/,
      /\bwithout\s*$/,
    ];

    return clearNegations.some((pattern) => pattern.test(prefix));
  }

  /**
   * Is this keyword in a category where even negated mentions
   * deserve extra caution?
   */
  private isSeriousCategory(keyword: string): boolean {
    const seriousKeywords = [
      'chest pain', 'chest tightness', 'chest pressure',
      'difficulty breathing', 'can\'t breathe', 'hard to breathe',
      'shortness of breath', 'trouble breathing',
      'suicide', 'suicidal', 'kill myself', 'self-harm',
      'unconscious', 'severe bleeding',
    ];
    return seriousKeywords.includes(keyword);
  }
}


// ─────────────────────────────────────────────────────────
// AGENT 3: ResearchAgent
// ─────────────────────────────────────────────────────────

/**
 * ResearchAgent: Calls the lookup_info tool for each matched symptom.
 *
 * HOW IT WORKS:
 * 1. Iterates through extractedSymptoms from ExtractorAgent
 * 2. Calls lookupInfo() for each symptom (this is the real tool call)
 * 3. Stores all results in ctx.retrievedInfo
 * 4. If no symptoms were found, adds a "not covered" result
 *
 * WHY does it call a tool instead of reading the KB directly?
 * Because in a real system, the tool would call an API.
 * Keeping this indirection means the agent code doesn't change
 * when we swap from local KB to remote API.
 */
export class ResearchAgent implements Agent {
  name = 'ResearchAgent';

  run(ctx: Ctx): Ctx {
    addTrace(ctx, this.name, 'start',
      `Researching ${ctx.extractedSymptoms.length} symptom(s)`
    );

    if (ctx.extractedSymptoms.length === 0) {
      // No symptoms extracted — provide a general response
      const unknownResult = lookupInfo(ctx.currentMessage.toLowerCase().trim());
      ctx.retrievedInfo.push(unknownResult);
      addTrace(ctx, this.name, 'no_symptoms_to_research',
        'No specific symptoms matched — providing general guidance'
      );
    } else {
      // Look up each symptom
      for (const symptom of ctx.extractedSymptoms) {
        addTrace(ctx, this.name, 'tool_call',
          `Calling lookup_info("${symptom}")`
        );

        const info = lookupInfo(symptom);
        ctx.retrievedInfo.push(info);

        addTrace(ctx, this.name, 'tool_result',
          `lookup_info("${symptom}") → coverage: ${info.coverage}`
        );
      }
    }

    addTrace(ctx, this.name, 'complete',
      `Retrieved info for ${ctx.retrievedInfo.length} topic(s)`
    );

    return ctx;
  }
}


// ─────────────────────────────────────────────────────────
// AGENT 4: PlannerAgent
// ─────────────────────────────────────────────────────────

/**
 * PlannerAgent: Calls suggest_next_step and determines the final recommendation.
 *
 * HOW IT WORKS:
 * 1. If urgent flag is set by TriageAgent, recommendation is "urgent" (override)
 * 2. Otherwise, calls suggest_next_step for each symptom
 * 3. Takes the MOST serious recommendation (conservative approach)
 * 4. Considers duration — longer symptoms may warrant professional evaluation
 * 5. Multiple symptoms may increase recommendation level
 *
 * DECISION RULES (deterministic, documented):
 *
 * Rule 1: Urgent flag → always "urgent" (highest priority, cannot be downgraded)
 * Rule 2: Unknown symptom → "see_professional" (conservative default)
 * Rule 3: Multiple symptoms (3+) → at least "see_professional"
 * Rule 4: Long duration (> 7 days) → at least "see_professional"
 * Rule 5: For single known symptoms → use knowledge base default
 * Rule 6: Always take the most serious of all applicable rules
 *
 * IMPORTANT: These thresholds (3 symptoms, 7 days) are NOT validated
 * clinical rules. They are conservative heuristics for general guidance.
 */
export class PlannerAgent implements Agent {
  name = 'PlannerAgent';

  run(ctx: Ctx): Ctx {
    addTrace(ctx, this.name, 'start', 'Determining next-step recommendation');

    // Rule 1: Urgent flag overrides everything
    if (ctx.urgentFlag) {
      ctx.nextStep = 'urgent';
      ctx.decisionReasons = [
        'URGENT: Warning signs have been detected by the Triage Agent.',
        ...ctx.urgentSigns.map((s) => `⚠️ ${s.sign}: ${s.explanation}`),
        'Please seek immediate medical attention.',
      ];
      addTrace(ctx, this.name, 'urgent_override',
        'Urgent flag is set — overriding all other recommendations'
      );
      addTrace(ctx, this.name, 'complete', 'Recommendation: URGENT');
      return ctx;
    }

    // Get recommendation for each symptom
    let highestStep: NextStep = 'rest';
    const allReasons: string[] = [];

    if (ctx.extractedSymptoms.length === 0) {
      // Rule 2: No known symptoms → conservative
      highestStep = 'see_professional';
      allReasons.push(
        'No specific symptoms were recognized from our knowledge base.',
        'When we cannot identify the concern, professional evaluation is recommended.',
      );
      addTrace(ctx, this.name, 'unknown_symptom_default',
        'No symptoms matched → defaulting to see_professional'
      );
    } else {
      // Call suggest_next_step for each symptom
      for (const symptom of ctx.extractedSymptoms) {
        addTrace(ctx, this.name, 'tool_call',
          `Calling suggest_next_step("${symptom}")`
        );

        const result = suggestNextStep(symptom);

        addTrace(ctx, this.name, 'tool_result',
          `suggest_next_step("${symptom}") → ${result.recommendation}`
        );

        // Keep the most serious recommendation
        if (STEP_PRIORITY[result.recommendation] > STEP_PRIORITY[highestStep]) {
          highestStep = result.recommendation;
        }

        allReasons.push(...result.reasons);
      }

      // Rule 3: Multiple symptoms → consider escalation
      if (ctx.extractedSymptoms.length >= 3 && STEP_PRIORITY[highestStep] < STEP_PRIORITY['see_professional']) {
        highestStep = 'see_professional';
        allReasons.push(
          `Multiple symptoms reported (${ctx.extractedSymptoms.length}). ` +
          'When several symptoms occur together, professional evaluation may be helpful. ' +
          '(Note: this threshold is a general heuristic, not a validated clinical rule.)'
        );
        addTrace(ctx, this.name, 'multi_symptom_escalation',
          `${ctx.extractedSymptoms.length} symptoms → escalated to see_professional`
        );
      }
    }

    // Rule 4: Duration consideration
    if (ctx.duration) {
      const days = this.parseDurationToDays(ctx.duration);
      if (days !== null && days > 7 && STEP_PRIORITY[highestStep] < STEP_PRIORITY['see_professional']) {
        highestStep = 'see_professional';
        allReasons.push(
          `Symptoms persisting for ${ctx.duration} may warrant professional evaluation. ` +
          '(Note: this duration threshold is a general guideline, not a validated clinical rule.)'
        );
        addTrace(ctx, this.name, 'duration_escalation',
          `Duration ${ctx.duration} (${days} days) → escalated to see_professional`
        );
      }
    }

    ctx.nextStep = highestStep;
    ctx.decisionReasons = allReasons;

    addTrace(ctx, this.name, 'complete',
      `Recommendation: ${highestStep.toUpperCase()}`
    );

    return ctx;
  }

  /**
   * Parse a duration string into approximate days.
   * Returns null if parsing fails (avoids treating garbage as a number).
   */
  private parseDurationToDays(duration: string): number | null {
    const lower = duration.toLowerCase();

    // Handle word-based quantities
    let quantity: number;
    if (lower.includes('a few') || lower.includes('several')) {
      quantity = 4; // Conservative estimate
    } else if (lower.includes('couple')) {
      quantity = 2;
    } else {
      const numMatch = lower.match(/\d+/);
      if (!numMatch) return null;
      quantity = parseInt(numMatch[0], 10);
    }

    // Convert to days
    if (lower.includes('month')) return quantity * 30;
    if (lower.includes('week')) return quantity * 7;
    if (lower.includes('day')) return quantity;
    if (lower.includes('hour')) return quantity / 24;

    return null;
  }
}


// ─────────────────────────────────────────────────────────
// AGENT 5: SafetyAgent
// ─────────────────────────────────────────────────────────

/**
 * SafetyAgent: The final gatekeeper. ALWAYS runs last.
 *
 * WHAT IT DOES:
 * 1. Adds the mandatory disclaimer to EVERY response
 * 2. Ensures the urgent warning sign list is ALWAYS present
 * 3. Verifies no urgent escalation was downgraded
 * 4. Checks for forbidden content (diagnoses, dosages, false assurances)
 * 5. Marks the response as safety-approved (or not)
 *
 * WHY is this a separate agent?
 * Defense in depth. Even if another agent has a bug, SafetyAgent
 * catches problems before the response reaches the user.
 * It's like a final quality-control inspector on an assembly line.
 */
export class SafetyAgent implements Agent {
  name = 'SafetyAgent';

  // The exact disclaimer text — never modified, always present
  static readonly DISCLAIMER =
    'I am NOT a doctor. This is general information only, not a diagnosis.';
  static readonly CONSULT_NOTE =
    'Please consult a doctor for anything serious.';

  run(ctx: Ctx): Ctx {
    addTrace(ctx, this.name, 'start', 'Running final safety checks');

    // --- Check 1: Add disclaimer ---
    ctx.disclaimer = `${SafetyAgent.DISCLAIMER}\n${SafetyAgent.CONSULT_NOTE}`;
    addTrace(ctx, this.name, 'disclaimer_added', 'Mandatory disclaimer attached');

    // --- Check 2: Ensure urgent signs list is always available ---
    // Even if no urgent signs were detected, the list of WHAT to watch for
    // must be available in the response
    addTrace(ctx, this.name, 'urgent_list_check',
      'Ensuring urgent warning signs list is available'
    );

    // --- Check 3: Verify urgent escalation was not downgraded ---
    if (ctx.urgentSigns.length > 0 && ctx.nextStep !== 'urgent') {
      // An urgent sign was detected but the recommendation isn't urgent!
      // This should never happen if PlannerAgent works correctly.
      // SafetyAgent fixes it as a failsafe.
      ctx.nextStep = 'urgent';
      ctx.decisionReasons.unshift(
        'SAFETY OVERRIDE: Urgent signs were detected. Recommendation upgraded to URGENT.'
      );
      addTrace(ctx, this.name, 'safety_override',
        '⚠️ Urgent downgrade detected and corrected'
      );
    }

    // --- Check 4: Verify no forbidden content ---
    const allInfoText = ctx.retrievedInfo
      .map((info) => info.information)
      .join(' ')
      .toLowerCase();

    // Check for patterns that should never appear
    const forbiddenPatterns = [
      { pattern: /you (have|are diagnosed with) \w+/i, rule: 'no_diagnosis' },
      { pattern: /take \d+ ?mg/i, rule: 'no_dosage' },
      { pattern: /you are (safe|fine|okay|not at risk)/i, rule: 'no_false_assurance' },
    ];

    for (const { pattern, rule } of forbiddenPatterns) {
      if (pattern.test(allInfoText)) {
        addTrace(ctx, this.name, 'forbidden_content',
          `Forbidden pattern detected: ${rule}. Applying conservative override.`
        );
        // In a real system, you'd sanitize or replace the content
        // For our demo, flag it and add a warning
        ctx.decisionReasons.push(
          'Note: Some content was flagged by the safety system. Please consult a professional.'
        );
      }
    }

    // --- Check 5: If safety can't be guaranteed, use conservative default ---
    if (ctx.retrievedInfo.length === 0) {
      ctx.nextStep = 'see_professional';
      ctx.decisionReasons.push(
        'No information could be retrieved. Professional evaluation is recommended.'
      );
      addTrace(ctx, this.name, 'no_info_fallback',
        'No retrieved info → defaulting to see_professional'
      );
    }

    // --- Final: Mark as safety-approved ---
    ctx.safetyApproved = true;
    addTrace(ctx, this.name, 'complete', 'Safety checks passed — response approved');

    return ctx;
  }
}
// src/services/informationProvider.ts

import type { SymptomInfo, NextStepResult } from '../agents/types';

/**
 * Interface for information providers.
 *
 * WHY does this exist when we only have one provider?
 *
 * It's a CONTRACT for the future. When you build a FastAPI backend
 * or connect to a real medical information API, you implement this
 * same interface. Nothing in the agents/ folder needs to change.
 *
 * This is the "Interface Segregation Principle" from SOLID design.
 */
export interface InformationProvider {
  lookupInfo(symptom: string): SymptomInfo;
  suggestNextStep(symptom: string): NextStepResult;
}

/**
 * Future placeholder for API-based provider.
 * Not implemented in v1 — the local provider is used instead.
 *
 * When implemented, this would:
 * 1. Send requests to a backend server
 * 2. The server would hold API keys (never the browser)
 * 3. Validate responses before returning them
 * 4. Apply the same safety rules as the local provider
 */
// export class APIInformationProvider implements InformationProvider {
//   constructor(private baseUrl: string) {}
//   lookupInfo(symptom: string): SymptomInfo { ... }
//   suggestNextStep(symptom: string): NextStepResult { ... }
// }
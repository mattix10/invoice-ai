import type { CopilotAnswer } from '../../../core/api/schema';
import type { EvidenceDestination } from './evidence-resolver';

export interface ConversationTurn {
  id: number;
  question: string;
  answer: CopilotAnswer | null;
  sources: readonly EvidenceDestination[];
  error: string;
  state: 'loading' | 'ready' | 'error';
}

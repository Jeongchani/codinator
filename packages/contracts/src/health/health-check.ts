import type { FeedbackTagCode } from '../common/enums';

export interface HealthCheckResponse {
  status: 'ok';
  service: 'api';
  timestamp: string;
  testSharedTag: FeedbackTagCode;
}
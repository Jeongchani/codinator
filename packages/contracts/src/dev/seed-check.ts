import type { Id } from '../common/id';

export interface SeedCheckRequest {
  email: string;
}

export interface SeedCheckResponse {
  found: boolean;
  user: {
    id: Id;
    email: string;
    nickname?: string | null;
    createdAt: string;
  } | null;
}

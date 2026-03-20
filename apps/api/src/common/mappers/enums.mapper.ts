import { PostStatus as ContractPostStatus } from '@codinator/contracts';
import { $Enums } from '@prisma/client';

export const mapPostStatus = (status: $Enums.PostStatus): ContractPostStatus =>
  status as ContractPostStatus;

export const mapGarmentCategory = (c: $Enums.GarmentCategory) =>
  c as import('@codinator/contracts').GarmentCategory;

export const mapEvaluationStatus = (s: $Enums.EvaluationStatus) =>
  s as import('@codinator/contracts').EvaluationStatus;

export const mapVoteChoice = (v: $Enums.VoteChoice) =>
  v as import('@codinator/contracts').VoteChoice;

export const mapRankingPeriod = (p: $Enums.RankingPeriod) =>
  p as import('@codinator/contracts').RankingPeriod;
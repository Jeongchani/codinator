import {
  GarmentCategory as ContractGarmentCategory,
  EvaluationStatus as ContractEvaluationStatus,
  VoteChoice as ContractVoteChoice,
  FeedbackTagPolarity as ContractFeedbackTagPolarity,
} from '@codinator/contracts';
import { $Enums } from '@prisma/client';

export function mapGarmentCategory(category: $Enums.GarmentCategory): ContractGarmentCategory {
  return category as ContractGarmentCategory;
}

export function mapEvaluationStatus(status: $Enums.EvaluationStatus): ContractEvaluationStatus {
  return status as ContractEvaluationStatus;
}

export function mapVoteChoice(choice: $Enums.VoteChoice): ContractVoteChoice {
  return choice as ContractVoteChoice;
}

export function mapFeedbackTagPolarity(polarity: $Enums.FeedbackTagPolarity): ContractFeedbackTagPolarity {
  return polarity as ContractFeedbackTagPolarity;
}




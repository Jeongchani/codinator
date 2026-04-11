import type { RankingPeriod } from "@codinator/contracts";
import { RankingDetailSheetContent } from "../../components/postdetail/PostDetailBottomSheet";

type Props = {
  postId?: number | null;
  period?: RankingPeriod;
  hideFeedLink?: boolean;
};

export default function RankingDetail({ postId, period, hideFeedLink = false }: Props) {
  return (
    <RankingDetailSheetContent
      postId={postId}
      period={period}
      hideFeedLink={hideFeedLink}
    />
  );
}

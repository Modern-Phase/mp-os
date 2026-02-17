import { Doc } from "~/convex/_generated/dataModel";
import { PlanKey } from "~/convex/schema";

export type User = Doc<"users"> & {
  avatarUrl?: string;
  memberships?: Doc<"memberships">[];
  subscription?: Doc<"subscriptions"> & {
    planKey: PlanKey;
  };
};

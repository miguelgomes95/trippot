import "server-only";
import { tables } from "@/db";
import { formatMoney } from "../money";
import { logAction } from "./actions";
import { runAgent } from "./run";

type Milestone = typeof tables.supplierMilestones.$inferSelect;

/**
 * Called when supplier deadlines change status after money comes in. Funded ones are handed
 * to the agent to pay (the guardrails in payMilestone still apply); ones above the auto-pay
 * limit are flagged for the organizer instead.
 */
export async function onMilestonesChanged(tripId: string, changed: Milestone[]) {
  const needApproval = changed.filter((m) => m.status === "awaiting_approval");
  for (const m of needApproval)
    await logAction(
      tripId,
      "approval_needed",
      `${m.label} (${formatMoney(m.amountCents)}) is fully funded and waiting for your approval`,
      "Above the auto-pay limit",
      { milestoneId: m.id },
    );

  const funded = changed.filter((m) => m.status === "funded");
  if (!funded.length) return;
  const list = funded.map((m) => `- ${m.label}, ${formatMoney(m.amountCents)}, due ${m.dueDate} (id ${m.id})`).join("\n");
  await runAgent(
    tripId,
    `[Automatic trigger, not the organizer] Incoming payments just fully funded these supplier deadlines:\n${list}\n` +
      `Check the trip overview and pay the ones that are funded, giving a short reason for each. Then summarise in one sentence.`,
    [],
    "Automatic: new payments funded a supplier deadline",
  );
}

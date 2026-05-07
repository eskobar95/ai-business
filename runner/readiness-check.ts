import { requireBusinessMemoryExists } from "./queries";

/**
 * Throws a descriptive error if the business is not ready for agent execution.
 * Call this before any SDK invocation in the dispatcher.
 */
export async function assertBusinessReadyForExecution(
  businessId: string,
  localPath: string | null,
): Promise<void> {
  const hasMemory = await requireBusinessMemoryExists(businessId);
  if (!hasMemory) {
    throw new Error(
      "Business has no memory. Complete Grill-Me onboarding or add memory in workspace settings first.",
    );
  }

  if (!localPath?.trim()) {
    throw new Error("localPath is not set. Set the workspace folder path in Settings.");
  }
}

import { processAutomationEvent } from "../services/automation/automationEngine.js";

export const triggerAutomation = async ({
  module,
  event,
  record,
  recordId,
  userId,
  metadata = {},
}) => {
  try {
    return await processAutomationEvent({
      module,
      event,
      record,
      recordId,
      userId,
      metadata,
    });
  } catch (error) {
    console.error("Automation processing error:", error);

    /*
     * Automation failure should NOT break the original
     * CRM/ERP transaction.
     */

    return {
      matched: 0,
      executed: 0,
      error: error.message,
    };
  }
};
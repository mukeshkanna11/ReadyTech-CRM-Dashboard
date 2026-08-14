import Automation from "../../models/Automation.js";
import AutomationExecution from "../../models/AutomationExecution.js";
import { evaluateConditions } from "./conditionEvaluator.js";
import { executeAction } from "./actionExecutor.js";

export const processAutomationEvent = async ({
  module,
  event,
  record,
  recordId,
  userId,
  metadata = {},
}) => {
  const automations = await Automation.find({
    module,
    status: "active",
    "trigger.type": "event",
    "trigger.event": event,
  }).lean();

  if (!automations.length) {
    return {
      matched: 0,
      executed: 0,
    };
  }

  let executed = 0;

  for (const automation of automations) {
    const conditionsPassed = evaluateConditions(
      record,
      automation.conditions,
      automation.conditionLogic
    );

    if (!conditionsPassed) {
      await AutomationExecution.create({
        automation: automation._id,
        automationVersion: automation.version,
        module,
        recordId,
        trigger: {
          event,
          metadata,
        },
        status: "skipped",
        conditionsPassed: false,
        actions: automation.actions.map((action) => ({
          type: action.type,
          status: "skipped",
          message: "Conditions not satisfied",
        })),
        completedAt: new Date(),
      });

      continue;
    }

    const execution = await AutomationExecution.create({
      automation: automation._id,
      automationVersion: automation.version,
      module,
      recordId,
      trigger: {
        event,
        metadata,
      },
      status: "running",
      conditionsPassed: true,
      actions: automation.actions.map((action) => ({
        type: action.type,
        status: "pending",
      })),
    });

    let hasFailure = false;

    for (let index = 0; index < automation.actions.length; index++) {
      const action = automation.actions[index];

      const startedAt = new Date();

      try {
        const result = await executeAction({
          action,
          record,
          module,
          recordId,
          userId,
        });

        execution.actions[index].status = "success";
        execution.actions[index].message =
          result?.message || "Action completed";
        execution.actions[index].startedAt = startedAt;
        execution.actions[index].completedAt = new Date();

        await execution.save();
      } catch (error) {
        hasFailure = true;

        execution.actions[index].status = "failed";
        execution.actions[index].message = error.message;
        execution.actions[index].startedAt = startedAt;
        execution.actions[index].completedAt = new Date();

        execution.status = "failed";
        execution.error = error.message;
        execution.completedAt = new Date();

        await execution.save();

        break;
      }
    }

    if (!hasFailure) {
      execution.status = "success";
      execution.completedAt = new Date();

      await execution.save();

      await Automation.findByIdAndUpdate(automation._id, {
        $inc: {
          executionCount: 1,
          successCount: 1,
        },
        $set: {
          lastExecutedAt: new Date(),
        },
      });

      executed++;
    } else {
      await Automation.findByIdAndUpdate(automation._id, {
        $inc: {
          executionCount: 1,
          failureCount: 1,
        },
        $set: {
          lastExecutedAt: new Date(),
        },
      });
    }
  }

  return {
    matched: automations.length,
    executed,
  };
};
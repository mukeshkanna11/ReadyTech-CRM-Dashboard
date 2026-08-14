export const executeAction = async ({
  action,
  record,
  module,
  recordId,
}) => {
  switch (action.type) {
    case "updateField": {
      const { field, value } = action.config;

      if (!field) {
        throw new Error("updateField requires a field");
      }

      return {
        success: true,
        message: `Field "${field}" scheduled for update`,
        data: {
          field,
          value,
        },
      };
    }

    case "assignOwner": {
      const { userId } = action.config;

      if (!userId) {
        throw new Error("assignOwner requires userId");
      }

      return {
        success: true,
        message: `Owner assignment requested`,
        data: {
          userId,
        },
      };
    }

    case "changeStatus": {
      const { status } = action.config;

      if (!status) {
        throw new Error("changeStatus requires status");
      }

      return {
        success: true,
        message: `Status change requested`,
        data: {
          status,
        },
      };
    }

    case "changeStage": {
      const { stage } = action.config;

      if (!stage) {
        throw new Error("changeStage requires stage");
      }

      return {
        success: true,
        message: `Stage change requested`,
        data: {
          stage,
        },
      };
    }

    case "addTag": {
      const { tag } = action.config;

      if (!tag) {
        throw new Error("addTag requires tag");
      }

      return {
        success: true,
        message: `Tag "${tag}" requested`,
      };
    }

    case "removeTag": {
      const { tag } = action.config;

      if (!tag) {
        throw new Error("removeTag requires tag");
      }

      return {
        success: true,
        message: `Tag removal requested`,
      };
    }

    case "createTask": {
      const { title, dueInDays = 0 } = action.config;

      if (!title) {
        throw new Error("createTask requires title");
      }

      return {
        success: true,
        message: `Task creation requested`,
        data: {
          title,
          dueInDays,
          recordId,
          module,
        },
      };
    }

    case "sendEmail": {
      const { to, subject } = action.config;

      if (!to || !subject) {
        throw new Error("sendEmail requires to and subject");
      }

      /*
       * Later connect this to your existing Resend/email service.
       */

      return {
        success: true,
        message: `Email action queued`,
        data: {
          to,
          subject,
        },
      };
    }

    case "sendNotification": {
      const { message } = action.config;

      if (!message) {
        throw new Error("sendNotification requires message");
      }

      return {
        success: true,
        message: "Notification action executed",
      };
    }

    case "webhook": {
      const { url } = action.config;

      if (!url) {
        throw new Error("webhook requires url");
      }

      /*
       * Webhook implementation will be added
       * in the integration phase.
       */

      return {
        success: true,
        message: "Webhook action validated",
        data: {
          url,
        },
      };
    }

    default:
      throw new Error(`Unsupported action type: ${action.type}`);
  }
};
const getNestedValue = (obj, path) => {
  if (!obj || !path) return undefined;

  return path.split(".").reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, obj);
};

const evaluateCondition = (record, condition) => {
  const actualValue = getNestedValue(record, condition.field);
  const expectedValue = condition.value;

  switch (condition.operator) {
    case "equals":
      return actualValue == expectedValue;

    case "notEquals":
      return actualValue != expectedValue;

    case "contains":
      return String(actualValue ?? "")
        .toLowerCase()
        .includes(String(expectedValue ?? "").toLowerCase());

    case "notContains":
      return !String(actualValue ?? "")
        .toLowerCase()
        .includes(String(expectedValue ?? "").toLowerCase());

    case "startsWith":
      return String(actualValue ?? "")
        .toLowerCase()
        .startsWith(String(expectedValue ?? "").toLowerCase());

    case "endsWith":
      return String(actualValue ?? "")
        .toLowerCase()
        .endsWith(String(expectedValue ?? "").toLowerCase());

    case "greaterThan":
      return Number(actualValue) > Number(expectedValue);

    case "greaterThanOrEqual":
      return Number(actualValue) >= Number(expectedValue);

    case "lessThan":
      return Number(actualValue) < Number(expectedValue);

    case "lessThanOrEqual":
      return Number(actualValue) <= Number(expectedValue);

    case "exists":
      return actualValue !== undefined && actualValue !== null;

    case "notExists":
      return actualValue === undefined || actualValue === null;

    case "isTrue":
      return actualValue === true;

    case "isFalse":
      return actualValue === false;

    default:
      return false;
  }
};

export const evaluateConditions = (record, conditions = [], logic = "AND") => {
  if (!conditions.length) {
    return true;
  }

  const results = conditions.map((condition) =>
    evaluateCondition(record, condition)
  );

  return logic === "OR"
    ? results.some(Boolean)
    : results.every(Boolean);
};
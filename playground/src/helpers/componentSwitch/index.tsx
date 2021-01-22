import type * as React from "react";

export function componentSwitch<Options extends string>(
  choice: Options,
  components: Record<Options | "default", React.ReactNode | undefined>,
): React.ReactNode {
  const hasDefault = components.default !== undefined;
  const hasChoice = choice in components;

  if (hasChoice) {
    return components[choice];
  } else if (hasDefault) {
    return components.default;
  }

  return null;
}

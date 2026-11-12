import type { ProjectRef } from "./types.ts";

const login = "[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})";
const urlPattern = new RegExp(
  `^(?:https?://)?github\\.com/(?:orgs|users)/(${login})/projects/(\\d+)(?:[/?#].*)?$`,
);
const shortPattern = new RegExp(`^(${login})[/#](\\d+)$`);

const toRef = (match: RegExpMatchArray | null): ProjectRef | null => {
  const owner = match?.[1];
  const number = Number(match?.[2]);
  return owner && Number.isInteger(number) && number > 0 ? { owner, number } : null;
};

export const parseProjectRef = (input: string): ProjectRef | null => {
  const text = input.trim();
  return toRef(text.match(urlPattern)) ?? toRef(text.match(shortPattern));
};

export const formatProjectRef = (ref: ProjectRef): string => `${ref.owner}/${ref.number}`;

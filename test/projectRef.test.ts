import { describe, expect, test } from "bun:test";
import { formatProjectRef, parseProjectRef } from "../src/model/projectRef.ts";

describe("parseProjectRef", () => {
  test.each([
    ["https://github.com/orgs/acme/projects/12", { owner: "acme", number: 12 }],
    ["https://github.com/orgs/acme/projects/12/views/3?filterQuery=x", { owner: "acme", number: 12 }],
    ["https://github.com/users/octo-cat/projects/3", { owner: "octo-cat", number: 3 }],
    ["github.com/users/octo/projects/7/", { owner: "octo", number: 7 }],
    ["acme/12", { owner: "acme", number: 12 }],
    ["  acme#5 ", { owner: "acme", number: 5 }],
  ])("%s", (input, expected) => {
    expect(parseProjectRef(input)).toEqual(expected);
  });

  test.each(["", "acme", "https://github.com/acme/repo/issues/1", "acme/0", "a b/1"])(
    "rejects %p",
    (input) => {
      expect(parseProjectRef(input)).toBeNull();
    },
  );

  test("formats back to a short ref", () => {
    expect(formatProjectRef({ owner: "acme", number: 12 })).toBe("acme/12");
  });
});

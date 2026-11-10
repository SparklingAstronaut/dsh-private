import test from "node:test";
import assert from "node:assert/strict";
import { welcomeSeed, rememberWelcome } from "../app/addons/incognito/welcome-notice.mjs";

const forms = (version) => [
  { ns: "locale", value: { preference: "zh" } },
  { ns: "ui-settings-general", value: version === undefined ? {} : { welcomeNoticeVersion: version } },
];

test("private mode starts with the notice acknowledgement from the normal profile", () => {
  assert.deepEqual(welcomeSeed(forms("2026-08-13.1")), {
    "ui-settings-general": { welcomeNoticeVersion: "2026-08-13.1" },
  });
  assert.deepEqual(welcomeSeed(forms(undefined)), {});
  assert.deepEqual(welcomeSeed([]), {});
  for (const odd of ["", " 2026", "../x", "a".repeat(65), 7]) assert.deepEqual(welcomeSeed(forms(odd)), {});
});

test("an acknowledgement made in private mode is saved once to the normal profile", async () => {
  let rows = forms(undefined);
  const updates = [];
  const settings = {
    describe: () => rows,
    update: async (ns, patch) => {
      updates.push([ns, patch]);
      rows = forms(patch.welcomeNoticeVersion);
    },
  };
  assert.equal(await rememberWelcome(settings, "2026-08-13.1"), true);
  assert.equal(await rememberWelcome(settings, "2026-08-13.1"), false);
  assert.deepEqual(updates, [["ui-settings-general", { welcomeNoticeVersion: "2026-08-13.1" }]]);
  for (const odd of [undefined, "", "x y", "a".repeat(65), { toString: () => "1" }])
    await assert.rejects(rememberWelcome(settings, odd), /Invalid notice version/);
  assert.equal(updates.length, 1);
});

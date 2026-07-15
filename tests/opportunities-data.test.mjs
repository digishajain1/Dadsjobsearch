import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync(new URL("../data/opportunities.json", import.meta.url), "utf8"));

test("generated opportunities metadata keeps active/latest and age guidance", () => {
  assert.equal(data.metadata.latestWindowDays, 7);
  assert.equal(data.metadata.ageDefaultLimit, 60);
  assert.ok(typeof data.metadata.ageFriendlyCount === "number");
  assert.ok(typeof data.metadata.flaggedAgeCount === "number");
});

test("generated executive opportunities preserve direct career links and latest flags", () => {
  const equinix = data.executiveRoles.find((item) => item.id === "exec-equinix-1");
  assert.ok(equinix);
  assert.equal(equinix.careerPageUrl, "https://careers.equinix.com/jobs?q=vice+president+india&location=Mumbai");
  assert.equal(typeof equinix.isLatest, "boolean");
  assert.equal(typeof equinix.ageAgeFriendly, "boolean");
});

import assert from "node:assert/strict";
import test from "node:test";

import { csvCell, toCsv } from "../lib/csv";
import { effectiveCutoff } from "../lib/cutoff";
import { addDays, weekStart } from "../lib/dates";

test("csv cells are quoted and formulas are defused", () => {
  assert.equal(csvCell("Sarmale"), "Sarmale");
  assert.equal(csvCell('fără "smântână", te rog'), '"fără ""smântână"", te rog"');
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell(-3), "-3");
  assert.equal(csvCell(null), "");
  assert.ok(toCsv([["a", "b"], [1, 2]]).startsWith("﻿a,b\r\n1,2"));
});

test("the earlier cut-off wins", () => {
  const s = { cutoff_breakfast: "10:00", cutoff_lunch: "12:30", cutoff_dinner: null, cutoff_all: "11:00" };
  assert.equal(effectiveCutoff(s, "breakfast"), "10:00");
  assert.equal(effectiveCutoff(s, "lunch"), "11:00");
  assert.equal(effectiveCutoff(s, "dinner"), "11:00");
  assert.equal(effectiveCutoff({ ...s, cutoff_all: null }, null), null);
});

test("week arithmetic on kitchen days", () => {
  assert.equal(weekStart("2026-10-10"), "2026-10-05");
  assert.equal(weekStart("2026-10-05"), "2026-10-05");
  assert.equal(weekStart("2026-10-11"), "2026-10-05");
  assert.equal(addDays("2026-10-30", 3), "2026-11-02");
});

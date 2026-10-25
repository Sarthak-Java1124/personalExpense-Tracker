import assert from "node:assert/strict";
import { test } from "node:test";
import { toMinor } from "../src/lib/money";
import { parseWithRules } from "../src/lib/ruleParser";

const REF = "2026-10-25"; // a Sunday

function read(text: string) {
  return parseWithRules(text, REF).items.map((i) => [i.description, i.amountMinor / 100, i.category, i.date]);
}

test("splits a sentence into separate expenses with shorthand amounts", () => {
  assert.deepEqual(read("I spent 200 on lunch, 50 on chai and 1.2k on groceries. Yesterday paid uber 340 rs"), [
    ["Lunch", 200, "Food & Dining", REF],
    ["Chai", 50, "Food & Dining", REF],
    ["Groceries", 1200, "Groceries", REF],
    ["Uber", 340, "Transport", "2026-10-24"],
  ]);
});

test("handles grouping commas, lakh, currency markers and decimals", () => {
  assert.deepEqual(read("petrol 2,500; Rs. 1,00,000 rent, shoes ₹3499.50, 1.5 lakh laptop"), [
    ["Petrol", 2500, "Fuel", REF],
    ["Rent", 100000, "Rent & Housing", REF],
    ["Shoes", 3499.5, "Shopping", REF],
    ["Laptop", 150000, "Shopping", REF],
  ]);
});

test("treats quantities and times as non-amounts", () => {
  assert.deepEqual(read("2 coffees for 300, got 2 kg apples for 180 at 5 pm, lunch at 1:30 was 220"), [
    ["2 coffees", 300, "Food & Dining", REF],
    ["2 kg apples", 180, "Groceries", REF],
    ["Lunch", 220, "Food & Dining", REF],
  ]);
});

test("reads number words and keeps descriptions joined by 'and'", () => {
  assert.deepEqual(read("bread and butter 50, spent two hundred fifty on dinner"), [
    ["Bread and butter", 50, "Groceries", REF],
    ["Dinner", 250, "Food & Dining", REF],
  ]);
});

test("splits multiple amounts inside one clause", () => {
  assert.deepEqual(read("auto 60 metro 40"), [
    ["Auto", 60, "Transport", REF],
    ["Metro", 40, "Transport", REF],
  ]);
});

test("resolves weekdays, 'N days ago' and explicit dates; dates carry forward", () => {
  assert.deepEqual(read("on monday shoes 900, 3 days ago gym fees 1500; 12th oct dinner 400, cab 120"), [
    ["Shoes", 900, "Shopping", "2026-10-19"],
    ["Gym fees", 1500, "Health & Fitness", "2026-10-22"],
    ["Dinner", 400, "Food & Dining", "2026-10-12"],
    ["Cab", 120, "Transport", "2026-10-12"],
  ]);
});

test("skips income", () => {
  const r = parseWithRules("lunch 200 and received 5000 salary", REF);
  assert.equal(r.items.length, 1);
  assert.match(r.warnings[0], /income/);
});

test("money is rounded to exact minor units", () => {
  assert.equal(toMinor(1.005), 101);
  assert.equal(toMinor(0.1) + toMinor(0.2), toMinor(0.3));
  assert.equal(toMinor(3499.5), 349950);
});

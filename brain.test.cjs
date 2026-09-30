const { test } = require("node:test");
const assert = require("node:assert/strict");
const { chat } = require("../src/brain.cjs");
const base = {
  model: "test",
  history: [],
  preferences: [],
  signal: new AbortController().signal,
  onState: () => {},
};
test("no model gives setup instructions and cannot execute actions", async () => {
  await assert.rejects(
    () =>
      chat({
        ...base,
        model: "",
        text: "hello",
        execute: () => assert.fail("executed"),
      }),
    /model/i,
  );
});
test("hostile model tool cannot reach executor", async () => {
  let count = 0;
  const reply = await chat({
    ...base,
    text: "hello",
    execute: () => {
      count++;
    },
    fetcher: async () => ({
      ok: true,
      json: async () => ({
        message:
          count === 0
            ? {
                content: "",
                tool_calls: [
                  { function: { name: "exec", arguments: { command: "rm" } } },
                ],
              }
            : { content: "ok" },
      }),
    }),
  });
  assert.equal(count, 0);
  assert.match(reply, /limit|حد/i);
});
test("cancelled model response never executes pending tools", async () => {
  const ac = new AbortController();
  await assert.rejects(
    () =>
      chat({
        ...base,
        signal: ac.signal,
        text: "hello",
        execute: () => assert.fail("executed"),
        fetcher: async () => {
          ac.abort();
          return {
            ok: true,
            json: async () => ({
              message: {
                tool_calls: [
                  {
                    function: {
                      name: "open_app",
                      arguments: { app: "calculator" },
                    },
                  },
                ],
              },
            }),
          };
        },
      }),
    /abort/i,
  );
});
test("tool results fed back to model and Urdu response returned", async () => {
  let n = 0;
  let body;
  const result = await chat({
    ...base,
    text: "help",
    execute: async () => ({ ok: true, text: "opened" }),
    fetcher: async (_, opts) => {
      body = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          message:
            ++n === 1
              ? {
                  tool_calls: [
                    {
                      function: {
                        name: "open_app",
                        arguments: { app: "calculator" },
                      },
                    },
                  ],
                }
              : { content: "حسنین سر، کھول دیا ہے۔" },
        }),
      };
    },
  });
  assert.equal(result, "حسنین سر، کھول دیا ہے۔");
  assert.equal(body.messages.at(-1).role, "tool");
});

// @vitest-environment jsdom
import { expect, test } from "vitest";
import { mountApp, register } from "@knobkit/core/client";
import { button, chat, knobkit } from "../../index.js";
import type { Message, ToolCall } from "./def.js";

register("col", () => import("../layout/col.js"));
register("chat", () => import("./view.js"));
register("button", () => import("../button/view.js"));

const until = async (cond: () => boolean): Promise<void> => {
  for (let i = 0; i < 80 && !cond(); i++) await new Promise((r) => setTimeout(r, 25));
  expect(cond()).toBe(true);
};

const texts = (selector: string): string[] => [...document.querySelectorAll(selector)].map((e) => e.textContent ?? "");
const click = (root: ParentNode, label: string): void =>
  [...root.querySelectorAll("button")].find((b) => b.textContent?.trim() === label)!.click();

test("an agent's conversation: streaming by id, tool calls, a decision, queued messages and an error", async () => {
  const convo = chat();
  const next = button({ label: "next" });
  const read = button({ label: "read" });
  const decisions: { id: string; decision: string }[] = [];
  let history: Message[] = [];
  let calls: Record<string, ToolCall> = {};

  const app = knobkit({ widgets: [convo, next, read] });
  app.setup(() => {
    convo.say({ role: "user", content: "Rename the function" });
    convo.say({ id: "reply-1", role: "assistant", content: "" });
    convo.appendTo("reply-1", "Looking");
    // said after the reply began: the reply is no longer the last message
    convo.tool({ id: "call-1", name: "read", input: { path: "src/app.js" } });
    convo.appendTo("reply-1", " at the file.");
    convo.toolResult("call-1", "function old() {}");
    convo.tool({ id: "call-2", name: "edit", input: { path: "src/app.js" }, status: "awaiting" });
    convo.queue("Keep the old name exported too");
  });
  app.on(convo.decided, (d) => {
    decisions.push(d);
  });
  app.on(next.clicked, () => {
    convo.toolResult("call-2", "the user rejected this change", true);
    convo.dequeue();
    convo.say({ role: "user", content: "Keep the old name exported too" });
    convo.say({ role: "error", content: "The model call failed: 529" });
  });
  app.on(read.clicked, async () => {
    history = await convo.history();
    calls = await convo.toolCalls();
  });

  document.body.innerHTML = '<div id="root"></div>';
  mountApp(app, "#root");
  await until(() => document.querySelectorAll(".pu-chat-tool").length === 2);

  // tokens sent by id reached the reply although a tool call came after it
  expect(texts(".pu-assistant")).toEqual(["assistant: Looking at the file."]);

  const [readCard, editCard] = [...document.querySelectorAll<HTMLElement>(".pu-chat-tool")];
  expect(readCard!.dataset["status"]).toBe("done");
  expect(readCard!.querySelector(".pu-chat-tool-actions")).toBeNull();
  // a finished call is collapsed until opened
  expect(readCard!.textContent).not.toContain("function old() {}");
  readCard!.querySelector("button")!.click();
  await until(() => (readCard!.textContent ?? "").includes("function old() {}"));

  // a call that needs a decision shows what is being decided, and the two answers
  expect(editCard!.dataset["status"]).toBe("awaiting");
  expect(editCard!.textContent).toContain('"path": "src/app.js"');
  expect(texts(".pu-msg-queued")).toEqual(["Keep the old name exported tooqueued"]);

  click(editCard!, "Reject");
  await until(() => decisions.length === 1);
  expect(decisions[0]).toEqual({ id: "call-2", decision: "reject" });
  // settled at once: nothing left to press a second time
  await until(() => editCard!.querySelector(".pu-chat-tool-actions") === null);
  expect(editCard!.dataset["status"]).toBe("rejected");

  click(document, "next");
  await until(() => document.querySelector(".pu-msg-error") !== null);
  expect(editCard!.dataset["status"]).toBe("error");
  expect(texts(".pu-msg-queued")).toEqual([]);
  expect(document.querySelector(".pu-msg-error")!.getAttribute("role")).toBe("alert");
  expect(texts(".pu-user").at(-1)).toBe("user: Keep the old name exported too");

  // reads fold the streamed text into the message it belongs to
  click(document, "read");
  await until(() => history.length > 0);
  expect(history.map((m) => m.role)).toEqual(["user", "assistant", "tool", "tool", "user", "error"]);
  expect(history[1]!.content).toBe("Looking at the file.");
  expect(calls["call-1"]).toMatchObject({ name: "read", status: "done", result: "function old() {}" });
});

test("the original chat still works: say, append to the last message, clear", async () => {
  const convo = chat();
  const wipe = button({ label: "wipe" });
  const app = knobkit({ widgets: [convo, wipe] });
  app.setup(() => {
    convo.say({ role: "user", content: "hi" });
    convo.say({ role: "assistant", content: "" });
    convo.append("hel");
    convo.append("lo");
    convo.tool({ id: "c", name: "read" });
    convo.queue("later");
  });
  app.on(wipe.clicked, () => convo.clear());

  document.body.innerHTML = '<div id="root"></div>';
  mountApp(app, "#root");
  await until(() => texts(".pu-assistant")[0] === "assistant: hello");
  expect(texts(".pu-user")[0]).toBe("user: hi");

  click(document, "wipe");
  await until(() => document.querySelectorAll(".pu-msg, .pu-chat-tool").length === 0);
  expect(document.querySelector(".pu-composer input")).not.toBeNull();
});

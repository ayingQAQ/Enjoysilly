import { expect, it } from "vitest";
import { searchChatMessages } from "./chatSearch";
it("finds current swipe Chinese emoji and literal punctuation in a thousand-message history", () => {
  const messages = Array.from({ length: 1000 }, (_, i) => ({ name: "N", mes: `消息${i}`, send_date: "date" }));
  Object.assign(messages[789], { mes: "旧内容", swipes: ["旧内容", "月亮🌙 [a]"], swipe_id: 1 });
  expect(searchChatMessages(messages, "月亮🌙")).toEqual([789]);
  expect(searchChatMessages(messages, "[a]")).toEqual([789]);
  expect(searchChatMessages(messages, "旧内容")).toEqual([]);
  expect(searchChatMessages(messages, "消息999")).toEqual([999]);
  expect(searchChatMessages(messages, " ")).toHaveLength(1000);
});

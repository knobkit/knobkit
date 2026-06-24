import { knobkit, row, col, splitPane, tabs, terminal, diff, log, chat, tree, sidebar, toolbar, toast } from "knobkit";

const navSidebar = sidebar([
  {
    label: "Agents",
    items: [
      { id: "agent-1", label: "frontend-agent", badge: "Running", badgeVariant: "success" },
      { id: "agent-2", label: "backend-agent", badge: "Idle", badgeVariant: "info" }
    ]
  },
  {
    label: "Workspaces",
    items: [
      { id: "ws-1", label: "knobkit" },
      { id: "ws-2", label: "orchestrator" }
    ]
  }
]);

const fileTree = tree([
  {
    id: "src", label: "src", children: [
      { id: "index.ts", label: "index.ts" },
      { id: "app.ts", label: "app.ts" }
    ]
  },
  { id: "package.json", label: "package.json" }
]);

const fileToolbar = toolbar();
// Setup toolbar items (setItems should be called in setup or directly if available synchronously, but let's do it in setup)

const explorerPane = col(fileToolbar, fileTree);

const term = terminal();
const diffView = diff();
const agentLog = log();
const agentChat = chat();

const mainTabs = tabs([
  { label: "Terminal", content: term },
  { label: "Diff", content: diffView, badge: "1" },
  { label: "Logs", content: agentLog },
  { label: "Chat", content: agentChat }
]);

const mainArea = splitPane(explorerPane, mainTabs, { ratio: 0.2 });
const notifications = toast();

const app = knobkit({
  title: "Agent Dashboard",
  widgets: [row(navSidebar, mainArea), notifications]
});

app.setup(() => {
  fileToolbar.setItems([
    { id: "new-file", label: "New File" },
    { id: "refresh", label: "Refresh" }
  ]);

  term.writeln("\x1b[1;32mAgent session started\x1b[0m");
  term.writeln("$ Waiting for commands...");

  diffView.setFiles([
    {
      path: "src/index.ts",
      status: "modified",
      oldContent: "console.log('hello');\n",
      newContent: "console.log('hello world');\n"
    }
  ]);

  agentLog.pushStyled("Agent initialized", "info");
  agentLog.pushStyled("Watching workspace...", "debug");

  agentChat.say({ role: "assistant", content: "Hello! I am ready to help you code. What would you like to build?" });
  
  notifications.show("Dashboard loaded successfully", "success");
});

app.on(term.data, async (data) => {
  // Simple local echo for placeholder
  term.write(data === "\r" ? "\r\n" : data);
});

app.on(agentChat.sent, async ({ text }) => {
  agentChat.say({ role: "user", content: text });
  agentLog.pushStyled(`User requested: ${text}`, "info");
  
  // mock thinking delay
  setTimeout(() => {
    term.writeln(`\r\n$ executing: ${text}`);
    agentChat.say({ role: "assistant", content: `I've started working on: "${text}". You can watch my progress in the terminal and logs.` });
    notifications.show("Agent task started", "info");
  }, 1000);
});

app.on(fileToolbar.clicked, async ({ id }) => {
  if (id === "refresh") {
    notifications.show("File tree refreshed", "info");
  }
});

app.mount("#root");

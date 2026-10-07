// Shape of the in-app help. Each language provides the same topics (same ids, same order),
// so switching language keeps you on the same page. Text may use **bold**.

export type ExampleLine = { label: string; value: string; note?: string; kind?: "minus" | "plus" | "total" | "muted" };

export type Block =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "steps"; items: string[] }
  | { type: "list"; items: string[] }
  | { type: "example"; title: string; lines: ExampleLine[]; note?: string }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "tip"; text: string }
  | { type: "warn"; text: string };

export type GroupId = "start" | "parts" | "bikes" | "money" | "reports" | "admin";

export type Topic = {
  id: string;
  group: GroupId;
  title: string;
  /** One line shown under the title and in search results. */
  summary: string;
  ownerOnly?: boolean;
  blocks: Block[];
};

export type HelpUi = {
  title: string;
  sub: string;
  search: string;
  noResults: string;
  example: string;
  tip: string;
  warn: string;
  ownerOnly: string;
  steps: string;
  next: string;
  previous: string;
  topics: string;
  groups: Record<GroupId, string>;
};

export type HelpLang = { ui: HelpUi; topics: Topic[] };

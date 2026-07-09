#!/usr/bin/env node
// List GitHub Copilot CLI sessions and extract their interactions.
//
// Reads on-disk session debug logs from ~/.copilot/session-state/<id>/
//   - events.jsonl   (the interaction stream; one JSON object per line)
//   - workspace.yaml (session metadata: name, repository, branch, cwd, timestamps)
//
// Usage:
//   node tools/sessions.mjs list   [--repo <substr>] [--json]
//   node tools/sessions.mjs show   <id-prefix> [--full] [--json]
//   node tools/sessions.mjs metrics <id-prefix>
//   node tools/sessions.mjs capture [<id-prefix>]
//
// Override the source dir with --dir <path> or COPILOT_HOME (points at .copilot).
//
// Per-model reporting (show/metrics): runtime span, tool calls (with names),
// output tokens, and — only when the session is COMPLETED — exact input/output/
// cache tokens and AI-Credit (AIC) cost. "Completed" means the session emitted a
// `session.shutdown` event (data.modelMetrics + data.totalNanoAiu). Until then,
// token/AIC fields are null: close the session to record real usage. AIC is
// derived from totalNanoAiu (USD = /1e11, credits = /1e9). Selected models, the
// auto-selection flag, resolved models, and session ids are always reported.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOME = process.env.COPILOT_HOME || path.join(os.homedir(), ".copilot");
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const RUN_DIR = path.join(REPO_ROOT, "run");
const EXPERIMENT_IDS = ["single-vibe", "single-plan", "orch-vibe", "orch-plan", "fleet"];

const argv = process.argv.slice(2);
const flags = {};
const positional = [];
let BASE = path.join(HOME, "session-state");
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dir") BASE = argv[++i];
  else if (a === "--repo") flags.repo = argv[++i];
  else if (a === "--json") flags.json = true;
  else if (a === "--full") flags.full = true;
  else if (a === "--experiment") flags.experiment = argv[++i];
  else if (a === "--id") flags.id = argv[++i];
  else if (a === "--quality") flags.quality = argv[++i];
  else if (a === "--input") flags.input = argv[++i];
  else if (a === "--cost") flags.cost = argv[++i];
  else if (a === "--report") flags.report = argv[++i];
  else if (a === "--period") flags.period = argv[++i];
  else if (a === "--no-usage") flags.noUsage = true;
  else if (a === "--help" || a === "-h") flags.help = true;
  else positional.push(a);
}
const cmd = positional[0];

function fail(msg) {
  console.error("error: " + msg);
  process.exit(1);
}

function iso(ms) {
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

function mins(ms) {
  return Number.isNaN(ms) ? null : Number((ms / 60000).toFixed(2));
}

function fmtDur(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "?";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}m${String(total % 60).padStart(2, "0")}s`;
}

function listDirs() {
  if (!fs.existsSync(BASE)) fail("session-state dir not found: " + BASE);
  return fs
    .readdirSync(BASE)
    .filter((d) => {
      try {
        return fs.statSync(path.join(BASE, d)).isDirectory();
      } catch {
        return false;
      }
    });
}

function readWorkspace(dir) {
  const f = path.join(BASE, dir, "workspace.yaml");
  if (!fs.existsSync(f)) return {};
  const ws = {};
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+):\s?(.*)$/);
    if (m) ws[m[1]] = m[2];
  }
  return ws;
}

function readEvents(dir) {
  const f = path.join(BASE, dir, "events.jsonl");
  if (!fs.existsSync(f)) return [];
  const out = [];
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // tolerate a partially written final line (live session)
    }
  }
  return out;
}

function summarize(dir) {
  const ws = readWorkspace(dir);
  const events = readEvents(dir);
  const ts = events.map((e) => Date.parse(e.timestamp)).filter((n) => !Number.isNaN(n));
  const start = ts.length ? ts[0] : Date.parse(ws.created_at ?? "");
  const end = ts.length ? ts[ts.length - 1] : Date.parse(ws.updated_at ?? "");
  // Resolved models = what actually ran per turn (assistant.message.model / tool model).
  // Selected models = what the user picked (session.start.selectedModel, model_change.newModel);
  // this is where "auto" surfaces, while resolved models show what auto chose.
  const usedModels = [];
  const useModel = (m) => {
    if (m && !usedModels.includes(m)) usedModels.push(m);
  };
  const selectedModels = [];
  const selectModel = (m) => {
    if (m && !selectedModels.includes(m)) selectedModels.push(m);
  };
  const modelUsage = {};
  const bump = (m, field, n = 1) => {
    if (!m) return;
    (modelUsage[m] ||= { assistantMessages: 0, toolCalls: 0, outputTokens: 0 })[field] += n;
  };
  // Per-model breakdown: runtime span, tool calls (with names), and exact token /
  // AI-credit usage. Token/cost fields stay null until the session is closed
  // cleanly (i.e. it emits a session.shutdown event carrying modelMetrics).
  const perModel = {};
  const pm = (m) => {
    if (!m) return null;
    return (perModel[m] ||= {
      model: m,
      selected: false,
      assistantMessages: 0,
      toolCalls: 0,
      tools: {},
      outputTokensObserved: 0,
      firstTs: NaN,
      lastTs: NaN,
      inputTokens: null,
      outputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      requests: null,
      aicCredits: null,
    });
  };
  const touch = (m, ts) => {
    const p = pm(m);
    if (!p || Number.isNaN(ts)) return;
    if (Number.isNaN(p.firstTs) || ts < p.firstTs) p.firstTs = ts;
    if (Number.isNaN(p.lastTs) || ts > p.lastTs) p.lastTs = ts;
  };
  let outputTokens = 0;
  const counts = { user: 0, assistant: 0, tool: 0, permission: 0, total: events.length };
  let copilotVersion;
  let shutdown = null;
  for (const e of events) {
    const d = e.data || {};
    const ts = Date.parse(e.timestamp);
    switch (e.type) {
      case "session.start":
        copilotVersion = d.copilotVersion;
        selectModel(d.selectedModel);
        break;
      case "session.model_change":
        selectModel(d.newModel);
        break;
      case "assistant.message": {
        counts.assistant++;
        useModel(d.model);
        bump(d.model, "assistantMessages");
        touch(d.model, ts);
        const p = pm(d.model);
        if (p) p.assistantMessages++;
        if (typeof d.outputTokens === "number") {
          outputTokens += d.outputTokens;
          bump(d.model, "outputTokens", d.outputTokens);
          if (p) p.outputTokensObserved += d.outputTokens;
        }
        break;
      }
      case "user.message":
        counts.user++;
        break;
      case "tool.execution_start": {
        counts.tool++;
        useModel(d.model);
        bump(d.model, "toolCalls");
        touch(d.model, ts);
        const p = pm(d.model);
        if (p) {
          p.toolCalls++;
          if (d.toolName) p.tools[d.toolName] = (p.tools[d.toolName] || 0) + 1;
        }
        break;
      }
      case "tool.execution_complete":
        touch(d.model, ts);
        break;
      case "session.shutdown":
        shutdown = d;
        break;
      case "permission.requested":
        counts.permission++;
        break;
    }
  }
  const autoSelected = selectedModels.some((m) => String(m).toLowerCase() === "auto");

  // Fold exact usage from session.shutdown into the per-model records. Without a
  // shutdown event the numbers below are unavailable (null) — close the session.
  const n0 = (x) => (typeof x === "number" ? x : 0);
  const nN = (x) => (typeof x === "number" ? x : null);
  const completed = !!(shutdown && shutdown.modelMetrics && Object.keys(shutdown.modelMetrics).length);
  let totalNanoAiu = null;
  let sessionTokens = null;
  if (completed) {
    totalNanoAiu = typeof shutdown.totalNanoAiu === "number" ? shutdown.totalNanoAiu : null;
    let inSum = 0,
      outSum = 0,
      crSum = 0,
      cwSum = 0;
    for (const [m, metrics] of Object.entries(shutdown.modelMetrics)) {
      const u = (metrics && metrics.usage) || {};
      const p = pm(m);
      p.inputTokens = n0(u.inputTokens);
      p.outputTokens = n0(u.outputTokens);
      p.cacheReadTokens = nN(u.cacheReadTokens);
      p.cacheWriteTokens = nN(u.cacheWriteTokens);
      if (metrics && metrics.requests) {
        p.requests = nN(metrics.requests.count);
        // Per-model GitHub Copilot billing (AI credits), when reported.
        p.aicCredits = nN(metrics.requests.cost);
      }
      inSum += p.inputTokens;
      outSum += p.outputTokens;
      crSum += p.cacheReadTokens || 0;
      cwSum += p.cacheWriteTokens || 0;
    }
    sessionTokens = { inputTokens: inSum, outputTokens: outSum, cacheReadTokens: crSum, cacheWriteTokens: cwSum };
  }

  // AI Credits: GitHub Copilot bills in nano-AI-units. USD = nanoAiu / 1e11;
  // 1 credit = $0.01, so credits = nanoAiu / 1e9. Null unless the session closed.
  const aicCredits = totalNanoAiu != null ? totalNanoAiu / 1e9 : null;
  const costUsd = totalNanoAiu != null ? totalNanoAiu / 1e11 : null;

  for (const m of selectedModels) if (perModel[m]) perModel[m].selected = true;
  const perModelList = Object.values(perModel).map((p) => ({
    model: p.model,
    selected: p.selected,
    runtimeMinutes: mins(p.lastTs - p.firstTs),
    assistantMessages: p.assistantMessages,
    toolCalls: p.toolCalls,
    tools: p.tools,
    outputTokensObserved: p.outputTokensObserved,
    inputTokens: p.inputTokens,
    outputTokens: p.outputTokens,
    cacheReadTokens: p.cacheReadTokens,
    cacheWriteTokens: p.cacheWriteTokens,
    requests: p.requests,
    aicCredits: p.aicCredits,
  }));

  return {
    dir,
    ws,
    events,
    start,
    end,
    runtimeMs: end - start,
    models: usedModels,
    selectedModels,
    autoSelected,
    modelUsage,
    outputTokens,
    counts,
    copilotVersion,
    mcSessionId: ws.mc_session_id || null,
    mcTaskId: ws.mc_task_id || null,
    completed,
    perModel: perModelList,
    sessionTokens,
    totalNanoAiu,
    aicCredits,
    costUsd,
  };
}

function resolve(idPrefix) {
  if (!idPrefix) fail("missing <id-prefix>");
  const dirs = listDirs().filter((d) => d.startsWith(idPrefix));
  if (dirs.length === 0) fail("no session matches: " + idPrefix);
  if (dirs.length > 1) {
    fail("ambiguous prefix '" + idPrefix + "': " + dirs.map((d) => d.slice(0, 8)).join(", "));
  }
  return dirs[0];
}

function trunc(value, n) {
  let str = String(value == null ? "" : value);
  if (flags.full) return str;
  str = str.replace(/\s+/g, " ").trim();
  return str.length > n ? str.slice(0, n) + "…" : str;
}

function indent(str, pad = "           ") {
  return String(str)
    .split("\n")
    .map((l) => pad + l)
    .join("\n");
}

function argsBrief(args) {
  if (!args || typeof args !== "object") return "";
  if (args.path) return args.path;
  if (args.command) return "$ " + args.command;
  if (args.pattern) return "/" + args.pattern + "/";
  if (args.query != null) return JSON.stringify(args.query);
  return JSON.stringify(args);
}

function buildInteractions(s) {
  const pending = new Map();
  const items = [];
  const offset = (e) => {
    const t = Date.parse(e.timestamp);
    return Number.isNaN(t) || Number.isNaN(s.start) ? "" : fmtDur(t - s.start);
  };
  for (const e of s.events) {
    const d = e.data || {};
    switch (e.type) {
      case "user.message":
        items.push({ at: offset(e), role: "user", content: d.content || "" });
        break;
      case "assistant.message":
        items.push({
          at: offset(e),
          role: "assistant",
          model: d.model,
          content: d.content || "",
          reasoning: d.reasoningText || "",
          tools: (d.toolRequests || []).map((r) => r.name),
          outputTokens: d.outputTokens ?? null,
        });
        break;
      case "tool.execution_start":
        pending.set(d.toolCallId, { at: offset(e), name: d.toolName, args: d.arguments });
        break;
      case "tool.execution_complete": {
        const st = pending.get(d.toolCallId) || { at: offset(e) };
        pending.delete(d.toolCallId);
        const r = d.result;
        const result = r == null ? "" : typeof r === "string" ? r : r.content || JSON.stringify(r);
        items.push({ at: st.at, role: "tool", name: st.name, args: st.args, success: d.success, result });
        break;
      }
      case "session.info":
        items.push({ at: offset(e), role: "info", content: d.message || "" });
        break;
      case "permission.requested":
        items.push({
          at: offset(e),
          role: "permission",
          content: (d.permissionRequest && (d.permissionRequest.intention || d.permissionRequest.kind)) || "",
        });
        break;
    }
  }
  for (const st of pending.values()) {
    items.push({ at: st.at, role: "tool", name: st.name, args: st.args, success: null, result: "(no completion event)" });
  }
  return items;
}

function cmdList() {
  let rows = listDirs()
    .map((d) => {
      try {
        return summarize(d);
      } catch {
        return null;
      }
    })
    .filter((s) => s && (s.events.length || Object.keys(s.ws).length));
  if (flags.repo) rows = rows.filter((s) => (s.ws.repository || "").includes(flags.repo));
  rows.sort((a, b) => (a.start || 0) - (b.start || 0));

  if (flags.json) {
    console.log(
      JSON.stringify(
        rows.map((s) => ({
          id: s.dir,
          name: s.ws.name || null,
          repository: s.ws.repository || null,
          branch: s.ws.branch || null,
          completed: s.completed,
          start: iso(s.start),
          end: iso(s.end),
          runtimeMinutes: mins(s.runtimeMs),
          selectedModels: s.selectedModels,
          autoSelected: s.autoSelected,
          models: s.models,
          userMessages: s.counts.user,
          assistantMessages: s.counts.assistant,
          toolCalls: s.counts.tool,
          inputTokens: s.sessionTokens ? s.sessionTokens.inputTokens : null,
          outputTokens: s.sessionTokens ? s.sessionTokens.outputTokens : null,
          aicCredits: s.aicCredits,
          costUsd: s.costUsd,
        })),
        null,
        2,
      ),
    );
    return;
  }

  console.log(`Sessions in ${BASE}\n`);
  for (const s of rows) {
    const id = s.dir.slice(0, 8);
    const when = Number.isNaN(s.start)
      ? "?".padEnd(16)
      : new Date(s.start).toISOString().slice(0, 16).replace("T", " ");
    const dur = fmtDur(s.runtimeMs).padStart(7);
    console.log(
      `${id}  ${when}  ${dur}  u:${s.counts.user} a:${s.counts.assistant} t:${s.counts.tool}  ${s.models.join(",") || "-"}${s.autoSelected ? " [auto]" : ""}${s.completed ? " [closed]" : " [open]"}`,
    );
    console.log(`          ${s.ws.name || "(untitled)"}  [${s.ws.repository || "?"} @ ${s.ws.branch || "?"}]`);
  }
  console.log(`\n${rows.length} session(s).  Inspect one: sessions.mjs show <id-prefix>`);
}

function cmdShow(idPrefix) {
  const s = summarize(resolve(idPrefix));
  const items = buildInteractions(s);

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          session: {
            id: s.dir,
            name: s.ws.name || null,
            repository: s.ws.repository || null,
            branch: s.ws.branch || null,
            cwd: s.ws.cwd || null,
            copilotVersion: s.copilotVersion || null,
            mcSessionId: s.mcSessionId,
            mcTaskId: s.mcTaskId,
            completed: s.completed,
            start: iso(s.start),
            end: iso(s.end),
            runtimeMinutes: mins(s.runtimeMs),
          },
          models: s.models,
          selectedModels: s.selectedModels,
          autoSelected: s.autoSelected,
          perModel: s.perModel,
          tokens: s.sessionTokens,
          aic: s.completed ? { credits: s.aicCredits, costUsd: s.costUsd } : null,
          outputTokens: s.outputTokens,
          counts: s.counts,
          interactions: items,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("Session " + s.dir);
  console.log("  name:       " + (s.ws.name || "(untitled)"));
  console.log("  repository: " + (s.ws.repository || "?") + " @ " + (s.ws.branch || "?"));
  console.log("  cwd:        " + (s.ws.cwd || "?"));
  console.log("  mcSession:  " + (s.mcSessionId || "(none)"));
  console.log("  mcTask:     " + (s.mcTaskId || "(none)"));
  console.log("  version:    " + (s.copilotVersion || "?"));
  console.log("  start:      " + (iso(s.start) || "?"));
  console.log("  end:        " + (iso(s.end) || "?"));
  console.log("  runtime:    " + fmtDur(s.runtimeMs) + " (" + mins(s.runtimeMs) + " min)");
  console.log("  selected:   " + (s.selectedModels.join(", ") || "?") + (s.autoSelected ? "   <-- AUTO" : ""));
  console.log("  models:     " + (s.models.join(", ") || "-") + "   (resolved/used)");
  console.log(
    "  completed:  " +
      (s.completed ? "yes (session.shutdown present)" : "NO -- close the session to record token/AIC usage"),
  );
  console.log(
    "  counts:     user=" +
      s.counts.user +
      " assistant=" +
      s.counts.assistant +
      " tools=" +
      s.counts.tool +
      " permissions=" +
      s.counts.permission +
      " events=" +
      s.counts.total,
  );
  if (s.completed) {
    const t = s.sessionTokens;
    console.log(
      "  tokens:     input=" +
        t.inputTokens +
        " output=" +
        t.outputTokens +
        " cacheRead=" +
        t.cacheReadTokens +
        " cacheWrite=" +
        t.cacheWriteTokens,
    );
    console.log(
      "  AIC:        " +
        (s.aicCredits != null ? s.aicCredits.toFixed(2) + " credits" : "\u2014") +
        (s.costUsd != null ? "  ($" + s.costUsd.toFixed(4) + ")" : ""),
    );
  } else {
    console.log("  tokens:     null   (no session.shutdown)");
    console.log("  AIC:        null   (no session.shutdown)");
  }

  console.log("\n--- per model ---");
  if (!s.perModel.length) {
    console.log("  (none)");
  } else {
    for (const p of s.perModel) {
      const tok = s.completed
        ? `in=${p.inputTokens} out=${p.outputTokens} cacheR=${p.cacheReadTokens ?? "-"} cacheW=${p.cacheWriteTokens ?? "-"}`
        : "tokens=null (session open)";
      const aic = p.aicCredits != null ? `  aic=${p.aicCredits}cr` : "";
      console.log(`  ${p.model}${p.selected ? " [selected]" : ""}`);
      console.log(
        `     runtime=${p.runtimeMinutes ?? "?"}min  msgs=${p.assistantMessages}  toolCalls=${p.toolCalls}${aic}`,
      );
      console.log(`     ${tok}`);
      const toolNames = Object.keys(p.tools);
      if (toolNames.length) {
        console.log(
          "     tools: " +
            toolNames
              .sort((a, b) => p.tools[b] - p.tools[a])
              .map((t) => `${t}\u00d7${p.tools[t]}`)
              .join(", "),
        );
      }
    }
  }
  if (s.autoSelected) console.log("\n  note: model selection was AUTO; resolved models above show what auto chose.");

  console.log("\n--- interactions ---\n");

  for (const it of items) {
    const at = (it.at || "").padStart(7);
    if (it.role === "user") {
      console.log(`[${at}] USER: ${trunc(it.content, 1000)}\n`);
    } else if (it.role === "assistant") {
      const head = `[${at}] ASSISTANT${it.model ? ` (${it.model})` : ""}:`;
      console.log(it.content && it.content.trim() ? `${head} ${trunc(it.content, 600)}` : `${head} (no text)`);
      if (flags.full && it.reasoning && it.reasoning.trim()) {
        console.log(indent("reasoning: " + it.reasoning, "          "));
      }
      if (it.tools.length) console.log(`          -> requests: ${it.tools.join(", ")}`);
      console.log("");
    } else if (it.role === "tool") {
      const ok = it.success === true ? "ok" : it.success === false ? "FAIL" : "…";
      console.log(`          [tool] ${it.name || "?"} ${trunc(argsBrief(it.args), 120)} -> ${ok}`);
      if (flags.full && it.result) console.log(indent(it.result, "            "));
    } else if (it.role === "info") {
      console.log(`[${at}] info: ${trunc(it.content, 200)}`);
    } else if (it.role === "permission") {
      console.log(`[${at}] permission: ${trunc(it.content, 120)}`);
    }
  }
}

function cmdMetrics(idPrefix) {
  const s = summarize(resolve(idPrefix));
  console.log(
    JSON.stringify(
      {
        sessionId: s.dir,
        mcSessionId: s.mcSessionId,
        mcTaskId: s.mcTaskId,
        name: s.ws.name || null,
        repository: s.ws.repository || null,
        branch: s.ws.branch || null,
        completed: s.completed,
        selectedModels: s.selectedModels,
        autoSelected: s.autoSelected,
        modelsUsed: s.models,
        runtimeMinutes: mins(s.runtimeMs),
        startTimestamp: iso(s.start),
        endTimestamp: iso(s.end),
        aic: s.completed ? { credits: s.aicCredits, costUsd: s.costUsd } : null,
        tokens: s.sessionTokens,
        counts: s.counts,
        models: s.perModel.map((p) => ({
          model: p.model,
          selected: p.selected,
          runtimeMinutes: p.runtimeMinutes,
          assistantMessages: p.assistantMessages,
          toolCalls: p.toolCalls,
          tools: p.tools,
          tokens: s.completed
            ? {
                inputTokens: p.inputTokens,
                outputTokens: p.outputTokens,
                cacheReadTokens: p.cacheReadTokens,
                cacheWriteTokens: p.cacheWriteTokens,
              }
            : null,
          requests: p.requests,
          aicCredits: p.aicCredits,
        })),
      },
      null,
      2,
    ),
  );
}

function experimentConfig() {
  const cfg = readJson(path.join(RUN_DIR, "experiment.json"), null) || {};
  return {
    id: typeof cfg.id === "string" && cfg.id ? cfg.id : null,
    label: typeof cfg.label === "string" && cfg.label ? cfg.label : null,
    promptVersion: typeof cfg.promptVersion === "string" ? cfg.promptVersion : null,
  };
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
}

function usageSnapshot(period) {
  try {
    const out = execFileSync(
      "npx",
      ["--yes", "@rajbos/ai-engineering-fluency", "usage", "--json"],
      { encoding: "utf8", timeout: 180000, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 },
    );
    const all = JSON.parse(out);
    return all[period] || all.today || null;
  } catch {
    return null;
  }
}

function latestSessionDir() {
  const all = listDirs()
    .map((d) => {
      try {
        return summarize(d);
      } catch {
        return null;
      }
    })
    .filter((s) => s && s.events.length);
  if (!all.length) return null;
  all.sort((a, b) => (a.start || 0) - (b.start || 0));
  return all[all.length - 1].dir;
}

function cmdCapture(idPrefix) {
  const dir = idPrefix ? resolve(idPrefix) : latestSessionDir();
  if (!dir) fail("no session with events found to capture");
  const s = summarize(dir);

  const cfg = experimentConfig();
  const experiment = flags.experiment || cfg.id;
  if (!experiment) {
    fail(
      "no experiment id: fill in run/experiment.json (id/label) or pass --experiment <" +
        EXPERIMENT_IDS.join("|") +
        ">",
    );
  }
  if (!EXPERIMENT_IDS.includes(experiment)) {
    fail("unknown experiment '" + experiment + "' (expected " + EXPERIMENT_IDS.join("|") + ")");
  }
  const id = flags.id || s.dir.slice(0, 8);
  const quality = flags.quality != null ? Number(flags.quality) : null;
  const period = flags.period || "today";

  // Estimated usage/cost from @rajbos/ai-engineering-fluency (period aggregate).
  const usage = flags.noUsage ? null : usageSnapshot(period);
  let estInput = null;
  let estCost = null;
  let estimated = null;
  if (usage) {
    const mu = usage.modelUsage || {};
    estInput = s.models.reduce((sum, m) => sum + (mu[m] ? mu[m].inputTokens || 0 : 0), 0) || null;
    estCost = usage.estimatedCost != null ? usage.estimatedCost : null;
    estimated = {
      source: "@rajbos/ai-engineering-fluency",
      period,
      periodSessions: usage.sessions != null ? usage.sessions : null,
      inputTokens: estInput,
      costUsd: estCost,
      thinkingTokens: usage.thinkingTokens != null ? usage.thinkingTokens : null,
      co2: usage.co2 != null ? usage.co2 : null,
      waterUsage: usage.waterUsage != null ? usage.waterUsage : null,
      treesEquivalent: usage.treesEquivalent != null ? usage.treesEquivalent : null,
      note: "input/cost are estimated period aggregates, not per-session",
    };
  }

  const inputTokens =
    flags.input != null ? Number(flags.input) : s.completed && s.sessionTokens ? s.sessionTokens.inputTokens : estInput;
  const costUsd = flags.cost != null ? Number(flags.cost) : s.costUsd != null ? s.costUsd : estCost;
  const outputTokens = s.completed && s.sessionTokens ? s.sessionTokens.outputTokens : s.outputTokens;
  const exactSource = s.completed && flags.input == null && flags.cost == null;

  // 1) Experiment report — deck-facing data for this repo.
  //    Lives at run/report.json (contract: run/report.schema.json). The hub deck
  //    aggregates the five experiment repos' reports.
  const runReportPath = flags.report ? path.resolve(flags.report) : path.join(RUN_DIR, "report.json");
  const runReport =
    readJson(runReportPath, null) || {
      $schema: "./report.schema.json",
      experiment,
      label: cfg.label,
      promptVersion: cfg.promptVersion,
      acceptancePct: null,
      modelUsage: [],
      sessions: [],
    };
  for (const key of ["modelUsage", "sessions"]) {
    if (!Array.isArray(runReport[key])) runReport[key] = [];
  }
  runReport.experiment = experiment;
  if (cfg.label && !flags.experiment) runReport.label = cfg.label;
  runReport.generatedAt = new Date().toISOString();
  const deckEntry = {
    id,
    models: s.models,
    runtimeMinutes: mins(s.runtimeMs) != null ? Math.round(mins(s.runtimeMs)) : null,
    inputTokens: inputTokens != null ? inputTokens : null,
    outputTokens,
    costUsd: costUsd != null ? costUsd : null,
    qualityScore: quality,
  };
  const i = runReport.sessions.findIndex((x) => x && x.id === id);
  if (i >= 0) runReport.sessions[i] = deckEntry;
  else runReport.sessions.push(deckEntry);
  writeJson(runReportPath, runReport);

  // 2) Durable capture (full detail).
  let metricsPath = path.join(RUN_DIR, "metrics.json");
  {
    const metrics = readJson(metricsPath, null) || { experiment, sessions: [] };
    if (!Array.isArray(metrics.sessions)) metrics.sessions = [];
    metrics.experiment = experiment;
    const entry = {
      sessionId: s.dir,
      mcSessionId: s.mcSessionId,
      mcTaskId: s.mcTaskId,
      experiment,
      capturedAt: new Date().toISOString(),
      completed: s.completed,
      selectedModels: s.selectedModels,
      autoSelected: s.autoSelected,
      modelsUsed: s.models,
      perModel: s.perModel,
      runtimeMinutes: mins(s.runtimeMs),
      startTimestamp: iso(s.start),
      endTimestamp: iso(s.end),
      counts: s.counts,
      tokens: s.sessionTokens,
      outputTokens,
      inputTokens: inputTokens != null ? inputTokens : null,
      costUsd: costUsd != null ? costUsd : null,
      aicCredits: s.aicCredits,
      qualityScore: quality,
      estimated: s.completed ? null : estimated,
    };
    const j = metrics.sessions.findIndex((x) => x && x.sessionId === s.dir);
    if (j >= 0) metrics.sessions[j] = entry;
    else metrics.sessions.push(entry);
    writeJson(metricsPath, metrics);
  }

  // 3) Summary. (This tool never touches the deck; the hub aggregates
  //    run/report.json from the five experiment repos.)
  const tag = (key) =>
    flags[key] != null
      ? " (--" + key + ")"
      : exactSource
        ? " (exact, session.shutdown)"
        : usage
          ? " (est, " + period + " aggregate)"
          : "";
  console.log('Captured ' + s.dir.slice(0, 8) + '  "' + (s.ws.name || "untitled") + '"');
  console.log(
    "  exp:     " + experiment + (flags.experiment ? " (--experiment)" : " (run/experiment.json)"),
  );
  console.log(
    "  status:  " +
      (s.completed ? "completed (exact token/AIC usage)" : "OPEN -- no session.shutdown; input/cost fall back to estimates"),
  );
  console.log(
    "  exact:   runtime " +
      fmtDur(s.runtimeMs) +
      " | models " +
      (s.models.join(",") || "-") +
      " | output " +
      outputTokens +
      (s.autoSelected ? " | AUTO" : ""),
  );
  console.log("  input:   " + (inputTokens != null ? inputTokens : "—") + tag("input"));
  console.log("  cost:    " + (costUsd != null ? "$" + costUsd : "—") + tag("cost"));
  if (!s.completed && usage && usage.sessions > 1 && flags.input == null && flags.cost == null) {
    console.log(
      "  ! input/cost are " +
        period +
        " aggregates across " +
        usage.sessions +
        " sessions, not just this one — use --input/--cost for exact per-experiment values.",
    );
  }
  console.log("  report:  " + path.relative(REPO_ROOT, runReportPath) + " (sessions[] upserted)");
  console.log("  detail:  " + path.relative(REPO_ROOT, metricsPath));
  console.log("  note:    modelUsage[]/acceptancePct not recomputed; the hub deck aggregates this report.");
}

function printHelp() {
  console.log(`sessions.mjs — list and extract GitHub Copilot CLI sessions

Usage:
  node tools/sessions.mjs list    [--repo <substr>] [--json]
  node tools/sessions.mjs show    <id-prefix> [--full] [--json]
  node tools/sessions.mjs metrics <id-prefix>
  node tools/sessions.mjs capture [<id-prefix>] [--experiment <id>]

\`capture\` is the one-shot: pick a session (default: most recent), gather metrics
from the log, upsert a session row into this repo's experiment report
(run/report.json, contract: run/report.schema.json), and write a full record to
run/metrics.json. Exact token/AIC values are used when the session is completed
(session.shutdown present); otherwise it falls back to an @rajbos/ai-engineering-
fluency estimate. It does not touch the deck — the hub repo aggregates the five
experiment repos' run/report.json files.

Options:
  --repo <substr>   filter list by repository substring (list)
  --json            machine-readable JSON output
  --full            show untruncated content + tool results (show)
  --dir <path>      session-state dir (default ~/.copilot/session-state)
  capture:
  --experiment <id> single-vibe|single-plan|orch-vibe|orch-plan|fleet
                    (default: id from run/experiment.json)
  --id <id>         deck session id (default: short session id)
  --input <n>       exact input tokens (else shutdown-exact, else estimate)
  --cost <usd>      exact session cost (else shutdown-exact, else estimate)
  --quality <n>     manual quality score
  --report <path>   report.json (default: run/report.json)
  --period <p>      usage period today|month|last30Days (default: today)
  --no-usage        skip the @rajbos/ai-engineering-fluency call
  -h, --help        this help

Source: ~/.copilot/session-state/<id>/{events.jsonl,workspace.yaml}
Per model (show/metrics): runtime, tool calls (with names), and — only for
completed sessions (session.shutdown present) — exact input/output/cache tokens
and AIC cost. Token/AIC fields are null until the session is closed. AIC comes
from totalNanoAiu (USD = /1e11, credits = /1e9). selectedModels = picked,
models = resolved/used, autoSelected flags auto selection.`);
}

if (flags.help) {
  printHelp();
  process.exit(0);
}
switch (cmd) {
  case undefined:
  case "list":
    cmdList();
    break;
  case "show":
  case "extract":
    cmdShow(positional[1]);
    break;
  case "metrics":
    cmdMetrics(positional[1]);
    break;
  case "capture":
    cmdCapture(positional[1]);
    break;
  default:
    fail("unknown command: " + cmd + " (try --help)");
}

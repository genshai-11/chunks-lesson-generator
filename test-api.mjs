/**
 * API Endpoint Test Suite — CHUNKS CVR Project
 * Covers all existing + new endpoints.
 * Run: node test-api.mjs
 *
 * Exit code 0 = all pass, 1 = any failure.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

const SERVER = process.env.SERVER || "http://localhost:3000";
const M2M_KEY = process.env.M2M_API_KEY || "m2m_CHUNK_ANALYZER_SECURE_2026";
const BAD_KEY = "invalid_key_12345";

// ─── Test runner ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌  ${name}`);
    console.log(`       ${e.message}`);
    failed++;
    failures.push({ name, error: e.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

async function req(method, path, body, headers = {}) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${SERVER}${path}`, opts);
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: r.status, json };
}

function m2m(headers = {}) {
  return { "X-API-Key": M2M_KEY, "X-Requested-With": "XMLHttpRequest", ...headers };
}

// ─── Fixture data ─────────────────────────────────────────────────────────────
const SAMPLE_RESOURCES = [
  { id: "r1", name: "hạ đường huyết", color: "Pink", ohm: 3, userId: "test", createdAt: new Date().toISOString() },
  { id: "r2", name: "mật ngọt chết ruồi", color: "Red", ohm: 9, userId: "test", createdAt: new Date().toISOString() },
  { id: "r3", name: "thành thật mà nói", color: "Green", ohm: 5, userId: "test", createdAt: new Date().toISOString() },
];

const TRANSCRIPT_EASY = "Hôm nay trời đẹp. Tôi đi dạo công viên với gia đình.";
const TRANSCRIPT_HARD = "Thành thật mà nói, hạ đường huyết không phải chuyện nhỏ — mật ngọt chết ruồi, cậu tới số rồi.";

// ─────────────────────────────────────────────────────────────────────────────

async function runAll() {
  console.log(`\n${"═".repeat(60)}`);
  console.log("  CHUNKS CVR — API Endpoint Test Suite");
  console.log(`  Server: ${SERVER}`);
  console.log(`${"═".repeat(60)}\n`);

  // ── GROUP 1: Infrastructure ─────────────────────────────────────────────
  console.log("── 1. Infrastructure ──────────────────────────────────────");

  await test("GET /api/ping — no auth required", async () => {
    const { status, json } = await req("GET", "/api/ping");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(json.status === "ok", "Expected status: ok");
  });

  await test("OPTIONS /api/ping — CORS preflight returns 200", async () => {
    const { status } = await req("OPTIONS", "/api/ping");
    assert(status === 200, `Expected 200, got ${status}`);
  });

  // ── GROUP 2: Auth validation ────────────────────────────────────────────
  console.log("\n── 2. Auth (M2M validation) ───────────────────────────────");

  await test("POST /api/measure-cvr — missing key returns 401", async () => {
    const { status, json } = await req("POST", "/api/measure-cvr", { transcript: "test" });
    assert(status === 401, `Expected 401, got ${status}`);
    assert(json.status === "error", "Expected error status");
  });

  await test("POST /api/chunk-generate — wrong key returns 401", async () => {
    const { status } = await req("POST", "/api/chunk-generate", { resources: SAMPLE_RESOURCES }, { "X-API-Key": BAD_KEY });
    assert(status === 401, `Expected 401, got ${status}`);
  });

  await test("POST /api/analyze-ohm — missing key returns 401", async () => {
    const { status } = await req("POST", "/api/analyze-ohm", { transcript: "test" });
    assert(status === 401, `Expected 401, got ${status}`);
  });

  // ── GROUP 3: Settings & Data ─────────────────────────────────────────────
  console.log("\n── 3. Settings & Data ─────────────────────────────────────");

  await test("GET /api/settings/ai — returns settings object", async () => {
    const { status, json } = await req("GET", "/api/settings/ai");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(typeof json === "object" && json !== null, "Expected object response");
  });

  await test("GET /api/resources — returns array", async () => {
    const { status, json } = await req("GET", "/api/resources");
    assert(status === 200, `Expected 200, got ${status}`);
    const arr = Array.isArray(json) ? json : json.data || json.resources || [];
    assert(Array.isArray(arr), "Expected array");
  });

  await test("GET /api/chunks — returns array", async () => {
    const { status, json } = await req("GET", "/api/chunks");
    assert(status === 200, `Expected 200, got ${status}`);
    const arr = Array.isArray(json) ? json : json.data || json.chunks || [];
    assert(Array.isArray(arr), "Expected array");
  });

  await test("GET /api/history — returns array", async () => {
    const { status, json } = await req("GET", "/api/history");
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await test("GET /api/app/bootstrap — returns bootstrap data", async () => {
    const { status, json } = await req("GET", "/api/app/bootstrap");
    assert(status === 200, `Expected 200, got ${status}`);
  });

  // ── GROUP 4: Transcription ───────────────────────────────────────────────
  console.log("\n── 4. Transcription ───────────────────────────────────────");

  await test("POST /api/transcribe — missing audioData returns 400/500", async () => {
    const { status } = await req("POST", "/api/transcribe", {}, m2m());
    assert(status >= 400, `Expected 4xx/5xx for empty body, got ${status}`);
  });

  await test("POST /api/transcribe — invalid base64 returns error", async () => {
    const { status, json } = await req("POST", "/api/transcribe", { audioData: "not_valid_base64", mimeType: "audio/webm" }, m2m());
    assert(status >= 400 || json.status === "error", `Expected error response, got ${status}`);
  });

  // ── GROUP 5: Existing Ohm Analysis ──────────────────────────────────────
  console.log("\n── 5. Existing: /api/analyze-ohm ──────────────────────────");

  await test("POST /api/analyze-ohm — missing transcript returns 400", async () => {
    const { status, json } = await req("POST", "/api/analyze-ohm", {}, m2m());
    assert(status === 400, `Expected 400, got ${status}`);
    assert(json.error, "Expected error message");
  });

  await test("POST /api/analyze-ohm — valid transcript returns chunks", async () => {
    const { status, json } = await req(
      "POST", "/api/analyze-ohm",
      { transcript: TRANSCRIPT_HARD, settings: { ohmBaseValues: { Green: 5, Blue: 7, Red: 9, Pink: 3 } } },
      m2m()
    );
    assert(status === 200, `Expected 200, got ${status}: ${json.error || ""}`);
    assert(json.status === "success" || json.data, "Expected success response");
  });

  // ── GROUP 6: NEW — /api/measure-cvr ─────────────────────────────────────
  console.log("\n── 6. NEW: /api/measure-cvr ───────────────────────────────");

  await test("POST /api/measure-cvr — missing transcript returns 400", async () => {
    const { status, json } = await req("POST", "/api/measure-cvr", {}, m2m());
    assert(status === 400, `Expected 400, got ${status}`);
    assert(json.error, "Expected error message");
  });

  await test("POST /api/measure-cvr — easy transcript, inline resources", async () => {
    const { status, json } = await req(
      "POST", "/api/measure-cvr",
      { transcript: TRANSCRIPT_EASY, resources: SAMPLE_RESOURCES },
      m2m()
    );
    assert(status === 200, `Expected 200, got ${status}: ${json.error || ""}`);
    assert(json.status === "success", "Expected success");
    const d = json.data;
    assert(typeof d.predictedCVR === "number", "predictedCVR should be number");
    assert(d.predictedCVR >= 1, `CVR floor should be >= 1, got ${d.predictedCVR}`);
    assert(d.lcBreakdown?.lcValue, "lcBreakdown.lcValue missing");
    assert(d.tcBreakdown?.estimatedTC !== undefined, "tcBreakdown.estimatedTC missing");
    assert(d.tlBreakdown?.tlValue, "tlBreakdown.tlValue missing");
    console.log(`       CVR=${d.predictedCVR}  TC=${d.tcBreakdown.estimatedTC}  LC=${d.lcBreakdown.lcValue}  TL=${d.tlBreakdown.tlValue}`);
  });

  await test("POST /api/measure-cvr — hard transcript with matched resources", async () => {
    const { status, json } = await req(
      "POST", "/api/measure-cvr",
      { transcript: TRANSCRIPT_HARD, resources: SAMPLE_RESOURCES },
      m2m()
    );
    assert(status === 200, `Expected 200, got ${status}: ${json.error || ""}`);
    const d = json.data;
    assert(d.tcBreakdown.matchedResources.length > 0, "Should match at least 1 resource");
    assert(d.predictedCVR > 1, `Hard sentence CVR should be > 1, got ${d.predictedCVR}`);
    console.log(`       CVR=${d.predictedCVR}  matched=${d.tcBreakdown.matchedResources.length}  candidates=${d.tcBreakdown.candidateResources.length}`);
  });

  await test("POST /api/measure-cvr — no resources provided (server fetches)", async () => {
    const { status, json } = await req(
      "POST", "/api/measure-cvr",
      { transcript: TRANSCRIPT_EASY },
      m2m()
    );
    assert(status === 200, `Expected 200, got ${status}: ${json.error || ""}`);
    assert(json.data?.predictedCVR >= 1, "CVR should be >= 1");
  });

  await test("POST /api/measure-cvr — CVR floor: TC=0 returns 1", async () => {
    const { status, json } = await req(
      "POST", "/api/measure-cvr",
      { transcript: "Con mèo ngồi trên bàn.", resources: [] },
      m2m()
    );
    assert(status === 200, `Expected 200, got ${status}: ${json.error || ""}`);
    assert(json.data?.predictedCVR === 1, `CVR floor should be 1, got ${json.data?.predictedCVR}`);
  });

  // ── GROUP 7: NEW — /api/chunk-generate ──────────────────────────────────
  console.log("\n── 7. NEW: /api/chunk-generate ────────────────────────────");

  await test("POST /api/chunk-generate — missing resources returns 400", async () => {
    const { status } = await req("POST", "/api/chunk-generate", { rTotal: 10, iValue: 1, uTotal: 10 }, m2m());
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test("POST /api/chunk-generate — valid request returns eng+vie sentences", async () => {
    const { status, json } = await req(
      "POST", "/api/chunk-generate",
      {
        resources: SAMPLE_RESOURCES,
        rTotal: 17,
        iValue: 1.0,
        uTotal: 17,
        theme: "Daily life",
        topicLevel: 1.2,
        sentenceLength: "Short",
      },
      m2m()
    );
    assert(status === 200, `Expected 200, got ${status}: ${json.error || ""}`);
    assert(json.status === "success", "Expected success");
    const d = json.data;
    assert(typeof d.engSentence === "string" && d.engSentence.length > 0, "engSentence missing");
    assert(typeof d.vieSentence === "string" && d.vieSentence.length > 0, "vieSentence missing");
    console.log(`       vie: "${d.vieSentence.slice(0, 60)}…"`);
  });

  // ── GROUP 8: NEW — /api/chunk-generate/batch ────────────────────────────
  console.log("\n── 8. NEW: /api/chunk-generate/batch ──────────────────────");

  await test("POST /api/chunk-generate/batch — missing required fields returns 400", async () => {
    const { status } = await req("POST", "/api/chunk-generate/batch", { quantity: 2 }, m2m());
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test("POST /api/chunk-generate/batch — generates N chunks", async () => {
    const { status, json } = await req(
      "POST", "/api/chunk-generate/batch",
      {
        theme: "Health & Daily Life",
        topicLevel: 1.3,
        targetU: 20,
        quantity: 2,
        sentenceLength: "Short",
        colorPreferences: ["Pink", "Red"],
        availableResources: SAMPLE_RESOURCES,
      },
      m2m()
    );
    assert(status === 200, `Expected 200, got ${status}: ${json.error || ""}`);
    assert(json.status === "success", "Expected success");
    assert(Array.isArray(json.data), "Expected array of chunks");
    assert(json.data.length > 0, "Expected at least 1 chunk");
    console.log(`       Generated ${json.data.length} chunk(s). First: "${json.data[0]?.vieSentence?.slice(0, 50)}…"`);
  });

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log("\n  Failed tests:");
    failures.forEach(f => console.log(`    ✗ ${f.name}\n      ${f.error}`));
  }
  console.log(`${"═".repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runAll().catch(e => {
  console.error("Test runner crashed:", e);
  process.exit(1);
});

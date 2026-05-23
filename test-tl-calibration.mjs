/**
 * TL Calibration Test — verifies the 1.0 → 1.3 → 1.6 → 1.8 → 2.0 axis is reachable.
 * Run: node test-tl-calibration.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

const SERVER = "http://localhost:3000";
const M2M_KEY = process.env.M2M_API_KEY || "m2m_CHUNK_ANALYZER_SECURE_2026";

const CASES = [
  // ── TL 1.0 anchors ────────────────────────────────────────────────────────
  { id: "T1.0-A", expectedMin: 1.0, expectedMax: 1.2,
    label: "Daily life — weather",
    transcript: "Hôm nay trời đẹp, tôi đi chợ mua rau về nấu canh." },
  { id: "T1.0-B", expectedMin: 1.0, expectedMax: 1.2,
    label: "Daily life — greeting",
    transcript: "Ăn cơm chưa? Mới về à? Mệt không?" },

  // ── TL 1.3 anchors ────────────────────────────────────────────────────────
  { id: "T1.3-A", expectedMin: 1.2, expectedMax: 1.5,
    label: "Social — work pressure",
    transcript: "Áp lực công việc khiến nhiều nhân viên kiệt sức và khó giữ cân bằng cuộc sống." },
  { id: "T1.3-B", expectedMin: 1.2, expectedMax: 1.8,
    label: "Social/policy — inequality (borderline 1.3–1.8)",
    transcript: "Bất bình đẳng thu nhập ngày càng tăng, người nghèo khó tiếp cận cơ hội giáo dục." },

  // ── TL 1.6 anchors ────────────────────────────────────────────────────────
  { id: "T1.6-A", expectedMin: 1.5, expectedMax: 1.7,
    label: "Professional — medical practice",
    transcript: "Bác sĩ chẩn đoán bệnh nhân mắc hội chứng chuyển hóa và đề nghị điều chỉnh lối sống, kiểm soát đường huyết định kỳ." },
  { id: "T1.6-B", expectedMin: 1.5, expectedMax: 1.7,
    label: "Professional — legal practice",
    transcript: "Luật sư tư vấn hợp đồng lao động cho khách hàng, làm rõ các điều khoản về thôi việc và bồi thường." },
  { id: "T1.6-C", expectedMin: 1.5, expectedMax: 1.7,
    label: "Professional — financial analyst",
    transcript: "Chuyên viên phân tích danh mục đầu tư dựa trên chỉ số P/E và tỷ suất sinh lợi kỳ vọng trong quý tới." },

  // ── TL 1.8 anchors — THE PROBLEM AREA ────────────────────────────────────
  { id: "T1.8-A", expectedMin: 1.7, expectedMax: 2.0,
    label: "Academic policy — microfinance (was E5)",
    transcript: "Các cơ chế tài chính vi mô hiện hành chưa đủ mạnh để bóc lột cấu trúc bất đối xứng thông tin trong thị trường tín dụng nông thôn tại Việt Nam." },
  { id: "T1.8-B", expectedMin: 1.7, expectedMax: 2.0,
    label: "Academic — behavioral economics (was E4)",
    transcript: "Nhìn từ góc độ kinh tế học hành vi, tâm lý tự mãn của nhà đầu tư thường dẫn đến quyết định phi lý trí và tổn thất danh mục." },
  { id: "T1.8-C", expectedMin: 1.7, expectedMax: 2.0,
    label: "Academic — public health policy",
    transcript: "Hiệu quả can thiệp y tế công cộng phụ thuộc vào mức độ tích hợp dữ liệu dịch tễ học và khả năng triển khai nguồn lực theo địa bàn ưu tiên." },
  { id: "T1.8-D", expectedMin: 1.7, expectedMax: 2.0,
    label: "Academic — legal scholarship",
    transcript: "Học thuyết quyền tài sản trong kinh tế học luật nhấn mạnh rằng phân bổ ban đầu không quan trọng khi chi phí giao dịch bằng không — định lý Coase." },
  { id: "T1.8-E", expectedMin: 1.7, expectedMax: 2.0,
    label: "Research — social policy analysis",
    transcript: "Phân tích hồi quy đa biến cho thấy hệ số co giãn của cầu với thu nhập trong nhóm dân số dưới chuẩn nghèo thấp hơn đáng kể so với nhóm trung lưu." },

  // ── TL 2.0 anchors ────────────────────────────────────────────────────────
  { id: "T2.0-A", expectedMin: 1.8, expectedMax: 2.0,
    label: "Research — mathematical economics",
    transcript: "Tính không đầy đủ thị trường Arrow-Debreu trong điều kiện rủi ro đạo đức nội sinh đòi hỏi cơ chế ưu đãi phi tuyến nhằm đạt cân bằng Pareto thứ cấp." },
  { id: "T2.0-B", expectedMin: 1.8, expectedMax: 2.0,
    label: "Research — clinical pharmacology",
    transcript: "Dược động học của chất ức chế PDE5 cho thấy sự tích lũy lũy thừa tại thụ thể cGMP, điều chỉnh áp suất mạch máu theo cơ chế phản hồi âm tính." },
];

async function measure(transcript) {
  const r = await fetch(`${SERVER}/api/measure-cvr`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": M2M_KEY,
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({ transcript, resources: [] }),
  });
  const j = await r.json();
  return j.data;
}

function pad(s, n) { s = String(s ?? ""); return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length); }
function rpad(s, n) { s = String(s ?? ""); return s.length >= n ? s.slice(0, n) : " ".repeat(n - s.length) + s; }

async function run() {
  console.log("\n" + "═".repeat(88));
  console.log("  TL Calibration Test — checking 1.0 → 1.8 → 2.0 axis reachability");
  console.log("═".repeat(88) + "\n");

  const results = [];

  for (const c of CASES) {
    process.stdout.write(`  [${c.id.padEnd(8)}] ${pad(c.label, 45)} … `);
    const t0 = Date.now();
    try {
      const d = await measure(c.transcript);
      const tl = d.tlBreakdown.tlValue;
      const ms = Date.now() - t0;
      const pass = tl >= c.expectedMin && tl <= c.expectedMax;
      const flag = pass ? "✅" : `❌ (expected ${c.expectedMin}–${c.expectedMax})`;
      process.stdout.write(`TL=${tl.toFixed(1)}  band="${d.tlBreakdown.band}"  ${flag}  ${ms}ms\n`);
      if (!pass) {
        console.log(`         reasoning: ${d.tlBreakdown.reasoning?.slice(0, 140)}`);
      }
      results.push({ ...c, tl, pass, ms, reasoning: d.tlBreakdown.reasoning });
    } catch (e) {
      process.stdout.write(`CRASH: ${e.message}\n`);
      results.push({ ...c, tl: null, pass: false, ms: 0 });
    }
  }

  // Summary by expected band
  console.log("\n" + "─".repeat(88));
  console.log("  SUMMARY BY EXPECTED TL BAND");
  console.log("─".repeat(88));

  const groups = {
    "1.0": CASES.filter(c => c.expectedMax <= 1.2),
    "1.3": CASES.filter(c => c.expectedMin >= 1.2 && c.expectedMax <= 1.5),
    "1.6": CASES.filter(c => c.expectedMin >= 1.5 && c.expectedMax <= 1.7),
    "1.8": CASES.filter(c => c.expectedMin >= 1.7 && c.expectedMax < 2.1 && c.expectedMin < 1.9),
    "2.0": CASES.filter(c => c.expectedMin >= 1.8),
  };

  for (const [band, cases] of Object.entries(groups)) {
    const caseResults = cases.map(c => results.find(r => r.id === c.id));
    const passed = caseResults.filter(r => r?.pass).length;
    const tlValues = caseResults.map(r => r?.tl?.toFixed(1) ?? "?").join(", ");
    const status = passed === cases.length ? "✅" : `❌ ${passed}/${cases.length}`;
    console.log(`  TL ~${band}  ${status}  got=[${tlValues}]`);
  }

  const total = results.length;
  const passed = results.filter(r => r.pass).length;
  console.log("\n" + "═".repeat(88));
  console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log("═".repeat(88) + "\n");

  process.exit(passed < total ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });

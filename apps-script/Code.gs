// Бекенд для атестації: Google Таблиця + Apps Script.
// Аркуші створюються самі: «Питання» і «Відповіді».

const ADMIN_PIN = "ЗМІНИ-МЕНЕ"; // PIN для адмінки. Зміни перед розгортанням.

const QUESTIONS = "Питання";
const ANSWERS = "Відповіді";
const QHEAD = ["id", "заголовок", "пояснення", "підпункти (JSON)"];
const AHEAD = ["час", "офіціант", "qid", "питання", "№", "підпункт", "відповідь"];

function sheet_(name, head) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(head);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, head.length).setFontWeight("bold");
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function questions_() {
  const v = sheet_(QUESTIONS, QHEAD).getDataRange().getValues().slice(1);
  return v.filter(r => r[0]).map(r => ({ id: String(r[0]), title: r[1], context: r[2], prompts: JSON.parse(r[3] || "[]") }));
}

function doGet(e) {
  try {
    if (e.parameter.action === "questions") return json_({ ok: true, questions: questions_() });
    return json_({ ok: false, error: "unknown action" });
  } catch (err) { return json_({ ok: false, error: String(err) }); }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const b = JSON.parse(e.postData.contents);

    if (b.action === "submit") {
      const name = String(b.name || "").trim();
      if (!name || !Array.isArray(b.rows) || !b.rows.length) throw new Error("empty");
      const sh = sheet_(ANSWERS, AHEAD);
      // повторна відправка з тим самим ім'ям замінює попередню
      const all = sh.getDataRange().getValues();
      const keep = all.slice(1).filter(r => String(r[1]).trim().toLowerCase() !== name.toLowerCase());
      const ts = new Date().toISOString();
      const fresh = b.rows.map(r => [ts, name, r.qid, r.question, r.pi, r.prompt, r.text]);
      const out = keep.concat(fresh);
      if (all.length > 1) sh.getRange(2, 1, all.length - 1, AHEAD.length).clearContent();
      sh.getRange(2, 1, out.length, AHEAD.length).setValues(out);
      return json_({ ok: true });
    }

    if (b.pin !== ADMIN_PIN) throw new Error("Невірний PIN");

    if (b.action === "answers") {
      const v = sheet_(ANSWERS, AHEAD).getDataRange().getValues().slice(1);
      return json_({ ok: true, rows: v.map(r => ({ ts: r[0], name: String(r[1]), qid: String(r[2]), question: r[3], pi: r[4], prompt: r[5], text: String(r[6]) })) });
    }

    if (b.action === "saveQuestions") {
      const sh = sheet_(QUESTIONS, QHEAD);
      const last = sh.getLastRow();
      if (last > 1) sh.getRange(2, 1, last - 1, QHEAD.length).clearContent();
      const rows = b.questions.map(q => [q.id, q.title, q.context, JSON.stringify(q.prompts)]);
      if (rows.length) sh.getRange(2, 1, rows.length, QHEAD.length).setValues(rows);
      return json_({ ok: true });
    }

    throw new Error("unknown action");
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

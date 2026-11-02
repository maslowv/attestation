// Шар доступу до даних. Є URL у config.js — працює з Google Apps Script,
// ні — з localStorage (демо-режим).
const API = (() => {
  const url = (window.CONFIG || {}).API_URL;
  const demo = !url;
  const DEMO_PIN = "1234";
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  async function post(body) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body)
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "Помилка сервера");
    return j;
  }

  async function getQuestions() {
    let list;
    if (demo) list = store.get("att_demo_questions", []);
    else {
      const r = await fetch(url + "?action=questions");
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Помилка сервера");
      list = j.questions;
    }
    return list.length ? list : structuredClone(window.SEED_QUESTIONS);
  }

  async function submit(name, rows) {
    if (!demo) return post({ action: "submit", name, rows });
    const all = store.get("att_demo_answers", []).filter(r => r.name.toLowerCase() !== name.toLowerCase());
    const ts = new Date().toISOString();
    store.set("att_demo_answers", all.concat(rows.map(r => ({ ...r, name, ts }))));
  }

  async function getAnswers(pin) {
    if (!demo) return (await post({ action: "answers", pin })).rows;
    if (pin !== DEMO_PIN) throw new Error("Невірний PIN");
    return store.get("att_demo_answers", []);
  }

  async function saveQuestions(pin, questions) {
    if (!demo) return post({ action: "saveQuestions", pin, questions });
    if (pin !== DEMO_PIN) throw new Error("Невірний PIN");
    store.set("att_demo_questions", questions);
  }

  const uid = () => "q" + Math.random().toString(36).slice(2, 9);
  return { demo, getQuestions, submit, getAnswers, saveQuestions, uid, store };
})();

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const KEY = "leave-data-v1";
const COLORS = ["#6d3fd6","#0f766e","#b4451f","#2563eb","#c026a3","#4d7c0f","#b45309","#475569"];
const LABEL = { full: "연차", am: "오전반차", pm: "오후반차" }, SHORT = { full: "연차", am: "오전", pm: "오후" };
const COST = { full: 1, am: .5, pm: .5 };
const DOW = "일월화수목금토";
const ORG = { "10-15": "개원기념일" };   /* 매년 반복되는 병원 기념일 (파란 글씨, 입력 불가) */

/* 대한민국 공휴일 (대체공휴일 포함). 2030년 이후는 아래에 추가하세요. */
const H = {};
const addH = (y, list) => list.forEach(([md, n]) => H[`${y}-${md}`] = n);
addH(2026, [["01-01","신정"],["02-16","설날 연휴"],["02-17","설날"],["02-18","설날 연휴"],["03-01","삼일절"],["03-02","대체공휴일"],["05-01","노동절"],["05-05","어린이날"],["05-24","부처님오신날"],["05-25","대체공휴일"],["06-03","지방선거"],["06-06","현충일"],["07-17","제헌절"],["08-15","광복절"],["08-17","대체공휴일"],["09-24","추석 연휴"],["09-25","추석"],["09-26","추석 연휴"],["09-28","대체공휴일"],["10-03","개천절"],["10-05","대체공휴일"],["10-09","한글날"],["12-25","성탄절"]]);
addH(2027, [["01-01","신정"],["02-06","설날 연휴"],["02-07","설날"],["02-08","설날 연휴"],["02-09","대체공휴일"],["03-01","삼일절"],["05-01","노동절"],["05-03","대체공휴일"],["05-05","어린이날"],["05-13","부처님오신날"],["06-06","현충일"],["07-17","제헌절"],["07-19","대체공휴일"],["08-15","광복절"],["08-16","대체공휴일"],["09-14","추석 연휴"],["09-15","추석"],["09-16","추석 연휴"],["10-03","개천절"],["10-04","대체공휴일"],["10-09","한글날"],["10-11","대체공휴일"],["12-25","성탄절"],["12-27","대체공휴일"]]);
addH(2028, [["01-01","신정"],["01-26","설날 연휴"],["01-27","설날"],["01-28","설날 연휴"],["03-01","삼일절"],["04-12","국회의원선거"],["05-01","노동절"],["05-02","부처님오신날"],["05-05","어린이날"],["06-06","현충일"],["07-17","제헌절"],["08-15","광복절"],["10-02","추석 연휴"],["10-03","추석·개천절"],["10-04","추석 연휴"],["10-05","대체공휴일"],["10-09","한글날"],["12-25","성탄절"]]);
addH(2029, [["01-01","신정"],["02-12","설날 연휴"],["02-13","설날"],["02-14","설날 연휴"],["03-01","삼일절"],["05-01","노동절"],["05-05","어린이날"],["05-07","대체공휴일"],["05-20","부처님오신날"],["05-21","대체공휴일"],["06-06","현충일"],["07-17","제헌절"],["08-15","광복절"],["09-21","추석 연휴"],["09-22","추석"],["09-23","추석 연휴"],["09-24","대체공휴일"],["10-03","개천절"],["10-09","한글날"],["12-25","성탄절"]]);
const hol = ds => ORG[ds.slice(5)] ? { n: ORG[ds.slice(5)], org: 1 } : H[ds] ? { n: H[ds] } : null;

const remote = !!(CONFIG.projectId && CONFIG.apiKey);
const API = `https://firestore.googleapis.com/v1/projects/${CONFIG.projectId}/databases/(default)/documents/app/data?key=${CONFIG.apiKey}`;

let S = { people: [], leaves: [] }, tab = "me", cur = null, adding = false, ym = new Date();
ym.setDate(1);
const NOW = new Date(), TODAY = ymd(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function pad(n) { return String(n).padStart(2, "0"); }
function ymd(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
const fmt = n => String(Math.round(n * 10) / 10);
const uid = () => Math.random().toString(36).slice(2, 10);
const col = id => COLORS[Math.max(0, S.people.findIndex(p => p.id === id)) % COLORS.length];

/* ===== 연차 계산 ===== */
/* 발생: 매년 매월 1일 1개 + 7월에 3개 추가 (연 15개). 현재 날짜까지 누적된 만큼만 발생 */
const accAt = (y, m) => y < 2026 ? 0 : m + (m >= 7 ? 3 : 0);
function accrued(y) {
  const ny = NOW.getFullYear();
  return y < ny ? accAt(y, 12) : y === ny ? accAt(y, NOW.getMonth() + 1) : 0;
}
function used(pid, y) { return S.leaves.filter(l => l.pid === pid && l.date.startsWith(y + "-")).reduce((a, l) => a + COST[l.type], 0); }
/* 이월: 전년도 말(연말 전체 발생 기준) 잔여를 다음 해로 이월, 해마다 누적 */
/* 사람마다 시작 연도(sy)가 있음: 추가된 해부터 계산. sy가 없는 기존 팀원은 2026년부터 */
const startY = pid => { const p = S.people.find(q => q.id === pid); return Math.max(2026, (p && p.sy) || 2026); };
function carry(pid, y) {
  const s = startY(pid); let c = 0;
  for (let k = s; k < y; k++) c = accAt(k, 12) + c - used(pid, k);
  return y <= s ? 0 : c;
}
const stat = (pid, y) => { const a = y < startY(pid) ? 0 : accrued(y), c = carry(pid, y), u = used(pid, y); return { a, c, u, r: a + c - u }; };

/* ===== 저장소 ===== */
function seed() { return { people: [], leaves: [] }; }
/* ===== 로그인 (Firebase Auth REST, 이메일/비밀번호) ===== */
const AUTHAPI = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + CONFIG.apiKey;
const REFRESHAPI = "https://securetoken.googleapis.com/v1/token?key=" + CONFIG.apiKey;
let AUTH = null;
try { AUTH = JSON.parse(localStorage.getItem("leave-auth")); } catch (e) {}
function setAuth(a) {
  AUTH = a;
  try { a ? localStorage.setItem("leave-auth", JSON.stringify(a)) : localStorage.removeItem("leave-auth"); } catch (e) {}
}
const toAuth = (id, refresh, sec) => ({ idToken: id, refreshToken: refresh, exp: Date.now() + (Number(sec) - 60) * 1000 });
async function signIn(email, pw) {
  const r = await fetch(AUTHAPI, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: pw, returnSecureToken: true }) });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || String(r.status));
  setAuth(toAuth(j.idToken, j.refreshToken, j.expiresIn));
}
async function token() {
  if (!AUTH) throw new Error("NO_AUTH");
  if (Date.now() > AUTH.exp) {
    const r = await fetch(REFRESHAPI, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(AUTH.refreshToken) });
    const j = await r.json();
    if (!r.ok) { setAuth(null); throw new Error("NO_AUTH"); }
    setAuth(toAuth(j.id_token, j.refresh_token, j.expires_in));
  }
  return AUTH.idToken;
}
async function fs(url, opt) {
  const o = opt || {};
  o.headers = Object.assign({ Authorization: "Bearer " + await token() }, o.headers || {});
  const r = await fetch(url, o);
  if (r.status === 401) { setAuth(null); throw new Error("NO_AUTH"); }
  return r;
}

/* 문서와 함께 마지막 수정 시각(ver)을 돌려줍니다. 저장할 때 이 시각이 그대로일 때만 쓰기가 허용되므로,
   그 사이 다른 사람이 저장했다면 덮어쓰지 않고 충돌로 처리합니다. */
async function loadRaw() {
  if (remote) {
    const r = await fs(API);
    if (r.status === 404) return { d: { people: [], leaves: [] }, ver: null };
    if (!r.ok) throw new Error("Firestore " + r.status);
    const j = await r.json();
    return { d: JSON.parse(j.fields.json.stringValue), ver: j.updateTime };
  }
  try { const t = localStorage.getItem(KEY); if (t) return { d: JSON.parse(t), ver: null }; } catch (e) {}
  return { d: seed(), ver: null };
}
const load = async () => (await loadRaw()).d;
async function save(d, ver) {
  if (remote) {
    /* ver 가 있으면 "그 시각 이후 바뀌지 않았을 때만", 없으면(문서가 아직 없음) "아직 없을 때만" 저장 */
    const pre = ver ? "&currentDocument.updateTime=" + encodeURIComponent(ver) : "&currentDocument.exists=false";
    const r = await fs(API + "&updateMask.fieldPaths=json" + pre, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: { json: { stringValue: JSON.stringify(d) } } }) });
    if (!r.ok) {
      let st = ""; try { st = (await r.json()).error.status; } catch (e) {}
      if (r.status === 409 || st === "FAILED_PRECONDITION" || st === "ABORTED") throw new Error("CONFLICT");
      throw new Error("Firestore " + r.status);
    }
  } else try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
}
/* 읽기 → 변경 → 저장. 충돌하면 최신 데이터를 다시 읽어 같은 변경을 다시 적용합니다 (최대 5번). */
async function mutate(fn) {
  try {
    for (let i = 0; ; i++) {
      const { d, ver } = remote ? await loadRaw() : { d: S, ver: null };
      fn(d);
      try { await save(d, ver); S = d; break; }
      catch (e) { if (e.message !== "CONFLICT" || i >= 4) throw e; }
    }
  } catch (e) {
    if (e.message !== "NO_AUTH") alert(e.message === "CONFLICT" ? "다른 사람이 동시에 저장하고 있어요. 잠시 후 다시 시도해 주세요." : e.message.includes("403") ? "접근 권한이 없는 계정이에요." : "저장 실패: " + e.message);
  }
  render();
}

/* ===== 화면 ===== */
const dname = ds => { const d = new Date(ds + "T00:00:00"); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`; };
function monthCells() {
  const y = ym.getFullYear(), m = ym.getMonth(), f = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate(), o = [];
  for (let i = 0; i < f; i++) o.push(0);
  for (let d = 1; d <= n; d++) o.push(d);
  while (o.length % 7) o.push(0);
  return o;
}
function calendar(mode) {
  const y = ym.getFullYear(), m = ym.getMonth();
  let h = `<div class="mh"><b>${y}년 ${m + 1}월</b><span><button class="sq" data-nav="-1">‹</button> <button class="sq" data-nav="1">›</button></span></div><div class="grid ${mode === "team" ? "tm" : ""}">`;
  h += [...DOW].map((c, i) => `<div class="dow" style="${i == 0 ? "color:var(--rd)" : i == 6 ? "color:var(--bl)" : ""}">${c}</div>`).join("");
  monthCells().forEach((d, i) => {
    if (!d) return h += `<div></div>`;
    const ds = ymd(y, m, d), w = i % 7, ho = hol(ds), off = w == 0 || w == 6 || !!ho;
    const ls = S.leaves.filter(l => l.date === ds && (mode === "team" || l.pid === cur));
    let cls = "c " + (w == 0 ? "sun " : w == 6 ? "sat " : "") + (ho ? (ho.org ? "org " : "hol ") : "") + (ds === TODAY ? "today " : "");
    let inner = `<span class="n">${d}</span>` + (ho ? `<span class="hn">${esc(ho.n).replace("대체공휴일", "대체<wbr>공휴일").replace("개원기념일", "개원<wbr>기념일").replace("부처님오신날", "부처님<wbr>오신날")}</span>` : "");
    let style = "";
    if (mode === "me") {
      if (off && !ho && ls.length === 0) cls += "pl";
      else cls += "box ";
      if (!off) cls += "go ";
      if (ls[0]) { const c = col(cur); style = `background:${c}22;border-color:${c}55`; inner += `<span class="lb" style="color:${c}">${SHORT[ls[0].type]}</span>`; }
    } else {
      cls += "box ";
      if (ls.length > 1) inner += `<span class="cnt">${ls.length}명</span>`;
      ls.forEach(l => { const p = S.people.find(q => q.id === l.pid); if (p) inner += `<span class="ch" style="background:${col(p.id)}22;color:${col(p.id)}">${esc(p.name)}${l.type === "full" ? "" : " " + SHORT[l.type]}</span>`; });
    }
    h += `<div class="${cls}" style="${style}" ${mode === "me" && !off ? `data-date="${ds}"` : ""}>${inner}</div>`;
  });
  return h + "</div>";
}
function table() {
  const y = ym.getFullYear(), cy = S.people.some(p => carry(p.id, y) !== 0);
  return `<div class="ttl">${y}년 팀원별 연차</div><div class="mu">${S.people.length}명</div><table><tr><th>이름</th><th>발생</th>${cy ? "<th>이월</th>" : ""}<th>사용</th><th>잔여</th><th></th></tr>` +
      S.people.map(p => { const s = stat(p.id, y); return `<tr><td><a class="lk" data-go="${p.id}" style="font-size:inherit;text-decoration:none"><span class="dot" style="background:${col(p.id)}"></span> ${esc(p.name)}</a></td><td>${fmt(s.a)}</td>${cy ? `<td>${fmt(s.c)}</td>` : ""}<td>${fmt(s.u)}</td><td><b ${s.r < 0 ? 'style="color:var(--rd)"' : ""}>${fmt(s.r)}</b></td><td><a class="lk" data-rm="${p.id}">삭제</a></td></tr>`; }).join("") + "</table>";
}
const gated = () => remote && !AUTH;
function renderLogin(msg) {
  $("#v").innerHTML = `<div class="card" style="max-width:360px;margin:30px auto"><div class="ttl" style="font-size:17px;margin-bottom:10px">로그인</div><div style="display:flex;flex-direction:column;gap:8px"><input id="em" type="text" placeholder="아이디" autocomplete="username" autocapitalize="none" spellcheck="false" style="width:100%"><input id="pw" type="password" placeholder="비밀번호" autocomplete="current-password" style="width:100%"><button class="b p" data-login="1">로그인</button><div class="mu" style="color:var(--rd)">${esc(msg || "")}</div></div></div>`;
  const em = $("#em"); if (em) em.focus();
}
async function doLogin() {
  const id = $("#em").value.trim().toLowerCase(), pw = $("#pw").value;
  if (!id || !pw) return renderLogin("아이디와 비밀번호를 입력해 주세요.");
  const email = id.includes("@") ? id : id + "@" + CONFIG.idDomain;
  try { await signIn(email, pw); S = await load(); render(); }
  catch (e) {
    const m = e.message;
    if (AUTH && m.includes("403")) { setAuth(null); return renderLogin("접근 권한이 없는 계정이에요."); }
    renderLogin(/INVALID|NOT_FOUND|PASSWORD/.test(m) ? "아이디 또는 비밀번호가 올바르지 않아요." : /TOO_MANY/.test(m) ? "시도가 너무 많아요. 잠시 후 다시 해 주세요." : "로그인 실패: " + m);
  }
}
function render() {
  const g = gated();
  $(".seg").style.display = $(".yr").style.display = g ? "none" : "";
  $("#lo").style.display = remote && AUTH ? "" : "none";
  if (g) { $("#mode").textContent = ""; $("#today").textContent = ""; return renderLogin(); }
  const y = ym.getFullYear(), m = ym.getMonth();
  $("#today").textContent = `${NOW.getFullYear()}년 ${NOW.getMonth() + 1}월 ${NOW.getDate()}일 ${DOW[NOW.getDay()]}요일 기준`;
  $("#yl").textContent = y + "년"; $("#yp").disabled = y <= 2026;
  document.querySelectorAll(".seg button").forEach(b => b.classList.toggle("on", b.dataset.t === tab));
  $("#mode").textContent = remote ? "" : "※ 데모 모드: 데이터가 이 브라우저에만 저장됩니다. (Firebase 설정 후 팀 공유)";
  if (!S.people.find(p => p.id === cur)) cur = S.people[0] ? S.people[0].id : null;
  const v = $("#v");
  const addBtn = adding ? `<span class="pc add"><input id="nm" maxlength="20" placeholder="이름"><button class="b p" data-ok="1">추가</button></span>` : `<span class="pc add" data-addp="1">+ 팀원 추가</span>`;
  if (tab === "team") {
    const rows = {}; S.leaves.filter(l => l.date.startsWith(`${y}-${pad(m + 1)}`)).forEach(l => (rows[l.date] = rows[l.date] || []).push(l));
    const list = Object.keys(rows).sort().map(ds => `<div class="r"><span class="mu" style="white-space:nowrap">${new Date(ds + "T00:00:00").getDate()}일 (${DOW[new Date(ds + "T00:00:00").getDay()]})</span><span class="chips" style="justify-content:flex-end">${rows[ds].map(l => { const p = S.people.find(q => q.id === l.pid); return p ? `<span class="tag" style="background:${col(p.id)}22;color:${col(p.id)}"><b>${esc(p.name)}</b> ${LABEL[l.type]}</span>` : ""; }).join("")}</span></div>`).join("");
    v.innerHTML = `<div class="two"><div class="card">${calendar("team")}<div class="ul" style="margin-top:12px;border-top:1px solid var(--bd);padding-top:10px"><div class="ttl">${m + 1}월 휴가 목록</div>${list || '<div class="mu" style="padding:8px 0">입력된 휴가가 없어요</div>'}</div></div><div class="card">${S.people.length ? table() : '<span class="mu">구성원이 없습니다</span>'}<div class="chips" style="margin-top:10px">${addBtn}</div></div></div>`;
  } else if (!S.people.length) {
    v.innerHTML = `<div class="card"><div class="chips">${addBtn}</div><p class="mu">먼저 팀원을 추가해 주세요.</p></div>`;
  } else {
    const s = stat(cur, y), tot = s.a + s.c, pc = tot > 0 ? Math.max(0, Math.min(100, Math.round(s.u / tot * 100))) : 0, c = col(cur);
    const mine = S.leaves.filter(l => l.pid === cur && l.date.startsWith(y + "-")).sort((a, b) => a.date < b.date ? -1 : 1);
    const nm = y < NOW.getFullYear() ? 12 : y === NOW.getFullYear() ? NOW.getMonth() + 1 : 0;
    const accSub = nm ? `매월 1일 ${nm}개${nm >= 7 ? " + 7월 3개" : ""}` : "아직 발생 전 (매월 1일 1개)";
    const strip = Array.from({ length: 12 }, (_, i) => { const mm = i + 1, cnt = S.leaves.filter(l => l.pid === cur && l.date.startsWith(`${y}-${pad(mm)}`)).reduce((a, l) => a + COST[l.type], 0), fut = y > NOW.getFullYear() || (y === NOW.getFullYear() && mm > NOW.getMonth() + 1); return `<div class="mo ${mm === m + 1 ? "on" : ""} ${fut ? "fut" : ""}" data-m="${i}">${mm}월${mm === 7 ? "<sup>+3</sup>" : ""}<b>${accAt(y, mm)}</b>${cnt ? `<u>사용 ${fmt(cnt)}</u>` : ""}</div>`; }).join("");
    v.innerHTML = `<div class="card"><div class="chips">${S.people.map(p => `<span class="pc ${p.id === cur ? "on" : ""}" data-p="${p.id}"><span class="dot" style="background:${col(p.id)}"></span>${esc(p.name)}</span>`).join("")}${addBtn}</div></div>
    <div class="card"><div class="ttl"><span class="dot" style="background:${c}"></span> ${esc(S.people.find(p => p.id === cur).name)} · ${y}년${s.c !== 0 ? ` <span class="tag" style="background:var(--bl);color:#fff">↪ ${y - 1}년에서 ${fmt(s.c)}일 이월</span>` : ""}</div>
    <div class="stats"><div class="s"><small>발생연차</small><b style="color:var(--pu)">${fmt(s.a)}</b> <span>일</span><em>${accSub}</em></div>
    ${s.c !== 0 ? `<div class="s"><small>이월연차</small><b style="color:var(--bl)">${fmt(s.c)}</b> <span>일</span><em>${y - 1}년 잔여 이월</em></div>` : ""}
    <div class="s"><small>사용연차</small><b style="color:var(--br)">${fmt(s.u)}</b> <span>일</span><em>${mine.length}건 입력</em></div>
    <div class="s"><small>잔여연차</small><b ${s.r < 0 ? 'style="color:var(--rd)"' : ""}>${fmt(s.r)}</b> <span>일</span><em>${s.c !== 0 ? `이월 ${fmt(s.c)} 포함` : "발생 − 사용"}</em></div></div>
    <div class="bar"><i style="width:${pc}%"></i></div><div class="bf"><span>사용 ${fmt(s.u)} / ${s.c !== 0 ? "발생+이월" : "발생"} ${fmt(tot)}</span><span>${pc}% 사용</span></div></div>
    <div class="card"><div class="strip">${strip}</div></div>
    <div class="two"><div class="card">${calendar("me")}<div class="mu" style="margin-top:8px">평일을 눌러 입력 · 공휴일과 개원기념일은 입력할 수 없어요</div></div>
    <div class="card ul"><div class="ttl">${y}년 ${esc(S.people.find(p => p.id === cur).name)} 사용 내역</div><div class="mu">${mine.length}건</div>${s.c !== 0 ? `<div class="r"><span>1월 1일 · ${y - 1}년 잔여 이월</span><span class="tag" style="background:var(--bl);color:#fff">이월 ${s.c >= 0 ? "+" : ""}${fmt(s.c)}</span></div>` : ""}${mine.map(l => `<div class="r"><span>${dname(l.date)}${l.date > TODAY ? ' <span class="mu">예정</span>' : ""}</span><span><span class="tag">${LABEL[l.type]} ${COST[l.type]}</span> <a class="lk" data-del="${l.id}">취소</a></span></div>`).join("") || '<div class="mu" style="padding:8px 0">입력된 내역이 없어요</div>'}</div></div>`;
  }
  const inp = $("#nm"); if (inp) inp.focus();
}

function popup(date) {
  const ex = S.leaves.find(l => l.pid === cur && l.date === date);
  const p = document.createElement("div"); p.className = "pop";
  p.innerHTML = `<div><b>${dname(date)}</b>${["full", "am", "pm"].map(k => `<button class="b ${ex && ex.type === k ? "p" : ""}" data-set="${k}">${LABEL[k]}</button>`).join("")}${ex ? `<button class="b" data-set="del" style="color:var(--rd)">삭제</button>` : ""}<button class="b" data-set="x">닫기</button></div>`;
  p.addEventListener("click", e => {
    const k = e.target.dataset.set;
    if (e.target === p || k === "x") return p.remove();
    if (!k) return;
    p.remove();
    mutate(d => { d.leaves = d.leaves.filter(l => !(l.pid === cur && l.date === date)); if (k !== "del") d.leaves.push({ id: uid(), pid: cur, date, type: k }); });
  });
  document.body.appendChild(p);
}
function addPerson() { const n = ($("#nm") || {}).value; adding = false; if (n && n.trim()) mutate(d => d.people.push({ id: uid(), name: n.trim(), sy: NOW.getFullYear() })); else render(); }

document.addEventListener("click", e => {
  const t = e.target, q = s => t.closest(s);
  if (q("[data-t]")) { tab = q("[data-t]").dataset.t; render(); }
  else if (q("[data-y]")) { const ny = ym.getFullYear() + +q("[data-y]").dataset.y; if (ny >= 2026) { ym.setFullYear(ny); render(); } }
  else if (q("[data-nav]")) { ym.setMonth(ym.getMonth() + +q("[data-nav]").dataset.nav); render(); }
  else if (q("[data-m]")) { ym.setMonth(+q("[data-m]").dataset.m); render(); }
  else if (q("[data-p]")) { cur = q("[data-p]").dataset.p; render(); }
  else if (q("[data-go]")) { cur = q("[data-go]").dataset.go; tab = "me"; render(); }
  else if (q("[data-rm]")) {
    const id = q("[data-rm]").dataset.rm, p = S.people.find(x => x.id === id);
    if (p && confirm(`${p.name} 님과 연차 기록을 모두 삭제할까요?`)) mutate(d => { d.people = d.people.filter(x => x.id !== id); d.leaves = d.leaves.filter(l => l.pid !== id); });
  }
  else if (q("[data-date]")) popup(q("[data-date]").dataset.date);
  else if (q("[data-del]")) { const id = q("[data-del]").dataset.del; mutate(d => d.leaves = d.leaves.filter(l => l.id !== id)); }
  else if (q("[data-addp]")) { adding = true; render(); }
  else if (q("[data-ok]")) addPerson();
  else if (q("[data-login]")) doLogin();
  else if (q("[data-lo]")) { setAuth(null); S = { people: [], leaves: [] }; render(); }
});
document.addEventListener("keydown", e => { if (e.key !== "Enter") return; if (e.target.id === "nm") addPerson(); else if (e.target.id === "pw" || e.target.id === "em") doLogin(); });

(async function init() {
  if (!gated()) { try { S = await load(); } catch (e) { if (e.message !== "NO_AUTH") alert("불러오기 실패: " + e.message); } }
  render();
  if (remote) setInterval(async () => { if (AUTH && !document.querySelector(".pop") && !adding) { try { S = await load(); render(); } catch (e) {} } }, 30000);
})();
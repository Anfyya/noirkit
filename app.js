const TOOLS = [
  { id: "json", name: "JSON", keys: "format validate 格式化", render: jsonTool },
  { id: "jwt", name: "JWT", keys: "token decode 拆包", render: jwtTool },
  { id: "hash", name: "Hash", keys: "sha256 sha1 sha512 digest", render: hashTool },
  { id: "time", name: "时间戳", keys: "timestamp unix epoch date", render: timeTool },
  { id: "base64", name: "Base64", keys: "encode decode 编码", render: base64Tool },
  { id: "url", name: "URL", keys: "encode decode query", render: urlTool },
  { id: "regex", name: "正则", keys: "regexp test match", render: regexTool },
  { id: "uuid", name: "UUID", keys: "guid random id", render: uuidTool },
];

const stage = document.getElementById("stage");
const rail = document.getElementById("rail");
const palette = document.getElementById("palette");
const paletteInput = document.getElementById("paletteInput");
const paletteList = document.getElementById("paletteList");

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function copy(text) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function toolButtons() {
  rail.innerHTML = "";
  TOOLS.forEach((t) => {
    const b = document.createElement("button");
    b.textContent = t.name;
    b.dataset.id = t.id;
    b.onclick = () => openTool(t.id);
    rail.appendChild(b);
  });
}

function openTool(id) {
  const tool = TOOLS.find((t) => t.id === id) || TOOLS[0];
  [...rail.querySelectorAll("button")].forEach((b) => {
    b.classList.toggle("active", b.dataset.id === tool.id);
  });
  stage.innerHTML = "";
  stage.appendChild(tool.render());
  history.replaceState(null, "", `#${tool.id}`);
  localStorage.setItem("noirkit.tool", tool.id);
}

function jsonTool() {
  const root = el(`<div class="grid">
    <div><label>输入 JSON</label><textarea id="in" placeholder='{"ok": true}'></textarea></div>
    <div class="row">
      <button class="btn" id="fmt">格式化</button>
      <button class="ghost" id="min">压缩</button>
      <button class="ghost" id="sort">按 key 排序</button>
      <button class="ghost" id="cpy">复制结果</button>
      <span class="meta" id="msg"></span>
    </div>
    <div><label>输出</label><textarea id="out" readonly></textarea></div>
  </div>`);
  const input = root.querySelector("#in");
  const out = root.querySelector("#out");
  const msg = root.querySelector("#msg");
  const parse = () => JSON.parse(input.value);
  const run = (fn) => {
    try {
      const v = fn(parse());
      out.value = typeof v === "string" ? v : JSON.stringify(v, null, 2);
      msg.className = "meta ok";
      msg.textContent = "有效 JSON";
    } catch (e) {
      msg.className = "meta err";
      msg.textContent = e.message;
    }
  };
  const sortKeys = (v) => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === "object") {
      return Object.keys(v).sort().reduce((a, k) => { a[k] = sortKeys(v[k]); return a; }, {});
    }
    return v;
  };
  root.querySelector("#fmt").onclick = () => run((v) => v);
  root.querySelector("#min").onclick = () => run((v) => JSON.stringify(v));
  root.querySelector("#sort").onclick = () => run(sortKeys);
  root.querySelector("#cpy").onclick = () => copy(out.value);
  return root;
}

function splitJwt(token) {
  const raw = token.trim();
  const parts = raw.split(".");
  if (parts.length < 2) throw new Error("不是有效的 JWT 结构");
  const dec = (p) => {
    const pad = p.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((p.length + 3) % 4);
    const json = decodeURIComponent(Array.from(atob(pad), (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""));
    return JSON.parse(json);
  };
  return { header: dec(parts[0]), payload: dec(parts[1]), signature: parts[2] || "" };
}

function jwtTool() {
  const root = el(`<div class="grid">
    <div><label>JWT</label><textarea id="in" placeholder="eyJhbGciOi..."></textarea></div>
    <div class="row"><button class="btn" id="go">拆包</button><span class="meta">只解码，不验证签名</span></div>
    <pre class="out" id="out"></pre>
  </div>`);
  root.querySelector("#go").onclick = () => {
    const out = root.querySelector("#out");
    try {
      out.className = "out ok";
      out.textContent = JSON.stringify(splitJwt(root.querySelector("#in").value), null, 2);
    } catch (e) {
      out.className = "out err";
      out.textContent = e.message;
    }
  };
  return root;
}

async function digest(algo, text) {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hashTool() {
  const root = el(`<div class="grid">
    <div><label>原文</label><textarea id="in"></textarea></div>
    <div class="row">
      <button class="btn" data-a="SHA-256">SHA-256</button>
      <button class="ghost" data-a="SHA-1">SHA-1</button>
      <button class="ghost" data-a="SHA-512">SHA-512</button>
      <button class="ghost" id="cpy">复制</button>
    </div>
    <pre class="out" id="out"></pre>
  </div>`);
  const out = root.querySelector("#out");
  root.querySelectorAll("[data-a]").forEach((b) => {
    b.onclick = async () => {
      try {
        out.className = "out ok";
        out.textContent = await digest(b.dataset.a, root.querySelector("#in").value);
      } catch (e) {
        out.className = "out err";
        out.textContent = e.message;
      }
    };
  });
  root.querySelector("#cpy").onclick = () => copy(out.textContent);
  return root;
}

function timeTool() {
  const now = Date.now();
  const root = el(`<div class="grid">
    <div class="chips">
      <span class="chip">本地：${new Date(now).toLocaleString()}</span>
      <span class="chip">Unix ms：${now}</span>
      <span class="chip">Unix s：${Math.floor(now / 1000)}</span>
    </div>
    <div><label>时间戳或日期字符串</label><input type="text" id="in" placeholder="1710000000 或 2026-09-12 05:00:00" /></div>
    <div class="row"><button class="btn" id="go">转换</button><button class="ghost" id="now">填入现在</button></div>
    <pre class="out" id="out"></pre>
  </div>`);
  const convert = () => {
    const raw = root.querySelector("#in").value.trim();
    const out = root.querySelector("#out");
    try {
      let d;
      if (/^-?\d+$/.test(raw)) {
        const n = Number(raw);
        d = new Date(n < 1e12 ? n * 1000 : n);
      } else d = new Date(raw);
      if (Number.isNaN(d.getTime())) throw new Error("无法解析");
      out.className = "out ok";
      out.textContent = JSON.stringify({ iso: d.toISOString(), local: d.toLocaleString(), unix_s: Math.floor(d.getTime() / 1000), unix_ms: d.getTime(), utc: d.toUTCString() }, null, 2);
    } catch (e) {
      out.className = "out err";
      out.textContent = e.message;
    }
  };
  root.querySelector("#go").onclick = convert;
  root.querySelector("#now").onclick = () => { root.querySelector("#in").value = String(Date.now()); convert(); };
  return root;
}

function base64Tool() {
  const root = el(`<div class="grid split">
    <div><label>原文</label><textarea id="plain"></textarea></div>
    <div><label>Base64</label><textarea id="b64"></textarea></div>
    <div class="row"><button class="btn" id="enc">编码 →</button><button class="ghost" id="dec">← 解码</button></div>
  </div>`);
  const utf8ToB64 = (s) => btoa(unescape(encodeURIComponent(s)));
  const b64ToUtf8 = (s) => decodeURIComponent(escape(atob(s.replace(/\s/g, ""))));
  root.querySelector("#enc").onclick = () => { root.querySelector("#b64").value = utf8ToB64(root.querySelector("#plain").value); };
  root.querySelector("#dec").onclick = () => {
    try { root.querySelector("#plain").value = b64ToUtf8(root.querySelector("#b64").value); }
    catch { root.querySelector("#plain").value = "解码失败"; }
  };
  return root;
}

function urlTool() {
  const root = el(`<div class="grid">
    <div><label>文本 / URL</label><textarea id="in"></textarea></div>
    <div class="row"><button class="btn" id="enc">Encode</button><button class="ghost" id="dec">Decode</button></div>
    <pre class="out" id="out"></pre>
  </div>`);
  const out = root.querySelector("#out");
  root.querySelector("#enc").onclick = () => { out.className = "out ok"; out.textContent = encodeURIComponent(root.querySelector("#in").value); };
  root.querySelector("#dec").onclick = () => {
    try { out.className = "out ok"; out.textContent = decodeURIComponent(root.querySelector("#in").value); }
    catch (e) { out.className = "out err"; out.textContent = e.message; }
  };
  return root;
}

function regexTool() {
  const root = el(`<div class="grid">
    <div><label>正则（不含斜杠）</label><input type="text" id="re" placeholder="\\d+" /></div>
    <div><label>flags</label><input type="text" id="flags" value="g" /></div>
    <div><label>测试文本</label><textarea id="text"></textarea></div>
    <div class="row"><button class="btn" id="go">匹配</button></div>
    <pre class="out" id="out"></pre>
  </div>`);
  root.querySelector("#go").onclick = () => {
    const out = root.querySelector("#out");
    try {
      const re = new RegExp(root.querySelector("#re").value, root.querySelector("#flags").value);
      const matches = [...root.querySelector("#text").value.matchAll(re)].map((m) => ({ match: m[0], index: m.index, groups: m.slice(1) }));
      out.className = "out ok";
      out.textContent = matches.length ? JSON.stringify(matches, null, 2) : "无匹配";
    } catch (e) {
      out.className = "out err";
      out.textContent = e.message;
    }
  };
  return root;
}

function uuidTool() {
  const root = el(`<div class="grid">
    <div class="row">
      <button class="btn" id="one">生成 1 个</button>
      <button class="ghost" id="ten">生成 10 个</button>
      <button class="ghost" id="cpy">复制</button>
    </div>
    <pre class="out" id="out"></pre>
  </div>`);
  const out = root.querySelector("#out");
  const gen = (n) => { out.className = "out ok"; out.textContent = Array.from({ length: n }, () => crypto.randomUUID()).join("\n"); };
  root.querySelector("#one").onclick = () => gen(1);
  root.querySelector("#ten").onclick = () => gen(10);
  root.querySelector("#cpy").onclick = () => copy(out.textContent);
  gen(1);
  return root;
}

function filterTools(q) {
  const s = q.trim().toLowerCase();
  if (!s) return TOOLS;
  return TOOLS.filter((t) => `${t.name} ${t.id} ${t.keys}`.toLowerCase().includes(s));
}

function renderPalette(q) {
  const items = filterTools(q);
  paletteList.innerHTML = "";
  items.forEach((t, i) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.textContent = `${t.name}  ·  ${t.id}`;
    if (i === 0) b.classList.add("active");
    b.onclick = () => { closePalette(); openTool(t.id); };
    li.appendChild(b);
    paletteList.appendChild(li);
  });
}

function openPalette() {
  palette.hidden = false;
  paletteInput.value = "";
  renderPalette("");
  paletteInput.focus();
}
function closePalette() { palette.hidden = true; }

document.getElementById("openPalette").onclick = openPalette;
palette.addEventListener("click", (e) => { if (e.target === palette) closePalette(); });
paletteInput.addEventListener("input", () => renderPalette(paletteInput.value));
paletteInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePalette();
  if (e.key === "Enter") {
    const first = filterTools(paletteInput.value)[0];
    if (first) { closePalette(); openTool(first.id); }
  }
});
document.getElementById("themeBtn").onclick = () => {
  const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("noirkit.theme", next);
};
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(e.target.tagName)) {
    e.preventDefault();
    openPalette();
  }
  if (e.key === "Escape") closePalette();
});

toolButtons();
const savedTheme = localStorage.getItem("noirkit.theme");
if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
openTool(location.hash.replace("#", "") || localStorage.getItem("noirkit.tool") || "json");

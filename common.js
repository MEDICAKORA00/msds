// 공통 기능: 목록(CSV) 읽기 — 수정할 필요 없습니다.
(function () {
  var CFG = window.MSDS_CONFIG || {};

  // 엑셀에서 저장한 CSV는 UTF-8 또는 CP949(EUC-KR)일 수 있어 둘 다 처리
  function decode(buf) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buf);
    } catch (e) {
      return new TextDecoder("euc-kr").decode(buf);
    }
  }

  function parseCSV(text) {
    var rows = [], row = [], cell = "", q = false;
    text = text.replace(/^﻿/, "");
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
        } else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim() !== ""; }); });
  }

  var ALIASES = {
    code: ["코드", "번호", "관리번호", "no", "code"],
    name: ["물질명", "제품명", "화학물질명", "품명", "name"],
    cas: ["cas번호", "cas", "cas no", "cas no."],
    supplier: ["공급사", "제조사", "공급업체", "제조/공급사", "supplier"],
    loc: ["보관장소", "장소", "사용장소", "취급장소", "location"],
    file: ["파일명", "파일", "pdf", "file"],
    alias: ["별칭", "검색어", "다른이름", "alias"]
  };

  function rowsToItems(rows) {
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var idx = {};
    Object.keys(ALIASES).forEach(function (k) {
      idx[k] = head.findIndex(function (h) { return ALIASES[k].indexOf(h) >= 0; });
    });
    if (idx.name < 0) throw new Error("목록 첫 줄에 '물질명' 칸이 없습니다.");
    var get = function (r, k) { return idx[k] >= 0 ? (r[idx[k]] || "").trim() : ""; };
    return rows.slice(1).map(function (r) {
      var code = get(r, "code");
      var file = get(r, "file") || (code ? code + ".pdf" : "");
      if (file && !/\.[a-z0-9]{2,5}$/i.test(file)) file += ".pdf";
      return {
        code: code,
        name: get(r, "name"),
        cas: get(r, "cas"),
        supplier: get(r, "supplier"),
        locs: get(r, "loc").split(/[;,/|\n]/).map(function (s) { return s.trim(); }).filter(Boolean),
        file: file,
        alias: get(r, "alias")
      };
    }).filter(function (it) { return it.name; });
  }

  function loadFromBuffer(buf) { return rowsToItems(parseCSV(decode(buf))); }

  function loadList() {
    return fetch(CFG.listFile + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("목록 파일(" + CFG.listFile + ")을 찾을 수 없습니다.");
        return r.arrayBuffer();
      })
      .then(loadFromBuffer);
  }

  function pdfUrl(item) {
    if (!item.file) return "";
    if (/^https?:\/\//i.test(item.file)) return item.file; // 외부 링크도 허용
    return (CFG.pdfFolder || "") + item.file.split("/").map(encodeURIComponent).join("/");
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  window.MSDS = { loadList: loadList, loadFromBuffer: loadFromBuffer, pdfUrl: pdfUrl, esc: esc, config: CFG };
})();

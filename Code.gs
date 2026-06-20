// ============================================================
//  Code.gs — Google Apps Script
//  ระบบ Dashboard ข้อมูลสหกรณ์รายแห่ง
//  อัปเดตให้รองรับ 9 ประเภทสหกรณ์ + โครงสร้างใหม่
//
//  วิธีใช้:
//   1) เปิด Google Sheet → Extensions → Apps Script → วางโค้ดนี้ทับของเดิม
//   2) เลือกฟังก์ชัน setupSheets (ช่องลิสต์ฟังก์ชันด้านบน) → กด Run ครั้งเดียว
//      (จะมี popup ขอสิทธิ์ authorize ครั้งแรก — กด Allow)
//   3) Deploy → New deployment → เลือกประเภท "Web app"
//        - Execute as: Me
//        - Who has access: Anyone
//      → Deploy → คัดลอก Web app URL ที่ได้
//   4) นำ URL ไปวางในตัวแปร API_URL ของไฟล์ dashboard.html (ฝั่ง Front-end)
//
//  หมายเหตุเรื่อง CORS: ฝั่งหน้าเว็บต้องเรียก POST ด้วย
//  Content-Type: text/plain (ไม่ใช่ application/json) เพื่อให้เป็น "simple request"
//  ซึ่ง Apps Script Web App จะตอบกลับโดยไม่ต้องทำ CORS preflight (OPTIONS)
//  — ฝั่ง dashboard.html ที่ให้มาตั้งค่านี้ไว้ให้แล้ว ไม่ต้องแก้ไขเพิ่ม
// ============================================================

// ── ชื่อ Sheet (ต้องตรงกับที่สร้างใน Google Sheets) ──────────
const SHEET_COOP  = "ข้อมูลสหกรณ์";   // รายชื่อสหกรณ์รายแห่ง
const SHEET_YEAR  = "ข้อมูลรายปี";    // ข้อมูลประจำปี
const SHEET_REF   = "ค่าอ้างอิง";     // ค่า dropdown (ห้ามลบ)

// ── ประเภทสหกรณ์ที่รองรับ (9 ประเภท) ────────────────────────
const VALID_TYPES = [
  "สหกรณ์การเกษตร",
  "สหกรณ์ประมง",
  "สหกรณ์นิคม",
  "สหกรณ์ร้านค้า",
  "สหกรณ์ออมทรัพย์",
  "สหกรณ์บริการ",
  "สหกรณ์เครดิตยูเนี่ยน",
  "สหกรณ์แท็กซี่",
  "สหกรณ์เคหสถาน (บ้านมั่นคง)"
];

const VALID_STATUS = ["ดำเนินการปกติ", "อยู่ระหว่างแก้ไข", "ยุบเลิก"];

// ============================================================
//  doGet — ดึงข้อมูลทั้งหมด (Dashboard เรียกใช้)
// ============================================================
function doGet(e) {
  try {
    const ss     = SpreadsheetApp.getActiveSpreadsheet();
    const shCoop = ss.getSheetByName(SHEET_COOP);
    const shYear = ss.getSheetByName(SHEET_YEAR);

    if (!shCoop) return errResponse("ไม่พบ Sheet: " + SHEET_COOP);
    if (!shYear) return errResponse("ไม่พบ Sheet: " + SHEET_YEAR);

    // ── อ่าน Sheet ข้อมูลสหกรณ์ ──────────────────────────────
    // คอลัมน์: ชื่อสหกรณ์, ประเภท, เขต/อำเภอ, เลขทะเบียน,
    //          ปีจดทะเบียน, สถานะ, ที่อยู่, โทรศัพท์
    const coopRows = shCoop.getDataRange().getValues();
    const coops    = [];

    for (let i = 1; i < coopRows.length; i++) {
      const r = coopRows[i];
      if (!r[0]) continue; // ข้ามแถวว่าง
      coops.push({
        id:      "coop_" + i,
        name:    String(r[0]).trim(),
        type:    String(r[1]).trim(),
        area:    String(r[2]).trim(),
        regNo:   String(r[3] || "").trim(),
        regYear: Number(r[4]) || 0,
        status:  String(r[5] || "ดำเนินการปกติ").trim(),
        addr:    String(r[6] || "").trim(),
        phone:   String(r[7] || "").trim(),
        rowIdx:  i + 1  // แถวใน Sheet (เริ่มที่ 1)
      });
    }

    // ── อ่าน Sheet ข้อมูลรายปี ───────────────────────────────
    // คอลัมน์: ชื่อสหกรณ์, ปี, สมาชิก, สมาชิกสมทบ, ทุน, กำไร
    const yearRows = shYear.getDataRange().getValues();
    const yearMap  = {}; // key: "ชื่อสหกรณ์|ปี"

    for (let i = 1; i < yearRows.length; i++) {
      const r = yearRows[i];
      if (!r[0]) continue;
      const key = String(r[0]).trim() + "|" + String(r[1]).trim();
      yearMap[key] = {
        member:  Number(r[2]) || 0,
        assoc:   Number(r[3]) || 0,
        capital: Number(r[4]) || 0,
        profit:  Number(r[5]) || 0
      };
    }

    // ── ประกอบ years object ให้แต่ละสหกรณ์ ──────────────────
    coops.forEach(c => {
      c.years = {};
      ["2568", "2569"].forEach(yr => {
        const key = c.name + "|" + yr;
        c.years[yr] = yearMap[key] || { member: 0, assoc: 0, capital: 0, profit: 0 };
      });
      // คำนวณ trend
      const m68 = c.years["2568"].member;
      const m69 = c.years["2569"].member;
      c.trend = m69 > m68 ? "up" : m69 < m68 ? "down" : "flat";
    });

    const result = JSON.stringify({
      success:   true,
      coops:     coops,
      timestamp: new Date().toISOString(),
      total:     coops.length
    });

    return ContentService
      .createTextOutput(result)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return errResponse(err.toString());
  }
}

// ============================================================
//  doPost — บันทึก/แก้ไข/ลบข้อมูล (Admin เรียกใช้)
// ============================================================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // ── ตรวจสอบ credentials ──────────────────────────────────
    if (body.user !== "TTT" || body.pass !== "666") {
      return jsonResponse({ success: false, message: "Unauthorized" });
    }

    const action = body.action; // add | edit | delete | addYear | editYear

    if (action === "add")      return addCoop(body);
    if (action === "edit")     return editCoop(body);
    if (action === "delete")   return deleteCoop(body);
    if (action === "addYear")  return addYearData(body);
    if (action === "editYear") return editYearData(body);

    return jsonResponse({ success: false, message: "Unknown action: " + action });

  } catch (err) {
    return jsonResponse({ success: false, message: err.toString() });
  }
}

// ── เพิ่มสหกรณ์ใหม่ ──────────────────────────────────────────
function addCoop(body) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_COOP);
  if (!sheet) return jsonResponse({ success: false, message: "ไม่พบ Sheet: " + SHEET_COOP });

  // validate
  if (!body.name)   return jsonResponse({ success: false, message: "กรุณาระบุชื่อสหกรณ์" });
  if (!body.type)   return jsonResponse({ success: false, message: "กรุณาระบุประเภทสหกรณ์" });
  if (!body.area)   return jsonResponse({ success: false, message: "กรุณาระบุเขต/อำเภอ" });
  if (!VALID_TYPES.includes(body.type)) {
    return jsonResponse({ success: false, message: "ประเภทสหกรณ์ไม่ถูกต้อง: " + body.type });
  }
  if (body.status && !VALID_STATUS.includes(body.status)) {
    return jsonResponse({ success: false, message: "สถานะไม่ถูกต้อง: " + body.status });
  }

  // ตรวจสอบชื่อซ้ำ
  const rows = sheet.getDataRange().getValues();
  const dup  = rows.slice(1).find(r => String(r[0]).trim() === body.name.trim());
  if (dup) return jsonResponse({ success: false, message: "มีชื่อสหกรณ์นี้อยู่แล้ว" });

  sheet.appendRow([
    body.name.trim(),
    body.type.trim(),
    body.area.trim(),
    body.regNo    || "",
    body.regYear  || "",
    body.status   || "ดำเนินการปกติ",
    body.addr     || "",
    body.phone    || ""
  ]);

  // บันทึกข้อมูลรายปีด้วยถ้ามี
  if (body.member || body.capital) {
    addYearData({
      name:    body.name.trim(),
      year:    body.year || "2569",
      member:  body.member  || 0,
      assoc:   body.assoc   || 0,
      capital: body.capital || 0,
      profit:  body.profit  || 0
    });
  }

  return jsonResponse({ success: true, message: "เพิ่มสหกรณ์สำเร็จ: " + body.name });
}

// ── แก้ไขสหกรณ์ ───────────────────────────────────────────────
function editCoop(body) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_COOP);
  if (!sheet) return jsonResponse({ success: false, message: "ไม่พบ Sheet: " + SHEET_COOP });

  if (body.type && !VALID_TYPES.includes(body.type)) {
    return jsonResponse({ success: false, message: "ประเภทสหกรณ์ไม่ถูกต้อง: " + body.type });
  }
  if (body.status && !VALID_STATUS.includes(body.status)) {
    return jsonResponse({ success: false, message: "สถานะไม่ถูกต้อง: " + body.status });
  }

  const rows   = sheet.getDataRange().getValues();
  const rowIdx = rows.findIndex((r, i) => i > 0 && String(r[0]).trim() === String(body.originalName || body.name).trim());

  if (rowIdx < 0) return jsonResponse({ success: false, message: "ไม่พบสหกรณ์: " + body.originalName });

  const sheetRow = rowIdx + 1;
  sheet.getRange(sheetRow, 1, 1, 8).setValues([[
    body.name    || rows[rowIdx][0],
    body.type    || rows[rowIdx][1],
    body.area    || rows[rowIdx][2],
    body.regNo   !== undefined ? body.regNo   : rows[rowIdx][3],
    body.regYear !== undefined ? body.regYear : rows[rowIdx][4],
    body.status  || rows[rowIdx][5],
    body.addr    !== undefined ? body.addr    : rows[rowIdx][6],
    body.phone   !== undefined ? body.phone   : rows[rowIdx][7]
  ]]);

  return jsonResponse({ success: true, message: "แก้ไขสำเร็จ: " + body.name });
}

// ── ลบสหกรณ์ ─────────────────────────────────────────────────
function deleteCoop(body) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_COOP);
  if (!sheet) return jsonResponse({ success: false, message: "ไม่พบ Sheet: " + SHEET_COOP });

  const rows   = sheet.getDataRange().getValues();
  const rowIdx = rows.findIndex((r, i) => i > 0 && String(r[0]).trim() === String(body.name).trim());

  if (rowIdx < 0) return jsonResponse({ success: false, message: "ไม่พบสหกรณ์: " + body.name });

  sheet.deleteRow(rowIdx + 1);

  // ลบข้อมูลรายปีด้วย
  const shYear = ss.getSheetByName(SHEET_YEAR);
  if (shYear) {
    const yRows = shYear.getDataRange().getValues();
    // ลบจากท้ายขึ้นมาเพื่อไม่ให้ index เลื่อน
    for (let i = yRows.length - 1; i >= 1; i--) {
      if (String(yRows[i][0]).trim() === String(body.name).trim()) {
        shYear.deleteRow(i + 1);
      }
    }
  }

  return jsonResponse({ success: true, message: "ลบสำเร็จ: " + body.name });
}

// ── บันทึกข้อมูลรายปี ────────────────────────────────────────
function addYearData(body) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_YEAR);
  if (!sheet) return jsonResponse({ success: false, message: "ไม่พบ Sheet: " + SHEET_YEAR });

  const rows   = sheet.getDataRange().getValues();
  const rowIdx = rows.findIndex((r, i) =>
    i > 0 &&
    String(r[0]).trim() === String(body.name).trim() &&
    String(r[1]).trim() === String(body.year).trim()
  );

  if (rowIdx >= 0) {
    // อัปเดตแถวที่มีอยู่
    sheet.getRange(rowIdx + 1, 3, 1, 4).setValues([[
      Number(body.member)  || 0,
      Number(body.assoc)   || 0,
      Number(body.capital) || 0,
      Number(body.profit)  || 0
    ]]);
    return jsonResponse({ success: true, message: "อัปเดตข้อมูลรายปีสำเร็จ" });
  } else {
    // เพิ่มแถวใหม่
    sheet.appendRow([
      body.name,
      body.year,
      Number(body.member)  || 0,
      Number(body.assoc)   || 0,
      Number(body.capital) || 0,
      Number(body.profit)  || 0
    ]);
    return jsonResponse({ success: true, message: "บันทึกข้อมูลรายปีสำเร็จ" });
  }
}

// alias
function editYearData(body) { return addYearData(body); }

// ============================================================
//  setupSheets — รันครั้งเดียวเพื่อสร้าง Sheet + หัวตาราง
//  วิธีใช้: เปิด Apps Script → เลือกฟังก์ชัน setupSheets → Run
// ============================================================
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── Sheet: ข้อมูลสหกรณ์ ──────────────────────────────────
  let sh = ss.getSheetByName(SHEET_COOP);
  if (!sh) sh = ss.insertSheet(SHEET_COOP);

  if (sh.getLastRow() === 0) {
    const headers = [
      "ชื่อสหกรณ์ *",
      "ประเภทสหกรณ์ *",
      "เขต/อำเภอ *",
      "เลขทะเบียน",
      "ปีที่จดทะเบียน (พ.ศ.)",
      "สถานะ *",
      "ที่อยู่",
      "โทรศัพท์"
    ];
    sh.appendRow(headers);
    styleHeader(sh, headers.length);
    setCoopValidation(sh);
  }

  // ── Sheet: ข้อมูลรายปี ──────────────────────────────────
  let shY = ss.getSheetByName(SHEET_YEAR);
  if (!shY) shY = ss.insertSheet(SHEET_YEAR);

  if (shY.getLastRow() === 0) {
    const hY = [
      "ชื่อสหกรณ์ *",
      "ปี (พ.ศ.) *",
      "จำนวนสมาชิก (คน)",
      "จำนวนสมาชิกสมทบ (คน)",
      "ทุนดำเนินการ (บาท)",
      "กำไรสุทธิ (บาท)"
    ];
    shY.appendRow(hY);
    styleHeader(shY, hY.length);
  }

  // ── Sheet: ค่าอ้างอิง ────────────────────────────────────
  let shR = ss.getSheetByName(SHEET_REF);
  if (!shR) shR = ss.insertSheet(SHEET_REF);

  shR.clearContents();
  shR.appendRow(["ประเภทสหกรณ์ (9 ประเภท)", "สถานะ"]);
  styleHeader(shR, 2);

  VALID_TYPES.forEach((t, i) => {
    shR.getRange(i + 2, 1).setValue(t);
  });
  VALID_STATUS.forEach((s, i) => {
    shR.getRange(i + 2, 2).setValue(s);
  });

  // ปรับความกว้างคอลัมน์
  sh.setColumnWidth(1, 280);
  sh.setColumnWidth(2, 200);
  sh.setColumnWidth(3, 140);
  sh.setColumnWidth(4, 140);
  sh.setColumnWidth(5, 160);
  sh.setColumnWidth(6, 180);
  sh.setColumnWidth(7, 300);
  sh.setColumnWidth(8, 120);

  shY.setColumnWidth(1, 280);
  shY.setColumnWidth(2, 100);
  shY.setColumnWidth(3, 160);
  shY.setColumnWidth(4, 180);
  shY.setColumnWidth(5, 180);
  shY.setColumnWidth(6, 160);

  SpreadsheetApp.getUi().alert("✅ สร้าง Sheet สำเร็จ!\n\nSheet ที่สร้าง:\n• " + SHEET_COOP + "\n• " + SHEET_YEAR + "\n• " + SHEET_REF);
}

// ── จัดสไตล์แถวหัวตาราง ──────────────────────────────────────
function styleHeader(sheet, numCols) {
  const hdr = sheet.getRange(1, 1, 1, numCols);
  hdr.setBackground("#1E40AF")
     .setFontColor("#FFFFFF")
     .setFontWeight("bold")
     .setFontSize(10)
     .setHorizontalAlignment("center")
     .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 30);
  sheet.setFrozenRows(1);
}

// ── ใส่ Dropdown Validation ───────────────────────────────────
function setCoopValidation(sheet) {
  // คอลัมน์ B: ประเภทสหกรณ์
  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(VALID_TYPES, true)
    .setAllowInvalid(false)
    .setHelpText("เลือกประเภทสหกรณ์จากรายการ")
    .build();
  sheet.getRange("B2:B1000").setDataValidation(typeRule);

  // คอลัมน์ F: สถานะ
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(VALID_STATUS, true)
    .setAllowInvalid(false)
    .setHelpText("เลือกสถานะสหกรณ์")
    .build();
  sheet.getRange("F2:F1000").setDataValidation(statusRule);

  // คอลัมน์ E: ปีที่จดทะเบียน (ตัวเลขเท่านั้น)
  const yearRule = SpreadsheetApp.newDataValidation()
    .requireNumberBetween(2400, 2600)
    .setAllowInvalid(false)
    .setHelpText("กรอกปี พ.ศ. เช่น 2530")
    .build();
  sheet.getRange("E2:E1000").setDataValidation(yearRule);
}

// ── Helper: JSON response ─────────────────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function errResponse(msg) {
  return jsonResponse({ success: false, message: msg, timestamp: new Date().toISOString() });
}

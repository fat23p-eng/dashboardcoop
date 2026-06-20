# ระบบ Dashboard ข้อมูลสหกรณ์รายแห่ง — เวอร์ชัน GitHub + Google Sheet

โครงสร้าง: **Google Sheet** เป็นฐานข้อมูล + **Google Apps Script** เป็น API (`Code.gs`) +
**GitHub Pages** เป็นหน้าเว็บ (`index.html`) ที่ดึงข้อมูลจาก API มาแสดงผล

```
┌─────────────────┐        fetch (GET/POST)        ┌──────────────────────┐
│  index.html      │ ───────────────────────────▶  │  Google Apps Script  │
│  (GitHub Pages)  │ ◀───────────────────────────  │  Web App (Code.gs)   │
└─────────────────┘           JSON                 └──────────┬───────────┘
                                                                │
                                                                ▼
                                                        Google Sheet (3 ชีต)
```

ไฟล์ที่ได้:
- `index.html` — หน้า Dashboard (เดิมใช้ข้อมูลสุ่ม mock ทั้งหมด ตอนนี้ดึง/บันทึกข้อมูลจริงจาก Google Sheet ได้แล้ว)
- `Code.gs` — Apps Script backend (รับ-ส่งข้อมูลกับ Google Sheet)

ถ้ายังไม่ตั้งค่า `API_URL` ระบบจะเข้า **โหมดสาธิต (Demo Mode)** อัตโนมัติ — ใช้ข้อมูลสุ่มให้ดูตัวอย่างหน้าเว็บได้
โดยจะมีแถบสีเหลืองเตือนว่ายังไม่เชื่อมต่อข้อมูลจริง

---

## ขั้นตอนที่ 1 — ตั้งค่า Google Sheet + Apps Script

1. สร้าง Google Sheet ใหม่ (Sheet ว่างๆ ก็ได้ ไม่ต้องสร้างชีตล่วงหน้า)
2. เมนู **Extensions → Apps Script**
3. ลบโค้ดเดิมในไฟล์ `Code.gs` ทั้งหมด แล้ววางโค้ดจากไฟล์ `Code.gs` ที่แนบมานี้ทับ
4. ที่แถบด้านบนของ Apps Script editor เลือกฟังก์ชัน **`setupSheets`** จาก dropdown แล้วกด **Run** (▶)
   - ครั้งแรกจะมี popup ขอ authorize สิทธิ์การเข้าถึง Sheet ของบัญชีคุณ → กด **Allow**
   - หลังรันสำเร็จ จะมี popup แจ้ง "✅ สร้าง Sheet สำเร็จ!" และจะเห็น 3 ชีตใหม่ในสเปรดชีต:
     - **ข้อมูลสหกรณ์** — กรอกรายชื่อสหกรณ์ที่นี่ (มี dropdown ประเภท/สถานะให้เลือก)
     - **ข้อมูลรายปี** — ข้อมูลสมาชิก/ทุน/กำไร แยกตามปี
     - **ค่าอ้างอิง** — รายการ dropdown อ้างอิง (ห้ามลบ)
5. (ไม่บังคับ) กรอกข้อมูลสหกรณ์ตัวอย่าง 2-3 แถวในชีต "ข้อมูลสหกรณ์" และ "ข้อมูลรายปี" เพื่อทดสอบ

## ขั้นตอนที่ 2 — Deploy เป็น Web App

1. ใน Apps Script editor มุมขวาบน กด **Deploy → New deployment**
2. ที่ "Select type" กดไอคอนเฟือง ⚙️ เลือก **Web app**
3. ตั้งค่า:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. กด **Deploy** → ครั้งแรกจะขอ authorize อีกครั้ง → Allow
5. คัดลอก **Web app URL** ที่ได้ (รูปแบบ `https://script.google.com/macros/s/XXXXXXXX/exec`)

> ⚠️ ทุกครั้งที่แก้โค้ดใน `Code.gs` ต้องกด **Deploy → Manage deployments → แก้ไข (ไอคอนดินสอ) → Version: New version → Deploy** ใหม่ ไม่เช่นนั้น URL เดิมจะยังใช้โค้ดเวอร์ชันเก่าอยู่

## ขั้นตอนที่ 3 — เชื่อมต่อหน้าเว็บกับ Google Sheet

1. เปิดไฟล์ `index.html` ด้วยโปรแกรมแก้ไขข้อความ
2. หาบรรทัด:
   ```js
   const API_URL = ''; // ← วาง Google Apps Script Web App URL ที่นี่
   ```
3. วาง Web app URL จากขั้นตอนที่ 2 ลงไปแทน เช่น:
   ```js
   const API_URL = 'https://script.google.com/macros/s/XXXXXXXX/exec';
   ```
4. บันทึกไฟล์ — แถบสีเหลือง "โหมดสาธิต" จะหายไปเมื่อเชื่อมต่อสำเร็จ

### บัญชี Admin
ค่าเริ่มต้นคือ `user: TTT / pass: 666` (กำหนดไว้ทั้งใน `index.html` ตัวแปร `ADMIN_USER`/`ADMIN_PASS`
และใน `Code.gs` ที่ฟังก์ชัน `doPost`) — **แนะนำให้เปลี่ยนทั้ง 2 ที่ให้ตรงกัน** ก่อนใช้งานจริง
เพราะค่านี้เป็นแค่การกันทั่วไป ไม่ใช่ระบบยืนยันตัวตนที่ปลอดภัยระดับสูง (ไม่ควรใช้กับข้อมูลที่เป็นความลับมาก)

---

## ขั้นตอนที่ 4 — เผยแพร่ผ่าน GitHub Pages

1. สร้าง repository ใหม่บน GitHub (Public หรือ Private ก็ได้ ถ้า Private ต้องมี GitHub Pro เพื่อใช้ Pages)
2. อัปโหลดไฟล์ `index.html` ขึ้น repo (root ของ repo) — จะ commit ผ่านเว็บ GitHub
   หรือใช้คำสั่งใน terminal ก็ได้ ตัวอย่าง:
   ```bash
   git init
   git add index.html
   git commit -m "coop dashboard - google sheet version"
   git branch -M main
   git remote add origin https://github.com/<username>/<repo>.git
   git push -u origin main
   ```
3. ไปที่ repo บนเว็บ GitHub → **Settings → Pages**
4. ที่ "Build and deployment" → Source: **Deploy from a branch**
   Branch: **main** / Folder: **/ (root)** → กด **Save**
5. รอ 1-2 นาที จะได้ลิงก์เว็บไซต์รูปแบบ:
   `https://<username>.github.io/<repo>/`
6. เปิดลิงก์นี้ — ควรเห็นข้อมูลจริงจาก Google Sheet (ไม่มีแถบเหลือง Demo Mode แล้ว)

> เก็บไฟล์ `Code.gs` ไว้ใน repo ด้วยก็ได้ (เป็นแค่เอกสารอ้างอิง/สำรอง — Apps Script จริงรันอยู่ใน Google Sheet ไม่เกี่ยวกับ GitHub)

---

## สรุปการทำงานของแต่ละปุ่มหลัง Deploy

| การทำงานบนหน้าเว็บ | เกิดอะไรขึ้น |
|---|---|
| เปิดหน้าเว็บ / กด "รีเฟรช" | `GET` ไปที่ Web app URL → อ่านข้อมูลทั้งหมดจาก Sheet |
| Admin → เพิ่มสหกรณ์ใหม่ | `POST` action `add` → เพิ่มแถวใหม่ใน "ข้อมูลสหกรณ์" (และ "ข้อมูลรายปี" ถ้ามีกรอกสมาชิก/ทุน) |
| Admin → แก้ไขสหกรณ์ | `POST` action `edit` + `addYear` → แก้แถวเดิมในทั้ง 2 ชีต |
| Admin → ลบสหกรณ์ | `POST` action `delete` → ลบแถวออกจากทั้ง 2 ชีต |
| Admin → บันทึกข้อมูลรายปี | `POST` action `addYear` → เพิ่ม/แก้แถวใน "ข้อมูลรายปี" |

ทุกครั้งที่บันทึกสำเร็จ หน้าเว็บจะดึงข้อมูลใหม่ทั้งหมดจาก Sheet อีกครั้งอัตโนมัติ
เพื่อให้สิ่งที่แสดงตรงกับข้อมูลจริงเสมอ

## ข้อจำกัดที่ควรรู้
- ระบบนี้เหมาะกับข้อมูลขนาดเล็ก-กลาง (Apps Script จะอ่าน/เขียนทั้งชีตทุกครั้ง ถ้าข้อมูลหลักหมื่นแถวอาจช้า)
- การยืนยันตัวตน Admin เป็นแบบพื้นฐาน (เช็ค user/pass ที่ส่งมาใน request) — ไม่ได้เข้ารหัสระดับสูง
  ไม่ควรใช้กับข้อมูลที่ต้องการความปลอดภัยสูงมาก
- Apps Script Web App แบบ "Anyone" หมายถึงใครก็ตามที่รู้ URL สามารถเรียกดูข้อมูล (GET) ได้
  ถ้าต้องการจำกัดสิทธิ์มากกว่านี้ ต้องปรับ logic ตรวจสอบเพิ่มเองใน `doGet`/`doPost`

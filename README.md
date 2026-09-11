# ระบบจัดการคะแนนความประพฤตินักเรียน (Conduct Score Management System)

ระบบบริหารจัดการและติดตามคะแนนความประพฤตินักเรียนออนไลน์ รองรับการบันทึกคะแนน ตัด/เพิ่มคะแนน กฎเกณฑ์ตามระเบียบโรงเรียน และแดชบอร์ดสถิติ

- **ผู้ดูแลระบบ / ผู้ใช้งาน:** `tasawan@pcccr.ac.th`
- **เทคโนโลยี:** React 19, TypeScript, Tailwind CSS, Vite, Firebase Firestore & Authentication

---

## 🚀 การนำขึ้น GitHub (Deployment to GitHub) สำหรับ `tasawan@pcccr.ac.th`

### วิธีที่ 1: ผ่าน Google AI Studio (ง่ายและเร็วที่สุด)
1. ไปที่เมนู **Settings** (รูปเฟือง) หรือเมนูแชร์ของ Google AI Studio ด้านขวาบน
2. เลือก **Export to GitHub**
3. ล็อกอินหรืออนุญาตสิทธิ์เข้าถึงบัญชี GitHub ของท่าน (`tasawan@pcccr.ac.th`)
4. เลือกว่าจะสร้างเป็น **Public** หรือ **Private Repository**
5. ระบบจะทำการ Push โค้ดทั้งหมดขึ้น GitHub ให้ทันทีโดยอัตโนมัติ

---

### วิธีที่ 2: ผ่าน Git CLI (Command Line)

หากต้องการ Push จากเครื่องของคุณเอง หรือผ่าน Git Terminal:

1. **สร้าง Repository ใหม่บน GitHub:**
   - เข้าสู่ระบบ [GitHub](https://github.com) ด้วยบัญชีอีเมล `tasawan@pcccr.ac.th`
   - คลิกปุ่ม **New Repository** (เช่น ตั้งชื่อว่า `conduct-score-system`)
   - ไม่ต้องติ๊กเลือกสร้าง README หรือ .gitignore (เนื่องจากในโปรเจกต์มีเตรียมไว้แล้ว)

2. **เชื่อมต่อและ Push ขึ้น GitHub:**
   ```bash
   # ตรวจสอบการตั้งค่า User Git
   git config user.name "tasawan"
   git config user.email "tasawan@pcccr.ac.th"

   # เชื่อมต่อ Remote Repository (แทนที่ YOUR_GITHUB_USERNAME และ REPO_NAME)
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/REPO_NAME.git

   # Push ไปยัง branch main
   git branch -M main
   git push -u origin main
   ```

---

## ⚙️ การตั้งค่า CI/CD อัตโนมัติ (GitHub Actions)

โปรเจกต์นี้มาพร้อมกับ GitHub Workflows 2 ตัวในโฟลเดอร์ `.github/workflows/`:
1. **`ci.yml` (Continuous Integration):**
   - รันอัตโนมัติเมื่อมีการ Push หรือ Pull Request ไปยัง branch `main`
   - ตรวจสอบ Type check (`npm run lint`), ติดตั้ง dependencies, และทดสอบ Build (`npm run build`)
2. **`deploy.yml` (GitHub Pages Deployment):**
   - รันอัตโนมัติเมื่อ Push ไปยัง branch `main`
   - ทำการ Build และ Deploy ขึ้น **GitHub Pages** อัตโนมัติ (เปิดใช้งานผ่าน Settings > Pages ใน GitHub Repo โดยเลือก Source เป็น GitHub Actions)

---

## 🌟 หน้าแรกของระบบ (School Conduct Portal Landing Page)

- **พอร์ทัลหน้าแรก (Home Landing View):** หน้าต้อนรับสำหรับนักเรียน ผู้ปกครอง และครู แสดงสรุปสถิติประจำภาคเรียน, ทำเนียบคนดี, เกณฑ์การตัด/เพิ่มคะแนนความประพฤติ
- **ค้นหาผลคะแนนความประพฤติออนไลน์:** ค้นหาได้ด้วยรหัสนักเรียนหรือเลขประจำตัวประชาชน
- **ระบบความปลอดภัย:** แยกสิทธิ์ระหว่างมุมมองสาธารณะ (ตรวจสอบคะแนน) และระบบจัดการหลังบ้าน (ฝ่ายปกครอง / ครูผู้สอน) ที่ต้องยืนยันตัวตน

---

## 🔒 ระบบความปลอดภัยและการเข้าใช้งาน (Access Control & Login Policy)

- **บังคับเข้าสู่ระบบก่อนเข้าใช้งาน (Require Login Before Access):** ระบบถูกกำหนดให้ผู้ใช้งานต้องลงชื่อเข้าใช้ด้วยบัญชีผู้ดูแลระบบ (Admin) หรือบุคลากร หรือตรวจสอบสิทธิ์นักเรียนก่อน จึงจะสามารถเข้าถึงและใช้งานระบบได้
- **การปรับแต่งในหน้าตั้งค่า:** ผู้ดูแลระบบสามารถเข้าสู่ระบบไปที่เมนู **"ตั้งค่าแบรนด์และระบบ"** เพื่อเลือกเปิด/ปิดตัวเลือก *"ต้องเข้าสู่ระบบก่อนจึงสามารถเข้าใช้ระบบได้"* ได้ตามนโยบายของโรงเรียน พร้อมบันทึกลงฐานข้อมูล Firebase Firestore แบบ Realtime
- **บัญชีผู้ดูแลระบบเริ่มต้น:**
  - ชื่อผู้ใช้ (Username): `admin`
  - รหัสผ่าน (Password): `213894120`

---

## 💻 การติดตั้งและรันโปรเจกต์บนเครื่องตนเอง (Local Development)

```bash
# 1. ติดตั้ง Dependencies
npm install

# 2. เริ่มต้น Dev Server (พอร์ต 3000)
npm run dev

# 3. ตรวจสอบ Lint / Type Check
npm run lint

# 4. ทดสอบ Build เพื่อขึ้น Production
npm run build
```

---

## 🔒 การเชื่อมต่อ Firebase

ไฟล์การตั้งค่า Firebase อยู่ที่ `firebase-applet-config.json` และการจัดการสิทธิ์ความปลอดภัยอยู่ที่ `firestore.rules`
เมื่อโคลนโปรเจกต์ไปรัน ให้แน่ใจว่าได้ระบุค่า Environment ใน `.env` ตามตัวอย่างใน `.env.example`

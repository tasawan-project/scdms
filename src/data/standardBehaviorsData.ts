import { StandardConductBehavior } from '../types';

export const INITIAL_STANDARD_BEHAVIORS: StandardConductBehavior[] = [
  // หมวดหักคะแนน (DEDUCT)
  {
    id: 'bhv-deduct-01',
    title: 'การมาสาย / ไม่เข้าแถว',
    type: 'DEDUCT',
    points: 5,
    category: 'การเข้าเรียนและวินัย',
    description: 'มาโรงเรียนสายหรือไม่เข้าร่วมกิจกรรมหน้าเสาธงโดยไม่มีเหตุจำเป็น',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bhv-deduct-02',
    title: 'หนีเรียน / ขาดเรียนไม่มีใบลา',
    type: 'DEDUCT',
    points: 15,
    category: 'การเข้าเรียนและวินัย',
    description: 'ขาดเรียนหรือหนีออกจากสถานศึกษาในระหว่างเวลาเรียน',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bhv-deduct-03',
    title: 'แต่งกายผิดระเบียบ / ทรงผม',
    type: 'DEDUCT',
    points: 10,
    category: 'การแต่งกาย',
    description: 'แต่งกายผิดระเบียบของโรงเรียน ไม่เรียบร้อย หรือเครื่องแบบไม่ถูกต้อง',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bhv-deduct-04',
    title: 'ใช้โทรศัพท์ในเวลาเรียนโดยไม่ได้รับอนุญาต',
    type: 'DEDUCT',
    points: 5,
    category: 'วินัยในห้องเรียน',
    description: 'ใช้โทรศัพท์มือถือหรืออุปกรณ์สื่อสารในเวลาเรียนโดยไม่ได้รับอนุญาตจากครูผู้สอน',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bhv-deduct-05',
    title: 'ไม่ส่งงาน / ไม่รับผิดชอบหน้าที่',
    type: 'DEDUCT',
    points: 5,
    category: 'วินัยการเรียน',
    description: 'ไม่ส่งงานหรือการบ้านติดต่อกันเกินกำหนด หรือละเลยหน้าที่เวรประจำวัน',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bhv-deduct-06',
    title: 'ทะเลาะวิวาท / ใช้ความรุนแรง',
    type: 'DEDUCT',
    points: 30,
    category: 'พฤติกรรมรุนแรง',
    description: 'ก่อเหตุทะเลาะวิวาท ชกต่อย หรือใช้ความรุนแรงทั้งในและนอกสถานศึกษา',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bhv-deduct-07',
    title: 'บุหรี่ / บุหรี่ไฟฟ้า / สารเสพติด',
    type: 'DEDUCT',
    points: 30,
    category: 'สารเสพติดและอบายมุข',
    description: 'พกพา ครอบครอง ซื้อขาย หรือเสพบุหรี่ บุหรี่ไฟฟ้า สุรา หรือสารเสพติดทุกชนิด',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bhv-deduct-08',
    title: 'ทุจริตการสอบ',
    type: 'DEDUCT',
    points: 25,
    category: 'จริยธรรม',
    description: 'ทุจริตหรือมีพฤติกรรมส่อเจตนาทุจริตในการสอบเก็บคะแนนหรือสอบปลายภาค',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bhv-deduct-09',
    title: 'ทำลายทรัพย์สินของโรงเรียน',
    type: 'DEDUCT',
    points: 20,
    category: 'ทรัพย์สินส่วนรวม',
    description: 'ทำให้ทรัพย์สิน โต๊ะ เก้าอี้ อาคาร หรืออุปกรณ์การเรียนของโรงเรียนเสียหาย',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },

  // หมวดเพิ่มคะแนน (ADD)
  {
    id: 'bhv-add-01',
    title: 'จิตอาสาบำเพ็ญประโยชน์ (5 ชม.)',
    type: 'ADD',
    points: 5,
    category: 'จิตอาสา',
    description: 'เข้าร่วมกิจกรรมจิตอาสาบำเพ็ญประโยชน์ต่อโรงเรียนหรือชุมชนครบ 5 ชั่วโมง',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bhv-add-02',
    title: 'จิตอาสาบำเพ็ญประโยชน์ (10 ชม.)',
    type: 'ADD',
    points: 10,
    category: 'จิตอาสา',
    description: 'เข้าร่วมกิจกรรมจิตอาสาบำเพ็ญประโยชน์ต่อโรงเรียนหรือชุมชนครบ 10 ชั่วโมง',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bhv-add-03',
    title: 'ช่วยงานกิจกรรมของโรงเรียน / วันสำคัญ',
    type: 'ADD',
    points: 10,
    category: 'กิจกรรมโรงเรียน',
    description: 'ช่วยเหลืองานครูและโรงเรียนในกิจกรรมวันสำคัญและงานพิธีการต่างๆ ด้วยความเสียสละ',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bhv-add-04',
    title: 'เข้าร่วมกิจกรรมปรับปรุงพฤติกรรมครบถ้วน',
    type: 'ADD',
    points: 15,
    category: 'การปรับปรุงพฤติกรรม',
    description: 'เข้าร่วมกิจกรรมค่ายพัฒนาวินัยหรือกิจกรรมปรับปรุงพฤติกรรมตามที่ฝ่ายปกครองกำหนดครบถ้วน',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bhv-add-05',
    title: 'เป็นตัวแทนแข่งขันทางวิชาการ / กีฬา',
    type: 'ADD',
    points: 15,
    category: 'วิชาการและกีฬา',
    description: 'เป็นตัวแทนโรงเรียนเข้าร่วมการแข่งขันทางวิชาการ กีฬา หรือศิลปวัฒนธรรม',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bhv-add-06',
    title: 'สร้างชื่อเสียงให้โรงเรียน (ระดับจังหวัด/ภาค/ชาติ)',
    type: 'ADD',
    points: 30,
    category: 'สร้างชื่อเสียง',
    description: 'ได้รับรางวัลชนะเลิศหรือสร้างชื่อเสียงโดดเด่นให้สถานศึกษาระดับจังหวัด ภาค หรือระดับประเทศ',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bhv-add-07',
    title: 'เก็บของมีค่าได้แล้วนำส่งคืนเจ้าของ',
    type: 'ADD',
    points: 10,
    category: 'คุณธรรมความซื่อสัตย์',
    description: 'เก็บเงินสดหรือทรัพย์สินมีค่าได้แล้วนำส่งครูหรือประชาสัมพันธ์เพื่อส่งมอบคืนเจ้าของ',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'bhv-add-08',
    title: 'สารวัตรนักเรียน / กรรมการสภานักเรียน',
    type: 'ADD',
    points: 20,
    category: 'ภาวะผู้นำ',
    description: 'ปฏิบัติหน้าที่สารวัตรนักเรียนหรือกรรมการสภานักเรียนด้วยความรับผิดชอบและเป็นแบบอย่างที่ดี',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  writeBatch,
  deleteField
} from 'firebase/firestore';
import {
  Student,
  ConductLog,
  SystemSettings,
  AppUser,
  StudentAccessGrant,
  HomeroomAdvisor,
  GradeLevel,
  StandardConductBehavior
} from './types';
import { calculateStudentGrade } from './utils/conductLogic';
import { INITIAL_STANDARD_BEHAVIORS } from './data/standardBehaviorsData';
import { recordRealOperation } from './utils/actualUsageTracker';
import firebaseConfig from '../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

const customDbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

// Robust Firestore instance with auto-detect long polling and multi-tab local cache for iframe stability
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, customDbId);
} catch (e) {
  firestoreInstance = customDbId ? getFirestore(app, customDbId) : getFirestore(app);
}

export const db = firestoreInstance;

// Collection references
export const STUDENTS_COLLECTION = 'students';
export const CONDUCT_LOGS_COLLECTION = 'conduct_logs';
export const SETTINGS_COLLECTION = 'settings';
export const USERS_COLLECTION = 'app_users';
export const ACCESS_GRANTS_COLLECTION = 'student_access_grants';
export const ADVISORS_COLLECTION = 'homeroom_advisors';
export const STANDARD_BEHAVIORS_COLLECTION = 'standard_conduct_behaviors';

/**
 * Helper to strip all `undefined` fields from an object so Firestore never throws:
 * "Unsupported field value: undefined"
 */
export function cleanForFirestore<T extends Record<string, any>>(data: T): Record<string, any> {
  if (data === null || typeof data !== 'object') return data;
  
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) {
      continue;
    }
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      cleaned[key] = cleanForFirestore(val);
    } else if (Array.isArray(val)) {
      cleaned[key] = val.map(item => (typeof item === 'object' && item !== null ? cleanForFirestore(item) : item));
    } else {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

/**
 * Default Initial Admin Credentials
 * admin : 213894120
 */
export const DEFAULT_ADMIN_USER: AppUser = {
  id: 'admin',
  username: 'admin',
  password: '213894120',
  name: 'ผู้ดูแลระบบสูงสุด (Super Admin)',
  role: 'admin',
  department: 'ศูนย์เทคโนโลยีและงานกิจการนักเรียน',
  email: 'admin@school.ac.th',
  isActive: true,
  isSuperAdmin: true,
  createdAt: '2026-01-01T00:00:00.000Z'
};

export const DEFAULT_INITIAL_USERS: AppUser[] = [
  DEFAULT_ADMIN_USER,
  {
    id: 'staff01',
    username: 'staff01',
    password: 'staff1234',
    name: 'เจ้าหน้าที่สมศักดิ์ วินัยดี',
    role: 'staff',
    department: 'ฝ่ายกิจการนักเรียนและระเบียบวินัย',
    email: 'staff01@school.ac.th',
    isActive: true,
    isSuperAdmin: false,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'teacher01',
    username: 'teacher01',
    password: 'teacher1234',
    name: 'ครูสมพร สอนดี',
    role: 'teacher',
    department: 'กลุ่มสาระการเรียนรู้ภาษาไทย',
    email: 'somporn@school.ac.th',
    isActive: true,
    isSuperAdmin: false,
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

/**
 * Default initial system settings
 */
export const DEFAULT_SETTINGS: SystemSettings = {
  schoolNameTh: 'โรงเรียนตัวอย่างวิทยา',
  schoolNameEn: 'Samplename Wittaya School',
  appNameTh: 'ระบบบริหารจัดการคะแนนความประพฤตินักเรียน',
  appNameEn: 'Student Conduct & Discipline Management System',
  logoUrl: '',
  currentAcademicYear: 2569,
  currentTerm: 1,
  requireLoginBeforeAccess: true,
  allowAllStudentsScoreCheck: false,
  criticalScoreThreshold: 70, // วิกฤต: หัก 70 คะแนน หรือเหลือ 30
  watchScoreThreshold: 30,    // เฝ้าระวัง: หัก 30 คะแนน หรือเหลือ 70
  cautionScoreThreshold: 20,  // ตักเตือน: หัก 20 คะแนน หรือเหลือ 80
  maxBankedPointsCap: 50,     // ยอดเยี่ยม: เพดานคะแนนสะสมสูงสุดที่นักเรียนเก็บได้
  warningScoreThreshold: 30,
  schoolName: 'โรงเรียนตัวอย่างวิทยา'
};

const USERS_CACHE_KEY = 'conduct_cached_users';

export function getLocalCachedUsers(): AppUser[] {
  try {
    const cached = localStorage.getItem(USERS_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading cached users:', e);
  }
  return [];
}

export function setLocalCachedUsers(users: AppUser[]): void {
  try {
    localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn('Error saving cached users:', e);
  }
}

/**
 * Initialize default admin user and initial tier accounts if needed
 */
export async function initDefaultAdminUser(): Promise<AppUser[]> {
  try {
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    if (snap.empty) {
      const batch = writeBatch(db);
      for (const u of DEFAULT_INITIAL_USERS) {
        batch.set(doc(db, USERS_COLLECTION, u.id), u);
      }
      await batch.commit();
      setLocalCachedUsers([...DEFAULT_INITIAL_USERS]);
      return [...DEFAULT_INITIAL_USERS];
    }
    const users: AppUser[] = [];
    snap.forEach(d => users.push(d.data() as AppUser));
    // Ensure admin user exists with requested default credentials if missing
    const adminExists = users.some(u => u.username === 'admin');
    if (!adminExists) {
      await setDoc(doc(db, USERS_COLLECTION, DEFAULT_ADMIN_USER.id), DEFAULT_ADMIN_USER);
      users.push(DEFAULT_ADMIN_USER);
    }
    // Merge with any cached users that might have been saved locally
    const cached = getLocalCachedUsers();
    for (const c of cached) {
      if (!users.some(u => u.id === c.id || u.username?.toLowerCase() === c.username?.toLowerCase())) {
        users.push(c);
      }
    }
    setLocalCachedUsers(users);
    return users;
  } catch (err) {
    console.warn('initDefaultAdminUser error:', err);
    const cached = getLocalCachedUsers();
    if (cached.length > 0) {
      return cached;
    }
    return [...DEFAULT_INITIAL_USERS];
  }
}

/**
 * Fetch all system users with guaranteed fallback to cached storage
 */
export async function fetchAppUsers(): Promise<AppUser[]> {
  try {
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    if (snap.empty) {
      return await initDefaultAdminUser();
    }
    const users: AppUser[] = [];
    snap.forEach(d => users.push(d.data() as AppUser));

    // Preserve any locally saved users that may not have reached Firestore
    const cached = getLocalCachedUsers();
    for (const c of cached) {
      if (!users.some(u => u.id === c.id || u.username?.toLowerCase() === c.username?.toLowerCase())) {
        users.push(c);
      }
    }

    setLocalCachedUsers(users);
    return users;
  } catch (e) {
    console.warn('fetchAppUsers error:', e);
    // Never blow away cached users on Firestore error (e.g. quota-exceeded or offline)
    const cached = getLocalCachedUsers();
    if (cached.length > 0) {
      return cached;
    }
    return [...DEFAULT_INITIAL_USERS];
  }
}

/**
 * Save or update an app user with dual persistence (local cache + Firestore)
 */
export async function saveAppUser(user: AppUser): Promise<void> {
  // 1. Immediately persist to localStorage to guarantee data survival on refresh
  try {
    const cached = getLocalCachedUsers();
    const idx = cached.findIndex(u => u.id === user.id || u.username?.toLowerCase() === user.username?.toLowerCase());
    let updated: AppUser[];
    if (idx >= 0) {
      updated = [...cached];
      updated[idx] = { ...updated[idx], ...user, updatedAt: new Date().toISOString() };
    } else {
      updated = [...cached, { ...user, updatedAt: new Date().toISOString() }];
    }
    setLocalCachedUsers(updated);
  } catch (localErr) {
    console.warn('Failed to update local user cache:', localErr);
  }

  // 2. Synchronize to Firestore
  try {
    const docRef = doc(db, USERS_COLLECTION, user.id);
    const payload = cleanForFirestore({
      ...user,
      updatedAt: new Date().toISOString()
    });
    await setDoc(docRef, payload, { merge: true });
    recordRealOperation('WRITE', 1, USERS_COLLECTION, 'SAVE_APP_USER', `บันทึกผู้ใช้ ${user.username}`);
  } catch (firestoreErr: any) {
    console.warn('saveAppUser Firestore error (saved to local cache successfully):', firestoreErr);
  }
}

/**
 * Delete an app user (cannot delete default admin) with dual persistence
 */
export async function deleteAppUser(userId: string): Promise<void> {
  if (userId === 'admin') {
    throw new Error('ไม่สามารถลบบัญชีผู้ดูแลระบบหลัก (admin) ได้');
  }
  // 1. Immediately remove from local cache
  try {
    const cached = getLocalCachedUsers();
    const updated = cached.filter(u => u.id !== userId);
    setLocalCachedUsers(updated);
  } catch (localErr) {
    console.warn('Failed to delete from local user cache:', localErr);
  }

  // 2. Delete from Firestore
  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    await deleteDoc(docRef);
    recordRealOperation('DELETE', 1, USERS_COLLECTION, 'DELETE_APP_USER', `ลบผู้ใช้ ${userId}`);
  } catch (firestoreErr) {
    console.warn('deleteAppUser Firestore error (deleted from local cache successfully):', firestoreErr);
  }
}

/**
 * Save / grant permission for student to view scores
 */
export async function saveStudentAccessGrant(grant: StudentAccessGrant): Promise<void> {
  const docRef = doc(db, ACCESS_GRANTS_COLLECTION, grant.id);
  await setDoc(docRef, cleanForFirestore(grant), { merge: true });
  recordRealOperation('WRITE', 1, ACCESS_GRANTS_COLLECTION, 'SAVE_GRANT', `ออกสิทธิ์ให้นักเรียน ${grant.studentId}`);
}

/**
 * Revoke student access grant
 */
export async function revokeStudentAccessGrant(grantId: string): Promise<void> {
  const docRef = doc(db, ACCESS_GRANTS_COLLECTION, grantId);
  await updateDoc(docRef, {
    isActive: false,
    revokedAt: new Date().toISOString()
  });
  recordRealOperation('WRITE', 1, ACCESS_GRANTS_COLLECTION, 'REVOKE_GRANT', `ยกเลิกสิทธิ์ ${grantId}`);
}

/**
 * Batch save multiple student access grants
 */
export async function batchSaveStudentAccessGrants(grants: StudentAccessGrant[]): Promise<void> {
  if (!grants || grants.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < grants.length; i += chunkSize) {
    const chunk = grants.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const g of chunk) {
      const docRef = doc(collection(db, ACCESS_GRANTS_COLLECTION), g.id);
      batch.set(docRef, cleanForFirestore(g), { merge: true });
    }
    await batch.commit();
  }
  recordRealOperation('WRITE', grants.length, ACCESS_GRANTS_COLLECTION, 'BATCH_SAVE_GRANTS', `ออกสิทธิ์กลุ่ม ${grants.length} รายการ`);
}

/**
 * Batch revoke active student access grants
 */
export async function batchRevokeAllStudentAccessGrants(grantIds: string[]): Promise<void> {
  if (!grantIds || grantIds.length === 0) return;
  const chunkSize = 400;
  const now = new Date().toISOString();
  for (let i = 0; i < grantIds.length; i += chunkSize) {
    const chunk = grantIds.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const id of chunk) {
      const docRef = doc(collection(db, ACCESS_GRANTS_COLLECTION), id);
      batch.update(docRef, {
        isActive: false,
        revokedAt: now
      });
    }
    await batch.commit();
  }
  recordRealOperation('WRITE', grantIds.length, ACCESS_GRANTS_COLLECTION, 'BATCH_REVOKE_GRANTS', `ยกเลิกสิทธิ์กลุ่ม ${grantIds.length} รายการ`);
}

/**
 * Fetch all student access grants
 */
export async function fetchStudentAccessGrants(): Promise<StudentAccessGrant[]> {
  try {
    const snap = await getDocs(collection(db, ACCESS_GRANTS_COLLECTION));
    const list: StudentAccessGrant[] = [];
    snap.forEach(d => list.push(d.data() as StudentAccessGrant));
    return list.sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime());
  } catch (e) {
    console.warn('fetchStudentAccessGrants error:', e);
    return [];
  }
}

/**
 * Save or update single student in Firestore
 */
export async function saveStudentToDb(student: Student): Promise<void> {
  const docRef = doc(db, STUDENTS_COLLECTION, student.id);
  const payload = cleanForFirestore({
    ...student,
    updatedAt: new Date().toISOString()
  });
  await setDoc(docRef, payload, { merge: true });
  recordRealOperation('WRITE', 1, STUDENTS_COLLECTION, 'SAVE_STUDENT', `บันทึกข้อมูลนักเรียน ${student.id} ${student.title || ''}${student.firstName} ${student.lastName}`);
}

/**
 * Save batch of students (e.g. from Excel/CSV import)
 */
export async function batchSaveStudents(students: Student[]): Promise<number> {
  let count = 0;
  const chunkSize = 400;
  for (let i = 0; i < students.length; i += chunkSize) {
    const chunk = students.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const student of chunk) {
      const docRef = doc(db, STUDENTS_COLLECTION, student.id);
      const payload = cleanForFirestore({
        ...student,
        updatedAt: new Date().toISOString()
      });
      batch.set(docRef, payload, { merge: true });
      count++;
    }
    await batch.commit();
  }
  recordRealOperation('WRITE', count, STUDENTS_COLLECTION, 'BATCH_SAVE_STUDENTS', `นำเข้านักเรียน ${count} คน`);
  return count;
}

/**
 * Record a conduct log (deduction or addition) and update student document in batch
 */
export async function recordConductLogTransaction(
  log: ConductLog,
  updatedStudent: Student
): Promise<void> {
  const batch = writeBatch(db);

  // 1. Add conduct log
  const logDocRef = doc(collection(db, CONDUCT_LOGS_COLLECTION), log.id);
  batch.set(logDocRef, cleanForFirestore(log));

  // 2. Update student doc
  const studentDocRef = doc(db, STUDENTS_COLLECTION, updatedStudent.id);
  batch.set(studentDocRef, cleanForFirestore({
    ...updatedStudent,
    updatedAt: new Date().toISOString()
  }), { merge: true });

  await batch.commit();
  recordRealOperation('WRITE', 2, CONDUCT_LOGS_COLLECTION, 'RECORD_CONDUCT_LOG', `บันทึกคะแนน ${log.studentId} (${log.type === 'DEDUCT' ? 'หัก' : 'เพิ่ม'} ${log.points} คะแนน)`);
}

/**
 * Batch record multiple conduct logs and update affected students
 * Handles large datasets safely by splitting into batches of 250 operations
 */
export async function batchRecordConductLogsTransaction(
  logs: ConductLog[],
  updatedStudents: Student[]
): Promise<{ successLogsCount: number; affectedStudentsCount: number }> {
  // 1. Commit conduct logs in chunks of 250
  const logChunkSize = 250;
  for (let i = 0; i < logs.length; i += logChunkSize) {
    const chunk = logs.slice(i, i + logChunkSize);
    const batch = writeBatch(db);
    for (const log of chunk) {
      const logDocRef = doc(collection(db, CONDUCT_LOGS_COLLECTION), log.id);
      batch.set(logDocRef, cleanForFirestore(log));
    }
    await batch.commit();
  }

  // 2. Commit student updates in chunks of 250
  const studentChunkSize = 250;
  for (let i = 0; i < updatedStudents.length; i += studentChunkSize) {
    const chunk = updatedStudents.slice(i, i + studentChunkSize);
    const batch = writeBatch(db);
    for (const student of chunk) {
      const studentDocRef = doc(db, STUDENTS_COLLECTION, student.id);
      batch.set(
        studentDocRef,
        cleanForFirestore({
          ...student,
          updatedAt: new Date().toISOString()
        }),
        { merge: true }
      );
    }
    await batch.commit();
  }

  recordRealOperation('WRITE', logs.length + updatedStudents.length, CONDUCT_LOGS_COLLECTION, 'BATCH_RECORD_CONDUCT_LOGS', `บันทึกคะแนนกลุ่ม ${logs.length} รายการ (ปรับปรุงนักเรียน ${updatedStudents.length} คน)`);

  return {
    successLogsCount: logs.length,
    affectedStudentsCount: updatedStudents.length
  };
}

/**
 * Update an existing conduct log and update student document in batch
 */
export async function updateConductLogTransaction(
  updatedLog: ConductLog,
  updatedStudent: Student
): Promise<void> {
  const batch = writeBatch(db);

  // 1. Update conduct log
  const logDocRef = doc(collection(db, CONDUCT_LOGS_COLLECTION), updatedLog.id);
  batch.set(logDocRef, cleanForFirestore(updatedLog), { merge: true });

  // 2. Update student doc
  const studentDocRef = doc(db, STUDENTS_COLLECTION, updatedStudent.id);
  batch.set(studentDocRef, cleanForFirestore({
    ...updatedStudent,
    updatedAt: new Date().toISOString()
  }), { merge: true });

  await batch.commit();
  recordRealOperation('WRITE', 2, CONDUCT_LOGS_COLLECTION, 'UPDATE_CONDUCT_LOG', `แก้ไขรายการคะแนน ${updatedLog.id}`);
}

/**
 * Delete a single conduct log and update student document in batch
 */
export async function deleteConductLogTransaction(
  logId: string,
  updatedStudent: Student
): Promise<void> {
  const batch = writeBatch(db);

  // 1. Delete conduct log
  const logDocRef = doc(collection(db, CONDUCT_LOGS_COLLECTION), logId);
  batch.delete(logDocRef);

  // 2. Update student doc
  const studentDocRef = doc(db, STUDENTS_COLLECTION, updatedStudent.id);
  batch.set(studentDocRef, cleanForFirestore({
    ...updatedStudent,
    updatedAt: new Date().toISOString()
  }), { merge: true });

  await batch.commit();
  recordRealOperation('DELETE', 1, CONDUCT_LOGS_COLLECTION, 'DELETE_CONDUCT_LOG', `ลบรายการคะแนน ${logId}`);
  recordRealOperation('WRITE', 1, STUDENTS_COLLECTION, 'UPDATE_STUDENT_ON_DELETE_LOG', `คืนคะแนนนักเรียน ${updatedStudent.id}`);
}

/**
 * Delete student by ID
 */
export async function deleteStudentFromDb(studentId: string): Promise<void> {
  const docRef = doc(db, STUDENTS_COLLECTION, studentId);
  await deleteDoc(docRef);
  recordRealOperation('DELETE', 1, STUDENTS_COLLECTION, 'DELETE_STUDENT', `ลบนักเรียน ${studentId}`);
}

/**
 * Delete batch of students (e.g. graduation of M.3 / M.6)
 */
export async function batchDeleteStudents(studentIds: string[]): Promise<number> {
  let count = 0;
  const chunkSize = 400;
  for (let i = 0; i < studentIds.length; i += chunkSize) {
    const chunk = studentIds.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const id of chunk) {
      const docRef = doc(db, STUDENTS_COLLECTION, id);
      batch.delete(docRef);
      count++;
    }
    await batch.commit();
  }
  recordRealOperation('DELETE', count, STUDENTS_COLLECTION, 'BATCH_DELETE_STUDENTS', `ลบนักเรียนกลุ่ม ${count} คน`);
  return count;
}

/**
 * Clear / remove all imported student photo URLs across the database
 * ยกเลิกและล้างรูปภาพนักเรียนทั้งหมดออกจากฐานข้อมูล
 */
export async function clearAllStudentPhotos(): Promise<{ clearedCount: number }> {
  try {
    const studentSnap = await getDocs(collection(db, STUDENTS_COLLECTION));
    const studentsWithPhotos: string[] = [];
    studentSnap.forEach(d => {
      const st = d.data() as Student;
      if (st.photoUrl && st.photoUrl.trim() !== '') {
        studentsWithPhotos.push(d.id);
      }
    });

    let clearedCount = 0;
    const chunkSize = 400;
    for (let i = 0; i < studentsWithPhotos.length; i += chunkSize) {
      const chunk = studentsWithPhotos.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const id of chunk) {
        const docRef = doc(db, STUDENTS_COLLECTION, id);
        batch.update(docRef, {
          photoUrl: deleteField(),
          updatedAt: new Date().toISOString()
        });
        clearedCount++;
      }
      await batch.commit();
    }
    return { clearedCount };
  } catch (err) {
    console.error('clearAllStudentPhotos error:', err);
    return { clearedCount: 0 };
  }
}

/**
 * Delete all conduct logs for a specific student
 */
export async function deleteStudentConductLogs(studentId: string): Promise<void> {
  const q = query(
    collection(db, CONDUCT_LOGS_COLLECTION),
    where('studentId', '==', studentId)
  );
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });
  await batch.commit();
}

/**
 * Fetch all students
 */
export async function fetchAllStudents(): Promise<Student[]> {
  const snapshot = await getDocs(collection(db, STUDENTS_COLLECTION));
  const students: Student[] = [];
  snapshot.forEach(docSnap => {
    students.push(docSnap.data() as Student);
  });
  return students;
}

/**
 * Fetch conduct logs for a student
 */
export async function fetchStudentConductLogs(studentId: string): Promise<ConductLog[]> {
  const q = query(
    collection(db, CONDUCT_LOGS_COLLECTION),
    where('studentId', '==', studentId),
    orderBy('recordedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  const logs: ConductLog[] = [];
  snapshot.forEach(docSnap => {
    logs.push(docSnap.data() as ConductLog);
  });
  return logs;
}

/**
 * Save System Settings
 */
export async function saveSystemSettings(settings: SystemSettings): Promise<void> {
  const docRef = doc(db, SETTINGS_COLLECTION, 'global_config');
  const payload = cleanForFirestore({
    ...settings,
    schoolName: settings.schoolNameTh || settings.schoolName || DEFAULT_SETTINGS.schoolNameTh
  });
  await setDoc(docRef, payload, { merge: true });
}

/**
 * Fetch System Settings
 */
export async function fetchSystemSettings(): Promise<SystemSettings> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, 'global_config');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as any;
      return {
        ...DEFAULT_SETTINGS,
        ...data,
        schoolNameTh: data.schoolNameTh || data.schoolName || DEFAULT_SETTINGS.schoolNameTh,
        schoolNameEn: data.schoolNameEn || DEFAULT_SETTINGS.schoolNameEn,
        appNameTh: data.appNameTh || DEFAULT_SETTINGS.appNameTh,
        appNameEn: data.appNameEn || DEFAULT_SETTINGS.appNameEn,
        logoUrl: data.logoUrl || ''
      };
    }
  } catch (e) {
    console.warn('fetchSystemSettings error:', e);
  }
  return DEFAULT_SETTINGS;
}

import { INITIAL_SAMPLE_STUDENTS, INITIAL_SAMPLE_LOGS, INITIAL_SAMPLE_ADVISORS } from './data/mockSampleData';

/**
 * Fetch all homeroom advisors from Firestore
 */
export async function fetchHomeroomAdvisors(academicYear?: number): Promise<HomeroomAdvisor[]> {
  try {
    const snap = await getDocs(collection(db, ADVISORS_COLLECTION));
    if (snap.empty) {
      return [];
    }
    let list: HomeroomAdvisor[] = [];
    snap.forEach(d => list.push(d.data() as HomeroomAdvisor));
    if (academicYear) {
      list = list.filter(a => a.academicYear === academicYear);
    }
    return list.sort((a, b) => {
      if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel.localeCompare(b.gradeLevel);
      if (a.room !== b.room) return a.room - b.room;
      return (a.advisorOrder || 1) - (b.advisorOrder || 1);
    });
  } catch (e) {
    console.warn('fetchHomeroomAdvisors error:', e);
    return [];
  }
}

/**
 * Delete all Homeroom Advisors and optionally clear advisor names from student records
 */
export async function deleteAllHomeroomAdvisors(clearStudentAdvisorNames: boolean = true): Promise<{
  deletedAdvisors: number;
  clearedStudents: number;
}> {
  try {
    const advSnap = await getDocs(collection(db, ADVISORS_COLLECTION));
    let deletedAdvisors = 0;
    const chunkSize = 400;
    const advDocs = advSnap.docs;

    for (let i = 0; i < advDocs.length; i += chunkSize) {
      const chunk = advDocs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const d of chunk) {
        batch.delete(d.ref);
        deletedAdvisors++;
      }
      await batch.commit();
    }

    let clearedStudents = 0;
    if (clearStudentAdvisorNames) {
      const studentSnap = await getDocs(collection(db, STUDENTS_COLLECTION));
      const studentsToClear: Student[] = [];
      studentSnap.forEach(d => {
        const st = d.data() as Student;
        if (st.advisorName && st.advisorName.trim() !== '') {
          studentsToClear.push(st);
        }
      });

      for (let i = 0; i < studentsToClear.length; i += chunkSize) {
        const chunk = studentsToClear.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const st of chunk) {
          const docRef = doc(db, STUDENTS_COLLECTION, st.id);
          batch.update(docRef, {
            advisorName: '',
            updatedAt: new Date().toISOString()
          });
          clearedStudents++;
        }
        await batch.commit();
      }
    }

    return { deletedAdvisors, clearedStudents };
  } catch (err) {
    console.error('deleteAllHomeroomAdvisors error:', err);
    return { deletedAdvisors: 0, clearedStudents: 0 };
  }
}

/**
 * Save or update single Homeroom Advisor
 */
export async function saveHomeroomAdvisor(advisor: HomeroomAdvisor, syncToStudents: boolean = true): Promise<void> {
  const docRef = doc(db, ADVISORS_COLLECTION, advisor.id);
  const nowIso = new Date().toISOString();
  const payload = cleanForFirestore({
    ...advisor,
    updatedAt: nowIso,
    createdAt: advisor.createdAt || nowIso
  });
  await setDoc(docRef, payload, { merge: true });

  if (syncToStudents) {
    await syncClassroomAdvisorToStudents(advisor.gradeLevel, advisor.room, advisor.academicYear, advisor.fullName);
  }
}

/**
 * Save batch of Homeroom Advisors
 */
export async function batchSaveHomeroomAdvisors(
  advisors: HomeroomAdvisor[],
  syncToStudents: boolean = true
): Promise<{ savedCount: number; syncedStudentsCount: number }> {
  let savedCount = 0;
  const chunkSize = 400;
  const nowIso = new Date().toISOString();

  for (let i = 0; i < advisors.length; i += chunkSize) {
    const chunk = advisors.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const adv of chunk) {
      const docRef = doc(db, ADVISORS_COLLECTION, adv.id);
      const payload = cleanForFirestore({
        ...adv,
        updatedAt: nowIso,
        createdAt: adv.createdAt || nowIso
      });
      batch.set(docRef, payload, { merge: true });
      savedCount++;
    }
    await batch.commit();
  }

  let syncedStudentsCount = 0;
  if (syncToStudents && advisors.length > 0) {
    const year = advisors[0].academicYear || 2569;
    syncedStudentsCount = await syncAllAdvisorsToStudents(advisors, year);
  }

  return { savedCount, syncedStudentsCount };
}

/**
 * Delete a Homeroom Advisor
 */
export async function deleteHomeroomAdvisor(advisorId: string): Promise<void> {
  const docRef = doc(db, ADVISORS_COLLECTION, advisorId);
  await deleteDoc(docRef);
}

/**
 * Sync advisor name to all active students in a specific classroom (gradeLevel & room)
 */
export async function syncClassroomAdvisorToStudents(
  gradeLevel: GradeLevel,
  room: number,
  academicYear: number = 2569,
  advisorName: string
): Promise<number> {
  try {
    const studentsSnap = await getDocs(collection(db, STUDENTS_COLLECTION));
    const matchingStudents: Student[] = [];
    
    studentsSnap.forEach(d => {
      const st = d.data() as Student;
      if (st.status === 'ACTIVE' && Number(st.room) === Number(room)) {
        const { grade } = calculateStudentGrade(st.entryYear, st.entryLevel, academicYear);
        if (grade === gradeLevel) {
          matchingStudents.push(st);
        }
      }
    });

    if (matchingStudents.length === 0) return 0;

    const chunkSize = 400;
    let updated = 0;
    for (let i = 0; i < matchingStudents.length; i += chunkSize) {
      const chunk = matchingStudents.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const st of chunk) {
        const docRef = doc(db, STUDENTS_COLLECTION, st.id);
        batch.update(docRef, {
          advisorName: advisorName,
          updatedAt: new Date().toISOString()
        });
        updated++;
      }
      await batch.commit();
    }
    return updated;
  } catch (err) {
    console.error('syncClassroomAdvisorToStudents error:', err);
    return 0;
  }
}

/**
 * Sync all advisors to their respective classrooms in one pass
 */
export async function syncAllAdvisorsToStudents(
  advisors: HomeroomAdvisor[],
  academicYear: number = 2569
): Promise<number> {
  try {
    // Group advisors by gradeLevel + room and sort by advisorOrder (1 first)
    const advisorMap = new Map<string, HomeroomAdvisor[]>();
    advisors.forEach(a => {
      const key = `${a.gradeLevel}_${a.room}`;
      const current = advisorMap.get(key) || [];
      current.push(a);
      advisorMap.set(key, current);
    });

    const studentsSnap = await getDocs(collection(db, STUDENTS_COLLECTION));
    const toUpdate: { student: Student; newAdvisor: string }[] = [];

    studentsSnap.forEach(d => {
      const st = d.data() as Student;
      if (st.status === 'ACTIVE') {
        const { grade } = calculateStudentGrade(st.entryYear, st.entryLevel, academicYear);
        const key = `${grade}_${st.room}`;
        const advList = advisorMap.get(key);
        if (advList && advList.length > 0) {
          // Sort strictly by advisorOrder starting with 1 (ครูที่ปรึกษา 1) first
          const sorted = [...advList].sort((a, b) => (Number(a.advisorOrder) || 1) - (Number(b.advisorOrder) || 1));
          const combined = sorted.map(a => a.fullName || `${a.prefix || ''}${a.firstName} ${a.lastName}`.trim()).join(', ');
          if (st.advisorName !== combined) {
            toUpdate.push({ student: st, newAdvisor: combined });
          }
        }
      }
    });

    if (toUpdate.length === 0) return 0;

    const chunkSize = 400;
    let count = 0;
    for (let i = 0; i < toUpdate.length; i += chunkSize) {
      const chunk = toUpdate.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const item of chunk) {
        const docRef = doc(db, STUDENTS_COLLECTION, item.student.id);
        batch.update(docRef, {
          advisorName: item.newAdvisor,
          updatedAt: new Date().toISOString()
        });
        count++;
      }
      await batch.commit();
    }
    return count;
  } catch (err) {
    console.error('syncAllAdvisorsToStudents error:', err);
    return 0;
  }
}

/**
 * Remove Sample / Mock Data (ลบข้อมูลตัวอย่างทั้งหมดและประวัติออกจากระบบ)
 */
export async function clearSampleMockData(): Promise<{
  deletedStudents: number;
  deletedLogs: number;
  deletedGrants: number;
  deletedAdvisors: number;
}> {
  const sampleStudentIds = ['05505', '05506', '05507', '05508', '05509', '05510', '05511', '05512'];
  const sampleLogIds = ['log-001', 'log-002', 'log-003', 'log-004', 'log-005', 'log-006', 'log-007', 'log-008', 'log-009'];

  let deletedStudents = 0;
  let deletedLogs = 0;
  let deletedGrants = 0;
  let deletedAdvisors = 0;

  // 1. Find and delete all students with isSampleData: true or sample IDs
  const studentSnap = await getDocs(collection(db, STUDENTS_COLLECTION));
  const batch1 = writeBatch(db);
  studentSnap.forEach(d => {
    const st = d.data() as Student;
    if (st.isSampleData || sampleStudentIds.includes(st.id) || sampleStudentIds.includes(d.id)) {
      batch1.delete(d.ref);
      deletedStudents++;
    }
  });
  if (deletedStudents > 0) {
    await batch1.commit();
  }

  // 2. Find and delete corresponding logs
  const logSnap = await getDocs(collection(db, CONDUCT_LOGS_COLLECTION));
  const batch2 = writeBatch(db);
  logSnap.forEach(d => {
    const lg = d.data() as ConductLog;
    if (sampleLogIds.includes(lg.id) || sampleLogIds.includes(d.id) || sampleStudentIds.includes(lg.studentId)) {
      batch2.delete(d.ref);
      deletedLogs++;
    }
  });
  if (deletedLogs > 0) {
    await batch2.commit();
  }

  // 3. Find and delete corresponding student access grants
  const grantSnap = await getDocs(collection(db, ACCESS_GRANTS_COLLECTION));
  const batch3 = writeBatch(db);
  grantSnap.forEach(d => {
    const gr = d.data() as StudentAccessGrant;
    if (sampleStudentIds.includes(gr.studentId)) {
      batch3.delete(d.ref);
      deletedGrants++;
    }
  });
  if (deletedGrants > 0) {
    await batch3.commit();
  }

  // 4. Find and delete sample advisors
  const advSnap = await getDocs(collection(db, ADVISORS_COLLECTION));
  const batch4 = writeBatch(db);
  advSnap.forEach(d => {
    const ad = d.data() as HomeroomAdvisor;
    if (ad.isSampleData || d.id.startsWith('adv-2569-')) {
      batch4.delete(d.ref);
      deletedAdvisors++;
    }
  });
  if (deletedAdvisors > 0) {
    await batch4.commit();
  }

  return { deletedStudents, deletedLogs, deletedGrants, deletedAdvisors };
}

/**
 * Seed / Load Initial Sample Mock Data (โหลดข้อมูลตัวอย่างเริ่มต้นเมื่อผู้ใช้ต้องการเรียกใช้)
 */
export async function seedSampleMockData(): Promise<{
  seededStudents: number;
  seededLogs: number;
  seededAdvisors: number;
}> {
  // 1. Batch save students
  const seededStudents = await batchSaveStudents(INITIAL_SAMPLE_STUDENTS);

  // 2. Batch save conduct logs
  let seededLogs = 0;
  const chunkSize = 400;
  for (let i = 0; i < INITIAL_SAMPLE_LOGS.length; i += chunkSize) {
    const chunk = INITIAL_SAMPLE_LOGS.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const log of chunk) {
      const docRef = doc(collection(db, CONDUCT_LOGS_COLLECTION), log.id);
      batch.set(docRef, log, { merge: true });
      seededLogs++;
    }
    await batch.commit();
  }

  // 3. Batch save advisors
  const { savedCount: seededAdvisors } = await batchSaveHomeroomAdvisors(INITIAL_SAMPLE_ADVISORS, true);

  return { seededStudents, seededLogs, seededAdvisors };
}

/**
 * Reset Database to Admin Only (ล้างข้อมูลให้เหลือเฉพาะผู้ดูแลเท่านั้น)
 */
export async function resetDatabaseToAdminOnly(): Promise<void> {
  // 1. Delete all students
  const studentSnap = await getDocs(collection(db, STUDENTS_COLLECTION));
  const b1 = writeBatch(db);
  studentSnap.forEach(d => b1.delete(d.ref));
  if (!studentSnap.empty) await b1.commit();

  // 2. Delete all conduct logs
  const logSnap = await getDocs(collection(db, CONDUCT_LOGS_COLLECTION));
  const b2 = writeBatch(db);
  logSnap.forEach(d => b2.delete(d.ref));
  if (!logSnap.empty) await b2.commit();

  // 3. Delete all access grants
  const grantSnap = await getDocs(collection(db, ACCESS_GRANTS_COLLECTION));
  const b3 = writeBatch(db);
  grantSnap.forEach(d => b3.delete(d.ref));
  if (!grantSnap.empty) await b3.commit();

  // 4. Delete all advisors
  const advSnap = await getDocs(collection(db, ADVISORS_COLLECTION));
  const bAdv = writeBatch(db);
  advSnap.forEach(d => bAdv.delete(d.ref));
  if (!advSnap.empty) await bAdv.commit();

  // 5. Delete all users except admin (213894120)
  const usersSnap = await getDocs(collection(db, USERS_COLLECTION));
  const b4 = writeBatch(db);
  usersSnap.forEach(d => {
    if (d.id !== 'admin') {
      b4.delete(d.ref);
    }
  });
  // Ensure default admin is present
  b4.set(doc(db, USERS_COLLECTION, DEFAULT_ADMIN_USER.id), DEFAULT_ADMIN_USER);
  await b4.commit();

  // 6. Reset settings
  await saveSystemSettings(DEFAULT_SETTINGS);
}

/**
 * ลบประวัติการเพิ่มและหักคะแนน และลบร่องรอยคะแนนความประพฤติรายบุคคล (Individual Student)
 * - ลบรายการใน conduct_logs ทั้งหมดของนักเรียนคนนี้
 * - ปรับคะแนนกลับเป็น 100 คะแนนเต็ม, ล้างแต้มสะสมสำรองเป็น 0, และคืนสถานะไม่เคยถูกหักคะแนน (hasNeverBeenDeducted: true)
 */
export async function clearIndividualStudentConduct(studentId: string): Promise<{
  deletedLogsCount: number;
  studentId: string;
}> {
  // 1. Delete all conduct logs for this student
  const q = query(
    collection(db, CONDUCT_LOGS_COLLECTION),
    where('studentId', '==', studentId)
  );
  const logSnap = await getDocs(q);
  let deletedLogsCount = 0;
  const chunkSize = 400;
  const logDocs = logSnap.docs;

  for (let i = 0; i < logDocs.length; i += chunkSize) {
    const chunk = logDocs.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const d of chunk) {
      batch.delete(d.ref);
      deletedLogsCount++;
    }
    await batch.commit();
  }

  // 2. Reset student's conduct score traces in Firestore completely (Clean slate)
  const studentRef = doc(db, STUDENTS_COLLECTION, studentId);
  await updateDoc(studentRef, {
    currentScore: 100,
    bankedPoints: 0,
    totalDeductionsCount: 0,
    totalDeductedPoints: 0,
    totalAddedPoints: 0,
    hasNeverBeenDeducted: true,
    updatedAt: new Date().toISOString()
  });

  return { deletedLogsCount, studentId };
}

/**
 * ลบประวัติการเพิ่มและหักคะแนน และลบร่องรอยคะแนนความประพฤติของนักเรียนทั้งหมดในระบบ (All Students)
 * - ลบรายการใน conduct_logs ทั้งหมดในระบบ
 * - ปรับคะแนนนักเรียนทุกคนกลับเป็น 100 คะแนนเต็ม, ล้างแต้มสะสมสำรองเป็น 0, ล้างจำนวนครั้งและคะแนนที่เคยหัก/เพิ่มเป็น 0 และคืนสถานะไม่เคยถูกหักคะแนน (hasNeverBeenDeducted: true)
 */
export async function clearAllConductData(): Promise<{
  deletedLogsCount: number;
  updatedStudentsCount: number;
}> {
  // 1. Delete all conduct logs
  const logSnap = await getDocs(collection(db, CONDUCT_LOGS_COLLECTION));
  let deletedLogsCount = 0;
  const chunkSize = 400;
  const logDocs = logSnap.docs;

  for (let i = 0; i < logDocs.length; i += chunkSize) {
    const chunk = logDocs.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const d of chunk) {
      batch.delete(d.ref);
      deletedLogsCount++;
    }
    await batch.commit();
  }

  // 2. Reset all students' conduct scores & traces completely
  const studentSnap = await getDocs(collection(db, STUDENTS_COLLECTION));
  let updatedStudentsCount = 0;
  const studentDocs = studentSnap.docs;

  for (let i = 0; i < studentDocs.length; i += chunkSize) {
    const chunk = studentDocs.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const d of chunk) {
      batch.update(d.ref, {
        currentScore: 100,
        bankedPoints: 0,
        totalDeductionsCount: 0,
        totalDeductedPoints: 0,
        totalAddedPoints: 0,
        hasNeverBeenDeducted: true,
        updatedAt: new Date().toISOString()
      });
      updatedStudentsCount++;
    }
    await batch.commit();
  }

  return { deletedLogsCount, updatedStudentsCount };
}

/**
 * ตรวจสอบและปรับปรุงข้อมูลนักเรียนที่โดนลบประวัติและร่องรอยคะแนนความประพฤติ
 * เพื่อให้แน่ใจว่านักเรียนที่ไม่มีประวัติ (0 รายการ) จะถูกลบร่องรอยออกจาก 6 เกณฑ์มาตรฐานอย่างสมบูรณ์:
 * - คืนคะแนนเต็ม 100 คะแนน
 * - ล้างคะแนนสำรอง bankedPoints = 0
 * - ล้างจำนวนครั้งที่โดนหัก totalDeductionsCount = 0
 * - ล้างคะแนนที่โดนหักสะสม totalDeductedPoints = 0
 * - ล้างคะแนนที่ได้รับเพิ่มสะสม totalAddedPoints = 0
 * - คืนสถานะ hasNeverBeenDeducted = true
 * ทำให้เหมือนไม่เคยทำความผิด และไม่เคยเพิ่มความดี โดยจะถูกจัดอยู่ในเกณฑ์ "ปกติ" เสมอ
 */
export async function auditAndReconcileClearedStudentsConduct(): Promise<{
  inspectedStudentsCount: number;
  fixedStudentsCount: number;
  fixedStudentIds: string[];
}> {
  try {
    const studentSnap = await getDocs(collection(db, STUDENTS_COLLECTION));
    const logSnap = await getDocs(collection(db, CONDUCT_LOGS_COLLECTION));

    const logsByStudent = new Map<string, ConductLog[]>();
    logSnap.docs.forEach(docSnap => {
      const log = docSnap.data() as ConductLog;
      if (log && log.studentId) {
        const existing = logsByStudent.get(log.studentId) || [];
        existing.push(log);
        logsByStudent.set(log.studentId, existing);
      }
    });

    const studentsToUpdate: { ref: any; data: Partial<Student> }[] = [];
    const fixedStudentIds: string[] = [];

    studentSnap.docs.forEach(docSnap => {
      const student = docSnap.data() as Student;
      if (!student || !student.id) return;

      const stLogs = logsByStudent.get(student.id) || [];

      // กรณีไม่มีประวัติคะแนนเลย (เช่น โดนลบประวัติและร่องรอยแล้ว หรือยังไม่เคยมีประวัติ)
      if (stLogs.length === 0) {
        const isPristine =
          Number(student.currentScore) === 100 &&
          Number(student.bankedPoints || 0) === 0 &&
          Number(student.totalDeductionsCount || 0) === 0 &&
          Number(student.totalDeductedPoints || 0) === 0 &&
          Number(student.totalAddedPoints || 0) === 0 &&
          student.hasNeverBeenDeducted === true;

        if (!isPristine) {
          studentsToUpdate.push({
            ref: docSnap.ref,
            data: {
              currentScore: 100,
              bankedPoints: 0,
              totalDeductionsCount: 0,
              totalDeductedPoints: 0,
              totalAddedPoints: 0,
              hasNeverBeenDeducted: true,
              updatedAt: new Date().toISOString()
            }
          });
          fixedStudentIds.push(student.id);
        }
      }
    });

    // Batch update students who need resetting
    const chunkSize = 400;
    for (let i = 0; i < studentsToUpdate.length; i += chunkSize) {
      const chunk = studentsToUpdate.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const item of chunk) {
        batch.update(item.ref, cleanForFirestore(item.data));
      }
      await batch.commit();
    }

    return {
      inspectedStudentsCount: studentSnap.docs.length,
      fixedStudentsCount: studentsToUpdate.length,
      fixedStudentIds
    };
  } catch (err) {
    console.error('auditAndReconcileClearedStudentsConduct error:', err);
    throw err;
  }
}

/**
 * Export Full Database Backup as JSON Object
 */
export async function exportDatabaseBackup(): Promise<any> {
  const students = await fetchAllStudents();
  
  const logSnap = await getDocs(collection(db, CONDUCT_LOGS_COLLECTION));
  const logs: ConductLog[] = [];
  logSnap.forEach(d => logs.push(d.data() as ConductLog));

  const settings = await fetchSystemSettings();
  const users = await fetchAppUsers();
  const grants = await fetchStudentAccessGrants();
  const advisors = await fetchHomeroomAdvisors();
  const standardBehaviors = await fetchStandardBehaviors();

  return {
    version: '2.2',
    exportedAt: new Date().toISOString(),
    schoolName: settings.schoolNameTh || settings.schoolName,
    data: {
      students,
      conductLogs: logs,
      settings,
      users,
      accessGrants: grants,
      advisors,
      standardBehaviors
    }
  };
}

/**
 * Import and Restore Database from JSON Backup
 */
export async function importDatabaseBackup(backup: any): Promise<{
  studentsCount: number;
  logsCount: number;
  usersCount: number;
  advisorsCount: number;
  standardBehaviorsCount?: number;
}> {
  if (!backup || !backup.data) {
    throw new Error('รูปแบบไฟล์สำรองข้อมูลไม่ถูกต้อง (Invalid Backup Structure)');
  }

  const {
    students = [],
    conductLogs = [],
    settings,
    users = [],
    accessGrants = [],
    advisors = [],
    standardBehaviors = []
  } = backup.data;

  // 1. Restore Students
  if (Array.isArray(students) && students.length > 0) {
    await batchSaveStudents(students);
  }

  // 2. Restore Conduct Logs
  if (Array.isArray(conductLogs) && conductLogs.length > 0) {
    const chunkSize = 400;
    for (let i = 0; i < conductLogs.length; i += chunkSize) {
      const chunk = conductLogs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const log of chunk) {
        const docRef = doc(collection(db, CONDUCT_LOGS_COLLECTION), log.id);
        batch.set(docRef, log, { merge: true });
      }
      await batch.commit();
    }
  }

  // 3. Restore Users
  if (Array.isArray(users) && users.length > 0) {
    for (const u of users) {
      await saveAppUser(u);
    }
  }

  // 4. Restore Access Grants
  if (Array.isArray(accessGrants) && accessGrants.length > 0) {
    for (const g of accessGrants) {
      await saveStudentAccessGrant(g);
    }
  }

  // 5. Restore Homeroom Advisors
  if (Array.isArray(advisors) && advisors.length > 0) {
    await batchSaveHomeroomAdvisors(advisors, true);
  }

  // 6. Restore Settings
  if (settings) {
    await saveSystemSettings(settings);
  }

  // 7. Restore Standard Behaviors
  let standardBehaviorsCount = 0;
  if (Array.isArray(standardBehaviors) && standardBehaviors.length > 0) {
    standardBehaviorsCount = await batchSaveStandardBehaviors(standardBehaviors);
  }

  return {
    studentsCount: students.length,
    logsCount: conductLogs.length,
    usersCount: users.length,
    advisorsCount: advisors.length,
    standardBehaviorsCount
  };
}

/**
 * -------------------------------------------------------------
 * Standard Conduct Behaviors (หัวข้อหรือพฤติกรรมมาตรฐาน)
 * -------------------------------------------------------------
 */

/**
 * Fetch all standard conduct behaviors from Firestore
 */
export async function fetchStandardBehaviors(): Promise<StandardConductBehavior[]> {
  try {
    const snap = await getDocs(collection(db, STANDARD_BEHAVIORS_COLLECTION));
    if (snap.empty) {
      return [];
    }
    const items: StandardConductBehavior[] = [];
    snap.forEach(d => {
      const data = d.data() as StandardConductBehavior;
      items.push({
        ...data,
        id: data.id || d.id
      });
    });

    // Sort by type: DEDUCT first, then title (ชื่อพฤติกรรม ก-ฮ), then points
    return items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'DEDUCT' ? -1 : 1;
      const titleCompare = (a.title || '').localeCompare(b.title || '', 'th');
      if (titleCompare !== 0) return titleCompare;
      return (a.points || 0) - (b.points || 0);
    });
  } catch (error) {
    console.error('Error fetching standard behaviors from Firestore:', error);
    return [];
  }
}

/**
 * Save / Update a single standard conduct behavior in Firestore
 */
export async function saveStandardBehavior(behavior: StandardConductBehavior): Promise<void> {
  const cleaned = cleanForFirestore({
    ...behavior,
    updatedAt: new Date().toISOString()
  });
  const docRef = doc(db, STANDARD_BEHAVIORS_COLLECTION, behavior.id);
  await setDoc(docRef, cleaned, { merge: true });
}

/**
 * Delete a standard conduct behavior from Firestore
 */
export async function deleteStandardBehavior(behaviorId: string): Promise<void> {
  const docRef = doc(db, STANDARD_BEHAVIORS_COLLECTION, behaviorId);
  await deleteDoc(docRef);
}

/**
 * Batch save multiple standard behaviors to Firestore
 */
export async function batchSaveStandardBehaviors(behaviors: StandardConductBehavior[]): Promise<number> {
  let count = 0;
  const chunkSize = 400;
  for (let i = 0; i < behaviors.length; i += chunkSize) {
    const chunk = behaviors.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const b of chunk) {
      const cleaned = cleanForFirestore({
        ...b,
        updatedAt: new Date().toISOString()
      });
      const docRef = doc(db, STANDARD_BEHAVIORS_COLLECTION, b.id);
      batch.set(docRef, cleaned, { merge: true });
      count++;
    }
    await batch.commit();
  }
  return count;
}

/**
 * Clear sample/mock standard behaviors from Firestore
 */
export async function clearSampleStandardBehaviors(): Promise<number> {
  const snap = await getDocs(collection(db, STANDARD_BEHAVIORS_COLLECTION));
  let count = 0;
  for (const d of snap.docs) {
    if (d.id.startsWith('bhv-deduct-') || d.id.startsWith('bhv-add-')) {
      await deleteDoc(doc(db, STANDARD_BEHAVIORS_COLLECTION, d.id));
      count++;
    }
  }
  return count;
}

/**
 * Metadata and technical information for the Firestore connection
 */
export function getFirestoreConfigInfo() {
  return {
    projectId: firebaseConfig.projectId,
    firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || '(default)',
    authDomain: firebaseConfig.authDomain,
    storageBucket: firebaseConfig.storageBucket,
    appId: firebaseConfig.appId,
    mode: 'Multi-Region Cloud Firestore',
    syncMode: 'Real-time Listeners (Active)',
    transport: 'Auto-detect Long Polling & WebChannel (iFrame Safe)',
    cache: 'Persistent Multi-Tab Local Storage (IndexedDB)'
  };
}

/**
 * Actively test round-trip connection to Google Cloud Firestore server
 * Returns connection health, latency in ms, and any error message
 */
export async function testFirestoreConnection(): Promise<{
  connected: boolean;
  latencyMs: number;
  error?: string;
  timestamp: string;
}> {
  const startTime = performance.now();
  try {
    // Attempt direct server read to confirm active cloud link (bypassing local cache)
    await getDocFromServer(doc(db, SETTINGS_COLLECTION, 'global_config'));
    const latencyMs = Math.max(1, Math.round(performance.now() - startTime));
    return {
      connected: true,
      latencyMs,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    const msg = error?.message || String(error);
    return {
      connected: false,
      latencyMs,
      error: msg,
      timestamp: new Date().toISOString()
    };
  }
}



/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Student,
  ConductLog,
  SystemSettings,
  UserRole,
  ConductType,
  AppUser,
  StudentAccessGrant,
  AppView,
  HomeroomAdvisor,
  GradeLevel,
  StandardConductBehavior,
  Dormitory
} from './types';
import {
  db,
  saveStudentToDb,
  batchSaveStudents,
  batchRecordConductLogsTransaction,
  recordConductLogTransaction,
  updateConductLogTransaction,
  deleteConductLogTransaction,
  deleteStudentFromDb,
  batchDeleteStudents,
  deleteStudentConductLogs,
  saveSystemSettings,
  fetchSystemSettings,
  fetchAppUsers,
  saveAppUser,
  deleteAppUser,
  fetchStudentAccessGrants,
  saveStudentAccessGrant,
  batchSaveStudentAccessGrants,
  revokeStudentAccessGrant,
  fetchHomeroomAdvisors,
  saveHomeroomAdvisor,
  batchSaveHomeroomAdvisors,
  deleteHomeroomAdvisor,
  deleteAllHomeroomAdvisors,
  syncClassroomAdvisorToStudents,
  syncAllAdvisorsToStudents,
  fetchStandardBehaviors,
  saveStandardBehavior,
  deleteStandardBehavior,
  batchSaveStandardBehaviors,
  clearSampleMockData,
  seedSampleMockData,
  clearAllStudentPhotos,
  clearIndividualStudentConduct,
  clearAllConductData,
  auditAndReconcileClearedStudentsConduct,
  resetDatabaseToAdminOnly,
  exportDatabaseBackup,
  importDatabaseBackup,
  fetchDormitories,
  saveDormitory,
  batchSaveDormitories,
  deleteDormitory,
  resetDefaultDormitories,
  syncStudentsToDormitoriesInDb,
  clearAllStudentDormitoriesInDb,
  assignStudentDormitoryInDb,
  batchAssignStudentsDormitoryInDb,
  DORMITORIES_COLLECTION,
  STUDENTS_COLLECTION,
  CONDUCT_LOGS_COLLECTION,
  USERS_COLLECTION,
  ACCESS_GRANTS_COLLECTION,
  ADVISORS_COLLECTION,
  STANDARD_BEHAVIORS_COLLECTION,
  DEFAULT_SETTINGS,
  DEFAULT_INITIAL_USERS
} from './firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { INITIAL_SAMPLE_STUDENTS, INITIAL_SAMPLE_LOGS, INITIAL_SAMPLE_ADVISORS } from './data/mockSampleData';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { HomeLandingView } from './components/HomeLandingView';
import { Dashboard } from './components/Dashboard';
import { StudentLookup } from './components/StudentLookup';
import { AdvisorManagementView } from './components/AdvisorManagementView';
import { LoginModal } from './components/LoginModal';
import { GrantAccessModal } from './components/GrantAccessModal';
import { SchoolBrandingSettings } from './components/SchoolBrandingSettings';
import { StandardBehaviorsSettings } from './components/StandardBehaviorsSettings';
import { UserManagementSettings } from './components/UserManagementSettings';
import { DatabaseSettings } from './components/DatabaseSettings';
import { StudentGrantsSettings } from './components/StudentGrantsSettings';
import { SystemUsageStatsSettings } from './components/SystemUsageStatsSettings';
import { MenuPermissionsSettings } from './components/MenuPermissionsSettings';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { canUserAccessMenu, canDeleteTargetUser, getUserRoleLevel, getRoleLevelByRoleName } from './utils/menuPermissions';
import { ConductActionModal } from './components/ConductActionModal';
import { HonourRollModal } from './components/HonourRollModal';
import { ImportStudentsModal } from './components/ImportStudentsModal';
import { ImportConductLogsModal } from './components/ImportConductLogsModal';
import { YearResetModal } from './components/YearResetModal';
import { CriticalAlertView } from './components/CriticalAlertView';
import { ConductReportView, ConductReportTab } from './components/ConductReportView';
import { StudentPhotoManagerModal } from './components/StudentPhotoManagerModal';
import { recordRealOperation } from './utils/actualUsageTracker';
import { ScoreCheckView } from './components/ScoreCheckView';
import { AddStudentModal } from './components/AddStudentModal';
import { EditStudentModal } from './components/EditStudentModal';
import { DormitoryManagementView } from './components/DormitoryManagementView';
import { DormitoryStudentsView } from './components/DormitoryStudentsView';
import { DEFAULT_DORMITORIES } from './utils/dormitoryLogic';
import { Loader2, ShieldAlert } from 'lucide-react';

const getActiveReportTabFromView = (view: AppView): ConductReportTab => {
  switch (view) {
    case 'REPORT_GRADE_LEVEL':
      return 'GRADE_LEVEL';
    case 'REPORT_FULL_100':
      return 'FULL_100';
    case 'REPORT_HONOUR_100':
      return 'HONOUR_100_PLUS';
    case 'REPORT_POINTS_ADDED':
      return 'POINTS_ADDED';
    case 'REPORT_POINTS_DEDUCTED':
      return 'POINTS_DEDUCTED';
    case 'REPORT_INDIVIDUAL':
    case 'REPORTS':
    default:
      return 'INDIVIDUAL';
  }
};

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [conductLogs, setConductLogs] = useState<ConductLog[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    try {
      const cached = localStorage.getItem('conduct_cached_settings');
      return cached ? JSON.parse(cached) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const cached = localStorage.getItem('conduct_cached_users');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      return DEFAULT_INITIAL_USERS;
    } catch {
      return DEFAULT_INITIAL_USERS;
    }
  });
  const [accessGrants, setAccessGrants] = useState<StudentAccessGrant[]>([]);
  const [advisors, setAdvisors] = useState<HomeroomAdvisor[]>([]);
  const [dormitories, setDormitories] = useState<Dormitory[]>(() => {
    try {
      const cached = localStorage.getItem('conduct_cached_dormitories');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      return DEFAULT_DORMITORIES;
    } catch {
      return DEFAULT_DORMITORIES;
    }
  });
  const [standardBehaviors, setStandardBehaviors] = useState<StandardConductBehavior[]>([]);
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      // Clear any legacy persistent login from localStorage so browser restart requires fresh login
      localStorage.removeItem('conduct_auth_user');
      const hasCachedSettings = !!localStorage.getItem('conduct_cached_settings');
      const hasCachedUser = !!sessionStorage.getItem('conduct_auth_user');
      return !hasCachedSettings && !hasCachedUser;
    } catch {
      return true;
    }
  });
  const [passwordTargetUser, setPasswordTargetUser] = useState<AppUser | null>(null);

  // Authentication & Access State (Session-only: terminates on browser close or logout)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      localStorage.removeItem('conduct_auth_user');
      const saved = sessionStorage.getItem('conduct_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [studentGrant, setStudentGrant] = useState<StudentAccessGrant | null>(() => {
    try {
      const saved = sessionStorage.getItem('conduct_student_grant');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // App Navigation state (derived from current active session)
  const [currentView, setCurrentView] = useState<AppView>(() => {
    try {
      localStorage.removeItem('conduct_auth_user');
      const savedUser = sessionStorage.getItem('conduct_auth_user');
      if (savedUser) return 'DASHBOARD';
      const savedGrant = sessionStorage.getItem('conduct_student_grant');
      if (savedGrant) return 'LOOKUP';
      return 'HOME';
    } catch {
      return 'HOME';
    }
  });
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedDormIdForStudentsView, setSelectedDormIdForStudentsView] = useState<string | undefined>(undefined);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  const getPermittedSettingsView = (): AppView => {
    const candidates: AppView[] = [
      'SETTINGS_BRANDING',
      'SETTINGS_BEHAVIORS',
      'SETTINGS_USERS',
      'SETTINGS_DATABASE',
      'SETTINGS_GRANTS',
      'SETTINGS_MENU_PERMISSIONS'
    ];
    for (const v of candidates) {
      if (canUserAccessMenu(v, currentUser, studentGrant, systemSettings?.menuPermissions)) {
        return v;
      }
    }
    return 'SETTINGS_BRANDING';
  };

  const handleChangeView = (view: AppView) => {
    if (view === 'LOOKUP') {
      setSelectedStudentId('');
    }
    if (view === 'SETTINGS') {
      view = getPermittedSettingsView();
    }
    setCurrentView(view);
  };

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [currentView]);

  // Interactive Action Dialogs
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [grantTargetStudent, setGrantTargetStudent] = useState<Student | null>(null);
  const [conductActionTarget, setConductActionTarget] = useState<{
    student: Student;
    defaultType: ConductType;
  } | null>(null);
  const [showPhotoManagerModal, setShowPhotoManagerModal] = useState<boolean>(false);
  const [showImportConductModal, setShowImportConductModal] = useState<boolean>(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // 1. Realtime Listeners & Fast Parallel Initial Data Fetching
  useEffect(() => {
    let unsubscribeStudents: () => void = () => {};
    let unsubscribeLogs: () => void = () => {};
    let unsubscribeUsers: () => void = () => {};
    let unsubscribeGrants: () => void = () => {};
    let unsubscribeAdvisors: () => void = () => {};
    let unsubscribeBehaviors: () => void = () => {};
    let unsubscribeDormitories: () => void = () => {};

    // Fast safety timeout: dismiss loading screen in max 600ms so user never waits
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 600);

    try {
      // 1.1 Realtime listener for students collection (starts immediately)
      unsubscribeStudents = onSnapshot(
        collection(db, STUDENTS_COLLECTION),
        (snapshot) => {
          const loaded: Student[] = [];
          const seenIds = new Set<string>();
          snapshot.forEach((docSnap) => {
            const studentData = docSnap.data() as Student;
            if (studentData && studentData.id && !seenIds.has(studentData.id)) {
              seenIds.add(studentData.id);
              loaded.push(studentData);
            }
          });
          setStudents(loaded);
          setLoading(false);
          if (!snapshot.empty) {
            recordRealOperation('READ', snapshot.size, STUDENTS_COLLECTION, 'REALTIME_SNAPSHOT_STUDENTS', `โหลดรายชื่อนักเรียน ${snapshot.size} คน`);
          }
        },
        (err) => {
          console.warn('Firestore students error:', err);
          setLoading(false);
        }
      );

      // 1.2 Realtime listener for conduct logs collection
      unsubscribeLogs = onSnapshot(
        collection(db, CONDUCT_LOGS_COLLECTION),
        (snapshot) => {
          const loadedLogs: ConductLog[] = [];
          const seenIds = new Set<string>();
          snapshot.forEach((docSnap) => {
            const logData = docSnap.data() as ConductLog;
            if (logData && logData.id && !seenIds.has(logData.id)) {
              seenIds.add(logData.id);
              loadedLogs.push(logData);
            }
          });
          setConductLogs(loadedLogs);
          if (!snapshot.empty) {
            recordRealOperation('READ', snapshot.size, CONDUCT_LOGS_COLLECTION, 'REALTIME_SNAPSHOT_LOGS', `โหลดประวัติคะแนน ${snapshot.size} รายการ`);
          }
        },
        (err) => {
          console.warn('Firestore logs snapshot error:', err);
        }
      );

      // 1.3 Realtime listener for users collection
      unsubscribeUsers = onSnapshot(
        collection(db, USERS_COLLECTION),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: AppUser[] = [];
            snapshot.forEach((docSnap) => {
              list.push(docSnap.data() as AppUser);
            });
            setUsers(prev => {
              const merged = [...list];
              // Ensure local additions are preserved
              for (const p of prev) {
                if (!merged.some(m => m.id === p.id || m.username.toLowerCase() === p.username.toLowerCase())) {
                  merged.push(p);
                }
              }
              try { localStorage.setItem('conduct_cached_users', JSON.stringify(merged)); } catch {}
              return merged;
            });
          }
        },
        (err) => {
          console.warn('Firestore users snapshot error:', err);
        }
      );

      // 1.4 Realtime listener for student access grants
      unsubscribeGrants = onSnapshot(
        collection(db, ACCESS_GRANTS_COLLECTION),
        (snapshot) => {
          const list: StudentAccessGrant[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as StudentAccessGrant);
          });
          setAccessGrants(list.sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime()));
        },
        (err) => {
          console.warn('Firestore grants snapshot error:', err);
        }
      );

      // 1.5 Realtime listener for homeroom advisors
      unsubscribeAdvisors = onSnapshot(
        collection(db, ADVISORS_COLLECTION),
        (snapshot) => {
          const list: HomeroomAdvisor[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as HomeroomAdvisor);
          });
          setAdvisors(list);
        },
        (err) => {
          console.warn('Firestore advisors snapshot error:', err);
        }
      );

      // 1.6 Realtime listener for standard conduct behaviors
      unsubscribeBehaviors = onSnapshot(
        collection(db, STANDARD_BEHAVIORS_COLLECTION),
        (snapshot) => {
          if (snapshot.empty) {
            fetchStandardBehaviors().then(setStandardBehaviors);
            return;
          }
          const list: StandardConductBehavior[] = [];
          const seenIds = new Set<string>();
          snapshot.forEach((docSnap) => {
            const b = docSnap.data() as StandardConductBehavior;
            if (b && b.id && !seenIds.has(b.id)) {
              seenIds.add(b.id);
              list.push(b);
            }
          });
          list.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'DEDUCT' ? -1 : 1;
            if (a.category !== b.category) return (a.category || '').localeCompare(b.category || '', 'th');
            return (a.points || 0) - (b.points || 0);
          });
          setStandardBehaviors(list);
        },
        (err) => {
          console.warn('Firestore behaviors snapshot error:', err);
        }
      );

      // 1.7 Snapshot listener for Dormitories
      unsubscribeDormitories = onSnapshot(
        collection(db, DORMITORIES_COLLECTION),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: Dormitory[] = [];
            snapshot.forEach((docSnap) => {
              const d = docSnap.data() as Dormitory;
              if (d && d.id) {
                list.push(d);
              }
            });
            list.sort((a, b) => a.dormNumber - b.dormNumber);
            setDormitories(list);
            try { localStorage.setItem('conduct_cached_dormitories', JSON.stringify(list)); } catch {}
          }
        },
        (err) => {
          console.warn('Firestore dormitories snapshot error:', err);
        }
      );

      // 1.8 Parallel initial fetch for fast non-blocking hydration
      Promise.allSettled([
        fetchSystemSettings(),
        fetchAppUsers(),
        fetchStudentAccessGrants(),
        fetchHomeroomAdvisors(),
        fetchStandardBehaviors(),
        fetchDormitories()
      ]).then(([settingsRes, usersRes, grantsRes, advisorsRes, behaviorsRes, dormsRes]) => {
        if (settingsRes.status === 'fulfilled' && settingsRes.value) {
          setSystemSettings(settingsRes.value);
          try { localStorage.setItem('conduct_cached_settings', JSON.stringify(settingsRes.value)); } catch {}
        }
        if (usersRes.status === 'fulfilled' && usersRes.value && usersRes.value.length > 0) {
          setUsers(prev => {
            const fetched = usersRes.value;
            const merged = [...fetched];
            for (const p of prev) {
              if (!merged.some(m => m.id === p.id || m.username.toLowerCase() === p.username.toLowerCase())) {
                merged.push(p);
              }
            }
            try { localStorage.setItem('conduct_cached_users', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
        if (grantsRes.status === 'fulfilled' && grantsRes.value) {
          setAccessGrants(grantsRes.value);
        }
        if (advisorsRes.status === 'fulfilled' && advisorsRes.value) {
          setAdvisors(advisorsRes.value);
        }
        if (behaviorsRes.status === 'fulfilled' && behaviorsRes.value) {
          setStandardBehaviors(behaviorsRes.value);
        }
        if (dormsRes.status === 'fulfilled' && dormsRes.value && dormsRes.value.length > 0) {
          setDormitories(dormsRes.value);
          try { localStorage.setItem('conduct_cached_dormitories', JSON.stringify(dormsRes.value)); } catch {}
        }
        setLoading(false);
      });
    } catch (e) {
      console.error('Initialization error:', e);
      setStudents(INITIAL_SAMPLE_STUDENTS);
      setConductLogs(INITIAL_SAMPLE_LOGS);
      setAdvisors([]);
      setLoading(false);
    }

    return () => {
      clearTimeout(safetyTimer);
      unsubscribeStudents();
      unsubscribeLogs();
      unsubscribeUsers();
      unsubscribeGrants();
      unsubscribeAdvisors();
      unsubscribeBehaviors();
      unsubscribeDormitories();
    };
  }, []);

  // Update page title & favicon/branding
  useEffect(() => {
    document.title = `${systemSettings.appNameTh || 'ระบบความประพฤตินักเรียน'} - ${
      systemSettings.schoolNameTh || systemSettings.schoolName
    }`;

    // Update favicon tab icon
    const iconLinks = document.querySelectorAll("link[rel*='icon']");
    if (iconLinks.length > 0) {
      iconLinks.forEach((link) => {
        (link as HTMLLinkElement).href = systemSettings.logoUrl || '/favicon.svg';
      });
    }
  }, [systemSettings]);

  // Auth Handlers (Strict session-based: login terminates upon browser close or logout)
  const handleStaffLogin = (user: AppUser) => {
    setCurrentUser(user);
    setStudentGrant(null);
    sessionStorage.setItem('conduct_auth_user', JSON.stringify(user));
    sessionStorage.removeItem('conduct_student_grant');
    localStorage.removeItem('conduct_auth_user');
    setCurrentView('DASHBOARD');
    setShowLoginModal(false);
  };

  const handleStudentAuthorizedView = (student: Student, grant: StudentAccessGrant) => {
    setStudentGrant(grant);
    setCurrentUser(null);
    sessionStorage.setItem('conduct_student_grant', JSON.stringify(grant));
    sessionStorage.removeItem('conduct_auth_user');
    localStorage.removeItem('conduct_auth_user');
    setSelectedStudentId(student?.id || grant.studentId);
    setCurrentView('LOOKUP');
    setShowLoginModal(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setStudentGrant(null);
    sessionStorage.removeItem('conduct_auth_user');
    sessionStorage.removeItem('conduct_student_grant');
    localStorage.removeItem('conduct_auth_user');
    setCurrentView('HOME');
  };

  // Conduct Action Handler - Optimistic UI for instant responsiveness
  const handleConductSubmit = async (log: ConductLog, updatedStudent: Student) => {
    if (currentUser?.role === 'teacher') {
      console.warn('ผู้ใช้งาน Teacher (ระดับ 1) เป็นโหมดดูได้อย่างเดียว ไม่สามารถเพิ่มหรือตัดคะแนนพฤติกรรมได้');
      return;
    }
    const recorder = currentUser ? currentUser.name : (log.recordedBy || 'เจ้าหน้าที่ฝ่ายปกครอง');
    const finalLog: ConductLog = {
      ...log,
      recordedBy: recorder,
      recordedByName: recorder
    };

    // 1. อัปเดต State บนหน้าจอทันที ไม่ต้องรอผลลัพธ์เครือข่าย เพื่อความเร็วสูงสุด
    setStudents(prev => prev.map(s => (s.id === updatedStudent.id ? updatedStudent : s)));
    setConductLogs(prev => {
      const filtered = prev.filter(l => l.id !== finalLog.id);
      return [finalLog, ...filtered];
    });

    // 2. บันทึกลง Firestore Transaction แบบเบื้องหลัง
    try {
      await recordConductLogTransaction(finalLog, updatedStudent);
    } catch (err: any) {
      console.error('Error persisting conduct log transaction:', err);
    }
  };

  // Edit Conduct Log Handler - Optimistic UI
  const handleEditConductLog = async (updatedLog: ConductLog, updatedStudent: Student) => {
    if (currentUser?.role === 'teacher') {
      console.warn('ผู้ใช้งาน Teacher (ระดับ 1) เป็นโหมดดูได้อย่างเดียว ไม่สามารถแก้ไขข้อมูลคะแนนพฤติกรรมได้');
      return;
    }
    // อัปเดตทันที
    setStudents(prev => prev.map(s => (s.id === updatedStudent.id ? updatedStudent : s)));
    setConductLogs(prev => {
      const filtered = prev.filter(l => l.id !== updatedLog.id);
      return [updatedLog, ...filtered];
    });

    try {
      await updateConductLogTransaction(updatedLog, updatedStudent);
    } catch (err: any) {
      console.error('Error updating conduct log transaction:', err);
    }
  };

  // Delete Conduct Log Handler - Optimistic UI
  const handleDeleteConductLog = async (log: ConductLog, updatedStudent: Student) => {
    if (currentUser?.role === 'teacher') {
      console.warn('ผู้ใช้งาน Teacher (ระดับ 1) เป็นโหมดดูได้อย่างเดียว ไม่สามารถลบประวัติคะแนนพฤติกรรมได้');
      return;
    }
    // ลบทันทีบนหน้าจอ
    setStudents(prev => prev.map(s => (s.id === updatedStudent.id ? updatedStudent : s)));
    setConductLogs(prev => prev.filter(l => l.id !== log.id));

    try {
      await deleteConductLogTransaction(log.id, updatedStudent);
    } catch (err: any) {
      console.error('Error deleting conduct log transaction:', err);
    }
  };

  // Bulk Student Import
  const handleImportSuccess = async (importedStudents: Student[]) => {
    await batchSaveStudents(importedStudents);
    setStudents(prev => {
      const map = new Map<string, Student>();
      prev.forEach(s => map.set(s.id, s));
      importedStudents.forEach(s => map.set(s.id, s));
      return Array.from(map.values());
    });
  };

  // Bulk Conduct Logs Import (Excel)
  const handleImportConductLogsSuccess = async (
    importedLogs: ConductLog[],
    updatedStudentsList: Student[]
  ) => {
    await batchRecordConductLogsTransaction(importedLogs, updatedStudentsList);
    setConductLogs(prev => [...importedLogs, ...prev]);
    setStudents(prev => {
      const map = new Map<string, Student>();
      prev.forEach(s => map.set(s.id, s));
      updatedStudentsList.forEach(s => map.set(s.id, s));
      return Array.from(map.values());
    });
  };

  // Batch Update Student Photos directly
  const handleBatchUpdateStudentPhotos = async (photoUpdates: { id: string; photoUrl: string }[]) => {
    const mapUpdates = new Map<string, string>();
    photoUpdates.forEach(p => mapUpdates.set(p.id, p.photoUrl));

    const updatedList: Student[] = [];
    students.forEach(s => {
      if (mapUpdates.has(s.id)) {
        updatedList.push({
          ...s,
          photoUrl: mapUpdates.get(s.id),
          updatedAt: new Date().toISOString()
        });
      }
    });

    if (updatedList.length > 0) {
      await batchSaveStudents(updatedList);
      setStudents(prev => {
        const studentMap = new Map<string, Student>();
        prev.forEach(s => studentMap.set(s.id, s));
        updatedList.forEach(s => studentMap.set(s.id, s));
        return Array.from(studentMap.values());
      });
    }
  };

  // Clear / Cancel all student photos across database & state
  const handleClearAllStudentPhotos = async () => {
    const res = await clearAllStudentPhotos();
    setStudents(prev =>
      prev.map(s => {
        const copy = { ...s };
        delete copy.photoUrl;
        return copy;
      })
    );
    return res;
  };

  // Add / Create Single Student - Optimistic UI
  const handleSaveNewStudent = async (newStudent: Student) => {
    // 1. อัปเดตทันที
    setStudents(prev => {
      const exists = prev.some(s => s.id === newStudent.id);
      if (exists) {
        return prev.map(s => (s.id === newStudent.id ? newStudent : s));
      }
      return [...prev, newStudent];
    });
    setShowAddStudentModal(false);
    setSelectedStudentId(newStudent.id);

    // 2. บันทึกลงฐานข้อมูลแบบเบื้องหลัง
    try {
      await saveStudentToDb(newStudent);
    } catch (err: any) {
      console.error('Error saving student to db:', err);
    }
  };

  // Update Single Student - Optimistic UI
  const handleUpdateStudent = async (updatedStudent: Student) => {
    // 1. อัปเดตทันที
    setStudents(prev => prev.map(s => (s.id === updatedStudent.id ? updatedStudent : s)));
    setEditingStudent(null);

    // 2. บันทึกลงฐานข้อมูลแบบเบื้องหลัง
    try {
      await saveStudentToDb(updatedStudent);
    } catch (err: any) {
      console.error('Error updating student in db:', err);
    }
  };

  // Delete Single Student & Associated Conduct Logs - Optimistic UI
  const handleDeleteStudent = async (studentId: string) => {
    // 1. ลบทันที
    setStudents(prev => prev.filter(s => s.id !== studentId));
    setConductLogs(prev => prev.filter(l => l.studentId !== studentId));
    if (selectedStudentId === studentId) {
      setSelectedStudentId('');
    }
    if (editingStudent?.id === studentId) {
      setEditingStudent(null);
    }

    // 2. ดำเนินการลบในฐานข้อมูลแบบเบื้องหลัง
    try {
      await deleteStudentFromDb(studentId);
      await deleteStudentConductLogs(studentId);
    } catch (err: any) {
      console.error('Error deleting student from db:', err);
    }
  };

  // Graduation (delete M.3 / M.6 students)
  const handleGraduateStudents = async (studentIds: string[]) => {
    await batchDeleteStudents(studentIds);
    for (const id of studentIds) {
      await deleteStudentConductLogs(id).catch(err => console.warn('Clean logs error:', err));
    }
    setStudents(prev => prev.filter(s => !studentIds.includes(s.id)));
    setConductLogs(prev => prev.filter(l => !studentIds.includes(l.studentId)));
    if (studentIds.includes(selectedStudentId)) {
      setSelectedStudentId('');
    }
    if (editingStudent && studentIds.includes(editingStudent.id)) {
      setEditingStudent(null);
    }
  };

  // Promotion to M.4 (reset score to 100, reset banked points, clear past logs)
  const handlePromoteToM4 = async (studentIds: string[], newEntryYear: number) => {
    const updatedList: Student[] = [];
    const nowIso = new Date().toISOString();

    for (const id of studentIds) {
      const student = students.find(s => s.id === id);
      if (student) {
        const updated: Student = {
          ...student,
          entryLevel: 'ม.4',
          levelCode: 'P',
          entryYear: newEntryYear,
          currentScore: 100,
          bankedPoints: 0,
          totalDeductionsCount: 0,
          totalDeductedPoints: 0,
          totalAddedPoints: 0,
          hasNeverBeenDeducted: true,
          updatedAt: nowIso
        };
        await saveStudentToDb(updated);
        await deleteStudentConductLogs(id);
        updatedList.push(updated);
      }
    }

    setStudents(prev =>
      prev.map(s => {
        const match = updatedList.find(u => u.id === s.id);
        return match || s;
      })
    );
    setConductLogs(prev => prev.filter(log => !studentIds.includes(log.studentId)));
  };

  // Settings update
  const handleUpdateSettings = async (newSettings: SystemSettings) => {
    await saveSystemSettings(newSettings);
    setSystemSettings(newSettings);
  };

  // Grant Access Handler
  const handleGrantAccessSuccess = async (grant: StudentAccessGrant) => {
    await saveStudentAccessGrant(grant);
    setAccessGrants(prev => [grant, ...prev.filter(g => g.id !== grant.id)]);
  };

  const handleBatchGrantAllStudents = async () => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'staff')) {
      throw new Error('ให้สิทธิ์เฉพาะผู้ดูแลระบบและเจ้าหน้าที่เท่านั้น');
    }
    const newGrants: StudentAccessGrant[] = [];
    const now = new Date().toISOString();
    const activeList = students.filter(s => s.status !== 'INACTIVE' && s.status !== 'GRADUATED');
    for (const st of activeList) {
      newGrants.push({
        id: `grant-${st.id}-${Date.now()}`,
        studentId: st.id,
        studentName: `${st.title || ''}${st.firstName} ${st.lastName}`,
        grantedByUserId: currentUser.id,
        grantedByUserName: currentUser.name,
        grantedByUserRole: currentUser.role,
        grantedAt: now,
        isActive: true,
        reason: 'อนุมัติสิทธิ์นักเรียนทุกคน (One-Click Batch Grant)'
      });
    }
    await batchSaveStudentAccessGrants(newGrants);
    setAccessGrants(prev => {
      const map = new Map<string, StudentAccessGrant>();
      for (const g of newGrants) {
        map.set(g.studentId, g);
      }
      for (const g of prev) {
        if (!map.has(g.studentId)) {
          map.set(g.studentId, g);
        }
      }
      return Array.from(map.values()).sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime());
    });
  };

  // User Management Handlers
  const handleSaveUser = async (user: AppUser) => {
    if (currentUser) {
      const isSelf = currentUser.id === user.id || currentUser.username?.toLowerCase() === user.username?.toLowerCase();
      if (!isSelf) {
        const curLevel = getUserRoleLevel(currentUser);
        const targetRoleLevel = getRoleLevelByRoleName(user.role, !!user.isSuperAdmin);
        if (curLevel <= targetRoleLevel) {
          throw new Error('คุณไม่มีสิทธิ์กำหนดหรือแก้ไขผู้ใช้งานที่มีระดับสิทธิ์เท่ากันหรือสูงกว่าคุณ');
        }
      }
    }
    await saveAppUser(user);
    setUsers(prev => {
      const idx = prev.findIndex(u => u.id === user.id || u.username?.toLowerCase() === user.username?.toLowerCase());
      let updated: AppUser[];
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = user;
        updated = copy;
      } else {
        updated = [...prev, user];
      }
      try { localStorage.setItem('conduct_cached_users', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const handleDeleteUser = async (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (currentUser && target) {
      if (!canDeleteTargetUser(currentUser, target)) {
        throw new Error('คุณไม่มีสิทธิ์ลบผู้ใช้งานนี้ (สามารถจัดการได้เฉพาะผู้มีระดับสิทธิ์ต่ำกว่าเท่านั้น)');
      }
    }
    await deleteAppUser(userId);
    setUsers(prev => {
      const updated = prev.filter(u => u.id !== userId);
      try { localStorage.setItem('conduct_cached_users', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const handleRevokeGrant = async (grantId: string) => {
    await revokeStudentAccessGrant(grantId);
    setAccessGrants(prev => prev.map(g => g.id === grantId ? { ...g, isActive: false } : g));
  };

  // Advisor Management Handlers
  const handleSaveAdvisor = async (advisor: HomeroomAdvisor, syncToStudents: boolean = true) => {
    await saveHomeroomAdvisor(advisor, syncToStudents);
    setAdvisors(prev => {
      const idx = prev.findIndex(a => a.id === advisor.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = advisor;
        return copy;
      }
      return [...prev, advisor];
    });
  };

  const handleBatchSaveAdvisors = async (importedAdvisors: HomeroomAdvisor[], syncToStudents: boolean = true) => {
    const res = await batchSaveHomeroomAdvisors(importedAdvisors, syncToStudents);
    const updated = await fetchHomeroomAdvisors();
    setAdvisors(updated);
    return res;
  };

  const handleDeleteAdvisor = async (advisorId: string) => {
    await deleteHomeroomAdvisor(advisorId);
    setAdvisors(prev => prev.filter(a => a.id !== advisorId));
  };

  const handleDeleteAllAdvisors = async (clearStudentAdvisorNames: boolean = true) => {
    const res = await deleteAllHomeroomAdvisors(clearStudentAdvisorNames);
    setAdvisors([]);
    if (clearStudentAdvisorNames) {
      setStudents(prev => prev.map(st => ({ ...st, advisorName: '' })));
    }
    return res;
  };

  const handleSyncAllAdvisors = async () => {
    return await syncAllAdvisorsToStudents(advisors, systemSettings.currentAcademicYear);
  };

  const handleSyncClassroomAdvisor = async (gradeLevel: GradeLevel, room: number, advisorName: string) => {
    return await syncClassroomAdvisorToStudents(gradeLevel, room, systemSettings.currentAcademicYear, advisorName);
  };

  // Dormitory Management Handlers - Optimistic UI
  const handleSaveDormitory = async (dormitory: Dormitory) => {
    // 1. อัปเดตทันที
    setDormitories(prev => {
      const idx = prev.findIndex(d => d.id === dormitory.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = dormitory;
        return copy;
      }
      return [...prev, dormitory];
    });

    // 2. บันทึกลงฐานข้อมูลแบบเบื้องหลัง
    try {
      await saveDormitory(dormitory);
    } catch (err: any) {
      console.error('Error saving dormitory:', err);
    }
  };

  const handleDeleteDormitory = async (dormId: string) => {
    // 1. ลบทันที
    setDormitories(prev => prev.filter(d => d.id !== dormId));

    // 2. ลบในฐานข้อมูลแบบเบื้องหลัง
    try {
      await deleteDormitory(dormId);
    } catch (err: any) {
      console.error('Error deleting dormitory:', err);
    }
  };

  const handleBatchSaveDormitories = async (dorms: Dormitory[]) => {
    const count = await batchSaveDormitories(dorms);
    setDormitories(dorms);
    return count;
  };

  const handleSyncStudentsWithDormitories = async (updatedStudents: Student[]) => {
    try {
      await syncStudentsToDormitoriesInDb(updatedStudents, dormitories, systemSettings.currentAcademicYear);
    } catch (e) {
      console.warn('syncStudentsToDormitoriesInDb warning:', e);
    }
    setStudents(updatedStudents);
    try {
      localStorage.setItem('conduct_cached_students', JSON.stringify(updatedStudents));
    } catch {}
  };

  const handleClearAllStudentDormitories = async (): Promise<number> => {
    const { clearedCount } = await clearAllStudentDormitoriesInDb(students);
    const updated = students.map(s => ({
      ...s,
      dormitoryId: undefined,
      dormitoryName: undefined
    }));
    setStudents(updated);
    try {
      localStorage.setItem('conduct_cached_students', JSON.stringify(updated));
    } catch {}
    return clearedCount;
  };

  const handleAssignStudentDormitory = async (studentId: string, dormitoryId?: string, dormitoryName?: string) => {
    await assignStudentDormitoryInDb(studentId, dormitoryId, dormitoryName);
    const updated = students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          dormitoryId,
          dormitoryName
        };
      }
      return s;
    });
    setStudents(updated);
    try {
      localStorage.setItem('conduct_cached_students', JSON.stringify(updated));
    } catch {}
  };

  const handleBatchAssignStudentsDormitory = async (studentIds: string[], dormitoryId?: string, dormitoryName?: string) => {
    const count = await batchAssignStudentsDormitoryInDb(studentIds, dormitoryId, dormitoryName);
    const updated = students.map(s => {
      if (studentIds.includes(s.id)) {
        return {
          ...s,
          dormitoryId,
          dormitoryName
        };
      }
      return s;
    });
    setStudents(updated);
    try {
      localStorage.setItem('conduct_cached_students', JSON.stringify(updated));
    } catch {}
    return count;
  };

  const handleResetDefaultDormitories = async () => {
    await resetDefaultDormitories();
    setDormitories(DEFAULT_DORMITORIES);
  };

  // Standard Conduct Behavior Handlers - Optimistic UI
  const handleSaveStandardBehavior = async (behavior: StandardConductBehavior) => {
    // 1. อัปเดตทันที
    setStandardBehaviors(prev => {
      const idx = prev.findIndex(b => b.id === behavior.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = behavior;
        return copy;
      }
      return [...prev, behavior];
    });

    // 2. บันทึกลงฐานข้อมูลแบบเบื้องหลัง
    try {
      await saveStandardBehavior(behavior);
    } catch (err: any) {
      console.error('Error saving standard behavior:', err);
    }
  };

  const handleDeleteStandardBehavior = async (behaviorId: string) => {
    // 1. ลบทันที
    setStandardBehaviors(prev => prev.filter(b => b.id !== behaviorId));

    // 2. ลบในฐานข้อมูลแบบเบื้องหลัง
    try {
      await deleteStandardBehavior(behaviorId);
    } catch (err: any) {
      console.error('Error deleting standard behavior:', err);
    }
  };

  const handleBatchSaveStandardBehaviors = async (behaviorsToSave: StandardConductBehavior[]) => {
    const count = await batchSaveStandardBehaviors(behaviorsToSave);
    const updated = await fetchStandardBehaviors();
    setStandardBehaviors(updated);
    return count;
  };

  // Database Management Actions
  const handleClearSampleData = async () => {
    const res = await clearSampleMockData();
    const sampleIds = ['05505', '05506', '05507', '05508', '05509', '05510', '05511', '05512'];
    setStudents(prev => prev.filter(s => !s.isSampleData && !sampleIds.includes(s.id)));
    setConductLogs(prev => prev.filter(l => !l.isSampleData && !sampleIds.includes(l.studentId) && !l.id.startsWith('log-0')));
    if (sampleIds.includes(selectedStudentId)) {
      setSelectedStudentId('');
    }
    if (studentGrant && sampleIds.includes(studentGrant.studentId)) {
      sessionStorage.removeItem('conduct_student_grant');
      setStudentGrant(null);
    }
    return res;
  };

  const handleSeedSampleData = async () => {
    const res = await seedSampleMockData();
    return res;
  };

  const handleResetDatabase = async () => {
    await resetDatabaseToAdminOnly();
    setStudents([]);
    setConductLogs([]);
    setSelectedStudentId('');
    sessionStorage.removeItem('conduct_student_grant');
    setStudentGrant(null);
    const refreshedUsers = await fetchAppUsers();
    setUsers(refreshedUsers);
  };

  const handleClearIndividualStudentConduct = async (studentId: string) => {
    const res = await clearIndividualStudentConduct(studentId);
    setConductLogs(prev => prev.filter(l => l.studentId !== studentId));
    setStudents(prev =>
      prev.map(s =>
        s.id === studentId
          ? {
              ...s,
              currentScore: 100,
              bankedPoints: 0,
              totalDeductionsCount: 0,
              totalDeductedPoints: 0,
              totalAddedPoints: 0,
              hasNeverBeenDeducted: true,
              updatedAt: new Date().toISOString()
            }
          : s
      )
    );
    return res;
  };

  const handleClearAllConductData = async () => {
    const res = await clearAllConductData();
    setConductLogs([]);
    setStudents(prev =>
      prev.map(s => ({
        ...s,
        currentScore: 100,
        bankedPoints: 0,
        totalDeductionsCount: 0,
        totalDeductedPoints: 0,
        totalAddedPoints: 0,
        hasNeverBeenDeducted: true,
        updatedAt: new Date().toISOString()
      }))
    );
    return res;
  };

  const handleAuditAndReconcileConduct = async () => {
    const res = await auditAndReconcileClearedStudentsConduct();
    if (res.fixedStudentsCount > 0) {
      const fixedSet = new Set(res.fixedStudentIds);
      setStudents(prev =>
        prev.map(s =>
          fixedSet.has(s.id)
            ? {
                ...s,
                currentScore: 100,
                bankedPoints: 0,
                totalDeductionsCount: 0,
                totalDeductedPoints: 0,
                totalAddedPoints: 0,
                hasNeverBeenDeducted: true,
                updatedAt: new Date().toISOString()
              }
            : s
        )
      );
    }
    return res;
  };

  // ตรวจสอบนักเรียนที่โดนลบประวัติและร่องรอยคะแนนความประพฤติ เพื่อปรับคืนสถานะปกติและนำออกจาก 6 เกณฑ์มาตรฐานโดยอัตโนมัติ
  useEffect(() => {
    if (loading || students.length === 0) return;

    // ตรวจสอบว่ามีนักเรียนที่ไม่มีประวัติคะแนนเลย แต่ยังมีร่องรอยคะแนนค้างอยู่หรือไม่
    const hasDirtyClearedStudent = students.some(s => {
      const logsCount = conductLogs.filter(l => l.studentId === s.id).length;
      if (logsCount === 0) {
        return (
          Number(s.currentScore) !== 100 ||
          Number(s.bankedPoints || 0) !== 0 ||
          Number(s.totalDeductionsCount || 0) !== 0 ||
          Number(s.totalDeductedPoints || 0) !== 0 ||
          Number(s.totalAddedPoints || 0) !== 0 ||
          s.hasNeverBeenDeducted !== true
        );
      }
      return false;
    });

    if (hasDirtyClearedStudent) {
      auditAndReconcileClearedStudentsConduct().catch(err => {
        console.warn('Auto conduct audit notice:', err);
      });
    }
  }, [loading, students, conductLogs]);

  // Student selection
  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setCurrentView('LOOKUP');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const criticalCount = students.filter(s => (s.currentScore ?? 100) <= 50 && s.status === 'ACTIVE').length;
  const warningCount = students.filter(
    s => (s.currentScore ?? 100) <= 70 && (s.currentScore ?? 100) > 50 && s.status === 'ACTIVE'
  ).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
        <h2 className="text-lg font-bold text-slate-800">กำลังเชื่อมต่อฐานข้อมูล Firebase...</h2>
        <p className="text-xs text-slate-500 mt-1">ระบบปรับปรุงคะแนนความประพฤตินักเรียน</p>
      </div>
    );
  }

  // If not logged in and not authorized student -> check authentication
  const isAuthenticated = currentUser !== null || studentGrant !== null;

  // If requireLoginBeforeAccess is enabled (default: true) and user is not authenticated:
  // Strictly enforce login before accessing the system!
  if (!isAuthenticated && systemSettings.requireLoginBeforeAccess !== false) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans relative overflow-x-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

        <LoginModal
          isOpen={true}
          canClose={false}
          users={users}
          students={students}
          conductLogs={conductLogs}
          accessGrants={accessGrants}
          advisors={advisors}
          currentAcademicYear={systemSettings.currentAcademicYear}
          standardBehaviors={standardBehaviors}
          onStaffLogin={handleStaffLogin}
          onLoginStaff={handleStaffLogin}
          onStudentAuthorizedView={handleStudentAuthorizedView}
          systemSettings={systemSettings}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans">
      {/* Left Sidebar Navigation (Desktop Fixed/Sticky, Mobile Drawer) */}
      {isAuthenticated && (
        <Sidebar
          currentUser={currentUser}
          studentGrant={studentGrant}
          currentView={currentView}
          onChangeView={handleChangeView}
          systemSettings={systemSettings}
          studentsCount={students.length}
          standardBehaviorsCount={standardBehaviors.length}
          accessGrantsCount={accessGrants.length}
          criticalCount={criticalCount}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          onLogout={handleLogout}
          onOpenChangePassword={() => setPasswordTargetUser(currentUser)}
        />
      )}

      {/* Main Content Area on the right */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <Navbar
          currentUser={currentUser}
          studentGrant={studentGrant}
          currentView={currentView}
          onChangeView={handleChangeView}
          systemSettings={systemSettings}
          criticalCount={criticalCount}
          warningCount={warningCount}
          onLogout={handleLogout}
          onOpenLoginModal={() => setShowLoginModal(true)}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          isMobileSidebarOpen={mobileSidebarOpen}
          onOpenChangePassword={() => setPasswordTargetUser(currentUser)}
        />

        {/* Main Content Area: Full width display on right side */}
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-6 pb-28 lg:pb-10 min-w-0">
          {currentView === 'HOME' ? (
            <HomeLandingView
              students={students}
              conductLogs={conductLogs}
              systemSettings={systemSettings}
              advisors={advisors}
              standardBehaviors={standardBehaviors}
              users={users}
              currentUser={currentUser}
              onNavigate={(v) => handleChangeView(v)}
              onSelectStudent={handleSelectStudent}
              onOpenLogin={() => setShowLoginModal(true)}
              onDemoLogin={(user) => {
                const adminUser = user || users.find(u => u.username === 'admin') || {
                  id: 'usr-admin-01',
                  username: 'admin',
                  name: 'ผู้ดูแลระบบสูงสุด',
                  role: 'admin',
                  isActive: true,
                  createdAt: new Date().toISOString()
                };
                handleStaffLogin(adminUser);
              }}
            />
          ) : !canUserAccessMenu(currentView, currentUser, studentGrant, systemSettings.menuPermissions) ? (
            <div className="py-16 px-4 max-w-lg mx-auto text-center space-y-5 bg-white border border-rose-200 rounded-3xl p-6 sm:p-8 shadow-xs">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-100 shadow-xs">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  สิทธิ์การเข้าถึงเมนูนี้ถูกจำกัด
                </h2>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed mt-2">
                  บัญชีของคุณไม่มีสิทธิ์เข้าถึงหน้านี้ตามการกำหนดค่าสิทธิ์ของระบบ กรุณาติดต่อผู้ดูแลระบบหลัก (Admin) เพื่อขอสิทธิ์เข้าถึง
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentView(currentUser?.role !== 'student' ? 'DASHBOARD' : 'LOOKUP')}
                  className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors cursor-pointer text-sm"
                >
                  กลับสู่หน้าหลักที่ได้รับอนุญาต
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('HOME')}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer text-sm"
                >
                  หน้าแรกพอร์ทัล
                </button>
              </div>
            </div>
          ) : currentView === 'CHECK_SCORE' ? (
            <ScoreCheckView
              students={students}
              conductLogs={conductLogs}
              accessGrants={accessGrants}
              currentUser={currentUser}
              studentGrant={studentGrant}
              systemSettings={systemSettings}
              currentAcademicYear={systemSettings.currentAcademicYear}
              currentTerm={systemSettings.currentTerm}
              dormitories={dormitories}
              onNavigate={handleChangeView}
              onSelectStudent={handleSelectStudent}
              onStudentAuthorizedView={handleStudentAuthorizedView}
              onUpdateSystemSettings={handleUpdateSettings}
              onGrantAccess={handleGrantAccessSuccess}
              onBatchGrantAllStudents={handleBatchGrantAllStudents}
            />
          ) : currentView === 'HONOUR' ? (
            <HonourRollModal
              isPage={true}
              students={students}
              currentAcademicYear={systemSettings.currentAcademicYear}
              systemSettings={systemSettings}
              dormitories={dormitories}
              onClose={() => setCurrentView(currentUser?.role !== 'student' ? 'DASHBOARD' : 'LOOKUP')}
              onSelectStudent={handleSelectStudent}
            />
          ) : currentView === 'REPORTS' ||
              currentView === 'REPORT_INDIVIDUAL' ||
              currentView === 'REPORT_GRADE_LEVEL' ||
              currentView === 'REPORT_FULL_100' ||
              currentView === 'REPORT_HONOUR_100' ||
              currentView === 'REPORT_POINTS_ADDED' ||
              currentView === 'REPORT_POINTS_DEDUCTED' ? (
            <ConductReportView
              students={students}
              conductLogs={conductLogs}
              currentAcademicYear={systemSettings.currentAcademicYear}
              currentTerm={systemSettings.currentTerm}
              systemSettings={systemSettings}
              advisors={advisors}
              standardBehaviors={standardBehaviors}
              currentUser={currentUser}
              dormitories={dormitories}
              activeReportTab={getActiveReportTabFromView(currentView)}
              onChangeReportTab={(tab) => {
                switch (tab) {
                  case 'INDIVIDUAL': setCurrentView('REPORT_INDIVIDUAL'); break;
                  case 'GRADE_LEVEL': setCurrentView('REPORT_GRADE_LEVEL'); break;
                  case 'FULL_100': setCurrentView('REPORT_FULL_100'); break;
                  case 'HONOUR_100_PLUS': setCurrentView('REPORT_HONOUR_100'); break;
                  case 'POINTS_ADDED': setCurrentView('REPORT_POINTS_ADDED'); break;
                  case 'POINTS_DEDUCTED': setCurrentView('REPORT_POINTS_DEDUCTED'); break;
                }
              }}
              onSelectStudent={handleSelectStudent}
              onClose={() => setCurrentView(currentUser?.role !== 'student' ? 'DASHBOARD' : 'LOOKUP')}
            />
          ) : currentView === 'LOOKUP' ? (
            <StudentLookup
              students={students}
              conductLogs={conductLogs}
              standardBehaviors={standardBehaviors}
              currentAcademicYear={systemSettings.currentAcademicYear}
              currentTerm={systemSettings.currentTerm}
              currentUser={currentUser}
              studentGrant={studentGrant}
              systemSettings={systemSettings}
              advisors={advisors}
              dormitories={dormitories}
              initialStudentId={studentGrant ? studentGrant.studentId : selectedStudentId}
              onOpenConductAction={(student, defaultType) => {
                if (!currentUser) {
                  setShowLoginModal(true);
                  return;
                }
                if (currentUser.role === 'teacher') {
                  return;
                }
                setConductActionTarget({ student, defaultType });
              }}
              onOpenGrantModal={(student) => {
                if (!currentUser) {
                  setShowLoginModal(true);
                  return;
                }
                setGrantTargetStudent(student);
              }}
              onUpdateStudentPhoto={async (id, photoUrl) => {
                if (!currentUser) {
                  setShowLoginModal(true);
                  return;
                }
                handleBatchUpdateStudentPhotos([{ id, photoUrl }]);
              }}
              onOpenAddStudent={() => {
                if (!currentUser) {
                  setShowLoginModal(true);
                  return;
                }
                setShowAddStudentModal(true);
              }}
              onOpenEditStudent={(st) => {
                if (!currentUser) {
                  setShowLoginModal(true);
                  return;
                }
                setEditingStudent(st);
              }}
              onDeleteStudent={handleDeleteStudent}
              onEditConductLog={handleEditConductLog}
              onDeleteConductLog={handleDeleteConductLog}
              onOpenPhotoManager={() => {
                if (!currentUser) {
                  setShowLoginModal(true);
                  return;
                }
                setCurrentView('PHOTOS');
              }}
            />
          ) : !isAuthenticated ? (
            <div className="py-12 px-4 max-w-lg mx-auto text-center space-y-5 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100 shadow-xs">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  กรุณาเข้าสู่ระบบเพื่อดูข้อมูลและตั้งค่า
                </h2>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed mt-1.5">
                  เข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ (Admin) หรือครู เพื่อดูแดชบอร์ดและจัดการคะแนนความประพฤติ
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const adminUser = users.find(u => u.username === 'admin') || {
                      id: 'usr-admin-01',
                      username: 'admin',
                      name: 'ผู้ดูแลระบบสูงสุด',
                      role: 'admin',
                      isActive: true,
                      createdAt: new Date().toISOString()
                    };
                    handleStaffLogin(adminUser);
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer text-sm flex items-center justify-center gap-2"
                >
                  <span>เข้าสู่ระบบทันที (Admin Demo)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowLoginModal(true)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer text-sm"
                >
                  กรอกรหัสผ่านด้วยตนเอง
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('HOME')}
                  className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 font-bold rounded-xl transition-colors cursor-pointer text-sm"
                >
                  กลับสู่หน้าแรก
                </button>
              </div>
            </div>
          ) : currentView === 'CRITICAL_ALERT' && currentUser ? (
            <CriticalAlertView
              students={students}
              currentAcademicYear={systemSettings.currentAcademicYear}
              currentUser={currentUser}
              systemSettings={systemSettings}
              advisors={advisors}
              onBack={() => setCurrentView('DASHBOARD')}
              onSelectStudent={handleSelectStudent}
              onOpenConductAction={(student, defaultType) => {
                if (!currentUser || currentUser.role === 'teacher') return;
                setConductActionTarget({ student, defaultType });
              }}
              onOpenGrantModal={(student) => setGrantTargetStudent(student)}
            />
          ) : currentView === 'ADVISORS' && currentUser ? (
            <AdvisorManagementView
              advisors={advisors}
              students={students}
              systemSettings={systemSettings}
              currentUser={currentUser}
              onSaveAdvisor={handleSaveAdvisor}
              onBatchSaveAdvisors={handleBatchSaveAdvisors}
              onDeleteAdvisor={handleDeleteAdvisor}
              onDeleteAllAdvisors={handleDeleteAllAdvisors}
              onSyncAllAdvisors={handleSyncAllAdvisors}
              onSyncClassroom={handleSyncClassroomAdvisor}
              onSelectStudent={handleSelectStudent}
            />
          ) : (currentView === 'DORMITORIES' || currentView === 'DORMITORY_ASSIGN' || currentView === 'DORMITORY_LIST' || currentView === 'DORMITORY_TEACHERS') && currentUser ? (
            <DormitoryManagementView
              dormitories={dormitories}
              students={students}
              currentAcademicYear={systemSettings.currentAcademicYear}
              currentUser={currentUser}
              systemSettings={systemSettings}
              activeSubTab={
                currentView === 'DORMITORY_LIST'
                  ? 'LIST'
                  : currentView === 'DORMITORY_TEACHERS'
                  ? 'TEACHERS'
                  : 'ASSIGN'
              }
              onSubTabChange={(tab) => {
                if (tab === 'ASSIGN') setCurrentView('DORMITORY_ASSIGN');
                else if (tab === 'LIST') setCurrentView('DORMITORY_LIST');
                else if (tab === 'TEACHERS') setCurrentView('DORMITORY_TEACHERS');
              }}
              onSaveDormitory={handleSaveDormitory}
              onBatchSaveDormitories={handleBatchSaveDormitories}
              onDeleteDormitory={handleDeleteDormitory}
              onSyncStudentsWithDormitories={handleSyncStudentsWithDormitories}
              onClearAllStudentDormitories={handleClearAllStudentDormitories}
              onAssignStudentDormitory={handleAssignStudentDormitory}
              onBatchAssignStudentsDormitory={handleBatchAssignStudentsDormitory}
              onResetDefaultDormitories={handleResetDefaultDormitories}
              onNavigateToStudentsView={(dormId) => {
                setSelectedDormIdForStudentsView(dormId);
                setCurrentView('DORMITORY_STUDENTS');
              }}
              homeroomAdvisors={advisors}
              onSelectStudent={handleSelectStudent}
            />
          ) : currentView === 'DORMITORY_STUDENTS' && currentUser ? (
            <DormitoryStudentsView
              dormitories={dormitories}
              students={students}
              currentAcademicYear={systemSettings.currentAcademicYear}
              initialDormId={selectedDormIdForStudentsView}
              systemSettings={systemSettings}
              onSelectStudent={handleSelectStudent}
              onClearAllStudentDormitories={handleClearAllStudentDormitories}
              onAssignStudentDormitory={handleAssignStudentDormitory}
              onBatchAssignStudentsDormitory={handleBatchAssignStudentsDormitory}
              onBackToDormitories={() => setCurrentView('DORMITORIES')}
            />
          ) : currentView === 'IMPORT' && currentUser ? (
            <ImportStudentsModal
              isPage={true}
              currentAcademicYear={systemSettings.currentAcademicYear}
              onClose={() => setCurrentView('DASHBOARD')}
              onImportSuccess={handleImportSuccess}
            />
          ) : currentView === 'IMPORT_CONDUCT' && currentUser ? (
            <ImportConductLogsModal
              isPage={true}
              students={students}
              currentAcademicYear={systemSettings.currentAcademicYear}
              currentTerm={systemSettings.currentTerm}
              currentUser={currentUser}
              systemSettings={systemSettings}
              onClose={() => setCurrentView('DASHBOARD')}
              onImportSuccess={handleImportConductLogsSuccess}
            />
          ) : currentView === 'PHOTOS' && currentUser ? (
            <StudentPhotoManagerModal
              isPage={true}
              students={students}
              currentAcademicYear={systemSettings.currentAcademicYear}
              systemSettings={systemSettings}
              onClose={() => setCurrentView('DASHBOARD')}
              onBatchUpdateStudentPhotos={handleBatchUpdateStudentPhotos}
              onClearAllStudentPhotos={handleClearAllStudentPhotos}
            />
          ) : currentView === 'YEAR_CYCLE' && currentUser ? (
            <YearResetModal
              isPage={true}
              students={students}
              conductLogs={conductLogs}
              systemSettings={systemSettings}
              currentUser={currentUser}
              users={users}
              onClose={() => setCurrentView('DASHBOARD')}
              onUpdateSettings={handleUpdateSettings}
              onGraduateStudents={handleGraduateStudents}
            />
          ) : (currentView === 'SETTINGS' || currentView.startsWith('SETTINGS_')) && currentUser ? (
            <div className="w-full space-y-4">
              {currentView === 'SETTINGS_BEHAVIORS' ? (
                <StandardBehaviorsSettings
                  standardBehaviors={standardBehaviors}
                  currentUser={currentUser}
                  onClose={() => setCurrentView('DASHBOARD')}
                  onSaveStandardBehavior={handleSaveStandardBehavior}
                  onDeleteStandardBehavior={handleDeleteStandardBehavior}
                  onBatchSaveStandardBehaviors={handleBatchSaveStandardBehaviors}
                />
              ) : currentView === 'SETTINGS_USERS' ? (
                <UserManagementSettings
                  users={users}
                  currentUser={currentUser}
                  onClose={() => setCurrentView('DASHBOARD')}
                  onSaveUser={handleSaveUser}
                  onDeleteUser={handleDeleteUser}
                  onNavigateToMenuPermissions={() => setCurrentView('SETTINGS_MENU_PERMISSIONS')}
                />
              ) : currentView === 'SETTINGS_DATABASE' || (currentView === 'SETTINGS' && !canUserAccessMenu('SETTINGS_BRANDING', currentUser, studentGrant, systemSettings.menuPermissions) && canUserAccessMenu('SETTINGS_DATABASE', currentUser, studentGrant, systemSettings.menuPermissions)) ? (
                <DatabaseSettings
                  currentUser={currentUser}
                  users={users}
                  students={students}
                  conductLogs={conductLogs}
                  systemSettings={systemSettings}
                  advisors={advisors}
                  standardBehaviors={standardBehaviors}
                  accessGrants={accessGrants}
                  onClose={() => setCurrentView('DASHBOARD')}
                  onExportBackup={exportDatabaseBackup}
                  onImportBackup={importDatabaseBackup}
                  onSeedSampleData={handleSeedSampleData}
                  onClearSampleData={handleClearSampleData}
                  onClearAllStudentPhotos={handleClearAllStudentPhotos}
                  onClearIndividualStudentConduct={handleClearIndividualStudentConduct}
                  onClearAllConductData={handleClearAllConductData}
                  onAuditAndReconcileConduct={handleAuditAndReconcileConduct}
                  onResetToAdminOnly={handleResetDatabase}
                  onResetDatabase={handleResetDatabase}
                />
              ) : currentView === 'SETTINGS_MENU_PERMISSIONS' ? (
                <MenuPermissionsSettings
                  currentUser={currentUser}
                  systemSettings={systemSettings}
                  onClose={() => setCurrentView('DASHBOARD')}
                  onSavePermissions={async (updatedPermissions) => {
                    await handleUpdateSettings({
                      ...systemSettings,
                      menuPermissions: updatedPermissions
                    });
                  }}
                />
              ) : currentView === 'SETTINGS_GRANTS' ? (
                <StudentGrantsSettings
                  accessGrants={accessGrants}
                  currentUser={currentUser}
                  onClose={() => setCurrentView('DASHBOARD')}
                  onRevokeGrant={handleRevokeGrant}
                />
              ) : currentView === 'SETTINGS_USAGE_STATS' ? (
                <SystemUsageStatsSettings
                  currentUser={currentUser}
                  students={students}
                  conductLogs={conductLogs}
                  standardBehaviors={standardBehaviors}
                  users={users}
                  onClose={() => setCurrentView('DASHBOARD')}
                />
              ) : (
                <SchoolBrandingSettings
                  systemSettings={systemSettings}
                  currentUser={currentUser}
                  onClose={() => setCurrentView('DASHBOARD')}
                  onSaveSettings={handleUpdateSettings}
                  onUpdateSettings={handleUpdateSettings}
                />
              )}
            </div>
          ) : (currentView === 'DASHBOARD' || currentView === 'STUDENT_LIST') && currentUser ? (
            <Dashboard
              students={students}
              conductLogs={conductLogs}
              currentAcademicYear={systemSettings.currentAcademicYear}
              currentTerm={systemSettings.currentTerm}
              currentUser={currentUser}
              studentGrant={studentGrant}
              systemSettings={systemSettings}
              advisors={advisors}
              dormitories={dormitories}
              viewMode={currentView === 'STUDENT_LIST' ? 'STUDENT_LIST' : 'OVERVIEW'}
              onSelectStudent={handleSelectStudent}
              onOpenConductAction={(student, defaultType) => {
                if (!currentUser || currentUser.role === 'teacher') return;
                setConductActionTarget({ student, defaultType });
              }}
              onOpenGrantModal={(student) => setGrantTargetStudent(student)}
              onOpenHonourModal={() => setCurrentView('HONOUR')}
              onOpenImportModal={() => setCurrentView('IMPORT')}
              onOpenImportConductModal={() => setCurrentView('IMPORT_CONDUCT')}
              onOpenPhotoManager={() => setCurrentView('PHOTOS')}
              onOpenAddStudent={() => setShowAddStudentModal(true)}
              onOpenEditStudent={(st) => setEditingStudent(st)}
            />
          ) : (
            <HomeLandingView
              students={students}
              conductLogs={conductLogs}
              systemSettings={systemSettings}
              advisors={advisors}
              standardBehaviors={standardBehaviors}
              users={users}
              currentUser={currentUser}
              onNavigate={(v) => handleChangeView(v)}
              onSelectStudent={handleSelectStudent}
              onOpenLogin={() => setShowLoginModal(true)}
              onDemoLogin={(user) => {
                const adminUser = user || users.find(u => u.username === 'admin') || {
                  id: 'usr-admin-01',
                  username: 'admin',
                  name: 'ผู้ดูแลระบบสูงสุด',
                  role: 'admin',
                  isActive: true,
                  createdAt: new Date().toISOString()
                };
                handleStaffLogin(adminUser);
              }}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              © {new Date().getFullYear()} {systemSettings.schoolNameTh || systemSettings.schoolName} — {systemSettings.appNameTh}
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <span>ฐานข้อมูล Firebase Firestore</span>
              <span>•</span>
              <span>ระบบกิจการนักเรียน</span>
            </div>
          </div>
        </footer>
      </div>

      {/* ACTION DIALOGS & POPUPS */}
      {/* 1. Login Modal */}
      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          users={users}
          students={students}
          conductLogs={conductLogs}
          accessGrants={accessGrants}
          advisors={advisors}
          currentAcademicYear={systemSettings.currentAcademicYear}
          standardBehaviors={standardBehaviors}
          onStaffLogin={handleStaffLogin}
          onLoginStaff={handleStaffLogin}
          onStudentAuthorizedView={handleStudentAuthorizedView}
          systemSettings={systemSettings}
        />
      )}

      {/* 2. Grant Access Modal (For Teacher/Staff/Admin to authorize a student) */}
      {grantTargetStudent && currentUser && (
        <GrantAccessModal
          isOpen={true}
          student={grantTargetStudent}
          currentUser={currentUser}
          onClose={() => setGrantTargetStudent(null)}
          onGrantSuccess={handleGrantAccessSuccess}
        />
      )}

      {/* 3. Conduct Action Modal (Deduct / Add Score) */}
      {conductActionTarget && currentUser && currentUser.role !== 'student' && currentUser.role !== 'teacher' && (
        <ConductActionModal
          student={conductActionTarget.student}
          defaultType={conductActionTarget.defaultType}
          currentAcademicYear={systemSettings.currentAcademicYear}
          currentTerm={systemSettings.currentTerm}
          recordedByName={currentUser.name}
          maxBankedPoints={systemSettings.maxBankedPointsCap ?? 100}
          standardBehaviors={standardBehaviors}
          onSaveStandardBehavior={handleSaveStandardBehavior}
          onClose={() => setConductActionTarget(null)}
          onSubmit={handleConductSubmit}
        />
      )}

      {/* 4. Student Photo Manager Modal (Popup mode) */}
      {showPhotoManagerModal && currentUser && currentUser.role !== 'student' && (
        <StudentPhotoManagerModal
          isOpen={true}
          isPage={false}
          students={students}
          currentAcademicYear={systemSettings.currentAcademicYear}
          systemSettings={systemSettings}
          onClose={() => setShowPhotoManagerModal(false)}
          onBatchUpdateStudentPhotos={handleBatchUpdateStudentPhotos}
          onClearAllStudentPhotos={handleClearAllStudentPhotos}
          onUpdateSinglePhoto={async (id, photoUrl) =>
            handleBatchUpdateStudentPhotos([{ id, photoUrl }])
          }
        />
      )}

      {/* 5. Add Student Modal with Photo Compression */}
      {showAddStudentModal && currentUser && currentUser.role !== 'student' && (
        <AddStudentModal
          currentAcademicYear={systemSettings.currentAcademicYear}
          advisors={advisors}
          dormitories={dormitories}
          existingStudents={students}
          onClose={() => setShowAddStudentModal(false)}
          onSave={handleSaveNewStudent}
        />
      )}

      {/* 6. Edit Student Modal with Photo Compression & Delete */}
      {editingStudent && currentUser && currentUser.role !== 'student' && (
        <EditStudentModal
          student={editingStudent}
          currentAcademicYear={systemSettings.currentAcademicYear}
          advisors={advisors}
          dormitories={dormitories}
          systemSettings={systemSettings}
          onClose={() => setEditingStudent(null)}
          onSave={handleUpdateStudent}
          onDelete={handleDeleteStudent}
        />
      )}

      {/* 6.1 Import Conduct Logs Modal Dialog */}
      {showImportConductModal && currentUser && (
        <ImportConductLogsModal
          isPage={false}
          students={students}
          currentAcademicYear={systemSettings.currentAcademicYear}
          currentTerm={systemSettings.currentTerm}
          currentUser={currentUser}
          systemSettings={systemSettings}
          onClose={() => setShowImportConductModal(false)}
          onImportSuccess={async (logs, updatedStudents) => {
            await handleImportConductLogsSuccess(logs, updatedStudents);
            setShowImportConductModal(false);
          }}
        />
      )}

      {/* 7. Change Password Modal (Restricted to Super Admin and Account Owner) */}
      {passwordTargetUser && currentUser && (
        <ChangePasswordModal
          currentUser={currentUser}
          targetUser={passwordTargetUser}
          onClose={() => setPasswordTargetUser(null)}
          onSavePassword={async (newPassword) => {
            const updatedUser: AppUser = {
              ...passwordTargetUser,
              password: newPassword
            };
            await handleSaveUser(updatedUser);
            if (currentUser.id === passwordTargetUser.id) {
              const refreshed = { ...currentUser, password: newPassword };
              setCurrentUser(refreshed);
              sessionStorage.setItem('conduct_auth_user', JSON.stringify(refreshed));
              localStorage.removeItem('conduct_auth_user');
            }
            setPasswordTargetUser(null);
          }}
        />
      )}
    </div>
  );
}

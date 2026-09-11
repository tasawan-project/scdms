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
  StandardConductBehavior
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
  STUDENTS_COLLECTION,
  CONDUCT_LOGS_COLLECTION,
  USERS_COLLECTION,
  ACCESS_GRANTS_COLLECTION,
  ADVISORS_COLLECTION,
  STANDARD_BEHAVIORS_COLLECTION,
  DEFAULT_SETTINGS
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
import { MenuPermissionsSettings } from './components/MenuPermissionsSettings';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { canUserAccessMenu, canDeleteTargetUser, getUserRoleLevel, getRoleLevelByRoleName } from './utils/menuPermissions';
import { ConductActionModal } from './components/ConductActionModal';
import { HonourRollModal } from './components/HonourRollModal';
import { ImportStudentsModal } from './components/ImportStudentsModal';
import { ImportConductLogsModal } from './components/ImportConductLogsModal';
import { YearResetModal } from './components/YearResetModal';
import { CriticalAlertView } from './components/CriticalAlertView';
import { StudentPhotoManagerModal } from './components/StudentPhotoManagerModal';
import { AddStudentModal } from './components/AddStudentModal';
import { EditStudentModal } from './components/EditStudentModal';
import { SettingsTabBar } from './components/SettingsTabBar';
import { Loader2, ShieldAlert } from 'lucide-react';

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
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [accessGrants, setAccessGrants] = useState<StudentAccessGrant[]>([]);
  const [advisors, setAdvisors] = useState<HomeroomAdvisor[]>([]);
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
            setUsers(list);
            try { localStorage.setItem('conduct_cached_users', JSON.stringify(list)); } catch {}
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

      // 1.7 Parallel initial fetch for fast non-blocking hydration
      Promise.allSettled([
        fetchSystemSettings(),
        fetchAppUsers(),
        fetchStudentAccessGrants(),
        fetchHomeroomAdvisors(),
        fetchStandardBehaviors()
      ]).then(([settingsRes, usersRes, grantsRes, advisorsRes, behaviorsRes]) => {
        if (settingsRes.status === 'fulfilled' && settingsRes.value) {
          setSystemSettings(settingsRes.value);
          try { localStorage.setItem('conduct_cached_settings', JSON.stringify(settingsRes.value)); } catch {}
        }
        if (usersRes.status === 'fulfilled' && usersRes.value) {
          setUsers(usersRes.value);
          try { localStorage.setItem('conduct_cached_users', JSON.stringify(usersRes.value)); } catch {}
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
    };
  }, []);

  // Update page title & favicon/branding
  useEffect(() => {
    document.title = `${systemSettings.appNameTh || 'ระบบความประพฤตินักเรียน'} - ${
      systemSettings.schoolNameTh || systemSettings.schoolName
    }`;
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

  // Conduct Action Handler
  const handleConductSubmit = async (log: ConductLog, updatedStudent: Student) => {
    const recorder = currentUser ? currentUser.name : (log.recordedBy || 'เจ้าหน้าที่ฝ่ายปกครอง');
    const finalLog: ConductLog = {
      ...log,
      recordedBy: recorder,
      recordedByName: recorder
    };

    await recordConductLogTransaction(finalLog, updatedStudent);

    setStudents(prev => prev.map(s => (s.id === updatedStudent.id ? updatedStudent : s)));
    setConductLogs(prev => {
      const filtered = prev.filter(l => l.id !== finalLog.id);
      return [finalLog, ...filtered];
    });
  };

  // Edit Conduct Log Handler
  const handleEditConductLog = async (updatedLog: ConductLog, updatedStudent: Student) => {
    await updateConductLogTransaction(updatedLog, updatedStudent);

    setStudents(prev => prev.map(s => (s.id === updatedStudent.id ? updatedStudent : s)));
    setConductLogs(prev => {
      const filtered = prev.filter(l => l.id !== updatedLog.id);
      return [updatedLog, ...filtered];
    });
  };

  // Delete Conduct Log Handler
  const handleDeleteConductLog = async (log: ConductLog, updatedStudent: Student) => {
    await deleteConductLogTransaction(log.id, updatedStudent);

    setStudents(prev => prev.map(s => (s.id === updatedStudent.id ? updatedStudent : s)));
    setConductLogs(prev => prev.filter(l => l.id !== log.id));
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

  // Add / Create Single Student
  const handleSaveNewStudent = async (newStudent: Student) => {
    await saveStudentToDb(newStudent);
    setStudents(prev => {
      const exists = prev.some(s => s.id === newStudent.id);
      if (exists) {
        return prev.map(s => (s.id === newStudent.id ? newStudent : s));
      }
      return [...prev, newStudent];
    });
    setShowAddStudentModal(false);
    setSelectedStudentId(newStudent.id);
  };

  // Update Single Student
  const handleUpdateStudent = async (updatedStudent: Student) => {
    await saveStudentToDb(updatedStudent);
    setStudents(prev => prev.map(s => (s.id === updatedStudent.id ? updatedStudent : s)));
    setEditingStudent(null);
  };

  // Delete Single Student & Associated Conduct Logs
  const handleDeleteStudent = async (studentId: string) => {
    await deleteStudentFromDb(studentId);
    await deleteStudentConductLogs(studentId);
    setStudents(prev => prev.filter(s => s.id !== studentId));
    setConductLogs(prev => prev.filter(l => l.studentId !== studentId));
    if (selectedStudentId === studentId) {
      setSelectedStudentId('');
    }
    if (editingStudent?.id === studentId) {
      setEditingStudent(null);
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
      const idx = prev.findIndex(u => u.id === user.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = user;
        return copy;
      }
      return [...prev, user];
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
    setUsers(prev => prev.filter(u => u.id !== userId));
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

  // Standard Conduct Behavior Handlers
  const handleSaveStandardBehavior = async (behavior: StandardConductBehavior) => {
    await saveStandardBehavior(behavior);
    setStandardBehaviors(prev => {
      const idx = prev.findIndex(b => b.id === behavior.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = behavior;
        return copy;
      }
      return [...prev, behavior];
    });
  };

  const handleDeleteStandardBehavior = async (behaviorId: string) => {
    await deleteStandardBehavior(behaviorId);
    setStandardBehaviors(prev => prev.filter(b => b.id !== behaviorId));
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
          accessGrants={accessGrants}
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
          ) : currentView === 'HONOUR' ? (
            <HonourRollModal
              isPage={true}
              students={students}
              currentAcademicYear={systemSettings.currentAcademicYear}
              systemSettings={systemSettings}
              onClose={() => setCurrentView(currentUser?.role !== 'student' ? 'DASHBOARD' : 'LOOKUP')}
              onSelectStudent={handleSelectStudent}
            />
          ) : currentView === 'LOOKUP' ? (
            <StudentLookup
              students={students}
              conductLogs={conductLogs}
              currentAcademicYear={systemSettings.currentAcademicYear}
              currentTerm={systemSettings.currentTerm}
              currentUser={currentUser}
              studentGrant={studentGrant}
              systemSettings={systemSettings}
              advisors={advisors}
              initialStudentId={studentGrant ? studentGrant.studentId : selectedStudentId}
              onOpenConductAction={(student, defaultType) => {
                if (!currentUser) {
                  setShowLoginModal(true);
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
              onOpenConductAction={(student, defaultType) =>
                setConductActionTarget({ student, defaultType })
              }
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
              <SettingsTabBar
                currentView={currentView}
                currentUser={currentUser}
                studentGrant={studentGrant}
                systemSettings={systemSettings}
                onChangeView={handleChangeView}
              />
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
              viewMode={currentView === 'STUDENT_LIST' ? 'STUDENT_LIST' : 'OVERVIEW'}
              onSelectStudent={handleSelectStudent}
              onOpenConductAction={(student, defaultType) =>
                setConductActionTarget({ student, defaultType })
              }
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
          accessGrants={accessGrants}
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
      {conductActionTarget && currentUser && currentUser.role !== 'student' && (
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

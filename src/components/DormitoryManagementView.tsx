import React, { useState, useEffect } from 'react';
import {
  Dormitory,
  Student,
  AppUser,
  SystemSettings,
  HomeroomAdvisor,
  AppView
} from '../types';
import { DormitoryStudentAssignmentView } from './DormitoryStudentAssignmentView';
import { DormitoryListView } from './DormitoryListView';
import { DormitorySupervisorView } from './DormitorySupervisorView';

interface DormitoryManagementViewProps {
  dormitories: Dormitory[];
  students: Student[];
  currentAcademicYear: number;
  currentUser: AppUser | null;
  systemSettings?: SystemSettings;
  activeSubTab?: 'ASSIGN' | 'LIST' | 'TEACHERS';
  onSubTabChange?: (tab: 'ASSIGN' | 'LIST' | 'TEACHERS') => void;
  onSaveDormitory: (dorm: Dormitory) => Promise<void>;
  onBatchSaveDormitories?: (dorms: Dormitory[]) => Promise<number>;
  onDeleteDormitory?: (dormId: string) => Promise<void>;
  onSyncStudentsWithDormitories?: (updatedStudents: Student[]) => Promise<void>;
  onClearAllStudentDormitories?: () => Promise<number>;
  onAssignStudentDormitory?: (studentId: string, dormitoryId?: string, dormitoryName?: string) => Promise<void>;
  onBatchAssignStudentsDormitory?: (studentIds: string[], dormitoryId?: string, dormitoryName?: string) => Promise<number>;
  onResetDefaultDormitories?: () => Promise<void>;
  onNavigateToStudentsView?: (dormId?: string) => void;
  homeroomAdvisors?: HomeroomAdvisor[];
  onSelectStudent?: (studentId: string) => void;
  onBackToDashboard?: () => void;
}

export const DormitoryManagementView: React.FC<DormitoryManagementViewProps> = ({
  dormitories = [],
  students = [],
  currentAcademicYear,
  currentUser,
  systemSettings,
  activeSubTab = 'ASSIGN',
  onSubTabChange,
  onSaveDormitory,
  onDeleteDormitory,
  onSyncStudentsWithDormitories,
  onClearAllStudentDormitories,
  onAssignStudentDormitory,
  onBatchAssignStudentsDormitory,
  onNavigateToStudentsView,
  homeroomAdvisors = [],
  onSelectStudent
}) => {
  const [currentTab, setCurrentTab] = useState<'ASSIGN' | 'LIST' | 'TEACHERS'>(activeSubTab);

  useEffect(() => {
    if (activeSubTab) {
      setCurrentTab(activeSubTab);
    }
  }, [activeSubTab]);

  const handleTabChange = (tab: 'ASSIGN' | 'LIST' | 'TEACHERS') => {
    setCurrentTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };

  return (
    <div className="space-y-6">
      {currentTab === 'ASSIGN' && (
        <DormitoryStudentAssignmentView
          dormitories={dormitories}
          students={students}
          currentAcademicYear={currentAcademicYear}
          currentUser={currentUser}
          systemSettings={systemSettings}
          onAssignStudentDormitory={onAssignStudentDormitory}
          onBatchAssignStudentsDormitory={onBatchAssignStudentsDormitory}
          onClearAllStudentDormitories={onClearAllStudentDormitories}
          onSyncStudentsWithDormitories={onSyncStudentsWithDormitories}
          onSelectStudent={onSelectStudent}
          onNavigateToTab={handleTabChange}
        />
      )}

      {currentTab === 'LIST' && (
        <DormitoryListView
          dormitories={dormitories}
          students={students}
          currentAcademicYear={currentAcademicYear}
          currentUser={currentUser}
          systemSettings={systemSettings}
          homeroomAdvisors={homeroomAdvisors}
          onSaveDormitory={onSaveDormitory}
          onDeleteDormitory={onDeleteDormitory}
          onSelectStudent={onSelectStudent}
          onNavigateToTab={handleTabChange}
          onViewDormStudents={onNavigateToStudentsView}
        />
      )}

      {currentTab === 'TEACHERS' && (
        <DormitorySupervisorView
          dormitories={dormitories}
          currentUser={currentUser}
          systemSettings={systemSettings}
          onSaveDormitory={onSaveDormitory}
          onNavigateToTab={handleTabChange}
        />
      )}
    </div>
  );
};

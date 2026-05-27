import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Project, DDL, CentralView } from './types';
import { supabase } from './lib/supabase';
import {
  loadProjects,
  loadDDLs,
  saveProjects,
  saveDDLs,
  deleteDDLs,
  deleteProjects,
  isInitialized,
  setInitialized,
  clearCategoryCache,
} from './utils/storage';
import { generateDemoData } from './utils/demo-data';
import { toISODate } from './utils/date';
import CalendarModule from './components/CalendarModule';
import TimelineModule from './components/TimelineModule';
import DayTasksView from './components/DayTasksView';
import ProjectDetailView from './components/ProjectDetailView';
import AIBottomBar from './components/AIBottomBar';
import MobileAppView from './components/MobileAppView';
import LoginPage from './components/LoginPage';

export default function App() {
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [ddls, setDDLs] = useState<DDL[]>([]);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [centralView, setCentralView] = useState<CentralView>('day-tasks');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const refreshData = useCallback(async () => {
    if (!authUser) return;
    const [projects, ddls] = await Promise.all([loadProjects(), loadDDLs()]);
    setProjects(projects);
    setDDLs(ddls);
  }, [authUser]);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!mounted) return;
        if (error) {
          await supabase.auth.signOut({ scope: 'local' });
          setAuthUser(null);
        } else {
          setAuthUser(data.session?.user ?? null);
        }
        setAuthLoading(false);
      })
      .catch(async (error) => {
        console.warn('[Auth] Cleared stale local session:', error);
        await supabase.auth.signOut({ scope: 'local' });
        if (!mounted) return;
        setAuthUser(null);
        setAuthLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      clearCategoryCache();
      setAuthUser(session?.user ?? null);
      setProjects([]);
      setDDLs([]);
      setSelectedProject(null);
      setCentralView('day-tasks');
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authUser) return;

    (async () => {
      try {
        const initialized = await isInitialized();
        console.log('[Init] isInitialized:', initialized);
        if (!initialized) {
          const demo = generateDemoData();
          console.log('[Init] seeding demo data:', demo.projects.length, 'projects,', demo.ddls.length, 'ddls');
          await saveProjects(demo.projects);
          console.log('[Init] saveProjects done');
          await saveDDLs(demo.ddls);
          console.log('[Init] saveDDLs done');
          await setInitialized();
        }

        // Clean up past-deadline DDLs on every load
        const now = dayjs();
        const allDDLs = await loadDDLs();
        console.log('[Init] loaded', allDDLs.length, 'ddls');
        const validDDLs = allDDLs.filter((d) => dayjs(d.deadline).isAfter(now));
        if (validDDLs.length < allDDLs.length) {
          const expiredDDLIds = allDDLs
            .filter((d) => !dayjs(d.deadline).isAfter(now))
            .map((d) => d.id);
          await deleteDDLs(expiredDDLIds);
          const remainingProjectIds = new Set(validDDLs.map((d) => d.projectId).filter(Boolean));
          const allProjects = await loadProjects();
          const emptyProjectIds = allProjects
            .filter((p) => !remainingProjectIds.has(p.id))
            .map((p) => p.id);
          await deleteProjects(emptyProjectIds);
        }
      } catch (err) {
        console.error('[Init] error:', err);
      } finally {
        await refreshData();
        console.log('[Init] refreshData done');
      }
    })();
  }, [authUser, refreshData]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (authLoading) {
    return (
      <div className="auth-shell">
        <div className="auth-card ui-panel">
          <div className="auth-mark">D</div>
          <h1>DDL Flow</h1>
          <p className="auth-subtitle">正在恢复登录状态...</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <LoginPage />;
  }

  const userEmail = authUser.email || '已登录用户';

  const dateDDLs = ddls.filter(
    (d) => dayjs(d.deadline).format('YYYY-MM-DD') === toISODate(selectedDate)
  );

  const handleDateSelect = (date: dayjs.Dayjs) => {
    setSelectedDate(date);
    setCentralView('day-tasks');
    setSelectedProject(null);
  };

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    setCentralView('project-detail');
  };

  const handleBackToWorkbench = () => {
    setCentralView('day-tasks');
    setSelectedProject(null);
  };

  const projectDDLs = (projectId: string) =>
    ddls.filter((d) => d.projectId === projectId);

  const activeProjects = projects.filter((p) => {
    const pDDLs = projectDDLs(p.id);
    return pDDLs.length === 0 || pDDLs.some((d) => !d.completed);
  });

  // Stats for quick project cards
  const projectStats = (projectId: string) => {
    const all = projectDDLs(projectId);
    const done = all.filter((d) => d.completed).length;
    return { total: all.length, done, progress: all.length > 0 ? Math.round((done / all.length) * 100) : 0 };
  };

  return (
    <>
    <div className="desktop-shell h-screen flex flex-col bg-[var(--color-bg)] overflow-hidden">
      {/* ========== HEADER ========== */}
      <header className="shrink-0 h-14 bg-white/90 backdrop-blur border-b border-[var(--color-border)] flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[8px] bg-[var(--color-primary)] shadow-sm flex items-center justify-center">
            <span className="text-white font-bold text-[13px]">D</span>
          </div>
          <h1 className="text-[19px] font-semibold text-[var(--color-text)] tracking-tight">DDL Flow</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-[var(--color-text-secondary)] mr-2">
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </span>
          <span className="max-w-[240px] truncate text-[12px] text-[var(--color-text-secondary)]">{userEmail}</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="px-3 py-1.5 rounded-[7px] bg-[#F1F5FA] text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
          >
            退出登录
          </button>
        </div>
      </header>

      {/* ========== WORK AREA ========== */}
      <div className="flex-1 grid grid-cols-[minmax(260px,22%)_1fr] gap-2 p-2 min-h-0 overflow-hidden">
        {/* ---- LEFT COLUMN ---- */}
        <div className="flex flex-col gap-2 min-h-0">
          {/* TOP 50%: Calendar */}
          <div className="flex-1 min-h-0">
            <CalendarModule ddls={ddls} selectedDate={selectedDate} onDateSelect={handleDateSelect} />
          </div>
          {/* BOTTOM 50%: AI Input */}
          <div className="flex-1 min-h-0">
            <AIBottomBar userName={userEmail} onCreated={refreshData} />
          </div>
        </div>

        {/* ---- RIGHT: Task Area (78%) ---- */}
        <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
          {/* TOP HALF: DayTasks or ProjectDetail */}
          <div className="flex-1 min-h-0 overflow-y-auto ui-panel p-4">
            <AnimatePresence mode="wait">
              {centralView === 'day-tasks' ? (
                <DayTasksView
                  key={`day-${selectedDate.format('YYYY-MM-DD')}`}
                  date={selectedDate}
                  ddls={dateDDLs}
                  projects={projects}
                  onRefresh={refreshData}
                  onProjectClick={handleProjectClick}
                />
              ) : selectedProject ? (
                <ProjectDetailView
                  key={`project-${selectedProject.id}`}
                  project={selectedProject}
                  ddls={projectDDLs(selectedProject.id)}
                  onBack={handleBackToWorkbench}
                  onRefresh={refreshData}
                  userName={userEmail}
                />
              ) : null}
            </AnimatePresence>
          </div>

          {/* BOTTOM HALF: Timeline + Projects */}
          <div className="flex-1 min-h-0 flex flex-col gap-2">
            <div className="flex-1 min-h-0">
              <TimelineModule
                ddls={ddls}
                projects={projects}
                onRefresh={refreshData}
                onProjectClick={handleProjectClick}
              />
            </div>

            {activeProjects.length > 0 && (
              <div className="shrink-0 ui-panel p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[14px] font-semibold text-[var(--color-text)]">所有任务</h3>
                  <span className="text-[11px] text-[var(--color-text-muted)]">{activeProjects.length} 个项目</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {activeProjects.map((p) => {
                    const stats = projectStats(p.id);
                    const pc = projectDDLs(p.id);
                    const nearest = pc.filter((d) => !d.completed).sort((a, b) =>
                      new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
                    )[0];
                    let priorityColor = 'var(--color-green)';
                    if (nearest) {
                      if (nearest.priority === '高') priorityColor = 'var(--color-red)';
                      else if (nearest.priority === '中') priorityColor = 'var(--color-yellow)';
                    }
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleProjectClick(p)}
                        className="shrink-0 w-[168px] text-left bg-[#F8FAFD] border border-transparent hover:border-[var(--color-border)] rounded-[8px] hover:shadow-sm transition-all flex overflow-hidden"
                      >
                        <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: priorityColor }} />
                        <div className="p-3 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-[13px] font-semibold text-[var(--color-text)] truncate">{p.name}</span>
                          <span className="text-[10px] px-1.5 py-1 ui-chip bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] font-medium shrink-0">
                            {p.category}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--color-border)] mb-2 overflow-hidden">
                          <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${stats.progress}%` }} />
                        </div>
                        <span className="text-[10px] text-[var(--color-text-secondary)]">
                          {stats.done}/{stats.total} · {stats.progress}%
                        </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    <MobileAppView
      userName={userEmail}
      userEmail={userEmail}
      projects={projects}
      ddls={ddls}
      todayCount={dateDDLs.filter((d) => !d.completed).length}
      onRefresh={refreshData}
      onSignOut={handleSignOut}
    />
    </>
  );
}

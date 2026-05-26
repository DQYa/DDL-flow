import { supabase } from '../lib/supabase';
import type { User, Project, DDL } from '../types';

// ---- User (localStorage only - no Supabase auth) ----

const USER_KEY = 'ddlflow_user';

interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  original_text: string | null;
  created_at: string;
}

interface DDLRow {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  deadline: string;
  priority: DDL['priority'] | null;
  category: string | null;
  status: boolean | null;
  completed_at: string | null;
  created_at: string;
}

export function loadUser(): User {
  const raw = localStorage.getItem(USER_KEY);
  if (raw) return JSON.parse(raw);
  const defaultUser: User = { name: 'DQY' };
  localStorage.setItem(USER_KEY, JSON.stringify(defaultUser));
  return defaultUser;
}

async function requireCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Please sign in before accessing DDL Flow data.');
  return data.user.id;
}

// ---- Projects ----

function toProjectRow(p: Project, userId: string) {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    category: p.category,
    original_text: p.originalText,
    created_at: p.createdAt,
  };
}

function fromProjectRow(r: ProjectRow): Project {
  return {
    id: r.id,
    name: r.name,
    category: r.category || '',
    originalText: r.original_text || '',
    createdAt: r.created_at,
  };
}

export async function loadProjects(): Promise<Project[]> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('loadProjects:', error); return []; }
  return (data || []).map(fromProjectRow);
}

export async function saveProjects(projects: Project[]): Promise<void> {
  if (projects.length > 0) {
    const userId = await requireCurrentUserId();
    const rows = projects.map((project) => toProjectRow(project, userId));
    const { error } = await supabase.from('projects').upsert(rows, { onConflict: 'id' });
    if (error) { console.error('saveProjects:', error); throw error; }
  }
}

export async function createProject(project: Project): Promise<void> {
  const userId = await requireCurrentUserId();
  const { error } = await supabase.from('projects').insert(toProjectRow(project, userId));
  if (error) { console.error('createProject:', error); throw error; }
}

export async function deleteProjects(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const userId = await requireCurrentUserId();
  const { error } = await supabase.from('projects').delete().in('id', ids).eq('user_id', userId);
  if (error) { console.error('deleteProjects:', error); throw error; }
}

// ---- DDLs ----

function toDDLRow(d: DDL, userId: string) {
  return {
    id: d.id,
    user_id: userId,
    project_id: d.projectId || null,
    title: d.title,
    description: d.description || '',
    deadline: d.deadline,
    priority: d.priority,
    category: d.category,
    status: d.completed,
    completed_at: d.completedAt || null,
    created_at: d.createdAt,
  };
}

function fromDDLRow(r: DDLRow): DDL {
  return {
    id: r.id,
    projectId: r.project_id || '',
    title: r.title,
    description: r.description || '',
    deadline: r.deadline,
    priority: r.priority || '中',
    category: r.category || '',
    completed: r.status || false,
    completedAt: r.completed_at || undefined,
    createdAt: r.created_at,
  };
}

export async function loadDDLs(): Promise<DDL[]> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('ddl')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('loadDDLs:', error); return []; }
  return (data || []).map(fromDDLRow);
}

export async function saveDDLs(ddls: DDL[]): Promise<void> {
  if (ddls.length > 0) {
    const userId = await requireCurrentUserId();
    const rows = ddls.map((ddl) => toDDLRow(ddl, userId));
    const { error } = await supabase.from('ddl').upsert(rows, { onConflict: 'id' });
    if (error) { console.error('saveDDLs:', error); throw error; }
  }
}

export async function createDDL(ddl: DDL): Promise<void> {
  const userId = await requireCurrentUserId();
  const { error } = await supabase.from('ddl').insert(toDDLRow(ddl, userId));
  if (error) { console.error('createDDL:', error); throw error; }
}

export async function createProjectWithDDLs(project: Project, ddls: DDL[]): Promise<void> {
  const userId = await requireCurrentUserId();
  const { error: projectError } = await supabase.from('projects').insert(toProjectRow(project, userId));
  if (projectError) { console.error('createProjectWithDDLs project:', projectError); throw projectError; }
  if (ddls.length > 0) {
    const { error } = await supabase.from('ddl').insert(ddls.map((ddl) => toDDLRow(ddl, userId)));
    if (error) { console.error('createProjectWithDDLs:', error); throw error; }
  }
}

export async function updateDDL(ddl: DDL): Promise<void> {
  const userId = await requireCurrentUserId();
  const { error } = await supabase.from('ddl').update(toDDLRow(ddl, userId)).eq('id', ddl.id).eq('user_id', userId);
  if (error) { console.error('updateDDL:', error); throw error; }
}

export async function setDDLCompleted(id: string, completed: boolean): Promise<void> {
  const userId = await requireCurrentUserId();
  const { error } = await supabase
    .from('ddl')
    .update({
      status: completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) { console.error('setDDLCompleted:', error); throw error; }
}

export async function deleteDDLs(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const userId = await requireCurrentUserId();
  const { error } = await supabase.from('ddl').delete().in('id', ids).eq('user_id', userId);
  if (error) { console.error('deleteDDLs:', error); throw error; }
}

export async function deleteProjectWithDDLs(projectId: string): Promise<void> {
  await deleteDDLsForProject(projectId);
  await deleteProjects([projectId]);
}

async function deleteDDLsForProject(projectId: string): Promise<void> {
  const userId = await requireCurrentUserId();
  const { error } = await supabase.from('ddl').delete().eq('project_id', projectId).eq('user_id', userId);
  if (error) { console.error('deleteDDLsForProject:', error); throw error; }
}

// ---- Categories ----

const DEFAULT_CATEGORIES = ['学习', '工作', '课程', '比赛', '社团', '考试', '生活'];
let cachedCategories: string[] | null = null;

export async function loadCategories(): Promise<string[]> {
  if (cachedCategories) return cachedCategories;
  const cats = new Set(DEFAULT_CATEGORIES);
  try {
    const [{ data: ddlCat }, { data: projCat }] = await Promise.all([
      supabase.from('ddl').select('category').eq('user_id', await requireCurrentUserId()),
      supabase.from('projects').select('category').eq('user_id', await requireCurrentUserId()),
    ]);
    for (const d of (ddlCat || [])) { if (d.category && d.category.trim()) cats.add(d.category.trim()); }
    for (const p of (projCat || [])) { if (p.category && p.category.trim()) cats.add(p.category.trim()); }
  } catch { /* offline — return defaults */ }
  cachedCategories = Array.from(cats);
  return cachedCategories;
}

export function saveCategories(categories: string[]): void {
  cachedCategories = categories;
}

export function clearCategoryCache(): void {
  cachedCategories = null;
}

// ---- Initialization ----

export async function isInitialized(): Promise<boolean> {
  const userId = await requireCurrentUserId();
  const [{ count: ddlCount }, { count: projCount }] = await Promise.all([
    supabase.from('ddl').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  return (ddlCount ?? 0) > 0 && (projCount ?? 0) > 0;
}

export async function setInitialized(): Promise<void> {
  // No-op: initialization state is determined by data presence
}

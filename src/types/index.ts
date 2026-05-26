export type Category = string;

export type Priority = '高' | '中' | '低';

export interface User {
  name: string;
}

export interface Project {
  id: string;
  name: string;
  category: Category;
  originalText: string;
  createdAt: string;
}

export interface DDL {
  id: string;
  projectId: string;
  title: string;
  description: string;
  deadline: string;
  priority: Priority;
  category: Category;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

export interface ParsedResult {
  projectName: string;
  category: Category;
  ddls: ParsedDDL[];
  originalText: string;
}

export interface ParsedDDL {
  title: string;
  deadline: string;
  priority: Priority;
  description: string;
}

export type CentralView = 'day-tasks' | 'project-detail';

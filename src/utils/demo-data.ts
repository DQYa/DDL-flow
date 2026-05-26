import type { Project, DDL } from '../types';
import dayjs from 'dayjs';

function id(): string {
  return crypto.randomUUID();
}

const now = dayjs();

export function generateDemoData(): { projects: Project[]; ddls: DDL[] } {
  const project1: Project = {
    id: id(),
    name: '军事理论',
    category: '课程',
    originalText: '军事理论：\nDQY负责：\n1. 周三前完成PPT\n2. 周五提交最终版\nAB负责：\n1. 周四完成数据整理\n5月30日晚集体检查',
    createdAt: now.subtract(3, 'day').toISOString(),
  };

  const project2: Project = {
    id: id(),
    name: '计算机大作业',
    category: '课程',
    originalText: '计算机大作业要求：\n需求分析文档 5月28日前\n前端开发完成 6月3日\n最终提交 6月8日23:59',
    createdAt: now.subtract(7, 'day').toISOString(),
  };

  const project3: Project = {
    id: id(),
    name: '数学建模比赛',
    category: '比赛',
    originalText: '全国大学生数学建模竞赛\n报名截止：6月15日\n初赛：7月1日\n决赛：8月20日',
    createdAt: now.subtract(14, 'day').toISOString(),
  };

  const project4: Project = {
    id: id(),
    name: '学生会招新',
    category: '社团',
    originalText: '学生会春季招新\n面试安排：5月30日\n结果公布：6月2日',
    createdAt: now.subtract(5, 'day').toISOString(),
  };

  const ddls: DDL[] = [
    {
      id: id(),
      projectId: project1.id,
      title: '完成PPT',
      description: '周三前完成PPT',
      deadline: now.add(2, 'day').hour(23).minute(59).second(0).toISOString(),
      priority: '高',
      category: '课程',
      completed: false,
      createdAt: now.subtract(3, 'day').toISOString(),
    },
    {
      id: id(),
      projectId: project1.id,
      title: '提交最终版',
      description: '周五提交最终版',
      deadline: now.add(4, 'day').hour(23).minute(59).second(0).toISOString(),
      priority: '高',
      category: '课程',
      completed: false,
      createdAt: now.subtract(3, 'day').toISOString(),
    },
    {
      id: id(),
      projectId: project2.id,
      title: '需求分析',
      description: '需求分析文档',
      deadline: now.add(3, 'day').hour(23).minute(59).second(0).toISOString(),
      priority: '中',
      category: '课程',
      completed: false,
      createdAt: now.subtract(7, 'day').toISOString(),
    },
    {
      id: id(),
      projectId: project2.id,
      title: '前端完成',
      description: '前端开发完成',
      deadline: now.add(9, 'day').hour(23).minute(59).second(0).toISOString(),
      priority: '中',
      category: '课程',
      completed: false,
      createdAt: now.subtract(7, 'day').toISOString(),
    },
    {
      id: id(),
      projectId: project2.id,
      title: '最终提交',
      description: '最终提交',
      deadline: now.add(14, 'day').hour(23).minute(59).second(0).toISOString(),
      priority: '高',
      category: '课程',
      completed: false,
      createdAt: now.subtract(7, 'day').toISOString(),
    },
    {
      id: id(),
      projectId: project3.id,
      title: '报名',
      description: '报名截止',
      deadline: now.add(21, 'day').hour(23).minute(59).second(0).toISOString(),
      priority: '高',
      category: '比赛',
      completed: false,
      createdAt: now.subtract(14, 'day').toISOString(),
    },
    {
      id: id(),
      projectId: project3.id,
      title: '初赛',
      description: '数学建模初赛',
      deadline: now.add(37, 'day').hour(9).minute(0).second(0).toISOString(),
      priority: '高',
      category: '比赛',
      completed: false,
      createdAt: now.subtract(14, 'day').toISOString(),
    },
    {
      id: id(),
      projectId: project4.id,
      title: '面试安排',
      description: '学生会面试安排',
      deadline: now.add(5, 'day').hour(18).minute(0).second(0).toISOString(),
      priority: '中',
      category: '社团',
      completed: false,
      createdAt: now.subtract(5, 'day').toISOString(),
    },
    {
      id: id(),
      projectId: project4.id,
      title: '结果公布',
      description: '招新结果公布',
      deadline: now.add(8, 'day').hour(12).minute(0).second(0).toISOString(),
      priority: '低',
      category: '社团',
      completed: true,
      completedAt: now.subtract(1, 'day').toISOString(),
      createdAt: now.subtract(5, 'day').toISOString(),
    },
  ];

  return { projects: [project1, project2, project3, project4], ddls };
}

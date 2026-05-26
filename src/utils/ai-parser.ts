import type { Priority, ParsedResult, ParsedDDL } from '../types';
import { loadCategories } from './storage';
import dayjs from 'dayjs';

// ============================================================
//  Parse Pipeline v2.1 — Deadline-Anchored Semantic Extraction
// ============================================================

// ---- Category Keywords ----

const BASE_KEYWORDS: Record<string, string[]> = {
  '学习': ['学习', '复习', '作业', '论文', '阅读', '笔记', '自习', '图书馆'],
  '工作': ['工作', '实习', '面试', '简历', '任务', '项目', '报告', '周报'],
  '课程': ['课程', '上课', '课堂', '课件', 'PPT', '展示', 'pre', '汇报', '小组', '讨论'],
  '比赛': ['比赛', '竞赛', '挑战杯', '大创', '互联网+', '建模', '编程', '路演', '答辩'],
  '社团': ['社团', '活动', '招新', '例会', '团建', '聚餐', '晚会', '换届'],
  '考试': ['考试', '期末', '期中', '测验', '四级', '六级', '考研', '雅思', '托福', '教资', '公考'],
  '生活': ['体检', '看病', '搬家', '旅行', '聚会', '生日', '快递', '缴费', '办理'],
};

async function getCategoryKeywords(): Promise<Record<string, string[]>> {
  const categories = await loadCategories();
  const kw: Record<string, string[]> = {};
  for (const cat of categories) {
    kw[cat] = BASE_KEYWORDS[cat] || [cat];
  }
  return kw;
}

// ---- Action Verbs (verbs that indicate a real deliverable) ----

const ACTION_VERBS = [
  '提交', '完成', '准备', '参加', '报名', '撰写', '制作', '收集', '整理',
  '发送', '上传', '下载', '填写', '打印', '购买', '联系', '确认',
  '检查', '复习', '预习', '阅读', '负责', '组织', '安排', '协调', '统计',
  '汇总', '汇报', '回复', '修改', '更新', '删除', '安装', '配置', '部署',
  '设计', '开发', '测试', '发布', '翻译', '校对', '录制', '拍摄', '编辑',
  '办理', '缴费', '注册', '登录', '签到', '请假', '申请', '审批', '盖章',
  '扫描', '备份', '恢复', '清理', '打扫', '采购', '搬运', '布置',
  '主持', '演讲', '演示', '讲解', '辅导', '答疑', '评分', '批改', '出卷',
  '命题', '监考', '巡考', '登分', '录入', '核对', '验收', '交付',
];

// ---- Notice / Announcement Signals ----

const NOTICE_SIGNALS = [
  /通知/, /公告/, /请各单位/, /请督促/, /@所有人/, /@all/,
  /各位同学/, /各位老师/, /各班级/, /各年级/, /各学院/, /各位家长/,
  /团委/, /学生会/, /学校/, /教务处/, /学院/, /学工部/, /辅导员/,
  /特此通知/, /请互相转告/, /请查收/, /请注意/,
  /根据.*?要求/, /按照.*?规定/, /经.*?研究/,
  /逾期/, /未按要求/,
];

// ---- Lines to Completely Ignore ----

const IGNORE_LINE_PATTERNS = [
  // Bare headers / dividers
  /^[—-]+$/, /^#{1,3}\s/, /^[=]+$/,
  // Administrative boilerplate
  /^请各单位/, /^请督促/, /^请互相转告/, /^特此通知/,
  /^根据.*?要求$/, /^经.*?研究/, /^按照.*?规定/,
  /^如有.*?请/, /^届时/, /^以上/,
  /现将.*?通知如下/, /将以下材料.*?发送/,
  /请.*?高度重视/, /请.*?积极组织/,
  // Contact info
  /联系人[:：]/, /联系电话/, /联系邮箱/, /联系地址/,
  /^邮箱[:：]/, /^电话[:：]/,
  // Signatures
  /^校团委/, /^学生会/, /^教务处/, /^\d{4}年\d{1,2}月\d{1,2}日$/,
  // @ mentions
  /^@\S+/,
  // List / section titles that are not tasks
  /^(本周|今日|明天|明日|个人)?(待办|任务|计划|安排|备忘)[：:]\s*$/,
  // Very short (1 char)
  /^.$/,
];

// ---- Section Headers (Chinese numerals + 、) ----

const SECTION_HEADER = /^[（(]?[一二三四五六七八九十]+[）)、][、，]?\s*/;
const NUMBERED_ITEM = /^\d+[.、)]\s*/;

// ---- Patterns That Look Like Tasks But Aren't ----

const NON_TASK_PATTERNS = [
  // Pure deadline markers: "报名截止：XXX" "截止时间：XXX"
  /^(报名|提交|申请|比赛|考试|活动)?截止\s*(时间|日期)?\s*[:：]/,
  /^(初赛|决赛|复赛|笔试|面试|考试|活动|比赛|会议|培训)\s*(时间|日期)?\s*[:：]/,
  // Constraints / rules: "每个团队人数不超过8人"
  /不超过/, /不少于/, /至少/, /最多/, /不低于/, /不高于/,
  /^本次/, /^本届/, /^本项/,
  /^现将.*?通知如下/, /^根据.*?(?:安排|要求|规定|通知)/,
  // Contact / inquiry
  /^详情/, /^具体/, /^咨询/,
  // Transitional instructions
  /将以下材料.*?发送/, /请.*?于.*?前.*?将.*?发送/,
];

// ============================================================
//  Step 1: Text Type Detection
// ============================================================

type TextType = 'notice' | 'personal' | 'list' | 'mixed';

function detectTextType(text: string): TextType {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Count notice signals
  const noticeScore = NOTICE_SIGNALS.reduce((s, p) => s + (p.test(text) ? 1 : 0), 0);

  // Count numbered items (number. or number、or number) pattern)
  const numberedCount = lines.filter(l => NUMBERED_ITEM.test(l)).length;
  const listRatio = lines.length > 0 ? numberedCount / lines.length : 0;

  // Check for formal structure markers: section headers like 一、二、三、
  const sectionCount = lines.filter(l => SECTION_HEADER.test(l)).length;

  // Personal signals
  const personalSignals = [/我的/, /我要/, /我需要/, /记得/, /别忘了/, /待办/, /todo/i, /^备忘/];
  const personalScore = personalSignals.reduce((s, p) => s + (p.test(text) ? 1 : 0), 0);

  // Short input → personal
  if (lines.length <= 3 && noticeScore === 0) return 'personal';

  // Strong notice signal
  if (noticeScore >= 2) {
    if (listRatio > 0.25 && sectionCount > 0) return 'mixed';
    return 'notice';
  }

  // Formal structure (sections + numbered items) → likely a notice or structured list
  if (sectionCount >= 2 && lines.length > 5) {
    if (noticeScore >= 1) return 'notice';
    return 'list';
  }

  // High numbered ratio → list
  if (listRatio > 0.4) return 'list';

  // Personal signals
  if (personalScore > 0) return 'personal';

  // Any notice signal at all
  if (noticeScore >= 1) return 'notice';

  // Long text without clear structure → personal (todo dump)
  return 'personal';
}

// ============================================================
//  Step 2: Date Parsing
// ============================================================

function parseDate(text: string): string | null {
  const now = dayjs();
  const trimmed = text.trim();

  // Today
  if (/今晚|今天晚上|今晚儿/.test(trimmed)) {
    return now.hour(23).minute(59).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }
  if (/今天|今日|今天白天/.test(trimmed)) {
    return now.hour(23).minute(59).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }

  // Tomorrow
  if (/明天下午|明天傍晚/.test(trimmed)) {
    return now.add(1, 'day').hour(18).minute(0).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }
  if (/明天晚上|明晚/.test(trimmed)) {
    return now.add(1, 'day').hour(23).minute(59).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }
  if (/明天上午/.test(trimmed)) {
    return now.add(1, 'day').hour(12).minute(0).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }
  if (/明天|明日/.test(trimmed)) {
    return now.add(1, 'day').hour(23).minute(59).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }

  // Day after tomorrow
  if (/后天上午/.test(trimmed)) {
    return now.add(2, 'day').hour(12).minute(0).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }
  if (/后天下午|后天傍晚/.test(trimmed)) {
    return now.add(2, 'day').hour(18).minute(0).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }
  if (/后天晚上|后天/.test(trimmed)) {
    return now.add(2, 'day').hour(23).minute(59).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }

  // 3 days later
  if (/大后天上午/.test(trimmed)) {
    return now.add(3, 'day').hour(12).minute(0).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }
  if (/大后天下午|大后天傍晚/.test(trimmed)) {
    return now.add(3, 'day').hour(18).minute(0).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }
  if (/大后天晚上|大后天/.test(trimmed)) {
    return now.add(3, 'day').hour(23).minute(59).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }

  // N days later
  const daysLaterMatch = trimmed.match(/(\d+)\s*天后/);
  if (daysLaterMatch) {
    const days = parseInt(daysLaterMatch[1]);
    return now.add(days, 'day').hour(23).minute(59).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }

  // Week-based
  const weekMatch = trimmed.match(/周([一二三四五六日])前?/);
  if (weekMatch) {
    const dayMap: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0 };
    const targetDay = dayMap[weekMatch[1]];
    const currentDay = now.day();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    return now.add(daysUntil, 'day').hour(23).minute(59).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }

  if (/下周/.test(trimmed)) {
    return now.add(7, 'day').hour(23).minute(59).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }

  // Month-based
  if (/月底前|月底|月末/.test(trimmed)) {
    return now.endOf('month').hour(23).minute(59).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }
  if (/下月初|6月初|六月初/.test(trimmed)) {
    return now.add(1, 'month').startOf('month').add(2, 'day').hour(23).minute(59).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }
  if (/下月底/.test(trimmed)) {
    return now.add(1, 'month').endOf('month').hour(23).minute(59).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }

  // "5月28日17:00" — date + time (specific time)
  const dateTimeMatch = trimmed.match(/(\d{1,2})月(\d{1,2})[日号]?\s*(\d{1,2}):(\d{2})/);
  if (dateTimeMatch) {
    const month = parseInt(dateTimeMatch[1]);
    const day = parseInt(dateTimeMatch[2]);
    const hour = parseInt(dateTimeMatch[3]);
    const minute = parseInt(dateTimeMatch[4]);
    const year = month < now.month() + 1 ? now.year() + 1 : now.year();
    return dayjs(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
      .hour(hour).minute(minute).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }

  // "5月28日" — simple date
  const dateMatch1 = trimmed.match(/(\d{1,2})月(\d{1,2})[日号]?/);
  if (dateMatch1) {
    const month = parseInt(dateMatch1[1]);
    const day = parseInt(dateMatch1[2]);
    const year = month < now.month() + 1 ? now.year() + 1 : now.year();
    return dayjs(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
      .hour(23).minute(59).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }

  // ISO date: "2024-05-28"
  const dateMatch2 = trimmed.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (dateMatch2) {
    const [, y, m, d] = dateMatch2;
    return dayjs(`${y}-${String(parseInt(m)).padStart(2, '0')}-${String(parseInt(d)).padStart(2, '0')}`)
      .hour(23).minute(59).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }

  // Time only: "17:00"
  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const h = parseInt(timeMatch[1]);
    const m = parseInt(timeMatch[2]);
    return now.hour(h).minute(m).second(0).format('YYYY-MM-DDTHH:mm:ss');
  }

  return null;
}

// ============================================================
//  Step 3: Line Filtering & Classification
// ============================================================

function shouldIgnoreLine(line: string): boolean {
  for (const p of IGNORE_LINE_PATTERNS) {
    if (p.test(line)) return true;
  }
  // Section headers like "一、参赛对象" "四、材料提交" are not tasks
  if (SECTION_HEADER.test(line)) return true;
  return false;
}

function isNonTask(line: string): boolean {
  for (const p of NON_TASK_PATTERNS) {
    if (p.test(line)) return true;
  }
  return false;
}

function hasActionVerb(line: string): boolean {
  return ACTION_VERBS.some(v => line.includes(v));
}

// Extract any date found within a line of text
function extractInlineDate(line: string): string | null {
  // "在5月20日前" / "于5月28日前" / "需5月20日前"
  const zaiMatch = line.match(/[在将于需]\s*(\d{1,2}月\d{1,2}[日号]?(?:\s*\d{1,2}:\d{2})?)\s*(前|之前)/);
  if (zaiMatch) return parseDate(zaiMatch[1]);

  // "5月28日17:00前"
  const beforeMatch = line.match(/(\d{1,2}月\d{1,2}[日号]?\s*\d{1,2}:\d{2})\s*前/);
  if (beforeMatch) return parseDate(beforeMatch[1]);

  // "5月28日前"
  const simpleBefore = line.match(/(\d{1,2}月\d{1,2}[日号]?)\s*前/);
  if (simpleBefore) return parseDate(simpleBefore[1]);

  // "报名截止：5月28日" — deadline marker within line
  const deadlineMarker = line.match(/截止\s*(时间|日期)?\s*[:：]?\s*(\d{1,2}月\d{1,2}[日号]?(?:\s*\d{1,2}:\d{2})?)/);
  if (deadlineMarker) {
    const d = deadlineMarker[2] || deadlineMarker[1];
    return parseDate(d);
  }

  // Any date in the line (loose match)
  const anyDate = line.match(/(\d{1,2}月\d{1,2}[日号]?(?:\s*\d{1,2}:\d{2})?)/);
  if (anyDate) return parseDate(anyDate[1]);

  // Relative dates
  const relDate = line.match(/(今晚|今天晚上|明天|后天|大后天|周[一二三四五六日]|\d+天后)/);
  if (relDate) return parseDate(relDate[1]);

  return null;
}

// ============================================================
//  Step 4: Task Extraction (deadline-anchored)
// ============================================================

interface RawTask {
  title: string;
  deadline: string | null;
  description: string;
}

// Find the most recent section header before a given line index
function findParentSection(lines: string[], lineIndex: number): string {
  for (let i = lineIndex - 1; i >= 0; i--) {
    const m = lines[i].match(SECTION_HEADER);
    if (m) {
      // Return the section title without the number marker
      return lines[i].replace(SECTION_HEADER, '').trim();
    }
  }
  return '';
}

function extractTasksForNotice(text: string, globalDeadline: string | null): RawTask[] {
  const lines = text.split('\n').map(l => l.trim());
  const tasks: RawTask[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || shouldIgnoreLine(line)) continue;
    if (isNonTask(line)) continue;

    // Must have an action verb or be a numbered item with clear task context
    const isNumbered = NUMBERED_ITEM.test(line);
    const hasVerb = hasActionVerb(line);

    if (!hasVerb && !isNumbered) continue;

    // Numbered items without verbs: try to inherit context from parent section or previous line
    let title: string;
    if (isNumbered && !hasVerb) {
      const parentSection = findParentSection(lines, i);
      // Look back for the nearest line with an action verb
      let inheritedVerb = '';
      for (let j = i - 1; j >= 0; j--) {
        const prevLine = lines[j];
        if (SECTION_HEADER.test(prevLine)) {
          // Got section header — use its verb if it has one
          const sectionTitle = prevLine.replace(SECTION_HEADER, '').trim();
          const sectionVerb = ACTION_VERBS.find(v => sectionTitle.includes(v));
          if (sectionVerb) {
            inheritedVerb = sectionVerb;
          }
          break;
        }
        if (hasActionVerb(prevLine)) {
          // Find the first action verb in the previous actionable line
          const verb = ACTION_VERBS.find(v => prevLine.includes(v));
          if (verb) inheritedVerb = verb;
          break;
        }
      }
      // Also check section header directly
      if (!inheritedVerb && parentSection) {
        const sectionVerb = ACTION_VERBS.find(v => parentSection.includes(v));
        if (sectionVerb) inheritedVerb = sectionVerb;
      }

      const cleaned = line.replace(NUMBERED_ITEM, '').trim();
      if (inheritedVerb && !hasActionVerb(cleaned)) {
        title = inheritedVerb + cleaned;
      } else {
        title = cleaned;
      }
    } else {
      title = line.replace(NUMBERED_ITEM, '').replace(SECTION_HEADER, '').trim();
    }

    if (title.length < 2) continue;

    // Extract deadline from this specific line
    const lineDeadline = extractInlineDate(line);

    tasks.push({
      title,
      deadline: lineDeadline || globalDeadline,
      description: line,
    });
  }

  return tasks;
}

function extractTasksForPersonal(text: string): RawTask[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const tasks: RawTask[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (shouldIgnoreLine(line)) continue;
    if (line.length < 2) continue;

    let title = line.replace(NUMBERED_ITEM, '').trim();

    // Strip reminder prefixes
    title = title.replace(/^(?:记得|别忘了|不要忘了|别忘了要|别忘了去)\s*/, '');

    if (title.length < 2) continue;

    // Skip first line if it looks like a header (short, no verb, not numbered)
    if (i === 0 && lines.length > 1 && !NUMBERED_ITEM.test(line) && !hasActionVerb(line) && line.length <= 12) {
      continue;
    }

    // Extract inline date if any
    const lineDeadline = extractInlineDate(line);

    // If the whole line is just a date, skip it
    if (!lineDeadline) {
      const maybeDate = parseDate(title);
      if (maybeDate && title.length <= 8) continue;
    }

    tasks.push({
      title,
      deadline: lineDeadline,
      description: line,
    });
  }

  return tasks;
}

// ============================================================
//  Step 5: Semantic Merging
// ============================================================

function charBigrams(s: string): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.add(s.substring(i, i + 2));
  }
  return bigrams;
}

function textSimilarity(a: string, b: string): number {
  const bgA = charBigrams(a);
  const bgB = charBigrams(b);
  if (bgA.size === 0 || bgB.size === 0) return 0;
  let intersection = 0;
  for (const bg of bgA) {
    if (bgB.has(bg)) intersection++;
  }
  return intersection / Math.max(bgA.size, bgB.size);
}

function mergeSimilarTasks(rawTasks: RawTask[], isNotice: boolean): RawTask[] {
  if (rawTasks.length <= 1) return rawTasks;

  const threshold = isNotice ? 0.30 : 0.45; // More aggressive for notices
  const merged: RawTask[] = [];
  const used = new Set<number>();

  for (let i = 0; i < rawTasks.length; i++) {
    if (used.has(i)) continue;
    let representative = rawTasks[i];
    used.add(i);

    for (let j = i + 1; j < rawTasks.length; j++) {
      if (used.has(j)) continue;
      const sim = textSimilarity(representative.title, rawTasks[j].title);
      if (sim > threshold) {
        // Merge: keep the longer title
        if (rawTasks[j].title.length > representative.title.length) {
          representative = { ...representative, title: rawTasks[j].title };
        }
        // Use earlier deadline
        const candidateDeadline = rawTasks[j].deadline;
        const representativeDeadline = representative.deadline;
        if (
          candidateDeadline &&
          (!representativeDeadline ||
            new Date(candidateDeadline) < new Date(representativeDeadline))
        ) {
          representative = { ...representative, deadline: candidateDeadline };
        }
        used.add(j);
      }
    }

    merged.push(representative);
  }

  return merged;
}

function deduplicateTasks(tasks: RawTask[]): RawTask[] {
  const seen = new Set<string>();
  const result: RawTask[] = [];

  for (const task of tasks) {
    const key = task.title.replace(/\s+/g, '').substring(0, 8);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(task);
    }
  }

  return result;
}

// ============================================================
//  Step 6: Priority
// ============================================================

function autoPriority(deadline: string): Priority {
  const now = dayjs();
  const d = dayjs(deadline);
  const hoursUntil = d.diff(now, 'hour');

  if (hoursUntil <= 24) return '高';
  if (hoursUntil <= 72) return '中';
  return '低';
}

function detectPriorityFromText(text: string): Priority {
  for (const p of [/紧急/, /重要/, /尽快/, /马上/, /立即/, /优先/, /截止/, /deadline/i, /ddl/i, /必须/, /务必/, /ASAP/i]) {
    if (p.test(text)) return '高';
  }
  for (const p of [/有空/, /不急/, /随意/, /顺便/, /抽空/]) {
    if (p.test(text)) return '低';
  }
  return '中';
}

function determinePriority(deadline: string, text: string): Priority {
  const textPriority = detectPriorityFromText(text);
  if (textPriority !== '中') return textPriority;
  return autoPriority(deadline);
}

// ============================================================
//  Step 7: Project Name & Global Deadline & Category
// ============================================================

function extractProjectName(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return '未命名项目';

  // Best: first line that looks like a title (ends with 通知/公告/安排)
  for (const line of lines) {
    if (/(?:通知|公告|安排|方案|计划|比赛|竞赛|活动)$/.test(line) && line.length >= 6 && line.length < 40) {
      return line.replace(/[【#*\]]|\[/g, '').trim();
    }
  }

  // Next: first non-header, non-task line
  for (const line of lines) {
    if (shouldIgnoreLine(line)) continue;
    if (SECTION_HEADER.test(line)) continue;
    if (hasActionVerb(line)) continue;
    if (line.length >= 2 && line.length < 30) {
      if (!/\d{1,2}[月/-]/.test(line) && !/[:：]/.test(line)) {
        return line.replace(/[【#*\]]|\[/g, '').trim();
      }
    }
  }

  // Fallback
  const projectMatch = text.match(/项目[：:]\s*(.+)/);
  if (projectMatch) return projectMatch[1].trim();

  return '未命名项目';
}

function extractGlobalDeadline(text: string): string | null {
  // Explicit deadline markers
  const patterns = [
    /(?:报名|提交|申请|比赛|考试|活动)?截止\s*(?:时间|日期)?\s*[:：]\s*(.+)/,
    /deadline\s*[:：]\s*(.+)/i,
    /ddl\s*[:：]\s*(.+)/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const parsed = parseDate(m[1]);
      if (parsed) return parsed;
    }
  }

  // "请于XX前" patterns
  const pleaseMatch = text.match(/请[各院全校].*?于\s*(.+?)\s*前/);
  if (pleaseMatch) {
    const parsed = parseDate(pleaseMatch[1]);
    if (parsed) return parsed;
  }

  return null;
}

async function detectCategory(text: string): Promise<string> {
  const keywords = await getCategoryKeywords();
  const categories = await loadCategories();
  const scores = Object.entries(keywords).map(([cat, kws]) => {
    const score = kws.reduce((s, kw) => s + (text.includes(kw) ? 1 : 0), 0);
    return { cat, score };
  });
  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.score > 0 ? scores[0].cat : (categories[0] || '课程');
}

// ============================================================
//  Main Export
// ============================================================

export async function parseAIInput(text: string, userName: string): Promise<ParsedResult> {
  void userName;
  const textType = detectTextType(text);
  const category = await detectCategory(text);
  const globalDeadline = extractGlobalDeadline(text);
  const projectName = extractProjectName(text);
  const isNotice = textType === 'notice' || textType === 'mixed';

  let rawTasks: RawTask[];

  if (isNotice) {
    rawTasks = extractTasksForNotice(text, globalDeadline);
  } else {
    rawTasks = extractTasksForPersonal(text);
    // Apply global deadline to tasks without one
    if (globalDeadline) {
      rawTasks = rawTasks.map(t => ({
        ...t,
        deadline: t.deadline || globalDeadline,
      }));
    }
  }

  // Merge similar tasks (more aggressive for notices)
  rawTasks = mergeSimilarTasks(rawTasks, isNotice);

  // Deduplicate
  rawTasks = deduplicateTasks(rawTasks);

  // Fill missing deadlines
  const fallbackDeadline = dayjs().add(7, 'day').hour(23).minute(59).second(0).format('YYYY-MM-DDTHH:mm:ss');
  rawTasks = rawTasks.map(t => ({
    ...t,
    deadline: t.deadline || fallbackDeadline,
  }));

  // Cap: notices ≤ 5, personal ≤ 8
  const cap = isNotice ? 5 : 8;
  if (rawTasks.length > cap) {
    const scored = rawTasks.map((t, i) => {
      const verbCount = ACTION_VERBS.reduce((s, v) => s + (t.title.includes(v) ? 1 : 0), 0);
      return { task: t, score: verbCount, index: i };
    });
    scored.sort((a, b) => b.score - a.score);
    rawTasks = scored.slice(0, cap).sort((a, b) => a.index - b.index).map(s => s.task);
  }

  // Build final output
  const ddls: ParsedDDL[] = rawTasks.map(t => ({
    title: t.title,
    deadline: t.deadline!,
    priority: determinePriority(t.deadline!, text),
    description: t.description,
  }));

  // Fallback: if nothing extracted, create one task from first meaningful line
  if (ddls.length === 0) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const firstLine = lines.find(l => l.length > 3 && !shouldIgnoreLine(l)) || lines[0] || '任务';
    ddls.push({
      title: firstLine.replace(NUMBERED_ITEM, '').trim().substring(0, 50) || '任务',
      deadline: globalDeadline || fallbackDeadline,
      priority: determinePriority(globalDeadline || fallbackDeadline, text),
      description: firstLine,
    });
  }

  return {
    projectName,
    category,
    ddls,
    originalText: text,
  };
}

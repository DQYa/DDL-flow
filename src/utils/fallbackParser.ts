import dayjs from 'dayjs';
import type { ParsedResult, Priority } from '../types';

type Confidence = 'high' | 'medium' | 'low';

interface DeadlineResult {
  value: string;
  detected: boolean;
}

const HIGH_PRIORITY = /紧急|重要|必须|立即|今天|今晚|截止今晚|逾期|最后一天|不交|未完成/;
const MEDIUM_PRIORITY = /明天|后天|本周|这周|周[一二三四五六日天]前|尽快|及时|请尽快/;
const LOW_PRIORITY = /下周|有空|自愿|可选|了解一下/;

const TITLE_KEYWORDS = [
  '作业',
  '会议',
  '班会',
  '讲座',
  '比赛',
  '报名',
  '提交',
  '签到',
  '活动',
  '考试',
  '调研',
  '课程',
  '训练',
  '汇报',
  '答辩',
  '检查表',
  '大赛',
];

const LOCATION_ENTITY_PATTERN =
  '(?:教学楼|实验楼|综合楼|行政楼|图书馆|体育馆|操场|学术报告厅|报告厅|会议室|教室|机房|宿舍|食堂|校门|广场|腾讯会议|飞书会议|钉钉会议|线上|线下|A座|B座|[AB]\\d{3,4}|\\d{3,4})';

const WEEKDAY_MAP: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0,
};

const CN_NUMBER_MAP: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十一: 11,
  十二: 12,
};

function cleanText(text: string): string {
  return text
    .replace(/@所有人/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function clampTitle(title: string): string {
  const cleaned = title
    .replace(/^【?重要?通知】?/g, '')
    .replace(/^各位同学[，,：:\s]*/g, '')
    .replace(/^请大家[，,：:\s]*/g, '')
    .replace(/^关于/g, '')
    .replace(/^@所有人/g, '')
    .replace(/[，,。；;：:\s]+$/g, '')
    .replace(/^[，,。；;：:\s]+/g, '')
    .trim();

  return cleaned.length > 30 ? cleaned.slice(0, 30).replace(/[，,。；;：:\s]+$/g, '') : cleaned;
}

function stripScheduleAndPlace(text: string): string {
  return text
    .replace(/(?:请于|请在|需在|于|在)?(?:今天|今晚|明天|后天|本周|这周|下周|周|星期)[一二三四五六日天]?(?:上午|中午|下午|晚上)?[零一二两三四五六七八九十\d]{1,2}(?:点半|点|[:：]\d{2})?(?:前|之前)?/g, '')
    .replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:\s*(?:上午|中午|下午|晚上)?\d{1,2}(?:[:：]\d{2}|点半?|点)?)?(?:前|之前)?/g, '')
    .replace(/\d{1,2}\s*(?:月|[.-])\s*\d{1,2}\s*(?:日|号)?(?:\s*(?:上午|中午|下午|晚上)?\d{1,2}(?:[:：]\d{2}|点半?|点)?)?(?:前|之前)?/g, '')
    .replace(new RegExp(`(?:在|于|前往|到)\\s*[^，,。；;\\n]{0,20}${LOCATION_ENTITY_PATTERN}[^，,。；;\\n]{0,12}`, 'g'), '')
    .replace(/(?:截止时间|截止|提交|完成|参加|报名|通知|请|需|前|之前|为|的)+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentenceAroundKeyword(text: string): string {
  const clauses = text
    .split(/[。！？!?；;\n]/)
    .map((line) => line.trim())
    .filter(Boolean);

  const matched = clauses.find((line) => TITLE_KEYWORDS.some((keyword) => line.includes(keyword)));
  return matched || clauses[0] || text;
}

function extractTitle(text: string): string {
  const cleaned = cleanText(text);
  const firstLine = cleaned.split('\n').map((line) => line.trim()).find(Boolean) || cleaned;
  const candidateLine = TITLE_KEYWORDS.some((keyword) => firstLine.includes(keyword))
    ? firstLine
    : sentenceAroundKeyword(cleaned);

  const compactPatterns = [
    /([\u4e00-\u9fa5A-Za-z0-9]{0,12}(?:创新创业大赛|大赛|竞赛|比赛|报名)[\u4e00-\u9fa5A-Za-z0-9]{0,8})/,
    /([\u4e00-\u9fa5A-Za-z0-9]{0,12}(?:作业|检查表|报告|论文|表格|材料))/,
    /([\u4e00-\u9fa5A-Za-z0-9]{0,12}(?:班会|会议|讲座|考试|答辩|汇报|签到|活动|训练))/,
  ];

  for (const pattern of compactPatterns) {
    const match = candidateLine.match(pattern);
    if (match?.[1]) return clampTitle(stripScheduleAndPlace(match[1]));
  }

  const stripped = stripScheduleAndPlace(candidateLine);
  return clampTitle(stripped || candidateLine || '未命名任务');
}

function parseHour(raw: string): number | null {
  if (/^\d+$/.test(raw)) return Number(raw);
  return CN_NUMBER_MAP[raw] ?? null;
}

function normalizeHour(hour: number, period?: string): number {
  if ((period === '下午' || period === '晚上' || period === '今晚') && hour < 12) return hour + 12;
  if (period === '中午' && hour < 11) return hour + 12;
  return hour;
}

function extractTime(segment: string): { hour: number; minute: number; detected: boolean } {
  const clock = segment.match(/(上午|早上|中午|下午|晚上|今晚)?\s*(\d{1,2})[:：](\d{2})/);
  if (clock) {
    return {
      hour: normalizeHour(Number(clock[2]), clock[1]),
      minute: Number(clock[3]),
      detected: true,
    };
  }

  const hourText = segment.match(/(上午|早上|中午|下午|晚上|今晚)?\s*([零一二两三四五六七八九十\d]{1,2})点(半)?/);
  if (hourText) {
    const hour = parseHour(hourText[2]);
    if (hour !== null) {
      return {
        hour: normalizeHour(hour, hourText[1]),
        minute: hourText[3] ? 30 : 0,
        detected: true,
      };
    }
  }

  return { hour: 23, minute: 59, detected: false };
}

function parseDateFromSegment(segment: string): { date: dayjs.Dayjs | null; detected: boolean } {
  const now = dayjs();

  const fullDate = segment.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (fullDate) {
    return {
      date: dayjs(`${fullDate[1]}-${fullDate[2].padStart(2, '0')}-${fullDate[3].padStart(2, '0')}`),
      detected: true,
    };
  }

  const monthDay = segment.match(/(?<!\d)(\d{1,2})\s*(?:月|[.-])\s*(\d{1,2})\s*(?:日|号)?(?!\d)/);
  if (monthDay) {
    const month = Number(monthDay[1]);
    const date = Number(monthDay[2]);
    const year = month < now.month() + 1 ? now.year() + 1 : now.year();
    return {
      date: dayjs(`${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`),
      detected: true,
    };
  }

  if (/后天/.test(segment)) return { date: now.add(2, 'day'), detected: true };
  if (/明天|明日/.test(segment)) return { date: now.add(1, 'day'), detected: true };
  if (/今天|今日|今晚/.test(segment)) return { date: now, detected: true };

  const weekday = segment.match(/(下周|下星期|本周|这周|周|星期)([一二三四五六日天])/);
  if (weekday) {
    const target = WEEKDAY_MAP[weekday[2]];
    const isNextWeek = weekday[1] === '下周' || weekday[1] === '下星期';
    let diff = target - now.day();
    if (isNextWeek) {
      if (diff <= 0) diff += 7;
    } else if (diff < 0) {
      diff += 7;
    }
    return { date: now.add(diff, 'day'), detected: true };
  }

  return { date: null, detected: false };
}

function candidateSegments(text: string): string[] {
  const keywords = /(截止时间|报名截止时间|截止|ddl|DDL|提交|前提交|前|之前|逾期|需在|请于|活动时间|会议时间|上课时间|比赛时间|时间|于)/g;
  const segments: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = keywords.exec(text))) {
    const start = Math.max(0, match.index - 24);
    const end = Math.min(text.length, match.index + match[0].length + 48);
    segments.push(text.slice(start, end));
  }

  return [...segments, text];
}

function extractDeadline(text: string): DeadlineResult {
  const now = dayjs();

  for (const segment of candidateSegments(text)) {
    const datePart = parseDateFromSegment(segment);
    const timePart = extractTime(segment);

    if (datePart.detected || timePart.detected) {
      let base = datePart.date || now;
      base = base.hour(timePart.hour).minute(timePart.minute).second(0).millisecond(0);

      if (!datePart.detected && timePart.detected && base.isBefore(now)) {
        base = base.add(1, 'day');
      }

      return { value: base.toISOString(), detected: true };
    }
  }

  return {
    value: now.add(7, 'day').hour(23).minute(59).second(0).millisecond(0).toISOString(),
    detected: false,
  };
}

function cleanLocation(value: string): string {
  return value
    .replace(/^(在|于|前往|到|地点|位置|活动地点|会议地点|上课地点|比赛地点|签到地点)[:：\s]*/g, '')
    .replace(/(参加|举行|开展|进行|开|完成|提交|报名|签到).*/g, '')
    .replace(/[，,。；;：:\s]+$/g, '')
    .trim();
}

function extractLocation(text: string): string {
  const explicit = text.match(/(?:活动地点|会议地点|上课地点|比赛地点|签到地点|地点|位置|地址)[:：\s]*([^，,。；;\n]{2,42})/);
  if (explicit?.[1]) return cleanLocation(explicit[1]);

  const online = text.match(/腾讯会议|飞书会议|钉钉会议|线上|线下/);
  if (online?.[0]) return online[0];

  const context = text.match(new RegExp(`(?:在|于|前往|到)\\s*([^，,。；;\\n]{0,24}${LOCATION_ENTITY_PATTERN}[^，,。；;\\n]{0,18})`));
  if (context?.[1]) return cleanLocation(context[1]);

  const entity = text.match(new RegExp(`((?:大学城校区|[\\u4e00-\\u9fa5]{0,8})?${LOCATION_ENTITY_PATTERN}[A-Za-z0-9\\u4e00-\\u9fa5-]{0,16})`));
  if (entity?.[1]) return cleanLocation(entity[1]);

  return '';
}

function detectCategory(text: string): string {
  const rules: Array<[string, RegExp]> = [
    ['考试', /考试|测验|期中|期末|补考|考核/],
    ['课程', /高数|线代|英语|体育|程序设计|数据结构|数据库|大学物理|马原|思修/],
    ['学习', /作业|课程|上课|论文|预习|复习|实验|考试|测验|课堂|课程报告|讲座/],
    ['比赛', /比赛|竞赛|大赛|初赛|复赛|决赛|报名/],
    ['工作', /值班|工作|会议|汇报|材料|表格|统计|收集/],
    ['社团', /社团|学生会|部门|团委|班委|志愿|志愿者|班会/],
    ['生活', /宿舍|体检|缴费|领取|快递|饭卡|校园卡|卫生/],
  ];

  return rules.find(([, pattern]) => pattern.test(text))?.[0] || '学习';
}

function detectPriority(text: string, deadline: string): Priority {
  const hours = dayjs(deadline).diff(dayjs(), 'hour', true);
  if (HIGH_PRIORITY.test(text) || hours < 24) return '高' as Priority;
  if (LOW_PRIORITY.test(text) && hours >= 72) return '低' as Priority;
  if (MEDIUM_PRIORITY.test(text) || hours < 72) return '中' as Priority;
  return '中' as Priority;
}

function buildDescription(text: string): string {
  const cleaned = cleanText(text);
  if (cleaned.length <= 160) return cleaned;
  return `${cleaned.slice(0, 156).replace(/[，,。；;：:\s]+$/g, '')}...`;
}

function getConfidence(title: string, deadlineDetected: boolean, location: string): Confidence {
  if (title && deadlineDetected && location) return 'high';
  if (title && deadlineDetected) return 'medium';
  return 'low';
}

function confidenceRank(confidence: Confidence): number {
  return confidence === 'high' ? 3 : confidence === 'medium' ? 2 : 1;
}

function splitPotentialTasks(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 4);

  const usefulLines = lines.filter((line) => (
    TITLE_KEYWORDS.some((keyword) => line.includes(keyword)) ||
    /截止|提交|完成|报名|时间|今天|今晚|明天|后天|周[一二三四五六日天]|星期[一二三四五六日天]|\d{1,2}月\d{1,2}|\d{1,2}[:：]\d{2}/.test(line)
  ));

  return usefulLines.length > 1 ? usefulLines : [text];
}

export function parseDDLTextLocally(text: string): ParsedResult {
  const originalText = text || '';
  const cleaned = cleanText(originalText);
  const segments = splitPotentialTasks(cleaned);
  const parsedDDLs = segments.map((segment) => {
    const deadline = extractDeadline(segment);
    const location = extractLocation(segment) || extractLocation(cleaned);
    const title = extractTitle(segment);
    return {
      ddl: {
        title: title || '未命名任务',
        deadline: deadline.value,
        priority: detectPriority(segment, deadline.value),
        description: buildDescription(segment),
        originalText,
        location,
      },
      title,
      deadlineDetected: deadline.detected,
      location,
    };
  });

  const first = parsedDDLs[0];
  const category = detectCategory(cleaned);
  const confidence = parsedDDLs
    .map((item) => getConfidence(item.title, item.deadlineDetected, item.location))
    .sort((a, b) => confidenceRank(a) - confidenceRank(b))[0] || 'low';

  const result: ParsedResult = {
    projectName: first?.title || '未命名项目',
    category,
    ddls: parsedDDLs.map((item) => item.ddl),
    originalText,
    parseMode: 'fallback',
    confidence,
  };

  console.info('[DDL Flow fallback parser]', {
    confidence,
    count: result.ddls.length,
    titles: result.ddls.map((ddl) => ddl.title),
  });
  return result;
}

export const COMPLEXITY = { Routine: 1, Standard: 2, Complex: 3, Strategic: 5 };
export const STATUSES = ['Not started', 'In progress', 'In review', 'Approved'];
export const DEFAULT_WEIGHTS = { completion: 50, timeliness: 30, quality: 20 };
export function localDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function isOverdue(task, today = localDate()) {
  return task.status !== 'Approved' && task.due < today;
}
export function kpi(tasks, personId, month, weights = DEFAULT_WEIGHTS) {
  const assigned = tasks.filter(t => t.owner === personId && t.due.slice(0, 7) === month);
  const points = t => COMPLEXITY[t.complexity];
  const total = assigned.reduce((sum, t) => sum + points(t), 0);
  const approved = assigned.filter(t => t.status === 'Approved');
  const earned = approved.reduce((sum, t) => sum + points(t), 0);
  const onTime = approved.filter(t => t.completedAt && t.completedAt <= t.due).reduce((sum, t) => sum + points(t), 0);
  const qualityPoints = approved.reduce((sum, t) => sum + points(t) * t.quality / 5, 0);
  const completion = total ? earned / total * 100 : null;
  const timeliness = total ? onTime / total * 100 : null;
  const quality = total ? qualityPoints / total * 100 : null;
  const score = total ? (completion * weights.completion + timeliness * weights.timeliness + quality * weights.quality) / 100 : null;
  return { assigned: assigned.length, approved: approved.length, total, earned, completion, timeliness, quality, score };
}
export function validWeights(weights) {
  return weights && ['completion', 'timeliness', 'quality'].every(k => Number.isFinite(weights[k]) && weights[k] >= 0 && weights[k] <= 100) && weights.completion + weights.timeliness + weights.quality === 100;
}
export function validDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
}
export function validateData(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.people) || !Array.isArray(data.tasks) || !validWeights(data.weights)) throw new Error('This file is not a valid Taskmanag backup.');
  if (!data.people.length || data.people.length > 200 || data.tasks.length > 5000) throw new Error('Backup must contain 1–200 team members and up to 5,000 tasks.');
  const ids = new Set();
  const text = (s, max = 10000) => typeof s === 'string' && s.length <= max;
  for (const p of data.people) {
    if (!text(p.id, 100) || !p.id || ids.has(p.id) || !text(p.name, 100) || !p.name.trim() || !text(p.role, 150) || !['Textile', 'Silk', 'Leather', 'Strategy'].includes(p.sector)) throw new Error('Invalid team member in backup.');
    ids.add(p.id);
  }
  const taskIds = new Set(data.tasks.map(t => t.id));
  if (taskIds.size !== data.tasks.length) throw new Error('Duplicate task IDs in backup.');
  for (const t of data.tasks) {
    if (!text(t.id, 100) || !t.id || !text(t.title, 200) || !t.title.trim() || !text(t.description) || !text(t.evidence) || !ids.has(t.owner) || !STATUSES.includes(t.status) || !Object.hasOwn(COMPLEXITY, t.complexity) || !['Normal', 'High', 'Urgent'].includes(t.priority) || !['Textile', 'Silk', 'Leather', 'Strategy'].includes(t.sector) || !validDate(t.due) || !Number.isFinite(t.progress) || t.progress < 0 || t.progress > 100 || !Number.isInteger(t.quality) || t.quality < 1 || t.quality > 5 || !Array.isArray(t.checklist) || !Array.isArray(t.comments) || !Array.isArray(t.dependencies)) throw new Error('Invalid task in backup.');
    if (t.status === 'Approved' && (!validDate(t.completedAt) || t.progress !== 100)) throw new Error('Approved tasks must have a completion date and 100% progress.');
    if (t.completedAt !== null && !validDate(t.completedAt)) throw new Error('Invalid completion date.');
    if (t.checklist.some(c => !text(c.label, 500) || typeof c.done !== 'boolean') || t.comments.some(c => !text(c.text, 3000) || !text(c.at, 100))) throw new Error('Invalid checklist or update.');
    if (t.dependencies.some(id => !taskIds.has(id) || id === t.id)) throw new Error('Invalid task dependency.');
  }
  const visiting = new Set(), visited = new Set(), map = new Map(data.tasks.map(t => [t.id, t]));
  function visit(id) {
    if (visiting.has(id)) throw new Error('Task dependencies cannot contain a cycle.');
    if (visited.has(id)) return;
    visiting.add(id); map.get(id).dependencies.forEach(visit); visiting.delete(id); visited.add(id);
  }
  data.tasks.forEach(t => visit(t.id));
  return data;
}
export function canApprove(task, tasks) {
  if (!task.evidence.trim()) return 'Add a delivery note or evidence before approval.';
  if (task.checklist.some(c => !c.done)) return 'Complete every checklist item before approval.';
  if (task.dependencies.some(id => tasks.find(t => t.id === id)?.status !== 'Approved')) return 'Approve the prerequisite tasks first.';
  return '';
}
export function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}

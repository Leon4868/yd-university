import type {
  AdminCreatorApplication,
  CourseDraftInput,
  CourseStatus,
  CreatorApplication,
  CreatorApplicationInput,
  CurrentUser,
  ManagedCourse,
  PublicCourseDetail,
  PublicCourseSummary,
  ReviewStatus,
} from "./types.ts";

const rawBaseUrl: string = import.meta.env.VITE_API_BASE_URL ?? "";
const baseUrl = rawBaseUrl.trim().replace(/\/+$/, "");

/** 契约错误形状 { error, message } 映射成带 code 的异常，UI 按 code 分支 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const fallbackMessages: Record<string, string | undefined> = {
  INVALID_REQUEST: "参数校验失败",
  UNAUTHENTICATED: "登录状态无效，请重新登录",
  FORBIDDEN: "当前身份没有权限执行该操作",
  NOT_FOUND: "资源不存在或对当前身份不可见",
  INVALID_STATE_TRANSITION: "当前状态不允许该操作",
};

export function apiErrorMessage(error: unknown, fallback = "请求失败，请稍后重试") {
  return error instanceof ApiError ? error.message : fallback;
}

interface RequestOptions {
  token?: string | null;
  body?: unknown;
  query?: Record<string, string | undefined>;
  signal?: AbortSignal;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function toRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
}

function buildUrl(path: string, query?: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) search.set(key, value);
  }
  const suffix = search.toString();
  return `${baseUrl}${path}${suffix ? `?${suffix}` : ""}`;
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "NETWORK_ERROR", "无法连接后端服务，请确认 API 已启动");
  }
  const payload = await readJson(response);
  const body = toRecord(payload);
  if (!response.ok) {
    const code = typeof body.error === "string" ? body.error : "UNKNOWN_ERROR";
    const message = typeof body.message === "string" && body.message
      ? body.message
      : fallbackMessages[code] ?? `请求失败（HTTP ${response.status}）`;
    throw new ApiError(response.status, code, message);
  }
  if (!("data" in body)) {
    throw new ApiError(response.status, "INVALID_RESPONSE", "接口响应格式不符合契约");
  }
  return body.data as T;
}

// 身份
export function getMe(token: string, signal?: AbortSignal) {
  return request<CurrentUser>("GET", "/api/me", { token, signal });
}

// 创作者申请
export function createCreatorApplication(token: string, input: CreatorApplicationInput) {
  return request<CreatorApplication>("POST", "/api/creators/applications", { token, body: input });
}

export function getMyCreatorApplication(token: string, signal?: AbortSignal) {
  return request<CreatorApplication | null>("GET", "/api/creators/applications/mine", { token, signal });
}

// 管理员：教师/商家审核
export function listAdminCreators(token: string, status: ReviewStatus, signal?: AbortSignal) {
  return request<AdminCreatorApplication[]>("GET", "/api/admin/creators", { token, query: { status }, signal });
}

export function approveCreator(token: string, id: string) {
  return request<AdminCreatorApplication>("POST", `/api/admin/creators/${id}/approve`, { token });
}

export function rejectCreator(token: string, id: string, reason: string) {
  return request<AdminCreatorApplication>("POST", `/api/admin/creators/${id}/reject`, { token, body: { reason } });
}

// 管理员：课程上架审核
export function listAdminCourses(token: string, status: CourseStatus, signal?: AbortSignal) {
  return request<ManagedCourse[]>("GET", "/api/admin/courses", { token, query: { status }, signal });
}

export function publishCourse(token: string, id: string) {
  return request<ManagedCourse>("POST", `/api/admin/courses/${id}/publish`, { token });
}

export function rejectCourse(token: string, id: string, reason: string) {
  return request<ManagedCourse>("POST", `/api/admin/courses/${id}/reject`, { token, body: { reason } });
}

// 教师：我的课程
export function listTeacherCourses(token: string, signal?: AbortSignal) {
  return request<ManagedCourse[]>("GET", "/api/teacher/courses", { token, signal });
}

export function createTeacherCourse(token: string, input: CourseDraftInput) {
  return request<ManagedCourse>("POST", "/api/teacher/courses", { token, body: input });
}

export function submitTeacherCourse(token: string, id: string) {
  return request<ManagedCourse>("POST", `/api/teacher/courses/${id}/submit`, { token });
}

// 公开课程
export function listPublishedCourses(signal?: AbortSignal) {
  return request<PublicCourseSummary[]>("GET", "/api/courses", { signal });
}

export function getPublishedCourse(slug: string, signal?: AbortSignal) {
  return request<PublicCourseDetail>("GET", `/api/courses/${slug}`, { signal });
}

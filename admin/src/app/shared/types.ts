/**
 * Shared types for the application
 */

export interface User {
  guid: number;
  name: string;
  email: string;
  username: string;
  role: Role | null;
  permissions: string[];
  locale?: string | null;
}

export interface Role {
  guid: number;
  name: string;
  is_admin: number;
}

export interface Permission {
  guid: number;
  name: string;
  description?: string;
}

export interface LibraryItem {
  guid: number;
  name: string;
  type: 'text' | 'image' | 'url';
  content: string | Array<{ page: number; content: string }>;
  description?: string;
  modified?: string;
  author?: string;
}

export interface Playlist {
  guid: number;
  name: string;
  description?: string;
  updated?: string;
  items: PlaylistItem[];
}

export interface PlaylistItem {
  guid: number;
  page?: number;
  pages?: number[];
  description?: string;
  name?: string;
  type?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  status?: number;
  stack?: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}


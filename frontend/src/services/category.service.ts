import api from '../config/api';
import type { ApiResponse, Category } from '../types';

export const categoryService = {
  list: () => api.get<ApiResponse<{ items: Category[] }>>('/categories').then((r) => r.data),
  getById: (id: string) => api.get<ApiResponse<Category>>(`/categories/${id}`).then((r) => r.data),

  create: (data: { name: string; description?: string | null }) =>
    api
      .post<ApiResponse<Category>>('/categories', data)
      .then((r) => r.data),

  update: (id: string, data: { name?: string; description?: string | null }) =>
    api
      .put<ApiResponse<Category>>(`/categories/${id}`, data)
      .then((r) => r.data),

  remove: (id: string) =>
    api.delete<ApiResponse>(`/categories/${id}`).then((r) => r.data),
};


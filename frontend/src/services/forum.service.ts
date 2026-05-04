import api from '../config/api';
import type { ApiResponse, ForumListPayload, ForumPostDetail, ForumPostListItem } from '../types';

/** Backend: router.use(auth) — tất cả route cần Bearer token */
export const forumService = {
  listPosts: (params?: { page?: number; limit?: number; user_id?: string }) =>
    api.get<ApiResponse<ForumListPayload>>('/forum/posts', { params }).then((r) => r.data),

  getPost: (postId: string) =>
    api.get<ApiResponse<ForumPostDetail>>(`/forum/posts/${postId}`).then((r) => r.data),

  createPost: (body: { title: string; content: string }) =>
    api.post<ApiResponse<ForumPostListItem>>('/forum/posts', body).then((r) => r.data),

  updatePost: (postId: string, body: { title?: string; content?: string }) =>
    api.put<ApiResponse<ForumPostListItem>>(`/forum/posts/${postId}`, body).then((r) => r.data),

  deletePost: (postId: string) => api.delete<ApiResponse<null>>(`/forum/posts/${postId}`).then((r) => r.data),

  addComment: (postId: string, body: { content: string }) =>
    api.post<ApiResponse<unknown>>(`/forum/posts/${postId}/comments`, body).then((r) => r.data),

  updateComment: (commentId: string, body: { content: string }) =>
    api.put<ApiResponse<unknown>>(`/forum/comments/${commentId}`, body).then((r) => r.data),

  deleteComment: (commentId: string) =>
    api.delete<ApiResponse<null>>(`/forum/comments/${commentId}`).then((r) => r.data),

  likePost: (postId: string) =>
    api.post<ApiResponse<unknown>>(`/forum/posts/${postId}/likes`).then((r) => r.data),

  unlikePost: (postId: string) =>
    api.delete<ApiResponse<null>>(`/forum/posts/${postId}/likes`).then((r) => r.data),
};

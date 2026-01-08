export interface IBlog {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  coverImage?: string;
  category: string;
  status: string;
  views: number;
  likesCount: number;
  hostId: string;
  tourId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBlogInput {
  title: string;
  content: string;
  excerpt?: string;
  coverImage?: string;
  category: string;
  tourId?: string;
}

export interface UpdateBlogInput {
  title?: string;
  content?: string;
  excerpt?: string;
  coverImage?: string;
  category?: string;
  status?: string;
  tourId?: string;
}

export interface BlogCommentInput {
  content: string;
  parentId?: string;
}

export interface UpdateCommentInput {
  content: string;
}
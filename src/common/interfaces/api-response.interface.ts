export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
    timestamp: string;
  }
  
  export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }
// src/services/api/types.ts

export interface ApiResponse {
    success: boolean;
    data: any;
    message: string;
    token?: string;
  }
  
  export interface ApiError {
    message: string;
    code?: string;
    status?: number;
  }
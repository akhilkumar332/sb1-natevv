// src/services/api/baseApi.ts

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { API_CONFIG } from './config';
import { ApiResponse, ApiError } from './types';
import { captureHandledError } from '../errorLog.service';

export class BaseApiClient {
  protected client: AxiosInstance;

  constructor(config?: AxiosRequestConfig) {
    this.client = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      headers: API_CONFIG.HEADERS.DEFAULT,
      ...config,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      this.handleError
    );
  }

  protected handleError(error: any): never {
    if (axios.isAxiosError(error)) {
      void captureHandledError(error, {
        source: 'frontend',
        scope: 'unknown',
        metadata: {
          kind: 'api.client.error',
          status: error.response?.status,
          code: error.response?.data?.code,
          message: error.message,
          responseMessage: error.response?.data?.message,
          requestUrl: error.config?.url,
          method: error.config?.method,
        },
      });

      const apiError: ApiError = {
        message: error.response?.data?.message || error.message,
        status: error.response?.status,
        code: error.response?.data?.code,
      };
      throw apiError;
    }
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'unknown',
      metadata: { kind: 'api.client.unexpected_error' },
    });
    throw new Error('An unexpected error occurred');
  }

  protected async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.get(url, config);
    return response.data;
  }

  protected async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.post(url, data, config);
    return response.data;
  }

  protected async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.put(url, data, config);
    return response.data;
  }

  protected async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.delete(url, config);
    return response.data;
  }
}

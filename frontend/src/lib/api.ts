import { Conversation, Message, Summary } from '../types';

// API service that tries backend first, then falls back to mock
class ApiService {
  private baseUrl = (import.meta.env.VITE_API_URL) + '/api';

  private getToken() {
    return localStorage.getItem('token') || localStorage.getItem('guestToken');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        // If backend is not available, throw fallback error
        if (response.status === 404 || response.status >= 500) {
          throw new Error('API_FALLBACK');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // Network errors or CORS issues indicate backend unavailable
      if (error instanceof TypeError || (error as any).name === 'NetworkError') {
        throw new Error('API_FALLBACK');
      }
      throw error;
    }
  }

  // Conversations
  async getConversations(): Promise<any> {
    try {
      return await this.request('/conversations');
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        const { mockApi } = await import('../lib/mockApi');
        return await mockApi.getConversations();
      }
      throw error;
    }
  }

  async getConversation(id: string): Promise<any> {
    try {
      return await this.request(`/conversations/${id}`);
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        const { mockApi } = await import('../lib/mockApi');
        return await mockApi.getConversation(id);
      }
      throw error;
    }
  }

  async getMessages(conversationId: string): Promise<any> {
    try {
      return await this.request(`/conversations/${conversationId}/messages`);
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        const { mockApi } = await import('../lib/mockApi');
        const mockResult = await mockApi.getConversation(conversationId);
        return mockResult.data.messages;
      }
      throw error;
    }
  }

  async startConversation(data: { useMemory: boolean; title: string }): Promise<{ data: { conversation: Conversation } }> {
    try {
      return await this.request('/conversations/start', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        const { mockApi } = await import('../lib/mockApi');
        return await mockApi.createConversation(data);
      }
      throw error;
    }
  }

  async sendMessage(conversationId: string, content: string): Promise<{ data: { userMessage: Message; assistantMessage: Message } }> {
    console.log('🌐 API Service: Sending message to conversation:', conversationId);
    try {
      console.log('🌐 API Service: Trying backend API for sendMessage...');
      const result = await this.request<{ data: { userMessage: Message; assistantMessage: Message } }>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, role: 'user' }),
      });
      console.log('🌐 API Service: Backend sendMessage succeeded:', result);
      return result;
    } catch (error) {
      console.log('🌐 API Service: Backend sendMessage failed:', error.message);
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        console.log('🌐 API Service: Falling back to mock API for sendMessage...');
        const { mockApi } = await import('../lib/mockApi');
        const mockResult = await mockApi.sendMessage(conversationId, content);
        console.log('🌐 API Service: Mock sendMessage result:', mockResult);
        return mockResult;
      }
      console.error('🌐 API Service: Non-fallback sendMessage error:', error);
      throw error;
    }
  }

  // Sub-chats
  async createSubChat(data: { conversationId: string; parentMessageId: string; contextMessage: string; title?: string }): Promise<{ data: { id: string } }> {
    return this.request('/subchats', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendSubChatMessage(subChatId: string, content: string): Promise<{ data: { userMessage: Message; assistantMessage: Message } }> {
    return this.request(`/subchats/${subChatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, role: 'user' }),
    });
  }

  async mergeSubChat(subChatId: string): Promise<{ data: { summary: { summary: string; fullSummary?: string }; injectedMessage: { id: string } } }> {
    return this.request(`/subchats/${subChatId}/merge`, {
      method: 'POST',
    });
  }

  // Memory
  async listMemories(): Promise<{ data: Summary[] }> {
    return this.request('/memory/list');
  }

  async retrieveMemories(query: string): Promise<{ data: Summary[] }> {
    return this.request('/memory/retrieve', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  // Authentication
  async register(email: string, password: string, name?: string): Promise<{ success: boolean; data: { token: string; user: any } }> {
    try {
      return await this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        const { mockAuth } = await import('../lib/mockApi');
        return await mockAuth.register(email, password, name);
      }
      throw error;
    }
  }

  async login(email: string, password: string): Promise<{ success: boolean; data: { token: string; user: any } }> {
    try {
      return await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        const { mockAuth } = await import('../lib/mockApi');
        return await mockAuth.login(email, password);
      }
      throw error;
    }
  }

  async createGuestToken(): Promise<{ success: boolean; data: { token: string; user: any } }> {
    try {
      return await this.request('/auth/guest', {
        method: 'POST',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        const { mockAuth } = await import('../lib/mockApi');
        return await mockAuth.createGuestToken();
      }
      throw error;
    }
  }

  async getCurrentUser(): Promise<{ success: boolean; data: any }> {
    try {
      return await this.request('/auth/me');
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        const { mockAuth } = await import('../lib/mockApi');
        return await mockAuth.getCurrentUser();
      }
      throw error;
    }
  }

  async logout(): Promise<{ success: boolean }> {
    try {
      return await this.request('/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        // For mock API, just return success
        return { success: true };
      }
      throw error;
    }
  }

  // AI Search
  async searchQuery(query: string): Promise<{ response: string; query: string; timestamp: string }> {
    try {
      // Ensure we have a token for the search request
      let token = this.getToken();

      // If no token, try to get a guest token
      if (!token) {
        try {
          const guestResponse = await this.createGuestToken();
          token = guestResponse.data.token;
          localStorage.setItem('token', token);
        } catch (guestError) {
          console.warn('Failed to create guest token:', guestError);
        }
      }

      return await this.request('/ai/search', {
        method: 'POST',
        body: JSON.stringify({ query }),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'API_FALLBACK') {
        // Fallback to mock response
        return {
          response: `This is a mock response to your query: "${query}". The backend AI service is not available, but in a real implementation, this would provide intelligent answers using Gemini AI.`,
          query,
          timestamp: new Date().toISOString()
        };
      }
      throw error;
    }
  }
}

export const apiService = new ApiService();
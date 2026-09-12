import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { environment } from '../../environments/environment';

export type HabitAttribute =
  | 'Strength'
  | 'Constitution'
  | 'Dexterity'
  | 'Intelligence'
  | 'Willpower'
  | 'Charisma';

export type HabitType = 'positive' | 'negative';

export interface HabitRecord {
  id?: string;
  user_id?: string;
  title: string;
  description?: string | null;
  habit_type: HabitType;
  attribute: HabitAttribute;
  target_per_week: number;
  xp_per_completion: number;
  bonus_xp_for_full_week: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface HabitCompletionRecord {
  id?: string;
  user_id?: string;
  habit_id: string;
  completed_at?: string;
  quantity: number;
  xp_delta: number;
  notes?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private client: SupabaseClient | null = null;
  private readonly devSessionKey = 'level-headed-dev-session';
  private readonly devPasswordKeyPrefix = 'level-headed-dev-password:';

  isConfigured(): boolean {
    const { supabaseUrl, supabaseAnonKey } = environment;
    return Boolean(
      supabaseUrl &&
      supabaseAnonKey &&
      !supabaseUrl.includes('your-project') &&
      !supabaseAnonKey.includes('your-anon-key'),
    );
  }

  isLocalDevelopmentMode(): boolean {
    return !environment.production;
  }

  getStoredDevSession(): {
    id: string;
    email: string;
    user_metadata?: { full_name?: string };
  } | null {
    try {
      const raw = localStorage.getItem(this.devSessionKey);
      return raw ? (JSON.parse(raw) as any) : null;
    } catch {
      return null;
    }
  }

  setStoredDevSession(email: string, fullName?: string) {
    const session = {
      id: 'local-dev-user',
      email,
      user_metadata: {
        full_name: fullName ?? email.split('@')[0] ?? 'Local Hero',
      },
    };

    localStorage.setItem(this.devSessionKey, JSON.stringify(session));
    return session;
  }

  isDevSessionActive(): boolean {
    return this.isLocalDevelopmentMode() && Boolean(this.getStoredDevSession());
  }

  loginWithDevBypass(email: string, fullName?: string) {
    if (environment.production) {
      return {
        data: null,
        error: { message: 'Development bypass is disabled in production.' },
      };
    }

    const session = this.setStoredDevSession(email, fullName);
    return {
      data: {
        user: {
          id: session.id,
          email: session.email,
          user_metadata: session.user_metadata,
        },
      },
      error: null,
    };
  }

  setDevPassword(email: string, password: string) {
    if (!this.isLocalDevelopmentMode()) {
      return;
    }

    localStorage.setItem(`${this.devPasswordKeyPrefix}${email}`, password);
  }

  getStoredDevPassword(email: string): string | null {
    if (!this.isLocalDevelopmentMode()) {
      return null;
    }

    return localStorage.getItem(`${this.devPasswordKeyPrefix}${email}`) ?? null;
  }

  getClient(): SupabaseClient {
    if (!this.isConfigured()) {
      throw new Error(
        'Supabase is not configured. Add your project URL and anon key to src/environments/environment.ts.',
      );
    }

    if (!this.client) {
      this.client = createClient(
        environment.supabaseUrl,
        environment.supabaseAnonKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        },
      );
    }

    return this.client;
  }

  async signUpWithEmail(email: string, password: string, fullName?: string) {
    if (this.isLocalDevelopmentMode()) {
      this.setDevPassword(email, password);
      this.setStoredDevSession(email, fullName);
      return {
        data: {
          user: {
            id: 'local-dev-user',
            email,
            user_metadata: {
              full_name: fullName ?? email.split('@')[0] ?? 'Local Hero',
            },
          },
        },
        error: null,
      };
    }

    return this.getClient().auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName ?? '',
        },
      },
    });
  }

  async signInWithEmail(email: string, password: string) {
    if (this.isLocalDevelopmentMode()) {
      const activeSession = this.getStoredDevSession();
      const savedPassword = this.getStoredDevPassword(email);

      if (savedPassword === password || activeSession?.email === email) {
        const session = this.setStoredDevSession(
          email,
          activeSession?.user_metadata?.full_name,
        );

        return {
          data: {
            user: {
              id: session.id,
              email: session.email,
              user_metadata: session.user_metadata,
            },
          },
          error: null,
        };
      }

      if (password === 'local-dev-bypass') {
        return this.loginWithDevBypass(email, 'Local Hero');
      }

      return {
        data: { user: null },
        error: {
          message:
            'Development mode is active. Use your local saved password or create a local account.',
        },
      };
    }

    return this.getClient().auth.signInWithPassword({ email, password });
  }

  async signOut() {
    if (this.isLocalDevelopmentMode()) {
      localStorage.removeItem(this.devSessionKey);
      return { error: null };
    }

    return this.getClient().auth.signOut();
  }

  async resetPasswordForEmail(email: string) {
    if (this.isLocalDevelopmentMode()) {
      this.setStoredDevSession(email, email.split('@')[0] ?? 'Local Hero');
      return {
        data: { user: { email } },
        error: null,
      };
    }

    return this.getClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
  }

  async deleteCurrentAccount() {
    return this.getClient().rpc('delete_current_user');
  }

  async getCurrentUserId(): Promise<string | null> {
    if (this.isLocalDevelopmentMode()) {
      const session = this.getStoredDevSession();
      return session?.id ?? null;
    }

    const { data } = await this.getClient().auth.getUser();
    return data.user?.id ?? null;
  }

  async getHabits() {
    if (this.isLocalDevelopmentMode() && this.isDevSessionActive()) {
      return {
        data: [],
        error: null,
      };
    }

    return this.getClient()
      .from('habits')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
  }

  async upsertHabit(habit: HabitRecord) {
    const userId = habit.user_id ?? (await this.getCurrentUserId());
    if (!userId) {
      throw new Error('You must be signed in to save habits.');
    }

    return this.getClient()
      .from('habits')
      .upsert({ ...habit, user_id: userId }, { onConflict: 'id' });
  }

  async deleteHabit(id: string) {
    return this.getClient()
      .from('habits')
      .update({ is_active: false })
      .eq('id', id);
  }

  async logCompletion(completion: HabitCompletionRecord) {
    const userId = completion.user_id ?? (await this.getCurrentUserId());
    if (!userId) {
      throw new Error('You must be signed in to log a completion.');
    }

    return this.getClient()
      .from('habit_completions')
      .insert({ ...completion, user_id: userId });
  }

  async getCompletionHistory(habitId: string) {
    return this.getClient()
      .from('habit_completions')
      .select('*')
      .eq('habit_id', habitId)
      .order('completed_at', { ascending: false });
  }
}

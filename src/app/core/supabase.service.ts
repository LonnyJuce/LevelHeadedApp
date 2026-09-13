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
  private readonly devHabitsKey = 'level-headed-dev-habits';
  private readonly devCompletionKey = 'level-headed-dev-completions';

  private getStableDevUserId(email: string): string {
    const normalized = email.trim().toLowerCase();
    let hash = 0;

    for (let index = 0; index < normalized.length; index += 1) {
      hash = (hash << 5) - hash + normalized.charCodeAt(index);
      hash |= 0;
    }

    const numeric = Math.abs(hash).toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${numeric.slice(0, 12)}`;
  }

  private readDevStore<T>(key: string): T[] {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
      return [];
    }
  }

  private writeDevStore<T>(key: string, items: T[]): void {
    localStorage.setItem(key, JSON.stringify(items));
  }

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
      id: this.getStableDevUserId(email),
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

  getDevSessionSnapshot(): {
    user: {
      email: string;
      user_metadata?: { full_name?: string };
    };
  } | null {
    const session = this.getStoredDevSession();
    if (!this.isLocalDevelopmentMode() || !session) {
      return null;
    }

    return {
      user: {
        email: session.email,
        user_metadata: session.user_metadata ?? {},
      },
    };
  }

  async getSession(): Promise<{ data: { session: any | null } }> {
    if (this.isLocalDevelopmentMode() && this.isDevSessionActive()) {
      return {
        data: { session: this.getDevSessionSnapshot() },
      };
    }

    return this.getClient().auth.getSession();
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
      const session = this.setStoredDevSession(email, fullName);
      return {
        data: {
          user: {
            id: session.id,
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

  async getHabits(includeInactive = false) {
    if (this.isLocalDevelopmentMode() && this.isDevSessionActive()) {
      const userId = await this.getCurrentUserId();
      const habits = this.readDevStore<HabitRecord>(this.devHabitsKey).filter(
        (habit) => habit.user_id === userId,
      );

      return {
        data: includeInactive
          ? habits
          : habits.filter((habit) => habit.is_active !== false),
        error: null,
      };
    }

    const query = this.getClient()
      .from('habits')
      .select('*')
      .order('created_at', { ascending: false });

    return includeInactive ? query : query.eq('is_active', true);
  }

  async upsertHabit(habit: HabitRecord) {
    if (this.isLocalDevelopmentMode() && this.isDevSessionActive()) {
      const userId = habit.user_id ?? (await this.getCurrentUserId());
      if (!userId) {
        throw new Error('You must be signed in to save habits.');
      }

      const habits = this.readDevStore<HabitRecord>(this.devHabitsKey);
      const existingIndex = habits.findIndex((item) => item.id === habit.id);
      const record: HabitRecord = {
        ...habit,
        id: habit.id ?? crypto.randomUUID(),
        user_id: userId,
        created_at: habit.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: habit.is_active ?? true,
      };

      if (existingIndex >= 0) {
        habits[existingIndex] = record;
      } else {
        habits.unshift(record);
      }

      this.writeDevStore(this.devHabitsKey, habits);
      return { data: record, error: null };
    }

    const userId = habit.user_id ?? (await this.getCurrentUserId());
    if (!userId) {
      throw new Error('You must be signed in to save habits.');
    }

    return this.getClient()
      .from('habits')
      .upsert({ ...habit, user_id: userId }, { onConflict: 'id' });
  }

  async deleteHabit(id: string) {
    if (this.isLocalDevelopmentMode() && this.isDevSessionActive()) {
      const habits = this.readDevStore<HabitRecord>(this.devHabitsKey).map(
        (habit) =>
          habit.id === id
            ? {
                ...habit,
                is_active: false,
                updated_at: new Date().toISOString(),
              }
            : habit,
      );
      this.writeDevStore(this.devHabitsKey, habits);
      return { data: null, error: null };
    }

    return this.getClient()
      .from('habits')
      .update({ is_active: false })
      .eq('id', id);
  }

  async logCompletion(completion: HabitCompletionRecord) {
    if (this.isLocalDevelopmentMode() && this.isDevSessionActive()) {
      const userId = completion.user_id ?? (await this.getCurrentUserId());
      if (!userId) {
        throw new Error('You must be signed in to log a completion.');
      }

      const entry: HabitCompletionRecord = {
        ...completion,
        id: completion.id ?? crypto.randomUUID(),
        user_id: userId,
        completed_at: completion.completed_at ?? new Date().toISOString(),
      };

      const completions = this.readDevStore<HabitCompletionRecord>(
        this.devCompletionKey,
      );
      completions.unshift(entry);
      this.writeDevStore(this.devCompletionKey, completions);

      return { data: entry, error: null };
    }

    const userId = completion.user_id ?? (await this.getCurrentUserId());
    if (!userId) {
      throw new Error('You must be signed in to log a completion.');
    }

    return this.getClient()
      .from('habit_completions')
      .insert({ ...completion, user_id: userId });
  }

  async getCompletionHistory(habitId: string) {
    if (this.isLocalDevelopmentMode() && this.isDevSessionActive()) {
      const userId = await this.getCurrentUserId();
      const completions = this.readDevStore<HabitCompletionRecord>(
        this.devCompletionKey,
      ).filter(
        (entry) => entry.habit_id === habitId && entry.user_id === userId,
      );

      return {
        data: completions,
        error: null,
      };
    }

    return this.getClient()
      .from('habit_completions')
      .select('*')
      .eq('habit_id', habitId)
      .order('completed_at', { ascending: false });
  }
}

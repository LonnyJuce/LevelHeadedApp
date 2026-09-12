import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { SupabaseService } from './core/supabase.service';

export const authGuard: CanActivateFn = async (): Promise<
  boolean | UrlTree
> => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  try {
    if (supabase.isLocalDevelopmentMode() && supabase.isDevSessionActive()) {
      return true;
    }

    const { data } = await supabase.getClient().auth.getSession();
    return data.session ? true : router.createUrlTree(['/login']);
  } catch {
    return router.createUrlTree(['/login']);
  }
};

export const guestGuard: CanActivateFn = async (): Promise<
  boolean | UrlTree
> => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  try {
    if (supabase.isLocalDevelopmentMode() && supabase.isDevSessionActive()) {
      return router.createUrlTree(['/dashboard']);
    }

    const { data } = await supabase.getClient().auth.getSession();
    return data.session ? router.createUrlTree(['/dashboard']) : true;
  } catch {
    return true;
  }
};

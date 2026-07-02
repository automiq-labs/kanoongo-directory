export interface OnboardingState {
  found: boolean;
  member_id: string | null;
  full_name: string | null;
  full_name_en: string | null;
  profile_complete: boolean;
  seen_count: number;
  show_tour: boolean;
}

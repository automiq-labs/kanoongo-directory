export interface Family {
  id: string;
  auth_user_id: string | null;
  head_member_id: string | null;
  family_label: string | null;
  status: "active" | "pending" | "archived";
}

export interface Member {
  member_id: string;
  family_id: string;
  full_name: string;
  full_name_en: string | null;
  gender: string | null;
  is_deceased: boolean;
  father_member_id: string | null;
  education: string | null;
  education_en: string | null;
  occupation: string | null;
  occupation_en: string | null;
  dob: string | null;
  date_of_death: string | null;
  mobile_1: string | null;
  mobile_2: string | null;
  email: string | null;
  addr_line1: string | null;
  addr_line1_en: string | null;
  addr_line2: string | null;
  addr_line2_en: string | null;
  city: string | null;
  city_en: string | null;
  pincode: string | null;
  gotra: string | null;
  gotra_en: string | null;
  marital_status: string | null;
  husband_name: string | null;
  husband_name_en: string | null;
  origin: string | null;
  state: string | null;
  state_en: string | null;
  country: string | null;
  country_en: string | null;
  sort_seq: number | null;
  review_flags: string | null;
  photo_url: string | null;
  notes: string | null;
  notes_en: string | null;
  edit_blocked: boolean;
}

export interface SpouseRelative {
  relative_id: string;
  relation_code: string;
  relation_label: string | null;
  relation_label_en: string | null;
  full_name: string | null;
  full_name_en: string | null;
  addr: string | null;
  addr_en: string | null;
  city: string | null;
  city_en: string | null;
  mobile: string | null;
  occupation: string | null;
  occupation_en: string | null;
  notes: string | null;
  notes_en: string | null;
  source_raw?: string | null;
  sort_seq: number | null;
  removed_at?: string | null;
}

export interface Spouse {
  spouse_id: string;
  member_id: string;
  full_name: string;
  full_name_en: string | null;
  gender: string | null;
  birth_gotra: string | null;
  birth_gotra_en: string | null;
  father_name: string | null;
  father_name_en: string | null;
  education: string | null;
  education_en: string | null;
  dob: string | null;
  date_of_marriage: string | null;
  date_of_death: string | null;
  mobile: string | null;
  email: string | null;
  photo_url: string | null;
  notes: string | null;
  notes_en: string | null;
  relatives?: SpouseRelative[] | null;
}

export interface Child {
  child_id: string;
  parent_member_id: string;
  full_name: string;
  full_name_en: string | null;
  gender: string | null;
  gender_confirmed: boolean | null;
  dob: string | null;
  education: string | null;
  education_en: string | null;
  marital_status: string | null;
  occupation: string | null;
  occupation_en: string | null;
  mobile: string | null;
  email: string | null;
  photo_url: string | null;
  notes: string | null;
  notes_en: string | null;
}

export interface MarriedDaughter {
  md_id: string;
  member_id?: string;
  d_member_id?: string | null;
  relation_label: string | null;
  relation_label_en: string | null;
  full_name: string | null;
  full_name_en: string | null;
  husband_name: string | null;
  husband_name_en: string | null;
  sasur_name: string | null;
  sasur_name_en: string | null;
  addr: string | null;
  addr_en: string | null;
  city: string | null;
  city_en: string | null;
  mobile: string | null;
  husband_mobile: string | null;
  sasur_mobile: string | null;
  email: string | null;
  education: string | null;
  education_en: string | null;
  occupation: string | null;
  occupation_en: string | null;
  dom: string | null;
  children_note: string | null;
  children_note_en: string | null;
  notes: string | null;
  notes_en: string | null;
  sort_seq: number | null;
  needs_review?: boolean | null;
  source_raw?: string | null;
  removed_at?: string | null;
}

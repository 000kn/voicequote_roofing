-- =====================================================
-- TEKLIFPRO SUPABASE SCHEMA & RLS SETUP
-- =====================================================

-- 1. PROFILES TABLOSU
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  firma_adi text default 'Firma Adı',
  firma_tel text default '',
  varsayilan_yetkililer text default '',
  kdv_notu text default 'Fiyatlarımıza KDV dahil değildir. Teklifimiz 15 gün süreyle geçerlidir.',
  logo_url text,
  is_pro boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Kullanıcılar kendi profillerini okuyabilir." 
  on public.profiles for select using (auth.uid() = id);

create policy "Kullanıcılar kendi profillerini güncelleyebilir." 
  on public.profiles for update using (auth.uid() = id);

create policy "Kullanıcılar kendi profillerini ekleyebilir." 
  on public.profiles for insert with check (auth.uid() = id);


-- 2. QUOTES TABLOSU (Teklif Geçmişi & Usta Hafızası)
create table if not exists public.quotes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  tarih text not null,
  musteri_adi text,
  bina_adi text,
  konum text,
  ana_tutar_rakam numeric,
  quote_data jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.quotes enable row level security;

create policy "Kullanıcılar kendi tekliflerini görebilir." 
  on public.quotes for select using (auth.uid() = user_id);

create policy "Kullanıcılar teklif ekleyebilir." 
  on public.quotes for insert with check (auth.uid() = user_id);

create policy "Kullanıcılar teklif silebilir." 
  on public.quotes for delete using (auth.uid() = user_id);


-- 3. STORAGE BUCKET & RLS (logos)
-- Not: Supabase Dashboard üzerinden 'logos' adında public bir bucket oluşturulmalıdır.
-- Aşağıdaki politika kullanıcıların sadece kendi user_id klasörlerine dosya yüklemesini/güncellemesini sağlar:

create policy "Kullanıcılar logolarını kendi klasörüne yükleyebilir."
  on storage.objects for insert
  with check (
    bucket_id = 'logos' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

create policy "Kullanıcılar logolarını güncelleyebilir."
  on storage.objects for update
  using (
    bucket_id = 'logos' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

create policy "Kullanıcılar logolarını silebilir."
  on storage.objects for delete
  using (
    bucket_id = 'logos' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

create policy "Herkes logoları okuyabilir (Public)."
  on storage.objects for select
  using (bucket_id = 'logos');

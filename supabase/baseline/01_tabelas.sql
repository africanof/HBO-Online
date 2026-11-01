-- ============================================================
-- Huambo Online — esquema completo (gerado a partir do projeto antigo)
-- Parte 1: extensões, sequências e tabelas
-- ============================================================
set check_function_bodies = off;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create sequence if not exists public.event_orders_ref_no_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1001 cache 1;
create sequence if not exists public.event_platform_payments_ref_no_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1001 cache 1;
create sequence if not exists public.events_ref_no_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1001 cache 1;
create sequence if not exists public.field_agents_code_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1001 cache 1;
create sequence if not exists public.fuel_orders_ref_no_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1001 cache 1;
create sequence if not exists public.fuel_platform_payments_ref_no_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1001 cache 1;
create sequence if not exists public.fuel_stations_ref_no_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1001 cache 1;
create sequence if not exists public.inspections_ref_no_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1001 cache 1;
create sequence if not exists public.job_queue_id_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 cache 1;
create sequence if not exists public.listing_claims_ref_no_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1001 cache 1;
create sequence if not exists public.promo_boosts_ref_no_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1001 cache 1;
create sequence if not exists public.promo_posts_ref_no_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1001 cache 1;
create sequence if not exists public.venue_orders_ref_no_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1001 cache 1;
create sequence if not exists public.venue_platform_payments_ref_no_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1001 cache 1;
create sequence if not exists public.venues_ref_no_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1001 cache 1;

create table if not exists public.account_capabilities (
  user_id uuid not null,
  capability text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.addresses (
  id uuid default gen_random_uuid() not null,
  street_id uuid,
  house_number text,
  address_label text not null,
  latitude double precision,
  longitude double precision,
  plus_code text,
  reference_point text,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity not null,
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.agent_commissions (
  id uuid default gen_random_uuid() not null,
  agent_id uuid not null,
  listing_id uuid,
  listing_title text not null,
  owner_id uuid,
  amount numeric not null,
  status text default 'pending'::text not null,
  admin_note text,
  created_at timestamp with time zone default now() not null,
  decided_at timestamp with time zone,
  decided_by uuid,
  sale_amount numeric,
  rate_pct numeric
);

create table if not exists public.auction_bids (
  id uuid default gen_random_uuid() not null,
  auction_id uuid not null,
  bidder_id uuid not null,
  amount numeric(14,2) not null,
  created_at timestamp with time zone default now() not null,
  retracted_at timestamp with time zone,
  retracted_by uuid,
  retract_reason text,
  is_auto boolean default false not null
);

create table if not exists public.auction_max_bids (
  id uuid default gen_random_uuid() not null,
  auction_id uuid not null,
  bidder_id uuid not null,
  max_amount numeric not null,
  max_set_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  retracted_at timestamp with time zone,
  retracted_by uuid,
  retract_reason text
);

create table if not exists public.auctions (
  id uuid default gen_random_uuid() not null,
  seller_id uuid not null,
  product_id uuid,
  title text not null,
  description text,
  currency text default 'AOA'::text not null,
  starting_price numeric(14,2) not null,
  reserve_price numeric(14,2),
  min_increment numeric(14,2) default 0 not null,
  current_price numeric(14,2) not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  status text default 'draft'::text not null,
  winner_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  classified_listing_id uuid,
  buy_now_price numeric,
  ending_notified_at timestamp with time zone,
  bought_now boolean default false not null
);

create table if not exists public.businesses (
  id uuid default gen_random_uuid() not null,
  owner_id uuid not null,
  organization_id uuid,
  name text not null,
  description text,
  category_id uuid,
  address_id uuid,
  verified boolean default false not null,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  municipality_id uuid,
  phone text,
  whatsapp text,
  logo_url text,
  address_text text,
  market_id uuid,
  custom_category text,
  directions text,
  geo_lat numeric,
  geo_lng numeric
);

create table if not exists public.cart_items (
  id uuid default gen_random_uuid() not null,
  cart_id uuid not null,
  product_id uuid not null,
  quantity integer not null,
  created_at timestamp with time zone default now() not null,
  ordered_at timestamp with time zone
);

create table if not exists public.carts (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.categories (
  id uuid default gen_random_uuid() not null,
  name text not null,
  slug text not null,
  type text not null,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.classified_listings (
  id uuid default gen_random_uuid() not null,
  owner_id uuid not null,
  category_id uuid,
  address_id uuid,
  listing_type text not null,
  purpose text not null,
  title text not null,
  description text,
  price numeric(14,2),
  currency text default 'AOA'::text not null,
  attributes jsonb default '{}'::jsonb not null,
  media jsonb default '[]'::jsonb not null,
  status text default 'draft'::text not null,
  featured boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  market_id uuid,
  video_url text,
  budget_min numeric,
  budget_max numeric,
  deal_with uuid,
  deal_at timestamp with time zone,
  sale_mode text,
  accepts_trade boolean default false not null,
  trade_wants text,
  ref_no bigint generated by default as identity not null,
  sale_amount numeric,
  featured_until timestamp with time zone,
  agent_id uuid,
  directions text,
  geo_lat numeric,
  geo_lng numeric,
  conformity_accepted_at timestamp with time zone
);

create table if not exists public.classified_saved_searches (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  name text not null,
  filters jsonb default '{}'::jsonb not null,
  active boolean default true not null,
  last_notified_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  notification_frequency text default 'immediate'::text not null,
  notification_quiet_until timestamp with time zone
);

create table if not exists public.communes (
  id uuid default gen_random_uuid() not null,
  municipality_id uuid not null,
  name text not null,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null,
  user_id uuid not null,
  joined_at timestamp with time zone default now() not null,
  last_read_at timestamp with time zone
);

create table if not exists public.conversations (
  id uuid default gen_random_uuid() not null,
  created_by uuid not null,
  subject text,
  context_type text default 'general'::text not null,
  business_id uuid,
  provider_id uuid,
  service_id uuid,
  product_id uuid,
  order_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  classified_listing_id uuid
);

create table if not exists public.couriers (
  user_id uuid not null,
  display_name text not null,
  phone text not null,
  vehicle text default 'moto'::text not null,
  municipality_id uuid,
  status text default 'pending'::text not null,
  available boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.delivery_requests (
  id uuid default gen_random_uuid() not null,
  order_id uuid not null,
  requester_id uuid not null,
  pickup_address_id uuid,
  dropoff_address_id uuid,
  assigned_to uuid,
  status text default 'pending'::text not null,
  notes text,
  requested_at timestamp with time zone default now() not null,
  assigned_at timestamp with time zone,
  delivered_at timestamp with time zone
);

create table if not exists public.event_orders (
  id uuid default gen_random_uuid() not null,
  ref_no bigint default nextval('event_orders_ref_no_seq'::regclass) not null,
  event_id uuid not null,
  ticket_type_id uuid not null,
  buyer_id uuid not null,
  buyer_name text not null,
  buyer_phone text,
  quantity integer not null,
  unit_price numeric not null,
  total numeric not null,
  status text default 'reserved'::text not null,
  method text,
  reference text,
  pay_by timestamp with time zone,
  fee_pct numeric,
  fee_amount numeric default 0 not null,
  note text,
  created_at timestamp with time zone default now() not null,
  submitted_at timestamp with time zone,
  decided_at timestamp with time zone
);

create table if not exists public.event_payment_info (
  event_id uuid not null,
  holder text,
  iban text,
  express text,
  note text,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.event_platform_payments (
  id uuid default gen_random_uuid() not null,
  ref_no bigint default nextval('event_platform_payments_ref_no_seq'::regclass) not null,
  event_id uuid not null,
  organizer_id uuid not null,
  kind text not null,
  amount numeric not null,
  days integer,
  method text not null,
  reference text,
  proof_path text,
  status text default 'pending'::text not null,
  admin_note text,
  created_at timestamp with time zone default now() not null,
  decided_at timestamp with time zone,
  decided_by uuid
);

create table if not exists public.event_ticket_types (
  id uuid default gen_random_uuid() not null,
  event_id uuid not null,
  name text not null,
  price numeric default 0 not null,
  quantity integer not null,
  max_per_order integer default 10 not null,
  active boolean default true not null,
  sort integer default 0 not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.event_tickets (
  id uuid default gen_random_uuid() not null,
  code text not null,
  order_id uuid not null,
  event_id uuid not null,
  ticket_type_id uuid not null,
  holder_id uuid not null,
  status text default 'valid'::text not null,
  checked_in_at timestamp with time zone,
  checked_in_by uuid,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.events (
  id uuid default gen_random_uuid() not null,
  ref_no bigint default nextval('events_ref_no_seq'::regclass) not null,
  organizer_id uuid not null,
  title text not null,
  description text,
  category text default 'other'::text not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone,
  venue text not null,
  municipality_id uuid,
  directions text,
  geo_lat numeric,
  geo_lng numeric,
  cover_url text,
  status text default 'draft'::text not null,
  cancel_reason text,
  featured_until timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.field_agents (
  user_id uuid not null,
  code text default ('AG'::text || nextval('field_agents_code_seq'::regclass)) not null,
  market_id uuid,
  full_name text not null,
  phone text not null,
  note text,
  status text default 'pending'::text not null,
  admin_note text,
  created_at timestamp with time zone default now() not null,
  decided_at timestamp with time zone,
  decided_by uuid
);

create table if not exists public.followed_businesses (
  user_id uuid not null,
  business_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.followed_providers (
  user_id uuid not null,
  provider_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.followed_sellers (
  user_id uuid not null,
  seller_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.fuel_alerts (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  product text not null,
  municipality_id uuid,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.fuel_orders (
  id uuid default gen_random_uuid() not null,
  ref_no bigint default nextval('fuel_orders_ref_no_seq'::regclass) not null,
  station_id uuid not null,
  product_id uuid not null,
  product text not null,
  buyer_id uuid not null,
  buyer_name text not null,
  buyer_phone text,
  plate text,
  quantity numeric not null,
  unit_price numeric not null,
  total numeric not null,
  method text not null,
  status text not null,
  code text,
  hold_until timestamp with time zone,
  pay_by timestamp with time zone,
  pay_method text,
  reference text,
  note text,
  fee_pct numeric,
  fee_amount numeric default 0 not null,
  collected_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  subtotal numeric not null,
  qr_token text default replace((gen_random_uuid())::text, '-'::text, ''::text) not null,
  proof_path text,
  proof_hash text,
  reference_norm text
);

create table if not exists public.fuel_platform_payments (
  id uuid default gen_random_uuid() not null,
  ref_no bigint default nextval('fuel_platform_payments_ref_no_seq'::regclass) not null,
  station_id uuid not null,
  owner_id uuid not null,
  amount numeric not null,
  method text not null,
  reference text,
  proof_path text,
  status text default 'pending'::text not null,
  admin_note text,
  decided_at timestamp with time zone,
  decided_by uuid,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.fuel_products (
  id uuid default gen_random_uuid() not null,
  station_id uuid not null,
  product text not null,
  price numeric,
  status text default 'unknown'::text not null,
  queue text,
  reservable_qty numeric default 0 not null,
  max_per_order numeric default 40 not null,
  note text,
  status_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.fuel_reports (
  id uuid default gen_random_uuid() not null,
  product_id uuid not null,
  user_id uuid not null,
  has boolean not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.fuel_station_pay (
  station_id uuid not null,
  holder text,
  iban text,
  express text,
  note text,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.fuel_stations (
  id uuid default gen_random_uuid() not null,
  ref_no bigint default nextval('fuel_stations_ref_no_seq'::regclass) not null,
  owner_id uuid not null,
  name text not null,
  kind text not null,
  municipality_id uuid,
  address text,
  directions text,
  geo_lat numeric,
  geo_lng numeric,
  phone text,
  whatsapp text,
  opening_hours text,
  accepts_reservations boolean default false not null,
  accepts_prepay boolean default false not null,
  hold_minutes integer default 120 not null,
  status text default 'pending'::text not null,
  admin_note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.inspections (
  id uuid default gen_random_uuid() not null,
  ref_no bigint default nextval('inspections_ref_no_seq'::regclass) not null,
  kind text not null,
  target_id uuid not null,
  owner_id uuid not null,
  status text default 'requested'::text not null,
  address text,
  phone text,
  preferred_time text,
  note text,
  scheduled_for timestamp with time zone,
  inspector_name text,
  checklist jsonb default '{}'::jsonb not null,
  admin_note text,
  inspected_at timestamp with time zone,
  valid_until timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  fee_amount numeric default 0 not null,
  pay_method text,
  pay_reference text,
  pay_proof_path text,
  pay_submitted_at timestamp with time zone,
  paid_at timestamp with time zone
);

create table if not exists public.item_stats_daily (
  kind text not null,
  item_id uuid not null,
  day date not null,
  owner_id uuid not null,
  views integer default 0 not null,
  whatsapp integer default 0 not null,
  calls integer default 0 not null,
  shares integer default 0 not null
);

create table if not exists public.job_queue (
  id bigint default nextval('job_queue_id_seq'::regclass) not null,
  kind text not null,
  ref_id uuid not null,
  created_at timestamp with time zone default now() not null,
  run_after timestamp with time zone default now() not null,
  attempts integer default 0 not null,
  last_error text,
  done_at timestamp with time zone
);

create table if not exists public.listing_boosts (
  id uuid default gen_random_uuid() not null,
  ref_no bigint generated always as identity not null,
  listing_id uuid not null,
  owner_id uuid not null,
  days integer not null,
  amount numeric not null,
  status text default 'pending'::text not null,
  method text,
  reference text,
  proof_path text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  admin_note text,
  created_at timestamp with time zone default now() not null,
  decided_at timestamp with time zone,
  decided_by uuid
);

create table if not exists public.listing_claims (
  id uuid default gen_random_uuid() not null,
  ref_no bigint default nextval('listing_claims_ref_no_seq'::regclass) not null,
  listing_id uuid,
  listing_title text not null,
  buyer_id uuid not null,
  seller_id uuid not null,
  request text not null,
  reason text not null,
  description text not null,
  amount numeric,
  status text default 'open'::text not null,
  outcome text,
  seller_note text,
  admin_note text,
  decided_by_admin boolean default false not null,
  respond_by timestamp with time zone default (now() + '3 days'::interval) not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  resolved_at timestamp with time zone
);

create table if not exists public.listing_commissions (
  id uuid default gen_random_uuid() not null,
  listing_id uuid not null,
  owner_id uuid not null,
  listing_title text not null,
  listed_price numeric,
  sale_amount numeric not null,
  rate_pct numeric not null,
  amount numeric not null,
  source text not null,
  status text default 'due'::text not null,
  due_at timestamp with time zone not null,
  method text,
  reference text,
  proof_path text,
  submitted_at timestamp with time zone,
  admin_note text,
  decided_by uuid,
  decided_at timestamp with time zone,
  last_reminder text,
  created_at timestamp with time zone default now() not null,
  rental_request_id uuid
);

create table if not exists public.listing_offers (
  id uuid default gen_random_uuid() not null,
  listing_id uuid not null,
  buyer_id uuid not null,
  amount numeric,
  trade_item text,
  message text,
  status text default 'pending'::text not null,
  seller_note text,
  created_at timestamp with time zone default now() not null,
  responded_at timestamp with time zone
);

create table if not exists public.markets (
  id uuid default gen_random_uuid() not null,
  name text not null,
  municipality_id uuid,
  address_text text,
  description text,
  opening_hours text,
  photo_url text,
  status text default 'pending'::text not null,
  suggested_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.media_cleanup_queue (
  path text not null,
  due_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  done_at timestamp with time zone
);

create table if not exists public.messages (
  id uuid default gen_random_uuid() not null,
  conversation_id uuid not null,
  sender_id uuid not null,
  body text not null,
  created_at timestamp with time zone default now() not null,
  edited_at timestamp with time zone,
  attachment_kind text,
  attachment_path text,
  attachment_seconds integer
);

create table if not exists public.moderation_reports (
  id uuid default gen_random_uuid() not null,
  reporter_id uuid not null,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  details text,
  status text default 'open'::text not null,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.municipalities (
  id uuid default gen_random_uuid() not null,
  province_id uuid not null,
  name text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.neighborhoods (
  id uuid default gen_random_uuid() not null,
  municipality_id uuid not null,
  name text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.notification_preferences (
  user_id uuid not null,
  enabled boolean default true not null,
  saved_search boolean default true not null,
  messages boolean default true not null,
  rentals boolean default true not null,
  auctions boolean default true not null,
  marketplace boolean default true not null,
  reviews boolean default true not null,
  system boolean default true not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.notifications (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  type text not null,
  title text not null,
  body text not null,
  data jsonb default '{}'::jsonb not null,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.order_dispute_events (
  id uuid default gen_random_uuid() not null,
  dispute_id uuid not null,
  actor_id uuid,
  actor_role text not null,
  action text not null,
  note text,
  photos text[] default '{}'::text[] not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.order_disputes (
  id uuid default gen_random_uuid() not null,
  order_id uuid not null,
  buyer_id uuid not null,
  seller_id uuid not null,
  request text not null,
  reason text not null,
  description text,
  amount numeric,
  status text default 'open'::text not null,
  outcome text,
  admin_note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  resolved_at timestamp with time zone,
  refund_to text
);

create table if not exists public.order_items (
  id uuid default gen_random_uuid() not null,
  order_id uuid not null,
  product_id uuid not null,
  seller_id uuid not null,
  quantity integer not null,
  unit_price numeric(14,2) not null,
  line_total numeric(14,2) not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.order_payments (
  id uuid default gen_random_uuid() not null,
  order_id uuid not null,
  buyer_id uuid not null,
  amount numeric not null,
  provider text not null,
  method text not null,
  status text default 'pending'::text not null,
  entity text,
  reference text,
  proof_path text,
  provider_payment_id text,
  paid_amount numeric,
  expires_at timestamp with time zone,
  admin_note text,
  created_at timestamp with time zone default now() not null,
  decided_at timestamp with time zone,
  decided_by uuid
);

create table if not exists public.orders (
  id uuid default gen_random_uuid() not null,
  buyer_id uuid not null,
  status text default 'pending'::text not null,
  currency text default 'AOA'::text not null,
  subtotal numeric(14,2) default 0 not null,
  delivery_fee numeric(14,2) default 0 not null,
  total numeric(14,2) default 0 not null,
  delivery_address_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  payment_status text default 'unpaid'::text not null,
  payment_method text,
  fulfillment_type text default 'delivery'::text not null,
  fulfillment_status text default 'pending'::text not null,
  delivery_notes text,
  seller_id uuid,
  contact_phone text,
  delivery_text text,
  buyer_note text,
  refunded_amount numeric default 0 not null,
  completed_at timestamp with time zone,
  ref_no bigint generated by default as identity not null,
  protected boolean default false not null,
  escrow_status text,
  platform_fee numeric default 0 not null,
  pay_by timestamp with time zone,
  paid_at timestamp with time zone,
  delivered_at timestamp with time zone,
  received_at timestamp with time zone,
  release_at timestamp with time zone,
  released_at timestamp with time zone,
  delivery_lat numeric,
  delivery_lng numeric,
  delivery_municipality_id uuid
);

create table if not exists public.organization_members (
  organization_id uuid not null,
  user_id uuid not null,
  role text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.organizations (
  id uuid default gen_random_uuid() not null,
  name text not null,
  type text not null,
  owner_id uuid not null,
  verified boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.payout_accounts (
  user_id uuid not null,
  method text not null,
  holder_name text not null,
  iban text,
  express_number text,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.payout_requests (
  id uuid default gen_random_uuid() not null,
  ref_no bigint generated always as identity not null,
  user_id uuid not null,
  amount numeric not null,
  method text not null,
  holder_name text not null,
  destination text not null,
  status text default 'requested'::text not null,
  batch_id uuid,
  bank_reference text,
  admin_note text,
  created_at timestamp with time zone default now() not null,
  processed_at timestamp with time zone,
  paid_at timestamp with time zone,
  decided_by uuid
);

create table if not exists public.photo_search_usage (
  user_id uuid not null,
  day date not null,
  count integer default 0 not null
);

create table if not exists public.platform_settings (
  id integer default 1 not null,
  provider_monthly_kz numeric default 2000 not null,
  business_monthly_kz numeric default 5000 not null,
  trial_days integer default 30 not null,
  bank_name text,
  iban text,
  account_holder text,
  express_number text,
  payment_note text,
  updated_at timestamp with time zone default now() not null,
  store_monthly_kz numeric default 5000 not null,
  listing_commission_pct numeric default 5 not null,
  commission_due_days integer default 7 not null,
  payment_accounts jsonb default '[]'::jsonb not null,
  protected_enabled boolean default false not null,
  payment_provider text default 'manual'::text not null,
  proxypay_entity text,
  protected_fee_pct numeric default 0 not null,
  auto_release_days integer default 3 not null,
  payment_window_hours integer default 48 not null,
  payout_min_kz numeric default 1000 not null,
  payout_weekdays integer[] default '{2,5}'::integer[] not null,
  boost_price_kz numeric default 500 not null,
  boost_days integer default 7 not null,
  safe_spots jsonb default '[{"name": "À porta de uma esquadra da Polícia Nacional", "note": "Há sempre agentes por perto."}, {"name": "Numa agência bancária ou caixa Multicaixa movimentada", "note": "Tem câmaras e seguranças, e dá para levantar dinheiro na hora."}, {"name": "Num supermercado ou centro comercial", "note": "Muita gente, luz e câmaras."}, {"name": "Num posto de combustível", "note": "Aberto até tarde e com câmaras."}]'::jsonb not null,
  agent_fee_kz numeric default 100 not null,
  agent_daily_cap integer default 20 not null,
  agent_sale_pct numeric default 2 not null,
  referral_reward_days integer default 30 not null,
  claim_days integer default 7 not null,
  event_ticket_fee_pct numeric default 5 not null,
  event_boost_price_kz numeric default 1000 not null,
  event_boost_days integer default 7 not null,
  event_payment_hours integer default 48 not null,
  promo_boost_price_kz numeric default 1000 not null,
  promo_boost_days integer default 7 not null,
  fuel_fee_pct numeric default 10 not null,
  fuel_pay_minutes integer default 60 not null,
  inspection_valid_months integer default 12 not null,
  inspection_fee_kz numeric default 5000 not null,
  inspection_fee_provider_kz numeric default 2000 not null,
  venue_client_fee_pct numeric default 5 not null,
  venue_business_fee_pct numeric default 5 not null,
  venue_pay_minutes integer default 120 not null
);

create table if not exists public.portfolio_items (
  id uuid default gen_random_uuid() not null,
  owner_id uuid not null,
  provider_id uuid,
  business_id uuid,
  title text not null,
  description text,
  photos text[] not null,
  done_on date,
  "position" integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.products (
  id uuid default gen_random_uuid() not null,
  seller_id uuid not null,
  business_id uuid,
  name text not null,
  description text,
  category_id uuid,
  price numeric(14,2) not null,
  currency text default 'AOA'::text not null,
  stock integer default 0 not null,
  address_id uuid,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  media jsonb default '[]'::jsonb not null,
  municipality_id uuid,
  market_id uuid,
  video_url text,
  ref_no bigint generated by default as identity not null,
  conformity_accepted_at timestamp with time zone
);

create table if not exists public.profiles (
  id uuid not null,
  full_name text default ''::text not null,
  phone text,
  phone_verified boolean default false not null,
  province text default 'Huambo'::text not null,
  municipality text default ''::text not null,
  kyc_level integer default 0 not null,
  trust_score integer default 50 not null,
  status text default 'active'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  avatar_url text,
  whatsapp text,
  whatsapp_public boolean default false not null
);

create table if not exists public.promo_boosts (
  id uuid default gen_random_uuid() not null,
  ref_no bigint default nextval('promo_boosts_ref_no_seq'::regclass) not null,
  post_id uuid not null,
  owner_id uuid not null,
  amount numeric not null,
  days integer not null,
  method text not null,
  reference text,
  proof_path text,
  status text default 'pending'::text not null,
  admin_note text,
  decided_by uuid,
  decided_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.promo_posts (
  id uuid default gen_random_uuid() not null,
  ref_no bigint default nextval('promo_posts_ref_no_seq'::regclass) not null,
  owner_id uuid not null,
  subject_kind text not null,
  subject_id uuid not null,
  kind text not null,
  title text not null,
  description text,
  video_url text,
  external_url text,
  cover_url text,
  live_starts_at timestamp with time zone,
  live_ends_at timestamp with time zone,
  live_notified boolean default false not null,
  status text default 'published'::text not null,
  hidden_reason text,
  featured_until timestamp with time zone,
  views integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.provider_profiles (
  user_id uuid not null,
  display_name text not null,
  headline text,
  bio text,
  category_id uuid,
  address_id uuid,
  phone text,
  verified boolean default false not null,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  municipality_id uuid,
  whatsapp text,
  avatar_url text,
  custom_category text,
  directions text,
  geo_lat numeric,
  geo_lng numeric
);

create table if not exists public.provinces (
  id uuid default gen_random_uuid() not null,
  name text not null,
  country_code text default 'AO'::text not null,
  created_at timestamp with time zone default now() not null,
  active boolean default false not null
);

create table if not exists public.referral_codes (
  user_id uuid not null,
  code text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.referrals (
  referred_id uuid not null,
  referrer_id uuid not null,
  status text default 'joined'::text not null,
  reward_days integer,
  subscription_id uuid,
  created_at timestamp with time zone default now() not null,
  earned_at timestamp with time zone,
  rewarded_at timestamp with time zone
);

create table if not exists public.rental_requests (
  id uuid default gen_random_uuid() not null,
  listing_id uuid not null,
  renter_id uuid not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  proposed_price numeric(14,2) not null,
  message text,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.reviews (
  id uuid default gen_random_uuid() not null,
  author_id uuid not null,
  business_id uuid,
  provider_id uuid,
  product_id uuid,
  service_id uuid,
  order_id uuid,
  rating smallint not null,
  title text,
  comment text,
  status text default 'published'::text not null,
  created_at timestamp with time zone default now() not null,
  service_request_id uuid,
  owner_reply text,
  owner_reply_at timestamp with time zone
);

create table if not exists public.saved_items (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  business_id uuid,
  provider_id uuid,
  service_id uuid,
  product_id uuid,
  created_at timestamp with time zone default now() not null,
  auction_id uuid,
  classified_listing_id uuid
);

create table if not exists public.saved_search_notification_queue (
  id uuid default gen_random_uuid() not null,
  saved_search_id uuid not null,
  user_id uuid not null,
  listing_id uuid not null,
  created_at timestamp with time zone default now() not null,
  delivered_at timestamp with time zone,
  processing_at timestamp with time zone
);

create table if not exists public.seller_delivery_settings (
  seller_id uuid not null,
  pickup_enabled boolean default true not null,
  pickup_place text,
  delivery_enabled boolean default false not null,
  default_fee numeric,
  free_over numeric,
  min_order numeric,
  delivery_days text,
  note text,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.seller_delivery_zones (
  seller_id uuid not null,
  municipality_id uuid not null,
  fee numeric not null
);

create table if not exists public.service_requests (
  id uuid default gen_random_uuid() not null,
  client_id uuid not null,
  provider_id uuid,
  business_id uuid,
  description text not null,
  status text default 'requested'::text not null,
  provider_note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  preferred_date date
);

create table if not exists public.services (
  id uuid default gen_random_uuid() not null,
  provider_id uuid not null,
  business_id uuid,
  title text not null,
  description text,
  category_id uuid,
  price_from numeric(14,2),
  currency text default 'AOA'::text not null,
  address_id uuid,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  municipality_id uuid
);

create table if not exists public.streets (
  id uuid default gen_random_uuid() not null,
  neighborhood_id uuid not null,
  name text not null,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.subscription_payments (
  id uuid default gen_random_uuid() not null,
  subscription_id uuid not null,
  owner_id uuid not null,
  months integer not null,
  amount numeric not null,
  method text not null,
  reference text,
  proof_path text,
  status text default 'pending'::text not null,
  admin_note text,
  period_end timestamp with time zone,
  decided_by uuid,
  decided_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() not null,
  kind text not null,
  owner_id uuid not null,
  provider_id uuid,
  business_id uuid,
  trial_ends_at timestamp with time zone not null,
  paid_until timestamp with time zone,
  last_reminder text,
  created_at timestamp with time zone default now() not null,
  seller_id uuid
);

create table if not exists public.user_blocks (
  blocker_id uuid not null,
  blocked_id uuid not null,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.user_reviews (
  id uuid default gen_random_uuid() not null,
  author_id uuid not null,
  target_id uuid not null,
  role text not null,
  rating smallint not null,
  comment text,
  order_id uuid,
  listing_id uuid,
  status text default 'published'::text not null,
  created_at timestamp with time zone default now() not null,
  reply text,
  reply_at timestamp with time zone
);

create table if not exists public.user_roles (
  user_id uuid not null,
  role text default 'user'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.venue_items (
  id uuid default gen_random_uuid() not null,
  venue_id uuid not null,
  name text not null,
  description text,
  section text,
  photos text[] default '{}'::text[] not null,
  price numeric not null,
  unit text,
  capacity integer,
  qty_total numeric,
  min_qty numeric default 1 not null,
  available boolean default true not null,
  "position" integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.venue_order_lines (
  id uuid default gen_random_uuid() not null,
  order_id uuid not null,
  item_id uuid not null,
  name text not null,
  unit text,
  qty numeric not null,
  unit_price numeric not null,
  line_total numeric not null
);

create table if not exists public.venue_orders (
  id uuid default gen_random_uuid() not null,
  ref_no bigint default nextval('venue_orders_ref_no_seq'::regclass) not null,
  venue_id uuid not null,
  buyer_id uuid not null,
  kind text not null,
  buyer_name text not null,
  buyer_phone text,
  guests integer,
  check_in date,
  check_out date,
  slot_at timestamp with time zone,
  buyer_note text,
  subtotal numeric not null,
  client_fee_pct numeric not null,
  client_fee numeric default 0 not null,
  business_fee_pct numeric not null,
  business_fee numeric default 0 not null,
  total numeric not null,
  method text not null,
  status text not null,
  code text,
  qr_token text default replace((gen_random_uuid())::text, '-'::text, ''::text) not null,
  hold_until timestamp with time zone,
  pay_by timestamp with time zone,
  pay_method text,
  reference text,
  reference_norm text,
  proof_path text,
  proof_hash text,
  note text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.venue_pay (
  venue_id uuid not null,
  holder text,
  iban text,
  express text,
  note text,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.venue_platform_payments (
  id uuid default gen_random_uuid() not null,
  ref_no bigint default nextval('venue_platform_payments_ref_no_seq'::regclass) not null,
  venue_id uuid not null,
  owner_id uuid not null,
  amount numeric not null,
  method text not null,
  reference text,
  proof_path text,
  status text default 'pending'::text not null,
  admin_note text,
  decided_at timestamp with time zone,
  decided_by uuid,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.venues (
  id uuid default gen_random_uuid() not null,
  ref_no bigint default nextval('venues_ref_no_seq'::regclass) not null,
  business_id uuid not null,
  owner_id uuid not null,
  kind text not null,
  subtype text not null,
  accepts_reservations boolean default true not null,
  accepts_pay_at_place boolean default true not null,
  accepts_prepay boolean default false not null,
  hold_minutes integer default 60 not null,
  check_in_time text,
  check_out_time text,
  opening_hours text,
  policies text,
  status text default 'pending'::text not null,
  admin_note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.verification_requests (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  kind text not null,
  business_id uuid,
  document_path text,
  note text,
  status text default 'pending'::text not null,
  admin_note text,
  decided_by uuid,
  decided_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  back_path text,
  selfie_path text,
  id_number text
);

create table if not exists public.wallet_entries (
  id bigint generated always as identity not null,
  user_id uuid not null,
  order_id uuid,
  payout_id uuid,
  bucket text not null,
  kind text not null,
  amount numeric not null,
  note text,
  created_at timestamp with time zone default now() not null,
  created_by uuid
);

-- Numerações automáticas (identidades): mesmos valores iniciais do projeto antigo
alter table public.admin_audit_log alter column id set start with 1 set increment by 1 set minvalue 1 set cache 1;
alter table public.classified_listings alter column ref_no set start with 1001 restart with 1001;
alter table public.listing_boosts alter column ref_no set start with 1001 restart with 1001;
alter table public.orders alter column ref_no set start with 1001 restart with 1001;
alter table public.payout_requests alter column ref_no set start with 1001 restart with 1001;
alter table public.products alter column ref_no set start with 1001 restart with 1001;
alter table public.wallet_entries alter column id set start with 1 set increment by 1 set minvalue 1 set cache 1;

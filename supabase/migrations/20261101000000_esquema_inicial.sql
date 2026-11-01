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
CREATE OR REPLACE FUNCTION public.activate_due_auctions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_count integer;
begin
  update public.auctions
  set status='live', updated_at=now()
  where status='scheduled' and starts_at <= now() and ends_at > now();
  get diagnostics v_count = row_count;

  update public.auctions
  set status='ended', updated_at=now()
  where status='live' and ends_at <= now();

  return v_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_agent(p_user_id uuid, p_status text, p_note text DEFAULT NULL::text)
 RETURNS field_agents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.field_agents; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('active', 'suspended', 'rejected') then raise exception 'INVALID_STATUS'; end if;
  if p_status <> 'active' and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.field_agents set status = p_status, admin_note = txt, decided_at = now(), decided_by = auth.uid()
  where user_id = p_user_id returning * into a;
  if not found then raise exception 'AGENT_NOT_FOUND'; end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (a.user_id, 'system',
    case p_status when 'active' then 'Já é agente do Huambo Online 🤝' when 'suspended' then 'Conta de agente suspensa' else 'Pedido de agente não aceite' end,
    case p_status when 'active' then 'O seu código é ' || a.code || '. Peça aos vendedores que o escrevam ao publicar.' else txt end,
    jsonb_build_object('for', 'agent'));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'agent_' || p_status, 'user', a.user_id, jsonb_build_object('code', a.code));
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_agent_commissions(p_ids uuid[], p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.agent_commissions; n integer := 0; done uuid[] := '{}'; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if not p_approve and txt is null then raise exception 'REASON_REQUIRED'; end if;
  for c in select * from public.agent_commissions where id = any(coalesce(p_ids, '{}')) and status = 'pending' for update loop
    update public.agent_commissions set status = case when p_approve then 'approved' else 'rejected' end, admin_note = txt,
      decided_at = now(), decided_by = auth.uid() where id = c.id;
    if p_approve and c.amount > 0 then
      perform public.wallet_add(c.agent_id, null, null, 'available', 'agent', c.amount, 'Comissão de agente: ' || left(c.listing_title, 200));
    end if;
    n := n + 1; done := done || c.id;
  end loop;
  if n > 0 then
    insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
    values (auth.uid(), case when p_approve then 'agent_commissions_approved' else 'agent_commissions_rejected' end, 'user', auth.uid(), jsonb_build_object('count', n, 'ids', done));
    insert into public.notifications(user_id, type, title, body, data)
    select x.agent_id, 'system', case when p_approve then 'Comissões confirmadas 💰' else 'Comissões recusadas' end,
      case when x.k = 1 then '1 comissão' else x.k || ' comissões' end || case when p_approve then ' · ' || x.s || ' Kz já no seu saldo.' else ' recusada' || case when x.k = 1 then '' else 's' end || ': ' || txt end,
      jsonb_build_object('for', case when p_approve then 'wallet' else 'agent' end)
    from (select agent_id, count(*) k, sum(amount) s from public.agent_commissions where id = any(done) group by agent_id) x;
  end if;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_boost(p_boost_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS listing_boosts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b public.listing_boosts; l public.classified_listings; s timestamptz; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into b from public.listing_boosts where id = p_boost_id for update;
  if not found then raise exception 'BOOST_NOT_FOUND'; end if;
  if b.status <> 'pending' then raise exception 'PAYMENT_ALREADY_DECIDED'; end if;
  select * into l from public.classified_listings where id = b.listing_id for update;
  if p_confirm then
    s := greatest(now(), coalesce(l.featured_until, now()));
    update public.listing_boosts set status = 'active', starts_at = s, ends_at = s + make_interval(days => b.days), admin_note = txt,
      decided_at = now(), decided_by = auth.uid() where id = b.id returning * into b;
    perform set_config('huambo.allow_feature', 'on', true);
    update public.classified_listings set featured = true, featured_until = b.ends_at where id = l.id;
    perform set_config('huambo.allow_feature', '', true);
    insert into public.notifications(user_id, type, title, body, data)
    values (b.owner_id, 'system', 'Anúncio em destaque ⭐', '«' || l.title || '» aparece em destaque até ' || to_char(b.ends_at at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '.',
      jsonb_build_object('listing_id', l.id, 'for', 'boost'));
  else
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
    update public.listing_boosts set status = 'rejected', admin_note = txt, decided_at = now(), decided_by = auth.uid() where id = b.id returning * into b;
    insert into public.notifications(user_id, type, title, body, data)
    values (b.owner_id, 'system', 'Destaque não confirmado', txt, jsonb_build_object('listing_id', l.id, 'for', 'boost'));
  end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_confirm then 'boost_confirmed' else 'boost_rejected' end, 'listing', l.id, jsonb_build_object('boost_id', b.id, 'amount', b.amount));
  return b;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_dispute(p_dispute_id uuid, p_decision text, p_amount numeric DEFAULT NULL::numeric, p_note text DEFAULT NULL::text)
 RETURNS order_disputes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.order_disputes; o public.orders; amt numeric; txt text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into d from public.order_disputes where id = p_dispute_id for update;
  if not found then raise exception 'DISPUTE_NOT_FOUND'; end if;
  if d.status = 'resolved' then raise exception 'DISPUTE_CLOSED'; end if;
  if p_decision not in ('refund', 'return_refund', 'replacement', 'reject') then raise exception 'INVALID_DECISION'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into o from public.orders where id = d.order_id;
  if p_decision in ('refund', 'return_refund') then
    amt := coalesce(p_amount, d.amount, o.total - o.refunded_amount);
    if amt <= 0 or amt > o.total - o.refunded_amount then raise exception 'INVALID_AMOUNT'; end if;
  end if;
  update public.order_disputes set
    request = case when p_decision = 'reject' then request else p_decision end,
    amount = case when p_decision = 'reject' then amount when p_decision = 'replacement' then null else amt end,
    status = case p_decision when 'refund' then 'awaiting_refund' when 'return_refund' then 'awaiting_return' when 'replacement' then 'replacing' else 'resolved' end,
    outcome = case when p_decision = 'reject' then 'rejected' end,
    resolved_at = case when p_decision = 'reject' then now() end,
    admin_note = txt, updated_at = now()
   where id = d.id returning * into d;
  perform public.dispute_log(d, 'admin', 'decided', txt);
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'dispute_decided', 'order', d.order_id, jsonb_build_object('dispute_id', d.id, 'decision', p_decision, 'amount', d.amount));
  return d;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_event_payment(p_payment_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS event_platform_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.event_platform_payments; e public.events; txt text := nullif(left(trim(coalesce(p_note, '')), 500), ''); until_ timestamptz;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into p from public.event_platform_payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if p.status <> 'pending' then raise exception 'PAYMENT_ALREADY_DECIDED'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into e from public.events where id = p.event_id for update;
  update public.event_platform_payments set status = case when p_confirm then 'confirmed' else 'rejected' end, admin_note = txt, decided_at = now(), decided_by = auth.uid()
   where id = p.id returning * into p;
  if p_confirm and p.kind = 'boost' then
    until_ := greatest(now(), coalesce(e.featured_until, now())) + make_interval(days => coalesce(p.days, 7));
    perform set_config('huambo.allow_feature', 'on', true);
    update public.events set featured_until = until_ where id = e.id;
    perform set_config('huambo.allow_feature', '', true);
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (p.organizer_id, 'system',
    case when not p_confirm then 'Pagamento não confirmado' when p.kind = 'boost' then 'Evento em destaque ⭐' else 'Comissão do evento paga ✔' end,
    case when not p_confirm then '«' || left(e.title, 80) || '»: ' || txt
         when p.kind = 'boost' then '«' || left(e.title, 80) || '» aparece em destaque até ' || to_char(until_ at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '.'
         else '«' || left(e.title, 80) || '»: pagamento de ' || p.amount || ' Kz confirmado.' end,
    jsonb_build_object('for', 'event_orders', 'event_id', e.id));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'event_' || p.kind || case when p_confirm then '_confirmed' else '_rejected' end, 'event', e.id, jsonb_build_object('payment_id', p.id, 'amount', p.amount));
  return p;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_fuel_payment(p_payment_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS fuel_platform_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.fuel_platform_payments; s public.fuel_stations; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into p from public.fuel_platform_payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if p.status <> 'pending' then raise exception 'PAYMENT_ALREADY_DECIDED'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.fuel_platform_payments set status = case when p_confirm then 'confirmed' else 'rejected' end, admin_note = txt, decided_at = now(), decided_by = auth.uid()
   where id = p.id returning * into p;
  select * into s from public.fuel_stations where id = p.station_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (p.owner_id, 'system', case when p_confirm then 'Comissão paga ✔' else 'Pagamento não confirmado' end,
    case when p_confirm then s.name || ': pagamento de ' || p.amount || ' Kz confirmado.' else s.name || ': ' || txt end,
    jsonb_build_object('for', 'fuel_station', 'station_id', s.id));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'fuel_fee' || case when p_confirm then '_confirmed' else '_rejected' end, 'fuel_station', s.id, jsonb_build_object('payment_id', p.id, 'amount', p.amount));
  return p;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_inspection(p_id uuid, p_approve boolean, p_note text DEFAULT NULL::text, p_checklist jsonb DEFAULT '{}'::jsonb)
 RETURNS inspections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare i public.inspections; st public.platform_settings; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if not p_approve and txt is null then raise exception 'REASON_REQUIRED'; end if;
  if p_approve and not coalesce((p_checklist->>'exists')::boolean, false) then raise exception 'INSPECTION_CHECKLIST'; end if;
  select * into st from public.platform_settings where id = 1;
  update public.inspections set status = case when p_approve then 'approved' else 'rejected' end, admin_note = txt, checklist = coalesce(p_checklist, '{}'::jsonb),
    inspected_at = now(), valid_until = case when p_approve then now() + make_interval(months => st.inspection_valid_months) end, updated_at = now()
    where id = p_id and status in ('requested', 'scheduled') returning * into i;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_approve then 'inspection_approved' else 'inspection_rejected' end, i.kind, i.target_id, jsonb_build_object('inspection', i.ref_no, 'note', txt, 'checklist', i.checklist));
  insert into public.notifications(user_id, type, title, body, data)
  values (i.owner_id, 'system', case when p_approve then '🏅 Inspeção aprovada' else 'Inspeção não aprovada' end,
    coalesce(public.inspection_target_name(i.kind, i.target_id), '') || case when p_approve then ': já mostra o selo «Inspecionado» até ' || to_char(i.valid_until at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '.' else ': ' || txt end,
    jsonb_build_object('for', 'inspection', 'inspection_id', i.id));
  return i;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_inspection_payment(p_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS inspections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare i public.inspections; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.inspections set status = case when p_confirm then 'requested' else 'awaiting_payment' end, paid_at = case when p_confirm then now() end,
    admin_note = txt, updated_at = now() where id = p_id and status = 'payment_submitted' returning * into i;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_confirm then 'inspection_payment_confirmed' else 'inspection_payment_rejected' end, i.kind, i.target_id,
    jsonb_build_object('inspection', i.ref_no, 'amount', i.fee_amount, 'reference', i.pay_reference, 'note', txt));
  insert into public.notifications(user_id, type, title, body, data)
  values (i.owner_id, 'system', case when p_confirm then '🏅 Taxa de inspeção confirmada' else 'Pagamento da inspeção não confirmado' end,
    coalesce(public.inspection_target_name(i.kind, i.target_id), '') || case when p_confirm then ': vamos ligar para marcar a visita.' else ': ' || txt end,
    jsonb_build_object('for', 'inspection', 'inspection_id', i.id));
  return i;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_listing_claim(p_claim_id uuid, p_uphold boolean, p_note text)
 RETURNS listing_claims
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.listing_claims; txt text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into c from public.listing_claims where id = p_claim_id for update;
  if not found then raise exception 'CLAIM_NOT_FOUND'; end if;
  if c.status = 'resolved' then raise exception 'INVALID_TRANSITION'; end if;
  if p_uphold then
    update public.listing_claims set status = 'accepted', admin_note = txt, decided_by_admin = true, updated_at = now() where id = c.id returning * into c;
  else
    update public.listing_claims set status = 'resolved', outcome = 'rejected', admin_note = txt, decided_by_admin = true, resolved_at = now(), updated_at = now()
     where id = c.id returning * into c;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  select x.u, 'system', case when p_uphold then 'Decisão: o comprador tem razão' else 'Decisão: reclamação recusada' end,
    '«' || left(c.listing_title, 120) || '» (R-' || c.ref_no || '): ' || txt
    || case when p_uphold and x.u = c.seller_id then ' Tem de fazer a troca, a devolução ou o reembolso pedido; se não cumprir, a conta pode ser suspensa.' else '' end,
    jsonb_build_object('for', 'claim')
  from (values (c.buyer_id), (c.seller_id)) x(u);
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_uphold then 'claim_upheld' else 'claim_rejected' end, 'listing', c.listing_id, jsonb_build_object('claim_id', c.id, 'ref', c.ref_no));
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_order_payment(p_payment_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS order_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pay public.order_payments; o public.orders; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into pay from public.order_payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if pay.status <> 'pending' or pay.provider <> 'manual' then raise exception 'PAYMENT_ALREADY_DECIDED'; end if;
  select * into o from public.orders where id = pay.order_id;
  if p_confirm then
    perform public.escrow_mark_paid(pay.id, null, null);
  else
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
    update public.order_payments set status = 'rejected', admin_note = txt, decided_at = now(), decided_by = auth.uid() where id = pay.id;
    -- mais um dia para voltar a enviar
    update public.orders set pay_by = greatest(pay_by, now() + interval '24 hours'), updated_at = now() where id = o.id and escrow_status = 'awaiting_payment';
    insert into public.notifications(user_id, type, title, body, data)
    values (o.buyer_id, 'order', 'Pagamento não confirmado', txt || ' Pode enviar o comprovativo outra vez.', jsonb_build_object('order_id', o.id, 'for', 'purchase'));
  end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_confirm then 'order_payment_confirmed' else 'order_payment_rejected' end, 'order', o.id,
    jsonb_build_object('payment_id', pay.id, 'amount', pay.amount, 'note', txt));
  select * into pay from public.order_payments where id = p_payment_id;
  return pay;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_promo_boost(p_boost_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS promo_boosts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b public.promo_boosts; p public.promo_posts;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if not p_confirm and nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'REASON_REQUIRED'; end if;
  select * into b from public.promo_boosts where id = p_boost_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if b.status <> 'pending' then raise exception 'ALREADY_DECIDED'; end if;
  update public.promo_boosts set status = case when p_confirm then 'confirmed' else 'rejected' end, admin_note = nullif(trim(coalesce(p_note, '')), ''),
    decided_by = auth.uid(), decided_at = now() where id = b.id returning * into b;
  if p_confirm then
    update public.promo_posts set featured_until = greatest(coalesce(featured_until, now()), now()) + make_interval(days => b.days) where id = b.post_id returning * into p;
  else select * into p from public.promo_posts where id = b.post_id; end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (b.owner_id, 'system', case when p_confirm then '⭐ Destaque ativo' else 'Destaque não confirmado' end,
    case when p_confirm then '«' || p.title || '» fica em destaque até ' || to_char(p.featured_until at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '.'
         else '«' || p.title || '»: ' || trim(p_note) end,
    jsonb_build_object('for', 'promo', 'post_id', p.id));
  return b;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_subscription_payment(p_payment_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS subscription_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.subscription_payments; s public.subscriptions; new_end timestamptz; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into p from public.subscription_payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if p.status <> 'pending' then raise exception 'INVALID_TRANSITION'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into s from public.subscriptions where id = p.subscription_id for update;
  if p_confirm then
    new_end := greatest(now(), public.subscription_active_until(s)) + make_interval(months => p.months);
    update public.subscriptions set paid_until = new_end, last_reminder = null where id = s.id;
  end if;
  update public.subscription_payments set status = case when p_confirm then 'confirmed' else 'rejected' end, admin_note = txt,
    period_end = new_end, decided_by = auth.uid(), decided_at = now() where id = p.id returning * into p;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_confirm then 'subscription_payment_confirmed' else 'subscription_payment_rejected' end, s.kind, coalesce(s.provider_id, s.business_id),
          jsonb_build_object('payment_id', p.id, 'amount', p.amount, 'months', p.months));
  insert into public.notifications(user_id, type, title, body, data)
  values (p.owner_id, 'system', case when p_confirm then 'Pagamento confirmado ✔' else 'Pagamento não confirmado' end,
          case when p_confirm then 'A mensalidade está paga até ' || to_char(new_end at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '.' else txt end,
          jsonb_build_object('payment_id', p.id, 'for', 'plan'));
  return p;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_venue_payment(p_payment_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS venue_platform_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.venue_platform_payments; bname text; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into p from public.venue_platform_payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if p.status <> 'pending' then raise exception 'PAYMENT_ALREADY_DECIDED'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.venue_platform_payments set status = case when p_confirm then 'confirmed' else 'rejected' end, admin_note = txt, decided_at = now(), decided_by = auth.uid()
   where id = p.id returning * into p;
  select b.name into bname from public.venues v join public.businesses b on b.id = v.business_id where v.id = p.venue_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (p.owner_id, 'system', case when p_confirm then 'Taxa paga ✔' else 'Pagamento não confirmado' end,
    case when p_confirm then bname || ': pagamento de ' || p.amount || ' Kz confirmado.' else bname || ': ' || txt end,
    jsonb_build_object('for', 'venue', 'venue_id', p.venue_id));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'venue_fee' || case when p_confirm then '_confirmed' else '_rejected' end, 'venue', p.venue_id, jsonb_build_object('payment_id', p.id, 'amount', p.amount));
  return p;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decide_verification(p_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS verification_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.verification_requests;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into v from public.verification_requests where id = p_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v.status <> 'pending' then raise exception 'INVALID_TRANSITION'; end if;
  update public.verification_requests set status = case when p_approve then 'approved' else 'rejected' end,
    admin_note = nullif(left(trim(coalesce(p_note, '')), 500), ''), decided_by = auth.uid(), decided_at = now()
   where id = v.id returning * into v;
  if p_approve then
    if v.kind = 'identity' then update public.profiles set kyc_level = greatest(kyc_level, 1) where id = v.user_id;
    elsif v.kind = 'provider' then update public.provider_profiles set verified = true where user_id = v.user_id;
    else update public.businesses set verified = true where id = v.business_id; end if;
  end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_approve then 'verification_approved' else 'verification_rejected' end, v.kind, coalesce(v.business_id, v.user_id), jsonb_build_object('request_id', v.id));
  insert into public.notifications(user_id, type, title, body, data)
  values (v.user_id, 'system', case when p_approve then 'Verificação aprovada ✔' else 'Verificação recusada' end,
          case when p_approve then 'O seu perfil passa a mostrar o selo de verificado.' else coalesce(v.admin_note, 'Envie um documento legível e tente novamente.') end,
          jsonb_build_object('verification_id', v.id, 'for', 'verification'));
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_escrow_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return jsonb_build_object(
    'held', (select coalesce(sum(amount), 0) from public.wallet_entries where bucket = 'pending'),
    'available', (select coalesce(sum(amount), 0) from public.wallet_entries where bucket = 'available'),
    'payouts_open', (select coalesce(sum(amount), 0) from public.payout_requests where status in ('requested', 'processing')),
    'payouts_requested', (select count(*) from public.payout_requests where status = 'requested'),
    'payouts_processing', (select count(*) from public.payout_requests where status = 'processing'),
    'payments_pending', (select count(*) from public.order_payments where status = 'pending' and provider = 'manual'),
    'awaiting_payment', (select count(*) from public.orders where escrow_status = 'awaiting_payment' and status <> 'cancelled'),
    'refunds_to_send', (select count(*) from public.order_disputes d join public.orders o on o.id = d.order_id
                         where o.escrow_status = 'held' and d.status = 'awaiting_refund'),
    'fees_30d', (select coalesce(sum(platform_fee), 0) from public.orders where released_at > now() - interval '30 days'));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_job_queue_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return jsonb_build_object(
    'pending', (select count(*) from public.job_queue where done_at is null),
    'oldest_pending_seconds', (select extract(epoch from now() - min(created_at))::int from public.job_queue where done_at is null),
    'done_last_hour', (select count(*) from public.job_queue where done_at > now() - interval '1 hour' and last_error is null),
    'failed', (select count(*) from public.job_queue where done_at is not null and last_error is not null and attempts >= 5));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_agent_commissions(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, agent_id uuid, agent_code text, agent_name text, listing_id uuid, listing_title text, listing_status text, listing_ref bigint, owner_name text, amount numeric, status text, admin_note text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select c.id, c.agent_id, a.code, a.full_name, c.listing_id, c.listing_title, l.status, l.ref_no,
    coalesce(nullif(p.full_name, ''), 'Utilizador'), c.amount, c.status, c.admin_note, c.created_at
  from public.agent_commissions c join public.field_agents a on a.user_id = c.agent_id
    left join public.classified_listings l on l.id = c.listing_id left join public.profiles p on p.id = c.owner_id
  where p_status is null or c.status = p_status
  order by c.created_at limit 500;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_agent_commissions_v2(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, agent_id uuid, agent_code text, agent_name text, listing_id uuid, listing_title text, listing_status text, listing_ref bigint, owner_name text, amount numeric, sale_amount numeric, rate_pct numeric, seller_commission_status text, status text, admin_note text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select c.id, c.agent_id, a.code, a.full_name, c.listing_id, c.listing_title, l.status, l.ref_no,
    coalesce(nullif(p.full_name, ''), 'Utilizador'), c.amount, c.sale_amount, c.rate_pct,
    (select lc.status from public.listing_commissions lc where lc.listing_id = c.listing_id and lc.status <> 'cancelled' order by lc.created_at desc limit 1),
    c.status, c.admin_note, c.created_at
  from public.agent_commissions c join public.field_agents a on a.user_id = c.agent_id
    left join public.classified_listings l on l.id = c.listing_id left join public.profiles p on p.id = c.owner_id
  where p_status is null or c.status = p_status
  order by c.created_at limit 500;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_agents(p_status text DEFAULT NULL::text)
 RETURNS TABLE(user_id uuid, code text, full_name text, phone text, note text, status text, admin_note text, market_name text, created_at timestamp with time zone, listings bigint, pending_count bigint, pending_kz numeric, approved_kz numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select a.user_id, a.code, a.full_name, a.phone, a.note, a.status, a.admin_note, m.name, a.created_at,
    (select count(*) from public.classified_listings l where l.agent_id = a.user_id),
    (select count(*) from public.agent_commissions c where c.agent_id = a.user_id and c.status = 'pending'),
    (select coalesce(sum(c.amount), 0) from public.agent_commissions c where c.agent_id = a.user_id and c.status = 'pending'),
    (select coalesce(sum(c.amount), 0) from public.agent_commissions c where c.agent_id = a.user_id and c.status = 'approved')
  from public.field_agents a left join public.markets m on m.id = a.market_id
  where p_status is null or a.status = p_status
  order by case a.status when 'pending' then 0 when 'active' then 1 else 2 end, a.created_at desc limit 300;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_agents_v2(p_status text DEFAULT NULL::text)
 RETURNS TABLE(user_id uuid, code text, full_name text, phone text, note text, status text, admin_note text, market_name text, created_at timestamp with time zone, listings bigint, sold bigint, pending_count bigint, pending_kz numeric, approved_kz numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select a.user_id, a.code, a.full_name, a.phone, a.note, a.status, a.admin_note, m.name, a.created_at,
    (select count(*) from public.classified_listings l where l.agent_id = a.user_id),
    (select count(*) from public.classified_listings l where l.agent_id = a.user_id and l.status = 'sold'),
    (select count(*) from public.agent_commissions c where c.agent_id = a.user_id and c.status = 'pending'),
    (select coalesce(sum(c.amount), 0) from public.agent_commissions c where c.agent_id = a.user_id and c.status = 'pending'),
    (select coalesce(sum(c.amount), 0) from public.agent_commissions c where c.agent_id = a.user_id and c.status = 'approved')
  from public.field_agents a left join public.markets m on m.id = a.market_id
  where p_status is null or a.status = p_status
  order by case a.status when 'pending' then 0 when 'active' then 1 else 2 end, a.created_at desc limit 300;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_audit(p_limit integer DEFAULT 100)
 RETURNS TABLE(id bigint, actor_name text, action text, target_type text, target_id uuid, details jsonb, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select a.id, coalesce(nullif(p.full_name, ''), 'Administração'), a.action, a.target_type, a.target_id, a.details, a.created_at
  from public.admin_audit_log a left join public.profiles p on p.id = a.actor_id
  order by a.created_at desc limit greatest(1, least(coalesce(p_limit, 100), 500));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_boosts(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, ref_no bigint, listing_id uuid, listing_title text, owner_id uuid, owner_name text, phone text, days integer, amount numeric, status text, method text, reference text, proof_path text, starts_at timestamp with time zone, ends_at timestamp with time zone, admin_note text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select b.id, b.ref_no, b.listing_id, l.title, b.owner_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), p.phone, b.days, b.amount,
    b.status, b.method, b.reference, b.proof_path, b.starts_at, b.ends_at, b.admin_note, b.created_at
  from public.listing_boosts b join public.classified_listings l on l.id = b.listing_id left join public.profiles p on p.id = b.owner_id
  where p_status is null or b.status = p_status order by b.created_at desc limit 300;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_commissions(p_status text DEFAULT 'submitted'::text)
 RETURNS TABLE(id uuid, listing_id uuid, listing_title text, owner_id uuid, owner_name text, phone text, listed_price numeric, sale_amount numeric, rate_pct numeric, amount numeric, source text, status text, due_at timestamp with time zone, method text, reference text, proof_path text, admin_note text, submitted_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select c.id, c.listing_id, c.listing_title, c.owner_id, coalesce(nullif(pr.full_name, ''), 'Utilizador'), pr.phone, c.listed_price, c.sale_amount, c.rate_pct,
    c.amount, c.source, c.status, c.due_at, c.method, c.reference, c.proof_path, c.admin_note, c.submitted_at, c.created_at
  from public.listing_commissions c left join public.profiles pr on pr.id = c.owner_id
  where p_status is null or c.status = p_status or (p_status = 'overdue' and c.status = 'due' and c.due_at < now())
  order by (c.status = 'submitted') desc, c.due_at limit 300;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_couriers()
 RETURNS TABLE(user_id uuid, display_name text, phone text, vehicle text, municipality text, status text, available boolean, created_at timestamp with time zone, delivered bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select c.user_id, c.display_name, c.phone, c.vehicle, m.name, c.status, c.available, c.created_at,
    (select count(*) from public.delivery_requests d where d.assigned_to = c.user_id and d.status = 'delivered')
  from public.couriers c left join public.municipalities m on m.id = c.municipality_id
  order by (c.status = 'pending') desc, c.created_at desc limit 300;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_deliveries()
 RETURNS TABLE(id uuid, order_id uuid, status text, requested_at timestamp with time zone, total numeric, delivery_text text, seller_name text, courier_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select d.id, d.order_id, d.status, d.requested_at, o.total, o.delivery_text,
    coalesce(nullif(sp.full_name, ''), 'Vendedor'), c.display_name
  from public.delivery_requests d join public.orders o on o.id = d.order_id
  left join public.profiles sp on sp.id = o.seller_id left join public.couriers c on c.user_id = d.assigned_to
  where d.status not in ('delivered', 'cancelled') order by d.requested_at limit 200;
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_list_disputes(p_status text DEFAULT 'escalated'::text)
 RETURNS TABLE(id uuid, order_id uuid, buyer_id uuid, buyer_name text, seller_id uuid, seller_name text, request text, reason text, description text, amount numeric, status text, outcome text, admin_note text, created_at timestamp with time zone, updated_at timestamp with time zone, order_total numeric, payment_method text, order_status text, events jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select d.id, d.order_id, d.buyer_id, coalesce(nullif(b.full_name, ''), 'Utilizador'), d.seller_id, coalesce(nullif(s.full_name, ''), 'Utilizador'),
    d.request, d.reason, d.description, d.amount, d.status, d.outcome, d.admin_note, d.created_at, d.updated_at, o.total, o.payment_method, o.status,
    public.dispute_events_json(d.id)
  from public.order_disputes d join public.orders o on o.id = d.order_id
  left join public.profiles b on b.id = d.buyer_id left join public.profiles s on s.id = d.seller_id
  where p_status is null or (p_status = 'active' and d.status <> 'resolved') or d.status = p_status
  order by (d.status = 'escalated') desc, d.updated_at limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_disputes_v2(p_status text DEFAULT 'escalated'::text)
 RETURNS TABLE(id uuid, order_id uuid, buyer_id uuid, buyer_name text, seller_id uuid, seller_name text, request text, reason text, description text, amount numeric, status text, outcome text, admin_note text, created_at timestamp with time zone, updated_at timestamp with time zone, order_total numeric, payment_method text, order_status text, events jsonb, protected boolean, escrow_status text, refund_to text, order_ref text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select d.id, d.order_id, d.buyer_id, coalesce(nullif(b.full_name, ''), 'Utilizador'), d.seller_id, coalesce(nullif(s.full_name, ''), 'Utilizador'),
    d.request, d.reason, d.description, d.amount, d.status, d.outcome, d.admin_note, d.created_at, d.updated_at, o.total, o.payment_method, o.status,
    public.dispute_events_json(d.id), o.protected, o.escrow_status, d.refund_to, public.order_ref(o)
  from public.order_disputes d join public.orders o on o.id = d.order_id
  left join public.profiles b on b.id = d.buyer_id left join public.profiles s on s.id = d.seller_id
  where p_status is null or (p_status = 'active' and d.status <> 'resolved') or d.status = p_status
    or (p_status = 'escrow_refunds' and o.escrow_status = 'held' and d.status in ('awaiting_refund', 'refund_sent'))
  order by (d.status = 'escalated') desc, d.updated_at limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_event_payments(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, ref_no bigint, event_id uuid, event_ref bigint, event_title text, organizer_name text, kind text, amount numeric, days integer, method text, reference text, proof_path text, status text, admin_note text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select p.id, p.ref_no, p.event_id, e.ref_no, e.title, coalesce(nullif(pr.full_name, ''), 'Organizador'), p.kind, p.amount, p.days,
    p.method, p.reference, p.proof_path, p.status, p.admin_note, p.created_at
  from public.event_platform_payments p join public.events e on e.id = p.event_id left join public.profiles pr on pr.id = p.organizer_id
  where p_status is null or p.status = p_status order by p.created_at limit 300;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_fuel_orders(p_status text DEFAULT 'submitted'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select o.id, o.ref_no, o.status, o.method, o.product, o.quantity, o.subtotal, o.fee_amount, o.total, o.buyer_name, o.buyer_phone, o.reference, o.proof_path,
      o.qr_token, o.note, o.created_at, s.id station_id, s.ref_no station_ref, s.name station_name
    from public.fuel_orders o join public.fuel_stations s on s.id = o.station_id
    where o.method = 'prepaid' and (coalesce(p_status, '') = '' or o.status = p_status) order by o.created_at desc limit 200) x);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_fuel_payments(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, ref_no bigint, station_id uuid, station_ref bigint, station_name text, owner_name text, amount numeric, method text, reference text, proof_path text, status text, admin_note text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select p.id, p.ref_no, p.station_id, s.ref_no, s.name, coalesce(nullif(pr.full_name, ''), 'Dono'), p.amount, p.method, p.reference, p.proof_path, p.status, p.admin_note, p.created_at
  from public.fuel_platform_payments p join public.fuel_stations s on s.id = p.station_id left join public.profiles pr on pr.id = p.owner_id
  where p_status is null or p.status = p_status order by p.created_at limit 300;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_inspections(p_status text DEFAULT 'requested'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.sort_at), '[]') from (
    select i.id, i.ref_no, i.kind, i.target_id, public.inspection_target_name(i.kind, i.target_id) target_name,
      case when i.kind = 'business' then (select c.slug from public.businesses b join public.categories c on c.id = b.category_id where b.id = i.target_id) end category_slug,
      i.owner_id, coalesce(nullif(p.full_name, ''), '—') owner_name, i.status, i.address, i.phone, i.preferred_time, i.note, i.scheduled_for, i.inspector_name,
      i.checklist, i.admin_note, i.inspected_at, i.valid_until, i.created_at, i.fee_amount, i.pay_method, i.pay_reference, i.pay_proof_path, i.pay_submitted_at, i.paid_at,
      coalesce(i.scheduled_for, i.pay_submitted_at, i.created_at) sort_at
    from public.inspections i left join public.profiles p on p.id = i.owner_id
    where coalesce(p_status, '') = '' or i.status = p_status or (p_status = 'approved' and i.status = 'approved' and i.valid_until > now())
    order by coalesce(i.scheduled_for, i.pay_submitted_at, i.created_at) limit 300) x);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_listing_claims(p_status text DEFAULT 'escalated'::text)
 RETURNS TABLE(id uuid, ref_no bigint, listing_id uuid, listing_title text, buyer_name text, seller_name text, seller_id uuid, request text, reason text, description text, amount numeric, status text, outcome text, seller_note text, admin_note text, created_at timestamp with time zone, seller_claims bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select c.id, c.ref_no, c.listing_id, c.listing_title, coalesce(nullif(b.full_name, ''), 'Comprador'), coalesce(nullif(s.full_name, ''), 'Vendedor'),
    c.seller_id, c.request, c.reason, c.description, c.amount, c.status, c.outcome, c.seller_note, c.admin_note, c.created_at,
    (select count(*) from public.listing_claims x where x.seller_id = c.seller_id)
  from public.listing_claims c left join public.profiles b on b.id = c.buyer_id left join public.profiles s on s.id = c.seller_id
  where p_status is null or c.status = p_status
  order by c.created_at limit 300;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_listings(p_status text DEFAULT NULL::text, p_query text DEFAULT ''::text)
 RETURNS TABLE(id uuid, title text, status text, featured boolean, price numeric, currency text, created_at timestamp with time zone, owner_id uuid, owner_name text, reports bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
  select l.id, l.title, l.status, l.featured, l.price, l.currency, l.created_at, l.owner_id, p.full_name,
         (select count(*) from public.moderation_reports r where r.target_type = 'classified_listing' and r.target_id = l.id)
  from public.classified_listings l left join public.profiles p on p.id = l.owner_id
  where (p_status is null or l.status = p_status)
    and (coalesce(p_query,'') = '' or lower(l.title) like '%' || lower(p_query) || '%')
  order by l.created_at desc
  limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_order_payments(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, order_id uuid, order_ref text, buyer_id uuid, buyer_name text, buyer_phone text, seller_name text, amount numeric, paid_amount numeric, provider text, method text, status text, entity text, reference text, proof_path text, admin_note text, created_at timestamp with time zone, decided_at timestamp with time zone, order_status text, escrow_status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select p.id, p.order_id, public.order_ref(o), p.buyer_id, coalesce(nullif(b.full_name, ''), 'Utilizador'), o.contact_phone,
    coalesce(nullif(s.full_name, ''), 'Utilizador'), p.amount, p.paid_amount, p.provider, p.method, p.status, p.entity, p.reference, p.proof_path,
    p.admin_note, p.created_at, p.decided_at, o.status, o.escrow_status
  from public.order_payments p join public.orders o on o.id = p.order_id
  left join public.profiles b on b.id = p.buyer_id left join public.profiles s on s.id = o.seller_id
  where p_status is null or p.status = p_status
  order by p.created_at desc limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_payouts(p_status text DEFAULT 'requested'::text)
 RETURNS TABLE(id uuid, ref_no bigint, user_id uuid, user_name text, phone text, amount numeric, method text, holder_name text, destination text, status text, batch_id uuid, bank_reference text, admin_note text, created_at timestamp with time zone, processed_at timestamp with time zone, paid_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select p.id, p.ref_no, p.user_id, coalesce(nullif(pf.full_name, ''), 'Utilizador'), pf.phone, p.amount, p.method, p.holder_name,
    p.destination, p.status, p.batch_id, p.bank_reference, p.admin_note, p.created_at, p.processed_at, p.paid_at
  from public.payout_requests p left join public.profiles pf on pf.id = p.user_id
  where p_status is null or p.status = p_status
  order by p.created_at limit 500;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_promo_boosts(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, ref_no bigint, post_id uuid, post_ref bigint, post_title text, post_kind text, owner_name text, amount numeric, days integer, method text, reference text, proof_path text, status text, admin_note text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select b.id, b.ref_no, b.post_id, p.ref_no, p.title, p.kind, coalesce(nullif(pr.full_name, ''), 'Utilizador'), b.amount, b.days, b.method,
    b.reference, b.proof_path, b.status, b.admin_note, b.created_at
  from public.promo_boosts b join public.promo_posts p on p.id = b.post_id left join public.profiles pr on pr.id = b.owner_id
  where p_status is null or b.status = p_status order by b.created_at desc limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_promo_posts(p_status text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, ref_no bigint, kind text, title text, subject_kind text, subject_id uuid, subject_name text, video_url text, external_url text, status text, hidden_reason text, views integer, featured_until timestamp with time zone, created_at timestamp with time zone, reports bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select x.id, x.ref_no, x.kind, x.title, x.subject_kind, x.subject_id, s.name, x.video_url, x.external_url, x.status, x.hidden_reason, x.views, x.featured_until, x.created_at,
    (select count(*) from public.moderation_reports r where r.target_type = 'promo_post' and r.target_id = x.id and r.status in ('open', 'reviewing'))
  from public.promo_posts x cross join lateral public.promo_subject(x.subject_kind, x.subject_id) s
  where p_status is null or x.status = p_status
  order by 15 desc, x.created_at desc limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_reports(p_status text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, target_type text, target_id uuid, reason text, details text, status text, created_at timestamp with time zone, reporter_name text, listing_title text, listing_status text, listing_owner uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
  select r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at,
         p.full_name, l.title, l.status, l.owner_id
  from public.moderation_reports r
  left join public.profiles p on p.id = r.reporter_id
  left join public.classified_listings l on r.target_type = 'classified_listing' and l.id = r.target_id
  where p_status is null or r.status = p_status
  order by (r.status in ('open','reviewing')) desc, r.created_at desc
  limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_reports_v2(p_status text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, target_type text, target_id uuid, reason text, details text, status text, created_at timestamp with time zone, reporter_name text, target_title text, target_active boolean, target_owner uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
  select r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at, coalesce(nullif(rp.full_name, ''), 'Utilizador'),
    case r.target_type
      when 'classified_listing' then (select l.title from public.classified_listings l where l.id = r.target_id)
      when 'product' then (select p.name from public.products p where p.id = r.target_id)
      when 'business' then (select b.name from public.businesses b where b.id = r.target_id)
      when 'provider' then (select pp.display_name from public.provider_profiles pp where pp.user_id = r.target_id)
      when 'user' then (select coalesce(nullif(u.full_name, ''), 'Utilizador') from public.profiles u where u.id = r.target_id)
      when 'promo_post' then (select x.title from public.promo_posts x where x.id = r.target_id)
      else null end,
    case r.target_type
      when 'classified_listing' then (select l.status not in ('cancelled') from public.classified_listings l where l.id = r.target_id)
      when 'product' then (select p.active from public.products p where p.id = r.target_id)
      when 'business' then (select b.active from public.businesses b where b.id = r.target_id)
      when 'provider' then (select pp.active from public.provider_profiles pp where pp.user_id = r.target_id)
      when 'user' then (select u.status = 'active' from public.profiles u where u.id = r.target_id)
      when 'promo_post' then (select x.status = 'published' from public.promo_posts x where x.id = r.target_id)
      else null end,
    case r.target_type
      when 'classified_listing' then (select l.owner_id from public.classified_listings l where l.id = r.target_id)
      when 'product' then (select p.seller_id from public.products p where p.id = r.target_id)
      when 'business' then (select b.owner_id from public.businesses b where b.id = r.target_id)
      when 'promo_post' then (select x.owner_id from public.promo_posts x where x.id = r.target_id)
      when 'provider' then r.target_id
      when 'user' then r.target_id
      else null end
  from public.moderation_reports r left join public.profiles rp on rp.id = r.reporter_id
  where p_status is null or r.status = p_status
  order by (r.status in ('open', 'reviewing')) desc, r.created_at desc limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_subscription_payments(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, subscription_id uuid, kind text, subject_id uuid, subject_name text, owner_id uuid, owner_name text, phone text, months integer, amount numeric, method text, reference text, proof_path text, status text, admin_note text, created_at timestamp with time zone, active_until timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select p.id, s.id, s.kind, coalesce(s.provider_id, s.business_id, s.seller_id), public.plan_subject_name(s),
    p.owner_id, coalesce(nullif(pr.full_name, ''), 'Utilizador'), pr.phone,
    p.months, p.amount, p.method, p.reference, p.proof_path, p.status, p.admin_note, p.created_at, public.subscription_active_until(s)
  from public.subscription_payments p join public.subscriptions s on s.id = p.subscription_id
  left join public.profiles pr on pr.id = p.owner_id
  where p_status is null or p.status = p_status
  order by (p.status = 'pending') desc, p.created_at limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_users(p_query text DEFAULT ''::text)
 RETURNS TABLE(id uuid, email text, full_name text, phone text, municipality text, status text, role text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, listings bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query
  select u.id, u.email::text, p.full_name, p.phone, p.municipality, coalesce(p.status,'active'),
         coalesce((select r.role from public.user_roles r where r.user_id = u.id), 'user'),
         u.created_at, u.last_sign_in_at,
         (select count(*) from public.classified_listings l where l.owner_id = u.id)
  from auth.users u left join public.profiles p on p.id = u.id
  where coalesce(p_query,'') = '' or lower(coalesce(u.email,'') || ' ' || coalesce(p.full_name,'')) like '%' || lower(p_query) || '%'
  order by u.created_at desc
  limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_venue_orders(p_status text DEFAULT 'submitted'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select o.id, o.ref_no, o.kind, o.status, o.method, o.subtotal, o.client_fee, o.business_fee, o.total, o.buyer_name, o.buyer_phone, o.reference, o.proof_path,
      o.qr_token, o.note, o.created_at, v.id venue_id, v.ref_no venue_ref, b.name venue_name
    from public.venue_orders o join public.venues v on v.id = o.venue_id join public.businesses b on b.id = v.business_id
    where o.method = 'prepaid' and (coalesce(p_status, '') = '' or o.status = p_status) order by o.created_at desc limit 200) x);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_venue_payments(p_status text DEFAULT 'pending'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.created_at), '[]') from (
    select p.id, p.ref_no, p.venue_id, v.ref_no venue_ref, b.name venue_name, coalesce(nullif(pr.full_name, ''), 'Dono') owner_name, p.amount, p.method, p.reference,
      p.proof_path, p.status, p.admin_note, p.created_at
    from public.venue_platform_payments p join public.venues v on v.id = p.venue_id join public.businesses b on b.id = v.business_id left join public.profiles pr on pr.id = p.owner_id
    where coalesce(p_status, '') = '' or p.status = p_status order by p.created_at limit 300) x);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_venues(p_status text DEFAULT 'pending'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.created_at), '[]') from (
    select v.id, v.ref_no, v.kind, v.subtype, v.status, v.admin_note, v.accepts_prepay, v.created_at, b.id business_id, b.name, b.phone, b.address_text, b.verified,
      coalesce(nullif(pr.full_name, ''), '—') owner_name, (select to_jsonb(y) - 'venue_id' - 'updated_at' from public.venue_pay y where y.venue_id = v.id) pay,
      public.venue_fee_due(v.id) fee_due, public.venue_fees_overdue(v.id) fee_overdue
    from public.venues v join public.businesses b on b.id = v.business_id left join public.profiles pr on pr.id = v.owner_id
    where coalesce(p_status, '') = '' or v.status = p_status order by v.created_at limit 300) x);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_verifications(p_status text DEFAULT 'pending'::text)
 RETURNS TABLE(id uuid, user_id uuid, user_name text, phone text, kind text, business_id uuid, business_name text, document_path text, note text, status text, admin_note text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return query select v.id, v.user_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), p.phone, v.kind, v.business_id, b.name, v.document_path,
    v.note, v.status, v.admin_note, v.created_at
  from public.verification_requests v left join public.profiles p on p.id = v.user_id left join public.businesses b on b.id = v.business_id
  where p_status is null or v.status = p_status
  order by (v.status = 'pending') desc, v.created_at limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_verifications_v2(p_status text DEFAULT 'pending'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return (select coalesce(jsonb_agg(x order by x.pending desc, x.created_at), '[]') from (
    select v.id, v.user_id, coalesce(nullif(p.full_name, ''), 'Utilizador') user_name, p.phone, p.created_at account_created_at, v.kind, v.business_id, b.name business_name,
      v.document_path, v.back_path, v.selfie_path, v.id_number, v.note, v.status, v.admin_note, v.created_at, v.decided_at, v.status = 'pending' pending,
      (select count(*) from public.verification_requests o where o.user_id = v.user_id and o.kind = v.kind and o.status = 'rejected') previous_rejections
    from public.verification_requests v left join public.profiles p on p.id = v.user_id left join public.businesses b on b.id = v.business_id
    where coalesce(p_status, '') = '' or v.status = p_status
    order by (v.status = 'pending') desc, v.created_at limit 200) x);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_mark_payouts_paid(p_ids uuid[], p_bank_reference text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pr public.payout_requests; n integer := 0; ref text := nullif(left(trim(coalesce(p_bank_reference, '')), 120), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  for pr in update public.payout_requests set status = 'paid', paid_at = now(), bank_reference = coalesce(ref, bank_reference), decided_by = auth.uid()
    where id = any(p_ids) and status in ('requested', 'processing') returning * loop
    n := n + 1;
    insert into public.notifications(user_id, type, title, body, data)
    values (pr.user_id, 'system', 'Levantamento pago 💸', pr.amount || ' Kz foram enviados para ' || pr.destination || ' (L-' || pr.ref_no || ').',
      jsonb_build_object('payout_id', pr.id, 'for', 'wallet'));
    insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
    values (auth.uid(), 'payout_paid', 'payout', pr.id, jsonb_build_object('amount', pr.amount, 'reference', ref));
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_moderate_listing(p_listing_id uuid, p_status text, p_featured boolean DEFAULT NULL::boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status is not null and p_status not in ('draft','published','paused','sold','rented','closed','cancelled') then raise exception 'INVALID_STATUS'; end if;
  update public.classified_listings
     set status = coalesce(p_status, status), featured = coalesce(p_featured, featured)
   where id = p_listing_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_reject_payout(p_payout_id uuid, p_note text)
 RETURNS payout_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pr public.payout_requests; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into pr from public.payout_requests where id = p_payout_id for update;
  if not found then raise exception 'PAYOUT_NOT_FOUND'; end if;
  if pr.status not in ('requested', 'processing') then raise exception 'PAYOUT_ALREADY_DECIDED'; end if;
  update public.payout_requests set status = 'rejected', admin_note = txt, decided_by = auth.uid() where id = pr.id returning * into pr;
  perform public.wallet_add(pr.user_id, null, pr.id, 'available', 'payout_returned', pr.amount, 'Levantamento L-' || pr.ref_no || ' não feito');
  insert into public.notifications(user_id, type, title, body, data)
  values (pr.user_id, 'system', 'Levantamento não feito', txt || ' O dinheiro voltou ao seu saldo.', jsonb_build_object('payout_id', pr.id, 'for', 'wallet'));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'payout_rejected', 'payout', pr.id, jsonb_build_object('amount', pr.amount, 'note', txt));
  return pr;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_release_escrow(p_order_id uuid, p_note text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ok boolean; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  if exists (select 1 from public.order_disputes where order_id = p_order_id and status <> 'resolved') then raise exception 'DISPUTE_OPEN'; end if;
  ok := public.escrow_release(p_order_id, 'admin', true);
  if not ok then raise exception 'NOTHING_TO_RELEASE'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'escrow_released', 'order', p_order_id, jsonb_build_object('note', txt));
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(p_report_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('open','reviewing','resolved','dismissed') then raise exception 'INVALID_STATUS'; end if;
  update public.moderation_reports
     set status = p_status,
         resolved_by = case when p_status in ('resolved','dismissed') then auth.uid() else null end,
         resolved_at = case when p_status in ('resolved','dismissed') then now() else null end
   where id = p_report_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_revenue(p_from date, p_to date)
 RETURNS TABLE(paid_at timestamp with time zone, kind text, description text, payer_name text, amount numeric, method text, reference text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then raise exception 'INVALID_PERIOD'; end if;
  return query
  select p.decided_at, 'plan_' || s.kind, public.plan_subject_name(s) || ' · ' || p.months || case when p.months = 1 then ' mês' else ' meses' end,
         coalesce(nullif(pr.full_name, ''), 'Utilizador'), p.amount, p.method, p.reference
  from public.subscription_payments p join public.subscriptions s on s.id = p.subscription_id left join public.profiles pr on pr.id = p.owner_id
  where p.status = 'confirmed' and (p.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select c.decided_at, 'commission', c.listing_title || ' · venda ' || c.sale_amount || ' Kz', coalesce(nullif(pr.full_name, ''), 'Utilizador'), c.amount, c.method, c.reference
  from public.listing_commissions c left join public.profiles pr on pr.id = c.owner_id
  where c.status = 'paid' and (c.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select o.released_at, 'protected_fee', 'Pagamento protegido · ' || public.order_ref(o) || ' · ' || (o.total - o.refunded_amount) || ' Kz',
         coalesce(nullif(pr.full_name, ''), 'Utilizador'), o.platform_fee, null::text, null::text
  from public.orders o left join public.profiles pr on pr.id = o.seller_id
  where o.platform_fee > 0 and (o.released_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select b.decided_at, 'boost', 'Destaque D-' || b.ref_no || ' · ' || l.title || ' · ' || b.days || ' dias', coalesce(nullif(pr.full_name, ''), 'Utilizador'), b.amount, b.method, b.reference
  from public.listing_boosts b join public.classified_listings l on l.id = b.listing_id left join public.profiles pr on pr.id = b.owner_id
  where b.status in ('active', 'expired') and b.amount > 0 and (b.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select i.paid_at, 'inspection', 'Inspeção I-' || i.ref_no || ' · ' || coalesce(public.inspection_target_name(i.kind, i.target_id), ''), coalesce(nullif(pr.full_name, ''), 'Utilizador'),
         i.fee_amount, i.pay_method, i.pay_reference
  from public.inspections i left join public.profiles pr on pr.id = i.owner_id
  where i.paid_at is not null and i.fee_amount > 0 and (i.paid_at at time zone 'Africa/Luanda')::date between p_from and p_to
  union all
  select vp.decided_at, 'venue_fee', 'Taxa de reservas E-' || v.ref_no || ' · ' || bz.name, coalesce(nullif(pr.full_name, ''), 'Utilizador'), vp.amount, vp.method, vp.reference
  from public.venue_platform_payments vp join public.venues v on v.id = vp.venue_id join public.businesses bz on bz.id = v.business_id left join public.profiles pr on pr.id = vp.owner_id
  where vp.status = 'confirmed' and (vp.decided_at at time zone 'Africa/Luanda')::date between p_from and p_to
  order by 1 desc;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_revoke_inspection(p_id uuid, p_note text)
 RETURNS inspections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare i public.inspections; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.inspections set status = 'revoked', admin_note = txt, updated_at = now() where id = p_id and status = 'approved' returning * into i;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'inspection_revoked', i.kind, i.target_id, jsonb_build_object('inspection', i.ref_no, 'note', txt));
  insert into public.notifications(user_id, type, title, body, data)
  values (i.owner_id, 'system', 'Selo «Inspecionado» retirado', coalesce(public.inspection_target_name(i.kind, i.target_id), '') || ': ' || txt,
    jsonb_build_object('for', 'inspection', 'inspection_id', i.id));
  return i;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_schedule_inspection(p_id uuid, p_when timestamp with time zone, p_inspector text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS inspections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare i public.inspections;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_when is null or p_when < now() - interval '1 day' then raise exception 'INSPECTION_DATE_REQUIRED'; end if;
  update public.inspections set status = 'scheduled', scheduled_for = p_when, inspector_name = nullif(left(trim(coalesce(p_inspector, '')), 80), ''),
    admin_note = nullif(left(trim(coalesce(p_note, '')), 500), ''), updated_at = now()
    where id = p_id and status in ('requested', 'scheduled') returning * into i;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (i.owner_id, 'system', '🏅 Inspeção marcada', coalesce(public.inspection_target_name(i.kind, i.target_id), '') || ': ' ||
    to_char(i.scheduled_for at time zone 'Africa/Luanda', 'DD/MM "às" HH24:MI') || coalesce(' · ' || i.inspector_name, '') || '. Esteja no local.',
    jsonb_build_object('for', 'inspection', 'inspection_id', i.id));
  return i;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_courier_status(p_user_id uuid, p_status text)
 RETURNS couriers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.couriers;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('pending', 'approved', 'suspended') then raise exception 'INVALID_STATUS'; end if;
  update public.couriers set status = p_status, updated_at = now() where user_id = p_user_id returning * into c;
  if not found then raise exception 'NOT_COURIER'; end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (p_user_id, 'delivery', case p_status when 'approved' then 'Conta de estafeta aprovada' else 'Conta de estafeta suspensa' end,
    case p_status when 'approved' then 'Já pode aceitar entregas no Huambo Online.' else 'Contacte a administração para mais informações.' end,
    jsonb_build_object('for', 'courier'));
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_fuel_station_status(p_station_id uuid, p_status text, p_note text DEFAULT NULL::text)
 RETURNS fuel_stations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.fuel_stations; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('pending', 'approved', 'suspended') then raise exception 'INVALID_STATUS'; end if;
  if p_status = 'suspended' and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.fuel_stations set status = p_status, admin_note = txt where id = p_station_id returning * into s;
  if not found then raise exception 'FUEL_NOT_FOUND'; end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (s.owner_id, 'system', case p_status when 'approved' then '⛽ Posto aprovado ✔' when 'suspended' then 'Posto suspenso' else 'Posto à espera de revisão' end,
    s.name || case p_status when 'approved' then ': já aparece em «Combustível e gás». Marque quando houver!' else coalesce(': ' || txt, '') end,
    jsonb_build_object('for', 'fuel_station', 'station_id', s.id));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'fuel_station_' || p_status, 'fuel_station', s.id, jsonb_build_object('note', txt));
  return s;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_promo_hidden(p_id uuid, p_hidden boolean, p_reason text DEFAULT NULL::text)
 RETURNS promo_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.promo_posts;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_hidden and nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'REASON_REQUIRED'; end if;
  update public.promo_posts set status = case when p_hidden then 'hidden' else 'published' end, hidden_reason = case when p_hidden then trim(p_reason) end, updated_at = now()
   where id = p_id returning * into p;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_hidden then
    insert into public.notifications(user_id, type, title, body, data)
    values (p.owner_id, 'system', 'Vídeo escondido pela administração', '«' || p.title || '»: ' || trim(p_reason), jsonb_build_object('for', 'promo', 'post_id', p.id));
  end if;
  return p;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_target_active(p_target_type text, p_target_id uuid, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_target_type = 'product' then update public.products set active = p_active where id = p_target_id;
  elsif p_target_type = 'business' then update public.businesses set active = p_active where id = p_target_id;
  elsif p_target_type = 'provider' then update public.provider_profiles set active = p_active where user_id = p_target_id;
  else raise exception 'INVALID_TARGET'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_active then 'show' else 'hide' end, p_target_type, p_target_id, '{}'::jsonb);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id uuid, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if p_role not in ('user','moderator','admin') then raise exception 'INVALID_ROLE'; end if;
  if p_user_id = auth.uid() then raise exception 'CANNOT_CHANGE_SELF'; end if;
  insert into public.user_roles(user_id, role) values (p_user_id, p_role)
  on conflict (user_id) do update set role = excluded.role, updated_at = now();
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_set_user_status(p_user_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('active','suspended','banned') then raise exception 'INVALID_STATUS'; end if;
  if p_user_id = auth.uid() then raise exception 'CANNOT_CHANGE_SELF'; end if;
  update public.profiles set status = p_status where id = p_user_id;
  if p_status <> 'active' then
    update public.classified_listings set status = 'paused' where owner_id = p_user_id and status = 'published';
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_venue_status(p_venue_id uuid, p_status text, p_note text DEFAULT NULL::text)
 RETURNS venues
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.venues; bname text; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  if p_status not in ('pending', 'approved', 'suspended') then raise exception 'INVALID_STATUS'; end if;
  if p_status = 'suspended' and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.venues set status = p_status, admin_note = txt where id = p_venue_id returning * into v;
  if not found then raise exception 'VENUE_NOT_FOUND'; end if;
  select name into bname from public.businesses where id = v.business_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (v.owner_id, 'system', case p_status when 'approved' then 'Estabelecimento aprovado ✔' when 'suspended' then 'Estabelecimento suspenso' else 'Estabelecimento à espera de revisão' end,
    bname || case p_status when 'approved' then ': já recebe reservas e encomendas.' else coalesce(': ' || txt, '') end,
    jsonb_build_object('for', 'venue', 'venue_id', v.id));
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'venue_' || p_status, 'venue', v.id, jsonb_build_object('note', txt));
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_start_payout_batch()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b uuid := gen_random_uuid(); n integer;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  update public.payout_requests set status = 'processing', batch_id = b, processed_at = now(), decided_by = auth.uid() where status = 'requested';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'NO_PAYOUTS'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'payout_batch_started', 'payout_batch', b, jsonb_build_object('count', n));
  return b;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users_suspended', (select count(*) from public.profiles where status <> 'active'),
    'listings_published', (select count(*) from public.classified_listings where status = 'published'),
    'listings_total', (select count(*) from public.classified_listings),
    'listings_7d', (select count(*) from public.classified_listings where created_at > now() - interval '7 days'),
    'reports_open', (select count(*) from public.moderation_reports where status in ('open', 'reviewing')),
    'conversations', (select count(*) from public.conversations),
    'messages_7d', (select count(*) from public.messages where created_at > now() - interval '7 days'),
    'products_active', (select count(*) from public.products where active),
    'providers', (select count(*) from public.provider_profiles where active),
    'businesses', (select count(*) from public.businesses where active),
    'orders_30d', (select count(*) from public.orders where created_at > now() - interval '30 days'),
    'orders_completed_30d', (select count(*) from public.orders where status = 'completed' and updated_at > now() - interval '30 days'),
    'sales_value_30d', (select coalesce(sum(total), 0) from public.orders where status = 'completed' and updated_at > now() - interval '30 days'),
    'services_30d', (select count(*) from public.service_requests where created_at > now() - interval '30 days'),
    'services_done_30d', (select count(*) from public.service_requests where status in ('done', 'confirmed') and updated_at > now() - interval '30 days'),
    'deals_30d', (select count(*) from public.classified_listings where deal_at > now() - interval '30 days'),
    'reviews_30d', (select count(*) from public.user_reviews where created_at > now() - interval '30 days')
                  + (select count(*) from public.reviews where created_at > now() - interval '30 days'),
    'verifications_pending', (select count(*) from public.verification_requests where status = 'pending'),
    'disputes_open', (select count(*) from public.order_disputes where status <> 'resolved'),
    'disputes_escalated', (select count(*) from public.order_disputes where status = 'escalated'),
    'refunds_30d', (select coalesce(sum(amount), 0) from public.order_disputes where outcome = 'refunded' and resolved_at > now() - interval '30 days'),
    'plans_trial', (select count(*) from public.subscriptions s where s.trial_ends_at > now() and (s.paid_until is null or s.paid_until <= now())),
    'plans_paid', (select count(*) from public.subscriptions s where s.paid_until > now()),
    'plans_expired', (select count(*) from public.subscriptions s where public.subscription_active_until(s) <= now()),
    'plan_payments_pending', (select count(*) from public.subscription_payments where status = 'pending'),
    'plan_revenue_30d', (select coalesce(sum(amount), 0) from public.subscription_payments where status = 'confirmed' and decided_at > now() - interval '30 days')
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_update_commission(p_id uuid, p_action text, p_note text DEFAULT NULL::text, p_sale_amount numeric DEFAULT NULL::numeric)
 RETURNS listing_commissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.listing_commissions; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into c from public.listing_commissions where id = p_id for update;
  if not found then raise exception 'COMMISSION_NOT_FOUND'; end if;
  if p_action = 'confirm' and c.status in ('submitted', 'due') then
    update public.listing_commissions set status = 'paid', admin_note = txt, decided_by = auth.uid(), decided_at = now() where id = c.id returning * into c;
  elsif p_action = 'reject' and c.status = 'submitted' then
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
    update public.listing_commissions set status = 'due', admin_note = txt, decided_by = auth.uid(), decided_at = now() where id = c.id returning * into c;
  elsif p_action = 'waive' and c.status in ('due', 'submitted') then
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
    update public.listing_commissions set status = 'waived', admin_note = txt, decided_by = auth.uid(), decided_at = now() where id = c.id returning * into c;
  elsif p_action = 'adjust' and c.status in ('due', 'submitted') then
    if p_sale_amount is null or p_sale_amount < 0 then raise exception 'INVALID_AMOUNT'; end if;
    update public.listing_commissions set sale_amount = p_sale_amount, amount = round(p_sale_amount * rate_pct / 100), admin_note = coalesce(txt, admin_note)
     where id = c.id returning * into c;
  else raise exception 'INVALID_TRANSITION'; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'commission_' || p_action, 'classified_listing', c.listing_id, jsonb_build_object('commission_id', c.id, 'amount', c.amount, 'note', txt));
  insert into public.notifications(user_id, type, title, body, data)
  values (c.owner_id, 'system',
    case p_action when 'confirm' then 'Comissão paga ✔' when 'reject' then 'Pagamento da comissão não confirmado' when 'waive' then 'Comissão anulada' else 'Comissão corrigida' end,
    '«' || c.listing_title || '»: ' || case p_action when 'confirm' then 'pagamento de ' || c.amount || ' Kz confirmado.' when 'adjust' then 'nova comissão ' || c.amount || ' Kz.' else coalesce(txt, '') end,
    jsonb_build_object('listing_id', c.listing_id, 'for', 'commission'));
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.agent_commission_create(p_listing_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; a public.field_agents; st public.platform_settings; offer_amt numeric; amt numeric; fee numeric;
begin
  select * into l from public.classified_listings where id = p_listing_id;
  if not found or l.agent_id is null or l.status <> 'sold' or l.purpose not in ('sale', 'auction') then return; end if;
  if exists (select 1 from public.agent_commissions where listing_id = l.id and status <> 'cancelled') then return; end if;
  select * into a from public.field_agents where user_id = l.agent_id;
  if not found or a.status <> 'active' or a.user_id = l.owner_id then return; end if;
  select * into st from public.platform_settings where id = 1;
  if l.deal_with is not null then
    select o.amount into offer_amt from public.listing_offers o where o.listing_id = l.id and o.buyer_id = l.deal_with and o.status = 'accepted' and o.amount is not null
     order by o.responded_at desc nulls last limit 1;
  end if;
  amt := coalesce(l.sale_amount, offer_amt, l.price);
  if amt is null or amt <= 0 or st.agent_sale_pct <= 0 then return; end if;
  fee := round(amt * st.agent_sale_pct / 100);
  if fee <= 0 then return; end if;
  insert into public.agent_commissions(agent_id, listing_id, listing_title, owner_id, amount, sale_amount, rate_pct)
  values (a.user_id, l.id, left(l.title, 200), l.owner_id, fee, amt, st.agent_sale_pct);
  insert into public.notifications(user_id, type, title, body, data)
  values (a.user_id, 'system', 'Venda! 🎉', '«' || left(l.title, 120) || '» foi vendido por ' || amt || ' Kz. A sua comissão de ' || fee
    || ' Kz está à espera de confirmação.', jsonb_build_object('for', 'agent'));
end $function$
;

CREATE OR REPLACE FUNCTION public.angola_iban_digits(p text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare s text := upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if s ~ '^AO06[0-9]{21}$' then s := substr(s, 5); end if;
  if s !~ '^[0-9]{21}$' then return null; end if;
  if mod((s || '102406')::numeric, 97) <> 1 then return null; end if;
  return s;
end $function$
;

CREATE OR REPLACE FUNCTION public.angola_today()
 RETURNS date
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ select (now() at time zone 'Africa/Luanda')::date $function$
;

CREATE OR REPLACE FUNCTION public.apply_field_agent(p_market_id uuid, p_full_name text, p_phone text, p_note text DEFAULT NULL::text)
 RETURNS field_agents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.field_agents; me uuid := auth.uid(); ph text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if char_length(trim(coalesce(p_full_name, ''))) < 3 then raise exception 'NAME_REQUIRED'; end if;
  if char_length(ph) < 9 then raise exception 'PHONE_REQUIRED'; end if;
  if p_market_id is null or not exists (select 1 from public.markets where id = p_market_id and status = 'active') then raise exception 'MARKET_REQUIRED'; end if;
  select * into a from public.field_agents where user_id = me for update;
  if not found then
    insert into public.field_agents(user_id, market_id, full_name, phone, note)
    values (me, p_market_id, trim(p_full_name), ph, nullif(left(trim(coalesce(p_note, '')), 500), '')) returning * into a;
    perform public.notify_staff('Pedido para ser agente', a.full_name || ' · ' || a.code, jsonb_build_object('agent_id', me));
  elsif a.status = 'suspended' then raise exception 'AGENT_SUSPENDED';
  else
    update public.field_agents set market_id = p_market_id, full_name = trim(p_full_name), phone = ph,
      note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
      status = case when a.status = 'rejected' then 'pending' else a.status end
    where user_id = me returning * into a;
    if a.status = 'pending' then perform public.notify_staff('Pedido para ser agente', a.full_name || ' · ' || a.code, jsonb_build_object('agent_id', me)); end if;
  end if;
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.apply_notification_preferences()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.notification_preferences;
begin
  select * into p from public.notification_preferences where user_id = new.user_id;
  if not found then return new; end if;
  if not p.enabled then return null; end if;
  if (new.type = 'saved_search' and not p.saved_search) or (new.type = 'message' and not p.messages)
     or (new.type in ('auction','bid') and not p.auctions) or (new.type in ('order','delivery') and not p.marketplace)
     or (new.type = 'review' and not p.reviews) or (new.type = 'system' and not p.system) then
    return null;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.assign_delivery(p_delivery_id uuid, p_assignee uuid)
 RETURNS delivery_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.delivery_requests;
begin
  if not public.has_admin_role() then raise exception 'ADMIN_ONLY'; end if;
  select * into v from public.delivery_requests where id = p_delivery_id for update;
  if not found then raise exception 'DELIVERY_NOT_FOUND'; end if;
  if v.status not in ('pending','assigned') then raise exception 'DELIVERY_NOT_ASSIGNABLE'; end if;
  update public.delivery_requests set assigned_to = p_assignee, status = 'assigned', assigned_at = now() where id = p_delivery_id returning * into v;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.auction_bids_for(p_auction_id uuid)
 RETURNS TABLE(id uuid, bidder_label text, amount numeric, created_at timestamp with time zone, is_mine boolean, retracted boolean, retract_reason text, retracted_by_seller boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions; see_names boolean;
begin
  select * into a from public.auctions where auctions.id = p_auction_id;
  if not found or (a.status not in ('live', 'ended') and a.seller_id is distinct from auth.uid() and not public.has_admin_role()) then raise exception 'AUCTION_NOT_FOUND'; end if;
  see_names := a.seller_id = auth.uid() or public.has_admin_role();
  return query
  with ranked as (
    select b.*, dense_rank() over (order by first_bid.first_at, b.bidder_id) as n
    from public.auction_bids b
    join (select x.bidder_id, min(x.created_at) first_at from public.auction_bids x where x.auction_id = a.id group by x.bidder_id) first_bid on first_bid.bidder_id = b.bidder_id
    where b.auction_id = a.id)
  select r.id,
    case when r.bidder_id = auth.uid() then 'Você'
         when see_names then coalesce(nullif((select p.full_name from public.profiles p where p.id = r.bidder_id), ''), 'Licitador ' || r.n)
         else 'Licitador ' || r.n end,
    r.amount, r.created_at, r.bidder_id = auth.uid(), r.retracted_at is not null,
    case when r.retracted_at is not null then r.retract_reason end, r.retracted_by is not null and r.retracted_by <> r.bidder_id
  from ranked r order by r.amount desc, r.created_at asc limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.auction_bids_for_v2(p_auction_id uuid)
 RETURNS TABLE(id uuid, bidder_label text, amount numeric, created_at timestamp with time zone, is_mine boolean, is_auto boolean, retracted boolean, retract_reason text, retracted_by_seller boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions; see_names boolean;
begin
  select * into a from public.auctions where auctions.id = p_auction_id;
  if not found or (a.status not in ('live', 'ended') and a.seller_id is distinct from auth.uid() and not public.has_admin_role()) then raise exception 'AUCTION_NOT_FOUND'; end if;
  see_names := a.seller_id = auth.uid() or public.has_admin_role();
  return query
  with ranked as (
    select b.*, dense_rank() over (order by first_bid.first_at, b.bidder_id) as n
    from public.auction_bids b
    join (select x.bidder_id, min(x.created_at) first_at from public.auction_bids x where x.auction_id = a.id group by x.bidder_id) first_bid on first_bid.bidder_id = b.bidder_id
    where b.auction_id = a.id)
  select r.id,
    case when r.bidder_id = auth.uid() then 'Você'
         when see_names then coalesce(nullif((select p.full_name from public.profiles p where p.id = r.bidder_id), ''), 'Licitador ' || r.n)
         else 'Licitador ' || r.n end,
    r.amount, r.created_at, r.bidder_id = auth.uid(), r.is_auto, r.retracted_at is not null,
    case when r.retracted_at is not null then r.retract_reason end, r.retracted_by is not null and r.retracted_by <> r.bidder_id
  from ranked r order by r.created_at desc, r.amount desc limit 200;
end $function$
;

CREATE OR REPLACE FUNCTION public.auction_drop_bidder(a auctions, p_bidder uuid, p_by uuid, p_reason text)
 RETURNS auctions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare before record; after record;
begin
  select * into before from public.auction_standing(a.id);
  update public.auction_max_bids set retracted_at = now(), retracted_by = p_by, retract_reason = p_reason
   where auction_id = a.id and bidder_id = p_bidder and retracted_at is null;
  update public.auction_bids set retracted_at = now(), retracted_by = p_by, retract_reason = p_reason
   where auction_id = a.id and bidder_id = p_bidder and retracted_at is null;
  select * into after from public.auction_standing(a.id);
  update public.auctions set current_price = after.price, updated_at = now() where id = a.id returning * into a;
  if after.leader is not null and after.leader is distinct from before.leader then
    insert into public.auction_bids(auction_id, bidder_id, amount, is_auto) values (a.id, after.leader, after.price, true);
    insert into public.notifications(user_id, type, title, body, data)
    values (after.leader, 'bid', 'Voltou a ganhar o leilão', 'Um lance maior foi retirado em «' || a.title || '». Está a ganhar com ' || after.price || ' Kz.',
            jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  end if;
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.auction_for_listing(p_listing_id uuid)
 RETURNS TABLE(id uuid, seller_id uuid, title text, starting_price numeric, reserve_met boolean, min_increment numeric, current_price numeric, starts_at timestamp with time zone, ends_at timestamp with time zone, status text, winner_id uuid, bid_count bigint, my_best numeric, leader_is_me boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.id, a.seller_id, a.title, a.starting_price,
         (a.reserve_price is null or coalesce((select s.leader_max from public.auction_standing(a.id) s), 0) >= a.reserve_price),
         public.auction_increment(a.current_price, a.min_increment), a.current_price, a.starts_at, a.ends_at, a.status, a.winner_id,
         (select count(*) from public.auction_bids b where b.auction_id = a.id and b.retracted_at is null),
         (select m.max_amount from public.auction_max_bids m where m.auction_id = a.id and m.bidder_id = auth.uid() and m.retracted_at is null),
         coalesce((select s.leader = auth.uid() from public.auction_standing(a.id) s), false)
  from public.auctions a
  where a.classified_listing_id = p_listing_id and (a.status in ('scheduled','live','ended') or a.seller_id = auth.uid())
  order by a.created_at desc limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.auction_for_listing_v2(p_listing_id uuid)
 RETURNS TABLE(id uuid, seller_id uuid, title text, starting_price numeric, reserve_met boolean, has_reserve boolean, min_increment numeric, current_price numeric, starts_at timestamp with time zone, ends_at timestamp with time zone, status text, winner_id uuid, bid_count bigint, my_best numeric, leader_is_me boolean, buy_now_price numeric, buy_now_available boolean, bought_now boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.id, a.seller_id, a.title, a.starting_price,
         (a.reserve_price is null or coalesce((select s.leader_max from public.auction_standing(a.id) s), 0) >= a.reserve_price), a.reserve_price is not null,
         public.auction_increment(a.current_price, a.min_increment), a.current_price, a.starts_at, a.ends_at, a.status, a.winner_id,
         (select count(*) from public.auction_bids b where b.auction_id = a.id and b.retracted_at is null),
         (select m.max_amount from public.auction_max_bids m where m.auction_id = a.id and m.bidder_id = auth.uid() and m.retracted_at is null),
         coalesce((select s.leader = auth.uid() from public.auction_standing(a.id) s), false),
         a.buy_now_price,
         a.buy_now_price is not null and a.status = 'live' and now() < a.ends_at
           and not exists (select 1 from public.auction_max_bids m where m.auction_id = a.id and m.retracted_at is null),
         a.bought_now
  from public.auctions a
  where a.classified_listing_id = p_listing_id and (a.status in ('scheduled','live','ended') or a.seller_id = auth.uid())
  order by a.created_at desc limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.auction_increment(p_price numeric, p_min numeric DEFAULT 0)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select greatest(coalesce(p_min, 0), case
    when p_price < 1000 then 50 when p_price < 5000 then 100 when p_price < 25000 then 250 when p_price < 100000 then 500
    when p_price < 250000 then 1000 when p_price < 1000000 then 2500 when p_price < 5000000 then 5000 else 10000 end);
$function$
;

CREATE OR REPLACE FUNCTION public.auction_mark_listing_sold()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'ended' and old.status is distinct from 'ended' and new.winner_id is not null and new.classified_listing_id is not null then
    update public.classified_listings set sale_amount = new.current_price, deal_with = coalesce(deal_with, new.winner_id), deal_at = coalesce(deal_at, now()), status = 'sold'
     where id = new.classified_listing_id and status <> 'sold';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.auction_recalc(p_auction_id uuid)
 RETURNS auctions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions;
begin
  update public.auctions x set current_price = coalesce((select max(b.amount) from public.auction_bids b where b.auction_id = x.id and b.retracted_at is null), x.starting_price),
    updated_at = now()
   where x.id = p_auction_id returning * into a;
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.auction_standing(p_auction_id uuid, OUT leader uuid, OUT leader_max numeric, OUT price numeric)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions; second_max numeric;
begin
  select * into a from public.auctions where id = p_auction_id;
  select m.bidder_id, m.max_amount into leader, leader_max from public.auction_max_bids m
   where m.auction_id = p_auction_id and m.retracted_at is null order by m.max_amount desc, m.max_set_at asc limit 1;
  if leader is null then price := a.starting_price; return; end if;
  select m.max_amount into second_max from public.auction_max_bids m
   where m.auction_id = p_auction_id and m.retracted_at is null order by m.max_amount desc, m.max_set_at asc offset 1 limit 1;
  price := case when second_max is null then a.starting_price
                else least(leader_max, second_max + public.auction_increment(second_max, a.min_increment)) end;
  if a.reserve_price is not null and leader_max >= a.reserve_price then price := greatest(price, a.reserve_price); end if;
  price := least(greatest(price, a.starting_price), leader_max);
end $function$
;

CREATE OR REPLACE FUNCTION public.audit_admin_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n jsonb := to_jsonb(new); o jsonb := to_jsonb(old); owner text; changes jsonb := '{}'::jsonb; k text;
begin
  if auth.uid() is null or not public.has_admin_role() then return new; end if;
  owner := coalesce(n->>'owner_id', n->>'user_id', case when tg_table_name = 'profiles' then n->>'id' end);
  if owner is not null and owner = auth.uid()::text and tg_table_name <> 'user_roles' then return new; end if;
  foreach k in array array['status', 'role', 'featured', 'active', 'verified', 'kyc_level'] loop
    if n ? k and (o is null or (n->k) is distinct from (o->k)) then changes := changes || jsonb_build_object(k, n->k); end if;
  end loop;
  if changes = '{}'::jsonb then return new; end if;
  insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'update', tg_table_name, coalesce((n->>'id')::uuid, (n->>'user_id')::uuid), changes);
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.available_deliveries()
 RETURNS TABLE(id uuid, order_id uuid, requested_at timestamp with time zone, notes text, total numeric, currency text, delivery_text text, seller_name text, seller_municipality text, items jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_approved_courier() then raise exception 'NOT_APPROVED_COURIER'; end if;
  return query select d.id, d.order_id, d.requested_at, d.notes, o.total, o.currency, o.delivery_text,
    coalesce(nullif(sp.full_name, ''), 'Vendedor'), sp.municipality,
    (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'quantity', oi.quantity) order by p.name), '[]')
       from public.order_items oi join public.products p on p.id = oi.product_id where oi.order_id = o.id)
  from public.delivery_requests d join public.orders o on o.id = d.order_id
  left join public.profiles sp on sp.id = o.seller_id
  where d.status = 'pending' and o.seller_id <> auth.uid() and o.buyer_id <> auth.uid()
  order by d.requested_at limit 100;
end $function$
;

CREATE OR REPLACE FUNCTION public.boost_expire()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l record; n integer := 0;
begin
  perform set_config('huambo.allow_feature', 'on', true);
  for l in update public.classified_listings set featured = false, featured_until = null
      where featured_until is not null and featured_until <= now() returning id, owner_id, title loop
    n := n + 1;
    insert into public.notifications(user_id, type, title, body, data)
    values (l.owner_id, 'system', 'O destaque terminou', '«' || l.title || '» já não está em destaque. Pode destacar outra vez em «Os meus anúncios».',
      jsonb_build_object('listing_id', l.id, 'for', 'boost'));
  end loop;
  perform set_config('huambo.allow_feature', '', true);
  update public.listing_boosts set status = 'expired' where status = 'active' and ends_at <= now();
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.business_directory(p_query text DEFAULT ''::text, p_category_id uuid DEFAULT NULL::uuid, p_municipality_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 30)
 RETURNS TABLE(id uuid, owner_id uuid, name text, description text, category_id uuid, category_name text, municipality_id uuid, municipality_name text, phone text, whatsapp text, logo_url text, address_text text, verified boolean, rating numeric, review_count bigint, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select b.id, b.owner_id, b.name, b.description, b.category_id, coalesce(c.name, b.custom_category), b.municipality_id, m.name,
         b.phone, b.whatsapp, b.logo_url, b.address_text, b.verified,
         coalesce(round(avg(r.rating)::numeric, 1), 0), count(distinct r.id), b.created_at
  from public.businesses b
  left join public.categories c on c.id = b.category_id
  left join public.municipalities m on m.id = b.municipality_id
  left join public.reviews r on r.business_id = b.id and r.status = 'published'
  where b.active
    and (p_category_id is null or b.category_id = p_category_id)
    and (p_municipality_id is null or b.municipality_id = p_municipality_id)
    and (coalesce(p_query, '') = '' or public.fold_text(concat_ws(' ', b.name, b.description, b.custom_category, c.name)) like '%' || public.fold_text(trim(p_query)) || '%')
  group by b.id, c.name, m.name
  order by b.verified desc, count(distinct r.id) desc, b.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$function$
;

CREATE OR REPLACE FUNCTION public.business_stats(p_business_id uuid)
 RETURNS TABLE(rating numeric, review_count bigint, confirmed_reviews bigint, services_requested bigint, services_done bigint, sales_done bigint, member_since timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    (select round(avg(rating)::numeric, 1) from public.reviews where business_id = p_business_id and status = 'published'),
    (select count(*) from public.reviews where business_id = p_business_id and status = 'published'),
    (select count(*) from public.reviews where business_id = p_business_id and status = 'published' and service_request_id is not null),
    (select count(*) from public.service_requests where business_id = p_business_id),
    (select count(*) from public.service_requests where business_id = p_business_id and status in ('done', 'confirmed')),
    (select count(*) from public.orders o join public.businesses b on b.owner_id = o.seller_id where b.id = p_business_id and o.status = 'completed'),
    (select created_at from public.businesses where id = p_business_id);
$function$
;

CREATE OR REPLACE FUNCTION public.buy_auction_now(p_auction_id uuid)
 RETURNS auctions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if a.status <> 'live' or now() < a.starts_at or now() >= a.ends_at then raise exception 'AUCTION_NOT_LIVE'; end if;
  if a.seller_id = auth.uid() then raise exception 'SELLER_CANNOT_BID'; end if;
  if a.buy_now_price is null then raise exception 'BUY_NOW_NOT_AVAILABLE'; end if;
  if exists (select 1 from public.auction_max_bids where auction_id = a.id and retracted_at is null) then raise exception 'BUY_NOW_NOT_AVAILABLE'; end if;
  if exists (select 1 from public.auction_max_bids where auction_id = a.id and bidder_id = auth.uid() and retracted_by is not null and retracted_by <> auth.uid()) then raise exception 'BIDDER_BLOCKED'; end if;
  update public.auctions set status = 'ended', winner_id = auth.uid(), current_price = buy_now_price, bought_now = true, ends_at = greatest(now(), starts_at + interval '1 second'), updated_at = now()
   where id = a.id returning * into a;
  insert into public.notifications(user_id, type, title, body, data)
  values (auth.uid(), 'auction', 'Comprou já! 🎉', 'Comprou «' || a.title || '» por ' || a.current_price || ' Kz. Contacte o vendedor para combinar a entrega.',
          jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id)),
         (a.seller_id, 'auction', 'Vendido com «Comprar já»', '«' || a.title || '» foi comprado por ' || a.current_price || ' Kz. O comprador vai contactá-lo.',
          jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.buyer_listing_claim(p_claim_id uuid, p_action text, p_note text DEFAULT NULL::text)
 RETURNS listing_claims
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.listing_claims; txt text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  select * into c from public.listing_claims where id = p_claim_id for update;
  if not found or c.buyer_id <> auth.uid() then raise exception 'CLAIM_NOT_FOUND'; end if;
  if p_action = 'confirm' and c.status in ('accepted', 'open', 'escalated', 'declined') then
    update public.listing_claims set status = 'resolved', outcome = 'done', resolved_at = now(), updated_at = now() where id = c.id returning * into c;
  elsif p_action = 'withdraw' and c.status <> 'resolved' then
    update public.listing_claims set status = 'resolved', outcome = 'withdrawn', resolved_at = now(), updated_at = now() where id = c.id returning * into c;
  elsif p_action = 'escalate' and (c.status = 'declined' or (c.status in ('open', 'accepted') and (c.respond_by < now() or c.status = 'accepted'))) then
    update public.listing_claims set status = 'escalated', admin_note = coalesce(admin_note, txt), updated_at = now() where id = c.id returning * into c;
    perform public.notify_staff('Reclamação de anúncio para decidir', 'R-' || c.ref_no || ' · ' || left(c.listing_title, 100), jsonb_build_object('claim_id', c.id));
  else raise exception 'INVALID_TRANSITION'; end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (c.seller_id, 'system', case p_action when 'confirm' then 'Reclamação resolvida ✔' when 'withdraw' then 'Reclamação retirada' else 'Reclamação enviada à administração' end,
    '«' || left(c.listing_title, 120) || '» (R-' || c.ref_no || ')' || case when txt is not null then ': ' || txt else '.' end, jsonb_build_object('for', 'claim'));
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.cancel_delivery_request(p_delivery_id uuid)
 RETURNS delivery_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.delivery_requests;
begin
  select * into d from public.delivery_requests where id = p_delivery_id for update;
  if not found then raise exception 'DELIVERY_NOT_FOUND'; end if;
  if d.requester_id <> auth.uid() and not public.has_admin_role() then raise exception 'NOT_DELIVERY_PARTY'; end if;
  if d.status not in ('pending', 'assigned', 'accepted') then raise exception 'DELIVERY_IN_PROGRESS'; end if;
  update public.delivery_requests set status = 'cancelled' where id = d.id returning * into d;
  if d.assigned_to is not null then
    insert into public.notifications(user_id, type, title, body, data)
    values (d.assigned_to, 'delivery', 'Entrega cancelada', 'O vendedor cancelou o pedido de entrega.', jsonb_build_object('delivery_id', d.id, 'for', 'courier'));
  end if;
  return d;
end $function$
;

CREATE OR REPLACE FUNCTION public.cancel_event(p_event_id uuid, p_reason text)
 RETURNS events
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e public.events; txt text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  select * into e from public.events where id = p_event_id for update;
  if not found or (e.organizer_id <> auth.uid() and not public.has_admin_role()) then raise exception 'NOT_EVENT_ORGANIZER'; end if;
  if e.status = 'cancelled' then raise exception 'EVENT_CANCELLED'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  perform set_config('huambo.allow_cancel', 'on', true);
  update public.events set status = 'cancelled', cancel_reason = txt where id = e.id returning * into e;
  perform set_config('huambo.allow_cancel', '', true);
  update public.event_tickets set status = 'void' where event_id = e.id and status = 'valid';
  update public.event_orders set status = 'cancelled', decided_at = now() where event_id = e.id and status in ('reserved', 'submitted');
  insert into public.notifications(user_id, type, title, body, data)
  select distinct o.buyer_id, 'system', 'Evento cancelado', '«' || left(e.title, 80) || '» foi cancelado: ' || txt || ' Se já pagou, o organizador tem de devolver o dinheiro.',
    jsonb_build_object('for', 'tickets', 'event_id', e.id)
  from public.event_orders o where o.event_id = e.id and o.status in ('confirmed', 'cancelled');
  return e;
end $function$
;

CREATE OR REPLACE FUNCTION public.cancel_event_ticket_order(p_order_id uuid)
 RETURNS event_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.event_orders;
begin
  select * into o from public.event_orders where id = p_order_id for update;
  if not found or o.buyer_id <> auth.uid() then raise exception 'TICKET_ORDER_NOT_FOUND'; end if;
  if o.status not in ('reserved', 'submitted', 'rejected') then raise exception 'INVALID_TRANSITION'; end if;
  update public.event_orders set status = 'cancelled', decided_at = now() where id = o.id returning * into o;
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.cancel_fuel_order(p_order_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS fuel_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.fuel_orders; s public.fuel_stations; me uuid := auth.uid(); txt text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  select * into o from public.fuel_orders where id = p_order_id for update;
  if not found then raise exception 'FUEL_ORDER_NOT_FOUND'; end if;
  select * into s from public.fuel_stations where id = o.station_id;
  if o.buyer_id = me then
    if o.status not in ('reserved', 'awaiting_payment', 'rejected') then raise exception 'INVALID_TRANSITION'; end if;
  elsif s.owner_id = me then
    if o.status not in ('reserved', 'awaiting_payment', 'submitted', 'paid', 'rejected') then raise exception 'INVALID_TRANSITION'; end if;
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
  else raise exception 'FUEL_ORDER_NOT_FOUND'; end if;
  update public.fuel_orders set status = 'cancelled', note = coalesce(txt, note), updated_at = now() where id = o.id returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (case when o.buyer_id = me then s.owner_id else o.buyer_id end, 'system', '⛽ Pedido cancelado',
    'C-' || o.ref_no || ' · ' || s.name || coalesce(': ' || txt, '') || case when s.owner_id = me and o.status = 'cancelled' and o.method = 'prepaid' and o.reference is not null then ' O posto deve devolver o dinheiro.' else '' end,
    jsonb_build_object('for', case when o.buyer_id = me then 'fuel_station' else 'fuel_orders' end, 'station_id', s.id));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.cancel_inspection(p_id uuid)
 RETURNS inspections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare i public.inspections;
begin
  update public.inspections set status = 'cancelled', updated_at = now()
    where id = p_id and owner_id = auth.uid() and (status = 'awaiting_payment' or (fee_amount = 0 and status in ('requested', 'scheduled'))) returning * into i;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;
  return i;
end $function$
;
CREATE OR REPLACE FUNCTION public.cancel_payout(p_payout_id uuid)
 RETURNS payout_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pr public.payout_requests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into pr from public.payout_requests where id = p_payout_id for update;
  if not found or pr.user_id <> auth.uid() then raise exception 'PAYOUT_NOT_FOUND'; end if;
  if pr.status <> 'requested' then raise exception 'PAYOUT_IN_PROGRESS'; end if;
  update public.payout_requests set status = 'cancelled' where id = pr.id returning * into pr;
  perform public.wallet_add(pr.user_id, null, pr.id, 'available', 'payout_returned', pr.amount, 'Levantamento L-' || pr.ref_no || ' cancelado');
  return pr;
end $function$
;

CREATE OR REPLACE FUNCTION public.cancel_rental_request(p_request_id uuid)
 RETURNS rental_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.rental_requests;
begin
  select * into r from public.rental_requests where id = p_request_id for update;
  if not found or r.renter_id <> auth.uid() then raise exception 'RENTAL_NOT_FOUND'; end if;
  if r.status not in ('pending','accepted') then raise exception 'RENTAL_ALREADY_ANSWERED'; end if;
  update public.rental_requests set status = 'cancelled', updated_at = now() where id = r.id returning * into r;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.cancel_venue_order(p_order_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS venue_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.venue_orders; v public.venues; me uuid := auth.uid(); was text; txt text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  select * into o from public.venue_orders where id = p_order_id for update;
  if not found then raise exception 'VENUE_ORDER_NOT_FOUND'; end if;
  select * into v from public.venues where id = o.venue_id;
  was := o.status;
  if o.buyer_id = me then
    if o.status not in ('reserved', 'awaiting_payment', 'rejected') then raise exception 'INVALID_TRANSITION'; end if;
  elsif v.owner_id = me then
    if o.status not in ('reserved', 'awaiting_payment', 'submitted', 'paid', 'rejected') then raise exception 'INVALID_TRANSITION'; end if;
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
  else raise exception 'VENUE_ORDER_NOT_FOUND'; end if;
  update public.venue_orders set status = 'cancelled', note = coalesce(txt, note), updated_at = now() where id = o.id returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (case when o.buyer_id = me then v.owner_id else o.buyer_id end, 'system', 'Pedido cancelado',
    'R-' || o.ref_no || coalesce(': ' || txt, '') || case when v.owner_id = me and was in ('submitted', 'paid') then ' O estabelecimento deve devolver o dinheiro.' else '' end,
    case when o.buyer_id = me then jsonb_build_object('for', 'venue', 'venue_id', v.id) else jsonb_build_object('for', 'venue_orders') end);
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.cart_add(p_product_id uuid, p_quantity integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cid uuid; p public.products;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'INVALID_QUANTITY'; end if;
  select * into p from public.products where id = p_product_id and active;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if p.seller_id = auth.uid() then raise exception 'CANNOT_BUY_OWN_PRODUCT'; end if;
  insert into public.carts(user_id) values (auth.uid()) on conflict (user_id) do update set updated_at = now() returning id into cid;
  insert into public.cart_items(cart_id, product_id, quantity) values (cid, p_product_id, least(p_quantity, greatest(p.stock, 1)))
  on conflict (cart_id, product_id) do update set
    quantity = least(case when public.cart_items.ordered_at is null then public.cart_items.quantity else 0 end + excluded.quantity, greatest(p.stock, 1)),
    ordered_at = null;
end $function$
;

CREATE OR REPLACE FUNCTION public.cart_contents()
 RETURNS TABLE(product_id uuid, name text, price numeric, currency text, stock integer, active boolean, media jsonb, seller_id uuid, seller_name text, quantity integer, line_total numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.name, p.price, p.currency, p.stock, p.active, p.media, p.seller_id, coalesce(nullif(pr.full_name, ''), 'Vendedor'),
         ci.quantity, p.price * ci.quantity
  from public.carts c join public.cart_items ci on ci.cart_id = c.id join public.products p on p.id = ci.product_id
  left join public.profiles pr on pr.id = p.seller_id
  where c.user_id = auth.uid() and ci.ordered_at is null
  order by pr.full_name, p.name;
$function$
;

CREATE OR REPLACE FUNCTION public.cart_delivery_quote(p_municipality_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('seller_id', x.seller_id, 'seller_name', x.seller_name, 'subtotal', x.sub,
    'quote', public.seller_delivery_quote(x.seller_id, p_municipality_id, x.sub)) order by x.seller_name), '[]')
  from (select p.seller_id, coalesce(nullif(pr.full_name, ''), 'Vendedor') seller_name, sum(p.price * ci.quantity) sub
        from public.carts c join public.cart_items ci on ci.cart_id = c.id and ci.ordered_at is null join public.products p on p.id = ci.product_id
        left join public.profiles pr on pr.id = p.seller_id
        where c.user_id = auth.uid() group by p.seller_id, pr.full_name) x
$function$
;

CREATE OR REPLACE FUNCTION public.cart_set_quantity(p_product_id uuid, p_quantity integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(p_quantity, 0) < 1 then raise exception 'INVALID_QUANTITY'; end if;
  select id into cid from public.carts where user_id = auth.uid();
  if cid is null then return; end if;
  update public.cart_items ci set quantity = least(p_quantity, greatest(p.stock, 1))
  from public.products p where ci.cart_id = cid and ci.product_id = p_product_id and p.id = ci.product_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.check_agent_code(p_code text)
 RETURNS TABLE(code text, first_name text, market_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.code, split_part(trim(a.full_name), ' ', 1), m.name
  from public.field_agents a left join public.markets m on m.id = a.market_id
  where a.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) and a.status = 'active'
$function$
;

CREATE OR REPLACE FUNCTION public.check_in_event_ticket(p_event_id uuid, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e public.events; t public.event_tickets; c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); tn text; holder text;
begin
  select * into e from public.events where id = p_event_id;
  if not found or e.organizer_id <> auth.uid() then raise exception 'NOT_EVENT_ORGANIZER'; end if;
  if c like 'HO%' then c := substr(c, 3); end if;
  if char_length(c) <> 8 then return jsonb_build_object('result', 'invalid'); end if;
  c := 'HO-' || substr(c, 1, 4) || '-' || substr(c, 5, 4);
  select * into t from public.event_tickets where code = c for update;
  if not found or t.event_id <> e.id then return jsonb_build_object('result', 'invalid', 'code', c); end if;
  select name into tn from public.event_ticket_types where id = t.ticket_type_id;
  select buyer_name into holder from public.event_orders where id = t.order_id;
  if t.status = 'void' then return jsonb_build_object('result', 'void', 'code', c, 'type', tn, 'holder', holder); end if;
  if t.status = 'used' then return jsonb_build_object('result', 'used', 'code', c, 'type', tn, 'holder', holder, 'at', t.checked_in_at); end if;
  update public.event_tickets set status = 'used', checked_in_at = now(), checked_in_by = auth.uid() where id = t.id;
  return jsonb_build_object('result', 'ok', 'code', c, 'type', tn, 'holder', holder);
end $function$
;

CREATE OR REPLACE FUNCTION public.checkout_cart(p_cart_id uuid, p_delivery_address_id uuid DEFAULT NULL::uuid, p_delivery_fee numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_order uuid;
  v_subtotal numeric(14,2);
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.carts where id=p_cart_id and user_id=v_user) then raise exception 'CART_NOT_FOUND'; end if;

  select coalesce(sum(p.price * ci.quantity),0)
    into v_subtotal
  from public.cart_items ci
  join public.products p on p.id=ci.product_id
  where ci.cart_id=p_cart_id and p.active=true and p.stock >= ci.quantity;

  if v_subtotal is null or v_subtotal=0 then raise exception 'CART_EMPTY_OR_UNAVAILABLE'; end if;

  if exists (
    select 1 from public.cart_items ci
    join public.products p on p.id=ci.product_id
    where ci.cart_id=p_cart_id and (not p.active or p.stock < ci.quantity)
  ) then raise exception 'STOCK_CHANGED'; end if;

  insert into public.orders(buyer_id,status,currency,subtotal,delivery_fee,total,delivery_address_id)
  values(v_user,'pending','AOA',v_subtotal,greatest(p_delivery_fee,0),v_subtotal+greatest(p_delivery_fee,0),p_delivery_address_id)
  returning id into v_order;

  insert into public.order_items(order_id,product_id,seller_id,quantity,unit_price,line_total)
  select v_order,p.id,p.seller_id,ci.quantity,p.price, p.price*ci.quantity
  from public.cart_items ci join public.products p on p.id=ci.product_id
  where ci.cart_id=p_cart_id;

  update public.products p
  set stock=p.stock-ci.quantity, updated_at=now()
  from public.cart_items ci
  where ci.cart_id=p_cart_id and ci.product_id=p.id;

  delete from public.cart_items where cart_id=p_cart_id;
  return v_order;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_delivery(p_delivery_id uuid)
 RETURNS delivery_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.delivery_requests; o public.orders; c public.couriers;
begin
  select * into c from public.couriers where user_id = auth.uid() and status = 'approved';
  if not found then raise exception 'NOT_APPROVED_COURIER'; end if;
  select * into d from public.delivery_requests where id = p_delivery_id for update;
  if not found then raise exception 'DELIVERY_NOT_FOUND'; end if;
  if d.status <> 'pending' then raise exception 'DELIVERY_ALREADY_TAKEN'; end if;
  select * into o from public.orders where id = d.order_id;
  if o.seller_id = auth.uid() or o.buyer_id = auth.uid() then raise exception 'NOT_DELIVERY_PARTY'; end if;
  update public.delivery_requests set assigned_to = auth.uid(), status = 'accepted', assigned_at = now() where id = d.id returning * into d;
  update public.orders set fulfillment_status = 'assigned', updated_at = now() where id = o.id;
  insert into public.notifications(user_id, type, title, body, data)
  select u, 'delivery', 'Estafeta a caminho', c.display_name || ' (' || c.phone || ') vai fazer a entrega.', jsonb_build_object('delivery_id', d.id, 'order_id', o.id)
  from unnest(array[o.seller_id, o.buyer_id]) u;
  return d;
end $function$
;

CREATE OR REPLACE FUNCTION public.claim_referral(p_code text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); ref uuid; created timestamptz; name text;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select user_id into ref from public.referral_codes where code = c;
  if ref is null then raise exception 'REFERRAL_NOT_FOUND'; end if;
  if ref = me then raise exception 'REFERRAL_SELF'; end if;
  if exists (select 1 from public.referrals where referred_id = me) then raise exception 'REFERRAL_ALREADY'; end if;
  select u.created_at into created from auth.users u where u.id = me;
  if created < now() - interval '14 days' then raise exception 'REFERRAL_TOO_LATE'; end if;
  if exists (select 1 from public.referrals where referred_id = ref and referrer_id = me) then raise exception 'REFERRAL_SELF'; end if;
  insert into public.referrals(referred_id, referrer_id) values (me, ref);
  select coalesce(nullif(split_part(trim(full_name), ' ', 1), ''), 'Alguém') into name from public.profiles where id = me;
  insert into public.notifications(user_id, type, title, body, data)
  values (ref, 'system', 'Convite aceite 🎉', coalesce(name, 'Alguém') || ' entrou no Huambo Online com o seu convite. Ganha um mês grátis quando pagar a primeira mensalidade.',
    jsonb_build_object('for', 'referral'));
  return (select coalesce(nullif(split_part(trim(full_name), ' ', 1), ''), 'um amigo') from public.profiles where id = ref);
end $function$
;

CREATE OR REPLACE FUNCTION public.classified_saved_search_matches_listing(p_filters jsonb, p_listing classified_listings)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
 f jsonb:=case when jsonb_typeof(coalesce(p_filters,'{}'::jsonb))='object' then p_filters else '{}'::jsonb end;
 category_filter uuid; min_price numeric; max_price numeric; filter_territory uuid; filter_kind text;
 listing_territory uuid; listing_neighborhood uuid; listing_municipality uuid; listing_province uuid; listing_country_code text;
 listing_matches boolean:=true; mode text := nullif(trim(coalesce(f->>'saleMode','')),'');
begin
 begin
  if nullif(trim(f->>'categoryId'),'') is not null then category_filter:=(f->>'categoryId')::uuid; end if;
  if nullif(trim(f->>'minPrice'),'') is not null then min_price:=(f->>'minPrice')::numeric; end if;
  if nullif(trim(f->>'maxPrice'),'') is not null then max_price:=(f->>'maxPrice')::numeric; end if;
 exception when invalid_text_representation then return false; end;
 select a.street_id,n.id,m.id,p.id,p.country_code into listing_territory,listing_neighborhood,listing_municipality,listing_province,listing_country_code
 from public.addresses a left join public.streets s on s.id=a.street_id left join public.neighborhoods n on n.id=s.neighborhood_id left join public.municipalities m on m.id=n.municipality_id left join public.provinces p on p.id=m.province_id where a.id=p_listing.address_id;
 if p_listing.address_id is not null and not public.listing_territory_active(p_listing) then return false; end if;
 begin
  listing_municipality:=coalesce(listing_municipality,nullif(p_listing.attributes->>'municipalityId','')::uuid);
  listing_province:=coalesce(listing_province,nullif(p_listing.attributes->>'provinceId','')::uuid);
 exception when invalid_text_representation then null; end;
 if listing_province is null and listing_municipality is not null then select m.province_id into listing_province from public.municipalities m where m.id=listing_municipality; end if;
 if listing_country_code is null and listing_province is not null then select p.country_code into listing_country_code from public.provinces p where p.id=listing_province; end if;
 if nullif(trim(f->>'streetId'),'') is not null then
  begin filter_territory:=(f->>'streetId')::uuid; filter_kind:='street'; exception when invalid_text_representation then return false; end;
 elsif nullif(trim(f->>'neighborhoodId'),'') is not null then
  begin filter_territory:=(f->>'neighborhoodId')::uuid; filter_kind:='neighborhood'; exception when invalid_text_representation then return false; end;
 elsif nullif(trim(f->>'municipalityId'),'') is not null then
  begin filter_territory:=(f->>'municipalityId')::uuid; filter_kind:='municipality'; exception when invalid_text_representation then return false; end;
 elsif nullif(trim(f->>'provinceId'),'') is not null then
  begin filter_territory:=(f->>'provinceId')::uuid; filter_kind:='province'; exception when invalid_text_representation then return false; end;
 end if;
 if filter_territory is not null then
  if not public.saved_search_territory_active(filter_territory,filter_kind) then return false; end if;
  listing_matches:=case filter_kind when 'street' then listing_territory=filter_territory when 'neighborhood' then listing_neighborhood=filter_territory when 'municipality' then listing_municipality=filter_territory when 'province' then listing_province=filter_territory else false end;
  if not coalesce(listing_matches,false) then return false; end if;
 elsif nullif(trim(f->>'countryCode'),'') is not null then
  if not exists(select 1 from public.provinces p where p.country_code=f->>'countryCode' and p.active) then return false; end if;
  if listing_country_code is distinct from f->>'countryCode' then return false; end if;
 end if;
 return (category_filter is null or p_listing.category_id=category_filter)
 and (min_price is null or (p_listing.price is not null and p_listing.price>=min_price))
 and (max_price is null or (p_listing.price is not null and p_listing.price<=max_price))
 and (coalesce(trim(f->>'listingType'),'')='' or p_listing.listing_type=f->>'listingType')
 and (coalesce(trim(f->>'purpose'),'')='' or p_listing.purpose=f->>'purpose')
 and (coalesce(trim(f->>'query'),'')='' or public.fold_text(concat_ws(' ', p_listing.title, p_listing.description, p_listing.trade_wants)) like '%'||public.fold_text(trim(f->>'query'))||'%')
 and (coalesce(f->'attributes','{}'::jsonb)='{}'::jsonb or p_listing.attributes @> (f->'attributes'))
 and (mode is null or p_listing.purpose <> 'wanted' and case mode
       when 'trade' then p_listing.sale_mode = 'trade' or p_listing.accepts_trade
       when 'auction' then p_listing.purpose = 'auction' or p_listing.sale_mode = 'auction'
       when 'negotiable' then p_listing.purpose <> 'auction' and coalesce(p_listing.sale_mode, 'negotiable') = 'negotiable'
       else p_listing.purpose <> 'auction' and p_listing.sale_mode = mode end);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.clean_refund_destination(p text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare d text := public.angola_iban_digits(p); n text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if d is not null then return public.format_angola_iban(d); end if;
  if n ~ '^(244)?9[0-9]{8}$' then return 'Multicaixa Express ' || right(n, 9); end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.close_auction(p_auction_id uuid)
 RETURNS auctions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions; st record;
begin
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if a.status not in ('live','scheduled') then return a; end if;
  if now() < a.ends_at then
    if auth.uid() is distinct from a.seller_id and not public.has_admin_role() then raise exception 'AUCTION_NOT_ENDED'; end if;
    if exists (select 1 from public.auction_max_bids where auction_id = a.id and retracted_at is null) then raise exception 'AUCTION_HAS_BIDS'; end if;
    update public.auctions set status = 'cancelled', updated_at = now() where id = a.id returning * into a;
    return a;
  end if;
  select * into st from public.auction_standing(a.id);
  update public.auctions set status = 'ended',
    winner_id = case when st.leader is not null and (reserve_price is null or st.leader_max >= reserve_price) then st.leader end,
    current_price = st.price, updated_at = now()
  where id = a.id returning * into a;
  if a.winner_id is not null then
    insert into public.notifications(user_id, type, title, body, data)
    values (a.winner_id, 'auction', 'Ganhou o leilão!', 'Ganhou «' || a.title || '» por ' || a.current_price || ' Kz. Contacte o vendedor.', jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (a.seller_id, 'auction', 'Leilão terminado',
          case when a.winner_id is not null then '«' || a.title || '» vendido por ' || a.current_price || ' Kz.'
               when st.leader is not null then '«' || a.title || '» terminou sem atingir o preço mínimo de venda.' else '«' || a.title || '» terminou sem vencedor.' end,
          jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.close_classified_listing(p_listing_id uuid, p_final_status text)
 RETURNS classified_listings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings;
begin
 if p_final_status not in ('sold','rented','closed','cancelled') then raise exception 'INVALID_FINAL_STATUS'; end if;
 select * into l from public.classified_listings where id=p_listing_id for update;
 if not found then raise exception 'LISTING_NOT_FOUND'; end if;
 if l.owner_id<>auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
 update public.classified_listings set status=p_final_status,updated_at=now() where id=p_listing_id returning * into l;
 return l;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.collect_fuel(p_station_id uuid, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.fuel_stations; o public.fuel_orders; c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  select * into s from public.fuel_stations where id = p_station_id;
  if not found or s.owner_id <> auth.uid() then raise exception 'NOT_STATION_OWNER'; end if;
  if c like 'CB%' then c := substr(c, 3); end if;
  if char_length(c) <> 6 then return jsonb_build_object('result', 'invalid'); end if;
  c := 'CB-' || c;
  select * into o from public.fuel_orders where code = c for update;
  if not found or o.station_id <> s.id then return jsonb_build_object('result', 'invalid', 'code', c); end if;
  if o.status = 'collected' then return jsonb_build_object('result', 'used', 'code', c, 'at', o.collected_at, 'buyer', o.buyer_name); end if;
  if o.status not in ('reserved', 'paid') then return jsonb_build_object('result', o.status, 'code', c, 'buyer', o.buyer_name); end if;
  update public.fuel_orders set status = 'collected', collected_at = now(), updated_at = now() where id = o.id returning * into o;
  update public.fuel_products set reservable_qty = greatest(0, reservable_qty - o.quantity) where id = o.product_id;
  return jsonb_build_object('result', 'ok', 'code', c, 'buyer', o.buyer_name, 'plate', o.plate, 'product', o.product, 'quantity', o.quantity,
    'total', o.total, 'fee', o.fee_amount, 'method', o.method);
end $function$
;

CREATE OR REPLACE FUNCTION public.complete_venue_order(p_venue_id uuid, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.venues; o public.venue_orders; c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  select * into v from public.venues where id = p_venue_id;
  if not found or v.owner_id <> auth.uid() then raise exception 'NOT_VENUE_OWNER'; end if;
  if c like 'RV%' then c := substr(c, 3); end if;
  if char_length(c) <> 6 then return jsonb_build_object('result', 'invalid'); end if;
  c := 'RV-' || c;
  select * into o from public.venue_orders where code = c for update;
  if not found or o.venue_id <> v.id then return jsonb_build_object('result', 'invalid', 'code', c); end if;
  if o.status = 'completed' then return jsonb_build_object('result', 'used', 'code', c, 'at', o.completed_at, 'buyer', o.buyer_name); end if;
  if o.status not in ('reserved', 'paid') then return jsonb_build_object('result', o.status, 'code', c, 'buyer', o.buyer_name); end if;
  update public.venue_orders set status = 'completed', completed_at = now(), updated_at = now() where id = o.id returning * into o;
  if o.kind <> 'stay' then
    update public.venue_items i set qty_total = greatest(0, i.qty_total - l.qty), updated_at = now()
      from public.venue_order_lines l where l.order_id = o.id and l.item_id = i.id and i.qty_total is not null;
  end if;
  return jsonb_build_object('result', 'ok', 'code', c, 'kind', o.kind, 'buyer', o.buyer_name, 'guests', o.guests, 'check_in', o.check_in, 'check_out', o.check_out,
    'slot_at', o.slot_at, 'total', o.total, 'method', o.method,
    'lines', (select coalesce(jsonb_agg(jsonb_build_object('name', l.name, 'qty', l.qty, 'unit', l.unit)), '[]') from public.venue_order_lines l where l.order_id = o.id));
end $function$
;

CREATE OR REPLACE FUNCTION public.confirm_order_received(p_order_id uuid)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.buyer_id <> auth.uid() then raise exception 'ORDER_NOT_FOUND'; end if;
  if not o.protected then raise exception 'NOT_PROTECTED'; end if;
  if o.escrow_status = 'awaiting_payment' then raise exception 'AWAITING_PAYMENT'; end if;
  if o.escrow_status <> 'held' or o.status = 'cancelled' then raise exception 'ORDER_CLOSED'; end if;
  if exists (select 1 from public.order_disputes where order_id = o.id and status <> 'resolved') then raise exception 'DISPUTE_OPEN'; end if;
  update public.orders set received_at = now(), status = 'completed', fulfillment_status = 'delivered',
    completed_at = coalesce(completed_at, now()), updated_at = now() where id = o.id;
  perform public.escrow_release(o.id, 'buyer');
  select * into o from public.orders where id = p_order_id;
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.confirm_service(p_id uuid, p_rating integer, p_comment text DEFAULT NULL::text)
 RETURNS service_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.service_requests; owner uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'INVALID_RATING'; end if;
  select * into r from public.service_requests where id = p_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if r.client_id <> auth.uid() then raise exception 'NOT_SERVICE_CLIENT'; end if;
  if r.status not in ('accepted', 'done') then raise exception 'INVALID_TRANSITION'; end if;
  owner := public.service_request_owner(r);
  update public.service_requests set status = 'confirmed', updated_at = now() where id = r.id returning * into r;
  -- Uma avaliação por pessoa e profissional/empresa: a mais recente substitui a anterior.
  update public.reviews set rating = p_rating, comment = nullif(left(trim(coalesce(p_comment, '')), 1000), ''),
         status = 'published', service_request_id = r.id, created_at = now()
   where author_id = auth.uid() and ((r.provider_id is not null and provider_id = r.provider_id) or (r.business_id is not null and business_id = r.business_id));
  if not found then
    insert into public.reviews(author_id, provider_id, business_id, rating, comment, status, service_request_id)
    values (auth.uid(), r.provider_id, r.business_id, p_rating, nullif(left(trim(coalesce(p_comment, '')), 1000), ''), 'published', r.id);
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (owner, 'review', 'Serviço confirmado e avaliado', p_rating || ' estrela(s)' || coalesce(': ' || left(nullif(trim(coalesce(p_comment, '')), ''), 140), ''),
          jsonb_build_object('service_request_id', r.id, 'for', 'service'));
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.consume_photo_search()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d date := (now() at time zone 'Africa/Luanda')::date; used integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  insert into public.photo_search_usage(user_id, day, count) values (auth.uid(), d, 1)
  on conflict (user_id, day) do update set count = public.photo_search_usage.count + 1
    where public.photo_search_usage.count < public.photo_search_limit()
  returning count into used;
  if used is null then raise exception 'PHOTO_SEARCH_LIMIT'; end if;
  return public.photo_search_limit() - used;
end $function$
;

CREATE OR REPLACE FUNCTION public.create_classified_auction(p_listing_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_starting_price numeric, p_reserve_price numeric DEFAULT NULL::numeric, p_min_increment numeric DEFAULT 0)
 RETURNS auctions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; a public.auctions;
begin
 select * into l from public.classified_listings where id=p_listing_id for update;
 if not found then raise exception 'LISTING_NOT_FOUND'; end if;
 if l.owner_id<>auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
 if l.status not in ('published','draft') then raise exception 'LISTING_NOT_AUCTIONABLE'; end if;
 if l.listing_type not in ('real_estate','vehicle','product','classified') then raise exception 'LISTING_TYPE_NOT_AUCTIONABLE'; end if;
 if p_ends_at<=p_starts_at then raise exception 'INVALID_AUCTION_WINDOW'; end if;
 if p_starting_price<0 or p_min_increment<0 then raise exception 'INVALID_AUCTION_PRICE'; end if;

 insert into public.auctions(
   seller_id,title,description,currency,starting_price,reserve_price,min_increment,current_price,
   starts_at,ends_at,status,classified_listing_id
 ) values (
   l.owner_id,l.title,l.description,l.currency,p_starting_price,p_reserve_price,p_min_increment,
   p_starting_price,p_starts_at,p_ends_at,
   case when p_starts_at<=now() then 'live' else 'scheduled' end,p_listing_id
 ) returning * into a;

 update public.classified_listings set purpose='auction',updated_at=now() where id=p_listing_id;
 return a;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_classified_saved_search(p_name text, p_filters jsonb)
 RETURNS classified_saved_searches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.classified_saved_searches;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 insert into public.classified_saved_searches(user_id,name,filters) values(auth.uid(),trim(p_name),coalesce(p_filters,'{}'::jsonb)) returning * into v;
 return v;
end; $function$
;

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS notifications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.notifications;
begin
  insert into public.notifications(user_id,type,title,body,data)
  values(p_user_id,p_type,p_title,p_body,coalesce(p_data,'{}'::jsonb))
  returning * into v;
  return v;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_active()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select status = 'active' from public.profiles where id = auth.uid()), true);
$function$
;

CREATE OR REPLACE FUNCTION public.decide_event_ticket_order(p_order_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS event_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.event_orders; e public.events; st public.platform_settings; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  select * into o from public.event_orders where id = p_order_id for update;
  if not found then raise exception 'TICKET_ORDER_NOT_FOUND'; end if;
  select * into e from public.events where id = o.event_id;
  if e.organizer_id <> auth.uid() then raise exception 'NOT_EVENT_ORGANIZER'; end if;
  if o.status not in ('reserved', 'submitted') then raise exception 'INVALID_TRANSITION'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  select * into st from public.platform_settings where id = 1;
  if p_confirm then
    update public.event_orders set status = 'confirmed', decided_at = now(), note = txt, fee_pct = st.event_ticket_fee_pct,
      fee_amount = round(total * st.event_ticket_fee_pct / 100), method = coalesce(method, 'cash') where id = o.id returning * into o;
    perform public.issue_event_tickets(o);
  else
    update public.event_orders set status = 'rejected', decided_at = now(), note = txt where id = o.id returning * into o;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (o.buyer_id, 'system', case when p_confirm then 'Bilhetes confirmados 🎟️' else 'Pagamento dos bilhetes não confirmado' end,
    case when p_confirm then o.quantity || ' bilhete(s) para «' || left(e.title, 80) || '». Mostre o código à entrada.' else '«' || left(e.title, 80) || '»: ' || txt end,
    jsonb_build_object('for', 'tickets', 'event_id', e.id));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.decide_fuel_payment(p_order_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS fuel_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.fuel_orders; s public.fuel_stations; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  select * into o from public.fuel_orders where id = p_order_id for update;
  if not found then raise exception 'FUEL_ORDER_NOT_FOUND'; end if;
  select * into s from public.fuel_stations where id = o.station_id;
  if s.owner_id <> auth.uid() then raise exception 'NOT_STATION_OWNER'; end if;
  if o.status <> 'submitted' then raise exception 'INVALID_TRANSITION'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  if p_confirm then
    update public.fuel_orders set status = 'paid', code = coalesce(code, public.new_fuel_code()), hold_until = now() + make_interval(mins => s.hold_minutes), note = txt, updated_at = now()
      where id = o.id returning * into o;
  else
    update public.fuel_orders set status = 'rejected', note = txt, updated_at = now() where id = o.id returning * into o;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (o.buyer_id, 'system', case when p_confirm then '⛽ Pagamento confirmado — código ' || o.code else 'Pagamento não confirmado' end,
    case when p_confirm then s.name || ': levante ' || o.quantity || ' × ' || public.fuel_product_label(o.product) || ' até ' || to_char(o.hold_until at time zone 'Africa/Luanda', 'DD/MM HH24:MI') || '. Mostre o QR no posto.'
         else s.name || ': ' || txt end,
    jsonb_build_object('for', 'fuel_orders'));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.decide_venue_payment(p_order_id uuid, p_confirm boolean, p_note text DEFAULT NULL::text)
 RETURNS venue_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.venue_orders; v public.venues; bname text; txt text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  select * into o from public.venue_orders where id = p_order_id for update;
  if not found then raise exception 'VENUE_ORDER_NOT_FOUND'; end if;
  select * into v from public.venues where id = o.venue_id;
  if v.owner_id <> auth.uid() then raise exception 'NOT_VENUE_OWNER'; end if;
  if o.status <> 'submitted' then raise exception 'INVALID_TRANSITION'; end if;
  if not p_confirm and txt is null then raise exception 'REASON_REQUIRED'; end if;
  select name into bname from public.businesses where id = v.business_id;
  if p_confirm then
    update public.venue_orders set status = 'paid', code = coalesce(code, public.new_venue_code()), note = txt, updated_at = now() where id = o.id returning * into o;
  else
    update public.venue_orders set status = 'rejected', note = txt, updated_at = now() where id = o.id returning * into o;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  values (o.buyer_id, 'system', case when p_confirm then '✔ Pagamento confirmado — código ' || o.code else 'Pagamento não confirmado' end,
    case when p_confirm then bname || ': mostre o QR ou o código ' || o.code || ' ao chegar.' else bname || ': ' || txt end,
    jsonb_build_object('for', 'venue_orders'));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_promo_post(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.promo_posts where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'POST_NOT_FOUND'; end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.delivery_requires_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if exists (select 1 from public.orders where id = new.order_id and escrow_status = 'awaiting_payment') then raise exception 'AWAITING_PAYMENT'; end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.dispute_action(p_dispute_id uuid, p_action text, p_note text DEFAULT NULL::text, p_photos text[] DEFAULT '{}'::text[])
 RETURNS order_disputes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.order_disputes; r text; ph text[]; nxt text; outc text; ev text; held boolean; txt text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into d from public.order_disputes where id = p_dispute_id for update;
  if not found then raise exception 'DISPUTE_NOT_FOUND'; end if;
  r := case when d.buyer_id = auth.uid() then 'buyer' when d.seller_id = auth.uid() then 'seller' when public.has_admin_role() then 'admin' end;
  if r is null then raise exception 'NOT_ORDER_PARTY'; end if;
  if d.status = 'resolved' then raise exception 'DISPUTE_CLOSED'; end if;
  -- dinheiro ainda guardado pelo Huambo Online (pagamento protegido): o reembolso sai da plataforma
  held := exists (select 1 from public.orders where id = d.order_id and escrow_status = 'held');
  ph := case when r = 'admin' then '{}' else public.dispute_clean_photos(d.order_id, p_photos) end;
  ev := case p_action when 'accept' then 'accepted' when 'decline' then 'declined' when 'mark_returned' then 'returned'
    when 'confirm_return' then 'return_received' when 'mark_refunded' then 'refund_sent' when 'confirm_refund' then 'refund_confirmed'
    when 'confirm_replacement' then 'replacement_received' when 'escalate' then 'escalated' when 'withdraw' then 'withdrawn'
    when 'comment' then 'comment' end;
  if ev is null then raise exception 'INVALID_ACTION'; end if;

  if p_action = 'accept' and r = 'seller' and d.status = 'open' then
    nxt := case d.request when 'refund' then 'awaiting_refund' when 'return_refund' then 'awaiting_return' else 'replacing' end;
  elsif p_action = 'decline' and r = 'seller' and d.status = 'open' then
    if txt is null then raise exception 'REASON_REQUIRED'; end if;
    nxt := 'declined';
  elsif p_action = 'mark_returned' and r = 'buyer' and d.status = 'awaiting_return' then nxt := 'returned';
  elsif p_action = 'confirm_return' and r = 'seller' and d.status = 'returned' then nxt := 'awaiting_refund';
  elsif p_action = 'mark_refunded' and d.status = 'awaiting_refund' and ((r = 'seller' and not held) or (r = 'admin' and held)) then
    if held and d.refund_to is null then raise exception 'REFUND_ACCOUNT_REQUIRED'; end if;
    nxt := 'refund_sent';
  elsif p_action = 'confirm_refund' and d.status = 'refund_sent' and (r = 'buyer' or (r = 'admin' and held)) then nxt := 'resolved'; outc := 'refunded';
  elsif p_action = 'confirm_replacement' and r = 'buyer' and d.status = 'replacing' then nxt := 'resolved'; outc := 'replaced';
  elsif p_action = 'withdraw' and r = 'buyer' then nxt := 'resolved'; outc := 'withdrawn';
  elsif p_action = 'escalate' and r in ('buyer', 'seller') and d.status <> 'escalated' then
    -- o comprador pode chamar logo depois de uma recusa; de resto, só ao fim de 3 dias sem avanço
    if not ((r = 'buyer' and d.status = 'declined') or (d.status not in ('declined', 'open') and d.updated_at < now() - interval '3 days')
            or (r = 'buyer' and d.status = 'open' and d.updated_at < now() - interval '3 days')) then raise exception 'ESCALATE_TOO_EARLY'; end if;
    nxt := 'escalated';
  elsif p_action = 'comment' then
    if txt is null and cardinality(ph) = 0 then raise exception 'MESSAGE_REQUIRED'; end if;
    nxt := d.status;
  else raise exception 'INVALID_TRANSITION'; end if;

  update public.order_disputes set status = nxt, outcome = coalesce(outc, outcome),
    resolved_at = case when nxt = 'resolved' then now() else resolved_at end,
    updated_at = case when p_action = 'comment' then updated_at else now() end
   where id = d.id returning * into d;
  if outc = 'refunded' then
    update public.orders set refunded_amount = least(total, refunded_amount + d.amount),
      payment_status = case when refunded_amount + d.amount >= total then 'refunded' else payment_status end, updated_at = now()
     where id = d.order_id;
  end if;
  perform public.dispute_log(d, r, ev, txt, ph);
  if nxt = 'escalated' then
    perform public.notify_staff('Disputa para decidir', coalesce(txt, 'Encomenda com pedido de devolução ou reembolso.'), jsonb_build_object('dispute_id', d.id));
  end if;
  return d;
end $function$
;

CREATE OR REPLACE FUNCTION public.dispute_clean_photos(p_order_id uuid, p_photos text[])
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p text; res text[] := '{}';
begin
  foreach p in array coalesce(p_photos, '{}') loop
    if p !~ ('^' || p_order_id::text || '/' || auth.uid()::text || '/[A-Za-z0-9._-]{1,120}$') then raise exception 'INVALID_PHOTO'; end if;
    res := res || p;
  end loop;
  if cardinality(res) > 4 then raise exception 'TOO_MANY_PHOTOS'; end if;
  return res;
end $function$
;

CREATE OR REPLACE FUNCTION public.dispute_events_json(p_dispute_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('actor_role', e.actor_role, 'action', e.action, 'note', e.note, 'photos', to_jsonb(e.photos), 'created_at', e.created_at) order by e.created_at), '[]')
  from public.order_dispute_events e where e.dispute_id = p_dispute_id;
$function$
;

CREATE OR REPLACE FUNCTION public.dispute_log(d order_disputes, p_role text, p_action text, p_note text, p_photos text[] DEFAULT '{}'::text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare who uuid; title text; body text;
begin
  insert into public.order_dispute_events(dispute_id, actor_id, actor_role, action, note, photos)
  values (d.id, case when p_role = 'system' then null else auth.uid() end, p_role, p_action, nullif(left(trim(coalesce(p_note, '')), 1000), ''), coalesce(p_photos, '{}'));
  title := case p_action
    when 'opened' then 'Pedido de devolução ou reembolso'
    when 'accepted' then 'O vendedor aceitou o seu pedido ✔'
    when 'declined' then 'O vendedor recusou o seu pedido'
    when 'returned' then 'O comprador devolveu o artigo'
    when 'return_received' then 'O vendedor recebeu a devolução'
    when 'refund_sent' then 'O vendedor diz que devolveu o dinheiro'
    when 'refund_confirmed' then 'Reembolso confirmado ✔'
    when 'replacement_received' then 'Troca confirmada ✔'
    when 'escalated' then 'Pedido enviado à administração'
    when 'decided' then 'A administração decidiu'
    when 'withdrawn' then 'O comprador desistiu do pedido'
    when 'auto_refund' then 'Encomenda paga cancelada: reembolso'
    else 'Nova mensagem no pedido de devolução' end;
  body := coalesce(nullif(left(trim(coalesce(p_note, '')), 200), ''), 'Encomenda de ' || replace(to_char(coalesce(d.amount, (select total from public.orders where id = d.order_id)), 'FM999,999,999,990'), ',', ' ') || ' Kz');
  -- avisa a(s) outra(s) parte(s)
  for who in select x from unnest(array[d.buyer_id, d.seller_id]) x
    where p_role in ('admin', 'system') or x is distinct from auth.uid() loop
    insert into public.notifications(user_id, type, title, body, data)
    values (who, 'order', title, body, jsonb_build_object('order_id', d.order_id, 'dispute_id', d.id, 'for', 'dispute'));
  end loop;
end $function$
;

CREATE OR REPLACE FUNCTION public.enqueue_job(p_kind text, p_ref uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.job_queue(kind, ref_id) values (p_kind, p_ref) on conflict (kind, ref_id) where done_at is null do nothing
$function$
;

CREATE OR REPLACE FUNCTION public.escrow_mark_paid(p_payment_id uuid, p_paid_amount numeric, p_provider_payment_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pay public.order_payments; o public.orders; d public.order_disputes;
begin
  select * into pay from public.order_payments where id = p_payment_id for update;
  if not found or pay.status not in ('pending', 'expired') then return false; end if;
  update public.order_payments set status = 'confirmed', decided_at = now(), decided_by = auth.uid(),
    paid_amount = coalesce(p_paid_amount, pay.amount), provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id)
   where id = pay.id returning * into pay;
  select * into o from public.orders where id = pay.order_id for update;
  if o.escrow_status <> 'awaiting_payment' then
    perform public.notify_staff('Pagamento a mais — devolver ao cliente', pay.paid_amount || ' Kz · ' || public.order_ref(o) || ' já estava paga.',
      jsonb_build_object('payment_id', pay.id, 'order_id', o.id));
    return false;
  end if;
  update public.orders set escrow_status = 'held', payment_status = 'paid', paid_at = now(), updated_at = now() where id = o.id returning * into o;
  perform public.wallet_add(o.seller_id, o.id, null, 'pending', 'sale', o.total, 'Pagamento recebido · ' || public.order_ref(o));
  if o.status = 'cancelled' then
    if not exists (select 1 from public.order_disputes where order_id = o.id and status <> 'resolved') then
      insert into public.order_disputes(order_id, buyer_id, seller_id, request, reason, description, amount, status)
      values (o.id, o.buyer_id, o.seller_id, 'refund', 'seller_cancelled', 'A encomenda foi paga depois de ser cancelada.', o.total, 'awaiting_refund')
      returning * into d;
      perform public.dispute_log(d, 'system', 'auto_refund', 'A encomenda foi paga depois de ser cancelada: o Huambo Online vai devolver o dinheiro.');
    end if;
  else
    insert into public.notifications(user_id, type, title, body, data) values
      (o.seller_id, 'order', 'Pagamento recebido 🛡️', 'O cliente pagou ' || o.total || ' Kz da encomenda ' || public.order_ref(o)
        || '. O dinheiro fica guardado pelo Huambo Online até o cliente receber. Já pode preparar e enviar.', jsonb_build_object('order_id', o.id, 'for', 'sale')),
      (o.buyer_id, 'order', 'Pagamento confirmado ✔', 'Recebemos ' || o.total || ' Kz da encomenda ' || public.order_ref(o)
        || '. O dinheiro fica guardado até confirmar que recebeu a encomenda.', jsonb_build_object('order_id', o.id, 'for', 'purchase'));
  end if;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.escrow_refund_alert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders;
begin
  if new.status <> 'awaiting_refund' or (tg_op = 'UPDATE' and old.status = 'awaiting_refund') then return new; end if;
  select * into o from public.orders where id = new.order_id;
  if o.escrow_status is distinct from 'held' then return new; end if;
  perform public.notify_staff('Reembolso a enviar (pagamento protegido)', coalesce(new.amount, o.total) || ' Kz · ' || public.order_ref(o),
    jsonb_build_object('dispute_id', new.id, 'order_id', o.id));
  if new.refund_to is null then
    insert into public.notifications(user_id, type, title, body, data)
    values (new.buyer_id, 'order', 'Para onde devolvemos o dinheiro?',
      'O Huambo Online vai devolver ' || coalesce(new.amount, o.total) || ' Kz da encomenda ' || public.order_ref(o) || '. Indique o seu IBAN ou número Multicaixa Express no pedido.',
      jsonb_build_object('order_id', o.id, 'dispute_id', new.id, 'for', 'dispute'));
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.escrow_release(p_order_id uuid, p_by text, p_force boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; net numeric; fee numeric; pct numeric;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.escrow_status is distinct from 'held' then return false; end if;
  if o.status = 'cancelled' and not p_force then return false; end if;
  if exists (select 1 from public.order_disputes where order_id = o.id and status <> 'resolved') then return false; end if;
  net := o.total - o.refunded_amount;
  if net <= 0 then
    update public.orders set escrow_status = 'refunded', updated_at = now() where id = o.id;
    return false;
  end if;
  select protected_fee_pct into pct from public.platform_settings where id = 1;
  fee := round(net * coalesce(pct, 0) / 100, 2);
  update public.orders set escrow_status = 'released', released_at = now(), platform_fee = fee,
    status = case when status = 'cancelled' then status else 'completed' end,
    fulfillment_status = case when status = 'cancelled' then fulfillment_status else 'delivered' end,
    completed_at = coalesce(completed_at, case when status = 'cancelled' then null else now() end), updated_at = now()
   where id = o.id returning * into o;
  perform public.wallet_add(o.seller_id, o.id, null, 'pending', 'release', -net, 'Libertado · ' || public.order_ref(o));
  perform public.wallet_add(o.seller_id, o.id, null, 'available', 'release', net, 'Libertado · ' || public.order_ref(o));
  perform public.wallet_add(o.seller_id, o.id, null, 'available', 'fee', -fee, 'Comissão do pagamento protegido (' || pct || '%) · ' || public.order_ref(o));
  insert into public.notifications(user_id, type, title, body, data)
  values (o.seller_id, 'system', 'Dinheiro disponível 💰', (net - fee) || ' Kz da encomenda ' || public.order_ref(o) || ' já podem ser levantados.',
    jsonb_build_object('order_id', o.id, 'for', 'wallet'));
  if p_by = 'auto' then
    insert into public.notifications(user_id, type, title, body, data)
    values (o.buyer_id, 'order', 'Pagamento entregue ao vendedor', 'Passou o prazo depois da entrega da encomenda ' || public.order_ref(o)
      || ' sem reclamação, por isso o pagamento foi entregue ao vendedor.', jsonb_build_object('order_id', o.id, 'for', 'purchase'));
  end if;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.escrow_tick()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; cancelled integer := 0; released integer := 0;
begin
  -- 1) encomendas protegidas não pagas a tempo (e sem comprovativo à espera) são canceladas e o stock volta
  for o in select * from public.orders x where x.escrow_status = 'awaiting_payment' and x.status <> 'cancelled' and x.pay_by < now()
      and not exists (select 1 from public.order_payments p where p.order_id = x.id and p.status = 'pending' and p.provider = 'manual')
      for update skip locked loop
    update public.products p set stock = p.stock + oi.quantity, updated_at = now() from public.order_items oi where oi.order_id = o.id and oi.product_id = p.id;
    update public.orders set status = 'cancelled', fulfillment_status = 'cancelled', updated_at = now() where id = o.id;
    insert into public.notifications(user_id, type, title, body, data) values
      (o.buyer_id, 'order', 'Encomenda cancelada', 'A encomenda ' || public.order_ref(o) || ' foi cancelada porque o pagamento não chegou a tempo.',
        jsonb_build_object('order_id', o.id, 'for', 'purchase')),
      (o.seller_id, 'order', 'Encomenda cancelada', 'O cliente não pagou a encomenda ' || public.order_ref(o) || ' a tempo. O stock voltou à Loja.',
        jsonb_build_object('order_id', o.id, 'for', 'sale'));
    cancelled := cancelled + 1;
  end loop;
  -- 2) referências ProxyPay vencidas
  update public.order_payments set status = 'expired' where provider = 'proxypay' and status = 'pending' and expires_at < now();
  -- 3) dinheiro libertado depois do prazo, sem reclamação
  for o in select * from public.orders x where x.escrow_status = 'held' and x.status <> 'cancelled' and x.release_at <= now()
      and not exists (select 1 from public.order_disputes d where d.order_id = x.id and d.status <> 'resolved') loop
    if public.escrow_release(o.id, 'auto') then released := released + 1; end if;
  end loop;
  return jsonb_build_object('cancelled', cancelled, 'released', released);
end $function$
;

CREATE OR REPLACE FUNCTION public.event_fee_due(p_event uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select greatest(0, coalesce((select sum(fee_amount) from public.event_orders where event_id = p_event and status = 'confirmed'), 0)
    - coalesce((select sum(amount) from public.event_platform_payments where event_id = p_event and kind = 'fee' and status = 'confirmed'), 0))
$function$
;

CREATE OR REPLACE FUNCTION public.event_ticket_availability(p_event_id uuid)
 RETURNS TABLE(id uuid, name text, price numeric, quantity integer, left_count integer, max_per_order integer, active boolean, sort integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select t.id, t.name, t.price, t.quantity, greatest(t.quantity - public.ticket_type_taken(t.id), 0), t.max_per_order, t.active, t.sort
  from public.event_ticket_types t join public.events e on e.id = t.event_id
  where t.event_id = p_event_id and (e.status <> 'draft' or e.organizer_id = auth.uid())
  order by t.sort, t.price
$function$
;

CREATE OR REPLACE FUNCTION public.events_tick()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  with x as (update public.event_orders set status = 'expired', decided_at = now() where status = 'reserved' and pay_by < now() returning 1)
  select count(*) into n from x;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.finalize_due_auctions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare x record; n integer := 0; st record;
begin
  update public.auctions set status = 'live', updated_at = now() where status = 'scheduled' and starts_at <= now() and ends_at > now();
  for x in select * from public.auctions where status = 'live' and ending_notified_at is null and ends_at > now() and ends_at <= now() + interval '1 hour' for update skip locked loop
    select * into st from public.auction_standing(x.id);
    insert into public.notifications(user_id, type, title, body, data)
    select m.bidder_id, 'auction',
      case when m.bidder_id = st.leader then 'Leilão a terminar: está a ganhar' else 'Leilão a terminar: foi ultrapassado' end,
      '«' || x.title || '» termina em menos de 1 hora. Preço atual: ' || st.price || ' Kz.' || case when m.bidder_id = st.leader then '' else ' Suba o seu máximo para ganhar.' end,
      jsonb_build_object('auction_id', x.id, 'listing_id', x.classified_listing_id)
    from public.auction_max_bids m where m.auction_id = x.id and m.retracted_at is null;
    insert into public.notifications(user_id, type, title, body, data)
    select distinct si.user_id, 'auction', 'Leilão guardado a terminar', '«' || x.title || '» termina em menos de 1 hora. Preço atual: ' || st.price || ' Kz.',
      jsonb_build_object('auction_id', x.id, 'listing_id', x.classified_listing_id)
    from public.saved_items si
    where si.classified_listing_id = x.classified_listing_id and si.user_id <> x.seller_id
      and not exists (select 1 from public.auction_max_bids m where m.auction_id = x.id and m.bidder_id = si.user_id and m.retracted_at is null);
    update public.auctions set ending_notified_at = now() where id = x.id;
  end loop;
  for x in select id from public.auctions where status in ('live','scheduled') and ends_at <= now() loop
    perform public.close_auction(x.id); n := n + 1;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.find_by_ref(p_ref text)
 RETURNS TABLE(kind text, id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m text[]; k text; n bigint;
begin
  m := regexp_match(upper(trim(coalesce(p_ref, ''))), '^([APE])[\s-]*0*([0-9]{1,12})$');
  if m is null then return; end if;
  k := m[1]; n := m[2]::bigint;
  if k = 'A' then
    return query select 'listing'::text, l.id from public.classified_listings l
      where l.ref_no = n and (l.status in ('published', 'sold', 'rented', 'closed') or l.owner_id = auth.uid() or public.has_admin_role());
  elsif k = 'P' then
    return query select 'product'::text, p.id from public.products p where p.ref_no = n and (p.active or p.seller_id = auth.uid() or public.has_admin_role());
  else
    return query select 'order'::text, o.id from public.orders o where o.ref_no = n and (auth.uid() in (o.buyer_id, o.seller_id) or public.has_admin_role());
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.flush_daily_saved_search_notifications(p_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare s record; inserted_count integer:=0; cycle_key text; begin for s in select q.saved_search_id,q.user_id,count(*) total,min(q.created_at) first_match,max(q.created_at) last_match,array_agg(q.listing_id order by q.created_at) listing_ids from public.saved_search_notification_queue q join public.classified_saved_searches ss on ss.id=q.saved_search_id where q.delivered_at is null and (q.processing_at is null or q.processing_at<p_now-interval '15 minutes') and ss.active=true and coalesce(ss.notification_frequency,'immediate')='daily' and (ss.notification_quiet_until is null or ss.notification_quiet_until<=p_now) group by q.saved_search_id,q.user_id loop update public.saved_search_notification_queue set processing_at=p_now where saved_search_id=s.saved_search_id and user_id=s.user_id and delivered_at is null and (processing_at is null or processing_at<p_now-interval '15 minutes'); if found then cycle_key:=to_char((p_now at time zone 'Africa/Luanda')::date,'YYYY-MM-DD'); insert into public.notifications(user_id,type,title,body,data) values(s.user_id,'saved_search',case when s.total=1 then 'Novo anúncio encontrado' else s.total||' novos anúncios encontrados' end,case when s.total=1 then 'Um novo anúncio corresponde à sua pesquisa guardada.' else s.total||' novos anúncios correspondem à sua pesquisa guardada.' end,jsonb_build_object('saved_search_id',s.saved_search_id,'listing_ids',to_jsonb(s.listing_ids),'count',s.total,'digest',true,'digest_cycle',cycle_key,'first_match_at',s.first_match,'last_match_at',s.last_match)) on conflict do nothing; if found then update public.saved_search_notification_queue set delivered_at=p_now,processing_at=null where saved_search_id=s.saved_search_id and user_id=s.user_id and delivered_at is null and processing_at=p_now; update public.classified_saved_searches set last_notified_at=p_now,updated_at=p_now where id=s.saved_search_id; inserted_count:=inserted_count+1; else update public.saved_search_notification_queue set processing_at=null where saved_search_id=s.saved_search_id and user_id=s.user_id and delivered_at is null and processing_at=p_now; end if; end if; end loop; return inserted_count; end $function$
;

CREATE OR REPLACE FUNCTION public.fold_text(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select translate(lower(coalesce(p, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
$function$
;

CREATE OR REPLACE FUNCTION public.follow_info(p_kind text, p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'followers', case p_kind
      when 'seller' then (select count(*) from public.followed_sellers where seller_id = p_id)
      when 'provider' then (select count(*) from public.followed_providers where provider_id = p_id)
      when 'business' then (select count(*) from public.followed_businesses where business_id = p_id) else 0 end,
    'following', auth.uid() is not null and case p_kind
      when 'seller' then exists (select 1 from public.followed_sellers where seller_id = p_id and user_id = auth.uid())
      when 'provider' then exists (select 1 from public.followed_providers where provider_id = p_id and user_id = auth.uid())
      when 'business' then exists (select 1 from public.followed_businesses where business_id = p_id and user_id = auth.uid()) else false end);
$function$
;

CREATE OR REPLACE FUNCTION public.follow_notify_listing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'published' and new.purpose <> 'wanted' and not (tg_op = 'UPDATE' and old.status = 'published') then perform public.enqueue_job('follow_listing', new.id); end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.follow_notify_portfolio()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.enqueue_job('follow_portfolio', new.id);
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.follow_notify_product()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.active and not (tg_op = 'UPDATE' and old.active) then perform public.enqueue_job('follow_product', new.id); end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.format_angola_iban(p_digits text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select 'AO06 ' || trim(regexp_replace(p_digits, '(.{4})', '\1 ', 'g'));
$function$
;

CREATE OR REPLACE FUNCTION public.fuel_fee_due(p_station uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select greatest(0, coalesce((select sum(fee_amount) from public.fuel_orders where station_id = p_station and status = 'collected'), 0)
    - coalesce((select sum(amount) from public.fuel_platform_payments where station_id = p_station and status = 'confirmed'), 0))
$function$
;

CREATE OR REPLACE FUNCTION public.fuel_feed(p_product text DEFAULT NULL::text, p_municipality uuid DEFAULT NULL::uuid, p_station uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 100)
 RETURNS TABLE(product_id uuid, station_id uuid, station_ref bigint, station_name text, kind text, municipality_name text, address text, directions text, geo_lat numeric, geo_lng numeric, phone text, whatsapp text, opening_hours text, product text, price numeric, status text, queue text, note text, status_at timestamp with time zone, updated_at timestamp with time zone, reservable_left numeric, max_per_order numeric, accepts_reservations boolean, accepts_prepay boolean, hold_minutes integer, yes_2h bigint, no_2h bigint, last_report_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, s.id, s.ref_no, s.name, s.kind, m.name, s.address, s.directions, s.geo_lat, s.geo_lng, s.phone, s.whatsapp, s.opening_hours,
    p.product, p.price, p.status, p.queue, p.note, p.status_at, p.updated_at,
    greatest(0, p.reservable_qty - public.fuel_reserved_qty(p.id)), p.max_per_order,
    s.accepts_reservations and not public.fuel_fees_overdue(s.id), s.accepts_prepay and exists (select 1 from public.fuel_station_pay x where x.station_id = s.id and (x.iban is not null or x.express is not null)),
    s.hold_minutes,
    (select count(*) from public.fuel_reports r where r.product_id = p.id and r.has and r.created_at > now() - interval '2 hours'),
    (select count(*) from public.fuel_reports r where r.product_id = p.id and not r.has and r.created_at > now() - interval '2 hours'),
    (select max(r.created_at) from public.fuel_reports r where r.product_id = p.id)
  from public.fuel_products p join public.fuel_stations s on s.id = p.station_id left join public.municipalities m on m.id = s.municipality_id
  where s.status = 'approved'
    and (p_product is null or p.product = p_product)
    and (p_municipality is null or s.municipality_id = p_municipality)
    and (p_station is null or s.id = p_station)
  order by case p.status when 'available' then 0 when 'low' then 1 when 'unknown' then 2 else 3 end, p.status_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 300);
$function$
;

CREATE OR REPLACE FUNCTION public.fuel_fees_overdue(p_station uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select sum(fee_amount) from public.fuel_orders where station_id = p_station and status = 'collected' and collected_at < now() - interval '7 days'), 0)
    > coalesce((select sum(amount) from public.fuel_platform_payments where station_id = p_station and status = 'confirmed'), 0)
$function$
;

CREATE OR REPLACE FUNCTION public.fuel_order_by_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.fuel_orders; s public.fuel_stations; me uuid := auth.uid(); t text := lower(regexp_replace(coalesce(p_token, ''), '[^A-Fa-f0-9]', '', 'g')); role_ text;
begin
  if char_length(t) <> 32 then return jsonb_build_object('result', 'invalid'); end if;
  select * into o from public.fuel_orders where qr_token = t;
  if not found then return jsonb_build_object('result', 'invalid'); end if;
  select * into s from public.fuel_stations where id = o.station_id;
  role_ := case when me is not null and s.owner_id = me then 'station' when me is not null and public.has_admin_role() then 'admin'
                when me is not null and o.buyer_id = me then 'buyer' else 'other' end;
  if role_ = 'other' then
    return jsonb_build_object('result', 'ok', 'role', role_, 'ref_no', o.ref_no, 'status', o.status, 'product', o.product, 'quantity', o.quantity,
      'station_id', s.id, 'station_name', s.name);
  end if;
  return jsonb_build_object('result', 'ok', 'role', role_, 'id', o.id, 'ref_no', o.ref_no, 'status', o.status, 'method', o.method, 'product', o.product,
    'quantity', o.quantity, 'unit_price', o.unit_price, 'subtotal', o.subtotal, 'fee_pct', o.fee_pct, 'fee_amount', o.fee_amount, 'total', o.total,
    'buyer_name', o.buyer_name, 'buyer_phone', o.buyer_phone, 'plate', o.plate, 'code', o.code, 'hold_until', o.hold_until, 'pay_method', o.pay_method,
    'reference', o.reference, 'proof_path', o.proof_path, 'note', o.note, 'created_at', o.created_at, 'collected_at', o.collected_at,
    'station_id', s.id, 'station_name', s.name);
end $function$
;

CREATE OR REPLACE FUNCTION public.fuel_product_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then new.status_at := now(); end if;
  if tg_op = 'UPDATE' and (new.status, new.price, new.queue, new.reservable_qty, new.note, new.max_per_order) is not distinct from (old.status, old.price, old.queue, old.reservable_qty, old.note, old.max_per_order) then return new; end if;
  new.updated_at := now();
  if new.status in ('available', 'low') and (tg_op = 'INSERT' or old.status in ('out', 'unknown')) then perform public.enqueue_job('fuel_alert', new.id); end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.fuel_product_label(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p when 'gasolina' then 'Gasolina' when 'gasoleo' then 'Gasóleo' when 'petroleo' then 'Petróleo'
    when 'gas_12kg' then 'Gás (botija 12 kg)' when 'gas_6kg' then 'Gás (botija 6 kg)' else p end
$function$
;

CREATE OR REPLACE FUNCTION public.fuel_reserved_qty(p_product uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(quantity), 0) from public.fuel_orders where product_id = p_product and status in ('reserved', 'awaiting_payment', 'submitted', 'paid')
$function$
;

CREATE OR REPLACE FUNCTION public.fuel_station_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.notify_staff('Novo posto para aprovar', 'S-' || new.ref_no || ' · ' || left(new.name, 80), jsonb_build_object('fuel_station_id', new.id));
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.fuel_station_panel(p_station_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.fuel_stations; st public.platform_settings;
begin
  select * into s from public.fuel_stations where id = p_station_id;
  if not found or (s.owner_id <> auth.uid() and not public.has_admin_role()) then raise exception 'NOT_STATION_OWNER'; end if;
  select * into st from public.platform_settings where id = 1;
  return jsonb_build_object(
    'fee_pct', st.fuel_fee_pct,
    'collected_today', (select coalesce(sum(total), 0) from public.fuel_orders where station_id = s.id and status = 'collected' and collected_at > date_trunc('day', now() at time zone 'Africa/Luanda') at time zone 'Africa/Luanda'),
    'collected_total', (select coalesce(sum(total), 0) from public.fuel_orders where station_id = s.id and status = 'collected'),
    'fee_total', (select coalesce(sum(fee_amount), 0) from public.fuel_orders where station_id = s.id and status = 'collected'),
    'fee_due', public.fuel_fee_due(s.id),
    'fee_overdue', public.fuel_fees_overdue(s.id),
    'fee_pending', exists (select 1 from public.fuel_platform_payments where station_id = s.id and status = 'pending'),
    'orders', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select o.id, o.ref_no, o.status, o.method, o.product, o.quantity, o.subtotal, o.fee_amount, o.total, o.buyer_name, o.buyer_phone, o.plate, o.code, o.qr_token,
        o.hold_until, o.pay_by, o.pay_method, o.reference, o.proof_path, o.note, o.created_at, o.collected_at
      from public.fuel_orders o where o.station_id = s.id order by o.created_at desc limit 300) x),
    'payments', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select p.id, p.ref_no, p.amount, p.status, p.admin_note, p.created_at from public.fuel_platform_payments p where p.station_id = s.id order by p.created_at desc limit 50) x));
end $function$
;

CREATE OR REPLACE FUNCTION public.fuel_tick()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  with x as (update public.fuel_orders set status = 'expired', updated_at = now()
    where (status = 'reserved' and hold_until < now()) or (status = 'awaiting_payment' and pay_by < now()) returning 1)
  select count(*) into n from x;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.get_notification_preferences()
 RETURNS notification_preferences
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.notification_preferences;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.notification_preferences where user_id = auth.uid();
  if not found then
    r.user_id := auth.uid(); r.enabled := true; r.saved_search := true; r.messages := true; r.rentals := true;
    r.auctions := true; r.marketplace := true; r.reviews := true; r.system := true; r.updated_at := now();
  end if;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.get_promo_post(p_id uuid)
 RETURNS TABLE(id uuid, ref_no bigint, owner_id uuid, subject_kind text, subject_id uuid, subject_name text, subject_picture text, kind text, title text, description text, video_url text, external_url text, cover_url text, live_starts_at timestamp with time zone, live_ends_at timestamp with time zone, live_state text, featured boolean, featured_until timestamp with time zone, views integer, status text, hidden_reason text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select x.id, x.ref_no, x.owner_id, x.subject_kind, x.subject_id, s.name, s.picture, x.kind, x.title, x.description, x.video_url, x.external_url, x.cover_url,
    x.live_starts_at, x.live_ends_at,
    case when x.kind <> 'live' then null when now() < x.live_starts_at then 'upcoming' when now() <= x.live_ends_at then 'live' else 'ended' end,
    coalesce(x.featured_until > now(), false), x.featured_until, x.views, x.status, x.hidden_reason, x.created_at
  from public.promo_posts x cross join lateral public.promo_subject(x.subject_kind, x.subject_id) s
  where x.id = p_id and ((x.status = 'published' and s.visible) or x.owner_id = auth.uid() or public.has_admin_role());
$function$
;

CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
 RETURNS TABLE(id uuid, full_name text, avatar_url text, province text, municipality text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.full_name, p.avatar_url, p.province, p.municipality, p.created_at
  from public.profiles p where p.id = p_user_id and p.status = 'active';
$function$
;

CREATE OR REPLACE FUNCTION public.guard_classified_listing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare admin boolean := public.has_admin_role(); allow_feature boolean := coalesce(current_setting('huambo.allow_feature', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if not admin then
      if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
      new.status := 'draft'; new.featured := false; new.featured_until := null;
    end if;
    return new;
  end if;
  new.owner_id := old.owner_id;
  if not admin then
    if not allow_feature then new.featured := old.featured; new.featured_until := old.featured_until; end if;
    if new.status = 'published' and old.status is distinct from 'published'
       and coalesce(current_setting('huambo.allow_publish', true), '') <> 'on' then
      raise exception 'USE_PUBLISH_FUNCTION';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_commission_overdue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'published' and old.status is distinct from 'published' and not public.has_admin_role()
     and exists (select 1 from public.listing_commissions c where c.owner_id = new.owner_id and c.status = 'due' and c.due_at < now()) then
    raise exception 'COMMISSION_OVERDUE';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare admin boolean := public.has_admin_role();
begin
  if tg_op = 'UPDATE' then
    new.organizer_id := old.organizer_id; new.ref_no := old.ref_no;
    if old.status = 'cancelled' and new.status <> 'cancelled' and not admin then raise exception 'EVENT_CANCELLED'; end if;
    if new.status = 'cancelled' and old.status <> 'cancelled' and coalesce(current_setting('huambo.allow_cancel', true), '') <> 'on' then raise exception 'USE_CANCEL_FUNCTION'; end if;
  end if;
  if not admin and coalesce(current_setting('huambo.allow_feature', true), '') <> 'on' then
    new.featured_until := case when tg_op = 'UPDATE' then old.featured_until else null end;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if not public.current_user_active() and not admin then raise exception 'ACCOUNT_SUSPENDED'; end if;
    if new.starts_at < now() then raise exception 'EVENT_IN_PAST'; end if;
    if tg_op = 'UPDATE' and not exists (select 1 from public.event_ticket_types t where t.event_id = new.id and t.active) then raise exception 'EVENT_NEEDS_TICKETS'; end if;
    if tg_op = 'INSERT' then raise exception 'EVENT_NEEDS_TICKETS'; end if;
    if exists (select 1 from public.event_ticket_types t where t.event_id = new.id and t.active and t.price > 0)
       and not exists (select 1 from public.event_payment_info pi where pi.event_id = new.id and (nullif(trim(pi.iban), '') is not null or nullif(trim(pi.express), '') is not null)) then
      raise exception 'EVENT_NEEDS_PAYMENT_INFO';
    end if;
    if exists (select 1 from public.events e where e.organizer_id = new.organizer_id and e.id <> new.id
               and coalesce(e.ends_at, e.starts_at) < now() - interval '7 days' and public.event_fee_due(e.id) > 0) then raise exception 'EVENT_FEES_OVERDUE'; end if;
  end if;
  new.updated_at := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_fuel_station()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    if not public.has_admin_role() then new.status := 'pending'; new.admin_note := null; end if;
    if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
    if (select count(*) from public.fuel_stations where owner_id = new.owner_id) >= 10 then raise exception 'TOO_MANY_STATIONS'; end if;
  else
    if new.owner_id <> old.owner_id then raise exception 'NOT_ALLOWED'; end if;
    if (new.status is distinct from old.status or new.admin_note is distinct from old.admin_note) and not public.has_admin_role()
       and coalesce(current_setting('app.fuel_pay_changed', true), '') <> '1' then raise exception 'ADMIN_ONLY'; end if;
    if not public.has_admin_role() and old.status = 'approved' and (new.name is distinct from old.name or new.kind is distinct from old.kind
        or new.municipality_id is distinct from old.municipality_id or new.address is distinct from old.address or new.directions is distinct from old.directions
        or new.geo_lat is distinct from old.geo_lat or new.geo_lng is distinct from old.geo_lng) then
      new.status := 'pending'; new.admin_note := 'Dados do posto mudaram: à espera de nova aprovação.';
      perform public.notify_staff('⛽ Posto mudou dados', 'S-' || new.ref_no || ' · ' || new.name || ' precisa de nova aprovação.', jsonb_build_object('fuel_station_id', new.id));
    end if;
    new.updated_at := now();
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.guard_fuel_station_pay()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.fuel_stations;
begin
  if public.has_admin_role() then return new; end if;
  if tg_op = 'UPDATE' and new.holder is not distinct from old.holder and new.iban is not distinct from old.iban and new.express is not distinct from old.express then return new; end if;
  select * into s from public.fuel_stations where id = new.station_id;
  if s.status = 'approved' and (tg_op = 'UPDATE' or new.iban is not null or new.express is not null) then
    perform set_config('app.fuel_pay_changed', '1', true);
    update public.fuel_stations set status = 'pending', admin_note = 'Conta para pagamentos mudou: à espera de nova aprovação.' where id = s.id;
    perform set_config('app.fuel_pay_changed', '', true);
    perform public.notify_staff('⛽ Posto mudou a conta para pagamentos', 'S-' || s.ref_no || ' · ' || s.name || ' precisa de nova aprovação.', jsonb_build_object('fuel_station_id', s.id));
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_listing_agent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(current_setting('huambo.allow_agent', true), '') = 'on' or public.has_admin_role() then return new; end if;
  if tg_op = 'INSERT' then new.agent_id := null; else new.agent_id := old.agent_id; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_listing_deal()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.deal_with is distinct from old.deal_with and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'USE_SERVER_FUNCTIONS';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_message_sender()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_order_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if current_user in ('postgres', 'supabase_admin') then return new; end if;
  raise exception 'USE_ORDER_FUNCTIONS';
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_profile_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_admin_role() then
    new.kyc_level := old.kyc_level; new.trust_score := old.trust_score;
    new.status := old.status; new.phone_verified := old.phone_verified;
  end if;
  new.id := old.id; new.updated_at := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_review_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if public.has_admin_role() or current_user in ('postgres', 'supabase_admin') then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then return old; end if;
  raise exception 'USE_REVIEW_FUNCTION';
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_server_only_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if current_user in ('postgres', 'supabase_admin') then return new; end if;
  raise exception 'USE_SERVER_FUNCTIONS';
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_store_paid_up()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.products;
begin
  -- só verifica quando entra um produto novo ou a quantidade sobe
  if tg_op = 'UPDATE' and new.product_id = old.product_id and new.quantity <= old.quantity then return new; end if;
  select * into p from public.products where id = new.product_id;
  if found and not public.product_paid_up(p.seller_id, p.business_id) then raise exception 'STORE_UNAVAILABLE'; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_ticket_type()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare taken int;
begin
  if tg_op = 'DELETE' then
    if public.ticket_type_taken(old.id) > 0 or exists (select 1 from public.event_orders where ticket_type_id = old.id) then raise exception 'TICKET_TYPE_HAS_ORDERS'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    new.event_id := old.event_id;
    taken := public.ticket_type_taken(old.id);
    if new.quantity < taken then raise exception 'TICKETS_ALREADY_SOLD'; end if;
    if new.price <> old.price and exists (select 1 from public.event_orders where ticket_type_id = old.id and status in ('reserved', 'submitted', 'confirmed')) then raise exception 'TICKET_PRICE_LOCKED'; end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_venue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.has_admin_role() then new.updated_at := now(); return new; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.businesses b where b.id = new.business_id and b.owner_id = new.owner_id) then raise exception 'NOT_BUSINESS_OWNER'; end if;
    if (select count(*) from public.venues where owner_id = new.owner_id) >= 10 then raise exception 'TOO_MANY_VENUES'; end if;
    new.status := 'pending'; new.admin_note := null;
  else
    if new.owner_id <> old.owner_id or new.business_id <> old.business_id or new.ref_no <> old.ref_no then raise exception 'ADMIN_ONLY'; end if;
    if (new.status is distinct from old.status or new.admin_note is distinct from old.admin_note)
       and coalesce(current_setting('app.venue_pay_changed', true), '') <> '1' then raise exception 'ADMIN_ONLY'; end if;
    if new.kind <> old.kind and old.status = 'approved' then
      new.status := 'pending'; new.admin_note := 'Mudou o tipo de estabelecimento: à espera de nova aprovação.';
      perform public.notify_staff('Estabelecimento mudou de tipo', 'E-' || new.ref_no || ' precisa de nova aprovação.', jsonb_build_object('venue_id', new.id));
    end if;
  end if;
  new.updated_at := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_venue_pay()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.venues;
begin
  if public.has_admin_role() then return new; end if;
  select * into v from public.venues where id = new.venue_id;
  if v.status = 'approved' and (tg_op = 'INSERT' or new.iban is distinct from old.iban or new.express is distinct from old.express or new.holder is distinct from old.holder) then
    perform set_config('app.venue_pay_changed', '1', true);
    update public.venues set status = 'pending', admin_note = 'Conta para pagamentos mudou: à espera de nova aprovação.' where id = v.id;
    perform set_config('app.venue_pay_changed', '', true);
    perform public.notify_staff('Estabelecimento mudou a conta para pagamentos', 'E-' || v.ref_no || ' precisa de nova aprovação.', jsonb_build_object('venue_id', v.id));
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_verified_flag()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if public.has_admin_role() or current_user in ('postgres', 'supabase_admin') then return new; end if;
  if tg_op = 'INSERT' then new.verified := false; else new.verified := old.verified; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_huambo_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, phone, province, municipality)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    'Huambo',
    coalesce(new.raw_user_meta_data->>'municipality', '')
  )
  on conflict (id) do nothing;

  insert into public.account_capabilities (user_id, capability)
  values (new.id, 'customer')
  on conflict (user_id, capability) do nothing;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.has_admin_role()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('moderator','admin'))
     and public.current_user_active() and public.mfa_ok();
$function$
;

CREATE OR REPLACE FUNCTION public.inspected_targets(p_kind text, p_ids uuid[])
 RETURNS TABLE(target_id uuid, inspected_at timestamp with time zone, valid_until timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct on (i.target_id) i.target_id, i.inspected_at, i.valid_until
  from public.inspections i
  where i.kind = p_kind and i.target_id = any(p_ids[1:200]) and i.status = 'approved' and i.valid_until > now()
  order by i.target_id, i.valid_until desc
$function$
;

CREATE OR REPLACE FUNCTION public.inspection_target_name(p_kind text, p_target uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case p_kind
    when 'provider' then (select display_name from public.provider_profiles where user_id = p_target)
    when 'business' then (select name from public.businesses where id = p_target)
    when 'store' then (select 'Loja de ' || coalesce(nullif(full_name, ''), 'vendedor') from public.profiles where id = p_target)
  end
$function$
;

CREATE OR REPLACE FUNCTION public.inspection_target_owner(p_kind text, p_target uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case p_kind
    when 'provider' then (select user_id from public.provider_profiles where user_id = p_target)
    when 'business' then (select owner_id from public.businesses where id = p_target)
    when 'store' then (select id from public.profiles where id = p_target and exists (select 1 from public.products x where x.seller_id = p_target))
  end
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin') and public.current_user_active();
$function$
;

CREATE OR REPLACE FUNCTION public.is_approved_courier()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.couriers where user_id = auth.uid() and status = 'approved');
$function$
;

CREATE OR REPLACE FUNCTION public.is_order_party(p_order text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when p_order ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then exists (select 1 from public.orders where id = p_order::uuid and auth.uid() in (buyer_id, seller_id)) else false end;
$function$
;

CREATE OR REPLACE FUNCTION public.issue_event_tickets(o event_orders)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare i int;
begin
  for i in 1..o.quantity loop
    insert into public.event_tickets(code, order_id, event_id, ticket_type_id, holder_id) values (public.new_ticket_code(), o.id, o.event_id, o.ticket_type_id, o.buyer_id);
  end loop;
end $function$
;

CREATE OR REPLACE FUNCTION public.job_follow_listing(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; who text;
begin
  select * into l from public.classified_listings where id = p_id;
  if not found or l.status <> 'published' or l.purpose = 'wanted' then return; end if;
  select coalesce(nullif(full_name, ''), 'Um vendedor que segue') into who from public.profiles where id = l.owner_id;
  perform public.notify_followers(array(select user_id from public.followed_sellers where seller_id = l.owner_id), 'seller:' || l.owner_id,
    'Novo anúncio de ' || coalesce(who, 'um vendedor que segue'), l.title, jsonb_build_object('listing_id', l.id));
end $function$
;

CREATE OR REPLACE FUNCTION public.job_follow_portfolio(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare it public.portfolio_items; who text;
begin
  select * into it from public.portfolio_items where id = p_id;
  if not found then return; end if;
  if it.provider_id is not null then
    select display_name into who from public.provider_profiles where user_id = it.provider_id;
    perform public.notify_followers(array(select user_id from public.followed_providers where provider_id = it.provider_id), 'provider:' || it.provider_id,
      'Trabalho novo de ' || coalesce(who, 'um profissional que segue'), it.title, jsonb_build_object('provider_id', it.provider_id));
  else
    select name into who from public.businesses where id = it.business_id;
    perform public.notify_followers(array(select user_id from public.followed_businesses where business_id = it.business_id), 'business:' || it.business_id,
      'Novidade de ' || coalesce(who, 'uma empresa que segue'), it.title, jsonb_build_object('business_id', it.business_id));
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.job_follow_product(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.products; who text;
begin
  select * into p from public.products where id = p_id;
  if not found or not p.active then return; end if;
  select coalesce((select name from public.businesses where id = p.business_id), nullif(full_name, ''), 'Uma loja que segue') into who from public.profiles where id = p.seller_id;
  perform public.notify_followers(array(select user_id from public.followed_sellers where seller_id = p.seller_id
      union select user_id from public.followed_businesses where business_id = p.business_id),
    'seller:' || p.seller_id, 'Novo produto de ' || coalesce(who, 'uma loja que segue'), p.name, jsonb_build_object('product_id', p.id));
end $function$
;

CREATE OR REPLACE FUNCTION public.job_fuel_alert(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.fuel_products; s public.fuel_stations;
begin
  select * into p from public.fuel_products where id = p_id;
  if not found or p.status not in ('available', 'low') then return; end if;
  select * into s from public.fuel_stations where id = p.station_id;
  if s.status <> 'approved' then return; end if;
  if exists (select 1 from public.notifications n where n.data->>'for' = 'fuel' and n.data->>'product_id' = p.id::text and n.created_at > now() - interval '2 hours') then return; end if;
  insert into public.notifications(user_id, type, title, body, data)
  select distinct a.user_id, 'system', '⛽ Há ' || lower(public.fuel_product_label(p.product)) || '!',
    s.name || coalesce(' · ' || (select m.name from public.municipalities m where m.id = s.municipality_id), '') || case when p.price is not null then ' · ' || p.price || ' Kz' else '' end,
    jsonb_build_object('for', 'fuel', 'station_id', s.id, 'product_id', p.id)
  from public.fuel_alerts a
  where a.product = p.product and (a.municipality_id is null or a.municipality_id = s.municipality_id) and a.user_id <> s.owner_id
  limit 5000;
end $function$
;

CREATE OR REPLACE FUNCTION public.job_queue_cleanup()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  delete from public.job_queue where done_at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.job_saved_search(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; s record;
begin
  select * into l from public.classified_listings where id = p_id;
  if not found or l.status <> 'published' then return; end if;
  for s in select id, user_id, name, coalesce(notification_frequency, 'immediate') frequency from public.classified_saved_searches
    where active = true and user_id <> l.owner_id and (notification_quiet_until is null or notification_quiet_until <= now())
      and public.classified_saved_search_matches_listing(filters, l) loop
    if s.frequency = 'daily' then
      insert into public.saved_search_notification_queue(saved_search_id, user_id, listing_id) values (s.id, s.user_id, l.id) on conflict do nothing;
    else
      insert into public.notifications(user_id, type, title, body, data)
      values (s.user_id, 'saved_search', 'Novo anúncio encontrado', 'Um novo anúncio corresponde à sua pesquisa guardada "' || s.name || '".',
        jsonb_build_object('saved_search_id', s.id, 'listing_id', l.id, 'listing_type', l.listing_type, 'purpose', l.purpose)) on conflict do nothing;
      if found then update public.classified_saved_searches set last_notified_at = now(), updated_at = now() where id = s.id; end if;
    end if;
  end loop;
end $function$
;

CREATE OR REPLACE FUNCTION public.job_wanted(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; words text[]; budget text;
begin
  select * into l from public.classified_listings where id = p_id;
  if not found or l.purpose <> 'wanted' or l.status <> 'published' then return; end if;
  words := public.wanted_keywords(l.title);
  if coalesce(array_length(words, 1), 0) = 0 then return; end if;
  budget := case
    when l.budget_min is not null and l.budget_max is not null then ' Orçamento: ' || l.budget_min || ' – ' || l.budget_max || ' Kz.'
    when l.budget_max is not null then ' Orçamento: até ' || l.budget_max || ' Kz.'
    when l.budget_min is not null then ' Orçamento: a partir de ' || l.budget_min || ' Kz.'
    else '' end;
  insert into public.notifications(user_id, type, title, body, data)
  select s.uid, 'system', 'Alguém procura o que vende', '«' || l.title || '».' || budget, jsonb_build_object('listing_id', l.id, 'for', 'wanted')
  from (
    select p.seller_id as uid from public.products p
     where p.active and p.seller_id <> l.owner_id and exists (select 1 from unnest(words) w where public.fold_text(p.name) like '%' || w || '%')
    union
    select x.owner_id from public.classified_listings x
     where x.status = 'published' and x.purpose in ('sale', 'rent', 'lease', 'auction') and x.owner_id <> l.owner_id
       and exists (select 1 from unnest(words) w where public.fold_text(x.title) like '%' || w || '%')
  ) s
  where not exists (select 1 from public.notifications n where n.user_id = s.uid and n.data->>'listing_id' = l.id::text)
  limit 30;
  insert into public.notifications(user_id, type, title, body, data)
  select s.uid, 'system', 'Alguém procura os seus serviços', '«' || l.title || '».' || budget, jsonb_build_object('listing_id', l.id, 'for', 'wanted')
  from (
    select pp.user_id as uid from public.provider_profiles pp left join public.categories c on c.id = pp.category_id
     where pp.active and pp.user_id <> l.owner_id and exists (select 1 from unnest(words) w where
       public.fold_text(concat_ws(' ', c.name, pp.custom_category, pp.headline, pp.display_name)) like '%' || w || '%'
       or exists (select 1 from public.services sv where sv.provider_id = pp.user_id and sv.active and public.fold_text(sv.title) like '%' || w || '%'))
    union
    select b.owner_id from public.businesses b left join public.categories c on c.id = b.category_id
     where b.active and b.owner_id <> l.owner_id and exists (select 1 from unnest(words) w where
       public.fold_text(concat_ws(' ', c.name, b.custom_category, b.name, b.description)) like '%' || w || '%')
  ) s
  where not exists (select 1 from public.notifications n where n.user_id = s.uid and n.data->>'listing_id' = l.id::text)
  limit 30;
end $function$
;

CREATE OR REPLACE FUNCTION public.list_active_categories(p_type text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, slug text, type text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select id,name,slug,type
  from public.categories
  where active=true and (p_type is null or type=p_type)
  order by name;
$function$
;

CREATE OR REPLACE FUNCTION public.list_active_provinces(p_country_code text DEFAULT 'AO'::text)
 RETURNS TABLE(id uuid, name text, country_code text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select id,name,country_code
  from public.provinces
  where country_code=upper(p_country_code) and active=true
  order by name;
$function$
;

CREATE OR REPLACE FUNCTION public.list_events(p_category text DEFAULT NULL::text, p_municipality uuid DEFAULT NULL::uuid, p_query text DEFAULT NULL::text, p_limit integer DEFAULT 60)
 RETURNS TABLE(id uuid, ref_no bigint, title text, category text, starts_at timestamp with time zone, ends_at timestamp with time zone, venue text, municipality_name text, cover_url text, featured boolean, price_from numeric, tickets_left bigint, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select e.id, e.ref_no, e.title, e.category, e.starts_at, e.ends_at, e.venue, m.name, e.cover_url, coalesce(e.featured_until > now(), false),
    (select min(t.price) from public.event_ticket_types t where t.event_id = e.id and t.active),
    (select coalesce(sum(t.quantity - public.ticket_type_taken(t.id)), 0) from public.event_ticket_types t where t.event_id = e.id and t.active),
    e.status
  from public.events e left join public.municipalities m on m.id = e.municipality_id
  where e.status = 'published' and coalesce(e.ends_at, e.starts_at + interval '6 hours') > now()
    and (p_category is null or e.category = p_category) and (p_municipality is null or e.municipality_id = p_municipality)
    and (p_query is null or e.title ilike '%' || p_query || '%' or e.venue ilike '%' || p_query || '%')
  order by coalesce(e.featured_until > now(), false) desc, e.starts_at
  limit least(greatest(coalesce(p_limit, 60), 1), 200)
$function$
;

CREATE OR REPLACE FUNCTION public.list_reviews(p_provider_id uuid DEFAULT NULL::uuid, p_business_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, rating integer, comment text, created_at timestamp with time zone, author_id uuid, author_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, r.rating, r.comment, r.created_at, r.author_id, coalesce(nullif(p.full_name, ''), 'Utilizador')
  from public.reviews r left join public.profiles p on p.id = r.author_id
  where r.status = 'published'
    and ((p_provider_id is not null and r.provider_id = p_provider_id) or (p_business_id is not null and r.business_id = p_business_id))
  order by r.created_at desc limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.list_reviews_v2(p_provider_id uuid DEFAULT NULL::uuid, p_business_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, rating smallint, comment text, created_at timestamp with time zone, author_id uuid, author_name text, confirmed boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, r.rating, r.comment, r.created_at, r.author_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), r.service_request_id is not null
  from public.reviews r left join public.profiles p on p.id = r.author_id
  where r.status = 'published' and ((p_provider_id is not null and r.provider_id = p_provider_id) or (p_business_id is not null and r.business_id = p_business_id))
  order by (r.service_request_id is not null) desc, r.created_at desc limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.list_reviews_v3(p_provider_id uuid DEFAULT NULL::uuid, p_business_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, rating smallint, comment text, created_at timestamp with time zone, author_id uuid, author_name text, confirmed boolean, owner_reply text, owner_reply_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, r.rating, r.comment, r.created_at, r.author_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), r.service_request_id is not null, r.owner_reply, r.owner_reply_at
  from public.reviews r left join public.profiles p on p.id = r.author_id
  where r.status = 'published' and ((p_provider_id is not null and r.provider_id = p_provider_id) or (p_business_id is not null and r.business_id = p_business_id))
  order by (r.service_request_id is not null) desc, r.created_at desc limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.listing_agent_published()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.agent_id is not null and new.status = 'sold' and old.status is distinct from 'sold' then
    perform public.agent_commission_create(new.id);
  elsif old.status = 'sold' and new.status is distinct from 'sold' then
    update public.agent_commissions set status = 'cancelled', admin_note = 'O anúncio deixou de estar vendido.', decided_at = now()
     where listing_id = new.id and status = 'pending';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.listing_claim_deadline(p_listing_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); l public.classified_listings; days int; since timestamptz;
begin
  if me is null then return null; end if;
  select * into l from public.classified_listings where id = p_listing_id;
  if not found or l.owner_id = me then return null; end if;
  select claim_days into days from public.platform_settings where id = 1;
  if l.deal_with = me and l.status in ('sold', 'rented') then since := l.deal_at; end if;
  select greatest(since, max(r.starts_at)) into since from public.rental_requests r where r.listing_id = l.id and r.renter_id = me and r.status = 'accepted';
  if since is null then return null; end if;
  if since + make_interval(days => days) < now() then return null; end if;
  return since + make_interval(days => days);
end $function$
;

CREATE OR REPLACE FUNCTION public.listing_claims_tick()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer := 0; c record;
begin
  for c in select * from public.listing_claims where status = 'open' and respond_by < now() for update skip locked loop
    update public.listing_claims set status = 'escalated', updated_at = now() where id = c.id;
    insert into public.notifications(user_id, type, title, body, data)
    select x.u, 'system', 'Reclamação enviada à administração', '«' || left(c.listing_title, 120) || '» (R-' || c.ref_no || '): o vendedor não respondeu em 3 dias.',
      jsonb_build_object('for', 'claim') from (values (c.buyer_id), (c.seller_id)) x(u);
    perform public.notify_staff('Reclamação de anúncio para decidir', 'R-' || c.ref_no || ' · sem resposta do vendedor', jsonb_build_object('claim_id', c.id));
    n := n + 1;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.listing_commission_add(l classified_listings, p_amount numeric, p_source text, p_rental uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare st public.platform_settings; fee numeric; due timestamptz; what text;
begin
  select * into st from public.platform_settings where id = 1;
  if p_amount is null or p_amount <= 0 or st.listing_commission_pct <= 0 then return; end if;
  fee := round(p_amount * st.listing_commission_pct / 100);
  due := now() + make_interval(days => st.commission_due_days);
  insert into public.listing_commissions(listing_id, owner_id, listing_title, listed_price, sale_amount, rate_pct, amount, source, due_at, rental_request_id)
  values (l.id, l.owner_id, l.title, l.price, p_amount, st.listing_commission_pct, fee, p_source, due, p_rental)
  on conflict do nothing;
  if not found then return; end if;
  what := case when p_source in ('rental', 'rented') then 'Arrendamento registado' else 'Venda registada' end;
  insert into public.notifications(user_id, type, title, body, data)
  values (l.owner_id, 'system', what || ': comissão de ' || st.listing_commission_pct || '%',
          '«' || l.title || '» ' || case when p_source in ('rental', 'rented') then 'arrendado' else 'vendido' end || ' por ' || p_amount || ' Kz. Comissão a pagar: '
          || fee || ' Kz até ' || to_char(due at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '.',
          jsonb_build_object('listing_id', l.id, 'for', 'commission'));
end $function$
;

CREATE OR REPLACE FUNCTION public.listing_commission_on_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare amt numeric; src text := 'sold'; offer_amt numeric;
begin
  if new.status = 'sold' and old.status is distinct from 'sold' and new.purpose in ('sale', 'auction') then
    if new.deal_with is not null then
      select o.amount into offer_amt from public.listing_offers o where o.listing_id = new.id and o.buyer_id = new.deal_with and o.status = 'accepted' and o.amount is not null
       order by o.responded_at desc nulls last limit 1;
    end if;
    amt := coalesce(new.sale_amount, offer_amt, new.price);
    if new.sale_amount is null and offer_amt is not null then src := 'offer'; end if;
    if new.purpose = 'auction' then src := 'auction'; end if;
    perform public.listing_commission_add(new, amt, src);
  elsif new.status = 'rented' and old.status is distinct from 'rented' and new.purpose in ('rent', 'lease') then
    if not exists (select 1 from public.listing_commissions c where c.listing_id = new.id and c.source = 'rental' and c.status <> 'cancelled'
                   and c.created_at > now() - interval '30 days') then
      perform public.listing_commission_add(new, coalesce(new.sale_amount, new.price), 'rented');
    end if;
  elsif (old.status = 'sold' and new.status is distinct from 'sold') or (old.status = 'rented' and new.status is distinct from 'rented') then
    update public.listing_commissions set status = 'cancelled', admin_note = coalesce(admin_note, 'Anúncio deixou de estar vendido/arrendado.')
     where listing_id = new.id and status = 'due' and rental_request_id is null;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.listing_deal_candidates(p_listing_id uuid)
 RETURNS TABLE(user_id uuid, full_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.classified_listings where id = p_listing_id and owner_id = auth.uid()) then raise exception 'NOT_LISTING_OWNER'; end if;
  return query select distinct x.uid, coalesce(nullif(p.full_name, ''), 'Utilizador') from (
    select cp.user_id as uid from public.conversations c join public.conversation_participants cp on cp.conversation_id = c.id
     where c.classified_listing_id = p_listing_id
    union
    select o.buyer_id from public.listing_offers o where o.listing_id = p_listing_id and o.status in ('pending', 'accepted')
  ) x left join public.profiles p on p.id = x.uid
  where x.uid <> auth.uid();
end $function$
;

CREATE OR REPLACE FUNCTION public.listing_offers_for(p_listing_id uuid)
 RETURNS TABLE(id uuid, buyer_id uuid, buyer_name text, amount numeric, trade_item text, message text, status text, seller_note text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.classified_listings where id = p_listing_id and owner_id = auth.uid()) then raise exception 'NOT_LISTING_OWNER'; end if;
  return query select o.id, o.buyer_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), o.amount, o.trade_item, o.message, o.status, o.seller_note, o.created_at
  from public.listing_offers o left join public.profiles p on p.id = o.buyer_id
  where o.listing_id = p_listing_id order by (o.status = 'pending') desc, o.created_at desc limit 100;
end $function$
;

CREATE OR REPLACE FUNCTION public.listing_territory_active(p_listing classified_listings)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare ok boolean;
begin
  if p_listing.address_id is null then return true; end if;
  select a.active and coalesce(s.active,false) and coalesce(p.active,false) into ok
  from public.addresses a left join public.streets s on s.id=a.street_id left join public.neighborhoods n on n.id=s.neighborhood_id left join public.municipalities m on m.id=n.municipality_id left join public.provinces p on p.id=m.province_id where a.id=p_listing.address_id;
  return coalesce(ok,false);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.make_offer(p_listing_id uuid, p_amount numeric, p_trade_item text DEFAULT NULL::text, p_message text DEFAULT NULL::text)
 RETURNS listing_offers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; o public.listing_offers; t text := nullif(left(trim(coalesce(p_trade_item, '')), 300), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into l from public.classified_listings where id = p_listing_id;
  if not found or l.status <> 'published' then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.owner_id = auth.uid() then raise exception 'CANNOT_OFFER_OWN_LISTING'; end if;
  if l.purpose in ('wanted', 'auction') or coalesce(l.sale_mode, 'negotiable') in ('fixed', 'auction') and not l.accepts_trade then raise exception 'OFFERS_NOT_ACCEPTED'; end if;
  if p_amount is null and t is null then raise exception 'OFFER_REQUIRED'; end if;
  if p_amount is not null and p_amount <= 0 then raise exception 'INVALID_OFFER'; end if;
  if t is not null and not (l.accepts_trade or l.sale_mode in ('trade', 'offers')) then raise exception 'TRADE_NOT_ACCEPTED'; end if;
  if l.sale_mode = 'trade' and t is null then raise exception 'TRADE_REQUIRED'; end if;
  if l.sale_mode = 'fixed' and t is null then raise exception 'OFFERS_NOT_ACCEPTED'; end if; -- preço fixo: só propostas de troca
  if exists (select 1 from public.listing_offers where listing_id = l.id and buyer_id = auth.uid() and status = 'pending') then raise exception 'OFFER_PENDING'; end if;
  if (select count(*) from public.listing_offers where buyer_id = auth.uid() and created_at > now() - interval '1 day') >= 30 then raise exception 'TOO_MANY_REQUESTS'; end if;
  insert into public.listing_offers(listing_id, buyer_id, amount, trade_item, message)
  values (l.id, auth.uid(), p_amount, t, nullif(left(trim(coalesce(p_message, '')), 500), '')) returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (l.owner_id, 'system', 'Nova proposta', '«' || l.title || '»: ' || concat_ws(' + ', case when p_amount is not null then replace(to_char(p_amount, 'FM999,999,999,990'), ',', ' ') || ' Kz' end, case when t is not null then 'troca por ' || t end),
          jsonb_build_object('listing_id', l.id, 'offer_id', o.id, 'for', 'offer'));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.mark_videos_removed(p_paths text[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer := 0; k integer;
begin
  update public.classified_listings set video_url = null where public.video_path(video_url) = any(p_paths);
  get diagnostics k = row_count; n := n + k;
  update public.products set video_url = null where public.video_path(video_url) = any(p_paths);
  get diagnostics k = row_count; n := n + k;
  update public.media_cleanup_queue set done_at = now() where path = any(p_paths);
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.market_directory(p_query text DEFAULT ''::text, p_municipality_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, name text, municipality_id uuid, municipality_name text, address_text text, description text, opening_hours text, photo_url text, listings bigint, products bigint, businesses bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select m.id, m.name, m.municipality_id, mu.name, m.address_text, m.description, m.opening_hours, m.photo_url,
    (select count(*) from public.classified_listings l where l.market_id = m.id and l.status = 'published'),
    (select count(*) from public.products p where p.market_id = m.id and p.active),
    (select count(*) from public.businesses b where b.market_id = m.id and b.active)
  from public.markets m left join public.municipalities mu on mu.id = m.municipality_id
  where m.status = 'active'
    and (coalesce(trim(p_query), '') = '' or m.name ilike '%' || trim(p_query) || '%' or m.address_text ilike '%' || trim(p_query) || '%')
    and (p_municipality_id is null or m.municipality_id = p_municipality_id)
  order by m.name limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.messages_block_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if exists (select 1 from public.conversation_participants o join public.user_blocks b
               on (b.blocker_id = o.user_id and b.blocked_id = new.sender_id) or (b.blocker_id = new.sender_id and b.blocked_id = o.user_id)
             where b.active and o.conversation_id = new.conversation_id and o.user_id <> new.sender_id) then
    raise exception 'BLOCKED';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.mfa_ok()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$function$
;

CREATE OR REPLACE FUNCTION public.my_admin_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select role from public.user_roles where user_id = auth.uid()), 'user');
$function$
;

CREATE OR REPLACE FUNCTION public.my_auction_bids()
 RETURNS TABLE(auction_id uuid, listing_id uuid, ref_no bigint, title text, photo text, status text, ends_at timestamp with time zone, current_price numeric, my_max numeric, standing text, bid_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.id, a.classified_listing_id, l.ref_no, a.title, l.media->>0, a.status, a.ends_at, a.current_price,
    case when m.retracted_at is null then m.max_amount end,
    case
      when m.retracted_at is not null then case when m.retracted_by = m.bidder_id then 'retracted' else 'cancelled' end
      when a.status = 'ended' and a.winner_id = m.bidder_id then 'won'
      when a.status = 'ended' then case when a.winner_id is null and s.leader = m.bidder_id then 'reserve_not_met' else 'lost' end
      when a.status = 'cancelled' then 'auction_cancelled'
      when s.leader = m.bidder_id then 'winning'
      else 'outbid' end,
    (select count(*) from public.auction_bids b where b.auction_id = a.id and b.retracted_at is null)
  from public.auction_max_bids m
  join public.auctions a on a.id = m.auction_id
  left join public.classified_listings l on l.id = a.classified_listing_id
  cross join lateral public.auction_standing(a.id) s
  where m.bidder_id = auth.uid()
  order by (a.status = 'live') desc, a.ends_at asc limit 200;
$function$
;
CREATE OR REPLACE FUNCTION public.my_blocks()
 RETURNS TABLE(user_id uuid, name text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select b.blocked_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), b.created_at
  from public.user_blocks b left join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid() and b.active order by b.created_at desc limit 500;
$function$
;

CREATE OR REPLACE FUNCTION public.my_commissions()
 RETURNS TABLE(id uuid, listing_id uuid, listing_title text, listed_price numeric, sale_amount numeric, rate_pct numeric, amount numeric, source text, status text, due_at timestamp with time zone, overdue boolean, reference text, admin_note text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.listing_id, c.listing_title, c.listed_price, c.sale_amount, c.rate_pct, c.amount, c.source, c.status, c.due_at,
    c.status = 'due' and c.due_at < now(), c.reference, c.admin_note, c.created_at
  from public.listing_commissions c where c.owner_id = auth.uid() and c.status <> 'cancelled'
  order by (c.status = 'due') desc, c.due_at, c.created_at desc limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.my_conversation_partners()
 RETURNS TABLE(conversation_id uuid, other_user_id uuid, other_name text, other_avatar text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct on (me.conversation_id) me.conversation_id, o.user_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), p.avatar_url
  from public.conversation_participants me
  join public.conversation_participants o on o.conversation_id = me.conversation_id and o.user_id <> me.user_id
  left join public.profiles p on p.id = o.user_id
  where me.user_id = auth.uid()
  order by me.conversation_id, o.joined_at;
$function$
;

CREATE OR REPLACE FUNCTION public.my_deliveries(p_role text DEFAULT 'courier'::text)
 RETURNS TABLE(id uuid, order_id uuid, status text, notes text, requested_at timestamp with time zone, assigned_at timestamp with time zone, delivered_at timestamp with time zone, total numeric, currency text, delivery_text text, contact_phone text, seller_name text, buyer_name text, courier_name text, courier_phone text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select d.id, d.order_id, d.status, d.notes, d.requested_at, d.assigned_at, d.delivered_at, o.total, o.currency, o.delivery_text,
    case when p_role = 'courier' or o.seller_id = auth.uid() then o.contact_phone end,
    coalesce(nullif(sp.full_name, ''), 'Vendedor'), coalesce(nullif(bp.full_name, ''), 'Cliente'), c.display_name, c.phone
  from public.delivery_requests d join public.orders o on o.id = d.order_id
  left join public.profiles sp on sp.id = o.seller_id
  left join public.profiles bp on bp.id = o.buyer_id
  left join public.couriers c on c.user_id = d.assigned_to
  where (p_role = 'courier' and d.assigned_to = auth.uid())
     or (p_role <> 'courier' and (o.seller_id = auth.uid() or o.buyer_id = auth.uid()))
  order by d.requested_at desc limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.my_disputes()
 RETURNS TABLE(id uuid, order_id uuid, my_role text, other_name text, request text, reason text, description text, amount numeric, status text, outcome text, admin_note text, created_at timestamp with time zone, updated_at timestamp with time zone, order_total numeric, order_items jsonb, events jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select d.id, d.order_id, case when d.buyer_id = auth.uid() then 'buyer' else 'seller' end,
    coalesce(nullif(p.full_name, ''), 'Utilizador'), d.request, d.reason, d.description, d.amount, d.status, d.outcome, d.admin_note,
    d.created_at, d.updated_at, o.total,
    (select coalesce(jsonb_agg(jsonb_build_object('name', pr.name, 'quantity', oi.quantity) order by pr.name), '[]')
       from public.order_items oi join public.products pr on pr.id = oi.product_id where oi.order_id = o.id),
    public.dispute_events_json(d.id)
  from public.order_disputes d join public.orders o on o.id = d.order_id
  left join public.profiles p on p.id = case when d.buyer_id = auth.uid() then d.seller_id else d.buyer_id end
  where auth.uid() in (d.buyer_id, d.seller_id)
  order by (d.status <> 'resolved') desc, d.updated_at desc limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.my_disputes_v2()
 RETURNS TABLE(id uuid, order_id uuid, my_role text, other_name text, request text, reason text, description text, amount numeric, status text, outcome text, admin_note text, created_at timestamp with time zone, updated_at timestamp with time zone, order_total numeric, order_items jsonb, events jsonb, protected boolean, escrow_status text, refund_to text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select d.id, d.order_id, case when d.buyer_id = auth.uid() then 'buyer' else 'seller' end,
    coalesce(nullif(p.full_name, ''), 'Utilizador'), d.request, d.reason, d.description, d.amount, d.status, d.outcome, d.admin_note,
    d.created_at, d.updated_at, o.total,
    (select coalesce(jsonb_agg(jsonb_build_object('name', pr.name, 'quantity', oi.quantity) order by pr.name), '[]')
       from public.order_items oi join public.products pr on pr.id = oi.product_id where oi.order_id = o.id),
    public.dispute_events_json(d.id), o.protected, o.escrow_status,
    case when d.buyer_id = auth.uid() then d.refund_to end
  from public.order_disputes d join public.orders o on o.id = d.order_id
  left join public.profiles p on p.id = case when d.buyer_id = auth.uid() then d.seller_id else d.buyer_id end
  where auth.uid() in (d.buyer_id, d.seller_id)
  order by (d.status <> 'resolved') desc, d.updated_at desc limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.my_event_tickets()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(x order by x.starts_at desc), '[]') from (
    select o.id, o.ref_no, o.status, o.quantity, o.total, o.unit_price, o.method, o.reference, o.pay_by, o.note, o.created_at,
      e.id event_id, e.title, e.starts_at, e.ends_at, e.venue, e.status event_status, e.cancel_reason,
      pi.holder pay_holder, pi.iban pay_iban, pi.express pay_express, pi.note pay_note, t.name type_name,
      (select coalesce(jsonb_agg(jsonb_build_object('code', k.code, 'status', k.status) order by k.code), '[]') from public.event_tickets k where k.order_id = o.id) tickets
    from public.event_orders o join public.events e on e.id = o.event_id join public.event_ticket_types t on t.id = o.ticket_type_id
      left join public.event_payment_info pi on pi.event_id = e.id
    where o.buyer_id = auth.uid() order by e.starts_at desc limit 200) x
$function$
;

CREATE OR REPLACE FUNCTION public.my_field_agent()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); a public.field_agents; st public.platform_settings;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into st from public.platform_settings where id = 1;
  select * into a from public.field_agents where user_id = me;
  if not found then return jsonb_build_object('agent', null, 'sale_pct', st.agent_sale_pct); end if;
  return jsonb_build_object(
    'agent', jsonb_build_object('code', a.code, 'status', a.status, 'full_name', a.full_name, 'phone', a.phone, 'note', a.note,
      'admin_note', a.admin_note, 'market_id', a.market_id, 'market_name', (select m.name from public.markets m where m.id = a.market_id), 'created_at', a.created_at),
    'sale_pct', st.agent_sale_pct,
    'pending_kz', (select coalesce(sum(amount), 0) from public.agent_commissions where agent_id = me and status = 'pending'),
    'approved_kz', (select coalesce(sum(amount), 0) from public.agent_commissions where agent_id = me and status = 'approved'),
    'listings', (select count(*) from public.classified_listings where agent_id = me),
    'sold', (select count(*) from public.classified_listings where agent_id = me and status = 'sold'),
    'helped', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select l.id, l.title, l.status, l.price, l.currency, l.created_at from public.classified_listings l
      where l.agent_id = me and l.status <> 'draft' order by l.created_at desc limit 100) x),
    'commissions', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select c.id, c.listing_id, c.listing_title, c.amount, c.sale_amount, c.rate_pct, c.status, c.admin_note, c.created_at, c.decided_at,
        (select l.status from public.classified_listings l where l.id = c.listing_id) listing_status
      from public.agent_commissions c where c.agent_id = me order by c.created_at desc limit 100) x));
end $function$
;

CREATE OR REPLACE FUNCTION public.my_follower_count()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*) from public.followed_sellers where seller_id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.my_follows()
 RETURNS TABLE(kind text, id uuid, name text, picture text, detail text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select 'seller', f.seller_id, coalesce(nullif(p.full_name, ''), 'Utilizador'), p.avatar_url, p.municipality, f.created_at
    from public.followed_sellers f join public.profiles p on p.id = f.seller_id where f.user_id = auth.uid()
  union all
  select 'provider', f.provider_id, pp.display_name, pp.avatar_url, pp.headline, f.created_at
    from public.followed_providers f join public.provider_profiles pp on pp.user_id = f.provider_id where f.user_id = auth.uid()
  union all
  select 'business', f.business_id, b.name, b.logo_url, b.address_text, f.created_at
    from public.followed_businesses f join public.businesses b on b.id = f.business_id where f.user_id = auth.uid()
  order by 6 desc limit 500;
$function$
;

CREATE OR REPLACE FUNCTION public.my_fuel_orders()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select o.id, o.ref_no, o.status, o.method, o.product, o.quantity, o.unit_price, o.subtotal, o.fee_pct, o.fee_amount, o.total, o.code,
      case when o.status in ('reserved', 'submitted', 'paid') then o.qr_token end qr_token,
      o.hold_until, o.pay_by, o.pay_method, o.reference, o.proof_path, o.note, o.plate,
      o.created_at, s.id station_id, s.name station_name, s.address, s.directions, s.geo_lat, s.geo_lng, s.phone,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.holder end pay_holder,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.iban end pay_iban,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.express end pay_express,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.note end pay_note
    from public.fuel_orders o join public.fuel_stations s on s.id = o.station_id left join public.fuel_station_pay y on y.station_id = s.id
    where o.buyer_id = auth.uid() order by o.created_at desc limit 100) x
$function$
;

CREATE OR REPLACE FUNCTION public.my_inspections()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select i.id, i.ref_no, i.kind, i.target_id, public.inspection_target_name(i.kind, i.target_id) target_name, i.status, i.address, i.phone, i.preferred_time,
      i.note, i.scheduled_for, i.admin_note, i.inspected_at, i.valid_until, i.created_at, i.fee_amount, i.pay_method, i.pay_reference, i.paid_at
    from public.inspections i where i.owner_id = auth.uid() order by i.created_at desc limit 50) x
$function$
;

CREATE OR REPLACE FUNCTION public.my_item_stats(p_days integer DEFAULT 30)
 RETURNS TABLE(kind text, item_id uuid, title text, status text, created_at timestamp with time zone, views bigint, views_total bigint, whatsapp bigint, calls bigint, shares bigint, saves bigint, messages bigint, offers bigint, orders bigint, followers bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); d integer := least(greatest(coalesce(p_days, 30), 1), 365); since date; since_ts timestamptz;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  since := public.angola_today() - (d - 1);
  since_ts := (since::timestamp at time zone 'Africa/Luanda');
  return query
  with items as (
    select 'listing'::text k, l.id, l.title::text t, l.status::text st, l.created_at c from public.classified_listings l
      where l.owner_id = me and l.status not in ('draft', 'cancelled')
    union all select 'product', p.id, p.name, case when p.active then 'active' else 'inactive' end, p.created_at from public.products p where p.seller_id = me
    union all select 'business', b.id, b.name, case when b.active then 'active' else 'inactive' end, b.created_at from public.businesses b where b.owner_id = me
    union all select 'provider', pp.user_id, pp.display_name, case when pp.active then 'active' else 'inactive' end, pp.created_at from public.provider_profiles pp where pp.user_id = me
  )
  select i.k, i.id, i.t, i.st, i.c,
    coalesce(sum(s.views) filter (where s.day >= since), 0)::bigint,
    coalesce(sum(s.views), 0)::bigint,
    coalesce(sum(s.whatsapp) filter (where s.day >= since), 0)::bigint,
    coalesce(sum(s.calls) filter (where s.day >= since), 0)::bigint,
    coalesce(sum(s.shares) filter (where s.day >= since), 0)::bigint,
    (select count(*) from public.saved_items si where case i.k when 'listing' then si.classified_listing_id when 'product' then si.product_id
       when 'business' then si.business_id else si.provider_id end = i.id),
    (select count(*) from public.conversations cv where cv.created_at >= since_ts and cv.created_by <> me and case i.k when 'listing' then cv.classified_listing_id
       when 'product' then cv.product_id when 'business' then cv.business_id else cv.provider_id end = i.id),
    case when i.k = 'listing' then (select count(*) from public.listing_offers o where o.listing_id = i.id and o.created_at >= since_ts) else 0 end,
    case when i.k = 'product' then (select count(distinct oi.order_id) from public.order_items oi where oi.product_id = i.id and oi.created_at >= since_ts)
         when i.k = 'provider' then (select count(*) from public.service_requests r where r.provider_id = i.id and r.business_id is null and r.created_at >= since_ts)
         when i.k = 'business' then (select count(*) from public.service_requests r where r.business_id = i.id and r.created_at >= since_ts) else 0 end,
    case when i.k = 'business' then (select count(*) from public.followed_businesses f where f.business_id = i.id)
         when i.k = 'provider' then (select count(*) from public.followed_providers f where f.provider_id = i.id) else 0 end
  from items i
  left join public.item_stats_daily s on s.kind = i.k and s.item_id = i.id
  group by i.k, i.id, i.t, i.st, i.c;
end $function$
;

CREATE OR REPLACE FUNCTION public.my_listing_boosts()
 RETURNS TABLE(id uuid, ref_no bigint, listing_id uuid, listing_title text, days integer, amount numeric, status text, method text, reference text, starts_at timestamp with time zone, ends_at timestamp with time zone, admin_note text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select b.id, b.ref_no, b.listing_id, l.title, b.days, b.amount, b.status, b.method, b.reference, b.starts_at, b.ends_at, b.admin_note, b.created_at
  from public.listing_boosts b join public.classified_listings l on l.id = b.listing_id
  where b.owner_id = auth.uid() order by b.created_at desc limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.my_listing_claims()
 RETURNS TABLE(id uuid, ref_no bigint, listing_id uuid, listing_title text, role text, other_name text, request text, reason text, description text, amount numeric, status text, outcome text, seller_note text, admin_note text, decided_by_admin boolean, respond_by timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.ref_no, c.listing_id, c.listing_title, case when c.buyer_id = auth.uid() then 'buyer' else 'seller' end,
    coalesce(nullif(p.full_name, ''), 'Utilizador'), c.request, c.reason, c.description, c.amount, c.status, c.outcome, c.seller_note, c.admin_note,
    c.decided_by_admin, c.respond_by, c.created_at, c.updated_at
  from public.listing_claims c left join public.profiles p on p.id = case when c.buyer_id = auth.uid() then c.seller_id else c.buyer_id end
  where c.buyer_id = auth.uid() or c.seller_id = auth.uid()
  order by c.updated_at desc limit 200
$function$
;

CREATE OR REPLACE FUNCTION public.my_listing_offer_counts()
 RETURNS TABLE(listing_id uuid, pending bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select o.listing_id, count(*) from public.listing_offers o join public.classified_listings l on l.id = o.listing_id
  where l.owner_id = auth.uid() and o.status = 'pending' group by o.listing_id;
$function$
;

CREATE OR REPLACE FUNCTION public.my_offers()
 RETURNS TABLE(id uuid, listing_id uuid, listing_title text, listing_status text, amount numeric, trade_item text, message text, status text, seller_note text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select o.id, o.listing_id, l.title, l.status, o.amount, o.trade_item, o.message, o.status, o.seller_note, o.created_at
  from public.listing_offers o join public.classified_listings l on l.id = o.listing_id
  where o.buyer_id = auth.uid() order by o.created_at desc limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.my_orders(p_role text DEFAULT 'buyer'::text)
 RETURNS TABLE(id uuid, status text, payment_status text, payment_method text, fulfillment_type text, total numeric, currency text, created_at timestamp with time zone, buyer_id uuid, seller_id uuid, other_name text, contact_phone text, delivery_text text, buyer_note text, items jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select o.id, o.status, o.payment_status, o.payment_method, o.fulfillment_type, o.total, o.currency, o.created_at, o.buyer_id, o.seller_id,
         coalesce(nullif(pr.full_name, ''), 'Utilizador'),
         case when p_role = 'seller' then o.contact_phone end, o.delivery_text, o.buyer_note,
         (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'quantity', oi.quantity, 'line_total', oi.line_total) order by p.name), '[]')
            from public.order_items oi join public.products p on p.id = oi.product_id where oi.order_id = o.id)
  from public.orders o
  left join public.profiles pr on pr.id = case when p_role = 'seller' then o.buyer_id else o.seller_id end
  where (p_role = 'seller' and o.seller_id = auth.uid()) or (p_role <> 'seller' and o.buyer_id = auth.uid())
  order by o.created_at desc limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.my_orders_v2(p_role text DEFAULT 'buyer'::text)
 RETURNS TABLE(id uuid, ref_no bigint, status text, payment_status text, payment_method text, fulfillment_type text, total numeric, currency text, created_at timestamp with time zone, updated_at timestamp with time zone, completed_at timestamp with time zone, refunded_amount numeric, buyer_id uuid, seller_id uuid, other_name text, contact_phone text, delivery_text text, buyer_note text, items jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select o.id, o.ref_no, o.status, o.payment_status, o.payment_method, o.fulfillment_type, o.total, o.currency, o.created_at, o.updated_at, o.completed_at,
         o.refunded_amount, o.buyer_id, o.seller_id, coalesce(nullif(pr.full_name, ''), 'Utilizador'),
         case when p_role = 'seller' then o.contact_phone end, o.delivery_text, o.buyer_note,
         (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'quantity', oi.quantity, 'line_total', oi.line_total) order by p.name), '[]')
            from public.order_items oi join public.products p on p.id = oi.product_id where oi.order_id = o.id)
  from public.orders o
  left join public.profiles pr on pr.id = case when p_role = 'seller' then o.buyer_id else o.seller_id end
  where (p_role = 'seller' and o.seller_id = auth.uid()) or (p_role <> 'seller' and o.buyer_id = auth.uid())
  order by o.created_at desc limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.my_orders_v3(p_role text DEFAULT 'buyer'::text)
 RETURNS TABLE(id uuid, ref_no bigint, status text, payment_status text, payment_method text, fulfillment_type text, total numeric, currency text, created_at timestamp with time zone, updated_at timestamp with time zone, completed_at timestamp with time zone, refunded_amount numeric, buyer_id uuid, seller_id uuid, other_name text, contact_phone text, delivery_text text, buyer_note text, items jsonb, fulfillment_status text, protected boolean, escrow_status text, pay_by timestamp with time zone, paid_at timestamp with time zone, delivered_at timestamp with time zone, release_at timestamp with time zone, released_at timestamp with time zone, platform_fee numeric, payment jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select o.id, o.ref_no, o.status, o.payment_status, o.payment_method, o.fulfillment_type, o.total, o.currency, o.created_at, o.updated_at, o.completed_at,
         o.refunded_amount, o.buyer_id, o.seller_id, coalesce(nullif(pr.full_name, ''), 'Utilizador'),
         case when p_role = 'seller' then o.contact_phone end, o.delivery_text, o.buyer_note,
         (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'quantity', oi.quantity, 'line_total', oi.line_total) order by p.name), '[]')
            from public.order_items oi join public.products p on p.id = oi.product_id where oi.order_id = o.id),
         o.fulfillment_status, o.protected, o.escrow_status, o.pay_by, o.paid_at, o.delivered_at, o.release_at, o.released_at,
         case when p_role = 'seller' then o.platform_fee else 0 end,
         case when p_role = 'seller' or not o.protected then null else
           (select jsonb_build_object('id', op.id, 'status', op.status, 'provider', op.provider, 'method', op.method, 'entity', op.entity,
              'reference', op.reference, 'amount', op.amount, 'expires_at', op.expires_at, 'admin_note', op.admin_note, 'created_at', op.created_at)
              from public.order_payments op where op.order_id = o.id order by op.created_at desc limit 1) end
  from public.orders o
  left join public.profiles pr on pr.id = case when p_role = 'seller' then o.buyer_id else o.seller_id end
  where (p_role = 'seller' and o.seller_id = auth.uid()) or (p_role <> 'seller' and o.buyer_id = auth.uid())
  order by o.created_at desc limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.my_orders_v4(p_role text)
 RETURNS TABLE(id uuid, ref_no bigint, status text, payment_status text, payment_method text, fulfillment_type text, total numeric, currency text, created_at timestamp with time zone, updated_at timestamp with time zone, completed_at timestamp with time zone, refunded_amount numeric, buyer_id uuid, seller_id uuid, other_name text, contact_phone text, delivery_text text, buyer_note text, items jsonb, fulfillment_status text, protected boolean, escrow_status text, pay_by timestamp with time zone, paid_at timestamp with time zone, delivered_at timestamp with time zone, release_at timestamp with time zone, released_at timestamp with time zone, platform_fee numeric, payment jsonb, subtotal numeric, delivery_fee numeric, delivery_municipality_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select v.*, o.subtotal, o.delivery_fee, m.name
  from public.my_orders_v3(p_role) v join public.orders o on o.id = v.id left join public.municipalities m on m.id = o.delivery_municipality_id
$function$
;

CREATE OR REPLACE FUNCTION public.my_pending_reviews()
 RETURNS TABLE(kind text, ref_id uuid, title text, other_id uuid, other_name text, other_role text, done_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select * from (
    select 'order'::text, o.id, 'Encomenda de ' || to_char(o.created_at, 'DD/MM/YYYY'),
           case when o.buyer_id = auth.uid() then o.seller_id else o.buyer_id end,
           coalesce(nullif(p.full_name, ''), 'Utilizador'),
           case when o.buyer_id = auth.uid() then 'seller' else 'buyer' end, o.updated_at
    from public.orders o left join public.profiles p on p.id = case when o.buyer_id = auth.uid() then o.seller_id else o.buyer_id end
    where o.status = 'completed' and auth.uid() in (o.buyer_id, o.seller_id) and o.seller_id is not null
      and not exists (select 1 from public.user_reviews r where r.author_id = auth.uid() and r.order_id = o.id)
    union all
    select 'listing', l.id, l.title,
           case when l.owner_id = auth.uid() then l.deal_with else l.owner_id end,
           coalesce(nullif(p.full_name, ''), 'Utilizador'),
           case when (l.owner_id = auth.uid()) = (l.purpose = 'wanted') then 'seller' else 'buyer' end, l.deal_at
    from public.classified_listings l left join public.profiles p on p.id = case when l.owner_id = auth.uid() then l.deal_with else l.owner_id end
    where l.deal_with is not null and auth.uid() in (l.owner_id, l.deal_with)
      and not exists (select 1 from public.user_reviews r where r.author_id = auth.uid() and r.listing_id = l.id)
  ) t where auth.uid() is not null order by 7 desc nulls last limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.my_promo_posts()
 RETURNS TABLE(id uuid, ref_no bigint, subject_kind text, subject_id uuid, subject_name text, kind text, title text, live_starts_at timestamp with time zone, live_ends_at timestamp with time zone, status text, hidden_reason text, featured_until timestamp with time zone, views integer, created_at timestamp with time zone, boost_status text, boost_note text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select x.id, x.ref_no, x.subject_kind, x.subject_id, s.name, x.kind, x.title, x.live_starts_at, x.live_ends_at, x.status, x.hidden_reason, x.featured_until, x.views, x.created_at,
    b.status, b.admin_note
  from public.promo_posts x cross join lateral public.promo_subject(x.subject_kind, x.subject_id) s
  left join lateral (select pb.status, pb.admin_note from public.promo_boosts pb where pb.post_id = x.id order by pb.created_at desc limit 1) b on true
  where x.owner_id = auth.uid()
  order by x.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.my_promo_subjects()
 RETURNS TABLE(kind text, id uuid, name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select 'provider', pp.user_id, pp.display_name from public.provider_profiles pp where pp.user_id = auth.uid() and pp.active
  union all select 'business', b.id, b.name from public.businesses b where b.owner_id = auth.uid() and b.active
  union all select 'store', pr.id, coalesce(nullif(pr.full_name, ''), 'A minha loja') from public.profiles pr
    where pr.id = auth.uid() and exists (select 1 from public.subscriptions s where s.seller_id = pr.id and s.kind = 'store');
$function$
;

CREATE OR REPLACE FUNCTION public.my_referral_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); c text; abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select code into c from public.referral_codes where user_id = me;
  if c is not null then return c; end if;
  loop
    c := '';
    for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
    begin
      insert into public.referral_codes(user_id, code) values (me, c);
      return c;
    exception when unique_violation then
      select code into c from public.referral_codes where user_id = me;
      if c is not null then return c; end if;
    end;
  end loop;
end $function$
;

CREATE OR REPLACE FUNCTION public.my_referrals()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); created timestamptz;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select u.created_at into created from auth.users u where u.id = me;
  return jsonb_build_object(
    'code', public.my_referral_code(),
    'reward_days', (select referral_reward_days from public.platform_settings where id = 1),
    'invited', (select count(*) from public.referrals where referrer_id = me),
    'earned', (select count(*) from public.referrals where referrer_id = me and status in ('earned', 'rewarded')),
    'days_earned', (select coalesce(sum(reward_days), 0) from public.referrals where referrer_id = me and status in ('earned', 'rewarded')),
    'waiting_days', (select coalesce(sum(reward_days), 0) from public.referrals where referrer_id = me and status = 'earned'),
    'can_claim', created >= now() - interval '14 days' and not exists (select 1 from public.referrals where referred_id = me),
    'invited_by', (select coalesce(nullif(split_part(trim(p.full_name), ' ', 1), ''), 'um amigo') from public.referrals r join public.profiles p on p.id = r.referrer_id where r.referred_id = me),
    'friends', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select coalesce(nullif(split_part(trim(p.full_name), ' ', 1), ''), 'Amigo') as name, r.status, r.reward_days, r.created_at
      from public.referrals r left join public.profiles p on p.id = r.referred_id where r.referrer_id = me order by r.created_at desc limit 100) x));
end $function$
;

CREATE OR REPLACE FUNCTION public.my_rental_requests(p_role text DEFAULT 'renter'::text)
 RETURNS TABLE(id uuid, listing_id uuid, listing_title text, status text, starts_at timestamp with time zone, ends_at timestamp with time zone, proposed_price numeric, message text, other_name text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, r.listing_id, l.title, r.status, r.starts_at, r.ends_at, r.proposed_price, r.message,
         coalesce(nullif(p.full_name, ''), 'Utilizador'), r.created_at
  from public.rental_requests r
  join public.classified_listings l on l.id = r.listing_id
  left join public.profiles p on p.id = case when p_role = 'owner' then r.renter_id else l.owner_id end
  where (p_role = 'owner' and l.owner_id = auth.uid()) or (p_role <> 'owner' and r.renter_id = auth.uid())
  order by r.created_at desc limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.my_saved_items()
 RETURNS TABLE(id uuid, kind text, target_id uuid, title text, subtitle text, image text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id,
    case when s.classified_listing_id is not null then 'listing' when s.provider_id is not null then 'provider'
         when s.business_id is not null then 'business' when s.product_id is not null then 'product' else 'other' end,
    coalesce(s.classified_listing_id, s.provider_id, s.business_id, s.product_id, s.service_id, s.auction_id),
    coalesce(l.title, pp.display_name, b.name, p.name, 'Item'),
    coalesce(case when l.id is not null then coalesce(l.price::text || ' Kz', 'Preço sob consulta') end,
             pp.headline, left(b.description, 100), case when p.id is not null then p.price::text || ' Kz' end, ''),
    coalesce(l.media->>0, p.media->>0, pp.avatar_url, b.logo_url),
    s.created_at
  from public.saved_items s
  left join public.classified_listings l on l.id = s.classified_listing_id and (l.status = 'published' or l.owner_id = auth.uid())
  left join public.provider_profiles pp on pp.user_id = s.provider_id and pp.active
  left join public.businesses b on b.id = s.business_id and b.active
  left join public.products p on p.id = s.product_id and p.active
  where s.user_id = auth.uid()
  order by s.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.my_service_requests(p_as text DEFAULT 'client'::text)
 RETURNS TABLE(id uuid, status text, description text, provider_note text, created_at timestamp with time zone, updated_at timestamp with time zone, provider_id uuid, business_id uuid, target_name text, client_id uuid, client_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, s.status, s.description, s.provider_note, s.created_at, s.updated_at, s.provider_id, s.business_id,
         coalesce(pp.display_name, b.name, 'Profissional'), s.client_id, coalesce(nullif(pc.full_name, ''), 'Cliente')
  from public.service_requests s
  left join public.provider_profiles pp on pp.user_id = s.provider_id
  left join public.businesses b on b.id = s.business_id
  left join public.profiles pc on pc.id = s.client_id
  where auth.uid() is not null and case when p_as = 'provider'
    then (s.provider_id = auth.uid() or b.owner_id = auth.uid()) else s.client_id = auth.uid() end
  order by s.updated_at desc limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.my_service_requests_v2(p_as text DEFAULT 'client'::text)
 RETURNS TABLE(id uuid, status text, description text, provider_note text, created_at timestamp with time zone, updated_at timestamp with time zone, provider_id uuid, business_id uuid, target_name text, client_id uuid, client_name text, preferred_date date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, s.status, s.description, s.provider_note, s.created_at, s.updated_at, s.provider_id, s.business_id,
         coalesce(pp.display_name, b.name, 'Profissional'), s.client_id, coalesce(nullif(pc.full_name, ''), 'Cliente'), s.preferred_date
  from public.service_requests s
  left join public.provider_profiles pp on pp.user_id = s.provider_id
  left join public.businesses b on b.id = s.business_id
  left join public.profiles pc on pc.id = s.client_id
  where auth.uid() is not null and case when p_as = 'provider'
    then (s.provider_id = auth.uid() or b.owner_id = auth.uid()) else s.client_id = auth.uid() end
  order by s.updated_at desc limit 200;
$function$
;

CREATE OR REPLACE FUNCTION public.my_stats_daily(p_days integer DEFAULT 30)
 RETURNS TABLE(day date, views bigint, contacts bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); d integer := least(greatest(coalesce(p_days, 30), 1), 365); since date;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  since := public.angola_today() - (d - 1);
  return query
  with days as (select g::date dd from generate_series(since, public.angola_today(), interval '1 day') g),
  ev as (select s.day dd, sum(s.views) v, sum(s.whatsapp + s.calls) c from public.item_stats_daily s where s.owner_id = me and s.day >= since group by s.day),
  mine as (
    select l.id from public.classified_listings l where l.owner_id = me
    union all select p.id from public.products p where p.seller_id = me
    union all select b.id from public.businesses b where b.owner_id = me
    union all select me),
  msg as (select (cv.created_at at time zone 'Africa/Luanda')::date dd, count(*) c from public.conversations cv
    where cv.created_by <> me and cv.created_at >= (since::timestamp at time zone 'Africa/Luanda')
      and coalesce(cv.classified_listing_id, cv.product_id, cv.business_id, cv.provider_id) in (select id from mine)
    group by 1)
  select days.dd, coalesce(ev.v, 0)::bigint, (coalesce(ev.c, 0) + coalesce(msg.c, 0))::bigint
  from days left join ev on ev.dd = days.dd left join msg on msg.dd = days.dd order by days.dd;
end $function$
;

CREATE OR REPLACE FUNCTION public.my_subscriptions()
 RETURNS TABLE(id uuid, kind text, subject_id uuid, name text, trial_ends_at timestamp with time zone, paid_until timestamp with time zone, active_until timestamp with time zone, state text, monthly_price numeric, pending_payment_id uuid, pending_amount numeric, last_rejected_note text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, s.kind, coalesce(s.provider_id, s.business_id, s.seller_id), public.plan_subject_name(s),
    s.trial_ends_at, s.paid_until, public.subscription_active_until(s),
    case when public.subscription_active_until(s) <= now() then 'expired'
         when s.paid_until is not null and s.paid_until > now() then case when s.paid_until < now() + interval '7 days' then 'expiring' else 'paid' end
         when s.trial_ends_at < now() + interval '7 days' then 'trial_ending' else 'trial' end,
    public.plan_monthly_price(s.kind), p.id, p.amount,
    (select r.admin_note from public.subscription_payments r where r.subscription_id = s.id and r.status = 'rejected' order by r.decided_at desc limit 1)
  from public.subscriptions s
  left join public.subscription_payments p on p.subscription_id = s.id and p.status = 'pending'
  where s.owner_id = auth.uid() and public.plan_subject_exists(s)
  order by case s.kind when 'provider' then 0 when 'store' then 1 else 2 end, s.created_at;
$function$
;

CREATE OR REPLACE FUNCTION public.my_venue_orders()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select o.id, o.ref_no, o.kind, o.status, o.method, o.guests, o.check_in, o.check_out, o.slot_at, o.buyer_note, o.subtotal, o.client_fee_pct, o.client_fee, o.total, o.code,
      case when o.status in ('reserved', 'submitted', 'paid') then o.qr_token end qr_token,
      o.hold_until, o.pay_by, o.pay_method, o.reference, o.proof_path, o.note, o.created_at, o.completed_at,
      v.id venue_id, v.kind venue_kind, b.name venue_name, b.address_text, b.directions, b.geo_lat, b.geo_lng, b.phone,
      (select coalesce(jsonb_agg(jsonb_build_object('name', l.name, 'unit', l.unit, 'qty', l.qty, 'unit_price', l.unit_price, 'line_total', l.line_total)), '[]')
        from public.venue_order_lines l where l.order_id = o.id) lines,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.holder end pay_holder,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.iban end pay_iban,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.express end pay_express,
      case when o.method = 'prepaid' and o.status in ('awaiting_payment', 'rejected') then y.note end pay_note
    from public.venue_orders o join public.venues v on v.id = o.venue_id join public.businesses b on b.id = v.business_id
      left join public.venue_pay y on y.venue_id = v.id
    where o.buyer_id = auth.uid() order by o.created_at desc limit 100) x
$function$
;
CREATE OR REPLACE FUNCTION public.my_venues()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(x order by x.created_at), '[]') from (
    select v.*, b.name business_name, (select to_jsonb(y) - 'venue_id' - 'updated_at' from public.venue_pay y where y.venue_id = v.id) pay
    from public.venues v join public.businesses b on b.id = v.business_id where v.owner_id = auth.uid()) x
$function$
;

CREATE OR REPLACE FUNCTION public.my_verifications()
 RETURNS TABLE(id uuid, kind text, business_id uuid, business_name text, status text, admin_note text, created_at timestamp with time zone, decided_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select v.id, v.kind, v.business_id, b.name, v.status, v.admin_note, v.created_at, v.decided_at
  from public.verification_requests v left join public.businesses b on b.id = v.business_id
  where v.user_id = auth.uid() order by v.created_at desc limit 50;
$function$
;

CREATE OR REPLACE FUNCTION public.my_verifications_v2()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
    select v.id, v.kind, v.business_id, b.name business_name, v.status, v.admin_note, v.created_at, v.decided_at,
      case when v.id_number is not null then '•••••' || right(v.id_number, 5) end id_number_hint, v.selfie_path is not null has_selfie
    from public.verification_requests v left join public.businesses b on b.id = v.business_id
    where v.user_id = auth.uid() order by v.created_at desc limit 50) x
$function$
;

CREATE OR REPLACE FUNCTION public.my_wallet()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare st public.platform_settings; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into st from public.platform_settings where id = 1;
  return jsonb_build_object(
    'pending', (select coalesce(sum(amount), 0) from public.wallet_entries where user_id = uid and bucket = 'pending'),
    'available', (select coalesce(sum(amount), 0) from public.wallet_entries where user_id = uid and bucket = 'available'),
    'in_payout', (select coalesce(sum(amount), 0) from public.payout_requests where user_id = uid and status in ('requested', 'processing')),
    'paid_out', (select coalesce(sum(amount), 0) from public.payout_requests where user_id = uid and status = 'paid'),
    'account', (select jsonb_build_object('method', a.method, 'holder_name', a.holder_name,
        'destination', case when a.method = 'iban' then public.format_angola_iban(a.iban) else a.express_number end, 'updated_at', a.updated_at)
      from public.payout_accounts a where a.user_id = uid),
    'entries', (select coalesce(jsonb_agg(x order by x.id desc), '[]') from (
        select e.id, e.bucket, e.kind, e.amount, e.note, e.created_at, e.order_id from public.wallet_entries e where e.user_id = uid order by e.id desc limit 100) x),
    'payouts', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
        select p.id, p.ref_no, p.amount, p.method, p.destination, p.status, p.admin_note, p.bank_reference, p.created_at, p.paid_at
          from public.payout_requests p where p.user_id = uid order by p.created_at desc limit 50) x),
    'payout_min_kz', st.payout_min_kz, 'payout_weekdays', to_jsonb(st.payout_weekdays), 'fee_pct', st.protected_fee_pct,
    'auto_release_days', st.auto_release_days);
end $function$
;

CREATE OR REPLACE FUNCTION public.new_fuel_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := 'CB-';
    for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from public.fuel_orders where code = c);
  end loop;
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.new_ticket_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := 'HO-';
    for i in 1..8 loop c := c || substr(abc, 1 + floor(random() * 32)::int, 1); if i = 4 then c := c || '-'; end if; end loop;
    exit when not exists (select 1 from public.event_tickets where code = c);
  end loop;
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.new_venue_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := 'RV-';
    for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from public.venue_orders where code = c);
  end loop;
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.normalize_bi(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'))
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_whatsapp(p text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if d ~ '^00' then d := substr(d, 3); end if;
  if d ~ '^9[0-9]{8}$' then return '244' || d; end if;
  if d ~ '^2449[0-9]{8}$' then return d; end if;
  if d ~ '^244' then return null; end if;
  if d ~ '^[1-9][0-9]{9,14}$' then return d; end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_classified_saved_searches()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'published' and not (tg_op = 'UPDATE' and old.status = 'published') then perform public.enqueue_job('saved_search', new.id); end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_followers(p_followers uuid[], p_source text, p_title text, p_body text, p_data jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  insert into public.notifications(user_id, type, title, body, data)
  select f, 'system', left(p_title, 120), left(p_body, 300), p_data || jsonb_build_object('for', 'follow', 'source', p_source)
  from (select distinct unnest(p_followers) f) x
  where f is not null and not exists (select 1 from public.notifications n where n.user_id = x.f and n.data->>'for' = 'follow'
    and n.data->>'source' = p_source and n.created_at > now() - interval '1 hour')
  limit 2000;
  get diagnostics n = row_count;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p record; c record; preview text;
begin
  select * into c from public.conversations where id = new.conversation_id;
  preview := coalesce(nullif(trim(new.body), ''), case new.attachment_kind when 'image' then '📷 Fotografia' when 'video' then '🎬 Vídeo' when 'audio' then '🎤 Mensagem de voz' else '' end);
  for p in select cp.user_id from public.conversation_participants cp where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id loop
    insert into public.notifications(user_id, type, title, body, data)
    values (p.user_id, 'message', 'Nova mensagem', left(preview, 180),
      jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id, 'listing_id', c.classified_listing_id))
    on conflict do nothing;
  end loop;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_staff(p_title text, p_body text, p_data jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.notifications(user_id, type, title, body, data)
  select distinct r.user_id, 'system', p_title, p_body, p_data || jsonb_build_object('for', 'admin')
  from public.user_roles r where r.role in ('moderator', 'admin') limit 20;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_wanted_matches()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.purpose = 'wanted' and new.status = 'published' and not (tg_op = 'UPDATE' and old.status = 'published') then perform public.enqueue_job('wanted', new.id); end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.open_listing_claim(p_listing_id uuid, p_request text, p_reason text, p_description text, p_amount numeric DEFAULT NULL::numeric)
 RETURNS listing_claims
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); l public.classified_listings; c public.listing_claims;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into l from public.classified_listings where id = p_listing_id;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if public.listing_claim_deadline(p_listing_id) is null then raise exception 'CLAIM_NOT_ALLOWED'; end if;
  if p_request not in ('exchange', 'return_refund', 'refund') or p_reason not in ('omitted_defect', 'not_as_described', 'wrong_item', 'missing_parts', 'other') then raise exception 'INVALID_CLAIM'; end if;
  if char_length(trim(coalesce(p_description, ''))) < 10 then raise exception 'CLAIM_DESCRIPTION_REQUIRED'; end if;
  if exists (select 1 from public.listing_claims where listing_id = l.id and buyer_id = me and status <> 'resolved') then raise exception 'CLAIM_ALREADY_OPEN'; end if;
  insert into public.listing_claims(listing_id, listing_title, buyer_id, seller_id, request, reason, description, amount)
  values (l.id, left(l.title, 200), me, l.owner_id, p_request, p_reason, left(trim(p_description), 1000), case when p_request = 'exchange' then null else p_amount end)
  returning * into c;
  insert into public.notifications(user_id, type, title, body, data)
  values (l.owner_id, 'system', 'Reclamação: o artigo não corresponde ao anúncio',
    '«' || left(l.title, 120) || '» (R-' || c.ref_no || '). Responda em 3 dias; se não responder, a administração decide.', jsonb_build_object('for', 'claim'));
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.open_order_dispute(p_order_id uuid, p_request text, p_reason text, p_description text, p_amount numeric DEFAULT NULL::numeric, p_photos text[] DEFAULT '{}'::text[])
 RETURNS order_disputes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; d public.order_disputes; ph text[]; amt numeric; txt text := nullif(left(trim(coalesce(p_description, '')), 1000), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.buyer_id <> auth.uid() then raise exception 'NOT_ORDER_PARTY'; end if;
  if o.status in ('pending', 'cancelled') or (o.status <> 'completed' and o.payment_status <> 'paid') then raise exception 'DISPUTE_NOT_ALLOWED'; end if;
  if o.status = 'completed' and coalesce(o.completed_at, o.updated_at) < now() - interval '14 days' then raise exception 'DISPUTE_WINDOW_CLOSED'; end if;
  if exists (select 1 from public.order_disputes where order_id = o.id and status <> 'resolved') then raise exception 'DISPUTE_OPEN'; end if;
  if exists (select 1 from public.order_disputes where order_id = o.id and outcome <> 'withdrawn') then raise exception 'DISPUTE_ALREADY_DECIDED'; end if;
  if (select count(*) from public.order_disputes where order_id = o.id) >= 3 then raise exception 'TOO_MANY_REQUESTS'; end if;
  if p_request not in ('refund', 'return_refund', 'replacement') then raise exception 'INVALID_REQUEST'; end if;
  if p_reason not in ('not_received', 'damaged', 'not_as_described', 'wrong_item', 'missing_items', 'other') then raise exception 'INVALID_REASON'; end if;
  if p_reason = 'not_received' and p_request <> 'refund' then raise exception 'INVALID_REQUEST'; end if;
  if txt is null or char_length(txt) < 5 then raise exception 'DESCRIPTION_REQUIRED'; end if;
  if p_request = 'replacement' then amt := null;
  else
    amt := coalesce(p_amount, o.total - o.refunded_amount);
    if amt <= 0 or amt > o.total - o.refunded_amount then raise exception 'INVALID_AMOUNT'; end if;
  end if;
  ph := public.dispute_clean_photos(o.id, p_photos);
  insert into public.order_disputes(order_id, buyer_id, seller_id, request, reason, description, amount)
  values (o.id, o.buyer_id, o.seller_id, p_request, p_reason, txt, amt) returning * into d;
  perform public.dispute_log(d, 'buyer', 'opened', txt, ph);
  return d;
end $function$
;

CREATE OR REPLACE FUNCTION public.order_delivery_point(p_order_id uuid)
 RETURNS TABLE(lat numeric, lng numeric, delivery_text text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select o.delivery_lat, o.delivery_lng, o.delivery_text from public.orders o
  where o.id = p_order_id and auth.uid() is not null and (o.buyer_id = auth.uid() or o.seller_id = auth.uid()
    or exists (select 1 from public.delivery_requests d where d.order_id = o.id and d.assigned_to = auth.uid() and d.status <> 'cancelled'))
$function$
;

CREATE OR REPLACE FUNCTION public.order_payment_quote(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; pay public.order_payments;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id;
  if not found or o.buyer_id <> auth.uid() then raise exception 'ORDER_NOT_FOUND'; end if;
  if not o.protected or o.escrow_status <> 'awaiting_payment' or o.status = 'cancelled' then raise exception 'PAYMENT_NOT_EXPECTED'; end if;
  select * into pay from public.order_payments where order_id = o.id and status = 'pending' and provider = 'proxypay' and (expires_at is null or expires_at > now());
  return jsonb_build_object('order_id', o.id, 'buyer_id', o.buyer_id, 'amount', o.total, 'ref', public.order_ref(o), 'pay_by', o.pay_by,
    'existing', case when pay.id is null then null else jsonb_build_object('entity', pay.entity, 'reference', pay.reference, 'amount', pay.amount, 'expires_at', pay.expires_at) end);
end $function$
;

CREATE OR REPLACE FUNCTION public.order_ref(o orders)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$ select 'E-' || coalesce(o.ref_no::text, left(o.id::text, 8)) $function$
;

CREATE OR REPLACE FUNCTION public.orders_escrow_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare days integer; diff numeric;
begin
  if not new.protected then return new; end if;
  if new.escrow_status = 'awaiting_payment' then
    if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then raise exception 'PROTECTED_PAID_BY_PLATFORM'; end if;
    if new.status in ('processing', 'ready', 'completed') or new.fulfillment_status in ('assigned', 'in_transit', 'delivered') then
      raise exception 'AWAITING_PAYMENT'; end if;
  end if;
  -- cancelada antes de pagar: a referência deixa de valer
  if new.status = 'cancelled' and old.status <> 'cancelled' and new.escrow_status = 'awaiting_payment' then
    update public.order_payments set status = 'expired' where order_id = new.id and status = 'pending' and provider = 'proxypay';
  end if;
  -- entregue: começa a contagem para libertar o dinheiro
  if new.fulfillment_status = 'delivered' and old.fulfillment_status is distinct from 'delivered' and new.delivered_at is null then
    new.delivered_at := now();
    if new.escrow_status = 'held' and new.release_at is null then
      select auto_release_days into days from public.platform_settings where id = 1;
      days := coalesce(days, 3);
      new.release_at := now() + make_interval(days => days);
      if new.received_at is null then
        insert into public.notifications(user_id, type, title, body, data)
        values (new.buyer_id, 'order', 'Recebeu a encomenda? 📦',
          'A encomenda ' || public.order_ref(new) || ' foi marcada como entregue. Carregue em «Confirmar receção» ou peça reembolso. Se não disser nada em '
          || days || ' dias, o pagamento é entregue ao vendedor.', jsonb_build_object('order_id', new.id, 'for', 'purchase'));
      end if;
    end if;
  end if;
  -- reembolso de dinheiro ainda retido: sai do saldo pendente do vendedor
  if new.refunded_amount > old.refunded_amount and old.escrow_status = 'held' then
    diff := new.refunded_amount - old.refunded_amount;
    perform public.wallet_add(new.seller_id, new.id, null, 'pending', 'refund', -diff, 'Reembolso ao cliente · ' || public.order_ref(new));
    if new.refunded_amount >= new.total then new.escrow_status := 'refunded'; end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.organizer_event_panel(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e public.events; st public.platform_settings;
begin
  select * into e from public.events where id = p_event_id;
  if not found or (e.organizer_id <> auth.uid() and not public.has_admin_role()) then raise exception 'NOT_EVENT_ORGANIZER'; end if;
  select * into st from public.platform_settings where id = 1;
  return jsonb_build_object(
    'sold', (select coalesce(sum(quantity), 0) from public.event_orders where event_id = e.id and status = 'confirmed'),
    'revenue', (select coalesce(sum(total), 0) from public.event_orders where event_id = e.id and status = 'confirmed'),
    'checked_in', (select count(*) from public.event_tickets where event_id = e.id and status = 'used'),
    'fee_pct', st.event_ticket_fee_pct,
    'fee_total', (select coalesce(sum(fee_amount), 0) from public.event_orders where event_id = e.id and status = 'confirmed'),
    'fee_due', public.event_fee_due(e.id),
    'fee_pending', exists (select 1 from public.event_platform_payments where event_id = e.id and kind = 'fee' and status = 'pending'),
    'boost_pending', exists (select 1 from public.event_platform_payments where event_id = e.id and kind = 'boost' and status = 'pending'),
    'boost_price_kz', st.event_boost_price_kz, 'boost_days', st.event_boost_days,
    'orders', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select o.id, o.ref_no, o.status, o.quantity, o.total, o.buyer_name, o.buyer_phone, o.method, o.reference, o.pay_by, o.note, o.created_at, t.name type_name
      from public.event_orders o join public.event_ticket_types t on t.id = o.ticket_type_id where o.event_id = e.id order by o.created_at desc limit 500) x),
    'payments', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select p.id, p.ref_no, p.kind, p.amount, p.days, p.status, p.admin_note, p.created_at from public.event_platform_payments p where p.event_id = e.id order by p.created_at desc limit 50) x));
end $function$
;

CREATE OR REPLACE FUNCTION public.photo_search_limit()
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$ select 20 $function$
;

CREATE OR REPLACE FUNCTION public.photo_searches_left()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.photo_search_limit() - coalesce((select count from public.photo_search_usage
    where user_id = auth.uid() and day = (now() at time zone 'Africa/Luanda')::date), 0);
$function$
;

CREATE OR REPLACE FUNCTION public.place_auction_bid(p_auction_id uuid, p_amount numeric)
 RETURNS auction_bids
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions; b public.auction_bids; mine public.auction_max_bids; before record; after record; min_bid numeric; has_bids boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if a.status <> 'live' or now() < a.starts_at or now() >= a.ends_at then raise exception 'AUCTION_NOT_LIVE'; end if;
  if a.seller_id = auth.uid() then raise exception 'SELLER_CANNOT_BID'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'BID_TOO_LOW'; end if;
  select * into mine from public.auction_max_bids where auction_id = a.id and bidder_id = auth.uid();
  if found and mine.retracted_by is not null and mine.retracted_by <> auth.uid() then raise exception 'BIDDER_BLOCKED'; end if;
  select * into before from public.auction_standing(a.id);
  has_bids := before.leader is not null;
  if before.leader = auth.uid() then
    if p_amount <= before.leader_max then raise exception 'MAX_MUST_INCREASE'; end if;
  else
    min_bid := case when not has_bids then a.starting_price else a.current_price + public.auction_increment(a.current_price, a.min_increment) end;
    if p_amount < min_bid then raise exception 'BID_TOO_LOW'; end if;
  end if;
  insert into public.auction_max_bids(auction_id, bidder_id, max_amount, max_set_at)
  values (a.id, auth.uid(), p_amount, now())
  on conflict (auction_id, bidder_id) do update set max_amount = excluded.max_amount, max_set_at = now(), retracted_at = null, retracted_by = null, retract_reason = null;
  select * into after from public.auction_standing(a.id);
  update public.auctions set current_price = after.price, updated_at = now() where id = a.id;

  if after.leader = auth.uid() then
    if before.leader is distinct from auth.uid() or after.price <> a.current_price then
      insert into public.auction_bids(auction_id, bidder_id, amount) values (a.id, auth.uid(), after.price) returning * into b;
    else
      b := row(null, a.id, auth.uid(), after.price, now(), null, null, null, false)::public.auction_bids; -- só subiu o máximo
    end if;
  else
    -- ultrapassado de imediato pela licitação automática de quem já ganhava
    insert into public.auction_bids(auction_id, bidder_id, amount) values (a.id, auth.uid(), p_amount) returning * into b;
    insert into public.auction_bids(auction_id, bidder_id, amount, is_auto, created_at) values (a.id, after.leader, after.price, true, now() + interval '1 millisecond');
  end if;

  if before.leader is not null and before.leader is distinct from after.leader then
    insert into public.notifications(user_id, type, title, body, data)
    values (before.leader, 'bid', 'A sua licitação foi ultrapassada', 'O preço de «' || a.title || '» está agora em ' || after.price || ' Kz. Pode subir o seu máximo.',
            jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  end if;
  if after.price <> a.current_price or before.leader is distinct from after.leader then
    insert into public.notifications(user_id, type, title, body, data)
    values (a.seller_id, 'bid', 'Nova licitação', 'Preço atual de «' || a.title || '»: ' || after.price || ' Kz.', jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  end if;
  return b;
end $function$
;

CREATE OR REPLACE FUNCTION public.place_orders(p_fulfillment text, p_payment_method text, p_contact_phone text, p_delivery_text text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cid uuid; s record; oid uuid; ids uuid[] := '{}'; sub numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_fulfillment not in ('delivery','pickup') then raise exception 'INVALID_FULFILLMENT'; end if;
  if p_payment_method not in ('cash_on_delivery','bank_transfer','mobile_money','reference') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if nullif(trim(p_contact_phone), '') is null then raise exception 'PHONE_REQUIRED'; end if;
  if p_fulfillment = 'delivery' and nullif(trim(p_delivery_text), '') is null then raise exception 'DELIVERY_ADDRESS_REQUIRED'; end if;
  select id into cid from public.carts where user_id = auth.uid();
  if cid is null or not exists (select 1 from public.cart_items where cart_id = cid and ordered_at is null) then raise exception 'CART_EMPTY'; end if;
  perform 1 from public.products p join public.cart_items ci on ci.product_id = p.id where ci.cart_id = cid and ci.ordered_at is null for update of p;
  if exists (select 1 from public.cart_items ci join public.products p on p.id = ci.product_id
             where ci.cart_id = cid and ci.ordered_at is null and (not p.active or p.stock < ci.quantity)) then raise exception 'STOCK_CHANGED'; end if;
  for s in select distinct p.seller_id from public.cart_items ci join public.products p on p.id = ci.product_id where ci.cart_id = cid and ci.ordered_at is null loop
    select sum(p.price * ci.quantity) into sub from public.cart_items ci join public.products p on p.id = ci.product_id
     where ci.cart_id = cid and ci.ordered_at is null and p.seller_id = s.seller_id;
    insert into public.orders(buyer_id, seller_id, status, currency, subtotal, delivery_fee, total, payment_status, payment_method,
      fulfillment_type, fulfillment_status, contact_phone, delivery_text, buyer_note)
    values (auth.uid(), s.seller_id, 'pending', 'AOA', sub, 0, sub, 'unpaid', p_payment_method,
      p_fulfillment, 'pending', trim(p_contact_phone), nullif(trim(p_delivery_text), ''), nullif(trim(p_note), ''))
    returning id into oid;
    insert into public.order_items(order_id, product_id, seller_id, quantity, unit_price, line_total)
    select oid, p.id, p.seller_id, ci.quantity, p.price, p.price * ci.quantity
    from public.cart_items ci join public.products p on p.id = ci.product_id where ci.cart_id = cid and ci.ordered_at is null and p.seller_id = s.seller_id;
    update public.products p set stock = p.stock - ci.quantity, updated_at = now()
    from public.cart_items ci where ci.cart_id = cid and ci.ordered_at is null and ci.product_id = p.id and p.seller_id = s.seller_id;
    insert into public.notifications(user_id, type, title, body, data)
    values (s.seller_id, 'order', 'Nova encomenda', 'Recebeu uma encomenda de ' || sub || ' Kz.', jsonb_build_object('order_id', oid));
    ids := ids || oid;
  end loop;
  update public.cart_items set ordered_at = now() where cart_id = cid and ordered_at is null;
  return ids;
end $function$
;

CREATE OR REPLACE FUNCTION public.place_orders_v2(p_fulfillment text, p_payment_method text, p_contact_phone text, p_delivery_text text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_protected boolean DEFAULT false)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ids uuid[]; st public.platform_settings;
begin
  if not coalesce(p_protected, false) then
    return public.place_orders(p_fulfillment, p_payment_method, p_contact_phone, p_delivery_text, p_note);
  end if;
  select * into st from public.platform_settings where id = 1;
  if not coalesce(st.protected_enabled, false) then raise exception 'PROTECTED_DISABLED'; end if;
  ids := public.place_orders(p_fulfillment, 'reference', p_contact_phone, p_delivery_text, p_note);
  update public.orders set protected = true, escrow_status = 'awaiting_payment',
    pay_by = now() + make_interval(hours => st.payment_window_hours), updated_at = now()
   where id = any(ids);
  update public.notifications set body = body || ' 🛡️ Pagamento protegido: espere pelo aviso «Pagamento recebido» antes de enviar.',
    data = data || jsonb_build_object('for', 'sale')
   where type = 'order' and title = 'Nova encomenda' and data->>'order_id' = any(ids::text[]);
  return ids;
end $function$
;

CREATE OR REPLACE FUNCTION public.place_orders_v3(p_choices jsonb, p_payment_method text, p_contact_phone text, p_municipality_id uuid DEFAULT NULL::uuid, p_delivery_text text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_protected boolean DEFAULT false)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cid uuid; s record; oid uuid; ids uuid[] := '{}'; sub numeric; choice text; q jsonb; fee numeric; st public.platform_settings;
  pay text := case when coalesce(p_protected, false) then 'reference' else p_payment_method end;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if pay not in ('cash_on_delivery','bank_transfer','mobile_money','reference') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if nullif(trim(p_contact_phone), '') is null then raise exception 'PHONE_REQUIRED'; end if;
  if p_choices is null or jsonb_typeof(p_choices) <> 'object' then raise exception 'INVALID_FULFILLMENT'; end if;
  if coalesce(p_protected, false) then
    select * into st from public.platform_settings where id = 1;
    if not coalesce(st.protected_enabled, false) then raise exception 'PROTECTED_DISABLED'; end if;
  end if;
  select id into cid from public.carts where user_id = auth.uid();
  if cid is null or not exists (select 1 from public.cart_items where cart_id = cid and ordered_at is null) then raise exception 'CART_EMPTY'; end if;
  perform 1 from public.products p join public.cart_items ci on ci.product_id = p.id where ci.cart_id = cid and ci.ordered_at is null for update of p;
  if exists (select 1 from public.cart_items ci join public.products p on p.id = ci.product_id
             where ci.cart_id = cid and ci.ordered_at is null and (not p.active or p.stock < ci.quantity)) then raise exception 'STOCK_CHANGED'; end if;
  for s in select distinct p.seller_id from public.cart_items ci join public.products p on p.id = ci.product_id where ci.cart_id = cid and ci.ordered_at is null loop
    choice := p_choices ->> s.seller_id::text;
    if choice is null or choice not in ('pickup', 'delivery') then raise exception 'FULFILLMENT_REQUIRED'; end if;
    select sum(p.price * ci.quantity) into sub from public.cart_items ci join public.products p on p.id = ci.product_id
     where ci.cart_id = cid and ci.ordered_at is null and p.seller_id = s.seller_id;
    q := public.seller_delivery_quote(s.seller_id, p_municipality_id, sub);
    if choice = 'pickup' then
      if not (q->>'pickup')::boolean then raise exception 'SELLER_NO_PICKUP'; end if;
      fee := 0;
    else
      if nullif(trim(coalesce(p_delivery_text, '')), '') is null then raise exception 'DELIVERY_ADDRESS_REQUIRED'; end if;
      if not (q->>'delivery')::boolean then
        raise exception '%', case q->>'reason' when 'no_delivery' then 'SELLER_NO_DELIVERY' when 'min_order' then 'DELIVERY_BELOW_MINIMUM'
          when 'needs_area' then 'DELIVERY_AREA_REQUIRED' else 'DELIVERY_AREA_NOT_COVERED' end;
      end if;
      fee := coalesce((q->>'fee')::numeric, 0);
    end if;
    insert into public.orders(buyer_id, seller_id, status, currency, subtotal, delivery_fee, total, payment_status, payment_method,
      fulfillment_type, fulfillment_status, contact_phone, delivery_text, delivery_municipality_id, buyer_note)
    values (auth.uid(), s.seller_id, 'pending', 'AOA', sub, fee, sub + fee, 'unpaid', pay,
      choice, 'pending', trim(p_contact_phone), case when choice = 'delivery' then nullif(trim(p_delivery_text), '') end,
      case when choice = 'delivery' then p_municipality_id end, nullif(trim(p_note), ''))
    returning id into oid;
    insert into public.order_items(order_id, product_id, seller_id, quantity, unit_price, line_total)
    select oid, p.id, p.seller_id, ci.quantity, p.price, p.price * ci.quantity
    from public.cart_items ci join public.products p on p.id = ci.product_id where ci.cart_id = cid and ci.ordered_at is null and p.seller_id = s.seller_id;
    update public.products p set stock = p.stock - ci.quantity, updated_at = now()
    from public.cart_items ci where ci.cart_id = cid and ci.ordered_at is null and ci.product_id = p.id and p.seller_id = s.seller_id;
    insert into public.notifications(user_id, type, title, body, data)
    values (s.seller_id, 'order', 'Nova encomenda', 'Recebeu uma encomenda de ' || (sub + fee) || ' Kz'
      || case when choice = 'pickup' then ' (levantamento no local).' when fee > 0 then ' (inclui entrega: ' || fee || ' Kz).' else ' (entrega grátis).' end
      || case when coalesce(p_protected, false) then ' 🛡️ Pagamento protegido: espere pelo aviso «Pagamento recebido» antes de enviar.' else '' end,
      jsonb_build_object('order_id', oid) || case when coalesce(p_protected, false) then jsonb_build_object('for', 'sale') else '{}'::jsonb end);
    ids := ids || oid;
  end loop;
  update public.cart_items set ordered_at = now() where cart_id = cid and ordered_at is null;
  if coalesce(p_protected, false) then
    update public.orders set protected = true, escrow_status = 'awaiting_payment',
      pay_by = now() + make_interval(hours => st.payment_window_hours), updated_at = now()
     where id = any(ids);
  end if;
  return ids;
end $function$
;

CREATE OR REPLACE FUNCTION public.plan_monthly_price(p_kind text)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case p_kind when 'provider' then provider_monthly_kz when 'business' then business_monthly_kz else store_monthly_kz end from public.platform_settings where id = 1;
$function$
;

CREATE OR REPLACE FUNCTION public.plan_subject_exists(s subscriptions)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case s.kind when 'provider' then exists (select 1 from public.provider_profiles pp where pp.user_id = s.provider_id)
                     when 'business' then exists (select 1 from public.businesses b where b.id = s.business_id)
                     else exists (select 1 from public.products p where p.seller_id = s.seller_id and p.business_id is null) end;
$function$
;

CREATE OR REPLACE FUNCTION public.plan_subject_name(s subscriptions)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(case s.kind when 'provider' then (select pp.display_name from public.provider_profiles pp where pp.user_id = s.provider_id)
                              when 'business' then (select b.name from public.businesses b where b.id = s.business_id)
                              else 'A minha Loja' end, 'Perfil apagado');
$function$
;

CREATE OR REPLACE FUNCTION public.portfolio_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' and (select count(*) from public.portfolio_items
      where provider_id is not distinct from new.provider_id and business_id is not distinct from new.business_id) >= 40 then
    raise exception 'PORTFOLIO_FULL';
  end if;
  if tg_op = 'UPDATE' then
    new.owner_id := old.owner_id; new.provider_id := old.provider_id; new.business_id := old.business_id; new.created_at := old.created_at;
  end if;
  new.title := trim(new.title); new.description := nullif(trim(coalesce(new.description, '')), ''); new.updated_at := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.portfolio_photos_ok(p_photos text[], p_owner uuid)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(bool_and(p ~ ('^https://[a-z0-9.-]+/storage/v1/object/public/classified-media/' || p_owner::text || '/[A-Za-z0-9._-]{1,120}$')), false)
  from unnest(p_photos) p;
$function$
;

CREATE OR REPLACE FUNCTION public.portfolio_target_owned(p_provider uuid, p_business uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when p_provider is not null then p_provider = auth.uid() and exists (select 1 from public.provider_profiles where user_id = p_provider)
              else exists (select 1 from public.businesses where id = p_business and owner_id = auth.uid()) end;
$function$
;

CREATE OR REPLACE FUNCTION public.portfolio_target_public(p_provider uuid, p_business uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when p_provider is not null then exists (select 1 from public.provider_profiles where user_id = p_provider and active) and public.subject_paid_up(p_provider, null)
              else exists (select 1 from public.businesses where id = p_business and active) and public.subject_paid_up(null, p_business) end;
$function$
;

CREATE OR REPLACE FUNCTION public.process_job_queue(p_limit integer DEFAULT 300)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare j public.job_queue; n integer := 0;
begin
  for j in select * from public.job_queue where done_at is null and run_after <= now() order by id limit greatest(1, least(p_limit, 2000)) for update skip locked loop
    begin
      case j.kind
        when 'saved_search' then perform public.job_saved_search(j.ref_id);
        when 'wanted' then perform public.job_wanted(j.ref_id);
        when 'follow_listing' then perform public.job_follow_listing(j.ref_id);
        when 'follow_product' then perform public.job_follow_product(j.ref_id);
        when 'follow_portfolio' then perform public.job_follow_portfolio(j.ref_id);
        when 'fuel_alert' then perform public.job_fuel_alert(j.ref_id);
      end case;
      update public.job_queue set done_at = now(), attempts = attempts + 1 where id = j.id;
      n := n + 1;
    exception when others then
      update public.job_queue set attempts = attempts + 1, last_error = left(sqlerrm, 500),
        run_after = now() + make_interval(mins => power(2, least(attempts, 6))::int),
        done_at = case when attempts + 1 >= 5 then now() end
      where id = j.id;
    end;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.product_catalog(p_query text DEFAULT ''::text, p_category_id uuid DEFAULT NULL::uuid, p_municipality_id uuid DEFAULT NULL::uuid, p_seller_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 40)
 RETURNS TABLE(id uuid, seller_id uuid, seller_name text, business_id uuid, business_name text, name text, description text, category_id uuid, category_name text, price numeric, currency text, stock integer, media jsonb, municipality_id uuid, municipality_name text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.seller_id, coalesce(nullif(pr.full_name, ''), 'Vendedor'), p.business_id, b.name, p.name, p.description,
         p.category_id, c.name, p.price, p.currency, p.stock, p.media, p.municipality_id, m.name, p.created_at
  from public.products p
  left join public.profiles pr on pr.id = p.seller_id
  left join public.businesses b on b.id = p.business_id
  left join public.categories c on c.id = p.category_id
  left join public.municipalities m on m.id = p.municipality_id
  where p.active and coalesce(pr.status, 'active') = 'active' and public.product_paid_up(p.seller_id, p.business_id)
    and (p_category_id is null or p.category_id = p_category_id)
    and (p_municipality_id is null or p.municipality_id = p_municipality_id)
    and (p_seller_id is null or p.seller_id = p_seller_id)
    and (coalesce(p_query, '') = '' or lower(p.name || ' ' || coalesce(p.description, '')) like '%' || lower(p_query) || '%')
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$function$
;
CREATE OR REPLACE FUNCTION public.product_paid_up(p_seller uuid, p_business uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when p_business is not null then public.subject_paid_up(null, p_business) else public.store_paid_up(p_seller) end;
$function$
;

CREATE OR REPLACE FUNCTION public.promo_feed(p_kind text DEFAULT NULL::text, p_subject_kind text DEFAULT NULL::text, p_subject_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 40)
 RETURNS TABLE(id uuid, ref_no bigint, subject_kind text, subject_id uuid, subject_name text, subject_picture text, kind text, title text, description text, video_url text, external_url text, cover_url text, live_starts_at timestamp with time zone, live_ends_at timestamp with time zone, live_state text, featured boolean, views integer, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select x.id, x.ref_no, x.subject_kind, x.subject_id, s.name, s.picture, x.kind, x.title, x.description, x.video_url, x.external_url, x.cover_url,
    x.live_starts_at, x.live_ends_at,
    case when x.kind <> 'live' then null when now() < x.live_starts_at then 'upcoming' when now() <= x.live_ends_at then 'live' else 'ended' end,
    coalesce(x.featured_until > now(), false), x.views, x.created_at
  from public.promo_posts x cross join lateral public.promo_subject(x.subject_kind, x.subject_id) s
  where x.status = 'published' and s.visible
    and (p_kind is null or x.kind = p_kind)
    and (p_subject_kind is null or (x.subject_kind = p_subject_kind and x.subject_id = p_subject_id))
    and (x.kind <> 'live' or x.live_ends_at > now() - interval '3 days' or p_subject_id is not null)
  order by (x.kind = 'live' and now() between x.live_starts_at and x.live_ends_at) desc,
    coalesce(x.featured_until > now(), false) desc,
    (x.kind = 'live' and now() < x.live_starts_at) desc,
    case when x.kind = 'live' and now() < x.live_starts_at then x.live_starts_at end asc,
    x.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$function$
;

CREATE OR REPLACE FUNCTION public.promo_notify_followers(p promo_posts, p_source text, p_title text, p_body text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return public.notify_followers(
    case p.subject_kind
      when 'provider' then array(select user_id from public.followed_providers where provider_id = p.subject_id)
      when 'business' then array(select user_id from public.followed_businesses where business_id = p.subject_id)
      else array(select user_id from public.followed_sellers where seller_id = p.subject_id) end,
    p_source, p_title, p_body, jsonb_build_object('post_id', p.id));
end $function$
;

CREATE OR REPLACE FUNCTION public.promo_subject(p_kind text, p_id uuid, OUT owner uuid, OUT name text, OUT picture text, OUT visible boolean)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_kind = 'provider' then
    select pp.user_id, pp.display_name, pp.avatar_url, pp.active and public.subject_paid_up(pp.user_id, null) into owner, name, picture, visible
      from public.provider_profiles pp where pp.user_id = p_id;
  elsif p_kind = 'business' then
    select b.owner_id, b.name, b.logo_url, b.active and public.subject_paid_up(null, b.id) into owner, name, picture, visible
      from public.businesses b where b.id = p_id;
  elsif p_kind = 'store' then
    select pr.id, coalesce(nullif(pr.full_name, ''), 'Loja'), pr.avatar_url, pr.status = 'active' and public.store_paid_up(pr.id) into owner, name, picture, visible
      from public.profiles pr where pr.id = p_id and exists (select 1 from public.subscriptions s where s.seller_id = pr.id and s.kind = 'store');
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.promo_tick()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.promo_posts; s record; n integer := 0;
begin
  for p in select * from public.promo_posts where kind = 'live' and status = 'published' and not live_notified
             and live_starts_at <= now() + interval '5 minutes' and live_ends_at > now() for update skip locked loop
    select * into s from public.promo_subject(p.subject_kind, p.subject_id);
    if s.visible then perform public.promo_notify_followers(p, 'live:' || p.id, '🔴 ' || s.name || ' está em direto agora', p.title); end if;
    update public.promo_posts set live_notified = true where id = p.id;
    n := n + 1;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.provider_confirm_payment(p_reference text, p_amount numeric, p_provider_payment_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pay public.order_payments;
begin
  if p_provider_payment_id is null or p_reference is null then return 'invalid'; end if;
  if exists (select 1 from public.order_payments where provider_payment_id = p_provider_payment_id) then return 'duplicate'; end if;
  select * into pay from public.order_payments where provider = 'proxypay' and reference = p_reference and status in ('pending', 'expired')
   order by created_at desc limit 1 for update;
  if not found then
    perform public.notify_staff('Pagamento ProxyPay sem encomenda', p_amount || ' Kz · referência ' || p_reference, jsonb_build_object('reference', p_reference));
    return 'unknown_reference';
  end if;
  if p_amount < pay.amount then
    update public.order_payments set paid_amount = p_amount, provider_payment_id = p_provider_payment_id,
      admin_note = 'Pagou ' || p_amount || ' Kz em vez de ' || pay.amount || ' Kz.' where id = pay.id;
    perform public.notify_staff('Pagamento com valor errado', p_amount || ' Kz em vez de ' || pay.amount || ' Kz · referência ' || p_reference,
      jsonb_build_object('payment_id', pay.id, 'order_id', pay.order_id));
    return 'amount_mismatch';
  end if;
  perform public.escrow_mark_paid(pay.id, p_amount, p_provider_payment_id);
  return 'ok';
end $function$
;

CREATE OR REPLACE FUNCTION public.provider_directory(p_query text DEFAULT ''::text, p_category_id uuid DEFAULT NULL::uuid, p_municipality_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 30)
 RETURNS TABLE(user_id uuid, display_name text, headline text, bio text, category_id uuid, category_name text, municipality_id uuid, municipality_name text, phone text, whatsapp text, avatar_url text, verified boolean, rating numeric, review_count bigint, services_count bigint, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select p.user_id, p.display_name, p.headline, p.bio, p.category_id, coalesce(c.name, p.custom_category), p.municipality_id, m.name,
         p.phone, p.whatsapp, p.avatar_url, p.verified,
         coalesce(round(avg(r.rating)::numeric, 1), 0), count(distinct r.id),
         (select count(*) from public.services s where s.provider_id = p.user_id and s.active), p.created_at
  from public.provider_profiles p
  left join public.categories c on c.id = p.category_id
  left join public.municipalities m on m.id = p.municipality_id
  left join public.reviews r on r.provider_id = p.user_id and r.status = 'published'
  where p.active
    and (p_category_id is null or p.category_id = p_category_id)
    and (p_municipality_id is null or p.municipality_id = p_municipality_id)
    and (coalesce(p_query, '') = '' or public.fold_text(concat_ws(' ', p.display_name, p.headline, p.bio, p.custom_category, c.name)) like '%' || public.fold_text(trim(p_query)) || '%'
         or exists (select 1 from public.services s where s.provider_id = p.user_id and s.active and public.fold_text(s.title) like '%' || public.fold_text(trim(p_query)) || '%'))
  group by p.user_id, c.name, m.name
  order by p.verified desc, count(distinct r.id) desc, p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$function$
;

CREATE OR REPLACE FUNCTION public.provider_register_reference(p_order_id uuid, p_entity text, p_reference text, p_amount numeric, p_expires_at timestamp with time zone)
 RETURNS order_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; pay public.order_payments;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.escrow_status <> 'awaiting_payment' or o.status = 'cancelled' then raise exception 'PAYMENT_NOT_EXPECTED'; end if;
  if p_amount <> o.total then raise exception 'INVALID_AMOUNT'; end if;
  update public.order_payments set status = 'expired' where order_id = o.id and status = 'pending' and provider = 'proxypay';
  if exists (select 1 from public.order_payments where order_id = o.id and status = 'pending') then raise exception 'PAYMENT_PENDING'; end if;
  insert into public.order_payments(order_id, buyer_id, amount, provider, method, entity, reference, expires_at)
  values (o.id, o.buyer_id, o.total, 'proxypay', 'reference', p_entity, p_reference, p_expires_at) returning * into pay;
  return pay;
end $function$
;

CREATE OR REPLACE FUNCTION public.public_seller(p_user_id uuid)
 RETURNS TABLE(id uuid, full_name text, avatar_url text, municipality text, member_since timestamp with time zone, listings bigint, products bigint, is_provider boolean, rating numeric, review_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.full_name, p.avatar_url, p.municipality, p.created_at,
         (select count(*) from public.classified_listings l where l.owner_id = p.id and l.status = 'published'),
         (select count(*) from public.products x where x.seller_id = p.id and x.active),
         exists (select 1 from public.provider_profiles pp where pp.user_id = p.id and pp.active),
         (select coalesce(round(avg(r.rating)::numeric, 1), 0) from public.reviews r where r.provider_id = p.id and r.status = 'published'),
         (select count(*) from public.reviews r where r.provider_id = p.id and r.status = 'published')
  from public.profiles p where p.id = p_user_id and p.status = 'active';
$function$
;

CREATE OR REPLACE FUNCTION public.public_trust_signals(p_user_id uuid)
 RETURNS TABLE(identity_verified boolean, phone_verified boolean, provider_verified boolean, businesses_verified bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select kyc_level >= 1 from public.profiles where id = p_user_id), false),
         coalesce((select phone_verified from public.profiles where id = p_user_id), false),
         coalesce((select verified from public.provider_profiles where user_id = p_user_id), false),
         (select count(*) from public.businesses where owner_id = p_user_id and verified and active);
$function$
;

CREATE OR REPLACE FUNCTION public.public_user_stats(p_user_id uuid)
 RETURNS TABLE(seller_rating numeric, seller_reviews bigint, buyer_rating numeric, buyer_reviews bigint, sales_done bigint, purchases_done bigint, listings_sold bigint, listings_active bigint, services_requested bigint, services_done bigint, service_rating numeric, service_reviews bigint, member_since timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    (select round(avg(rating)::numeric, 1) from public.user_reviews where target_id = p_user_id and role = 'seller' and status = 'published'),
    (select count(*) from public.user_reviews where target_id = p_user_id and role = 'seller' and status = 'published'),
    (select round(avg(rating)::numeric, 1) from public.user_reviews where target_id = p_user_id and role = 'buyer' and status = 'published'),
    (select count(*) from public.user_reviews where target_id = p_user_id and role = 'buyer' and status = 'published'),
    (select count(*) from public.orders where seller_id = p_user_id and status = 'completed'),
    (select count(*) from public.orders where buyer_id = p_user_id and status = 'completed')
      + (select count(*) from public.classified_listings where deal_with = p_user_id and purpose <> 'wanted')
      + (select count(*) from public.classified_listings where owner_id = p_user_id and purpose = 'wanted' and deal_with is not null),
    (select count(*) from public.classified_listings where owner_id = p_user_id and purpose <> 'wanted' and status in ('sold', 'rented'))
      + (select count(*) from public.classified_listings where deal_with = p_user_id and purpose = 'wanted'),
    (select count(*) from public.classified_listings where owner_id = p_user_id and status = 'published'),
    (select count(*) from public.service_requests where provider_id = p_user_id),
    (select count(*) from public.service_requests where provider_id = p_user_id and status in ('done', 'confirmed')),
    (select round(avg(rating)::numeric, 1) from public.reviews where provider_id = p_user_id and status = 'published'),
    (select count(*) from public.reviews where provider_id = p_user_id and status = 'published'),
    (select created_at from public.profiles where id = p_user_id);
$function$
;

CREATE OR REPLACE FUNCTION public.publish_classified_listing(p_listing_id uuid)
 RETURNS classified_listings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; m uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into l from public.classified_listings where id = p_listing_id for update;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.owner_id <> auth.uid() and not public.has_admin_role() then raise exception 'NOT_LISTING_OWNER'; end if;
  if nullif(trim(l.title), '') is null then raise exception 'TITLE_REQUIRED'; end if;
  begin m := nullif(l.attributes->>'municipalityId', '')::uuid; exception when others then m := null; end;
  if l.address_id is null and (m is null or not exists (select 1 from public.municipalities x where x.id = m)) then
    raise exception 'LOCATION_REQUIRED';
  end if;
  if not public.validate_classified_attributes(l.listing_type, l.attributes) then raise exception 'INVALID_ATTRIBUTES'; end if;
  if jsonb_typeof(l.media) <> 'array' then raise exception 'MEDIA_INVALID'; end if;
  if jsonb_array_length(l.media) > 10 then raise exception 'TOO_MANY_PHOTOS'; end if;
  perform set_config('huambo.allow_publish', 'on', true);
  update public.classified_listings set status = 'published' where id = p_listing_id returning * into l;
  perform set_config('huambo.allow_publish', '', true);
  return l;
end $function$
;

CREATE OR REPLACE FUNCTION public.queue_video_cleanup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.video_url is not null and (tg_op = 'DELETE' or new.video_url is distinct from old.video_url) then
    insert into public.media_cleanup_queue(path) values (public.video_path(old.video_url)) on conflict (path) do nothing;
  end if;
  return coalesce(new, old);
end $function$
;

CREATE OR REPLACE FUNCTION public.record_item_event(p_kind text, p_id uuid, p_event text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_owner uuid;
begin
  if p_event not in ('view', 'whatsapp', 'call', 'share') then return; end if;
  if p_kind = 'listing' then select owner_id into v_owner from public.classified_listings where id = p_id and status = 'published';
  elsif p_kind = 'product' then select seller_id into v_owner from public.products where id = p_id and active;
  elsif p_kind = 'business' then select owner_id into v_owner from public.businesses where id = p_id and active;
  elsif p_kind = 'provider' then select user_id into v_owner from public.provider_profiles where user_id = p_id and active;
  else return; end if;
  if v_owner is null or v_owner = auth.uid() then return; end if;
  insert into public.item_stats_daily as s (kind, item_id, day, owner_id, views, whatsapp, calls, shares)
  values (p_kind, p_id, public.angola_today(), v_owner,
    (p_event = 'view')::int, (p_event = 'whatsapp')::int, (p_event = 'call')::int, (p_event = 'share')::int)
  on conflict (kind, item_id, day) do update set
    views = s.views + excluded.views, whatsapp = s.whatsapp + excluded.whatsapp,
    calls = s.calls + excluded.calls, shares = s.shares + excluded.shares, owner_id = excluded.owner_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.record_promo_view(p_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.promo_posts set views = views + 1 where id = p_id and status = 'published' and owner_id is distinct from auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.referral_apply_reward(p_referred uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.referrals; s public.subscriptions; days int;
begin
  select * into r from public.referrals where referred_id = p_referred for update;
  if not found or r.status = 'rewarded' then return; end if;
  days := coalesce(r.reward_days, (select referral_reward_days from public.platform_settings where id = 1), 30);
  if days <= 0 then return; end if;
  select x.* into s from public.subscriptions x where x.owner_id = r.referrer_id
    order by public.subscription_active_until(x) asc limit 1 for update;
  if not found then
    if r.status = 'joined' then
      update public.referrals set status = 'earned', reward_days = days, earned_at = now() where referred_id = r.referred_id;
      insert into public.notifications(user_id, type, title, body, data)
      values (r.referrer_id, 'system', 'Ganhou 1 mês grátis 🎁', 'Quem convidou pagou a primeira mensalidade. O seu prémio de ' || days
        || ' dias fica guardado e entra na sua primeira mensalidade (profissional, empresa ou loja).', jsonb_build_object('for', 'referral'));
    end if;
    return;
  end if;
  update public.subscriptions set paid_until = greatest(now(), public.subscription_active_until(s)) + make_interval(days => days), last_reminder = null where id = s.id;
  update public.referrals set status = 'rewarded', reward_days = days, subscription_id = s.id, earned_at = coalesce(earned_at, now()), rewarded_at = now()
   where referred_id = r.referred_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (r.referrer_id, 'system', 'Ganhou 1 mês grátis 🎁', 'Quem convidou pagou a primeira mensalidade: juntámos ' || days || ' dias grátis à sua mensalidade.',
    jsonb_build_object('for', 'plan'));
end $function$
;

CREATE OR REPLACE FUNCTION public.referral_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed'
     and not exists (select 1 from public.subscription_payments x where x.owner_id = new.owner_id and x.status = 'confirmed' and x.id <> new.id) then
    perform public.referral_apply_reward(new.owner_id);
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.referral_on_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.referrals;
begin
  for r in select * from public.referrals where referrer_id = new.owner_id and status = 'earned' for update loop
    update public.subscriptions set trial_ends_at = trial_ends_at + make_interval(days => coalesce(r.reward_days, 30)) where id = new.id;
    update public.referrals set status = 'rewarded', subscription_id = new.id, rewarded_at = now() where referred_id = r.referred_id;
  end loop;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.register_courier(p_name text, p_phone text, p_vehicle text, p_municipality_id uuid)
 RETURNS couriers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.couriers;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.couriers(user_id, display_name, phone, vehicle, municipality_id)
  values (auth.uid(), trim(p_name), trim(p_phone), coalesce(p_vehicle, 'moto'), p_municipality_id)
  on conflict (user_id) do update set display_name = excluded.display_name, phone = excluded.phone,
    vehicle = excluded.vehicle, municipality_id = excluded.municipality_id, updated_at = now()
  returning * into c;
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.rental_commission_on_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    select * into l from public.classified_listings where id = new.listing_id;
    if found then perform public.listing_commission_add(l, new.proposed_price, 'rental', new.id); end if;
  elsif old.status = 'accepted' and new.status is distinct from 'accepted' then
    update public.listing_commissions set status = 'cancelled', admin_note = coalesce(admin_note, 'Aluguer cancelado.')
     where rental_request_id = new.id and status = 'due';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.reply_to_review(p_kind text, p_review_id uuid, p_reply text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t text := nullif(left(trim(coalesce(p_reply, '')), 1000), ''); author uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_kind = 'service' then
    select r.author_id into author from public.reviews r left join public.businesses b on b.id = r.business_id
     where r.id = p_review_id and (r.provider_id = auth.uid() or b.owner_id = auth.uid());
    if not found then raise exception 'NOT_REVIEW_TARGET'; end if;
    update public.reviews set owner_reply = t, owner_reply_at = case when t is null then null else now() end where id = p_review_id;
  elsif p_kind = 'deal' then
    select r.author_id into author from public.user_reviews r where r.id = p_review_id and r.target_id = auth.uid();
    if not found then raise exception 'NOT_REVIEW_TARGET'; end if;
    update public.user_reviews set reply = t, reply_at = case when t is null then null else now() end where id = p_review_id;
  else raise exception 'INVALID_KIND'; end if;
  if t is not null then
    insert into public.notifications(user_id, type, title, body, data)
    values (author, 'review', 'Responderam à sua avaliação', left(t, 140), jsonb_build_object('for', 'reply'));
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.report_classified_listing(p_listing_id uuid, p_reason text, p_details text DEFAULT NULL::text)
 RETURNS moderation_reports
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.moderation_reports;
begin
 if not exists(select 1 from public.classified_listings where id=p_listing_id) then
   raise exception 'LISTING_NOT_FOUND';
 end if;
 insert into public.moderation_reports(reporter_id,target_type,target_id,reason,details,status)
 values(auth.uid(),'classified_listing',p_listing_id,trim(p_reason),nullif(trim(p_details),''),'open')
 returning * into r;
 return r;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.report_content(p_target_type text, p_target_id uuid, p_reason text, p_details text DEFAULT NULL::text)
 RETURNS moderation_reports
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.moderation_reports; owner uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'REASON_REQUIRED'; end if;
  owner := case p_target_type
    when 'user' then (select id from public.profiles where id = p_target_id)
    when 'provider' then (select user_id from public.provider_profiles where user_id = p_target_id)
    when 'business' then (select owner_id from public.businesses where id = p_target_id)
    when 'product' then (select seller_id from public.products where id = p_target_id)
    when 'classified_listing' then (select owner_id from public.classified_listings where id = p_target_id)
    when 'promo_post' then (select owner_id from public.promo_posts where id = p_target_id)
    else null end;
  if p_target_type not in ('user', 'provider', 'business', 'product', 'classified_listing', 'promo_post') then raise exception 'INVALID_TARGET'; end if;
  if owner is null then raise exception 'TARGET_NOT_FOUND'; end if;
  if owner = auth.uid() then raise exception 'CANNOT_REPORT_SELF'; end if;
  if exists (select 1 from public.moderation_reports where reporter_id = auth.uid() and target_type = p_target_type and target_id = p_target_id and status in ('open', 'reviewing')) then
    raise exception 'ALREADY_REPORTED';
  end if;
  if (select count(*) from public.moderation_reports where reporter_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;
  insert into public.moderation_reports(reporter_id, target_type, target_id, reason, details, status)
  values (auth.uid(), p_target_type, p_target_id, left(trim(p_reason), 200), nullif(left(trim(coalesce(p_details, '')), 1000), ''), 'open')
  returning * into r;
  perform public.notify_staff('Nova denúncia', left(trim(p_reason), 140), jsonb_build_object('report_id', r.id));
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.report_fuel(p_product_id uuid, p_has boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if not exists (select 1 from public.fuel_products p join public.fuel_stations s on s.id = p.station_id where p.id = p_product_id and s.status = 'approved') then raise exception 'FUEL_NOT_FOUND'; end if;
  if exists (select 1 from public.fuel_reports where product_id = p_product_id and user_id = me and created_at > now() - interval '30 minutes') then raise exception 'FUEL_REPORT_TOO_SOON'; end if;
  if (select count(*) from public.fuel_reports where user_id = me and created_at > now() - interval '1 day') >= 20 then raise exception 'TOO_MANY_REQUESTS'; end if;
  insert into public.fuel_reports(product_id, user_id, has) values (p_product_id, me, p_has);
end $function$
;

CREATE OR REPLACE FUNCTION public.reputation_summary(p_business_id uuid DEFAULT NULL::uuid, p_provider_id uuid DEFAULT NULL::uuid, p_product_id uuid DEFAULT NULL::uuid, p_service_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(rating numeric, review_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(round(avg(r.rating)::numeric,2),0),count(*)
  from public.reviews r
  where r.status='published'
    and (p_business_id is null or r.business_id=p_business_id)
    and (p_provider_id is null or r.provider_id=p_provider_id)
    and (p_product_id is null or r.product_id=p_product_id)
    and (p_service_id is null or r.service_id=p_service_id);
$function$
;

CREATE OR REPLACE FUNCTION public.request_classified_rental(p_listing_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_price numeric, p_message text DEFAULT NULL::text)
 RETURNS rental_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; r public.rental_requests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into l from public.classified_listings where id = p_listing_id and status = 'published' and purpose in ('rent','lease');
  if not found then raise exception 'LISTING_NOT_RENTABLE'; end if;
  if l.owner_id = auth.uid() then raise exception 'CANNOT_RENT_OWN_LISTING'; end if;
  if p_ends_at <= p_starts_at or p_price < 0 or p_starts_at < now() - interval '1 day' then raise exception 'INVALID_RENTAL_REQUEST'; end if;
  if exists (select 1 from public.rental_requests x where x.listing_id = p_listing_id and x.status = 'accepted'
             and x.starts_at < p_ends_at and x.ends_at > p_starts_at) then raise exception 'RENTAL_WINDOW_UNAVAILABLE'; end if;
  insert into public.rental_requests(listing_id, renter_id, starts_at, ends_at, proposed_price, message)
  values (p_listing_id, auth.uid(), p_starts_at, p_ends_at, p_price, nullif(trim(p_message), '')) returning * into r;
  insert into public.notifications(user_id, type, title, body, data)
  values (l.owner_id, 'system', 'Novo pedido de aluguer', 'Recebeu um pedido para «' || l.title || '».', jsonb_build_object('rental_id', r.id, 'listing_id', l.id));
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_identity_verification(p_front_path text, p_back_path text, p_selfie_path text, p_id_number text, p_note text DEFAULT NULL::text)
 RETURNS verification_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.verification_requests; me uuid := auth.uid(); bi text := public.normalize_bi(p_id_number);
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if coalesce((select kyc_level from public.profiles where id = me), 0) >= 1 then raise exception 'ALREADY_VERIFIED'; end if;
  if p_front_path is null or p_back_path is null or p_selfie_path is null then raise exception 'IDENTITY_PHOTOS_REQUIRED'; end if;
  if split_part(p_front_path, '/', 1) <> me::text or split_part(p_back_path, '/', 1) <> me::text or split_part(p_selfie_path, '/', 1) <> me::text then raise exception 'INVALID_DOCUMENT'; end if;
  if p_front_path = p_back_path or p_front_path = p_selfie_path or p_back_path = p_selfie_path then raise exception 'IDENTITY_PHOTOS_REQUIRED'; end if;
  if bi !~ '^[0-9]{9}[A-Z]{2}[0-9]{3}$' then raise exception 'INVALID_BI_NUMBER'; end if;
  if exists (select 1 from public.verification_requests where user_id = me and kind = 'identity' and status = 'pending') then raise exception 'VERIFICATION_PENDING'; end if;
  if exists (select 1 from public.verification_requests where id_number = bi and kind = 'identity' and status in ('pending', 'approved') and user_id <> me) then raise exception 'BI_ALREADY_USED'; end if;
  insert into public.verification_requests(user_id, kind, document_path, back_path, selfie_path, id_number, note)
  values (me, 'identity', p_front_path, p_back_path, p_selfie_path, bi, nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning * into v;
  perform public.notify_staff('Novo pedido de verificação', 'Identidade (BI + selfie)', jsonb_build_object('verification_id', v.id));
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_inspection(p_kind text, p_target uuid, p_address text, p_phone text, p_preferred_time text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS inspections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); i public.inspections; fee numeric;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_kind not in ('provider', 'business', 'store') then raise exception 'INVALID_KIND'; end if;
  if public.inspection_target_owner(p_kind, p_target) is distinct from me then raise exception 'INSPECTION_NOT_OWNER'; end if;
  if char_length(trim(coalesce(p_address, ''))) < 5 then raise exception 'INSPECTION_ADDRESS_REQUIRED'; end if;
  if char_length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) < 9 then raise exception 'PHONE_REQUIRED'; end if;
  if exists (select 1 from public.inspections where kind = p_kind and target_id = p_target and status in ('awaiting_payment', 'payment_submitted', 'requested', 'scheduled')) then raise exception 'INSPECTION_OPEN'; end if;
  if exists (select 1 from public.inspections where kind = p_kind and target_id = p_target and status = 'approved' and valid_until > now() + interval '30 days') then raise exception 'INSPECTION_STILL_VALID'; end if;
  select coalesce(case when p_kind = 'provider' then inspection_fee_provider_kz else inspection_fee_kz end, 0) into fee from public.platform_settings where id = 1;
  insert into public.inspections(kind, target_id, owner_id, status, fee_amount, address, phone, preferred_time, note)
  values (p_kind, p_target, me, case when fee > 0 then 'awaiting_payment' else 'requested' end, fee, left(trim(p_address), 300), left(regexp_replace(p_phone, '[^0-9+]', '', 'g'), 20),
    nullif(left(trim(coalesce(p_preferred_time, '')), 120), ''), nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning * into i;
  if fee = 0 then
    perform public.notify_staff('🏅 Pedido de inspeção', 'I-' || i.ref_no || ' · ' || coalesce(public.inspection_target_name(p_kind, p_target), ''), jsonb_build_object('inspection_id', i.id));
  end if;
  return i;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_listing_boost(p_listing_id uuid, p_method text, p_reference text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS listing_boosts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; st public.platform_settings; b public.listing_boosts; ref text := nullif(left(trim(coalesce(p_reference, '')), 120), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into l from public.classified_listings where id = p_listing_id;
  if not found or l.owner_id <> auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if l.status <> 'published' then raise exception 'LISTING_NOT_PUBLISHED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if ref is null and p_proof_path is null then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_DOCUMENT'; end if;
  if exists (select 1 from public.listing_boosts where listing_id = l.id and status = 'pending') then raise exception 'PAYMENT_PENDING'; end if;
  select * into st from public.platform_settings where id = 1;
  insert into public.listing_boosts(listing_id, owner_id, days, amount, method, reference, proof_path)
  values (l.id, auth.uid(), st.boost_days, st.boost_price_kz, p_method, ref, p_proof_path) returning * into b;
  perform public.notify_staff('Destaque para confirmar', b.amount || ' Kz · ' || l.title || ' · D-' || b.ref_no, jsonb_build_object('boost_id', b.id, 'listing_id', l.id));
  return b;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_order_delivery(p_order_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS delivery_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; d public.delivery_requests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.seller_id <> auth.uid() and not public.has_admin_role() then raise exception 'NOT_ORDER_PARTY'; end if;
  if o.fulfillment_type <> 'delivery' then raise exception 'ORDER_IS_PICKUP'; end if;
  if o.status in ('completed', 'cancelled') then raise exception 'ORDER_CLOSED'; end if;
  if exists (select 1 from public.delivery_requests x where x.order_id = o.id and x.status not in ('delivered', 'cancelled')) then
    raise exception 'DELIVERY_ALREADY_REQUESTED';
  end if;
  insert into public.delivery_requests(order_id, requester_id, status, notes)
  values (o.id, auth.uid(), 'pending', nullif(trim(coalesce(p_notes, '')), '')) returning * into d;
  update public.orders set fulfillment_status = 'pending', updated_at = now() where id = o.id;
  insert into public.notifications(user_id, type, title, body, data)
  select c.user_id, 'delivery', 'Nova entrega disponível', 'Encomenda de ' || o.total || ' Kz para entregar.',
         jsonb_build_object('delivery_id', d.id, 'for', 'courier')
  from public.couriers c where c.status = 'approved' and c.available and c.user_id <> o.seller_id limit 100;
  return d;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_payout(p_amount numeric DEFAULT NULL::numeric)
 RETURNS payout_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.payout_accounts; st public.platform_settings; avail numeric; amt numeric; pr public.payout_requests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payout:' || auth.uid()::text, 0));
  select * into a from public.payout_accounts where user_id = auth.uid();
  if not found then raise exception 'PAYOUT_ACCOUNT_REQUIRED'; end if;
  if exists (select 1 from public.payout_requests where user_id = auth.uid() and status in ('requested', 'processing')) then raise exception 'PAYOUT_OPEN'; end if;
  select * into st from public.platform_settings where id = 1;
  select coalesce(sum(amount), 0) into avail from public.wallet_entries where user_id = auth.uid() and bucket = 'available';
  amt := round(coalesce(p_amount, avail), 2);
  if amt <= 0 or amt > avail then raise exception 'NOT_ENOUGH_BALANCE'; end if;
  if amt < st.payout_min_kz then raise exception 'PAYOUT_TOO_SMALL'; end if;
  insert into public.payout_requests(user_id, amount, method, holder_name, destination)
  values (auth.uid(), amt, a.method, a.holder_name, case when a.method = 'iban' then public.format_angola_iban(a.iban) else a.express_number end)
  returning * into pr;
  perform public.wallet_add(auth.uid(), null, pr.id, 'available', 'payout', -amt, 'Levantamento L-' || pr.ref_no);
  perform public.notify_staff('Pedido de levantamento', amt || ' Kz · ' || a.holder_name || ' · L-' || pr.ref_no, jsonb_build_object('payout_id', pr.id));
  return pr;
end $function$
;
CREATE OR REPLACE FUNCTION public.request_service(p_provider_id uuid, p_business_id uuid, p_description text)
 RETURNS service_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.service_requests; owner uuid; who text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if (p_provider_id is null) = (p_business_id is null) then raise exception 'INVALID_TARGET'; end if;
  if char_length(trim(coalesce(p_description, ''))) < 3 then raise exception 'DESCRIPTION_REQUIRED'; end if;
  if p_provider_id is not null then
    select pp.user_id, pp.display_name into owner, who from public.provider_profiles pp where pp.user_id = p_provider_id and pp.active;
  else
    select b.owner_id, b.name into owner, who from public.businesses b where b.id = p_business_id and b.active;
  end if;
  if owner is null then raise exception 'TARGET_NOT_FOUND'; end if;
  if owner = auth.uid() then raise exception 'CANNOT_REQUEST_OWN_SERVICE'; end if;
  if (select count(*) from public.service_requests s where s.client_id = auth.uid() and s.created_at > now() - interval '1 day') >= 20 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;
  insert into public.service_requests(client_id, provider_id, business_id, description)
  values (auth.uid(), p_provider_id, p_business_id, left(trim(p_description), 1000)) returning * into r;
  insert into public.notifications(user_id, type, title, body, data)
  values (owner, 'system', 'Novo pedido de serviço', left(trim(p_description), 160), jsonb_build_object('service_request_id', r.id, 'for', 'service'));
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_service_v2(p_provider_id uuid, p_business_id uuid, p_description text, p_preferred_date date DEFAULT NULL::date)
 RETURNS service_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.service_requests;
begin
  if p_preferred_date is not null and (p_preferred_date < (now() at time zone 'Africa/Luanda')::date or p_preferred_date > (now() at time zone 'Africa/Luanda')::date + 365) then
    raise exception 'INVALID_DATE';
  end if;
  r := public.request_service(p_provider_id, p_business_id, p_description);
  if p_preferred_date is not null then
    update public.service_requests set preferred_date = p_preferred_date where id = r.id returning * into r;
  end if;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_verification(p_kind text, p_business_id uuid DEFAULT NULL::uuid, p_document_path text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS verification_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.verification_requests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_kind = 'identity' then raise exception 'IDENTITY_NEEDS_SELFIE'; end if;
  if p_kind not in ('provider', 'business') then raise exception 'INVALID_KIND'; end if;
  if p_kind = 'provider' and not exists (select 1 from public.provider_profiles where user_id = auth.uid()) then raise exception 'NO_PROVIDER_PROFILE'; end if;
  if p_kind = 'business' and not exists (select 1 from public.businesses where id = p_business_id and owner_id = auth.uid()) then raise exception 'NOT_BUSINESS_OWNER'; end if;
  if p_document_path is not null and split_part(p_document_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_DOCUMENT'; end if;
  if p_document_path is null then raise exception 'DOCUMENT_REQUIRED'; end if;
  if exists (select 1 from public.verification_requests where user_id = auth.uid() and kind = p_kind and status = 'pending'
             and business_id is not distinct from case when p_kind = 'business' then p_business_id end) then raise exception 'VERIFICATION_PENDING'; end if;
  insert into public.verification_requests(user_id, kind, business_id, document_path, note)
  values (auth.uid(), p_kind, case when p_kind = 'business' then p_business_id end, p_document_path, nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning * into v;
  perform public.notify_staff('Novo pedido de verificação', case p_kind when 'provider' then 'Profissional' else 'Empresa' end, jsonb_build_object('verification_id', v.id));
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.require_capability(target_user uuid, target_capability text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.account_capabilities
    where user_id = target_user and capability = target_capability
  );
$function$
;

CREATE OR REPLACE FUNCTION public.require_listing_conformity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published')
     and new.purpose <> 'wanted' and new.conformity_accepted_at is null then
    raise exception 'CONFORMITY_REQUIRED';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.require_product_conformity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.active and (tg_op = 'INSERT' or not old.active or old.conformity_accepted_at is null) and new.conformity_accepted_at is null then
    raise exception 'CONFORMITY_REQUIRED';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.reserve_event_tickets(p_ticket_type_id uuid, p_quantity integer, p_name text, p_phone text DEFAULT NULL::text)
 RETURNS event_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); t public.event_ticket_types; e public.events; o public.event_orders; st public.platform_settings; left_ int;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into t from public.event_ticket_types where id = p_ticket_type_id for update;
  if not found or not t.active then raise exception 'TICKET_TYPE_NOT_FOUND'; end if;
  select * into e from public.events where id = t.event_id;
  if e.status <> 'published' or coalesce(e.ends_at, e.starts_at + interval '6 hours') < now() then raise exception 'EVENT_NOT_ON_SALE'; end if;
  if e.organizer_id = me then raise exception 'CANNOT_BUY_OWN_TICKETS'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > t.max_per_order then raise exception 'INVALID_TICKET_QUANTITY'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'NAME_REQUIRED'; end if;
  left_ := t.quantity - public.ticket_type_taken(t.id);
  if p_quantity > left_ then raise exception 'NOT_ENOUGH_TICKETS'; end if;
  if t.price > 0 and exists (select 1 from public.event_orders where buyer_id = me and event_id = e.id and status in ('reserved', 'submitted')) then raise exception 'TICKET_ORDER_OPEN'; end if;
  select * into st from public.platform_settings where id = 1;
  insert into public.event_orders(event_id, ticket_type_id, buyer_id, buyer_name, buyer_phone, quantity, unit_price, total, status, pay_by, decided_at)
  values (e.id, t.id, me, trim(p_name), nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''), p_quantity, t.price, t.price * p_quantity,
    case when t.price = 0 then 'confirmed' else 'reserved' end,
    case when t.price = 0 then null else now() + make_interval(hours => st.event_payment_hours) end,
    case when t.price = 0 then now() end)
  returning * into o;
  if t.price = 0 then
    perform public.issue_event_tickets(o);
  else
    insert into public.notifications(user_id, type, title, body, data)
    values (e.organizer_id, 'system', 'Nova reserva de bilhetes 🎟️', o.quantity || ' × ' || t.name || ' · «' || left(e.title, 80) || '» · B-' || o.ref_no || '. Confirme quando receber o pagamento.',
      jsonb_build_object('for', 'event_orders', 'event_id', e.id));
  end if;
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.reserve_fuel(p_product_id uuid, p_quantity numeric, p_method text, p_name text, p_phone text DEFAULT NULL::text, p_plate text DEFAULT NULL::text)
 RETURNS fuel_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); p public.fuel_products; s public.fuel_stations; st public.platform_settings; o public.fuel_orders; left_ numeric; sub numeric; fee numeric;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into p from public.fuel_products where id = p_product_id for update;
  if not found then raise exception 'FUEL_NOT_FOUND'; end if;
  select * into s from public.fuel_stations where id = p.station_id;
  if s.status <> 'approved' then raise exception 'FUEL_NOT_FOUND'; end if;
  if s.owner_id = me then raise exception 'CANNOT_BUY_OWN'; end if;
  if p_method not in ('at_station', 'prepaid') then raise exception 'INVALID_METHOD'; end if;
  if not s.accepts_reservations or public.fuel_fees_overdue(s.id) then raise exception 'FUEL_NO_RESERVATIONS'; end if;
  if p_method = 'prepaid' and (not s.accepts_prepay or not exists (select 1 from public.fuel_station_pay x where x.station_id = s.id and (x.iban is not null or x.express is not null))) then raise exception 'FUEL_NO_PREPAY'; end if;
  if p.status not in ('available', 'low') then raise exception 'FUEL_NOT_AVAILABLE'; end if;
  if p.price is null then raise exception 'FUEL_NO_PRICE'; end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > p.max_per_order then raise exception 'FUEL_INVALID_QUANTITY'; end if;
  if p.product like 'gas_%' and p_quantity <> trunc(p_quantity) then raise exception 'FUEL_INVALID_QUANTITY'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'NAME_REQUIRED'; end if;
  left_ := p.reservable_qty - public.fuel_reserved_qty(p.id);
  if p_quantity > left_ then raise exception 'FUEL_NOT_ENOUGH'; end if;
  if exists (select 1 from public.fuel_orders where buyer_id = me and product = p.product and status in ('reserved', 'awaiting_payment', 'submitted', 'paid')) then raise exception 'FUEL_ORDER_OPEN'; end if;
  select * into st from public.platform_settings where id = 1;
  sub := round(p.price * p_quantity);
  fee := round(sub * st.fuel_fee_pct / 100);
  insert into public.fuel_orders(station_id, product_id, product, buyer_id, buyer_name, buyer_phone, plate, quantity, unit_price, subtotal, fee_pct, fee_amount, total,
    method, status, code, hold_until, pay_by)
  values (s.id, p.id, p.product, me, trim(p_name), nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''), nullif(upper(trim(coalesce(p_plate, ''))), ''),
    p_quantity, p.price, sub, st.fuel_fee_pct, fee, sub + fee, p_method,
    case when p_method = 'at_station' then 'reserved' else 'awaiting_payment' end,
    case when p_method = 'at_station' then public.new_fuel_code() end,
    case when p_method = 'at_station' then now() + make_interval(mins => s.hold_minutes) end,
    case when p_method = 'prepaid' then now() + make_interval(mins => st.fuel_pay_minutes) end)
  returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (s.owner_id, 'system', case when p_method = 'at_station' then '⛽ Nova reserva' else '⛽ Nova compra adiantada' end,
    'C-' || o.ref_no || ' · ' || o.quantity || ' × ' || public.fuel_product_label(o.product) || ' · ' || o.total || ' Kz · ' || o.buyer_name,
    jsonb_build_object('for', 'fuel_station', 'station_id', s.id));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.reserve_venue(p_venue_id uuid, p_kind text, p_lines jsonb, p_method text, p_name text, p_phone text DEFAULT NULL::text, p_check_in date DEFAULT NULL::date, p_check_out date DEFAULT NULL::date, p_guests integer DEFAULT NULL::integer, p_slot_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_note text DEFAULT NULL::text)
 RETURNS venue_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); v public.venues; b public.businesses; st public.platform_settings; o public.venue_orders; i public.venue_items;
  ln jsonb; q numeric; nights int := 1; sub numeric := 0; cfee numeric; bfee numeric; today date := (now() at time zone 'Africa/Luanda')::date; n int := 0; free_ numeric;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into v from public.venues where id = p_venue_id;
  if not found or v.status <> 'approved' then raise exception 'VENUE_NOT_FOUND'; end if;
  select * into b from public.businesses where id = v.business_id;
  if not b.active then raise exception 'VENUE_NOT_FOUND'; end if;
  if v.owner_id = me then raise exception 'CANNOT_BUY_OWN'; end if;
  if not v.accepts_reservations or public.venue_fees_overdue(v.id) then raise exception 'VENUE_NO_RESERVATIONS'; end if;
  if p_method not in ('at_place', 'prepaid') then raise exception 'INVALID_METHOD'; end if;
  if p_method = 'at_place' and not v.accepts_pay_at_place then raise exception 'VENUE_NO_PAY_AT_PLACE'; end if;
  if p_method = 'prepaid' and (not v.accepts_prepay or not exists (select 1 from public.venue_pay y where y.venue_id = v.id and (y.iban is not null or y.express is not null))) then raise exception 'VENUE_NO_PREPAY'; end if;
  if (v.kind = 'hotel' and p_kind <> 'stay') or (v.kind = 'restaurant' and p_kind not in ('table', 'order')) or (v.kind = 'warehouse' and p_kind <> 'order') then raise exception 'INVALID_KIND'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'NAME_REQUIRED'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then p_lines := '[]'; end if;
  if jsonb_array_length(p_lines) > 40 then raise exception 'VENUE_TOO_MANY_LINES'; end if;
  if (select count(*) from public.venue_orders where buyer_id = me and venue_id = v.id and public.venue_open_status(status)) >= 3 then raise exception 'VENUE_ORDER_OPEN'; end if;
  if p_kind = 'stay' then
    if jsonb_array_length(p_lines) <> 1 then raise exception 'VENUE_ONE_ROOM_TYPE'; end if;
    if p_check_in is null or p_check_out is null or p_check_in < today or p_check_in > today + 365 or p_check_out <= p_check_in then raise exception 'VENUE_INVALID_DATES'; end if;
    nights := p_check_out - p_check_in;
    if nights > 60 then raise exception 'VENUE_INVALID_DATES'; end if;
    if p_guests is null or p_guests < 1 then raise exception 'VENUE_INVALID_GUESTS'; end if;
  elsif p_kind = 'table' then
    if p_guests is null or p_guests < 1 or p_guests > 100 then raise exception 'VENUE_INVALID_GUESTS'; end if;
    if p_slot_at is null or p_slot_at < now() or p_slot_at > now() + interval '60 days' then raise exception 'VENUE_INVALID_TIME'; end if;
  else
    if jsonb_array_length(p_lines) = 0 then raise exception 'VENUE_EMPTY_ORDER'; end if;
    if p_slot_at is null or p_slot_at < now() - interval '5 minutes' or p_slot_at > now() + interval '30 days' then raise exception 'VENUE_INVALID_TIME'; end if;
  end if;
  select * into st from public.platform_settings where id = 1;
  insert into public.venue_orders(venue_id, buyer_id, kind, buyer_name, buyer_phone, guests, check_in, check_out, slot_at, buyer_note,
    subtotal, client_fee_pct, business_fee_pct, total, method, status)
  values (v.id, me, p_kind, trim(p_name), nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''), p_guests,
    case when p_kind = 'stay' then p_check_in end, case when p_kind = 'stay' then p_check_out end, case when p_kind <> 'stay' then p_slot_at end,
    nullif(left(trim(coalesce(p_note, '')), 300), ''), 0, st.venue_client_fee_pct, st.venue_business_fee_pct, 0, p_method, 'reserved')
  returning * into o;
  for ln in select * from jsonb_array_elements(p_lines) loop
    begin q := (ln->>'qty')::numeric; exception when others then raise exception 'VENUE_INVALID_QUANTITY'; end;
    select * into i from public.venue_items where id = (ln->>'item_id')::uuid and venue_id = v.id for update;
    if not found then raise exception 'VENUE_ITEM_NOT_FOUND'; end if;
    if not i.available then raise exception 'VENUE_ITEM_NOT_AVAILABLE'; end if;
    if q is null or q <= 0 or q > 100000 then raise exception 'VENUE_INVALID_QUANTITY'; end if;
    if exists (select 1 from public.venue_order_lines where order_id = o.id and item_id = i.id) then raise exception 'VENUE_DUPLICATE_ITEM'; end if;
    if p_kind = 'stay' then
      if q <> trunc(q) or q > 20 then raise exception 'VENUE_INVALID_QUANTITY'; end if;
      if p_guests > coalesce(i.capacity, 2) * q then raise exception 'VENUE_TOO_MANY_GUESTS'; end if;
      if public.venue_room_free(i.id, p_check_in, p_check_out) < q then raise exception 'VENUE_NO_ROOMS'; end if;
    else
      if q < i.min_qty then raise exception 'VENUE_BELOW_MINIMUM'; end if;
      if i.qty_total is not null and q > i.qty_total - public.venue_item_reserved(i.id) then raise exception 'VENUE_NOT_ENOUGH'; end if;
    end if;
    insert into public.venue_order_lines(order_id, item_id, name, unit, qty, unit_price, line_total)
    values (o.id, i.id, i.name, i.unit, q, i.price, round(i.price * q * nights));
    sub := sub + round(i.price * q * nights);
    n := n + 1;
  end loop;
  cfee := round(sub * st.venue_client_fee_pct / 100);
  bfee := round(sub * st.venue_business_fee_pct / 100);
  if p_method = 'prepaid' and sub = 0 then raise exception 'VENUE_NOTHING_TO_PAY'; end if;
  update public.venue_orders set subtotal = sub, client_fee = cfee, business_fee = bfee, total = sub + cfee,
    status = case when p_method = 'at_place' then 'reserved' else 'awaiting_payment' end,
    code = case when p_method = 'at_place' then public.new_venue_code() end,
    hold_until = case when p_method = 'at_place' then
      case when p_kind = 'stay' then ((p_check_in + 1)::timestamp + time '12:00') at time zone 'Africa/Luanda' else p_slot_at + make_interval(mins => v.hold_minutes) end end,
    pay_by = case when p_method = 'prepaid' then now() + make_interval(mins => st.venue_pay_minutes) end
  where id = o.id returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (v.owner_id, 'system', case p_kind when 'stay' then '🏨 Nova reserva de quarto' when 'table' then '🍽️ Nova reserva de mesa' else '📦 Nova encomenda' end,
    'R-' || o.ref_no || ' · ' || o.buyer_name || ' · ' || o.total || ' Kz' || case when p_method = 'prepaid' then ' (vai pagar adiantado)' else ' (paga no local)' end,
    jsonb_build_object('for', 'venue', 'venue_id', v.id));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.respond_listing_claim(p_claim_id uuid, p_accept boolean, p_note text DEFAULT NULL::text)
 RETURNS listing_claims
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.listing_claims; txt text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  select * into c from public.listing_claims where id = p_claim_id for update;
  if not found or c.seller_id <> auth.uid() then raise exception 'CLAIM_NOT_FOUND'; end if;
  if c.status <> 'open' then raise exception 'INVALID_TRANSITION'; end if;
  if not p_accept and txt is null then raise exception 'REASON_REQUIRED'; end if;
  update public.listing_claims set status = case when p_accept then 'accepted' else 'declined' end, seller_note = txt, updated_at = now()
   where id = c.id returning * into c;
  insert into public.notifications(user_id, type, title, body, data)
  values (c.buyer_id, 'system', case when p_accept then 'Reclamação aceite ✔' else 'Reclamação recusada' end,
    '«' || left(c.listing_title, 120) || '» (R-' || c.ref_no || '): ' || coalesce(txt, case when p_accept then 'o vendedor aceitou.' else '' end)
    || case when p_accept then '' else ' Pode pedir à administração para decidir.' end, jsonb_build_object('for', 'claim'));
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.respond_offer(p_offer_id uuid, p_accept boolean, p_note text DEFAULT NULL::text)
 RETURNS listing_offers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.listing_offers; l public.classified_listings;
begin
  select * into o from public.listing_offers where id = p_offer_id for update;
  if not found then raise exception 'OFFER_NOT_FOUND'; end if;
  select * into l from public.classified_listings where id = o.listing_id;
  if l.owner_id is distinct from auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if o.status <> 'pending' then raise exception 'INVALID_TRANSITION'; end if;
  update public.listing_offers set status = case when p_accept then 'accepted' else 'declined' end,
    seller_note = nullif(left(trim(coalesce(p_note, '')), 300), ''), responded_at = now()
   where id = o.id returning * into o;
  insert into public.notifications(user_id, type, title, body, data)
  values (o.buyer_id, 'system', case when p_accept then 'Proposta aceite ✔' else 'Proposta recusada' end,
          '«' || l.title || '»' || coalesce(': ' || o.seller_note, case when p_accept then '. Combine a entrega com o vendedor pelas mensagens.' else '' end),
          jsonb_build_object('listing_id', l.id, 'offer_id', o.id, 'for', 'my_offer'));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.respond_rental_request(p_request_id uuid, p_accept boolean)
 RETURNS rental_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.rental_requests; l public.classified_listings;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.rental_requests where id = p_request_id for update;
  if not found then raise exception 'RENTAL_NOT_FOUND'; end if;
  select * into l from public.classified_listings where id = r.listing_id;
  if l.owner_id <> auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if r.status <> 'pending' then raise exception 'RENTAL_ALREADY_ANSWERED'; end if;
  if p_accept and exists (select 1 from public.rental_requests x where x.listing_id = r.listing_id and x.status = 'accepted'
                          and x.id <> r.id and x.starts_at < r.ends_at and x.ends_at > r.starts_at) then raise exception 'RENTAL_WINDOW_UNAVAILABLE'; end if;
  update public.rental_requests set status = case when p_accept then 'accepted' else 'rejected' end, updated_at = now()
   where id = r.id returning * into r;
  insert into public.notifications(user_id, type, title, body, data)
  values (r.renter_id, 'system', case when p_accept then 'Aluguer aceite' else 'Aluguer recusado' end,
          'O seu pedido para «' || l.title || '» foi ' || case when p_accept then 'aceite.' else 'recusado.' end,
          jsonb_build_object('rental_id', r.id, 'listing_id', l.id));
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.retract_auction_bid(p_auction_id uuid, p_reason text)
 RETURNS auctions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions; latest timestamptz; reason text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  reason := case p_reason when 'typo' then 'Enganei-me no valor' when 'listing_changed' then 'O vendedor mudou o anúncio'
    when 'cannot_contact' then 'Não consigo contactar o vendedor' end;
  if reason is null then raise exception 'INVALID_REASON'; end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if a.status <> 'live' or now() >= a.ends_at then raise exception 'AUCTION_NOT_LIVE'; end if;
  select max_set_at into latest from public.auction_max_bids where auction_id = a.id and bidder_id = auth.uid() and retracted_at is null;
  if latest is null then raise exception 'NO_BID_TO_RETRACT'; end if;
  if a.ends_at - now() <= interval '12 hours' and latest < now() - interval '1 hour' then raise exception 'RETRACT_TOO_LATE'; end if;
  if (select count(*) from public.auction_max_bids where bidder_id = auth.uid() and retracted_by = auth.uid() and retracted_at > now() - interval '30 days') >= 3 then raise exception 'TOO_MANY_RETRACTIONS'; end if;
  a := public.auction_drop_bidder(a, auth.uid(), auth.uid(), reason);
  insert into public.notifications(user_id, type, title, body, data)
  values (a.seller_id, 'bid', 'Lance retirado', 'Um licitador retirou os lances em «' || a.title || '» (' || reason || '). Preço atual: ' || a.current_price || ' Kz.',
          jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.round_listing_geo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.geo_lat := round(new.geo_lat, 3);
  new.geo_lng := round(new.geo_lng, 3);
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.save_payout_account(p_method text, p_holder text, p_destination text)
 RETURNS payout_accounts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.payout_accounts; holder text := nullif(left(trim(coalesce(p_holder, '')), 120), ''); dig text; num text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if holder is null or char_length(holder) < 3 then raise exception 'HOLDER_REQUIRED'; end if;
  if p_method = 'iban' then
    dig := public.angola_iban_digits(p_destination);
    if dig is null then raise exception 'INVALID_IBAN'; end if;
  elsif p_method = 'express' then
    num := right(regexp_replace(coalesce(p_destination, ''), '[^0-9]', '', 'g'), 9);
    if num !~ '^9[0-9]{8}$' then raise exception 'INVALID_EXPRESS_NUMBER'; end if;
  else raise exception 'INVALID_PAYOUT_METHOD'; end if;
  insert into public.payout_accounts(user_id, method, holder_name, iban, express_number, updated_at)
  values (auth.uid(), p_method, holder, dig, num, now())
  on conflict (user_id) do update set method = excluded.method, holder_name = excluded.holder_name, iban = excluded.iban,
    express_number = excluded.express_number, updated_at = now()
  returning * into a;
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.save_promo_post(p_id uuid, p_subject_kind text, p_subject_id uuid, p_kind text, p_title text, p_description text DEFAULT NULL::text, p_video_url text DEFAULT NULL::text, p_external_url text DEFAULT NULL::text, p_cover_url text DEFAULT NULL::text, p_live_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_live_minutes integer DEFAULT NULL::integer)
 RETURNS promo_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); s record; p public.promo_posts; old public.promo_posts;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_kind not in ('video', 'live') then raise exception 'INVALID_KIND'; end if;
  select * into s from public.promo_subject(p_subject_kind, p_subject_id);
  if s.owner is null or s.owner <> me then raise exception 'NOT_SUBJECT_OWNER'; end if;
  if char_length(trim(coalesce(p_title, ''))) < 4 then raise exception 'TITLE_REQUIRED'; end if;
  if p_kind = 'video' and p_video_url is null and p_external_url is null then raise exception 'VIDEO_REQUIRED'; end if;
  if p_kind = 'live' then
    if p_external_url is null then raise exception 'LIVE_LINK_REQUIRED'; end if;
    if p_live_starts_at is null then raise exception 'LIVE_TIME_REQUIRED'; end if;
    if coalesce(p_live_minutes, 0) not between 10 and 480 then raise exception 'LIVE_DURATION_INVALID'; end if;
  end if;
  if p_id is null then
    if p_kind = 'live' and p_live_starts_at < now() - interval '10 minutes' then raise exception 'LIVE_IN_PAST'; end if;
    if p_kind = 'live' and p_live_starts_at > now() + interval '60 days' then raise exception 'LIVE_TOO_FAR'; end if;
    if (select count(*) from public.promo_posts x where x.owner_id = me and x.created_at > now() - interval '1 day') >= 5 then raise exception 'TOO_MANY_POSTS'; end if;
    insert into public.promo_posts(owner_id, subject_kind, subject_id, kind, title, description, video_url, external_url, cover_url, live_starts_at, live_ends_at)
    values (me, p_subject_kind, p_subject_id, p_kind, trim(p_title), nullif(trim(coalesce(p_description, '')), ''), p_video_url, p_external_url, p_cover_url,
      case when p_kind = 'live' then p_live_starts_at end, case when p_kind = 'live' then p_live_starts_at + make_interval(mins => p_live_minutes) end)
    returning * into p;
    if s.visible then
      perform public.promo_notify_followers(p, 'promo:' || p.id,
        case when p.kind = 'live' then '🔴 Live de ' || s.name || ' — ' || to_char(p.live_starts_at at time zone 'Africa/Luanda', 'DD/MM HH24:MI')
             else '🎬 Vídeo novo de ' || s.name end, p.title);
    end if;
  else
    select * into old from public.promo_posts where id = p_id for update;
    if not found or old.owner_id <> me then raise exception 'POST_NOT_FOUND'; end if;
    if old.kind <> p_kind or old.subject_kind <> p_subject_kind or old.subject_id <> p_subject_id then raise exception 'CANNOT_CHANGE_KIND'; end if;
    update public.promo_posts set title = trim(p_title), description = nullif(trim(coalesce(p_description, '')), ''), video_url = p_video_url, external_url = p_external_url,
      cover_url = p_cover_url,
      live_starts_at = case when p_kind = 'live' then p_live_starts_at end,
      live_ends_at = case when p_kind = 'live' then p_live_starts_at + make_interval(mins => p_live_minutes) end,
      live_notified = case when p_kind = 'live' and p_live_starts_at is distinct from old.live_starts_at then false else old.live_notified end,
      updated_at = now()
    where id = p_id returning * into p;
  end if;
  return p;
end $function$
;

CREATE OR REPLACE FUNCTION public.saved_search_territory_active(p_territory_id uuid, p_kind text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare ok boolean;
begin
  if p_territory_id is null then return true; end if;
  if p_kind='street' then
    select s.active and p.active into ok from public.streets s join public.neighborhoods n on n.id=s.neighborhood_id join public.municipalities m on m.id=n.municipality_id join public.provinces p on p.id=m.province_id where s.id=p_territory_id;
  elsif p_kind='neighborhood' then
    select p.active into ok from public.neighborhoods n join public.municipalities m on m.id=n.municipality_id join public.provinces p on p.id=m.province_id where n.id=p_territory_id;
  elsif p_kind='municipality' then
    select p.active into ok from public.municipalities m join public.provinces p on p.id=m.province_id where m.id=p_territory_id;
  elsif p_kind='province' then
    select p.active into ok from public.provinces p where p.id=p_territory_id;
  else return false;
  end if;
  return coalesce(ok,false);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.search_classified_by_location(p_province_id uuid DEFAULT NULL::uuid, p_municipality_id uuid DEFAULT NULL::uuid, p_neighborhood_id uuid DEFAULT NULL::uuid, p_listing_type text DEFAULT NULL::text, p_purpose text DEFAULT NULL::text, p_limit integer DEFAULT 30)
 RETURNS SETOF classified_listings
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
 select l.*
 from public.classified_listings l
 join public.addresses a on a.id=l.address_id
 join public.streets s on s.id=a.street_id
 join public.neighborhoods n on n.id=s.neighborhood_id
 join public.municipalities m on m.id=n.municipality_id
 where l.status='published'
 and (p_province_id is null or m.province_id=p_province_id)
 and (p_municipality_id is null or n.municipality_id=p_municipality_id)
 and (p_neighborhood_id is null or s.neighborhood_id=p_neighborhood_id)
 and (p_listing_type is null or l.listing_type=p_listing_type)
 and (p_purpose is null or l.purpose=p_purpose)
 order by l.featured desc,l.created_at desc
 limit greatest(1,least(p_limit,100));
$function$
;

CREATE OR REPLACE FUNCTION public.search_classified_listings(p_listing_type text DEFAULT NULL::text, p_purpose text DEFAULT NULL::text, p_category_id uuid DEFAULT NULL::uuid, p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric, p_query text DEFAULT ''::text, p_attributes jsonb DEFAULT '{}'::jsonb, p_limit integer DEFAULT 30)
 RETURNS SETOF classified_listings
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
 select *
 from public.classified_listings l
 where l.status='published'
 and (p_listing_type is null or l.listing_type=p_listing_type)
 and (p_purpose is null or l.purpose=p_purpose)
 and (p_category_id is null or l.category_id=p_category_id)
 and (p_min_price is null or l.price>=p_min_price)
 and (p_max_price is null or l.price<=p_max_price)
 and (p_query='' or lower(l.title) like '%'||lower(p_query)||'%' or lower(coalesce(l.description,'')) like '%'||lower(p_query)||'%')
 and (p_attributes='{}'::jsonb or l.attributes @> p_attributes)
 order by l.featured desc,l.created_at desc
 limit greatest(1,least(p_limit,100));
$function$
;

CREATE OR REPLACE FUNCTION public.search_classified_listings_v2(p_listing_type text DEFAULT NULL::text, p_purpose text DEFAULT NULL::text, p_category_id uuid DEFAULT NULL::uuid, p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric, p_query text DEFAULT ''::text, p_attributes jsonb DEFAULT '{}'::jsonb, p_limit integer DEFAULT 30, p_sale_mode text DEFAULT NULL::text)
 RETURNS SETOF classified_listings
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select * from public.classified_listings l
  where l.status = 'published'
    and (p_listing_type is null or l.listing_type = p_listing_type)
    and (p_purpose is null or l.purpose = p_purpose)
    and (p_category_id is null or l.category_id = p_category_id)
    and (p_min_price is null or l.price >= p_min_price)
    and (p_max_price is null or l.price <= p_max_price)
    and (coalesce(p_query, '') = '' or public.fold_text(concat_ws(' ', l.title, l.description, l.trade_wants)) like '%' || public.fold_text(trim(p_query)) || '%')
    and (coalesce(p_attributes, '{}'::jsonb) = '{}'::jsonb or l.attributes @> p_attributes)
    and (p_sale_mode is null or l.purpose <> 'wanted' and case p_sale_mode
          when 'trade' then l.sale_mode = 'trade' or l.accepts_trade
          when 'auction' then l.purpose = 'auction' or l.sale_mode = 'auction'
          when 'negotiable' then l.purpose <> 'auction' and coalesce(l.sale_mode, 'negotiable') = 'negotiable'
          else l.purpose <> 'auction' and l.sale_mode = p_sale_mode end)
  order by l.featured desc, l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$function$
;

CREATE OR REPLACE FUNCTION public.search_huambo_online(p_query text DEFAULT ''::text, p_limit integer DEFAULT 30)
 RETURNS TABLE(entity_type text, entity_id uuid, title text, description text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with q as (select lower(trim(coalesce(p_query,''))) as term),
  results as (
    select 'business'::text as entity_type,b.id as entity_id,b.name as title,coalesce(b.description,'') as description
    from public.businesses b,q where b.active and (q.term='' or lower(b.name) like '%'||q.term||'%' or lower(coalesce(b.description,'')) like '%'||q.term||'%')
    union all
    select 'product',p.id,p.name,coalesce(p.description,'')
    from public.products p,q where p.active and (q.term='' or lower(p.name) like '%'||q.term||'%' or lower(coalesce(p.description,'')) like '%'||q.term||'%')
    union all
    select 'service',s.id,s.title,coalesce(s.description,'')
    from public.services s,q where s.active and (q.term='' or lower(s.title) like '%'||q.term||'%' or lower(coalesce(s.description,'')) like '%'||q.term||'%')
  )
  select entity_type,entity_id,title,description from results order by title limit greatest(1,least(p_limit,100));
$function$
;

CREATE OR REPLACE FUNCTION public.search_huambo_online(p_query text DEFAULT ''::text, p_limit integer DEFAULT 30, p_entity_type text DEFAULT NULL::text, p_category_id uuid DEFAULT NULL::uuid, p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric)
 RETURNS TABLE(entity_type text, entity_id uuid, title text, description text, price numeric, category_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with results as (
    select 'business'::text entity_type,b.id entity_id,b.name title,coalesce(b.description,'') description,null::numeric price,b.category_id
    from public.businesses b
    where b.active
      and (p_entity_type is null or p_entity_type='business')
      and (p_category_id is null or b.category_id=p_category_id)
      and (p_query='' or lower(b.name) like '%'||lower(p_query)||'%' or lower(coalesce(b.description,'')) like '%'||lower(p_query)||'%')
    union all
    select 'product',p.id,p.name,coalesce(p.description,''),p.price,p.category_id
    from public.products p
    where p.active
      and (p_entity_type is null or p_entity_type='product')
      and (p_category_id is null or p.category_id=p_category_id)
      and (p_min_price is null or p.price>=p_min_price)
      and (p_max_price is null or p.price<=p_max_price)
      and (p_query='' or lower(p.name) like '%'||lower(p_query)||'%' or lower(coalesce(p.description,'')) like '%'||lower(p_query)||'%')
    union all
    select 'service',s.id,s.title,coalesce(s.description,''),s.price_from,s.category_id
    from public.services s
    where s.active
      and (p_entity_type is null or p_entity_type='service')
      and (p_category_id is null or s.category_id=p_category_id)
      and (p_min_price is null or coalesce(s.price_from,0)>=p_min_price)
      and (p_max_price is null or coalesce(s.price_from,0)<=p_max_price)
      and (p_query='' or lower(s.title) like '%'||lower(p_query)||'%' or lower(coalesce(s.description,'')) like '%'||lower(p_query)||'%')
  )
  select * from results order by title limit greatest(1,least(p_limit,100));
$function$
;

CREATE OR REPLACE FUNCTION public.search_trades(p_query text DEFAULT ''::text, p_only_trade boolean DEFAULT false, p_limit integer DEFAULT 40)
 RETURNS SETOF classified_listings
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select l.* from public.classified_listings l
  where l.status = 'published' and l.purpose <> 'wanted'
    and (l.sale_mode = 'trade' or (not coalesce(p_only_trade, false) and l.accepts_trade))
    and (coalesce(p_query, '') = '' or public.fold_text(concat_ws(' ', l.title, l.description, l.trade_wants)) like '%' || public.fold_text(trim(p_query)) || '%')
  order by l.featured desc, (l.sale_mode = 'trade') desc, l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$function$
;
CREATE OR REPLACE FUNCTION public.seller_cancel_bid(p_bid_id uuid, p_reason text)
 RETURNS auctions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions; b public.auction_bids; txt text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into b from public.auction_bids where id = p_bid_id;
  if not found then raise exception 'BID_NOT_FOUND'; end if;
  select * into a from public.auctions where id = b.auction_id for update;
  if a.seller_id is distinct from auth.uid() and not public.has_admin_role() then raise exception 'NOT_AUCTION_SELLER'; end if;
  if a.status <> 'live' or now() >= a.ends_at then raise exception 'AUCTION_NOT_LIVE'; end if;
  if b.retracted_at is not null then raise exception 'INVALID_TRANSITION'; end if;
  if txt is null then raise exception 'REASON_REQUIRED'; end if;
  a := public.auction_drop_bidder(a, b.bidder_id, auth.uid(), txt);
  insert into public.notifications(user_id, type, title, body, data)
  values (b.bidder_id, 'bid', 'Os seus lances foram cancelados', '«' || a.title || '»: ' || txt,
          jsonb_build_object('auction_id', a.id, 'listing_id', a.classified_listing_id));
  if public.has_admin_role() and a.seller_id is distinct from auth.uid() then
    insert into public.admin_audit_log(actor_id, action, target_type, target_id, details)
    values (auth.uid(), 'bid_cancelled', 'auction', a.id, jsonb_build_object('bidder_id', b.bidder_id, 'reason', txt));
  end if;
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.seller_delivery_policy(p_seller_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when s.seller_id is null then null else jsonb_build_object(
    'pickup_enabled', s.pickup_enabled, 'pickup_place', s.pickup_place, 'delivery_enabled', s.delivery_enabled, 'default_fee', s.default_fee,
    'free_over', s.free_over, 'min_order', s.min_order, 'delivery_days', s.delivery_days, 'note', s.note,
    'zones', (select coalesce(jsonb_agg(jsonb_build_object('municipality_id', z.municipality_id, 'municipality_name', m.name, 'fee', z.fee) order by m.name), '[]')
      from public.seller_delivery_zones z join public.municipalities m on m.id = z.municipality_id where z.seller_id = s.seller_id)) end
  from (select 1) one left join public.seller_delivery_settings s on s.seller_id = p_seller_id
$function$
;

CREATE OR REPLACE FUNCTION public.seller_delivery_quote(p_seller_id uuid, p_municipality_id uuid DEFAULT NULL::uuid, p_subtotal numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.seller_delivery_settings; zfee numeric; fee numeric; sub numeric := greatest(coalesce(p_subtotal, 0), 0); reason text;
begin
  select * into s from public.seller_delivery_settings where seller_id = p_seller_id;
  if not found then
    return jsonb_build_object('configured', false, 'pickup', true, 'delivery', true, 'fee', 0, 'free', false, 'reason', null);
  end if;
  if p_municipality_id is not null then select z.fee into zfee from public.seller_delivery_zones z where z.seller_id = s.seller_id and z.municipality_id = p_municipality_id; end if;
  fee := coalesce(zfee, s.default_fee);
  reason := case
    when not s.delivery_enabled then 'no_delivery'
    when s.min_order is not null and sub < s.min_order then 'min_order'
    when p_municipality_id is null then 'needs_area'
    when fee is null then 'area' end;
  if reason is null and s.free_over is not null and sub >= s.free_over then fee := 0; end if;
  return jsonb_build_object('configured', true, 'pickup', s.pickup_enabled, 'pickup_place', s.pickup_place,
    'delivery', reason is null, 'fee', case when reason is null then fee end, 'free', reason is null and fee = 0,
    'reason', reason, 'min_order', s.min_order, 'free_over', s.free_over,
    'missing_for_free', case when s.delivery_enabled and s.free_over is not null and sub < s.free_over then s.free_over - sub end,
    'delivery_days', s.delivery_days, 'note', s.note);
end $function$
;

CREATE OR REPLACE FUNCTION public.seller_whatsapp(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.whatsapp from public.profiles p
  where auth.uid() is not null and p.id = p_user_id and p.whatsapp_public and p.status = 'active';
$function$
;

CREATE OR REPLACE FUNCTION public.service_request_owner(r service_requests)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(r.provider_id, (select b.owner_id from public.businesses b where b.id = r.business_id));
$function$
;

CREATE OR REPLACE FUNCTION public.service_request_paid_up()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.subject_paid_up(new.provider_id, new.business_id) then raise exception 'PROFILE_UNAVAILABLE'; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_auction_buy_now(p_auction_id uuid, p_price numeric)
 RETURNS auctions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.auctions;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
  if a.seller_id <> auth.uid() then raise exception 'NOT_AUCTION_SELLER'; end if;
  if a.status not in ('live', 'scheduled') or now() >= a.ends_at then raise exception 'AUCTION_NOT_LIVE'; end if;
  if exists (select 1 from public.auction_max_bids where auction_id = a.id and retracted_at is null) then raise exception 'AUCTION_HAS_BIDS'; end if;
  if p_price is not null and (p_price <= a.starting_price or p_price < coalesce(a.reserve_price, 0)) then raise exception 'INVALID_BUY_NOW_PRICE'; end if;
  update public.auctions set buy_now_price = p_price, updated_at = now() where id = a.id returning * into a;
  return a;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_courier_available(p_available boolean)
 RETURNS couriers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.couriers;
begin
  update public.couriers set available = p_available, updated_at = now() where user_id = auth.uid() returning * into c;
  if not found then raise exception 'NOT_COURIER'; end if;
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_dispute_refund_account(p_dispute_id uuid, p_account text)
 RETURNS order_disputes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.order_disputes; dest text := public.clean_refund_destination(p_account);
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into d from public.order_disputes where id = p_dispute_id for update;
  if not found or d.buyer_id <> auth.uid() then raise exception 'DISPUTE_NOT_FOUND'; end if;
  if d.status = 'resolved' then raise exception 'DISPUTE_CLOSED'; end if;
  if dest is null then raise exception 'INVALID_REFUND_ACCOUNT'; end if;
  update public.order_disputes set refund_to = dest where id = d.id returning * into d;
  perform public.dispute_log(d, 'buyer', 'comment', 'Devolver o dinheiro para: ' || dest);
  return d;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_listing_agent(p_listing_id uuid, p_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; a public.field_agents; c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into l from public.classified_listings where id = p_listing_id for update;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.owner_id <> auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if c = '' and l.agent_id is null then return null; end if;
  if l.agent_id is not null and exists (select 1 from public.field_agents x where x.user_id = l.agent_id and x.code = c) then return l.agent_id; end if;
  if l.status = 'sold' or exists (select 1 from public.agent_commissions where listing_id = l.id and status <> 'cancelled') then raise exception 'AGENT_LOCKED'; end if;
  if c = '' then a := null;
  else
    select * into a from public.field_agents where code = c and status = 'active';
    if not found then raise exception 'AGENT_NOT_FOUND'; end if;
    if a.user_id = auth.uid() then raise exception 'CANNOT_BE_OWN_AGENT'; end if;
  end if;
  perform set_config('huambo.allow_agent', 'on', true);
  update public.classified_listings set agent_id = a.user_id where id = l.id;
  perform set_config('huambo.allow_agent', '', true);
  return a.user_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_listing_deal(p_listing_id uuid, p_status text, p_counterpart uuid)
 RETURNS classified_listings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings;
begin
  if p_status not in ('sold', 'rented', 'closed') then raise exception 'INVALID_FINAL_STATUS'; end if;
  select * into l from public.classified_listings where id = p_listing_id for update;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.owner_id <> auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if l.deal_with is not null then raise exception 'DEAL_ALREADY_SET'; end if;
  if not exists (select 1 from public.listing_deal_candidates(p_listing_id) c where c.user_id = p_counterpart) then raise exception 'NOT_A_DEAL_PARTNER'; end if;
  update public.classified_listings set status = p_status, deal_with = p_counterpart, deal_at = now(), updated_at = now()
   where id = l.id returning * into l;
  insert into public.notifications(user_id, type, title, body, data)
  values (p_counterpart, 'system', 'Negócio concluído — avalie', 'Concluiu um negócio: «' || l.title || '». Deixe a sua avaliação.',
          jsonb_build_object('listing_id', l.id, 'for', 'review'));
  return l;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_listing_deal_v2(p_listing_id uuid, p_status text, p_counterpart uuid, p_sale_amount numeric DEFAULT NULL::numeric)
 RETURNS classified_listings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings;
begin
  if p_sale_amount is not null and p_sale_amount < 0 then raise exception 'INVALID_AMOUNT'; end if;
  select * into l from public.classified_listings where id = p_listing_id;
  if not found then raise exception 'LISTING_NOT_FOUND'; end if;
  if l.owner_id <> auth.uid() then raise exception 'NOT_LISTING_OWNER'; end if;
  if p_status in ('sold', 'rented') then update public.classified_listings set sale_amount = p_sale_amount where id = l.id; end if;
  return public.set_listing_deal(p_listing_id, p_status, p_counterpart);
end $function$
;

CREATE OR REPLACE FUNCTION public.set_my_whatsapp(p_number text, p_public boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(coalesce(p_number, '')), '') is null then
    update public.profiles set whatsapp = null, whatsapp_public = false where id = auth.uid();
    return jsonb_build_object('whatsapp', null, 'whatsapp_public', false);
  end if;
  n := public.normalize_whatsapp(p_number);
  if n is null then raise exception 'INVALID_WHATSAPP'; end if;
  update public.profiles set whatsapp = n, whatsapp_public = coalesce(p_public, false) where id = auth.uid();
  return jsonb_build_object('whatsapp', n, 'whatsapp_public', coalesce(p_public, false));
end $function$
;

CREATE OR REPLACE FUNCTION public.set_order_delivery_point(p_order_id uuid, p_lat numeric, p_lng numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.buyer_id <> auth.uid() then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status in ('completed', 'cancelled') or o.fulfillment_status = 'delivered' then raise exception 'ORDER_CLOSED'; end if;
  if (p_lat is null) <> (p_lng is null) or (p_lat is not null and not (p_lat between -18.1 and -4.3 and p_lng between 11.6 and 24.2)) then
    raise exception 'INVALID_LOCATION';
  end if;
  update public.orders set delivery_lat = round(p_lat, 6), delivery_lng = round(p_lng, 6), updated_at = now() where id = o.id;
end $function$
;

CREATE OR REPLACE FUNCTION public.start_classified_conversation(p_listing_id uuid, p_message text)
 RETURNS conversations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare l public.classified_listings; c public.conversations;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(p_message), '') is null then raise exception 'MESSAGE_REQUIRED'; end if;
  select * into l from public.classified_listings where id = p_listing_id and status = 'published';
  if not found then raise exception 'LISTING_NOT_FOUND_OR_NOT_PUBLISHED'; end if;
  if l.owner_id = auth.uid() then raise exception 'CANNOT_CONTACT_SELF'; end if;
  select * into c from public.conversations
   where classified_listing_id = p_listing_id and created_by = auth.uid()
   order by created_at limit 1;
  if not found then
    insert into public.conversations(created_by, subject, context_type, classified_listing_id)
    values (auth.uid(), l.title, 'classified', p_listing_id) returning * into c;
  end if;
  insert into public.conversation_participants(conversation_id, user_id)
  values (c.id, auth.uid()), (c.id, l.owner_id) on conflict do nothing;
  insert into public.messages(conversation_id, sender_id, body) values (c.id, auth.uid(), trim(p_message));
  update public.conversation_participants set last_read_at = now() where conversation_id = c.id and user_id = auth.uid();
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.start_directory_conversation(p_provider_id uuid, p_business_id uuid, p_message text)
 RETURNS conversations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.conversations; owner uuid; subj text; ctx text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(p_message), '') is null then raise exception 'MESSAGE_REQUIRED'; end if;
  if (p_provider_id is null) = (p_business_id is null) then raise exception 'CONTACT_TARGET_REQUIRED'; end if;
  if p_provider_id is not null then
    select user_id, display_name into owner, subj from public.provider_profiles where user_id = p_provider_id and active;
    ctx := 'provider';
  else
    select owner_id, name into owner, subj from public.businesses where id = p_business_id and active;
    ctx := 'business';
  end if;
  if owner is null then raise exception 'NOT_FOUND'; end if;
  if owner = auth.uid() then raise exception 'CANNOT_CONTACT_SELF'; end if;
  select * into c from public.conversations
   where created_by = auth.uid() and context_type = ctx
     and provider_id is not distinct from p_provider_id and business_id is not distinct from p_business_id
   order by created_at limit 1;
  if not found then
    insert into public.conversations(created_by, subject, context_type, provider_id, business_id)
    values (auth.uid(), subj, ctx, p_provider_id, p_business_id) returning * into c;
  end if;
  insert into public.conversation_participants(conversation_id, user_id) values (c.id, auth.uid()), (c.id, owner) on conflict do nothing;
  insert into public.messages(conversation_id, sender_id, body) values (c.id, auth.uid(), trim(p_message));
  update public.conversation_participants set last_read_at = now() where conversation_id = c.id and user_id = auth.uid();
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.store_paid_up(p_seller uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select public.subscription_active_until(s) > now() from public.subscriptions s where s.seller_id = p_seller limit 1), true);
$function$
;

CREATE OR REPLACE FUNCTION public.store_subscription_start()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_days integer := coalesce((select trial_days from public.platform_settings where id = 1), 30);
begin
  if new.business_id is null then
    insert into public.subscriptions(kind, owner_id, seller_id, trial_ends_at) values ('store', new.seller_id, new.seller_id, now() + make_interval(days => v_days))
    on conflict do nothing;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.subject_paid_up(p_provider uuid, p_business uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select public.subscription_active_until(s) > now() from public.subscriptions s
                   where (p_provider is not null and s.provider_id = p_provider) or (p_business is not null and s.business_id = p_business) limit 1), true);
$function$
;

CREATE OR REPLACE FUNCTION public.submit_commission_payment(p_ids uuid[], p_method text, p_reference text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ref text := nullif(left(trim(coalesce(p_reference, '')), 120), ''); n integer; total numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if ref is null and p_proof_path is null then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_DOCUMENT'; end if;
  update public.listing_commissions set status = 'submitted', method = p_method, reference = ref, proof_path = p_proof_path, submitted_at = now(), admin_note = null
   where id = any(coalesce(p_ids, '{}')) and owner_id = auth.uid() and status = 'due';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'NOTHING_TO_PAY'; end if;
  select sum(amount) into total from public.listing_commissions where id = any(p_ids) and owner_id = auth.uid() and status = 'submitted';
  perform public.notify_staff('Pagamento de comissões para confirmar', total || ' Kz · ' || n || ' venda(s)', jsonb_build_object('commission_ids', to_jsonb(p_ids), 'payment_id', p_ids[1]));
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_deal_review(p_kind text, p_ref uuid, p_rating integer, p_comment text DEFAULT NULL::text)
 RETURNS user_reviews
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; l public.classified_listings; target uuid; r_role text; rv public.user_reviews;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'INVALID_RATING'; end if;
  if p_kind = 'order' then
    select * into o from public.orders where id = p_ref;
    if not found or o.status <> 'completed' then raise exception 'DEAL_NOT_COMPLETED'; end if;
    if auth.uid() = o.buyer_id then target := o.seller_id; r_role := 'seller';
    elsif auth.uid() = o.seller_id then target := o.buyer_id; r_role := 'buyer';
    else raise exception 'NOT_DEAL_PARTY'; end if;
  elsif p_kind = 'listing' then
    select * into l from public.classified_listings where id = p_ref;
    if not found or l.deal_with is null or l.status not in ('sold', 'rented', 'closed') then raise exception 'DEAL_NOT_COMPLETED'; end if;
    if auth.uid() = l.owner_id then target := l.deal_with; r_role := case when l.purpose = 'wanted' then 'seller' else 'buyer' end;
    elsif auth.uid() = l.deal_with then target := l.owner_id; r_role := case when l.purpose = 'wanted' then 'buyer' else 'seller' end;
    else raise exception 'NOT_DEAL_PARTY'; end if;
  else raise exception 'INVALID_KIND'; end if;

  select * into rv from public.user_reviews where author_id = auth.uid()
    and ((p_kind = 'order' and order_id = p_ref) or (p_kind = 'listing' and listing_id = p_ref));
  if found then
    update public.user_reviews set rating = p_rating, comment = nullif(trim(coalesce(p_comment, '')), ''), created_at = now()
     where id = rv.id returning * into rv;
  else
    insert into public.user_reviews(author_id, target_id, role, rating, comment, order_id, listing_id)
    values (auth.uid(), target, r_role, p_rating, nullif(trim(coalesce(p_comment, '')), ''),
            case when p_kind = 'order' then p_ref end, case when p_kind = 'listing' then p_ref end)
    returning * into rv;
    insert into public.notifications(user_id, type, title, body, data)
    values (target, 'review', 'Recebeu uma avaliação', p_rating || ' estrela(s) como ' || case r_role when 'seller' then 'vendedor' else 'comprador' end
            || coalesce(': ' || left(nullif(trim(coalesce(p_comment, '')), ''), 140), ''), jsonb_build_object('for', 'profile', 'user_id', target));
  end if;
  return rv;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_event_platform_payment(p_event_id uuid, p_kind text, p_method text, p_reference text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS event_platform_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e public.events; st public.platform_settings; p public.event_platform_payments; amt numeric;
begin
  select * into e from public.events where id = p_event_id;
  if not found or e.organizer_id <> auth.uid() then raise exception 'NOT_EVENT_ORGANIZER'; end if;
  if p_kind not in ('fee', 'boost') or p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if nullif(trim(coalesce(p_reference, '')), '') is null and p_proof_path is null then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_PROOF'; end if;
  select * into st from public.platform_settings where id = 1;
  if p_kind = 'fee' then
    amt := public.event_fee_due(e.id);
    if amt <= 0 then raise exception 'NOTHING_TO_PAY'; end if;
  else
    if e.status <> 'published' or e.starts_at < now() then raise exception 'EVENT_NOT_ON_SALE'; end if;
    amt := st.event_boost_price_kz;
  end if;
  insert into public.event_platform_payments(event_id, organizer_id, kind, amount, days, method, reference, proof_path)
  values (e.id, e.organizer_id, p_kind, amt, case when p_kind = 'boost' then st.event_boost_days end, p_method, nullif(left(trim(coalesce(p_reference, '')), 120), ''), p_proof_path)
  returning * into p;
  perform public.notify_staff(case when p_kind = 'fee' then 'Comissão de evento paga' else 'Pedido de destaque de evento' end,
    'E-' || e.ref_no || ' · ' || amt || ' Kz · «' || left(e.title, 80) || '»', jsonb_build_object('event_payment_id', p.id));
  return p;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_event_ticket_payment(p_order_id uuid, p_method text, p_reference text)
 RETURNS event_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.event_orders; e public.events;
begin
  select * into o from public.event_orders where id = p_order_id for update;
  if not found or o.buyer_id <> auth.uid() then raise exception 'TICKET_ORDER_NOT_FOUND'; end if;
  if o.status not in ('reserved', 'rejected') then raise exception 'INVALID_TRANSITION'; end if;
  if o.status = 'reserved' and o.pay_by < now() then raise exception 'TICKET_RESERVATION_EXPIRED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if char_length(trim(coalesce(p_reference, ''))) < 3 then raise exception 'REFERENCE_REQUIRED'; end if;
  if o.status = 'rejected' and o.quantity > (select quantity from public.event_ticket_types where id = o.ticket_type_id) - public.ticket_type_taken(o.ticket_type_id) then raise exception 'NOT_ENOUGH_TICKETS'; end if;
  update public.event_orders set status = 'submitted', method = p_method, reference = left(trim(p_reference), 120), submitted_at = now() where id = o.id returning * into o;
  select * into e from public.events where id = o.event_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (e.organizer_id, 'system', 'Pagamento de bilhetes para confirmar', 'B-' || o.ref_no || ' · ' || o.total || ' Kz · ref. ' || o.reference || ' · «' || left(e.title, 80) || '».',
    jsonb_build_object('for', 'event_orders', 'event_id', e.id));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_fuel_fee_payment(p_station_id uuid, p_method text, p_reference text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS fuel_platform_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.fuel_stations; p public.fuel_platform_payments; amt numeric;
begin
  select * into s from public.fuel_stations where id = p_station_id;
  if not found or s.owner_id <> auth.uid() then raise exception 'NOT_STATION_OWNER'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if nullif(trim(coalesce(p_reference, '')), '') is null and p_proof_path is null then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_PROOF'; end if;
  amt := public.fuel_fee_due(s.id);
  if amt <= 0 then raise exception 'NOTHING_TO_PAY'; end if;
  insert into public.fuel_platform_payments(station_id, owner_id, amount, method, reference, proof_path)
  values (s.id, s.owner_id, amt, p_method, nullif(left(trim(coalesce(p_reference, '')), 120), ''), p_proof_path) returning * into p;
  perform public.notify_staff('Comissão de combustível paga', 'S-' || s.ref_no || ' · ' || amt || ' Kz · ' || left(s.name, 80), jsonb_build_object('fuel_payment_id', p.id));
  return p;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_fuel_payment(p_order_id uuid, p_method text, p_reference text)
 RETURNS fuel_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin raise exception 'FUEL_PROOF_REQUIRED'; end $function$
;

CREATE OR REPLACE FUNCTION public.submit_fuel_payment_v2(p_order_id uuid, p_method text, p_reference text, p_proof_path text, p_proof_hash text DEFAULT NULL::text)
 RETURNS fuel_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.fuel_orders; s public.fuel_stations; me uuid := auth.uid();
  ref_n text := upper(regexp_replace(coalesce(p_reference, ''), '[^A-Za-z0-9]', '', 'g'));
  h text := nullif(lower(regexp_replace(coalesce(p_proof_hash, ''), '[^A-Fa-f0-9]', '', 'g')), '');
begin
  select * into o from public.fuel_orders where id = p_order_id for update;
  if not found or o.buyer_id <> me then raise exception 'FUEL_ORDER_NOT_FOUND'; end if;
  if o.status not in ('awaiting_payment', 'rejected') or o.method <> 'prepaid' then raise exception 'INVALID_TRANSITION'; end if;
  if o.status = 'awaiting_payment' and o.pay_by < now() then raise exception 'FUEL_ORDER_EXPIRED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express') then raise exception 'INVALID_METHOD'; end if;
  if char_length(ref_n) < 4 then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is null or p_proof_path not like me::text || '/%' then raise exception 'FUEL_PROOF_REQUIRED'; end if;
  if exists (select 1 from public.fuel_orders x where x.id <> o.id and x.reference_norm = ref_n) then raise exception 'FUEL_REFERENCE_USED'; end if;
  if h is not null and exists (select 1 from public.fuel_orders x where x.id <> o.id and x.proof_hash = h) then raise exception 'FUEL_PROOF_USED'; end if;
  update public.fuel_orders set status = 'submitted', pay_method = p_method, reference = left(trim(p_reference), 120), reference_norm = ref_n,
    proof_path = p_proof_path, proof_hash = h, code = coalesce(code, public.new_fuel_code()), note = null, updated_at = now()
    where id = o.id returning * into o;
  select * into s from public.fuel_stations where id = o.station_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (s.owner_id, 'system', '⛽ Pagamento com comprovativo para confirmar', 'C-' || o.ref_no || ' · ' || o.total || ' Kz · ref. ' || o.reference || ' · confirme na sua conta bancária.',
    jsonb_build_object('for', 'fuel_station', 'station_id', s.id));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_inspection_payment(p_id uuid, p_method text, p_reference text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS inspections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare i public.inspections; me uuid := auth.uid(); ref text := nullif(left(trim(coalesce(p_reference, '')), 120), '');
begin
  select * into i from public.inspections where id = p_id for update;
  if not found or i.owner_id <> me then raise exception 'INSPECTION_NOT_FOUND'; end if;
  if i.status <> 'awaiting_payment' then raise exception 'INVALID_TRANSITION'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if ref is null and p_proof_path is null then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is not null and p_proof_path not like me::text || '/%' then raise exception 'INVALID_PROOF'; end if;
  update public.inspections set status = 'payment_submitted', pay_method = p_method, pay_reference = ref, pay_proof_path = p_proof_path,
    pay_submitted_at = now(), admin_note = null, updated_at = now() where id = i.id returning * into i;
  perform public.notify_staff('🏅 Taxa de inspeção para confirmar', 'I-' || i.ref_no || ' · ' || i.fee_amount || ' Kz · ' || coalesce(public.inspection_target_name(i.kind, i.target_id), ''),
    jsonb_build_object('inspection_id', i.id));
  return i;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_order_payment(p_order_id uuid, p_method text, p_reference text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS order_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; pay public.order_payments; ref text := nullif(left(trim(coalesce(p_reference, '')), 120), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.buyer_id <> auth.uid() then raise exception 'ORDER_NOT_FOUND'; end if;
  if not o.protected or o.escrow_status <> 'awaiting_payment' or o.status = 'cancelled' then raise exception 'PAYMENT_NOT_EXPECTED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if ref is null and p_proof_path is null then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_DOCUMENT'; end if;
  if exists (select 1 from public.order_payments where order_id = o.id and status = 'pending') then raise exception 'PAYMENT_PENDING'; end if;
  insert into public.order_payments(order_id, buyer_id, amount, provider, method, reference, proof_path)
  values (o.id, auth.uid(), o.total, 'manual', p_method, ref, p_proof_path) returning * into pay;
  perform public.notify_staff('Pagamento protegido para confirmar', o.total || ' Kz · ' || public.order_ref(o),
    jsonb_build_object('payment_id', pay.id, 'order_id', o.id));
  return pay;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_promo_boost(p_post_id uuid, p_method text, p_reference text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS promo_boosts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); p public.promo_posts; st public.platform_settings; b public.promo_boosts;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into p from public.promo_posts where id = p_post_id;
  if not found or p.owner_id <> me then raise exception 'POST_NOT_FOUND'; end if;
  if p.status <> 'published' then raise exception 'POST_HIDDEN'; end if;
  if p.kind = 'live' and p.live_ends_at < now() then raise exception 'LIVE_ENDED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if nullif(trim(coalesce(p_reference, '')), '') is null and p_proof_path is null then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is not null and p_proof_path !~ ('^' || me::text || '/') then raise exception 'INVALID_PROOF'; end if;
  if exists (select 1 from public.promo_boosts where post_id = p.id and status = 'pending') then raise exception 'BOOST_PENDING'; end if;
  select * into st from public.platform_settings where id = 1;
  insert into public.promo_boosts(post_id, owner_id, amount, days, method, reference, proof_path)
  values (p.id, me, st.promo_boost_price_kz, st.promo_boost_days, p_method, nullif(trim(coalesce(p_reference, '')), ''), p_proof_path)
  returning * into b;
  perform public.notify_staff('Destaque de vídeo por confirmar', 'V-' || p.ref_no || ' · ' || st.promo_boost_price_kz || ' Kz', jsonb_build_object('for', 'admin_promo'));
  return b;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_review(p_provider_id uuid, p_business_id uuid, p_rating integer, p_comment text)
 RETURNS reviews
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.reviews; owner uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if (p_provider_id is null) = (p_business_id is null) then raise exception 'REVIEW_TARGET_REQUIRED'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'INVALID_RATING'; end if;
  if p_provider_id is not null then
    if not exists (select 1 from public.provider_profiles where user_id = p_provider_id and active) then raise exception 'PROVIDER_NOT_FOUND'; end if;
    owner := p_provider_id;
  else
    select owner_id into owner from public.businesses where id = p_business_id and active;
    if owner is null then raise exception 'BUSINESS_NOT_FOUND'; end if;
  end if;
  if owner = auth.uid() then raise exception 'CANNOT_REVIEW_SELF'; end if;
  select * into r from public.reviews where author_id = auth.uid()
    and provider_id is not distinct from p_provider_id and business_id is not distinct from p_business_id;
  if found then
    update public.reviews set rating = p_rating, comment = nullif(trim(p_comment), ''), status = 'published', created_at = now()
     where id = r.id returning * into r;
  else
    insert into public.reviews(author_id, provider_id, business_id, rating, comment, status)
    values (auth.uid(), p_provider_id, p_business_id, p_rating, nullif(trim(p_comment), ''), 'published') returning * into r;
    insert into public.notifications(user_id, type, title, body, data)
    values (owner, 'review', 'Nova avaliação', p_rating || ' estrela(s)' || coalesce(': ' || left(trim(p_comment), 140), ''),
            jsonb_build_object('review_id', r.id, 'provider_id', p_provider_id, 'business_id', p_business_id));
  end if;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_subscription_payment(p_subscription_id uuid, p_months integer, p_method text, p_reference text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS subscription_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.subscriptions; pay public.subscription_payments; ref text := nullif(left(trim(coalesce(p_reference, '')), 120), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into s from public.subscriptions where id = p_subscription_id;
  if not found or s.owner_id <> auth.uid() then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  if p_months is null or p_months not between 1 and 12 then raise exception 'INVALID_MONTHS'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if ref is null and p_proof_path is null then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_DOCUMENT'; end if;
  if exists (select 1 from public.subscription_payments where subscription_id = s.id and status = 'pending') then raise exception 'PAYMENT_PENDING'; end if;
  insert into public.subscription_payments(subscription_id, owner_id, months, amount, method, reference, proof_path)
  values (s.id, auth.uid(), p_months, p_months * public.plan_monthly_price(s.kind), p_method, ref, p_proof_path)
  returning * into pay;
  perform public.notify_staff('Pagamento de mensalidade para confirmar', pay.amount || ' Kz · ' || p_months || ' mês(es)', jsonb_build_object('payment_id', pay.id));
  return pay;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_venue_fee_payment(p_venue_id uuid, p_method text, p_reference text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS venue_platform_payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.venues; p public.venue_platform_payments; amt numeric;
begin
  select * into v from public.venues where id = p_venue_id;
  if not found or v.owner_id <> auth.uid() then raise exception 'NOT_VENUE_OWNER'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if nullif(trim(coalesce(p_reference, '')), '') is null and p_proof_path is null then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'INVALID_PROOF'; end if;
  amt := public.venue_fee_due(v.id);
  if amt <= 0 then raise exception 'NOTHING_TO_PAY'; end if;
  insert into public.venue_platform_payments(venue_id, owner_id, amount, method, reference, proof_path)
  values (v.id, v.owner_id, amt, p_method, nullif(left(trim(coalesce(p_reference, '')), 120), ''), p_proof_path) returning * into p;
  perform public.notify_staff('Taxa de reservas paga', 'E-' || v.ref_no || ' · ' || amt || ' Kz', jsonb_build_object('venue_payment_id', p.id));
  return p;
end $function$
;
CREATE OR REPLACE FUNCTION public.submit_venue_payment(p_order_id uuid, p_method text, p_reference text, p_proof_path text, p_proof_hash text DEFAULT NULL::text)
 RETURNS venue_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.venue_orders; v public.venues; me uuid := auth.uid();
  ref_n text := upper(regexp_replace(coalesce(p_reference, ''), '[^A-Za-z0-9]', '', 'g'));
  h text := nullif(lower(regexp_replace(coalesce(p_proof_hash, ''), '[^A-Fa-f0-9]', '', 'g')), '');
begin
  select * into o from public.venue_orders where id = p_order_id for update;
  if not found or o.buyer_id <> me then raise exception 'VENUE_ORDER_NOT_FOUND'; end if;
  if o.status not in ('awaiting_payment', 'rejected') or o.method <> 'prepaid' then raise exception 'INVALID_TRANSITION'; end if;
  if o.status = 'awaiting_payment' and o.pay_by < now() then raise exception 'VENUE_ORDER_EXPIRED'; end if;
  if p_method not in ('bank_transfer', 'multicaixa_express') then raise exception 'INVALID_METHOD'; end if;
  if char_length(ref_n) < 4 then raise exception 'REFERENCE_REQUIRED'; end if;
  if p_proof_path is null or p_proof_path not like me::text || '/%' then raise exception 'VENUE_PROOF_REQUIRED'; end if;
  if exists (select 1 from public.venue_orders x where x.id <> o.id and x.reference_norm = ref_n)
     or exists (select 1 from public.fuel_orders x where x.reference_norm = ref_n) then raise exception 'VENUE_REFERENCE_USED'; end if;
  if h is not null and (exists (select 1 from public.venue_orders x where x.id <> o.id and x.proof_hash = h)
     or exists (select 1 from public.fuel_orders x where x.proof_hash = h)) then raise exception 'VENUE_PROOF_USED'; end if;
  update public.venue_orders set status = 'submitted', pay_method = p_method, reference = left(trim(p_reference), 120), reference_norm = ref_n,
    proof_path = p_proof_path, proof_hash = h, code = coalesce(code, public.new_venue_code()), note = null, updated_at = now()
    where id = o.id returning * into o;
  select * into v from public.venues where id = o.venue_id;
  insert into public.notifications(user_id, type, title, body, data)
  values (v.owner_id, 'system', '💳 Pagamento com comprovativo para confirmar', 'R-' || o.ref_no || ' · ' || o.total || ' Kz · ref. ' || o.reference || ' · confirme na sua conta bancária.',
    jsonb_build_object('for', 'venue', 'venue_id', v.id));
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.subscription_active_until(s subscriptions)
 RETURNS timestamp with time zone
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$ select greatest(s.trial_ends_at, coalesce(s.paid_until, s.trial_ends_at)); $function$
;

CREATE OR REPLACE FUNCTION public.subscription_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s record; c record; tag text; n integer := 0; ends timestamptz; title text; body text; price numeric;
begin
  for s in select x.*, public.subscription_active_until(x) as until, public.plan_subject_name(x) as name
    from public.subscriptions x where public.plan_subject_exists(x) loop
    ends := s.until;
    tag := case when ends <= now() then 'end' when ends <= now() + interval '1 day' then 'd1' when ends <= now() + interval '7 days' then 'd7' end;
    continue when tag is null or s.last_reminder = tag || ':' || ends::date;
    continue when tag = 'end' and ends < now() - interval '3 days';
    price := public.plan_monthly_price(s.kind);
    title := case tag when 'end' then case when s.kind = 'store' then 'Os seus produtos deixaram de aparecer' else 'O seu perfil deixou de aparecer' end
                      when 'd1' then 'O seu plano termina amanhã' else 'O seu plano termina em 7 dias' end;
    body := '«' || s.name || '»: ' || case when tag = 'end' then 'pague a mensalidade de ' || price || ' Kz para voltar a aparecer aos clientes.'
                                          else (case when s.paid_until is null then 'o mês grátis' else 'o período pago' end) || ' termina a ' || to_char(ends at time zone 'Africa/Luanda', 'DD/MM/YYYY') || '. Mensalidade: ' || price || ' Kz.' end;
    insert into public.notifications(user_id, type, title, body, data) values (s.owner_id, 'system', title, body, jsonb_build_object('subscription_id', s.id, 'for', 'plan'));
    update public.subscriptions set last_reminder = tag || ':' || ends::date where id = s.id;
    n := n + 1;
  end loop;
  for c in select * from public.listing_commissions where status = 'due' loop
    tag := case when c.due_at <= now() then 'late' when c.due_at <= now() + interval '2 days' then 'd2' end;
    continue when tag is null or c.last_reminder = tag;
    insert into public.notifications(user_id, type, title, body, data)
    values (c.owner_id, 'system', case tag when 'late' then 'Comissão em atraso' else 'Comissão a pagar em 2 dias' end,
            '«' || c.listing_title || '»: ' || c.amount || ' Kz.' || case when tag = 'late' then ' Enquanto não pagar, não pode publicar anúncios novos.' else '' end,
            jsonb_build_object('listing_id', c.listing_id, 'for', 'commission'));
    update public.listing_commissions set last_reminder = tag where id = c.id;
    n := n + 1;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.subscription_start()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_days integer := coalesce((select trial_days from public.platform_settings where id = 1), 30);
begin
  if tg_table_name = 'provider_profiles' then
    insert into public.subscriptions(kind, owner_id, provider_id, trial_ends_at) values ('provider', new.user_id, new.user_id, now() + make_interval(days => v_days))
    on conflict do nothing;
  else
    insert into public.subscriptions(kind, owner_id, business_id, trial_ends_at) values ('business', new.owner_id, new.id, now() + make_interval(days => v_days))
    on conflict do nothing;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.suggest_market(p_name text, p_municipality_id uuid, p_address text DEFAULT NULL::text, p_description text DEFAULT NULL::text)
 RETURNS markets
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m public.markets;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.current_user_active() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'INVALID_MARKET'; end if;
  if exists (select 1 from public.markets x where lower(trim(x.name)) = lower(trim(p_name))) then raise exception 'MARKET_EXISTS'; end if;
  if (select count(*) from public.markets x where x.suggested_by = auth.uid() and x.status = 'pending') >= 5 then raise exception 'TOO_MANY_SUGGESTIONS'; end if;
  insert into public.markets(name, municipality_id, address_text, description, status, suggested_by)
  values (trim(p_name), p_municipality_id, nullif(trim(coalesce(p_address, '')), ''), nullif(trim(coalesce(p_description, '')), ''), 'pending', auth.uid())
  returning * into m;
  insert into public.notifications(user_id, type, title, body, data)
  select r.user_id, 'system', 'Nova praça sugerida', '«' || m.name || '» está à espera de aprovação.', jsonb_build_object('market_id', m.id, 'for', 'admin')
  from public.user_roles r where r.role in ('admin', 'moderator') limit 20;
  return m;
end $function$
;

CREATE OR REPLACE FUNCTION public.sync_auction_sale_mode()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.purpose = 'auction' and new.sale_mode is distinct from 'auction' then new.sale_mode := 'auction'; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.ticket_by_code(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t public.event_tickets; e public.events; me uuid := auth.uid(); role_ text; tn text; holder text;
  c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if c like 'HO%' then c := substr(c, 3); end if;
  if char_length(c) <> 8 then return jsonb_build_object('result', 'invalid'); end if;
  c := 'HO-' || substr(c, 1, 4) || '-' || substr(c, 5, 4);
  select * into t from public.event_tickets where code = c;
  if not found then return jsonb_build_object('result', 'invalid'); end if;
  select * into e from public.events where id = t.event_id;
  role_ := case when me is not null and e.organizer_id = me then 'organizer' when me is not null and public.has_admin_role() then 'admin'
                when me is not null and t.holder_id = me then 'holder' else 'other' end;
  if role_ = 'other' then
    return jsonb_build_object('result', 'ok', 'role', role_, 'code', c, 'status', t.status, 'event_id', e.id, 'event_title', e.title, 'starts_at', e.starts_at, 'event_status', e.status);
  end if;
  select name into tn from public.event_ticket_types where id = t.ticket_type_id;
  select buyer_name into holder from public.event_orders where id = t.order_id;
  return jsonb_build_object('result', 'ok', 'role', role_, 'code', c, 'status', t.status, 'event_id', e.id, 'event_title', e.title, 'starts_at', e.starts_at,
    'venue', e.venue, 'event_status', e.status, 'type', tn, 'holder', holder, 'checked_in_at', t.checked_in_at);
end $function$
;

CREATE OR REPLACE FUNCTION public.ticket_type_taken(p_type uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(quantity), 0)::int from public.event_orders where ticket_type_id = p_type and status in ('reserved', 'submitted', 'confirmed')
$function$
;

CREATE OR REPLACE FUNCTION public.toggle_block(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); was boolean;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_user_id is null or p_user_id = me then raise exception 'CANNOT_BLOCK_SELF'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'PROFILE_UNAVAILABLE'; end if;
  select active into was from public.user_blocks where blocker_id = me and blocked_id = p_user_id;
  insert into public.user_blocks(blocker_id, blocked_id, active, created_at) values (me, p_user_id, true, now())
  on conflict (blocker_id, blocked_id) do update set active = not coalesce(was, false), created_at = now();
  return not coalesce(was, false);
end $function$
;

CREATE OR REPLACE FUNCTION public.toggle_follow(p_kind text, p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_owner uuid; v_name text; me uuid := auth.uid(); was boolean;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_kind = 'seller' then
    select id, coalesce(nullif(full_name, ''), 'Utilizador') into v_owner, v_name from public.profiles where id = p_id and status = 'active';
  elsif p_kind = 'provider' then
    select user_id, display_name into v_owner, v_name from public.provider_profiles where user_id = p_id and active;
  elsif p_kind = 'business' then
    select owner_id, b.name into v_owner, v_name from public.businesses b where id = p_id and active;
  else raise exception 'INVALID_FOLLOW'; end if;
  if v_owner is null then raise exception 'PROFILE_UNAVAILABLE'; end if;
  if v_owner = me then raise exception 'CANNOT_FOLLOW_SELF'; end if;
  if p_kind = 'seller' then
    delete from public.followed_sellers where user_id = me and seller_id = p_id; was := found;
    if not was then insert into public.followed_sellers(user_id, seller_id) values (me, p_id); end if;
  elsif p_kind = 'provider' then
    delete from public.followed_providers where user_id = me and provider_id = p_id; was := found;
    if not was then insert into public.followed_providers(user_id, provider_id) values (me, p_id); end if;
  else
    delete from public.followed_businesses where user_id = me and business_id = p_id; was := found;
    if not was then insert into public.followed_businesses(user_id, business_id) values (me, p_id); end if;
  end if;
  if not was and not exists (select 1 from public.notifications where user_id = v_owner and data->>'for' = 'new_follower' and created_at > now() - interval '1 day') then
    insert into public.notifications(user_id, type, title, body, data)
    values (v_owner, 'system', 'Tem novos seguidores 👋', 'Há pessoas a seguir «' || v_name || '». Recebem um aviso quando publicar algo novo.',
      jsonb_build_object('for', 'new_follower', 'kind', p_kind, 'id', p_id));
  end if;
  return not was;
end $function$
;

CREATE OR REPLACE FUNCTION public.touch_conversation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.conversations set updated_at=now() where id=new.conversation_id;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_delivery_status(p_delivery_id uuid, p_status text)
 RETURNS delivery_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.delivery_requests; o public.orders; label text; allowed boolean;
begin
  select * into d from public.delivery_requests where id = p_delivery_id for update;
  if not found then raise exception 'DELIVERY_NOT_FOUND'; end if;
  if d.assigned_to is distinct from auth.uid() then raise exception 'NOT_DELIVERY_PARTY'; end if;
  allowed := case p_status
    when 'picked_up' then d.status in ('assigned', 'accepted')
    when 'in_transit' then d.status in ('assigned', 'accepted', 'picked_up')
    when 'delivered' then d.status in ('picked_up', 'in_transit')
    when 'released' then d.status in ('assigned', 'accepted')
    else false end;
  if not allowed then raise exception 'INVALID_DELIVERY_STEP'; end if;
  select * into o from public.orders where id = d.order_id;
  if p_status = 'released' then
    update public.delivery_requests set status = 'pending', assigned_to = null, assigned_at = null where id = d.id returning * into d;
    update public.orders set fulfillment_status = 'pending', updated_at = now() where id = o.id;
    label := 'O estafeta desistiu. A entrega voltou à lista de espera.';
  else
    update public.delivery_requests set status = p_status, delivered_at = case when p_status = 'delivered' then now() else delivered_at end
    where id = d.id returning * into d;
    update public.orders set fulfillment_status = case p_status when 'delivered' then 'delivered' else 'in_transit' end, updated_at = now() where id = o.id;
    label := case p_status when 'picked_up' then 'O estafeta recolheu a encomenda.' when 'in_transit' then 'A encomenda está a caminho.'
      else 'A encomenda foi entregue.' end;
  end if;
  insert into public.notifications(user_id, type, title, body, data)
  select u, 'delivery', 'Entrega atualizada', label, jsonb_build_object('delivery_id', d.id, 'order_id', o.id)
  from unnest(array[o.seller_id, o.buyer_id]) u;
  return d;
end $function$
;

CREATE OR REPLACE FUNCTION public.update_order_status(p_order_id uuid, p_status text, p_paid boolean DEFAULT NULL::boolean)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.orders; is_seller boolean; is_buyer boolean; label text; was_paid boolean; held boolean; d public.order_disputes;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  is_seller := o.seller_id = auth.uid() or public.has_admin_role();
  is_buyer := o.buyer_id = auth.uid();
  if not (is_seller or is_buyer) then raise exception 'NOT_ORDER_PARTY'; end if;
  if p_status not in ('pending','confirmed','processing','ready','completed','cancelled') then raise exception 'INVALID_STATUS'; end if;
  if o.status in ('completed','cancelled') then raise exception 'ORDER_CLOSED'; end if;
  if not is_seller and not (p_status = 'cancelled' and o.status = 'pending') then raise exception 'BUYER_CAN_ONLY_CANCEL_PENDING'; end if;
  was_paid := o.payment_status = 'paid';
  held := o.escrow_status = 'held';
  if p_status = 'cancelled' then
    update public.products p set stock = p.stock + oi.quantity, updated_at = now()
    from public.order_items oi where oi.order_id = o.id and oi.product_id = p.id;
  end if;
  update public.orders set status = p_status,
    fulfillment_status = case p_status when 'completed' then 'delivered' when 'cancelled' then 'cancelled' else fulfillment_status end,
    payment_status = case when is_seller and p_paid is true then 'paid' when p_status = 'completed' and payment_method = 'cash_on_delivery' then 'paid' else payment_status end,
    completed_at = case when p_status = 'completed' then now() else completed_at end,
    updated_at = now()
  where id = o.id returning * into o;
  label := case p_status when 'confirmed' then 'confirmada' when 'processing' then 'em preparação' when 'ready' then 'pronta'
    when 'completed' then case when o.protected then 'entregue' else 'concluída' end when 'cancelled' then 'cancelada' else p_status end;
  insert into public.notifications(user_id, type, title, body, data)
  values (case when auth.uid() = o.buyer_id then o.seller_id else o.buyer_id end, 'order', 'Encomenda ' || label,
          'A encomenda de ' || o.total || ' Kz foi ' || label || '.', jsonb_build_object('order_id', o.id));
  if p_status = 'cancelled' and was_paid and o.total > o.refunded_amount
     and not exists (select 1 from public.order_disputes where order_id = o.id and status <> 'resolved') then
    insert into public.order_disputes(order_id, buyer_id, seller_id, request, reason, description, amount, status)
    values (o.id, o.buyer_id, o.seller_id, 'refund', 'seller_cancelled', 'A encomenda já estava paga e foi cancelada.', o.total - o.refunded_amount, 'awaiting_refund')
    returning * into d;
    perform public.dispute_log(d, 'system', 'auto_refund', case when held
      then 'A encomenda já estava paga e foi cancelada: o Huambo Online vai devolver o dinheiro guardado.'
      else 'A encomenda já estava paga e foi cancelada: o vendedor tem de devolver o dinheiro.' end);
  end if;
  return o;
end $function$
;

CREATE OR REPLACE FUNCTION public.update_service_request(p_id uuid, p_action text, p_note text DEFAULT NULL::text)
 RETURNS service_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.service_requests; owner uuid; next_status text; notify_to uuid; msg text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.service_requests where id = p_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  owner := public.service_request_owner(r);
  if p_action in ('accept', 'decline', 'done') then
    if auth.uid() <> owner then raise exception 'NOT_SERVICE_PROVIDER'; end if;
    if p_action = 'accept' and r.status = 'requested' then next_status := 'accepted'; msg := 'O seu pedido de serviço foi aceite.';
    elsif p_action = 'decline' and r.status in ('requested', 'accepted') then next_status := 'declined'; msg := 'O seu pedido de serviço foi recusado.';
    elsif p_action = 'done' and r.status in ('requested', 'accepted') then next_status := 'done'; msg := 'Serviço concluído: confirme e avalie.';
    else raise exception 'INVALID_TRANSITION'; end if;
    notify_to := r.client_id;
  elsif p_action = 'cancel' then
    if auth.uid() <> r.client_id then raise exception 'NOT_SERVICE_CLIENT'; end if;
    if r.status not in ('requested', 'accepted') then raise exception 'INVALID_TRANSITION'; end if;
    next_status := 'cancelled'; msg := 'O cliente cancelou o pedido de serviço.'; notify_to := owner;
  else raise exception 'INVALID_ACTION'; end if;
  update public.service_requests set status = next_status, updated_at = now(),
    provider_note = case when p_action in ('accept', 'decline', 'done') then coalesce(nullif(left(trim(coalesce(p_note, '')), 500), ''), provider_note) else provider_note end
   where id = r.id returning * into r;
  insert into public.notifications(user_id, type, title, body, data)
  values (notify_to, 'system', 'Pedido de serviço', msg || coalesce(' ' || nullif(left(trim(coalesce(p_note, '')), 140), ''), ''),
          jsonb_build_object('service_request_id', r.id, 'for', 'service'));
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.upsert_notification_preferences(p_enabled boolean, p_saved_search boolean, p_messages boolean, p_rentals boolean, p_auctions boolean, p_marketplace boolean, p_reviews boolean, p_system boolean)
 RETURNS notification_preferences
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.notification_preferences;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.notification_preferences as np(user_id, enabled, saved_search, messages, rentals, auctions, marketplace, reviews, system, updated_at)
  values (auth.uid(), coalesce(p_enabled,true), coalesce(p_saved_search,true), coalesce(p_messages,true), coalesce(p_rentals,true),
          coalesce(p_auctions,true), coalesce(p_marketplace,true), coalesce(p_reviews,true), coalesce(p_system,true), now())
  on conflict (user_id) do update set enabled = excluded.enabled, saved_search = excluded.saved_search, messages = excluded.messages,
    rentals = excluded.rentals, auctions = excluded.auctions, marketplace = excluded.marketplace, reviews = excluded.reviews,
    system = excluded.system, updated_at = now()
  returning * into r;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.user_reviews_for(p_user_id uuid)
 RETURNS TABLE(id uuid, role text, rating smallint, comment text, created_at timestamp with time zone, author_name text, kind text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, r.role, r.rating, r.comment, r.created_at, coalesce(nullif(p.full_name, ''), 'Utilizador'),
         case when r.order_id is not null then 'order' else 'listing' end
  from public.user_reviews r left join public.profiles p on p.id = r.author_id
  where r.target_id = p_user_id and r.status = 'published'
  order by r.created_at desc limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.user_reviews_for_v2(p_user_id uuid)
 RETURNS TABLE(id uuid, role text, rating smallint, comment text, created_at timestamp with time zone, author_name text, kind text, reply text, reply_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, r.role, r.rating, r.comment, r.created_at, coalesce(nullif(p.full_name, ''), 'Utilizador'),
         case when r.order_id is not null then 'order' else 'listing' end, r.reply, r.reply_at
  from public.user_reviews r left join public.profiles p on p.id = r.author_id
  where r.target_id = p_user_id and r.status = 'published'
  order by r.created_at desc limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_classified_attributes(p_listing_type text, p_attributes jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
begin
 if p_attributes is null or jsonb_typeof(p_attributes)<>'object' then return false; end if;
 if p_listing_type='vehicle' then
   if nullif(trim(coalesce(p_attributes->>'brand','')),'') is null then return false; end if;
   if p_attributes ? 'year' and (p_attributes->>'year')::int not between 1900 and extract(year from now())::int+1 then return false; end if;
   if p_attributes ? 'mileage' and (p_attributes->>'mileage')::numeric < 0 then return false; end if;
 end if;
 if p_listing_type='real_estate' then
   if p_attributes ? 'area_m2' and (p_attributes->>'area_m2')::numeric <= 0 then return false; end if;
   if p_attributes ? 'bedrooms' and (p_attributes->>'bedrooms')::int < 0 then return false; end if;
   if p_attributes ? 'bathrooms' and (p_attributes->>'bathrooms')::int < 0 then return false; end if;
 end if;
 return true;
exception when others then return false;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.venue_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.notify_staff('Novo estabelecimento para aprovar', 'E-' || new.ref_no || ' · ' || coalesce((select left(name, 80) from public.businesses where id = new.business_id), ''),
    jsonb_build_object('venue_id', new.id));
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.venue_detail(p_venue_id uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.venues; b public.businesses; me uuid := auth.uid(); st public.platform_settings; d1 date; d2 date;
begin
  select * into v from public.venues where id = p_venue_id;
  if not found or (v.status <> 'approved' and (me is null or (v.owner_id <> me and not public.has_admin_role()))) then return null; end if;
  select * into b from public.businesses where id = v.business_id;
  select * into st from public.platform_settings where id = 1;
  d1 := coalesce(p_from, (now() at time zone 'Africa/Luanda')::date);
  d2 := case when p_to is not null and p_to > d1 then p_to else d1 + 1 end;
  return jsonb_build_object('id', v.id, 'ref_no', v.ref_no, 'kind', v.kind, 'subtype', v.subtype, 'status', v.status, 'owner_id', v.owner_id,
    'accepts_reservations', v.accepts_reservations and not public.venue_fees_overdue(v.id), 'accepts_pay_at_place', v.accepts_pay_at_place,
    'accepts_prepay', v.accepts_prepay and exists (select 1 from public.venue_pay y where y.venue_id = v.id and (y.iban is not null or y.express is not null)),
    'hold_minutes', v.hold_minutes, 'check_in_time', v.check_in_time, 'check_out_time', v.check_out_time, 'opening_hours', v.opening_hours, 'policies', v.policies,
    'client_fee_pct', st.venue_client_fee_pct, 'business_fee_pct', st.venue_business_fee_pct, 'from', d1, 'to', d2,
    'business', jsonb_build_object('id', b.id, 'name', b.name, 'description', b.description, 'logo_url', b.logo_url, 'phone', b.phone, 'whatsapp', b.whatsapp,
      'address_text', b.address_text, 'verified', b.verified, 'directions', b.directions, 'geo_lat', b.geo_lat, 'geo_lng', b.geo_lng,
      'municipality_name', (select name from public.municipalities where id = b.municipality_id)),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'description', i.description, 'section', i.section, 'photos', i.photos,
        'price', i.price, 'unit', i.unit, 'capacity', i.capacity, 'qty_total', i.qty_total, 'min_qty', i.min_qty, 'available', i.available, 'position', i.position,
        'free', case when v.kind = 'hotel' then public.venue_room_free(i.id, d1, d2)::numeric when i.qty_total is null then null else greatest(0, i.qty_total - public.venue_item_reserved(i.id)) end)
        order by i.section nulls first, i.position, i.created_at), '[]') from public.venue_items i where i.venue_id = v.id));
end $function$
;

CREATE OR REPLACE FUNCTION public.venue_fee_due(p_venue uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select greatest(0, coalesce((select sum(client_fee + business_fee) from public.venue_orders where venue_id = p_venue and status = 'completed'), 0)
    - coalesce((select sum(amount) from public.venue_platform_payments where venue_id = p_venue and status = 'confirmed'), 0))
$function$
;

CREATE OR REPLACE FUNCTION public.venue_feed(p_kind text, p_municipality_id uuid DEFAULT NULL::uuid, p_query text DEFAULT ''::text, p_limit integer DEFAULT 40)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(x order by x.has_now desc, x.verified desc, x.created_at desc), '[]') from (
    select v.id, v.ref_no, v.kind, v.subtype, v.accepts_reservations, v.accepts_prepay, v.accepts_pay_at_place, v.opening_hours, v.created_at,
      b.id business_id, b.name, b.description, b.logo_url, b.phone, b.whatsapp, b.address_text, b.verified, b.directions, b.geo_lat, b.geo_lng, m.name municipality_name,
      (select min(i.price) from public.venue_items i where i.venue_id = v.id and i.available) price_from,
      (select i.photos[1] from public.venue_items i where i.venue_id = v.id and cardinality(i.photos) > 0 order by i.position, i.created_at limit 1) photo,
      case when v.kind = 'hotel' then (select coalesce(sum(public.venue_room_free(i.id, (now() at time zone 'Africa/Luanda')::date, (now() at time zone 'Africa/Luanda')::date + 1)), 0)
        from public.venue_items i where i.venue_id = v.id and i.available) end rooms_free,
      exists (select 1 from public.venue_items i where i.venue_id = v.id and i.available
        and (v.kind <> 'hotel' or public.venue_room_free(i.id, (now() at time zone 'Africa/Luanda')::date, (now() at time zone 'Africa/Luanda')::date + 1) > 0)) has_now
    from public.venues v join public.businesses b on b.id = v.business_id left join public.municipalities m on m.id = b.municipality_id
    where v.status = 'approved' and b.active and v.kind = p_kind
      and (p_municipality_id is null or b.municipality_id = p_municipality_id)
      and (coalesce(p_query, '') = '' or lower(b.name || ' ' || coalesce(b.description, '') || ' ' || coalesce(b.address_text, '')) like '%' || lower(trim(p_query)) || '%')
    limit greatest(1, least(coalesce(p_limit, 40), 100))) x
$function$
;

CREATE OR REPLACE FUNCTION public.venue_fees_overdue(p_venue uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select sum(client_fee + business_fee) from public.venue_orders where venue_id = p_venue and status = 'completed' and completed_at < now() - interval '7 days'), 0)
    > coalesce((select sum(amount) from public.venue_platform_payments where venue_id = p_venue and status = 'confirmed'), 0)
$function$
;

CREATE OR REPLACE FUNCTION public.venue_item_reserved(p_item_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(l.qty), 0) from public.venue_order_lines l join public.venue_orders o on o.id = l.order_id
  where l.item_id = p_item_id and o.kind <> 'stay' and public.venue_open_status(o.status)
$function$
;

CREATE OR REPLACE FUNCTION public.venue_kind_label(k text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case k when 'stay' then 'Reserva de quarto' when 'table' then 'Reserva de mesa' else 'Encomenda' end
$function$
;

CREATE OR REPLACE FUNCTION public.venue_open_status(s text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select s in ('reserved', 'awaiting_payment', 'submitted', 'paid')
$function$
;

CREATE OR REPLACE FUNCTION public.venue_order_by_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.venue_orders; v public.venues; bname text; me uuid := auth.uid(); t text := lower(regexp_replace(coalesce(p_token, ''), '[^A-Fa-f0-9]', '', 'g')); role_ text;
begin
  if char_length(t) <> 32 then return jsonb_build_object('result', 'invalid'); end if;
  select * into o from public.venue_orders where qr_token = t;
  if not found then return jsonb_build_object('result', 'invalid'); end if;
  select * into v from public.venues where id = o.venue_id;
  select name into bname from public.businesses where id = v.business_id;
  role_ := case when me is not null and v.owner_id = me then 'venue' when me is not null and public.has_admin_role() then 'admin'
                when me is not null and o.buyer_id = me then 'buyer' else 'other' end;
  if role_ = 'other' then
    return jsonb_build_object('result', 'ok', 'role', role_, 'ref_no', o.ref_no, 'status', o.status, 'kind', o.kind, 'venue_id', v.id, 'venue_name', bname,
      'check_in', o.check_in, 'check_out', o.check_out, 'slot_at', o.slot_at);
  end if;
  return jsonb_build_object('result', 'ok', 'role', role_, 'id', o.id, 'ref_no', o.ref_no, 'status', o.status, 'kind', o.kind, 'method', o.method,
    'buyer_name', o.buyer_name, 'buyer_phone', o.buyer_phone, 'guests', o.guests, 'check_in', o.check_in, 'check_out', o.check_out, 'slot_at', o.slot_at,
    'buyer_note', o.buyer_note, 'subtotal', o.subtotal, 'client_fee_pct', o.client_fee_pct, 'client_fee', o.client_fee, 'business_fee', o.business_fee, 'total', o.total,
    'code', o.code, 'hold_until', o.hold_until, 'pay_method', o.pay_method, 'reference', o.reference, 'proof_path', o.proof_path, 'note', o.note,
    'created_at', o.created_at, 'completed_at', o.completed_at, 'venue_id', v.id, 'venue_name', bname, 'venue_kind', v.kind,
    'lines', (select coalesce(jsonb_agg(jsonb_build_object('name', l.name, 'unit', l.unit, 'qty', l.qty, 'unit_price', l.unit_price, 'line_total', l.line_total)), '[]')
      from public.venue_order_lines l where l.order_id = o.id));
end $function$
;

CREATE OR REPLACE FUNCTION public.venue_panel(p_venue_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.venues; st public.platform_settings;
begin
  select * into v from public.venues where id = p_venue_id;
  if not found or (v.owner_id <> auth.uid() and not public.has_admin_role()) then raise exception 'NOT_VENUE_OWNER'; end if;
  select * into st from public.platform_settings where id = 1;
  return jsonb_build_object(
    'client_fee_pct', st.venue_client_fee_pct, 'business_fee_pct', st.venue_business_fee_pct,
    'completed_total', (select coalesce(sum(total), 0) from public.venue_orders where venue_id = v.id and status = 'completed'),
    'fee_total', (select coalesce(sum(client_fee + business_fee), 0) from public.venue_orders where venue_id = v.id and status = 'completed'),
    'fee_due', public.venue_fee_due(v.id),
    'fee_overdue', public.venue_fees_overdue(v.id),
    'fee_pending', exists (select 1 from public.venue_platform_payments where venue_id = v.id and status = 'pending'),
    'orders', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select o.id, o.ref_no, o.kind, o.status, o.method, o.guests, o.check_in, o.check_out, o.slot_at, o.buyer_note, o.subtotal, o.client_fee, o.business_fee, o.total,
        o.buyer_name, o.buyer_phone, o.code, o.qr_token, o.hold_until, o.pay_by, o.pay_method, o.reference, o.proof_path, o.note, o.created_at, o.completed_at,
        (select coalesce(jsonb_agg(jsonb_build_object('name', l.name, 'unit', l.unit, 'qty', l.qty, 'unit_price', l.unit_price, 'line_total', l.line_total)), '[]')
          from public.venue_order_lines l where l.order_id = o.id) lines
      from public.venue_orders o where o.venue_id = v.id order by o.created_at desc limit 300) x),
    'payments', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select p.id, p.ref_no, p.amount, p.status, p.admin_note, p.created_at from public.venue_platform_payments p where p.venue_id = v.id order by p.created_at desc limit 50) x));
end $function$
;

CREATE OR REPLACE FUNCTION public.venue_room_free(p_item_id uuid, p_from date, p_to date)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select greatest(0, coalesce(floor(i.qty_total)::int, 0) - coalesce((
    select max(n.booked) from (
      select d::date night, sum(l.qty) booked
      from generate_series(p_from, p_to - 1, interval '1 day') d
      join public.venue_order_lines l on l.item_id = i.id
      join public.venue_orders o on o.id = l.order_id
      where o.kind = 'stay' and (public.venue_open_status(o.status) or (o.status = 'completed' and o.check_out > (now() at time zone 'Africa/Luanda')::date))
        and o.check_in <= d::date and o.check_out > d::date
      group by d) n), 0)::int)
  from public.venue_items i where i.id = p_item_id
$function$
;

CREATE OR REPLACE FUNCTION public.venue_tick()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  with x as (update public.venue_orders set status = 'expired', updated_at = now()
    where (status = 'reserved' and hold_until < now()) or (status = 'awaiting_payment' and pay_by < now()) returning 1)
  select count(*) into n from x;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.video_path(p_url text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select substring(p_url from '/storage/v1/object/public/media-videos/(.+)$');
$function$
;

CREATE OR REPLACE FUNCTION public.videos_due_for_cleanup()
 RETURNS TABLE(path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select q.path from public.media_cleanup_queue q where q.due_at <= now() and q.done_at is null and q.path is not null
  union
  select public.video_path(l.video_url) from public.classified_listings l
   where l.video_url is not null and l.status in ('sold', 'rented', 'closed', 'cancelled') and l.updated_at < now() - interval '7 days'
  union
  select public.video_path(p.video_url) from public.products p
   where p.video_url is not null and not p.active and p.updated_at < now() - interval '30 days'
  limit 500;
$function$
;

CREATE OR REPLACE FUNCTION public.wallet_add(p_user uuid, p_order uuid, p_payout uuid, p_bucket text, p_kind text, p_amount numeric, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_amount is null or p_amount = 0 then return; end if;
  insert into public.wallet_entries(user_id, order_id, payout_id, bucket, kind, amount, note, created_by)
  values (p_user, p_order, p_payout, p_bucket, p_kind, round(p_amount, 2), left(p_note, 300), auth.uid());
end $function$
;

CREATE OR REPLACE FUNCTION public.wanted_keywords(p_title text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(array_agg(distinct left(w, 6)), '{}') from (
    select w from regexp_split_to_table(public.fold_text(p_title), '[^a-z0-9]+') w
  ) t
  where char_length(w) >= 4 and w not in (
    'preciso','precisa','procuro','procura','compro','comprar','quero','pago','pagar','alguem','vende','vendo','venda',
    'estado','bons','boas','usado','usada','novo','nova','urgente','urgencia','para','mais','menos','como','desde',
    'entre','kwanzas','preco','barato','barata','qualquer','tipo','servico','servicos','profissional','pessoa',
    'senhor','senhora','trabalho','fazer','minha','minhas','meus','numa','numas','esta','este','isto','aqui','zona','bairro');
$function$
;

CREATE OR REPLACE FUNCTION public.withdraw_offer(p_offer_id uuid)
 RETURNS listing_offers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.listing_offers;
begin
  update public.listing_offers set status = 'withdrawn', responded_at = now()
   where id = p_offer_id and buyer_id = auth.uid() and status = 'pending' returning * into o;
  if not found then raise exception 'INVALID_TRANSITION'; end if;
  return o;
end $function$
;
-- ============================================================
-- Parte 3: posse das sequências, restrições, índices e vistas
-- ============================================================

alter sequence public.job_queue_id_seq owned by public.job_queue.id;

-- Chaves primárias e únicas
alter table public.account_capabilities add constraint account_capabilities_pkey PRIMARY KEY (user_id, capability);
alter table public.addresses add constraint addresses_pkey PRIMARY KEY (id);
alter table public.admin_audit_log add constraint admin_audit_log_pkey PRIMARY KEY (id);
alter table public.agent_commissions add constraint agent_commissions_pkey PRIMARY KEY (id);
alter table public.auction_bids add constraint auction_bids_pkey PRIMARY KEY (id);
alter table public.auction_max_bids add constraint auction_max_bids_auction_id_bidder_id_key UNIQUE (auction_id, bidder_id);
alter table public.auction_max_bids add constraint auction_max_bids_pkey PRIMARY KEY (id);
alter table public.auctions add constraint auctions_pkey PRIMARY KEY (id);
alter table public.businesses add constraint businesses_pkey PRIMARY KEY (id);
alter table public.cart_items add constraint cart_items_cart_id_product_id_key UNIQUE (cart_id, product_id);
alter table public.cart_items add constraint cart_items_pkey PRIMARY KEY (id);
alter table public.carts add constraint carts_pkey PRIMARY KEY (id);
alter table public.carts add constraint carts_user_id_key UNIQUE (user_id);
alter table public.categories add constraint categories_name_key UNIQUE (name);
alter table public.categories add constraint categories_pkey PRIMARY KEY (id);
alter table public.categories add constraint categories_slug_key UNIQUE (slug);
alter table public.classified_listings add constraint classified_listings_pkey PRIMARY KEY (id);
alter table public.classified_saved_searches add constraint classified_saved_searches_pkey PRIMARY KEY (id);
alter table public.communes add constraint communes_municipality_id_name_key UNIQUE (municipality_id, name);
alter table public.communes add constraint communes_pkey PRIMARY KEY (id);
alter table public.conversation_participants add constraint conversation_participants_pkey PRIMARY KEY (conversation_id, user_id);
alter table public.conversations add constraint conversations_pkey PRIMARY KEY (id);
alter table public.couriers add constraint couriers_pkey PRIMARY KEY (user_id);
alter table public.delivery_requests add constraint delivery_requests_order_id_key UNIQUE (order_id);
alter table public.delivery_requests add constraint delivery_requests_pkey PRIMARY KEY (id);
alter table public.event_orders add constraint event_orders_pkey PRIMARY KEY (id);
alter table public.event_orders add constraint event_orders_ref_no_key UNIQUE (ref_no);
alter table public.event_payment_info add constraint event_payment_info_pkey PRIMARY KEY (event_id);
alter table public.event_platform_payments add constraint event_platform_payments_pkey PRIMARY KEY (id);
alter table public.event_platform_payments add constraint event_platform_payments_ref_no_key UNIQUE (ref_no);
alter table public.event_ticket_types add constraint event_ticket_types_pkey PRIMARY KEY (id);
alter table public.event_tickets add constraint event_tickets_code_key UNIQUE (code);
alter table public.event_tickets add constraint event_tickets_pkey PRIMARY KEY (id);
alter table public.events add constraint events_pkey PRIMARY KEY (id);
alter table public.events add constraint events_ref_no_key UNIQUE (ref_no);
alter table public.field_agents add constraint field_agents_code_key UNIQUE (code);
alter table public.field_agents add constraint field_agents_pkey PRIMARY KEY (user_id);
alter table public.followed_businesses add constraint followed_businesses_pkey PRIMARY KEY (user_id, business_id);
alter table public.followed_providers add constraint followed_providers_pkey PRIMARY KEY (user_id, provider_id);
alter table public.followed_sellers add constraint followed_sellers_pkey PRIMARY KEY (user_id, seller_id);
alter table public.fuel_alerts add constraint fuel_alerts_pkey PRIMARY KEY (id);
alter table public.fuel_orders add constraint fuel_orders_code_key UNIQUE (code);
alter table public.fuel_orders add constraint fuel_orders_pkey PRIMARY KEY (id);
alter table public.fuel_orders add constraint fuel_orders_qr_token_key UNIQUE (qr_token);
alter table public.fuel_orders add constraint fuel_orders_ref_no_key UNIQUE (ref_no);
alter table public.fuel_platform_payments add constraint fuel_platform_payments_pkey PRIMARY KEY (id);
alter table public.fuel_platform_payments add constraint fuel_platform_payments_ref_no_key UNIQUE (ref_no);
alter table public.fuel_products add constraint fuel_products_pkey PRIMARY KEY (id);
alter table public.fuel_products add constraint fuel_products_station_id_product_key UNIQUE (station_id, product);
alter table public.fuel_reports add constraint fuel_reports_pkey PRIMARY KEY (id);
alter table public.fuel_station_pay add constraint fuel_station_pay_pkey PRIMARY KEY (station_id);
alter table public.fuel_stations add constraint fuel_stations_pkey PRIMARY KEY (id);
alter table public.fuel_stations add constraint fuel_stations_ref_no_key UNIQUE (ref_no);
alter table public.inspections add constraint inspections_pkey PRIMARY KEY (id);
alter table public.inspections add constraint inspections_ref_no_key UNIQUE (ref_no);
alter table public.item_stats_daily add constraint item_stats_daily_pkey PRIMARY KEY (kind, item_id, day);
alter table public.job_queue add constraint job_queue_pkey PRIMARY KEY (id);
alter table public.listing_boosts add constraint listing_boosts_pkey PRIMARY KEY (id);
alter table public.listing_boosts add constraint listing_boosts_ref_no_key UNIQUE (ref_no);
alter table public.listing_claims add constraint listing_claims_pkey PRIMARY KEY (id);
alter table public.listing_claims add constraint listing_claims_ref_no_key UNIQUE (ref_no);
alter table public.listing_commissions add constraint listing_commissions_pkey PRIMARY KEY (id);
alter table public.listing_offers add constraint listing_offers_pkey PRIMARY KEY (id);
alter table public.markets add constraint markets_pkey PRIMARY KEY (id);
alter table public.media_cleanup_queue add constraint media_cleanup_queue_pkey PRIMARY KEY (path);
alter table public.messages add constraint messages_pkey PRIMARY KEY (id);
alter table public.moderation_reports add constraint moderation_reports_pkey PRIMARY KEY (id);
alter table public.municipalities add constraint municipalities_pkey PRIMARY KEY (id);
alter table public.municipalities add constraint municipalities_province_id_name_key UNIQUE (province_id, name);
alter table public.neighborhoods add constraint neighborhoods_municipality_id_name_key UNIQUE (municipality_id, name);
alter table public.neighborhoods add constraint neighborhoods_pkey PRIMARY KEY (id);
alter table public.notification_preferences add constraint notification_preferences_pkey PRIMARY KEY (user_id);
alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table public.order_dispute_events add constraint order_dispute_events_pkey PRIMARY KEY (id);
alter table public.order_disputes add constraint order_disputes_pkey PRIMARY KEY (id);
alter table public.order_items add constraint order_items_pkey PRIMARY KEY (id);
alter table public.order_payments add constraint order_payments_pkey PRIMARY KEY (id);
alter table public.order_payments add constraint order_payments_provider_payment_id_key UNIQUE (provider_payment_id);
alter table public.orders add constraint orders_pkey PRIMARY KEY (id);
alter table public.organization_members add constraint organization_members_pkey PRIMARY KEY (organization_id, user_id);
alter table public.organizations add constraint organizations_pkey PRIMARY KEY (id);
alter table public.payout_accounts add constraint payout_accounts_pkey PRIMARY KEY (user_id);
alter table public.payout_requests add constraint payout_requests_pkey PRIMARY KEY (id);
alter table public.payout_requests add constraint payout_requests_ref_no_key UNIQUE (ref_no);
alter table public.photo_search_usage add constraint photo_search_usage_pkey PRIMARY KEY (user_id, day);
alter table public.platform_settings add constraint platform_settings_pkey PRIMARY KEY (id);
alter table public.portfolio_items add constraint portfolio_items_pkey PRIMARY KEY (id);
alter table public.products add constraint products_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_phone_key UNIQUE (phone);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.promo_boosts add constraint promo_boosts_pkey PRIMARY KEY (id);
alter table public.promo_boosts add constraint promo_boosts_ref_no_key UNIQUE (ref_no);
alter table public.promo_posts add constraint promo_posts_pkey PRIMARY KEY (id);
alter table public.promo_posts add constraint promo_posts_ref_no_key UNIQUE (ref_no);
alter table public.provider_profiles add constraint provider_profiles_pkey PRIMARY KEY (user_id);
alter table public.provinces add constraint provinces_name_key UNIQUE (name);
alter table public.provinces add constraint provinces_pkey PRIMARY KEY (id);
alter table public.referral_codes add constraint referral_codes_code_key UNIQUE (code);
alter table public.referral_codes add constraint referral_codes_pkey PRIMARY KEY (user_id);
alter table public.referrals add constraint referrals_pkey PRIMARY KEY (referred_id);
alter table public.rental_requests add constraint rental_requests_pkey PRIMARY KEY (id);
alter table public.reviews add constraint reviews_pkey PRIMARY KEY (id);
alter table public.saved_items add constraint saved_items_pkey PRIMARY KEY (id);
alter table public.saved_search_notification_queue add constraint saved_search_notification_queue_pkey PRIMARY KEY (id);
alter table public.seller_delivery_settings add constraint seller_delivery_settings_pkey PRIMARY KEY (seller_id);
alter table public.seller_delivery_zones add constraint seller_delivery_zones_pkey PRIMARY KEY (seller_id, municipality_id);
alter table public.service_requests add constraint service_requests_pkey PRIMARY KEY (id);
alter table public.services add constraint services_pkey PRIMARY KEY (id);
alter table public.streets add constraint streets_neighborhood_id_name_key UNIQUE (neighborhood_id, name);
alter table public.streets add constraint streets_pkey PRIMARY KEY (id);
alter table public.subscription_payments add constraint subscription_payments_pkey PRIMARY KEY (id);
alter table public.subscriptions add constraint subscriptions_pkey PRIMARY KEY (id);
alter table public.user_blocks add constraint user_blocks_pkey PRIMARY KEY (blocker_id, blocked_id);
alter table public.user_reviews add constraint user_reviews_pkey PRIMARY KEY (id);
alter table public.user_roles add constraint user_roles_pkey PRIMARY KEY (user_id);
alter table public.venue_items add constraint venue_items_pkey PRIMARY KEY (id);
alter table public.venue_order_lines add constraint venue_order_lines_pkey PRIMARY KEY (id);
alter table public.venue_orders add constraint venue_orders_code_key UNIQUE (code);
alter table public.venue_orders add constraint venue_orders_pkey PRIMARY KEY (id);
alter table public.venue_orders add constraint venue_orders_qr_token_key UNIQUE (qr_token);
alter table public.venue_orders add constraint venue_orders_ref_no_key UNIQUE (ref_no);
alter table public.venue_pay add constraint venue_pay_pkey PRIMARY KEY (venue_id);
alter table public.venue_platform_payments add constraint venue_platform_payments_pkey PRIMARY KEY (id);
alter table public.venue_platform_payments add constraint venue_platform_payments_ref_no_key UNIQUE (ref_no);
alter table public.venues add constraint venues_business_id_key UNIQUE (business_id);
alter table public.venues add constraint venues_pkey PRIMARY KEY (id);
alter table public.venues add constraint venues_ref_no_key UNIQUE (ref_no);
alter table public.verification_requests add constraint verification_requests_pkey PRIMARY KEY (id);
alter table public.wallet_entries add constraint wallet_entries_pkey PRIMARY KEY (id);

-- Verificações (check)
alter table public.account_capabilities add constraint account_capabilities_capability_check CHECK ((capability = ANY (ARRAY['customer'::text, 'provider'::text, 'seller'::text, 'business_owner'::text, 'business_staff'::text, 'courier'::text])));
alter table public.agent_commissions add constraint agent_commissions_admin_note_check CHECK (((admin_note IS NULL) OR (char_length(admin_note) <= 500)));
alter table public.agent_commissions add constraint agent_commissions_amount_check CHECK ((amount >= (0)::numeric));
alter table public.agent_commissions add constraint agent_commissions_rate_pct_check CHECK (((rate_pct IS NULL) OR ((rate_pct >= (0)::numeric) AND (rate_pct <= (20)::numeric))));
alter table public.agent_commissions add constraint agent_commissions_sale_amount_check CHECK (((sale_amount IS NULL) OR (sale_amount >= (0)::numeric)));
alter table public.agent_commissions add constraint agent_commissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])));
alter table public.auction_bids add constraint auction_bids_amount_check CHECK ((amount > (0)::numeric));
alter table public.auction_bids add constraint auction_bids_retract_reason_check CHECK (((retract_reason IS NULL) OR (char_length(retract_reason) <= 300)));
alter table public.auction_max_bids add constraint auction_max_bids_max_amount_check CHECK ((max_amount > (0)::numeric));
alter table public.auction_max_bids add constraint auction_max_bids_retract_reason_check CHECK (((retract_reason IS NULL) OR (char_length(retract_reason) <= 300)));
alter table public.auctions add constraint auctions_buy_now_price_check CHECK (((buy_now_price IS NULL) OR (buy_now_price > (0)::numeric)));
alter table public.auctions add constraint auctions_check CHECK (((reserve_price IS NULL) OR (reserve_price >= starting_price)));
alter table public.auctions add constraint auctions_check1 CHECK ((ends_at > starts_at));
alter table public.auctions add constraint auctions_check2 CHECK ((current_price >= starting_price));
alter table public.auctions add constraint auctions_min_increment_check CHECK ((min_increment >= (0)::numeric));
alter table public.auctions add constraint auctions_starting_price_check CHECK ((starting_price >= (0)::numeric));
alter table public.auctions add constraint auctions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'live'::text, 'ended'::text, 'cancelled'::text])));
alter table public.businesses add constraint businesses_custom_category_check CHECK (((custom_category IS NULL) OR ((char_length(TRIM(BOTH FROM custom_category)) >= 2) AND (char_length(TRIM(BOTH FROM custom_category)) <= 60))));
alter table public.businesses add constraint businesses_directions_check CHECK (((directions IS NULL) OR (char_length(directions) <= 300)));
alter table public.businesses add constraint businesses_geo_check CHECK ((((geo_lat IS NULL) AND (geo_lng IS NULL)) OR ((geo_lat IS NOT NULL) AND (geo_lng IS NOT NULL) AND ((geo_lat >= '-18.1'::numeric) AND (geo_lat <= '-4.3'::numeric)) AND ((geo_lng >= 11.6) AND (geo_lng <= 24.2)))));
alter table public.cart_items add constraint cart_items_quantity_check CHECK ((quantity > 0));
alter table public.categories add constraint categories_type_check CHECK ((type = ANY (ARRAY['business'::text, 'professional'::text, 'service'::text, 'product'::text, 'classified'::text])));
alter table public.classified_listings add constraint classified_attributes_object_check CHECK ((jsonb_typeof(attributes) = 'object'::text));
alter table public.classified_listings add constraint classified_budget_order CHECK (((budget_min IS NULL) OR (budget_max IS NULL) OR (budget_min <= budget_max)));
alter table public.classified_listings add constraint classified_listings_budget_max_check CHECK (((budget_max IS NULL) OR (budget_max >= (0)::numeric)));
alter table public.classified_listings add constraint classified_listings_budget_min_check CHECK (((budget_min IS NULL) OR (budget_min >= (0)::numeric)));
alter table public.classified_listings add constraint classified_listings_directions_check CHECK (((directions IS NULL) OR (char_length(directions) <= 300)));
alter table public.classified_listings add constraint classified_listings_geo_check CHECK ((((geo_lat IS NULL) AND (geo_lng IS NULL)) OR ((geo_lat IS NOT NULL) AND (geo_lng IS NOT NULL) AND ((geo_lat >= '-18.1'::numeric) AND (geo_lat <= '-4.3'::numeric)) AND ((geo_lng >= 11.6) AND (geo_lng <= 24.2)))));
alter table public.classified_listings add constraint classified_listings_listing_type_check CHECK ((listing_type = ANY (ARRAY['real_estate'::text, 'vehicle'::text, 'product'::text, 'service'::text, 'classified'::text])));
alter table public.classified_listings add constraint classified_listings_price_check CHECK (((price IS NULL) OR (price >= (0)::numeric)));
alter table public.classified_listings add constraint classified_listings_purpose_check CHECK ((purpose = ANY (ARRAY['sale'::text, 'rent'::text, 'lease'::text, 'auction'::text, 'wanted'::text, 'service'::text])));
alter table public.classified_listings add constraint classified_listings_sale_amount_check CHECK (((sale_amount IS NULL) OR (sale_amount >= (0)::numeric)));
alter table public.classified_listings add constraint classified_listings_sale_mode_check CHECK (((sale_mode IS NULL) OR (sale_mode = ANY (ARRAY['fixed'::text, 'negotiable'::text, 'offers'::text, 'auction'::text, 'trade'::text]))));
alter table public.classified_listings add constraint classified_listings_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'paused'::text, 'sold'::text, 'rented'::text, 'closed'::text, 'cancelled'::text])));
alter table public.classified_listings add constraint classified_listings_trade_wants_check CHECK (((trade_wants IS NULL) OR (char_length(trade_wants) <= 300)));
alter table public.classified_listings add constraint classified_listings_video_url_check CHECK (((video_url IS NULL) OR (video_url ~ '^https://[^ ]+/storage/v1/object/public/media-videos/'::text)));
alter table public.classified_saved_searches add constraint classified_saved_searches_filters_object CHECK ((jsonb_typeof(filters) = 'object'::text));
alter table public.classified_saved_searches add constraint classified_saved_searches_notification_frequency_check CHECK ((notification_frequency = ANY (ARRAY['immediate'::text, 'daily'::text])));
alter table public.conversations add constraint conversations_context_type_check CHECK ((context_type = ANY (ARRAY['general'::text, 'business'::text, 'provider'::text, 'service'::text, 'product'::text, 'order'::text, 'classified'::text])));
alter table public.couriers add constraint couriers_display_name_check CHECK (((char_length(display_name) >= 2) AND (char_length(display_name) <= 80)));
alter table public.couriers add constraint couriers_phone_check CHECK (((char_length(phone) >= 6) AND (char_length(phone) <= 30)));
alter table public.couriers add constraint couriers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'suspended'::text])));
alter table public.couriers add constraint couriers_vehicle_check CHECK ((vehicle = ANY (ARRAY['moto'::text, 'carro'::text, 'carrinha'::text, 'bicicleta'::text, 'a_pe'::text])));
alter table public.delivery_requests add constraint delivery_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'assigned'::text, 'accepted'::text, 'picked_up'::text, 'in_transit'::text, 'delivered'::text, 'cancelled'::text])));
alter table public.event_orders add constraint event_orders_buyer_name_check CHECK (((char_length(TRIM(BOTH FROM buyer_name)) >= 2) AND (char_length(TRIM(BOTH FROM buyer_name)) <= 120)));
alter table public.event_orders add constraint event_orders_buyer_phone_check CHECK (((buyer_phone IS NULL) OR (char_length(buyer_phone) <= 20)));
alter table public.event_orders add constraint event_orders_method_check CHECK (((method IS NULL) OR (method = ANY (ARRAY['bank_transfer'::text, 'multicaixa_express'::text, 'cash'::text]))));
alter table public.event_orders add constraint event_orders_note_check CHECK (((note IS NULL) OR (char_length(note) <= 500)));
alter table public.event_orders add constraint event_orders_quantity_check CHECK (((quantity >= 1) AND (quantity <= 50)));
alter table public.event_orders add constraint event_orders_reference_check CHECK (((reference IS NULL) OR (char_length(reference) <= 120)));
alter table public.event_orders add constraint event_orders_status_check CHECK ((status = ANY (ARRAY['reserved'::text, 'submitted'::text, 'confirmed'::text, 'rejected'::text, 'cancelled'::text, 'expired'::text])));
alter table public.event_orders add constraint event_orders_total_check CHECK ((total >= (0)::numeric));
alter table public.event_orders add constraint event_orders_unit_price_check CHECK ((unit_price >= (0)::numeric));
alter table public.event_payment_info add constraint event_payment_info_express_check CHECK (((express IS NULL) OR (char_length(express) <= 20)));
alter table public.event_payment_info add constraint event_payment_info_holder_check CHECK (((holder IS NULL) OR (char_length(holder) <= 120)));
alter table public.event_payment_info add constraint event_payment_info_iban_check CHECK (((iban IS NULL) OR (char_length(iban) <= 40)));
alter table public.event_payment_info add constraint event_payment_info_note_check CHECK (((note IS NULL) OR (char_length(note) <= 300)));
alter table public.event_platform_payments add constraint event_platform_payments_admin_note_check CHECK (((admin_note IS NULL) OR (char_length(admin_note) <= 500)));
alter table public.event_platform_payments add constraint event_platform_payments_amount_check CHECK ((amount >= (0)::numeric));
alter table public.event_platform_payments add constraint event_platform_payments_days_check CHECK (((days IS NULL) OR ((days >= 1) AND (days <= 60))));
alter table public.event_platform_payments add constraint event_platform_payments_kind_check CHECK ((kind = ANY (ARRAY['fee'::text, 'boost'::text])));
alter table public.event_platform_payments add constraint event_platform_payments_method_check CHECK ((method = ANY (ARRAY['bank_transfer'::text, 'multicaixa_express'::text, 'cash'::text])));
alter table public.event_platform_payments add constraint event_platform_payments_proof_path_check CHECK (((proof_path IS NULL) OR (proof_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,140}$'::text)));
alter table public.event_platform_payments add constraint event_platform_payments_reference_check CHECK (((reference IS NULL) OR (char_length(reference) <= 120)));
alter table public.event_platform_payments add constraint event_platform_payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text])));
alter table public.event_ticket_types add constraint event_ticket_types_max_per_order_check CHECK (((max_per_order >= 1) AND (max_per_order <= 50)));
alter table public.event_ticket_types add constraint event_ticket_types_name_check CHECK (((char_length(TRIM(BOTH FROM name)) >= 2) AND (char_length(TRIM(BOTH FROM name)) <= 60)));
alter table public.event_ticket_types add constraint event_ticket_types_price_check CHECK ((price >= (0)::numeric));
alter table public.event_ticket_types add constraint event_ticket_types_quantity_check CHECK (((quantity >= 1) AND (quantity <= 100000)));
alter table public.event_tickets add constraint event_tickets_code_check CHECK ((code ~ '^HO-[A-Z2-9]{4}-[A-Z2-9]{4}$'::text));
alter table public.event_tickets add constraint event_tickets_status_check CHECK ((status = ANY (ARRAY['valid'::text, 'used'::text, 'void'::text])));
alter table public.events add constraint events_cancel_reason_check CHECK (((cancel_reason IS NULL) OR (char_length(cancel_reason) <= 500)));
alter table public.events add constraint events_category_check CHECK ((category = ANY (ARRAY['music'::text, 'party'::text, 'sport'::text, 'culture'::text, 'religion'::text, 'business'::text, 'training'::text, 'family'::text, 'other'::text])));
alter table public.events add constraint events_check CHECK (((ends_at IS NULL) OR (ends_at > starts_at)));
alter table public.events add constraint events_check1 CHECK ((((geo_lat IS NULL) AND (geo_lng IS NULL)) OR ((geo_lat IS NOT NULL) AND (geo_lng IS NOT NULL) AND ((geo_lat >= '-18.1'::numeric) AND (geo_lat <= '-4.3'::numeric)) AND ((geo_lng >= 11.6) AND (geo_lng <= 24.2)))));
alter table public.events add constraint events_cover_url_check CHECK (((cover_url IS NULL) OR (cover_url ~ '^https://'::text)));
alter table public.events add constraint events_description_check CHECK (((description IS NULL) OR (char_length(description) <= 4000)));
alter table public.events add constraint events_directions_check CHECK (((directions IS NULL) OR (char_length(directions) <= 300)));
alter table public.events add constraint events_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'cancelled'::text])));
alter table public.events add constraint events_title_check CHECK (((char_length(TRIM(BOTH FROM title)) >= 4) AND (char_length(TRIM(BOTH FROM title)) <= 120)));
alter table public.events add constraint events_venue_check CHECK (((char_length(TRIM(BOTH FROM venue)) >= 2) AND (char_length(TRIM(BOTH FROM venue)) <= 160)));
alter table public.field_agents add constraint field_agents_admin_note_check CHECK (((admin_note IS NULL) OR (char_length(admin_note) <= 500)));
alter table public.field_agents add constraint field_agents_full_name_check CHECK (((char_length(TRIM(BOTH FROM full_name)) >= 3) AND (char_length(TRIM(BOTH FROM full_name)) <= 120)));
alter table public.field_agents add constraint field_agents_note_check CHECK (((note IS NULL) OR (char_length(note) <= 500)));
alter table public.field_agents add constraint field_agents_phone_check CHECK (((char_length(phone) >= 9) AND (char_length(phone) <= 20)));
alter table public.field_agents add constraint field_agents_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'suspended'::text, 'rejected'::text])));
alter table public.followed_providers add constraint followed_providers_check CHECK ((user_id <> provider_id));
alter table public.followed_sellers add constraint followed_sellers_check CHECK ((user_id <> seller_id));
alter table public.fuel_alerts add constraint fuel_alerts_product_check CHECK ((product = ANY (ARRAY['gasolina'::text, 'gasoleo'::text, 'petroleo'::text, 'gas_12kg'::text, 'gas_6kg'::text])));
alter table public.fuel_orders add constraint fuel_orders_buyer_name_check CHECK (((char_length(buyer_name) >= 2) AND (char_length(buyer_name) <= 80)));
alter table public.fuel_orders add constraint fuel_orders_buyer_phone_check CHECK (((buyer_phone IS NULL) OR (char_length(buyer_phone) <= 20)));
alter table public.fuel_orders add constraint fuel_orders_method_check CHECK ((method = ANY (ARRAY['at_station'::text, 'prepaid'::text])));
alter table public.fuel_orders add constraint fuel_orders_note_check CHECK (((note IS NULL) OR (char_length(note) <= 500)));
alter table public.fuel_orders add constraint fuel_orders_pay_method_check CHECK (((pay_method IS NULL) OR (pay_method = ANY (ARRAY['bank_transfer'::text, 'multicaixa_express'::text]))));
alter table public.fuel_orders add constraint fuel_orders_plate_check CHECK (((plate IS NULL) OR (char_length(plate) <= 20)));
alter table public.fuel_orders add constraint fuel_orders_quantity_check CHECK ((quantity > (0)::numeric));
alter table public.fuel_orders add constraint fuel_orders_reference_check CHECK (((reference IS NULL) OR (char_length(reference) <= 120)));
alter table public.fuel_orders add constraint fuel_orders_status_check CHECK ((status = ANY (ARRAY['reserved'::text, 'awaiting_payment'::text, 'submitted'::text, 'paid'::text, 'collected'::text, 'cancelled'::text, 'expired'::text, 'rejected'::text])));
alter table public.fuel_orders add constraint fuel_orders_total_check CHECK ((total >= (0)::numeric));
alter table public.fuel_orders add constraint fuel_orders_unit_price_check CHECK ((unit_price >= (0)::numeric));
alter table public.fuel_platform_payments add constraint fuel_platform_payments_amount_check CHECK ((amount >= (0)::numeric));
alter table public.fuel_platform_payments add constraint fuel_platform_payments_method_check CHECK ((method = ANY (ARRAY['bank_transfer'::text, 'multicaixa_express'::text, 'cash'::text])));
alter table public.fuel_platform_payments add constraint fuel_platform_payments_proof_path_check CHECK (((proof_path IS NULL) OR (proof_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,140}$'::text)));
alter table public.fuel_platform_payments add constraint fuel_platform_payments_reference_check CHECK (((reference IS NULL) OR (char_length(reference) <= 120)));
alter table public.fuel_platform_payments add constraint fuel_platform_payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text])));
alter table public.fuel_products add constraint fuel_products_max_per_order_check CHECK ((max_per_order > (0)::numeric));
alter table public.fuel_products add constraint fuel_products_note_check CHECK (((note IS NULL) OR (char_length(note) <= 160)));
alter table public.fuel_products add constraint fuel_products_price_check CHECK (((price IS NULL) OR (price >= (0)::numeric)));
alter table public.fuel_products add constraint fuel_products_product_check CHECK ((product = ANY (ARRAY['gasolina'::text, 'gasoleo'::text, 'petroleo'::text, 'gas_12kg'::text, 'gas_6kg'::text])));
alter table public.fuel_products add constraint fuel_products_queue_check CHECK (((queue IS NULL) OR (queue = ANY (ARRAY['none'::text, 'short'::text, 'medium'::text, 'long'::text]))));
alter table public.fuel_products add constraint fuel_products_reservable_qty_check CHECK ((reservable_qty >= (0)::numeric));
alter table public.fuel_products add constraint fuel_products_status_check CHECK ((status = ANY (ARRAY['available'::text, 'low'::text, 'out'::text, 'unknown'::text])));
alter table public.fuel_station_pay add constraint fuel_station_pay_express_check CHECK (((express IS NULL) OR (char_length(express) <= 20)));
alter table public.fuel_station_pay add constraint fuel_station_pay_holder_check CHECK (((holder IS NULL) OR (char_length(holder) <= 80)));
alter table public.fuel_station_pay add constraint fuel_station_pay_iban_check CHECK (((iban IS NULL) OR (char_length(iban) <= 40)));
alter table public.fuel_station_pay add constraint fuel_station_pay_note_check CHECK (((note IS NULL) OR (char_length(note) <= 200)));
alter table public.fuel_stations add constraint fuel_stations_address_check CHECK (((address IS NULL) OR (char_length(address) <= 200)));
alter table public.fuel_stations add constraint fuel_stations_check CHECK (((geo_lat IS NULL) = (geo_lng IS NULL)));
alter table public.fuel_stations add constraint fuel_stations_directions_check CHECK (((directions IS NULL) OR (char_length(directions) <= 500)));
alter table public.fuel_stations add constraint fuel_stations_geo_lat_check CHECK (((geo_lat IS NULL) OR ((geo_lat >= '-18.1'::numeric) AND (geo_lat <= '-4.3'::numeric))));
alter table public.fuel_stations add constraint fuel_stations_geo_lng_check CHECK (((geo_lng IS NULL) OR ((geo_lng >= 11.6) AND (geo_lng <= 24.1))));
alter table public.fuel_stations add constraint fuel_stations_hold_minutes_check CHECK (((hold_minutes >= 15) AND (hold_minutes <= 1440)));
alter table public.fuel_stations add constraint fuel_stations_kind_check CHECK ((kind = ANY (ARRAY['fuel'::text, 'gas'::text, 'both'::text])));
alter table public.fuel_stations add constraint fuel_stations_name_check CHECK (((char_length(name) >= 3) AND (char_length(name) <= 100)));
alter table public.fuel_stations add constraint fuel_stations_opening_hours_check CHECK (((opening_hours IS NULL) OR (char_length(opening_hours) <= 120)));
alter table public.fuel_stations add constraint fuel_stations_phone_check CHECK (((phone IS NULL) OR (char_length(phone) <= 20)));
alter table public.fuel_stations add constraint fuel_stations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'suspended'::text])));
alter table public.fuel_stations add constraint fuel_stations_whatsapp_check CHECK (((whatsapp IS NULL) OR (char_length(whatsapp) <= 20)));
alter table public.inspections add constraint inspections_address_check CHECK (((address IS NULL) OR (char_length(address) <= 300)));
alter table public.inspections add constraint inspections_admin_note_check CHECK (((admin_note IS NULL) OR (char_length(admin_note) <= 500)));
alter table public.inspections add constraint inspections_inspector_name_check CHECK (((inspector_name IS NULL) OR (char_length(inspector_name) <= 80)));
alter table public.inspections add constraint inspections_kind_check CHECK ((kind = ANY (ARRAY['provider'::text, 'business'::text, 'store'::text])));
alter table public.inspections add constraint inspections_note_check CHECK (((note IS NULL) OR (char_length(note) <= 500)));
alter table public.inspections add constraint inspections_pay_method_check CHECK (((pay_method IS NULL) OR (pay_method = ANY (ARRAY['bank_transfer'::text, 'multicaixa_express'::text, 'cash'::text]))));
alter table public.inspections add constraint inspections_pay_reference_check CHECK (((pay_reference IS NULL) OR (char_length(pay_reference) <= 120)));
alter table public.inspections add constraint inspections_phone_check CHECK (((phone IS NULL) OR (char_length(phone) <= 20)));
alter table public.inspections add constraint inspections_preferred_time_check CHECK (((preferred_time IS NULL) OR (char_length(preferred_time) <= 120)));
alter table public.inspections add constraint inspections_status_check CHECK ((status = ANY (ARRAY['awaiting_payment'::text, 'payment_submitted'::text, 'requested'::text, 'scheduled'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text, 'revoked'::text])));
alter table public.item_stats_daily add constraint item_stats_daily_kind_check CHECK ((kind = ANY (ARRAY['listing'::text, 'product'::text, 'business'::text, 'provider'::text])));
alter table public.job_queue add constraint job_queue_kind_check CHECK ((kind = ANY (ARRAY['saved_search'::text, 'wanted'::text, 'follow_listing'::text, 'follow_product'::text, 'follow_portfolio'::text, 'fuel_alert'::text])));
alter table public.listing_boosts add constraint listing_boosts_admin_note_check CHECK (((admin_note IS NULL) OR (char_length(admin_note) <= 500)));
alter table public.listing_boosts add constraint listing_boosts_amount_check CHECK ((amount >= (0)::numeric));
alter table public.listing_boosts add constraint listing_boosts_days_check CHECK (((days >= 1) AND (days <= 60)));
alter table public.listing_boosts add constraint listing_boosts_method_check CHECK (((method IS NULL) OR (method = ANY (ARRAY['bank_transfer'::text, 'multicaixa_express'::text, 'cash'::text]))));
alter table public.listing_boosts add constraint listing_boosts_proof_path_check CHECK (((proof_path IS NULL) OR (proof_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,140}$'::text)));
alter table public.listing_boosts add constraint listing_boosts_reference_check CHECK (((reference IS NULL) OR (char_length(reference) <= 120)));
alter table public.listing_boosts add constraint listing_boosts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'rejected'::text, 'expired'::text, 'cancelled'::text])));
alter table public.listing_claims add constraint listing_claims_admin_note_check CHECK (((admin_note IS NULL) OR (char_length(admin_note) <= 1000)));
alter table public.listing_claims add constraint listing_claims_amount_check CHECK (((amount IS NULL) OR (amount > (0)::numeric)));
alter table public.listing_claims add constraint listing_claims_check CHECK (((status = 'resolved'::text) = (outcome IS NOT NULL)));
alter table public.listing_claims add constraint listing_claims_description_check CHECK (((char_length(TRIM(BOTH FROM description)) >= 10) AND (char_length(TRIM(BOTH FROM description)) <= 1000)));
alter table public.listing_claims add constraint listing_claims_outcome_check CHECK (((outcome IS NULL) OR (outcome = ANY (ARRAY['done'::text, 'rejected'::text, 'withdrawn'::text]))));
alter table public.listing_claims add constraint listing_claims_reason_check CHECK ((reason = ANY (ARRAY['omitted_defect'::text, 'not_as_described'::text, 'wrong_item'::text, 'missing_parts'::text, 'other'::text])));
alter table public.listing_claims add constraint listing_claims_request_check CHECK ((request = ANY (ARRAY['exchange'::text, 'return_refund'::text, 'refund'::text])));
alter table public.listing_claims add constraint listing_claims_seller_note_check CHECK (((seller_note IS NULL) OR (char_length(seller_note) <= 1000)));
alter table public.listing_claims add constraint listing_claims_status_check CHECK ((status = ANY (ARRAY['open'::text, 'accepted'::text, 'declined'::text, 'escalated'::text, 'resolved'::text])));
alter table public.listing_commissions add constraint listing_commissions_admin_note_check CHECK (((admin_note IS NULL) OR (char_length(admin_note) <= 500)));
alter table public.listing_commissions add constraint listing_commissions_amount_check CHECK ((amount >= (0)::numeric));
alter table public.listing_commissions add constraint listing_commissions_method_check CHECK (((method IS NULL) OR (method = ANY (ARRAY['bank_transfer'::text, 'multicaixa_express'::text, 'cash'::text]))));
alter table public.listing_commissions add constraint listing_commissions_proof_path_check CHECK (((proof_path IS NULL) OR (proof_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,140}$'::text)));
alter table public.listing_commissions add constraint listing_commissions_rate_pct_check CHECK (((rate_pct >= (0)::numeric) AND (rate_pct <= (50)::numeric)));
alter table public.listing_commissions add constraint listing_commissions_reference_check CHECK (((reference IS NULL) OR (char_length(reference) <= 120)));
alter table public.listing_commissions add constraint listing_commissions_sale_amount_check CHECK ((sale_amount >= (0)::numeric));
alter table public.listing_commissions add constraint listing_commissions_source_check CHECK ((source = ANY (ARRAY['sold'::text, 'auction'::text, 'offer'::text, 'rental'::text, 'rented'::text])));
alter table public.listing_commissions add constraint listing_commissions_status_check CHECK ((status = ANY (ARRAY['due'::text, 'submitted'::text, 'paid'::text, 'waived'::text, 'cancelled'::text])));
alter table public.listing_offers add constraint listing_offers_amount_check CHECK (((amount IS NULL) OR (amount > (0)::numeric)));
alter table public.listing_offers add constraint listing_offers_check CHECK (((amount IS NOT NULL) OR (trade_item IS NOT NULL)));
alter table public.listing_offers add constraint listing_offers_message_check CHECK (((message IS NULL) OR (char_length(message) <= 500)));
alter table public.listing_offers add constraint listing_offers_seller_note_check CHECK (((seller_note IS NULL) OR (char_length(seller_note) <= 300)));
alter table public.listing_offers add constraint listing_offers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'withdrawn'::text])));
alter table public.listing_offers add constraint listing_offers_trade_item_check CHECK (((trade_item IS NULL) OR ((char_length(trade_item) >= 2) AND (char_length(trade_item) <= 300))));
alter table public.markets add constraint markets_address_text_check CHECK (((address_text IS NULL) OR (char_length(address_text) <= 200)));
alter table public.markets add constraint markets_description_check CHECK (((description IS NULL) OR (char_length(description) <= 2000)));
alter table public.markets add constraint markets_name_check CHECK (((char_length(TRIM(BOTH FROM name)) >= 2) AND (char_length(TRIM(BOTH FROM name)) <= 80)));
alter table public.markets add constraint markets_opening_hours_check CHECK (((opening_hours IS NULL) OR (char_length(opening_hours) <= 120)));
alter table public.markets add constraint markets_photo_url_check CHECK (((photo_url IS NULL) OR (photo_url ~ '^https://'::text)));
alter table public.markets add constraint markets_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'hidden'::text])));
alter table public.messages add constraint messages_attachment_both CHECK (((attachment_kind IS NULL) = (attachment_path IS NULL)));
alter table public.messages add constraint messages_attachment_kind_check CHECK ((attachment_kind = ANY (ARRAY['image'::text, 'video'::text, 'audio'::text])));
alter table public.messages add constraint messages_attachment_own_folder CHECK (((attachment_path IS NULL) OR (attachment_path ~~ ((((conversation_id)::text || '/'::text) || (sender_id)::text) || '/%'::text))));
alter table public.messages add constraint messages_attachment_seconds_check CHECK (((attachment_seconds IS NULL) OR ((attachment_seconds >= 0) AND (attachment_seconds <= 600))));
alter table public.messages add constraint messages_body_check CHECK (((length(TRIM(BOTH FROM body)) > 0) OR (attachment_path IS NOT NULL)));
alter table public.moderation_reports add constraint moderation_reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'reviewing'::text, 'resolved'::text, 'dismissed'::text])));
alter table public.moderation_reports add constraint moderation_reports_target_type_check CHECK ((target_type = ANY (ARRAY['user'::text, 'business'::text, 'provider'::text, 'product'::text, 'service'::text, 'auction'::text, 'classified_listing'::text, 'message'::text, 'promo_post'::text])));
alter table public.notifications add constraint notifications_type_check CHECK ((type = ANY (ARRAY['order'::text, 'auction'::text, 'bid'::text, 'message'::text, 'delivery'::text, 'review'::text, 'system'::text, 'saved_search'::text])));
alter table public.order_dispute_events add constraint order_dispute_events_action_check CHECK ((action = ANY (ARRAY['opened'::text, 'accepted'::text, 'declined'::text, 'returned'::text, 'return_received'::text, 'refund_sent'::text, 'refund_confirmed'::text, 'replacement_received'::text, 'escalated'::text, 'decided'::text, 'withdrawn'::text, 'comment'::text, 'auto_refund'::text])));
alter table public.order_dispute_events add constraint order_dispute_events_actor_role_check CHECK ((actor_role = ANY (ARRAY['buyer'::text, 'seller'::text, 'admin'::text, 'system'::text])));
alter table public.order_dispute_events add constraint order_dispute_events_note_check CHECK (((note IS NULL) OR (char_length(note) <= 1000)));
alter table public.order_dispute_events add constraint order_dispute_events_photos_check CHECK ((cardinality(photos) <= 4));
alter table public.order_disputes add constraint order_disputes_admin_note_check CHECK (((admin_note IS NULL) OR (char_length(admin_note) <= 1000)));
alter table public.order_disputes add constraint order_disputes_amount_check CHECK (((amount IS NULL) OR (amount > (0)::numeric)));
alter table public.order_disputes add constraint order_disputes_check CHECK (((status = 'resolved'::text) = (outcome IS NOT NULL)));
alter table public.order_disputes add constraint order_disputes_check1 CHECK (((request = 'replacement'::text) = (amount IS NULL)));
alter table public.order_disputes add constraint order_disputes_description_check CHECK (((description IS NULL) OR (char_length(description) <= 1000)));
alter table public.order_disputes add constraint order_disputes_outcome_check CHECK (((outcome IS NULL) OR (outcome = ANY (ARRAY['refunded'::text, 'replaced'::text, 'rejected'::text, 'withdrawn'::text]))));
alter table public.order_disputes add constraint order_disputes_reason_check CHECK ((reason = ANY (ARRAY['not_received'::text, 'damaged'::text, 'not_as_described'::text, 'wrong_item'::text, 'missing_items'::text, 'other'::text, 'seller_cancelled'::text])));
alter table public.order_disputes add constraint order_disputes_refund_to_check CHECK (((refund_to IS NULL) OR (char_length(refund_to) <= 60)));
alter table public.order_disputes add constraint order_disputes_request_check CHECK ((request = ANY (ARRAY['refund'::text, 'return_refund'::text, 'replacement'::text])));
alter table public.order_disputes add constraint order_disputes_status_check CHECK ((status = ANY (ARRAY['open'::text, 'declined'::text, 'awaiting_return'::text, 'returned'::text, 'awaiting_refund'::text, 'refund_sent'::text, 'replacing'::text, 'escalated'::text, 'resolved'::text])));
alter table public.order_items add constraint order_items_quantity_check CHECK ((quantity > 0));
alter table public.order_payments add constraint order_payments_admin_note_check CHECK (((admin_note IS NULL) OR (char_length(admin_note) <= 500)));
alter table public.order_payments add constraint order_payments_amount_check CHECK ((amount > (0)::numeric));
alter table public.order_payments add constraint order_payments_entity_check CHECK (((entity IS NULL) OR (char_length(entity) <= 10)));
alter table public.order_payments add constraint order_payments_method_check CHECK ((method = ANY (ARRAY['bank_transfer'::text, 'multicaixa_express'::text, 'reference'::text])));
alter table public.order_payments add constraint order_payments_proof_path_check CHECK (((proof_path IS NULL) OR (proof_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,140}$'::text)));
alter table public.order_payments add constraint order_payments_provider_check CHECK ((provider = ANY (ARRAY['manual'::text, 'proxypay'::text])));
alter table public.order_payments add constraint order_payments_reference_check CHECK (((reference IS NULL) OR (char_length(reference) <= 120)));
alter table public.order_payments add constraint order_payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text, 'expired'::text])));
alter table public.orders add constraint orders_delivery_geo_check CHECK ((((delivery_lat IS NULL) AND (delivery_lng IS NULL)) OR ((delivery_lat IS NOT NULL) AND (delivery_lng IS NOT NULL) AND ((delivery_lat >= '-18.1'::numeric) AND (delivery_lat <= '-4.3'::numeric)) AND ((delivery_lng >= 11.6) AND (delivery_lng <= 24.2)))));
alter table public.orders add constraint orders_escrow_status_check CHECK (((escrow_status IS NULL) OR (escrow_status = ANY (ARRAY['awaiting_payment'::text, 'held'::text, 'released'::text, 'refunded'::text]))));
alter table public.orders add constraint orders_fulfillment_status_check CHECK ((fulfillment_status = ANY (ARRAY['pending'::text, 'assigned'::text, 'in_transit'::text, 'delivered'::text, 'cancelled'::text])));
alter table public.orders add constraint orders_fulfillment_type_check CHECK ((fulfillment_type = ANY (ARRAY['delivery'::text, 'pickup'::text])));
alter table public.orders add constraint orders_payment_method_check CHECK (((payment_method IS NULL) OR (payment_method = ANY (ARRAY['cash_on_delivery'::text, 'bank_transfer'::text, 'card'::text, 'reference'::text, 'mobile_money'::text]))));
alter table public.orders add constraint orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text])));
alter table public.orders add constraint orders_platform_fee_check CHECK ((platform_fee >= (0)::numeric));
alter table public.orders add constraint orders_protected_escrow CHECK ((protected = (escrow_status IS NOT NULL)));
alter table public.orders add constraint orders_refunded_amount_check CHECK ((refunded_amount >= (0)::numeric));
alter table public.orders add constraint orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'processing'::text, 'ready'::text, 'completed'::text, 'cancelled'::text])));
alter table public.organization_members add constraint organization_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text])));
alter table public.organizations add constraint organizations_type_check CHECK ((type = ANY (ARRAY['business'::text, 'store'::text, 'organization'::text])));
alter table public.payout_accounts add constraint payout_accounts_check CHECK (((method = 'iban'::text) = (iban IS NOT NULL)));
alter table public.payout_accounts add constraint payout_accounts_check1 CHECK (((method = 'express'::text) = (express_number IS NOT NULL)));
alter table public.payout_accounts add constraint payout_accounts_express_number_check CHECK (((express_number IS NULL) OR (express_number ~ '^9[0-9]{8}$'::text)));
alter table public.payout_accounts add constraint payout_accounts_holder_name_check CHECK (((char_length(holder_name) >= 3) AND (char_length(holder_name) <= 120)));
alter table public.payout_accounts add constraint payout_accounts_iban_check CHECK (((iban IS NULL) OR (iban ~ '^[0-9]{21}$'::text)));
alter table public.payout_accounts add constraint payout_accounts_method_check CHECK ((method = ANY (ARRAY['iban'::text, 'express'::text])));
alter table public.payout_requests add constraint payout_requests_admin_note_check CHECK (((admin_note IS NULL) OR (char_length(admin_note) <= 500)));
alter table public.payout_requests add constraint payout_requests_amount_check CHECK ((amount > (0)::numeric));
alter table public.payout_requests add constraint payout_requests_bank_reference_check CHECK (((bank_reference IS NULL) OR (char_length(bank_reference) <= 120)));
alter table public.payout_requests add constraint payout_requests_method_check CHECK ((method = ANY (ARRAY['iban'::text, 'express'::text])));
alter table public.payout_requests add constraint payout_requests_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'processing'::text, 'paid'::text, 'rejected'::text, 'cancelled'::text])));
alter table public.photo_search_usage add constraint photo_search_usage_count_check CHECK ((count >= 0));
alter table public.platform_settings add constraint platform_settings_agent_daily_cap_check CHECK (((agent_daily_cap >= 1) AND (agent_daily_cap <= 500)));
alter table public.platform_settings add constraint platform_settings_agent_fee_kz_check CHECK (((agent_fee_kz >= (0)::numeric) AND (agent_fee_kz <= (100000)::numeric)));
alter table public.platform_settings add constraint platform_settings_agent_sale_pct_check CHECK (((agent_sale_pct >= (0)::numeric) AND (agent_sale_pct <= (20)::numeric)));
alter table public.platform_settings add constraint platform_settings_auto_release_days_check CHECK (((auto_release_days >= 1) AND (auto_release_days <= 30)));
alter table public.platform_settings add constraint platform_settings_boost_days_check CHECK (((boost_days >= 1) AND (boost_days <= 60)));
alter table public.platform_settings add constraint platform_settings_boost_price_kz_check CHECK ((boost_price_kz >= (0)::numeric));
alter table public.platform_settings add constraint platform_settings_business_monthly_kz_check CHECK ((business_monthly_kz >= (0)::numeric));
alter table public.platform_settings add constraint platform_settings_claim_days_check CHECK (((claim_days >= 1) AND (claim_days <= 60)));
alter table public.platform_settings add constraint platform_settings_commission_due_days_check CHECK (((commission_due_days >= 1) AND (commission_due_days <= 90)));
alter table public.platform_settings add constraint platform_settings_event_boost_days_check CHECK (((event_boost_days >= 1) AND (event_boost_days <= 60)));
alter table public.platform_settings add constraint platform_settings_event_boost_price_kz_check CHECK ((event_boost_price_kz >= (0)::numeric));
alter table public.platform_settings add constraint platform_settings_event_payment_hours_check CHECK (((event_payment_hours >= 1) AND (event_payment_hours <= 240)));
alter table public.platform_settings add constraint platform_settings_event_ticket_fee_pct_check CHECK (((event_ticket_fee_pct >= (0)::numeric) AND (event_ticket_fee_pct <= (30)::numeric)));
alter table public.platform_settings add constraint platform_settings_fuel_fee_pct_check CHECK (((fuel_fee_pct >= (0)::numeric) AND (fuel_fee_pct <= (30)::numeric)));
alter table public.platform_settings add constraint platform_settings_fuel_pay_minutes_check CHECK (((fuel_pay_minutes >= 10) AND (fuel_pay_minutes <= 1440)));
alter table public.platform_settings add constraint platform_settings_id_check CHECK ((id = 1));
alter table public.platform_settings add constraint platform_settings_inspection_fee_kz_check CHECK ((inspection_fee_kz >= (0)::numeric));
alter table public.platform_settings add constraint platform_settings_inspection_fee_provider_kz_check CHECK ((inspection_fee_provider_kz >= (0)::numeric));
alter table public.platform_settings add constraint platform_settings_inspection_valid_months_check CHECK (((inspection_valid_months >= 1) AND (inspection_valid_months <= 60)));
alter table public.platform_settings add constraint platform_settings_listing_commission_pct_check CHECK (((listing_commission_pct >= (0)::numeric) AND (listing_commission_pct <= (50)::numeric)));
alter table public.platform_settings add constraint platform_settings_payment_accounts_check CHECK (((jsonb_typeof(payment_accounts) = 'array'::text) AND (jsonb_array_length(payment_accounts) <= 6)));
alter table public.platform_settings add constraint platform_settings_payment_note_check CHECK (((payment_note IS NULL) OR (char_length(payment_note) <= 500)));
alter table public.platform_settings add constraint platform_settings_payment_provider_check CHECK ((payment_provider = ANY (ARRAY['manual'::text, 'proxypay'::text])));
alter table public.platform_settings add constraint platform_settings_payment_window_hours_check CHECK (((payment_window_hours >= 1) AND (payment_window_hours <= 168)));
alter table public.platform_settings add constraint platform_settings_payout_min_kz_check CHECK ((payout_min_kz >= (0)::numeric));
alter table public.platform_settings add constraint platform_settings_payout_weekdays_check CHECK (((payout_weekdays <@ ARRAY[1, 2, 3, 4, 5, 6, 7]) AND ((cardinality(payout_weekdays) >= 1) AND (cardinality(payout_weekdays) <= 7))));
alter table public.platform_settings add constraint platform_settings_promo_boost_days_check CHECK (((promo_boost_days >= 1) AND (promo_boost_days <= 60)));
alter table public.platform_settings add constraint platform_settings_promo_boost_price_kz_check CHECK ((promo_boost_price_kz >= (0)::numeric));
alter table public.platform_settings add constraint platform_settings_protected_fee_pct_check CHECK (((protected_fee_pct >= (0)::numeric) AND (protected_fee_pct <= (20)::numeric)));
alter table public.platform_settings add constraint platform_settings_provider_monthly_kz_check CHECK ((provider_monthly_kz >= (0)::numeric));
alter table public.platform_settings add constraint platform_settings_proxypay_entity_check CHECK (((proxypay_entity IS NULL) OR (proxypay_entity ~ '^[0-9]{3,6}$'::text)));
alter table public.platform_settings add constraint platform_settings_referral_reward_days_check CHECK (((referral_reward_days >= 0) AND (referral_reward_days <= 365)));
alter table public.platform_settings add constraint platform_settings_safe_spots_check CHECK (((jsonb_typeof(safe_spots) = 'array'::text) AND (jsonb_array_length(safe_spots) <= 20)));
alter table public.platform_settings add constraint platform_settings_store_monthly_kz_check CHECK ((store_monthly_kz >= (0)::numeric));
alter table public.platform_settings add constraint platform_settings_trial_days_check CHECK (((trial_days >= 0) AND (trial_days <= 365)));
alter table public.platform_settings add constraint platform_settings_venue_business_fee_pct_check CHECK (((venue_business_fee_pct >= (0)::numeric) AND (venue_business_fee_pct <= (20)::numeric)));
alter table public.platform_settings add constraint platform_settings_venue_client_fee_pct_check CHECK (((venue_client_fee_pct >= (0)::numeric) AND (venue_client_fee_pct <= (20)::numeric)));
alter table public.platform_settings add constraint platform_settings_venue_pay_minutes_check CHECK (((venue_pay_minutes >= 15) AND (venue_pay_minutes <= 2880)));
alter table public.portfolio_items add constraint portfolio_items_check CHECK (((provider_id IS NULL) <> (business_id IS NULL)));
alter table public.portfolio_items add constraint portfolio_items_description_check CHECK (((description IS NULL) OR (char_length(description) <= 1000)));
alter table public.portfolio_items add constraint portfolio_items_done_on_check CHECK (((done_on IS NULL) OR (done_on <= (CURRENT_DATE + 1))));
alter table public.portfolio_items add constraint portfolio_items_photos_check CHECK (((cardinality(photos) >= 1) AND (cardinality(photos) <= 8)));
alter table public.portfolio_items add constraint portfolio_items_title_check CHECK (((char_length(TRIM(BOTH FROM title)) >= 2) AND (char_length(TRIM(BOTH FROM title)) <= 120)));
alter table public.products add constraint products_stock_check CHECK ((stock >= 0));
alter table public.products add constraint products_video_url_check CHECK (((video_url IS NULL) OR (video_url ~ '^https://[^ ]+/storage/v1/object/public/media-videos/'::text)));
alter table public.profiles add constraint profiles_kyc_level_check CHECK (((kyc_level >= 0) AND (kyc_level <= 3)));
alter table public.profiles add constraint profiles_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'banned'::text])));
alter table public.profiles add constraint profiles_trust_score_check CHECK (((trust_score >= 0) AND (trust_score <= 100)));
alter table public.profiles add constraint profiles_whatsapp_check CHECK (((whatsapp IS NULL) OR (whatsapp ~ '^[0-9]{10,15}$'::text)));
alter table public.promo_boosts add constraint promo_boosts_amount_check CHECK ((amount >= (0)::numeric));
alter table public.promo_boosts add constraint promo_boosts_days_check CHECK (((days >= 1) AND (days <= 60)));
alter table public.promo_boosts add constraint promo_boosts_method_check CHECK ((method = ANY (ARRAY['bank_transfer'::text, 'multicaixa_express'::text, 'cash'::text])));
alter table public.promo_boosts add constraint promo_boosts_reference_check CHECK (((reference IS NULL) OR (char_length(reference) <= 120)));
alter table public.promo_boosts add constraint promo_boosts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text])));
alter table public.promo_posts add constraint promo_posts_check CHECK (((kind <> 'video'::text) OR (video_url IS NOT NULL) OR (external_url IS NOT NULL)));
alter table public.promo_posts add constraint promo_posts_check1 CHECK (((kind <> 'live'::text) OR ((external_url IS NOT NULL) AND (live_starts_at IS NOT NULL) AND (live_ends_at > live_starts_at))));
alter table public.promo_posts add constraint promo_posts_cover_url_check CHECK (((cover_url IS NULL) OR (cover_url ~ '^https://'::text)));
alter table public.promo_posts add constraint promo_posts_description_check CHECK (((description IS NULL) OR (char_length(description) <= 1000)));
alter table public.promo_posts add constraint promo_posts_external_url_check CHECK (((external_url IS NULL) OR (external_url ~* '^https://([a-z0-9-]+\.)*(youtube\.com|youtu\.be|facebook\.com|fb\.watch|tiktok\.com|instagram\.com)(/|$)'::text)));
alter table public.promo_posts add constraint promo_posts_kind_check CHECK ((kind = ANY (ARRAY['video'::text, 'live'::text])));
alter table public.promo_posts add constraint promo_posts_status_check CHECK ((status = ANY (ARRAY['published'::text, 'hidden'::text])));
alter table public.promo_posts add constraint promo_posts_subject_kind_check CHECK ((subject_kind = ANY (ARRAY['provider'::text, 'business'::text, 'store'::text])));
alter table public.promo_posts add constraint promo_posts_title_check CHECK (((char_length(title) >= 4) AND (char_length(title) <= 120)));
alter table public.promo_posts add constraint promo_posts_video_url_check CHECK (((video_url IS NULL) OR (video_url ~ '^https://[^ ]+/storage/v1/object/public/media-videos/'::text)));
alter table public.provider_profiles add constraint provider_profiles_custom_category_check CHECK (((custom_category IS NULL) OR ((char_length(TRIM(BOTH FROM custom_category)) >= 2) AND (char_length(TRIM(BOTH FROM custom_category)) <= 60))));
alter table public.provider_profiles add constraint provider_profiles_directions_check CHECK (((directions IS NULL) OR (char_length(directions) <= 300)));
alter table public.provider_profiles add constraint provider_profiles_geo_check CHECK ((((geo_lat IS NULL) AND (geo_lng IS NULL)) OR ((geo_lat IS NOT NULL) AND (geo_lng IS NOT NULL) AND ((geo_lat >= '-18.1'::numeric) AND (geo_lat <= '-4.3'::numeric)) AND ((geo_lng >= 11.6) AND (geo_lng <= 24.2)))));
alter table public.referral_codes add constraint referral_codes_code_check CHECK ((code ~ '^[A-Z2-9]{6}$'::text));
alter table public.referrals add constraint referrals_check CHECK ((referred_id <> referrer_id));
alter table public.referrals add constraint referrals_status_check CHECK ((status = ANY (ARRAY['joined'::text, 'earned'::text, 'rewarded'::text])));
alter table public.rental_requests add constraint rental_requests_proposed_price_check CHECK ((proposed_price >= (0)::numeric));
alter table public.rental_requests add constraint rental_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'cancelled'::text, 'expired'::text])));
alter table public.rental_requests add constraint rental_window_valid CHECK ((ends_at > starts_at));
alter table public.reviews add constraint reviews_check CHECK (((((((business_id IS NOT NULL))::integer + ((provider_id IS NOT NULL))::integer) + ((product_id IS NOT NULL))::integer) + ((service_id IS NOT NULL))::integer) = 1));
alter table public.reviews add constraint reviews_owner_reply_check CHECK (((owner_reply IS NULL) OR (char_length(owner_reply) <= 1000)));
alter table public.reviews add constraint reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
alter table public.reviews add constraint reviews_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'published'::text, 'hidden'::text, 'rejected'::text])));
alter table public.saved_items add constraint saved_items_check CHECK (((((((((business_id IS NOT NULL))::integer + ((provider_id IS NOT NULL))::integer) + ((service_id IS NOT NULL))::integer) + ((product_id IS NOT NULL))::integer) + ((auction_id IS NOT NULL))::integer) + ((classified_listing_id IS NOT NULL))::integer) = 1));
alter table public.seller_delivery_settings add constraint seller_delivery_settings_check CHECK ((pickup_enabled OR delivery_enabled));
alter table public.seller_delivery_settings add constraint seller_delivery_settings_default_fee_check CHECK (((default_fee IS NULL) OR ((default_fee >= (0)::numeric) AND (default_fee <= (10000000)::numeric))));
alter table public.seller_delivery_settings add constraint seller_delivery_settings_delivery_days_check CHECK (((delivery_days IS NULL) OR (char_length(delivery_days) <= 120)));
alter table public.seller_delivery_settings add constraint seller_delivery_settings_free_over_check CHECK (((free_over IS NULL) OR ((free_over > (0)::numeric) AND (free_over <= (1000000000)::numeric))));
alter table public.seller_delivery_settings add constraint seller_delivery_settings_min_order_check CHECK (((min_order IS NULL) OR ((min_order > (0)::numeric) AND (min_order <= (1000000000)::numeric))));
alter table public.seller_delivery_settings add constraint seller_delivery_settings_note_check CHECK (((note IS NULL) OR (char_length(note) <= 300)));
alter table public.seller_delivery_settings add constraint seller_delivery_settings_pickup_place_check CHECK (((pickup_place IS NULL) OR (char_length(pickup_place) <= 300)));
alter table public.seller_delivery_zones add constraint seller_delivery_zones_fee_check CHECK (((fee >= (0)::numeric) AND (fee <= (10000000)::numeric)));
alter table public.service_requests add constraint service_requests_check CHECK (((((provider_id IS NOT NULL))::integer + ((business_id IS NOT NULL))::integer) = 1));
alter table public.service_requests add constraint service_requests_description_check CHECK (((char_length(TRIM(BOTH FROM description)) >= 3) AND (char_length(TRIM(BOTH FROM description)) <= 1000)));
alter table public.service_requests add constraint service_requests_provider_note_check CHECK (((provider_note IS NULL) OR (char_length(provider_note) <= 500)));
alter table public.service_requests add constraint service_requests_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'accepted'::text, 'declined'::text, 'done'::text, 'confirmed'::text, 'cancelled'::text])));
alter table public.subscription_payments add constraint subscription_payments_admin_note_check CHECK (((admin_note IS NULL) OR (char_length(admin_note) <= 500)));
alter table public.subscription_payments add constraint subscription_payments_amount_check CHECK ((amount >= (0)::numeric));
alter table public.subscription_payments add constraint subscription_payments_method_check CHECK ((method = ANY (ARRAY['bank_transfer'::text, 'multicaixa_express'::text, 'cash'::text])));
alter table public.subscription_payments add constraint subscription_payments_months_check CHECK (((months >= 1) AND (months <= 12)));
alter table public.subscription_payments add constraint subscription_payments_proof_path_check CHECK (((proof_path IS NULL) OR (proof_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,140}$'::text)));
alter table public.subscription_payments add constraint subscription_payments_reference_check CHECK (((reference IS NULL) OR (char_length(reference) <= 120)));
alter table public.subscription_payments add constraint subscription_payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text])));
alter table public.subscriptions add constraint subscriptions_kind_check CHECK ((kind = ANY (ARRAY['provider'::text, 'business'::text, 'store'::text])));
alter table public.subscriptions add constraint subscriptions_subject_check CHECK (((num_nonnulls(provider_id, business_id, seller_id) = 1) AND ((kind = 'provider'::text) = (provider_id IS NOT NULL)) AND ((kind = 'business'::text) = (business_id IS NOT NULL)) AND ((kind = 'store'::text) = (seller_id IS NOT NULL))));
alter table public.user_blocks add constraint user_blocks_check CHECK ((blocker_id <> blocked_id));
alter table public.user_reviews add constraint user_reviews_check CHECK ((author_id <> target_id));
alter table public.user_reviews add constraint user_reviews_check1 CHECK (((((order_id IS NOT NULL))::integer + ((listing_id IS NOT NULL))::integer) = 1));
alter table public.user_reviews add constraint user_reviews_comment_check CHECK (((comment IS NULL) OR (char_length(comment) <= 1000)));
alter table public.user_reviews add constraint user_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
alter table public.user_reviews add constraint user_reviews_reply_check CHECK (((reply IS NULL) OR (char_length(reply) <= 1000)));
alter table public.user_reviews add constraint user_reviews_role_check CHECK ((role = ANY (ARRAY['seller'::text, 'buyer'::text])));
alter table public.user_reviews add constraint user_reviews_status_check CHECK ((status = ANY (ARRAY['published'::text, 'hidden'::text])));
alter table public.user_roles add constraint user_roles_role_check CHECK ((role = ANY (ARRAY['user'::text, 'moderator'::text, 'admin'::text])));
alter table public.venue_items add constraint venue_items_capacity_check CHECK (((capacity IS NULL) OR ((capacity >= 1) AND (capacity <= 30))));
alter table public.venue_items add constraint venue_items_description_check CHECK (((description IS NULL) OR (char_length(description) <= 600)));
alter table public.venue_items add constraint venue_items_min_qty_check CHECK ((min_qty > (0)::numeric));
alter table public.venue_items add constraint venue_items_name_check CHECK (((char_length(name) >= 2) AND (char_length(name) <= 100)));
alter table public.venue_items add constraint venue_items_photos_check CHECK ((cardinality(photos) <= 6));
alter table public.venue_items add constraint venue_items_price_check CHECK (((price >= (0)::numeric) AND (price <= (100000000)::numeric)));
alter table public.venue_items add constraint venue_items_qty_total_check CHECK (((qty_total IS NULL) OR (qty_total >= (0)::numeric)));
alter table public.venue_items add constraint venue_items_section_check CHECK (((section IS NULL) OR (char_length(section) <= 40)));
alter table public.venue_items add constraint venue_items_unit_check CHECK (((unit IS NULL) OR (char_length(unit) <= 24)));
alter table public.venue_order_lines add constraint venue_order_lines_line_total_check CHECK ((line_total >= (0)::numeric));
alter table public.venue_order_lines add constraint venue_order_lines_qty_check CHECK ((qty > (0)::numeric));
alter table public.venue_order_lines add constraint venue_order_lines_unit_price_check CHECK ((unit_price >= (0)::numeric));
alter table public.venue_orders add constraint venue_orders_buyer_name_check CHECK (((char_length(buyer_name) >= 2) AND (char_length(buyer_name) <= 80)));
alter table public.venue_orders add constraint venue_orders_buyer_note_check CHECK (((buyer_note IS NULL) OR (char_length(buyer_note) <= 300)));
alter table public.venue_orders add constraint venue_orders_buyer_phone_check CHECK (((buyer_phone IS NULL) OR (char_length(buyer_phone) <= 20)));
alter table public.venue_orders add constraint venue_orders_check CHECK (((kind <> 'stay'::text) OR ((check_in IS NOT NULL) AND (check_out > check_in))));
alter table public.venue_orders add constraint venue_orders_guests_check CHECK (((guests IS NULL) OR ((guests >= 1) AND (guests <= 200))));
alter table public.venue_orders add constraint venue_orders_kind_check CHECK ((kind = ANY (ARRAY['stay'::text, 'table'::text, 'order'::text])));
alter table public.venue_orders add constraint venue_orders_method_check CHECK ((method = ANY (ARRAY['at_place'::text, 'prepaid'::text])));
alter table public.venue_orders add constraint venue_orders_note_check CHECK (((note IS NULL) OR (char_length(note) <= 500)));
alter table public.venue_orders add constraint venue_orders_pay_method_check CHECK (((pay_method IS NULL) OR (pay_method = ANY (ARRAY['bank_transfer'::text, 'multicaixa_express'::text]))));
alter table public.venue_orders add constraint venue_orders_reference_check CHECK (((reference IS NULL) OR (char_length(reference) <= 120)));
alter table public.venue_orders add constraint venue_orders_status_check CHECK ((status = ANY (ARRAY['reserved'::text, 'awaiting_payment'::text, 'submitted'::text, 'paid'::text, 'completed'::text, 'cancelled'::text, 'expired'::text, 'rejected'::text])));
alter table public.venue_orders add constraint venue_orders_subtotal_check CHECK ((subtotal >= (0)::numeric));
alter table public.venue_orders add constraint venue_orders_total_check CHECK ((total >= (0)::numeric));
alter table public.venue_pay add constraint venue_pay_express_check CHECK (((express IS NULL) OR (char_length(express) <= 20)));
alter table public.venue_pay add constraint venue_pay_holder_check CHECK (((holder IS NULL) OR (char_length(holder) <= 80)));
alter table public.venue_pay add constraint venue_pay_iban_check CHECK (((iban IS NULL) OR (char_length(iban) <= 40)));
alter table public.venue_pay add constraint venue_pay_note_check CHECK (((note IS NULL) OR (char_length(note) <= 200)));
alter table public.venue_platform_payments add constraint venue_platform_payments_amount_check CHECK ((amount >= (0)::numeric));
alter table public.venue_platform_payments add constraint venue_platform_payments_method_check CHECK ((method = ANY (ARRAY['bank_transfer'::text, 'multicaixa_express'::text, 'cash'::text])));
alter table public.venue_platform_payments add constraint venue_platform_payments_proof_path_check CHECK (((proof_path IS NULL) OR (proof_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,140}$'::text)));
alter table public.venue_platform_payments add constraint venue_platform_payments_reference_check CHECK (((reference IS NULL) OR (char_length(reference) <= 120)));
alter table public.venue_platform_payments add constraint venue_platform_payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text])));
alter table public.venues add constraint venues_check_in_time_check CHECK (((check_in_time IS NULL) OR (check_in_time ~ '^[0-2][0-9]:[0-5][0-9]$'::text)));
alter table public.venues add constraint venues_check_out_time_check CHECK (((check_out_time IS NULL) OR (check_out_time ~ '^[0-2][0-9]:[0-5][0-9]$'::text)));
alter table public.venues add constraint venues_hold_minutes_check CHECK (((hold_minutes >= 15) AND (hold_minutes <= 1440)));
alter table public.venues add constraint venues_kind_check CHECK ((kind = ANY (ARRAY['hotel'::text, 'restaurant'::text, 'warehouse'::text])));
alter table public.venues add constraint venues_opening_hours_check CHECK (((opening_hours IS NULL) OR (char_length(opening_hours) <= 120)));
alter table public.venues add constraint venues_policies_check CHECK (((policies IS NULL) OR (char_length(policies) <= 600)));
alter table public.venues add constraint venues_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'suspended'::text])));
alter table public.venues add constraint venues_subtype_check CHECK ((subtype = ANY (ARRAY['hotel'::text, 'resort'::text, 'hospedaria'::text, 'casa_passagem'::text, 'pensao'::text, 'lodge'::text, 'apartamento'::text, 'restaurante'::text, 'snack_bar'::text, 'churrasqueira'::text, 'pastelaria'::text, 'take_away'::text, 'armazem'::text, 'distribuidora'::text, 'cash_carry'::text])));
alter table public.verification_requests add constraint verification_requests_admin_note_check CHECK (((admin_note IS NULL) OR (char_length(admin_note) <= 500)));
alter table public.verification_requests add constraint verification_requests_back_path_check CHECK (((back_path IS NULL) OR (back_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'::text)));
alter table public.verification_requests add constraint verification_requests_check CHECK (((kind = 'business'::text) = (business_id IS NOT NULL)));
alter table public.verification_requests add constraint verification_requests_document_path_check CHECK (((document_path IS NULL) OR (document_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'::text)));
alter table public.verification_requests add constraint verification_requests_id_number_check CHECK (((id_number IS NULL) OR (id_number ~ '^[0-9]{9}[A-Z]{2}[0-9]{3}$'::text)));
alter table public.verification_requests add constraint verification_requests_kind_check CHECK ((kind = ANY (ARRAY['identity'::text, 'provider'::text, 'business'::text])));
alter table public.verification_requests add constraint verification_requests_note_check CHECK (((note IS NULL) OR (char_length(note) <= 500)));
alter table public.verification_requests add constraint verification_requests_selfie_path_check CHECK (((selfie_path IS NULL) OR (selfie_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'::text)));
alter table public.verification_requests add constraint verification_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
alter table public.wallet_entries add constraint wallet_entries_amount_check CHECK ((amount <> (0)::numeric));
alter table public.wallet_entries add constraint wallet_entries_bucket_check CHECK ((bucket = ANY (ARRAY['pending'::text, 'available'::text])));
alter table public.wallet_entries add constraint wallet_entries_kind_check CHECK ((kind = ANY (ARRAY['sale'::text, 'release'::text, 'fee'::text, 'refund'::text, 'payout'::text, 'payout_returned'::text, 'adjustment'::text, 'agent'::text])));
alter table public.wallet_entries add constraint wallet_entries_note_check CHECK (((note IS NULL) OR (char_length(note) <= 300)));

-- Chaves estrangeiras
alter table public.account_capabilities add constraint account_capabilities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.addresses add constraint addresses_street_id_fkey FOREIGN KEY (street_id) REFERENCES streets(id) ON DELETE SET NULL;
alter table public.admin_audit_log add constraint admin_audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.agent_commissions add constraint agent_commissions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES field_agents(user_id) ON DELETE CASCADE;
alter table public.agent_commissions add constraint agent_commissions_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.agent_commissions add constraint agent_commissions_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES classified_listings(id) ON DELETE SET NULL;
alter table public.agent_commissions add constraint agent_commissions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.auction_bids add constraint auction_bids_auction_id_fkey FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE;
alter table public.auction_bids add constraint auction_bids_bidder_id_fkey FOREIGN KEY (bidder_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.auction_bids add constraint auction_bids_retracted_by_fkey FOREIGN KEY (retracted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.auction_max_bids add constraint auction_max_bids_auction_id_fkey FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE;
alter table public.auction_max_bids add constraint auction_max_bids_bidder_id_fkey FOREIGN KEY (bidder_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.auction_max_bids add constraint auction_max_bids_retracted_by_fkey FOREIGN KEY (retracted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.auctions add constraint auctions_classified_listing_id_fkey FOREIGN KEY (classified_listing_id) REFERENCES classified_listings(id) ON DELETE SET NULL;
alter table public.auctions add constraint auctions_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
alter table public.auctions add constraint auctions_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.auctions add constraint auctions_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.businesses add constraint businesses_address_id_fkey FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL;
alter table public.businesses add constraint businesses_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
alter table public.businesses add constraint businesses_market_id_fkey FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE SET NULL;
alter table public.businesses add constraint businesses_municipality_id_fkey FOREIGN KEY (municipality_id) REFERENCES municipalities(id);
alter table public.businesses add constraint businesses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
alter table public.businesses add constraint businesses_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cart_items add constraint cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE;
alter table public.cart_items add constraint cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
alter table public.carts add constraint carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.classified_listings add constraint classified_listings_address_id_fkey FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL;
alter table public.classified_listings add constraint classified_listings_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES field_agents(user_id) ON DELETE SET NULL;
alter table public.classified_listings add constraint classified_listings_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
alter table public.classified_listings add constraint classified_listings_deal_with_fkey FOREIGN KEY (deal_with) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.classified_listings add constraint classified_listings_market_id_fkey FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE SET NULL;
alter table public.classified_listings add constraint classified_listings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.classified_saved_searches add constraint classified_saved_searches_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.communes add constraint communes_municipality_id_fkey FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE CASCADE;
alter table public.conversation_participants add constraint conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
alter table public.conversation_participants add constraint conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.conversations add constraint conversations_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;
alter table public.conversations add constraint conversations_classified_listing_id_fkey FOREIGN KEY (classified_listing_id) REFERENCES classified_listings(id) ON DELETE SET NULL;
alter table public.conversations add constraint conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.conversations add constraint conversations_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
alter table public.conversations add constraint conversations_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
alter table public.conversations add constraint conversations_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.conversations add constraint conversations_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;
alter table public.couriers add constraint couriers_municipality_id_fkey FOREIGN KEY (municipality_id) REFERENCES municipalities(id);
alter table public.couriers add constraint couriers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.delivery_requests add constraint delivery_requests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.delivery_requests add constraint delivery_requests_dropoff_address_id_fkey FOREIGN KEY (dropoff_address_id) REFERENCES addresses(id) ON DELETE SET NULL;
alter table public.delivery_requests add constraint delivery_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.delivery_requests add constraint delivery_requests_pickup_address_id_fkey FOREIGN KEY (pickup_address_id) REFERENCES addresses(id) ON DELETE SET NULL;
alter table public.delivery_requests add constraint delivery_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public.event_orders add constraint event_orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.event_orders add constraint event_orders_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public.event_orders add constraint event_orders_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES event_ticket_types(id) ON DELETE RESTRICT;
alter table public.event_payment_info add constraint event_payment_info_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public.event_platform_payments add constraint event_platform_payments_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.event_platform_payments add constraint event_platform_payments_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public.event_platform_payments add constraint event_platform_payments_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.event_ticket_types add constraint event_ticket_types_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public.event_tickets add constraint event_tickets_checked_in_by_fkey FOREIGN KEY (checked_in_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.event_tickets add constraint event_tickets_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public.event_tickets add constraint event_tickets_holder_id_fkey FOREIGN KEY (holder_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.event_tickets add constraint event_tickets_order_id_fkey FOREIGN KEY (order_id) REFERENCES event_orders(id) ON DELETE CASCADE;
alter table public.event_tickets add constraint event_tickets_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES event_ticket_types(id) ON DELETE RESTRICT;
alter table public.events add constraint events_municipality_id_fkey FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE SET NULL;
alter table public.events add constraint events_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.field_agents add constraint field_agents_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.field_agents add constraint field_agents_market_id_fkey FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE SET NULL;
alter table public.field_agents add constraint field_agents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.followed_businesses add constraint followed_businesses_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
alter table public.followed_businesses add constraint followed_businesses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.followed_providers add constraint followed_providers_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.followed_providers add constraint followed_providers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.followed_sellers add constraint followed_sellers_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.followed_sellers add constraint followed_sellers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.fuel_alerts add constraint fuel_alerts_municipality_id_fkey FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE CASCADE;
alter table public.fuel_alerts add constraint fuel_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.fuel_orders add constraint fuel_orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.fuel_orders add constraint fuel_orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES fuel_products(id) ON DELETE CASCADE;
alter table public.fuel_orders add constraint fuel_orders_station_id_fkey FOREIGN KEY (station_id) REFERENCES fuel_stations(id) ON DELETE CASCADE;
alter table public.fuel_platform_payments add constraint fuel_platform_payments_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.fuel_platform_payments add constraint fuel_platform_payments_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.fuel_platform_payments add constraint fuel_platform_payments_station_id_fkey FOREIGN KEY (station_id) REFERENCES fuel_stations(id) ON DELETE CASCADE;
alter table public.fuel_products add constraint fuel_products_station_id_fkey FOREIGN KEY (station_id) REFERENCES fuel_stations(id) ON DELETE CASCADE;
alter table public.fuel_reports add constraint fuel_reports_product_id_fkey FOREIGN KEY (product_id) REFERENCES fuel_products(id) ON DELETE CASCADE;
alter table public.fuel_reports add constraint fuel_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.fuel_station_pay add constraint fuel_station_pay_station_id_fkey FOREIGN KEY (station_id) REFERENCES fuel_stations(id) ON DELETE CASCADE;
alter table public.fuel_stations add constraint fuel_stations_municipality_id_fkey FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE SET NULL;
alter table public.fuel_stations add constraint fuel_stations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.inspections add constraint inspections_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.item_stats_daily add constraint item_stats_daily_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.listing_boosts add constraint listing_boosts_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.listing_boosts add constraint listing_boosts_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES classified_listings(id) ON DELETE CASCADE;
alter table public.listing_boosts add constraint listing_boosts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.listing_claims add constraint listing_claims_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.listing_claims add constraint listing_claims_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES classified_listings(id) ON DELETE SET NULL;
alter table public.listing_claims add constraint listing_claims_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.listing_commissions add constraint listing_commissions_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.listing_commissions add constraint listing_commissions_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES classified_listings(id) ON DELETE CASCADE;
alter table public.listing_commissions add constraint listing_commissions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.listing_commissions add constraint listing_commissions_rental_request_id_fkey FOREIGN KEY (rental_request_id) REFERENCES rental_requests(id) ON DELETE SET NULL;
alter table public.listing_offers add constraint listing_offers_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.listing_offers add constraint listing_offers_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES classified_listings(id) ON DELETE CASCADE;
alter table public.markets add constraint markets_municipality_id_fkey FOREIGN KEY (municipality_id) REFERENCES municipalities(id);
alter table public.markets add constraint markets_suggested_by_fkey FOREIGN KEY (suggested_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.messages add constraint messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
alter table public.messages add constraint messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.moderation_reports add constraint moderation_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.moderation_reports add constraint moderation_reports_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.municipalities add constraint municipalities_province_id_fkey FOREIGN KEY (province_id) REFERENCES provinces(id) ON DELETE CASCADE;
alter table public.neighborhoods add constraint neighborhoods_municipality_id_fkey FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE CASCADE;
alter table public.notification_preferences add constraint notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.order_dispute_events add constraint order_dispute_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.order_dispute_events add constraint order_dispute_events_dispute_id_fkey FOREIGN KEY (dispute_id) REFERENCES order_disputes(id) ON DELETE CASCADE;
alter table public.order_disputes add constraint order_disputes_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.order_disputes add constraint order_disputes_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.order_disputes add constraint order_disputes_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.order_items add constraint order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.order_items add constraint order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
alter table public.order_items add constraint order_items_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public.order_payments add constraint order_payments_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.order_payments add constraint order_payments_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.order_payments add constraint order_payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.orders add constraint orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public.orders add constraint orders_delivery_address_id_fkey FOREIGN KEY (delivery_address_id) REFERENCES addresses(id) ON DELETE SET NULL;
alter table public.orders add constraint orders_delivery_municipality_id_fkey FOREIGN KEY (delivery_municipality_id) REFERENCES municipalities(id) ON DELETE SET NULL;
alter table public.orders add constraint orders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id);
alter table public.organization_members add constraint organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.organization_members add constraint organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.organizations add constraint organizations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.payout_accounts add constraint payout_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.payout_requests add constraint payout_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.payout_requests add constraint payout_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public.photo_search_usage add constraint photo_search_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.portfolio_items add constraint portfolio_items_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
alter table public.portfolio_items add constraint portfolio_items_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.portfolio_items add constraint portfolio_items_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES provider_profiles(user_id) ON DELETE CASCADE;
alter table public.products add constraint products_address_id_fkey FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL;
alter table public.products add constraint products_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;
alter table public.products add constraint products_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
alter table public.products add constraint products_market_id_fkey FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE SET NULL;
alter table public.products add constraint products_municipality_id_fkey FOREIGN KEY (municipality_id) REFERENCES municipalities(id);
alter table public.products add constraint products_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.promo_boosts add constraint promo_boosts_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.promo_boosts add constraint promo_boosts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.promo_boosts add constraint promo_boosts_post_id_fkey FOREIGN KEY (post_id) REFERENCES promo_posts(id) ON DELETE CASCADE;
alter table public.promo_posts add constraint promo_posts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.provider_profiles add constraint provider_profiles_address_id_fkey FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL;
alter table public.provider_profiles add constraint provider_profiles_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
alter table public.provider_profiles add constraint provider_profiles_municipality_id_fkey FOREIGN KEY (municipality_id) REFERENCES municipalities(id);
alter table public.provider_profiles add constraint provider_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.referral_codes add constraint referral_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.referrals add constraint referrals_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.referrals add constraint referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.referrals add constraint referrals_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL;
alter table public.rental_requests add constraint rental_requests_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES classified_listings(id) ON DELETE CASCADE;
alter table public.rental_requests add constraint rental_requests_renter_id_fkey FOREIGN KEY (renter_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.reviews add constraint reviews_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.reviews add constraint reviews_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
alter table public.reviews add constraint reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
alter table public.reviews add constraint reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table public.reviews add constraint reviews_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.reviews add constraint reviews_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;
alter table public.reviews add constraint reviews_service_request_id_fkey FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE SET NULL;
alter table public.saved_items add constraint saved_items_auction_id_fkey FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE;
alter table public.saved_items add constraint saved_items_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
alter table public.saved_items add constraint saved_items_classified_listing_id_fkey FOREIGN KEY (classified_listing_id) REFERENCES classified_listings(id) ON DELETE CASCADE;
alter table public.saved_items add constraint saved_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table public.saved_items add constraint saved_items_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.saved_items add constraint saved_items_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;
alter table public.saved_items add constraint saved_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.saved_search_notification_queue add constraint saved_search_notification_queue_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES classified_listings(id) ON DELETE CASCADE;
alter table public.saved_search_notification_queue add constraint saved_search_notification_queue_saved_search_id_fkey FOREIGN KEY (saved_search_id) REFERENCES classified_saved_searches(id) ON DELETE CASCADE;
alter table public.saved_search_notification_queue add constraint saved_search_notification_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.seller_delivery_settings add constraint seller_delivery_settings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.seller_delivery_zones add constraint seller_delivery_zones_municipality_id_fkey FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE CASCADE;
alter table public.seller_delivery_zones add constraint seller_delivery_zones_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.service_requests add constraint service_requests_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
alter table public.service_requests add constraint service_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.service_requests add constraint service_requests_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.services add constraint services_address_id_fkey FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL;
alter table public.services add constraint services_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;
alter table public.services add constraint services_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
alter table public.services add constraint services_municipality_id_fkey FOREIGN KEY (municipality_id) REFERENCES municipalities(id);
alter table public.services add constraint services_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.streets add constraint streets_neighborhood_id_fkey FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods(id) ON DELETE CASCADE;
alter table public.subscription_payments add constraint subscription_payments_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.subscription_payments add constraint subscription_payments_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.subscription_payments add constraint subscription_payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE;
alter table public.subscriptions add constraint subscriptions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_blocks add constraint user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_blocks add constraint user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_reviews add constraint user_reviews_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_reviews add constraint user_reviews_target_id_fkey FOREIGN KEY (target_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_roles add constraint user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.venue_items add constraint venue_items_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
alter table public.venue_order_lines add constraint venue_order_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES venue_items(id) ON DELETE CASCADE;
alter table public.venue_order_lines add constraint venue_order_lines_order_id_fkey FOREIGN KEY (order_id) REFERENCES venue_orders(id) ON DELETE CASCADE;
alter table public.venue_orders add constraint venue_orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.venue_orders add constraint venue_orders_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
alter table public.venue_pay add constraint venue_pay_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
alter table public.venue_platform_payments add constraint venue_platform_payments_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.venue_platform_payments add constraint venue_platform_payments_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.venue_platform_payments add constraint venue_platform_payments_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
alter table public.venues add constraint venues_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
alter table public.venues add constraint venues_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.verification_requests add constraint verification_requests_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
alter table public.verification_requests add constraint verification_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.verification_requests add constraint verification_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.wallet_entries add constraint wallet_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.wallet_entries add constraint wallet_entries_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
alter table public.wallet_entries add constraint wallet_entries_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES payout_requests(id) ON DELETE SET NULL;
alter table public.wallet_entries add constraint wallet_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- Índices
CREATE INDEX account_capabilities_user_id_idx ON public.account_capabilities USING btree (user_id);
CREATE INDEX addresses_coordinates_idx ON public.addresses USING btree (latitude, longitude);
CREATE INDEX addresses_street_id_idx ON public.addresses USING btree (street_id);
CREATE INDEX addresses_street_idx ON public.addresses USING btree (street_id);
CREATE INDEX admin_audit_log_actor_id_fk_idx ON public.admin_audit_log USING btree (actor_id);
CREATE INDEX admin_audit_log_created ON public.admin_audit_log USING btree (created_at DESC);
CREATE INDEX agent_commissions_agent_idx ON public.agent_commissions USING btree (agent_id, created_at DESC);
CREATE INDEX agent_commissions_decided_by_idx ON public.agent_commissions USING btree (decided_by);
CREATE INDEX agent_commissions_owner_idx ON public.agent_commissions USING btree (owner_id);
CREATE INDEX agent_commissions_status_idx ON public.agent_commissions USING btree (status, created_at);
CREATE INDEX auction_bids_active ON public.auction_bids USING btree (auction_id, amount DESC, created_at) WHERE (retracted_at IS NULL);
CREATE INDEX auction_bids_bidder_id_fk_idx ON public.auction_bids USING btree (bidder_id);
CREATE INDEX auction_bids_retracted_by_idx ON public.auction_bids USING btree (retracted_by);
CREATE INDEX auction_max_bids_bidder_id_idx ON public.auction_max_bids USING btree (bidder_id);
CREATE INDEX auction_max_bids_rank ON public.auction_max_bids USING btree (auction_id, max_amount DESC, max_set_at) WHERE (retracted_at IS NULL);
CREATE INDEX auction_max_bids_retracted_by_idx ON public.auction_max_bids USING btree (retracted_by);
CREATE INDEX auctions_classified_listing_idx ON public.auctions USING btree (classified_listing_id) WHERE (classified_listing_id IS NOT NULL);
CREATE INDEX auctions_product_id_fk_idx ON public.auctions USING btree (product_id);
CREATE INDEX auctions_seller_idx ON public.auctions USING btree (seller_id);
CREATE INDEX auctions_status_ends_idx ON public.auctions USING btree (status, ends_at);
CREATE INDEX auctions_winner_id_fk_idx ON public.auctions USING btree (winner_id);
CREATE INDEX bids_auction_created_idx ON public.auction_bids USING btree (auction_id, created_at DESC);
CREATE INDEX businesses_address_idx ON public.businesses USING btree (address_id);
CREATE INDEX businesses_category_active_idx ON public.businesses USING btree (category_id, active);
CREATE INDEX businesses_category_idx ON public.businesses USING btree (category_id);
CREATE INDEX businesses_market_idx ON public.businesses USING btree (market_id) WHERE (market_id IS NOT NULL);
CREATE INDEX businesses_municipality_idx ON public.businesses USING btree (municipality_id) WHERE active;
CREATE INDEX businesses_organization_id_fk_idx ON public.businesses USING btree (organization_id);
CREATE INDEX businesses_owner_id_fk_idx ON public.businesses USING btree (owner_id);
CREATE INDEX cart_items_cart_idx ON public.cart_items USING btree (cart_id);
CREATE INDEX cart_items_product_idx ON public.cart_items USING btree (product_id);
CREATE INDEX categories_active_type_idx ON public.categories USING btree (active, type, name);
CREATE INDEX classified_listings_address_idx ON public.classified_listings USING btree (address_id);
CREATE INDEX classified_listings_address_status_idx ON public.classified_listings USING btree (address_id, status) WHERE (status = 'published'::text);
CREATE INDEX classified_listings_agent_idx ON public.classified_listings USING btree (agent_id);
CREATE INDEX classified_listings_attributes_gin_idx ON public.classified_listings USING gin (attributes);
CREATE INDEX classified_listings_category_idx ON public.classified_listings USING btree (category_id, status);
CREATE INDEX classified_listings_deal_with_fk_idx ON public.classified_listings USING btree (deal_with);
CREATE INDEX classified_listings_featured_until ON public.classified_listings USING btree (featured_until) WHERE (featured_until IS NOT NULL);
CREATE INDEX classified_listings_market_idx ON public.classified_listings USING btree (market_id) WHERE (market_id IS NOT NULL);
CREATE INDEX classified_listings_owner_idx ON public.classified_listings USING btree (owner_id, created_at DESC);
CREATE INDEX classified_listings_type_price_idx ON public.classified_listings USING btree (listing_type, purpose, price) WHERE (status = 'published'::text);
CREATE INDEX classified_listings_type_purpose_idx ON public.classified_listings USING btree (listing_type, purpose, status);
CREATE INDEX classified_saved_searches_user_active_idx ON public.classified_saved_searches USING btree (user_id, active, created_at DESC);
CREATE INDEX communes_municipality_id_idx ON public.communes USING btree (municipality_id);
CREATE INDEX conversations_business_id_fk_idx ON public.conversations USING btree (business_id);
CREATE INDEX conversations_classified_listing_idx ON public.conversations USING btree (classified_listing_id) WHERE (classified_listing_id IS NOT NULL);
CREATE INDEX conversations_created_by_idx ON public.conversations USING btree (created_by);
CREATE INDEX conversations_order_id_fk_idx ON public.conversations USING btree (order_id);
CREATE INDEX conversations_product_id_fk_idx ON public.conversations USING btree (product_id);
CREATE INDEX conversations_provider_id_fk_idx ON public.conversations USING btree (provider_id);
CREATE INDEX conversations_service_id_fk_idx ON public.conversations USING btree (service_id);
CREATE INDEX couriers_municipality_id_fk_idx ON public.couriers USING btree (municipality_id);
CREATE INDEX delivery_requests_assigned_idx ON public.delivery_requests USING btree (assigned_to);
CREATE INDEX delivery_requests_dropoff_address_id_fk_idx ON public.delivery_requests USING btree (dropoff_address_id);
CREATE INDEX delivery_requests_order_idx ON public.delivery_requests USING btree (order_id);
CREATE INDEX delivery_requests_pickup_address_id_fk_idx ON public.delivery_requests USING btree (pickup_address_id);
CREATE INDEX delivery_requests_requester_idx ON public.delivery_requests USING btree (requester_id);
CREATE INDEX delivery_requests_status_idx ON public.delivery_requests USING btree (status);
CREATE INDEX event_orders_buyer_idx ON public.event_orders USING btree (buyer_id, created_at DESC);
CREATE INDEX event_orders_event_idx ON public.event_orders USING btree (event_id, status);
CREATE INDEX event_orders_type_idx ON public.event_orders USING btree (ticket_type_id, status);
CREATE INDEX event_platform_payments_decided_by_idx ON public.event_platform_payments USING btree (decided_by);
CREATE INDEX event_platform_payments_org_idx ON public.event_platform_payments USING btree (organizer_id, created_at DESC);
CREATE INDEX event_platform_payments_status_idx ON public.event_platform_payments USING btree (status, created_at);
CREATE INDEX event_ticket_types_event_idx ON public.event_ticket_types USING btree (event_id, sort);
CREATE INDEX event_tickets_checker_idx ON public.event_tickets USING btree (checked_in_by);
CREATE INDEX event_tickets_event_idx ON public.event_tickets USING btree (event_id, status);
CREATE INDEX event_tickets_holder_idx ON public.event_tickets USING btree (holder_id);
CREATE INDEX event_tickets_order_idx ON public.event_tickets USING btree (order_id);
CREATE INDEX event_tickets_type_idx ON public.event_tickets USING btree (ticket_type_id);
CREATE INDEX events_list_idx ON public.events USING btree (status, starts_at);
CREATE INDEX events_municipality_idx ON public.events USING btree (municipality_id);
CREATE INDEX events_organizer_idx ON public.events USING btree (organizer_id, created_at DESC);
CREATE INDEX field_agents_decided_by_idx ON public.field_agents USING btree (decided_by);
CREATE INDEX field_agents_market_idx ON public.field_agents USING btree (market_id);
CREATE INDEX followed_businesses_business_id_fk_idx ON public.followed_businesses USING btree (business_id);
CREATE INDEX followed_providers_provider_id_fk_idx ON public.followed_providers USING btree (provider_id);
CREATE INDEX followed_sellers_seller_id_idx ON public.followed_sellers USING btree (seller_id);
CREATE INDEX fuel_alerts_product ON public.fuel_alerts USING btree (product, municipality_id);
CREATE INDEX fuel_orders_buyer ON public.fuel_orders USING btree (buyer_id, created_at DESC);
CREATE INDEX fuel_orders_product ON public.fuel_orders USING btree (product_id, status);
CREATE INDEX fuel_orders_proof_hash ON public.fuel_orders USING btree (proof_hash) WHERE (proof_hash IS NOT NULL);
CREATE INDEX fuel_orders_reference_norm ON public.fuel_orders USING btree (reference_norm) WHERE (reference_norm IS NOT NULL);
CREATE INDEX fuel_orders_station ON public.fuel_orders USING btree (station_id, status, created_at DESC);
CREATE INDEX fuel_reports_product ON public.fuel_reports USING btree (product_id, created_at DESC);
CREATE INDEX fuel_reports_user ON public.fuel_reports USING btree (user_id, created_at DESC);
CREATE INDEX fuel_stations_owner ON public.fuel_stations USING btree (owner_id);
CREATE INDEX fuel_stations_status ON public.fuel_stations USING btree (status, municipality_id);
CREATE INDEX idx_classified_saved_searches_active_user ON public.classified_saved_searches USING btree (active, user_id);
CREATE INDEX idx_notifications_saved_search ON public.notifications USING btree (user_id, type, created_at DESC) WHERE (type = 'saved_search'::text);
CREATE INDEX inspections_owner ON public.inspections USING btree (owner_id, created_at DESC);
CREATE INDEX inspections_status ON public.inspections USING btree (status, created_at DESC);
CREATE INDEX inspections_target ON public.inspections USING btree (kind, target_id, status);
CREATE INDEX item_stats_daily_owner_idx ON public.item_stats_daily USING btree (owner_id, day);
CREATE INDEX job_queue_pending ON public.job_queue USING btree (run_after, id) WHERE (done_at IS NULL);
CREATE INDEX listing_boosts_decided_by ON public.listing_boosts USING btree (decided_by);
CREATE INDEX listing_boosts_owner ON public.listing_boosts USING btree (owner_id, created_at DESC);
CREATE INDEX listing_boosts_status ON public.listing_boosts USING btree (status, created_at);
CREATE INDEX listing_claims_buyer_idx ON public.listing_claims USING btree (buyer_id, created_at DESC);
CREATE INDEX listing_claims_seller_idx ON public.listing_claims USING btree (seller_id, created_at DESC);
CREATE INDEX listing_claims_status_idx ON public.listing_claims USING btree (status, respond_by);
CREATE INDEX listing_commissions_decided_by_idx ON public.listing_commissions USING btree (decided_by);
CREATE INDEX listing_commissions_owner ON public.listing_commissions USING btree (owner_id, status, due_at);
CREATE INDEX listing_commissions_status ON public.listing_commissions USING btree (status, created_at);
CREATE INDEX listing_offers_buyer_id_fk_idx ON public.listing_offers USING btree (buyer_id);
CREATE INDEX listing_offers_listing ON public.listing_offers USING btree (listing_id, created_at DESC);
CREATE INDEX markets_municipality_id_fk_idx ON public.markets USING btree (municipality_id);
CREATE INDEX markets_suggested_by_fk_idx ON public.markets USING btree (suggested_by);
CREATE INDEX messages_conversation_idx ON public.messages USING btree (conversation_id, created_at);
CREATE INDEX messages_sender_id_fk_idx ON public.messages USING btree (sender_id);
CREATE INDEX moderation_reports_classified_status_idx ON public.moderation_reports USING btree (target_id, status) WHERE (target_type = 'classified_listing'::text);
CREATE INDEX moderation_reports_resolved_by_fk_idx ON public.moderation_reports USING btree (resolved_by);
CREATE INDEX moderation_reports_status_idx ON public.moderation_reports USING btree (status, created_at DESC);
CREATE INDEX moderation_reports_target_idx ON public.moderation_reports USING btree (target_type, target_id);
CREATE INDEX municipalities_province_id_idx ON public.municipalities USING btree (province_id);
CREATE INDEX neighborhoods_municipality_id_idx ON public.neighborhoods USING btree (municipality_id);
CREATE INDEX notifications_unread_idx ON public.notifications USING btree (user_id, read_at) WHERE (read_at IS NULL);
CREATE INDEX notifications_user_created_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX order_dispute_events_actor_id_idx ON public.order_dispute_events USING btree (actor_id);
CREATE INDEX order_dispute_events_dispute ON public.order_dispute_events USING btree (dispute_id, created_at);
CREATE INDEX order_disputes_buyer ON public.order_disputes USING btree (buyer_id, created_at DESC);
CREATE INDEX order_disputes_seller ON public.order_disputes USING btree (seller_id, created_at DESC);
CREATE INDEX order_disputes_status ON public.order_disputes USING btree (status, updated_at);
CREATE INDEX order_items_order_idx ON public.order_items USING btree (order_id);
CREATE INDEX order_items_product_id_fk_idx ON public.order_items USING btree (product_id);
CREATE INDEX order_items_seller_idx ON public.order_items USING btree (seller_id);
CREATE INDEX order_payments_buyer ON public.order_payments USING btree (buyer_id);
CREATE INDEX order_payments_decided_by ON public.order_payments USING btree (decided_by);
CREATE INDEX order_payments_reference ON public.order_payments USING btree (reference) WHERE (provider = 'proxypay'::text);
CREATE INDEX order_payments_status ON public.order_payments USING btree (status, created_at);
CREATE INDEX orders_buyer_idx ON public.orders USING btree (buyer_id);
CREATE INDEX orders_delivery_address_id_fk_idx ON public.orders USING btree (delivery_address_id);
CREATE INDEX orders_escrow_pay_due ON public.orders USING btree (pay_by) WHERE (escrow_status = 'awaiting_payment'::text);
CREATE INDEX orders_escrow_release_due ON public.orders USING btree (release_at) WHERE (escrow_status = 'held'::text);
CREATE INDEX orders_fulfillment_status_idx ON public.orders USING btree (fulfillment_status);
CREATE INDEX orders_payment_status_idx ON public.orders USING btree (payment_status);
CREATE INDEX orders_seller_idx ON public.orders USING btree (seller_id, created_at DESC);
CREATE INDEX orders_status_idx ON public.orders USING btree (status);
CREATE INDEX organization_members_user_id_idx ON public.organization_members USING btree (user_id);
CREATE INDEX organizations_owner_id_idx ON public.organizations USING btree (owner_id);
CREATE INDEX participants_user_idx ON public.conversation_participants USING btree (user_id);
CREATE INDEX payout_requests_decided_by ON public.payout_requests USING btree (decided_by);
CREATE INDEX payout_requests_status ON public.payout_requests USING btree (status, created_at);
CREATE INDEX payout_requests_user ON public.payout_requests USING btree (user_id, created_at DESC);
CREATE INDEX portfolio_business ON public.portfolio_items USING btree (business_id, "position", created_at DESC) WHERE (business_id IS NOT NULL);
CREATE INDEX portfolio_owner ON public.portfolio_items USING btree (owner_id);
CREATE INDEX portfolio_provider ON public.portfolio_items USING btree (provider_id, "position", created_at DESC) WHERE (provider_id IS NOT NULL);
CREATE INDEX products_active_idx ON public.products USING btree (created_at DESC) WHERE active;
CREATE INDEX products_address_id_fk_idx ON public.products USING btree (address_id);
CREATE INDEX products_business_id_fk_idx ON public.products USING btree (business_id);
CREATE INDEX products_category_active_idx ON public.products USING btree (category_id, active);
CREATE INDEX products_category_idx ON public.products USING btree (category_id);
CREATE INDEX products_market_idx ON public.products USING btree (market_id) WHERE (market_id IS NOT NULL);
CREATE INDEX products_municipality_id_fk_idx ON public.products USING btree (municipality_id);
CREATE INDEX products_seller_idx ON public.products USING btree (seller_id);
CREATE INDEX promo_posts_feed ON public.promo_posts USING btree (status, created_at DESC);
CREATE INDEX promo_posts_subject ON public.promo_posts USING btree (subject_kind, subject_id, created_at DESC);
CREATE INDEX provider_profiles_address_idx ON public.provider_profiles USING btree (address_id);
CREATE INDEX provider_profiles_category_idx ON public.provider_profiles USING btree (category_id);
CREATE INDEX provider_profiles_municipality_idx ON public.provider_profiles USING btree (municipality_id) WHERE active;
CREATE INDEX provinces_active_idx ON public.provinces USING btree (active);
CREATE INDEX provinces_country_active_idx ON public.provinces USING btree (country_code, active);
CREATE INDEX referrals_referrer_idx ON public.referrals USING btree (referrer_id, status);
CREATE INDEX referrals_subscription_idx ON public.referrals USING btree (subscription_id);
CREATE INDEX rental_requests_listing_status_idx ON public.rental_requests USING btree (listing_id, status, starts_at, ends_at);
CREATE INDEX rental_requests_renter_idx ON public.rental_requests USING btree (renter_id, created_at DESC);
CREATE INDEX reviews_business_idx ON public.reviews USING btree (business_id);
CREATE INDEX reviews_business_status_idx ON public.reviews USING btree (business_id, status) WHERE (business_id IS NOT NULL);
CREATE INDEX reviews_order_id_fk_idx ON public.reviews USING btree (order_id);
CREATE INDEX reviews_product_idx ON public.reviews USING btree (product_id);
CREATE INDEX reviews_product_status_idx ON public.reviews USING btree (product_id, status) WHERE (product_id IS NOT NULL);
CREATE INDEX reviews_provider_idx ON public.reviews USING btree (provider_id);
CREATE INDEX reviews_provider_status_idx ON public.reviews USING btree (provider_id, status) WHERE (provider_id IS NOT NULL);
CREATE INDEX reviews_service_idx ON public.reviews USING btree (service_id);
CREATE INDEX reviews_service_status_idx ON public.reviews USING btree (service_id, status) WHERE (service_id IS NOT NULL);
CREATE INDEX reviews_status_idx ON public.reviews USING btree (status);
CREATE INDEX saved_items_auction_idx ON public.saved_items USING btree (auction_id) WHERE (auction_id IS NOT NULL);
CREATE INDEX saved_items_business_id_fk_idx ON public.saved_items USING btree (business_id);
CREATE INDEX saved_items_classified_listing_idx ON public.saved_items USING btree (classified_listing_id) WHERE (classified_listing_id IS NOT NULL);
CREATE INDEX saved_items_product_id_fk_idx ON public.saved_items USING btree (product_id);
CREATE INDEX saved_items_provider_id_fk_idx ON public.saved_items USING btree (provider_id);
CREATE INDEX saved_items_service_id_fk_idx ON public.saved_items USING btree (service_id);
CREATE INDEX saved_search_notification_queue_listing_id_fk_idx ON public.saved_search_notification_queue USING btree (listing_id);
CREATE INDEX saved_search_notification_queue_user_id_fk_idx ON public.saved_search_notification_queue USING btree (user_id);
CREATE INDEX saved_search_queue_lease_idx ON public.saved_search_notification_queue USING btree (processing_at, saved_search_id, user_id) WHERE (delivered_at IS NULL);
CREATE INDEX saved_search_queue_pending_idx ON public.saved_search_notification_queue USING btree (saved_search_id, user_id, created_at) WHERE (delivered_at IS NULL);
CREATE INDEX service_requests_business ON public.service_requests USING btree (business_id, created_at DESC) WHERE (business_id IS NOT NULL);
CREATE INDEX service_requests_client ON public.service_requests USING btree (client_id, created_at DESC);
CREATE INDEX service_requests_provider ON public.service_requests USING btree (provider_id, created_at DESC) WHERE (provider_id IS NOT NULL);
CREATE INDEX services_address_id_fk_idx ON public.services USING btree (address_id);
CREATE INDEX services_business_id_fk_idx ON public.services USING btree (business_id);
CREATE INDEX services_category_active_idx ON public.services USING btree (category_id, active);
CREATE INDEX services_category_idx ON public.services USING btree (category_id);
CREATE INDEX services_municipality_id_fk_idx ON public.services USING btree (municipality_id);
CREATE INDEX services_provider_idx ON public.services USING btree (provider_id);
CREATE INDEX streets_neighborhood_id_idx ON public.streets USING btree (neighborhood_id);
CREATE INDEX subscription_payments_decided_by_idx ON public.subscription_payments USING btree (decided_by);
CREATE INDEX subscription_payments_owner_id_idx ON public.subscription_payments USING btree (owner_id);
CREATE INDEX subscription_payments_status ON public.subscription_payments USING btree (status, created_at);
CREATE INDEX subscriptions_owner ON public.subscriptions USING btree (owner_id);
CREATE INDEX user_blocks_blocked_id_idx ON public.user_blocks USING btree (blocked_id);
CREATE INDEX user_reviews_target ON public.user_reviews USING btree (target_id, role) WHERE (status = 'published'::text);
CREATE INDEX venue_items_venue ON public.venue_items USING btree (venue_id, "position");
CREATE INDEX venue_order_lines_item ON public.venue_order_lines USING btree (item_id);
CREATE INDEX venue_order_lines_order ON public.venue_order_lines USING btree (order_id);
CREATE INDEX venue_orders_buyer ON public.venue_orders USING btree (buyer_id, created_at DESC);
CREATE INDEX venue_orders_proof_hash ON public.venue_orders USING btree (proof_hash) WHERE (proof_hash IS NOT NULL);
CREATE INDEX venue_orders_reference_norm ON public.venue_orders USING btree (reference_norm) WHERE (reference_norm IS NOT NULL);
CREATE INDEX venue_orders_venue ON public.venue_orders USING btree (venue_id, status, created_at DESC);
CREATE INDEX venues_owner ON public.venues USING btree (owner_id);
CREATE INDEX venues_status ON public.venues USING btree (status, kind);
CREATE INDEX verification_requests_business_id_fk_idx ON public.verification_requests USING btree (business_id);
CREATE INDEX verification_requests_decided_by_fk_idx ON public.verification_requests USING btree (decided_by);
CREATE INDEX wallet_entries_created_by ON public.wallet_entries USING btree (created_by);
CREATE INDEX wallet_entries_order ON public.wallet_entries USING btree (order_id);
CREATE INDEX wallet_entries_payout ON public.wallet_entries USING btree (payout_id);
CREATE INDEX wallet_entries_user ON public.wallet_entries USING btree (user_id, id DESC);
CREATE UNIQUE INDEX agent_commissions_one_active ON public.agent_commissions USING btree (listing_id) WHERE (status <> 'cancelled'::text);
CREATE UNIQUE INDEX cart_items_cart_product_uidx ON public.cart_items USING btree (cart_id, product_id);
CREATE UNIQUE INDEX carts_user_uidx ON public.carts USING btree (user_id);
CREATE UNIQUE INDEX classified_listings_ref_no ON public.classified_listings USING btree (ref_no);
CREATE UNIQUE INDEX event_platform_payments_one_pending ON public.event_platform_payments USING btree (event_id, kind) WHERE (status = 'pending'::text);
CREATE UNIQUE INDEX fuel_alerts_one ON public.fuel_alerts USING btree (user_id, product, COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE UNIQUE INDEX fuel_platform_payments_one_pending ON public.fuel_platform_payments USING btree (station_id) WHERE (status = 'pending'::text);
CREATE UNIQUE INDEX job_queue_pending_unique ON public.job_queue USING btree (kind, ref_id) WHERE (done_at IS NULL);
CREATE UNIQUE INDEX listing_boosts_one_pending ON public.listing_boosts USING btree (listing_id) WHERE (status = 'pending'::text);
CREATE UNIQUE INDEX listing_claims_one_active ON public.listing_claims USING btree (listing_id, buyer_id) WHERE (status <> 'resolved'::text);
CREATE UNIQUE INDEX listing_commissions_one_per_rental ON public.listing_commissions USING btree (rental_request_id) WHERE ((rental_request_id IS NOT NULL) AND (status <> 'cancelled'::text));
CREATE UNIQUE INDEX listing_commissions_one_sale ON public.listing_commissions USING btree (listing_id) WHERE ((status <> 'cancelled'::text) AND (source = ANY (ARRAY['sold'::text, 'auction'::text, 'offer'::text])));
CREATE UNIQUE INDEX listing_offers_one_pending ON public.listing_offers USING btree (listing_id, buyer_id) WHERE (status = 'pending'::text);
CREATE UNIQUE INDEX markets_name_unique ON public.markets USING btree (lower(TRIM(BOTH FROM name)));
CREATE UNIQUE INDEX moderation_reports_classified_unique ON public.moderation_reports USING btree (reporter_id, target_id) WHERE ((target_type = 'classified_listing'::text) AND (status = ANY (ARRAY['open'::text, 'under_review'::text])));
CREATE UNIQUE INDEX notifications_saved_search_digest_cycle_unique ON public.notifications USING btree (((data ->> 'saved_search_id'::text)), ((data ->> 'digest_cycle'::text))) WHERE ((type = 'saved_search'::text) AND ((data ->> 'digest'::text) = 'true'::text) AND (data ? 'saved_search_id'::text) AND (data ? 'digest_cycle'::text));
CREATE UNIQUE INDEX notifications_saved_search_listing_unique ON public.notifications USING btree (((data ->> 'saved_search_id'::text)), ((data ->> 'listing_id'::text))) WHERE ((type = 'saved_search'::text) AND (data ? 'saved_search_id'::text) AND (data ? 'listing_id'::text));
CREATE UNIQUE INDEX order_disputes_one_active ON public.order_disputes USING btree (order_id) WHERE (status <> 'resolved'::text);
CREATE UNIQUE INDEX order_payments_one_pending ON public.order_payments USING btree (order_id) WHERE (status = 'pending'::text);
CREATE UNIQUE INDEX orders_ref_no ON public.orders USING btree (ref_no);
CREATE UNIQUE INDEX payout_requests_one_open ON public.payout_requests USING btree (user_id) WHERE (status = ANY (ARRAY['requested'::text, 'processing'::text]));
CREATE UNIQUE INDEX products_ref_no ON public.products USING btree (ref_no);
CREATE UNIQUE INDEX promo_boosts_one_pending ON public.promo_boosts USING btree (post_id) WHERE (status = 'pending'::text);
CREATE UNIQUE INDEX reviews_author_business_uidx ON public.reviews USING btree (author_id, business_id) WHERE (business_id IS NOT NULL);
CREATE UNIQUE INDEX reviews_author_provider_uidx ON public.reviews USING btree (author_id, provider_id) WHERE (provider_id IS NOT NULL);
CREATE UNIQUE INDEX reviews_service_request_once ON public.reviews USING btree (service_request_id) WHERE (service_request_id IS NOT NULL);
CREATE UNIQUE INDEX saved_business_unique ON public.saved_items USING btree (user_id, business_id) WHERE (business_id IS NOT NULL);
CREATE UNIQUE INDEX saved_items_user_auction_unique ON public.saved_items USING btree (user_id, auction_id) WHERE (auction_id IS NOT NULL);
CREATE UNIQUE INDEX saved_items_user_classified_listing_uidx ON public.saved_items USING btree (user_id, classified_listing_id) WHERE (classified_listing_id IS NOT NULL);
CREATE UNIQUE INDEX saved_product_unique ON public.saved_items USING btree (user_id, product_id) WHERE (product_id IS NOT NULL);
CREATE UNIQUE INDEX saved_provider_unique ON public.saved_items USING btree (user_id, provider_id) WHERE (provider_id IS NOT NULL);
CREATE UNIQUE INDEX saved_service_unique ON public.saved_items USING btree (user_id, service_id) WHERE (service_id IS NOT NULL);
CREATE UNIQUE INDEX subscription_payments_one_pending ON public.subscription_payments USING btree (subscription_id) WHERE (status = 'pending'::text);
CREATE UNIQUE INDEX subscriptions_business ON public.subscriptions USING btree (business_id) WHERE (business_id IS NOT NULL);
CREATE UNIQUE INDEX subscriptions_provider ON public.subscriptions USING btree (provider_id) WHERE (provider_id IS NOT NULL);
CREATE UNIQUE INDEX subscriptions_store ON public.subscriptions USING btree (seller_id) WHERE (seller_id IS NOT NULL);
CREATE UNIQUE INDEX uq_saved_search_notification_queue_match ON public.saved_search_notification_queue USING btree (saved_search_id, listing_id) WHERE (delivered_at IS NULL);
CREATE UNIQUE INDEX user_reviews_author_listing ON public.user_reviews USING btree (author_id, listing_id) WHERE (listing_id IS NOT NULL);
CREATE UNIQUE INDEX user_reviews_author_order ON public.user_reviews USING btree (author_id, order_id) WHERE (order_id IS NOT NULL);
CREATE UNIQUE INDEX venue_platform_payments_one_pending ON public.venue_platform_payments USING btree (venue_id) WHERE (status = 'pending'::text);
CREATE UNIQUE INDEX verification_id_number_once ON public.verification_requests USING btree (id_number) WHERE ((kind = 'identity'::text) AND (id_number IS NOT NULL) AND (status = ANY (ARRAY['pending'::text, 'approved'::text])));
CREATE UNIQUE INDEX verification_one_pending ON public.verification_requests USING btree (user_id, kind, COALESCE(business_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE (status = 'pending'::text);

-- Vistas
create or replace view public.rating_summaries as
 SELECT business_id,
    provider_id,
    product_id,
    service_id,
    round(avg(rating), 2) AS average_rating,
    count(*) AS review_count
   FROM reviews
  WHERE (status = 'published'::text)
  GROUP BY business_id, provider_id, product_id, service_id;
-- ============================================================
-- Parte 4: gatilhos, RLS, regras de acesso e permissões
-- ============================================================

-- Permissões por omissão (iguais ao projeto antigo): tabelas e funções novas não ficam públicas
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant truncate, references, trigger, maintain on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated, service_role;

-- Gatilhos
CREATE TRIGGER trg_guard_bid_write BEFORE INSERT OR UPDATE ON public.auction_bids FOR EACH ROW EXECUTE FUNCTION guard_server_only_write();
CREATE TRIGGER trg_auction_mark_listing_sold AFTER UPDATE OF status ON public.auctions FOR EACH ROW EXECUTE FUNCTION auction_mark_listing_sold();
CREATE TRIGGER trg_guard_auction_write BEFORE INSERT OR UPDATE ON public.auctions FOR EACH ROW EXECUTE FUNCTION guard_server_only_write();
CREATE TRIGGER trg_guard_business_verified BEFORE INSERT OR UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION guard_verified_flag();
CREATE TRIGGER trg_subscription_start_business AFTER INSERT ON public.businesses FOR EACH ROW EXECUTE FUNCTION subscription_start();
CREATE TRIGGER trg_cart_store_paid_up BEFORE INSERT OR UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION guard_store_paid_up();
CREATE TRIGGER trg_audit_categories AFTER INSERT OR UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION audit_admin_change();
CREATE TRIGGER follow_notify_listing AFTER INSERT OR UPDATE OF status ON public.classified_listings FOR EACH ROW EXECUTE FUNCTION follow_notify_listing();
CREATE TRIGGER guard_listing_agent BEFORE INSERT OR UPDATE OF agent_id ON public.classified_listings FOR EACH ROW EXECUTE FUNCTION guard_listing_agent();
CREATE TRIGGER listing_agent_published AFTER UPDATE OF status ON public.classified_listings FOR EACH ROW EXECUTE FUNCTION listing_agent_published();
CREATE TRIGGER require_listing_conformity BEFORE INSERT OR UPDATE OF status ON public.classified_listings FOR EACH ROW EXECUTE FUNCTION require_listing_conformity();
CREATE TRIGGER round_listing_geo BEFORE INSERT OR UPDATE OF geo_lat, geo_lng ON public.classified_listings FOR EACH ROW EXECUTE FUNCTION round_listing_geo();
CREATE TRIGGER trg_audit_listings AFTER UPDATE ON public.classified_listings FOR EACH ROW EXECUTE FUNCTION audit_admin_change();
CREATE TRIGGER trg_guard_classified_listing BEFORE INSERT OR UPDATE ON public.classified_listings FOR EACH ROW EXECUTE FUNCTION guard_classified_listing();
CREATE TRIGGER trg_guard_commission_overdue BEFORE UPDATE OF status ON public.classified_listings FOR EACH ROW EXECUTE FUNCTION guard_commission_overdue();
CREATE TRIGGER trg_guard_listing_deal BEFORE UPDATE OF deal_with ON public.classified_listings FOR EACH ROW EXECUTE FUNCTION guard_listing_deal();
CREATE TRIGGER trg_listing_commission_on_sale AFTER UPDATE OF status ON public.classified_listings FOR EACH ROW EXECUTE FUNCTION listing_commission_on_sale();
CREATE TRIGGER trg_notify_classified_saved_searches AFTER INSERT OR UPDATE OF status ON public.classified_listings FOR EACH ROW EXECUTE FUNCTION notify_classified_saved_searches();
CREATE TRIGGER trg_notify_wanted_matches AFTER INSERT OR UPDATE OF status ON public.classified_listings FOR EACH ROW EXECUTE FUNCTION notify_wanted_matches();
CREATE TRIGGER trg_queue_video_cleanup_listing AFTER DELETE OR UPDATE OF video_url ON public.classified_listings FOR EACH ROW EXECUTE FUNCTION queue_video_cleanup();
CREATE TRIGGER trg_sync_auction_sale_mode BEFORE INSERT OR UPDATE OF purpose ON public.classified_listings FOR EACH ROW EXECUTE FUNCTION sync_auction_sale_mode();
CREATE TRIGGER trg_audit_couriers AFTER UPDATE ON public.couriers FOR EACH ROW EXECUTE FUNCTION audit_admin_change();
CREATE TRIGGER trg_guard_couriers_write BEFORE INSERT OR UPDATE ON public.couriers FOR EACH ROW EXECUTE FUNCTION guard_server_only_write();
CREATE TRIGGER delivery_requires_payment BEFORE INSERT ON public.delivery_requests FOR EACH ROW EXECUTE FUNCTION delivery_requires_payment();
CREATE TRIGGER trg_guard_delivery_write BEFORE INSERT OR UPDATE ON public.delivery_requests FOR EACH ROW EXECUTE FUNCTION guard_server_only_write();
CREATE TRIGGER guard_ticket_type BEFORE INSERT OR DELETE OR UPDATE ON public.event_ticket_types FOR EACH ROW EXECUTE FUNCTION guard_ticket_type();
CREATE TRIGGER guard_event BEFORE INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION guard_event();
CREATE TRIGGER trg_fuel_product_changed BEFORE INSERT OR UPDATE ON public.fuel_products FOR EACH ROW EXECUTE FUNCTION fuel_product_changed();
CREATE TRIGGER trg_guard_fuel_station_pay AFTER INSERT OR UPDATE ON public.fuel_station_pay FOR EACH ROW EXECUTE FUNCTION guard_fuel_station_pay();
CREATE TRIGGER trg_fuel_station_created AFTER INSERT ON public.fuel_stations FOR EACH ROW EXECUTE FUNCTION fuel_station_created();
CREATE TRIGGER trg_guard_fuel_station BEFORE INSERT OR UPDATE ON public.fuel_stations FOR EACH ROW EXECUTE FUNCTION guard_fuel_station();
CREATE TRIGGER messages_block_guard BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION messages_block_guard();
CREATE TRIGGER messages_touch_conversation AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION touch_conversation();
CREATE TRIGGER trg_guard_message_sender BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION guard_message_sender();
CREATE TRIGGER trg_notify_new_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION notify_new_message();
CREATE TRIGGER trg_audit_reports AFTER UPDATE ON public.moderation_reports FOR EACH ROW EXECUTE FUNCTION audit_admin_change();
CREATE TRIGGER trg_apply_notification_preferences BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION apply_notification_preferences();
CREATE TRIGGER escrow_refund_alert AFTER INSERT OR UPDATE OF status ON public.order_disputes FOR EACH ROW EXECUTE FUNCTION escrow_refund_alert();
CREATE TRIGGER trg_order_store_paid_up BEFORE INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION guard_store_paid_up();
CREATE TRIGGER orders_escrow_guard BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION orders_escrow_guard();
CREATE TRIGGER trg_guard_order_write BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION guard_order_write();
CREATE TRIGGER follow_notify_portfolio AFTER INSERT ON public.portfolio_items FOR EACH ROW EXECUTE FUNCTION follow_notify_portfolio();
CREATE TRIGGER trg_portfolio_guard BEFORE INSERT OR UPDATE ON public.portfolio_items FOR EACH ROW EXECUTE FUNCTION portfolio_guard();
CREATE TRIGGER follow_notify_product AFTER INSERT OR UPDATE OF active ON public.products FOR EACH ROW EXECUTE FUNCTION follow_notify_product();
CREATE TRIGGER require_product_conformity BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION require_product_conformity();
CREATE TRIGGER trg_queue_video_cleanup_product AFTER DELETE OR UPDATE OF video_url ON public.products FOR EACH ROW EXECUTE FUNCTION queue_video_cleanup();
CREATE TRIGGER trg_store_subscription_start AFTER INSERT OR UPDATE OF business_id ON public.products FOR EACH ROW EXECUTE FUNCTION store_subscription_start();
CREATE TRIGGER trg_audit_profiles AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION audit_admin_change();
CREATE TRIGGER trg_guard_profile_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION guard_profile_update();
CREATE TRIGGER trg_queue_video_cleanup_promo AFTER DELETE OR UPDATE OF video_url ON public.promo_posts FOR EACH ROW EXECUTE FUNCTION queue_video_cleanup();
CREATE TRIGGER trg_guard_provider_verified BEFORE INSERT OR UPDATE ON public.provider_profiles FOR EACH ROW EXECUTE FUNCTION guard_verified_flag();
CREATE TRIGGER trg_subscription_start_provider AFTER INSERT ON public.provider_profiles FOR EACH ROW EXECUTE FUNCTION subscription_start();
CREATE TRIGGER rental_commission_on_request AFTER UPDATE OF status ON public.rental_requests FOR EACH ROW EXECUTE FUNCTION rental_commission_on_request();
CREATE TRIGGER trg_guard_rental_write BEFORE INSERT OR UPDATE ON public.rental_requests FOR EACH ROW EXECUTE FUNCTION guard_server_only_write();
CREATE TRIGGER trg_guard_review_write BEFORE INSERT OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION guard_review_write();
CREATE TRIGGER trg_service_request_paid_up BEFORE INSERT ON public.service_requests FOR EACH ROW EXECUTE FUNCTION service_request_paid_up();
CREATE TRIGGER referral_on_payment AFTER UPDATE OF status ON public.subscription_payments FOR EACH ROW EXECUTE FUNCTION referral_on_payment();
CREATE TRIGGER referral_on_subscription AFTER INSERT ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION referral_on_subscription();
CREATE TRIGGER trg_audit_user_roles AFTER INSERT OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION audit_admin_change();
CREATE TRIGGER on_auth_user_created_huambo AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_huambo_user();
CREATE TRIGGER trg_guard_venue_pay AFTER INSERT OR UPDATE ON public.venue_pay FOR EACH ROW EXECUTE FUNCTION guard_venue_pay();
CREATE TRIGGER trg_guard_venue BEFORE INSERT OR UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION guard_venue();
CREATE TRIGGER trg_venue_created AFTER INSERT ON public.venues FOR EACH ROW EXECUTE FUNCTION venue_created();

-- RLS
alter table public.account_capabilities enable row level security;
alter table public.addresses enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.agent_commissions enable row level security;
alter table public.auction_bids enable row level security;
alter table public.auction_max_bids enable row level security;
alter table public.auctions enable row level security;
alter table public.businesses enable row level security;
alter table public.cart_items enable row level security;
alter table public.carts enable row level security;
alter table public.categories enable row level security;
alter table public.classified_listings enable row level security;
alter table public.classified_saved_searches enable row level security;
alter table public.communes enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.conversations enable row level security;
alter table public.couriers enable row level security;
alter table public.delivery_requests enable row level security;
alter table public.event_orders enable row level security;
alter table public.event_payment_info enable row level security;
alter table public.event_platform_payments enable row level security;
alter table public.event_ticket_types enable row level security;
alter table public.event_tickets enable row level security;
alter table public.events enable row level security;
alter table public.field_agents enable row level security;
alter table public.followed_businesses enable row level security;
alter table public.followed_providers enable row level security;
alter table public.followed_sellers enable row level security;
alter table public.fuel_alerts enable row level security;
alter table public.fuel_orders enable row level security;
alter table public.fuel_platform_payments enable row level security;
alter table public.fuel_products enable row level security;
alter table public.fuel_reports enable row level security;
alter table public.fuel_station_pay enable row level security;
alter table public.fuel_stations enable row level security;
alter table public.inspections enable row level security;
alter table public.item_stats_daily enable row level security;
alter table public.job_queue enable row level security;
alter table public.listing_boosts enable row level security;
alter table public.listing_claims enable row level security;
alter table public.listing_commissions enable row level security;
alter table public.listing_offers enable row level security;
alter table public.markets enable row level security;
alter table public.media_cleanup_queue enable row level security;
alter table public.messages enable row level security;
alter table public.moderation_reports enable row level security;
alter table public.municipalities enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.notifications force row level security;
alter table public.order_dispute_events enable row level security;
alter table public.order_disputes enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;
alter table public.orders enable row level security;
alter table public.organization_members enable row level security;
alter table public.organizations enable row level security;
alter table public.payout_accounts enable row level security;
alter table public.payout_requests enable row level security;
alter table public.photo_search_usage enable row level security;
alter table public.platform_settings enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.promo_boosts enable row level security;
alter table public.promo_posts enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.provinces enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.rental_requests enable row level security;
alter table public.reviews enable row level security;
alter table public.saved_items enable row level security;
alter table public.saved_search_notification_queue enable row level security;
alter table public.seller_delivery_settings enable row level security;
alter table public.seller_delivery_zones enable row level security;
alter table public.service_requests enable row level security;
alter table public.services enable row level security;
alter table public.streets enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_reviews enable row level security;
alter table public.user_roles enable row level security;
alter table public.venue_items enable row level security;
alter table public.venue_order_lines enable row level security;
alter table public.venue_orders enable row level security;
alter table public.venue_pay enable row level security;
alter table public.venue_platform_payments enable row level security;
alter table public.venues enable row level security;
alter table public.verification_requests enable row level security;
alter table public.wallet_entries enable row level security;

-- Regras de acesso (policies)
create policy capabilities_delete_own on public.account_capabilities as permissive for delete to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy capabilities_insert_own on public.account_capabilities as permissive for insert to authenticated with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy capabilities_select_own on public.account_capabilities as permissive for select to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy addresses_public_read on public.addresses as permissive for select to anon, authenticated using ((active = true));
create policy agent_commissions_own_read on public.agent_commissions as permissive for select to authenticated using ((agent_id = ( SELECT auth.uid() AS uid)));
create policy bids_bidder_insert on public.auction_bids as permissive for insert to authenticated with check ((bidder_id = ( SELECT auth.uid() AS uid)));
create policy bids_public_read on public.auction_bids as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM auctions a
  WHERE ((a.id = auction_bids.auction_id) AND (a.status = ANY (ARRAY['live'::text, 'ended'::text]))))));
create policy auctions_public_read on public.auctions as permissive for select to anon, authenticated using (((status = ANY (ARRAY['scheduled'::text, 'live'::text, 'ended'::text])) OR (seller_id = ( SELECT auth.uid() AS uid))));
create policy auctions_seller_insert on public.auctions as permissive for insert to authenticated with check ((seller_id = ( SELECT auth.uid() AS uid)));
create policy auctions_seller_update on public.auctions as permissive for update to authenticated using ((seller_id = ( SELECT auth.uid() AS uid))) with check ((seller_id = ( SELECT auth.uid() AS uid)));
create policy businesses_admin_update on public.businesses as permissive for update to authenticated using (has_admin_role()) with check (has_admin_role());
create policy businesses_owner_admin_read on public.businesses as permissive for select to authenticated using (((owner_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy businesses_owner_delete on public.businesses as permissive for delete to authenticated using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy businesses_owner_insert on public.businesses as permissive for insert to authenticated with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy businesses_owner_update on public.businesses as permissive for update to authenticated using ((owner_id = ( SELECT auth.uid() AS uid))) with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy businesses_public_read on public.businesses as permissive for select to anon, authenticated using (((active = true) AND subject_paid_up(NULL::uuid, id)));
create policy cart_items_owner_all on public.cart_items as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM carts c
  WHERE ((c.id = cart_items.cart_id) AND (c.user_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM carts c
  WHERE ((c.id = cart_items.cart_id) AND (c.user_id = ( SELECT auth.uid() AS uid))))));
create policy carts_owner_all on public.carts as permissive for all to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy categories_admin_insert on public.categories as permissive for insert to authenticated with check (has_admin_role());
create policy categories_admin_read on public.categories as permissive for select to authenticated using (has_admin_role());
create policy categories_admin_update on public.categories as permissive for update to authenticated using (has_admin_role()) with check (has_admin_role());
create policy categories_public_read on public.categories as permissive for select to anon, authenticated using ((active = true));
create policy classified_admin_delete on public.classified_listings as permissive for delete to authenticated using (has_admin_role());
create policy classified_admin_read on public.classified_listings as permissive for select to authenticated using (has_admin_role());
create policy classified_admin_update on public.classified_listings as permissive for update to authenticated using (has_admin_role()) with check (has_admin_role());
create policy classified_owner_delete on public.classified_listings as permissive for delete to authenticated using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy classified_owner_insert on public.classified_listings as permissive for insert to authenticated with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy classified_owner_update on public.classified_listings as permissive for update to authenticated using ((owner_id = ( SELECT auth.uid() AS uid))) with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy classified_public_read on public.classified_listings as permissive for select to anon, authenticated using (((status = 'published'::text) OR (owner_id = ( SELECT auth.uid() AS uid))));
create policy saved_searches_owner_delete on public.classified_saved_searches as permissive for delete to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy saved_searches_owner_insert on public.classified_saved_searches as permissive for insert to authenticated with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy saved_searches_owner_select on public.classified_saved_searches as permissive for select to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy saved_searches_owner_update on public.classified_saved_searches as permissive for update to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy communes_public_read on public.communes as permissive for select to anon, authenticated using ((active = true));
create policy participant_delete_self on public.conversation_participants as permissive for delete to public using ((user_id = ( SELECT auth.uid() AS uid)));
create policy participant_insert_creator on public.conversation_participants as permissive for insert to public with check ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = conversation_participants.conversation_id) AND (c.created_by = ( SELECT auth.uid() AS uid))))));
create policy participant_read_self on public.conversation_participants as permissive for select to public using ((user_id = ( SELECT auth.uid() AS uid)));
create policy participant_update_self on public.conversation_participants as permissive for update to public using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy conversation_participant_create on public.conversations as permissive for insert to authenticated with check ((created_by = ( SELECT auth.uid() AS uid)));
create policy conversation_participant_read on public.conversations as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM conversation_participants p
  WHERE ((p.conversation_id = conversations.id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));
create policy couriers_self_read on public.couriers as permissive for select to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR has_admin_role()));
create policy delivery_requester_insert on public.delivery_requests as permissive for insert to authenticated with check ((requester_id = ( SELECT auth.uid() AS uid)));
create policy delivery_requester_read on public.delivery_requests as permissive for select to authenticated using (((requester_id = ( SELECT auth.uid() AS uid)) OR (assigned_to = ( SELECT auth.uid() AS uid))));
create policy delivery_requester_update on public.delivery_requests as permissive for update to authenticated using (((requester_id = ( SELECT auth.uid() AS uid)) OR (assigned_to = ( SELECT auth.uid() AS uid)))) with check (((requester_id = ( SELECT auth.uid() AS uid)) OR (assigned_to = ( SELECT auth.uid() AS uid))));
create policy event_orders_parties_read on public.event_orders as permissive for select to authenticated using (((buyer_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = event_orders.event_id) AND (e.organizer_id = ( SELECT auth.uid() AS uid))))) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy event_payment_info_owner on public.event_payment_info as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = event_payment_info.event_id) AND (e.organizer_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = event_payment_info.event_id) AND (e.organizer_id = ( SELECT auth.uid() AS uid))))));
create policy event_platform_payments_read on public.event_platform_payments as permissive for select to authenticated using (((organizer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy event_ticket_types_owner_write on public.event_ticket_types as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = event_ticket_types.event_id) AND (e.organizer_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = event_ticket_types.event_id) AND (e.organizer_id = ( SELECT auth.uid() AS uid))))));
create policy event_ticket_types_read on public.event_ticket_types as permissive for select to anon, authenticated using ((EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = event_ticket_types.event_id) AND ((e.status <> 'draft'::text) OR (e.organizer_id = ( SELECT auth.uid() AS uid)))))));
create policy event_tickets_parties_read on public.event_tickets as permissive for select to authenticated using (((holder_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = event_tickets.event_id) AND (e.organizer_id = ( SELECT auth.uid() AS uid)))))));
create policy events_owner_insert on public.events as permissive for insert to authenticated with check ((organizer_id = ( SELECT auth.uid() AS uid)));
create policy events_owner_update on public.events as permissive for update to authenticated using (((organizer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role))) with check (((organizer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy events_public_read on public.events as permissive for select to anon, authenticated using (((status <> 'draft'::text) OR (organizer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy field_agents_own_read on public.field_agents as permissive for select to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy followed_businesses_owner_all on public.followed_businesses as permissive for all to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy followed_providers_owner_all on public.followed_providers as permissive for all to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy followed_sellers_owner_all on public.followed_sellers as permissive for all to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy fuel_alerts_own on public.fuel_alerts as permissive for all to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy fuel_orders_read on public.fuel_orders as permissive for select to authenticated using (((buyer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role) OR (EXISTS ( SELECT 1
   FROM fuel_stations s
  WHERE ((s.id = fuel_orders.station_id) AND (s.owner_id = ( SELECT auth.uid() AS uid)))))));
create policy fuel_platform_payments_read on public.fuel_platform_payments as permissive for select to authenticated using (((owner_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy fuel_products_owner on public.fuel_products as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM fuel_stations s
  WHERE ((s.id = fuel_products.station_id) AND (s.owner_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM fuel_stations s
  WHERE ((s.id = fuel_products.station_id) AND (s.owner_id = ( SELECT auth.uid() AS uid))))));
create policy fuel_products_read on public.fuel_products as permissive for select to anon, authenticated using ((EXISTS ( SELECT 1
   FROM fuel_stations s
  WHERE ((s.id = fuel_products.station_id) AND ((s.status = 'approved'::text) OR (s.owner_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role))))));
create policy fuel_station_pay_owner on public.fuel_station_pay as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM fuel_stations s
  WHERE ((s.id = fuel_station_pay.station_id) AND (s.owner_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM fuel_stations s
  WHERE ((s.id = fuel_station_pay.station_id) AND (s.owner_id = ( SELECT auth.uid() AS uid))))));
create policy fuel_stations_insert on public.fuel_stations as permissive for insert to authenticated with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy fuel_stations_read on public.fuel_stations as permissive for select to anon, authenticated using (((status = 'approved'::text) OR (owner_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy fuel_stations_update on public.fuel_stations as permissive for update to authenticated using ((owner_id = ( SELECT auth.uid() AS uid))) with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy inspections_own_read on public.inspections as permissive for select to authenticated using (((owner_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy listing_boosts_own_read on public.listing_boosts as permissive for select to authenticated using (((owner_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy listing_claims_parties_read on public.listing_claims as permissive for select to authenticated using (((buyer_id = ( SELECT auth.uid() AS uid)) OR (seller_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy listing_commissions_own_read on public.listing_commissions as permissive for select to authenticated using (((owner_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy listing_offers_parties_read on public.listing_offers as permissive for select to authenticated using (((buyer_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM classified_listings l
  WHERE ((l.id = listing_offers.listing_id) AND (l.owner_id = ( SELECT auth.uid() AS uid)))))));
create policy markets_admin_insert on public.markets as permissive for insert to authenticated with check (has_admin_role());
create policy markets_admin_update on public.markets as permissive for update to authenticated using (has_admin_role()) with check (has_admin_role());
create policy markets_anon_read on public.markets as permissive for select to anon using ((status = 'active'::text));
create policy markets_public_read on public.markets as permissive for select to authenticated using (((status = 'active'::text) OR has_admin_role() OR (suggested_by = ( SELECT auth.uid() AS uid))));
create policy messages_participant_read on public.messages as permissive for select to public using ((EXISTS ( SELECT 1
   FROM conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = ( SELECT auth.uid() AS uid))))));
create policy messages_participant_send on public.messages as permissive for insert to public with check (((sender_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = ( SELECT auth.uid() AS uid)))))));
create policy messages_sender_update on public.messages as permissive for update to authenticated using ((sender_id = ( SELECT auth.uid() AS uid))) with check ((sender_id = ( SELECT auth.uid() AS uid)));
create policy reports_admin_update on public.moderation_reports as permissive for update to authenticated using (has_admin_role()) with check (has_admin_role());
create policy reports_own_insert on public.moderation_reports as permissive for insert to authenticated with check ((reporter_id = ( SELECT auth.uid() AS uid)));
create policy reports_reporter_read on public.moderation_reports as permissive for select to authenticated using (((reporter_id = ( SELECT auth.uid() AS uid)) OR has_admin_role()));
create policy location_municipalities_public_read on public.municipalities as permissive for select to anon, authenticated using (true);
create policy location_neighborhoods_public_read on public.neighborhoods as permissive for select to anon, authenticated using (true);
create policy notification_preferences_own on public.notification_preferences as permissive for select to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy notifications_owner_select on public.notifications as permissive for select to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy notifications_owner_update on public.notifications as permissive for update to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy order_dispute_events_parties_read on public.order_dispute_events as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM order_disputes d
  WHERE ((d.id = order_dispute_events.dispute_id) AND ((d.buyer_id = ( SELECT auth.uid() AS uid)) OR (d.seller_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role))))));
create policy order_disputes_parties_read on public.order_disputes as permissive for select to authenticated using (((buyer_id = ( SELECT auth.uid() AS uid)) OR (seller_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy order_items_admin_read on public.order_items as permissive for select to authenticated using (has_admin_role());
create policy order_items_buyer_read on public.order_items as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.buyer_id = ( SELECT auth.uid() AS uid))))));
create policy order_items_seller_read on public.order_items as permissive for select to authenticated using ((seller_id = ( SELECT auth.uid() AS uid)));
create policy order_payments_own_read on public.order_payments as permissive for select to authenticated using (((buyer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy orders_admin_read on public.orders as permissive for select to authenticated using (has_admin_role());
create policy orders_buyer_insert on public.orders as permissive for insert to authenticated with check ((buyer_id = ( SELECT auth.uid() AS uid)));
create policy orders_buyer_read on public.orders as permissive for select to authenticated using ((buyer_id = ( SELECT auth.uid() AS uid)));
create policy orders_buyer_update on public.orders as permissive for update to authenticated using ((buyer_id = ( SELECT auth.uid() AS uid))) with check ((buyer_id = ( SELECT auth.uid() AS uid)));
create policy orders_seller_read on public.orders as permissive for select to authenticated using ((seller_id = ( SELECT auth.uid() AS uid)));
create policy members_delete_owner on public.organization_members as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = organization_members.organization_id) AND (o.owner_id = ( SELECT auth.uid() AS uid))))));
create policy members_insert_owner on public.organization_members as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = organization_members.organization_id) AND (o.owner_id = ( SELECT auth.uid() AS uid))))));
create policy members_select_member on public.organization_members as permissive for select to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM organizations o
  WHERE ((o.id = organization_members.organization_id) AND (o.owner_id = ( SELECT auth.uid() AS uid)))))));
create policy organizations_delete_owner on public.organizations as permissive for delete to authenticated using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy organizations_insert_owner on public.organizations as permissive for insert to authenticated with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy organizations_select_member on public.organizations as permissive for select to authenticated using (((owner_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = organizations.id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))));
create policy organizations_update_owner on public.organizations as permissive for update to authenticated using ((owner_id = ( SELECT auth.uid() AS uid))) with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy payout_accounts_own_read on public.payout_accounts as permissive for select to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy payout_requests_own_read on public.payout_requests as permissive for select to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy photo_search_usage_own_read on public.photo_search_usage as permissive for select to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy platform_settings_admin_update on public.platform_settings as permissive for update to authenticated using (( SELECT has_admin_role() AS has_admin_role)) with check (( SELECT has_admin_role() AS has_admin_role));
create policy platform_settings_read on public.platform_settings as permissive for select to anon, authenticated using (true);
create policy portfolio_admin_delete on public.portfolio_items as permissive for delete to authenticated using (( SELECT has_admin_role() AS has_admin_role));
create policy portfolio_owner_delete on public.portfolio_items as permissive for delete to authenticated using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy portfolio_owner_insert on public.portfolio_items as permissive for insert to authenticated with check (((owner_id = ( SELECT auth.uid() AS uid)) AND portfolio_target_owned(provider_id, business_id) AND portfolio_photos_ok(photos, owner_id)));
create policy portfolio_owner_update on public.portfolio_items as permissive for update to authenticated using ((owner_id = ( SELECT auth.uid() AS uid))) with check (((owner_id = ( SELECT auth.uid() AS uid)) AND portfolio_target_owned(provider_id, business_id) AND portfolio_photos_ok(photos, owner_id)));
create policy portfolio_public_read on public.portfolio_items as permissive for select to anon, authenticated using ((portfolio_target_public(provider_id, business_id) OR (owner_id = ( SELECT auth.uid() AS uid))));
create policy products_owner_admin_read on public.products as permissive for select to authenticated using (((seller_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy products_public_read on public.products as permissive for select to anon, authenticated using (((active = true) AND product_paid_up(seller_id, business_id)));
create policy products_seller_delete on public.products as permissive for delete to authenticated using ((seller_id = ( SELECT auth.uid() AS uid)));
create policy products_seller_insert on public.products as permissive for insert to authenticated with check ((seller_id = ( SELECT auth.uid() AS uid)));
create policy products_seller_update on public.products as permissive for update to authenticated using ((seller_id = ( SELECT auth.uid() AS uid))) with check ((seller_id = ( SELECT auth.uid() AS uid)));
create policy profiles_admin_read on public.profiles as permissive for select to authenticated using (has_admin_role());
create policy profiles_insert_own on public.profiles as permissive for insert to authenticated with check ((id = ( SELECT auth.uid() AS uid)));
create policy profiles_select_own on public.profiles as permissive for select to authenticated using ((id = ( SELECT auth.uid() AS uid)));
create policy profiles_update_own on public.profiles as permissive for update to authenticated using ((id = ( SELECT auth.uid() AS uid))) with check ((id = ( SELECT auth.uid() AS uid)));
create policy promo_boosts_owner_read on public.promo_boosts as permissive for select to authenticated using (((owner_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy promo_posts_owner_read on public.promo_posts as permissive for select to authenticated using (((owner_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy provider_profiles_admin_update on public.provider_profiles as permissive for update to authenticated using (has_admin_role()) with check (has_admin_role());
create policy provider_profiles_own_delete on public.provider_profiles as permissive for delete to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy provider_profiles_own_insert on public.provider_profiles as permissive for insert to authenticated with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy provider_profiles_own_update on public.provider_profiles as permissive for update to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy provider_profiles_owner_admin_read on public.provider_profiles as permissive for select to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy provider_profiles_public_read on public.provider_profiles as permissive for select to anon, authenticated using (((active = true) AND subject_paid_up(user_id, NULL::uuid)));
create policy location_provinces_public_read on public.provinces as permissive for select to anon, authenticated using ((active = true));
create policy referral_codes_own_read on public.referral_codes as permissive for select to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy referrals_referrer_read on public.referrals as permissive for select to authenticated using (((referrer_id = ( SELECT auth.uid() AS uid)) OR (referred_id = ( SELECT auth.uid() AS uid))));
create policy rental_owner_read on public.rental_requests as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM classified_listings l
  WHERE ((l.id = rental_requests.listing_id) AND (l.owner_id = ( SELECT auth.uid() AS uid))))));
create policy rental_owner_update on public.rental_requests as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM classified_listings l
  WHERE ((l.id = rental_requests.listing_id) AND (l.owner_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM classified_listings l
  WHERE ((l.id = rental_requests.listing_id) AND (l.owner_id = ( SELECT auth.uid() AS uid))))));
create policy rental_renter_cancel on public.rental_requests as permissive for update to authenticated using ((renter_id = ( SELECT auth.uid() AS uid))) with check ((renter_id = ( SELECT auth.uid() AS uid)));
create policy rental_renter_insert on public.rental_requests as permissive for insert to authenticated with check ((renter_id = ( SELECT auth.uid() AS uid)));
create policy rental_renter_read on public.rental_requests as permissive for select to authenticated using ((renter_id = ( SELECT auth.uid() AS uid)));
create policy reviews_admin_update on public.reviews as permissive for update to authenticated using (has_admin_role()) with check (has_admin_role());
create policy reviews_author_delete on public.reviews as permissive for delete to authenticated using ((author_id = ( SELECT auth.uid() AS uid)));
create policy reviews_author_insert on public.reviews as permissive for insert to authenticated with check ((author_id = ( SELECT auth.uid() AS uid)));
create policy reviews_author_update on public.reviews as permissive for update to authenticated using (((author_id = ( SELECT auth.uid() AS uid)) AND (status <> 'published'::text))) with check ((author_id = ( SELECT auth.uid() AS uid)));
create policy reviews_public_read on public.reviews as permissive for select to anon, authenticated using ((status = 'published'::text));
create policy saved_items_owner_all on public.saved_items as permissive for all to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy saved_search_queue_select_own on public.saved_search_notification_queue as permissive for select to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy seller_delivery_settings_own on public.seller_delivery_settings as permissive for all to authenticated using ((seller_id = ( SELECT auth.uid() AS uid))) with check ((seller_id = ( SELECT auth.uid() AS uid)));
create policy seller_delivery_settings_read on public.seller_delivery_settings as permissive for select to anon, authenticated using (true);
create policy seller_delivery_zones_own on public.seller_delivery_zones as permissive for all to authenticated using ((seller_id = ( SELECT auth.uid() AS uid))) with check ((seller_id = ( SELECT auth.uid() AS uid)));
create policy seller_delivery_zones_read on public.seller_delivery_zones as permissive for select to anon, authenticated using (true);
create policy service_requests_parties_read on public.service_requests as permissive for select to authenticated using (((client_id = ( SELECT auth.uid() AS uid)) OR (provider_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM businesses b
  WHERE ((b.id = service_requests.business_id) AND (b.owner_id = ( SELECT auth.uid() AS uid)))))));
create policy services_provider_delete on public.services as permissive for delete to authenticated using ((provider_id = ( SELECT auth.uid() AS uid)));
create policy services_provider_insert on public.services as permissive for insert to authenticated with check ((provider_id = ( SELECT auth.uid() AS uid)));
create policy services_provider_update on public.services as permissive for update to authenticated using ((provider_id = ( SELECT auth.uid() AS uid))) with check ((provider_id = ( SELECT auth.uid() AS uid)));
create policy services_public_read on public.services as permissive for select to anon, authenticated using ((active = true));
create policy streets_public_read on public.streets as permissive for select to anon, authenticated using ((active = true));
create policy subscription_payments_own_read on public.subscription_payments as permissive for select to authenticated using (((owner_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy subscriptions_own_read on public.subscriptions as permissive for select to authenticated using (((owner_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy user_blocks_own_read on public.user_blocks as permissive for select to authenticated using ((blocker_id = ( SELECT auth.uid() AS uid)));
create policy user_reviews_public_read on public.user_reviews as permissive for select to anon, authenticated using ((status = 'published'::text));
create policy roles_admin_manage on public.user_roles as permissive for all to authenticated using (has_admin_role()) with check (has_admin_role());
create policy roles_self_read on public.user_roles as permissive for select to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR has_admin_role()));
create policy venue_items_owner on public.venue_items as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM venues v
  WHERE ((v.id = venue_items.venue_id) AND (v.owner_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM venues v
  WHERE ((v.id = venue_items.venue_id) AND (v.owner_id = ( SELECT auth.uid() AS uid))))));
create policy venue_items_read on public.venue_items as permissive for select to anon, authenticated using ((EXISTS ( SELECT 1
   FROM venues v
  WHERE ((v.id = venue_items.venue_id) AND ((v.status = 'approved'::text) OR (v.owner_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role))))));
create policy venue_order_lines_read on public.venue_order_lines as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM venue_orders o
  WHERE (o.id = venue_order_lines.order_id))));
create policy venue_orders_read on public.venue_orders as permissive for select to authenticated using (((buyer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role) OR (EXISTS ( SELECT 1
   FROM venues v
  WHERE ((v.id = venue_orders.venue_id) AND (v.owner_id = ( SELECT auth.uid() AS uid)))))));
create policy venue_pay_owner on public.venue_pay as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM venues v
  WHERE ((v.id = venue_pay.venue_id) AND (v.owner_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM venues v
  WHERE ((v.id = venue_pay.venue_id) AND (v.owner_id = ( SELECT auth.uid() AS uid))))));
create policy venue_platform_payments_read on public.venue_platform_payments as permissive for select to authenticated using (((owner_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy venues_insert on public.venues as permissive for insert to authenticated with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy venues_read on public.venues as permissive for select to anon, authenticated using (((status = 'approved'::text) OR (owner_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy venues_update on public.venues as permissive for update to authenticated using ((owner_id = ( SELECT auth.uid() AS uid))) with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy verification_own_read on public.verification_requests as permissive for select to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy wallet_entries_own_read on public.wallet_entries as permissive for select to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT has_admin_role() AS has_admin_role)));
create policy dispute_evidence_insert on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'dispute-evidence'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text) AND is_order_party((storage.foldername(name))[1])));
create policy dispute_evidence_read on storage.objects as permissive for select to authenticated using (((bucket_id = 'dispute-evidence'::text) AND (is_order_party((storage.foldername(name))[1]) OR has_admin_role())));
create policy "huambo chat media delete own" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'chat-media'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)));
create policy "huambo chat media read" on storage.objects as permissive for select to authenticated using (((bucket_id = 'chat-media'::text) AND (EXISTS ( SELECT 1
   FROM conversation_participants cp
  WHERE (((cp.conversation_id)::text = (storage.foldername(objects.name))[1]) AND (cp.user_id = ( SELECT auth.uid() AS uid)))))));
create policy "huambo chat media upload" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'chat-media'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM conversation_participants cp
  WHERE (((cp.conversation_id)::text = (storage.foldername(objects.name))[1]) AND (cp.user_id = ( SELECT auth.uid() AS uid)))))));
create policy "huambo media delete own folder" on storage.objects as permissive for delete to authenticated using (((bucket_id = ANY (ARRAY['classified-media'::text, 'avatars'::text, 'media-videos'::text])) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "huambo media insert own folder" on storage.objects as permissive for insert to authenticated with check (((bucket_id = ANY (ARRAY['classified-media'::text, 'avatars'::text, 'media-videos'::text])) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "huambo media update own folder" on storage.objects as permissive for update to authenticated using (((bucket_id = ANY (ARRAY['classified-media'::text, 'avatars'::text, 'media-videos'::text])) AND ((storage.foldername(name))[1] = (auth.uid())::text))) with check (((bucket_id = ANY (ARRAY['classified-media'::text, 'avatars'::text, 'media-videos'::text])) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy payment_proofs_fuel_station_read on storage.objects as permissive for select to authenticated using (((bucket_id = 'payment-proofs'::text) AND (EXISTS ( SELECT 1
   FROM (fuel_orders o
     JOIN fuel_stations s ON ((s.id = o.station_id)))
  WHERE ((o.proof_path = objects.name) AND (s.owner_id = ( SELECT auth.uid() AS uid)))))));
create policy payment_proofs_insert on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'payment-proofs'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
create policy payment_proofs_read on storage.objects as permissive for select to authenticated using (((bucket_id = 'payment-proofs'::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR has_admin_role())));
create policy payment_proofs_venue_read on storage.objects as permissive for select to authenticated using (((bucket_id = 'payment-proofs'::text) AND (EXISTS ( SELECT 1
   FROM (venue_orders o
     JOIN venues v ON ((v.id = o.venue_id)))
  WHERE ((o.proof_path = objects.name) AND (v.owner_id = ( SELECT auth.uid() AS uid)))))));
create policy verification_docs_insert on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'verification-docs'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy verification_docs_read on storage.objects as permissive for select to authenticated using (((bucket_id = 'verification-docs'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR has_admin_role())));

-- Permissões das tabelas, vistas e sequências
revoke all on table public.account_capabilities from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.account_capabilities to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.account_capabilities to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.account_capabilities to service_role;
revoke all on table public.addresses from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.addresses to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.addresses to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.addresses to service_role;
revoke all on table public.admin_audit_log from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.admin_audit_log to service_role;
revoke all on sequence public.admin_audit_log_id_seq from anon, authenticated, service_role;
revoke all on table public.agent_commissions from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.agent_commissions to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.agent_commissions to service_role;
revoke all on table public.auction_bids from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.auction_bids to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.auction_bids to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.auction_bids to service_role;
revoke all on table public.auction_max_bids from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.auction_max_bids to service_role;
revoke all on table public.auctions from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.auctions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.auctions to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.auctions to service_role;
revoke all on table public.businesses from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.businesses to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.businesses to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.businesses to service_role;
revoke all on table public.cart_items from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.cart_items to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.cart_items to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.cart_items to service_role;
revoke all on table public.carts from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.carts to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.carts to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.carts to service_role;
revoke all on table public.categories from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.categories to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.categories to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.categories to service_role;
revoke all on table public.classified_listings from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.classified_listings to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.classified_listings to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.classified_listings to service_role;
revoke all on sequence public.classified_listings_ref_no_seq from anon, authenticated, service_role;
revoke all on table public.classified_saved_searches from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.classified_saved_searches to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.classified_saved_searches to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.classified_saved_searches to service_role;
revoke all on table public.communes from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.communes to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.communes to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.communes to service_role;
revoke all on table public.conversation_participants from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.conversation_participants to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.conversation_participants to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.conversation_participants to service_role;
revoke all on table public.conversations from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.conversations to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.conversations to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.conversations to service_role;
revoke all on table public.couriers from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.couriers to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.couriers to service_role;
revoke all on table public.delivery_requests from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.delivery_requests to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.delivery_requests to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.delivery_requests to service_role;
revoke all on table public.event_orders from anon, authenticated, service_role;
grant SELECT on table public.event_orders to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.event_orders to service_role;
revoke all on sequence public.event_orders_ref_no_seq from anon, authenticated, service_role;
revoke all on table public.event_payment_info from anon, authenticated, service_role;
grant INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_payment_info to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.event_payment_info to service_role;
revoke all on table public.event_platform_payments from anon, authenticated, service_role;
grant SELECT on table public.event_platform_payments to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.event_platform_payments to service_role;
revoke all on sequence public.event_platform_payments_ref_no_seq from anon, authenticated, service_role;
revoke all on table public.event_ticket_types from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.event_ticket_types to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_ticket_types to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.event_ticket_types to service_role;
revoke all on table public.event_tickets from anon, authenticated, service_role;
grant SELECT on table public.event_tickets to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.event_tickets to service_role;
revoke all on table public.events from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.events to anon;
grant INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.events to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.events to service_role;
revoke all on sequence public.events_ref_no_seq from anon, authenticated, service_role;
revoke all on table public.field_agents from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.field_agents to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.field_agents to service_role;
revoke all on sequence public.field_agents_code_seq from anon, authenticated, service_role;
revoke all on table public.followed_businesses from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.followed_businesses to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.followed_businesses to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.followed_businesses to service_role;
revoke all on table public.followed_providers from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.followed_providers to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.followed_providers to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.followed_providers to service_role;
revoke all on table public.followed_sellers from anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.followed_sellers to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.followed_sellers to service_role;
revoke all on table public.fuel_alerts from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.fuel_alerts to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.fuel_alerts to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.fuel_alerts to service_role;
revoke all on table public.fuel_orders from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.fuel_orders to anon;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.fuel_orders to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.fuel_orders to service_role;
revoke all on sequence public.fuel_orders_ref_no_seq from anon, authenticated, service_role;
revoke all on table public.fuel_platform_payments from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.fuel_platform_payments to anon;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.fuel_platform_payments to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.fuel_platform_payments to service_role;
revoke all on sequence public.fuel_platform_payments_ref_no_seq from anon, authenticated, service_role;
revoke all on table public.fuel_products from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.fuel_products to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.fuel_products to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.fuel_products to service_role;
revoke all on table public.fuel_reports from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.fuel_reports to service_role;
revoke all on table public.fuel_station_pay from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.fuel_station_pay to anon;
grant INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.fuel_station_pay to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.fuel_station_pay to service_role;
revoke all on table public.fuel_stations from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.fuel_stations to anon;
grant INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.fuel_stations to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.fuel_stations to service_role;
revoke all on sequence public.fuel_stations_ref_no_seq from anon, authenticated, service_role;
revoke all on table public.inspections from anon, authenticated, service_role;
grant SELECT on table public.inspections to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.inspections to service_role;
revoke all on sequence public.inspections_ref_no_seq from anon, authenticated, service_role;
revoke all on table public.item_stats_daily from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.item_stats_daily to service_role;
revoke all on table public.job_queue from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.job_queue to service_role;
revoke all on sequence public.job_queue_id_seq from anon, authenticated, service_role;
revoke all on table public.listing_boosts from anon, authenticated, service_role;
grant SELECT on table public.listing_boosts to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.listing_boosts to service_role;
revoke all on sequence public.listing_boosts_ref_no_seq from anon, authenticated, service_role;
revoke all on table public.listing_claims from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.listing_claims to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.listing_claims to service_role;
revoke all on sequence public.listing_claims_ref_no_seq from anon, authenticated, service_role;
revoke all on table public.listing_commissions from anon, authenticated, service_role;
grant SELECT on table public.listing_commissions to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.listing_commissions to service_role;
revoke all on table public.listing_offers from anon, authenticated, service_role;
grant SELECT on table public.listing_offers to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.listing_offers to service_role;
revoke all on table public.markets from anon, authenticated, service_role;
grant SELECT on table public.markets to anon;
grant INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.markets to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.markets to service_role;
revoke all on table public.media_cleanup_queue from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.media_cleanup_queue to service_role;
revoke all on table public.messages from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.messages to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.messages to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.messages to service_role;
revoke all on table public.moderation_reports from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.moderation_reports to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.moderation_reports to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.moderation_reports to service_role;
revoke all on table public.municipalities from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.municipalities to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.municipalities to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.municipalities to service_role;
revoke all on table public.neighborhoods from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.neighborhoods to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.neighborhoods to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.neighborhoods to service_role;
revoke all on table public.notification_preferences from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.notification_preferences to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notification_preferences to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.notification_preferences to service_role;
revoke all on table public.notifications from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.notifications to anon;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notifications to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.notifications to service_role;
revoke all on table public.order_dispute_events from anon, authenticated, service_role;
grant SELECT on table public.order_dispute_events to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.order_dispute_events to service_role;
revoke all on table public.order_disputes from anon, authenticated, service_role;
grant SELECT on table public.order_disputes to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.order_disputes to service_role;
revoke all on table public.order_items from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.order_items to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.order_items to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.order_items to service_role;
revoke all on table public.order_payments from anon, authenticated, service_role;
grant SELECT on table public.order_payments to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.order_payments to service_role;
revoke all on table public.orders from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.orders to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.orders to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.orders to service_role;
revoke all on sequence public.orders_ref_no_seq from anon, authenticated, service_role;
revoke all on table public.organization_members from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.organization_members to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.organization_members to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.organization_members to service_role;
revoke all on table public.organizations from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.organizations to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.organizations to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.organizations to service_role;
revoke all on table public.payout_accounts from anon, authenticated, service_role;
grant SELECT on table public.payout_accounts to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.payout_accounts to service_role;
revoke all on table public.payout_requests from anon, authenticated, service_role;
grant SELECT on table public.payout_requests to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.payout_requests to service_role;
revoke all on sequence public.payout_requests_ref_no_seq from anon, authenticated, service_role;
revoke all on table public.photo_search_usage from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.photo_search_usage to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.photo_search_usage to service_role;
revoke all on table public.platform_settings from anon, authenticated, service_role;
grant SELECT on table public.platform_settings to anon;
grant SELECT on table public.platform_settings to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.platform_settings to service_role;
revoke all on table public.portfolio_items from anon, authenticated, service_role;
grant SELECT on table public.portfolio_items to anon;
grant DELETE, INSERT, SELECT, UPDATE on table public.portfolio_items to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.portfolio_items to service_role;
revoke all on table public.products from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.products to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.products to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.products to service_role;
revoke all on sequence public.products_ref_no_seq from anon, authenticated, service_role;
revoke all on table public.profiles from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.profiles to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.profiles to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.profiles to service_role;
revoke all on table public.promo_boosts from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.promo_boosts to anon;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.promo_boosts to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.promo_boosts to service_role;
revoke all on sequence public.promo_boosts_ref_no_seq from anon, authenticated, service_role;
revoke all on table public.promo_posts from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.promo_posts to anon;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.promo_posts to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.promo_posts to service_role;
revoke all on sequence public.promo_posts_ref_no_seq from anon, authenticated, service_role;
revoke all on table public.provider_profiles from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.provider_profiles to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.provider_profiles to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.provider_profiles to service_role;
revoke all on table public.provinces from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.provinces to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.provinces to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.provinces to service_role;
revoke all on table public.rating_summaries from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.rating_summaries to anon;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.rating_summaries to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.rating_summaries to service_role;
revoke all on table public.referral_codes from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.referral_codes to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.referral_codes to service_role;
revoke all on table public.referrals from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.referrals to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.referrals to service_role;
revoke all on table public.rental_requests from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.rental_requests to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rental_requests to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.rental_requests to service_role;
revoke all on table public.reviews from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.reviews to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.reviews to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.reviews to service_role;
revoke all on table public.saved_items from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.saved_items to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.saved_items to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.saved_items to service_role;
revoke all on table public.saved_search_notification_queue from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.saved_search_notification_queue to anon;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.saved_search_notification_queue to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.saved_search_notification_queue to service_role;
revoke all on table public.seller_delivery_settings from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.seller_delivery_settings to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.seller_delivery_settings to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.seller_delivery_settings to service_role;
revoke all on table public.seller_delivery_zones from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.seller_delivery_zones to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.seller_delivery_zones to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.seller_delivery_zones to service_role;
revoke all on table public.service_requests from anon, authenticated, service_role;
grant SELECT on table public.service_requests to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.service_requests to service_role;
revoke all on table public.services from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.services to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.services to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.services to service_role;
revoke all on table public.streets from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.streets to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.streets to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.streets to service_role;
revoke all on table public.subscription_payments from anon, authenticated, service_role;
grant SELECT on table public.subscription_payments to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.subscription_payments to service_role;
revoke all on table public.subscriptions from anon, authenticated, service_role;
grant SELECT on table public.subscriptions to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.subscriptions to service_role;
revoke all on table public.user_blocks from anon, authenticated, service_role;
grant SELECT on table public.user_blocks to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.user_blocks to service_role;
revoke all on table public.user_reviews from anon, authenticated, service_role;
grant SELECT on table public.user_reviews to anon;
grant SELECT on table public.user_reviews to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.user_reviews to service_role;
revoke all on table public.user_roles from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.user_roles to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_roles to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.user_roles to service_role;
revoke all on table public.venue_items from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.venue_items to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.venue_items to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.venue_items to service_role;
revoke all on table public.venue_order_lines from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.venue_order_lines to anon;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.venue_order_lines to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.venue_order_lines to service_role;
revoke all on table public.venue_orders from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.venue_orders to anon;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.venue_orders to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.venue_orders to service_role;
revoke all on sequence public.venue_orders_ref_no_seq from anon, authenticated, service_role;
revoke all on table public.venue_pay from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.venue_pay to anon;
grant INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.venue_pay to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.venue_pay to service_role;
revoke all on table public.venue_platform_payments from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.venue_platform_payments to anon;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.venue_platform_payments to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.venue_platform_payments to service_role;
revoke all on sequence public.venue_platform_payments_ref_no_seq from anon, authenticated, service_role;
revoke all on table public.venues from anon, authenticated, service_role;
grant MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.venues to anon;
grant INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.venues to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.venues to service_role;
revoke all on sequence public.venues_ref_no_seq from anon, authenticated, service_role;
revoke all on table public.verification_requests from anon, authenticated, service_role;
grant SELECT on table public.verification_requests to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.verification_requests to service_role;
revoke all on table public.wallet_entries from anon, authenticated, service_role;
grant SELECT on table public.wallet_entries to authenticated;
grant MAINTAIN, REFERENCES, TRIGGER, TRUNCATE on table public.wallet_entries to service_role;
revoke all on sequence public.wallet_entries_id_seq from anon, authenticated, service_role;

-- Permissões das funções
revoke all on function public.activate_due_auctions() from public, anon, authenticated, service_role;
revoke all on function public.admin_decide_agent(p_user_id uuid, p_status text, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_decide_agent(p_user_id uuid, p_status text, p_note text) to authenticated;
revoke all on function public.admin_decide_agent_commissions(p_ids uuid[], p_approve boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_decide_agent_commissions(p_ids uuid[], p_approve boolean, p_note text) to authenticated;
revoke all on function public.admin_decide_boost(p_boost_id uuid, p_confirm boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_decide_boost(p_boost_id uuid, p_confirm boolean, p_note text) to authenticated;
revoke all on function public.admin_decide_dispute(p_dispute_id uuid, p_decision text, p_amount numeric, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_decide_dispute(p_dispute_id uuid, p_decision text, p_amount numeric, p_note text) to authenticated;
revoke all on function public.admin_decide_event_payment(p_payment_id uuid, p_confirm boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_decide_event_payment(p_payment_id uuid, p_confirm boolean, p_note text) to authenticated;
revoke all on function public.admin_decide_fuel_payment(p_payment_id uuid, p_confirm boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_decide_fuel_payment(p_payment_id uuid, p_confirm boolean, p_note text) to authenticated;
revoke all on function public.admin_decide_inspection(p_id uuid, p_approve boolean, p_note text, p_checklist jsonb) from public, anon, authenticated, service_role;
grant execute on function public.admin_decide_inspection(p_id uuid, p_approve boolean, p_note text, p_checklist jsonb) to authenticated;
revoke all on function public.admin_decide_inspection_payment(p_id uuid, p_confirm boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_decide_inspection_payment(p_id uuid, p_confirm boolean, p_note text) to authenticated;
revoke all on function public.admin_decide_listing_claim(p_claim_id uuid, p_uphold boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_decide_listing_claim(p_claim_id uuid, p_uphold boolean, p_note text) to authenticated;
revoke all on function public.admin_decide_order_payment(p_payment_id uuid, p_confirm boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_decide_order_payment(p_payment_id uuid, p_confirm boolean, p_note text) to authenticated;
revoke all on function public.admin_decide_promo_boost(p_boost_id uuid, p_confirm boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_decide_promo_boost(p_boost_id uuid, p_confirm boolean, p_note text) to authenticated;
revoke all on function public.admin_decide_subscription_payment(p_payment_id uuid, p_confirm boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_decide_subscription_payment(p_payment_id uuid, p_confirm boolean, p_note text) to authenticated;
revoke all on function public.admin_decide_venue_payment(p_payment_id uuid, p_confirm boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_decide_venue_payment(p_payment_id uuid, p_confirm boolean, p_note text) to authenticated;
revoke all on function public.admin_decide_verification(p_id uuid, p_approve boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_decide_verification(p_id uuid, p_approve boolean, p_note text) to authenticated;
revoke all on function public.admin_escrow_summary() from public, anon, authenticated, service_role;
grant execute on function public.admin_escrow_summary() to authenticated;
revoke all on function public.admin_job_queue_stats() from public, anon, authenticated, service_role;
grant execute on function public.admin_job_queue_stats() to authenticated;
revoke all on function public.admin_list_agent_commissions(p_status text) from public, anon, authenticated, service_role;
revoke all on function public.admin_list_agent_commissions_v2(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_agent_commissions_v2(p_status text) to authenticated;
revoke all on function public.admin_list_agents(p_status text) from public, anon, authenticated, service_role;
revoke all on function public.admin_list_agents_v2(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_agents_v2(p_status text) to authenticated;
revoke all on function public.admin_list_audit(p_limit integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_audit(p_limit integer) to authenticated;
revoke all on function public.admin_list_boosts(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_boosts(p_status text) to authenticated;
revoke all on function public.admin_list_commissions(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_commissions(p_status text) to authenticated;
revoke all on function public.admin_list_couriers() from public, anon, authenticated, service_role;
grant execute on function public.admin_list_couriers() to authenticated;
revoke all on function public.admin_list_deliveries() from public, anon, authenticated, service_role;
grant execute on function public.admin_list_deliveries() to authenticated;
revoke all on function public.admin_list_disputes(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_disputes(p_status text) to authenticated;
revoke all on function public.admin_list_disputes_v2(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_disputes_v2(p_status text) to authenticated;
revoke all on function public.admin_list_event_payments(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_event_payments(p_status text) to authenticated;
revoke all on function public.admin_list_fuel_orders(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_fuel_orders(p_status text) to authenticated;
revoke all on function public.admin_list_fuel_payments(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_fuel_payments(p_status text) to authenticated;
revoke all on function public.admin_list_inspections(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_inspections(p_status text) to authenticated;
revoke all on function public.admin_list_listing_claims(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_listing_claims(p_status text) to authenticated;
revoke all on function public.admin_list_listings(p_status text, p_query text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_listings(p_status text, p_query text) to authenticated;
revoke all on function public.admin_list_order_payments(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_order_payments(p_status text) to authenticated;
revoke all on function public.admin_list_payouts(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_payouts(p_status text) to authenticated;
revoke all on function public.admin_list_promo_boosts(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_promo_boosts(p_status text) to authenticated;
revoke all on function public.admin_list_promo_posts(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_promo_posts(p_status text) to authenticated;
revoke all on function public.admin_list_reports(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_reports(p_status text) to authenticated;
revoke all on function public.admin_list_reports_v2(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_reports_v2(p_status text) to authenticated;
revoke all on function public.admin_list_subscription_payments(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_subscription_payments(p_status text) to authenticated;
revoke all on function public.admin_list_users(p_query text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_users(p_query text) to authenticated;
revoke all on function public.admin_list_venue_orders(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_venue_orders(p_status text) to authenticated;
revoke all on function public.admin_list_venue_payments(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_venue_payments(p_status text) to authenticated;
revoke all on function public.admin_list_venues(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_venues(p_status text) to authenticated;
revoke all on function public.admin_list_verifications(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_verifications(p_status text) to authenticated;
revoke all on function public.admin_list_verifications_v2(p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_verifications_v2(p_status text) to authenticated;
revoke all on function public.admin_mark_payouts_paid(p_ids uuid[], p_bank_reference text) from public, anon, authenticated, service_role;
grant execute on function public.admin_mark_payouts_paid(p_ids uuid[], p_bank_reference text) to authenticated;
revoke all on function public.admin_moderate_listing(p_listing_id uuid, p_status text, p_featured boolean) from public, anon, authenticated, service_role;
grant execute on function public.admin_moderate_listing(p_listing_id uuid, p_status text, p_featured boolean) to authenticated;
revoke all on function public.admin_reject_payout(p_payout_id uuid, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_reject_payout(p_payout_id uuid, p_note text) to authenticated;
revoke all on function public.admin_release_escrow(p_order_id uuid, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_release_escrow(p_order_id uuid, p_note text) to authenticated;
revoke all on function public.admin_resolve_report(p_report_id uuid, p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_resolve_report(p_report_id uuid, p_status text) to authenticated;
revoke all on function public.admin_revenue(p_from date, p_to date) from public, anon, authenticated, service_role;
grant execute on function public.admin_revenue(p_from date, p_to date) to authenticated;
revoke all on function public.admin_revoke_inspection(p_id uuid, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_revoke_inspection(p_id uuid, p_note text) to authenticated;
revoke all on function public.admin_schedule_inspection(p_id uuid, p_when timestamp with time zone, p_inspector text, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_schedule_inspection(p_id uuid, p_when timestamp with time zone, p_inspector text, p_note text) to authenticated;
revoke all on function public.admin_set_courier_status(p_user_id uuid, p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_courier_status(p_user_id uuid, p_status text) to authenticated;
revoke all on function public.admin_set_fuel_station_status(p_station_id uuid, p_status text, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_fuel_station_status(p_station_id uuid, p_status text, p_note text) to authenticated;
revoke all on function public.admin_set_promo_hidden(p_id uuid, p_hidden boolean, p_reason text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_promo_hidden(p_id uuid, p_hidden boolean, p_reason text) to authenticated;
revoke all on function public.admin_set_target_active(p_target_type text, p_target_id uuid, p_active boolean) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_target_active(p_target_type text, p_target_id uuid, p_active boolean) to authenticated;
revoke all on function public.admin_set_user_role(p_user_id uuid, p_role text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_user_role(p_user_id uuid, p_role text) to authenticated;
revoke all on function public.admin_set_user_status(p_user_id uuid, p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_user_status(p_user_id uuid, p_status text) to authenticated;
revoke all on function public.admin_set_venue_status(p_venue_id uuid, p_status text, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_venue_status(p_venue_id uuid, p_status text, p_note text) to authenticated;
revoke all on function public.admin_start_payout_batch() from public, anon, authenticated, service_role;
grant execute on function public.admin_start_payout_batch() to authenticated;
revoke all on function public.admin_stats() from public, anon, authenticated, service_role;
grant execute on function public.admin_stats() to authenticated;
revoke all on function public.admin_update_commission(p_id uuid, p_action text, p_note text, p_sale_amount numeric) from public, anon, authenticated, service_role;
grant execute on function public.admin_update_commission(p_id uuid, p_action text, p_note text, p_sale_amount numeric) to authenticated;
revoke all on function public.agent_commission_create(p_listing_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.angola_iban_digits(p text) from public, anon, authenticated, service_role;
revoke all on function public.angola_today() from public, anon, authenticated, service_role;
grant execute on function public.angola_today() to anon;
grant execute on function public.angola_today() to authenticated;
revoke all on function public.apply_field_agent(p_market_id uuid, p_full_name text, p_phone text, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.apply_field_agent(p_market_id uuid, p_full_name text, p_phone text, p_note text) to authenticated;
revoke all on function public.apply_notification_preferences() from public, anon, authenticated, service_role;
revoke all on function public.assign_delivery(p_delivery_id uuid, p_assignee uuid) from public, anon, authenticated, service_role;
grant execute on function public.assign_delivery(p_delivery_id uuid, p_assignee uuid) to authenticated;
revoke all on function public.auction_bids_for(p_auction_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.auction_bids_for(p_auction_id uuid) to public;
grant execute on function public.auction_bids_for(p_auction_id uuid) to anon;
grant execute on function public.auction_bids_for(p_auction_id uuid) to authenticated;
revoke all on function public.auction_bids_for_v2(p_auction_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.auction_bids_for_v2(p_auction_id uuid) to public;
grant execute on function public.auction_bids_for_v2(p_auction_id uuid) to anon;
grant execute on function public.auction_bids_for_v2(p_auction_id uuid) to authenticated;
revoke all on function public.auction_drop_bidder(a auctions, p_bidder uuid, p_by uuid, p_reason text) from public, anon, authenticated, service_role;
revoke all on function public.auction_for_listing(p_listing_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.auction_for_listing(p_listing_id uuid) to public;
grant execute on function public.auction_for_listing(p_listing_id uuid) to anon;
grant execute on function public.auction_for_listing(p_listing_id uuid) to authenticated;
revoke all on function public.auction_for_listing_v2(p_listing_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.auction_for_listing_v2(p_listing_id uuid) to public;
grant execute on function public.auction_for_listing_v2(p_listing_id uuid) to anon;
grant execute on function public.auction_for_listing_v2(p_listing_id uuid) to authenticated;
revoke all on function public.auction_increment(p_price numeric, p_min numeric) from public, anon, authenticated, service_role;
grant execute on function public.auction_increment(p_price numeric, p_min numeric) to public;
grant execute on function public.auction_increment(p_price numeric, p_min numeric) to anon;
grant execute on function public.auction_increment(p_price numeric, p_min numeric) to authenticated;
revoke all on function public.auction_mark_listing_sold() from public, anon, authenticated, service_role;
revoke all on function public.auction_recalc(p_auction_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.auction_standing(p_auction_id uuid, OUT leader uuid, OUT leader_max numeric, OUT price numeric) from public, anon, authenticated, service_role;
revoke all on function public.audit_admin_change() from public, anon, authenticated, service_role;
revoke all on function public.available_deliveries() from public, anon, authenticated, service_role;
grant execute on function public.available_deliveries() to authenticated;
revoke all on function public.boost_expire() from public, anon, authenticated, service_role;
revoke all on function public.business_directory(p_query text, p_category_id uuid, p_municipality_id uuid, p_limit integer) from public, anon, authenticated, service_role;
grant execute on function public.business_directory(p_query text, p_category_id uuid, p_municipality_id uuid, p_limit integer) to public;
grant execute on function public.business_directory(p_query text, p_category_id uuid, p_municipality_id uuid, p_limit integer) to anon;
grant execute on function public.business_directory(p_query text, p_category_id uuid, p_municipality_id uuid, p_limit integer) to authenticated;
revoke all on function public.business_stats(p_business_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.business_stats(p_business_id uuid) to public;
grant execute on function public.business_stats(p_business_id uuid) to anon;
grant execute on function public.business_stats(p_business_id uuid) to authenticated;
revoke all on function public.buy_auction_now(p_auction_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.buy_auction_now(p_auction_id uuid) to authenticated;
revoke all on function public.buyer_listing_claim(p_claim_id uuid, p_action text, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.buyer_listing_claim(p_claim_id uuid, p_action text, p_note text) to authenticated;
revoke all on function public.cancel_delivery_request(p_delivery_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.cancel_delivery_request(p_delivery_id uuid) to authenticated;
revoke all on function public.cancel_event(p_event_id uuid, p_reason text) from public, anon, authenticated, service_role;
grant execute on function public.cancel_event(p_event_id uuid, p_reason text) to authenticated;
revoke all on function public.cancel_event_ticket_order(p_order_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.cancel_event_ticket_order(p_order_id uuid) to authenticated;
revoke all on function public.cancel_fuel_order(p_order_id uuid, p_reason text) from public, anon, authenticated, service_role;
grant execute on function public.cancel_fuel_order(p_order_id uuid, p_reason text) to authenticated;
revoke all on function public.cancel_inspection(p_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.cancel_inspection(p_id uuid) to authenticated;
revoke all on function public.cancel_payout(p_payout_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.cancel_payout(p_payout_id uuid) to authenticated;
revoke all on function public.cancel_rental_request(p_request_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.cancel_rental_request(p_request_id uuid) to authenticated;
revoke all on function public.cancel_venue_order(p_order_id uuid, p_reason text) from public, anon, authenticated, service_role;
grant execute on function public.cancel_venue_order(p_order_id uuid, p_reason text) to authenticated;
revoke all on function public.cart_add(p_product_id uuid, p_quantity integer) from public, anon, authenticated, service_role;
grant execute on function public.cart_add(p_product_id uuid, p_quantity integer) to authenticated;
revoke all on function public.cart_contents() from public, anon, authenticated, service_role;
grant execute on function public.cart_contents() to authenticated;
revoke all on function public.cart_delivery_quote(p_municipality_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.cart_delivery_quote(p_municipality_id uuid) to authenticated;
revoke all on function public.cart_set_quantity(p_product_id uuid, p_quantity integer) from public, anon, authenticated, service_role;
grant execute on function public.cart_set_quantity(p_product_id uuid, p_quantity integer) to authenticated;
revoke all on function public.check_agent_code(p_code text) from public, anon, authenticated, service_role;
grant execute on function public.check_agent_code(p_code text) to authenticated;
revoke all on function public.check_in_event_ticket(p_event_id uuid, p_code text) from public, anon, authenticated, service_role;
grant execute on function public.check_in_event_ticket(p_event_id uuid, p_code text) to authenticated;
revoke all on function public.checkout_cart(p_cart_id uuid, p_delivery_address_id uuid, p_delivery_fee numeric) from public, anon, authenticated, service_role;
revoke all on function public.claim_delivery(p_delivery_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.claim_delivery(p_delivery_id uuid) to authenticated;
revoke all on function public.claim_referral(p_code text) from public, anon, authenticated, service_role;
grant execute on function public.claim_referral(p_code text) to authenticated;
revoke all on function public.classified_saved_search_matches_listing(p_filters jsonb, p_listing classified_listings) from public, anon, authenticated, service_role;
revoke all on function public.clean_refund_destination(p text) from public, anon, authenticated, service_role;
revoke all on function public.close_auction(p_auction_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.close_auction(p_auction_id uuid) to authenticated;
revoke all on function public.close_classified_listing(p_listing_id uuid, p_final_status text) from public, anon, authenticated, service_role;
grant execute on function public.close_classified_listing(p_listing_id uuid, p_final_status text) to authenticated;
revoke all on function public.collect_fuel(p_station_id uuid, p_code text) from public, anon, authenticated, service_role;
grant execute on function public.collect_fuel(p_station_id uuid, p_code text) to authenticated;
revoke all on function public.complete_venue_order(p_venue_id uuid, p_code text) from public, anon, authenticated, service_role;
grant execute on function public.complete_venue_order(p_venue_id uuid, p_code text) to authenticated;
revoke all on function public.confirm_order_received(p_order_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.confirm_order_received(p_order_id uuid) to authenticated;
revoke all on function public.confirm_service(p_id uuid, p_rating integer, p_comment text) from public, anon, authenticated, service_role;
grant execute on function public.confirm_service(p_id uuid, p_rating integer, p_comment text) to authenticated;
revoke all on function public.consume_photo_search() from public, anon, authenticated, service_role;
grant execute on function public.consume_photo_search() to authenticated;
revoke all on function public.create_classified_auction(p_listing_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_starting_price numeric, p_reserve_price numeric, p_min_increment numeric) from public, anon, authenticated, service_role;
grant execute on function public.create_classified_auction(p_listing_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_starting_price numeric, p_reserve_price numeric, p_min_increment numeric) to authenticated;
revoke all on function public.create_classified_saved_search(p_name text, p_filters jsonb) from public, anon, authenticated, service_role;
grant execute on function public.create_classified_saved_search(p_name text, p_filters jsonb) to authenticated;
revoke all on function public.create_notification(p_user_id uuid, p_type text, p_title text, p_body text, p_data jsonb) from public, anon, authenticated, service_role;
grant execute on function public.create_notification(p_user_id uuid, p_type text, p_title text, p_body text, p_data jsonb) to service_role;
revoke all on function public.current_user_active() from public, anon, authenticated, service_role;
grant execute on function public.current_user_active() to authenticated;
revoke all on function public.decide_event_ticket_order(p_order_id uuid, p_confirm boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.decide_event_ticket_order(p_order_id uuid, p_confirm boolean, p_note text) to authenticated;
revoke all on function public.decide_fuel_payment(p_order_id uuid, p_confirm boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.decide_fuel_payment(p_order_id uuid, p_confirm boolean, p_note text) to authenticated;
revoke all on function public.decide_venue_payment(p_order_id uuid, p_confirm boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.decide_venue_payment(p_order_id uuid, p_confirm boolean, p_note text) to authenticated;
revoke all on function public.delete_my_account() from public, anon, authenticated, service_role;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.delete_promo_post(p_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_promo_post(p_id uuid) to authenticated;
revoke all on function public.delivery_requires_payment() from public, anon, authenticated, service_role;
revoke all on function public.dispute_action(p_dispute_id uuid, p_action text, p_note text, p_photos text[]) from public, anon, authenticated, service_role;
grant execute on function public.dispute_action(p_dispute_id uuid, p_action text, p_note text, p_photos text[]) to authenticated;
revoke all on function public.dispute_clean_photos(p_order_id uuid, p_photos text[]) from public, anon, authenticated, service_role;
revoke all on function public.dispute_events_json(p_dispute_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.dispute_log(d order_disputes, p_role text, p_action text, p_note text, p_photos text[]) from public, anon, authenticated, service_role;
revoke all on function public.enqueue_job(p_kind text, p_ref uuid) from public, anon, authenticated, service_role;
revoke all on function public.escrow_mark_paid(p_payment_id uuid, p_paid_amount numeric, p_provider_payment_id text) from public, anon, authenticated, service_role;
revoke all on function public.escrow_refund_alert() from public, anon, authenticated, service_role;
revoke all on function public.escrow_release(p_order_id uuid, p_by text, p_force boolean) from public, anon, authenticated, service_role;
revoke all on function public.escrow_tick() from public, anon, authenticated, service_role;
revoke all on function public.event_fee_due(p_event uuid) from public, anon, authenticated, service_role;
revoke all on function public.event_ticket_availability(p_event_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.event_ticket_availability(p_event_id uuid) to anon;
grant execute on function public.event_ticket_availability(p_event_id uuid) to authenticated;
revoke all on function public.events_tick() from public, anon, authenticated, service_role;
revoke all on function public.finalize_due_auctions() from public, anon, authenticated, service_role;
revoke all on function public.find_by_ref(p_ref text) from public, anon, authenticated, service_role;
grant execute on function public.find_by_ref(p_ref text) to public;
grant execute on function public.find_by_ref(p_ref text) to anon;
grant execute on function public.find_by_ref(p_ref text) to authenticated;
revoke all on function public.flush_daily_saved_search_notifications(p_now timestamp with time zone) from public, anon, authenticated, service_role;
grant execute on function public.flush_daily_saved_search_notifications(p_now timestamp with time zone) to service_role;
revoke all on function public.fold_text(p text) from public, anon, authenticated, service_role;
grant execute on function public.fold_text(p text) to public;
revoke all on function public.follow_info(p_kind text, p_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.follow_info(p_kind text, p_id uuid) to public;
grant execute on function public.follow_info(p_kind text, p_id uuid) to anon;
grant execute on function public.follow_info(p_kind text, p_id uuid) to authenticated;
revoke all on function public.follow_notify_listing() from public, anon, authenticated, service_role;
revoke all on function public.follow_notify_portfolio() from public, anon, authenticated, service_role;
revoke all on function public.follow_notify_product() from public, anon, authenticated, service_role;
revoke all on function public.format_angola_iban(p_digits text) from public, anon, authenticated, service_role;
revoke all on function public.fuel_fee_due(p_station uuid) from public, anon, authenticated, service_role;
revoke all on function public.fuel_feed(p_product text, p_municipality uuid, p_station uuid, p_limit integer) from public, anon, authenticated, service_role;
grant execute on function public.fuel_feed(p_product text, p_municipality uuid, p_station uuid, p_limit integer) to public;
grant execute on function public.fuel_feed(p_product text, p_municipality uuid, p_station uuid, p_limit integer) to anon;
grant execute on function public.fuel_feed(p_product text, p_municipality uuid, p_station uuid, p_limit integer) to authenticated;
revoke all on function public.fuel_fees_overdue(p_station uuid) from public, anon, authenticated, service_role;
revoke all on function public.fuel_order_by_token(p_token text) from public, anon, authenticated, service_role;
grant execute on function public.fuel_order_by_token(p_token text) to anon;
grant execute on function public.fuel_order_by_token(p_token text) to authenticated;
revoke all on function public.fuel_product_changed() from public, anon, authenticated, service_role;
revoke all on function public.fuel_product_label(p text) from public, anon, authenticated, service_role;
grant execute on function public.fuel_product_label(p text) to public;
revoke all on function public.fuel_reserved_qty(p_product uuid) from public, anon, authenticated, service_role;
revoke all on function public.fuel_station_created() from public, anon, authenticated, service_role;
revoke all on function public.fuel_station_panel(p_station_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.fuel_station_panel(p_station_id uuid) to authenticated;
revoke all on function public.fuel_tick() from public, anon, authenticated, service_role;
revoke all on function public.get_notification_preferences() from public, anon, authenticated, service_role;
grant execute on function public.get_notification_preferences() to authenticated;
revoke all on function public.get_promo_post(p_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_promo_post(p_id uuid) to public;
grant execute on function public.get_promo_post(p_id uuid) to anon;
grant execute on function public.get_promo_post(p_id uuid) to authenticated;
revoke all on function public.get_public_profile(p_user_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_public_profile(p_user_id uuid) to anon;
grant execute on function public.get_public_profile(p_user_id uuid) to authenticated;
revoke all on function public.guard_classified_listing() from public, anon, authenticated, service_role;
revoke all on function public.guard_commission_overdue() from public, anon, authenticated, service_role;
revoke all on function public.guard_event() from public, anon, authenticated, service_role;
revoke all on function public.guard_fuel_station() from public, anon, authenticated, service_role;
revoke all on function public.guard_fuel_station_pay() from public, anon, authenticated, service_role;
revoke all on function public.guard_listing_agent() from public, anon, authenticated, service_role;
revoke all on function public.guard_listing_deal() from public, anon, authenticated, service_role;
grant execute on function public.guard_listing_deal() to public;
revoke all on function public.guard_message_sender() from public, anon, authenticated, service_role;
revoke all on function public.guard_order_write() from public, anon, authenticated, service_role;
grant execute on function public.guard_order_write() to public;
grant execute on function public.guard_order_write() to authenticated;
revoke all on function public.guard_profile_update() from public, anon, authenticated, service_role;
revoke all on function public.guard_review_write() from public, anon, authenticated, service_role;
grant execute on function public.guard_review_write() to authenticated;
revoke all on function public.guard_server_only_write() from public, anon, authenticated, service_role;
grant execute on function public.guard_server_only_write() to public;
grant execute on function public.guard_server_only_write() to authenticated;
revoke all on function public.guard_store_paid_up() from public, anon, authenticated, service_role;
revoke all on function public.guard_ticket_type() from public, anon, authenticated, service_role;
revoke all on function public.guard_venue() from public, anon, authenticated, service_role;
revoke all on function public.guard_venue_pay() from public, anon, authenticated, service_role;
revoke all on function public.guard_verified_flag() from public, anon, authenticated, service_role;
grant execute on function public.guard_verified_flag() to public;
revoke all on function public.handle_new_huambo_user() from public, anon, authenticated, service_role;
revoke all on function public.has_admin_role() from public, anon, authenticated, service_role;
grant execute on function public.has_admin_role() to authenticated;
revoke all on function public.inspected_targets(p_kind text, p_ids uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.inspected_targets(p_kind text, p_ids uuid[]) to anon;
grant execute on function public.inspected_targets(p_kind text, p_ids uuid[]) to authenticated;
revoke all on function public.inspection_target_name(p_kind text, p_target uuid) from public, anon, authenticated, service_role;
revoke all on function public.inspection_target_owner(p_kind text, p_target uuid) from public, anon, authenticated, service_role;
revoke all on function public.is_admin() from public, anon, authenticated, service_role;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.is_approved_courier() from public, anon, authenticated, service_role;
grant execute on function public.is_approved_courier() to authenticated;
revoke all on function public.is_order_party(p_order text) from public, anon, authenticated, service_role;
grant execute on function public.is_order_party(p_order text) to authenticated;
revoke all on function public.issue_event_tickets(o event_orders) from public, anon, authenticated, service_role;
revoke all on function public.job_follow_listing(p_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.job_follow_portfolio(p_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.job_follow_product(p_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.job_fuel_alert(p_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.job_queue_cleanup() from public, anon, authenticated, service_role;
revoke all on function public.job_saved_search(p_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.job_wanted(p_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.list_active_categories(p_type text) from public, anon, authenticated, service_role;
grant execute on function public.list_active_categories(p_type text) to anon;
grant execute on function public.list_active_categories(p_type text) to authenticated;
revoke all on function public.list_active_provinces(p_country_code text) from public, anon, authenticated, service_role;
grant execute on function public.list_active_provinces(p_country_code text) to anon;
grant execute on function public.list_active_provinces(p_country_code text) to authenticated;
revoke all on function public.list_events(p_category text, p_municipality uuid, p_query text, p_limit integer) from public, anon, authenticated, service_role;
grant execute on function public.list_events(p_category text, p_municipality uuid, p_query text, p_limit integer) to anon;
grant execute on function public.list_events(p_category text, p_municipality uuid, p_query text, p_limit integer) to authenticated;
revoke all on function public.list_reviews(p_provider_id uuid, p_business_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.list_reviews(p_provider_id uuid, p_business_id uuid) to public;
grant execute on function public.list_reviews(p_provider_id uuid, p_business_id uuid) to anon;
grant execute on function public.list_reviews(p_provider_id uuid, p_business_id uuid) to authenticated;
revoke all on function public.list_reviews_v2(p_provider_id uuid, p_business_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.list_reviews_v2(p_provider_id uuid, p_business_id uuid) to public;
grant execute on function public.list_reviews_v2(p_provider_id uuid, p_business_id uuid) to anon;
grant execute on function public.list_reviews_v2(p_provider_id uuid, p_business_id uuid) to authenticated;
revoke all on function public.list_reviews_v3(p_provider_id uuid, p_business_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.list_reviews_v3(p_provider_id uuid, p_business_id uuid) to public;
grant execute on function public.list_reviews_v3(p_provider_id uuid, p_business_id uuid) to anon;
grant execute on function public.list_reviews_v3(p_provider_id uuid, p_business_id uuid) to authenticated;
revoke all on function public.listing_agent_published() from public, anon, authenticated, service_role;
revoke all on function public.listing_claim_deadline(p_listing_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.listing_claim_deadline(p_listing_id uuid) to authenticated;
revoke all on function public.listing_claims_tick() from public, anon, authenticated, service_role;
revoke all on function public.listing_commission_add(l classified_listings, p_amount numeric, p_source text, p_rental uuid) from public, anon, authenticated, service_role;
revoke all on function public.listing_commission_on_sale() from public, anon, authenticated, service_role;
revoke all on function public.listing_deal_candidates(p_listing_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.listing_deal_candidates(p_listing_id uuid) to authenticated;
revoke all on function public.listing_offers_for(p_listing_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.listing_offers_for(p_listing_id uuid) to authenticated;
revoke all on function public.listing_territory_active(p_listing classified_listings) from public, anon, authenticated, service_role;
grant execute on function public.listing_territory_active(p_listing classified_listings) to public;
revoke all on function public.make_offer(p_listing_id uuid, p_amount numeric, p_trade_item text, p_message text) from public, anon, authenticated, service_role;
grant execute on function public.make_offer(p_listing_id uuid, p_amount numeric, p_trade_item text, p_message text) to authenticated;
revoke all on function public.mark_videos_removed(p_paths text[]) from public, anon, authenticated, service_role;
grant execute on function public.mark_videos_removed(p_paths text[]) to service_role;
revoke all on function public.market_directory(p_query text, p_municipality_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.market_directory(p_query text, p_municipality_id uuid) to anon;
grant execute on function public.market_directory(p_query text, p_municipality_id uuid) to authenticated;
revoke all on function public.messages_block_guard() from public, anon, authenticated, service_role;
revoke all on function public.mfa_ok() from public, anon, authenticated, service_role;
grant execute on function public.mfa_ok() to authenticated;
revoke all on function public.my_admin_role() from public, anon, authenticated, service_role;
grant execute on function public.my_admin_role() to authenticated;
revoke all on function public.my_auction_bids() from public, anon, authenticated, service_role;
grant execute on function public.my_auction_bids() to authenticated;
revoke all on function public.my_blocks() from public, anon, authenticated, service_role;
grant execute on function public.my_blocks() to authenticated;
revoke all on function public.my_commissions() from public, anon, authenticated, service_role;
grant execute on function public.my_commissions() to authenticated;
revoke all on function public.my_conversation_partners() from public, anon, authenticated, service_role;
grant execute on function public.my_conversation_partners() to authenticated;
revoke all on function public.my_deliveries(p_role text) from public, anon, authenticated, service_role;
grant execute on function public.my_deliveries(p_role text) to authenticated;
revoke all on function public.my_disputes() from public, anon, authenticated, service_role;
grant execute on function public.my_disputes() to authenticated;
revoke all on function public.my_disputes_v2() from public, anon, authenticated, service_role;
grant execute on function public.my_disputes_v2() to authenticated;
revoke all on function public.my_event_tickets() from public, anon, authenticated, service_role;
grant execute on function public.my_event_tickets() to authenticated;
revoke all on function public.my_field_agent() from public, anon, authenticated, service_role;
grant execute on function public.my_field_agent() to authenticated;
revoke all on function public.my_follower_count() from public, anon, authenticated, service_role;
grant execute on function public.my_follower_count() to authenticated;
revoke all on function public.my_follows() from public, anon, authenticated, service_role;
grant execute on function public.my_follows() to authenticated;
revoke all on function public.my_fuel_orders() from public, anon, authenticated, service_role;
grant execute on function public.my_fuel_orders() to authenticated;
revoke all on function public.my_inspections() from public, anon, authenticated, service_role;
grant execute on function public.my_inspections() to authenticated;
revoke all on function public.my_item_stats(p_days integer) from public, anon, authenticated, service_role;
grant execute on function public.my_item_stats(p_days integer) to authenticated;
revoke all on function public.my_listing_boosts() from public, anon, authenticated, service_role;
grant execute on function public.my_listing_boosts() to authenticated;
revoke all on function public.my_listing_claims() from public, anon, authenticated, service_role;
grant execute on function public.my_listing_claims() to authenticated;
revoke all on function public.my_listing_offer_counts() from public, anon, authenticated, service_role;
grant execute on function public.my_listing_offer_counts() to authenticated;
revoke all on function public.my_offers() from public, anon, authenticated, service_role;
grant execute on function public.my_offers() to authenticated;
revoke all on function public.my_orders(p_role text) from public, anon, authenticated, service_role;
grant execute on function public.my_orders(p_role text) to authenticated;
revoke all on function public.my_orders_v2(p_role text) from public, anon, authenticated, service_role;
grant execute on function public.my_orders_v2(p_role text) to authenticated;
revoke all on function public.my_orders_v3(p_role text) from public, anon, authenticated, service_role;
grant execute on function public.my_orders_v3(p_role text) to authenticated;
revoke all on function public.my_orders_v4(p_role text) from public, anon, authenticated, service_role;
grant execute on function public.my_orders_v4(p_role text) to authenticated;
revoke all on function public.my_pending_reviews() from public, anon, authenticated, service_role;
grant execute on function public.my_pending_reviews() to authenticated;
revoke all on function public.my_promo_posts() from public, anon, authenticated, service_role;
grant execute on function public.my_promo_posts() to authenticated;
revoke all on function public.my_promo_subjects() from public, anon, authenticated, service_role;
grant execute on function public.my_promo_subjects() to authenticated;
revoke all on function public.my_referral_code() from public, anon, authenticated, service_role;
grant execute on function public.my_referral_code() to authenticated;
revoke all on function public.my_referrals() from public, anon, authenticated, service_role;
grant execute on function public.my_referrals() to authenticated;
revoke all on function public.my_rental_requests(p_role text) from public, anon, authenticated, service_role;
grant execute on function public.my_rental_requests(p_role text) to authenticated;
revoke all on function public.my_saved_items() from public, anon, authenticated, service_role;
grant execute on function public.my_saved_items() to authenticated;
revoke all on function public.my_service_requests(p_as text) from public, anon, authenticated, service_role;
grant execute on function public.my_service_requests(p_as text) to authenticated;
revoke all on function public.my_service_requests_v2(p_as text) from public, anon, authenticated, service_role;
grant execute on function public.my_service_requests_v2(p_as text) to authenticated;
revoke all on function public.my_stats_daily(p_days integer) from public, anon, authenticated, service_role;
grant execute on function public.my_stats_daily(p_days integer) to authenticated;
revoke all on function public.my_subscriptions() from public, anon, authenticated, service_role;
grant execute on function public.my_subscriptions() to authenticated;
revoke all on function public.my_venue_orders() from public, anon, authenticated, service_role;
grant execute on function public.my_venue_orders() to authenticated;
revoke all on function public.my_venues() from public, anon, authenticated, service_role;
grant execute on function public.my_venues() to authenticated;
revoke all on function public.my_verifications() from public, anon, authenticated, service_role;
grant execute on function public.my_verifications() to authenticated;
revoke all on function public.my_verifications_v2() from public, anon, authenticated, service_role;
grant execute on function public.my_verifications_v2() to authenticated;
revoke all on function public.my_wallet() from public, anon, authenticated, service_role;
grant execute on function public.my_wallet() to authenticated;
revoke all on function public.new_fuel_code() from public, anon, authenticated, service_role;
revoke all on function public.new_ticket_code() from public, anon, authenticated, service_role;
revoke all on function public.new_venue_code() from public, anon, authenticated, service_role;
revoke all on function public.normalize_bi(p text) from public, anon, authenticated, service_role;
grant execute on function public.normalize_bi(p text) to public;
revoke all on function public.normalize_whatsapp(p text) from public, anon, authenticated, service_role;
revoke all on function public.notify_classified_saved_searches() from public, anon, authenticated, service_role;
revoke all on function public.notify_followers(p_followers uuid[], p_source text, p_title text, p_body text, p_data jsonb) from public, anon, authenticated, service_role;
revoke all on function public.notify_new_message() from public, anon, authenticated, service_role;
revoke all on function public.notify_staff(p_title text, p_body text, p_data jsonb) from public, anon, authenticated, service_role;
revoke all on function public.notify_wanted_matches() from public, anon, authenticated, service_role;
revoke all on function public.open_listing_claim(p_listing_id uuid, p_request text, p_reason text, p_description text, p_amount numeric) from public, anon, authenticated, service_role;
grant execute on function public.open_listing_claim(p_listing_id uuid, p_request text, p_reason text, p_description text, p_amount numeric) to authenticated;
revoke all on function public.open_order_dispute(p_order_id uuid, p_request text, p_reason text, p_description text, p_amount numeric, p_photos text[]) from public, anon, authenticated, service_role;
grant execute on function public.open_order_dispute(p_order_id uuid, p_request text, p_reason text, p_description text, p_amount numeric, p_photos text[]) to authenticated;
revoke all on function public.order_delivery_point(p_order_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.order_delivery_point(p_order_id uuid) to authenticated;
revoke all on function public.order_payment_quote(p_order_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.order_payment_quote(p_order_id uuid) to authenticated;
revoke all on function public.order_ref(o orders) from public, anon, authenticated, service_role;
revoke all on function public.orders_escrow_guard() from public, anon, authenticated, service_role;
revoke all on function public.organizer_event_panel(p_event_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.organizer_event_panel(p_event_id uuid) to authenticated;
revoke all on function public.photo_search_limit() from public, anon, authenticated, service_role;
grant execute on function public.photo_search_limit() to public;
revoke all on function public.photo_searches_left() from public, anon, authenticated, service_role;
grant execute on function public.photo_searches_left() to authenticated;
revoke all on function public.place_auction_bid(p_auction_id uuid, p_amount numeric) from public, anon, authenticated, service_role;
grant execute on function public.place_auction_bid(p_auction_id uuid, p_amount numeric) to authenticated;
revoke all on function public.place_orders(p_fulfillment text, p_payment_method text, p_contact_phone text, p_delivery_text text, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.place_orders(p_fulfillment text, p_payment_method text, p_contact_phone text, p_delivery_text text, p_note text) to authenticated;
revoke all on function public.place_orders_v2(p_fulfillment text, p_payment_method text, p_contact_phone text, p_delivery_text text, p_note text, p_protected boolean) from public, anon, authenticated, service_role;
grant execute on function public.place_orders_v2(p_fulfillment text, p_payment_method text, p_contact_phone text, p_delivery_text text, p_note text, p_protected boolean) to authenticated;
revoke all on function public.place_orders_v3(p_choices jsonb, p_payment_method text, p_contact_phone text, p_municipality_id uuid, p_delivery_text text, p_note text, p_protected boolean) from public, anon, authenticated, service_role;
grant execute on function public.place_orders_v3(p_choices jsonb, p_payment_method text, p_contact_phone text, p_municipality_id uuid, p_delivery_text text, p_note text, p_protected boolean) to authenticated;
revoke all on function public.plan_monthly_price(p_kind text) from public, anon, authenticated, service_role;
grant execute on function public.plan_monthly_price(p_kind text) to authenticated;
revoke all on function public.plan_subject_exists(s subscriptions) from public, anon, authenticated, service_role;
revoke all on function public.plan_subject_name(s subscriptions) from public, anon, authenticated, service_role;
revoke all on function public.portfolio_guard() from public, anon, authenticated, service_role;
revoke all on function public.portfolio_photos_ok(p_photos text[], p_owner uuid) from public, anon, authenticated, service_role;
grant execute on function public.portfolio_photos_ok(p_photos text[], p_owner uuid) to public;
grant execute on function public.portfolio_photos_ok(p_photos text[], p_owner uuid) to anon;
grant execute on function public.portfolio_photos_ok(p_photos text[], p_owner uuid) to authenticated;
revoke all on function public.portfolio_target_owned(p_provider uuid, p_business uuid) from public, anon, authenticated, service_role;
grant execute on function public.portfolio_target_owned(p_provider uuid, p_business uuid) to authenticated;
revoke all on function public.portfolio_target_public(p_provider uuid, p_business uuid) from public, anon, authenticated, service_role;
grant execute on function public.portfolio_target_public(p_provider uuid, p_business uuid) to public;
grant execute on function public.portfolio_target_public(p_provider uuid, p_business uuid) to anon;
grant execute on function public.portfolio_target_public(p_provider uuid, p_business uuid) to authenticated;
revoke all on function public.process_job_queue(p_limit integer) from public, anon, authenticated, service_role;
revoke all on function public.product_catalog(p_query text, p_category_id uuid, p_municipality_id uuid, p_seller_id uuid, p_limit integer) from public, anon, authenticated, service_role;
grant execute on function public.product_catalog(p_query text, p_category_id uuid, p_municipality_id uuid, p_seller_id uuid, p_limit integer) to public;
grant execute on function public.product_catalog(p_query text, p_category_id uuid, p_municipality_id uuid, p_seller_id uuid, p_limit integer) to anon;
grant execute on function public.product_catalog(p_query text, p_category_id uuid, p_municipality_id uuid, p_seller_id uuid, p_limit integer) to authenticated;
revoke all on function public.product_paid_up(p_seller uuid, p_business uuid) from public, anon, authenticated, service_role;
grant execute on function public.product_paid_up(p_seller uuid, p_business uuid) to public;
grant execute on function public.product_paid_up(p_seller uuid, p_business uuid) to anon;
grant execute on function public.product_paid_up(p_seller uuid, p_business uuid) to authenticated;
revoke all on function public.promo_feed(p_kind text, p_subject_kind text, p_subject_id uuid, p_limit integer) from public, anon, authenticated, service_role;
grant execute on function public.promo_feed(p_kind text, p_subject_kind text, p_subject_id uuid, p_limit integer) to public;
grant execute on function public.promo_feed(p_kind text, p_subject_kind text, p_subject_id uuid, p_limit integer) to anon;
grant execute on function public.promo_feed(p_kind text, p_subject_kind text, p_subject_id uuid, p_limit integer) to authenticated;
revoke all on function public.promo_notify_followers(p promo_posts, p_source text, p_title text, p_body text) from public, anon, authenticated, service_role;
revoke all on function public.promo_subject(p_kind text, p_id uuid, OUT owner uuid, OUT name text, OUT picture text, OUT visible boolean) from public, anon, authenticated, service_role;
revoke all on function public.promo_tick() from public, anon, authenticated, service_role;
revoke all on function public.provider_confirm_payment(p_reference text, p_amount numeric, p_provider_payment_id text) from public, anon, authenticated, service_role;
grant execute on function public.provider_confirm_payment(p_reference text, p_amount numeric, p_provider_payment_id text) to service_role;
revoke all on function public.provider_directory(p_query text, p_category_id uuid, p_municipality_id uuid, p_limit integer) from public, anon, authenticated, service_role;
grant execute on function public.provider_directory(p_query text, p_category_id uuid, p_municipality_id uuid, p_limit integer) to public;
grant execute on function public.provider_directory(p_query text, p_category_id uuid, p_municipality_id uuid, p_limit integer) to anon;
grant execute on function public.provider_directory(p_query text, p_category_id uuid, p_municipality_id uuid, p_limit integer) to authenticated;
revoke all on function public.provider_register_reference(p_order_id uuid, p_entity text, p_reference text, p_amount numeric, p_expires_at timestamp with time zone) from public, anon, authenticated, service_role;
grant execute on function public.provider_register_reference(p_order_id uuid, p_entity text, p_reference text, p_amount numeric, p_expires_at timestamp with time zone) to service_role;
revoke all on function public.public_seller(p_user_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.public_seller(p_user_id uuid) to public;
grant execute on function public.public_seller(p_user_id uuid) to anon;
grant execute on function public.public_seller(p_user_id uuid) to authenticated;
revoke all on function public.public_trust_signals(p_user_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.public_trust_signals(p_user_id uuid) to public;
grant execute on function public.public_trust_signals(p_user_id uuid) to anon;
grant execute on function public.public_trust_signals(p_user_id uuid) to authenticated;
revoke all on function public.public_user_stats(p_user_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.public_user_stats(p_user_id uuid) to public;
grant execute on function public.public_user_stats(p_user_id uuid) to anon;
grant execute on function public.public_user_stats(p_user_id uuid) to authenticated;
revoke all on function public.publish_classified_listing(p_listing_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.publish_classified_listing(p_listing_id uuid) to authenticated;
revoke all on function public.queue_video_cleanup() from public, anon, authenticated, service_role;
revoke all on function public.record_item_event(p_kind text, p_id uuid, p_event text) from public, anon, authenticated, service_role;
grant execute on function public.record_item_event(p_kind text, p_id uuid, p_event text) to anon;
grant execute on function public.record_item_event(p_kind text, p_id uuid, p_event text) to authenticated;
revoke all on function public.record_promo_view(p_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.record_promo_view(p_id uuid) to public;
grant execute on function public.record_promo_view(p_id uuid) to anon;
grant execute on function public.record_promo_view(p_id uuid) to authenticated;
revoke all on function public.referral_apply_reward(p_referred uuid) from public, anon, authenticated, service_role;
revoke all on function public.referral_on_payment() from public, anon, authenticated, service_role;
revoke all on function public.referral_on_subscription() from public, anon, authenticated, service_role;
revoke all on function public.register_courier(p_name text, p_phone text, p_vehicle text, p_municipality_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.register_courier(p_name text, p_phone text, p_vehicle text, p_municipality_id uuid) to authenticated;
revoke all on function public.rental_commission_on_request() from public, anon, authenticated, service_role;
revoke all on function public.reply_to_review(p_kind text, p_review_id uuid, p_reply text) from public, anon, authenticated, service_role;
grant execute on function public.reply_to_review(p_kind text, p_review_id uuid, p_reply text) to authenticated;
revoke all on function public.report_classified_listing(p_listing_id uuid, p_reason text, p_details text) from public, anon, authenticated, service_role;
grant execute on function public.report_classified_listing(p_listing_id uuid, p_reason text, p_details text) to authenticated;
revoke all on function public.report_content(p_target_type text, p_target_id uuid, p_reason text, p_details text) from public, anon, authenticated, service_role;
grant execute on function public.report_content(p_target_type text, p_target_id uuid, p_reason text, p_details text) to authenticated;
revoke all on function public.report_fuel(p_product_id uuid, p_has boolean) from public, anon, authenticated, service_role;
grant execute on function public.report_fuel(p_product_id uuid, p_has boolean) to authenticated;
revoke all on function public.reputation_summary(p_business_id uuid, p_provider_id uuid, p_product_id uuid, p_service_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.reputation_summary(p_business_id uuid, p_provider_id uuid, p_product_id uuid, p_service_id uuid) to anon;
grant execute on function public.reputation_summary(p_business_id uuid, p_provider_id uuid, p_product_id uuid, p_service_id uuid) to authenticated;
revoke all on function public.request_classified_rental(p_listing_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_price numeric, p_message text) from public, anon, authenticated, service_role;
grant execute on function public.request_classified_rental(p_listing_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_price numeric, p_message text) to authenticated;
revoke all on function public.request_identity_verification(p_front_path text, p_back_path text, p_selfie_path text, p_id_number text, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.request_identity_verification(p_front_path text, p_back_path text, p_selfie_path text, p_id_number text, p_note text) to authenticated;
revoke all on function public.request_inspection(p_kind text, p_target uuid, p_address text, p_phone text, p_preferred_time text, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.request_inspection(p_kind text, p_target uuid, p_address text, p_phone text, p_preferred_time text, p_note text) to authenticated;
revoke all on function public.request_listing_boost(p_listing_id uuid, p_method text, p_reference text, p_proof_path text) from public, anon, authenticated, service_role;
grant execute on function public.request_listing_boost(p_listing_id uuid, p_method text, p_reference text, p_proof_path text) to authenticated;
revoke all on function public.request_order_delivery(p_order_id uuid, p_notes text) from public, anon, authenticated, service_role;
grant execute on function public.request_order_delivery(p_order_id uuid, p_notes text) to authenticated;
revoke all on function public.request_payout(p_amount numeric) from public, anon, authenticated, service_role;
grant execute on function public.request_payout(p_amount numeric) to authenticated;
revoke all on function public.request_service(p_provider_id uuid, p_business_id uuid, p_description text) from public, anon, authenticated, service_role;
grant execute on function public.request_service(p_provider_id uuid, p_business_id uuid, p_description text) to authenticated;
revoke all on function public.request_service_v2(p_provider_id uuid, p_business_id uuid, p_description text, p_preferred_date date) from public, anon, authenticated, service_role;
grant execute on function public.request_service_v2(p_provider_id uuid, p_business_id uuid, p_description text, p_preferred_date date) to authenticated;
revoke all on function public.request_verification(p_kind text, p_business_id uuid, p_document_path text, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.request_verification(p_kind text, p_business_id uuid, p_document_path text, p_note text) to authenticated;
revoke all on function public.require_capability(target_user uuid, target_capability text) from public, anon, authenticated, service_role;
grant execute on function public.require_capability(target_user uuid, target_capability text) to authenticated;
revoke all on function public.require_listing_conformity() from public, anon, authenticated, service_role;
revoke all on function public.require_product_conformity() from public, anon, authenticated, service_role;
revoke all on function public.reserve_event_tickets(p_ticket_type_id uuid, p_quantity integer, p_name text, p_phone text) from public, anon, authenticated, service_role;
grant execute on function public.reserve_event_tickets(p_ticket_type_id uuid, p_quantity integer, p_name text, p_phone text) to authenticated;
revoke all on function public.reserve_fuel(p_product_id uuid, p_quantity numeric, p_method text, p_name text, p_phone text, p_plate text) from public, anon, authenticated, service_role;
grant execute on function public.reserve_fuel(p_product_id uuid, p_quantity numeric, p_method text, p_name text, p_phone text, p_plate text) to authenticated;
revoke all on function public.reserve_venue(p_venue_id uuid, p_kind text, p_lines jsonb, p_method text, p_name text, p_phone text, p_check_in date, p_check_out date, p_guests integer, p_slot_at timestamp with time zone, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.reserve_venue(p_venue_id uuid, p_kind text, p_lines jsonb, p_method text, p_name text, p_phone text, p_check_in date, p_check_out date, p_guests integer, p_slot_at timestamp with time zone, p_note text) to authenticated;
revoke all on function public.respond_listing_claim(p_claim_id uuid, p_accept boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.respond_listing_claim(p_claim_id uuid, p_accept boolean, p_note text) to authenticated;
revoke all on function public.respond_offer(p_offer_id uuid, p_accept boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.respond_offer(p_offer_id uuid, p_accept boolean, p_note text) to authenticated;
revoke all on function public.respond_rental_request(p_request_id uuid, p_accept boolean) from public, anon, authenticated, service_role;
grant execute on function public.respond_rental_request(p_request_id uuid, p_accept boolean) to authenticated;
revoke all on function public.retract_auction_bid(p_auction_id uuid, p_reason text) from public, anon, authenticated, service_role;
grant execute on function public.retract_auction_bid(p_auction_id uuid, p_reason text) to authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role;
revoke all on function public.round_listing_geo() from public, anon, authenticated, service_role;
revoke all on function public.save_payout_account(p_method text, p_holder text, p_destination text) from public, anon, authenticated, service_role;
grant execute on function public.save_payout_account(p_method text, p_holder text, p_destination text) to authenticated;
revoke all on function public.save_promo_post(p_id uuid, p_subject_kind text, p_subject_id uuid, p_kind text, p_title text, p_description text, p_video_url text, p_external_url text, p_cover_url text, p_live_starts_at timestamp with time zone, p_live_minutes integer) from public, anon, authenticated, service_role;
grant execute on function public.save_promo_post(p_id uuid, p_subject_kind text, p_subject_id uuid, p_kind text, p_title text, p_description text, p_video_url text, p_external_url text, p_cover_url text, p_live_starts_at timestamp with time zone, p_live_minutes integer) to authenticated;
revoke all on function public.saved_search_territory_active(p_territory_id uuid, p_kind text) from public, anon, authenticated, service_role;
revoke all on function public.search_classified_by_location(p_province_id uuid, p_municipality_id uuid, p_neighborhood_id uuid, p_listing_type text, p_purpose text, p_limit integer) from public, anon, authenticated, service_role;
grant execute on function public.search_classified_by_location(p_province_id uuid, p_municipality_id uuid, p_neighborhood_id uuid, p_listing_type text, p_purpose text, p_limit integer) to anon;
grant execute on function public.search_classified_by_location(p_province_id uuid, p_municipality_id uuid, p_neighborhood_id uuid, p_listing_type text, p_purpose text, p_limit integer) to authenticated;
revoke all on function public.search_classified_listings(p_listing_type text, p_purpose text, p_category_id uuid, p_min_price numeric, p_max_price numeric, p_query text, p_attributes jsonb, p_limit integer) from public, anon, authenticated, service_role;
grant execute on function public.search_classified_listings(p_listing_type text, p_purpose text, p_category_id uuid, p_min_price numeric, p_max_price numeric, p_query text, p_attributes jsonb, p_limit integer) to anon;
grant execute on function public.search_classified_listings(p_listing_type text, p_purpose text, p_category_id uuid, p_min_price numeric, p_max_price numeric, p_query text, p_attributes jsonb, p_limit integer) to authenticated;
revoke all on function public.search_classified_listings_v2(p_listing_type text, p_purpose text, p_category_id uuid, p_min_price numeric, p_max_price numeric, p_query text, p_attributes jsonb, p_limit integer, p_sale_mode text) from public, anon, authenticated, service_role;
grant execute on function public.search_classified_listings_v2(p_listing_type text, p_purpose text, p_category_id uuid, p_min_price numeric, p_max_price numeric, p_query text, p_attributes jsonb, p_limit integer, p_sale_mode text) to public;
grant execute on function public.search_classified_listings_v2(p_listing_type text, p_purpose text, p_category_id uuid, p_min_price numeric, p_max_price numeric, p_query text, p_attributes jsonb, p_limit integer, p_sale_mode text) to anon;
grant execute on function public.search_classified_listings_v2(p_listing_type text, p_purpose text, p_category_id uuid, p_min_price numeric, p_max_price numeric, p_query text, p_attributes jsonb, p_limit integer, p_sale_mode text) to authenticated;
revoke all on function public.search_huambo_online(p_query text, p_limit integer) from public, anon, authenticated, service_role;
grant execute on function public.search_huambo_online(p_query text, p_limit integer) to anon;
grant execute on function public.search_huambo_online(p_query text, p_limit integer) to authenticated;
revoke all on function public.search_huambo_online(p_query text, p_limit integer, p_entity_type text, p_category_id uuid, p_min_price numeric, p_max_price numeric) from public, anon, authenticated, service_role;
grant execute on function public.search_huambo_online(p_query text, p_limit integer, p_entity_type text, p_category_id uuid, p_min_price numeric, p_max_price numeric) to public;
revoke all on function public.search_trades(p_query text, p_only_trade boolean, p_limit integer) from public, anon, authenticated, service_role;
grant execute on function public.search_trades(p_query text, p_only_trade boolean, p_limit integer) to public;
grant execute on function public.search_trades(p_query text, p_only_trade boolean, p_limit integer) to anon;
grant execute on function public.search_trades(p_query text, p_only_trade boolean, p_limit integer) to authenticated;
revoke all on function public.seller_cancel_bid(p_bid_id uuid, p_reason text) from public, anon, authenticated, service_role;
grant execute on function public.seller_cancel_bid(p_bid_id uuid, p_reason text) to authenticated;
revoke all on function public.seller_delivery_policy(p_seller_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.seller_delivery_policy(p_seller_id uuid) to anon;
grant execute on function public.seller_delivery_policy(p_seller_id uuid) to authenticated;
revoke all on function public.seller_delivery_quote(p_seller_id uuid, p_municipality_id uuid, p_subtotal numeric) from public, anon, authenticated, service_role;
grant execute on function public.seller_delivery_quote(p_seller_id uuid, p_municipality_id uuid, p_subtotal numeric) to anon;
grant execute on function public.seller_delivery_quote(p_seller_id uuid, p_municipality_id uuid, p_subtotal numeric) to authenticated;
revoke all on function public.seller_whatsapp(p_user_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.seller_whatsapp(p_user_id uuid) to authenticated;
revoke all on function public.service_request_owner(r service_requests) from public, anon, authenticated, service_role;
revoke all on function public.service_request_paid_up() from public, anon, authenticated, service_role;
revoke all on function public.set_auction_buy_now(p_auction_id uuid, p_price numeric) from public, anon, authenticated, service_role;
grant execute on function public.set_auction_buy_now(p_auction_id uuid, p_price numeric) to authenticated;
revoke all on function public.set_courier_available(p_available boolean) from public, anon, authenticated, service_role;
grant execute on function public.set_courier_available(p_available boolean) to authenticated;
revoke all on function public.set_dispute_refund_account(p_dispute_id uuid, p_account text) from public, anon, authenticated, service_role;
grant execute on function public.set_dispute_refund_account(p_dispute_id uuid, p_account text) to authenticated;
revoke all on function public.set_listing_agent(p_listing_id uuid, p_code text) from public, anon, authenticated, service_role;
grant execute on function public.set_listing_agent(p_listing_id uuid, p_code text) to authenticated;
revoke all on function public.set_listing_deal(p_listing_id uuid, p_status text, p_counterpart uuid) from public, anon, authenticated, service_role;
grant execute on function public.set_listing_deal(p_listing_id uuid, p_status text, p_counterpart uuid) to authenticated;
revoke all on function public.set_listing_deal_v2(p_listing_id uuid, p_status text, p_counterpart uuid, p_sale_amount numeric) from public, anon, authenticated, service_role;
grant execute on function public.set_listing_deal_v2(p_listing_id uuid, p_status text, p_counterpart uuid, p_sale_amount numeric) to authenticated;
revoke all on function public.set_my_whatsapp(p_number text, p_public boolean) from public, anon, authenticated, service_role;
grant execute on function public.set_my_whatsapp(p_number text, p_public boolean) to authenticated;
revoke all on function public.set_order_delivery_point(p_order_id uuid, p_lat numeric, p_lng numeric) from public, anon, authenticated, service_role;
grant execute on function public.set_order_delivery_point(p_order_id uuid, p_lat numeric, p_lng numeric) to authenticated;
revoke all on function public.start_classified_conversation(p_listing_id uuid, p_message text) from public, anon, authenticated, service_role;
grant execute on function public.start_classified_conversation(p_listing_id uuid, p_message text) to authenticated;
revoke all on function public.start_directory_conversation(p_provider_id uuid, p_business_id uuid, p_message text) from public, anon, authenticated, service_role;
grant execute on function public.start_directory_conversation(p_provider_id uuid, p_business_id uuid, p_message text) to authenticated;
revoke all on function public.store_paid_up(p_seller uuid) from public, anon, authenticated, service_role;
grant execute on function public.store_paid_up(p_seller uuid) to authenticated;
revoke all on function public.store_subscription_start() from public, anon, authenticated, service_role;
revoke all on function public.subject_paid_up(p_provider uuid, p_business uuid) from public, anon, authenticated, service_role;
grant execute on function public.subject_paid_up(p_provider uuid, p_business uuid) to public;
grant execute on function public.subject_paid_up(p_provider uuid, p_business uuid) to anon;
grant execute on function public.subject_paid_up(p_provider uuid, p_business uuid) to authenticated;
revoke all on function public.submit_commission_payment(p_ids uuid[], p_method text, p_reference text, p_proof_path text) from public, anon, authenticated, service_role;
grant execute on function public.submit_commission_payment(p_ids uuid[], p_method text, p_reference text, p_proof_path text) to authenticated;
revoke all on function public.submit_deal_review(p_kind text, p_ref uuid, p_rating integer, p_comment text) from public, anon, authenticated, service_role;
grant execute on function public.submit_deal_review(p_kind text, p_ref uuid, p_rating integer, p_comment text) to authenticated;
revoke all on function public.submit_event_platform_payment(p_event_id uuid, p_kind text, p_method text, p_reference text, p_proof_path text) from public, anon, authenticated, service_role;
grant execute on function public.submit_event_platform_payment(p_event_id uuid, p_kind text, p_method text, p_reference text, p_proof_path text) to authenticated;
revoke all on function public.submit_event_ticket_payment(p_order_id uuid, p_method text, p_reference text) from public, anon, authenticated, service_role;
grant execute on function public.submit_event_ticket_payment(p_order_id uuid, p_method text, p_reference text) to authenticated;
revoke all on function public.submit_fuel_fee_payment(p_station_id uuid, p_method text, p_reference text, p_proof_path text) from public, anon, authenticated, service_role;
grant execute on function public.submit_fuel_fee_payment(p_station_id uuid, p_method text, p_reference text, p_proof_path text) to authenticated;
revoke all on function public.submit_fuel_payment(p_order_id uuid, p_method text, p_reference text) from public, anon, authenticated, service_role;
revoke all on function public.submit_fuel_payment_v2(p_order_id uuid, p_method text, p_reference text, p_proof_path text, p_proof_hash text) from public, anon, authenticated, service_role;
grant execute on function public.submit_fuel_payment_v2(p_order_id uuid, p_method text, p_reference text, p_proof_path text, p_proof_hash text) to authenticated;
revoke all on function public.submit_inspection_payment(p_id uuid, p_method text, p_reference text, p_proof_path text) from public, anon, authenticated, service_role;
grant execute on function public.submit_inspection_payment(p_id uuid, p_method text, p_reference text, p_proof_path text) to authenticated;
revoke all on function public.submit_order_payment(p_order_id uuid, p_method text, p_reference text, p_proof_path text) from public, anon, authenticated, service_role;
grant execute on function public.submit_order_payment(p_order_id uuid, p_method text, p_reference text, p_proof_path text) to authenticated;
revoke all on function public.submit_promo_boost(p_post_id uuid, p_method text, p_reference text, p_proof_path text) from public, anon, authenticated, service_role;
grant execute on function public.submit_promo_boost(p_post_id uuid, p_method text, p_reference text, p_proof_path text) to authenticated;
revoke all on function public.submit_review(p_provider_id uuid, p_business_id uuid, p_rating integer, p_comment text) from public, anon, authenticated, service_role;
grant execute on function public.submit_review(p_provider_id uuid, p_business_id uuid, p_rating integer, p_comment text) to authenticated;
revoke all on function public.submit_subscription_payment(p_subscription_id uuid, p_months integer, p_method text, p_reference text, p_proof_path text) from public, anon, authenticated, service_role;
grant execute on function public.submit_subscription_payment(p_subscription_id uuid, p_months integer, p_method text, p_reference text, p_proof_path text) to authenticated;
revoke all on function public.submit_venue_fee_payment(p_venue_id uuid, p_method text, p_reference text, p_proof_path text) from public, anon, authenticated, service_role;
grant execute on function public.submit_venue_fee_payment(p_venue_id uuid, p_method text, p_reference text, p_proof_path text) to authenticated;
revoke all on function public.submit_venue_payment(p_order_id uuid, p_method text, p_reference text, p_proof_path text, p_proof_hash text) from public, anon, authenticated, service_role;
grant execute on function public.submit_venue_payment(p_order_id uuid, p_method text, p_reference text, p_proof_path text, p_proof_hash text) to authenticated;
revoke all on function public.subscription_active_until(s subscriptions) from public, anon, authenticated, service_role;
grant execute on function public.subscription_active_until(s subscriptions) to public;
revoke all on function public.subscription_reminders() from public, anon, authenticated, service_role;
revoke all on function public.subscription_start() from public, anon, authenticated, service_role;
revoke all on function public.suggest_market(p_name text, p_municipality_id uuid, p_address text, p_description text) from public, anon, authenticated, service_role;
grant execute on function public.suggest_market(p_name text, p_municipality_id uuid, p_address text, p_description text) to authenticated;
revoke all on function public.sync_auction_sale_mode() from public, anon, authenticated, service_role;
revoke all on function public.ticket_by_code(p_code text) from public, anon, authenticated, service_role;
grant execute on function public.ticket_by_code(p_code text) to anon;
grant execute on function public.ticket_by_code(p_code text) to authenticated;
revoke all on function public.ticket_type_taken(p_type uuid) from public, anon, authenticated, service_role;
revoke all on function public.toggle_block(p_user_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.toggle_block(p_user_id uuid) to authenticated;
revoke all on function public.toggle_follow(p_kind text, p_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.toggle_follow(p_kind text, p_id uuid) to authenticated;
revoke all on function public.touch_conversation() from public, anon, authenticated, service_role;
revoke all on function public.update_delivery_status(p_delivery_id uuid, p_status text) from public, anon, authenticated, service_role;
grant execute on function public.update_delivery_status(p_delivery_id uuid, p_status text) to authenticated;
revoke all on function public.update_order_status(p_order_id uuid, p_status text, p_paid boolean) from public, anon, authenticated, service_role;
grant execute on function public.update_order_status(p_order_id uuid, p_status text, p_paid boolean) to authenticated;
revoke all on function public.update_service_request(p_id uuid, p_action text, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.update_service_request(p_id uuid, p_action text, p_note text) to authenticated;
revoke all on function public.upsert_notification_preferences(p_enabled boolean, p_saved_search boolean, p_messages boolean, p_rentals boolean, p_auctions boolean, p_marketplace boolean, p_reviews boolean, p_system boolean) from public, anon, authenticated, service_role;
grant execute on function public.upsert_notification_preferences(p_enabled boolean, p_saved_search boolean, p_messages boolean, p_rentals boolean, p_auctions boolean, p_marketplace boolean, p_reviews boolean, p_system boolean) to authenticated;
revoke all on function public.user_reviews_for(p_user_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.user_reviews_for(p_user_id uuid) to public;
grant execute on function public.user_reviews_for(p_user_id uuid) to anon;
grant execute on function public.user_reviews_for(p_user_id uuid) to authenticated;
revoke all on function public.user_reviews_for_v2(p_user_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.user_reviews_for_v2(p_user_id uuid) to public;
grant execute on function public.user_reviews_for_v2(p_user_id uuid) to anon;
grant execute on function public.user_reviews_for_v2(p_user_id uuid) to authenticated;
revoke all on function public.validate_classified_attributes(p_listing_type text, p_attributes jsonb) from public, anon, authenticated, service_role;
grant execute on function public.validate_classified_attributes(p_listing_type text, p_attributes jsonb) to public;
revoke all on function public.venue_created() from public, anon, authenticated, service_role;
revoke all on function public.venue_detail(p_venue_id uuid, p_from date, p_to date) from public, anon, authenticated, service_role;
grant execute on function public.venue_detail(p_venue_id uuid, p_from date, p_to date) to anon;
grant execute on function public.venue_detail(p_venue_id uuid, p_from date, p_to date) to authenticated;
revoke all on function public.venue_fee_due(p_venue uuid) from public, anon, authenticated, service_role;
revoke all on function public.venue_feed(p_kind text, p_municipality_id uuid, p_query text, p_limit integer) from public, anon, authenticated, service_role;
grant execute on function public.venue_feed(p_kind text, p_municipality_id uuid, p_query text, p_limit integer) to anon;
grant execute on function public.venue_feed(p_kind text, p_municipality_id uuid, p_query text, p_limit integer) to authenticated;
revoke all on function public.venue_fees_overdue(p_venue uuid) from public, anon, authenticated, service_role;
revoke all on function public.venue_item_reserved(p_item_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.venue_kind_label(k text) from public, anon, authenticated, service_role;
grant execute on function public.venue_kind_label(k text) to public;
revoke all on function public.venue_open_status(s text) from public, anon, authenticated, service_role;
grant execute on function public.venue_open_status(s text) to public;
revoke all on function public.venue_order_by_token(p_token text) from public, anon, authenticated, service_role;
grant execute on function public.venue_order_by_token(p_token text) to anon;
grant execute on function public.venue_order_by_token(p_token text) to authenticated;
revoke all on function public.venue_panel(p_venue_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.venue_panel(p_venue_id uuid) to authenticated;
revoke all on function public.venue_room_free(p_item_id uuid, p_from date, p_to date) from public, anon, authenticated, service_role;
revoke all on function public.venue_tick() from public, anon, authenticated, service_role;
revoke all on function public.video_path(p_url text) from public, anon, authenticated, service_role;
grant execute on function public.video_path(p_url text) to public;
revoke all on function public.videos_due_for_cleanup() from public, anon, authenticated, service_role;
grant execute on function public.videos_due_for_cleanup() to service_role;
revoke all on function public.wallet_add(p_user uuid, p_order uuid, p_payout uuid, p_bucket text, p_kind text, p_amount numeric, p_note text) from public, anon, authenticated, service_role;
revoke all on function public.wanted_keywords(p_title text) from public, anon, authenticated, service_role;
grant execute on function public.wanted_keywords(p_title text) to public;
revoke all on function public.withdraw_offer(p_offer_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.withdraw_offer(p_offer_id uuid) to authenticated;

-- Tempo real (mensagens e notificações)
alter publication supabase_realtime add table public.messages, public.notifications;

-- Liga a RLS automaticamente em cada tabela nova (se o projeto ainda não tiver este gatilho)
do $do$ begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') execute function public.rls_auto_enable();
  end if;
exception when insufficient_privilege then raise notice 'ensure_rls: sem permissão para criar o gatilho de eventos';
end $do$;

-- ============================================================================
-- Migration 0011 — Inventory reservation release movement
-- ============================================================================

alter type public.inventory_movement_type add value if not exists 'reservation_release';
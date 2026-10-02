-- ============================================================================
-- OPTIONAL SEED DATA FOR TESTING PURPOSES ONLY
-- Run this script ONLY if you wish to pre-populate sample routes, buses, and locations
-- ============================================================================

USE `college_transportation`;

-- Sample Fleet Buses
INSERT INTO `buses` (`bus_number`, `registration_number`, `capacity`, `status`, `speed`, `fuel_level`)
VALUES 
  ('BUS-01', 'AP 04 TC 4401', 52, 'active', '0 km/h', '90%'),
  ('BUS-02', 'AP 04 TC 4402', 50, 'active', '0 km/h', '85%'),
  ('BUS-03', 'AP 04 TC 4403', 54, 'active', '0 km/h', '75%'),
  ('BUS-05', 'AP 04 TC 4405', 52, 'active', '0 km/h', '80%');

-- Sample Routes
INSERT INTO `routes` (`route_number`, `route_name`, `start_point`, `end_point`, `distance_km`, `bus_id`, `timing`, `academic_year`, `semester`, `status`)
VALUES 
  ('Route 01', 'Madanapalle Town - Campus Express', 'Madanapalle RTC Bus Stand', 'Main College Campus', 18.70, 1, '07:45 AM - 08:35 AM', '2026-27', '1', 'active'),
  ('Route 02', 'Punganur Highway Corridor', 'Punganur Town Bus Stand', 'Main College Campus', 28.00, 2, '07:30 AM - 08:40 AM', '2026-27', '1', 'active'),
  ('Route 03', 'Rayachoti - Kurabalakota Line', 'Kurabalakota Center', 'Main College Campus', 24.00, 3, '07:35 AM - 08:35 AM', '2026-27', '1', 'active');

-- Sample Route Stops
INSERT INTO `route_stops` (`route_id`, `stop_order`, `stop_name`, `pickup_time`, `drop_time`, `latitude`, `longitude`, `distance_from_start_km`)
VALUES 
  (1, 1, 'Madanapalle RTC Bus Stand', '07:45 AM', '05:30 PM', 13.5510, 78.5020, 0.00),
  (1, 2, 'Nehru Circle', '07:55 AM', '05:20 PM', 13.5580, 78.5080, 2.50),
  (1, 3, 'Rama Rao Colony Bypass', '08:05 AM', '05:10 PM', 13.5700, 78.5200, 5.00),
  (1, 4, 'Angallu Junction', '08:22 AM', '04:55 PM', 13.5950, 78.5520, 14.50),
  (1, 5, 'Main College Campus', '08:35 AM', '04:40 PM', 13.6200, 78.5800, 18.70);

-- Sample Locations
INSERT INTO `locations` (`name`, `zone`, `distance_km`, `route_id`, `morning_pickup_time`, `evening_drop_time`, `latitude`, `longitude`, `status`)
VALUES 
  ('Madanapalle RTC Bus Stand', 'Zone 1', 18.70, 1, '07:45 AM', '05:30 PM', 13.5510, 78.5020, 'active'),
  ('Nehru Circle', 'Zone 1', 16.20, 1, '07:55 AM', '05:20 PM', 13.5580, 78.5080, 'active'),
  ('Rama Rao Colony Bypass', 'Zone 1', 13.70, 1, '08:05 AM', '05:10 PM', 13.5700, 78.5200, 'active'),
  ('Angallu Junction', 'Zone 1', 4.20, 1, '08:22 AM', '04:55 PM', 13.5950, 78.5520, 'active'),
  ('Punganur Town Bus Stand', 'Zone 2', 28.00, 2, '07:30 AM', '05:45 PM', 13.3660, 78.5800, 'active');

-- Sample Fee Structure for Route 01
INSERT INTO `fee_structures` (`route_id`, `bus_id`, `academic_year`, `semester`, `fee_calculation_type`, `fee_per_km`, `fixed_route_fee`, `calculated_distance_km`, `final_fee`, `status`)
VALUES 
  (1, 1, '2026-27', '1', 'FIXED_ROUTE', 0.00, 15000.00, 18.70, 15000.00, 'active'),
  (2, 2, '2026-27', '1', 'PER_KM', 50.00, 0.00, 28.00, 1400.00, 'active');

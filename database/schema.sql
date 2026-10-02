-- ============================================================================
-- College Transportation Management System - Normalized Relational Schema
-- Database: college_transportation
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `college_transportation`
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE `college_transportation`;

-- Drop tables in reverse dependency order if resetting
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `cancellation_requests`;
DROP TABLE IF EXISTS `live_locations`;
DROP TABLE IF EXISTS `trips`;
DROP TABLE IF EXISTS `bus_passes`;
DROP TABLE IF EXISTS `bus_pass_applications`;
DROP TABLE IF EXISTS `late_fees`;
DROP TABLE IF EXISTS `receipts`;
DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `student_fee_records`;
DROP TABLE IF EXISTS `fee_structures`;
DROP TABLE IF EXISTS `transportation_applications`;
DROP TABLE IF EXISTS `students`;
DROP TABLE IF EXISTS `locations`;
DROP TABLE IF EXISTS `route_stops`;
DROP TABLE IF EXISTS `routes`;
DROP TABLE IF EXISTS `drivers`;
DROP TABLE IF EXISTS `buses`;
DROP TABLE IF EXISTS `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 1. Table: users
-- Core authentication and identity table
-- ----------------------------------------------------------------------------
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'student', 'driver') NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(25) DEFAULT NULL,
  `avatar` VARCHAR(50) DEFAULT '👤',
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. Table: buses
-- Fleet vehicles
-- ----------------------------------------------------------------------------
CREATE TABLE `buses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `bus_number` VARCHAR(30) NOT NULL UNIQUE,
  `registration_number` VARCHAR(50) NOT NULL UNIQUE,
  `capacity` INT NOT NULL DEFAULT 50,
  `status` ENUM('active', 'maintenance', 'standby', 'retired') DEFAULT 'active',
  `speed` VARCHAR(20) DEFAULT '0 km/h',
  `fuel_level` VARCHAR(20) DEFAULT '80%',
  `last_maintenance` DATE DEFAULT NULL,
  `next_service` DATE DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_buses_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. Table: drivers
-- Driver personnel linked to user credentials and assigned buses
-- ----------------------------------------------------------------------------
CREATE TABLE `drivers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(25) NOT NULL,
  `license_number` VARCHAR(50) NOT NULL UNIQUE,
  `experience` VARCHAR(50) DEFAULT '5 Years',
  `assigned_bus_id` INT NULL,
  `status` ENUM('active', 'on_leave', 'inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`assigned_bus_id`) REFERENCES `buses`(`id`) ON DELETE SET NULL,
  INDEX `idx_drivers_license` (`license_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. Table: routes
-- Commuter transit routes
-- ----------------------------------------------------------------------------
CREATE TABLE `routes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `route_number` VARCHAR(50) NOT NULL UNIQUE,
  `route_name` VARCHAR(150) NOT NULL,
  `start_point` VARCHAR(150) NOT NULL,
  `end_point` VARCHAR(150) NOT NULL DEFAULT 'Main College Campus',
  `distance_km` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `bus_id` INT NULL,
  `driver_id` INT NULL,
  `timing` VARCHAR(100) DEFAULT '07:30 AM - 08:45 AM',
  `academic_year` VARCHAR(20) DEFAULT '2026-27',
  `semester` VARCHAR(20) DEFAULT '1',
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`bus_id`) REFERENCES `buses`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON DELETE SET NULL,
  INDEX `idx_routes_bus` (`bus_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. Table: route_stops
-- Sequential stops along each transit route
-- ----------------------------------------------------------------------------
CREATE TABLE `route_stops` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `route_id` INT NOT NULL,
  `stop_order` INT NOT NULL,
  `stop_name` VARCHAR(150) NOT NULL,
  `pickup_time` VARCHAR(30) DEFAULT '07:45 AM',
  `drop_time` VARCHAR(30) DEFAULT '05:30 PM',
  `latitude` DECIMAL(10,8) DEFAULT NULL,
  `longitude` DECIMAL(11,8) DEFAULT NULL,
  `distance_from_start_km` DECIMAL(6,2) DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uq_route_stop_order` (`route_id`, `stop_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. Table: locations
-- Standalone stops and fare zones directory
-- ----------------------------------------------------------------------------
CREATE TABLE `locations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL UNIQUE,
  `zone` VARCHAR(50) DEFAULT 'Zone 1',
  `distance_km` DECIMAL(6,2) NOT NULL DEFAULT 10.00,
  `route_id` INT NULL,
  `morning_pickup_time` VARCHAR(30) DEFAULT '07:45 AM',
  `evening_drop_time` VARCHAR(30) DEFAULT '05:30 PM',
  `latitude` DECIMAL(10,8) DEFAULT NULL,
  `longitude` DECIMAL(11,8) DEFAULT NULL,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. Table: students
-- Enrolled student commuters with UNIQUE 10-char alphanumeric Roll Number
-- ----------------------------------------------------------------------------
CREATE TABLE `students` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL UNIQUE,
  `roll_number` VARCHAR(10) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `course` VARCHAR(100) NOT NULL,
  `admission_number` VARCHAR(50) DEFAULT NULL,
  `parent_name` VARCHAR(100) DEFAULT NULL,
  `year_of_study` VARCHAR(20) DEFAULT '1st Year',
  `phone` VARCHAR(25) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `address` TEXT DEFAULT NULL,
  `pickup_location_id` INT NULL,
  `assigned_route_id` INT NULL,
  `assigned_bus_id` INT NULL,
  `transportation_status` ENUM('pending', 'approved', 'active', 'cancelled', 'rejected') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`pickup_location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`assigned_route_id`) REFERENCES `routes`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`assigned_bus_id`) REFERENCES `buses`(`id`) ON DELETE SET NULL,
  INDEX `idx_students_roll` (`roll_number`),
  INDEX `idx_students_trans_status` (`transportation_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. Table: fee_structures
-- Route fee configuration: PER_KM or FIXED_ROUTE
-- ----------------------------------------------------------------------------
CREATE TABLE `fee_structures` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `route_id` INT NOT NULL,
  `bus_id` INT NULL,
  `academic_year` VARCHAR(20) NOT NULL DEFAULT '2026-27',
  `semester` VARCHAR(20) NOT NULL DEFAULT '1',
  `fee_calculation_type` ENUM('PER_KM', 'FIXED_ROUTE') NOT NULL DEFAULT 'FIXED_ROUTE',
  `fee_per_km` DECIMAL(8,2) DEFAULT 0.00,
  `fixed_route_fee` DECIMAL(10,2) DEFAULT 0.00,
  `calculated_distance_km` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `final_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`bus_id`) REFERENCES `buses`(`id`) ON DELETE SET NULL,
  UNIQUE KEY `uq_fee_structure` (`route_id`, `academic_year`, `semester`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 9. Table: student_fee_records
-- Student transportation ledger
-- ----------------------------------------------------------------------------
CREATE TABLE `student_fee_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT NOT NULL,
  `fee_structure_id` INT NULL,
  `route_id` INT NULL,
  `academic_year` VARCHAR(20) NOT NULL DEFAULT '2026-27',
  `semester` VARCHAR(20) NOT NULL DEFAULT '1',
  `total_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `paid_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `pending_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `late_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `total_payable` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `payment_status` ENUM('UNPAID', 'PARTIALLY PAID', 'PAID', 'WAIVED') DEFAULT 'UNPAID',
  `due_date` DATE DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`fee_structure_id`) REFERENCES `fee_structures`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON DELETE SET NULL,
  UNIQUE KEY `uq_student_fee_record` (`student_id`, `academic_year`, `semester`),
  INDEX `idx_fee_status` (`payment_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 10. Table: payments
-- Payment transactions with unique transaction ID
-- ----------------------------------------------------------------------------
CREATE TABLE `payments` (
  `payment_id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT NOT NULL,
  `fee_record_id` INT NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `payment_method` ENUM('UPI / PhonePe Demo', 'Card Demo', 'Cash') NOT NULL,
  `transaction_id` VARCHAR(50) NOT NULL UNIQUE,
  `payment_status` ENUM('PENDING ADMIN VERIFICATION', 'SUCCESSFUL', 'REJECTED', 'FAILED') DEFAULT 'SUCCESSFUL',
  `payment_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `verified_by_admin_id` INT NULL,
  `verified_at` TIMESTAMP NULL DEFAULT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`fee_record_id`) REFERENCES `student_fee_records`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`verified_by_admin_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_payments_txn` (`transaction_id`),
  INDEX `idx_payments_status` (`payment_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 11. Table: receipts
-- Official receipts generated automatically (Format: F2526-16444, exactly 11 chars)
-- ----------------------------------------------------------------------------
CREATE TABLE `receipts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `payment_id` INT NOT NULL UNIQUE,
  `student_id` INT NOT NULL,
  `receipt_number` VARCHAR(11) NOT NULL UNIQUE,
  `fee_particulars` VARCHAR(200) NOT NULL DEFAULT 'Annual Transportation Fee',
  `amount` DECIMAL(10,2) NOT NULL,
  `amount_in_words` VARCHAR(255) NOT NULL,
  `payment_mode` VARCHAR(50) NOT NULL,
  `receipt_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`payment_id`) REFERENCES `payments`(`payment_id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE,
  INDEX `idx_receipt_number` (`receipt_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 12. Table: late_fees
-- Late fee penalties and fines
-- ----------------------------------------------------------------------------
CREATE TABLE `late_fees` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_fee_record_id` INT NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `applied_date` DATE NOT NULL,
  `status` ENUM('applied', 'waived', 'paid') DEFAULT 'applied',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`student_fee_record_id`) REFERENCES `student_fee_records`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 13. Table: transportation_applications
-- Initial student enrollment requests for campus transit
-- ----------------------------------------------------------------------------
CREATE TABLE `transportation_applications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT NOT NULL,
  `pickup_location_id` INT NOT NULL,
  `preferred_route_id` INT NULL,
  `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  `admin_notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`pickup_location_id`) REFERENCES `locations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`preferred_route_id`) REFERENCES `routes`(`id`) ON DELETE SET NULL,
  INDEX `idx_trans_app_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 14. Table: bus_pass_applications
-- Bus pass applications submitted after fee payment
-- ----------------------------------------------------------------------------
CREATE TABLE `bus_pass_applications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT NOT NULL,
  `roll_number` VARCHAR(10) NOT NULL,
  `route_id` INT NOT NULL,
  `bus_id` INT NOT NULL,
  `pickup_location_id` INT NOT NULL,
  `fee_payment_id` INT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
  `rejection_reason` TEXT DEFAULT NULL,
  `applied_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `reviewed_by_admin_id` INT NULL,
  `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`bus_id`) REFERENCES `buses`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`pickup_location_id`) REFERENCES `locations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`fee_payment_id`) REFERENCES `payments`(`payment_id`) ON DELETE SET NULL,
  FOREIGN KEY (`reviewed_by_admin_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_pass_app_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 15. Table: bus_passes
-- Issued digital transit bus passes
-- ----------------------------------------------------------------------------
CREATE TABLE `bus_passes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `application_id` INT NOT NULL UNIQUE,
  `pass_number` VARCHAR(50) NOT NULL UNIQUE,
  `student_id` INT NOT NULL,
  `bus_id` INT NOT NULL,
  `route_id` INT NOT NULL,
  `pickup_location_id` INT NOT NULL,
  `valid_from` DATE NOT NULL,
  `valid_until` DATE NOT NULL,
  `academic_year` VARCHAR(20) NOT NULL DEFAULT '2026-27',
  `status` ENUM('ACTIVE', 'EXPIRED', 'CANCELLED') DEFAULT 'ACTIVE',
  `qr_data` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`application_id`) REFERENCES `bus_pass_applications`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`bus_id`) REFERENCES `buses`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`pickup_location_id`) REFERENCES `locations`(`id`) ON DELETE CASCADE,
  INDEX `idx_pass_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 16. Table: trips
-- Scheduled or active operational runs
-- ----------------------------------------------------------------------------
CREATE TABLE `trips` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `bus_id` INT NOT NULL,
  `route_id` INT NOT NULL,
  `driver_id` INT NOT NULL,
  `trip_type` ENUM('morning_pickup', 'evening_drop', 'special') DEFAULT 'morning_pickup',
  `status` ENUM('scheduled', 'in_progress', 'completed', 'cancelled') DEFAULT 'scheduled',
  `start_time` TIMESTAMP NULL DEFAULT NULL,
  `end_time` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`bus_id`) REFERENCES `buses`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 17. Table: live_locations
-- Real-time telemetry coordinates for live bus tracking
-- ----------------------------------------------------------------------------
CREATE TABLE `live_locations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `bus_id` INT NOT NULL UNIQUE,
  `trip_id` INT NULL,
  `latitude` DECIMAL(10,8) NOT NULL,
  `longitude` DECIMAL(11,8) NOT NULL,
  `speed_kmh` DECIMAL(5,2) DEFAULT 0.00,
  `heading_degrees` DECIMAL(5,2) DEFAULT 0.00,
  `current_stop_name` VARCHAR(150) DEFAULT NULL,
  `next_stop_name` VARCHAR(150) DEFAULT NULL,
  `eta_next_stop` VARCHAR(50) DEFAULT NULL,
  `trip_status` VARCHAR(50) DEFAULT 'In Transit',
  `last_updated` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`bus_id`) REFERENCES `buses`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 18. Table: cancellation_requests
-- Student transportation opt-out requests
-- ----------------------------------------------------------------------------
CREATE TABLE `cancellation_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT NOT NULL,
  `reason` ENUM('Using Own Vehicle', 'Shifted Residence', 'No Longer Requires Bus', 'Personal Reason', 'Other') NOT NULL,
  `remarks` TEXT DEFAULT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
  `admin_remarks` TEXT DEFAULT NULL,
  `reviewed_by_admin_id` INT NULL,
  `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`reviewed_by_admin_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_cancel_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 19. Table: notifications
-- System alerts and notifications for Admin, Student, and Driver
-- ----------------------------------------------------------------------------
CREATE TABLE `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `target_role` ENUM('all', 'admin', 'student', 'driver') DEFAULT 'all',
  `title` VARCHAR(150) NOT NULL,
  `message` TEXT NOT NULL,
  `category` ENUM('info', 'success', 'warning', 'danger') DEFAULT 'info',
  `is_read` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_notif_target` (`target_role`, `is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- REQUIRED SYSTEM/ADMIN INITIAL CONFIGURATION ONLY
-- No fake demo students, fake payments, fake receipts, or fake routes!
-- ============================================================================
INSERT INTO `users` (`username`, `email`, `password_hash`, `role`, `full_name`, `phone`, `avatar`, `status`)
VALUES (
  'admin',
  'admin@college.edu',
  '$2b$10$UYfZPx1a5/XBaItj8U7.WeQcLu5Wt60RXG666PkCua9EuWrj6U1Q6', -- bcrypt hash of 'password123'
  'admin',
  'Dr. Ramesh Sharma',
  '+91 98450 11223',
  '👨‍💼',
  'active'
);

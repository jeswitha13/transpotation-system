// In-Memory Data Store for Smart Bus Management System
// Structured in a database-ready schema format for seamless future MySQL migration.

const initialData = {
  users: [
    {
      id: 'usr-admin-01',
      username: 'admin',
      email: 'admin@college.edu',
      password: 'password123',
      role: 'admin',
      name: 'Dr. Ramesh Sharma',
      designation: 'Director of Transport & Logistics',
      phone: '+91 98450 11223',
      avatar: '👨‍💼',
      createdAt: '2025-01-10T08:00:00Z'
    },
    {
      id: 'usr-stu-01',
      username: 'rahul.v',
      email: 'rahul@college.edu',
      password: 'password123',
      role: 'student',
      name: 'Rahul Verma',
      rollNo: '23CS1048',
      branch: 'Computer Science & Engineering',
      year: '3rd Year',
      phone: '+91 98765 43210',
      address: 'Plot 42, Green Valley, Madanapalle',
      pickupId: 'loc-01',
      routeId: 'route-01',
      busId: 'bus-01',
      feeStatus: 'Paid',
      passStatus: 'Active',
      avatar: '👨‍🎓',
      createdAt: '2025-06-15T09:30:00Z'
    },
    {
      id: 'usr-stu-02',
      username: 'ananya.r',
      email: 'ananya@college.edu',
      password: 'password123',
      role: 'student',
      name: 'Ananya Reddy',
      rollNo: '23EC2015',
      branch: 'Electronics & Communication',
      year: '2nd Year',
      phone: '+91 98451 23456',
      address: '14-B Gandhi Road, Punganur',
      pickupId: 'loc-05',
      routeId: 'route-02',
      busId: 'bus-02',
      feeStatus: 'Pending',
      passStatus: 'Pending Payment',
      avatar: '👩‍🎓',
      createdAt: '2025-07-01T10:15:00Z'
    },
    {
      id: 'usr-stu-03',
      username: 'kiran.k',
      email: 'kiran@college.edu',
      password: 'password123',
      role: 'student',
      name: 'Kiran Kumar',
      rollNo: '23ME3002',
      branch: 'Mechanical Engineering',
      year: '4th Year',
      phone: '+91 97001 88990',
      address: 'Nehru Circle, Madanapalle',
      pickupId: 'loc-02',
      routeId: 'route-01',
      busId: 'bus-01',
      feeStatus: 'Paid',
      passStatus: 'Active',
      avatar: '👨‍🎓',
      createdAt: '2025-06-18T11:00:00Z'
    },
    {
      id: 'usr-drv-01',
      username: 'suresh.k',
      email: 'driver@college.edu',
      password: 'password123',
      role: 'driver',
      name: 'Suresh Kumar',
      phone: '+91 91234 56789',
      license: 'DL-AP04-2018-00982',
      experience: '12 Years',
      busId: 'bus-01',
      routeId: 'route-01',
      status: 'On Duty',
      avatar: '👮‍♂️',
      createdAt: '2024-05-12T07:00:00Z'
    },
    {
      id: 'usr-drv-02',
      username: 'venkatesh.r',
      email: 'venkatesh@college.edu',
      password: 'password123',
      role: 'driver',
      name: 'Venkatesh Rao',
      phone: '+91 94401 22334',
      license: 'DL-AP04-2016-00431',
      experience: '15 Years',
      busId: 'bus-02',
      routeId: 'route-02',
      status: 'On Duty',
      avatar: '👮‍♂️',
      createdAt: '2024-04-10T07:00:00Z'
    }
  ],

  locations: [
    {
      id: 'loc-01',
      name: 'Madanapalle RTC Bus Stand',
      zone: 'Zone 1',
      distanceKm: 18,
      fee: 14000,
      routeId: 'route-01',
      status: 'Active',
      morningPickupTime: '07:45 AM',
      eveningDropTime: '05:30 PM'
    },
    {
      id: 'loc-02',
      name: 'Nehru Circle, Madanapalle',
      zone: 'Zone 1',
      distanceKm: 16,
      fee: 14000,
      routeId: 'route-01',
      status: 'Active',
      morningPickupTime: '07:55 AM',
      eveningDropTime: '05:20 PM'
    },
    {
      id: 'loc-03',
      name: 'Rama Rao Colony / Bypass',
      zone: 'Zone 1',
      distanceKm: 14,
      fee: 12000,
      routeId: 'route-01',
      status: 'Active',
      morningPickupTime: '08:05 AM',
      eveningDropTime: '05:10 PM'
    },
    {
      id: 'loc-04',
      name: 'Angallu Junction',
      zone: 'Zone 1',
      distanceKm: 4,
      fee: 8000,
      routeId: 'route-01',
      status: 'Active',
      morningPickupTime: '08:25 AM',
      eveningDropTime: '04:50 PM'
    },
    {
      id: 'loc-05',
      name: 'Punganur Town Bus Stand',
      zone: 'Zone 2',
      distanceKm: 28,
      fee: 18000,
      routeId: 'route-02',
      status: 'Active',
      morningPickupTime: '07:30 AM',
      eveningDropTime: '05:45 PM'
    },
    {
      id: 'loc-06',
      name: 'Somala Cross Center',
      zone: 'Zone 2',
      distanceKm: 22,
      fee: 16000,
      routeId: 'route-02',
      status: 'Active',
      morningPickupTime: '07:45 AM',
      eveningDropTime: '05:30 PM'
    },
    {
      id: 'loc-07',
      name: 'Chowdepalle Center',
      zone: 'Zone 2',
      distanceKm: 19,
      fee: 15000,
      routeId: 'route-02',
      status: 'Active',
      morningPickupTime: '08:00 AM',
      eveningDropTime: '05:15 PM'
    },
    {
      id: 'loc-08',
      name: 'Kurabalakota Center',
      zone: 'Zone 2',
      distanceKm: 24,
      fee: 17000,
      routeId: 'route-03',
      status: 'Active',
      morningPickupTime: '07:35 AM',
      eveningDropTime: '05:40 PM'
    },
    {
      id: 'loc-09',
      name: 'Mudivedu Circle',
      zone: 'Zone 2',
      distanceKm: 15,
      fee: 13000,
      routeId: 'route-03',
      status: 'Active',
      morningPickupTime: '07:55 AM',
      eveningDropTime: '05:20 PM'
    },
    {
      id: 'loc-10',
      name: 'B.Kothakota Center',
      zone: 'Zone 3',
      distanceKm: 34,
      fee: 22000,
      routeId: 'route-04',
      status: 'Active',
      morningPickupTime: '07:15 AM',
      eveningDropTime: '06:00 PM'
    },
    {
      id: 'loc-11',
      name: 'Kadiri Toll Gate Line',
      zone: 'Zone 3',
      distanceKm: 32,
      fee: 21000,
      routeId: 'route-05',
      status: 'Active',
      morningPickupTime: '07:20 AM',
      eveningDropTime: '05:55 PM'
    }
  ],

  routes: [
    {
      id: 'route-01',
      routeNumber: 'Route 01',
      title: 'Madanapalle Town - Campus Express',
      startPoint: 'Madanapalle RTC Bus Stand',
      endPoint: 'Main College Campus',
      distance: '18 km',
      totalStops: 5,
      timing: '07:45 AM - 08:35 AM',
      busId: 'bus-01',
      driverId: 'usr-drv-01',
      status: 'In Transit',
      stops: [
        { order: 1, name: 'Madanapalle RTC Stand', time: '07:45 AM', studentsCount: 16, lat: 13.5510, lng: 78.5020 },
        { order: 2, name: 'Nehru Circle', time: '07:55 AM', studentsCount: 12, lat: 13.5580, lng: 78.5080 },
        { order: 3, name: 'Rama Rao Colony Bypass', time: '08:05 AM', studentsCount: 8, lat: 13.5700, lng: 78.5200 },
        { order: 4, name: 'Angallu Junction', time: '08:22 AM', studentsCount: 10, lat: 13.5950, lng: 78.5520 },
        { order: 5, name: 'College Main Campus', time: '08:35 AM', studentsCount: 0, lat: 13.6200, lng: 78.5800 }
      ]
    },
    {
      id: 'route-02',
      routeNumber: 'Route 02',
      title: 'Punganur Highway Corridor',
      startPoint: 'Punganur Town Bus Stand',
      endPoint: 'Main College Campus',
      distance: '28 km',
      totalStops: 5,
      timing: '07:30 AM - 08:40 AM',
      busId: 'bus-02',
      driverId: 'usr-drv-02',
      status: 'Scheduled',
      stops: [
        { order: 1, name: 'Punganur Town Stand', time: '07:30 AM', studentsCount: 18, lat: 13.3660, lng: 78.5800 },
        { order: 2, name: 'Somala Cross Center', time: '07:48 AM', studentsCount: 10, lat: 13.4300, lng: 78.5750 },
        { order: 3, name: 'Chowdepalle Center', time: '08:02 AM', studentsCount: 7, lat: 13.4900, lng: 78.5700 },
        { order: 4, name: 'Nimmanapalle Cross', time: '08:20 AM', studentsCount: 7, lat: 13.5600, lng: 78.5680 },
        { order: 5, name: 'College Main Campus', time: '08:40 AM', studentsCount: 0, lat: 13.6200, lng: 78.5800 }
      ]
    },
    {
      id: 'route-03',
      routeNumber: 'Route 03',
      title: 'Rayachoti - Kurabalakota Line',
      startPoint: 'Kurabalakota Center',
      endPoint: 'Main College Campus',
      distance: '24 km',
      totalStops: 5,
      timing: '07:35 AM - 08:35 AM',
      busId: 'bus-03',
      driverId: null,
      status: 'In Transit',
      stops: [
        { order: 1, name: 'Kurabalakota Center', time: '07:35 AM', studentsCount: 15, lat: 13.6500, lng: 78.4800 },
        { order: 2, name: 'Mudivedu Circle', time: '07:55 AM', studentsCount: 14, lat: 13.6400, lng: 78.5100 },
        { order: 3, name: 'Thettu Cross', time: '08:10 AM', studentsCount: 9, lat: 13.6300, lng: 78.5400 },
        { order: 4, name: 'Angallu East Bypass', time: '08:22 AM', studentsCount: 10, lat: 13.6220, lng: 78.5650 },
        { order: 5, name: 'College Main Campus', time: '08:35 AM', studentsCount: 0, lat: 13.6200, lng: 78.5800 }
      ]
    },
    {
      id: 'route-04',
      routeNumber: 'Route 04',
      title: 'B.Kothakota Rural Express',
      startPoint: 'B.Kothakota Center',
      endPoint: 'Main College Campus',
      distance: '34 km',
      totalStops: 4,
      timing: '07:15 AM - 08:45 AM',
      busId: 'bus-04',
      driverId: null,
      status: 'Scheduled',
      stops: [
        { order: 1, name: 'B.Kothakota Center', time: '07:15 AM', studentsCount: 20, lat: 13.7200, lng: 78.3500 },
        { order: 2, name: 'Beerangi Cross', time: '07:45 AM', studentsCount: 11, lat: 13.6800, lng: 78.4300 },
        { order: 3, name: 'Horsley Hills Junction', time: '08:10 AM', studentsCount: 8, lat: 13.6450, lng: 78.5200 },
        { order: 4, name: 'College Main Campus', time: '08:45 AM', studentsCount: 0, lat: 13.6200, lng: 78.5800 }
      ]
    },
    {
      id: 'route-05',
      routeNumber: 'Route 05',
      title: 'Kadiri Road Service',
      startPoint: 'Kadiri Toll Gate Line',
      endPoint: 'Main College Campus',
      distance: '32 km',
      totalStops: 4,
      timing: '07:20 AM - 08:40 AM',
      busId: 'bus-05',
      driverId: null,
      status: 'Scheduled',
      stops: [
        { order: 1, name: 'Kadiri Toll Gate', time: '07:20 AM', studentsCount: 18, lat: 13.7800, lng: 78.5200 },
        { order: 2, name: 'Buragunta Village', time: '07:45 AM', studentsCount: 12, lat: 13.7200, lng: 78.5400 },
        { order: 3, name: 'Valmikipuram Bypass', time: '08:10 AM', studentsCount: 15, lat: 13.6600, lng: 78.5600 },
        { order: 4, name: 'College Main Campus', time: '08:40 AM', studentsCount: 0, lat: 13.6200, lng: 78.5800 }
      ]
    }
  ],

  buses: [
    {
      id: 'bus-01',
      busNumber: 'Bus 01',
      regNumber: 'AP 04 TC 4401',
      capacity: 52,
      occupied: 46,
      driverId: 'usr-drv-01',
      driverName: 'Suresh Kumar',
      driverPhone: '+91 91234 56789',
      routeId: 'route-01',
      routeName: 'Madanapalle Town - Campus Express',
      status: 'Active',
      gpsStatus: 'Live',
      speed: '42 km/h',
      fuelLevel: '85%',
      lastMaintenance: '2025-08-10',
      nextService: '2025-11-10'
    },
    {
      id: 'bus-02',
      busNumber: 'Bus 02',
      regNumber: 'AP 04 TC 4402',
      capacity: 50,
      occupied: 42,
      driverId: 'usr-drv-02',
      driverName: 'Venkatesh Rao',
      driverPhone: '+91 94401 22334',
      routeId: 'route-02',
      routeName: 'Punganur Highway Corridor',
      status: 'Active',
      gpsStatus: 'Standby',
      speed: '0 km/h',
      fuelLevel: '92%',
      lastMaintenance: '2025-07-28',
      nextService: '2025-10-28'
    },
    {
      id: 'bus-03',
      busNumber: 'Bus 03',
      regNumber: 'AP 04 TC 4403',
      capacity: 54,
      occupied: 48,
      driverId: 'usr-drv-03',
      driverName: 'K. Balaji',
      driverPhone: '+91 98480 33445',
      routeId: 'route-03',
      routeName: 'Rayachoti - Kurabalakota Line',
      status: 'Active',
      gpsStatus: 'Live',
      speed: '38 km/h',
      fuelLevel: '78%',
      lastMaintenance: '2025-08-01',
      nextService: '2025-11-01'
    },
    {
      id: 'bus-04',
      busNumber: 'Bus 04',
      regNumber: 'AP 04 TC 4404',
      capacity: 48,
      occupied: 39,
      driverId: 'usr-drv-04',
      driverName: 'Mohan Das',
      driverPhone: '+91 97011 55667',
      routeId: 'route-04',
      routeName: 'B.Kothakota Rural Express',
      status: 'Active',
      gpsStatus: 'Standby',
      speed: '0 km/h',
      fuelLevel: '64%',
      lastMaintenance: '2025-06-15',
      nextService: '2025-09-30'
    },
    {
      id: 'bus-05',
      busNumber: 'Bus 05',
      regNumber: 'AP 04 TC 4405',
      capacity: 52,
      occupied: 45,
      driverId: 'usr-drv-05',
      driverName: 'P. Srinivas',
      driverPhone: '+91 96180 77889',
      routeId: 'route-05',
      routeName: 'Kadiri Road Service',
      status: 'Active',
      gpsStatus: 'Standby',
      speed: '0 km/h',
      fuelLevel: '80%',
      lastMaintenance: '2025-07-10',
      nextService: '2025-10-15'
    },
    {
      id: 'bus-06',
      busNumber: 'Bus 06',
      regNumber: 'AP 04 TC 4406',
      capacity: 50,
      occupied: 0,
      driverId: null,
      driverName: 'Unassigned',
      driverPhone: '-',
      routeId: null,
      routeName: 'Spare / Fleet Reserve',
      status: 'Maintenance',
      gpsStatus: 'Offline',
      speed: '0 km/h',
      fuelLevel: '45%',
      lastMaintenance: '2025-08-20',
      nextService: '2025-08-30'
    }
  ],

  drivers: [
    {
      id: 'usr-drv-01',
      name: 'Suresh Kumar',
      phone: '+91 91234 56789',
      license: 'DL-AP04-2018-00982',
      busId: 'bus-01',
      busNumber: 'Bus 01',
      routeId: 'route-01',
      routeName: 'Madanapalle Town - Campus Express',
      experience: '12 Years',
      rating: '4.9 ★',
      status: 'Active',
      joinDate: '2022-03-15'
    },
    {
      id: 'usr-drv-02',
      name: 'Venkatesh Rao',
      phone: '+91 94401 22334',
      license: 'DL-AP04-2016-00431',
      busId: 'bus-02',
      busNumber: 'Bus 02',
      routeId: 'route-02',
      routeName: 'Punganur Highway Corridor',
      experience: '15 Years',
      rating: '4.8 ★',
      status: 'Active',
      joinDate: '2021-08-01'
    },
    {
      id: 'usr-drv-03',
      name: 'K. Balaji',
      phone: '+91 98480 33445',
      license: 'DL-AP04-2019-01124',
      busId: 'bus-03',
      busNumber: 'Bus 03',
      routeId: 'route-03',
      routeName: 'Rayachoti - Kurabalakota Line',
      experience: '9 Years',
      rating: '4.7 ★',
      status: 'Active',
      joinDate: '2023-01-10'
    },
    {
      id: 'usr-drv-04',
      name: 'Mohan Das',
      phone: '+91 97011 55667',
      license: 'DL-AP04-2015-00778',
      busId: 'bus-04',
      busNumber: 'Bus 04',
      routeId: 'route-04',
      routeName: 'B.Kothakota Rural Express',
      experience: '14 Years',
      rating: '4.9 ★',
      status: 'Active',
      joinDate: '2020-11-20'
    },
    {
      id: 'usr-drv-05',
      name: 'P. Srinivas',
      phone: '+91 96180 77889',
      license: 'DL-AP04-2020-02319',
      busId: 'bus-05',
      busNumber: 'Bus 05',
      routeId: 'route-05',
      routeName: 'Kadiri Road Service',
      experience: '8 Years',
      rating: '4.6 ★',
      status: 'Active',
      joinDate: '2023-06-15'
    }
  ],

  payments: [
    {
      receiptNo: 'RCP-2025-8841',
      paymentId: 'TXN_UPI_992817263',
      studentId: 'usr-stu-01',
      studentName: 'Rahul Verma',
      rollNo: '23CS1048',
      branch: 'Computer Science & Engineering',
      amount: 14000,
      feeType: 'Annual Transportation Fee',
      academicYear: '2025-2026',
      pickupLocation: 'Madanapalle RTC Bus Stand',
      route: 'Route 01 - Madanapalle Town',
      busNumber: 'Bus 01',
      method: 'UPI (Google Pay)',
      date: '2025-06-20',
      time: '10:42 AM',
      status: 'Successful',
      referenceNumber: 'UPI/982716381029'
    },
    {
      receiptNo: 'RCP-2025-8842',
      paymentId: 'TXN_CARD_773615201',
      studentId: 'usr-stu-03',
      studentName: 'Kiran Kumar',
      rollNo: '23ME3002',
      branch: 'Mechanical Engineering',
      amount: 14000,
      feeType: 'Annual Transportation Fee',
      academicYear: '2025-2026',
      pickupLocation: 'Nehru Circle, Madanapalle',
      route: 'Route 01 - Madanapalle Town',
      busNumber: 'Bus 01',
      method: 'Credit Card (Visa)',
      date: '2025-06-22',
      time: '03:15 PM',
      status: 'Successful',
      referenceNumber: 'CC/773615201-AUTH'
    }
  ],

  passes: [
    {
      passId: 'PASS-2025-1048',
      studentId: 'usr-stu-01',
      rollNo: '23CS1048',
      studentName: 'Rahul Verma',
      branch: 'CSE - 3rd Year',
      busNumber: 'Bus 01',
      routeName: 'Route 01 (Madanapalle Town)',
      pickupLocation: 'Madanapalle RTC Bus Stand',
      validFrom: '2025-07-01',
      validUntil: '2026-06-30',
      status: 'Active',
      academicYear: '2025-2026',
      qrData: 'VERIFIED:23CS1048:BUS-01:ROUTE-01:VALID-2026'
    },
    {
      passId: 'PASS-2025-3002',
      studentId: 'usr-stu-03',
      rollNo: '23ME3002',
      studentName: 'Kiran Kumar',
      branch: 'ME - 4th Year',
      busNumber: 'Bus 01',
      routeName: 'Route 01 (Madanapalle Town)',
      pickupLocation: 'Nehru Circle',
      validFrom: '2025-07-01',
      validUntil: '2026-06-30',
      status: 'Active',
      academicYear: '2025-2026',
      qrData: 'VERIFIED:23ME3002:BUS-01:ROUTE-01:VALID-2026'
    }
  ],

  cancellations: [
    {
      id: 'can-001',
      studentId: 'usr-stu-02',
      studentName: 'Ananya Reddy',
      rollNo: '23EC2015',
      route: 'Route 02 - Punganur Corridor',
      busNumber: 'Bus 02',
      pickupLocation: 'Punganur Town Bus Stand',
      reason: 'Using Own Vehicle',
      remarks: 'Purchased two-wheeler, commute by personal bike from next term.',
      requestDate: '2025-09-15T14:20:00Z',
      status: 'Pending',
      adminRemarks: 'Under review by transport manager.'
    }
  ],

  notifications: [
    {
      id: 'notif-01',
      title: 'Bus Pass Generated',
      message: 'Your Digital Bus Pass for Academic Year 2025-2026 has been successfully generated.',
      category: 'success',
      targetRole: 'student',
      userId: 'usr-stu-01',
      timestamp: '2025-06-20T10:45:00Z',
      read: false
    },
    {
      id: 'notif-02',
      title: 'Fee Payment Received',
      message: 'Payment of ₹14,000 for Annual Transportation Fee is verified. Receipt RCP-2025-8841 generated.',
      category: 'info',
      targetRole: 'student',
      userId: 'usr-stu-01',
      timestamp: '2025-06-20T10:43:00Z',
      read: true
    },
    {
      id: 'notif-03',
      title: 'Route Timetable Notice',
      message: 'Morning pickup starts precisely 10 minutes earlier during upcoming mid-term examinations.',
      category: 'warning',
      targetRole: 'all',
      userId: null,
      timestamp: '2025-09-20T08:00:00Z',
      read: false
    },
    {
      id: 'notif-04',
      title: 'New Cancellation Request',
      message: 'Student Ananya Reddy (23EC2015) has requested transportation cancellation.',
      category: 'warning',
      targetRole: 'admin',
      userId: 'usr-admin-01',
      timestamp: '2025-09-15T14:20:00Z',
      read: false
    }
  ],

  // Live Tracking Real-time Telemetry State
  tracking: {
    'bus-01': {
      busId: 'bus-01',
      busNumber: 'Bus 01',
      routeId: 'route-01',
      routeName: 'Madanapalle Town - Campus Express',
      driverName: 'Suresh Kumar',
      driverPhone: '+91 91234 56789',
      tripStatus: 'In Transit',
      speed: 42,
      currentStopIndex: 2,
      nextStop: 'Rama Rao Colony Bypass',
      etaNextStop: '4 mins',
      etaCampus: '28 mins',
      progressPercent: 55,
      lastUpdated: new Date().toLocaleTimeString(),
      latitude: 13.5650,
      longitude: 78.5140,
      currentCoordinates: { x: 55, y: 48 }, // Percentage on visual preview map
      stopsCompleted: ['Madanapalle RTC Stand', 'Nehru Circle']
    },
    'bus-02': {
      busId: 'bus-02',
      busNumber: 'Bus 02',
      routeId: 'route-02',
      routeName: 'Punganur Highway Corridor',
      driverName: 'Venkatesh Rao',
      driverPhone: '+91 94401 22334',
      tripStatus: 'Scheduled',
      speed: 0,
      currentStopIndex: 0,
      nextStop: 'Punganur Town Stand',
      etaNextStop: 'Departs 07:30 AM',
      etaCampus: '1 hr 10 mins',
      progressPercent: 0,
      lastUpdated: new Date().toLocaleTimeString(),
      latitude: 13.3660,
      longitude: 78.5800,
      currentCoordinates: { x: 10, y: 15 },
      stopsCompleted: []
    },
    'bus-03': {
      busId: 'bus-03',
      busNumber: 'Bus 03',
      routeId: 'route-03',
      routeName: 'Rayachoti - Kurabalakota Line',
      driverName: 'K. Balaji',
      driverPhone: '+91 98480 33445',
      tripStatus: 'In Transit',
      speed: 38,
      currentStopIndex: 3,
      nextStop: 'Angallu East Bypass',
      etaNextStop: '6 mins',
      etaCampus: '18 mins',
      progressPercent: 72,
      lastUpdated: new Date().toLocaleTimeString(),
      latitude: 13.6210,
      longitude: 78.5550,
      currentCoordinates: { x: 72, y: 60 },
      stopsCompleted: ['Kurabalakota Center', 'Mudivedu Circle', 'Thettu Cross']
    }
  }
};

// Deep copy initial data into runtime state
let store = JSON.parse(JSON.stringify(initialData));

module.exports = {
  getStore: () => store,
  resetStore: () => {
    store = JSON.parse(JSON.stringify(initialData));
    return store;
  }
};

export const summary = {
  headcount: 9601,
  currency: 'USD',
  totalPay: '819144586.80',
  averagePay: '85318.67',
  medianPay: '75650.00',
};

export const byCountry = {
  data: [
    {
      country: { code: 'US', name: 'United States' },
      currency: 'USD',
      headcount: 2834,
      totalPay: '381813610.00',
      totalPayUsd: '381813610.00',
      base: { average: '118805.29', median: '104500.00', min: '48100.00', max: '351200.00' },
    },
    {
      country: { code: 'IN', name: 'India' },
      currency: 'INR',
      headcount: 2470,
      totalPay: '3570991850.00',
      totalPayUsd: '42851902.20',
      base: { average: '1275542.00', median: '1180000.00', min: '481700.00', max: '3910500.00' },
    },
  ],
};

export const byDepartment = {
  currency: 'USD',
  data: [
    {
      department: { id: 1, name: 'Engineering' },
      headcount: 3300,
      totalPayUsd: '320000000.00',
      base: { average: '90000.00', median: '82000.00' },
    },
    {
      department: { id: 2, name: 'Sales' },
      headcount: 1400,
      totalPayUsd: '110000000.00',
      base: { average: '75000.00', median: '70000.00' },
    },
  ],
};

export const byLevelUsd = {
  currency: 'USD',
  data: [
    {
      level: 'L1',
      headcount: 2343,
      base: { average: '44368.31', median: '48895.00', min: '5780.40', max: '87800.00' },
    },
    {
      level: 'L2',
      headcount: 2909,
      base: { average: '60359.97', median: '65564.00', min: '7844.40', max: '118700.00' },
    },
  ],
};

export const byLevelInr = {
  currency: 'INR',
  data: [
    {
      level: 'L1',
      headcount: 622,
      base: { average: '751467.20', median: '744800.00', min: '481700.00', max: '989700.00' },
    },
  ],
};

export const distribution = {
  currency: 'USD',
  data: [
    { from: '0.00', to: '50000.00', count: 3193 },
    { from: '50000.00', to: '100000.00', count: 3867 },
  ],
};

export const trend = {
  data: [
    { year: 2024, hires: 1138, cumulative: 7057 },
    { year: 2025, hires: 1215, cumulative: 8272 },
    { year: 2026, hires: 1329, cumulative: 9601 },
  ],
};

export const analyticsHandlers = {
  'GET /api/analytics/summary': { body: summary },
  'GET /api/analytics/by-country': { body: byCountry },
  'GET /api/analytics/by-department': { body: byDepartment },
  'GET /api/analytics/by-level': { body: byLevelUsd },
  'GET /api/analytics/distribution': { body: distribution },
  'GET /api/analytics/headcount-trend': { body: trend },
};

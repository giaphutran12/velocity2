# Velocity API Issue Report - 2026-01-01

## Summary
33 of 39 broker API keys are returning HTTP 400 "Unexpected error retrieving deals" from the Velocity API. Issue started on 2026-01-01.

## Key Finding
**NOT a date format issue** - failing brokers return 400 for ALL dates (2025 and 2026). Working brokers succeed for ALL dates.

| Test | Failing Broker (Alika Walia) | Working Broker (Sunny Dhillon) |
|------|------------------------------|--------------------------------|
| 2026-01-01 | 400 | 200 |
| 2025-12-31 | 400 | 200 |
| 2025-12-01 to 2025-12-31 | 400 | 200 |

## API Endpoint
```
https://api-velocity.newton.ca/api/forms/v1/deals?apikey={key}&startdate={date}&enddate={date}&datetype=1&page=1
```

## Working Brokers (6)
1. Gurjit Sandhu
2. Jennifer Souvanvong
3. Karny Mehat
4. Shaneen Mohammed
5. Sunny Dhillon
6. Valerie Roy

## Failing Brokers (33)
1. Alika Walia
2. Amanda Weeks
3. Bowie Nan
4. Brandon Viaje-Roque
5. Brendan Wilson
6. Charlene Smith
7. Doyle Minhas
8. Garry Singh
9. Gurpreet Kaur
10. Jayashree Venkatachalam
11. Kam Virdi
12. Karen John
13. Keenan Marshall
14. Lesly Camaclang
15. Megan Robertson
16. Mindy Basran
17. Natalie Pacheco
18. Nav Cheema
19. Nazneen Nasir Khan
20. Olaf Durkowski
21. Patrick Khouri
22. Pina Cundari
23. Prem Hoonjan
24. Rani Mallhi
25. Ranier Manding
26. Renzo Mesia
27. Riley Morrison
28. Saihaj Cheema
29. Salil Singla
30. Serg Martires
31. Shawn Cantwell
32. Shiela Jamero
33. Stephanie Viaje

## What We Ruled Out
- Date format (YYYY-MM-DD is correct)
- Year 2026 specifically (fails for 2025 dates too)
- Base URL (all brokers use same URL)
- API key format (all valid UUIDs)
- Our code (same code path for all brokers)

## Likely Cause
Backend issue on Newton's Velocity API affecting specific broker accounts. The same API keys were working a few days ago.

## Action Required
Contact Newton support to investigate why these 33 broker accounts are returning "Unexpected error retrieving deals" while 6 others work fine.

## Test Scripts
- `scripts/test-api-keys.ts` - Tests all broker API keys
- `scripts/check-broker-urls.ts` - Compares working vs failing broker configs
- `scripts/test-date-hypothesis.ts` - Tests date hypothesis
- `scripts/api-keys-test-results.json` - Raw test results

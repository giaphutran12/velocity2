# RC Extension Mapping Gaps

Generated: 2024-12-30

## Summary

- Total RC Extensions: 61
- Total VL Brokers: 39
- Matched: 26 (25 new + 1 already mapped)
- Unmatched Brokers: 13
- Unmatched Extensions: 31

## Unmatched VL Brokers (no RC extension found)

These brokers exist in Velocity but couldn't be matched to a RingCentral extension:

| Broker Name             | Broker ID                            |
| ----------------------- | ------------------------------------ |
| Amanda Weeks            | 9bf4ecf7-2c4c-4f8b-989d-5279907a0971 |
| Valerie Roy             | a1c7e4fb-c06b-4602-bd13-3259aa78440b |
| Shawn Cantwell          | 66508a9f-a324-40f2-b8bc-03e12bba11fd |
| Riley Morrison          | a9713c99-7ac4-440f-8746-86b57bc65542 |
| Karen John              | 371a800c-21e4-4d84-99fb-12c6c557e319 |
| Jayashree Venkatachalam | 77e6ef3f-0868-4c6f-8941-9d75d3eeb656 |
| Nazneen Nasir Khan      | d30d4e31-c79a-41a8-9a0e-4a1e61312833 |
| Pina Cundari            | cf6d37df-d56f-4dcf-85c8-5f18abc7ce83 |
| Patrick Khouri          | 937a6606-6ceb-48c0-9119-56e75cb255d8 |
| Keenan Marshall         | fcae6c3f-273f-444c-bdef-522d7481c691 |
| Rani Mallhi             | a4945dcd-76d0-43b6-8354-3dbc24d25d4a |
| Prem Hoonjan            | 44f22623-a092-46c2-8c66-3afd68fadfb0 |
| Kam Virdi               | 7858ab10-2e51-4ec7-984f-345fa3dd2855 |

## Unmatched RC Extensions (no VL broker found)

These RingCentral extensions exist but aren't in Velocity:

| Name               | Extension ID | Extension Number | Notes          |
| ------------------ | ------------ | ---------------- | -------------- |
| Savraj Cheema      | 310351042    | 808              |                |
| Amanbir Singh      | 317419042    | 903              | Contractor dev |
| Mona Rakkar        | 321048042    | 908              |                |
| Karolina Mazur     | 321539042    | 700              |                |
| Rahul Narula       | 321554042    | 909              |                |
| Veetesh Rup        | 660561043    | 199              |                |
| Jaslene Perhar     | 660565043    | 619              |                |
| Nitesh Prakash     | 660566043    | 100              |                |
| Miko Bacomo        | 660567043    | 125              |                |
| Donna Humphreys    | 660568043    | 130              |                |
| Don Ha             | 660569043    | 115              |                |
| Shey Nandini       | 660570043    | 708              |                |
| Sarah Cabaral      | 660571043    | 102              |                |
| Taylor Hopkins     | 660574043    | 600              |                |
| Baldip Nijjar      | 660577043    | 202              |                |
| Neville Kumar      | 660596043    | 901              |                |
| Philip Tai         | 660597043    | 706              |                |
| Kylie Mattu        | 660598043    | 801              |                |
| Candice Jamieson   | 660599043    | 106              |                |
| Ross Kennedy       | 660604043    | 160              |                |
| Helena Kwiatkowska | 660609043    | 707              |                |
| Edward Tran        | 660611043    | 201              |                |
| Tony Gueness       | 674136043    | 702              |                |
| Divs C             | 676982043    | 902              |                |
| Harick Brar        | 678555043    | 198              |                |
| Katie McCammon     | 678657043    | 904              |                |
| Closing Room       | 679830043    | 906              | Shared line    |
| Lisa Reynolds      | 681730043    | 907              |                |
| Gaurav Dadral      | 687603043    | 910              |                |
| Samuel Pius        | 688880043    | 912              |                |
| Parmeet Singh      | 690535043    | 913              |                |

## Manual Mapping

To manually map a broker to an extension, run:

```sql
UPDATE vl_brokers SET rc_extension_id = '<extension_id>' WHERE id = '<broker_id>';
```

Example:

```sql
UPDATE vl_brokers SET rc_extension_id = '317419042' WHERE id = '9bf4ecf7-2c4c-4f8b-989d-5279907a0971';
```

Eventually, gaurav, rahul, savraj, jaslene, katie and parmeet will be though

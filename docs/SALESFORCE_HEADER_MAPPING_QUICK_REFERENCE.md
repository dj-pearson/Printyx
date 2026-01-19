# Salesforce to Printyx Column Header Quick Reference

## 📋 Copy-Paste CSV Headers

Replace your Salesforce headers with this single line:

```csv
company_name,external_salesforce_id,account_type,website,industry,notes,lead_source,customer_number,status,contact_first_name,contact_last_name,primary_contact_title,address_line1,city,state,postal_code,country,phone,fax,mobile_phone,primary_contact_email,account_manager_name,owner_id,created_at,updated_at,created_by_name
```

---

## 🔄 Find & Replace in Excel/CSV

Use Find & Replace (Ctrl+H) for the header row only:

| Find | Replace With |
|---|---|
| `Business Name` | `company_name` |
| `Business ID` | `external_salesforce_id` |
| `Business Record Type` | `account_type` |
| `Business Description` | `notes` |
| `Lead Source` | `lead_source` |
| `EA Customer Number` | `customer_number` |
| `Prospect Status` | `status` |
| `First Name` | `contact_first_name` |
| `Last Name` | `contact_last_name` |
| `Title` | `primary_contact_title` |
| `Mailing Street` | `address_line1` |
| `Mailing City` | `city` |
| `Mailing State/Province` | `state` |
| `Mailing Zip/Postal Code` | `postal_code` |
| `Mailing Country` | `country` |
| `Phone` | `phone` |
| `Fax` | `fax` |
| `Mobile` | `mobile_phone` |
| `Email` | `primary_contact_email` |
| `Business Owner` | `account_manager_name` |
| `Business Owner Alias` | `owner_id` |
| `Created Date` | `created_at` |
| `Last Modified Date` | `updated_at` |
| `Created By` | `created_by_name` |

---

## ⚡ 30-Second Process

1. Export from Salesforce (.xls)
2. Open in Excel
3. Select row 1 (header row)
4. Delete it
5. Paste this as new row 1:
   ```
   company_name,external_salesforce_id,account_type,website,industry,notes,lead_source,customer_number,status,contact_first_name,contact_last_name,primary_contact_title,address_line1,city,state,postal_code,country,phone,fax,mobile_phone,primary_contact_email,account_manager_name,owner_id,created_at,updated_at,created_by_name
   ```
6. Save As → CSV
7. Upload to Printyx

Done!

---

## 📌 Fields NOT in Salesforce (Added Automatically by Printyx)

These are added during import - don't worry about them:
- ✅ `tenant_id` - Added automatically
- ✅ `record_type` - Set to "customer" or "lead"
- ✅ `external_system_id` - Set to "salesforce"

---

Print this page and keep it handy when importing!

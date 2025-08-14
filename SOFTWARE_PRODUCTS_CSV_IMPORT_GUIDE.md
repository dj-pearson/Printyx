# Software Products CSV Import Guide

## Quick Start
Use the provided `software_products_template.csv` file as your starting point. This template includes all available fields with sample data.

## Required Fields
- `product_code` - Unique identifier for the product (required)
- `product_name` - Display name of the product (required)

## Field Descriptions

### Basic Information
- `vendor` - Manufacturer or vendor name
- `product_type` - Type of product (Application, License, etc.)
- `category` - Product category
- `accessory_type` - Type of accessory/license
- `payment_type` - Payment structure (Monthly, Annual, Perpetual)
- `description` - Detailed product description

### Additional Information
- `summary` - Brief product summary
- `note` - Internal notes
- `ea_notes` - E-Automate specific notes
- `config_note` - Configuration requirements
- `related_products` - Related product codes (separate multiple with |)

### Pricing Fields
All pricing fields are optional and accept decimal values:

**Standard Pricing:**
- `standard_active` - Enable standard pricing (TRUE/FALSE)
- `standard_cost` - Standard cost price
- `standard_rep_price` - Standard representative price

**New Pricing:**
- `new_active` - Enable new pricing (TRUE/FALSE)
- `new_cost` - New customer cost
- `new_rep_price` - New customer rep price

**Upgrade Pricing:**
- `upgrade_active` - Enable upgrade pricing (TRUE/FALSE)
- `upgrade_cost` - Upgrade cost
- `upgrade_rep_price` - Upgrade rep price

### Flags (TRUE/FALSE values)
- `is_active` - Product is active
- `available_for_all` - Available to all users
- `repost_edit` - Allow repost editing
- `sales_rep_credit` - Sales rep gets credit
- `funding` - Funding available
- `lease` - Lease option available

### System Fields
- `price_book_id` - Price book identifier
- `temp_key` - Temporary key for tracking

## Boolean Values
Use `TRUE` or `FALSE` (case insensitive) for all boolean fields.

## Tips
1. Keep product codes unique
2. Use pipe separator (|) for multiple related products
3. Leave fields empty if not applicable
4. All pricing values should be decimal numbers (e.g., 150.00)
5. Text fields will be automatically trimmed of extra spaces
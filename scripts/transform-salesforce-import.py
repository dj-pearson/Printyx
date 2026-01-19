#!/usr/bin/env python3
"""
Transform Salesforce Business & Contacts export to Printyx import format
Handles deduplication and field mapping automatically
"""

import pandas as pd
import sys
from pathlib import Path

# Configuration - UPDATE THESE VALUES
TENANT_ID = "your-tenant-id-here"  # Replace with your actual tenant ID
USER_ID = "your-user-id-here"      # Replace with your actual user ID

def transform_salesforce_export(input_file: str, output_file: str = None):
    """
    Transform Salesforce export to Printyx import format
    
    Args:
        input_file: Path to Salesforce XLS export
        output_file: Path for output CSV (optional)
    """
    
    print(f"📖 Reading Salesforce export: {input_file}")
    
    # Read the HTML/XLS file
    df = pd.read_html(input_file)[0]
    
    print(f"✓ Found {len(df)} total rows (including duplicates)")
    print(f"✓ Found {df['Business Name'].nunique()} unique businesses")
    
    # Sort to prioritize contacts with emails and important titles
    df['has_email'] = df['Email'].notna() & (df['Email'] != '')
    df['title_priority'] = df['Title'].apply(lambda x: 
        0 if pd.isna(x) or x == '' else
        1 if any(word in str(x).upper() for word in ['CEO', 'CFO', 'COO', 'PRESIDENT', 'OWNER', 'DIRECTOR']) else
        2 if any(word in str(x).upper() for word in ['MANAGER', 'SUPERVISOR', 'COORDINATOR']) else
        3
    )
    
    # Sort: emails first, then by title importance
    df = df.sort_values(['Business Name', 'has_email', 'title_priority'], 
                        ascending=[True, False, True])
    
    # Keep only first contact per business (best contact)
    df_unique = df.drop_duplicates(subset=['Business ID'], keep='first')
    
    print(f"✓ Deduplicated to {len(df_unique)} unique businesses")
    
    # Create Printyx-formatted dataframe
    printyx_df = pd.DataFrame()
    
    # Map fields
    printyx_df['company_name'] = df_unique['Business Name']
    printyx_df['external_salesforce_id'] = df_unique['Business ID']
    printyx_df['record_type'] = df_unique['Business Record Type'].str.lower()  # "Customer" -> "customer"
    printyx_df['website'] = df_unique['Website']
    printyx_df['industry'] = df_unique['Industry']
    printyx_df['notes'] = df_unique['Business Description']
    
    # Combine first and last name
    printyx_df['primary_contact_name'] = (
        df_unique['First Name'].fillna('') + ' ' + 
        df_unique['Last Name'].fillna('')
    ).str.strip()
    
    printyx_df['primary_contact_email'] = df_unique['Email']
    printyx_df['primary_contact_phone'] = df_unique['Phone']
    printyx_df['primary_contact_title'] = df_unique['Title']
    
    # Address fields
    printyx_df['address_line1'] = df_unique['Mailing Street']
    printyx_df['city'] = df_unique['Mailing City']
    printyx_df['state'] = df_unique['Mailing State/Province']
    printyx_df['postal_code'] = df_unique['Mailing Zip/Postal Code']
    printyx_df['country'] = df_unique['Mailing Country'].fillna('US')
    
    # Communication
    printyx_df['phone'] = df_unique['Phone']  # Business phone (same as contact phone in this export)
    printyx_df['fax'] = df_unique['Fax']
    
    # Assignment
    printyx_df['owner_id'] = df_unique['Business Owner Alias']  # Using alias as it's shorter
    
    # Dates
    printyx_df['created_at'] = pd.to_datetime(df_unique['Created Date']).dt.strftime('%Y-%m-%d %H:%M:%S')
    printyx_df['updated_at'] = pd.to_datetime(df_unique['Last Modified Date']).dt.strftime('%Y-%m-%d %H:%M:%S')
    
    # E-Automate customer number
    printyx_df['customer_number'] = df_unique['EA Customer Number']
    
    # Static fields
    printyx_df['tenant_id'] = TENANT_ID
    printyx_df['status'] = 'active'
    printyx_df['lead_source'] = 'salesforce_import'
    printyx_df['created_by'] = USER_ID
    printyx_df['external_system_id'] = 'salesforce'
    printyx_df['external_customer_id'] = df_unique['EA Customer Number']  # Also map EA number here
    
    # Replace NaN with empty strings
    printyx_df = printyx_df.fillna('')
    
    # Generate output filename if not provided
    if output_file is None:
        input_path = Path(input_file)
        output_file = input_path.parent / f"{input_path.stem}_printyx_import.csv"
    
    # Save to CSV
    printyx_df.to_csv(output_file, index=False)
    
    print(f"✅ Saved Printyx import file: {output_file}")
    print(f"\n📊 Summary:")
    print(f"   • Total businesses: {len(printyx_df)}")
    print(f"   • With emails: {(printyx_df['primary_contact_email'] != '').sum()}")
    print(f"   • With phone: {(printyx_df['primary_contact_phone'] != '').sum()}")
    print(f"   • With address: {(printyx_df['city'] != '').sum()}")
    
    # Show sample of first 3 companies
    print(f"\n📋 Sample (first 3 companies):")
    sample_cols = ['company_name', 'primary_contact_name', 'primary_contact_email', 'city', 'state']
    print(printyx_df[sample_cols].head(3).to_string(index=False))
    
    return output_file


def main():
    if len(sys.argv) < 2:
        print("Usage: python transform-salesforce-import.py <input_file.xls> [output_file.csv]")
        print("\nExample:")
        print("  python transform-salesforce-import.py report1768836481860.xls")
        print("  python transform-salesforce-import.py report1768836481860.xls customers_import.csv")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Check if file exists
    if not Path(input_file).exists():
        print(f"❌ Error: File not found: {input_file}")
        sys.exit(1)
    
    # Check if tenant_id and user_id are configured
    if TENANT_ID == "your-tenant-id-here" or USER_ID == "your-user-id-here":
        print("⚠️  WARNING: Please update TENANT_ID and USER_ID in the script first!")
        print("   Edit the script and replace:")
        print("   • TENANT_ID = 'your-tenant-id-here'")
        print("   • USER_ID = 'your-user-id-here'")
        print("\n   Get these values from your Printyx admin settings.")
        response = input("\nContinue anyway? (y/n): ")
        if response.lower() != 'y':
            sys.exit(1)
    
    try:
        output = transform_salesforce_export(input_file, output_file)
        print(f"\n✅ Done! Import this file into Printyx: {output}")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

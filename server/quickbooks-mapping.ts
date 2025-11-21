// QuickBooks API Field Mappings for Printyx Integration
// Comprehensive field mapping system for QuickBooks Online API integration

export const QUICKBOOKS_FIELD_MAPPINGS = {
  // Customer/Account Object
  'Customer': {
    table_name: 'business_records',
    primary_key: 'Id',
    fields: {
      'Id': 'external_customer_id',
      'Name': 'company_name',
      'CompanyName': 'company_name',
      'DisplayName': 'display_name',
      'PrintOnCheckName': 'print_on_check_name',
      'Active': 'is_active',
      'CustomerTypeRef': 'customer_type_id',
      'ParentRef': 'parent_customer_id',
      'Level': 'customer_level',
      'Job': 'is_sub_customer',
      'BillWithParent': 'bill_with_parent',
      'FullyQualifiedName': 'fully_qualified_name',
      'Taxable': 'is_taxable',
      'DefaultTaxCodeRef': 'default_tax_code_id',
      'TaxExemptionReasonId': 'tax_exemption_reason',
      'SalesTermRef': 'payment_terms_id',
      'PaymentMethodRef': 'preferred_payment_method_id',
      'Balance': 'current_balance',
      'OpenBalanceDate': 'open_balance_date',
      'BalanceWithJobs': 'balance_with_jobs',
      'CreditLimit': 'credit_limit',
      'AcctNum': 'account_number',
      'OverDueBalance': 'overdue_balance',
      'TotalRevenue': 'total_revenue',
      'TotalExpense': 'total_expense',
      'PreferredDeliveryMethod': 'preferred_delivery_method',
      'ResaleNum': 'resale_number',
      'JobInfo': 'job_info_json',
      'Notes': 'customer_notes',
      'PrimaryPhone': 'primary_phone_json',
      'AlternatePhone': 'alternate_phone_json',
      'Mobile': 'mobile_phone_json',
      'Fax': 'fax_json',
      'PrimaryEmailAddr': 'primary_email_json',
      'WebAddr': 'website_json',
      'BillAddr': 'billing_address_json',
      'ShipAddr': 'shipping_address_json',
      'domain': 'qb_domain',
      'sparse': 'is_sparse',
      'SyncToken': 'sync_token',
      'MetaData': 'metadata_json'
    }
  },

  // Vendor/Supplier Object
  'Vendor': {
    table_name: 'vendors',
    primary_key: 'Id',
    fields: {
      'Id': 'external_vendor_id',
      'Name': 'vendor_name',
      'CompanyName': 'company_name',
      'DisplayName': 'display_name',
      'PrintOnCheckName': 'print_on_check_name',
      'Active': 'is_active',
      'VendorTypeRef': 'vendor_type_id',
      'TaxIdentifier': 'tax_id',
      'AcctNum': 'account_number',
      'Vendor1099': 'is_1099_vendor',
      'CurrencyRef': 'currency_id',
      'APAccountRef': 'ap_account_id',
      'TermRef': 'payment_terms_id',
      'Balance': 'current_balance',
      'OpenBalanceDate': 'open_balance_date',
      'CreditLimit': 'credit_limit',
      'Notes': 'vendor_notes',
      'PrimaryPhone': 'primary_phone_json',
      'AlternatePhone': 'alternate_phone_json',
      'Mobile': 'mobile_phone_json',
      'Fax': 'fax_json',
      'PrimaryEmailAddr': 'primary_email_json',
      'WebAddr': 'website_json',
      'BillAddr': 'billing_address_json',
      'domain': 'qb_domain',
      'sparse': 'is_sparse',
      'SyncToken': 'sync_token',
      'MetaData': 'metadata_json'
    }
  },

  // Item/Product Object - Maps to existing products table
  'Item': {
    table_name: 'products',
    primary_key: 'Id',
    fields: {
      'Id': 'external_item_id',
      'Name': 'name',
      'Description': 'description',
      'Active': 'is_active',
      'FullyQualifiedName': 'fully_qualified_name',
      'Taxable': 'is_taxable',
      'SalesTaxIncluded': 'sales_tax_included',
      'PercentBased': 'is_percent_based',
      'UnitPrice': 'base_price',
      'Type': 'item_type',
      'IncomeAccountRef': 'income_account_id',
      'PurchaseDesc': 'purchase_description',
      'PurchaseCost': 'cost',
      'ExpenseAccountRef': 'expense_account_id',
      'COGSAccountRef': 'cogs_account_id',
      'AssetAccountRef': 'asset_account_id',
      'PrefVendorRef': 'preferred_vendor_id',
      'AvgCost': 'average_cost',
      'TrackQtyOnHand': 'track_quantity_on_hand',
      'QtyOnHand': 'quantity_on_hand',
      'QtyOnSalesOrder': 'quantity_on_sales_order',
      'QtyOnPurchaseOrder': 'quantity_on_purchase_order',
      'ReorderPoint': 'reorder_point',
      'ManPartNum': 'manufacturer_part_number',
      'Department': 'department',
      'SubItem': 'is_sub_item',
      'ParentRef': 'parent_item_id',
      'Level': 'item_level',
      'InventoryStartDate': 'inventory_start_date',
      'BuildPoint': 'build_point',
      'PrintGroupedItems': 'print_grouped_items',
      'SpecialItem': 'is_special_item',
      'SpecialItemType': 'special_item_type',
      'ItemGroupDetail': 'item_group_detail_json',
      'ItemAssemblyDetail': 'item_assembly_detail_json',
      'UOMSetRef': 'unit_of_measure_set_id',
      'SalesTaxCodeRef': 'sales_tax_code_id',
      'PurchaseTaxCodeRef': 'purchase_tax_code_id',
      'ClassRef': 'class_id',
      'Source': 'item_source',
      'TaxClassificationRef': 'tax_classification_id',
      'domain': 'qb_domain',
      'sparse': 'is_sparse',
      'SyncToken': 'sync_token',
      'MetaData': 'metadata_json'
    }
  },

  // Invoice Object - Maps to existing invoices table
  'Invoice': {
    table_name: 'invoices',
    primary_key: 'Id',
    fields: {
      'Id': 'external_invoice_id',
      'SyncToken': 'sync_token',
      'MetaData': 'metadata_json',
      'CustomField': 'custom_fields_json',
      'DocNumber': 'invoice_number',
      'TxnDate': 'invoice_date',
      'DepartmentRef': 'department_id',
      'CurrencyRef': 'currency_id',
      'ExchangeRate': 'exchange_rate',
      'PrivateNote': 'private_note',
      'LinkedTxn': 'linked_transactions_json',
      'Line': 'line_items_json',
      'TxnTaxDetail': 'tax_detail_json',
      'CustomerRef': 'customer_id',
      'CustomerMemo': 'customer_memo_json',
      'BillAddr': 'billing_address_json',
      'ShipAddr': 'shipping_address_json',
      'FreeFormAddress': 'free_form_address',
      'ShipMethodRef': 'shipping_method_id',
      'ShipDate': 'ship_date',
      'TrackingNum': 'tracking_number',
      'ClassRef': 'class_id',
      'PrintStatus': 'print_status',
      'EmailStatus': 'email_status',
      'BillEmail': 'bill_email_json',
      'BillEmailCc': 'bill_email_cc_json',
      'BillEmailBcc': 'bill_email_bcc_json',
      'DeliveryInfo': 'delivery_info_json',
      'InvoiceLink': 'invoice_link',
      'RecurDataRef': 'recurring_data_id',
      'TaxExemptionReasonId': 'tax_exemption_reason',
      'ApplyTaxAfterDiscount': 'apply_tax_after_discount',
      'HomeTotalAmt': 'home_total_amount',
      'TotalAmt': 'total_amount',
      'FinanceCharge': 'finance_charge',
      'GlobalTaxCalculation': 'global_tax_calculation',
      'AllowIPNPayment': 'allow_ipn_payment',
      'AllowOnlinePayment': 'allow_online_payment',
      'AllowOnlineCreditCardPayment': 'allow_online_credit_card_payment',
      'AllowOnlineACHPayment': 'allow_online_ach_payment',
      'DueDate': 'due_date',
      'Balance': 'balance_due',
      'DepositToAccountRef': 'deposit_to_account_id',
      'Deposit': 'deposit_amount',
      'domain': 'qb_domain'
    }
  }
};

// QuickBooks API Configuration
export const QUICKBOOKS_CONFIG = {
  // OAuth 2.0 Configuration
  auth: {
    discovery_document_url: 'https://appcenter.intuit.com/.well-known/connect-platform/.well-known/openid_connect_sandbox',
    base_url: 'https://sandbox-quickbooks.api.intuit.com', // Use https://quickbooks.api.intuit.com for production
    scopes: 'com.intuit.quickbooks.accounting',
    response_type: 'code',
    access_type: 'offline'
  },
  
  // API Endpoints
  endpoints: {
    customers: '/v3/company/{companyId}/customers',
    customer: '/v3/company/{companyId}/customer/{customerId}',
    create_customer: '/v3/company/{companyId}/customer',
    update_customer: '/v3/company/{companyId}/customer',
    
    vendors: '/v3/company/{companyId}/vendors',
    vendor: '/v3/company/{companyId}/vendor/{vendorId}',
    create_vendor: '/v3/company/{companyId}/vendor',
    
    items: '/v3/company/{companyId}/items',
    item: '/v3/company/{companyId}/item/{itemId}',
    create_item: '/v3/company/{companyId}/item',
    
    invoices: '/v3/company/{companyId}/invoices',
    invoice: '/v3/company/{companyId}/invoice/{invoiceId}',
    create_invoice: '/v3/company/{companyId}/invoice',
    
    accounts: '/v3/company/{companyId}/accounts',
    account: '/v3/company/{companyId}/account/{accountId}',
    
    companyinfo: '/v3/company/{companyId}/companyinfo/{companyId}'
  },
  
  // Common Query Parameters
  query_defaults: {
    maxresults: 1000,
    startposition: 1,
    orderby: 'MetaData.LastUpdatedTime DESC'
  }
};

// Type for QuickBooks mapping structure
type QBMapping = {
  table_name: string;
  primary_key: string;
  fields: Record<string, string>;
};

type QBMappings = Record<string, QBMapping>;

// Helper function to transform QuickBooks data to Printyx format
export function transformQuickBooksData(objectType: string, qbData: any): any {
  const mappings = QUICKBOOKS_FIELD_MAPPINGS as QBMappings;
  const mapping = mappings[objectType];
  if (!mapping) {
    throw new Error(`No mapping found for QuickBooks object type: ${objectType}`);
  }

  const transformed: any = {};
  
  // Map each field according to the mapping
  for (const [qbField, printixField] of Object.entries(mapping.fields)) {
    if (qbData[qbField] !== undefined) {
      // Handle complex objects (addresses, phone numbers, etc.)
      if (typeof qbData[qbField] === 'object' && printixField.endsWith('_json')) {
        transformed[printixField] = JSON.stringify(qbData[qbField]);
      } else if (qbField.endsWith('Ref') && qbData[qbField]?.value) {
        // Handle reference objects
        transformed[printixField] = qbData[qbField].value;
      } else {
        transformed[printixField] = qbData[qbField];
      }
    }
  }
  
  return transformed;
}

// Helper function to transform Printyx data to QuickBooks format
export function transformPrintyxData(objectType: string, printyxData: any): any {
  const mappings = QUICKBOOKS_FIELD_MAPPINGS as QBMappings;
  const mapping = mappings[objectType];
  if (!mapping) {
    throw new Error(`No mapping found for QuickBooks object type: ${objectType}`);
  }

  const transformed: any = {};
  
  // Reverse map from Printyx to QuickBooks format
  for (const [qbField, printixField] of Object.entries(mapping.fields)) {
    if (printyxData[printixField] !== undefined) {
      // Handle JSON fields
      if (printixField.endsWith('_json') && typeof printyxData[printixField] === 'string') {
        try {
          transformed[qbField] = JSON.parse(printyxData[printixField]);
        } catch {
          transformed[qbField] = printyxData[printixField];
        }
      } else if (qbField.endsWith('Ref') && printyxData[printixField]) {
        // Handle reference objects
        transformed[qbField] = { value: printyxData[printixField] };
      } else {
        transformed[qbField] = printyxData[printixField];
      }
    }
  }
  
  return transformed;
}

// QuickBooks webhook event types
export const QUICKBOOKS_WEBHOOK_EVENTS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  MERGE: 'MERGE',
  VOID: 'VOID'
};

// Supported QuickBooks entities for synchronization
export const SUPPORTED_QB_ENTITIES = [
  'Customer',
  'Vendor', 
  'Item',
  'Invoice',
  'Bill',
  'Payment',
  'Account',
  'Employee'
];
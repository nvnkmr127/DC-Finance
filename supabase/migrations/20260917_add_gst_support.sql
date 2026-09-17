-- Migration: Add GST Tax Invoice Support
-- Run this in your Supabase SQL Editor if you are deploying to production.

-- 1. Add GST fields to Settings
ALTER TABLE settings 
  ADD COLUMN IF NOT EXISTS company_gstin text,
  ADD COLUMN IF NOT EXISTS company_state text DEFAULT 'Telangana',
  ADD COLUMN IF NOT EXISTS company_address text,
  ADD COLUMN IF NOT EXISTS company_pan text;

-- 2. Add GST fields to Clients
ALTER TABLE clients 
  ADD COLUMN IF NOT EXISTS gstin text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS address text;

-- 3. Add GST fields to Invoices
ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS is_gst_invoice boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_tax_inclusive boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hsn_sac text DEFAULT '998314',
  ADD COLUMN IF NOT EXISTS gst_rate numeric(5,2) DEFAULT 18.00,
  ADD COLUMN IF NOT EXISTS tax_type text DEFAULT 'cgst_sgst',
  ADD COLUMN IF NOT EXISTS reverse_charge boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS subtotal numeric(12,2),
  ADD COLUMN IF NOT EXISTS tax_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS grand_total numeric(12,2);

-- 4. Re-create invoice_summary view to include GST columns & financial totals
CREATE OR REPLACE VIEW invoice_summary AS
SELECT
  i.id,
  i.invoice_number,
  i.client_id,
  c.name AS client_name,
  c.company AS client_company,
  c.gstin AS client_gstin,
  c.state AS client_state,
  c.address AS client_address,
  i.issue_date,
  i.due_date,
  i.status,
  i.notes,
  i.is_gst_invoice,
  i.is_tax_inclusive,
  i.hsn_sac,
  i.gst_rate,
  i.tax_type,
  i.reverse_charge,
  COALESCE(i.subtotal, items_agg.calculated_subtotal, 0) AS subtotal,
  COALESCE(i.tax_amount, 
    CASE WHEN i.is_gst_invoice THEN ROUND((COALESCE(i.subtotal, items_agg.calculated_subtotal, 0) * (COALESCE(i.gst_rate, 18) / 100)), 2) ELSE 0 END
  ) AS tax_amount,
  COALESCE(i.grand_total, 
    COALESCE(i.subtotal, items_agg.calculated_subtotal, 0) + 
    CASE WHEN i.is_gst_invoice THEN ROUND((COALESCE(i.subtotal, items_agg.calculated_subtotal, 0) * (COALESCE(i.gst_rate, 18) / 100)), 2) ELSE 0 END
  ) AS total,
  COALESCE(p_agg.paid_amount, 0) AS paid,
  (
    COALESCE(i.grand_total, 
      COALESCE(i.subtotal, items_agg.calculated_subtotal, 0) + 
      CASE WHEN i.is_gst_invoice THEN ROUND((COALESCE(i.subtotal, items_agg.calculated_subtotal, 0) * (COALESCE(i.gst_rate, 18) / 100)), 2) ELSE 0 END
    ) - COALESCE(p_agg.paid_amount, 0)
  ) AS balance,
  CASE
    WHEN i.status = 'cancelled' THEN 'cancelled'
    WHEN COALESCE(p_agg.paid_amount, 0) >= (
      COALESCE(i.grand_total, 
        COALESCE(i.subtotal, items_agg.calculated_subtotal, 0) + 
        CASE WHEN i.is_gst_invoice THEN ROUND((COALESCE(i.subtotal, items_agg.calculated_subtotal, 0) * (COALESCE(i.gst_rate, 18) / 100)), 2) ELSE 0 END
      )
    ) AND (
      COALESCE(i.grand_total, 
        COALESCE(i.subtotal, items_agg.calculated_subtotal, 0) + 
        CASE WHEN i.is_gst_invoice THEN ROUND((COALESCE(i.subtotal, items_agg.calculated_subtotal, 0) * (COALESCE(i.gst_rate, 18) / 100)), 2) ELSE 0 END
      )
    ) > 0 THEN 'paid'
    WHEN COALESCE(p_agg.paid_amount, 0) > 0 THEN 'partial'
    ELSE i.status
  END AS display_status,
  i.last_reminded_at,
  i.created_at
FROM invoices i
JOIN clients c ON c.id = i.client_id
LEFT JOIN (
  SELECT invoice_id, SUM(quantity * unit_price) AS calculated_subtotal
  FROM invoice_items
  GROUP BY invoice_id
) items_agg ON items_agg.invoice_id = i.id
LEFT JOIN (
  SELECT invoice_id, SUM(amount) AS paid_amount
  FROM payments
  WHERE invoice_id IS NOT NULL
  GROUP BY invoice_id
) p_agg ON p_agg.invoice_id = i.id;

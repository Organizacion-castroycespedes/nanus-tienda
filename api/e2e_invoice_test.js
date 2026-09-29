const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  host: process.env.DB_HOST || 'host.docker.internal',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_DATABASE || 'manus_tienda_qa',
  user: process.env.DB_USERNAME || 'manus_user',
  password: process.env.DB_PASSWORD || 'e006ef39-3ab7-46c5-b9f5-be55596df5e9'
});

async function main() {
  const tenantId = '00000000-0000-0000-0000-000000000001';

  // 1. Get branch, terminal, product, payment method, customer
  const branchRes = await pool.query("SELECT id FROM tenant_branches WHERE tenant_id = $1 LIMIT 1", [tenantId]);
  const branchId = branchRes.rows[0].id;

  const terminalId = '693921eb-d28d-4c1b-af17-087b589c6467';

  const prodRes = await pool.query("SELECT id, name, price, tax_id FROM products WHERE tenant_id = $1 AND tax_id = '20000000-0000-0000-0000-000000000001' AND is_active = true LIMIT 1", [tenantId]);
  const product = prodRes.rows[0];

  const payRes = await pool.query("SELECT id FROM payment_methods WHERE tenant_id = $1 AND active = true LIMIT 1", [tenantId]);
  const paymentMethodId = payRes.rows[0].id;

  const customerId = '40000000-0000-0000-0000-000000000002';
  await pool.query(
    `UPDATE customers
        SET document_type_code = '13',
            dian_identification_type = '13',
            department_code = '05',
            municipality_code = '05001',
            person_type = 'NATURAL',
            tax_regime = 'NO_RESPONSABLE',
            country_code = 'CO',
            verification_digit = NULL,
            tax_responsibilities = '["R-99-PN"]'::jsonb
      WHERE id = $1`,
    [customerId]
  );
  const custRes = await pool.query("SELECT id, name FROM customers WHERE id = $1", [customerId]);
  const customer = custRes.rows[0];

  await pool.query(
    `UPDATE products
        SET dian_standard_item_scheme_id = '999',
            dian_standard_item_code = '7701234567890'
      WHERE id = $1`,
    [product.id]
  );

  console.log('--- E2E SETUP ---');
  console.log('Branch:', branchId);
  console.log('Terminal:', terminalId);
  console.log('Product:', product);
  console.log('Customer:', customer);

  saleId = crypto.randomUUID();
  const totalAmount = parseFloat(product.price);
  const taxAmount = Math.round(totalAmount * 0.19 / 1.19 * 100) / 100;
  const subtotalAmount = totalAmount - taxAmount;

  await pool.query(
    `INSERT INTO sales (
      id, tenant_id, branch_id, terminal_id, user_id, pos_session_id, customer_id,
      status, payment_status, total, created_at
    ) VALUES ($1, $2, $3, $4, '4693e5e5-3afb-46e4-a703-eabdbd13e24b', 'cda78d5f-f269-4a26-845f-b1dd91497c74', $5, 'CONFIRMED', 'PAID', $6, NOW())`,
    [saleId, tenantId, branchId, terminalId, customer.id, totalAmount]
  );

  await pool.query(
    `INSERT INTO sale_items (
      id, tenant_id, sale_id, product_id, quantity, price, price_without_tax, tax_total, tax_amount, tax_base, subtotal, base_unit_price, final_unit_price, line_total, created_at
    ) VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $7, $6, $6, $5, $5, $5, NOW())`,
    [crypto.randomUUID(), tenantId, saleId, product.id, totalAmount, subtotalAmount, taxAmount]
  );

  await pool.query(
    `INSERT INTO payments (
      id, tenant_id, branch_id, direction, reference_type, reference_id, payment_method_id, amount, status, created_by, created_at
    ) VALUES ($1, $2, $3, 'IN', 'SALE', $4, $5, $6, 'COMPLETED', '4693e5e5-3afb-46e4-a703-eabdbd13e24b', NOW())`,
    [crypto.randomUUID(), tenantId, branchId, saleId, paymentMethodId, totalAmount]
  );



  console.log(`\n--- SALE TARGET: ${saleId} ---`);

  // 3. Trigger electronic billing via HTTP POST to manus-api (/api/sales/:id/electronic-billing)
  const http = require('http');
  const startTime = Date.now();

  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    {
      sub: '4693e5e5-3afb-46e4-a703-eabdbd13e24b',
      tenant_id: tenantId,
      tenant_slug: 'manustienda-platform-s-a-s',
      roles: ['SUPER_ADMIN', 'USER'],
      session_id: '803f99f0-9ca4-49d9-9737-e84dfb128665'
    },
    process.env.JWT_SECRET || 'local-docker-manus-dev',
    { expiresIn: '1h' }
  );

  const postData = JSON.stringify({});
  const reqOptions = {
    hostname: '127.0.0.1',
    port: 4020,
    path: `/api/sales/${saleId}/electronic-billing`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': `Bearer ${token}`
    }
  };

  await new Promise((resolve, reject) => {
    const req = http.request(reqOptions, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        console.log('HTTP Billing Request Status:', res.statusCode);
        console.log('HTTP Billing Request Response:', responseBody);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });

  // 4. Poll electronic_documents table to verify DIAN response
  console.log('\n--- POLLING DIAN RESPONSE ---');
  let acceptedDoc = null;
  for (let attempt = 1; attempt <= 10; attempt++) {
    const docRes = await pool.query(
      `SELECT id, status, provider_status, processing_stage, provider_document_id, full_number, cufe, accepted_at, last_error_message
       FROM electronic_documents
       WHERE tenant_id = $1 AND source_type = 'SALE' AND source_id = $2`,
      [tenantId, saleId]
    );

    const doc = docRes.rows[0];
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Attempt ${attempt} - ${elapsed}s] Document status: ${doc?.status || 'NONE'} | Stage: ${doc?.processing_stage || 'N/A'} | Number: ${doc?.full_number || 'N/A'}`);

    if (doc && doc.status === 'ACCEPTED') {
      acceptedDoc = doc;
      break;
    }

    if (doc && (doc.status === 'REJECTED' || doc.status === 'TECHNICAL_ERROR')) {
      console.error('Document Error:', doc.last_error_message);
      break;
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n==================================================');
  if (acceptedDoc) {
    console.log(`✅ E2E TEST PASSED IN ${totalTime} SECONDS!`);
    console.log('Document ID:', acceptedDoc.id);
    console.log('Document Number:', acceptedDoc.full_number);
    console.log('CUFE:', acceptedDoc.cufe);
    console.log('DIAN Accepted At:', acceptedDoc.accepted_at);
  } else {
    console.log(`❌ E2E TEST DID NOT REACH ACCEPTED IN ${totalTime}s`);
  }
  console.log('==================================================\n');

  await pool.end();
}

main().catch(err => {
  console.error('Fatal E2E Test Error:', err);
  process.exit(1);
});

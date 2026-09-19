/**
 * Bench DB local: chạy bộ migrations packages/database/zenicloud/*.sql theo thứ tự
 * tên file lên một Postgres local (Docker), lặp N vòng để chứng minh idempotent,
 * rồi sanity-count. Dùng cho DoD masterspec (test thật trước khi db-setup prod).
 *
 *   node scripts/bench-db.cjs [--url postgresql://postgres:bench@localhost:55432/zeni_ipo] [--rounds 2]
 */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.join(__dirname, '..');
const requireWeb = createRequire(path.join(root, 'apps', 'web', 'package.json'));
const { Pool } = requireWeb('pg');

const args = process.argv.slice(2);
function argOf(flag, dflt) {
  const i = args.indexOf(flag);
  return i > -1 && args[i + 1] ? args[i + 1] : dflt;
}
const url = argOf('--url', 'postgresql://postgres:bench@localhost:55432/zeni_ipo');
const rounds = Number(argOf('--rounds', '2'));
const dir = path.join(root, 'packages', 'database', 'zenicloud');

async function main() {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  console.log(`bench-db: ${files.length} file SQL · ${rounds} vòng · ${url.replace(/:[^:@/]+@/, ':***@')}`);
  const pool = new Pool({ connectionString: url, max: 2 });
  let failed = 0;

  for (let r = 1; r <= rounds; r++) {
    console.log(`\n=== VÒNG ${r} ===`);
    for (const f of files) {
      const t0 = Date.now();
      try {
        await pool.query(fs.readFileSync(path.join(dir, f), 'utf8'));
        console.log(`  OK  ${f} (${Date.now() - t0}ms)`);
      } catch (e) {
        failed++;
        console.log(`  FAIL ${f}: ${e.message.slice(0, 200)}`);
        console.log('  → DỪNG vòng (thứ tự bắt buộc).');
        break;
      }
    }
  }

  console.log('\n=== SANITY ===');
  for (const t of ['agent_catalog', 'modules_catalog', 'tenants', 'plan_coa_lines', 'ipo_benchmarks']) {
    try {
      const res = await pool.query(`SELECT count(*)::int AS n FROM public.${t}`);
      console.log(`  ${t} = ${res.rows[0].n}`);
    } catch (e) {
      console.log(`  ${t} ERR: ${e.message.slice(0, 100)}`);
    }
  }
  const roles = await pool.query(
    "SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') ORDER BY 1",
  );
  console.log(`  roles: ${roles.rows.map((r) => r.rolname).join(', ') || 'THIẾU'}`);
  const uid = await pool.query('SELECT auth.uid() AS uid');
  console.log(`  auth.uid() khi chưa set GUC = ${uid.rows[0].uid === null ? 'NULL (đúng)' : uid.rows[0].uid}`);

  await pool.end();
  console.log(failed === 0 ? '\nBENCH PASS' : `\nBENCH FAIL (${failed} lỗi)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('bench-db fatal:', e.message);
  process.exit(1);
});

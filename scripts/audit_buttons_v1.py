#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KIỂM KÊ CƠ HỌC TOÀN BỘ NÚT BẤM — ZENI-IPO (hệ V1)

Vì sao cần: giao diện V1 là `lib/v1/source.html` (bản dựng TĨNH: có sẵn nút +
số liệu bịa). Thứ làm cho nút sống là `components/v1-data-bind.tsx` (binder):
nó thay số thật và gắn hành động. Nút nào binder KHÔNG chạm tới = nút trang trí.

Script này đo đúng điều đó, không đoán:
  1. Tách 44 trang trong source.html, đếm phần tử tương tác từng trang
  2. Đọc binder: trang nào có binder, binder gắn được bao nhiêu nút, gọi API nào
  3. Đối chiếu endpoint binder gọi với route thật trong app/api
  4. Quét trang React trong app/ (ngoài hệ V1)

Chạy:  python scripts/audit_buttons_v1.py            (bảng tổng)
       python scripts/audit_buttons_v1.py --page pnl (chi tiết 1 trang)
       python scripts/audit_buttons_v1.py --json     (máy đọc)
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, 'apps', 'web', 'src')
SRC_HTML = os.path.join(WEB, 'lib', 'v1', 'source.html')
BINDER = os.path.join(WEB, 'components', 'v1-data-bind.tsx')
API_DIR = os.path.join(WEB, 'app', 'api')
APP_DIR = os.path.join(WEB, 'app')


def read(p):
    with open(p, encoding='utf-8', errors='replace') as f:
        return f.read()


# ── 1 · Tách trang trong source.html ────────────────────────────────────────
def split_pages(html):
    """Trả [(page_id, line_start, block_text)] theo <div class="page..." id="page-X">"""
    out = []
    marks = [(m.start(), m.group(1)) for m in
             re.finditer(r'<div class="page[^"]*"\s+id="page-([a-z0-9\-]+)"', html)]
    for i, (pos, pid) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(html)
        line = html.count('\n', 0, pos) + 1
        out.append((pid, line, html[pos:end]))
    return out


def count_elements(block):
    """Đếm phần tử tương tác trong 1 khối trang."""
    return {
        'button': len(re.findall(r'<button', block)),
        'onclick': len(re.findall(r'onclick=', block)),
        'link': len(re.findall(r'<a\s[^>]*href=', block)),
        'input': len(re.findall(r'<input', block)),
        'select': len(re.findall(r'<select', block)),
        'textarea': len(re.findall(r'<textarea', block)),
        # ô dữ liệu cứng: số có đơn vị tiền/% nằm trong bảng hoặc thẻ KPI
        'hardcoded': len(re.findall(r'>[\s$₫]*[\d.,]+\s*(?:[KMB]|%|₫|tr|tỷ)\b', block)),
        'table_rows': len(re.findall(r'<tr', block)),
    }


# ── 2 · Đọc binder ──────────────────────────────────────────────────────────
def parse_binder(txt):
    """
    Trả {page_id: {...}} — mỗi trang binder làm gì.
    Nhận diện khối binder bằng mốc 'page-xxx' xuất hiện trong mã (map endpoint
    hoặc nhánh xử lý), rồi đo phạm vi tới mốc kế tiếp.
    """
    # bảng endpoint khai báo đầu file:  'page-pnl': '/api/financials',
    endpoints = dict(re.findall(r"'page-([a-z0-9\-]+)'\s*:\s*'(/api[^']*)'", txt))

    # THÂN PATCHER: PAGE_PATCHERS = { 'page-xxx': (raw) => { ... }, 'page-yyy': ... }
    # Ranh giới = từ khoá này tới khoá kế tiếp (chính xác, không đoán).
    marks = [(m.start(), m.group(1)) for m in
             re.finditer(r"^\s{2}'page-([a-z0-9\-]+)'\s*:\s*(?:async\s*)?\(", txt, re.M)]
    blocks = {}
    lines_of = {}
    for i, (pos, pid) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(txt)
        blocks.setdefault(pid, '')
        blocks[pid] += txt[pos:end]
        lines_of.setdefault(pid, txt.count('\n', 0, pos) + 1)

    out = {}
    for pid in set(list(endpoints.keys()) + list(blocks.keys())):
        b = blocks.get(pid, '')
        line = lines_of.get(pid)
        out[pid] = {
            'endpoint': endpoints.get(pid),
            'binder_line': line,
            'has_block': bool(b),
            'block_len': len(b.splitlines()),
            # nút MỚI do binder thêm vào (không có trong source.html)
            'added_buttons': re.findall(
                r"ensureHeaderButton\(\s*[^,]+,\s*'[^']*'\s*,\s*'([^']*)'", b),
            # gắn hành động vào phần tử CÓ SẴN
            'wired': len(re.findall(r'wireEach\(|wireClick\(|wireButtonByText\(', b)),
            'wire_calls': re.findall(r"wireEach\([^,]+,\s*'([^']+)'", b),
            # API binder thực sự gọi
            'api_calls': sorted(set(re.findall(r"apiSend\(\s*[`'\"]([^`'\"]+)[`'\"]", b))),
            'methods': sorted(set(re.findall(
                r"apiSend\(\s*[`'\"][^`'\"]+[`'\"]\s*,\s*'([A-Z]+)'", b))),
            'opens_form': len(re.findall(r'openFormModal\(', b)),
        }
    return out


# ── 3 · Route API thật ──────────────────────────────────────────────────────
def scan_api_routes():
    routes = {}
    for dirpath, _dirs, files in os.walk(API_DIR):
        if 'route.ts' not in files:
            continue
        rel = os.path.relpath(dirpath, API_DIR).replace(os.sep, '/')
        path = '/api' + ('' if rel == '.' else '/' + rel)
        body = read(os.path.join(dirpath, 'route.ts'))
        methods = sorted(set(re.findall(r'export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)', body)))
        routes[path] = {
            'methods': methods,
            'lines': len(body.splitlines()),
            # dấu hiệu route chỉ là vỏ
            'stub': bool(re.search(r'TODO|not implemented|chưa triển khai', body, re.I)),
        }
    return routes


def scan_app_pages():
    pages = []
    for dirpath, _dirs, files in os.walk(APP_DIR):
        if 'page.tsx' not in files or os.sep + 'api' + os.sep in dirpath + os.sep:
            continue
        rel = os.path.relpath(dirpath, APP_DIR).replace(os.sep, '/')
        body = read(os.path.join(dirpath, 'page.tsx'))
        pages.append({
            'route': '/' + re.sub(r'\((\w+)\)/?', '', rel).strip('/'),
            'lines': len(body.splitlines()),
            'buttons': len(re.findall(r'<button', body)),
            'onclick': len(re.findall(r'onClick=', body)),
            'fetches': len(re.findall(r'fetch\(|apiSend\(', body)),
            'uses_v1': 'V1Page' in body or 'v1/Page' in body or 'getScript' in body,
        })
    return sorted(pages, key=lambda p: -p['buttons'])


# ── 4 · Chấm & in ───────────────────────────────────────────────────────────
def classify(el, b):
    """Xếp hạng trang: CRUD thật / chỉ đọc số / VỎ (không binder)."""
    if not b:
        return 'VO'                      # không binder: toàn nút trang trí
    if b['added_buttons'] or b['opens_form'] or any(
            m in b['methods'] for m in ('POST', 'PUT', 'PATCH', 'DELETE')):
        return 'CRUD'                    # ghi được dữ liệu
    if b['endpoint'] or b['api_calls']:
        return 'DOC'                     # chỉ đọc, nút cũ vẫn trang trí
    return 'VO'


def main():
    html = read(SRC_HTML)
    binder_txt = read(BINDER)
    pages = split_pages(html)
    binders = parse_binder(binder_txt)
    routes = scan_api_routes()

    as_json = '--json' in sys.argv
    only = None
    if '--page' in sys.argv:
        only = sys.argv[sys.argv.index('--page') + 1].replace('page-', '')

    rows = []
    for pid, line, block in pages:
        el = count_elements(block)
        b = binders.get(pid)
        interactive = el['button'] + el['input'] + el['select'] + el['textarea'] + el['link']
        rows.append({
            'page': pid,
            'html_line': line,
            'interactive': interactive,
            **el,
            'binder_line': b['binder_line'] if b else None,
            'endpoint': b['endpoint'] if b else None,
            'added_buttons': b['added_buttons'] if b else [],
            'wired': b['wired'] if b else 0,
            'methods': b['methods'] if b else [],
            'forms': b['opens_form'] if b else 0,
            'grade': classify(el, b),
        })

    if only:
        for r in rows:
            if r['page'] == only:
                print(json.dumps(r, ensure_ascii=False, indent=2))
                blk = [b for p, _l, b in pages if p == only][0]
                print('\n--- NÚT TRONG source.html ---')
                for m in re.finditer(r'<button[^>]*>(.*?)</button>', blk, re.S):
                    label = re.sub(r'<[^>]+>', '', m.group(1)).strip()[:60]
                    ln = r['html_line'] + blk.count('\n', 0, m.start())
                    print(f'  dòng {ln}: {label}')
                return 0
        print('Không có trang:', only)
        return 1

    if as_json:
        print(json.dumps({'pages': rows, 'routes': routes}, ensure_ascii=False, indent=2))
        return 0

    # ── bảng chính ──
    print('=' * 104)
    print('KIỂM KÊ NÚT BẤM — ZENI-IPO (hệ V1)')
    print('=' * 104)
    print(f'{"TRANG":<16}{"DÒNG":>6}{"TƯƠNG TÁC":>10}{"NÚT":>5}{"Ô SỐ CỨNG":>11}'
          f'{"BINDER":>8}{"NÚT THÊM":>9}{"GẮN":>5}{"GHI":>5}  {"HẠNG":<6}{"ENDPOINT"}')
    print('-' * 104)
    for r in sorted(rows, key=lambda x: -x['interactive']):
        writes = ','.join(m for m in r['methods'] if m != 'GET') or '—'
        print(f'{r["page"]:<16}{r["html_line"]:>6}{r["interactive"]:>10}{r["button"]:>5}'
              f'{r["hardcoded"]:>11}{(r["binder_line"] or "—"):>8}'
              f'{len(r["added_buttons"]):>9}{r["wired"]:>5}{writes:>5}  '
              f'{r["grade"]:<6}{r["endpoint"] or "—"}')
    print('-' * 104)

    tot_int = sum(r['interactive'] for r in rows)
    tot_btn = sum(r['button'] for r in rows)
    tot_hard = sum(r['hardcoded'] for r in rows)
    tot_added = sum(len(r['added_buttons']) for r in rows)
    tot_wired = sum(r['wired'] for r in rows)
    g = {}
    for r in rows:
        g[r['grade']] = g.get(r['grade'], 0) + 1

    print(f'{"TỔNG":<16}{"":>6}{tot_int:>10}{tot_btn:>5}{tot_hard:>11}'
          f'{"":>8}{tot_added:>9}{tot_wired:>5}')
    print()
    print(f'  {len(rows)} trang V1 · {tot_int} phần tử tương tác · {tot_btn} nút trong bản dựng tĩnh')
    print(f'  Hạng trang: CRUD (ghi được) {g.get("CRUD",0)} · DOC (chỉ đọc số) {g.get("DOC",0)} · '
          f'VỎ (không binder) {g.get("VO",0)}')
    print(f'  Binder thêm mới {tot_added} nút · gắn hành động vào {tot_wired} nhóm phần tử có sẵn')
    print(f'  Ô số liệu cứng trong bản dựng: {tot_hard}')

    # trang vỏ = mọi nút là trang trí
    vo = [r for r in rows if r['grade'] == 'VO']
    if vo:
        print()
        print(f'  ⚠ {len(vo)} TRANG KHÔNG CÓ BINDER — toàn bộ '
              f'{sum(r["interactive"] for r in vo)} phần tử là trang trí:')
        for r in sorted(vo, key=lambda x: -x['interactive']):
            print(f'      page-{r["page"]:<14} {r["interactive"]:>3} phần tử '
                  f'({r["button"]} nút) · dòng {r["html_line"]}')

    # đối chiếu endpoint binder gọi vs route thật
    print()
    print('=' * 104)
    print('ĐỐI CHIẾU ENDPOINT BINDER GỌI ↔ ROUTE THẬT')
    print('=' * 104)
    missing = []
    for r in rows:
        ep = (r['endpoint'] or '').split('?')[0]
        if ep and ep not in routes:
            missing.append((r['page'], ep))
    print(f'  Route API có thật: {len(routes)}')
    used = {(r["endpoint"] or "").split("?")[0] for r in rows if r['endpoint']}
    print(f'  Endpoint binder khai báo: {len(used)}')
    print(f'  Route KHÔNG được binder nào gọi: {len(set(routes) - used)}')
    if missing:
        print(f'  ⚠ BINDER GỌI ENDPOINT KHÔNG TỒN TẠI ({len(missing)}):')
        for pid, ep in missing:
            print(f'      page-{pid} → {ep}')
    else:
        print('  ✓ Mọi endpoint binder khai báo đều có route thật')

    # trang React ngoài hệ V1
    app_pages = scan_app_pages()
    print()
    print('=' * 104)
    print('TRANG REACT (ngoài hệ V1)')
    print('=' * 104)
    print(f'  Tổng {len(app_pages)} trang · '
          f'{sum(p["buttons"] for p in app_pages)} nút · '
          f'{sum(p["fetches"] for p in app_pages)} lời gọi API')
    print(f'{"ROUTE":<28}{"DÒNG":>7}{"NÚT":>5}{"onClick":>8}{"GỌI API":>8}  V1?')
    for p in app_pages[:20]:
        if p['buttons'] or p['fetches']:
            print(f'{p["route"] or "/":<28}{p["lines"]:>7}{p["buttons"]:>5}'
                  f'{p["onclick"]:>8}{p["fetches"]:>8}  {"có" if p["uses_v1"] else ""}')
    return 0


if __name__ == '__main__':
    sys.exit(main())

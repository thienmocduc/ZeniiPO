import { describe, it, expect } from 'vitest'
import { _chiDungChoTest } from './v1-interactivity'

const { transformScript } = _chiDungChoTest

/**
 * Canh chỗ dữ liệu MINH HOẠ có thể ghi đè dữ liệu THẬT.
 *
 * `setRole()` trong `source.html` gọi thẳng bốn hàm dựng. Ba trong bốn hàm đó
 * dựng lại DOM từ dữ liệu cứng (`OKR_TREE`, `TASKS_BY_ROLE`) trên đúng những
 * trang đã có hàm vá dữ liệu thật — nên mỗi lần đổi vai là một lần dữ liệu thật
 * bị ghi đè. Hàm thứ tư (`renderDashboard`) PHẢI còn, vì `page-dash` không có
 * hàm vá nào.
 *
 * ⚠ Test này chạy thật đoạn script đã biến đổi bằng `new Function`, không chỉ so
 * chuỗi — so chuỗi thì một dấu ngoặc lệch vẫn xanh.
 */
describe('Biến đổi script v1 — dữ liệu minh hoạ không được ghi đè dữ liệu thật', () => {
  /** Script giả, giữ đúng hình dạng phần quan trọng của `source.html`. */
  const scriptGoc = `
var currentRole = 'chr';
var daGoi = { okr: 0, tasks: 0, agents: 0, dash: 0 };
function renderOKRPage(role) { daGoi.okr++; }
function renderTasksPage(role) { daGoi.tasks++; }
function filterAgentsPage(role) { daGoi.agents++; }
function renderDashboard(role) { daGoi.dash++; }
function setRole(role) {
  currentRole = role;
  renderDashboard(role);
  renderOKRPage(role);
  renderTasksPage(role);
  filterAgentsPage(role);
}
window.daGoi = daGoi;
`

  const chay = (s: string) => {
    const w = {} as Record<string, unknown>
    // eslint-disable-next-line no-new-func
    new Function('window', transformScript(s)).call(w, w)
    ;(w.setRole as (r: string) => void)('cfo')
    return w.daGoi as { okr: number; tasks: number; agents: number; dash: number }
  }

  it('setRole KHÔNG còn gọi được ba hàm dựng minh hoạ', () => {
    const d = chay(scriptGoc)
    expect(d.okr, 'renderOKRPage vẫn chạy ⇒ OKR_TREE cứng sẽ ghi đè cây phân rã thật').toBe(0)
    expect(d.tasks, 'renderTasksPage vẫn chạy ⇒ TASKS_BY_ROLE cứng sẽ ghi đè việc thật').toBe(0)
    expect(d.agents, 'filterAgentsPage vẫn chạy').toBe(0)
  })

  it('renderDashboard PHẢI còn chạy — page-dash không có hàm vá thật', () => {
    // Đây là nửa thứ hai của phép kiểm, và là nửa hay bị bỏ: bài học cũ là regex
    // gỡ nút SSO đã xoá luôn nút Đăng nhập, vì chỉ kiểm thứ BIẾN MẤT.
    const d = chay(scriptGoc)
    expect(d.dash, 'gỡ cả renderDashboard là làm trắng bảng điều khiển').toBe(1)
  })

  it('script vẫn chạy được, setRole vẫn đổi vai', () => {
    const w = {} as Record<string, unknown>
    // eslint-disable-next-line no-new-func
    new Function('window', transformScript(scriptGoc)).call(w, w)
    expect(typeof w.setRole).toBe('function')
    expect(() => (w.setRole as (r: string) => void)('coo')).not.toThrow()
  })

  it('không vỡ khi script KHÔNG có ba hàm đó', () => {
    // Bản `source.html` có thể đổi. Thiếu hàm thì phép gán lại phải im lặng bỏ
    // qua, không được ném lỗi làm chết mọi handler còn lại.
    const w = {} as Record<string, unknown>
    const s = `function setRole(r){ window.vai = r; }`
    // eslint-disable-next-line no-new-func
    expect(() => new Function('window', transformScript(s)).call(w, w)).not.toThrow()
    ;(w.setRole as (r: string) => void)('chr')
    expect(w.vai).toBe('chr')
  })
})

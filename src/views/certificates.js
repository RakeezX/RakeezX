import * as store from '../store.js';
import { createCertificateCenter } from '../lib/certificate-center.js';

let workspace;
let scope;
const workspaceScope = () => JSON.stringify([
  store.getActiveWorkspace(), store.activeYear()?.id, store.activeTerm()?.id,
]);

export default {
  title: () => 'شهادات التقدير',
  subtitle: () => 'اختر الطلاب، وخصّص التصميم والبيانات، ثم صدّر شهاداتهم.',
  wide: true,
  beforeRender() { workspace = null; scope = null; },
  render(params) {
    // Keep this transient editor intact through unrelated Sync/header repaints.
    // A workspace or academic-scope change starts a fresh editor.
    const nextScope = workspaceScope();
    if (!workspace || scope !== nextScope) {
      scope = nextScope;
      workspace = createCertificateCenter({ teachingId: params.teaching });
    }
    return workspace.body;
  },
  afterPaint(root) { workspace?.mount(root.querySelector('.certificate-page')); },
  onUnmount() { workspace = null; scope = null; },
};

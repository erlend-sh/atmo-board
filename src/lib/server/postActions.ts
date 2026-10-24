import { redirect, type RequestEvent } from '@sveltejs/kit';
import { api, groupApi } from './hv';
import { actionFailure } from './errors';

// Form actions every page that shows posts shares: reactions, the author's
// edit and delete, and following or muting a thread.
const md = (text: string) => ({ $type: 'dev.atmoboard.defs#markdown', text });

async function run(event: RequestEvent, fn: (form: FormData, hv: ReturnType<typeof api>) => Promise<unknown>) {
  const form = await event.request.formData();
  try {
    await fn(form, api(event.locals.viewer));
  } catch (e) { return actionFailure(e); }
}
const str = (form: FormData, k: string) => String(form.get(k) ?? '').trim();

export const postActions = {
  // Moderation goes through the group account, which signs the override and
  // records the staff member as its actor. The Lua side checks the actor.
  moderate: (e: RequestEvent) => run(e, (f) => groupApi().procedure('moderate', {
    actor: e.locals.viewer, action: str(f, 'action'), subject: str(f, 'subject'),
    toThread: str(f, 'toThread') || undefined, title: str(f, 'title') || undefined,
    reason: str(f, 'reason') || undefined,
  })),
  report: (e: RequestEvent) => run(e, (f, hv) => hv.procedure('report', {
    subject: str(f, 'subject'), reason: str(f, 'reason'), note: str(f, 'note') || undefined,
  })),
  react: (e: RequestEvent) => run(e, (f, hv) =>
    hv.procedure(f.get('op') === 'unreact' ? 'unreact' : 'react', { post: str(f, 'post'), emoji: str(f, 'emoji') })),
  edit: (e: RequestEvent) => run(e, (f, hv) => {
    const text = str(f, 'text');
    const title = str(f, 'title') || undefined;
    return hv.procedure('editPost', { key: str(f, 'key'), title, textContent: text, content: md(text) });
  }),
  delete: async (e: RequestEvent) => {
    let then = '';
    const failed = await run(e, (f, hv) => ((then = str(f, 'then')), hv.procedure('deletePost', { key: str(f, 'key') })));
    if (failed) return failed;
    if (then.startsWith('/')) redirect(303, then);
  },
  notify: (e: RequestEvent) => run(e, (f, hv) =>
    hv.procedure('setThreadNotification', { thread: str(f, 'thread'), level: str(f, 'level') })),
};

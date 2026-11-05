import { defineAction, fail } from '@agent-native/core/action';
import { z } from 'zod';

const id = z.string().uuid();
const revision = z.number().int().nonnegative();
const key = z.string().regex(/^[A-Za-z0-9_-]{12,128}$/);
const actor = ctx => ctx?.patchActor;
export function createActions(desk) {
  const action = (description, schema, run, humanOnly = false) => defineAction({
    description, schema, changeEvents: false, audit: { enabled: false },
    agentTool: !humanOnly, mcpTool: !humanOnly,
    authorize: (_args, ctx) => {
      if (!['human', 'agent'].includes(actor(ctx)) || (humanOnly && actor(ctx) !== 'human'))
        fail('A human capability is required for approval, apply and rollback.', { errorCode: 'FORBIDDEN', statusCode: 403 });
    },
    run,
  });
  return {
    inspect: action('Inspect the shared text workspace, draft hunks and receipts. Detecting baseline drift revokes approvals.', z.object({}).strict(), () => ({ files: desk.inventory(), proposals: desk.list(), receipts: desk.receipts() })),
    propose: action('Propose replacement text for an existing workspace file. Computes reviewable hunks; grants no approval.', z.object({
      path: z.string().max(80), base_sha256: z.string().regex(/^[a-f0-9]{64}$/), content: z.string().max(100_000), title: z.string().min(1).max(120).default('Proposed text change'),
    }).strict(), args => desk.propose(args)),
    review: action('A human approves or revokes exactly one hunk at a specific proposal revision.', z.object({ id, hunk_id: z.string().regex(/^[a-f0-9]{24}$/), approved: z.boolean(), expected_revision: revision }).strict(), args => desk.review(args), true),
    apply: action('A human applies only approved hunks after a fresh baseline check. Saves a durable backup and receipt first.', z.object({ id, expected_revision: revision, key }).strict(), args => desk.apply(args), true),
    rollback: action('A human restores a saved baseline only if the file still exactly matches the applied output.', z.object({ receipt_id: id, key }).strict(), args => desk.rollback(args), true),
  };
}
// This is a small local transport adapter, not Agent-Native's hosted runtime.
// Invoking the framework's wrapped run enforces its schema and authorize gates.
export async function invoke(actions, name, input, role) {
  if (!Object.hasOwn(actions, name)) throw Object.assign(new Error('Unknown action.'), { statusCode: 404, code: 'NOT_FOUND' });
  // This adapter supplies only caller identity. Framework DB audit/tracking is
  // not attached; the app keeps its own durable local receipts instead.
  return actions[name].run(input, { patchActor: role, caller: role === 'human' ? 'frontend' : 'tool' });
}

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { expect, it } from 'vitest';
import { Scope, type FixturePlan } from './phase3-negative-pg/scope.js';
import { postForm } from './phase3-negative-pg/http.js';

const load = () => JSON.parse(readFileSync(resolve(__dirname, '../../output/phase3/negative-postgres-20261105-01/fixture-plan.json'), 'utf8')) as FixturePlan;

it('validates the reviewed fresh synthetic fixture plan', () => {
  expect(new Scope(load()).plan.fixtures.map(f => f.name)).toEqual(['fail', 'cancel', 'success']);
});

it('rejects a duplicated payment or transaction identity', () => {
  const plan = load();
  plan.fixtures[1].tranId = plan.fixtures[0].tranId;
  expect(() => new Scope(plan)).toThrow('FIXTURE_COLLISION');
});

it('rejects cap increases and unauthorized captured identifiers', () => {
  const plan = load();
  plan.caps.providerDoubles++;
  expect(() => new Scope(plan)).toThrow('EXACT_PLAN_REQUIRED');
  const second = load();
  second.fixtures[0].valId = second.fixtures[2].valId;
  expect(() => new Scope(second)).toThrow('FIXTURE_SHAPE_DENIED');
});

it('counts attempts before dispatch and stops when closed or capped', () => {
  const scope = new Scope(load());
  for (let i = 0; i < scope.plan.caps.providerDoubles; i++) scope.take('providerDoubles');
  expect(() => scope.take('providerDoubles')).toThrow('RUN_SCOPE_EXCEEDED');
  scope.closed = true;
  expect(() => scope.take('bookingInserts')).toThrow('RUN_SCOPE_EXCEEDED');
});

it('runs async form middleware over an in-process HTTP stream', async () => {
  const app = express();
  app.post('/ipn', express.urlencoded({ extended: false }), async (req, res) => {
    await Promise.resolve();
    res.status(req.body.status === 'CANCELLED' ? 200 : 400).send('RECEIVED');
  });
  expect(await postForm(app, '/ipn', { status: 'CANCELLED' })).toMatchObject({ status: 200, text: 'RECEIVED' });
});

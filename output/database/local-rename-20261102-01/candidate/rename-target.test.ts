import {it,expect} from 'vitest';
import {readOnlyTarget,EXPECTED_IDENTITY} from './phase2-identity-diagnostic.js';
it('admits only renamed local restricted target',()=>{ const u=readOnlyTarget('postgresql://flywithsafe_phase2_booking_test:synthetic-only@127.0.0.1:5432/flywithsafety_local_integration');expect(EXPECTED_IDENTITY.db).toBe('flywithsafety_local_integration');expect(new URL(u).pathname).toBe('/flywithsafety_local_integration'); });
it('rejects the consumed historical physical name after cutover',()=>{expect(()=>readOnlyTarget('postgresql://flywithsafe_phase2_booking_test:synthetic-only@127.0.0.1:5432/flywithsafe_phase2_booking_integration')).toThrow('PHASE2_READONLY_WRONG_TARGET');});

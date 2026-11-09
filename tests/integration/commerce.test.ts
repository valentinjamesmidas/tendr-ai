import {describe,it,expect} from 'vitest';
import {DemoCreditLedger} from '../../packages/billing/src/index';
import {transition} from '../../packages/jobs/src/index';
describe('isolated demo financial model',()=>{
 it('deduplicates synthetic events and job completion',()=>{const ledger=new DemoCreditLedger('a');ledger.grant('a','demo:event');ledger.grant('a','demo:event');ledger.reserve('a','job');ledger.reserve('a','job');ledger.complete('a','job');ledger.complete('a','job');expect(ledger.balance('a')).toBe(0);});
 it('does not let concurrent requests reserve one credit twice',async()=>{const ledger=new DemoCreditLedger('a');ledger.grant('a','demo:event');const results=await Promise.allSettled(['1','2'].map(id=>Promise.resolve().then(()=>ledger.reserve('a',id))));expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(ledger.balance('a')).toBe(0);});
 it('releases failed processing once and rejects completion afterward',()=>{const ledger=new DemoCreditLedger('a');ledger.grant('a','demo:event');ledger.reserve('a','1');ledger.release('a','1');ledger.release('a','1');expect(ledger.balance('a')).toBe(1);expect(()=>ledger.complete('a','1')).toThrow();});
 it('rejects cross-tenant access and real-looking events',()=>{const ledger=new DemoCreditLedger('a');expect(()=>ledger.grant('b','demo:event')).toThrow('Forbidden');expect(()=>ledger.balance('b')).toThrow('Forbidden');expect(()=>ledger.grant('a','evt_real')).toThrow();});
});
describe('job lifecycle',()=>{it('forbids bypassing entitlement and reopening completed work',()=>{expect(()=>transition('created','running_rules')).toThrow();expect(()=>transition('completed','queued')).toThrow();expect(transition('verifying','review_required')).toBe('review_required');});});

/** In-memory reference model, NOT a durable ledger or public payment API. */
export class DemoCreditLedger {
  private entries: Readonly<{key:string; delta:number}>[] = [];
  private reservations = new Map<string, 'reserved'|'consumed'|'released'>();
  constructor(private readonly organizationId:string) {}
  private authorize(organizationId:string) {if(organizationId!==this.organizationId) throw new Error('Forbidden');}
  grant(organizationId:string,eventId:string) {
    this.authorize(organizationId);
    if(!eventId.startsWith('demo:')) throw new Error('Only synthetic demo events accepted');
    if(this.entries.some(e=>e.key===eventId)) return;
    this.entries.push(Object.freeze({key:eventId,delta:1}));
  }
  balance(organizationId:string) {
    this.authorize(organizationId);
    return this.entries.reduce((sum,e)=>sum+e.delta,0)-[...this.reservations.values()].filter(s=>s==='reserved').length;
  }
  reserve(organizationId:string,auditId:string) {
    this.authorize(organizationId);
    const state=this.reservations.get(auditId);
    if(state==='reserved'||state==='consumed') return;
    if(state==='released') throw new Error('Use a new audit ID after release');
    if(this.balance(organizationId)<1) throw new Error('Insufficient demo credit');
    this.reservations.set(auditId,'reserved');
  }
  complete(organizationId:string,auditId:string) {
    this.authorize(organizationId);
    const state=this.reservations.get(auditId);
    if(state==='consumed') return;
    if(state!=='reserved') throw new Error('No active reservation');
    this.entries.push(Object.freeze({key:`consume:${auditId}`,delta:-1}));
    this.reservations.set(auditId,'consumed');
  }
  release(organizationId:string,auditId:string) {
    this.authorize(organizationId);
    const state=this.reservations.get(auditId);
    if(state==='released') return;
    if(state!=='reserved') throw new Error('No active reservation');
    this.reservations.set(auditId,'released');
  }
}

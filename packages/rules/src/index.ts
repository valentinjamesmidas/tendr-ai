export interface ExposureInput { valueMinor:number; penaltyBps:number; retentionBps:number; days:number }
function integer(value:number,name:string,max=Number.MAX_SAFE_INTEGER):bigint {
 if(!Number.isSafeInteger(value)||value<0||value>max) throw new RangeError(`${name}: expected a non-negative safe integer up to ${max}`);
 return BigInt(value);
}
function safeNumber(value:bigint):number {
 if(value>BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Financial result exceeds safe integer range');
 return Number(value);
}
// Half-up rounding to haléře, then daily penalty multiplied by scenario days.
export function calculateExposure(input:ExposureInput) {
 const value=integer(input.valueMinor,'valueMinor');
 const penalty=integer(input.penaltyBps,'penaltyBps',10000);
 const retention=integer(input.retentionBps,'retentionBps',10000);
 const days=integer(input.days,'days',36500);
 const daily=(value*penalty+5000n)/10000n;
 return {dailyPenaltyMinor:safeNumber(daily),scenarioDays:input.days,scenarioPenaltyMinor:safeNumber(daily*days),retentionMinor:safeNumber((value*retention+5000n)/10000n)};
}
export function formatMoney(minor:number):string {
 integer(minor,'minor');
 return new Intl.NumberFormat('cs-CZ',{style:'currency',currency:'CZK',minimumFractionDigits:2,maximumFractionDigits:2}).format(minor/100);
}

import { z } from 'zod';
export const referenceSchema = z.string().regex(/^N006\/\d{2}\/V\d{8}$/);
export const documentSchema = z.object({id:z.string(), version:z.string(), name:z.string(), content:z.string(), locator:z.string()});
export const evidenceSchema = z.object({documentId:z.string(),version:z.string(),locator:z.string(),quote:z.string()});
export const findingSchema = z.object({id:z.string(),title:z.string(),category:z.enum(['financial','legal','technical','chronological','qualification','conflict']),severity:z.enum(['critical','high','medium','low']),explanation:z.string(),action:z.string(),evidence:z.array(evidenceSchema).min(1),kind:z.enum(['source_fact','calculation','assessment'])});
export const tenderSchema = z.object({reference:referenceSchema,title:z.string(),authority:z.string(),sector:z.enum(['construction','it']),valueMinor:z.number().int().nonnegative(),deadline:z.string(),synthetic:z.literal(true),documents:z.array(documentSchema),penaltyBps:z.number().int().nonnegative(),retentionBps:z.number().int().nonnegative(),qualification:z.array(z.object({id:z.string(),requirement:z.string(),condition:z.string(),documentId:z.string(),status:z.literal('missing_evidence')}))});
export type Tender = z.infer<typeof tenderSchema>;
export type SourceDocument = z.infer<typeof documentSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type JobState = 'created'|'awaiting_entitlement'|'queued'|'fetching_metadata'|'downloading_documents'|'extracting_documents'|'running_rules'|'running_ai'|'verifying'|'generating_package'|'completed'|'review_required'|'failed'|'cancelled';
export interface AuditReport { id:string; reference:string; createdAt:string; documentSetHash:string; ruleVersion:string; provider:'mock'; model:'deterministic-fixture'; findings:Finding[]; verification:{passed:number;total:number;deliverable:boolean}; calculations:{dailyPenaltyMinor:number;scenarioDays:number;scenarioPenaltyMinor:number;retentionMinor:number}; verdict:'CONDITIONAL GO'|'NO-GO'; }
export interface SourceProvider { normalizeReference(input:string):string; fetchMetadata(reference:string):Promise<Tender>; listDocuments(reference:string):Promise<SourceDocument[]>; downloadDocument(reference:string,documentId:string):Promise<SourceDocument>; getSourceVersion(reference:string):Promise<string>; }
export interface AuditAIProvider { analyze(tender:Tender):Promise<Finding[]>; }

export const nenFindingCategory = z.enum(['submission','qualification','attachments','evaluation','contract','technical','conflict']);
export const nenFindingSchema = z.object({
 id:z.string(),
 category:nenFindingCategory,
 severity:findingSchema.shape.severity,
 title:z.string().min(1).max(180),
 requirement:z.string().min(1).max(1500),
 impact:z.string().min(1).max(1000),
 action:z.string().min(1).max(1000),
 evidence:z.array(evidenceSchema.extend({quote:z.string().min(12).max(450)})).min(1).max(4),
});
export type NenFinding = z.infer<typeof nenFindingSchema>;

export const nenAnalysisSchema = z.object({
 reference:referenceSchema,
 title:z.string(),
 authority:z.string().nullable(),
 checkedAt:z.iso.datetime(),
 bibliography:z.array(documentSchema.omit({content:true}).extend({fileId:z.string()})),
 files:z.array(z.object({
  id:z.string(),
  name:z.string(),
  status:z.enum(['read','partial','unreadable']),
  notes:z.array(z.string()),
 })),
 findings:z.array(nenFindingSchema),
 gaps:z.array(z.string()),
 rejectedFindings:z.number().int().nonnegative(),
});
export type NenAnalysis = z.infer<typeof nenAnalysisSchema>;
export const nenAnalysisEventSchema = z.discriminatedUnion('type',[
 z.object({type:z.literal('progress'),stage:z.enum(['locating','downloading','reading','analyzing','verifying']),detail:z.string()}),
 z.object({type:z.literal('result'),report:nenAnalysisSchema}),
 z.object({type:z.literal('error'),message:z.string()}),
]);
export type NenAnalysisEvent = z.infer<typeof nenAnalysisEventSchema>;

export const singleOfferPriceMinor = 999_900;
export const analysisCreditPriceMinor = 99_900;
export const plans = {
 pro:{name:'Pro',monthlyMinor:500_000,includedOffers:1,includedAnalyses:1},
 business:{name:'Business',monthlyMinor:2_000_000,annualMinor:20_000_000,includedAnalyses:5,extraAnalysisMinor:analysisCreditPriceMinor},
 enterprise:{name:'Enterprise'},
} as const;

export const planSelectionSchema = z.discriminatedUnion('plan',[
 z.object({plan:z.literal('pro'),billing:z.literal('monthly')}).strict(),
 z.object({plan:z.literal('business'),billing:z.enum(['monthly','annual'])}).strict(),
 z.object({plan:z.literal('enterprise'),billing:z.literal('monthly')}).strict(),
]);
export type PlanSelection = z.infer<typeof planSelectionSchema>;
export const purchaseSelectionSchema = z.union([
 planSelectionSchema,
 z.object({plan:z.literal('credit'),billing:z.literal('once')}).strict(),
 z.object({plan:z.literal('offer'),billing:z.literal('once'),reference:referenceSchema}).strict(),
]);
export type PurchaseSelection = z.infer<typeof purchaseSelectionSchema>;
export const subscriptionRequestSchema = z.object({
 requestId:z.uuid(),
 selection:purchaseSelectionSchema,
 email:z.string().trim().max(254).pipe(z.email()).transform(value=>value.toLowerCase()),
 company:z.string().trim().max(150),
}).strict();
export const subscriptionReceiptSchema = z.object({requestId:z.uuid()}).strict();
export const customerAccountSchema = z.object({customer:z.object({id:z.uuid(),email:z.email(),credits:z.number().int().nonnegative()}).nullable()});
export type CustomerAccount = NonNullable<z.infer<typeof customerAccountSchema>['customer']>;

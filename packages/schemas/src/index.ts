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

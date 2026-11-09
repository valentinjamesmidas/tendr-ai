import type {JobState} from '@tendr/schemas';
/** Shared lifecycle guard. Queue persistence and leases remain a production gate. */
const transitions:Record<JobState, readonly JobState[]>={
 created:['awaiting_entitlement','cancelled'], awaiting_entitlement:['queued','cancelled'],queued:['fetching_metadata','cancelled','failed'],fetching_metadata:['downloading_documents','failed','cancelled'],downloading_documents:['extracting_documents','failed','cancelled'],extracting_documents:['running_rules','failed','cancelled'],running_rules:['running_ai','failed','cancelled'],running_ai:['verifying','failed','cancelled'],verifying:['generating_package','review_required','failed','cancelled'],generating_package:['completed','failed','cancelled'],completed:[],review_required:[],failed:[],cancelled:[]
};
export function transition(state:JobState,next:JobState):JobState {
 if(!transitions[state].includes(next)) throw new Error(`Invalid job transition: ${state} -> ${next}`);
 return next;
}

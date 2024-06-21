/**
 * Human-readable transaction metadata
 * events: the events
 * actions: the actions
 * custom: the custom metadata defined by the developer
 */

export interface TransactionMetadata {
  events: object[];
  actions: object[];
  custom: object;
}

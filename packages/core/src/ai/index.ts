export {
  LeadAnalysisSchema,
  type AIProvider,
  type LeadAnalysis,
  type ServiceOfferingSummary,
  type OutreachTone,
  type OutreachLanguage,
  type OutreachGenerationInput,
} from "./AIProvider";
export { getAIProvider } from "./provider-factory";
export { ClaudeAIProvider } from "./providers/claude.provider";
export { MockAIProvider } from "./providers/mock.provider";
export { analyzeAndDraftForLead, type DraftGenerationOptions, type DraftGenerationResult } from "./analyze-and-draft";
export {
  renderLeadFacts,
  renderServiceCatalog,
  buildAnalysisPrompt,
  buildOutreachPrompt,
  buildFollowUpPrompt,
} from "./prompts";

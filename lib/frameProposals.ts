import type { WeddingOptions } from './weddingFrames'
export interface ProposalItem { id: string; name: string; options: WeddingOptions; overlay: string; preview: string }
export interface FrameProposal { _id: string; title: string; items: ProposalItem[]; createdAt: string; selection?: { itemId: string; selectedAt: string } }
export const PROPOSAL_COLLECTION = 'frameProposals'
export const validProposalId = (id: string) => /^[a-f0-9]{36}$/.test(id)
export const PRIVATE_LINK_HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' }

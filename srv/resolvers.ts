import cds, { Transaction } from '@sap/cds';

/**
 * Shared types
 */
export type ResolverInput = {
    ocrTextOuter: string;
    ocrTextInner?: string;
    images: string[];
    scanTimestamp: string; // ISO string
};

export type CandidateMatchSource = 'PO' | 'INBOUND' | 'MATERIAL' | 'LLM' | 'MAINT_ORDER';

export type CandidateMatch = {
    source: CandidateMatchSource;
    key: string;                // e.g. "4500001234/00010" or "MO/123456789"
    storageLocation: string;
    confidence: number;         // 0..1
    citations: string[];
    explanation?: string;
};

export type ResolverResult =
    | { status: 'RESOLVED'; decision: CandidateMatch }
    | { status: 'CANDIDATES'; candidates: CandidateMatch[] }
    | { status: 'NO_MATCH' };

/**
 * Helper functions
 */
function parseScanDate(scanTimestamp: string): Date {
    return new Date(scanTimestamp);
}

function extractMaintenanceOrderNumber(text: string): string | null {
    if (!text) return null;
    const patterns = [
        /\b(?:MO|Maint(?:enance)?\s*Order|Order)\s*[:#]?\s*(\d{6,12})\b/i,
        /\b(\d{6,12})\b/, // fallback: any 6–12 digit sequence
    ];

    for (const re of patterns) {
        const m = text.match(re);
        if (m && m[1]) {
            return m[1];
        }
    }
    return null;
}

function extractMaterialNumber(text: string): string | null {
    if (!text) return null;
    const re = /\b\d{6,18}\b/;
    const m = text.match(re);
    return m ? m[0] : null;
}

function extractQuantity(text: string): number | null {
    if (!text) return null;
    const patterns = [
        /\bQty[: ]+(\d+)\b/i,
        /\bQuantity[: ]+(\d+)\b/i,
        /\bx\s*(\d+)\b/i,
    ];

    for (const re of patterns) {
        const m = text.match(re);
        if (m && m[1]) {
            const q = Number(m[1]);
            if (!Number.isNaN(q)) return q;
        }
    }

    const fallback = text.match(/\b\d+\b/);
    if (fallback) {
        const q = Number(fallback[0]);
        if (!Number.isNaN(q)) return q;
    }

    return null;
}

function extractVendor(text: string): string | null {
    if (!text) return null;
    const m = text.match(/\bVendor[: ]+(\d{4,10})\b/i);
    if (m && m[1]) {
        return m[1];
    }
    return null;
}

function applyQuantityAndDateRules(
    candidates: any[],
    requiredQty: number,
    scanTimestamp: string
): any[] {
    const scanDate = parseScanDate(scanTimestamp);
    const maxDaysDiff = 180;

    return candidates.filter((c) => {
        const openQty = Number(c.OPEN_QTY ?? c.ORDER_QTY ?? c.DELIVERY_QTY ?? 0);
        if (Number.isNaN(openQty) || openQty < requiredQty) return false;

        const docDateStr = c.DOC_DATE || c.PO_DATE || c.INBOUND_DATE;
        if (!docDateStr) return true;

        const docDate = new Date(docDateStr);
        const diffDays = Math.abs((scanDate.getTime() - docDate.getTime()) / (1000 * 3600 * 24));
        return diffDays <= maxDaysDiff;
    });
}

function rankByInboundThenAge(candidates: any[]): any[] {
    return [...candidates].sort((a, b) => {
        const hasInbA = a.INBOUND_DELIVERY ? 1 : 0;
        const hasInbB = b.INBOUND_DELIVERY ? 1 : 0;

        if (hasInbA !== hasInbB) {
            return hasInbB - hasInbA;
        }

        const dateA = new Date(a.DOC_DATE || a.PO_DATE || a.INBOUND_DATE || 0);
        const dateB = new Date(b.DOC_DATE || b.PO_DATE || b.INBOUND_DATE || 0);
        return dateA.getTime() - dateB.getTime();
    });
}

function isClearlyBest(ranked: any[]): boolean {
    if (ranked.length < 2) return true;
    const score = (c: any) => Number(c.SCORE ?? 0);
    return score(ranked[0]) >= score(ranked[1]) + 0.3;
}

function computeDeterministicScore(candidate: any, requiredQty?: number): number {
    let score = 0.0;

    if (candidate.INBOUND_DELIVERY) score += 0.4;

    const today = new Date();
    const date = new Date(candidate.DOC_DATE || candidate.PO_DATE || candidate.INBOUND_DATE || today);
    const ageDays = (today.getTime() - date.getTime()) / (1000 * 3600 * 24);
    const ageFactor = Math.min(ageDays / 365, 1.0);
    score += 0.3 * ageFactor;

    if (requiredQty != null) {
        const openQty = Number(candidate.OPEN_QTY ?? candidate.ORDER_QTY ?? candidate.DELIVERY_QTY ?? 0);
        if (openQty > 0) {
            const ratio = requiredQty / openQty;
            const qtyScore = 1 - Math.min(Math.abs(1 - ratio), 1);
            score += 0.3 * qtyScore;
        }
    }

    return Math.min(score, 1.0);
}

/**
 * Resolver implementations
 */
export async function PoLineItemResolver(
    input: ResolverInput,
    tx: Transaction
): Promise<ResolverResult> {
    const { ocrTextOuter, scanTimestamp } = input;

    const mfrPart = extractMaterialNumber(ocrTextOuter);
    const quantity = extractQuantity(ocrTextOuter);
    const vendorId = extractVendor(ocrTextOuter);

    if (!mfrPart || !quantity) {
        return { status: 'NO_MATCH' };
    }

    const PO_DATA = tx.entities['PO_DATA'];

    const where: any = {
        VENDOR_MAT: mfrPart,
        STATUS: { '!=': 'CLOSED' },
    };

    if (vendorId) {
        where.VENDOR_ID = vendorId;
    }

    const rawCandidates = await tx.run(SELECT.from(PO_DATA).where(where));

    if (!rawCandidates || rawCandidates.length === 0) {
        return { status: 'NO_MATCH' };
    }

    const filtered = applyQuantityAndDateRules(rawCandidates, quantity, scanTimestamp);

    if (!filtered || filtered.length === 0) {
        return { status: 'NO_MATCH' };
    }

    if (filtered.length === 1) {
        const c = filtered[0];
        const key = `${c.PO_NUMBER}/${c.PO_ITEM}`;

        return {
            status: 'RESOLVED',
            decision: {
                source: 'PO',
                key,
                storageLocation: c.STORAGE_LOCATION,
                confidence: 1.0,
                citations: [
                    `PO_DATA(PO=${c.PO_NUMBER},ITEM=${c.PO_ITEM})`,
                    vendorId ? `VENDOR(VENDOR_ID=${vendorId})` : `MFR_PART(MFR=${mfrPart})`,
                ],
                explanation:
                    'Matched on manufacturer part number, quantity, and sane date window (PO line item resolver).',
            },
        };
    }

    const ranked = rankByInboundThenAge(filtered);

    if (isClearlyBest(ranked)) {
        const top = ranked[0];
        const key = `${top.PO_NUMBER}/${top.PO_ITEM}`;
        const confidence = computeDeterministicScore(top, quantity);

        return {
            status: 'RESOLVED',
            decision: {
                source: 'PO',
                key,
                storageLocation: top.STORAGE_LOCATION,
                confidence,
                citations: [
                    `PO_DATA(PO=${top.PO_NUMBER},ITEM=${top.PO_ITEM})`,
                    vendorId ? `VENDOR(VENDOR_ID=${vendorId})` : `MFR_PART(MFR=${mfrPart})`,
                ],
                explanation:
                    'Multiple PO line-item candidates; selected best match based on inbound-delivery presence, document age, and quantity fit.',
            },
        };
    }

    return {
        status: 'CANDIDATES',
        candidates: ranked.map((c: any) => ({
            source: 'PO',
            key: `${c.PO_NUMBER}/${c.PO_ITEM}`,
            storageLocation: c.STORAGE_LOCATION,
            confidence: computeDeterministicScore(c, quantity),
            citations: [
                `PO_DATA(PO=${c.PO_NUMBER},ITEM=${c.PO_ITEM})`,
                vendorId ? `VENDOR(VENDOR_ID=${vendorId})` : `MFR_PART(MFR=${mfrPart})`,
            ],
            explanation:
                'Deterministic PO line-item candidate; to be disambiguated by other resolvers or the probabilistic LLM step.',
        })),
    };
}

export async function MaintenanceOrderResolver(
    input: ResolverInput,
    tx: Transaction
): Promise<ResolverResult> {
    const { ocrTextInner, scanTimestamp } = input;

    if (!ocrTextInner || !ocrTextInner.trim()) {
        return { status: 'NO_MATCH' };
    }

    const maintOrder = extractMaintenanceOrderNumber(ocrTextInner);
    if (!maintOrder) {
        return { status: 'NO_MATCH' };
    }

    const MAINT_ORDER_LINK = tx.entities['MAINT_ORDER_LINK'];

    const rawCandidates = await tx.run(
        SELECT.from(MAINT_ORDER_LINK).where({
            MAINT_ORDER: maintOrder,
            STATUS: { '!=': 'CLOSED' }
        })
    );

    if (!rawCandidates || rawCandidates.length === 0) {
        return { status: 'NO_MATCH' };
    }

    const filtered = applyQuantityAndDateRules(rawCandidates, 1, scanTimestamp);
    const candidates = filtered.length > 0 ? filtered : rawCandidates;

    if (candidates.length === 1) {
        const c = candidates[0];

        const key =
            c.INBOUND_DELIVERY && c.PO_NUMBER && c.PO_ITEM
                ? `${c.PO_NUMBER}/${c.PO_ITEM}@${c.INBOUND_DELIVERY}`
                : `MO/${maintOrder}`;

        return {
            status: 'RESOLVED',
            decision: {
                source: 'MAINT_ORDER',
                key,
                storageLocation: c.STORAGE_LOCATION,
                confidence: 1.0,
                citations: [
                    `MAINT_ORDER_LINK(MO=${maintOrder})`,
                    c.PO_NUMBER && c.PO_ITEM
                        ? `PO_DATA(PO=${c.PO_NUMBER},ITEM=${c.PO_ITEM})`
                        : `INBOUND_DELIVERY(${c.INBOUND_DELIVERY})`,
                ],
                explanation:
                    'Resolved via maintenance order linkage to inbound delivery / PO; routed to maintenance staging storage location.',
            },
        };
    }

    const ranked = rankByInboundThenAge(candidates);

    if (isClearlyBest(ranked)) {
        const top = ranked[0];

        const key =
            top.INBOUND_DELIVERY && top.PO_NUMBER && top.PO_ITEM
                ? `${top.PO_NUMBER}/${top.PO_ITEM}@${top.INBOUND_DELIVERY}`
                : `MO/${maintOrder}`;

        const confidence = computeDeterministicScore(top);

        return {
            status: 'RESOLVED',
            decision: {
                source: 'MAINT_ORDER',
                key,
                storageLocation: top.STORAGE_LOCATION,
                confidence,
                citations: [
                    `MAINT_ORDER_LINK(MO=${maintOrder})`,
                    top.PO_NUMBER && top.PO_ITEM
                        ? `PO_DATA(PO=${top.PO_NUMBER},ITEM=${top.PO_ITEM})`
                        : `INBOUND_DELIVERY(${top.INBOUND_DELIVERY})`,
                ],
                explanation:
                    'Multiple maintenance-order-linked candidates; selected best match based on inbound-delivery presence and document age.',
            },
        };
    }

    return {
        status: 'CANDIDATES',
        candidates: ranked.map((c: any) => ({
            source: 'MAINT_ORDER',
            key:
                c.INBOUND_DELIVERY && c.PO_NUMBER && c.PO_ITEM
                    ? `${c.PO_NUMBER}/${c.PO_ITEM}@${c.INBOUND_DELIVERY}`
                    : `MO/${maintOrder}`,
            storageLocation: c.STORAGE_LOCATION,
            confidence: computeDeterministicScore(c),
            citations: [
                `MAINT_ORDER_LINK(MO=${maintOrder})`,
                c.PO_NUMBER && c.PO_ITEM
                    ? `PO_DATA(PO=${c.PO_NUMBER},ITEM=${c.PO_ITEM})`
                    : `INBOUND_DELIVERY(${c.INBOUND_DELIVERY})`,
            ],
            explanation:
                'Candidate from maintenance order linkage; to be refined by downstream resolvers or probabilistic LLM.',
        })),
    };
}

export async function MaterialOnlyResolver(
    input: ResolverInput,
    tx: Transaction
): Promise<ResolverResult> {
    const { ocrTextOuter, scanTimestamp } = input;

    const materialId = extractMaterialNumber(ocrTextOuter);
    const quantity = extractQuantity(ocrTextOuter);
    const vendorId = extractVendor(ocrTextOuter);

    if (!materialId || !quantity) {
        return { status: 'NO_MATCH' };
    }

    const PO_DATA = tx.entities['PO_DATA'];

    const where: any = {
        MATERIAL_ID: materialId,
        STATUS: { '!=': 'CLOSED' },
    };

    if (vendorId) {
        where.VENDOR_ID = vendorId;
    }

    const rawCandidates = await tx.run(SELECT.from(PO_DATA).where(where));

    if (!rawCandidates || rawCandidates.length === 0) {
        return { status: 'NO_MATCH' };
    }

    const filtered = applyQuantityAndDateRules(rawCandidates, quantity, scanTimestamp);

    if (!filtered || filtered.length === 0) {
        return { status: 'NO_MATCH' };
    }

    if (filtered.length === 1) {
        const c = filtered[0];
        const key = `${c.PO_NUMBER}/${c.PO_ITEM}`;

        return {
            status: 'RESOLVED',
            decision: {
                source: 'MATERIAL',
                key,
                storageLocation: c.STORAGE_LOCATION,
                confidence: 1.0,
                citations: [
                    `PO_DATA(PO=${c.PO_NUMBER},ITEM=${c.PO_ITEM})`,
                    vendorId ? `VENDOR(VENDOR_ID=${vendorId})` : `MATERIAL(MAT=${materialId})`,
                ],
                explanation:
                    'Matched on internal material number, quantity, and sane date window (material-only resolver).',
            },
        };
    }

    const ranked = rankByInboundThenAge(filtered);

    if (isClearlyBest(ranked)) {
        const top = ranked[0];
        const key = `${top.PO_NUMBER}/${top.PO_ITEM}`;
        const confidence = computeDeterministicScore(top, quantity);

        return {
            status: 'RESOLVED',
            decision: {
                source: 'MATERIAL',
                key,
                storageLocation: top.STORAGE_LOCATION,
                confidence,
                citations: [
                    `PO_DATA(PO=${top.PO_NUMBER},ITEM=${top.PO_ITEM})`,
                    vendorId ? `VENDOR(VENDOR_ID=${vendorId})` : `MATERIAL(MAT=${materialId})`,
                ],
                explanation:
                    'Multiple material-only candidates; selected best match based on inbound-delivery presence, document age, and quantity fit.',
            },
        };
    }

    return {
        status: 'CANDIDATES',
        candidates: ranked.map((c: any) => ({
            source: 'MATERIAL',
            key: `${c.PO_NUMBER}/${c.PO_ITEM}`,
            storageLocation: c.STORAGE_LOCATION,
            confidence: computeDeterministicScore(c, quantity),
            citations: [
                `PO_DATA(PO=${c.PO_NUMBER},ITEM=${c.PO_ITEM})`,
                vendorId ? `VENDOR(VENDOR_ID=${vendorId})` : `MATERIAL(MAT=${materialId})`,
            ],
            explanation:
                'Deterministic material-only candidate; to be disambiguated by other resolvers or the probabilistic LLM step.',
        })),
    };
}

export async function resolvePutaway(input: ResolverInput, tx: Transaction): Promise<any> {
    const resolvers = [
        PoLineItemResolver,
        MaintenanceOrderResolver,
        MaterialOnlyResolver
    ];

    let allCandidates: CandidateMatch[] = [];

    for (const resolver of resolvers) {
        const result = await resolver(input, tx);

        if (result.status === 'RESOLVED') {
            return {
                type: 'DETERMINISTIC',
                decision: result.decision
            };
        }

        if (result.status === 'CANDIDATES') {
            allCandidates = allCandidates.concat(result.candidates);
        }
    }

    // If we get here, deterministic logic didn't fully resolve it
    return await runProbabilisticStep(input, allCandidates, tx);
}

async function runProbabilisticStep(
    input: ResolverInput,
    deterministicCandidates: CandidateMatch[],
    tx: Transaction
): Promise<any> {
    // TODO: Implement LLM integration
    // For now, we'll just return the first candidate if available, or unresolved otherwise
    if (deterministicCandidates.length > 0) {
        const topCandidate = deterministicCandidates[0];
        return {
            type: 'PROBABILISTIC',
            decision: {
                ...topCandidate,
                confidence: 0.7, // Arbitrary confidence score
                explanation: 'Selected by probabilistic step (placeholder implementation).'
            }
        };
    }

    return {
        type: 'UNRESOLVED',
        action: 'GRIEF_EVENT_EMITTED'
    };
}

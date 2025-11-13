const cds = require('@sap/cds')
import { retry, safeSendToAICore } from "./utils/AICore";
import { Request } from '@sap/cds';
import { GRIEF_RECORD } from "#cds-models/GriefReliefService";
import { ResolverInput, resolvePutaway } from './resolvers';

const LOG = cds.log('code', 'info')

module.exports = cds.service.impl(async function (this: any) {


    const { submit } = GRIEF_RECORD.actions;

    this.on(submit, async (req: Request) => {
        const tx = cds.transaction(req);
        const grieveRecord = await tx.run(SELECT.one.from(req.subject));
        
        if (!grieveRecord) {
            req.error(400, 'Grief record not found');
            return;
        }

        const input: ResolverInput = {
            ocrTextOuter: grieveRecord.OCR_LABEL_TEXT,
            ocrTextInner: grieveRecord.OCR_LABEL_TEXT, // Assuming inner and outer are the same for now
            images: [grieveRecord.IMAGE_URL],
            scanTimestamp: new Date().toISOString()
        };

        try {
            const result = await resolvePutaway(input, tx);
            
            if (result.type === 'DETERMINISTIC' || result.type === 'PROBABILISTIC') {
                await tx.run(UPDATE(GRIEF_RECORD).set({
                    RESOLVED_STORAGE_LOC: result.decision.storageLocation,
                    STATUS: 'RESOLVED',
                    AGENT_ATTEMPTED: true,
                    AGENT_CONFIDENCE: result.decision.confidence
                }).where({ GRIEF_ID: grieveRecord.GRIEF_ID }));

                return { success: true, message: 'Putaway location resolved', result };
            } else {
                await tx.run(UPDATE(GRIEF_RECORD).set({
                    STATUS: 'UNRESOLVED',
                    AGENT_ATTEMPTED: true,
                    AGENT_CONFIDENCE: 0
                }).where({ GRIEF_ID: grieveRecord.GRIEF_ID }));

                return { success: false, message: 'Unable to resolve putaway location', result };
            }
        } catch (error) {
            LOG.error('Error in submit action:', error);
            req.error(500, 'Internal server error during putaway resolution');
        }
    });

    // const {selectMaterial} = LineItemCMIRCandidate.actions;

    // this.on(selectMaterial, async (req : Request) => {
    // const selectedCandidate = await SELECT.one.from(req.subject)
    // .columns(c => {
    // c.lineitem((li: { ID: string; }) => { li.ID }),
    // c.mapping((m: CMIRMapping) => {m.supplierMaterialNumber})
    // });
    // await UPDATE(LineItems).byKey(selectedCandidate.lineitem.ID).set({'sapMaterialNumber': selectedCandidate.mapping.supplierMaterialNumber, materialSelectionReason: 'User match'})
    // })


    // this.after('READ', PurchaseOrders, async (results: any, req: Request) => {
    // if (!results) return;
    // const purchaseOrders = Array.isArray(results) ? results : [results];
    // for (const po of purchaseOrders) {
    // if (po.ID) {
    // // Get all line items for this purchase order
    // const lineItems = await SELECT.from(LineItems).where({ purchaseOrder_ID: po.ID });
    // // Calculate total count
    // po.totalLineItemsCount = lineItems.length;
    // // Calculate count with SAP material number
    // po.lineItemsWithSapMaterialCount = lineItems.filter(item =>
    // item.sapMaterialNumber && item.sapMaterialNumber.trim() !== ''
    // ).length;
    // // Calculate count without SAP material number
    // po.lineItemsWithoutSapMaterialCount = lineItems.filter(item =>
    // !item.sapMaterialNumber || item.sapMaterialNumber.trim() === ''
    // ).length;

    // //TODO add pdfContent from dox, only if the property is requested
    // if(wants(req, 'pdfContent')) {
    // const dox = await cds.connect.to('DOX-PREMIUM');
    // try {

    // const { data: ab } = await executeHttpRequest(
    // { destinationName: 'DOX-PREMIUM' },
    // { method: 'GET', url: `/document-information-extraction/v1/document/jobs/${po.ID}/file?clientId=${dox.options.CLIENT}`, responseType: 'arraybuffer' }
    // );
    // const buf = Buffer.from(ab);

    // console.log('type=', typeof buf, 'isBuffer=', Buffer.isBuffer(buf),
    // 'ctor=', Object.prototype.toString.call(buf));
    // po.pdfContent = Readable.from(buf);
    // } catch (error) {
    // LOG.error(`Error fetching PDF for PO ${po.ID}:`, error);
    // po.pdfContent = null;
    // }
    // }
    // }
    // }
    // });

    this.on('review', async (req: Request) => {
        const ID = req.params[0].ID

        const purchaseOrder = await cds.db.run(SELECT.one.from('PurchaseOrders').where({ ID: ID }));

        const previousHumanReviewedPOsForCustomer = await cds.db.run(
            SELECT.from('PurchaseOrders')
                .where({ extractionReviewStatus: 'human reviewed', senderName: purchaseOrder.senderName })
                .orderBy('createdAt desc')
                .limit(3)
        )

        const template = `You are reviewing pdf extraction results for purchase orders. You are responsible to make sure the extracted data does not have extraction mistakes. To assist you in the assessment you are provided with up to the latest 3 documents that passed human review for this customer. You need to respond with a list of attributes to check and a concise note whether there is a risk of an extraction error for this purchase order. If you don't have context, don't make assumptions.
---

previous purchase orders:
${JSON.stringify(previousHumanReviewedPOsForCustomer)}

---

Purchase Order to be reviewed by you:

${JSON.stringify(purchaseOrder)}

structure the response in JSON format:
{
"assessment": <your assessment as string>
}
`

        // depending on model check the payload here https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/consume-generative-ai-models-using-sap-ai-core
        const payload = {
            messages: [{ role: "user", content: template }],
            max_completion_tokens: 16000,
        };

        const safeResponse = await safeSendToAICore<{ assessment: String }>(payload)
        if (safeResponse.success) {
            const poAssessment: { assessment: String } = safeResponse.parsedData
            LOG.info(safeResponse.parsedData);
            const tx = cds.tx(req);
            await tx.run(
                UPSERT.into('PurchaseOrders')
                    .entries({ ID: ID, aiExtractionReview: JSON.stringify(poAssessment.assessment), extractionReviewStatus: 'AI reviewed' })
            );
        }
        else {
            LOG.error(`❗❗❗❗❗❗❗ AI Core error for purchase order`)
        }
    })

    // this.on('SyncDOX', async () => {
    // const dox = await cds.connect.to('DOX-PREMIUM');
    // const jobListResponse = await dox.send({
    // query: `GET /document-information-extraction/v1/document/jobs?clientId=${dox.options.CLIENT}`,
    // });

    // const dbList = await cds.db.run(SELECT.from('PurchaseOrders'))
    // const dbPOIDs = dbList.map((po: { ID: any; }) => po.ID)

    // for(let extractedPO of jobListResponse.results) {
    // if( !dbPOIDs.includes(extractedPO.id) ) {
    // const jobResultResponse = await dox.send({
    // query: `GET /document-information-extraction/v1/document/jobs/${extractedPO.id}?returnNullValues=true&clientId=${dox.options.CLIENT}`,
    // });
    // LOG.debug(JSON.stringify(jobResultResponse))

    // // Helper function to find header field value by name
    // const getHeaderFieldValue = (fieldName: string) => {
    // const field = jobResultResponse.extraction.headerFields?.find((f: { name: string; }) => f.name === fieldName);
    // return field ? field.value : null;
    // };

    // // Helper function to convert string to number or null
    // const parseNumericValue = (value: any) => {
    // if (value === null || value === undefined || value === '') {
    // return null;
    // }
    // const parsed = parseFloat(value);
    // return isNaN(parsed) ? null : parsed;
    // };

    // // Extract header fields from the new schema format
    // const headerData = {
    // senderPostalCode: getHeaderFieldValue('senderPostalCode'),
    // senderState: getHeaderFieldValue('senderState'),
    // senderStreet: getHeaderFieldValue('senderStreet'),
    // documentDate: getHeaderFieldValue('documentDate'),
    // documentNumber: getHeaderFieldValue('documentNumber'),
    // grossAmount: parseNumericValue(getHeaderFieldValue('grossAmount')),
    // netAmount: parseNumericValue(getHeaderFieldValue('netAmount')),
    // paymentTerms: getHeaderFieldValue('paymentTerms'),
    // senderAddress: getHeaderFieldValue('senderAddress'),
    // senderCity: getHeaderFieldValue('senderCity'),
    // senderCountryCode: getHeaderFieldValue('senderCountryCode'),
    // senderFax: getHeaderFieldValue('senderFax'),
    // senderId: getHeaderFieldValue('senderId'),
    // senderName: getHeaderFieldValue('senderName'),
    // senderPhone: getHeaderFieldValue('senderPhone'),
    // shipToAddress: getHeaderFieldValue('shipToAddress'),
    // shipToCity: getHeaderFieldValue('shipToCity'),
    // shipToCountryCode: getHeaderFieldValue('shipToCountryCode'),
    // shipToFax: getHeaderFieldValue('shipToFax'),
    // shipToName: getHeaderFieldValue('shipToName'),
    // shipToPhone: getHeaderFieldValue('shipToPhone'),
    // shipToPostalCode: getHeaderFieldValue('shipToPostalCode'),
    // shipToState: getHeaderFieldValue('shipToState'),
    // shipToStreet: getHeaderFieldValue('shipToStreet'),
    // shippingTerms: getHeaderFieldValue('shippingTerms')
    // };

    // const filename = jobResultResponse.fileName || 'unknown';

    // // Insert Purchase Order
    // try {
    // const poEntry = {
    // ID: extractedPO.id,
    // extractionReviewStatus: 'not reviewed',
    // paymentStatus: 'unpaid',
    // filename: filename,
    // sender_name: headerData.senderName, // Set up the association key
    // customer_ID: null as string | null,
    // customerReason: null as string | null,
    // ...headerData
    // };

    // const {customerId, reason} = await findCustomerByContext(JSON.stringify(poEntry));
    // poEntry.customer_ID = customerId;
    // poEntry.customerReason = reason;

    // const insertPOResult = await cds.db.run(INSERT.into('PurchaseOrders').entries(poEntry));
    // LOG.info(`insert purchase order result :: ${JSON.stringify(insertPOResult)}`)

    // // Process line items if they exist
    // if (jobResultResponse.extraction.lineItems && Array.isArray(jobResultResponse.extraction.lineItems)) {
    // for (let lineItemFields of jobResultResponse.extraction.lineItems) {
    // // Helper function to find line item field value by name
    // const getLineItemFieldValue = (fieldName: string) => {
    // const field = lineItemFields.find((f: { name: string; }) => f.name === fieldName);
    // return field ? field.value : null;
    // };

    // const lineItemData = {
    // lineNumber: getLineItemFieldValue('itemNumber'),
    // description: getLineItemFieldValue('description'),
    // netAmount: getLineItemFieldValue('netAmount'),
    // quantity: getLineItemFieldValue('quantity'),
    // unitPrice: getLineItemFieldValue('unitPrice'),
    // supplierMaterialNumber: getLineItemFieldValue('supplierMaterialNumber'),
    // customerMaterialNumber: getLineItemFieldValue('customerMaterialNumber'),
    // purchaseOrder_ID: extractedPO.id
    // };

    // try {
    // const insertLineItemResult = await cds.db.run(INSERT.into('LineItems').entries(lineItemData));
    // LOG.info(`insert line item result :: ${JSON.stringify(insertLineItemResult)}`)
    // } catch (e) {
    // LOG.error("Error when persisting line item", e)
    // }
    // }
    // }
    // if(poEntry.customer_ID != null) {
    // // If a customer has been found, set mapping candidates for line items
    // await setMappingCandidatesForLineItems(poEntry.ID, String(poEntry.customer_ID));
    // }

    // } catch (e) {
    // LOG.error("Error when persisting new purchase order", e)
    // }
    // }
    // }
    // return `sync completed`;
    // })

})

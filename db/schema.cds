namespace lmco.com.grief.app;
entity PO_DATA {
    key PO_NUMBER: String(10);
    key PO_ITEM: String(5);
    DOC_TYPE: String(4);
    VENDOR_ID: String(10);
    MATERIAL_ID: String(18);
    SHORT_TEXT: String(40);
    PLANT: String(4);
    STORAGE_LOCATION: String(4);
    QUANTITY: Decimal(13,3);
    UNIT: String(3);
    DELIVERY_DATE: Date;
    VENDOR_MAT: String(35);
    REFERENCE_LABEL_TEXT: String(2000);
}

entity INBOUND_DELIVERY {
    key DELIVERY_NUMBER: String(10);
    key DELIVERY_ITEM: String(5);
    PO_NUMBER: String(10);
    PO_ITEM: String(5);
    MATERIAL_ID: String(18);
    QUANTITY: Decimal(13,3);
    VENDOR_ID: String(10);
    PLANT: String(4);
    STORAGE_LOCATION: String(4);
    LABEL_TEXT: String(2000);
}

entity MATERIAL_MASTER {
    key MATERIAL_ID: String(18);
    MATERIAL_DESC: String(40);
    PLANT: String(4);
    DEFAULT_STORAGE_LOC: String(4);
    EAN_UPC: String(20);
    ALT_MATERIAL_IDS: String(2000);
    IMAGE_REFERENCE: String(100);
}

entity CUST_MAT_INFO {
    key VENDOR_ID: String(10);
    key MATERIAL_ID: String(18);
    VENDOR_MAT: String(35);
    VENDOR_DESC: String(100);
    STORAGE_LOCATION_OVERRIDE: String(4);
}

entity GRIEF_RECORD {
    key GRIEF_ID: String(10);
    RECEIPT_TIMESTAMP: Timestamp;
    OCR_LABEL_TEXT: String(2000);
    IMAGE_URL: String(200);
    VENDOR_ID: String(10);
    STATUS: String(20);
    RESOLVED_STORAGE_LOC: String(4);
    AGENT_ATTEMPTED: Boolean;
    AGENT_CONFIDENCE: Decimal(5,2);
}

entity MAINTENANCE_ORDER {
    key ORDER_NUMBER: String(12);
    ORDER_TYPE: String(4);
    DESCRIPTION: String(40);
    FUNCTIONAL_LOCATION: String(30);
    EQUIPMENT: String(18);
    PRIORITY: String(1);
    PLANNED_START_DATE: Date;
    PLANNED_END_DATE: Date;
    ACTUAL_START_DATE: Date;
    ACTUAL_END_DATE: Date;
    STATUS: String(4);
    RESPONSIBLE_WORK_CENTER: String(8);
    NOTIFICATION_NUMBER: String(12);
    MATERIAL_ID: String(18);
    QUANTITY: Decimal(13,3);
    UNIT: String(3);
}
using GriefReliefService as service from '../../srv/service';
annotate service.GRIEF_RECORD with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'GRIEF_ID',
                Value : GRIEF_ID,
            },
            {
                $Type : 'UI.DataField',
                Label : 'RECEIPT_TIMESTAMP',
                Value : RECEIPT_TIMESTAMP,
            },
            {
                $Type : 'UI.DataField',
                Label : 'OCR_LABEL_TEXT',
                Value : OCR_LABEL_TEXT,
            },
            {
                $Type : 'UI.DataField',
                Label : 'IMAGE_URL',
                Value : IMAGE_URL,
            },
            {
                $Type : 'UI.DataField',
                Label : 'VENDOR_ID',
                Value : VENDOR_ID,
            },
            {
                $Type : 'UI.DataField',
                Label : 'STATUS',
                Value : STATUS,
            },
            {
                $Type : 'UI.DataField',
                Label : 'RESOLVED_STORAGE_LOC',
                Value : RESOLVED_STORAGE_LOC,
            },
            {
                $Type : 'UI.DataField',
                Label : 'AGENT_ATTEMPTED',
                Value : AGENT_ATTEMPTED,
            },
            {
                $Type : 'UI.DataField',
                Label : 'AGENT_CONFIDENCE',
                Value : AGENT_CONFIDENCE,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'GRIEF_ID',
            Value : GRIEF_ID,
        },
        {
            $Type : 'UI.DataField',
            Label : 'RECEIPT_TIMESTAMP',
            Value : RECEIPT_TIMESTAMP,
        },
        {
            $Type : 'UI.DataField',
            Label : 'OCR_LABEL_TEXT',
            Value : OCR_LABEL_TEXT,
        },
        {
            $Type : 'UI.DataField',
            Label : 'IMAGE_URL',
            Value : IMAGE_URL,
        },
        {
            $Type : 'UI.DataField',
            Label : 'VENDOR_ID',
            Value : VENDOR_ID,
        },
    ],
    UI.Identification : [
        {
            $Type : 'UI.DataFieldForAction',
            Action : 'GriefReliefService.submit',
            Label : 'submit',
        },
    ],
);

